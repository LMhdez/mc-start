# GitHub Actions — catálogo e segurança operacional

Ler o README da raiz e rever o YAML integral antes de executar qualquer workflow. Esta tabela é um índice, não substitui a inspeção dos comandos, secrets, permissões e efeitos reais.

## Inventário do branch main

| Workflow | Função | Classe / risco |
|---|---|---|
| `validate.yml` | Sintaxe, testes, Wrangler dry-run e smoke tests públicos | CI; sem deploy |
| `ui-browser-audit.yml` | Chromium, acessibilidade, teclado e responsividade | CI; screenshots temporários |
| `social-preview.yml` | Converte `social-preview.svg` em PNG 1200×630 e publica o ficheiro | Mutável apenas no repositório; runner GitHub |
| `toggle-maintenance.yml` | Altera `maintenance.json` | Mutável apenas no website; não toca na VM |
| `build-essential-commands-afk.yml` | Compila variante AFK do Essential Commands | Build; não instala na VM |
| `remote-info.yml` | Diagnóstico remoto | Read-only; rever output |
| `status-mc-server.yml` | Consulta estado VM/Docker/RCON para o painel | Read-only remoto; secrets no ambiente |
| `azure-network-audit.yml` | Auditoria sanitizada de NSG e Geyser via issue `[MC-AUDIT]` | Read-only; consome Azure Run Command |
| `install-mc-autostart.yml` | Instala/atualiza serviço systemd | Mutável; pode alterar arranque |
| `install-private-agent.yml` | Instala agente privado na VM | Mutável; SSH/serviço |
| `deploy-private-agent.yml` | Atualiza agente privado | Mutável; altera código/serviço |
| `restore-cron-automations.yml` | Restaura automações cron | Mutável; pode reativar backup/autostop |
| `toggle-autostop.yml` | Altera entrada cron do autostop | Mutável; pode desligar a produção |
| `secure-minecraft-network.yml` | Ajusta regras NSG de jogo | Mutável; pode cortar conectividade |
| `start-vm.yml` | Inicia VM Azure | Pode iniciar compute faturável; exige preflight de créditos Azure Student, confirmação de ausência de despesa pessoal e autorização explícita |
| `stop-mc-server.yml` | Para Minecraft e desaloca VM | Interrompe jogadores; exige confirmação de zero jogadores |

## Regras obrigatórias

- **Despesa pessoal máxima: 0,00 € / $0,00.** Os créditos Azure for Students podem financiar compute Azure pago deliberadamente escolhido pela melhor relação custo/desempenho. Antes de `start-vm.yml` ou de qualquer alteração de consumo, confirmar preço regional, estimativa, saldo e validade dos créditos, incluindo o risco de esgotamento/expiração; bloquear se existir risco de cobrança pessoal. Não ativar Pay-As-You-Go nem aceitar billing pessoal sem autorização explícita. GitHub runners e serviços de terceiros têm billing separado e devem permanecer nas quotas gratuitas aprovadas, salvo autorização separada.
- Nunca imprimir secrets, env vars, credenciais Azure, chaves SSH, RCON, nomes de jogadores, IP público ou logs brutos.
- Não usar workflow mutável para diagnóstico.
- Antes de parar/reiniciar Minecraft: confirmar jogadores offline, backup recente validado, lock livre, janela e rollback.
- Antes de qualquer NSG change: comparar regras efetivas NIC e subnet. Preservar SSH TCP 22 conforme política atual, Java TCP 25565, Bedrock UDP 19132 e o uso legítimo Bedrock TCP 19132. O workflow de rede foi corrigido para contemplar TCP 19132, mas continua mutável e não foi executado nesta revisão.
- Nunca correr em paralelo workflows que usem Azure Run Command ou alterem a VM.
- Verificar resultados com campos allowlisted; nunca colar logs brutos.
- O modo manutenção do site é informativo: altera apenas `maintenance.json`, não bloqueia jogadores nem desliga a VM.
- O PNG social é gerado por GitHub Actions. Monitorizar a utilização dentro das quotas gratuitas; não ativar runners pagos.

## Evidência pós-migração BelgiumCentral — 2026-11-03

 > **Custo:** a VM atual usa `Standard_B2als_v2`, compute pago deliberadamente aceite com créditos Azure for Students. O saldo/billing não foi consultado nesta revisão; antes de workflows que iniciem/expandam compute, confirmar preço, consumo estimado, saldo e validade dos créditos e garantir que não haverá despesa pessoal. A SKU não é Free Tier.

A produção documentada é a VM `MC-VM-BE` em `MCServerBelgiumGroup`, BelgiumCentral. Os workflows usam os secrets Azure para determinar o alvo; confirmar metadata/configuração antes de qualquer operação, sem consultar os valores. Não reutilizar nomes, IPs ou scripts de Austria East/Madrid.

O endpoint público `/api/public/status` voltou a HTTP 200 após atribuir `Reader` ao Service Principal do Worker no scope da VM belga. Ver `cloudflare/WORKER-503-INCIDENT.md`. A confirmação do endpoint não equivale a teste de login Minecraft.

## Workflows mutáveis — não executar sem nova revisão

`install-private-agent.yml`, `deploy-private-agent.yml`, `install-mc-autostart.yml`, `restore-cron-automations.yml`, `toggle-autostop.yml`, `secure-minecraft-network.yml`, `start-vm.yml` e `stop-mc-server.yml` alteram produção ou disponibilidade. Exigem revisão do estado vivo, custo, jogadores, backup, lock, alvo e rollback. Esta revisão documental não executou nenhum deles.

## Modo de manutenção do website

- `mode=enable` ativa o aviso público; `mode=disable` remove-o.
- A mensagem é limitada a 240 caracteres.
- Só altera `maintenance.json` em `main`; o frontend consulta o estado periodicamente.
- Não altera Worker, Azure, rede, Minecraft ou billing.

## Histórico

Os preflights Azure de Madrid/France e o workflow de instalação de Krypton foram removidos/arquivados. Não os reintroduzir sem pedido explícito, revisão técnica e preflight financeiro segundo a política Azure Student atual. A configuração Geyser/Floodgate aprovada é para preservar, não para endurecer automaticamente durante uma tarefa de documentação.
