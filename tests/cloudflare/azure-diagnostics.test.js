import worker from "../../cloudflare/worker.js";
import { afterEach, describe, expect, it, vi } from "vitest";

const bindings = () => ({
  ALLOWED_ORIGIN: "https://lmhdez.github.io",
  STATUS_KV: {},
  AZURE_CLIENT_ID: "test-client-id",
  AZURE_CLIENT_SECRET: "test-only-secret",
  AZURE_TENANT_ID: "test-tenant-id",
  AZURE_SUBSCRIPTION_ID: "test-subscription-id",
  AZURE_RESOURCE_GROUP: "test-resource-group",
  AZURE_VM_NAME: "test-vm"
});

function statusRequest(ip) {
  return new Request("https://worker.example/api/public/status", {
    method: "GET",
    headers: {
      Origin: "https://lmhdez.github.io",
      "CF-Connecting-IP": ip
    }
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Azure diagnostics for public Worker status", () => {
  it("includes the public maintenance state in the same status response", async () => {
    const rawFetch = vi.fn(async input => {
      const url = String(input);
      if (url === "https://raw.githubusercontent.com/LMhdez/mc-start/main/maintenance.json") {
        return Response.json({ enabled: true, message: "Manutenção programada." });
      }
      if (url.startsWith("https://login.microsoftonline.com/")) {
        return Response.json({ error: "invalid_client" }, { status: 401 });
      }
      throw new Error("Unexpected request");
    });
    vi.stubGlobal("fetch", rawFetch);
    const response = await worker.fetch(statusRequest("192.0.2.86"), bindings());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      result: { vm: "Unknown", maintenance: { enabled: true, message: "Manutenção programada." } }
    });
    expect(rawFetch).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/LMhdez/mc-start/main/maintenance.json",
      { headers: { "Accept": "application/json" }, cf: { cacheTtl: 30, cacheEverything: true } }
    );
  });

  it("logs only the HTTP status and safe OAuth error code", async () => {
    vi.stubGlobal("fetch", vi.fn(async input => {
      if (String(input).startsWith("https://login.microsoftonline.com/")) {
        return Response.json({
          error: "invalid_client",
          error_description: "NEVER LOG THIS OAUTH DESCRIPTION"
        }, { status: 401 });
      }
      throw new Error("Unexpected request");
    }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await worker.fetch(statusRequest("192.0.2.81"), bindings());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, result: { vm: "Unknown" } });
    expect(log).toHaveBeenCalledWith(
      "Estado publico: Azure indisponivel; estado da VM desconhecido:",
      "Azure token request failed (HTTP 401, invalid_client)"
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain("NEVER LOG THIS OAUTH DESCRIPTION");
    expect(JSON.stringify(log.mock.calls)).not.toContain("test-only-secret");
  });

  it("logs only the HTTP status and safe ARM error code", async () => {
    vi.stubGlobal("fetch", vi.fn(async input => {
      const url = String(input);
      if (url.startsWith("https://login.microsoftonline.com/")) {
        return Response.json({ access_token: "test-only-token" });
      }
      if (url.startsWith("https://management.azure.com/")) {
        return Response.json({
          error: {
            code: "AuthorizationFailed",
            message: "NEVER LOG THIS ARM ERROR DESCRIPTION"
          }
        }, { status: 403 });
      }
      throw new Error("Unexpected request");
    }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await worker.fetch(statusRequest("192.0.2.82"), bindings());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, result: { vm: "Unknown" } });
    expect(log).toHaveBeenCalledWith(
      "Estado publico: Azure indisponivel; estado da VM desconhecido:",
      "Azure VM status request failed (HTTP 403, AuthorizationFailed)"
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain("NEVER LOG THIS ARM ERROR DESCRIPTION");
    expect(JSON.stringify(log.mock.calls)).not.toContain("test-only-token");
    expect(JSON.stringify(log.mock.calls)).not.toContain("test-only-secret");
  });

  it("omits malformed Azure error codes instead of logging arbitrary text", async () => {
    vi.stubGlobal("fetch", vi.fn(async input => {
      const url = String(input);
      if (url.startsWith("https://login.microsoftonline.com/")) {
        return Response.json({ access_token: "test-only-token" });
      }
      if (url.startsWith("https://management.azure.com/")) {
        return Response.json({
          error: {
            code: "AuthorizationFailed: NEVER LOG THIS",
            message: "NEVER LOG THIS ARM ERROR DESCRIPTION"
          }
        }, { status: 403 });
      }
      throw new Error("Unexpected request");
    }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await worker.fetch(statusRequest("192.0.2.83"), bindings());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, result: { vm: "Unknown" } });
    expect(log).toHaveBeenCalledWith(
      "Estado publico: Azure indisponivel; estado da VM desconhecido:",
      "Azure VM status request failed (HTTP 403)"
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain("NEVER LOG THIS");
  });

  it("redacts unexpected fetch exceptions instead of logging their message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network failure with confidential tenant and credential material");
    }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await worker.fetch(statusRequest("192.0.2.84"), bindings());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, result: { vm: "Unknown" } });
    expect(log).toHaveBeenCalledWith(
      "Estado publico: Azure indisponivel; estado da VM desconhecido:",
      "Unexpected Azure status error"
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain("confidential tenant");
    expect(JSON.stringify(log.mock.calls)).not.toContain("credential material");
  });

  it("redacts unexpected private-agent errors from public status logs", async () => {
    vi.stubGlobal("fetch", vi.fn(async input => {
      const url = String(input);
      if (url.startsWith("https://login.microsoftonline.com/")) {
        return Response.json({ access_token: "test-only-token" });
      }
      if (url.startsWith("https://management.azure.com/")) {
        return Response.json({
          statuses: [{ code: "PowerState/running" }]
        });
      }
      throw new Error("Unexpected request");
    }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const env = bindings();
    env.MC_AGENT = {
      fetch: vi.fn(async () => {
        throw new Error("confidential agent endpoint credential material");
      })
    };

    const response = await worker.fetch(statusRequest("192.0.2.85"), env);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, result: { vm: "VM running" } });
    expect(log).toHaveBeenCalledWith(
      "Estado publico: agente indisponivel:",
      "Unexpected internal error"
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain("confidential agent endpoint credential material");
    expect(JSON.stringify(log.mock.calls)).not.toContain("test-only-token");
    expect(JSON.stringify(log.mock.calls)).not.toContain("test-only-secret");
  });
});


