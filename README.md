# Central SS Eventos V2

Reconstrução declarativa da Central SS Eventos sobre o OonCore.

A V2 comprova que navegação, coleções, esteiras, formulários, abas, grids relacionados, cálculos, regras específicas do negócio e operação de integrações podem existir sem copiar shell, autenticação, páginas genéricas ou infraestrutura técnica do Core.

## Fronteira arquitetural

A Central declara somente:

- `central.app.json`: identidade, `appKind`, módulos, capabilities e compatibilidade;
- `backend/central.domain.json`: models, campos, referências, fórmulas e validações declarativas;
- `frontend/central.ui.json`: navegação, coleções, esteiras, filtros, abas, grids e ações;
- `backend/src/validations`: regras específicas que consultam outros registros;
- `backend/src/triggers`: efeitos e cálculos entre models;
- `backend/src/hooks`: proteção de exclusão e carga das localidades oficiais;
- `backend/src/services`: funções puras reutilizadas pelas regras;
- `backend/src/mappings/omie.js`: endpoints, chamadas, listas, transformações e eventos Omie específicos da SS Eventos.

`backend/central.config.js` não contém identidade nem autenticação. `frontend/src/main.tsx` apenas importa os dois manifestos e chama `startCentralFromManifest`.

A engine de integrações pertence ao OonCore. Não existem na V2 models técnicos, outbox, inbox, runtime, rotas operacionais, worker por timer ou página local de integrações.

## Versão-alvo

Os três pacotes estão fixados exatamente em `0.3.63`:

- `@oondemand/create-central-oon`;
- `@oondemand/oon-core-back`;
- `@oondemand/oon-core-front`.

A versão `0.3.63` está publicada no npm e é consumida por lockfiles reproduzíveis da raiz, do backend e do frontend.

Além dos contratos declarativos anteriores, essa versão fornece a engine genérica de integrações, página operacional nativa e o executável separado `oonCore-integration-worker`.

## Identidade e capabilities

A fonte única da identidade é `central.app.json`:

```json
{
  "id": "ss-eventos-v2",
  "appKind": "member-central",
  "modules": {
    "collections": true,
    "pipelines": true,
    "integrations": true,
    "omie": true
  },
  "capabilities": [
    "core.collections",
    "core.pipelines",
    "core.integrations",
    "core.integrations.omie",
    "domain.computed-fields",
    "ui.related-grid.parent-defaults"
  ]
}
```

As capabilities `core.integrations` e `core.integrations.omie` habilitam a página, as APIs operacionais e o adaptador Omie nativo do OonCore. A Central declara somente endpoints, chamadas, listas, transformações e ações do seu domínio; cliente HTTP, credenciais, outbox, inbox, retry, locks e worker permanecem no Core.

## Engine de integrações

A infraestrutura consumida da OonCore inclui:

- provider registry e catálogo de recursos;
- outbox persistente e idempotente;
- inbox idempotente para webhooks;
- histórico de execução sanitizado;
- lock por lease e heartbeat;
- retry e classificação de erro;
- arquivamento e reprocessamento;
- página operacional nativa em `/integracoes`;
- worker separado do servidor web.

Para desenvolvimento ou execução isolada do worker:

```bash
npm run integration:worker --prefix backend
npm run integration:worker:once --prefix backend
```

Em ambiente publicado, o worker deve ser executado por processo ou Deployment separado do backend web. A declaração e reconciliação desse workload pertencem à camada de delivery/infraestrutura.

Com `omie` habilitado, a página de Integrações registra o provider nativo e apresenta configuração segura, teste de conexão, chamadas, `listas-omie`, mappings de webhook, filas e diagnósticos sanitizados.

No OonCore `0.3.63`, a engrenagem no header direciona para a configuração da Central e, na ausência de uma página própria, abre `/integracoes`. As capabilities arquiteturais do aplicativo são avaliadas separadamente das permissões RBAC do usuário, permitindo acessar a configuração e o teste do Omie sem duplicar a capability no token. A versão também corrige a persistência das credenciais Omie em ambientes publicados, reutilizando `INSTANCE_CREDENTIAL_ENCRYPTION_KEY`, e apresenta na interface o diagnóstico sanitizado devolvido pelo backend. O histórico de integrações agora pode ser expandido para mostrar resumo, erros por registro, chave externa, itens processados, chamadas sanitizadas e metadados, sem recuperar credenciais.

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

## Infraestrutura Omie da Fase 6

A V2 consome o adaptador Omie nativo do OonCore e declara em `backend/src/mappings/omie.js`:

- teste de conexão por `ListarClientes`;
- chamadas de clientes/prestadores, categorias, contas correntes e Contas a Pagar;
- `listas-omie` para clientes/prestadores e categorias financeiras, persistidas nas próprias models funcionais da Central;
- mappings de webhook financeiro e ações assíncronas rastreáveis.

Nenhuma model técnica Omie é criada na Central. Configuração, segredos, transporte, fila, inbox, histórico, retry, lease e reprocessamento continuam integralmente no OonCore. Contas correntes permanecem como chamada declarada até que o domínio funcional defina onde esse vínculo será persistido.

A ativação com credenciais reais e a homologação funcional de envio/reconciliação financeira continuam condicionadas à configuração do ambiente; a V2 ainda não está autorizada para cutover.

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

A validação consumidora da Fase 6 cobre o registro das chamadas, as duas `listas-omie`, os três mappings financeiros de webhook, as transformações de clientes/prestadores e categorias, a ausência de runtime técnico local e a compatibilidade coordenada com o OonCore `0.3.63`.

O gate rejeita transforms no bootstrap, registries/páginas locais, identidade duplicada, models técnicos, workers locais, clientes HTTP Omie próprios e patches de Mongoose; mappings de negócio em `backend/src/mappings` são a extensão permitida.

O roteiro funcional está em [`docs/HOMOLOGACAO_PARIDADE.md`](docs/HOMOLOGACAO_PARIDADE.md).

## Home de Configurações

A engrenagem abre `/configuracoes`, com acessos a Cadastros Auxiliares e Integração Omie sem criar seções de Configurações ou Integrações no menu lateral. Categorias/Subcategorias e Responsáveis permanecem acessíveis pela Home de Cadastros Auxiliares. Estados e Cidades são apenas models internas de referência.

A página Omie do OonCore `0.3.63` separa Configurações, Sincronização, Webhooks/Gatilhos e Histórico. O link público do webhook pode ser copiado, e o token é gerado e rotacionado pelo Core.

## Dashboard operacional

A Home `/` apresenta indicadores declarativos de Projetos, Itens e Pagamentos, valores orçados, contratados, fechados e pendentes, além da distribuição dos tickets por etapa e status de trabalho. As agregações são executadas pelo OonCore no backend sobre todos os registros.
