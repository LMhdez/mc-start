import { DurableObject } from "cloudflare:workers";

const REPO = "LMhdez/mc-start";
const API_VERSION = "2022-11-28";
const STATUS_TTL = 300;
const MAX_STATUS_ENVELOPE_BYTES = 64 * 1024;
const RATE_WINDOW = 60;
const RATE_LIMIT = 10;
const AUTH_RATE_LIMIT = 20;
const CALLBACK_RATE_LIMIT = 10;
const MAX_JSON_BYTES = 64 * 1024;
const TECHNICAL_KV_KEY = "technical:public";
const TECHNICAL_R2_KEY = "technical/latest.json";
const PUBLIC_MAINTENANCE_URL = "https://raw.githubusercontent.com/LMhdez/mc-start/main/maintenance.json";
const PUBLIC_MAINTENANCE_CACHE_TTL_MS = 30 * 1000;
let publicMaintenanceCache = { value: { enabled: false, message: "" }, expiresAt: 0 };
// Global R2 budgets are enforced by the persistent SQLite-backed Durable Object.
const R2_DAILY_READ_BUDGET = 3000;
const R2_MONTHLY_READ_BUDGET = 90000;
const R2_DAILY_WRITE_BUDGET = 10;
const R2_MONTHLY_WRITE_BUDGET = 300;
const R2_MAX_OBJECT_BYTES = 256 * 1024;
const R2_LOCAL_CACHE_TTL_MS = 60 * 1000;
const R2_MIGRATION_BACKOFF_MS = 60 * 1000;
const localRateLimitFallback = new Map();
let r2SnapshotCache = { loaded: false, snapshot: null, serialized: null, expiresAt: 0 };
let r2MigrationRetryAfter = 0;


async function getPublicMaintenanceConfig() {
  const now = Date.now();
  if (publicMaintenanceCache.expiresAt > now) return publicMaintenanceCache.value;
  try {
    const response = await fetch(PUBLIC_MAINTENANCE_URL, {
      headers: { "Accept": "application/json" },
      cf: { cacheTtl: 30, cacheEverything: true }
    });
    if (!response.ok) throw new Error("Maintenance source unavailable");
    const config = await response.json();
    if (!config || typeof config !== "object" || Array.isArray(config) || typeof config.enabled !== "boolean") {
      throw new Error("Maintenance source invalid");
    }
    const value = { enabled: config.enabled, message: typeof config.message === "string" ? config.message.trim().slice(0, 240) : "" };
    publicMaintenanceCache = { value, expiresAt: now + PUBLIC_MAINTENANCE_CACHE_TTL_MS };
    return value;
  } catch {
    publicMaintenanceCache.expiresAt = now + PUBLIC_MAINTENANCE_CACHE_TTL_MS;
    console.warn("Configuracao publica de manutencao indisponivel; a manter o ultimo estado conhecido.");
    return publicMaintenanceCache.value;
  }
}

async function enrichPublicSseFrame(frame) {
  const lines = frame.split(/\r?\n/);
  const dataLines = lines.filter(line => line.startsWith("data:"));
  if (!dataLines.length) return frame;

  const raw = dataLines.map(line => line.slice(5).replace(/^ /, "")).join("\n");
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return frame;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return frame;

  payload.maintenance = await getPublicMaintenanceConfig();
  let replaced = false;
  return lines.map(line => {
    if (!line.startsWith("data:")) return line;
    if (replaced) return null;
    replaced = true;
    return "data: " + JSON.stringify(payload);
  }).filter(line => line !== null).join("\n");
}

function withPublicMaintenanceEvents(stream) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let pending = "";
  return stream.pipeThrough(new TransformStream({
    async transform(chunk, controller) {
      pending += decoder.decode(chunk, { stream: true });
      const frames = pending.split(/\r?\n\r?\n/);
      pending = frames.pop() ?? "";
      for (const frame of frames) {
        if (!frame) continue;
        const enriched = await enrichPublicSseFrame(frame);
        controller.enqueue(encoder.encode(enriched + "\n\n"));
      }
    },
    async flush(controller) {
      pending += decoder.decode();
      if (pending) controller.enqueue(encoder.encode(await enrichPublicSseFrame(pending)));
    }
  }));
}

function checkLocalRateLimit(request, scope, limit, now) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = scope + ":" + ip;
  let record = localRateLimitFallback.get(key);
  if (!record || now - record.startedAt >= RATE_WINDOW || now < record.startedAt) {
    record = { count: 0, startedAt: now };
  }
  if (record.count >= limit) return false;
  record.count += 1;
  localRateLimitFallback.set(key, record);

  // Bound memory use and discard expired fallback counters.
  if (localRateLimitFallback.size > 5000) {
    for (const [storedKey, storedRecord] of localRateLimitFallback) {
      if (now - storedRecord.startedAt >= RATE_WINDOW || now < storedRecord.startedAt) {
        localRateLimitFallback.delete(storedKey);
      }
    }
    while (localRateLimitFallback.size > 5000) {
      const oldestKey = localRateLimitFallback.keys().next().value;
      if (oldestKey === undefined) break;
      localRateLimitFallback.delete(oldestKey);
    }
  }
  return true;
}

const WORKFLOWS = {
  start: {
    file: "start-vm.yml",
    // O pedido só é criado depois da autenticação da palavra-passe do painel.
    // A ação explícita “Ligar servidor” é a confirmação do utilizador para este arranque.
    inputs: { notificar: "Painel web", confirmar_arranque: "true" },
    message: "Pedido para ligar o servidor enviado."
  },
  stop: {
    file: "stop-mc-server.yml",
    inputs: { motivo: "Painel web" },
    message: "Pedido para desligar o servidor enviado."
  }
};

function json(data, status, origin, extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function constantTimeEqual(a, b) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    difference |= (left[i] || 0) ^ (right[i] || 0);
  }
  return difference === 0;
}

