import { startFromManifest } from "@oondemand/oon-core-front";
import manifest from "../central.ui.json";

/**
 * Toda a Central Ss Eventos V2 inicia por aqui. Sem providers, router, auth, layout
 * ou páginas — só o manifesto declarativo `central.ui.json`. O Core resolve as
 * telas a partir do `/core/metadata` do backend.
 */
startFromManifest(manifest, {
  apiBaseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
  meusAppsUrl: import.meta.env.VITE_MEUS_APPS_URL,
  // O valor só entra no bundle servido pelo Vite em modo de desenvolvimento.
  // O backend continua validando se ele coincide com DEV_TOKEN.
  devToken: import.meta.env.DEV ? (import.meta.env.VITE_DEV_TOKEN ?? "dev-local") : undefined,
});
