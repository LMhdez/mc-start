# Auditoria de prontidão para produção — 2026-11-04

## Resultado executivo

**Estado: apto para disponibilização controlada ao grupo.** A infraestrutura principal, o website, o Worker e o agente privado têm evidência de publicação/atualização bem-sucedida. O smoke test SSE de produção passou. A PR #81 e o contrato unificado de manutenção continuam fora da produção.

Esta auditoria é documental e usa evidências recolhidas em 2026-11-04. Não substitui uma verificação read-only da VM imediatamente antes de uma operação de manutenção.

## Evidência confirmada

| Área | Evidência | Resultado |
|---|---|---|
| GitHub main | Validate project run [41839109694](https://github.com/LMhdez/mc-start/actions/runs/41839109694) passou no commit documental atual `9756eb5ec964292ee5496a22524c244c94abc32f` | Passou |
| GitHub Pages | Deployment run [41839108242](https://github.com/LMhdez/mc-start/actions/runs/41839108242) passou para o commit atual | Publicado |
| Cloudflare Worker | `mc-start-control`, versão 56, 100% do tráfego desde 12:57:10 UTC | Ativo |
| Worker bindings | `MC_AGENT`, `R2_BUDGET` SQLite/`R2Budget`, `STATUS_KV`, `TECHNICAL_BUCKET` e nove secret bindings presentes | Preservados |
| Configuração Worker | `compatibility_date=2026-10-30`, `usage_model=standard` | Preservada |
| Agente privado | Workflow [41795652240](https://github.com/LMhdez/mc-start/actions/runs/41795652240) concluiu com sucesso | Atualizado |
| Agente pós-deploy | Serviço `mc-private-agent.service` ativo e endpoint `/status` com `ok=true` no workflow | Passou |
| SSE em produção | Smoke test nos runs [41836572573](https://github.com/LMhdez/mc-start/actions/runs/41836572573), [41836754756](https://github.com/LMhdez/mc-start/actions/runs/41836754756) e [41839109694](https://github.com/LMhdez/mc-start/actions/runs/41839109694): HTTP 200, `text/event-stream` e evento inicial `status` | Passou |
| Backup | Backup recente validado com `gzip -t`; três arquivos completos observados na VM | Passou na última evidência |
| Recuperação | Migração real entre VMs concluída sem perda de dados conhecida | Demonstrada |

Nenhum valor de secret foi consultado ou publicado. Não foram alterados plano, billing, bindings, Azure, VM ou recursos Cloudflare nesta revisão.

## SSE — verificação específica

O frontend publicado, Worker v56 e agente privado estão alinhados no contrato SSE. O smoke test de produção verifica `GET /api/public/events`, HTTP 200, content-type `text/event-stream` e evento inicial `status`, sem imprimir o payload. O teste passou em duas execuções. A revalidação posterior da branch `main` também passou integralmente no run [41839109694](https://github.com/LMhdez/mc-start/actions/runs/41839109694), incluindo sintaxe, Vitest/DO/R2, Wrangler dry-run, smoke tests públicos, SSE, sintaxe Python e testes do agente.

## Funcionalidades e trabalhos não incluídos

- **PR #81 — manutenção unificada:** continua em draft e não foi publicada. A produção mantém o fluxo atual baseado em `maintenance.json`; não assumir que `result.maintenance` existe no Worker v56. A comparação atual entre `main` e `refactor/unified-maintenance-status-rebased` indica divergência: 9 commits exclusivos da branch e 15 commits de `main` ainda não incorporados. O PR não deve ser marcado como pronto nem merged sem reconciliação, revisão do diff e novos checks. O deploy do Worker que implementaria o novo contrato é uma operação separada e não foi feito.
- **Issue #9 — cópias dos scripts:** concluída como documentação sanitizada através da [PR #10](https://github.com/LMhdez/mc-server-infrastructure/pull/10); a [Issue #9](https://github.com/LMhdez/mc-server-infrastructure/issues/9) está fechada como completed. Os ficheiros são transcrições sanitizadas, não cópias byte-a-byte dos originais nem executáveis.
- **Ensaio isolado de restauro:** não foi executado um restauro adicional de um arquivo de backup para um destino descartável. A migração real entre VMs sem perda de dados conhecida já demonstrou recuperação operacional; manter esta distinção explícita.
- **Conectividade externa Java/Bedrock:** não foi repetido um teste de entrada com clientes externos nesta auditoria. Listeners TCP 25565 e TCP/UDP 19132 observados anteriormente não equivalem a um teste de join externo.
- **Browser e painel:** a confirmação visual num browser normal, incluindo a ação autenticada «Mostrar endereço», continua por repetir nesta auditoria.

## Risco e custos

- `usage_model=standard` não prova o plano Free/Paid da conta. A ligação Cloudflare atual não tem scope de leitura de billing/subscrições; o plano e a ausência de faturação não foram confirmados. Não alterar plano ou billing.
- Os limites R2 protegem os orçamentos de operações implementados, mas não são um teto global de faturação nem limitam, por si só, o armazenamento acumulado.
- Não criar recursos pagos, ativar upgrades ou aceitar despesas pessoais. O objetivo permanece Free Tier sempre que possível e 0,00 € / $0,00 de despesa pessoal; a VM Azure atual é faturável e consome créditos Azure Student.

## Decisão para comunicação ao grupo

É razoável comunicar que o servidor e o website estão disponíveis para utilização controlada e que o SSE passou o smoke test automatizado. Não anunciar a manutenção unificada da PR #81 como publicada, nem certificação de conectividade externa Java/Bedrock. A issue #9 e o ensaio isolado de restauro são tarefas operacionais/documentais adicionais, não bloqueadores da disponibilização controlada atual.


## Revalidação técnica após o commit documental — 2026-11-04

- `main` está no commit `9756eb5ec964292ee5496a22524c244c94abc32f`. A alteração foi documental; os hashes GitHub de `cloudflare/worker.js`, `cloudflare/wrangler.toml`, `index.html`, `script.js` e `vm/mc-agent.py` coincidem com os do commit de código publicado `ac4182747a7c91e5a7f94396f455426a97e033b2`.
- Validate project [41839109694](https://github.com/LMhdez/mc-start/actions/runs/41839109694) passou em todos os passos, incluindo teste Durable Object/R2, Wrangler dry-run, smoke tests de produção e testes do agente.
- GitHub Pages deployment [41839108242](https://github.com/LMhdez/mc-start/actions/runs/41839108242) concluiu com sucesso para o commit atual. O site é publicado via GitHub Pages; não depende de um projeto Cloudflare Pages.
- A API Cloudflare confirma o Worker `mc-start-control` com 100% do tráfego na versão de produção 56, deployment às 12:57 UTC, bindings esperados presentes e nove secret bindings. Nenhum valor secreto foi lido.
- O agente privado foi publicado pelo workflow [41795652240](https://github.com/LMhdez/mc-start/actions/runs/41795652240); o SHA do ficheiro `vm/mc-agent.py` nesse commit coincide com o ficheiro atual em `main`.
- Configuração de observabilidade observada: Workers Logs ativos com amostragem de 100%; Workers Traces desativados. Não foram ativados traces nem alterado billing. A conta não autorizou leitura da subscrição/billing através da ligação API; `usage_model=standard` não prova que o plano é Free.
- O rate limit do Worker usa memória por isolate e não é global/atómico. A palavra-passe do painel tem de ser aleatória, longa e exclusiva; o requisito mínimo de 20 caracteres não garante entropia.
- A auditoria estática dirigida não encontrou tokens/chaves literais nem comandos de dump de ambiente nos ficheiros de código/workflows revistos. Isto não equivale a um scan completo de todo o histórico Git nem a uma auditoria externa.
- Não foi feita uma ligação real Java/Bedrock por cliente externo nesta revalidação; não foi feito um restauro isolado de backup; e não foi recolhido estado SSH ao vivo da VM durante esta revisão.

## Decisão revista

**Apto para disponibilização controlada ao grupo**, mantendo as limitações acima. Não classificar como certificação completa de produção/segurança: falta teste externo de entrada Java/Bedrock e ensaio isolado de restauro; o rate limit é por isolate; o plano de billing Cloudflare não foi confirmado. Não anunciar a manutenção unificada da PR #81 como publicada. Sem alterações de código de produção, VM, Worker, bindings, secrets ou billing nesta auditoria.
