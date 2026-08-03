"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const domain = JSON.parse(fs.readFileSync(path.join(root, "backend/central.domain.json"), "utf8"));
const processManifest = JSON.parse(fs.readFileSync(path.join(root, "backend/central.process.json"), "utf8"));
const ui = JSON.parse(fs.readFileSync(path.join(root, "frontend/central.ui.json"), "utf8"));
const app = JSON.parse(fs.readFileSync(path.join(root, "central.app.json"), "utf8"));
const rootPackage = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const backendPackage = JSON.parse(fs.readFileSync(path.join(root, "backend/package.json"), "utf8"));
const frontendPackage = JSON.parse(fs.readFileSync(path.join(root, "frontend/package.json"), "utf8"));

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
  assert.deepEqual(
    [...ui.collections.map((view) => view.model)].sort(),
    expected.filter((name) => !["ProjetoItem", "Pagamento"].includes(name)).sort(),
  );
  assert.deepEqual(ui.pipelines.map((view) => view.model), ["ProjetoItem", "Pagamento"]);
  assert.deepEqual(Object.keys(processManifest.models), expected);
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

test("backend aplica as mesmas transições manuais e mantém etapas automáticas protegidas", () => {
  const workflow = processManifest.models.Pagamento.workflow;
  const transitions = workflow.transitions.map((transition) => `${transition.from}->${transition.to}`);
  assert.deepEqual(transitions, [
    "Solicitado->Aprovado",
    "Aprovado->Solicitado",
    "Aprovado->Aguardando NF",
    "Aguardando NF->Aprovado",
    "Aguardando NF->Enviado para Omie",
  ]);
  assert.deepEqual(workflow.initialStages, ["Solicitado"]);
  assert.ok(workflow.lockedFieldsByStage["Enviado para Omie"].includes("valor"));
  assert.ok(workflow.lockedFieldsByStage["Pagamento Ok"].includes("projetoItemId"));
  assert.equal(workflow.automaticTransitions[0].to, "Pagamento Ok");
});

test("recálculos de projeto e pagamento são declarativos e em lote", () => {
  const bindings = processManifest.models.ProjetoItem.bindings;
  const fee = bindings.find((binding) => binding.field === "percentualFeeAplicado");
  const planned = bindings.find((binding) => binding.field === "pagamentoTotalPlanejado");
  const paid = bindings.find((binding) => binding.field === "pagamentoTotalPago");

  assert.equal(fee.kind, "lookup");
  assert.equal(fee.recalculate, "async");
  assert.deepEqual(fee.watchFields, ["percentualFee"]);
  assert.equal(planned.kind, "aggregate");
  assert.equal(planned.operator, "sum");
  assert.ok(planned.watchFields.includes("canceladoNaCentral"));
  assert.equal(paid.sourceField, "omieValorPago");

  for (const removed of [
    "backend/src/triggers/Projeto.js",
    "backend/src/triggers/ProjetoItem.js",
    "backend/src/triggers/Pagamento.js",
    "backend/src/hooks/protecaoExclusao.js",
    "backend/src/validations/regrasProjetos.js",
  ]) {
    assert.equal(fs.existsSync(path.join(root, removed)), false, removed);
  }
});

test("limite de pagamentos é uma invariável transacional do Core", () => {
  const [invariant] = processManifest.models.Pagamento.atomicInvariants;
  assert.equal(invariant.kind, "relatedSumLteParentField");
  assert.equal(invariant.parentModel, "ProjetoItem");
  assert.equal(invariant.parentLocalField, "projetoItemId");
  assert.equal(invariant.sourceField, "valor");
  assert.equal(invariant.parentField, "contratacaoTotal");
  assert.equal(invariant.match.canceladoNaCentral.neq, true);
});

test("dependências de referência e exclusões não usam hooks locais", () => {
  assert.ok(processManifest.models.Projeto.references.length >= 3);
  assert.ok(processManifest.models.ProjetoItem.references.length >= 6);
  assert.ok(processManifest.models.Pagamento.references.length >= 3);
  assert.ok(processManifest.models.ClienteFornecedor.deleteProtection.length >= 3);
  assert.ok(processManifest.models.ProjetoItem.deleteProtection.length >= 1);
});

test("Projeto usa o OonCore 0.3.52 com correções de formulário multiaaba", () => {
  assert.equal(rootPackage.devDependencies["@oondemand/create-central-oon"], "0.3.52");
  assert.equal(backendPackage.dependencies["@oondemand/oon-core-back"], "0.3.52");
  assert.equal(frontendPackage.dependencies["@oondemand/oon-core-front"], "0.3.52");
  assert.equal(app.compatibility.core.minVersion, "0.3.52");

  const projetoView = ui.collections.find((view) => view.model === "Projeto");
  assert.equal(projetoView.detailModal.defaultTab, "resumo");
  assert.equal(
    projetoView.detailModal.tabs.find((tab) => tab.type === "form")?.id,
    "dados",
  );

  const contatoReference = processManifest.models.Projeto.references
    .find((reference) => reference.field === "contatoPrincipalId");
  assert.equal(contatoReference.sourceModel, "Contato");
  assert.deepEqual(contatoReference.constraints, [
    {
      sourceField: "clienteFornecedorId",
      equalsField: "clienteId",
      message: "O contato principal deve pertencer ao cliente selecionado.",
    },
  ]);
});
