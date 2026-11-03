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

- A causa do 503 ficou corrigida por RBAC.
- Não foi alterado `worker.js`, `wrangler.toml`, frontend, secrets, bindings, Azure VM, rede, Docker ou Minecraft.
- Não foi feito merge nem deploy de código para esta correção.
- O Service Principal recebeu `Reader`, não `Contributor` nem `Owner`, e apenas no scope da VM.
- A Managed Identity da VM e o seu role `MC Server Contributor Plus` são independentes desta identidade e desta atribuição.

## PR de diagnósticos adicionais

A [PR #78](https://github.com/LMhdez/mc-start/pull/78) continua **OPEN**, sem merge e sem deploy. Propõe Workers Logs com códigos HTTP/Azure allowlisted e testes para garantir redaction de descrições e valores sensíveis. Como o problema foi resolvido por RBAC, a necessidade desses diagnósticos adicionais fica por decidir.

- Manter a PR aberta até decisão explícita.
- Não fazer merge/deploy automaticamente.
- Qualquer uso de observability deve continuar limitado às funcionalidades Free; não ativar add-ons ou serviços pagos.

## Validação ainda pendente

- O endpoint público `/api/public/status` foi confirmado com HTTP 200 após a correção.
- A confirmação visual do carregamento do GitHub Pages e o teste da ação autenticada «Mostrar endereço» ainda precisam de ser feitos num browser normal.
- Não confundir o sucesso do endpoint de status com uma validação end-to-end de login Java/Bedrock ou das operações start/stop.

## Segurança

- Nunca consultar ou imprimir valores de Cloudflare secrets, tokens OAuth/ARM, headers de autenticação, IDs de subscrição/tenant/principal ou IP público.
- Em testes, apresentar apenas HTTP status e campos explicitamente allowlisted.
- Não ampliar RBAC como workaround se o endpoint voltar a falhar; verificar primeiro a identidade e o scope exatos.
