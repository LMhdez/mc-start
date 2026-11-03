# Testes

Esta pasta contém testes automatizados para a aplicação e os componentes Cloudflare. Testes não devem aceder à VM de produção, mundos, RCON, secrets ou serviços pagos.

## Estrutura

- `cloudflare/`: testes unitários/de integração local do Worker e Durable Object usando Vitest/Miniflare.
- `ui-audit.cjs`: auditoria automatizada de interface/acessibilidade executada no CI.
- `../vitest.config.mjs`: configuração Vitest.

## Execução

A partir da raiz:

```bash
npm install
npm run test:cloudflare
node tests/ui-audit.cjs
```

Consultar `.github/workflows/validate.yml` para a matriz exata de CI e eventuais dependências do browser. Não executar deploy durante os testes.

## Princípios

- Usar fixtures e bindings isolados; não importar secrets reais.
- Nunca usar endpoints de produção para testes destrutivos.
- Não incluir IPs de jogadores, nomes, passwords, tokens ou dados de mundo em snapshots.
- Manter testes determinísticos e sem custo adicional.
