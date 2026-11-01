# MC SERVER — Runbook de publicação controlada do Worker

**Estado:** PR #27 merged em 2026-11-01. Preparação de publicação apenas; este documento não autoriza nem executa deploy, alterações no Dashboard ou alterações de billing.

## 1. Estado verificado em 2026-11-01

- PR #27: merged e fechado através de squash.
- Commit de merge em `main`: `4c5eeb40b96571c7834a81a75b457de83c44c54b`.
- Último commit de código do PR: `9e268325248ff203c51d61ac035d59bcb8ba6a69`.
- CI do PR #41307451514: sucesso; CI pós-merge #41307597369: sucesso.
- GitHub Pages build/deploy #41307596601: sucesso.
- Worker de produção: `mc-start-control`.
- Auditoria read-only da configuração ativa (2026-11-01): `usage_model = "standard"`, `compatibility_date = "2026-10-30"`, `default_usage_model = "standard"`.
- **Plano confirmado visualmente:** o Dashboard mostrou **Workers Free — Active** durante a auditoria de 2026-11-01. O campo API `usage_model = "standard"` não foi usado isoladamente para contrariar essa confirmação nem para concluir que existe uma subscrição Workers Paid. A API de Billing devolveu 403, pelo que não foi possível fazer uma verificação independente da faturação por API. Não alterar o plano nem o modelo de utilização.
- **Fotografia histórica das 10:23 UTC:** a versão 45, publicada pelo Dashboard, apenas acrescentou o binding `TECHNICAL_BUCKET`; nessa altura, o PR #27 ainda não tinha sido merged. Esta fotografia não representa a configuração ativa posterior.
- **Estado posterior confirmado read-only:** foi observada uma deployment mais recente às 15:36:41 UTC, a receber 100% do tráfego. A configuração ativa nessa auditoria já incluía `R2_BUDGET` e o namespace `R2Budget`. Não inferir, apenas a partir desta observação, que o PR #32 foi publicado: o PR #32 continua a ser uma alteração separada e não deve ser considerado merged/deployed sem nova verificação.
- **Auditoria read-only posterior (2026-11-01, deployment mais recente observada às 15:36:41 UTC):** o Worker `mc-start-control` tem os bindings `STATUS_KV`, `TECHNICAL_BUCKET`, `MC_AGENT` e `R2_BUDGET`. O binding `R2_BUDGET` aponta para a classe `R2Budget`, e o namespace Durable Object SQLite correspondente existe e está associado ao Worker. A deployment mais recente observada recebia 100% do tráfego.
- A auditoria confirmou apenas metadata de bindings e deployments. Foram confirmados 9 secrets por metadata, sem consultar ou imprimir valores. Não publicar IDs de namespaces, KV, VPC, deployments ou outros identificadores internos neste runbook.
- `workers.dev` está ativo; previews estão desativados.
- A API devolveu zero domínios personalizados do Worker, zero zonas acessíveis nesta conta e zero custom domains do bucket R2. O domínio gerido `r2.dev` está desativado.
- O bucket `mc-start-technical` existe em região WEUR e classe Standard, privado, sem domínio público ou `r2.dev`.
- A listagem read-only do bucket não devolveu objetos; isto sugere bucket vazio, mas não é extrato de faturação nem prova de zero operações faturáveis.
- A chave KV `technical:public` existe no namespace de estado; o valor não foi lido. O snapshot ainda não foi migrado para R2.
- Foram observadas 10 deployments; a mais recente estava a receber 100% do tráfego no momento da auditoria.
- **Na auditoria inicial das 10:23 UTC**, ainda não tinha sido publicado o código do PR #27. Na auditoria read-only posterior, não foram feitas alterações ao plano, billing, bindings ou deployments: apenas foi consultada a configuração já existente.
- A auditoria read-only de Observability encontrou, nas últimas 24 horas, 9 eventos de erro em `GET /api/public/status`, todos com a mensagem `Rate limit storage unavailable: KV put() limit exceeded for the day.`. Isto é compatível com a versão pré-PR #27 ainda tentar guardar o rate limiter no KV e atingir o limite diário de escritas.
- Foi executado um teste isolado temporário no runtime Workers Free, sem bindings ou secrets de produção, reproduzindo a sequência criptográfica antiga de `decryptStatus()`. O Analytics GraphQL registou 2 invocações, CPU P50 = 19 199 µs e P99 = 20 523 µs. Esta medição histórica identificou que PBKDF2 no Worker excedia o limite nominal Free de 10 ms. A alteração proposta nesta branch remove PBKDF2 do Worker: o endpoint autenticado devolve o envelope cifrado e o navegador desencripta-o com WebCrypto, mantendo as 100 000 iterações e AES-256-GCM. A medição antiga deixa, portanto, de representar o caminho de leitura proposto; a validação automática desta alteração e a confirmação pós-publicação continuam obrigatórias.
- A tentativa de definir explicitamente `limits.cpu_ms` foi rejeitada pela API por não ser suportada no plano Free; não foi ativado Workers Paid. O teste foi removido após a medição e o seu endpoint `workers.dev` foi desativado.
- A verificação local `wrangler deploy --dry-run` permanece pendente: o ambiente de trabalho não conseguiu clonar o repositório devido a falha de resolução DNS do GitHub. O CI atual não executa esse dry-run.

