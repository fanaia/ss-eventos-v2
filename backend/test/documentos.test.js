"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  cpfValido,
  cnpjValido,
  emailValido,
} = require("../src/services/documentos");

test("valida CPF e CNPJ", () => {
  assert.equal(cpfValido("529.982.247-25"), true);
  assert.equal(cpfValido("111.111.111-11"), false);
  assert.equal(cnpjValido("11.222.333/0001-81"), true);
  assert.equal(cnpjValido("11.111.111/1111-11"), false);
});

test("aceita email vazio e valida email preenchido", () => {
  assert.equal(emailValido(""), true);
  assert.equal(emailValido("financeiro@empresa.com.br"), true);
  assert.equal(emailValido("email-invalido"), false);
});
