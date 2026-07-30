"use strict";

const {
  registry,
  GenericError,
} = require("@oondemand/oon-core-back");
const { recalcularProjetoItem } = require("../triggers/Pagamento");

function model(nome) {
  return registry.getModel(nome)?.mongooseModel;
}

function conflito(message) {
  throw new GenericError(message, { statusCode: 409 });
}

function protegerExclusao(Model, verificacoes) {
  if (!Model || Model.__oonExclusaoProtegida) return;
  const original = Model.findByIdAndDelete.bind(Model);

  Model.findByIdAndDelete = async function excluirComProtecao(id, opcoes = {}) {
    for (const verificar of verificacoes) await verificar(id);
    return original(id, opcoes);
  };
  Model.__oonExclusaoProtegida = true;
}

const ClienteFornecedor = model("ClienteFornecedor");
const Contato = model("Contato");
const Categoria = model("Categoria");
const Responsavel = model("Responsavel");
const Estado = model("Estado");
const Cidade = model("Cidade");
const Projeto = model("Projeto");
const ProjetoItem = model("ProjetoItem");
const Pagamento = model("Pagamento");

protegerExclusao(ClienteFornecedor, [
  async (id) => {
    if (await Contato?.exists({ clienteFornecedorId: id })) {
      conflito("Este cliente/fornecedor possui contatos. Inative o cadastro em vez de excluir.");
    }
    if (await Projeto?.exists({ $or: [{ clienteId: id }, { fornecedorId: id }] })) {
      conflito("Este cliente/fornecedor está vinculado a projetos. Inative o cadastro em vez de excluir.");
    }
  },
]);

protegerExclusao(Contato, [
  async (id) => {
    if (await Projeto?.exists({ contatoPrincipalId: id })) {
      conflito("Este contato é o contato principal de um projeto. Altere o projeto antes de excluir.");
    }
  },
]);

protegerExclusao(Categoria, [
  async (id) => {
    if (await Categoria?.exists({ categoriaPaiId: id })) {
      conflito("Esta categoria possui subcategorias. Inative-a em vez de excluir.");
    }
    if (await ProjetoItem?.exists({ $or: [{ categoriaId: id }, { subcategoriaId: id }] })) {
      conflito("Esta categoria está vinculada a itens de projeto. Inative-a em vez de excluir.");
    }
  },
]);

protegerExclusao(Responsavel, [
  async (id) => {
    if (await ProjetoItem?.exists({ responsavelId: id })
      || await Pagamento?.exists({ responsavelPagamentoId: id })) {
      conflito("Este responsável está em uso. Inative-o em vez de excluir.");
    }
  },
]);

protegerExclusao(Estado, [
  async (id) => {
    if (await Cidade?.exists({ estadoId: id }) || await ProjetoItem?.exists({ estadoId: id })) {
      conflito("Este estado está em uso e não pode ser excluído.");
    }
  },
]);

protegerExclusao(Cidade, [
  async (id) => {
    if (await ProjetoItem?.exists({ cidadeId: id })) {
      conflito("Esta cidade está vinculada a itens de projeto.");
    }
  },
]);

protegerExclusao(Projeto, [
  async (id) => {
    if (await ProjetoItem?.exists({ projetoId: id }) || await Pagamento?.exists({ projetoId: id })) {
      conflito("Este projeto possui itens ou pagamentos. Inative-o em vez de excluir.");
    }
  },
]);

protegerExclusao(ProjetoItem, [
  async (id) => {
    if (await Pagamento?.exists({ projetoItemId: id })) {
      conflito("Este item possui pagamentos e não pode ser excluído.");
    }
  },
]);

if (Pagamento && !Pagamento.__oonExclusaoRecalculaItem) {
  const originalPagamento = Pagamento.findByIdAndDelete.bind(Pagamento);
  Pagamento.findByIdAndDelete = async function excluirPagamento(id, opcoes = {}) {
    const atual = await Pagamento.findById(id).lean();
    const excluido = await originalPagamento(id, opcoes);
    if (atual?.projetoItemId) await recalcularProjetoItem(atual.projetoItemId);
    return excluido;
  };
  Pagamento.__oonExclusaoRecalculaItem = true;
}
