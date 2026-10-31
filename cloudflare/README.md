# Controlo do servidor através de Cloudflare Workers

Este Worker recebe pedidos do painel web e inicia apenas três workflows conhecidos do GitHub: ligar, desligar e verificar o servidor.

## Criar o Worker

1. Na Cloudflare, abre **Workers & Pages** e cria uma aplicação Worker.
2. Dá-lhe um nome, por exemplo `mc-start-control`.
3. Escolhe a opção para editar o código e substitui o exemplo pelo conteúdo de `worker.js`.
4. Guarda e implementa o Worker.

## Configurar os Secrets

No Worker, abre **Settings → Variables and Secrets** e adiciona estes valores como **Secret** (não como texto simples):

- `GITHUB_TOKEN`: Fine-grained Personal Access Token com acesso apenas ao repositório `LMhdez/mc-start` e permissão **Actions: Read and write**.
- `ACCESS_PASSWORD`: palavra-passe aleatória com pelo menos 20 caracteres. Gera-a num gestor de palavras-passe e partilha-a com os amigos por um canal separado do link.
- `ALLOWED_ORIGIN`: apenas a origem do site, por exemplo `https://lmhdez.github.io` (sem caminho e sem barra final). Confirma a origem real do GitHub Pages antes de configurar.

Depois de adicionar ou alterar Secrets, implementa a versão do Worker.

## Endpoint

O Worker aceita pedidos POST em `/api/action` com JSON:

```json
{
  "action": "start",
  "password": "palavra-passe"
}
```

Os valores permitidos para `action` são `start`, `stop` e `status`.

O token GitHub nunca é enviado ao browser. O Worker valida a origem e a palavra-passe, e só depois inicia o workflow correspondente.

## Importante

- Não coloques nenhum Secret no repositório, no HTML ou no JavaScript.
- Não partilhes a palavra-passe nesta conversa nem a coloques no URL.
- O endpoint não permite escolher nomes de workflows, branches ou comandos arbitrários.
- O plano gratuito da Cloudflare tem limites de utilização; se forem excedidos, os pedidos podem falhar.

## Ligacao privada a VM (migracao 2026-10-31)

O Worker usa agora esta ordem:

1. Consulta o estado da VM diretamente pela API do Azure.
2. Se a VM estiver ligada, tenta consultar o agente local através de Workers VPC e Cloudflare Tunnel.
3. Se o Tunnel ou o agente ainda nao estiverem disponiveis, usa o workflow GitHub Actions antigo como alternativa.

Os botoes de ligar e desligar tentam primeiro a API do Azure. O desligamento direto pede ao agente para parar o contentor Minecraft de forma graciosa antes de desalocar a VM. Se a chamada direta falhar, o Worker usa os workflows antigos.

### Recursos ja criados na Cloudflare

- Tunnel remoto: `mc-start-vm-private`
- VPC Service: `mc-start-private-agent`
- Binding no Worker: `MC_AGENT`
- Servico local: `http://127.0.0.1:8765`

O agente so escuta em localhost. Nao abras a porta 8765 no NSG nem exponhas o agente diretamente na Internet.

### Ativar o Tunnel na VM

1. No painel Cloudflare, abre **Networks > Tunnels** e seleciona `mc-start-vm-private`.
2. Escolhe **Add a replica** e copia o token da instalacao. Nao publiques nem partilhes esse token.
3. No GitHub, abre **Settings > Secrets and variables > Actions** e cria o repository secret `CLOUDFLARE_TUNNEL_TOKEN` com esse token.
4. Em **Actions**, executa manualmente o workflow **Instalar agente privado MC**.
5. Confirma no painel Cloudflare que o Tunnel fica **Healthy** e que a replica esta ligada.

O workflow instala `cloudflared` e `vm/mc-agent.py` na VM, usando os secrets SSH e Azure que ja existem no repositorio. E uma instalacao pontual; os pedidos normais de estado deixam de precisar de iniciar GitHub Actions quando o agente estiver online.

### Alternativa e diagnostico

- Se o Tunnel estiver desligado, o Worker continua a recorrer ao workflow de estado antigo.
- Se o Azure nao aceitar a operacao direta de ligar/desligar, o Worker tenta o workflow GitHub Actions existente.
- Nao apagues os workflows antigos enquanto a nova ligacao nao tiver sido testada.
