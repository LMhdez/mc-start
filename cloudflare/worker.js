const REPO = "LMhdez/mc-start";
const API_VERSION = "2022-11-28";

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
  },
  status: {
    file: "status-mc-server.yml",
    inputs: {},
    message: "Pedido de verificacao do servidor enviado."
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

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");

    if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) {
      return json({ ok: false, message: "Origem nao autorizada." }, 403);
    }

    const url = new URL(request.url);

    if (url.pathname !== "/api/action") {
      return json({ ok: false, message: "Endereco nao encontrado." }, 404, origin);
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

    if (request.method !== "POST") {
      return json({ ok: false, message: "Metodo nao permitido." }, 405, origin);
    }

    if (!env.GITHUB_TOKEN || !env.ACCESS_PASSWORD || env.ACCESS_PASSWORD.length < 20) {
      return json({ ok: false, message: "Configuracao incompleta do painel." }, 503, origin);
    }

    if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) {
      return json({ ok: false, message: "Pedido invalido." }, 415, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, message: "Pedido invalido." }, 400, origin);
    }

    if (!body || typeof body.password !== "string" || typeof body.action !== "string") {
      return json({ ok: false, message: "Pedido invalido." }, 400, origin);
    }

    if (!constantTimeEqual(body.password, env.ACCESS_PASSWORD)) {
      return json({ ok: false, message: "Palavra-passe incorreta." }, 401, origin);
    }

    const workflow = WORKFLOWS[body.action];
    if (!workflow) {
      return json({ ok: false, message: "Acao nao permitida." }, 400, origin);
    }

    const response = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${workflow.file}/dispatches`,
      {
        method: "POST",
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
          "X-GitHub-Api-Version": API_VERSION,
          "Content-Type": "application/json",
          "User-Agent": "mc-start-control-worker"
        },
        body: JSON.stringify({ ref: "main", inputs: workflow.inputs })
      }
    );

    if (!response.ok) {
      // Nao devolver a resposta do GitHub: evita expor detalhes internos.
      return json({ ok: false, message: "O GitHub nao aceitou o pedido. Tenta novamente mais tarde." }, 502, origin);
    }

    return json({ ok: true, message: workflow.message }, 202, origin);
  }
};
