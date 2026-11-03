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
  it("redacts unexpected fetch exceptions instead of logging their message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network failure with confidential tenant and credential material");
    }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await worker.fetch(statusRequest("192.0.2.84"), bindings());

    expect(response.status).toBe(503);
    expect(log).toHaveBeenCalledWith(
      "Consulta publica falhou:",
      "Unexpected Azure status error"
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain("confidential tenant");
    expect(JSON.stringify(log.mock.calls)).not.toContain("credential material");
  });

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

    expect(response.status).toBe(503);
    expect(log).toHaveBeenCalledWith(
      "Consulta publica falhou:",
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

    expect(response.status).toBe(503);
    expect(log).toHaveBeenCalledWith(
      "Consulta publica falhou:",
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

    expect(response.status).toBe(503);
    expect(log).toHaveBeenCalledWith(
      "Consulta publica falhou:",
      "Azure VM status request failed (HTTP 403)"
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain("NEVER LOG THIS");
  });
});
