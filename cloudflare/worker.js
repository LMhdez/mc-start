const REPO = "LMhdez/mc-start";
const API_VERSION = "2022-11-28";
const STATUS_TTL = 300;
const RATE_WINDOW = 60;
const RATE_LIMIT = 10;

const WORKFLOWS = {
  start: {
    file: "start-vm.yml",
    inputs: { notificar: "Painel web" },
    message: "Pedido para ligar o servidor enviado."
  },
  stop: {
    file: "stop-mc-server.yml",
    inputs: { motivo: "Painel web" },
    message: "Pedido para desligar o servidor enviado."
  }
};

function json(data, status, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
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

async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

async function decryptStatus(envelope, password) {
  const salt = Uint8Array.from(atob(envelope.salt), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(envelope.iv), c => c.charCodeAt(0));
  const data = Uint8Array.from(atob(envelope.data), c => c.charCodeAt(0));
  const key = await deriveKey(password, salt);
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.parse(new TextDecoder().decode(clear));
}

async function checkRateLimit(env, request, scope = "action", limit = RATE_LIMIT) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = "rate:" + scope + ":" + ip;
  const current = Number(await env.STATUS_KV.get(key) || "0");
  if (current >= limit) return false;
  await env.STATUS_KV.put(key, String(current + 1), { expirationTtl: RATE_WINDOW });
  return true;
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const isCallback = url.pathname === "/api/status-result";

    // O callback do GitHub Actions nao vem do navegador; autentica-se pela palavra-passe.
    if (isCallback) {
      if (request.method !== "POST") return json({ ok: false }, 405);
      if (!env.ACCESS_PASSWORD || !env.STATUS_KV) return json({ ok: false }, 503);
      let body;
      try { body = await request.json(); } catch { return json({ ok: false }, 400); }
      if (!body || typeof body.password !== "string" ||
          !constantTimeEqual(body.password, env.ACCESS_PASSWORD)) {
        return json({ ok: false }, 401);
      }
      if (!validRequestId(body.request_id) || !body.envelope ||
          !body.envelope.salt || !body.envelope.iv || !body.envelope.data) {
        return json({ ok: false }, 400);
      }
      await env.STATUS_KV.put(
        "status:" + body.request_id,
        JSON.stringify(body.envelope),
        { expirationTtl: STATUS_TTL }
      );
      return json({ ok: true }, 200);
    }

    if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) {
      return json({ ok: false, message: "Origem nao autorizada." }, 403);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    if (!env.ACCESS_PASSWORD || env.ACCESS_PASSWORD.length < 20) {
      return json({ ok: false, message: "Configuracao incompleta do painel." }, 503, origin);
    }

    let body;
    try { body = await request.json(); } catch {
      return json({ ok: false, message: "Pedido invalido." }, 400, origin);
    }
    if (!body || typeof body.password !== "string" ||
        !constantTimeEqual(body.password, env.ACCESS_PASSWORD)) {
      return json({ ok: false, message: "Palavra-passe incorreta." }, 401, origin);
    }

    if (url.pathname === "/api/status/read") {
      if (!env.STATUS_KV || !validRequestId(body.request_id)) {
        return json({ ok: false, message: "Pedido invalido." }, 400, origin);
      }
      if (!(await checkRateLimit(env, request, "read", 45))) {
        return json({ ok: false, message: "Demasiados pedidos. Aguarda um minuto." }, 429, origin);
      }
      const key = "status:" + body.request_id;
      const stored = await env.STATUS_KV.get(key);
      if (!stored) return json({ ok: false, pending: true }, 202, origin);
      await env.STATUS_KV.delete(key);
      try {
        const result = await decryptStatus(JSON.parse(stored), env.ACCESS_PASSWORD);
        return json({ ok: true, result }, 200, origin);
      } catch {
        return json({ ok: false, message: "Nao foi possivel ler o resultado." }, 500, origin);
      }
    }

    if (url.pathname !== "/api/action") return json({ ok: false, message: "Endereco nao encontrado." }, 404, origin);
    if (!env.GITHUB_TOKEN) return json({ ok: false, message: "Configuracao incompleta do painel." }, 503, origin);
    if (!["start", "stop", "status"].includes(body.action)) {
      return json({ ok: false, message: "Acao nao permitida." }, 400, origin);
    }
    if (!env.STATUS_KV) return json({ ok: false, message: "Binding STATUS_KV em falta." }, 503, origin);
    if (!(await checkRateLimit(env, request))) {
      return json({ ok: false, message: "Demasiados pedidos. Aguarda um minuto." }, 429, origin);
    }

    let file;
    let inputs = {};
    let message;
    if (body.action === "status") {
      if (!validRequestId(body.request_id)) return json({ ok: false, message: "Pedido invalido." }, 400, origin);
      await env.STATUS_KV.delete("status:" + body.request_id);
      file = "status-mc-server.yml";
      inputs = { request_id: body.request_id };
      message = "Pedido de verificacao do servidor enviado.";
    } else {
      const workflow = WORKFLOWS[body.action];
      file = workflow.file;
      inputs = workflow.inputs;
      message = workflow.message;
    }

    const response = await dispatchWorkflow(env, file, inputs);
    if (!response.ok) {
      return json({ ok: false, message: "O GitHub nao aceitou o pedido. Tenta novamente mais tarde." }, 502, origin);
    }
    return json({ ok: true, message }, 202, origin);
  }
};