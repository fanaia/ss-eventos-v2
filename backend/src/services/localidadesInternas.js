"use strict";

const https = require("node:https");

const TAMANHO_LOTE = 500;
const TOTAL_ESTADOS = 27;
const MINIMO_MUNICIPIOS = 5500;
const TENTATIVAS_MS = [0, 10_000, 60_000];
const URL_ESTADOS = "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome";
const URL_MUNICIPIOS = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome";

function baixarJson(url, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      { headers: { Accept: "application/json", "User-Agent": "ss-eventos-v2-localidades/1.0" } },
      (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          baixarJson(new URL(response.headers.location, url).toString(), timeoutMs).then(resolve, reject);
          return;
        }
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`IBGE retornou HTTP ${response.statusCode} para ${url}.`));
          return;
        }

        const partes = [];
        response.on("data", (parte) => partes.push(parte));
        response.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(partes).toString("utf8")));
          } catch (error) {
            reject(new Error(`Resposta inválida da API do IBGE: ${error.message}`));
          }
        });
      },
    );

    request.setTimeout(timeoutMs, () => request.destroy(new Error("Timeout ao consultar a API do IBGE.")));
    request.on("error", reject);
  });
}

function normalizarLocalidades(estadosOrigem, municipiosOrigem) {
  const estados = estadosOrigem
    .map((estado) => ({
      codigoIbge: String(estado.id),
      uf: String(estado.sigla),
      nome: String(estado.nome),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const cidades = municipiosOrigem
    .map((municipio) => ({
      codigoIbge: String(municipio.id),
      codigoUf: String(municipio.id).slice(0, 2),
      nome: String(municipio.nome),
    }))
    .sort((a, b) => a.codigoUf.localeCompare(b.codigoUf) || a.nome.localeCompare(b.nome, "pt-BR"));

  if (estados.length !== TOTAL_ESTADOS) {
    throw new Error(`Quantidade inesperada de estados recebida do IBGE: ${estados.length}.`);
  }
  if (cidades.length < MINIMO_MUNICIPIOS) {
    throw new Error(`Quantidade inesperada de municípios recebida do IBGE: ${cidades.length}.`);
  }

  const codigosEstados = new Set(estados.map((estado) => estado.codigoIbge));
  const codigosCidades = new Set(cidades.map((cidade) => cidade.codigoIbge));
  if (codigosEstados.size !== estados.length) throw new Error("A API do IBGE retornou estados duplicados.");
  if (codigosCidades.size !== cidades.length) throw new Error("A API do IBGE retornou municípios duplicados.");

  const cidadeSemEstado = cidades.find((cidade) => !codigosEstados.has(cidade.codigoUf));
  if (cidadeSemEstado) {
    throw new Error(`UF ${cidadeSemEstado.codigoUf} não encontrada para ${cidadeSemEstado.nome}.`);
  }

  return { estados, cidades };
}

async function obterLocalidadesOficiais() {
  const [estados, municipios] = await Promise.all([
    baixarJson(URL_ESTADOS),
    baixarJson(URL_MUNICIPIOS),
  ]);
  return normalizarLocalidades(estados, municipios);
}

async function executarEmLotes(itens, executar, tamanho = TAMANHO_LOTE) {
  for (let inicio = 0; inicio < itens.length; inicio += tamanho) {
    await executar(itens.slice(inicio, inicio + tamanho));
  }
}

async function sincronizarEstados(Estado, localidades) {
  await Estado.bulkWrite(
    localidades.estados.map((estado) => ({
      updateOne: {
        filter: { uf: estado.uf },
        update: {
          $set: {
            codigoIbge: estado.codigoIbge,
            uf: estado.uf,
            nome: estado.nome,
            status: "Ativo",
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  await Estado.updateMany(
    { uf: { $nin: localidades.estados.map((estado) => estado.uf) } },
    { $set: { status: "Inativo" } },
  );

  const estados = await Estado.find({ status: "Ativo" })
    .select("_id codigoIbge uf")
    .lean();

  return new Map(estados.map((estado) => [String(estado.codigoIbge), estado._id]));
}

async function sincronizarCidades(Cidade, estadosPorCodigo, localidades) {
  const cidadesExistentes = await Cidade.find({})
    .select("_id codigoIbge nome estadoId")
    .lean();

  const porCodigo = new Map(
    cidadesExistentes
      .filter((cidade) => cidade.codigoIbge)
      .map((cidade) => [String(cidade.codigoIbge), cidade]),
  );
  const porNomeEstado = new Map(
    cidadesExistentes.map((cidade) => [
      `${String(cidade.estadoId)}::${String(cidade.nome).trim().toLocaleLowerCase("pt-BR")}`,
      cidade,
    ]),
  );

  const operacoes = localidades.cidades.map((cidade) => {
    const estadoId = estadosPorCodigo.get(String(cidade.codigoUf));
    if (!estadoId) throw new Error(`UF ${cidade.codigoUf} não encontrada para a cidade ${cidade.nome}.`);

    const existente = porCodigo.get(cidade.codigoIbge)
      || porNomeEstado.get(`${String(estadoId)}::${cidade.nome.trim().toLocaleLowerCase("pt-BR")}`);

    return {
      updateOne: {
        filter: existente ? { _id: existente._id } : { codigoIbge: cidade.codigoIbge },
        update: {
          $set: {
            estadoId,
            nome: cidade.nome,
            codigoIbge: cidade.codigoIbge,
            status: "Ativo",
          },
        },
        upsert: true,
      },
    };
  });

  await executarEmLotes(operacoes, (lote) => Cidade.bulkWrite(lote, { ordered: false }));

  await Cidade.updateMany(
    {
      $or: [
        { codigoIbge: { $exists: false } },
        { codigoIbge: { $nin: localidades.cidades.map((cidade) => cidade.codigoIbge) } },
      ],
    },
    { $set: { status: "Inativo" } },
  );
}

async function cacheValido(Estado, Cidade) {
  const [estados, cidades] = await Promise.all([
    Estado.countDocuments({ status: "Ativo" }),
    Cidade.countDocuments({ status: "Ativo" }),
  ]);
  return estados === TOTAL_ESTADOS && cidades >= MINIMO_MUNICIPIOS;
}

async function sincronizarLocalidades({ Estado, Cidade, obterLocalidades = obterLocalidadesOficiais }) {
  if (!Estado || !Cidade) throw new Error("Models Estado e Cidade precisam estar registradas antes da sincronização.");

  let localidades;
  try {
    localidades = await obterLocalidades();
  } catch (error) {
    if (await cacheValido(Estado, Cidade)) {
      console.warn(`API do IBGE indisponível; mantendo a lista interna existente. Motivo: ${error.message}`);
      return { origem: "cache" };
    }
    throw error;
  }

  const estadosPorCodigo = await sincronizarEstados(Estado, localidades);
  await sincronizarCidades(Cidade, estadosPorCodigo, localidades);

  console.log(
    `Localidades internas sincronizadas pelo IBGE: ${localidades.estados.length} estados e ${localidades.cidades.length} cidades.`,
  );
  return { origem: "ibge", ...localidades };
}

function agendarSincronizacao({ connection, obterModels }) {
  let concluida = false;
  let executando = false;

  const executar = async (tentativa = 0) => {
    if (concluida || executando) return;
    executando = true;
    try {
      await sincronizarLocalidades(obterModels());
      concluida = true;
    } catch (error) {
      const proxima = tentativa + 1;
      console.error(
        `Falha ao sincronizar localidades internas (${proxima}/${TENTATIVAS_MS.length}):`,
        error.message,
      );
      if (proxima < TENTATIVAS_MS.length) {
        setTimeout(() => executar(proxima), TENTATIVAS_MS[proxima]);
      }
    } finally {
      executando = false;
    }
  };

  const iniciar = () => setTimeout(() => executar(0), TENTATIVAS_MS[0]);
  if (connection.readyState === 1) iniciar();
  else connection.once("open", iniciar);
}

module.exports = {
  TAMANHO_LOTE,
  TOTAL_ESTADOS,
  MINIMO_MUNICIPIOS,
  URL_ESTADOS,
  URL_MUNICIPIOS,
  baixarJson,
  normalizarLocalidades,
  obterLocalidadesOficiais,
  executarEmLotes,
  sincronizarEstados,
  sincronizarCidades,
  cacheValido,
  sincronizarLocalidades,
  agendarSincronizacao,
};
