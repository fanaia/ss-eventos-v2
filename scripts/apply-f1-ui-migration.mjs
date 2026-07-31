import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const uiPath = path.join(root, "frontend", "central.ui.json");
const ui = JSON.parse(fs.readFileSync(uiPath, "utf8"));

delete ui.name;
delete ui.slug;
delete ui.appKind;
delete ui.auth;
ui.schemaVersion = 2;

const itemPipeline = (ui.pipelines ?? []).find((pipeline) => pipeline.model === "ProjetoItem");
if (!itemPipeline) throw new Error("Esteira ProjetoItem não encontrada em central.ui.json.");
const paymentTab = itemPipeline.ticketModal?.tabs?.find((tab) => tab.id === "pagamento");
if (!paymentTab || paymentTab.type !== "relatedGrid") {
  throw new Error("Aba pagamento da esteira ProjetoItem não encontrada.");
}

paymentTab.create = {
  enabled: true,
  label: "Novo pagamento",
  fields: [
    {
      field: "dataPrevisaoPagamento",
      kind: "date",
      label: "Data previsão pagamento",
      required: true,
    },
    {
      field: "valor",
      kind: "currency",
      label: "Valor",
      required: true,
    },
    {
      field: "responsavelPagamentoId",
      kind: "ref",
      ref: "Responsavel",
      label: "Responsável pelo pagamento",
      required: true,
      referenceFilters: { status: "Ativo" },
    },
    {
      field: "nfRecebida",
      kind: "boolean",
      label: "NF recebida",
      widget: "checkbox",
      checkedValue: true,
      uncheckedValue: false,
    },
  ],
  initialValues: {
    etapa: "Solicitado",
    statusTrabalho: "Aguardando início",
    nfRecebida: false,
  },
  initialValuesFromParent: {
    projetoId: "projetoId",
    projetoItemId: "_id",
    valor: "pagamentoValorPendente",
  },
};

fs.writeFileSync(uiPath, `${JSON.stringify(ui, null, 2)}\n`);

const workflowPath = path.join(root, ".github", "workflows", "f1-ui-migration.yml");
fs.rmSync(path.join(root, "scripts", "apply-f1-ui-migration.mjs"), { force: true });
fs.rmSync(workflowPath, { force: true });

execFileSync("git", ["config", "user.name", "github-actions[bot]"], { stdio: "inherit" });
execFileSync("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], { stdio: "inherit" });
execFileSync("git", ["add", "frontend/central.ui.json", "scripts/apply-f1-ui-migration.mjs", ".github/workflows/f1-ui-migration.yml"], { stdio: "inherit" });
execFileSync("git", ["commit", "-m", "refactor: move payment creation into UI manifest"], { stdio: "inherit" });
execFileSync("git", ["push", "origin", "HEAD:agent/f1-central-app-conformance"], { stdio: "inherit" });
