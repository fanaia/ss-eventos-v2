# Referência de baseline da SS-Eventos V2

A Fase 0 usa esta Central somente como **alvo de comparação** da SS-Eventos original.

## Referências congeladas

- Golden master: `fanaia/ss-eventos@3f689bed834aab7dd024a8e31d37bf7623efae58`;
- Artefatos executáveis do golden master: `fanaia/ss-eventos#32`;
- V2 observada: `fanaia/ss-eventos-v2@7c3506b04c61bf0ca9a6c52ae1e64f6b7b079eab`;
- Coordenação: `oondemand/oon-docs#5`.

## Limite da Fase 0

A V2 preserva o estado atual:

- OonCore `0.3.44` em CLI, backend e frontend;
- contrato funcional declarativo para cadastros, projetos, itens, pagamentos, cálculos e esteiras;
- `integrations: false` e `omie: false`;
- sem outbox, inbox, histórico técnico, worker, lock/retry, rotas técnicas, cliente HTTP ou models técnicos de integração.

Portanto, esta referência:

- não afirma paridade integral;
- não autoriza cutover;
- não substitui o golden master;
- não antecipa a engine genérica de integrações ou o adaptador Omie nativo;
- serve para detectar alterações acidentais na fronteira da v2 enquanto a arquitetura evolui.

## Validação

```bash
npm run baseline:check
npm run check
```

`baseline:check` valida os SHAs, as versões dos três pacotes OonCore e a permanência das integrações desabilitadas. O arquivo `baseline.reference.json` é a fonte legível por máquina.

A comparação comportamental será implementada na Fase 7; até lá, diferenças não podem ser tratadas automaticamente como regressão ou correção sem classificação explícita.
