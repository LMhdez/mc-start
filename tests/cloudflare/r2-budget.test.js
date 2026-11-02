import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import worker from "../../cloudflare/worker.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const OBJECT_KEY = "technical/latest.json";
const MAX_OBJECT_BYTES = 256 * 1024;

async function createBudget() {
  const id = env.R2_BUDGET.idFromName("r2-budget-test-" + crypto.randomUUID());
  return env.R2_BUDGET.get(id);
}

function currentKeys() {
  const day = new Date().toISOString().slice(0, 10);
  return { day, month: day.slice(0, 7) };
}

async function seedCounters(stub, values = {}) {
  const { day, month } = currentKeys();
  await runInDurableObject(stub, (_instance, state) => {
    state.storage.sql.exec(
      `UPDATE r2_budget
       SET day_key = ?, month_key = ?, daily_reads = ?, monthly_reads = ?,
           daily_writes = ?, monthly_writes = ?, migration_retry_after = ?
       WHERE id = 1`,
      values.dayKey ?? day,
      values.monthKey ?? month,
      values.dailyReads ?? 0,
      values.monthlyReads ?? 0,
      values.dailyWrites ?? 0,
      values.monthlyWrites ?? 0,
      values.migrationRetryAfter ?? 0
    );
  });
}

async function readCounters(stub) {
  return runInDurableObject(stub, (_instance, state) =>
    state.storage.sql.exec(
      `SELECT day_key, month_key, daily_reads, monthly_reads,
              daily_writes, monthly_writes, migration_retry_after
       FROM r2_budget WHERE id = 1`
    ).one()
  );
}

