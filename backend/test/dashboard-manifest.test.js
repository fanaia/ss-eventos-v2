"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const ui = JSON.parse(fs.readFileSync(path.join(root, "frontend/central.ui.json"), "utf8"));
const app = JSON.parse(fs.readFileSync(path.join(root, "central.app.json"), "utf8"));
const rootPackage = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const backendPackage = JSON.parse(fs.readFileSync(path.join(root, "backend/package.json"), "utf8"));
const frontendPackage = JSON.parse(fs.readFileSync(path.join(root, "frontend/package.json"), "utf8"));

const dashboard = ui.dashboards?.find((entry) => entry.path === "/");

test("Dashboard é a Home da Central e aparece na navegação", () => {
  assert.ok(dashboard);
  assert.equal(dashboard.label, "Dashboard");
  assert.equal(dashboard.hidden, undefined);
  assert.equal(dashboard.order, 0);
});

test("Dashboard consolida operação, valores, pendências e tickets por status", () => {
  const widgets = new Map(dashboard.widgets.map((widget) => [widget.id, widget]));
  for (const id of [
    "projetos-total", "itens-total", "pagamentos-total", "valor-orcado",
    "valor-contratado", "valor-fechado", "valor-pagamentos", "valor-pendente",
    "itens-por-etapa", "pagamentos-por-etapa", "itens-por-status-trabalho",
    "pagamentos-por-status-trabalho",
  ]) assert.ok(widgets.has(id), `Indicador ausente: ${id}`);

  assert.equal(widgets.get("valor-pendente").field, "pagamentoValorPendente");
  assert.equal(widgets.get("itens-por-etapa").groupBy, "etapa");
  assert.equal(widgets.get("pagamentos-por-etapa").groupBy, "etapa");
  assert.equal(widgets.get("itens-por-status-trabalho").groupBy, "statusTrabalho");
  assert.equal(widgets.get("pagamentos-por-status-trabalho").groupBy, "statusTrabalho");
});

test("Configurações continuam ocultas do menu e acessíveis pela engrenagem do Core", () => {
  const settings = ui.pages?.find((page) => page.path === "/configuracoes");
  assert.ok(settings);
  assert.equal(settings.label, "Configurações");
  assert.equal(settings.hidden, true);
});

test("Central consome os três pacotes coordenados 0.3.63", () => {
  assert.equal(rootPackage.version, "0.1.10");
  assert.equal(rootPackage.devDependencies["@oondemand/create-central-oon"], "0.3.63");
  assert.equal(backendPackage.dependencies["@oondemand/oon-core-back"], "0.3.63");
  assert.equal(frontendPackage.dependencies["@oondemand/oon-core-front"], "0.3.63");
  assert.equal(app.compatibility.core.minVersion, "0.3.63");
});
