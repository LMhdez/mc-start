# GitHub configuration

This directory contains repository automation and CI. Read [workflows/README.md](workflows/README.md) and inspect the complete YAML before invoking or changing any workflow.

Workflows can alter Azure VM power, Docker services, cron, SSH agent, NSG rules, Worker deployments, or public website state. A manual trigger is not inherently safe. Never print GitHub Secrets, environment variables, raw Azure/SSH/RCON output, player data, or public IPs.

**Personal out-of-pocket budget: €0 / $0.** Azure for Students credits may fund deliberately selected paid Azure compute when it offers the best technically viable infrastructure at the lowest cost. Before starting or changing billable Azure resources, verify regional price, estimated consumption, remaining credit and expiry; block any action that could cause personal billing. Never enable Pay-As-You-Go or accept personal billing without explicit authorization. GitHub runners and third-party services have separate billing and must remain within approved free allowances unless separately authorized. Review permissions, concurrency, pinned external actions, idempotency, rollback and output redaction on every change.
