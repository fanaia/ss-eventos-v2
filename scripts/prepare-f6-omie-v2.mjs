import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const absolute = (relativePath) => path.join(root, relativePath);
const readJson = (relativePath) => JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
const writeJson = (relativePath, value) => fs.writeFileSync(absolute(relativePath), `${JSON.stringify(value, null, 2)}\n`);
const readText = (relativePath) => fs.readFileSync(absolute(relativePath), "utf8");
const writeText = (relativePath, value) => {
  fs.mkdirSync(path.dirname(absolute(relativePath)), { recursive: true });
  fs.writeFileSync(absolute(relativePath), value.endsWith("\n") ? value : `${value}\n`);
};
const replaceRequired = (text, search, replacement, label) => {
  const next = text.replace(search, replacement);
  if (next === text) throw new Error(`Não foi possível atualizar ${label}.`);
  return next;
};

const CORE_VERSION = "0.3.58";
const CENTRAL_VERSION = "0.1.5";

for (const relativePath of ["package.json", "backend/package.json", "frontend/package.json"]) {
  const pkg = readJson(relativePath);
  pkg.version = CENTRAL_VERSION;
  if (relativePath === "package.json") pkg.devDependencies["@oondemand/create-central-oon"] = CORE_VERSION;
  if (relativePath === "backend/package.json") pkg.dependencies["@oondemand/oon-core-back"] = CORE_VERSION;
  if (relativePath === "frontend/package.json") pkg.dependencies["@oondemand/oon-core-front"] = CORE_VERSION;
  writeJson(relativePath, pkg);
}

const app = readJson("central.app.json");
app.modules.integrations = true;
app.modules.omie = true;
app.capabilities = [...new Set([...app.capabilities, "core.integrations", "core.integrations.omie"])];
app.compatibility.core.minVersion = CORE_VERSION;
writeJson("central.app.json", app);

const domain = readJson("backend/central.domain.json");
const byName = new Map(domain.models.map((model) => [model.name, model]));
Object.assign(byName.get("ClienteFornecedor").fields, {
  codigoClienteOmie: { kind: "number", label: "Código Cliente/Fornecedor Omie", index: true },
  codigoClienteIntegracao: {
    kind: "string",
    label: "Código de integração Omie",
    searchable: true,
    maxLength: 100,
  },
  omieSincronizadoEm: { kind: "date", label: "Sincronizado no Omie em" },
  omieStatusIntegracao: {
    kind: "enum",
    label: "Status da integração Omie",
    values: ["Não sincronizado", "Pendente", "Sincronizado", "Conflito", "Erro"],
    default: "Não sincronizado",
    index: true,
  },
  omieUltimoErro: { kind: "string", label: "Último erro Omie", maxLength: 1000 },
});
Object.assign(byName.get("Categoria").fields, {
  omieSincronizadoEm: { kind: "date", label: "Categoria Omie sincronizada em" },
});
writeJson("backend/central.domain.json", domain);

