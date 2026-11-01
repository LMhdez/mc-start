# MC SERVER — Cloudflare e agente privado

Este documento descreve a arquitetura atual e a ordem segura de implementação. O website está alojado no **GitHub Pages**; a Cloudflare fornece a API de controlo e a ligação privada à VM.

## Arquitetura

1. **Website — GitHub Pages**
   - Interface estática em HTML, CSS e JavaScript.
   - Consulta o estado público e o inventário técnico.
   - Envia ações administrativas com palavra-passe.

2. **Cloudflare Worker — `mc-start-control`**
   - Consulta e controla a VM através da API ARM do Azure.
   - Usa os workflows do GitHub Actions como alternativa quando a chamada direta falha.
   - Encaminha pedidos privados para o agente através do binding VPC `MC_AGENT`.
   - Usa o KV `STATUS_KV` para cache técnica e resultados privados cifrados; os contadores de rate limit ficam em memória no Worker.

3. **VM Azure**
   - Contentor Docker `mc-server`.
   - RCON para consultar jogadores e parar o Minecraft de forma graciosa.
   - Agente Python em `127.0.0.1:8765`.
   - Serviço `cloudflared`, com ligação de saída à Cloudflare.

**Não exponhas a porta 8765 na Internet nem no NSG.** O agente só deve ser alcançado pelo binding VPC. O túnel não deve ser usado como substituto da autenticação do Worker.

## Endpoints do Worker

| Método | Endpoint | Acesso |
|---|---|---|
| GET | `/api/public/status` | Público; estado da VM, contentor, porta e número de jogadores quando conhecido |
| GET | `/api/technical` | Público; versões e inventário de software/mods |
| POST | `/api/action` | Palavra-passe; ações `start`, `stop` e `status` |
| POST | `/api/status/read` | Palavra-passe; leitura do resultado privado |
| POST | `/api/status-result` | Callback autenticado do workflow de estado |

O endpoint técnico divulga versões e mods instalados. Isso é informação operacional, não um segredo, mas deve ser considerado uma decisão consciente de exposição pública.

A validação de `Origin` limita os browsers autorizados, mas **não substitui a palavra-passe**: clientes não-browser podem falsificar esse cabeçalho.

## Bindings e secrets do Worker

Os seguintes bindings existem na configuração Cloudflare:

| Nome | Tipo | Utilização |
|---|---|---|
| `ACCESS_PASSWORD` | Secret | Autenticação do painel e callback |
| `ALLOWED_ORIGIN` | Secret | Origem autorizada do website |
| `AZURE_CLIENT_ID` | Secret | Identidade de serviço Azure |
| `AZURE_CLIENT_SECRET` | Secret | Credencial Azure |
| `AZURE_TENANT_ID` | Secret | Tenant Azure |
| `AZURE_SUBSCRIPTION_ID` | Secret | Subscrição Azure |
| `AZURE_RESOURCE_GROUP` | Secret | Resource group da VM |
| `AZURE_VM_NAME` | Secret | Nome da VM |
| `GITHUB_TOKEN` | Secret | Dispatch dos workflows de fallback |
| `STATUS_KV` | KV namespace | Cache técnica e estado privado temporário |
| `MC_AGENT` | VPC Service | Ligação ao agente privado |

Estes valores já aparecem como bindings do tipo Secret na configuração atual. **Não os recries nem substituas por variáveis de texto simples.** Os valores dos secrets não são legíveis através da API de gestão.

O `GITHUB_TOKEN` deve ser um Fine-grained Personal Access Token limitado ao repositório `LMhdez/mc-start), com a permissão mínima necessária para iniciar workflows (Actions: Read and write).

## Secrets do GitHub Actions

Os workflows existentes referenciam:

- `AZURE_CREDENTIALS`: credencial JSON do service principal usada pelo Azure Login.
- `AZURE_RESOURCE_GROUP` e `AZURE_VM_NAME`: identificação da VM.
- `ACCESS_PASSWORD`: autenticação do callback de estado.
- `CLOUDFLARE_TUNNEL_TOKEN`: token do túnel remoto.
- `MC_VM_SSH_PRIVATE_KEY`: chave SSH para a instalação inicial do agente.

Não coloques valores destes secrets no repositório, nos logs ou em URLs. A autenticação Azure dos workflows ainda usa um client secret; uma migração futura para OIDC/federated credentials reduziria a dependência de credenciais de longa duração.

## Ordem de implementação e deploy

1. **GitHub Pages:** o website é publicado automaticamente quando as alterações chegam a `main`.
2. **Cloudflare Worker:** o código de referência está em `cloudflare/worker.js). A implementação atual não tem um workflow de deploy automático; é necessário publicar o código no Worker e preservar todos os bindings e secrets existentes.
3. **Agente privado:** depois de publicar o Worker compatível, as alterações a `vm/mc-agent.py` acionam automaticamente **Atualizar agente privado MC**. Também pode ser executado manualmente. O workflow exige que a VM esteja ligada e não aplica alterações se estiver desligada.
4. **Instalação inicial:** executa **Instalar agente privado MC** apenas quando a VM estiver ligada. O workflow valida a fingerprint SSH através da Azure antes de confiar na ligação.
5. **Krypton:** executa **Instalar Krypton no servidor Minecraft** manualmente. O workflow verifica RCON/jogadores, compatibilidade, hash SHA-512, backup e arranque do servidor. Não é acionado por um simples push ao ficheiro do workflow.

A publicação do Worker e do agente é deliberadamente separada: publica primeiro o Worker e só depois atualiza o agente, para evitar incompatibilidades temporárias entre versões.

## Segurança e operação

- O agente escuta apenas em `127.0.0.1:8765`; não abras essa porta no NSG.
- A instalação inicial ainda usa SSH para o IP público da VM. A fingerprint é validada através da Azure, mas a porta TCP 22 continua a ter de estar acessível; restringe-a no NSG e considera migrar para Azure Bastion ou um runner dentro da VNet.
- O Worker exige palavra-passe para ações privadas e aplica limites por IP em memória por isolate. Isto evita escritas KV por pedido, mas é apenas uma proteção de melhor esforço: contadores não são partilhados entre isolates nem garantem bloqueio global/atómico. Se o tráfego crescer ou for necessário controlo anti-abuso forte, configurar um Cloudflare Rate Limiting binding dedicado.
- Os endpoints públicos não devolvem IP privado nem nomes de jogadores.
- O desligamento tenta parar o contentor Minecraft antes de desalocar a VM.
- Os workflows que alteram a VM partilham um grupo de concorrência para evitar execuções simultâneas.
- A conta Cloudflare deve ter autenticação multifator obrigatória. A configuração de conta consultada durante a auditoria não tinha a imposição de 2FA ativa.
- A observabilidade do Worker está desativada; a remoção de query strings dos logs está ativada como proteção adicional.

## Limites desta auditoria

A integração disponível permite inspecionar o repositório, os workflows e a configuração do Worker. Não permite ler valores de secrets nem verificar diretamente regras NSG, discos, backups, RBAC e políticas da subscrição Azure. Esses elementos devem ser auditados no portal Azure.
