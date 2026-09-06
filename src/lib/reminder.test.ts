// Unit tests for expiry reminder utilities (F-005)
import { describe, it, expect } from "vitest";
import { daysBetween, listExpiringContracts } from "./reminder";
import type { Contract } from "../types";

describe("daysBetween", () => {
  it("returns 0 for same day", () => {
    const a = new Date("2026-09-06T10:00:00Z");
    const b = new Date("2026-09-06T22:00:00Z");
    expect(daysBetween(a, b) + 0).toBe(0);
  });

  it("returns positive integer for future date", () => {
    const a = new Date("2026-09-10T00:00:00Z");
    const b = new Date("2026-09-06T00:00:00Z");
    expect(daysBetween(a, b)).toBe(4);
  });

  it("returns negative integer for past date", () => {
    const a = new Date("2026-09-01T00:00:00Z");
    const b = new Date("2026-09-06T00:00:00Z");
    expect(daysBetween(a, b)).toBe(-5);
  });

  it("handles 30-day difference", () => {
    const a = new Date("2026-10-06T00:00:00Z");
    const b = new Date("2026-09-06T00:00:00Z");
    expect(daysBetween(a, b)).toBe(30);
  });
});

// listExpiringContracts uses Dexie/IndexedDB. Use fake-indexeddb for unit test.
import "fake-indexeddb/auto";
import { saveContract, listContracts as _list } from "./storage";

const makeContract = (overrides: Partial<Contract>): Contract => ({
  id: overrides.id ?? `c-${Math.random().toString(36).slice(2, 9)}`,
  title: overrides.title ?? "Test contract",
  category: overrides.category ?? "other",
  counterparty: overrides.counterparty ?? "Test Party",
  expiresAt: overrides.expiresAt ?? "2026-12-31",
  riskScore: overrides.riskScore ?? "green",
  riskAnalysis: overrides.riskAnalysis ?? [],
  reminderDaysBefore: overrides.reminderDaysBefore ?? 30,
  isActive: overrides.isActive ?? true,
  clauses: overrides.clauses ?? [],
  createdAt: overrides.createdAt ?? new Date().toISOString(),
});

describe("listExpiringContracts", () => {
  it("includes contracts within the window", async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in60 = new Date(today);
    in60.setDate(today.getDate() + 60);

    const c = makeContract({ expiresAt: in60.toISOString().slice(0, 10) });
    await saveContract(c);

    const expiring = await listExpiringContracts(90);
    const found = expiring.find((e) => e.contract.id === c.id);
    expect(found).toBeDefined();
    expect(found?.daysUntilExpiry).toBeGreaterThanOrEqual(58);
    expect(found?.daysUntilExpiry).toBeLessThanOrEqual(60);
  });

  it("excludes inactive contracts", async () => {
    const today = new Date();
    const in30 = new Date(today);
    in30.setDate(today.getDate() + 30);
    const c = makeContract({
      id: "inactive-1",
      expiresAt: in30.toISOString().slice(0, 10),
      isActive: false,
    });
    await saveContract(c);

    const expiring = await listExpiringContracts(90);
    expect(expiring.find((e) => e.contract.id === "inactive-1")).toBeUndefined();
  });

  it("excludes contracts already expired", async () => {
    const c = makeContract({
      id: "expired-1",
      expiresAt: "2020-01-01",
    });
    await saveContract(c);
    const expiring = await listExpiringContracts(90);
    expect(expiring.find((e) => e.contract.id === "expired-1")).toBeUndefined();
  });

  it("sorts by daysUntilExpiry ascending", async () => {
    const today = new Date();
    const in10 = new Date(today);
    in10.setDate(today.getDate() + 10);
    const in80 = new Date(today);
    in80.setDate(today.getDate() + 80);

    await saveContract(
      makeContract({ id: "far-1", expiresAt: in80.toISOString().slice(0, 10) })
    );
    await saveContract(
      makeContract({ id: "near-1", expiresAt: in10.toISOString().slice(0, 10) })
    );

    const expiring = await listExpiringContracts(90);
    const ids = expiring.map((e) => e.contract.id);
    const nearIdx = ids.indexOf("near-1");
    const farIdx = ids.indexOf("far-1");
    if (nearIdx >= 0 && farIdx >= 0) {
      expect(nearIdx).toBeLessThan(farIdx);
    }
  });
});
