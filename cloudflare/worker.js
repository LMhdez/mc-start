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

function validIPv4(value) {
  if (typeof value !== "string") return false;
  const parts = value.trim().split(".");
  return parts.length === 4 && parts.every(part =>
    /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255
  );
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
  if (!tokenResponse.ok) throw new Error("Azure token request failed");
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
  if (!vmResponse.ok) throw new Error("Azure VM status request failed");
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

async function performAzureVmAction(env, action) {
  if (!["start", "deallocate"].includes(action)) {
    throw new Error("Azure VM action is not allowed");
  }
  const accessToken = await getAzureAccessToken(env);
  if (!accessToken) throw new Error("Azure credentials are incomplete");

  const response = await fetch(
    "https://management.azure.com/" + azureVmResource(env) + "/" + action + "?api-version=2024-07-01",
    {
      method: "POST",
      headers: { "Authorization": "Bearer " + accessToken }
    }
  );
  if (!response.ok && response.status !== 202) {
    throw new Error("Azure VM action failed with status " + response.status);
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const isStatusCallback = url.pathname === "/api/status-result";

    // Callbacks do GitHub Actions não vêm do navegador; autenticam-se pela palavra-passe.
    if (isStatusCallback) {
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

    // Endpoints publicos: nunca devolvem IP, nomes de jogadores ou dados de acesso.
    if (url.pathname === "/api/public/status" && request.method === "GET") {
      try {
        const vm = await getAzureVmPowerState(env);
        let result = {
          vm: vm || "Unknown",
          players: 0,
          docker: "unknown",
          container: "unknown",
          port_open: false,
          checked_at: new Date().toISOString()
        };
        if (vm === "VM running") {
          try {
            const agent = await callPrivateAgent(env, "/status");
            const live = agent.result || {};
            result = {
              vm: "VM running",
              players: Number.isFinite(Number(live.players)) ? Number(live.players) : 0,
              docker: live.docker || "unknown",
              container: live.container || "unknown",
              port_open: Boolean(live.port_open),
              checked_at: live.checked_at || result.checked_at
            };
          } catch (error) {
            console.error("Estado publico: agente indisponivel:", error.message);
          }
        }
        return json({ ok: true, result }, 200, origin);
      } catch (error) {
        console.error("Consulta publica falhou:", error.message);
        return json({ ok: false, message: "Nao foi possivel consultar o estado." }, 503, origin);
      }
    }

    if (url.pathname === "/api/technical" && request.method === "GET") {
      if (!env.STATUS_KV) return json({ ok: false, message: "Cache indisponivel." }, 503, origin);
      const cacheKey = "technical:public";
      let cached = null;
      const stored = await env.STATUS_KV.get(cacheKey);
      if (stored) {
        try { cached = JSON.parse(stored); }
        catch { await env.STATUS_KV.delete(cacheKey); }
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

        // Sem expirationTtl: a ultima fotografia permanece disponivel mesmo apos longos periodos offline.
        await env.STATUS_KV.put(cacheKey, JSON.stringify(technical));
        return json({ ok: true, result: technical, cached: false }, 200, origin);
      } catch (error) {
        console.error("Consulta tecnica indisponivel:", error.message);
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
            console.error("Agente privado indisponivel; a usar GitHub Actions:", error.message);
          }
        }
      } catch (error) {
        console.error("Consulta direta Azure falhou; a usar GitHub Actions:", error.message);
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

    // Ligar e desligar diretamente pela API do Azure. As Actions ficam como fallback.
    if (body.action === "start") {
      try {
        const vmState = await getAzureVmPowerState(env);
        if (vmState === "VM running" || vmState === "VM starting") {
          return json({ ok: true, message: "O servidor ja esta ligado ou a iniciar." }, 200, origin);
        }
        await performAzureVmAction(env, "start");
        return json({ ok: true, message: "Pedido para ligar o servidor enviado diretamente ao Azure." }, 202, origin);
      } catch (error) {
        console.error("Arranque direto Azure falhou; a usar GitHub Actions:", error.message);
        file = WORKFLOWS.start.file;
        inputs = WORKFLOWS.start.inputs;
        message = WORKFLOWS.start.message;
      }
    } else if (body.action === "stop") {
      try {
        const vmState = await getAzureVmPowerState(env);
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
        await performAzureVmAction(env, "deallocate");
        return json({ ok: true, message: "Pedido para desligar o servidor enviado diretamente ao Azure." }, 202, origin);
      } catch (error) {
        console.error("Desligamento direto nao concluido; a usar GitHub Actions:", error.message);
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