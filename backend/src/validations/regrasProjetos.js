"use strict";

const {
  defineValidation,
  registry,
  GenericError,
} = require("@oondemand/oon-core-back");
const {
  dadosConsolidados,
  dadosComDependenciaOpcional,
  subcategoriaPertenceACategoria,
} = require("../services/dadosValidacao");

const ETAPAS_AUTOMATICAS = new Set(["Enviado para Omie", "Pagamento Ok"]);
const CAMPOS_INTEGRACAO = new Set([
  "codigoLancamentoIntegracao",
  "codigoLancamentoOmie",
  "contaCorrenteOmieCodigo",
  "omieValorTitulo",
  "omieValorPago",
  "omieValorPendente",
  "omieDataUltimaBaixa",
  "omieLiquidado",
  "omieStatusIntegracao",
  "omieUltimoErro",
  "omieUltimaSincronizacaoEm",
  "canceladoNaCentral",
]);

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

async function registroAtivo(nome, id, field, mensagem) {
  if (!id) erroCampo(field, mensagem);
  const registro = await model(nome).findById(id).lean();
  if (!registro || registro.status === "Inativo") erroCampo(field, mensagem);
  return registro;
}

defineValidation("Projeto", async (dados, contexto) => {
  const entrada = dadosConsolidados(dados, contexto);
  const cliente = await registroAtivo(
    "ClienteFornecedor",
    entrada.clienteId,
    "clienteId",
    "Selecione um cliente ativo.",
  );
  if (!cliente.cliente) {
    erroCampo("clienteId", "O cadastro selecionado não está marcado como Cliente.");
  }

  const fornecedor = await registroAtivo(
    "ClienteFornecedor",
    entrada.fornecedorId,
    "fornecedorId",
    "Selecione um fornecedor ativo.",
  );
  if (!fornecedor.fornecedor) {
    erroCampo("fornecedorId", "O cadastro selecionado não está marcado como Fornecedor.");
  }

  const contato = await registroAtivo(
    "Contato",
    entrada.contatoPrincipalId,
    "contatoPrincipalId",
    "Selecione um contato ativo.",
  );
  if (String(contato.clienteFornecedorId) !== String(entrada.clienteId)) {
    erroCampo("contatoPrincipalId", "O contato principal deve pertencer ao cliente selecionado.");
  }
});

defineValidation("ProjetoItem", async (dados, contexto) => {
  const entrada = dadosComDependenciaOpcional(
    dados,
    contexto,
    "categoriaId",
    "subcategoriaId",
  );

  await registroAtivo("Projeto", entrada.projetoId, "projetoId", "Selecione um projeto ativo.");

  const responsavel = await registroAtivo(
    "Responsavel",
    entrada.responsavelId,
    "responsavelId",
    "Selecione um responsável ativo.",
  );
  if (!["Operacional", "Ambos"].includes(responsavel.tipo)) {
    erroCampo("responsavelId", "O responsável selecionado não está habilitado para a operação.");
  }

  const estado = await registroAtivo("Estado", entrada.estadoId, "estadoId", "Selecione um estado ativo.");
  const cidade = await registroAtivo("Cidade", entrada.cidadeId, "cidadeId", "Selecione uma cidade ativa.");
  if (String(cidade.estadoId) !== String(estado._id)) {
    erroCampo("cidadeId", "A cidade selecionada não pertence ao estado informado.");
  }

  const categoria = await registroAtivo(
    "Categoria",
    entrada.categoriaId,
    "categoriaId",
    "Selecione uma categoria ativa.",
  );
  if (categoria.categoriaPaiId) {
    erroCampo("categoriaId", "Selecione uma categoria principal, sem categoria pai.");
  }

  if (entrada.subcategoriaId) {
    const subcategoria = await registroAtivo(
      "Categoria",
      entrada.subcategoriaId,
      "subcategoriaId",
      "Selecione uma subcategoria ativa.",
    );
    if (!subcategoriaPertenceACategoria(categoria._id, subcategoria)) {
      erroCampo("subcategoriaId", "A subcategoria selecionada não pertence à categoria informada.");
    }
  }
});

