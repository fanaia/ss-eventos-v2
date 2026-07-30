"use strict";

const {
  defineTrigger,
  registry,
  GenericError,
} = require("@oondemand/oon-core-back");
const { calcularValoresItem } = require("../services/calculosProjeto");

const CAMPOS_DERIVADOS = [
  "percentualFeeAplicado",
  "percentualImpostoAplicado",
  "fechamentoValor",
  "fechamentoFee",
  "fechamentoImposto",
  "fechamentoTotal",
  "fechamentoLucroValor",
  "fechamentoLucroPercentual",
];

defineTrigger("ProjetoItem", {
  before: async (documento) => {
    const Projeto = registry.getModel("Projeto")?.mongooseModel;
    if (!Projeto) throw new GenericError("Model Projeto não registrada.", { statusCode: 500 });

    const projeto = await Projeto.findById(documento.projetoId).lean();
    if (!projeto) throw new GenericError("Projeto informado não foi encontrado.", { statusCode: 422 });

    const calculado = calcularValoresItem(documento.toObject(), projeto);
    for (const campo of CAMPOS_DERIVADOS) documento.set(campo, calculado[campo]);
  },
});

module.exports = { CAMPOS_DERIVADOS };
