# Madrid (Spain Central) — plano de migração Minecraft

**Estado:** destino candidato; preparação apenas. Nenhum recurso Azure foi criado.

A região Madrid substitui France Central como hipótese principal após o Azure Speed Test fornecido indicar cerca de 35 ms para Spain Central contra 67 ms para Austria East. Esta diferença é indicativa e tem de ser validada com TCP Minecraft, jitter e perda de pacotes a partir das redes dos jogadores.

## Implementação

O one-shot Azure Cloud Shell e o runbook operacional vivem no repositório privado `LMhdez/mc-server-infrastructure`:

- [Plano Madrid e custos](https://github.com/LMhdez/mc-server-infrastructure/blob/main/docs/madrid-migration-plan.md)
- [One-shot Azure Cloud Shell](https://github.com/LMhdez/mc-server-infrastructure/blob/main/scripts/azure-madrid-once.sh)

O script começa sempre em modo read-only. A criação só é possível com confirmação de créditos Azure for Students, custo total e confirmação interativa. Não existe autorização para despesas pessoais.

## Alvo planeado

- Região: Spain Central (`spaincentral`)
- VM: `Standard_B2als_v2`, sem zona
- Ubuntu Server 24.04 LTS
- Disco Premium SSD 30 GB
- Identidade SystemAssigned
- Portas: SSH TCP 22; Java TCP 25565; Bedrock UDP/TCP 19132

## Salvaguardas

- A VM austríaca continua ligada e intacta durante a preparação.
- Sem alterações de DNS ou cutover automático.
- Sem publicação de backups, mundos, logs ou segredos no GitHub.
- Sem criação de recursos no modo de preparação.
- A VM antiga só poderá ser desligada/eliminada após validação e aprovação explícita.

## Estado

- [x] Região Madrid selecionada como candidata principal.
- [x] Inventário da origem confirmado.
- [x] Portas e política SSH confirmadas.
- [x] One-shot preparado no repositório privado de infraestrutura.
- [ ] Revisão/merge do PR.
- [ ] Preflight read-only executado.
- [ ] Créditos e custo total confirmados.
- [ ] Infraestrutura criada.
- [ ] Dados migrados e serviços validados.
- [ ] Latência real comparada.
- [ ] Cutover aprovado.
