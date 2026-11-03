# GitHub configuration

This directory contains repository automation and CI. Read [workflows/README.md](workflows/README.md) and inspect the complete YAML before invoking or changing any workflow.

Workflows can alter Azure VM power, Docker services, cron, SSH agent, NSG rules, Worker deployments, or public website state. A manual trigger is not inherently safe. Never print GitHub Secrets, environment variables, raw Azure/SSH/RCON output, player data, or public IPs.

**Absolute budget: €0 / $0. Free Tier only.** Do not consume Azure Student credits for paid resources, enable Pay-As-You-Go, start billable compute, activate trials/upgrades, or use paid runners/services. Review permissions, concurrency, pinned external actions, idempotency, rollback and output redaction on every change.
