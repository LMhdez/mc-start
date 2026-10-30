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
