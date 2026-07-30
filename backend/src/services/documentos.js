"use strict";

function somenteDigitos(valor) {
  return String(valor ?? "").replace(/\D/g, "");
}

function todosIguais(valor) {
  return /^(\d)\1+$/.test(valor);
}

function cpfValido(valor) {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || todosIguais(cpf)) return false;

  const digito = (tamanho) => {
    let soma = 0;
    for (let indice = 0; indice < tamanho; indice += 1) {
      soma += Number(cpf[indice]) * (tamanho + 1 - indice);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

function cnpjValido(valor) {
  const cnpj = somenteDigitos(valor);
  if (cnpj.length !== 14 || todosIguais(cnpj)) return false;

  const digito = (base, pesos) => {
    const soma = base.reduce(
      (total, item, indice) => total + Number(item) * pesos[indice],
      0,
    );
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const base = cnpj.slice(0, 12).split("");
  const primeiro = digito(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digito(
    [...base, String(primeiro)],
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );

  return primeiro === Number(cnpj[12]) && segundo === Number(cnpj[13]);
}

function emailValido(valor) {
  return !String(valor ?? "").trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor).trim());
}

module.exports = { somenteDigitos, cpfValido, cnpjValido, emailValido };
