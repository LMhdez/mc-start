# VM — agente privado e referências históricas

Esta pasta contém o agente privado ativo e documentos antigos de preflight/migração. A fonte operacional atual da infraestrutura é o repositório [mc-server-infrastructure](https://github.com/LMhdez/mc-server-infrastructure), em particular `docs/current-state.md`.

## Ficheiros

- `mc-agent.py`: agente Python privado usado pelo Worker através do Cloudflare Tunnel/VPC. É código operacional; rever testes, autenticação e rollback antes de alterar.
- `MADRID-MIGRATION-PLAN.md`: **ARQUIVADO**. Plano supersedido pela migração concluída para BelgiumCentral.
- `FRANCE-MIGRATION-PLAN.md`: **ARQUIVADO**. Preflight regional antigo, sem destino operacional.
- `france-preflight.sh`: script read-only legado, desativado por defeito; não executar.

## Produção conhecida

Último estado documentado em 2026-11-03: Azure BelgiumCentral, VM `MC-VM-BE`, resource group `MCServerBelgiumGroup`. Não reutilizar nomes/IPs de Austria East, France Central ou Madrid. Confirmar estado vivo na infraestrutura antes de operações.

## Segurança do agente

- Escutar apenas em loopback na VM e encaminhar via binding VPC; nunca publicar a porta 8765 na Internet/NSG.
- Validar autenticação, método, path e payload antes de cada operação.
- Nunca registar passwords, tokens, RCON, listas de jogadores ou dados de mundo.
- Alterações ao agente são deployments mutáveis; confirmar compatibilidade Worker/agent, testes e rollback.
- Não executar comandos que possam devolver segredos sem redaction/allowlist.

## Custos

Custo permitido absoluto: 0,00 € / $0,00; Free Tier efetivo apenas. A VM atual documentada usa SKU `Standard_B2als_v2`, que não deve ser presumido Free Tier; billing não foi validado nesta revisão. Não criar/iniciar/redimensionar compute pago, criar IP/disco/rede, consumir créditos Azure Student para recursos pagos ou ativar Pay-As-You-Go.
