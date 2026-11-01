import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

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
    stub = await createBudget();
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
    const previousMonth = month === "2026-01" ? "2025-12" :
      String(Number(month.slice(0, 4)) - (month.endsWith("-01") ? 1 : 0)).padStart(4, "0") +
      "-" + String(month.endsWith("-01") ? 12 : Number(month.slice(5, 7)) - 1).padStart(2, "0");

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
});
