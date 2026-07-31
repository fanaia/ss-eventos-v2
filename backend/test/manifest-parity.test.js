"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const domain = JSON.parse(fs.readFileSync(path.join(root, "backend/central.domain.json"), "utf8"));
const ui = JSON.parse(fs.readFileSync(path.join(root, "frontend/central.ui.json"), "utf8"));

test("declara todas as models e views da SS Eventos", () => {
  const expected = [
    "ClienteFornecedor",
    "Contato",
    "Categoria",
    "Estado",
    "Cidade",
    "Responsavel",
    "Projeto",
    "ProjetoItem",
    "Pagamento",
  ];
  assert.deepEqual(domain.models.map((model) => model.name), expected);
  assert.deepEqual([...ui.collections.map((view) => view.model)].sort(), expected.filter((name) => !["ProjetoItem", "Pagamento"].includes(name)).sort());
  assert.deepEqual(ui.pipelines.map((view) => view.model), ["ProjetoItem", "Pagamento"]);
});

test("não incorpora models técnicos da integração", () => {
  const names = new Set(domain.models.map((model) => model.name));
  for (const forbidden of [
    "IntegrationExecution",
    "IntegrationOutbox",
    "WebhookInbox",
    "OmieConfiguracao",
    "OmieCategoria",
    "OmieContaCorrente",
    "OmieBaixaPagamento",
  ]) {
    assert.equal(names.has(forbidden), false);
  }
});

test("mantém a ordem operacional das abas do item", () => {
  const pipeline = ui.pipelines.find((view) => view.model === "ProjetoItem");
  assert.deepEqual(
    pipeline.ticketModal.tabs.map((tab) => tab.id),
    ["dados", "orcamento", "contratacao", "pagamento", "fechamento"],
  );
});

test("fluxo de pagamentos expõe somente ações manuais", () => {
  const pipeline = ui.pipelines.find((view) => view.model === "Pagamento");
  assert.equal(pipeline.defaultActions, false);
  const approvalTransitions = pipeline.ticketActions
    .filter((action) => action.group === "approval")
    .map((action) => `${action.hiddenWhen.notEquals}->${action.value}`);
  assert.deepEqual(approvalTransitions, [
    "Solicitado->Aprovado",
    "Aprovado->Aguardando NF",
    "Aguardando NF->Enviado para Omie",
    "Aprovado->Solicitado",
    "Aguardando NF->Aprovado",
  ]);
  assert.equal(
    pipeline.ticketActions.some((action) => action.hiddenWhen?.notEquals === "Enviado para Omie"),
    false,
  );
  assert.equal(
    pipeline.ticketActions.some((action) => action.hiddenWhen?.notEquals === "Pagamento Ok"),
    false,
  );
});
