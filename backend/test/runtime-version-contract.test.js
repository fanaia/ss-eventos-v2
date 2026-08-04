"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const readJson = (relativePath) => JSON.parse(
  fs.readFileSync(path.join(root, relativePath), "utf8"),
);

test("Central publica versões identificáveis do aplicativo e do OonCore", () => {
  const central = readJson("package.json");
  const backend = readJson("backend/package.json");
  const frontend = readJson("frontend/package.json");
  const app = readJson("central.app.json");

  assert.equal(central.version, "0.1.7");
  assert.equal(backend.version, central.version);
  assert.equal(frontend.version, central.version);
  assert.equal(central.devDependencies["@oondemand/create-central-oon"], "0.3.60");
  assert.equal(backend.dependencies["@oondemand/oon-core-back"], "0.3.60");
  assert.equal(frontend.dependencies["@oondemand/oon-core-front"], "0.3.60");
  assert.equal(app.compatibility.core.minVersion, "0.3.60");
});

test("mantém Integrações e Omie habilitados para o atalho de configurações do Core", () => {
  const app = readJson("central.app.json");

  assert.equal(app.modules.integrations, true);
  assert.equal(app.modules.omie, true);
  assert.ok(app.capabilities.includes("core.integrations"));
  assert.ok(app.capabilities.includes("core.integrations.omie"));
});
