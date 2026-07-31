import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const packages = [
  {
    file: "backend/package-lock.json",
    name: "@oondemand/oon-core-back",
    version: "0.3.45",
    resolved: "https://registry.npmjs.org/@oondemand/oon-core-back/-/oon-core-back-0.3.45.tgz",
    integrity: "sha512-F1HVKczymTpImtCmY+qs7oqzH7XiaXA8qDWSDrpi5UBLDbN048Oqrg5j7tS+DLAdc9/O0peMMmGaDRDq7chSNA==",
  },
  {
    file: "frontend/package-lock.json",
    name: "@oondemand/oon-core-front",
    version: "0.3.45",
    resolved: "https://registry.npmjs.org/@oondemand/oon-core-front/-/oon-core-front-0.3.45.tgz",
    integrity: "sha512-uq/mA7NT9y6bq/3omVYlT7WShuzjOgFzjdk34UMROkoBBgwLiSmuKU9urgE4snXYYTp421+4zVcVQy3BdLUYqw==",
  },
];

for (const item of packages) {
  const filePath = path.join(root, item.file);
  const lock = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const rootPackage = lock.packages?.[""];
  const installed = lock.packages?.[`node_modules/${item.name}`];
  if (!rootPackage?.dependencies || !installed) {
    throw new Error(`Estrutura inesperada em ${item.file} para ${item.name}.`);
  }
  rootPackage.dependencies[item.name] = item.version;
  installed.version = item.version;
  installed.resolved = item.resolved;
  installed.integrity = item.integrity;
  fs.writeFileSync(filePath, `${JSON.stringify(lock, null, 2)}\n`);
}

const workflow = ".github/workflows/f1-lockfiles.yml";
fs.rmSync(path.join(root, "scripts", "apply-f1-lockfiles.mjs"), { force: true });
fs.rmSync(path.join(root, workflow), { force: true });

execFileSync("git", ["config", "user.name", "github-actions[bot]"], { stdio: "inherit" });
execFileSync("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], { stdio: "inherit" });
execFileSync("git", ["add", "backend/package-lock.json", "frontend/package-lock.json", "scripts/apply-f1-lockfiles.mjs", workflow], { stdio: "inherit" });
execFileSync("git", ["commit", "-m", "chore: lock OonCore 0.3.45 release candidates"], { stdio: "inherit" });
execFileSync("git", ["push", "origin", "HEAD:agent/f1-central-app-conformance"], { stdio: "inherit" });
