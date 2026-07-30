"use strict";

const { registry } = require("@oondemand/oon-core-back");
const { agendarSincronizacao } = require("../services/localidadesInternas");

const Estado = registry.getModel("Estado")?.mongooseModel;
const Cidade = registry.getModel("Cidade")?.mongooseModel;

if (Estado && Cidade) {
  agendarSincronizacao({
    connection: Cidade.db,
    obterModels: () => ({ Estado, Cidade }),
  });
}
