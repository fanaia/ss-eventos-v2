/**
 * Configuração da Central Ss Eventos V2 (Seção 8). Apenas identidade, módulos
 * ativos e os paths de domínio. Sem db/auth/deploy — isso vive no Core e nas
 * variáveis de ambiente.
 */

// Em desenvolvimento, aceita o DEV_TOKEN sem chamar o Meus Apps.
// Para usar: acesse http://localhost:5173/?code=<DEV_TOKEN>
const devAuth =
  process.env.NODE_ENV === "development" && process.env.DEV_TOKEN
    ? {
        verifyToken: async (token) => {
          if (token !== process.env.DEV_TOKEN) {
            const err = new Error("Token inválido.");
            err.statusCode = 401;
            throw err;
          }
          return { tipo: "admin", nome: "Dev Local", email: "dev@local" };
        },
      }
    : undefined;

module.exports = {
  ecosystem: { role: "member" },
  activation: { enabled: true, configurationVersion: 1, fields: [] },
  name: "Ss Eventos V2",
  slug: "ss-eventos-v2",

  auth: devAuth,

  // Módulos opinativos do Core ligados nesta Central.
  modules: {
    collections: true,
    documents: false,
    pipelines: false,
    integrations: false,
    omie: false,
    assistants: false,
    currencies: false,
  },

  // Paths de domínio (carregados por convenção pelo Core no boot).
  domain: {
    models: "src/models",
    validations: "src/validations",
    triggers: "src/triggers",
    hooks: "src/hooks",
    mappings: "src/mappings",
    documents: "src/documents",
    pipelines: "src/pipelines",
    integrations: "src/integrations",
    routes: "src/routes",
  },
};