## 2. Riscos e decisões antes de publicar

### 2.1 Wrangler passa a ser a fonte de verdade para bindings

O ficheiro `cloudflare/wrangler.toml` declara os bindings existentes de KV, R2 e VPC, mais o novo Durable Object. As bindings não são herdadas automaticamente entre ambientes e a configuração do Worker deve ser tratada como fonte de verdade.

Antes de publicar, comparar novamente o conjunto completo de bindings ativos com o TOML. Se aparecer qualquer binding novo ou não representado, parar e atualizar a configuração antes do deploy.

A configuração não contém valores de secrets. A documentação Cloudflare indica que os secrets existentes não são eliminados por um deploy, mesmo sem `--keep-vars`; secrets omitidos de um ficheiro de secrets também são preservados. Não criar um ficheiro de secrets nem executar `wrangler secret bulk` para esta publicação.

`keep_vars`/ `--keep-vars` aplica-se a variáveis simples configuradas no Dashboard, não é uma solução para preservar bindings. Não adicionar variáveis simples para dados sensíveis.

### 2.2 Primeiro deploy de R2Budget

A publicação que introduziu `[exports.R2Budget]` provisionou o namespace SQLite, que já foi confirmado na auditoria read-only posterior de 2026-11-01. Em publicações futuras, preservar a classe e o binding existentes. O formato declarativo `exports` é mutuamente exclusivo com o fluxo legado `migrations`; não voltar a introduzir `migrations` depois de publicar com `exports`.

**Atenção ao rollback:** Cloudflare documenta que um rollback para uma versão anterior pode ser bloqueado quando ocorreu uma alteração ao ciclo de vida de uma classe Durable Object entre a versão ativa e a versão de destino. Como esta publicação introduz a classe `R2Budget`, não assumir que será possível voltar diretamente à versão anterior do Worker. Preparar uma correção para a frente que mantenha o binding e a declaração `exports.R2Budget`. Não apagar nem renomear a classe para tentar reverter o código.

O rollback de uma versão também não reverte o estado de recursos externos como KV, R2 ou Durable Objects.

### 2.3 Free Tier — bloqueio obrigatório

