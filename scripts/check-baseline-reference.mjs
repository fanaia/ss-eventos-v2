import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const json = (file) => JSON.parse(read(file));
const fail = (message) => { throw new Error(`[baseline-reference] ${message}`); };

function run() {
  const reference = json("baseline.reference.json");
  const rootPackage = json("package.json");
  const backendPackage = json("backend/package.json");
  const frontendPackage = json("frontend/package.json");
  const config = read("backend/central.config.js");
  const readme = read("README.md");

  if (reference.self.gitSha !== "7c3506b04c61bf0ca9a6c52ae1e64f6b7b079eab") fail("SHA da v2 divergiu");
  if (reference.goldenMaster.gitSha !== "3f689bed834aab7dd024a8e31d37bf7623efae58") fail("SHA do golden master divergiu");
  if (reference.boundary.parityClaimed || reference.boundary.cutoverAllowed) fail("F0 não permite declarar paridade ou cutover");
  if (rootPackage.version !== reference.versions.application) fail("versão da aplicação divergiu");
  if (rootPackage.devDependencies?.["@oondemand/create-central-oon"] !== reference.versions.createCentralOon) fail("create-central-oon divergiu");
  if (backendPackage.dependencies?.["@oondemand/oon-core-back"] !== reference.versions.oonCoreBack) fail("OonCore backend divergiu");
  if (frontendPackage.dependencies?.["@oondemand/oon-core-front"] !== reference.versions.oonCoreFront) fail("OonCore frontend divergiu");
  if (!/integrations:\s*false/.test(config) || !/omie:\s*false/.test(config)) fail("integrações devem permanecer desabilitadas na F0");
  if (!/Não existem na V2:[\s\S]*outbox\/inbox[\s\S]*worker[\s\S]*cliente HTTP Omie/.test(readme)) {
    fail("limite operacional da v2 não está documentado");
  }

  console.log("[baseline-reference] OK — v2 fixada como alvo de comparação, sem alegação de paridade ou cutover.");
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