writeText("backend/src/mappings/omie.js", `"use strict";

const { defineOmieMapping } = require("@oondemand/oon-core-back");

function somenteDigitos(value) {
  return String(value || "").replace(/\\D+/g, "");
}

function primeiroTexto(record, fields, fallback = "") {
  for (const field of fields) {
    const value = String(record?.[field] ?? "").trim();
    if (value) return value;
  }
  return fallback;
}

function booleanoOmie(value) {
  return ["S", "SIM", "TRUE", "1"].includes(String(value || "").trim().toUpperCase());
}

function mapearClienteOmie(record = {}) {
  const codigo = Number(record.codigo_cliente_omie || record.codigo_cliente || 0) || undefined;
  const documentoOriginal = primeiroTexto(record, ["cnpj_cpf", "documento_exterior", "nif"]);
  const documento = documentoOriginal || \`OMIE-\${codigo || "SEM-CODIGO"}\`;
  const tags = new Set((Array.isArray(record.tags) ? record.tags : [])
    .map((item) => String(item?.tag || item?.cTag || "").trim().toLowerCase())
    .filter(Boolean));
  const exterior = Boolean(record.documento_exterior || record.nif || record.exterior === "S");
  return {
    codigoClienteOmie: codigo,
    codigoClienteIntegracao: String(record.codigo_cliente_integracao || "").trim(),
    nome: primeiroTexto(
      record,
      ["nome_fantasia", "razao_social", "nome", "descricao", "cNome", "cRazaoSocial"],
      \`Cadastro Omie \${codigo || "sem código"}\`,
    ),
    tipo: exterior ? "Est" : somenteDigitos(documento).length === 11 ? "PF" : "PJ",
    documento,
    cliente: tags.has("cliente") || (!tags.has("fornecedor") && tags.size === 0),
    fornecedor: tags.has("fornecedor"),
    origem: "Omie",
    status: record.inativo === "S" ? "Inativo" : "Ativo",
    omieSincronizadoEm: new Date(),
    omieStatusIntegracao: "Sincronizado",
    omieUltimoErro: "",
  };
}

function mapearCategoriaOmie(record = {}) {
  const contaInativa = booleanoOmie(record.conta_inativa);
  const codigo = String(record.codigo || "").trim();
  const descricao = String(record.descricao || record.descricao_padrao || "").trim();
  return {
    codigoCategoriaOmie: codigo,
    nome: descricao || \`Categoria Omie \${codigo}\`,
    descricao,
    status: contaInativa ? "Inativo" : "Ativo",
    omieSincronizadoEm: new Date(),
  };
}

async function registrarEventoFinanceiro(event, context = {}) {
  const summary = {
    accepted: true,
    eventType: event.payload?.eventType || event.payload?.topic || "evento-financeiro",
    aggregateId: event.aggregateId || "",
    instanceId: event.payload?.instanceId || "default",
  };
  context.recordItem?.(summary);
  return summary;
}

defineOmieMapping("ss-eventos-v2", {
  instances: [{ id: "default", label: "Omie SS Eventos" }],
  calls: {
    "testar-conexao": {
      label: "Testar conexão com o Omie",
      endpoint: "geral/clientes/",
      call: "ListarClientes",
      param: [{ pagina: 1, registros_por_pagina: 1, apenas_importado_api: "N" }],
      connectionTest: true,
    },
    "listar-clientes-prestadores": {
      label: "Listar clientes e prestadores",
      endpoint: "geral/clientes/",
      call: "ListarClientes",
      param: [{
        pagina: "$input.page",
        registros_por_pagina: "$input.pageSize",
        apenas_importado_api: "N",
      }],
      pagination: {
        itemsPath: "clientes_cadastro",
        totalPagesPath: "total_de_paginas",
        pageSize: 100,
      },
    },
    "listar-categorias": {
      label: "Listar categorias financeiras",
      endpoint: "geral/categorias/",
      call: "ListarCategorias",
      param: [{ pagina: "$input.page", registros_por_pagina: "$input.pageSize" }],
      pagination: {
        itemsPath: "categoria_cadastro",
        totalPagesPath: "total_de_paginas",
        pageSize: 100,
      },
    },
    "listar-contas-correntes": {
      label: "Listar contas correntes",
      endpoint: "geral/contacorrente/",
      call: "ListarContasCorrentes",
      param: [{
        pagina: "$input.page",
        registros_por_pagina: "$input.pageSize",
        apenas_importado_api: "N",
      }],
      pagination: {
        itemsPath: "ListarContasCorrentes",
        totalPagesPath: "total_de_paginas",
        pageSize: 100,
      },
    },
    "alterar-cliente-prestador": {
      label: "Alterar cliente ou prestador",
      endpoint: "geral/clientes/",
      call: "AlterarCliente",
      param: { $path: "$input.param", default: [{}] },
    },
    "incluir-conta-pagar": {
      label: "Incluir ou atualizar conta a pagar",
      endpoint: "financas/contapagar/",
      call: "UpsertContaPagar",
      param: { $path: "$input.param", default: [{}] },
    },
    "consultar-conta-pagar": {
      label: "Consultar conta a pagar",
      endpoint: "financas/contapagar/",
      call: "ConsultarContaPagar",
      param: { $path: "$input.param", default: [{}] },
    },
  },
  lists: [
    {
      key: "clientes-prestadores",
      label: "Clientes / Prestadores",
      description: "Sincroniza os cadastros usados pela Central sem runtime técnico local.",
      call: "listar-clientes-prestadores",
      mode: "full",
      direction: "bidirectional",
      target: {
        model: "ClienteFornecedor",
        externalKey: "codigoClienteOmie",
        activeField: "status",
        inactiveValue: "Inativo",
      },
      mapping: mapearClienteOmie,
      policies: { create: true, update: true, inactivate: true, conflict: "remote-wins" },
      batchSize: 100,
      includeInFullSync: true,
      order: 10,
    },
    {
      key: "categorias-financeiras",
      label: "Categorias financeiras Omie",
      description: "Sincroniza a lista Omie diretamente com as categorias declaradas pela SS Eventos.",
      call: "listar-categorias",
      mode: "full",
      direction: "inbound",
      target: {
        model: "Categoria",
        externalKey: "codigoCategoriaOmie",
        activeField: "status",
        inactiveValue: "Inativo",
      },
      mapping: mapearCategoriaOmie,
      policies: { create: true, update: true, inactivate: true, conflict: "remote-wins" },
      batchSize: 100,
      includeInFullSync: true,
      order: 20,
    },
  ],
  webhooks: [
    {
      eventType: "Financas.ContaPagar.Alterado",
      resource: "contas-pagar",
      actions: [{
        handler: "SS_EVENTOS_OMIE_FINANCEIRO",
        aggregateType: "Pagamento",
        aggregateIdPath: "codigo_lancamento_integracao",
        payload: {
          eventType: "$event.eventType",
          topic: "$payload.topic",
          codigoLancamentoOmie: "$payload.codigo_lancamento_omie",
          codigoLancamentoIntegracao: "$payload.codigo_lancamento_integracao",
          status: "$payload.status_titulo",
          valorPago: "$payload.valor_pago",
          valorPendente: "$payload.valor_pag",
          instanceId: "$instanceId",
        },
      }],
    },
    {
      eventType: "Financas.ContaPagar.BaixaRealizada",
      resource: "contas-pagar",
      actions: [{
        handler: "SS_EVENTOS_OMIE_FINANCEIRO",
        aggregateType: "Pagamento",
        aggregateIdPath: "codigo_lancamento_integracao",
        payload: { $path: "$payload" },
      }],
    },
    {
      eventType: "Financas.ContaPagar.BaixaCancelada",
      resource: "contas-pagar",
      actions: [{
        handler: "SS_EVENTOS_OMIE_FINANCEIRO",
        aggregateType: "Pagamento",
        aggregateIdPath: "codigo_lancamento_integracao",
        payload: { $path: "$payload" },
      }],
    },
  ],
  handlers: {
    SS_EVENTOS_OMIE_FINANCEIRO: registrarEventoFinanceiro,
  },
});

module.exports = {
  booleanoOmie,
  mapearCategoriaOmie,
  mapearClienteOmie,
  registrarEventoFinanceiro,
};
`);

