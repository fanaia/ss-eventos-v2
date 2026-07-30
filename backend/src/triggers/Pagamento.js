"use strict";

const {
  defineTrigger,
  registry,
  GenericError,
} = require("@oondemand/oon-core-back");
const { calcularResumoPagamentos } = require("../services/calculosProjeto");

const ETAPAS_AUTOMATICAS = new Set(["Enviado para Omie", "Pagamento Ok"]);

async function recalcularProjetoItem(projetoItemId) {
  if (!projetoItemId) return null;
  const Pagamento = registry.getModel("Pagamento")?.mongooseModel;
  const ProjetoItem = registry.getModel("ProjetoItem")?.mongooseModel;
  if (!Pagamento || !ProjetoItem) {
    throw new GenericError("Models de pagamento não registradas.", { statusCode: 500 });
  }

  const item = await ProjetoItem.findById(projetoItemId);
  if (!item) return null;

  const pagamentos = await Pagamento.find({
    projetoItemId,
    canceladoNaCentral: { $ne: true },
  }).lean();

  const resumo = calcularResumoPagamentos(pagamentos, item.contratacaoTotal);
  for (const [campo, valor] of Object.entries(resumo)) item.set(campo, valor);
  await item.save();
  return item;
}

defineTrigger("Pagamento", {
  before: async (documento) => {
    const valor = Number(documento.valor || 0);
    const pago = Math.max(0, Number(documento.omieValorPago || 0));

    documento.set("omieValorTitulo", valor);
    documento.set("omieValorPendente", Math.max(0, valor - pago));

    if (ETAPAS_AUTOMATICAS.has(documento.etapa)) {
      documento.set("statusTrabalho", "Trabalhando");
    }
    if (documento.etapa === "Enviado para Omie"
      && ["Não enviado", "Cancelado"].includes(documento.omieStatusIntegracao)) {
      documento.set("omieStatusIntegracao", "Pendente");
    }
    if (documento.omieLiquidado || pago >= valor - 0.01) {
      documento.set("omieLiquidado", valor > 0);
      if (valor > 0) documento.set("etapa", "Pagamento Ok");
    }
  },
  after: async (documento) => {
    await recalcularProjetoItem(documento.projetoItemId);
  },
});

module.exports = { ETAPAS_AUTOMATICAS, recalcularProjetoItem };
