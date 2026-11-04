# Cloudflare — Worker, bindings, agente e operação

Este diretório contém o Worker `mc-start-control`, configuração Wrangler e runbook de publicação. O website estático é publicado por GitHub Pages; o Worker é a API de controlo, não o endereço Minecraft.

## Componentes

- `worker.js`: endpoints públicos/privados, autenticação, Azure ARM, fallback GitHub Actions, agente privado, cache e armazenamento temporário cifrado.
- `wrangler.toml`: configuração declarativa de produção e bindings. Comparar com metadata real antes de qualquer alteração.
- `wrangler.test.toml`: configuração isolada de testes; **nunca usar para deploy**.
- `DEPLOYMENT-RUNBOOK.md`: gates, validação, evidência e rollback.

## Arquitetura

- Website → Worker → Azure ARM / GitHub Actions / agente privado através de VPC/Tunnel.
- Agente na VM → ligação privada; nunca expor a porta 8765 à Internet.
- R2 privado para fotografia técnica; Durable Object SQLite para orçamento/estado temporário cifrado; KV mantém compatibilidade legada conforme implementação.
- O browser desencripta o estado privado; não mover PBKDF2/AES para o Worker Free sem medir CPU e rever limites.

## Estado público e manutenção

`GET /api/public/status` é o endpoint público de leitura inicial/manual. `GET /api/public/events` é o fluxo SSE de estado público: uma verificação Azure por ligação, depois proxy do stream do agente privado sem buffering, KV, R2 ou Durable Objects. O agente recolhe apenas campos públicos permitidos, consulta localmente o estado/RCON a cada 5 segundos enquanto há clientes ligados e emite apenas alterações. Não transmite IPs nem nomes de jogadores. O endpoint SSE é estritamente de leitura e não chama nem altera ações/workflows de ligar/desligar. Cloudflare documenta HTTP Workers streaming sem limite fixo de duração enquanto o cliente permanece ligado; a ligação conta como um pedido de entrada, não como um pedido por evento. Workers VPC está atualmente em beta e gratuito, mas essa condição deve ser revalidada antes de qualquer publicação.  Em 2026-11-03, voltou a HTTP 200 após atribuir `Reader` (Built-in) ao Service Principal `mc-start-status-reader` no scope da VM BelgiumCentral. Não houve alteração de código nem deploy para resolver o 503; a correção foi exclusivamente RBAC. A PR #78 e o follow-up de redaction foram posteriormente merged em `main`, mas **o Worker de produção não foi deployed**. Ver [incidente](WORKER-503-INCIDENT.md) e [runbook](DEPLOYMENT-RUNBOOK.md).

O frontend combina a API pública com `maintenance.json`, publicado pelo GitHub Pages e controlado por `.github/workflows/toggle-maintenance.yml`. O modo manutenção é apenas informativo: não altera Azure, Worker ou Minecraft e não bloqueia ligações. Se a API falhar, o frontend apresenta estado indisponível, não um estado online antigo.

## Endpoints e contratos

Consultar router, autenticação e validações em `worker.js` antes de usar endpoints. A API pública não pode revelar IP privado/público, credenciais, nomes de jogadores ou dados do mundo. `Origin` não substitui autenticação.

## Bindings e secrets

Wrangler declara bindings, mas não autoriza divulgar valores. Nunca ler/imprimir/copiar secrets, tokens, headers ou payloads privados. Confirmar presença apenas por metadata. Não substituir um binding Secret por texto simples.

## Testes e publicação

- Testes locais: `npm run test:cloudflare`.
- `wrangler.test.toml` é exclusivamente para testes.
- Deploy do Worker é manual e separado do deploy do agente. Ler integralmente `DEPLOYMENT-RUNBOOK.md`, validar testes, diff, bindings, migrations, rollback e limites Free antes de publicar.
- Não executar `wrangler deploy` como consequência automática de editar este diretório.
- Não ativar Workers Paid, R2 Infrequent Access, add-ons, trials ou funcionalidades faturáveis.

## Limites e segurança

- Rate limits em memória por isolate não são um bloqueio global.
- Limites R2 implementados no Durable Object não são hard spending cap global da conta.
- **Orçamento permitido: 0,00 € / $0,00.** Free Tier apenas; não usar créditos para justificar recursos pagos.
- Não ativar planos pagos nem aceitar qualquer prompt de billing.
- Redigir logs; nunca publicar secrets, IPs, dados de jogadores ou payloads cifrados.
- Se o agente VPC falhar, seguir fallback documentado; nunca expor a porta do agente publicamente como workaround.
