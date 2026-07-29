import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const fail = (message) => {
  throw new Error(message);
};

const domain = readJson("backend/central.domain.json");
const ui = readJson("frontend/central.ui.json");
const rootPackage = readJson("package.json");
const backendPackage = readJson("backend/package.json");
const frontendPackage = readJson("frontend/package.json");

if (domain.schemaVersion !== 1) fail("central.domain.json deve usar schemaVersion 1.");
if (!Array.isArray(domain.models) || !domain.models.length) fail("O manifesto deve declarar models.");
if (domain.slug !== ui.slug) fail("Os slugs do domínio e da UI devem ser iguais.");

const expectedVersion = "0.3.43";
const versions = {
  generator: rootPackage.devDependencies?.["@oondemand/create-central-oon"],
  backend: backendPackage.dependencies?.["@oondemand/oon-core-back"],
  frontend: frontendPackage.dependencies?.["@oondemand/oon-core-front"],
};
for (const [name, version] of Object.entries(versions)) {
  if (version !== expectedVersion) fail(`${name} deve usar exatamente OonCore ${expectedVersion}; encontrado ${version}.`);
}

const models = new Map();
const basePaths = new Set();
for (const model of domain.models) {
  if (models.has(model.name)) fail(`Model duplicada: ${model.name}.`);
  if (basePaths.has(model.basePath)) fail(`basePath duplicado: ${model.basePath}.`);
  models.set(model.name, model);
  basePaths.add(model.basePath);
}

const expressionReferences = (expression, output = new Set()) => {
  if (!expression || typeof expression !== "object") return output;
  if (typeof expression.field === "string") output.add(expression.field);
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

const views = [...(ui.collections ?? []), ...(ui.pipelines ?? []), ...(ui.documents ?? [])];
for (const view of views) {
  const model = models.get(view.model);
  if (!model) fail(`A UI referencia model inexistente: ${view.model}.`);

  const modal = view.detailModal ?? view.ticketModal;
  for (const tab of modal?.tabs ?? []) {
    if (tab.type !== "form") continue;
    const tabFields = new Set(tab.fields ?? tab.groups?.flatMap((group) => group.fields) ?? []);
    for (const fieldName of tabFields) {
      const field = model.fields[fieldName];
      if (!field) fail(`A aba ${tab.id} referencia campo inexistente: ${view.model}.${fieldName}.`);
      if (!field.computed) continue;
      for (const reference of expressionReferences(field.computed.expression)) {
        if (!tabFields.has(reference)) {
          fail(`A fórmula reativa ${view.model}.${fieldName} depende de ${reference}, ausente na aba ${tab.id}.`);
        }
      }
    }
  }
}

console.log(`Manifestos válidos: ${domain.models.length} models, ${views.length} views, OonCore ${expectedVersion}.`);
