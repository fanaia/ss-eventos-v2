import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sourcePath = path.resolve("scripts/prepare-f6-omie.mjs");
const temporaryPath = path.resolve("scripts/.prepare-f6-fixed.mjs");
let source = fs.readFileSync(sourcePath, "utf8");
source = source.replace(
  /  \]\) assert\.match\(source, new RegExp\([^\n]+\);/,
  "  ]) assert.ok(source.includes(value));",
);
source = source.replace(
  "adaptador Omie nativo[\\\\s\\\\S]*mappings declarados pela Central",
  "adaptador Omie nativo do OonCore",
);
if (source.includes("assert.match(source, new RegExp")) {
  throw new Error("Não foi possível corrigir a geração do teste de mappings.");
}
if (source.includes("mappings declarados pela Central")) {
  throw new Error("Não foi possível alinhar o gate documental da Fase 6.");
}
fs.writeFileSync(temporaryPath, source);
await import(`${pathToFileURL(temporaryPath).href}?${Date.now()}`);
fs.rmSync(temporaryPath, { force: true });
