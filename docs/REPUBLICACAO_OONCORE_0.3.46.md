# Republicação após OonCore 0.3.46

Registro operacional da republicação da Central SS Eventos V2 após a atualização da Central de Ativações para o OonCore `0.3.46`.

## Motivo

A publicação anterior, associada ao commit `9df44fc364ca6138a2ec4730098358464a091ebf`, falhou durante a construção da imagem porque o publisher ainda utilizava uma versão do OonCore que não preservava `central.app.json` no contexto do frontend e no runtime do backend.

A Central de Ativações foi atualizada e implantada em Dev pelo commit `d7d5a7b3ce48795f5e461f49d68c4fa3c890c4b1`, com imagem `ghcr.io/oondemand/central-ativacao@sha256:213bfdd61ec6c6f8e803f033295e26498b6f3dd21d6c69b33b0ae7a12233b498`.

## Objetivo desta publicação

- validar o build declarativo com `central.app.json`;
- confirmar o manifesto disponível durante o build do frontend e no runtime do backend;
- validar rollout, ativação e health checks em Dev;
- confirmar `/core/metadata` coerente com o manifesto da Central.

Este arquivo não altera domínio, UI, integrações ou regras funcionais da Central.
