# MC SERVER — Runbook de publicação controlada do Worker

**Estado:** preparação apenas. Este documento não autoriza nem executa merge, deploy, alterações no Dashboard ou alterações de billing.

## 1. Estado verificado em 2026-11-01

- PR #27: aberto, Draft, não merged.
- Branch: `fix/cloudflare-kv-write-amplification`.
- Head verificado: `d2400697d3cef9c9b8eaae7cc8cd303f05850658`.
- CI #41306538394: concluído com sucesso; job `validate` passou.
- Worker de produção: `mc-start-control`.
- Configuração ativa: `usage_model = "standard"`, `compatibility_date = "2026-10-30"`.
- Bindings atuais: os 9 secrets existentes e os bindings `STATUS_KV`, `TECHNICAL_BUCKET` e `MC_AGENT`. A auditoria consultou apenas metadata; nenhum valor secreto foi lido.
- O binding `R2_BUDGET` ainda não existe em produção.
- `workers.dev` está ativo; previews estão desativados.
- A API de Worker Domains devolveu zero domínios personalizados.
- A listagem de Worker Routes por zona continua por confirmar: a auditoria anterior não conseguiu enumerar zonas ativas. Não assumir que não existem routes.
- Foram encontradas 10 deployments anteriores. A mais recente observada foi criada em 2026-11-01 via Dashboard.
- Não foi feito deploy nem qualquer alteração à configuração de produção.

## 2. Riscos e decisões antes de publicar

### 2.1 Wrangler passa a ser a fonte de verdade para bindings

O ficheiro `cloudflare/wrangler.toml` declara os bindings existentes de KV, R2 e VPC, mais o novo Durable Object. As bindings não são herdadas automaticamente entre ambientes e a configuração do Worker deve ser tratada como fonte de verdade.

Antes de publicar, comparar novamente o conjunto completo de bindings ativos com o TOML. Se aparecer qualquer binding novo ou não representado, parar e atualizar a configuração antes do deploy.

A configuração não contém valores de secrets. A documentação Cloudflare indica que os secrets existentes não são eliminados por um deploy, mesmo sem `--keep-vars`; secrets omitidos de um ficheiro de secrets também são preservados. Não criar um ficheiro de secrets nem executar `wrangler secret bulk` para esta publicação.

`keep_vars`/ `--keep-vars` aplica-se a variáveis simples configuradas no Dashboard, não é uma solução para preservar bindings. Não adicionar variáveis simples para dados sensíveis.

### 2.2 Primeiro deploy de R2Budget

A primeira publicação com `[exports.R2Budget]` provisiona um namespace SQLite novo. O formato declarativo `exports` é mutuamente exclusivo com o fluxo legado `migrations`; não voltar a introduzir `migrations` depois de publicar com `exports`.

**Atenção ao rollback:** Cloudflare documenta que um rollback para uma versão anterior pode ser bloqueado quando ocorreu uma alteração ao ciclo de vida de uma classe Durable Object entre a versão ativa e a versão de destino. Como esta publicação introduz a classe `R2Budget`, não assumir que será possível voltar diretamente à versão anterior do Worker. Preparar uma correção para a frente que mantenha o binding e a declaração `exports.R2Budget`. Não apagar nem renomear a classe para tentar reverter o código.

O rollback de uma versão também não reverte o estado de recursos externos como KV, R2 ou Durable Objects.

### 2.3 Free Tier

- Não alterar o plano, método de pagamento, billing, usage model ou funcionalidades pagas.
- Manter `usage_model = "standard"`.
- Não ativar Workers Paid, R2 Infrequent Access, domínios públicos, `r2.dev`, Logpush ou serviços pagos.
- Os limites R2 implementados são um orçamento interno deste Worker, não um limite de despesa da conta.
- Se o Dashboard indicar que a operação exige upgrade, pagamento ou ativação de um produto pago, cancelar o procedimento.

## 3. Preflight — só leitura e testes locais

Executar a partir de uma cópia limpa do repositório, na branch que foi aprovada para publicação. Não colar outputs que contenham credenciais, tokens, IDs privados ou variáveis de ambiente.

1. Confirmar que a branch e o commit são os esperados:
   ```sh
   git status --short
   git rev-parse HEAD
   ```
2. Confirmar que o commit publicado é o head aprovado do PR e que o CI correspondente está verde.
3. Instalar dependências e executar testes locais:
   ```sh
   npm ci
   npm run test:cloudflare
   ```
4. Validar o bundle/configuração sem publicar:
   ```sh
   npx wrangler deploy --config cloudflare/wrangler.toml --dry-run
   ```