- O Dashboard confirmou **Workers Free — Active** em 2026-11-01. A API de Billing não permitiu uma verificação independente (403); não inferir o plano apenas a partir de `usage_model = "standard"`.
- Workers Free tem limite nominal de 10 ms de CPU por pedido. A implementação anterior executava PBKDF2-SHA256 (100 000 iterações) em `/api/status/read`, o que excedia esse limite na medição isolada descrita acima.
- **Solução nesta branch:** o Worker autentica a palavra-passe e devolve o envelope cifrado já existente. O navegador executa PBKDF2-SHA256 (100 000 iterações) e AES-256-GCM com WebCrypto. Não se reduzem iterações, não se altera a cifra, não se adiciona um Worker Secret e não se introduz qualquer serviço/consumo KV/R2. O formato do envelope mantém-se compatível com resultados já guardados no TTL de 5 minutos.
- O caminho do Worker passa a fazer apenas validação do envelope JSON e leitura KV; não deriva chaves nem desencripta payloads. Os testes da branch devem confirmar que o endpoint devolve o envelope sem plaintext e que o navegador consegue desencriptar fixtures compatíveis e rejeitar ciphertext adulterado.
- A documentação Cloudflare descreve flexibilidade para ultrapassagens infrequentes do limite; isto não é uma garantia para pedidos regulares. Fonte: https://developers.cloudflare.com/workers/platform/limits/ (limite Free de 10 ms e flexibilidade para ultrapassagens ocasionais).
- **Bloqueio anterior resolvido no código, ainda sujeito a CI e revisão:** PBKDF2 deixa de ser executado no Worker. Não reduzir iterações, não aumentar CPU, não alterar usage model e não ativar Workers Paid.
- O teste isolado foi eliminado após a medição; o subdomínio `workers.dev` específico do teste foi desativado. Não ficaram secrets, bindings, rotas ou recursos de teste ativos.
- Não alterar plano, método de pagamento, billing, usage model ou funcionalidades pagas neste procedimento.
- Não executar qualquer ação de upgrade/downgrade, ativação, trial, top-up ou subscription.
- Não ativar R2 Infrequent Access, domínios públicos, `r2.dev`, Logpush ou serviços pagos.
- O orçamento R2 no Worker é um limite interno e não um limite de despesa da conta.
- Se o Dashboard indicar que o procedimento exige pagamento, upgrade ou ativação de um produto pago, cancelar.

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
   npm install --legacy-peer-deps --no-audit --no-fund
   npm run test:cloudflare
   ```
   Nota: `package-lock.json` não existe em `main`; por isso, `npm ci` não é utilizável. A ausência do lockfile significa que as dependências transitivas não ficam totalmente fixadas. Recomenda-se adicionar e versionar um lockfile antes de considerar a validação reprodutível. O CI passou, mas não executa `wrangler deploy --dry-run`.
4. Validar o bundle/configuração sem publicar:
   ```sh
   npx wrangler deploy --config cloudflare/wrangler.toml --dry-run
   ```
5. Se qualquer comando pedir para criar recursos, ativar billing ou mudar para um plano pago, responder não/cancelar.
6. Confirmar manualmente no Dashboard, sem alterar nada:
   - plano está explicitamente em Workers Free e não existe Workers Paid ativo;
   - o Dashboard continua a indicar Workers Free — Active; não alterar o modelo de utilização;
   - bindings ativos continuam a corresponder ao TOML;
   - os 9 secrets continuam presentes (confirmar apenas nomes/metadata; nunca valores);
   - `workers.dev` continua ativo;
   - domains e routes atuais foram identificados;
   - bucket R2 continua Standard e privado;
   - não existem alterações inesperadas ao Worker desde a auditoria.

**Bloqueios ativos:** (1) CI e testes da alteração de desencriptação no navegador; (2) executar e aprovar `wrangler deploy --dry-run` a partir de checkout limpo; (3) confirmar novamente bindings, secrets, triggers e domínios imediatamente antes do deploy. O CI verde não substitui estas verificações. A publicação continua separada e não é executada por esta branch/PR.

## 4. Registo de backup antes do deploy

Antes de qualquer publicação autorizada:

1. No Dashboard, abrir **Workers & Pages → mc-start-control → Deployments**.
2. Registar o ID da deployment ativa, o ID da versão associada, data/hora e percentagem de tráfego.
3. Guardar uma cópia local segura da configuração atual e do código da versão ativa, sem exportar valores de secrets. Não colocar essa cópia no Git.
4. Registar a metadata dos bindings e triggers/domínios/routes atuais. Redigir todos os IDs privados se o registo sair do ambiente seguro.
5. Confirmar que existe acesso ao Dashboard para observar a deployment e, se possível, criar uma nova versão corretiva.

Não usar um dump de settings com valores secretos como backup. Não copiar secrets para ficheiros, terminal, issue ou PR.

## 5. Publicação — requer autorização explícita separada

**Autorização explícita para publicar em produção recebida nesta conversa em 2026-11-01.** A autorização não dispensa os bloqueios técnicos e de Free Tier descritos neste runbook. O merge do PR e o deploy são decisões separadas.

O PR #27 já está merged e a auditoria read-only posterior confirmou uma deployment mais recente com `R2_BUDGET` ativo. Isto não equivale a autorização para uma nova publicação. Antes de qualquer deploy futuro, identificar exatamente o PR/commit aprovado, confirmar que `main` o contém e repetir todos os passos de preflight. Só depois de os bloqueios Free Tier estarem resolvidos e de existir autorização explícita para essa publicação, executar:

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
4. Confirmar que o plano continua Workers Free (não Workers Paid), que não houve qualquer alteração de billing, que a configuração de utilização está no estado Free permitido, `compatibility_date` continua `2026-10-30`, `workers.dev` continua ativo e routes/domínios não foram alterados.
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

Só considerar concluído quando os testes pós-deploy passarem, os bindings/secrets e triggers estiverem preservados, Workers Free estiver confirmado sem Workers Paid ou custos adicionais, os endpoints públicos e o fluxo privado de estado funcionarem e não houver consumo inesperado de R2/DO.

## Referências oficiais

- [Workers pricing and Free/Paid plan distinction](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers platform limits, including CPU time](https://developers.cloudflare.com/workers/platform/limits/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Wrangler deploy command](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
- [Durable Object class exports](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)
- [Workers versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/)
- [Workers rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