describe("R2Budget Durable Object", () => {
  let stub;

  beforeEach(async () => {
    await env.TECHNICAL_BUCKET.delete(OBJECT_KEY);
    stub = await createBudget();
  });


  it("prefers a newer shared KV snapshot when the R2 budget is unavailable", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
    try {
      const oldSnapshot = {
        checked_at: new Date(Date.now() - 60_000).toISOString(),
        mods_inventory_available: true,
        version: "old"
      };
      const freshSnapshot = {
        checked_at: new Date().toISOString(),
        mods_inventory_available: true,
        version: "fresh"
      };
      let reads = 0;
      const bindings = {
        ALLOWED_ORIGIN: "https://panel.example",
        TECHNICAL_BUCKET: {},
        R2_BUDGET: {
          getByName() {
            return {
              async readSnapshot() {
                reads += 1;
                return reads === 1
                  ? { ok: true, snapshot: oldSnapshot, serialized: JSON.stringify(oldSnapshot) }
                  : { ok: false, reason: "budget_exhausted" };
              },
              async writeSnapshot() {
                return { ok: false, reason: "budget_exhausted" };
              }
            };
          }
        },
        STATUS_KV: {
          async get() {
            return JSON.stringify(freshSnapshot);
          }
        }
      };
      const request = () => new Request("https://worker.example/api/technical", {
        method: "GET",
        headers: {
          Origin: "https://panel.example",
          "CF-Connecting-IP": "192.0.2.10"
        }
      });

      const first = await worker.fetch(request(), bindings);
      expect((await first.json()).result.version).toBe("old");

      await vi.advanceTimersByTimeAsync(61_000);
      const second = await worker.fetch(request(), bindings);
      expect((await second.json()).result.version).toBe("fresh");
    } finally {
      vi.useRealTimers();
    }
  });

  it("reserves R2 reads and writes in persistent SQLite counters", async () => {
    const snapshot = { server: "online", players: 2 };
    expect((await stub.writeSnapshot(JSON.stringify(snapshot))).written).toBe(true);
    expect((await stub.readSnapshot()).snapshot).toEqual(snapshot);

    const counters = await readCounters(stub);
    expect(counters.daily_reads).toBe(1);
    expect(counters.monthly_reads).toBe(1);
    expect(counters.daily_writes).toBe(1);
    expect(counters.monthly_writes).toBe(1);
  });

  it("stops reads at the global daily limit", async () => {
    await seedCounters(stub, { dailyReads: 2999, monthlyReads: 100 });

    expect((await stub.readSnapshot()).ok).toBe(true);
    expect(await stub.readSnapshot()).toEqual({ ok: false, reason: "budget_exhausted" });

    const counters = await readCounters(stub);
    expect(counters.daily_reads).toBe(3000);
  });

  it("stops reads at the global monthly limit", async () => {
    await seedCounters(stub, { dailyReads: 0, monthlyReads: 89999 });

    expect((await stub.readSnapshot()).ok).toBe(true);
    expect(await stub.readSnapshot()).toEqual({ ok: false, reason: "budget_exhausted" });

    const counters = await readCounters(stub);
    expect(counters.monthly_reads).toBe(90000);
  });

  it("stops writes at the global daily limit", async () => {
    await seedCounters(stub, { dailyWrites: 9, monthlyWrites: 50 });

    expect((await stub.writeSnapshot('{"v":1}')).written).toBe(true);
    expect(await stub.writeSnapshot('{"v":2}')).toEqual({
      ok: false, reason: "budget_exhausted"
    });

    const counters = await readCounters(stub);
    expect(counters.daily_writes).toBe(10);
  });

  it("stops writes at the global monthly limit", async () => {
    await seedCounters(stub, { dailyWrites: 0, monthlyWrites: 299 });

    expect((await stub.writeSnapshot('{"v":1}')).written).toBe(true);
    expect(await stub.writeSnapshot('{"v":2}')).toEqual({
      ok: false, reason: "budget_exhausted"
    });

    const counters = await readCounters(stub);
    expect(counters.monthly_writes).toBe(300);
  });

  it("enforces the daily limit atomically under concurrent requests", async () => {
    await seedCounters(stub, { dailyReads: 2990, monthlyReads: 100 });

    const results = await Promise.all(
      Array.from({ length: 20 }, () => stub.readSnapshot())
    );

    expect(results.filter(result => result.ok).length).toBe(10);
    expect(results.filter(result => result.reason === "budget_exhausted").length).toBe(10);
    expect((await readCounters(stub)).daily_reads).toBe(3000);
  });

  it("resets monthly counters when the UTC month changes", async () => {
    const { month } = currentKeys();
    const [year, monthNumber] = month.split("-").map(Number);
    const previousMonthDate = new Date(Date.UTC(year, monthNumber - 2, 1));
    const previousMonth = previousMonthDate.toISOString().slice(0, 7);

    await seedCounters(stub, {
      dayKey: previousMonth + "-01",
      monthKey: previousMonth,
      dailyReads: 3000,
      monthlyReads: 90000,
      dailyWrites: 10,
      monthlyWrites: 300
    });

    expect((await stub.readSnapshot()).ok).toBe(true);
    const counters = await readCounters(stub);
    expect(counters.month_key).toBe(month);
    expect(counters.monthly_reads).toBe(1);
    expect(counters.daily_reads).toBe(1);
  });

  it("rejects malformed JSON and non-object snapshots on reads", async () => {
    await env.TECHNICAL_BUCKET.put(OBJECT_KEY, "{not-json");
    expect(await stub.readSnapshot()).toEqual({ ok: false, reason: "invalid_json" });

    await env.TECHNICAL_BUCKET.put(OBJECT_KEY, "[]");
    expect(await stub.readSnapshot()).toEqual({ ok: false, reason: "invalid_snapshot" });
  });

  it("rejects objects larger than 256 KiB on reads and writes", async () => {
    await env.TECHNICAL_BUCKET.put(OBJECT_KEY, "x".repeat(MAX_OBJECT_BYTES + 1));
    expect(await stub.readSnapshot()).toEqual({ ok: false, reason: "object_too_large" });

    const before = await readCounters(stub);
    expect(await stub.writeSnapshot("x".repeat(MAX_OBJECT_BYTES + 1))).toEqual({
      ok: false, reason: "object_too_large"
    });
    const after = await readCounters(stub);
    expect(after.daily_writes).toBe(before.daily_writes);
    expect(after.monthly_writes).toBe(before.monthly_writes);
  });

  it("persists the conditional migration backoff and skips repeated writes", async () => {
    const first = await stub.writeSnapshot('{"legacy":true}', true);
    const second = await stub.writeSnapshot('{"legacy":true}', true);

    expect(first).toEqual({ ok: true, written: true });
    expect(second).toEqual({ ok: true, written: false, skipped: true });
    const counters = await readCounters(stub);
    expect(counters.daily_writes).toBe(1);
    expect(counters.migration_retry_after).toBeGreaterThan(Date.now());
  });
  it("does not write technical snapshots to KV when the configured R2 budget is unavailable", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 11 * 60 * 1000));
    vi.stubGlobal("fetch", vi.fn(async input => {
      const url = String(input);
      if (url.startsWith("https://login.microsoftonline.com/")) {
        return Response.json({ access_token: "test-only-token" });
      }
      if (url.startsWith("https://management.azure.com/")) {
        return Response.json({ statuses: [{ code: "PowerState/running" }] });
      }
      throw new Error("Unexpected network request in isolated test");
    }));

    const freshSnapshot = {
      checked_at: new Date().toISOString(),
      mods_inventory_available: true,
      version: "live"
    };
    const kvPut = vi.fn(async () => undefined);
    const bindings = {
      ALLOWED_ORIGIN: "https://panel.example",
      AZURE_CLIENT_ID: "test-client",
      AZURE_CLIENT_SECRET: "test-secret",
      AZURE_TENANT_ID: "test-tenant",
      AZURE_SUBSCRIPTION_ID: "test-subscription",
      AZURE_RESOURCE_GROUP: "test-resource-group",
      AZURE_VM_NAME: "test-vm",
      TECHNICAL_BUCKET: {},
      R2_BUDGET: {
        getByName() {
          return {
            async readSnapshot() {
              return { ok: false, reason: "budget_exhausted" };
            },
            async writeSnapshot() {
              return { ok: false, reason: "budget_exhausted" };
            }
          };
        }
      },
      STATUS_KV: {
        async get() { return null; },
        put: kvPut
      },
      MC_AGENT: {
        async fetch() {
          return Response.json({ ok: true, result: freshSnapshot });
        }
      }
    };
    const request = new Request("https://worker.example/api/technical", {
      method: "GET",
      headers: {
        Origin: "https://panel.example",
        "CF-Connecting-IP": "192.0.2.30"
      }
    });

    try {
      const response = await worker.fetch(request, bindings);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({ ok: true, cached: false, result: freshSnapshot });
      expect(kvPut).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("stores and reads encrypted status results through SQLite without KV", async () => {
    const requestId = crypto.randomUUID();
    const envelope = {
      salt: "test-salt",
      iv: "test-iv",
      data: "test-ciphertext"
    };
    const kvGet = vi.fn(async () => {
      throw new Error("KV read must not be used for status results");
    });
    const kvPut = vi.fn(async () => {
      throw new Error("KV write must not be used for status results");
    });
    const bindings = {
      ACCESS_PASSWORD: "test-password-for-status-flow",
      ALLOWED_ORIGIN: "https://panel.example",
      STATUS_KV: { get: kvGet, put: kvPut },
      R2_BUDGET: { getByName: () => stub }
    };

    const callback = await worker.fetch(new Request("https://worker.example/api/status-result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: requestId,
        password: bindings.ACCESS_PASSWORD,
        envelope
      })
    }), bindings);
    expect(callback.status).toBe(200);
    expect(await callback.json()).toEqual({ ok: true });

    const read = await worker.fetch(new Request("https://worker.example/api/status/read", {
      method: "POST",
      headers: {
        Origin: bindings.ALLOWED_ORIGIN,
        "Content-Type": "application/json",
        "CF-Connecting-IP": "192.0.2.44"
      },
      body: JSON.stringify({
        request_id: requestId,
        password: bindings.ACCESS_PASSWORD
      })
    }), bindings);
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual({ ok: true, envelope });
    expect(kvGet).not.toHaveBeenCalled();
    expect(kvPut).not.toHaveBeenCalled();
  });

  it("expires encrypted status results after the configured TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T00:00:00Z"));
    try {
      const requestId = crypto.randomUUID();
      const envelope = {
        salt: "test-salt",
        iv: "test-iv",
        data: "test-ciphertext"
      };
      const stored = await stub.storeStatusResult(
        requestId,
        JSON.stringify(envelope),
        Date.now() + 300_000
      );
      expect(stored).toEqual({ ok: true });
      expect(await stub.readStatusResult(requestId)).toEqual({ ok: true, envelope });

      await vi.advanceTimersByTimeAsync(300_001);
      expect(await stub.readStatusResult(requestId)).toEqual({ ok: true, envelope: null });
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects invalid status envelopes and expiry values", async () => {
    const requestId = crypto.randomUUID();
    expect(await stub.storeStatusResult(requestId, "{invalid", Date.now() + 300_000))
      .toEqual({ ok: false, reason: "invalid_status_result" });
    expect(await stub.storeStatusResult(
      requestId,
      JSON.stringify({ salt: "s", iv: "i", data: "d" }),
      Date.now() - 1
    )).toEqual({ ok: false, reason: "invalid_status_expiry" });
    expect(await stub.readStatusResult("not-a-request-id"))
      .toEqual({ ok: false, reason: "invalid_request_id" });
  });

});
