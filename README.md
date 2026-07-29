# Central SS Eventos V2

Reconstrução da Central SS Eventos sobre o OonCore, iniciada do zero e orientada por manifestos.

## Princípio da implementação

Este repositório contém somente o domínio e a declaração da experiência da Central:

- `backend/central.domain.json`: models, campos, fórmulas e validações;
- `backend/central.config.js`: identidade e módulos habilitados;
- `frontend/central.ui.json`: coleções, esteira, filtros, modais e abas;
- `@oondemand/oon-core-back`: autenticação, RBAC, banco, CRUD, metadata, auditoria e validação final;
- `@oondemand/oon-core-front`: shell, menu, grid, formulários, referências e fórmulas reativas.

Não há model de negócio em JavaScript nem página React customizada nesta fase.

## Versão homologada do Core

Os três pacotes estão fixados em `0.3.43`:

- `@oondemand/create-central-oon`;
- `@oondemand/oon-core-back`;
- `@oondemand/oon-core-front`.

A fixação é intencional para que a homologação seja reproduzível.

## Primeira vertical

### Cadastros

- Clientes / Fornecedores;
- Projetos.

### Operação

- Esteira de Itens por etapa: Orçamento, Contratação, Pagamento e Fechamento;
- modal com abas `Dados do item` e `Valores`;
- cálculo reativo e autoritativo de orçamento, contratação, pagamento, fee, impostos, fechamento e lucro.

O roteiro completo está em [`docs/HOMOLOGACAO_FASE_1.md`](docs/HOMOLOGACAO_FASE_1.md).

## Preparação local

```bash
npm install
npm run ooncore:docs:check
npm run check
```

Backend:

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Frontend, em outro terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Acesse o frontend com o token local configurado:

```text
http://localhost:5173/?code=dev-local
```

## Validações automatizadas

```bash
npm run check
```

O comando verifica:

- versões coordenadas do OonCore;
- models e `basePath` duplicados;
- referências entre models;
- referências usadas nas fórmulas;
- ciclos entre campos calculados;
- consistência entre `central.domain.json` e `central.ui.json`;
- presença das dependências reativas na mesma aba do formulário.

O workflow `.github/workflows/ci.yml` também instala backend/frontend e executa o build do frontend.

## Publicação

O repositório mantém o contrato neutro em `oon.deploy.json`. Após merge em `main`, o workflow `publish-dev` solicita a publicação pelo fluxo Oon sem armazenar credenciais de infraestrutura no repositório.

## Próximas fases

1. Homologar a primeira vertical.
2. Separar categorias e subcategorias em cadastro hierárquico.
3. Evoluir contatos de clientes e fornecedores.
4. Importar planilhas de orçamento.
5. Implementar pagamentos e integração Omie pelo runtime genérico do Core.
6. Migrar os demais processos da SS Eventos somente após cada capacidade estar consolidada no OonCore.
