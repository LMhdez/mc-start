# Migração da VM Minecraft — seleção de região por subscrição

**Estado:** preparação e preflight apenas.  
**Regra de segurança:** a VM atual, o mundo e os jogadores permanecem intocados até existir uma VM nova validada e um plano de cutover aprovado.

## 1. Objetivo

Identificar uma região europeia que a subscrição Azure realmente devolva, verificar os SKUs candidatos e consultar as quotas regionais antes de considerar qualquer migração. Não assumir que uma região pública está autorizada na subscrição.

Não fazem parte desta fase: parar/desalocar/eliminar a VM atual, migrar jogadores, alterar o mundo de forma destrutiva, publicar credenciais ou criar recursos com custo não coberto por Free Tier.

## 2. Como é feita a seleção regional

O workflow manual **Azure subscription Europe region preflight (read-only)** executa `vm/france-preflight.sh` com a identidade Azure já guardada nos GitHub Secrets.

O script:
1. Autentica-se no contexto Azure existente sem imprimir identificadores.
2. Lê a localização, o tamanho e o estado da VM atual, ocultando nomes e IDs.
3. Executa `az account list-locations` no contexto da subscrição e filtra apenas regiões físicas cuja geografia seja Europa.
4. Para cada região devolvida, consulta uma vez a lista de SKUs e verifica `Standard_B1s`, `Standard_B2ats_v2` e `Standard_B2pts_v2`, distinguindo SKU não listado de SKU com restrição de localização.
5. Consulta as quotas de VM/vCPU de cada região.
6. Executa até quatro regiões em paralelo, preservando a ordem dos resultados.
7. Limita cada consulta de SKU a 150 segundos e cada consulta de quota a 45 segundos; uma consulta lenta fica marcada como indisponível/timeout e não bloqueia as restantes.
8. Suprime os diagnósticos brutos do Azure CLI para evitar expor identificadores ou informação confidencial.

**Interpretação importante:** a lista de localizações é a lista devolvida no contexto da subscrição, não uma garantia universal de acesso a todos os serviços. A presença de um SKU e quota disponível não confirmam capacidade física no momento da alocação. Só uma tentativa real de alocação poderia testar essa capacidade — e não será feita nesta fase, porque pode criar recursos faturáveis.

## 3. Bloqueios obrigatórios de Free Tier e custo zero

A disponibilidade de uma região ou SKU não prova que a conta tem benefício gratuito ativo.

Consequências práticas:
- As horas gratuitas de VM Linux, quando aplicáveis, são uma franquia mensal conjunta e não devem ser presumidas.
- Uma VM atual ligada quase todo o mês pode consumir praticamente toda a franquia antes de iniciarmos a cópia.
- Os benefícios de conta gratuita têm elegibilidade e prazo. É obrigatório verificar a grelha **Free services** da subscrição e o consumo restante.
- Discos, endereços IP, rede, tráfego de saída, snapshots e outros recursos associados podem ter faturação própria.
- Não será criado qualquer recurso se não for possível provar previamente que compute e dependências ficam a €0.

Referências:
- [Regiões Azure](https://learn.microsoft.com/azure/reliability/regions-list)
- [Disponibilidade de produtos por região](https://azure.microsoft.com/explore/global-infrastructure/products-by-region/)
- [Criar serviços gratuitos em regiões elegíveis](https://learn.microsoft.com/azure/cost-management-billing/manage/create-free-services)
- [Evitar cobranças numa conta Azure gratuita](https://learn.microsoft.com/azure/cost-management-billing/manage/avoid-charges-free-account)
- [Estados da VM e faturação](https://learn.microsoft.com/azure/virtual-machines/states-billing)

## 4. Limites do preflight

O relatório separa quatro verificações que não são equivalentes:
- **Região devolvida pela subscrição:** a localização aparece no inventário regional da subscrição.
- **SKU e quota:** a família/tamanho está listado sem restrição de localização e a quota regional é consultável.
- **Capacidade física:** não verificada por consultas read-only; a capacidade pode variar no tempo.
- **Custo zero:** não verificado pelo script; depende dos benefícios ativos e de todos os recursos associados.

Não usar o relatório para escolher automaticamente uma região nem para iniciar provisionamento. Primeiro analisar o resultado real da subscrição.

## 5. Sequência após o preflight

1. Rever apenas as regiões europeias devolvidas pela subscrição.
2. Excluir regiões sem SKU elegível ou sem quota suficiente.
3. Comparar latência a partir das localizações dos jogadores, sem alterar a produção.
4. Confirmar no portal Azure o benefício Free Tier restante e o custo de cada dependência.
5. Só considerar uma nova VM se todos os itens estiverem comprovadamente a €0 e a capacidade for confirmada sem comprometer a VM atual.
6. Manter a VM original e o mundo intactos até à validação integral e aprovação explícita do cutover.

## 6. Estado

- [x] Preflight regional baseado no inventário da subscrição implementado.
- [x] Verificação de SKUs candidatos por cada região europeia devolvida.
- [x] Consulta de quotas regionais.
- [x] Consultas regionais em lotes paralelos limitados e com timeout por consulta.
- [ ] CI validado.
- [ ] Preflight executado contra a subscrição real.
- [ ] Free Tier e custo total confirmados.
- [ ] Capacidade adequada confirmada.
- [ ] Migração — não autorizada nesta fase.

**Este preflight é read-only: não cria, atualiza, inicia, para, desaloca nem elimina recursos Azure.**
