# Central SS Eventos V2

Reconstrução declarativa da Central SS Eventos sobre o OonCore.

A V2 existe para comprovar que navegação, coleções, esteiras, formulários, abas, grids relacionados, cálculos e regras específicas do negócio podem ser mantidos sem copiar shell, páginas ou componentes padrão do Core.

## Arquitetura

A Central declara somente:

- `backend/central.domain.json`: models, campos, referências, fórmulas simples e validações declarativas;
- `frontend/central.ui.json`: navegação, coleções, esteiras, filtros, abas, grids e ações;
- `backend/src/validations`: regras específicas que consultam outros registros;
- `backend/src/triggers`: efeitos de domínio, cálculos entre models e atualização de resumos;
- `backend/src/hooks`: proteção de exclusão e carga das localidades oficiais;
- `backend/src/services`: funções puras reutilizadas pelas regras.

O frontend continua com um bootstrap mínimo em `frontend/src/main.tsx`.

## Versão homologada

Os três pacotes estão fixados em `0.3.44`:

- `@oondemand/create-central-oon`;
- `@oondemand/oon-core-back`;
- `@oondemand/oon-core-front`.

Esta versão incorpora o suporte a valores iniciais derivados do registro pai em grids relacionados e preserva a metadata dos campos no formulário de inclusão.

## Domínio declarado

### Cadastros

- Clientes/Fornecedores;
- Contatos;
- Categorias/Subcategorias.

### Operação

- Projetos;
- Itens de Projeto;
- Esteira de Itens.

### Financeiro

- Pagamentos;
- Esteira de Pagamentos.

Ao criar um pagamento dentro do item:

- projeto e item são vinculados automaticamente;
- o valor inicia com o saldo pendente do item;
- a etapa inicial é `Solicitado` e não aparece no formulário;
- data e moeda usam seus controles apropriados;
- responsável é selecionado por referência;
- NF recebida é exibida como checkbox.

### Configurações

- Responsáveis;
- Estados;
- Cidades.

## Regras cobertas

- CPF/CNPJ conforme o tipo de pessoa;
- cliente ou fornecedor obrigatório;
- contato principal pertencente ao cliente;
- cliente, fornecedor, responsáveis e cadastros relacionados ativos;
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

O contrato funcional da integração está visível nos campos e etapas, mas a infraestrutura continua desabilitada:

```js
integrations: false
omie: false
```

Não existem na V2:

- outbox/inbox;
- histórico técnico de execução;
- worker;
- lock e retry;
- rotas técnicas;
- cliente HTTP Omie;
- models técnicos da integração.

Esses recursos serão incorporados ao OonCore antes da ativação real da integração.

## Validação

```bash
npm install
npm run ooncore:docs:check
npm run check
npm install --prefix backend
npm test --prefix backend
npm install --prefix frontend
npm run build --prefix frontend
```

O roteiro funcional está em [`docs/HOMOLOGACAO_PARIDADE.md`](docs/HOMOLOGACAO_PARIDADE.md).
