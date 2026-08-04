# Configurações e Integração Omie

A engrenagem do header abre `/configuracoes`.

A Home apresenta:

- **Cadastros Auxiliares**: acesso a Categorias/Subcategorias e Responsáveis;
- **Integração Omie**: acesso à rota nativa `/configuracoes/integracao-omie`.

Categorias/Subcategorias e Responsáveis continuam disponíveis por rota, mas não aparecem no menu lateral. Estados e Cidades não possuem view própria no frontend e permanecem somente como models internas de referência.

A integração Omie do OonCore `0.3.63` é dividida em:

1. Configurações;
2. Sincronização;
3. Webhooks/Gatilhos;
4. Histórico.

O token do webhook é gerado e armazenado pelo OonCore. A interface permite copiar o link público e rotacionar o token; a rotação invalida o link anterior.
