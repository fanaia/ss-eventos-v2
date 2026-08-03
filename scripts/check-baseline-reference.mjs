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
  const app = json("central.app.json");
  const readme = read("README.md");

  if (reference.self.gitSha !== "7c3506b04c61bf0ca9a6c52ae1e64f6b7b079eab") fail("SHA da referência v2 divergiu");
  if (reference.goldenMaster.gitSha !== "3f689bed834aab7dd024a8e31d37bf7623efae58") fail("SHA do golden master divergiu");
  if (reference.versions.createCentralOon !== "0.3.44") fail("versão congelada do gerador divergiu");
  if (reference.versions.oonCoreBack !== "0.3.44") fail("versão congelada do backend divergiu");
  if (reference.versions.oonCoreFront !== "0.3.44") fail("versão congelada do frontend divergiu");
  if (reference.boundary.parityClaimed || reference.boundary.cutoverAllowed) {
    fail("a referência da Fase 0 não permite declarar paridade ou cutover");
  }
  if (app.modules?.integrations !== true || !app.capabilities?.includes("core.integrations")) {
    fail("a Fase 5 deve consumir a engine nativa de integrações do OonCore");
  }
  if (app.modules?.omie !== false) {
    fail("o adaptador Omie deve permanecer desabilitado até a Fase 6");
  }
  if (!/A engine de integrações pertence ao OonCore[\s\S]*models técnicos[\s\S]*outbox[\s\S]*inbox[\s\S]*runtime/i.test(readme)) {
    fail("fronteira da engine nativa não está documentada");
  }
  if (!/adaptador Omie permanece desabilitado/i.test(readme)) {
    fail("limite do adaptador Omie não está documentado");
  }
  if (!/não está autorizada para cutover/i.test(readme)) {
    fail("restrição de cutover não está documentada");
  }

  console.log(
    "[baseline-reference] OK — referência da Fase 0 preservada; engine F5 habilitada sem paridade, Omie ou cutover.",
  );
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
