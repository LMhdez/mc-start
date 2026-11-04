# Testes Cloudflare Worker e Durable Objects

Os testes desta pasta exercitam a lógica Worker/DO com Vitest e `@cloudflare/vitest-plugin` / Miniflare, usando configuração isolada.

## Ficheiros

- `azure-diagnostics.test.js`: allowlist e redaction de diagnósticos Azure, OAuth/ARM e erros inesperados.
- `r2-budget.test.js`: limites globais e concorrência do orçamento R2/SQLite.
- `status-encryption.test.js`: fluxo de envelope cifrado, autenticação e desencriptação.
- Configuração de teste: `cloudflare/wrangler.test.toml` (não usar para deploy).

## Comando

Na raiz do repo: `npm run test:cloudflare`.

## Cobertura esperada

- Limites diários/mensais e reset UTC.
- Concorrência e atomicidade do Durable Object.
- Validação de payload/tamanho de snapshot.
- Backoff e migração condicional KV→R2.
- Autenticação, TTL e integridade do payload cifrado.
- Mensagens de erro inesperadas sem conteúdo de exceções, tokens ou dados privados.

Não usar bindings, buckets, KV, Durable Objects ou secrets de produção. Não ativar plano pago.
