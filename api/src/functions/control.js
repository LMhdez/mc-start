const { app } = require("@azure/functions");
const { timingSafeEqual } = require("node:crypto");

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

app.http("control", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "control",
  handler: async (request, context) => {
    const expectedOrigin = process.env.ALLOWED_ORIGIN;
    const origin = request.headers.get("origin");

    // The browser origin is an additional restriction, not the authentication mechanism.
    if (!expectedOrigin || origin !== expectedOrigin) {
      return { status: 403, jsonBody: { error: "Origem não autorizada." } };
    }

    const expectedKey = process.env.LAUNCHER_KEY;
    const suppliedKey = request.headers.get("x-launcher-key");

    if (!expectedKey || !safeEqual(suppliedKey, expectedKey)) {
      return { status: 401, jsonBody: { error: "Código de acesso inválido." } };
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, jsonBody: { error: "Pedido inválido." } };
    }

    const eventTypes = {
      start: "start-mc-server",
      stop: "stop-mc-server"
    };
    const eventType = eventTypes[body?.action];

    if (!eventType) {
      return { status: 400, jsonBody: { error: "Ação não permitida." } };
    }

    const githubToken = process.env.GITHUB_DISPATCH_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    if (!githubToken || !owner || !repo) {
      context.error("A configuração do serviço está incompleta.");
      return { status: 503, jsonBody: { error: "Serviço temporariamente indisponível." } };
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/dispatches`,
        {
          method: "POST",
          headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${githubToken}`,
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ event_type: eventType })
        }
      );

      if (response.status !== 204) {
        // Do not log response bodies or credentials.
        context.error(`GitHub dispatch falhou com HTTP ${response.status}.`);
        return { status: 502, jsonBody: { error: "Não foi possível enviar o pedido ao GitHub." } };
      }

      context.log(`Pedido autorizado enviado: ${body.action}.`);
      return {
        status: 202,
        jsonBody: { message: body.action === "start" ? "Pedido para ligar enviado." : "Pedido para desligar enviado." }
      };
    } catch {
      context.error("Falha de comunicação com o GitHub.");
      return { status: 502, jsonBody: { error: "Falha de comunicação com o serviço." } };
    }
  }
});