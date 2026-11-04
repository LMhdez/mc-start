# Worker `/api/public/status` — incidente 503 e resolução RBAC

**Data:** 2026-11-03  
**Estado:** resolvido por Azure RBAC; sem alteração de código ou deploy.  
**Produção:** Azure BelgiumCentral; VM `MC-VM-BE`.

## Resumo

O endpoint público do Worker `mc-start-control`, `GET /api/public/status`, devolvia HTTP 503. A causa foi a ausência de uma atribuição RBAC de leitura para o Service Principal utilizado pelo Worker. A correção foi conceder apenas `Reader` (Built-in) diretamente no scope da VM.

## Diagnóstico e correção

1. O Worker autentica no Microsoft Entra ID com o seu Service Principal e consulta Azure Resource Manager. Não utiliza a Managed Identity system-assigned da VM.
2. A verificação de acesso no Azure Portal mostrou zero atribuições RBAC para o Service Principal no recurso VM antes da correção.
3. Foi atribuída a função `Reader` (Built-in) ao Service Principal `mc-start-status-reader`, com scope restrito à VM `MC-VM-BE`.
4. Após a atribuição, o teste a `/api/public/status`, incluindo o Origin permitido do GitHub Pages, devolveu HTTP 200.
5. O payload foi filtrado antes de ser apresentado: VM `running`, Docker `active`, contentor `running`.

## Impacto e alterações

- A causa do 503 ficou corrigida por RBAC. A PR #78 foi posteriormente merged, mas não foi publicada no Worker de produção.
- Não foi alterado `worker.js`, `wrangler.toml`, frontend, secrets, bindings, Azure VM, rede, Docker ou Minecraft.
- Não foi feito merge nem deploy de código para esta correção.
- O Service Principal recebeu `Reader`, não `Contributor` nem `Owner`, e apenas no scope da VM.
- A Managed Identity da VM e o seu role `MC Server Contributor Plus` são independentes desta identidade e desta atribuição.

## PR de diagnósticos adicionais

A [PR #78](https://github.com/LMhdez/mc-start/pull/78) foi **merged em 2026-11-03 às 23:12 UTC** (merge commit `d2d3361`). A alteração adiciona diagnóstico sanitizado e testes de redaction, mantendo-se dentro das funcionalidades Workers Free conforme a descrição da PR. O merge não fez deploy do Worker; a publicação continua manual e separada. A correção do incidente de produção continua a ser RBAC Reader, não o código da PR.

- PR #78: merged; não assumir que o código novo está deployed.
- Não executar deploy como consequência do merge.
- Manter Free Tier; não ativar add-ons, upgrades ou serviços pagos.

## Validação ainda pendente

- O endpoint público `/api/public/status` foi confirmado com HTTP 200 após a correção.
- A confirmação visual do carregamento do GitHub Pages e o teste da ação autenticada «Mostrar endereço» ainda precisam de ser feitos num browser normal.
- Não confundir o sucesso do endpoint de status com uma validação end-to-end de login Java/Bedrock ou das operações start/stop.

## Segurança

- Nunca consultar ou imprimir valores de Cloudflare secrets, tokens OAuth/ARM, headers de autenticação, IDs de subscrição/tenant/principal ou IP público.
- Em testes, apresentar apenas HTTP status e campos explicitamente allowlisted.
- Não ampliar RBAC como workaround se o endpoint voltar a falhar; verificar primeiro a identidade e o scope exatos.


## Follow-up — sanitized diagnostics code (2026-11-03)

- PR #78 was merged at 23:12 UTC (merge commit `d2d3361`); this did not deploy the Worker.
- A follow-up review found raw exception messages in Azure/agent/fallback error logs. `worker.js` now uses allowlisted Azure diagnostics and a generic `Unexpected internal error` for unexpected operational exceptions. No raw exception message is logged in these paths.
- Tests cover OAuth/ARM descriptions, malformed codes, unexpected fetch exceptions and private-agent exceptions containing confidential fixture text.
- Validation: [Validate project #41743225155](https://github.com/LMhdez/mc-start/actions/runs/41743225155) passed; [GitHub Pages #41743224895](https://github.com/LMhdez/mc-start/actions/runs/41743224895) passed. No Worker production deploy was performed.
