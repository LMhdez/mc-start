# Auditoria documental e técnica do repositório — 2026-11-03

## Âmbito

Foi enumerado o branch `main` e lidos individualmente todos os ficheiros versionados de texto, workflows, scripts, testes, configurações e documentação. O PNG foi verificado por metadata no GitHub; ficheiros binários não foram interpretados como texto.

## Correções aplicadas

- Reafirmada a política absoluta de custo zero e removida a interpretação de créditos Azure Student como autorização para recursos pagos.
- Alinhada a produção documentada com BelgiumCentral (`MC-VM-BE`, `MCServerBelgiumGroup`).
- Arquivados os planos Madrid/France que estavam apresentados como ativos.
- Atualizado o catálogo de workflows para corresponder aos ficheiros existentes no branch.
- Documentado o pipeline SVG → PNG para pré-visualização social.
- Corrigido o workflow NSG para preservar Java TCP 25565, Bedrock UDP 19132 e Bedrock TCP 19132, com frase de confirmação explícita; workflow não executado.
- O `worker.js` passou a usar `safeAzureDiagnostic()` nos erros Azure e `safeOperationalDiagnostic()` nos erros inesperados do agente/fallback. Nenhum `error.message` é emitido diretamente pelos logs operacionais revistos.
- Os testes de diagnóstico foram alinhados com o contrato HTTP 200 + estado Unknown em falha Azure e cobrem exceções confidenciais do agente privado.
- Reforçada a separação entre site GitHub Pages, Worker Cloudflare, agente privado e endereço Minecraft dinâmico.

## Ficheiros revistos sem alteração

Foram lidos `cloudflare/wrangler.toml`, `cloudflare/wrangler.test.toml`, `vm/mc-agent.py`, `index.html`, `script.js`, `status-crypto.js`, `maintenance-status.js`, `maintenance.json`, `style.css`, `favicon.svg`, `social-preview.svg`, `package.json`, `vitest.config.mjs`, restantes testes Cloudflare/UI, scripts de build e todos os workflows. Foram mantidos quando não havia erro factual/funcional demonstrável.

## Validação

- Confirmada no GitHub a existência de `social-preview.png`; metadata OG/Twitter aponta para PNG 1200×630.
- GitHub Actions Validate project [41743225155](https://github.com/LMhdez/mc-start/actions/runs/41743225155): **success** — sintaxe JS, testes Cloudflare, Wrangler dry-run, smoke tests públicos, Python e YAML/shell de todos os workflows.
- GitHub Pages build/deployment [41743224895](https://github.com/LMhdez/mc-start/actions/runs/41743224895): **success**.
- Um run anterior falhou porque quatro testes esperavam HTTP 503, enquanto o endpoint degrada para HTTP 200 com estado Unknown; os testes foram corrigidos para o contrato atual e a execução seguinte passou.
- PR #78 foi merged em 2026-11-03 às 23:12 UTC. O código e o follow-up de redaction estão em `main`; **não foi feito deploy do Worker**.
- Não foram executados workflows mutáveis, deploy do Worker, comandos Azure, alterações de NSG, operações de VM ou comandos Minecraft.
- Não foram consultados nem apresentados valores de secrets.
- Esta auditoria não é uma validação end-to-end de login Java/Bedrock nem do painel num browser real.

## Política

Free Tier efetivo apenas. Custo máximo permitido 0,00 € / $0,00. Não consumir créditos para serviços pagos, não ativar Pay-As-You-Go e não criar recursos faturáveis.


## Follow-up documental — 2026-11-04

- Confirmada a consistência dos READMEs raiz, GitHub Actions, Cloudflare, scripts, testes e VM com a produção documentada em BelgiumCentral.
- Acrescentada nota explícita: a VM documentada usa `Standard_B2als_v2`, que não deve ser presumido Free Tier. Billing não foi consultado e não foi autorizada qualquer operação de compute faturável.
- Reconfirmado que a PR #78 e o follow-up de redaction estão em `main`, mas não houve deploy do Worker.
- Nenhum workflow mutável, deploy, comando Azure ou operação na VM foi executado nesta revisão.
