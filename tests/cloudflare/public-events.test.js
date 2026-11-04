import worker from "../../cloudflare/worker.js";
import { afterEach, describe, expect, it, vi } from "vitest";

const origin = "https://lmhdez.github.io";

function request(path = "/api/public/events", method = "GET", requestOrigin = origin) {
  return new Request("https://worker.example" + path, {
    method,
    headers: {
      Origin: requestOrigin,
      "CF-Connecting-IP": "192.0.2.91"
    }
  });
}

function bindings(agent) {
  return {
    ALLOWED_ORIGIN: origin,
    AZURE_CLIENT_ID: "test-client-id",
    AZURE_CLIENT_SECRET: "test-only-secret",
    AZURE_TENANT_ID: "test-tenant-id",
    AZURE_SUBSCRIPTION_ID: "test-subscription-id",
    AZURE_RESOURCE_GROUP: "test-resource-group",
    AZURE_VM_NAME: "test-vm",
    MC_AGENT: agent
  };
}

function mockAzure(powerState = "PowerState/running") {
  vi.stubGlobal("fetch", vi.fn(async input => {
    const url = String(input);
    if (url.startsWith("https://login.microsoftonline.com/")) {
      return Response.json({ access_token: "test-only-token" });
    }
    if (url.startsWith("https://management.azure.com/")) {
      return Response.json({ statuses: [{ code: powerState }] });
    }
    throw new Error("Unexpected external request");
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("public player SSE endpoint", () => {
  it("rejects unapproved origins before Azure or agent access", async () => {
    const agent = { fetch: vi.fn() };
    const response = await worker.fetch(request("/api/public/events", "GET", "https://attacker.example"), bindings(agent));
    expect(response.status).toBe(403);
    expect(agent.fetch).not.toHaveBeenCalled();
  });

  it("streams the authoritative Azure power state without contacting or controlling the VM", async () => {
    mockAzure("PowerState/deallocated");
    const agent = { fetch: vi.fn() };
    const response = await worker.fetch(request(), bindings(agent));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(agent.fetch).not.toHaveBeenCalled();
    const body = await response.text();
    expect(body).toContain("event: status\ndata: ");
    expect(body).toContain('"vm":"VM deallocated"');
    const dataLine = body.split("\n").find(line => line.startsWith("data: "));
    const payload = JSON.parse(dataLine.slice(6));
    expect(payload.checked_at).toEqual(expect.any(String));
    expect(body.endsWith("\n\n")).toBe(true);
  });

  it("forwards the agent event stream without buffering or exposing private data", async () => {
    mockAzure();
    const payload = 'event: status\ndata: {"vm":"VM running","players":2}\n\n';
    const agent = {
      fetch: vi.fn(async upstreamRequest => {
        expect(new URL(upstreamRequest.url).pathname).toBe("/events");
        expect(upstreamRequest.headers.get("Accept")).toBe("text/event-stream");
        return new Response(payload, {
          headers: { "Content-Type": "text/event-stream" }
        });
      })
    };
    const response = await worker.fetch(request(), bindings(agent));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(await response.text()).toBe(payload);
    expect(agent.fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects methods other than GET without contacting Azure or the agent", async () => {
    const agent = { fetch: vi.fn() };
    const response = await worker.fetch(request("/api/public/events", "POST"), bindings(agent));
    expect(response.status).toBe(405);
    expect(agent.fetch).not.toHaveBeenCalled();
  });
});
