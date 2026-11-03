# Cloudflare — Worker, bindings, agente e operação

Este diretório contém o código do Worker `mc-start-control`, a configuração Wrangler e o runbook de publicação. O site estático vive na raiz do repositório e é publicado por GitHub Pages; o Worker é a API de controlo, não o endereço do servidor Minecraft.

## Componentes

- `worker.js`: endpoints públicos/privados, autenticação, Azure ARM, fallback GitHub Actions, agente VPC, cache e armazenamento temporário cifrado.
- `wrangler.toml`: configuração de produção, bindings e migrations. Fonte declarativa; não editar IDs/bindings sem comparar com o estado real.
- `wrangler.test.toml`: configuração isolada para testes. **Nunca usar para deploy.**
- `DEPLOYMENT-RUNBOOK.md`: estado conhecido, validação, gates de publicação e rollback.

## Arquitetura

- Website → Worker → Azure ARM / GitHub Actions / agente privado via VPC.
- Agente privado na VM → apenas ligação privada, nunca expor a porta 8765.
- R2 privado para fotografia técnica; Durable Object SQLite para orçamento/estado temporário cifrado; KV mantém compatibilidade/migração legada conforme implementação atual.
- O estado privado é desencriptado no browser; não mover trabalho criptográfico pesado para o Worker Free sem medir CPU.

## Estado público e manutenção do website

O estado público do servidor continua a ser consultado por `GET /api/public/status`. O frontend combina essa resposta com `maintenance.json`, publicado no GitHub Pages e controlado pelo workflow `.github/workflows/toggle-maintenance.yml`. O modo de manutenção não é um estado do Worker nem uma operação Minecraft: não altera Azure, não bloqueia jogadores e não exige deploy do Worker. Se a API pública falhar, o frontend apresenta `Estado indisponível` em vez de conservar um estado online antigo.

## Endpoints e contratos

Consultar o router e validações atuais em `worker.js` antes de usar endpoints; não assumir que esta lista é exaustiva nem que o contrato não mudou. A API pública não deve revelar IP privado, credenciais, nomes de jogadores ou dados de mundo. A autenticação não pode depender apenas de `Origin`.

## Bindings e secrets

Wrangler declara bindings, não autoriza divulgar valores secretos. Nunca ler, imprimir, copiar ou colocar em commits/logs os valores de secrets. Não substituir um binding Secret por texto simples. Confirmar a existência de bindings apenas por metadata. Não listar outputs que possam conter tokens.

## Testes e deploy

- Testes locais: `npm run test:cloudflare` na raiz do repo.
- A configuração `wrangler.test.toml` é isolada e não deve ser usada em deploy.
- O deploy do Worker é manual e separado do deploy do agente. Ler integralmente `DEPLOYMENT-RUNBOOK.md`, validar testes, diff, bindings, migrations, rollback e plano Free antes de publicar.
- Não executar `wrangler deploy` como consequência automática de editar este diretório.
- Não ativar Workers Paid, R2 Infrequent Access, add-ons, trials ou funcionalidades faturáveis.

## Limites e segurança

- Rate limits em memória por isolate não são um bloqueio global.
- Os limites R2 implementados no Durable Object não são um hard spending cap global da conta.
- Monitorizar quotas/uso no Dashboard sem ativar upgrades; custo permitido pelo projeto: **0,00 €**.
- Redigir logs antes de partilhar; nunca publicar secrets, endereços privados, dados de jogadores ou payloads cifrados.
- Se o agente VPC não estiver disponível, seguir fallback documentado; nunca expor a porta do agente publicamente como workaround.