const ACTION_PASSWORD = "test-panel-password-with-more-than-20-chars";

function actionRequest(action, password = ACTION_PASSWORD, ip = "192.0.2.90") {
  return new Request("https://worker.example/api/action", {
    method: "POST",
    headers: {
      Origin: "https://lmhdez.github.io",
      "Content-Type": "application/json",
      "CF-Connecting-IP": ip
    },
    body: JSON.stringify({ action, password })
  });
}

function actionBindings() {
  return {
    ...bindings(),
    ACCESS_PASSWORD: ACTION_PASSWORD,
    GITHUB_TOKEN: "test-github-token"
  };
}

describe("explicit Azure-first VM start", () => {
  it("rejects unauthenticated start requests before contacting Azure or GitHub", async () => {
    const network = vi.fn();
    vi.stubGlobal("fetch", network);

    const response = await worker.fetch(actionRequest("start", "wrong-password"), actionBindings());

    expect(response.status).toBe(401);
    expect(network).not.toHaveBeenCalled();
  });

  it("starts a deallocated VM directly through Azure without dispatching GitHub Actions", async () => {
    const network = vi.fn(async (input, init = {}) => {
      const url = String(input);
      if (url.startsWith("https://login.microsoftonline.com/")) {
        return Response.json({ access_token: "test-azure-token" });
      }
      if (url.includes("/instanceView?")) {
        return Response.json({ statuses: [{ code: "PowerState/deallocated" }] });
      }
      if (url.endsWith("/start?api-version=2024-07-01") && init.method === "POST") {
        return new Response(null, { status: 202 });
      }
      throw new Error("Unexpected network request");
    });
    vi.stubGlobal("fetch", network);

    const response = await worker.fetch(actionRequest("start", ACTION_PASSWORD, "192.0.2.91"), actionBindings());

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(network.mock.calls.some(([url]) => String(url).includes("api.github.com/repos/LMhdez/mc-start/actions/workflows/"))).toBe(false);
    expect(network.mock.calls.some(([url, init]) =>
      String(url).endsWith("/start?api-version=2024-07-01") && init?.method === "POST"
    )).toBe(true);
  });

  it("does not dispatch a second start while Azure reports the VM stopping", async () => {
    const network = vi.fn(async input => {
      const url = String(input);
      if (url.startsWith("https://login.microsoftonline.com/")) {
        return Response.json({ access_token: "test-azure-token" });
      }
      if (url.includes("/instanceView?")) {
        return Response.json({ statuses: [{ code: "PowerState/stopping" }] });
      }
      throw new Error("Unexpected network request");
    });
    vi.stubGlobal("fetch", network);

    const response = await worker.fetch(actionRequest("start", ACTION_PASSWORD, "192.0.2.92"), actionBindings());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ ok: false });
    expect(network.mock.calls.some(([url]) => String(url).includes("api.github.com/repos/LMhdez/mc-start/actions/workflows/"))).toBe(false);
    expect(network.mock.calls.some(([url]) => String(url).endsWith("/start?api-version=2024-07-01"))).toBe(false);
  });

  it("falls back to the confirmed GitHub workflow when Azure authentication fails", async () => {
    const network = vi.fn(async (input, init = {}) => {
      const url = String(input);
      if (url.startsWith("https://login.microsoftonline.com/")) {
        return Response.json({ error: "temporarily_unavailable" }, { status: 503 });
      }
      if (url === "https://api.github.com/repos/LMhdez/mc-start/actions/workflows/start-vm.yml/dispatches") {
        expect(init.method).toBe("POST");
        const payload = JSON.parse(init.body);
        expect(payload).toMatchObject({
          ref: "main",
          inputs: { notificar: "Painel web", confirmar_arranque: "true" }
        });
        return new Response(null, { status: 204 });
      }
      throw new Error("Unexpected network request");
    });
    vi.stubGlobal("fetch", network);

    const response = await worker.fetch(actionRequest("start", ACTION_PASSWORD, "192.0.2.93"), actionBindings());

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(network.mock.calls.some(([url]) => String(url).includes("/actions/workflows/start-vm.yml/dispatches"))).toBe(true);
  });

  it("does not start the VM when a public status read is made", async () => {
    const network = vi.fn(async input => {
      const url = String(input);
      if (url.startsWith("https://raw.githubusercontent.com/")) {
        return Response.json({ enabled: false, message: "" });
      }
      if (url.startsWith("https://login.microsoftonline.com/")) {
        return Response.json({ access_token: "test-azure-token" });
      }
      if (url.includes("/instanceView?")) {
        return Response.json({ statuses: [{ code: "PowerState/deallocated" }] });
      }
      throw new Error("Unexpected network request");
    });
    vi.stubGlobal("fetch", network);

    const response = await worker.fetch(statusRequest("192.0.2.94"), actionBindings());

    expect(response.status).toBe(200);
    expect(network.mock.calls.some(([url, init]) =>
      String(url).endsWith("/start?api-version=2024-07-01") || init?.method === "POST" && String(url).includes("/actions/workflows/")
    )).toBe(false);
  });
});
