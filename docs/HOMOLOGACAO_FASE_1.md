# Homologação — Fase 1

## Objetivo

Validar uma Central criada do zero sobre o OonCore 0.3.43, cobrindo:

- domínio carregado por `central.domain.json`;
- CRUD e referências gerados pelo backend;
- coleções e esteira geradas pelo `central.ui.json`;
- fórmulas reativas no formulário;
- recálculo autoritativo no backend;
- proteção de campos `readonly` e `computed`.

## Escopo funcional

A primeira vertical contém:

1. Clientes / Fornecedores (`Pessoa`).
2. Projetos (`Projeto`).
3. Esteira de Itens (`ProjetoItem`).
4. Orçamento, contratação, pagamento, fechamento e resultado calculados.

Ainda não fazem parte desta fase: importação de planilhas, categorias hierárquicas, contatos múltiplos, integração Omie, anexos, pagamentos reais e sincronização automática dos percentuais do Projeto para o Item.

## Massa de teste

### Pessoa

- Nome: `Cliente Homologação`
- Tipo: `PJ`
- Documento: `00.000.000/0001-00`
- Cliente: marcado
- Fornecedor: desmarcado
- Status: `Ativo`

### Projeto

- Código: `EVT-001`
- Nome: `Evento de Homologação`
- Cliente: `Cliente Homologação`
- Fee padrão: `10`
- Imposto padrão: `5`
- Status: `Planejamento`

### Item

Na aba **Dados do item**:

- Projeto: `Evento de Homologação`
- Item: `Estrutura principal`
- Etapa: `Orçamento`
- Tipo de custo: `Variável`

Na aba **Valores**:

- Quantidade: `2`
- Diárias: `3`
- Valor unitário do orçamento: `100`
- Valor unitário da contratação: `70`
- Fee: `10`
- Impostos: `5`

## Resultados esperados

Os valores devem aparecer imediatamente, antes do salvamento:

| Campo | Resultado esperado |
| --- | ---: |
| Total do orçamento | R$ 600,00 |
| Total da contratação | R$ 420,00 |
| Valor do pagamento | R$ 420,00 |
| Valor base do fechamento | R$ 600,00 |
| Valor do fee | R$ 60,00 |
| Valor dos impostos | R$ 30,00 |
| Total do fechamento | R$ 690,00 |
| Lucro | R$ 240,00 |
| Lucro % | 40,00% |

Fórmula de lucro adotada nesta fase:

```text
lucro = orçamento - contratação + fee
```

## Casos de aceitação

### 1. Cadastro comercial

- impedir Pessoa sem marcação de Cliente ou Fornecedor;
- permitir Pessoa marcada como ambos;
- impedir documento duplicado;
- exibir Pessoa na seleção de Cliente do Projeto.

### 2. Período do Projeto

- permitir datas vazias;
- impedir data de término anterior à data de início;
- permitir salvar cada aba do Projeto de forma independente.

### 3. Fórmulas reativas

- recalcular todos os resultados ao alterar quantidade;
- recalcular todos os resultados ao alterar diárias;
- recalcular orçamento e fechamento ao alterar o valor unitário do orçamento;
- recalcular contratação, pagamento e lucro ao alterar o valor unitário da contratação;
- recalcular fee, fechamento e lucro ao alterar o percentual de fee;
- recalcular impostos e fechamento ao alterar o percentual de impostos.

### 4. Proteção do backend

No request de criação ou edição, confirmar que o frontend não envia:

- `valorTotalOrcamento`;
- `valorTotalContratacao`;
- `valorPagamento`;
- `valorBaseFechamento`;
- `valorFee`;
- `valorImpostos`;
- `valorTotalFechamento`;
- `lucroValor`;
- `lucroPercentual`;
- `statusIntegracao`.

O backend deve devolver esses campos recalculados na resposta.

### 5. Tentativa de adulteração

Enviar manualmente um valor calculado diferente do resultado esperado. A operação deve ser rejeitada ou o campo deve ser descartado conforme o contrato do Core, nunca persistindo o valor adulterado.

## Critério para concluir a fase

A fase pode ser aprovada quando:

- o workflow `ci` estiver verde;
- a aplicação iniciar em ambiente dev;
- os três cadastros funcionarem;
- todos os valores acima forem recalculados na interface;
- a resposta persistida coincidir com o cálculo do backend;
- nenhuma regra depender de código React ou model JavaScript local.