function validRequestId(value) {
  return typeof value === "string" && /^[a-f0-9-]{36}$/i.test(value);
}

function validIPv4(value) {
  if (typeof value !== "string") return false;
  const parts = value.trim().split(".");
  return parts.length === 4 && parts.every(part =>
    /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255
  );
}

async function readJsonBody(request, maxBytes = MAX_JSON_BYTES) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new Error("BODY_TOO_LARGE");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) throw new Error("BODY_TOO_LARGE");
  try { return JSON.parse(raw); }
  catch { throw new Error("INVALID_JSON"); }
}

function checkRateLimit(_env, request, scope = "action", limit = RATE_LIMIT) {
  // Rate-limit counters are deliberately kept in isolate memory, not Workers KV.
  // KV is eventually consistent and writing every request exhausted the free daily
  // write quota. This remains a best-effort per-isolate limit, not a global/atomic
  // abuse-control mechanism; use a Cloudflare Rate Limiting binding if traffic grows.
  const now = Math.floor(Date.now() / 1000);
  return checkLocalRateLimit(request, scope, limit, now);
}

function getR2BudgetStub(env) {
  if (!env.R2_BUDGET) return null;
  return env.R2_BUDGET.getByName("mc-start-r2-global-budget");
}

async function readTechnicalSnapshot(env) {
  let staleR2Snapshot = null;

  if (env.TECHNICAL_BUCKET && env.R2_BUDGET) {
    const now = Date.now();

    // Local cache reduces Durable Object and R2 requests; it is never the budget authority.
    if (r2SnapshotCache.loaded && r2SnapshotCache.expiresAt > now) {
      if (r2SnapshotCache.snapshot) return r2SnapshotCache.snapshot;
    } else {
      try {
        const result = await getR2BudgetStub(env).readSnapshot();
        if (result && result.ok) {
          r2SnapshotCache = {
            loaded: true,
            snapshot: result.snapshot || null,
            serialized: result.snapshot ? result.serialized : null,
            expiresAt: now + R2_LOCAL_CACHE_TTL_MS
          };
          if (result.snapshot) return result.snapshot;
        } else {
          console.warn("Durable Object recusou ou nao conseguiu ler o snapshot R2; a usar fallback.");
          staleR2Snapshot = r2SnapshotCache.snapshot;
        }
      } catch {
        // Fail closed for R2: no direct R2 call is made when the budget authority is unavailable.
        console.error("Controlo global R2 indisponivel; a usar fallback KV/cache.");
        staleR2Snapshot = r2SnapshotCache.snapshot;
      }
    }
  }

  // Prefer the shared KV fallback over an older isolate-local snapshot.
  // The last local snapshot is used only when KV is unavailable or empty.
  if (!env.STATUS_KV) return staleR2Snapshot;
  let stored;
  try {
    stored = await env.STATUS_KV.get(TECHNICAL_KV_KEY);
  } catch {
    console.error("Leitura do snapshot tecnico legado em KV indisponivel.");
    return staleR2Snapshot;
  }
  if (!stored) return staleR2Snapshot;

  let snapshot;
  try {
    snapshot = JSON.parse(stored);
  } catch {
    console.error("Snapshot tecnico legado em KV invalido.");
    return staleR2Snapshot;
  }
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return staleR2Snapshot;

  // Keep the fallback result in this isolate too, so a failed R2 read does not
  // repeatedly hide a newer KV snapshot behind an older local copy.
  if (env.TECHNICAL_BUCKET && env.R2_BUDGET) {
    r2SnapshotCache = {
      loaded: true, snapshot, serialized: JSON.stringify(snapshot),
      expiresAt: Date.now() + R2_LOCAL_CACHE_TTL_MS
    };
  }

  // Migrate the legacy KV snapshot through the same global R2 budget authority.
  if (env.TECHNICAL_BUCKET && env.R2_BUDGET) {
    const serialized = JSON.stringify(snapshot);
    if (new TextEncoder().encode(serialized).byteLength > R2_MAX_OBJECT_BYTES) {
      console.error("Snapshot tecnico excede o limite de tamanho para R2.");
    } else if (Date.now() >= r2MigrationRetryAfter) {
      // Local backoff avoids unnecessary DO calls; the authoritative backoff is persisted in SQLite.
      r2MigrationRetryAfter = Date.now() + R2_MIGRATION_BACKOFF_MS;
      try {
        const result = await getR2BudgetStub(env).writeSnapshot(serialized, true);
        if (result && result.ok && result.written) {
          r2SnapshotCache = {
            loaded: true, snapshot, serialized,
            expiresAt: Date.now() + R2_LOCAL_CACHE_TTL_MS
          };
        }
      } catch {
        console.error("Migracao do snapshot tecnico para R2 indisponivel.");
      }
    }
  }
  return snapshot;
}

async function writeTechnicalSnapshot(env, snapshot) {
  const serialized = JSON.stringify(snapshot);
  const size = new TextEncoder().encode(serialized).byteLength;
  if (size > R2_MAX_OBJECT_BYTES) {
    throw new Error("Technical snapshot exceeds the R2 object size safety limit");
  }

  if (env.TECHNICAL_BUCKET && env.R2_BUDGET) {
    // Avoid a write only when this isolate already holds the exact same snapshot.
    if (r2SnapshotCache.loaded && r2SnapshotCache.serialized === serialized) {
      r2SnapshotCache.expiresAt = Date.now() + R2_LOCAL_CACHE_TTL_MS;
      return;
    }
    let result = null;
    try {
      result = await getR2BudgetStub(env).writeSnapshot(serialized, false);
    } catch {
      // RPC failure must not prevent the documented KV fallback.
      console.warn("Durable Object indisponivel; a tentar fallback KV.");
    }
    if (result && result.ok && result.written) {
      r2SnapshotCache = {
        loaded: true, snapshot, serialized,
        expiresAt: Date.now() + R2_LOCAL_CACHE_TTL_MS
      };
      return;
    }
    // Never bypass the global budget by calling R2 directly or falling back
    // to a KV write: doing so could exhaust the very quota this path protects.
    if (result) console.warn("Escrita R2 nao autorizada; snapshot mantido sem persistencia.");
    throw new Error("R2 persistence unavailable; KV write fallback is disabled");
  }

  // KV is retained only for installations that have not configured the R2 path.
  // Once either R2 binding is present, a broken/incomplete R2 setup must fail
  // closed instead of silently reintroducing technical snapshot KV writes.
  if (env.TECHNICAL_BUCKET || env.R2_BUDGET) {
    throw new Error("R2 configuration incomplete; KV write fallback is disabled");
  }

  if (env.STATUS_KV) {
    await env.STATUS_KV.put(TECHNICAL_KV_KEY, serialized);
    return;
  }
  throw new Error("No authorized technical cache binding is available");
}

