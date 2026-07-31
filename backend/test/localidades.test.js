"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  TOTAL_ESTADOS,
  MINIMO_MUNICIPIOS,
  normalizarLocalidades,
} = require("../src/services/localidadesInternas");

test("normaliza o catálogo mínimo de localidades do IBGE", () => {
  const estados = Array.from({ length: TOTAL_ESTADOS }, (_, index) => ({
    id: 11 + index,
    sigla: `U${String(index).padStart(1, "0")}`.slice(0, 2),
    nome: `Estado ${index}`,
  }));
  const municipios = Array.from({ length: MINIMO_MUNICIPIOS }, (_, index) => {
    const estado = estados[index % estados.length];
    return {
      id: Number(`${estado.id}${String(index).padStart(5, "0")}`),
      nome: `Município ${index}`,
    };
  });

  const resultado = normalizarLocalidades(estados, municipios);
  assert.equal(resultado.estados.length, TOTAL_ESTADOS);
  assert.equal(resultado.cidades.length, MINIMO_MUNICIPIOS);
  assert.equal(new Set(resultado.cidades.map((cidade) => cidade.codigoIbge)).size, MINIMO_MUNICIPIOS);
});