5. Se qualquer comando pedir para criar recursos, ativar billing ou mudar para um plano pago, responder não/cancelar.
6. Confirmar manualmente no Dashboard, sem alterar nada:
   - plano continua Free;
   - `usage_model` continua `standard`;
   - bindings ativos continuam a corresponder ao TOML;
   - os 9 secrets continuam presentes (confirmar apenas nomes/metadata; nunca valores);
   - `workers.dev` continua ativo;
   - domains e routes atuais foram identificados;
   - bucket R2 continua Standard e privado;
   - não existem alterações inesperadas ao Worker desde a auditoria.

**Bloqueio atual:** não publicar enquanto as Worker Routes não forem verificadas ou enquanto houver divergência entre os bindings ativos e o TOML.

## 4. Registo de backup antes do deploy

Antes de qualquer publicação autorizada:

1. No Dashboard, abrir **Workers & Pages → mc-start-control → Deployments**.
2. Registar o ID da deployment ativa, o ID da versão associada, data/hora e percentagem de tráfego.
3. Guardar uma cópia local segura da configuração atual e do código da versão ativa, sem exportar valores de secrets. Não colocar essa cópia no Git.
4. Registar a metadata dos bindings e triggers/domínios/routes atuais. Redigir todos os IDs privados se o registo sair do ambiente seguro.
5. Confirmar que existe acesso ao Dashboard para observar a deployment e, se possível, criar uma nova versão corretiva.

Não usar um dump de settings com valores secretos como backup. Não copiar secrets para ficheiros, terminal, issue ou PR.

## 5. Publicação — requer autorização explícita separada

**Não executar esta secção sem autorização explícita para publicar em produção.** O merge do PR e o deploy são decisões separadas.

Depois de o PR ser revisto e merged, confirmar que `main` contém exatamente o commit aprovado e repetir os passos de preflight. Só então, com autorização explícita, executar:

```sh
npx wrangler deploy --config cloudflare/wrangler.toml
```

Não executar `wrangler deploy` a partir de `cloudflare/wrangler.test.toml`. Esse ficheiro é exclusivamente para Vitest/Miniflare e aponta para um bucket de testes.

Não fornecer secrets em argumentos de linha de comandos. Não usar `--secrets-file`. Não executar `wrangler secret bulk`, `wrangler secret put`, comandos de billing ou comandos de criação manual de recursos.

## 6. Verificações imediatamente após publicação

Sem imprimir payloads sensíveis:

1. Confirmar no Dashboard que a nova deployment está ativa e recebe 100% do tráfego.
2. Confirmar que os bindings `STATUS_KV`, `TECHNICAL_BUCKET`, `MC_AGENT` e `R2_BUDGET` existem e apontam para os recursos esperados.
3. Confirmar que os 9 secrets continuam presentes por metadata, sem consultar valores.
4. Confirmar que `usage_model` continua `standard`, `compatibility_date` continua `2026-10-30`, `workers.dev` continua ativo e routes/domínios não foram alterados.
5. Testar os endpoints públicos:
   - `GET /api/public/status`
   - `GET /api/technical`
6. Fazer um teste privado controlado de `/api/action` com a ação `status`, e acompanhar `/api/status/read`. Não executar `start` ou `stop` como teste.
7. Confirmar que o inventário técnico é servido e que a persistência R2 funciona; se R2 falhar, confirmar que o fallback não expõe informação privada nem contorna o orçamento.
8. Verificar logs apenas com filtros e redação. Nunca mostrar tokens, passwords, cabeçalhos de autorização, IDs de sessão ou payloads privados.
9. Rever métricas R2 e Durable Objects no Dashboard. Não ativar funcionalidades pagas para obter métricas.

Se qualquer verificação falhar, parar os testes e não atualizar o agente privado nem fazer outras alterações de produção.

## 7. Recuperação em caso de falha

- Não assumir que `wrangler rollback` para a versão anterior é permitido: a introdução de `R2Budget` altera o ciclo de vida de Durable Objects.
- Não remover `R2_BUDGET` nem `exports.R2Budget` como tentativa de rollback.
- A estratégia segura prevista é uma nova versão corretiva que mantenha a classe, o binding e o armazenamento SQLite declarados, corrigindo o código do Worker. Esta correção deve ser testada e autorizada antes de publicar.
- Não apagar o namespace Durable Object, o bucket R2, o objeto técnico, o KV ou os secrets.
- Se houver falha de disponibilidade, interromper as ações administrativas do painel e preservar a VM/Minecraft; não executar ações de start/stop em cadeia.
- Documentar a falha sem incluir dados confidenciais e rever os contadores R2/DO antes de repetir pedidos.

## 8. Critério para considerar a publicação concluída

Só considerar concluído quando os testes pós-deploy passarem, os bindings/secrets e triggers estiverem preservados, o plano permanecer Free/Standard, os endpoints públicos e o fluxo privado de estado funcionarem e não houver consumo inesperado de R2/DO.

## Referências oficiais

- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Wrangler deploy command](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
- [Durable Object class exports](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)
- [Workers versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/)
- [Workers rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
