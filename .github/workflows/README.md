# GitHub Actions — catálogo e segurança operacional

Ler o README da raiz antes de usar qualquer workflow. **Inspecionar sempre o YAML atual antes de executar**: os nomes e esta tabela não substituem a revisão dos comandos e secrets usados.

## Classificação

| Workflow | Objetivo conhecido | Classe / risco |
|---|---|---|
| `validate.yml` | Validação de código, testes e bundle | CI; sem deploy esperado, confirmar YAML |
| `build-essential-commands-afk.yml` | Compila JAR AFK personalizado e publica artefacto temporário | Build; não instala na VM |
| `azure-region-preflight.yml` | Removido em 2026-11-03; preflight Madrid obsoleto após migração para BelgiumCentral | Eliminado |
| `preflight-france-vm.yml` | Removido em 2026-11-03; plano regional obsoleto | Eliminado |
| `azure-network-audit.yml` | Auditoria sanitizada de NSG/Geyser via issue `[MC-AUDIT]` | Read-only, mas consome Run Command |
| `remote-info.yml` | Diagnóstico remoto | Read-only segundo o script; rever output e escopo |
| `status-mc-server.yml` | Consulta VM, Docker, RCON e estado para o painel | Read-only remoto; contém segredos no ambiente |
| `ui-browser-audit.yml` | Auditoria UI/Browser | CI/diagnóstico; não é deploy |
| `install-mc-autostart.yml` | Instala/atualiza serviço systemd | Mutável, pode alterar arranque |
| `install-private-agent.yml` | Instala agente privado na VM | Mutável, usa SSH e credenciais |
| `deploy-private-agent.yml` | Atualiza agente privado | Mutável, altera ficheiros/serviço |
| `install-krypton.yml` | Removido em 2026-11-03; não instalar mods adicionais | Eliminado |
| `secure-minecraft-network.yml` | Altera regras de rede/NSG | Mutável, pode cortar acessos |
| `start-vm.yml` | Inicia VM Azure manualmente pelo GitHub Actions, com confirmação explícita | Mutável; pode consumir créditos Azure ou gerar custos se não houver saldo |
| `stop-mc-server.yml` | Para jogo e desaloca VM | Interrompe jogadores; pode afetar disponibilidade |
| `toggle-autostop.yml` | Altera configuração do autostop | Mutável; risco de desligamento automático |

## Regras obrigatórias

- Política do projeto: custo total permitido **0,00 € / $0,00**. Não executar start/provision/deploy que possa gerar custo sem prova de gratuitidade efetiva; neste momento não presumir essa prova.
- Não imprimir valores de GitHub Secrets, env vars, credenciais Azure, chaves SSH, RCON ou conteúdo de ficheiros privados.
- Antes de workflows que param/reiniciam Minecraft, confirmar zero jogadores online, janela aprovada, backup e rollback.
- Antes de qualquer NSG change, comparar regras efetivas NIC e subnet e preservar SSH TCP 22, Java TCP 25565 e Bedrock TCP/UDP 19132 conforme estado/requisito documentado.
- Nunca correr em paralelo workflows que usem Azure Run Command ou alterem a VM, mesmo que não tenham concurrency group.
- Não usar um workflow de instalação como ferramenta de diagnóstico.
- Depois de executar, consultar o run/job e resultados sanitizados; não colar logs brutos sem revisão.
- Se um workflow tiver efeitos não compreendidos, não o executar.

## Secrets

Os workflows referenciam credenciais via GitHub Actions Secrets. Nunca os consultar ou imprimir. Para saber se um secret existe, usar apenas metadata/validação que não revele o valor. Rotacionar qualquer credencial exposta.


## Auditoria pós-migração BelgiumCentral — 2026-11-03

Foram revistos os 16 workflows presentes no repositório. Correções aplicadas:

- `start-vm.yml`: permite ao proprietário iniciar a VM fora do site através de `Actions → Ligar Servidor Minecraft → Run workflow`, exigindo confirmação manual explícita (`confirmar_arranque=true`) quando a VM está parada/desalocada. Eventos automáticos `repository_dispatch` não podem iniciar compute. O arranque pode consumir créditos Azure ou gerar custos se estes se esgotarem; não existe garantia técnica de custo zero. Se a VM já estiver ligada, o workflow continua idempotente.
- `stop-mc-server.yml`: antes de parar o contentor/desalocar a VM, exige contentor Docker ativo, resposta RCON interpretável e contagem confirmada de zero jogadores. Se RCON falhar ou existir qualquer jogador, aborta sem parar/desalocar.
- `install-mc-autostart.yml`: removido o trigger automático `push`; alterações ao próprio workflow deixam de reiniciar serviços na VM. Continua apenas manual.
- `install-krypton.yml`: eliminado; era uma via para instalar outro mod e reiniciar o servidor, desnecessária e contrária à decisão atual de não acrescentar mods.
- `preflight-france-vm.yml` e `azure-region-preflight.yml`: eliminados por serem planos de região supersedidos pela migração concluída para BelgiumCentral.

### Workflows operacionais que permanecem

`install-private-agent.yml`, `deploy-private-agent.yml`, `install-mc-autostart.yml`, `secure-minecraft-network.yml`, `toggle-autostop.yml`, `start-vm.yml` e `stop-mc-server.yml` são mutáveis. Não executar automaticamente: exigem revisão do estado atual, backup, jogadores e impacto. O `start-vm.yml` é a via manual alternativa ao site para ligar a VM.

### Limitações ainda conhecidas

- `secure-minecraft-network.yml` altera NSG e permite tráfego público de origem `*`; não executar sem uma revisão da topologia atual e aprovação explícita.
- `install-private-agent.yml` e `deploy-private-agent.yml` alteram serviços na VM e exigem validação pós-deploy; não foram executados nesta auditoria.
- `toggle-autostop.yml` altera cron remoto; confirmar backup/autostop e lock atuais antes de o usar.
- CI e auditorias read-only não foram executados por dispatch nesta passagem. As alterações foram estáticas; a validação YAML/shell e os testes CI ainda devem correr em GitHub Actions.
- Não foram executados workflows de start/stop, deploy, instalação ou alteração NSG.
