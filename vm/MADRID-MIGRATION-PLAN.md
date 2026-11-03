# Madrid (Spain Central) — plano de migração Minecraft

**Estado:** destino candidato; preparação apenas. Nenhum recurso Azure foi criado.

A região Madrid substitui France Central como hipótese principal após o Azure Speed Test fornecido indicar cerca de 35 ms para Spain Central contra 67 ms para Austria East. Esta diferença é indicativa e tem de ser validada com TCP Minecraft, jitter e perda de pacotes a partir das redes dos jogadores.

## Implementação

O one-shot Azure Cloud Shell e o runbook operacional vivem no repositório privado `LMhdez/mc-server-infrastructure`:

- [Plano Madrid e custos](https://github.com/LMhdez/mc-server-infrastructure/blob/main/docs/madrid-migration-plan.md)
- [One-shot Azure Cloud Shell](https://github.com/LMhdez/mc-server-infrastructure/blob/main/scripts/azure-madrid-once.sh)

O script é exclusivamente read-only; não contém provisionamento. Todas as consultas Azure têm timeout. Não existe autorização para criar recursos, consumir créditos ou incorrer em despesas pessoais. Qualquer proposta futura exige primeiro estimativa discriminada, confirmação de saldo e aprovação explícita; despesa pessoal permitida: 0 €.

## Alvo planeado

- Região: Spain Central (`spaincentral`)
- VM: `Standard_B2als_v2`, sem zona
- Ubuntu Server 24.04 LTS
- Disco Premium SSD 30 GB
- Identidade SystemAssigned
- Portas: SSH TCP 22 aberto a qualquer origem (pedido explícito); Java TCP 25565; Bedrock UDP/TCP 19132

## Salvaguardas

- A VM austríaca continua ligada e intacta durante a preparação.
- Sem alterações de DNS ou cutover automático.
- Sem publicação de backups, mundos, logs ou segredos no GitHub.
- Sem criação de recursos no modo de preparação.
- A VM antiga só poderá ser desligada/eliminada após validação e aprovação explícita.

## Estado

- [x] Região Madrid selecionada como candidata principal.
- [x] Inventário da origem confirmado.
- [x] Portas de origem e preferência de SSH público documentadas; validar NSG efetiva no destino.
- [x] One-shot read-only no repositório privado; sem código de criação.
- [x] Preflight parcial: Ubuntu 24.04 e quota BASv2 confirmados.
- [ ] SKU Standard_B2als_v2 em Spain Central — list-skus excede timeout; disponibilidade não confirmada.
- [ ] Disco Premium_LRS em Spain Central — comando de listagem não suportado; disponibilidade não confirmada.
- [ ] Restauro funcional validado numa máquina local isolada sem custos cloud.
- [ ] Créditos disponíveis e custo total máximo confirmados antes de qualquer provisionamento.
- [ ] Provisionamento (bloqueado até todos os pré-requisitos e aprovação explícita).
- [ ] Dados migrados e serviços validados.
- [ ] Latência real comparada.
- [ ] Cutover aprovado.
