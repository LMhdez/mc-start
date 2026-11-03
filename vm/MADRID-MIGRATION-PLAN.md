# Madrid (Spain Central) — plano de migração Minecraft

**Estado:** destino candidato; preparação e alinhamento documental em curso. Nenhum recurso Azure foi criado.

A região Madrid substitui France Central como hipótese principal após o Azure Speed Test fornecido indicar cerca de 35 ms para Spain Central contra 67 ms para Austria East. Esta diferença é indicativa e tem de ser validada com TCP Minecraft, jitter e perda de pacotes a partir das redes dos jogadores.

## Implementação

O one-shot Azure Cloud Shell e o runbook operacional vivem no repositório privado `LMhdez/mc-server-infrastructure`:

- [Plano Madrid e custos](https://github.com/LMhdez/mc-server-infrastructure/blob/main/docs/madrid-migration-plan.md)
- [One-shot Azure Cloud Shell](https://github.com/LMhdez/mc-server-infrastructure/blob/main/scripts/azure-madrid-once.sh)

O script é exclusivamente read-only; não contém provisionamento. Todas as consultas Azure têm timeout. O operador autorizou expressamente a utilização dos créditos Azure for Students para a migração Madrid. Esta autorização não permite ativar Pay-As-You-Go, mudar de oferta, incorrer em despesas pessoais ou avançar automaticamente para provisionamento/cutover. A despesa pessoal permitida continua a ser 0 €. Antes de provisionar, confirmar saldo e validade dos créditos, estimativa discriminada do custo total e cobertura integral por créditos. Se houver risco de cobrança pessoal, parar.

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
- A migração deve ser transparente para os jogadores: preservar hostname/endereço de ligação sempre que o DNS/IP atual o permita, reduzir a janela de manutenção e manter a origem intacta para rollback.
- A VM antiga só poderá ser desligada/eliminada após validação e aprovação explícita.

## Auditoria read-only da origem (2026-11-03)

Resultado concluído em [MC-AUDIT #68](https://github.com/LMhdez/mc-start/issues/68):

- VM em execução; Azure VM Agent pronto.
- NSG da NIC permite SSH TCP 22, Java TCP 25565 e Bedrock TCP/UDP 19132 a qualquer origem Internet, conforme a preferência de acesso SSH do operador.
- Nenhuma regra inbound correspondente foi encontrada na NSG da subnet.
- Geyser confirmou `auth-type=floodgate` e `validate-bedrock-login=false`; transporte NETHERNET, ligação direta e listeners TCP/UDP 19132 ativos na JVM.
- O operador confirmou que esta configuração é intencional e determinou uma réplica 1:1. Preservar exatamente o comportamento da origem em Madrid; não alterar autenticação, validação Bedrock, transporte ou ligação direta. Os avisos da documentação upstream ficam registados como contexto, não como alteração aprovada.
- Auditoria não alterou produção, não mudou DNS e não criou recursos.

## Estado

- [x] Região Madrid selecionada como candidata principal.
- [x] Inventário da origem confirmado.
- [x] Portas de origem e preferência de SSH público documentadas; validar NSG efetiva no destino.
- [x] One-shot read-only no repositório privado; sem código de criação.
- [x] Preflight parcial: Ubuntu 24.04 e quota BASv2 confirmados.
- [ ] SKU Standard_B2als_v2 em Spain Central — list-skus excede timeout; disponibilidade não confirmada.
- [ ] Disco Premium_LRS em Spain Central — comando de listagem não suportado; disponibilidade não confirmada.
- [x] Operador dispensou teste funcional isolado prévio; validar integridade/checksum e executar testes funcionais no destino, mantendo Áustria para rollback.
- [ ] Saldo/validade dos créditos Azure for Students e custo total máximo confirmados antes de qualquer provisionamento; o custo acumulado apresentado no portal não equivale ao saldo disponível.
- [ ] Resultado do preflight Azure subscription-scoped de SKU VM/disco — [issue #71](https://github.com/LMhdez/mc-start/issues/71); workflow terminou, mas as duas consultas excederam o timeout.
- [ ] Provisionamento — apenas depois de confirmar cobertura integral dos custos pelos créditos Azure for Students, disponibilidade do SKU/disco e ausência de risco de cobrança pessoal.
- [ ] Dados migrados e serviços validados.
- [ ] Latência real comparada.
- [ ] Cutover aprovado.
