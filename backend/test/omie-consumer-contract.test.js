"use strict";

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
