"use strict";

function dadosConsolidados(dados = {}, contexto = {}) {
  return contexto?.consolidated && typeof contexto.consolidated === "object"
    ? contexto.consolidated
    : dados;
}

function dadosComDependenciaOpcional(
  dados = {},
  contexto = {},
  campoPai,
  campoDependente,
) {
  const entrada = { ...dadosConsolidados(dados, contexto) };
  const alteracoes = contexto?.changes ?? dados ?? {};
  const paiAlterado = Object.prototype.hasOwnProperty.call(alteracoes, campoPai);
  const dependenteAlterado = Object.prototype.hasOwnProperty.call(alteracoes, campoDependente);

  if (paiAlterado && !dependenteAlterado) entrada[campoDependente] = null;
  return entrada;
}

function subcategoriaPertenceACategoria(categoriaId, subcategoria) {
  if (!categoriaId || !subcategoria?.categoriaPaiId) return false;
  return String(subcategoria.categoriaPaiId) === String(categoriaId);
}

module.exports = {
  dadosConsolidados,
  dadosComDependenciaOpcional,
  subcategoriaPertenceACategoria,
};