let validator = readText("scripts/validate-manifests.mjs");
validator = replaceRequired(
  validator,
  'if (app.modules?.omie !== false) {\n  fail("O adaptador Omie deve permanecer desabilitado até a Fase 6.");\n}',
  'if (app.modules?.omie !== true) {\n  fail("SS Eventos V2 deve habilitar o adaptador Omie nativo na Fase 6.");\n}',
  "gate modules.omie",
);
validator = replaceRequired(
  validator,
  '  "core.integrations",\n  "domain.computed-fields",',
  '  "core.integrations",\n  "core.integrations.omie",\n  "domain.computed-fields",',
  "capability Omie",
);
validator = validator.replaceAll('"0.3.57"', '"0.3.58"');
validator += `\n\nconst omieMappingPath = "backend/src/mappings/omie.js";\nif (!exists(omieMappingPath)) fail("A Central deve declarar seus mappings Omie.");\nconst omieMappingSource = readText(omieMappingPath);\nfor (const required of ["defineOmieMapping", "listar-clientes-prestadores", "listar-categorias", "listar-contas-correntes", "Financas.ContaPagar.Alterado"]) {\n  if (!omieMappingSource.includes(required)) fail(\`Mapping Omie obrigatório ausente: \${required}.\`);\n}\nfor (const forbidden of ["IntegrationOutbox", "WebhookInbox", "setInterval", "OmieConfiguracao"]) {\n  if (omieMappingSource.includes(forbidden)) fail(\`Runtime técnico Omie não pode ser copiado para a Central: \${forbidden}.\`);\n}\n`;
writeText("scripts/validate-manifests.mjs", validator);

