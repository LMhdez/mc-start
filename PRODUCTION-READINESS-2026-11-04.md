# Auditoria de prontidão para produção — 2026-11-04

## Resultado executivo

**Estado: apto para disponibilização controlada ao grupo.** A infraestrutura principal, o painel, o Worker e o agente privado têm evidência de publicação/atualização bem-sucedida. Não declarar a PR #81 nem o contrato unificado de manutenção como publicados.

Esta auditoria não substitui uma verificação ao vivo da VM imediatamente antes de uma operação de manutenção. A última evidência operacional da VM foi recolhida em 2026-11-04 e está registada no repositório privado de infraestrutura.

## Evidência confirmada

| Área | Evidência | Resultado |
|---|---|---|
| GitHub main | Validate project run `41833781000` passou no commit documental anterior | Passou |
| GitHub Pages | Deployment run `41833779674` passou | Publicado |
| Cloudflare Worker | `mc-start-control`, versão 56, 100% do tráfego desde 12:57:10 UTC | Ativo |
| Worker bindings | `MC_AGENT`, `R2_BUDGET` SQLite/`R2Budget`, `STATUS_KV`, `TECHNICAL_BUCKET` e nove secret bindings presentes | Preservados |
| Configuração Worker | `compatibility_date=2026-10-30`, `usage_model=standard` | Preservada |
| Agente privado | Workflow [41795652240](https://github.com/LMhdez/mc-start/actions/runs/41795652240) concluído com sucesso às 07:56 UTC | Atualizado |
| Agente pós-deploy | Workflow verificou `mc-private-agent.service` ativo e `/status` com `ok=true` | Passou |
| Código agente | SHA do ficheiro `vm/mc-agent.py` no commit do deploy igual ao ficheiro atual em `main` | Correspondente |
| Backup | Backup recente validado com `gzip -t`; três arquivos completos observados na VM | Passou na última evidência |
| Recuperação | Migração real entre VMs concluída sem perda de dados conhecida | Demonstrada |

Nenhum valor de secret foi consultado ou publicado. Não foram alterados plano, billing, bindings, Azure, VM ou recursos Cloudflare durante esta auditoria.

## SSE — verificação específica

O frontend, Worker v56 e agente privado têm a implementação SSE versionada e o agente foi atualizado com sucesso. Os testes unitários do Worker e do agente passaram no CI.

O workflow `validate.yml` foi reforçado para testar em produção `GET /api/public/events`: HTTP 200, content-type `text/event-stream` e handshake/evento, sem imprimir payloads. **O resultado deste novo teste fica pendente até terminar a Action acionada pela alteração do workflow.** Só depois de passar se deve declarar o SSE ponta a ponta validado.

## Funcionalidades deliberadamente não incluídas

- PR #81 continua em draft. O frontend publicado continua a usar o fluxo atual de manutenção por `maintenance.json`; não assumir que `result.maintenance` está disponível no Worker v56.
- PR #84 contém reconciliação documental antiga e contradita pela publicação do Worker/Pages e pela atualização do agente. Não fazer merge sem reconciliação; as correções factuais foram registadas diretamente em `main`.
- O teste de conectividade de entrada com clientes Java/Bedrock externos não foi repetido nesta auditoria. A evidência anterior confirmou listeners TCP 25565 e TCP/UDP 19132, mas isso não equivale a um teste de join externo.
- Não foi feito um ensaio adicional e isolado de restauro de um arquivo de backup. A migração real entre VMs sem perda de dados conhecida já demonstrou recuperação operacional.
- O espelhamento sanitizado de `backup.sh` e `mc-backup-on-start` continua pendente na issue #9 do repositório de infraestrutura.

## Risco e custos

- O campo `usage_model=standard` não prova o plano Free/Paid da conta. Não alterar plano ou billing; a auditoria preservou a configuração existente.
- Os limites de operações R2 protegem os orçamentos de leituras/escritas implementados, mas não representam um teto global de faturação nem limitam, por si só, o armazenamento acumulado.
- Não criar recursos pagos, ativar upgrades ou aceitar despesas pessoais. O objetivo permanece 0,00 € / $0,00 de despesa pessoal.

## Decisão para comunicação ao grupo

É razoável comunicar que o servidor e o website estão disponíveis, sem prometer que a PR #81 está publicada nem que o teste SSE está concluído antes do novo CI. Se o smoke test SSE passar, o fluxo de estado em tempo real também fica validado pelo teste automatizado. Não anunciar uma certificação completa de conectividade externa Java/Bedrock com base apenas em listeners locais.
