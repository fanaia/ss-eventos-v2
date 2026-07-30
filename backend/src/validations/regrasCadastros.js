"use strict";

const {
  defineValidation,
  registry,
  GenericError,
} = require("@oondemand/oon-core-back");
const {
  cpfValido,
  cnpjValido,
  emailValido,
} = require("../services/documentos");

function model(nome) {
  const Model = registry.getModel(nome)?.mongooseModel;
  if (!Model) throw new GenericError(`Model ${nome} não registrada.`, { statusCode: 500 });
  return Model;
}

function erroCampo(field, message, statusCode = 422) {
  throw new GenericError(message, {
    statusCode,
    details: { field, message },
  });
}

defineValidation("ClienteFornecedor", async (dados) => {
  if (!dados.cliente && !dados.fornecedor) {
    erroCampo("cliente", "Marque o cadastro como Cliente, Fornecedor ou ambos.");
  }

  if (dados.origem === "Omie") return;
  if (!String(dados.documento ?? "").trim()) {
    erroCampo("documento", "Informe o documento do cliente/fornecedor.");
  }
  if (dados.tipo === "PF" && !cpfValido(dados.documento)) {
    erroCampo("documento", "CPF inválido.");
  }
  if (dados.tipo === "PJ" && !cnpjValido(dados.documento)) {
    erroCampo("documento", "CNPJ inválido.");
  }
  if (dados.tipo === "Est" && !String(dados.documento ?? "").trim()) {
    erroCampo("documento", "Informe o documento estrangeiro.");
  }
});

defineValidation("Contato", async (dados) => {
  if (!emailValido(dados.email)) erroCampo("email", "E-mail inválido.");
});

defineValidation("Responsavel", async (dados) => {
  if (!emailValido(dados.email)) erroCampo("email", "E-mail inválido.");
});

defineValidation("Categoria", async (dados, contexto) => {
  const id = contexto?.id ?? dados?._id;
  if (id && dados.categoriaPaiId && String(id) === String(dados.categoriaPaiId)) {
    erroCampo("categoriaPaiId", "Uma categoria não pode ser sua própria categoria pai.");
  }
});

defineValidation("Cidade", async (dados) => {
  if (!dados.estadoId) return;
  const estado = await model("Estado").findById(dados.estadoId).lean();
  if (!estado || estado.status === "Inativo") {
    erroCampo("estadoId", "Selecione um estado ativo para a cidade.");
  }
});
