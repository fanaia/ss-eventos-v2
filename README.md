# Ss Eventos V2

Central Oon gerada com `create-central-oon`. É composta por dois projetos mínimos que consomem o Core:

- **backend/** — só domínio (`src/models`, `validations`, `triggers`, …).
  Sobe com `oonCore-back dev`. Toda a infra (boot, db, auth, RBAC, metadata,
  CRUD, deploy) vem do `@oondemand/oon-core-back`.
- **frontend/** — só declaração (`central.ui.json`). Sobe com `oonCore-front
  dev`. Shell, providers, roteamento, auth e telas vêm do
  `@oondemand/oon-core-front`, renderizados a partir do `/core/metadata` do back.

## Documentação local do OonCore

A pasta `.ooncore/` é gerada automaticamente a partir da versão instalada do pacote `@oondemand/create-central-oon`.

Ela serve como contexto local para o Codex codificar sem depender de site externo.

```bash
npm run ooncore:docs        # sincroniza .ooncore/
npm run ooncore:docs:check  # valida versão/hash da documentação local
```

Não edite `.ooncore/context.generated.md` manualmente. Atualize o pacote e rode o sync.

## Rodando

```bash
# raiz da Central
npm install
npm run ooncore:docs:check

# backend
cd backend && cp .env.example .env && npm install && npm run dev

# frontend (noutro terminal)
cd frontend && cp .env.example .env && npm install && npm run dev
```

## Evoluindo a Central

1. Crie models em `backend/src/models` (só schema + CRUD).
2. Declare as telas em `frontend/central.ui.json` (coleções/esteiras/documentos).
3. Use validations, triggers, hooks, mappings e integrations para regras e processos.
4. O resto — grid, form, rotas, menu — é montado pelo Core automaticamente.
