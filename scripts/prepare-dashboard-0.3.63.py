import json
from pathlib import Path

CENTRAL_VERSION = "0.1.10"
CORE_VERSION = "0.3.63"


def load(path: str):
    return json.loads(Path(path).read_text())


def save(path: str, data):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


root = load("package.json")
root["version"] = CENTRAL_VERSION
root["devDependencies"]["@oondemand/create-central-oon"] = CORE_VERSION
save("package.json", root)

backend = load("backend/package.json")
backend["version"] = CENTRAL_VERSION
backend["dependencies"]["@oondemand/oon-core-back"] = CORE_VERSION
save("backend/package.json", backend)

frontend = load("frontend/package.json")
frontend["version"] = CENTRAL_VERSION
frontend["dependencies"]["@oondemand/oon-core-front"] = CORE_VERSION
save("frontend/package.json", frontend)

app = load("central.app.json")
app["compatibility"]["core"]["minVersion"] = CORE_VERSION
save("central.app.json", app)

ui = load("frontend/central.ui.json")
ui["dashboards"] = [
    {
        "id": "dashboard",
        "label": "Dashboard",
        "path": "/",
        "section": "Geral",
        "order": 0,
        "widgets": [
            {
                "id": "projetos-total",
                "label": "Projetos",
                "description": "Quantidade total de projetos cadastrados.",
                "model": "Projeto",
                "kind": "count",
                "format": "number",
            },
            {
                "id": "itens-total",
                "label": "Itens",
                "description": "Quantidade total de itens dos projetos.",
                "model": "ProjetoItem",
                "kind": "count",
                "format": "number",
            },
            {
                "id": "pagamentos-total",
                "label": "Pagamentos",
                "description": "Quantidade de pagamentos não cancelados na Central.",
                "model": "Pagamento",
                "kind": "count",
                "filters": {"canceladoNaCentral": {"ne": True}},
                "format": "number",
            },
            {
                "id": "valor-orcado",
                "label": "Valor orçado",
                "description": "Soma do orçamento de todos os itens.",
                "model": "ProjetoItem",
                "kind": "sum",
                "field": "orcamentoTotal",
                "format": "currency",
            },
            {
                "id": "valor-contratado",
                "label": "Valor contratado",
                "description": "Soma das contratações de todos os itens.",
                "model": "ProjetoItem",
                "kind": "sum",
                "field": "contratacaoTotal",
                "format": "currency",
            },
            {
                "id": "valor-fechado",
                "label": "Valor de fechamento",
                "description": "Soma dos valores finais, incluindo fee e impostos.",
                "model": "ProjetoItem",
                "kind": "sum",
                "field": "fechamentoTotal",
                "format": "currency",
            },
            {
                "id": "valor-pagamentos",
                "label": "Pagamentos planejados",
                "description": "Soma dos pagamentos não cancelados registrados na Central.",
                "model": "Pagamento",
                "kind": "sum",
                "field": "valor",
                "filters": {"canceladoNaCentral": {"ne": True}},
                "format": "currency",
            },
            {
                "id": "valor-pendente",
                "label": "Pendente de pagamento",
                "description": "Saldo consolidado ainda pendente de pagamento nos itens.",
                "model": "ProjetoItem",
                "kind": "sum",
                "field": "pagamentoValorPendente",
                "format": "currency",
            },
            {
                "id": "itens-por-etapa",
                "label": "Itens por etapa",
                "description": "Distribuição dos tickets de itens na esteira.",
                "model": "ProjetoItem",
                "kind": "groupCount",
                "groupBy": "etapa",
                "format": "number",
            },
            {
                "id": "pagamentos-por-etapa",
                "label": "Pagamentos por etapa",
                "description": "Distribuição dos tickets de pagamentos na esteira.",
                "model": "Pagamento",
                "kind": "groupCount",
                "groupBy": "etapa",
                "filters": {"canceladoNaCentral": {"ne": True}},
                "format": "number",
            },
            {
                "id": "itens-por-status-trabalho",
                "label": "Itens por status de trabalho",
                "description": "Aguardando início, trabalhando ou em revisão.",
                "model": "ProjetoItem",
                "kind": "groupCount",
                "groupBy": "statusTrabalho",
                "format": "number",
            },
            {
                "id": "pagamentos-por-status-trabalho",
                "label": "Pagamentos por status de trabalho",
                "description": "Aguardando início, trabalhando ou em revisão.",
                "model": "Pagamento",
                "kind": "groupCount",
                "groupBy": "statusTrabalho",
                "filters": {"canceladoNaCentral": {"ne": True}},
                "format": "number",
            },
        ],
    }
]
save("frontend/central.ui.json", ui)

Path("backend/test/dashboard-manifest.test.js").write_text(
    r'''"use strict";

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
'''
)

readme = Path("README.md")
text = readme.read_text()
marker = "## Dashboard operacional"
section = """
## Dashboard operacional

A Home `/` apresenta indicadores declarativos de Projetos, Itens e Pagamentos, valores orçados, contratados, fechados e pendentes, além da distribuição dos tickets por etapa e status de trabalho. As agregações são executadas pelo OonCore no backend sobre todos os registros.
"""
if marker not in text:
    readme.write_text(text.rstrip() + "\n\n" + section.strip() + "\n")
