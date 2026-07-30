"use strict";

const {
  defineTrigger,
  registry,
  GenericError,
} = require("@oondemand/oon-core-back");

defineTrigger("Projeto", {
  after: async (projeto) => {
    const ProjetoItem = registry.getModel("ProjetoItem")?.mongooseModel;
    if (!ProjetoItem) throw new GenericError("Model ProjetoItem não registrada.", { statusCode: 500 });

    const itens = await ProjetoItem.find({ projetoId: projeto._id });
    for (const item of itens) {
      // O trigger de ProjetoItem reaplica fee, imposto, fechamento e lucro.
      await item.save();
    }
  },
});
