"use strict";

const { defineOmieMapping } = require("@oondemand/oon-core-back");

function somenteDigitos(value) {
  return String(value || "").replace(/\D+/g, "");
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
  const documento = documentoOriginal || `OMIE-${codigo || "SEM-CODIGO"}`;
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
      `Cadastro Omie ${codigo || "sem código"}`,
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
    nome: descricao || `Categoria Omie ${codigo}`,
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
