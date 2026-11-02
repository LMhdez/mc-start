# Migração da VM Minecraft para França — plano seguro

**Estado:** preparação e preflight apenas.  
**Região-alvo inicial:** `francecentral` (France Central, Paris).  
**Regra de segurança:** a VM atual, o mundo e os jogadores permanecem intocados até existir uma VM nova validada e um plano de cutover aprovado.

## 1. Objetivo

Preparar uma segunda infraestrutura Azure em França, capaz de receber o servidor Minecraft existente sem reconstruir configurações à mão nem alterar a VM de produção. A nova VM só poderá receber dados depois de validarmos a capacidade, o armazenamento, a rede e o custo total.

Não fazem parte desta fase: parar/desalocar/eliminar a VM atual, migrar jogadores, alterar o mundo de forma destrutiva, publicar credenciais ou criar recursos com custo não coberto por Free Tier.

## 2. Escolha da região

Usar `francecentral` como primeira candidata. A região corresponde a Paris e consta da lista pública de regiões Azure. `francesouth` (Marseille) aparece com acesso restrito a cenários específicos; não a usar como alternativa sem confirmação de acesso na subscrição.

Referências:
- [Regiões Azure](https://learn.microsoft.com/azure/reliability/regions-list)
- [Disponibilidade de produtos por região](https://azure.microsoft.com/explore/global-infrastructure/products-by-region/)

A região final ainda deve ser validada com a subscrição real, as quotas, o SKU disponível e a latência medida a partir das localizações dos jogadores. A proximidade geográfica, isoladamente, não prova que a latência melhora para todos.

## 3. Bloqueios obrigatórios de Free Tier

A Microsoft documenta até **750 horas mensais de VM Linux** nos SKUs elegíveis e até **dois discos geridos P6 de 64 GiB**, para subscrições que ainda tenham os benefícios aplicáveis. As horas podem ser distribuídas por várias instâncias; não são 750 horas por VM. A disponibilidade de um SKU numa região não prova que a conta tem benefício gratuito ativo.

Consequências práticas:
- Duas VMs Linux ligadas 24/7 não cabem numa quota conjunta de 750 horas.
- Uma VM atual ligada quase todo o mês pode consumir praticamente toda a quota antes de iniciarmos a cópia.
- Os benefícios de conta gratuita têm elegibilidade e prazo. É obrigatório verificar a grelha **Free services** da subscrição e o consumo restante; não assumir que continuam ativos.
- Os SKUs Linux listados como elegíveis — `Standard_B1s`, `Standard_B2ats_v2` e `Standard_B2pts_v2` — incluem opções com apenas 1 GiB de RAM. Não assumir que são suficientes para o nosso servidor modificado. O SKU ARM também exige validação de compatibilidade.
- Discos, endereços IP, rede, tráfego de saída, snapshots e outros recursos associados podem ter faturação própria. Desalocar uma VM deixa de faturar o compute, mas não garante custo zero para discos e rede.

**Critério de criação:** só avançar quando a conta confirmar benefício gratuito ativo e horas restantes suficientes, o disco estiver coberto, e cada recurso dependente estiver confirmado a €0. Se não for possível provar custo zero, não criar a infraestrutura.

Referências:
- [Criar serviços gratuitos em qualquer região elegível](https://learn.microsoft.com/azure/cost-management-billing/manage/create-free-services)
- [Evitar cobranças numa conta Azure gratuita](https://learn.microsoft.com/azure/cost-management-billing/manage/avoid-charges-free-account)
- [Estados da VM e faturação](https://learn.microsoft.com/azure/virtual-machines/states-billing)
- [Especificações Basv2](https://learn.microsoft.com/azure/virtual-machines/sizes/general-purpose/basv2-series)
- [Especificações Bpsv2](https://learn.microsoft.com/azure/virtual-machines/sizes/general-purpose/bpsv2-series)

## 4. Preflight implementado

O workflow manual **Azure France VM preflight (read-only)** executa `vm/france-preflight.sh` com a identidade Azure já guardada nos GitHub Secrets.

O script limita-se a:
1. Confirmar que a sessão Azure está autenticada.
2. Ler a região, o tamanho e o estado da VM atual sem imprimir o nome, resource group ou subscription ID.
3. Consultar a visibilidade e as restrições dos SKUs candidatos em `francecentral`.
4. Consultar indicadores de quota regional.
5. Declarar explicitamente que Free Tier, horas restantes e custo dos recursos dependentes não foram verificados.

O workflow mascara os identificadores de infraestrutura antes das consultas. O script não contém comandos de criação, atualização, arranque, paragem, desalocação ou remoção de recursos. Não imprime valores de secrets.

**Limite conhecido:** Azure CLI consegue verificar SKU e quotas, mas estas consultas não provam o saldo da oferta gratuita nem o custo completo da arquitetura. A confirmação final tem de ser feita na página Free services e na estimativa de custo da própria subscrição, sem aceitar qualquer configuração com custo positivo.

## 5. Sequência de migração após o preflight

1. **Inventário:** obter tamanho da VM atual, uso real de RAM/CPU, tamanho dos discos, versões Java/Minecraft, mods, configs, Docker Compose, systemd, agente privado e serviços de rede.
2. **Decisão de capacidade:** escolher um SKU que iguale ou supere a capacidade necessária, sem reduzir o desempenho para caber artificialmente no Free Tier.
3. **Validação de custo:** confirmar compute, OS disk, discos de dados, IP público, NIC, NSG, VNet, tráfego, snapshots e armazenamento. Abortar se qualquer item não for gratuito.
4. **Provisionamento isolado:** criar a VM em França sem alterar a VM atual. Não instalar nem copiar dados de produção antes de validar a configuração base.
5. **Preparação do servidor:** instalar Docker e dependências; reproduzir versões e configurações por cópia controlada, mantendo segredos fora do GitHub.
6. **Cópia consistente:** criar backup verificável do mundo e das configurações. A sincronização final deve ser incremental e preservar uma cópia intacta da origem.
7. **Testes sem jogadores:** validar arranque, logs, RCON, Java, Bedrock, mods, permissões, backups, firewall, agente privado e latência de várias localizações.
8. **Cutover controlado:** só depois dos testes, agendar a passagem, congelar alterações no servidor antigo pelo período estritamente necessário, sincronizar a diferença final e alterar os pontos de entrada.
9. **Rollback:** manter a VM original e o backup anterior disponíveis. Se qualquer teste falhar, voltar ao servidor antigo sem tentar reparar o mundo em produção.

## 6. Estado desta alteração

- [x] Região inicial identificada.
- [x] Preflight Azure read-only adicionado.
- [x] Workflow manual com secrets existentes e mascaramento de identificadores.
- [ ] CI da pull request concluído.
- [ ] Preflight executado contra a subscrição real.
- [ ] Benefício Free Tier e custo total confirmados.
- [ ] Capacidade da VM nova confirmada.
- [ ] VM nova criada e testada — ainda não autorizada nesta fase.

**Nenhum recurso Azure foi criado ou alterado por esta alteração ao repositório.**