let baseline = readText("scripts/check-baseline-reference.mjs");
baseline = replaceRequired(
  baseline,
  '  if (app.modules?.omie !== false) {\n    fail("o adaptador Omie deve permanecer desabilitado até a Fase 6");\n  }',
  '  if (app.modules?.omie !== true || !app.capabilities?.includes("core.integrations.omie")) {\n    fail("a Fase 6 deve consumir o adaptador Omie nativo do OonCore");\n  }',
  "baseline F6",
);
baseline = replaceRequired(
  baseline,
  '  if (!/adaptador Omie permanece desabilitado/i.test(readme)) {\n    fail("limite do adaptador Omie não está documentado");\n  }',
  '  if (!/adaptador Omie nativo do OonCore/i.test(readme)) {\n    fail("fronteira do adaptador Omie nativo não está documentada");\n  }',
  "documentação baseline F6",
);
baseline = baseline.replace(
  '"[baseline-reference] OK — referência da Fase 0 preservada; engine F5 habilitada sem paridade, Omie ou cutover.",',
  '"[baseline-reference] OK — referência da Fase 0 preservada; engine F5 e adaptador F6 habilitados sem autorizar cutover.",',
);
writeText("scripts/check-baseline-reference.mjs", baseline);

let parity = readText("backend/test/manifest-parity.test.js");
parity = parity.replaceAll("0.3.57", "0.3.58");
parity = parity.replace(
  'test("Projeto usa o OonCore 0.3.58 com correções de formulários, pagamentos e ações sequenciais",',
  'test("Projeto usa o OonCore 0.3.58 com engine e adaptador Omie nativos",',
);
parity += `\n\ntest("habilita Omie por capability e declara listas, chamadas e webhooks na Central", () => {\n  assert.equal(app.modules.omie, true);\n  assert.ok(app.capabilities.includes("core.integrations.omie"));\n  const source = fs.readFileSync(path.join(root, "backend/src/mappings/omie.js"), "utf8");\n  for (const value of [\n    "defineOmieMapping",\n    "clientes-prestadores",\n    "categorias-financeiras",\n    "listar-contas-correntes",\n    "Financas.ContaPagar.Alterado",\n  ]) assert.ok(source.includes(value));\n  for (const technical of [\n    "backend/src/integrations",\n    "backend/src/models/OmieConfiguracao.js",\n    "backend/src/models/IntegrationOutbox.js",\n    "backend/src/models/WebhookInbox.js",\n    "backend/src/triggers/omieWorker.js",\n  ]) assert.equal(fs.existsSync(path.join(root, technical)), false, technical);\n});\n`;
writeText("backend/test/manifest-parity.test.js", parity);

let runtimeVersion = readText("backend/test/runtime-version-contract.test.js");
runtimeVersion = runtimeVersion.replaceAll('"0.1.4"', '"0.1.5"').replaceAll('"0.3.57"', '"0.3.58"');
writeText("backend/test/runtime-version-contract.test.js", runtimeVersion);

writeText("backend/test/omie-consumer-contract.test.js", `"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { registry } = require("@oondemand/oon-core-back");

const mappingPath = path.resolve(__dirname, "../src/mappings/omie.js");

function loadMapping() {
  registry.reset();
  delete require.cache[require.resolve(mappingPath)];
  return require(mappingPath);
}

test.beforeEach(() => registry.reset());

test("registra contrato Omie declarativo sem provider local", () => {
  loadMapping();
  const [mapping] = registry.listOmieMappings();
  assert.equal(mapping.name, "ss-eventos-v2");
  assert.deepEqual(Object.keys(mapping.calls).sort(), [
    "alterar-cliente-prestador",
    "consultar-conta-pagar",
    "incluir-conta-pagar",
    "listar-categorias",
    "listar-clientes-prestadores",
    "listar-contas-correntes",
    "testar-conexao",
  ]);
  assert.deepEqual(mapping.lists.map((list) => list.key), [
    "clientes-prestadores",
    "categorias-financeiras",
  ]);
  assert.equal(mapping.calls["testar-conexao"].connectionTest, true);
  assert.equal(mapping.handlers.SS_EVENTOS_OMIE_FINANCEIRO instanceof Function, true);
  assert.equal(mapping.webhooks.length, 3);
});

test("mapeia cliente/prestador para a model funcional existente", () => {
  const { mapearClienteOmie } = loadMapping();
  const mapped = mapearClienteOmie({
    codigo_cliente_omie: 123,
    codigo_cliente_integracao: "SS-123",
    nome_fantasia: "Prestador Exemplo",
    cnpj_cpf: "12.345.678/0001-90",
    tags: [{ tag: "Fornecedor" }],
    inativo: "N",
  });
  assert.equal(mapped.codigoClienteOmie, 123);
  assert.equal(mapped.nome, "Prestador Exemplo");
  assert.equal(mapped.fornecedor, true);
  assert.equal(mapped.cliente, false);
  assert.equal(mapped.origem, "Omie");
  assert.equal(mapped.omieStatusIntegracao, "Sincronizado");
});

test("mapeia categoria Omie sem criar model técnica local", () => {
  const { mapearCategoriaOmie } = loadMapping();
  const mapped = mapearCategoriaOmie({ codigo: "1.01", descricao: "Serviços", conta_inativa: "N" });
  assert.equal(mapped.codigoCategoriaOmie, "1.01");
  assert.equal(mapped.nome, "Serviços");
  assert.equal(mapped.status, "Ativo");
});
`);

