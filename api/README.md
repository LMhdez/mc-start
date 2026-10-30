# API privada do painel Minecraft

Esta Azure Function recebe pedidos do painel e envia `repository_dispatch` para o repositório `LMhdez/mc-start`.

## Segurança

- O token do GitHub existe apenas nas Application Settings da Function App.
- O código de acesso dos amigos (`LAUNCHER_KEY`) também fica nas Application Settings.
- A página envia o código num cabeçalho HTTPS; não existe token GitHub no JavaScript.
- A origem do site é validada com `ALLOWED_ORIGIN`.
- Só são aceites as ações `start` e `stop`.
- Não são registados cabeçalhos, códigos de acesso, tokens ou conteúdo das respostas do GitHub.

O código de acesso partilhado com os amigos funciona como uma chave de acesso: qualquer pessoa que tenha o link completo poderá pedir para ligar/desligar o servidor. Partilha-o apenas com quem deve ter essa possibilidade e roda-o se for divulgado.

## Criar o token GitHub

Cria um Fine-grained personal access token em GitHub > Settings > Developer settings > Personal access tokens > Fine-grained tokens.

Configuração:
- Resource owner: a tua conta.
- Repository access: Only select repositories > `mc-start`.
- Repository permissions: Contents = Read and write.
- Expiração: escolhe uma duração curta/razoável e renova quando necessário.

Este é o nível de permissão exigido pelo endpoint Create a repository dispatch event. Não uses um token clássico com acesso a todos os repositórios.

## Configurações da Function App

Em Function App > Settings > Environment variables (ou Configuration), cria:

- `GITHUB_OWNER` = `LMhdez`
- `GITHUB_REPO` = `mc-start`
- `GITHUB_DISPATCH_TOKEN` = o fine-grained token acabado de criar
- `LAUNCHER_KEY` = código aleatório longo gerado por ti (pelo menos 32 bytes aleatórios)
- `ALLOWED_ORIGIN` = origem exata do site, por exemplo `https://teu-site.pages.dev`

Não coloques estes valores neste repositório.

## CORS

Na Function App, configura CORS para permitir apenas a origem exata do site. Não uses `*`.

## Publicação

Publica o conteúdo desta pasta como raiz da Function App (não publiques a pasta `api` como uma subpasta da aplicação). Instala as dependências com `npm install` antes de publicar.

A rota será:
`https://NOME-DA-FUNCTION.azurewebsites.net/api/control`

O endpoint usa autenticação própria com `LAUNCHER_KEY`, por isso o HTTP trigger está configurado como `anonymous`. Não significa que o pedido seja aceite sem código.

## Teste

Envia um POST com:
- Header `Content-Type: application/json`
- Header `x-launcher-key: O_MESMO_LAUNCHER_KEY`
- Body `{"action":"start"}`

Não coloques o token GitHub no pedido. A Function é que o usa do lado do servidor.

## Nota sobre o estado

A resposta HTTP 202 confirma apenas que o GitHub aceitou o evento. Não confirma que a VM já arrancou. A confirmação real continua nos logs do workflow GitHub Actions.