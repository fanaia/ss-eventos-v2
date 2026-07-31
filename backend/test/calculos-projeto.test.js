"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calcularValoresItem,
  calcularResumoPagamentos,
} = require("../src/services/calculosProjeto");

const base = {
  orcamentoQuantidade: 2,
  orcamentoDiarias: 3,
  orcamentoValorUnitario: 100,
  contratacaoQuantidade: 2,
  contratacaoDiarias: 3,
  contratacaoValorUnitario: 70,
};

test("calcula Agência com fee e imposto sobre orçamento + fee", () => {
  const resultado = calcularValoresItem(
    { ...base, faturamento: "Agência" },
    { percentualFee: 10, percentualImposto: 5 },
  );
  assert.equal(resultado.orcamentoTotal, 600);
  assert.equal(resultado.contratacaoTotal, 420);
  assert.equal(resultado.fechamentoFee, 60);
  assert.equal(resultado.fechamentoImposto, 33);
  assert.equal(resultado.fechamentoTotal, 693);
  assert.equal(resultado.fechamentoLucroValor, 240);
  assert.equal(resultado.fechamentoLucroPercentual, 40);
});

test("calcula Agência Interna sem fee", () => {
  const resultado = calcularValoresItem(
    { ...base, faturamento: "Agência Interna" },
    { percentualFee: 10, percentualImposto: 5 },
  );
  assert.equal(resultado.fechamentoFee, 0);
  assert.equal(resultado.fechamentoImposto, 30);
  assert.equal(resultado.fechamentoTotal, 630);
  assert.equal(resultado.fechamentoLucroValor, 180);
});

test("calcula Faturamento Direto com imposto somente sobre fee", () => {
  const resultado = calcularValoresItem(
    { ...base, faturamento: "Faturamento Direto" },
    { percentualFee: 10, percentualImposto: 5 },
  );
  assert.equal(resultado.fechamentoFee, 60);
  assert.equal(resultado.fechamentoImposto, 3);
  assert.equal(resultado.fechamentoTotal, 663);
});

test("resume pagamentos parciais e liquidados", () => {
  const parcial = calcularResumoPagamentos([
    { valor: 200, omieValorPago: 80, omieStatusIntegracao: "Enviado" },
    { valor: 220, omieValorPago: 0, omieStatusIntegracao: "Não enviado" },
  ], 420);
  assert.equal(parcial.pagamentoTotalPlanejado, 420);
  assert.equal(parcial.pagamentoTotalPago, 80);
  assert.equal(parcial.pagamentoValorPendente, 340);
  assert.equal(parcial.pagamentoStatus, "Parcialmente pago");

  const pago = calcularResumoPagamentos([
    { valor: 420, omieValorPago: 420, omieStatusIntegracao: "Enviado", etapa: "Pagamento Ok" },
  ], 420);
  assert.equal(pago.pagamentoStatus, "Pago");
  assert.equal(pago.pagamentoResumo, "Pago");
});