let readme = readText("README.md");
readme = replaceRequired(
  readme,
  '- `backend/src/services`: funções puras reutilizadas pelas regras.',
  '- `backend/src/services`: funções puras reutilizadas pelas regras;\n- `backend/src/mappings/omie.js`: endpoints, chamadas, listas, transformações e eventos Omie específicos da SS Eventos.',
  "fronteira declarativa do README",
);
readme = readme.replaceAll("0.3.57", "0.3.58");
readme = replaceRequired(readme, '    "omie": false', '    "omie": true', "manifesto Omie no README");
readme = replaceRequired(
  readme,
  '    "core.integrations",\n    "domain.computed-fields",',
  '    "core.integrations",\n    "core.integrations.omie",\n    "domain.computed-fields",',
  "capability Omie no README",
);
readme = replaceRequired(
  readme,
  'A capability `core.integrations` habilita a página e as APIs operacionais padrão do Core. O adaptador Omie permanece desabilitado até a implementação da Fase 6; esta mudança não adiciona cliente HTTP, mapping ou regra Omie local.',
  'As capabilities `core.integrations` e `core.integrations.omie` habilitam a página, as APIs operacionais e o adaptador Omie nativo do OonCore. A Central declara somente endpoints, chamadas, listas, transformações e ações do seu domínio; cliente HTTP, credenciais, outbox, inbox, retry, locks e worker permanecem no Core.',
  "capabilities no README",
);
readme = replaceRequired(
  readme,
  'Enquanto `omie` estiver desabilitado, a página de Integrações pode ser exibida sem provider registrado e não executa chamadas externas.',
  'Com `omie` habilitado, a página de Integrações registra o provider nativo e apresenta configuração segura, teste de conexão, chamadas, `listas-omie`, mappings de webhook, filas e diagnósticos sanitizados.',
  "operação Omie no README",
);
readme = readme.replace(
  /## Limite desta fase[\s\S]*?## Referência da Fase 0/,
  `## Infraestrutura Omie da Fase 6\n\nA V2 consome o adaptador Omie nativo do OonCore e declara em \`backend/src/mappings/omie.js\`:\n\n- teste de conexão por \`ListarClientes\`;\n- chamadas de clientes/prestadores, categorias, contas correntes e Contas a Pagar;\n- \`listas-omie\` para clientes/prestadores e categorias financeiras, persistidas nas próprias models funcionais da Central;\n- mappings de webhook financeiro e ações assíncronas rastreáveis.\n\nNenhuma model técnica Omie é criada na Central. Configuração, segredos, transporte, fila, inbox, histórico, retry, lease e reprocessamento continuam integralmente no OonCore. Contas correntes permanecem como chamada declarada até que o domínio funcional defina onde esse vínculo será persistido.\n\nA ativação com credenciais reais e a homologação funcional de envio/reconciliação financeira continuam condicionadas à configuração do ambiente; a V2 ainda não está autorizada para cutover.\n\n## Referência da Fase 0`,
);
readme = replaceRequired(
  readme,
  'O gate rejeita transforms no bootstrap, registries/páginas locais, identidade duplicada, models técnicos, workers locais, clients Omie e patches de Mongoose.',
  'O gate rejeita transforms no bootstrap, registries/páginas locais, identidade duplicada, models técnicos, workers locais, clientes HTTP Omie próprios e patches de Mongoose; mappings de negócio em `backend/src/mappings` são a extensão permitida.',
  "gate final do README",
);
writeText("README.md", readme);

console.log("Fase 6 alinhada à conformidade do OonCore 0.3.58.");
