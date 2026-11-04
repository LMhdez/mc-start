# VM — agente privado e referências históricas

Esta pasta contém o agente privado ativo e documentos antigos de preflight/migração. A fonte operacional atual da infraestrutura é o repositório [mc-server-infrastructure](https://github.com/LMhdez/mc-server-infrastructure), em particular `docs/current-state.md`.

## Ficheiros

- `mc-agent.py`: agente Python privado usado pelo Worker através do Cloudflare Tunnel/VPC. Inclui `/events` (SSE) para alterações ao estado público e contagem de jogadores. Um watcher partilhado faz leituras locais de Docker/portas/RCON/Geyser a cada 5 segundos apenas enquanto há clientes ligados; o estado Geyser fica em cache depois de confirmado. Não publica nomes/IP.
- `MADRID-MIGRATION-PLAN.md`: **ARQUIVADO**. Plano supersedido pela migração concluída para BelgiumCentral.
- `FRANCE-MIGRATION-PLAN.md`: **ARQUIVADO**. Preflight regional antigo, sem destino operacional.
- `france-preflight.sh`: script read-only legado, desativado por defeito; não executar.

## Produção conhecida

Último estado documentado em 2026-11-03: Azure BelgiumCentral, VM `MC-VM-BE`, resource group `MCServerBelgiumGroup`. Não reutilizar nomes/IPs de Austria East, France Central ou Madrid. Confirmar estado vivo na infraestrutura antes de operações.

## Segurança do agente

- Escutar apenas em loopback na VM e encaminhar via binding VPC; nunca publicar a porta 8765 na Internet/NSG.
- Validar autenticação, método, path e payload antes de cada operação.
- Nunca registar passwords, tokens, RCON, listas de jogadores ou dados de mundo.
- O monitor SSE é estritamente passivo: apenas consulta estado/Docker/RCON em modo de leitura; não executa `docker start/stop/restart`, `systemctl`, ações Azure nem workflows de ligar/desligar.
- Alterações ao agente são deployments mutáveis; confirmar compatibilidade Worker/agent, testes e rollback.
- Não executar comandos que possam devolver segredos sem redaction/allowlist.

## Custos

A decisão do projeto é usar os créditos Azure for Students disponíveis para suportar a VM e obter a melhor relação desempenho/custo, mantendo despesa pessoal em 0,00 € / $0,00. A SKU documentada `Standard_B2als_v2` é compute pago e foi aceite deliberadamente como opção económica/viável; não a descrever como Free Tier. Antes de alterar compute ou criar recursos, confirmar preço, consumo estimado, saldo e validade dos créditos. Não ativar Pay-As-You-Go nem aceitar faturação pessoal sem autorização explícita.


## Estado de publicação — 2026-11-04

O código SSE deste agente está em `main`, mas a cópia instalada na VM ainda não foi atualizada segundo a última confirmação operacional do projeto. A presença do código neste repositório não prova deployment. Qualquer atualização do agente é uma operação mutável e requer revisão do diff, validação de compatibilidade com o Worker e plano de rollback.
