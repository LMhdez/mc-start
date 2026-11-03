# Auditoria documental e técnica do repositório — 2026-11-03

## Âmbito

Foi enumerado o branch `main` e lidos individualmente todos os ficheiros versionados de texto, workflows, scripts, testes, configurações e documentação. O PNG foi verificado por metadata no GitHub; ficheiros binários não foram interpretados como texto.

## Correções aplicadas nesta revisão

- Reafirmada a política absoluta de custo zero e removida a interpretação de créditos Azure Student como autorização para recursos pagos.
- Alinhada a produção documentada com BelgiumCentral (`MC-VM-BE`, `MCServerBelgiumGroup`).
- Arquivados os planos Madrid/France que estavam apresentados como ativos.
- Atualizado o catálogo de workflows para corresponder aos ficheiros existentes no branch.
- Documentado o pipeline SVG → PNG para pré-visualização social.
- Reforçada a separação entre site GitHub Pages, Worker Cloudflare, agente privado e endereço Minecraft dinâmico.
- Mantida a regra de nunca expor IPs, secrets, RCON, dados de jogadores ou mundo.

## Ficheiros revistos sem alteração funcional

Foram lidos: `cloudflare/worker.js`, `cloudflare/wrangler.toml`, `cloudflare/wrangler.test.toml`, `vm/mc-agent.py`, `index.html`, `script.js`, `status-crypto.js`, `maintenance-status.js`, `maintenance.json`, `style.css`, `favicon.svg`, `social-preview.svg`, `package.json`, `vitest.config.mjs`, testes Cloudflare/UI, scripts de build e todos os workflows. Não foram alterados sem uma necessidade demonstrada, para evitar regressões de produção.

## Validação

- Confirmada no GitHub a existência de `social-preview.png` e metadata OG/Twitter a apontar para PNG 1200×630.
- A validação local/CI não foi executada nesta alteração documental.
- Não foram executados workflows, deploys, comandos Azure, alterações de NSG, operações de VM ou comandos Minecraft.
- Não foram consultados nem apresentados valores de secrets.
- Esta auditoria não é uma validação end-to-end de login Java/Bedrock nem do painel num browser real.

## Política

Free Tier apenas. Custo máximo permitido 0,00 € / $0,00. Não consumir créditos para serviços pagos, não ativar Pay-As-You-Go e não criar recursos faturáveis.
