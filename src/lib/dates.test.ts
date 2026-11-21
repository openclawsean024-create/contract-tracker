// AC-006（Codex 審查 #5）：儀表板與寄件匣用同一個日曆日期基準；無效日期不得被正規化成別的日子。
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { addDaysKey, daysUntil, isValidDateKey, parseDateKey, toDateKey } from "./dates";
import { computeExpiring } from "./reminder";
import { dueThreshold } from "./reminderDispatch";
import { analyzeContract } from "./analyze";
import { makeTestContract } from "../test/factories";

describe("AC-006 嚴格的日期解析", () => {
  it("AC-006 不存在的日期回傳 null，不會被正規化", () => {
    expect(parseDateKey("2026-02-30")).toBeNull();
    expect(parseDateKey("2026-13-01")).toBeNull();
    expect(parseDateKey("2026-11-16T00:00:00Z")).toBeNull();
    expect(parseDateKey("2026-11-1")).toBeNull();
    expect(isValidDateKey("2028-02-29")).toBe(true);
    expect(isValidDateKey("2027-02-29")).toBe(false);
    expect(daysUntil("2026-02-30", "2026-02-27")).toBeNull();
  });

  it("AC-006 無效到期日的合約不寄提醒、也不列入即將到期", () => {
    const bad = makeTestContract({ expiresAt: "2026-02-30", reminderDaysBefore: 1 });
    expect(dueThreshold(bad, "2026-03-01")).toBeNull();
    expect(computeExpiring([bad], 90, new Date(2026, 1, 25, 9))).toEqual([]);
  });
});

describe("AC-006 UTC 負偏移時區（America/Los_Angeles）", () => {
  const originalTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "America/Los_Angeles";
  });
  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it("AC-006 時區確實生效（本地 11/16 晚上已是 UTC 11/17）", () => {
    const evening = new Date(2026, 10, 16, 22, 0, 0);
    expect(evening.toISOString().slice(0, 10)).toBe("2026-11-17");
    expect(toDateKey(evening)).toBe("2026-11-16");
  });

  it("AC-006 當天到期的合約：儀表板與寄件匣的判斷一致", () => {
    const morning = new Date(2026, 10, 16, 8, 0, 0);
    const contract = makeTestContract({ id: "due-today", expiresAt: "2026-11-16" });
    const expiring = computeExpiring([contract], 90, morning);
    expect(expiring).toEqual([{ contract, daysUntilExpiry: 0 }]);
    expect(dueThreshold(contract, toDateKey(morning))).toBe(0);
  });

  it("AC-006 到期前 7 天：儀表板天數與寄件匣門檻相同", () => {
    const now = new Date(2026, 10, 16, 23, 30, 0);
    const contract = makeTestContract({ id: "due-7", expiresAt: "2026-11-23" });
    expect(computeExpiring([contract], 90, now)[0].daysUntilExpiry).toBe(7);
    expect(dueThreshold(contract, toDateKey(now))).toBe(7);
  });

  it("AC-006 新合約的預設到期日以本地日曆計算", () => {
    const now = new Date(2026, 10, 16, 22, 0, 0); // UTC 已是 11/17
    const text = "【測試用假合約】測試內容";
    const contract = analyzeContract({
      id: "c",
      title: "t",
      source: "paste",
      fullText: text,
      pages: [{ pageNumber: 1, text }],
      articles: [],
      now,
    });
    expect(contract.expiresAt).toBe(addDaysKey(now, 365));
    expect(daysUntil(contract.expiresAt, toDateKey(now))).toBe(365);
  });
});
