import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readText = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const writeText = (relative, value) => fs.writeFileSync(path.join(root, relative), value);
const readJson = (relative) => JSON.parse(readText(relative));
const writeJson = (relative, value) => writeText(relative, `${JSON.stringify(value, null, 2)}\n`);

const centralVersion = "0.1.6";
const coreVersion = "0.3.59";

const central = readJson("package.json");
central.version = centralVersion;
central.devDependencies["@oondemand/create-central-oon"] = coreVersion;
writeJson("package.json", central);

const backend = readJson("backend/package.json");
backend.version = centralVersion;
backend.dependencies["@oondemand/oon-core-back"] = coreVersion;
writeJson("backend/package.json", backend);

const frontend = readJson("frontend/package.json");
frontend.version = centralVersion;
frontend.dependencies["@oondemand/oon-core-front"] = coreVersion;
writeJson("frontend/package.json", frontend);

const app = readJson("central.app.json");
app.compatibility.core.minVersion = coreVersion;
writeJson("central.app.json", app);

for (const file of [
  "README.md",
  "scripts/validate-manifests.mjs",
  "backend/test/manifest-parity.test.js",
  "backend/test/runtime-version-contract.test.js",
]) {
  let content = readText(file)
    .replaceAll("0.3.58", coreVersion)
    .replaceAll("0.1.5", centralVersion);

  if (file === "README.md" && !content.includes("engrenagem no header")) {
    const marker = "Com `omie` habilitado, a página de Integrações registra o provider nativo e apresenta configuração segura, teste de conexão, chamadas, `listas-omie`, mappings de webhook, filas e diagnósticos sanitizados.";
    const addition = `${marker}\n\nNo OonCore \`${coreVersion}\`, a engrenagem no header direciona para a configuração da Central e, na ausência de uma página própria, abre \`/integracoes\`. As capabilities arquiteturais do aplicativo são avaliadas separadamente das permissões RBAC do usuário, permitindo acessar a configuração e o teste do Omie sem duplicar a capability no token.`;
    if (!content.includes(marker)) throw new Error("Trecho de Integrações não encontrado no README.");
    content = content.replace(marker, addition);
  }

  writeText(file, content);
}

console.log(`Central ${centralVersion} preparada para OonCore ${coreVersion}.`);
