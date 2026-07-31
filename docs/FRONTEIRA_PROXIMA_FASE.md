# Fronteira para a próxima fase do OonCore

A paridade funcional desta fase mantém na Central somente regras específicas da SS Eventos.

## Já comprovado pelo manifesto

- domínio e referências;
- coleções e navegação;
- modal com abas;
- grids relacionados;
- filtros dependentes;
- esteiras em board/list;
- ações de aprovação e status de trabalho;
- fórmulas simples reativas;
- campos monetários e máscaras.

## Regras locais legítimas

Continuam na Central porque dependem do domínio específico:

- CPF/CNPJ conforme tipo;
- cliente/fornecedor e contato principal;
- categoria/subcategoria;
- responsável operacional ou financeiro;
- fórmula fiscal específica por tipo de faturamento;
- limite de pagamentos pelo valor contratado;
- atualização do resumo financeiro do item;
- proteção de exclusão de cadastros em uso.

## Recursos que devem migrar ao Core

Não devem ser implementados localmente na V2:

- engine genérica de integrações;
- outbox e inbox persistentes;
- execução, histórico e diagnóstico;
- lock, retry, backoff e reprocessamento;
- webhooks idempotentes;
- configuração segura do provedor;
- cliente HTTP Omie;
- sincronização de cadastros mestres;
- envio e conciliação de Contas a Pagar;
- baixa parcial, total e estorno;
- página operacional padrão da integração.

## Lacunas declarativas observadas

São candidatas a evoluções futuras do manifesto, mas não bloqueiam esta fase:

- fórmulas condicionais (`if/then/else`);
- fórmulas que consultam models relacionados;
- agregações relacionadas autoritativas no backend;
- validações declarativas assíncronas entre models;
- estilos condicionais declarativos para lucro/prejuízo;
- proteção declarativa de exclusão por referência.

Até esses contratos existirem, as regras ficam em `validations`, `triggers` e `hooks`, sem criar infraestrutura genérica dentro da Central.
