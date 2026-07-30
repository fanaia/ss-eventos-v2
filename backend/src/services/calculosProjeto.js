"use strict";

const formatadorBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function arredondar(valor) {
  return Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
}

function formatarMoedaBRL(valor) {
  return formatadorBRL.format(arredondar(Math.max(0, numero(valor))));
}

function calcularTotal(dados, prefixo) {
  return arredondar(
    numero(dados?.[`${prefixo}Quantidade`])
      * numero(dados?.[`${prefixo}Diarias`])
      * numero(dados?.[`${prefixo}ValorUnitario`]),
  );
}

function calcularFechamento({
  orcamentoTotal,
  contratacaoTotal,
  faturamento,
  percentualFee,
  percentualImposto,
}) {
  const fee = faturamento === "Agência Interna"
    ? 0
    : arredondar(orcamentoTotal * (numero(percentualFee) / 100));

  let baseImposto = 0;
  if (faturamento === "Agência") baseImposto = orcamentoTotal + fee;
  if (faturamento === "Agência Interna") baseImposto = orcamentoTotal;
  if (faturamento === "Faturamento Direto") baseImposto = fee;

  const imposto = arredondar(baseImposto * (numero(percentualImposto) / 100));
  const total = arredondar(orcamentoTotal + fee + imposto);
  const lucroValor = arredondar(orcamentoTotal - contratacaoTotal + fee);
  const lucroPercentual = orcamentoTotal > 0
    ? arredondar((lucroValor / orcamentoTotal) * 100)
    : 0;

  return {
    fechamentoValor: orcamentoTotal,
    fechamentoFee: fee,
    fechamentoImposto: imposto,
    fechamentoTotal: total,
    fechamentoLucroValor: lucroValor,
    fechamentoLucroPercentual: lucroPercentual,
  };
}

function calcularValoresItem(dados = {}, projeto = {}) {
  const orcamentoTotal = calcularTotal(dados, "orcamento");
  const contratacaoTotal = calcularTotal(dados, "contratacao");
  const percentualFeeAplicado = numero(projeto.percentualFee);
  const percentualImpostoAplicado = numero(projeto.percentualImposto);

  return {
    orcamentoTotal,
    contratacaoTotal,
    percentualFeeAplicado,
    percentualImpostoAplicado,
    ...calcularFechamento({
      orcamentoTotal,
      contratacaoTotal,
      faturamento: dados.faturamento,
      percentualFee: percentualFeeAplicado,
      percentualImposto: percentualImpostoAplicado,
    }),
  };
}

function resumirPagamento({ status, pendente } = {}) {
  const saldo = arredondar(Math.max(0, numero(pendente)));
  if (String(status ?? "") === "Pago" && saldo <= 0.01) return "Pago";
  return `Pendente: ${formatarMoedaBRL(saldo)}`;
}

function calcularResumoPagamentos(pagamentos = [], contratacaoTotal = 0) {
  const ativos = pagamentos.filter((pagamento) => !pagamento.canceladoNaCentral);
  const planejado = arredondar(ativos.reduce((total, pagamento) => total + numero(pagamento.valor), 0));
  const pago = arredondar(ativos.reduce((total, pagamento) => total + numero(pagamento.omieValorPago), 0));
  const pendente = arredondar(Math.max(0, numero(contratacaoTotal) - pago));

  let status = "Sem pagamento";
  if (planejado > numero(contratacaoTotal) + 0.01) status = "Divergência";
  else if (ativos.some((pagamento) => pagamento.omieStatusIntegracao === "Erro")) status = "Erro de integração";
  else if (pendente <= 0.01 && numero(contratacaoTotal) > 0) status = "Pago";
  else if (pago > 0) status = "Parcialmente pago";
  else if (ativos.some((pagamento) => (
    ["Enviado para Omie", "Pagamento Ok"].includes(pagamento.etapa)
      || ["Pendente", "Processando", "Enviado"].includes(pagamento.omieStatusIntegracao)
  ))) status = "Enviado ao Omie";
  else if (planejado > 0) status = "Pagamento pendente";

  return {
    pagamentoTotalPlanejado: planejado,
    pagamentoTotalPago: pago,
    pagamentoValorPendente: pendente,
    pagamentoStatus: status,
    pagamentoResumo: resumirPagamento({ status, pendente }),
  };
}

module.exports = {
  numero,
  arredondar,
  formatarMoedaBRL,
  calcularTotal,
  calcularFechamento,
  calcularValoresItem,
  resumirPagamento,
  calcularResumoPagamentos,
};
