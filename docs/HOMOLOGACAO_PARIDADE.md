# Homologação — Paridade declarativa SS Eventos

## Objetivo

Comprovar que a `ss-eventos-v2` reproduz a navegação e os comportamentos de negócio da `ss-eventos` sem transforms de frontend, páginas React locais ou runtime próprio de integração.

## Preparação

1. Configure MongoDB, `DEV_TOKEN` e as variáveis padrão do backend.
2. Inicie backend e frontend.
3. Acesse `/?code=<DEV_TOKEN>`.
4. Confirme que o menu contém Cadastros, Operação, Financeiro e Configurações.

## 1. Clientes e fornecedores

- Criar pessoa PF com CPF válido.
- Confirmar rejeição de CPF inválido.
- Criar pessoa PJ com CNPJ válido.
- Confirmar rejeição quando Cliente e Fornecedor estiverem desmarcados.
- Criar dois contatos na aba relacionada.
- Confirmar máscara de documento e telefone.
- Confirmar que um contato usado como principal não pode ser excluído.

## 2. Categorias e localidades

- Criar categoria principal.
- Criar subcategoria vinculada.
- Confirmar bloqueio de categoria apontando para si própria.
- Confirmar que a lista de estados e cidades foi carregada pelo IBGE.
- Selecionar estado e confirmar filtro das cidades.
- Selecionar categoria e confirmar filtro das subcategorias.

## 3. Responsáveis

- Criar responsável Operacional.
- Criar responsável Pagamento.
- Criar responsável Ambos.
- Confirmar que responsável de Pagamento não pode ser usado como responsável operacional.
- Confirmar que responsável Operacional não pode ser usado em pagamento.

## 4. Projeto

- Selecionar apenas registros ativos.
- Confirmar filtro de fornecedores e clientes pelos respectivos papéis.
- Confirmar filtro do contato principal pelo cliente.
- Informar fee e imposto.
- Salvar e abrir novamente todas as abas.
- Confirmar os cards de itens, pagamentos e totais.

## 5. Item — navegação e cálculos

Na esteira de itens:

1. Criar um item na aba Dados do item.
2. Confirmar a ordem:
   - Dados do item;
   - Orçamento;
   - Contratação;
   - Pagamento;
   - Fechamento.
3. Informar:
   - orçamento: quantidade 2, diárias 3, unitário R$ 100;
   - contratação: quantidade 2, diárias 3, unitário R$ 70;
   - projeto: fee 10%, imposto 5%.

### Agência

Esperado:

- orçamento: R$ 600;
- contratação: R$ 420;
- fee: R$ 60;
- imposto: R$ 33;
- fechamento: R$ 693;
- lucro: R$ 240;
- lucro: 40%.

### Agência Interna

Esperado:

- fee: R$ 0;
- imposto: R$ 30;
- fechamento: R$ 630;
- lucro: R$ 180.

### Faturamento Direto

Esperado:

- fee: R$ 60;
- imposto: R$ 3;
- fechamento: R$ 663.

Alterar fee ou imposto no Projeto e confirmar recálculo dos itens existentes.

## 6. Esteira de itens

- Avançar e recusar entre as etapas.
- Alterar status para Aguardando início, Trabalhando e Revisão.
- Confirmar ausência de aprovação após Cancelado.
- Validar visualização em quadro e lista.
- Confirmar nomes das referências em vez de IDs.

## 7. Pagamentos

- Criar pagamento dentro da aba Pagamento do item.
- Confirmar preenchimento automático do projeto/item pela relação.
- Confirmar rejeição de pagamento acima do saldo contratado.
- Confirmar atualização do total planejado e saldo pendente.
- Confirmar fluxo:
  - Solicitado → Aprovado;
  - Aprovado → Aguardando NF;
  - Aguardando NF → Enviado para Omie.
- Confirmar recusa no caminho inverso.
- Confirmar bloqueio de envio sem NF recebida.
- Confirmar ausência de ações manuais em Enviado para Omie e Pagamento Ok.
- Confirmar que Pagamento Ok exige `omieLiquidado`.

## 8. Fronteira da integração

- Confirmar que nenhuma chamada ao Omie é executada.
- Confirmar que não existem páginas, workers ou models técnicos de integração.
- Confirmar que a etapa Enviado para Omie registra status Pendente e aguarda a futura engine do Core.
- Confirmar que os campos de diagnóstico não expõem segredos.

## 9. Regressão técnica

Executar:

```bash
npm run check
npm test --prefix backend
npm run build --prefix frontend
```

Critério de aceite:

- validação dos manifestos aprovada;
- testes backend aprovados;
- build frontend aprovado;
- `frontend/src` contendo somente `main.tsx`;
- nenhuma model técnica de integração no domínio;
- nenhuma transformação JavaScript do manifesto.
