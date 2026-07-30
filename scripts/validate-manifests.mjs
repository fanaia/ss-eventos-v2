import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const absolute = (relativePath) => path.join(root, relativePath);
const readJson = (relativePath) => JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
const readText = (relativePath) => fs.readFileSync(absolute(relativePath), "utf8");
const fail = (message) => {
  throw new Error(message);
};

const domain = readJson("backend/central.domain.json");
const ui = readJson("frontend/central.ui.json");
const rootPackage = readJson("package.json");
const backendPackage = readJson("backend/package.json");
const frontendPackage = readJson("frontend/package.json");

if (domain.schemaVersion !== 1) fail("central.domain.json deve usar schemaVersion 1.");
if (ui.schemaVersion !== 2) fail("central.ui.json deve usar schemaVersion 2.");
if (!Array.isArray(domain.models) || !domain.models.length) fail("O manifesto deve declarar models.");
if (domain.slug !== ui.slug) fail("Os slugs do domínio e da UI devem ser iguais.");

const expectedVersion = "0.3.43";
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

for (const model of domain.models) {
  const fields = model.fields ?? {};
  for (const [fieldName, field] of Object.entries(fields)) {
    if (field.kind === "ref" && !models.has(field.ref)) {
      fail(`${model.name}.${fieldName} referencia model inexistente: ${field.ref}.`);
    }
    if (!field.computed) continue;
    for (const reference of expressionReferences(field.computed.expression)) {
      if (!fields[reference]) {
        fail(`${model.name}.${fieldName} referencia campo inexistente: ${reference}.`);
      }
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
      const relation = typeof tab.relation === "string"
        ? view.relations?.[tab.relation]
        : tab.relation;
      if (!relation) fail(`A aba ${tab.id} referencia relação inexistente em ${view.model}.`);
      const related = models.get(relation.model);
      for (const column of tab.columns ?? []) {
        checkField(related, typeof column === "string" ? column : column.field, `A aba ${tab.id}`);
      }
      for (const fieldName of tab.create?.fields ?? []) {
        checkField(related, typeof fieldName === "string" ? fieldName : fieldName.field, `A inclusão da aba ${tab.id}`);
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
  "backend/src/validations/regrasProjetos.js",
  "backend/src/triggers/Projeto.js",
  "backend/src/triggers/ProjetoItem.js",
  "backend/src/triggers/Pagamento.js",
  "backend/src/hooks/localidades.js",
  "backend/src/hooks/protecaoExclusao.js",
];
for (const relativePath of requiredDomainFiles) {
  if (!fs.existsSync(absolute(relativePath))) fail(`Arquivo de domínio obrigatório ausente: ${relativePath}.`);
}

const mainSource = readText("frontend/src/main.tsx");
if (!mainSource.includes("startFromManifest")) fail("O frontend deve iniciar por startFromManifest.");
if (/prepareManifest|automaticPayment|registry\s*:|pageComponents|cellRenderers/.test(mainSource)) {
  fail("O bootstrap do frontend não pode conter transforms ou registry local.");
}

const frontendSourceFiles = fs.readdirSync(absolute("frontend/src"), { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name);
if (frontendSourceFiles.some((file) => file !== "main.tsx")) {
  fail(`O frontend declarativo deve manter somente main.tsx; encontrados: ${frontendSourceFiles.join(", ")}.`);
}

const configSource = readText("backend/central.config.js");
if (!/integrations:\s*false/.test(configSource) || !/omie:\s*false/.test(configSource)) {
  fail("Integrações e Omie devem continuar desabilitados até a abstração no OonCore.");
}

console.log(
  `Manifestos válidos: ${domain.models.length} models, ${ui.collections.length} coleções, `
    + `${ui.pipelines.length} esteiras, OonCore ${expectedVersion}.`,
);
