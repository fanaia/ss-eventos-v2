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
if (source.includes("assert.match(source, new RegExp")) {
  throw new Error("Não foi possível corrigir a geração do teste de mappings.");
}
fs.writeFileSync(temporaryPath, source);
await import(`${pathToFileURL(temporaryPath).href}?${Date.now()}`);
fs.rmSync(temporaryPath, { force: true });
