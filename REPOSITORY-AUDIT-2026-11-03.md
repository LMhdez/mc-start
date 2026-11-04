# Auditoria documental e técnica do repositório — 2026-11-03

## Âmbito

Foi enumerado o branch `main` e lidos individualmente todos os ficheiros versionados de texto, workflows, scripts, testes, configurações e documentação. O PNG foi verificado por metadata no GitHub; ficheiros binários não foram interpretados como texto.

## Correções aplicadas

- Atualizada a política financeira para permitir usar créditos Azure for Students em compute Azure pago deliberadamente escolhido pela relação custo/desempenho, mantendo despesa pessoal em 0,00 € / $0,00.
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
- GitHub Actions Validate project [41781032284](https://github.com/LMhdez/mc-start/actions/runs/41781032284): job Validate project passou.
- GitHub Pages build/deployment [41781032190](https://github.com/LMhdez/mc-start/actions/runs/41781032190): build e report-build-status passaram; deployment estava `in_progress` na última consulta. Não afirmar conclusão sem nova verificação.
- PR #78 foi merged em 2026-11-03 às 23:12 UTC. O código e o follow-up de redaction estão em `main`; **não foi feito deploy do Worker**.
- Não foram executados workflows mutáveis, deploy do Worker, comandos Azure, alterações de NSG, operações de VM ou comandos Minecraft.
- Não foram consultados nem apresentados valores de secrets.
- Esta auditoria não é uma validação end-to-end de login Java/Bedrock nem do painel num browser real.

## Política

O projeto pode consumir créditos Azure for Students em recursos Azure pagos quando forem necessários e representarem a melhor relação custo/desempenho viável. O objetivo é despesa pessoal de 0,00 € / $0,00; créditos Student não são Free Tier. Antes de alterações faturáveis, confirmar preço, consumo estimado, saldo e validade. Não ativar Pay-As-You-Go nem aceitar cobrança pessoal sem autorização explícita.

## Follow-up documental — 2026-11-04

- Confirmada a consistência dos READMEs raiz, GitHub Actions, Cloudflare, scripts, testes e VM com a produção documentada em BelgiumCentral.
- Corrigida a política financeira em README, VM, Cloudflare, scripts e auditoria: a VM paga é uma decisão deliberada suportada pelos créditos Azure Student; não é apresentada como Free Tier nem como incompatível com o objetivo de custo pessoal zero.
- Reconfirmado que a PR #78 e o follow-up de redaction estão em `main`, mas sem deploy do Worker.
- Nenhum workflow mutável, deploy, comando Azure ou operação na VM foi executado nesta revisão.
## Follow-up — uniformização da política financeira (2026-11-04)

- Corrigidas as últimas instruções contraditórias em `.github/README.md`, `.github/workflows/README.md`, nos planos arquivados Madrid/France e no registo do incidente Cloudflare Worker 503.
- A automação Azure pode iniciar compute pago suportado por créditos Azure for Students após preflight de preço, consumo estimado, saldo e validade, mantendo despesa pessoal em 0,00 € / $0,00; exige autorização explícita para a operação concreta.
- A política Cloudflare Workers Free permanece separada: os créditos Azure Student não cobrem faturação Cloudflare nem runners/serviços externos.
- Nenhum workflow foi executado; nenhuma VM, rede, serviço ou Worker foi alterado.
