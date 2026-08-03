import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const absolute = (relativePath) => path.join(root, relativePath);
const readJson = (relativePath) => JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
const readText = (relativePath) => fs.readFileSync(absolute(relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(absolute(relativePath));
const fail = (message) => {
  throw new Error(message);
};

const app = readJson("central.app.json");
const domain = readJson("backend/central.domain.json");
const processManifest = readJson("backend/central.process.json");
const ui = readJson("frontend/central.ui.json");
const rootPackage = readJson("package.json");
const backendPackage = readJson("backend/package.json");
const frontendPackage = readJson("frontend/package.json");

if (app.schemaVersion !== 1) fail("central.app.json deve usar schemaVersion 1.");
if (domain.schemaVersion !== 1) fail("central.domain.json deve usar schemaVersion 1.");
if (processManifest.schemaVersion !== 1) fail("central.process.json deve usar schemaVersion 1.");
if (ui.schemaVersion !== 2) fail("central.ui.json deve usar schemaVersion 2.");
if (!Array.isArray(domain.models) || !domain.models.length) fail("O manifesto deve declarar models.");
if (!processManifest.models || typeof processManifest.models !== "object") {
  fail("central.process.json deve declarar models.");
}
if (app.slug !== domain.slug) fail("Os slugs do app e do domínio devem ser iguais.");
for (const identityField of ["name", "slug", "appKind", "auth"]) {
  if (Object.prototype.hasOwnProperty.call(ui, identityField)) {
    fail(`central.ui.json não pode declarar identidade/auth: ${identityField}.`);
  }
}
if (app.appKind !== "member-central") fail("SS Eventos V2 deve usar appKind member-central.");
if (app.modules?.collections !== true || app.modules?.pipelines !== true) {
  fail("SS Eventos V2 deve habilitar collections e pipelines no central.app.json.");
}
if (app.modules?.integrations !== false || app.modules?.omie !== false) {
  fail("Integrações e Omie devem continuar desabilitados até a abstração no OonCore.");
}
for (const capability of [
  "core.collections",
  "core.pipelines",
  "domain.computed-fields",
  "ui.related-grid.parent-defaults",
]) {
  if (!app.capabilities?.includes(capability)) fail(`Capability obrigatória ausente: ${capability}.`);
}

const expectedVersion = "0.3.54";
const versions = {
  generator: rootPackage.devDependencies?.["@oondemand/create-central-oon"],
  backend: backendPackage.dependencies?.["@oondemand/oon-core-back"],
  frontend: frontendPackage.dependencies?.["@oondemand/oon-core-front"],
};
for (const [name, version] of Object.entries(versions)) {
  if (version !== expectedVersion) {
    fail(`${name} deve usar exatamente OonCore ${expectedVersion}; encontrado ${version}.`);
  }
}
if (app.compatibility?.core?.minVersion !== expectedVersion) {
  fail(`central.app.json deve exigir OonCore ${expectedVersion}.`);
}

const expectedModels = [
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
const forbiddenTechnicalModels = [
  "IntegrationExecution",
  "IntegrationOutbox",
  "WebhookInbox",
  "OmieConfiguracao",
  "OmieCategoria",
  "OmieContaCorrente",
  "OmieBaixaPagamento",
];

const models = new Map();
const basePaths = new Set();
for (const model of domain.models) {
  if (models.has(model.name)) fail(`Model duplicada: ${model.name}.`);
  if (basePaths.has(model.basePath)) fail(`basePath duplicado: ${model.basePath}.`);
  models.set(model.name, model);
  basePaths.add(model.basePath);
}
for (const modelName of expectedModels) {
  if (!models.has(modelName)) fail(`Model obrigatória ausente: ${modelName}.`);
  if (!processManifest.models[modelName]) fail(`Processo obrigatório ausente: ${modelName}.`);
}
for (const modelName of Object.keys(processManifest.models)) {
  if (!models.has(modelName)) fail(`Processo referencia model inexistente: ${modelName}.`);
}
for (const modelName of forbiddenTechnicalModels) {
  if (models.has(modelName)) fail(`Model técnica de integração não pode permanecer na Central: ${modelName}.`);
}

const expressionReferences = (expression, output = new Set()) => {
  if (!expression || typeof expression !== "object") return output;
  if (typeof expression.field === "string") output.add(expression.field.split(".")[0]);
  for (const argument of expression.args ?? []) expressionReferences(argument, output);
  return output;
};

const assertOwnField = (modelName, fieldName, source) => {
  if (!fieldName || !models.get(modelName)?.fields?.[fieldName]) {
    fail(`${source} referencia campo inexistente: ${modelName}.${fieldName}.`);
  }
};
const assertSourceField = (modelName, fieldName, source) => {
  if (!fieldName || !models.get(modelName)?.fields?.[fieldName]) {
    fail(`${source} referencia campo de origem inexistente: ${modelName}.${fieldName}.`);
  }
};

for (const model of domain.models) {
  const fields = model.fields ?? {};
  for (const [fieldName, field] of Object.entries(fields)) {
    if (field.kind === "ref" && !models.has(field.ref)) {
      fail(`${model.name}.${fieldName} referencia model inexistente: ${field.ref}.`);
    }
    if (!field.computed) continue;
    for (const reference of expressionReferences(field.computed.expression)) {
      if (!fields[reference]) fail(`${model.name}.${fieldName} referencia campo inexistente: ${reference}.`);
    }
  }

  const computed = new Map(
    Object.entries(fields)
      .filter(([, field]) => field.computed)
      .map(([name, field]) => [name, field]),
  );
  const visiting = new Set();
  const visited = new Set();
  const visit = (fieldName) => {
    if (visited.has(fieldName)) return;
    if (visiting.has(fieldName)) fail(`Ciclo de fórmulas em ${model.name}.${fieldName}.`);
    visiting.add(fieldName);
    const field = computed.get(fieldName);
    for (const reference of expressionReferences(field.computed.expression)) {
      if (computed.has(reference)) visit(reference);
    }
    visiting.delete(fieldName);
    visited.add(fieldName);
  };
  computed.forEach((_, fieldName) => visit(fieldName));
}

for (const [modelName, rules] of Object.entries(processManifest.models)) {
  if (rules.workflow) {
    assertOwnField(modelName, rules.workflow.stageField, `${modelName}.workflow.stageField`);
    const stageField = models.get(modelName).fields[rules.workflow.stageField];
    if (stageField.kind !== "enum") fail(`${modelName}.workflow.stageField deve ser enum.`);
    const allowedStages = new Set(stageField.values ?? []);
    for (const stage of rules.workflow.initialStages ?? []) {
      if (!allowedStages.has(stage)) fail(`${modelName}.workflow.initialStages contém etapa inválida: ${stage}.`);
    }
    if (rules.workflow.defaultStage && !allowedStages.has(rules.workflow.defaultStage)) {
      fail(`${modelName}.workflow.defaultStage contém etapa inválida.`);
    }
    for (const transition of rules.workflow.transitions ?? []) {
      if (!allowedStages.has(transition.from) || !allowedStages.has(transition.to)) {
        fail(`${modelName}.workflow contém transição para etapa inexistente.`);
      }
      for (const reference of expressionReferences(transition.when)) {
        assertOwnField(modelName, reference, `${modelName}.workflow.transitions.when`);
      }
    }
    for (const [stage, fields] of Object.entries(rules.workflow.lockedFieldsByStage ?? {})) {
      if (!allowedStages.has(stage)) fail(`${modelName}.workflow bloqueia etapa inexistente: ${stage}.`);
      for (const field of fields) assertOwnField(modelName, field, `${modelName}.workflow.${stage}`);
    }
    for (const assignment of rules.workflow.onEnter ?? []) {
      if (!allowedStages.has(assignment.stage)) fail(`${modelName}.workflow.onEnter usa etapa inválida.`);
      for (const field of Object.keys(assignment.set ?? {})) {
        assertOwnField(modelName, field, `${modelName}.workflow.onEnter`);
      }
    }
    for (const transition of rules.workflow.automaticTransitions ?? []) {
      if (!allowedStages.has(transition.to)) fail(`${modelName}.workflow automático usa etapa inválida.`);
      for (const reference of expressionReferences(transition.when)) {
        assertOwnField(modelName, reference, `${modelName}.workflow.automaticTransitions.when`);
      }
      for (const field of Object.keys(transition.set ?? {})) {
        assertOwnField(modelName, field, `${modelName}.workflow.automaticTransitions.set`);
      }
    }
  }

  for (const reference of rules.references ?? []) {
    assertOwnField(modelName, reference.field, `${modelName}.references`);
    if (!models.has(reference.sourceModel)) {
      fail(`${modelName}.references usa model inexistente: ${reference.sourceModel}.`);
    }
    if (reference.active?.field) {
      assertSourceField(reference.sourceModel, reference.active.field, `${modelName}.references.active`);
    }
    for (const constraint of reference.constraints ?? []) {
      assertSourceField(reference.sourceModel, constraint.sourceField, `${modelName}.references.constraints`);
      if (constraint.equalsField) {
        assertOwnField(modelName, constraint.equalsField, `${modelName}.references.constraints.equalsField`);
      }
    }
  }

  for (const binding of rules.bindings ?? []) {
    assertOwnField(modelName, binding.field, `${modelName}.bindings`);
    if (binding.sourceModel && !models.has(binding.sourceModel)) {
      fail(`${modelName}.bindings usa model inexistente: ${binding.sourceModel}.`);
    }
    if (binding.kind === "lookup") {
      assertOwnField(modelName, binding.localField, `${modelName}.bindings.lookup.localField`);
      assertSourceField(binding.sourceModel, binding.sourceField, `${modelName}.bindings.lookup.sourceField`);
    }
    if (binding.kind === "aggregate") {
      assertSourceField(binding.sourceModel, binding.foreignField, `${modelName}.bindings.aggregate.foreignField`);
      if (binding.operator !== "count") {
        assertSourceField(binding.sourceModel, binding.sourceField, `${modelName}.bindings.aggregate.sourceField`);
      }
      for (const matchField of Object.keys(binding.match ?? {})) {
        assertSourceField(binding.sourceModel, matchField, `${modelName}.bindings.aggregate.match`);
      }
    }
    if (binding.kind === "expression") {
      for (const reference of expressionReferences(binding.expression)) {
        assertOwnField(modelName, reference, `${modelName}.bindings.expression`);
      }
    }
  }

  for (const protection of rules.deleteProtection ?? []) {
    if (!models.has(protection.sourceModel)) {
      fail(`${modelName}.deleteProtection usa model inexistente: ${protection.sourceModel}.`);
    }
    assertSourceField(
      protection.sourceModel,
      protection.foreignField,
      `${modelName}.deleteProtection.foreignField`,
    );
  }

  for (const invariant of rules.atomicInvariants ?? []) {
    if (!models.has(invariant.parentModel)) {
      fail(`${modelName}.atomicInvariants usa model pai inexistente: ${invariant.parentModel}.`);
    }
    assertOwnField(modelName, invariant.parentLocalField, `${modelName}.atomicInvariants.parentLocalField`);
    assertOwnField(modelName, invariant.sourceField, `${modelName}.atomicInvariants.sourceField`);
    assertSourceField(
      invariant.parentModel,
      invariant.parentField,
      `${modelName}.atomicInvariants.parentField`,
    );
    for (const matchField of Object.keys(invariant.match ?? {})) {
      assertOwnField(modelName, matchField, `${modelName}.atomicInvariants.match`);
    }
  }
}

const resolveFields = (tab) => tab.fields ?? tab.groups?.flatMap((group) => group.fields) ?? [];
const checkField = (model, fieldName, source) => {
  if (!model.fields?.[fieldName]) fail(`${source} referencia campo inexistente: ${model.name}.${fieldName}.`);
};

const views = [...(ui.collections ?? []), ...(ui.pipelines ?? []), ...(ui.documents ?? [])];
for (const view of views) {
  const model = models.get(view.model);
  if (!model) fail(`A UI referencia model inexistente: ${view.model}.`);

  for (const formField of view.form ?? []) checkField(model, formField.field, `${view.model}.form`);
  for (const filter of [...(view.filters ?? []), ...(view.list?.filters ?? [])]) {
    checkField(model, filter.field, `${view.model}.filters`);
  }
  for (const column of view.list?.columns ?? []) {
    checkField(model, typeof column === "string" ? column : column.field, `${view.model}.list`);
  }

  for (const [relationName, relation] of Object.entries(view.relations ?? {})) {
    const related = models.get(relation.model);
    if (!related) fail(`${view.model}.${relationName} referencia model inexistente: ${relation.model}.`);
    if (!related.fields?.[relation.foreignKey]) {
      fail(`${view.model}.${relationName} usa foreignKey inexistente: ${relation.model}.${relation.foreignKey}.`);
    }
  }

  const modal = view.detailModal ?? view.ticketModal;
  for (const tab of modal?.tabs ?? []) {
    if (tab.type === "form") {
      const tabFields = new Set(resolveFields(tab));
      for (const fieldName of tabFields) {
        checkField(model, fieldName, `A aba ${tab.id}`);
        const field = model.fields[fieldName];
        if (!field.computed) continue;
        for (const reference of expressionReferences(field.computed.expression)) {
          if (!tabFields.has(reference)) {
            fail(`A fórmula reativa ${view.model}.${fieldName} depende de ${reference}, ausente na aba ${tab.id}.`);
          }
        }
      }
    }

    if (["relatedGrid", "readonlyGrid"].includes(tab.type)) {
      const relation = typeof tab.relation === "string" ? view.relations?.[tab.relation] : tab.relation;
      if (!relation) fail(`A aba ${tab.id} referencia relação inexistente em ${view.model}.`);
      const related = models.get(relation.model);
      for (const column of tab.columns ?? []) {
        checkField(related, typeof column === "string" ? column : column.field, `A aba ${tab.id}`);
      }
      for (const field of tab.create?.fields ?? []) {
        checkField(related, typeof field === "string" ? field : field.field, `A inclusão da aba ${tab.id}`);
      }
      for (const [targetField, parentPath] of Object.entries(tab.create?.initialValuesFromParent ?? {})) {
        checkField(related, targetField, `A herança da aba ${tab.id}`);
        if (typeof parentPath !== "string" || !parentPath.trim()) {
          fail(`A herança da aba ${tab.id} deve apontar para um caminho válido no registro pai.`);
        }
      }
    }
  }

  if (view.stageField) {
    const stageField = model.fields?.[view.stageField];
    if (!stageField || stageField.kind !== "enum") {
      fail(`${view.model}.${view.stageField} deve ser um enum para uso como esteira.`);
    }
    const declaredStages = (view.stages ?? []).map((stage) => stage.id);
    if (JSON.stringify(declaredStages) !== JSON.stringify(stageField.values)) {
      fail(`As etapas da UI e do domínio divergem em ${view.model}.`);
    }
    for (const action of view.ticketActions ?? []) {
      if (action.field) checkField(model, action.field, `A ação ${action.id}`);
      if (action.field === view.stageField && !stageField.values.includes(action.value)) {
        fail(`A ação ${action.id} aponta para etapa inválida: ${action.value}.`);
      }
    }
  }
}

const collectionModels = new Set((ui.collections ?? []).map((view) => view.model));
for (const modelName of expectedModels.filter((name) => !["ProjetoItem", "Pagamento"].includes(name))) {
  if (!collectionModels.has(modelName)) fail(`Coleção de navegação ausente: ${modelName}.`);
}
for (const pipelineName of ["ProjetoItem", "Pagamento"]) {
  if (!(ui.pipelines ?? []).some((pipeline) => pipeline.model === pipelineName)) {
    fail(`Esteira obrigatória ausente: ${pipelineName}.`);
  }
}

const requiredDomainFiles = [
  "backend/src/services/calculosProjeto.js",
  "backend/src/services/dadosValidacao.js",
  "backend/src/services/documentos.js",
  "backend/src/services/localidadesInternas.js",
  "backend/src/validations/regrasCadastros.js",
  "backend/src/hooks/localidades.js",
];
for (const relativePath of requiredDomainFiles) {
  if (!exists(relativePath)) fail(`Arquivo específico obrigatório ausente: ${relativePath}.`);
}
const forbiddenGenericExtensions = [
  "backend/src/validations/regrasProjetos.js",
  "backend/src/triggers/Projeto.js",
  "backend/src/triggers/ProjetoItem.js",
  "backend/src/triggers/Pagamento.js",
  "backend/src/hooks/protecaoExclusao.js",
];
for (const relativePath of forbiddenGenericExtensions) {
  if (exists(relativePath)) fail(`Extensão genérica deve estar no OonCore: ${relativePath}.`);
}

const itemPipeline = (ui.pipelines ?? []).find((pipeline) => pipeline.model === "ProjetoItem");
const paymentTab = itemPipeline?.ticketModal?.tabs?.find((tab) => tab.id === "pagamento");
if (!paymentTab?.create) fail("A criação declarativa de pagamentos é obrigatória em central.ui.json.");
const expectedCreateFields = [
  "dataPrevisaoPagamento",
  "valor",
  "responsavelPagamentoId",
  "nfRecebida",
];
const actualCreateFields = (paymentTab.create.fields ?? []).map((field) => field.field);
if (JSON.stringify(actualCreateFields) !== JSON.stringify(expectedCreateFields)) {
  fail(`Campos da criação de pagamento divergentes: ${actualCreateFields.join(", ")}.`);
}
const expectedInheritance = {
  projetoId: "projetoId",
  projetoItemId: "_id",
  valor: "pagamentoValorPendente",
};
if (JSON.stringify(paymentTab.create.initialValuesFromParent) !== JSON.stringify(expectedInheritance)) {
  fail("A criação de pagamento deve herdar projeto, item e saldo pendente do registro pai.");
}

const mainSource = readText("frontend/src/main.tsx");
if (!mainSource.includes("startCentralFromManifest")) {
  fail("O frontend deve iniciar por startCentralFromManifest.");
}
for (const requiredSnippet of ["../../central.app.json", "../central.ui.json"]) {
  if (!mainSource.includes(requiredSnippet)) fail(`Bootstrap incompleto: ${requiredSnippet}.`);
}
if (/structuredClone|configurePaymentCreation|prepareManifest|automaticPayment|registry\s*:|pageComponents|cellRenderers|\.find\s*\(/.test(mainSource)) {
  fail("O bootstrap do frontend não pode transformar manifestos nem registrar páginas locais.");
}

const frontendSourceFiles = fs.readdirSync(absolute("frontend/src"), { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name);
if (frontendSourceFiles.some((file) => file !== "main.tsx")) {
  fail(`O frontend declarativo deve manter somente main.tsx; encontrados: ${frontendSourceFiles.join(", ")}.`);
}

const configSource = readText("backend/central.config.js");
for (const forbiddenKey of ["name", "slug", "appKind", "ecosystem", "activation", "modules", "capabilities", "auth"]) {
  if (new RegExp(`\\b${forbiddenKey}\\s*:`).test(configSource)) {
    fail(`${forbiddenKey} deve viver em central.app.json ou no OonCore, não em central.config.js.`);
  }
}

console.log(
  `Manifestos válidos: app ${app.id}, ${domain.models.length} models, `
    + `${Object.keys(processManifest.models).length} processos, ${ui.collections.length} coleções, `
    + `${ui.pipelines.length} esteiras, OonCore ${expectedVersion}.`,
);
