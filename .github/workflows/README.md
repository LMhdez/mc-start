# GitHub Actions — catálogo e segurança operacional

Ler o README da raiz antes de usar qualquer workflow. **Inspecionar sempre o YAML atual antes de executar**: os nomes e esta tabela não substituem a revisão dos comandos e secrets usados.

## Classificação

| Workflow | Objetivo conhecido | Classe / risco |
|---|---|---|
| `validate.yml` | Validação de código, testes e bundle | CI; sem deploy esperado, confirmar YAML |
| `build-essential-commands-afk.yml` | Compila JAR AFK personalizado e publica artefacto temporário | Build; não instala na VM |
| `azure-region-preflight.yml` | Consultas Azure de regiões/SKUs/quota | Read-only; timeout não significa disponibilidade |
| `preflight-france-vm.yml` | Preflight regional legado | Read-only; plano France supersedido |
| `azure-network-audit.yml` | Auditoria sanitizada de NSG/Geyser via issue `[MC-AUDIT]` | Read-only, mas consome Run Command |
| `remote-info.yml` | Diagnóstico remoto | Read-only segundo o script; rever output e escopo |
| `status-mc-server.yml` | Consulta VM, Docker, RCON e estado para o painel | Read-only remoto; contém segredos no ambiente |
| `ui-browser-audit.yml` | Auditoria UI/Browser | CI/diagnóstico; não é deploy |
| `install-mc-autostart.yml` | Instala/atualiza serviço systemd | Mutável, pode alterar arranque |
| `install-private-agent.yml` | Instala agente privado na VM | Mutável, usa SSH e credenciais |
| `deploy-private-agent.yml` | Atualiza agente privado | Mutável, altera ficheiros/serviço |
| `install-krypton.yml` | Instala mod Krypton e reinicia Minecraft | Interrupção, backup e reinício |
| `secure-minecraft-network.yml` | Altera regras de rede/NSG | Mutável, pode cortar acessos |
| `start-vm.yml` | Inicia VM Azure | Pode iniciar faturação; proibido sem custo €0 comprovado |
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
