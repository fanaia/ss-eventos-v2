import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sourcePath = path.resolve("scripts/prepare-f6-omie-v2.mjs");
const temporaryPath = path.resolve("scripts/.prepare-f6-v2-fixed.mjs");
let source = fs.readFileSync(sourcePath, "utf8");
source = source.replace('    "backend/src/integrations",\\n', "");
if (source.includes('    "backend/src/integrations",\\n')) {
  throw new Error("Não foi possível restringir o teste de runtime técnico.");
}
fs.writeFileSync(temporaryPath, source);
await import(`${pathToFileURL(temporaryPath).href}?${Date.now()}`);
fs.rmSync(temporaryPath, { force: true });
