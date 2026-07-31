# Central SS Eventos V2

Reconstrução declarativa da Central SS Eventos sobre o OonCore.

A V2 comprova que navegação, coleções, esteiras, formulários, abas, grids relacionados, cálculos e regras específicas do negócio podem existir sem copiar shell, autenticação, páginas genéricas ou infraestrutura do Core.

## Fronteira arquitetural

A Central declara somente:

- `central.app.json`: identidade, `appKind`, módulos, capabilities e compatibilidade;
- `backend/central.domain.json`: models, campos, referências, fórmulas e validações declarativas;
- `frontend/central.ui.json`: navegação, coleções, esteiras, filtros, abas, grids e ações;
- `backend/src/validations`: regras específicas que consultam outros registros;
- `backend/src/triggers`: efeitos e cálculos entre models;
- `backend/src/hooks`: proteção de exclusão e carga das localidades oficiais;
- `backend/src/services`: funções puras reutilizadas pelas regras.

`backend/central.config.js` não contém identidade nem autenticação. `frontend/src/main.tsx` apenas importa os dois manifestos e chama `startCentralFromManifest`.

## Versão-alvo

Os três pacotes estão fixados exatamente em `0.3.45`:

- `@oondemand/create-central-oon`;
- `@oondemand/oon-core-back`;
- `@oondemand/oon-core-front`.

A versão introduz `central.app.json`, bootstrap estrito, autenticação local fornecida pelo Core e o gate `create-central-oon conformance`.

## Identidade e capabilities

A fonte única da identidade é `central.app.json`:

```json
{
  "id": "ss-eventos-v2",
  "appKind": "member-central",
  "modules": {
    "collections": true,
    "pipelines": true,
    "integrations": false,
    "omie": false
  },
  "capabilities": [
    "core.collections",
    "core.pipelines",
    "domain.computed-fields",
    "ui.related-grid.parent-defaults"
  ]
}
```

Integrações e Omie permanecem desabilitados até que a engine e o adaptador nativos estejam disponíveis no OonCore.

## Domínio declarado

### Cadastros

- Clientes/Fornecedores;
- Contatos;
- Categorias/Subcategorias;
- Responsáveis;
- Estados;
- Cidades.

### Operação

- Projetos;
- Itens de Projeto;
- Esteira de Itens.

### Financeiro

- Pagamentos;
- Esteira de Pagamentos.

A criação de pagamento está integralmente declarada em `central.ui.json`:

- projeto e item são herdados do registro pai;
- o valor inicia com o saldo pendente;
- a etapa inicial é `Solicitado` e não aparece no formulário;
- data e valor usam controles próprios;
- responsável usa referência filtrada por registros ativos;
- NF recebida usa checkbox booleano.

## Regras cobertas

- CPF/CNPJ conforme o tipo de pessoa;
- cliente ou fornecedor obrigatório;
- contato principal pertencente ao cliente;
- cadastros relacionados ativos;
- estado/cidade e categoria/subcategoria dependentes;
- cálculo de orçamento e contratação;
- fee e imposto conforme o faturamento;
- fechamento, lucro em valor e percentual;
- limite dos pagamentos pelo valor contratado;
- aprovação, recusa e status de trabalho;
- bloqueio das etapas automáticas de pagamento;
- atualização dos totais e do resumo de pagamentos;
- sincronização de estados e cidades pela API oficial do IBGE;
- proteção contra exclusão de registros em uso.

## Limite desta fase

Não existem na V2:

- outbox/inbox;
- histórico técnico de execução;
- worker;
- lock e retry;
- rotas técnicas;
- cliente HTTP Omie;
- models técnicos da integração.

Esses recursos deverão ser incorporados ao OonCore antes da ativação real da integração.

## Referência da Fase 0

A V2 continua sendo alvo de comparação da SS-Eventos original e não está autorizada para cutover.

```bash
npm run baseline:check
```

Os SHAs, versões e limites da referência congelada estão em [`baseline.reference.json`](baseline.reference.json) e [`docs/BASELINE_REFERENCE.md`](docs/BASELINE_REFERENCE.md). O baseline não é regravado por esta migração; ele continua identificando a referência anterior à Fase 1.

## Validação

```bash
npm install
npm run ooncore:docs:check
npm run ooncore:conformance
npm run check
npm ci --prefix backend
npm test --prefix backend
npm ci --prefix frontend
npm run build --prefix frontend
```

O gate rejeita transforms no bootstrap, registries/páginas locais, identidade duplicada, models técnicos, workers, clients Omie e patches de Mongoose.

O roteiro funcional está em [`docs/HOMOLOGACAO_PARIDADE.md`](docs/HOMOLOGACAO_PARIDADE.md).
