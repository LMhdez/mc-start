# Auditoria de prontidão para produção — 2026-11-04

## Resultado executivo

**Estado: apto para disponibilização controlada ao grupo.** A infraestrutura principal, o website, o Worker e o agente privado têm evidência de publicação/atualização bem-sucedida. O smoke test SSE de produção passou. A PR #81 e o contrato unificado de manutenção continuam fora da produção.

Esta auditoria é documental e usa evidências recolhidas em 2026-11-04. Não substitui uma verificação read-only da VM imediatamente antes de uma operação de manutenção.

## Evidência confirmada

| Área | Evidência | Resultado |
|---|---|---|
| GitHub main | Validate project run [41836754756](https://github.com/LMhdez/mc-start/actions/runs/41836754756) passou no commit `ac4182747a7c91e5a7f94396f455426a97e033b2` | Passou |
| GitHub Pages | Deployment run [41836753837](https://github.com/LMhdez/mc-start/actions/runs/41836753837) passou para o mesmo commit | Publicado |
| Cloudflare Worker | `mc-start-control`, versão 56, 100% do tráfego desde 12:57:10 UTC | Ativo |
| Worker bindings | `MC_AGENT`, `R2_BUDGET` SQLite/`R2Budget`, `STATUS_KV`, `TECHNICAL_BUCKET` e nove secret bindings presentes | Preservados |
| Configuração Worker | `compatibility_date=2026-10-30`, `usage_model=standard` | Preservada |
| Agente privado | Workflow [41795652240](https://github.com/LMhdez/mc-start/actions/runs/41795652240) concluiu com sucesso | Atualizado |
| Agente pós-deploy | Serviço `mc-private-agent.service` ativo e endpoint `/status` com `ok=true` no workflow | Passou |
| SSE em produção | Smoke test no run [41836572573](https://github.com/LMhdez/mc-start/actions/runs/41836572573), repetido no run [41836754756](https://github.com/LMhdez/mc-start/actions/runs/41836754756): HTTP 200, `text/event-stream` e evento inicial `status` | Passou |
| Backup | Backup recente validado com `gzip -t`; três arquivos completos observados na VM | Passou na última evidência |
| Recuperação | Migração real entre VMs concluída sem perda de dados conhecida | Demonstrada |

Nenhum valor de secret foi consultado ou publicado. Não foram alterados plano, billing, bindings, Azure, VM ou recursos Cloudflare nesta revisão.

## SSE — verificação específica

O frontend publicado, Worker v56 e agente privado estão alinhados no contrato SSE. O smoke test de produção verifica `GET /api/public/events`, HTTP 200, content-type `text/event-stream` e evento inicial `status`, sem imprimir o payload. O teste passou em duas execuções, incluindo a validação mais recente.

## Funcionalidades e trabalhos não incluídos

- **PR #81 — manutenção unificada:** continua em draft e não foi publicada. A produção mantém o fluxo atual baseado em `maintenance.json`; não assumir que `result.maintenance` existe no Worker v56. A comparação atual entre `main` e `refactor/unified-maintenance-status-rebased` indica divergência: 9 commits exclusivos da branch e 15 commits de `main` ainda não incorporados. O PR não deve ser marcado como pronto nem merged sem reconciliação, revisão do diff e novos checks. O deploy do Worker que implementaria o novo contrato é uma operação separada e não foi feito.
- **Issue #9 — cópias dos scripts:** continuam por recolher os conteúdos atuais de `/home/azureuser/minecraft/backup.sh` e `/usr/local/sbin/mc-backup-on-start`. Só devem ser adicionadas cópias sanitizadas, com origem/data/hash e revisão manual; nunca incluir credenciais, IPs, backups, mundos, dados de jogadores ou logs. As cópias versionadas serão documentação e não deploy automático.
- **Ensaio isolado de restauro:** não foi executado um restauro adicional de um arquivo de backup para um destino descartável. A migração real entre VMs sem perda de dados conhecida já demonstrou recuperação operacional; manter esta distinção explícita.
- **Conectividade externa Java/Bedrock:** não foi repetido um teste de entrada com clientes externos nesta auditoria. Listeners TCP 25565 e TCP/UDP 19132 observados anteriormente não equivalem a um teste de join externo.
- **Browser e painel:** a confirmação visual num browser normal, incluindo a ação autenticada «Mostrar endereço», continua por repetir nesta auditoria.

## Risco e custos

- `usage_model=standard` não prova o plano Free/Paid da conta. Não alterar plano ou billing.
- Os limites R2 protegem os orçamentos de operações implementados, mas não são um teto global de faturação nem limitam, por si só, o armazenamento acumulado.
- Não criar recursos pagos, ativar upgrades ou aceitar despesas pessoais. O objetivo permanece 0,00 € / $0,00 de despesa pessoal.

## Decisão para comunicação ao grupo

É razoável comunicar que o servidor e o website estão disponíveis para utilização controlada e que o SSE passou o smoke test automatizado. Não anunciar a manutenção unificada da PR #81 como publicada, nem certificação de conectividade externa Java/Bedrock. A issue #9 e o ensaio isolado de restauro são tarefas operacionais/documentais adicionais, não bloqueadores da disponibilização controlada atual.
