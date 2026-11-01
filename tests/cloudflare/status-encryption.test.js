import worker from "../../cloudflare/worker.js";
import "../../status-crypto.js";
import { describe, expect, it, vi } from "vitest";

const PASSWORD = "test-only-password-with-more-than-20-chars";
const ORIGIN = "https://panel.example";

async function createEnvelope(value, password = PASSWORD) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(value))
  ));
  const encode = bytes => btoa(String.fromCharCode(...bytes));
  return {
    salt: encode(salt),
    iv: encode(iv),
    data: encode(encrypted)
  };
}

function statusReadRequest(password = PASSWORD) {
  return new Request("https://worker.example/api/status/read", {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      "Content-Type": "application/json",
      "CF-Connecting-IP": "192.0.2.25"
    },
    body: JSON.stringify({ password, request_id: "123e4567-e89b-42d3-a456-426614174000" })
  });
}

describe("private status envelope flow", () => {
  it("decrypts the existing PBKDF2-SHA256 and AES-256-GCM envelope in the browser", async () => {
    const expected = {
      vm: "VM running",
      ip: "192.0.2.10",
      players: 1,
      player_names: ["TestPlayer"]
    };
    const envelope = await createEnvelope(expected);

    await expect(globalThis.decryptPrivateStatus(envelope, PASSWORD)).resolves.toEqual(expected);
  });

  it("rejects a tampered AES-GCM ciphertext", async () => {
    const envelope = await createEnvelope({ vm: "VM running" });
    const bytes = Uint8Array.from(atob(envelope.data), character => character.charCodeAt(0));
    bytes[0] ^= 1;
    envelope.data = btoa(String.fromCharCode(...bytes));

    await expect(globalThis.decryptPrivateStatus(envelope, PASSWORD)).rejects.toThrow();
  });

  it("returns only the encrypted envelope after password authentication", async () => {
    const envelope = await createEnvelope({ vm: "VM running", players: 1 });
    const get = vi.fn(async () => JSON.stringify(envelope));
    const response = await worker.fetch(statusReadRequest(), {
      ACCESS_PASSWORD: PASSWORD,
      ALLOWED_ORIGIN: ORIGIN,
      STATUS_KV: { get }
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, envelope });
    expect(body.result).toBeUndefined();
    expect(get).toHaveBeenCalledOnce();
  });

  it("does not read KV when the supplied password is incorrect", async () => {
    const get = vi.fn(async () => null);
    const response = await worker.fetch(statusReadRequest("incorrect-password"), {
      ACCESS_PASSWORD: PASSWORD,
      ALLOWED_ORIGIN: ORIGIN,
      STATUS_KV: { get }
    });

    expect(response.status).toBe(401);
    expect(get).not.toHaveBeenCalled();
  });

  it("rejects malformed stored envelopes without returning their contents", async () => {
    const get = vi.fn(async () => JSON.stringify({ salt: 123, iv: "iv", data: "data" }));
    const response = await worker.fetch(statusReadRequest(), {
      ACCESS_PASSWORD: PASSWORD,
      ALLOWED_ORIGIN: ORIGIN,
      STATUS_KV: { get }
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      message: "Nao foi possivel ler o resultado."
    });
  });
});