async function dispatchWorkflow(env, file, inputs) {
  return fetch(
    "https://api.github.com/repos/" + REPO + "/actions/workflows/" + file + "/dispatches",
    {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": "Bearer " + env.GITHUB_TOKEN,
        "X-GitHub-Api-Version": API_VERSION,
        "Content-Type": "application/json",
        "User-Agent": "mc-start-control-worker"
      },
      body: JSON.stringify({ ref: "main", inputs })
    }
  );
}

async function getSafeAzureErrorCode(response) {
  try {
    const payload = await response.clone().json();
    const candidate = typeof payload?.error === "string"
      ? payload.error
      : payload?.error?.code;
    return typeof candidate === "string" &&
      /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(candidate)
      ? candidate
      : null;
  } catch {
    return null;
  }
}

function azureHttpError(operation, response, code) {
  return `${operation} failed (HTTP ${response.status}${code ? `, ${code}` : ""})`;
}

function safeAzureDiagnostic(error) {
  const message = error instanceof Error ? error.message : "";
  if (/^Azure (?:token|VM status|VM action) request failed \(HTTP [1-5]\d{2}(?:, [A-Za-z][A-Za-z0-9_.-]{0,63})?\)$/.test(message)) {
    return message;
  }
  if (message === "Azure token missing") return message;
  return "Unexpected Azure status error";
}

function safeOperationalDiagnostic(error) {
  const diagnostic = safeAzureDiagnostic(error);
  return diagnostic === "Unexpected Azure status error"
    ? "Unexpected internal error"
    : diagnostic;
}

async function getAzureAccessToken(env) {
  const required = ["AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "AZURE_TENANT_ID",
    "AZURE_SUBSCRIPTION_ID", "AZURE_RESOURCE_GROUP", "AZURE_VM_NAME"];
  if (required.some(name => !env[name])) return null;

  const tokenResponse = await fetch(
    "https://login.microsoftonline.com/" + encodeURIComponent(env.AZURE_TENANT_ID) + "/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.AZURE_CLIENT_ID,
        client_secret: env.AZURE_CLIENT_SECRET,
        grant_type: "client_credentials",
        scope: "https://management.azure.com/.default"
      })
    }
  );
  if (!tokenResponse.ok) {
    const code = await getSafeAzureErrorCode(tokenResponse);
    throw new Error(azureHttpError("Azure token request", tokenResponse, code));
  }
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) throw new Error("Azure token missing");
  return tokenData.access_token;
}

function azureVmResource(env) {
  return [
    "subscriptions", encodeURIComponent(env.AZURE_SUBSCRIPTION_ID),
    "resourceGroups", encodeURIComponent(env.AZURE_RESOURCE_GROUP),
    "providers/Microsoft.Compute/virtualMachines", encodeURIComponent(env.AZURE_VM_NAME)
  ].join("/");
}

async function getAzureVmPowerState(env, accessToken = null) {
  const token = accessToken || await getAzureAccessToken(env);
  if (!token) return null;

  const vmResponse = await fetch(
    "https://management.azure.com/" + azureVmResource(env) + "/instanceView?api-version=2024-07-01",
    { headers: { "Authorization": "Bearer " + token } }
  );
  if (!vmResponse.ok) {
    const code = await getSafeAzureErrorCode(vmResponse);
    throw new Error(azureHttpError("Azure VM status request", vmResponse, code));
  }
  const vmData = await vmResponse.json();
  const power = (vmData.statuses || []).find(item =>
    typeof item.code === "string" && item.code.startsWith("PowerState/")
  );
  if (!power) return null;

  const states = {
    "PowerState/deallocated": "VM deallocated",
    "PowerState/stopped": "VM stopped",
    "PowerState/starting": "VM starting",
    "PowerState/stopping": "VM stopping",
    "PowerState/running": "VM running"
  };
  return states[power.code] || null;
}

async function performAzureVmAction(env, action, accessToken = null) {
  if (!["start", "deallocate"].includes(action)) {
    throw new Error("Azure VM action is not allowed");
  }
  const token = accessToken || await getAzureAccessToken(env);
  if (!token) throw new Error("Azure credentials are incomplete");

  let response;
  try {
    response = await fetch(
      "https://management.azure.com/" + azureVmResource(env) + "/" + action + "?api-version=2024-07-01",
      {
        method: "POST",
        headers: { "Authorization": "Bearer " + token },
        body: ""
      }
    );
  } catch {
    // Fetch exceptions may contain request details; log only a fixed safe diagnostic.
    throw new Error("Azure VM action network request failed");
  }
  if (!response.ok && response.status !== 202) {
    const code = await getSafeAzureErrorCode(response);
    throw new Error(azureHttpError("Azure VM action request", response, code));
  }
  return response.status;
}

async function callPrivateAgent(env, path, method = "GET") {
  if (!env.MC_AGENT) throw new Error("Private MC agent binding is missing");
  const response = await env.MC_AGENT.fetch(new Request(
    "http://localhost:8765" + path,
    { method, headers: { "Accept": "application/json" } }
  ));
  if (!response.ok) throw new Error("Private MC agent returned status " + response.status);
  const data = await response.json();
  if (!data || data.ok !== true) throw new Error("Private MC agent rejected the request");
  return data;
}

