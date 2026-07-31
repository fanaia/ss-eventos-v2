import { startFromManifest } from "@oondemand/oon-core-front";
import sourceManifest from "../central.ui.json";

/**
 * Mantém a regra no manifesto: o pagamento criado dentro do item herda projeto,
 * item e saldo pendente do registro pai. OonCore 0.3.44+ interpreta
 * `initialValuesFromParent`; os metadados explícitos preservam os controles
 * corretos também durante a homologação da versão anterior.
 */
function configurePaymentCreation(input: typeof sourceManifest) {
  const manifest = structuredClone(input) as any;
  const itemPipeline = manifest.pipelines?.find((pipeline: any) => pipeline.model === "ProjetoItem");
  const paymentTab = itemPipeline?.ticketModal?.tabs?.find((tab: any) => tab.id === "pagamento");

  if (paymentTab?.create) {
    paymentTab.create.fields = [
      { field: "dataPrevisaoPagamento", kind: "date", label: "Data previsão pagamento", required: true },
      { field: "valor", kind: "currency", label: "Valor", required: true },
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
    ];
    paymentTab.create.initialValues = {
      etapa: "Solicitado",
      statusTrabalho: "Aguardando início",
      nfRecebida: false,
    };
    paymentTab.create.initialValuesFromParent = {
      projetoId: "projetoId",
      projetoItemId: "_id",
      valor: "pagamentoValorPendente",
    };
  }

  return manifest;
}

const manifest = configurePaymentCreation(sourceManifest);

startFromManifest(manifest, {
  apiBaseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
  meusAppsUrl: import.meta.env.VITE_MEUS_APPS_URL,
  devToken: import.meta.env.DEV ? (import.meta.env.VITE_DEV_TOKEN ?? "dev-local") : undefined,
});
