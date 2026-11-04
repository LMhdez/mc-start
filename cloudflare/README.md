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

`GET /api/public/status` é o endpoint público. Em 2026-11-03, voltou a HTTP 200 após atribuir `Reader` (Built-in) ao Service Principal `mc-start-status-reader` no scope da VM BelgiumCentral. Não houve alteração de código nem deploy para resolver o 503; a correção foi exclusivamente RBAC. A PR #78 e o follow-up de redaction foram posteriormente merged em `main`, mas **o Worker de produção não foi deployed**. Ver [incidente](WORKER-503-INCIDENT.md) e [runbook](DEPLOYMENT-RUNBOOK.md).

O frontend combina a API pública com `maintenance.json`, publicado pelo GitHub Pages e controlado por `.github/workflows/toggle-maintenance.yml`. O modo manutenção é apenas informativo: não altera Azure, Worker ou Minecraft e não bloqueia ligações. Se a API falhar, o frontend apresenta estado indisponível, não um estado online antigo.

## Endpoints e contratos

Consultar router, autenticação e validações em `worker.js` antes de usar endpoints. A API pública não pode revelar IP privado/público, credenciais, nomes de jogadores ou dados do mundo. `Origin` não substitui autenticação.

## Bindings e secrets

Wrangler declara bindings, mas não autoriza divulgar valores. Nunca ler/imprimir/copiar secrets, tokens, headers ou payloads privados. Confirmar presença apenas por metadata. Não substituir um binding Secret por texto simples.

## Testes e publicação

- Testes locais: `npm run test:cloudflare`.
- `wrangler.test.toml` é exclusivamente para testes.
- Deploy do Worker é manual e separado do deploy do agente. Ler integralmente `DEPLOYMENT-RUNBOOK.md`, validar testes, diff, bindings, migrations, rollback e limites do plano ativo antes de publicar.
- Não executar `wrangler deploy` como consequência automática de editar este diretório.
- Não ativar funcionalidades pagas de Cloudflare sem verificar cobertura dos benefícios/plano e impacto de faturação; não assumir que os créditos Azure Student cobrem Cloudflare.

## Limites e segurança

- Rate limits em memória por isolate não são um bloqueio global.
- Limites R2 implementados no Durable Object não são hard spending cap global da conta.
- O orçamento Azure Student aplica-se à infraestrutura Azure; serviços Cloudflare têm faturação e limites independentes. Manter Workers Free quando suficiente e nunca ativar Workers Paid/add-ons sem autorização e análise de custo.
- Redigir logs; nunca publicar secrets, IPs, dados de jogadores ou payloads cifrados.
- Se o agente VPC falhar, seguir fallback documentado; nunca expor a porta do agente publicamente como workaround.


## SSE — estado público em tempo real

- \`GET /api/public/events\` é um endpoint SSE de leitura. Faz uma verificação Azure por ligação e, quando a VM está ligada, encaminha diretamente o stream do agente VPC. Não escreve KV/R2, não usa Durable Objects e não chama endpoints de controlo.
- O agente faz leituras locais de estado/Docker/RCON/Geyser a cada 5 segundos, partilhadas por todos os browsers ligados; emite eventos apenas quando os campos públicos mudam e heartbeats apenas para atualizar \`checked_at\`. Não faz chamadas periódicas ao Worker/Azure nem consulta o IP público neste watcher.
- Quando a VM está parada/desalocada, o Worker emite o estado Azure num evento e fecha o stream; o browser volta a verificar a cada 60 segundos. Estados transitórios usam 15 segundos; falhas de ligação usam backoff até 5 minutos.
- Separadores ocultos fecham a ligação. Cada ligação SSE é um pedido Worker de entrada; os eventos não são pedidos adicionais. Cada reconexão é um novo pedido.

### Limites Free e continuidade

- Workers Free permite 100.000 pedidos de entrada por dia. Uma ligação SSE longa conta como um pedido, não um pedido por evento. Cada reconexão conta como novo pedido. Os pedidos estáticos do GitHub Pages não invocam este Worker.
- HTTP Workers não têm limite fixo de duração enquanto o cliente permanece ligado. Desconexões e atualizações do runtime podem interromper a ligação; o frontend reconecta com backoff.
- Workers VPC está gratuito durante a beta aberta; aplicam-se os limites e custos normais de Workers para pedidos e CPU. Não ativar Workers Paid nem qualquer plano pago.
- O watcher local só existe enquanto há browsers ligados; vários browsers partilham a mesma consulta. O polling local consome uma pequena quantidade de CPU na VM, mas não gera pedidos periódicos ao Worker/Azure.
- O fluxo SSE não executa ações Azure, GitHub Actions, Docker start/stop/restart, systemd, cron ou autostop. Os workflows de controlo e as respetivas proteções mantêm-se separados.


## Estado de publicação — 2026-11-04

O endpoint SSE e o respetivo proxy estão implementados em `main`, mas o Worker de produção ainda não foi publicado com esta versão. A documentação do endpoint descreve o comportamento pretendido do código, não uma confirmação de runtime. Antes de declarar SSE ativo, publicar o Worker com autorização explícita e validar `GET /api/public/events` sem expor payloads privados. A atualização do agente da VM é uma etapa separada.