export class R2Budget extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // SQLite state is the single persistent source of truth for all Worker isolates.
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS r2_budget (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        day_key TEXT NOT NULL,
        month_key TEXT NOT NULL,
        daily_reads INTEGER NOT NULL DEFAULT 0,
        monthly_reads INTEGER NOT NULL DEFAULT 0,
        daily_writes INTEGER NOT NULL DEFAULT 0,
        monthly_writes INTEGER NOT NULL DEFAULT 0,
        migration_retry_after INTEGER NOT NULL DEFAULT 0
      )
    `);
    this.ctx.storage.sql.exec(
      "INSERT OR IGNORE INTO r2_budget (id, day_key, month_key) VALUES (1, '', '')"
    );
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS status_results (request_id TEXT PRIMARY KEY, envelope TEXT NOT NULL, expires_at INTEGER NOT NULL)"
    );
  }

  reserveOperation(kind) {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const month = day.slice(0, 7);
    const isRead = kind === "read";
    const dailyLimit = isRead ? R2_DAILY_READ_BUDGET : R2_DAILY_WRITE_BUDGET;
    const monthlyLimit = isRead ? R2_MONTHLY_READ_BUDGET : R2_MONTHLY_WRITE_BUDGET;
    const dailyColumn = isRead ? "daily_reads" : "daily_writes";
    const monthlyColumn = isRead ? "monthly_reads" : "monthly_writes";
    const dailyIncrement = isRead ? 1 : 0;
    const dailyWriteIncrement = isRead ? 0 : 1;
    const monthlyIncrement = isRead ? 1 : 0;
    const monthlyWriteIncrement = isRead ? 0 : 1;

    // One conditional SQLite UPDATE atomically checks and reserves both periods.
    const sql = `
      UPDATE r2_budget
      SET day_key = ?,
          month_key = ?,
          daily_reads = CASE WHEN day_key = ? THEN daily_reads ELSE 0 END + ?,
          daily_writes = CASE WHEN day_key = ? THEN daily_writes ELSE 0 END + ?,
          monthly_reads = CASE WHEN month_key = ? THEN monthly_reads ELSE 0 END + ?,
          monthly_writes = CASE WHEN month_key = ? THEN monthly_writes ELSE 0 END + ?
      WHERE id = 1
        AND (CASE WHEN day_key = ? THEN ${dailyColumn} ELSE 0 END) < ?
        AND (CASE WHEN month_key = ? THEN ${monthlyColumn} ELSE 0 END) < ?
      RETURNING id
    `;
    const rows = this.ctx.storage.sql.exec(
      sql,
      day, month,
      day, dailyIncrement,
      day, dailyWriteIncrement,
      month, monthlyIncrement,
      month, monthlyWriteIncrement,
      day, dailyLimit,
      month, monthlyLimit
    ).toArray();
    return rows.length === 1;
  }

  async storeStatusResult(requestId, serializedEnvelope, expiresAt) {
    if (!validRequestId(requestId) || typeof serializedEnvelope !== "string" ||
        new TextEncoder().encode(serializedEnvelope).byteLength > MAX_STATUS_ENVELOPE_BYTES) {
      return { ok: false, reason: "invalid_status_result" };
    }

    let envelope;
    try {
      envelope = JSON.parse(serializedEnvelope);
    } catch {
      return { ok: false, reason: "invalid_status_result" };
    }
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope) ||
        typeof envelope.salt !== "string" || typeof envelope.iv !== "string" ||
        typeof envelope.data !== "string") {
      return { ok: false, reason: "invalid_status_result" };
    }

    const now = Date.now();
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= now ||
        expiresAt > now + (STATUS_TTL + 30) * 1000) {
      return { ok: false, reason: "invalid_status_expiry" };
    }

    // Short-lived encrypted results live in SQLite, not Workers KV.
    // Prune expired rows on writes; successful reads remain idempotent.
    this.ctx.storage.sql.exec("DELETE FROM status_results WHERE expires_at <= ?", now);
    this.ctx.storage.sql.exec(
      "INSERT INTO status_results (request_id, envelope, expires_at) VALUES (?, ?, ?) " +
      "ON CONFLICT(request_id) DO UPDATE SET envelope = excluded.envelope, expires_at = excluded.expires_at",
      requestId, serializedEnvelope, expiresAt
    );
    return { ok: true };
  }

  async readStatusResult(requestId) {
    if (!validRequestId(requestId)) return { ok: false, reason: "invalid_request_id" };

    const rows = this.ctx.storage.sql.exec(
      "SELECT envelope, expires_at FROM status_results WHERE request_id = ?",
      requestId
    ).toArray();
    if (rows.length === 0) return { ok: true, envelope: null };

    const row = rows[0];
    if (row.expires_at <= Date.now()) {
      this.ctx.storage.sql.exec("DELETE FROM status_results WHERE request_id = ?", requestId);
      return { ok: true, envelope: null };
    }

    try {
      const envelope = JSON.parse(row.envelope);
      if (!envelope || typeof envelope !== "object" || Array.isArray(envelope) ||
          typeof envelope.salt !== "string" || typeof envelope.iv !== "string" ||
          typeof envelope.data !== "string") {
        throw new Error("Invalid status envelope");
      }
      return { ok: true, envelope };
    } catch {
      this.ctx.storage.sql.exec("DELETE FROM status_results WHERE request_id = ?", requestId);
      return { ok: false, reason: "invalid_status_result" };
    }
  }

  async readSnapshot() {
    if (!this.env.TECHNICAL_BUCKET) return { ok: false, reason: "r2_unbound" };
    if (!this.reserveOperation("read")) return { ok: false, reason: "budget_exhausted" };

    try {
      const object = await this.env.TECHNICAL_BUCKET.get(TECHNICAL_R2_KEY);
      if (!object) return { ok: true, snapshot: null, serialized: null };
      if (Number.isFinite(object.size) && object.size > R2_MAX_OBJECT_BYTES) {
        return { ok: false, reason: "object_too_large" };
      }

      const serialized = await object.text();
      if (new TextEncoder().encode(serialized).byteLength > R2_MAX_OBJECT_BYTES) {
        return { ok: false, reason: "object_too_large" };
      }
      let snapshot;
      try {
        snapshot = JSON.parse(serialized);
      } catch {
        return { ok: false, reason: "invalid_json" };
      }
      if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
        return { ok: false, reason: "invalid_snapshot" };
      }
      return { ok: true, snapshot, serialized };
    } catch {
      return { ok: false, reason: "r2_unavailable" };
    }
  }

  async writeSnapshot(serialized, onlyIfAbsent = false) {
    if (!this.env.TECHNICAL_BUCKET) return { ok: false, reason: "r2_unbound" };
    if (typeof serialized !== "string" ||
        new TextEncoder().encode(serialized).byteLength > R2_MAX_OBJECT_BYTES) {
      return { ok: false, reason: "object_too_large" };
    }

    const now = Date.now();
    if (onlyIfAbsent) {
      const retry = this.ctx.storage.sql.exec(
        "SELECT migration_retry_after FROM r2_budget WHERE id = 1"
      ).one().migration_retry_after;
      if (now < retry) return { ok: true, written: false, skipped: true };
    }

    if (!this.reserveOperation("write")) {
      return { ok: false, reason: "budget_exhausted" };
    }

    if (onlyIfAbsent) {
      // Persist a global backoff before external I/O to prevent repeated conditional PUTs.
      this.ctx.storage.sql.exec(
        "UPDATE r2_budget SET migration_retry_after = ? WHERE id = 1",
        now + R2_MIGRATION_BACKOFF_MS
      );
    }

    try {
      const options = {
        httpMetadata: { contentType: "application/json; charset=utf-8" }
      };
      if (onlyIfAbsent) options.onlyIf = { etagDoesNotMatch: "*" };
      const result = await this.env.TECHNICAL_BUCKET.put(
        TECHNICAL_R2_KEY, serialized, options
      );
      return { ok: true, written: result !== null };
    } catch {
      return { ok: false, reason: "r2_unavailable" };
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const isStatusCallback = url.pathname === "/api/status-result";

    // Callbacks do GitHub Actions não vêm do navegador; autenticam-se pela palavra-passe.
    // Nunca registar body, password, envelope ou dados privados do servidor.
    if (isStatusCallback) {
      if (request.method !== "POST") return json({ ok: false, code: "method_not_allowed" }, 405);
      if (!env.ACCESS_PASSWORD || (!env.R2_BUDGET && !env.STATUS_KV)) return json({ ok: false, code: "configuration_unavailable" }, 503);
      if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) {
        return json({ ok: false, code: "invalid_content_type" }, 415);
      }
      if (!(await checkRateLimit(env, request, "callback", CALLBACK_RATE_LIMIT))) {
        return json({ ok: false, code: "rate_limited" }, 429);
      }

      let body;
      try {
        body = await readJsonBody(request);
      } catch (error) {
        const tooLarge = error.message === "BODY_TOO_LARGE";
        console.warn("Callback de estado rejeitado:", tooLarge ? "body_too_large" : "invalid_json");
        return json({ ok: false, code: tooLarge ? "body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
      }

      if (!body || typeof body.password !== "string" ||
          !constantTimeEqual(body.password, env.ACCESS_PASSWORD)) {
        return json({ ok: false, code: "unauthorized" }, 401);
      }

      const validEnvelope = body.envelope &&
        typeof body.envelope === "object" &&
        !Array.isArray(body.envelope) &&
        typeof body.envelope.salt === "string" &&
        body.envelope.salt.length > 0 &&
        typeof body.envelope.iv === "string" &&
        body.envelope.iv.length > 0 &&
        typeof body.envelope.data === "string" &&
        body.envelope.data.length > 0;

      if (!validRequestId(body.request_id) || !validEnvelope) {
        console.warn("Callback de estado rejeitado: invalid_payload");
        return json({ ok: false, code: "invalid_payload" }, 400);
      }

      try {
        if (env.R2_BUDGET) {
          const stored = await getR2BudgetStub(env).storeStatusResult(
            body.request_id,
            JSON.stringify(body.envelope),
            Date.now() + STATUS_TTL * 1000
          );
          if (!stored || stored.ok !== true) throw new Error("Status result storage rejected the write");
        } else {
          // Compatibility for older deployments without the SQLite-backed Durable Object.
          await env.STATUS_KV.put(
            "status:" + body.request_id,
            JSON.stringify(body.envelope),
            { expirationTtl: STATUS_TTL }
          );
        }
      } catch {
        console.error("Callback de estado: armazenamento temporário indisponível.");
        return json({ ok: false, code: "storage_unavailable" }, 503);
      }

      return json({ ok: true }, 200);
    }

    if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) {
      return json({ ok: false, message: "Origem nao autorizada." }, 403);
    }

    // Real SSE stream: one Azure state check per connection, then a direct
    // streaming proxy to the private agent. The Worker itself does no polling, KV writes or DO usage.
    // This endpoint is read-only and is deliberately separate from start/stop.
    if (url.pathname === "/api/public/events") {
      if (request.method !== "GET") {
        return json({ ok: false, message: "Metodo nao permitido." }, 405, origin, { "Allow": "GET" });
      }
      if (!(await checkRateLimit(env, request, "public-events", 30))) {
        return json({ ok: false, message: "Demasiadas reconexoes. Aguarda um pouco." }, 429, origin, { "Retry-After": "60" });
      }
      try {
        const vm = await getAzureVmPowerState(env);
        if (vm !== "VM running") {
          // Return the authoritative Azure power state as one SSE event. The
          // browser reconnects slowly while the VM is stopped/deallocated and
          // therefore can notice a later manual start without polling rapidly.
          const stoppedSnapshot = {
            vm: vm || "Unknown",
            players: 0,
            docker: "inactive",
            container: "unknown",
            port_open: false,
            rcon_ready: false,
            geyser_ready: false,
            geyser_state: "not_ready",
            geyser_transport: "unknown",
            geyser_udp_ready: false,
            geyser_udp_state: "unknown",
            checked_at: new Date().toISOString(),
            maintenance: await getPublicMaintenanceConfig()
          };
          const body = "event: status\ndata: " + JSON.stringify(stoppedSnapshot) + "\n\n";
          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              "X-Content-Type-Options": "nosniff",
              "Access-Control-Allow-Origin": origin,
              "Vary": "Origin"
            }
          });
        }
        if (!env.MC_AGENT) {
          return json({ ok: false, code: "agent_unavailable" }, 503, origin, { "Retry-After": "60" });
        }
        const upstream = await env.MC_AGENT.fetch(new Request(
          "http://localhost:8765/events",
          { method: "GET", headers: { "Accept": "text/event-stream" } }
        ));
        if (!upstream.ok || !upstream.body) {
          if (upstream.body) await upstream.body.cancel();
          return json({ ok: false, code: "event_stream_unavailable" }, 503, origin, { "Retry-After": "60" });
        }
        return new Response(withPublicMaintenanceEvents(upstream.body), {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Content-Type-Options": "nosniff",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": origin,
            "Vary": "Origin"
          }
        });
      } catch (error) {
        console.error("Fluxo SSE publico indisponivel:", safeOperationalDiagnostic(error));
        return json({ ok: false, code: "event_stream_unavailable" }, 503, origin, { "Retry-After": "60" });
      }
    }

    // Endpoints publicos: nunca devolvem IP, nomes de jogadores ou dados de acesso.
    if (url.pathname === "/api/public/status" && request.method === "GET") {
      if (!env.STATUS_KV) return json({ ok: false, message: "Cache indisponivel." }, 503, origin);
      if (!(await checkRateLimit(env, request, "public-status", 30))) {
        return json({ ok: false, message: "Demasiados pedidos. Aguarda um minuto." }, 429, origin);
      }
      try {
        // Azure control-plane failures must not turn a public status read into
        // an endpoint outage. Report an explicit unknown VM state instead.
        let vm = null;
        try {
          vm = await getAzureVmPowerState(env);
        } catch (error) {
          console.error("Estado publico: Azure indisponivel; estado da VM desconhecido:", safeAzureDiagnostic(error));
        }
        let result = {
          vm: vm || "Unknown",
          players: vm === "VM running" ? null : 0,
          docker: "unknown",
          container: "unknown",
          port_open: vm === "VM running" ? null : false,
          rcon_ready: null,
          geyser_ready: vm === "VM running" ? null : false,
          geyser_state: "unknown",
          geyser_transport: "unknown",
          geyser_udp_ready: vm === "VM running" ? null : false,
          geyser_udp_state: "unknown",
          checked_at: new Date().toISOString()
        };
        if (vm === "VM running") {
          try {
            const agent = await callPrivateAgent(env, "/status");
            const live = agent.result || {};
            result = {
              vm: "VM running",
              players: live.players !== null && live.players !== undefined && Number.isFinite(Number(live.players)) ? Number(live.players) : null,
              docker: live.docker || "unknown",
              container: live.container || "unknown",
              port_open: typeof live.port_open === "boolean" ? live.port_open : null,
              rcon_ready: typeof live.rcon_ready === "boolean" ? live.rcon_ready : null,
              geyser_ready: typeof live.geyser_ready === "boolean" ? live.geyser_ready : null,
              geyser_state: typeof live.geyser_state === "string" ? live.geyser_state : "unknown",
              geyser_transport: live.geyser_transport === "nethernet" ? "nethernet" : "unknown",
              geyser_udp_ready: typeof live.geyser_udp_ready === "boolean" ? live.geyser_udp_ready : null,
              geyser_udp_state: typeof live.geyser_udp_state === "string" ? live.geyser_udp_state : "unknown",
              geyser_udp_diagnostic: typeof live.geyser_udp_diagnostic === "string" ? live.geyser_udp_diagnostic : "unknown",
              checked_at: live.checked_at || result.checked_at
            };
          } catch (error) {
            console.error("Estado publico: agente indisponivel:", safeOperationalDiagnostic(error));
          }
        }
        result.maintenance = await getPublicMaintenanceConfig();
        return json({ ok: true, result }, 200, origin);
      } catch (error) {
        console.error("Consulta publica falhou:", safeAzureDiagnostic(error));
        return json({ ok: false, message: "Nao foi possivel consultar o estado." }, 503, origin);
      }
    }

    if (url.pathname === "/api/technical" && request.method === "GET") {
      if (!env.TECHNICAL_BUCKET && !env.STATUS_KV) {
        return json({ ok: false, message: "Cache indisponivel." }, 503, origin);
      }
      if (!(await checkRateLimit(env, request, "technical", 10))) {
        return json({ ok: false, message: "Demasiados pedidos. Aguarda um minuto." }, 429, origin);
      }
      let cached = null;
      try {
        cached = await readTechnicalSnapshot(env);
      } catch {
        // A cache indisponivel nao deve impedir a leitura do agente privado.
        console.error("Leitura do inventario tecnico em cache indisponivel.");
      }
      const age = cached && cached.checked_at ? Date.now() - Date.parse(cached.checked_at) : Infinity;
      if (cached && age >= 0 && age < 600000) {
        return json({ ok: true, result: cached, cached: true }, 200, origin);
      }
      try {
        // A VM desligada nunca invalida nem impede a leitura do ultimo inventario publico.
        const vmState = await getAzureVmPowerState(env);
        if (vmState !== "VM running") {
          if (cached) return json({ ok: true, result: cached, cached: true, stale: true }, 200, origin);
          return json({ ok: false, message: "Ainda nao existe um inventario tecnico sincronizado." }, 503, origin);
        }

        const agent = await callPrivateAgent(env, "/technical");
        const technical = agent.result || {};

        // Nao substituir um inventario valido por uma resposta incompleta durante o arranque.
        if (!technical.checked_at || technical.mods_inventory_available !== true) {
          if (cached) return json({ ok: true, result: cached, cached: true, stale: true }, 200, origin);
          return json({ ok: false, message: "Inventario tecnico ainda nao esta pronto." }, 503, origin);
        }

        // Keep the latest complete snapshot available even after long offline periods.
        // R2 is preferred; KV remains the compatibility fallback until R2 is bound.
        try {
          await writeTechnicalSnapshot(env, technical);
        } catch {
          // Return the live inventory even if persistence is temporarily unavailable.
          console.error("Gravacao do inventario tecnico em cache indisponivel.");
        }
        return json({ ok: true, result: technical, cached: false }, 200, origin);
      } catch (error) {
        console.error("Consulta tecnica indisponivel:", safeOperationalDiagnostic(error));
        if (cached) return json({ ok: true, result: cached, cached: true, stale: true }, 200, origin);
        return json({ ok: false, message: "Dados tecnicos dinamicos indisponiveis." }, 503, origin);
      }
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        }
      });
    }
    if (request.method !== "POST") return json({ ok: false, message: "Metodo nao permitido." }, 405, origin);
    if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) {
      return json({ ok: false, message: "Pedido invalido." }, 415, origin);
    }
    const isStatusRead = url.pathname === "/api/status/read";
    const isActionRequest = url.pathname === "/api/action";
    if (!isStatusRead && !isActionRequest) {
      return json({ ok: false, message: "Endereco nao encontrado." }, 404, origin);
    }
    if (!env.ACCESS_PASSWORD || env.ACCESS_PASSWORD.length < 20 || !env.STATUS_KV) {
      return json({ ok: false, message: "Configuracao incompleta do painel." }, 503, origin);
    }

    let body;
    try { body = await readJsonBody(request); }
    catch (error) {
      return json({ ok: false, message: "Pedido invalido." }, error.message === "BODY_TOO_LARGE" ? 413 : 400, origin);
    }

    const validPassword = body && typeof body.password === "string" &&
      constantTimeEqual(body.password, env.ACCESS_PASSWORD);
    if (!validPassword) {
      // Only failed password attempts consume the authentication-failure budget.
      // Valid status polling is governed by its own read limit below.
      if (!(await checkRateLimit(env, request, "auth-fail", AUTH_RATE_LIMIT))) {
        return json(
          { ok: false, message: "Demasiadas tentativas. Aguarda um minuto." },
          429,
          origin,
          { "Retry-After": "60" }
        );
      }
      return json({ ok: false, message: "Palavra-passe incorreta." }, 401, origin);
    }

    if (isStatusRead) {
      if (!validRequestId(body.request_id)) {
        return json({ ok: false, message: "Pedido invalido." }, 400, origin);
      }
      if (!(await checkRateLimit(env, request, "read", 45))) {
        return json(
          { ok: false, message: "Demasiados pedidos. Aguarda um minuto." },
          429,
          origin,
          { "Retry-After": "60" }
        );
      }
      let envelope = null;
      try {
        if (env.R2_BUDGET) {
          const stored = await getR2BudgetStub(env).readStatusResult(body.request_id);
          if (!stored || stored.ok !== true) throw new Error("Status result storage unavailable");
          envelope = stored.envelope;
        } else {
          // Compatibility for older deployments without the SQLite-backed Durable Object.
          const stored = await env.STATUS_KV.get("status:" + body.request_id);
          if (stored) envelope = JSON.parse(stored);
        }
      } catch {
        console.error("Leitura temporária do estado indisponível.");
        return json({ ok: false, message: "Resultado temporariamente indisponivel." }, 503, origin);
      }

      if (!envelope) return json({ ok: false, pending: true }, 202, origin);
      if (typeof envelope !== "object" || Array.isArray(envelope) ||
          typeof envelope.salt !== "string" ||
          typeof envelope.iv !== "string" ||
          typeof envelope.data !== "string") {
        return json({ ok: false, message: "Nao foi possivel ler o resultado." }, 500, origin);
      }
      // PBKDF2/AES-GCM decryption remains in the authenticated browser.
      return json({ ok: true, envelope }, 200, origin);
    }

    if (!["start", "stop", "status"].includes(body.action)) {
      return json({ ok: false, message: "Acao nao permitida." }, 400, origin);
    }
    const isStatusAction = body.action === "status";
    const actionScope = isStatusAction ? "status-action" : "action";
    const actionLimit = isStatusAction ? 30 : RATE_LIMIT;
    if (!(await checkRateLimit(env, request, actionScope, actionLimit))) {
      return json(
        { ok: false, message: "Demasiados pedidos. Aguarda um minuto." },
        429,
        origin,
        { "Retry-After": "60" }
      );
    }

    let file;
    let inputs = {};
    let message;
    if (body.action === "status") {
      if (!validRequestId(body.request_id)) return json({ ok: false, message: "Pedido invalido." }, 400, origin);
      // request_id is a fresh UUID; an old result cannot collide with this request.
      // The previous result, if any, expires automatically after STATUS_TTL.

      // Primeiro consulta diretamente Azure. Se a VM estiver ligada, tenta o agente privado.
      try {
        // Obter o token uma vez e reutilizá-lo nas consultas Azure desta operação.
        const accessToken = await getAzureAccessToken(env);
        const vmState = await getAzureVmPowerState(env, accessToken);
        if (vmState && vmState !== "VM running") {
          return json({
            ok: true,
            immediate: true,
            result: {
              vm: vmState, ip: "", port_open: false, docker: "unknown",
              container: "unknown", players: 0, player_names: [],
              checked_at: new Date().toISOString()
            }
          }, 200, origin);
        }

        if (vmState === "VM running") {
          try {
            const agent = await callPrivateAgent(env, "/status");
            if (agent.result && typeof agent.result === "object") {
              const result = { ...agent.result };
              result.ip = validIPv4(result.ip) ? result.ip.trim() : "";
              return json({ ok: true, immediate: true, result }, 200, origin);
            }
            throw new Error("Private MC agent returned an invalid status payload");
          } catch (error) {
            console.error("Agente privado indisponivel; a usar GitHub Actions:", safeOperationalDiagnostic(error));
          }
        }
      } catch (error) {
        console.error("Consulta direta Azure falhou; a usar GitHub Actions:", safeOperationalDiagnostic(error));
      }

      file = "status-mc-server.yml";
      inputs = { request_id: body.request_id };
      message = "Pedido de verificacao do servidor enviado.";
    } else {
      const workflow = WORKFLOWS[body.action];
      file = workflow.file;
      inputs = workflow.inputs;
      message = workflow.message;
    }

    // Azure first: this block is reachable only through the password-authenticated
    // POST /api/action endpoint after an explicit "start" action from the panel.
    // Public status reads and page loads never enter this path.
    if (body.action === "start") {
      let accessToken;
      let vmState;
      try {
        // Authentication and state discovery are read-only. If either fails,
        // the confirmed GitHub workflow remains a safe fallback path.
        accessToken = await getAzureAccessToken(env);
        vmState = await getAzureVmPowerState(env, accessToken);
      } catch (error) {
        console.error("Consulta direta Azure para arranque falhou; a usar GitHub Actions:", safeOperationalDiagnostic(error));
        file = WORKFLOWS.start.file;
        inputs = WORKFLOWS.start.inputs;
        message = WORKFLOWS.start.message;
      }

      if (accessToken && vmState === "VM stopping") {
        // A transition is not an Azure failure: do not dispatch a second start.
        return json({ ok: false, message: "A VM ainda está a desligar; aguarda pela conclusão." }, 409, origin);
      }
      if (accessToken && (vmState === "VM running" || vmState === "VM starting")) {
        return json({ ok: true, message: "O servidor ja esta ligado ou a iniciar." }, 200, origin);
      }
      if (accessToken && (vmState === "VM deallocated" || vmState === "VM stopped")) {
        try {
          await performAzureVmAction(env, "start", accessToken);
          return json({ ok: true, message: "Pedido para ligar o servidor enviado diretamente ao Azure." }, 202, origin);
        } catch (error) {
          const diagnostic = safeOperationalDiagnostic(error);
          // A 403 AuthorizationFailed response is an explicit rejection: Azure
          // did not authorize this mutation, so the authenticated GitHub workflow
          // is a safe alternative. Never use this fallback for network/5xx/409
          // outcomes, which may be ambiguous and could create duplicate starts.
          if (/^Azure VM action request failed \\(HTTP 403, AuthorizationFailed\\)$/.test(diagnostic)) {
            console.warn("Azure recusou explicitamente o arranque por autorização; a usar GitHub Actions:", diagnostic);
            file = WORKFLOWS.start.file;
            inputs = WORKFLOWS.start.inputs;
            message = WORKFLOWS.start.message;
          } else {
            // The POST may have reached Azure even if its response was lost.
            // Never dispatch a second start on this ambiguous mutation outcome.
            console.error("Resultado do pedido de arranque Azure inconclusivo; nao foi enviado um segundo pedido:", diagnostic);
            return json({ ok: false, message: "Não foi possível confirmar o pedido de arranque. Verifica o estado da VM antes de tentar novamente." }, 503, origin);
          }
        }
      }
      if (accessToken && !vmState) {
        console.warn("Estado Azure desconhecido; a usar o workflow de arranque confirmado.");
      }
      if (accessToken && vmState && !["VM deallocated", "VM stopped", "VM running", "VM starting", "VM stopping"].includes(vmState)) {
        console.warn("Estado Azure nao suportado; a usar o workflow de arranque confirmado.");
      }
    } else if (body.action === "stop") {
      try {
        const accessToken = await getAzureAccessToken(env);
        const vmState = await getAzureVmPowerState(env, accessToken);
        if (!vmState) throw new Error("Nao foi possivel confirmar o estado da VM.");
        if (vmState === "VM starting" || vmState === "VM stopping") {
          throw new Error("A VM tem uma operação em curso; aguarda pela conclusão.");
        }
        if (vmState === "VM deallocated") {
          return json({ ok: true, message: "O servidor ja esta desligado." }, 200, origin);
        }
        if (vmState === "VM starting" || vmState === "VM stopping") {
          throw new Error("A VM esta numa transicao; a usar o workflow existente.");
        }
        if (vmState === "VM running") {
          // Parar o Minecraft de forma graciosa antes de desalocar a VM.
          await callPrivateAgent(env, "/stop", "POST");
        }
        await performAzureVmAction(env, "deallocate", accessToken);
        return json({ ok: true, message: "Pedido para desligar o servidor enviado diretamente ao Azure." }, 202, origin);
      } catch (error) {
        console.error("Desligamento direto nao concluido; a usar GitHub Actions:", safeOperationalDiagnostic(error));
        file = WORKFLOWS.stop.file;
        inputs = WORKFLOWS.stop.inputs;
        message = WORKFLOWS.stop.message;
      }
    }

    if (!env.GITHUB_TOKEN) {
      return json({ ok: false, message: "Configuracao incompleta do painel." }, 503, origin);
    }
    const response = await dispatchWorkflow(env, file, inputs);
    if (!response.ok) {
      return json({ ok: false, message: "O GitHub nao aceitou o pedido. Tenta novamente mais tarde." }, 502, origin);
    }
    return json({ ok: true, message }, 202, origin);
  }
};