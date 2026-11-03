# VM — agente privado e planos de migração

Esta pasta contém código e documentação auxiliar para a VM Minecraft. A fonte operacional principal e atualizada da infraestrutura é o repositório privado `LMhdez/mc-server-infrastructure`.

## Ficheiros

- `mc-agent.py`: agente Python privado que expõe operações/status para o Worker através da ligação VPC/Tunnel.
- `MADRID-MIGRATION-PLAN.md`: resumo e links para o plano atual Madrid.
- `FRANCE-MIGRATION-PLAN.md`: plano histórico/supersedido; não usar como destino atual.
- Não confundir o agente com o servidor Minecraft nem com o Cloudflare Worker.

## Segurança do agente

- Escutar apenas em loopback na VM e encaminhar via binding VPC; nunca publicar a porta 8765 na Internet/NSG.
- Validar autenticação, método, path e payload antes de cada operação.
- Nunca registar passwords, tokens, RCON, listas de jogadores ou dados de mundo.
- Alterações ao agente são deployments mutáveis; confirmar compatibilidade Worker/agent e rollback.

## Migração

Madrid/Spain Central é apenas uma hipótese técnica. A migração está bloqueada enquanto não houver arquitetura completa e comprovadamente €0. Não criar VM, disco, IP, snapshots, rede ou qualquer recurso faturável. Ler o runbook atualizado em `mc-server-infrastructure/docs/` e preservar a VM austríaca.