async function validarLimitePagamento(entrada, contexto) {
  const Pagamento = model("Pagamento");
  const pagamentos = await Pagamento.find({
    projetoItemId: entrada.projetoItemId,
    canceladoNaCentral: { $ne: true },
  }).select("_id valor").lean();

  const atualId = contexto?.id ? String(contexto.id) : null;
  const outros = pagamentos
    .filter((pagamento) => !atualId || String(pagamento._id) !== atualId)
    .reduce((total, pagamento) => total + Number(pagamento.valor || 0), 0);
  const item = await model("ProjetoItem").findById(entrada.projetoItemId).lean();
  if (!item) erroCampo("projetoItemId", "Item do projeto não encontrado.");

  const total = outros + Number(entrada.valor || 0);
  if (total > Number(item.contratacaoTotal || 0) + 0.01) {
    erroCampo(
      "valor",
      `A soma dos pagamentos não pode ultrapassar o valor contratado do item (${Number(item.contratacaoTotal || 0).toFixed(2)}).`,
    );
  }
  return item;
}

function validarTransicaoPagamento(entrada, contexto) {
  const anterior = contexto?.current?.etapa;
  const proxima = entrada.etapa || "Solicitado";
  const alteracoes = contexto?.changes ?? {};

  if (!anterior && ETAPAS_AUTOMATICAS.has(proxima)) {
    erroCampo("etapa", "O pagamento deve iniciar em uma etapa manual.", 409);
  }

  if (anterior && ETAPAS_AUTOMATICAS.has(anterior)) {
    const campoNegocio = Object.keys(alteracoes).find((campo) => !CAMPOS_INTEGRACAO.has(campo));
    if (campoNegocio) {
      erroCampo(
        campoNegocio,
        "Esta é uma etapa automática. Os dados de negócio ficam bloqueados até a integração concluir.",
        409,
      );
    }
  }

  const permitidas = {
    Solicitado: new Set(["Solicitado", "Aprovado"]),
    Aprovado: new Set(["Solicitado", "Aprovado", "Aguardando NF"]),
    "Aguardando NF": new Set(["Aprovado", "Aguardando NF", "Enviado para Omie"]),
    "Enviado para Omie": new Set(["Enviado para Omie", "Pagamento Ok"]),
    "Pagamento Ok": new Set(["Pagamento Ok"]),
  };

  if (anterior && !permitidas[anterior]?.has(proxima)) {
    erroCampo("etapa", `Transição inválida de ${anterior} para ${proxima}.`, 409);
  }
  if (proxima === "Enviado para Omie" && !entrada.nfRecebida) {
    erroCampo("nfRecebida", "Confirme o recebimento da NF antes de enviar o pagamento ao Omie.");
  }
  if (proxima === "Pagamento Ok" && !entrada.omieLiquidado) {
    erroCampo("etapa", "Pagamento Ok somente pode ser definido após a baixa confirmada pela integração.");
  }
}

defineValidation("Pagamento", async (dados, contexto) => {
  const entrada = dadosConsolidados(dados, contexto);
  const item = await validarLimitePagamento(entrada, contexto);

  if (String(item.projetoId) !== String(entrada.projetoId)) {
    erroCampo("projetoItemId", "O pagamento deve estar vinculado ao mesmo projeto do item.");
  }

  const responsavel = await registroAtivo(
    "Responsavel",
    entrada.responsavelPagamentoId,
    "responsavelPagamentoId",
    "Selecione um responsável de pagamento ativo.",
  );
  if (!["Pagamento", "Ambos"].includes(responsavel.tipo)) {
    erroCampo("responsavelPagamentoId", "O responsável selecionado não está habilitado para pagamentos.");
  }

  validarTransicaoPagamento(entrada, contexto);
});

module.exports = {
  ETAPAS_AUTOMATICAS,
  CAMPOS_INTEGRACAO,
  validarLimitePagamento,
  validarTransicaoPagamento,
};
