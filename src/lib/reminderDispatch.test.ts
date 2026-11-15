// AC-006：到期提醒寄送（mock 寄件匣）；AC-008：每封提醒信都含免責聲明
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import {
  DexieOutboxStore,
  FIXED_REMINDER_THRESHOLDS,
  MemoryOutboxStore,
  MockEmailAdapter,
  buildReminderEmail,
  daysUntil,
  dispatchReminders,
  dueThreshold,
  reminderThresholds,
  toDateKey,
  type EmailAdapter,
  type EmailMessage,
} from "./reminderDispatch";
import { DISCLAIMER_TEXT } from "./disclaimer";
import { ContractDB } from "./storage";
import { makeTestContract, makeTestMember } from "../test/factories";

// 注入的固定日期：2026-11-16（本地時間上午 9 點）。測試不依賴系統時鐘。
const TODAY = new Date(2026, 10, 16, 9, 0, 0);
const TODAY_KEY = "2026-11-16";
/** 從固定的今天往後 n 天的 YYYY-MM-DD */
const inDays = (n: number) => toDateKey(new Date(2026, 10, 16 + n, 9, 0, 0));

const memberA = makeTestMember({ id: "member-a", name: "測試成員甲", email: "a@example.com" });
const memberB = makeTestMember({ id: "member-b", name: "測試成員乙", email: "b@example.test" });
const members = [memberA, memberB];

let store: MemoryOutboxStore;
let adapter: MockEmailAdapter;
let fetchSpy: MockInstance<typeof globalThis.fetch>;

beforeEach(() => {
  store = new MemoryOutboxStore();
  adapter = new MockEmailAdapter(store, () => TODAY);
  fetchSpy = vi.spyOn(globalThis, "fetch");
});

afterEach(() => {
  // 整個測試期間都不得發出任何網路請求
  expect(fetchSpy).toHaveBeenCalledTimes(0);
  fetchSpy.mockRestore();
});

const dispatch = (contracts: ReturnType<typeof makeTestContract>[], today = TODAY) =>
  dispatchReminders({ today, contracts, members, adapter });

describe("AC-006 日期與門檻計算", () => {
  it("AC-006 toDateKey／daysUntil 以日為單位計算", () => {
    expect(toDateKey(TODAY)).toBe(TODAY_KEY);
    expect(daysUntil("2026-11-16", TODAY_KEY)).toBe(0);
    expect(daysUntil("2026-11-23", TODAY_KEY)).toBe(7);
    expect(daysUntil("2026-12-31", TODAY_KEY)).toBe(45);
    expect(daysUntil("2026-11-15", TODAY_KEY)).toBe(-1);
    expect(daysUntil("不是日期", TODAY_KEY)).toBeNull();
  });

  it("AC-006 門檻＝使用者設定的天數＋固定的 7 天與當天", () => {
    expect(FIXED_REMINDER_THRESHOLDS).toEqual([7, 0]);
    expect(reminderThresholds({ reminderDaysBefore: 45 })).toEqual([45, 7, 0]);
    expect(reminderThresholds({ reminderDaysBefore: 7 })).toEqual([7, 0]);
    expect(reminderThresholds({ reminderDaysBefore: Number.NaN })).toEqual([7, 0]);
  });

  it("AC-006 舊版寫死的 30／60／90 天不再是門檻（除非使用者自己設定）", () => {
    const contract = makeTestContract({ reminderDaysBefore: 45 });
    for (const d of [30, 60, 90]) {
      expect(dueThreshold({ ...contract, expiresAt: inDays(d) }, TODAY_KEY)).toBeNull();
    }
  });
});

describe("AC-006 到期提醒寄送（mock 寄件匣）", () => {
  it("AC-006 自訂天數命中：到期前 45 天寫入寄件匣", async () => {
    const contract = makeTestContract({
      id: "c-45",
      reminderDaysBefore: 45,
      expiresAt: inDays(45),
      ownerId: memberA.id,
      reminderRecipientIds: [memberB.id],
    });
    const summary = await dispatch([contract]);

    expect(summary.sent).toHaveLength(1);
    const outbox = await store.list();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      id: `c-45:45:${TODAY_KEY}`,
      contractId: "c-45",
      threshold: 45,
      scheduledFor: TODAY_KEY,
      to: ["b@example.test"],
      createdAt: TODAY.toISOString(),
    });
    expect(outbox[0].subject).toContain(contract.title);
    expect(outbox[0].subject).toContain("45 天後到期");
    expect(outbox[0].body).toContain(contract.expiresAt);
    expect(outbox[0].body).toContain("測試成員甲");
  });

  it("AC-006 自訂天數未命中：不寫入寄件匣", async () => {
    const contract = makeTestContract({ reminderDaysBefore: 45, expiresAt: inDays(44) });
    const summary = await dispatch([contract]);
    expect(summary.sent).toEqual([]);
    expect(await store.list()).toEqual([]);
  });

  it("AC-006 使用者改了提醒天數後，以新的天數為準", async () => {
    const base = makeTestContract({ id: "c-edit", expiresAt: inDays(20) });
    expect((await dispatch([{ ...base, reminderDaysBefore: 30 }])).sent).toHaveLength(0);
    expect((await dispatch([{ ...base, reminderDaysBefore: 20 }])).sent).toHaveLength(1);
  });

  it("AC-006 固定在到期前 7 天與當天各觸發一次", async () => {
    const summary = await dispatch([
      makeTestContract({ id: "c-7", reminderDaysBefore: 45, expiresAt: inDays(7) }),
      makeTestContract({ id: "c-0", reminderDaysBefore: 45, expiresAt: inDays(0) }),
      makeTestContract({ id: "c-6", reminderDaysBefore: 45, expiresAt: inDays(6) }),
    ]);
    expect(summary.sent.map((m) => [m.contractId, m.threshold])).toEqual([
      ["c-7", 7],
      ["c-0", 0],
    ]);
    expect(summary.sent[1].subject).toContain("今天到期");
  });

  it("AC-006 重複執行不重寄（同合約、同門檻、同一天只寫入一次）", async () => {
    const contract = makeTestContract({ id: "c-dup", reminderDaysBefore: 45, expiresAt: inDays(45) });
    const first = await dispatch([contract]);
    const second = await dispatch([contract]);
    const third = await dispatch([contract], new Date(2026, 10, 16, 23, 30, 0));

    expect(first.sent).toHaveLength(1);
    expect(second.sent).toHaveLength(0);
    expect(second.skippedDuplicate).toBe(1);
    expect(third.sent).toHaveLength(0);
    expect(await store.list()).toHaveLength(1);
  });

  it("AC-006 同一份合約在不同門檻（不同日期）各寄一次", async () => {
    const contract = makeTestContract({ id: "c-multi", reminderDaysBefore: 45, expiresAt: inDays(45) });
    await dispatch([contract], TODAY); // 45 天前
    await dispatch([contract], new Date(2026, 10, 16 + 38, 9)); // 7 天前
    await dispatch([contract], new Date(2026, 10, 16 + 45, 9)); // 當天
    await dispatch([contract], new Date(2026, 10, 16 + 46, 9)); // 已過期
    const outbox = await store.list();
    expect(outbox.map((e) => e.threshold).sort((a, b) => b - a)).toEqual([45, 7, 0]);
  });

  it("AC-006 停用合約（isActive=false）不寄", async () => {
    const summary = await dispatch([
      makeTestContract({ id: "c-off", reminderDaysBefore: 45, expiresAt: inDays(45), isActive: false }),
      makeTestContract({ id: "c-off-0", expiresAt: inDays(0), isActive: false }),
    ]);
    expect(summary.sent).toEqual([]);
    expect(await store.list()).toEqual([]);
  });

  it("AC-006 已過期的合約不寄", async () => {
    const summary = await dispatch([
      makeTestContract({ id: "c-expired", reminderDaysBefore: 45, expiresAt: inDays(-1) }),
      makeTestContract({ id: "c-old", reminderDaysBefore: 30, expiresAt: "2020-01-01" }),
    ]);
    expect(summary.sent).toEqual([]);
    expect(await store.list()).toEqual([]);
  });

  it("AC-006 收件人取自合約設定的成員；未設定時退回負責人", async () => {
    const summary = await dispatch([
      makeTestContract({
        id: "c-r1",
        expiresAt: inDays(7),
        ownerId: memberA.id,
        reminderRecipientIds: [memberB.id, memberA.id],
      }),
      makeTestContract({ id: "c-r2", expiresAt: inDays(7), ownerId: memberA.id }),
      makeTestContract({ id: "c-r3", expiresAt: inDays(7) }),
    ]);
    expect(summary.sent.map((m) => m.to)).toEqual([
      ["b@example.test", "a@example.com"],
      ["a@example.com"],
      [],
    ]);
  });

  it("AC-006 寄送一律透過注入的 EmailAdapter 介面", async () => {
    const received: EmailMessage[] = [];
    const spyAdapter: EmailAdapter = {
      send: async (message) => {
        received.push(message);
        return { accepted: true };
      },
    };
    await dispatchReminders({
      today: TODAY,
      contracts: [makeTestContract({ id: "c-spy", reminderDaysBefore: 45, expiresAt: inDays(45) })],
      members,
      adapter: spyAdapter,
    });
    expect(received).toHaveLength(1);
    expect(received[0].dedupeKey).toBe(`c-spy:45:${TODAY_KEY}`);
    expect(await store.list()).toEqual([]);
  });

  it("AC-006 結果只取決於注入的日期，不讀系統時鐘", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2031, 0, 1));
      const contract = makeTestContract({ id: "c-clock", reminderDaysBefore: 45, expiresAt: inDays(45) });
      const summary = await dispatch([contract]);
      expect(summary.todayKey).toBe(TODAY_KEY);
      expect(summary.sent).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("AC-006 本機寄件匣（IndexedDB）同樣不重複寫入，且可列出信件", async () => {
    const database = new ContractDB("outbox-test");
    const dexieStore = new DexieOutboxStore(database);
    const dexieAdapter = new MockEmailAdapter(dexieStore, () => TODAY);
    const contracts = [
      makeTestContract({ id: "c-db", reminderDaysBefore: 45, expiresAt: inDays(45), ownerId: memberA.id }),
    ];
    const run = () => dispatchReminders({ today: TODAY, contracts, members, adapter: dexieAdapter });
    // 同時觸發兩次檢查也只會寫入一次
    const [a, b] = await Promise.all([run(), run()]);
    expect(a.sent.length + b.sent.length).toBe(1);
    await run();
    const outbox = await dexieStore.list();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toEqual(["a@example.com"]);
    await database.delete();
  });
});

describe("AC-006 不發出網路請求", () => {
  it("AC-006 檢查、寄送、讀取寄件匣的過程中 fetch 呼叫次數為 0", async () => {
    await dispatch([
      makeTestContract({ id: "c-n1", reminderDaysBefore: 45, expiresAt: inDays(45), ownerId: memberA.id }),
      makeTestContract({ id: "c-n2", expiresAt: inDays(7), reminderRecipientIds: [memberB.id] }),
      makeTestContract({ id: "c-n3", expiresAt: inDays(0) }),
    ]);
    expect(await store.list()).toHaveLength(3);
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });
});

describe("AC-008 提醒信內文包含免責聲明", () => {
  it("AC-008 每封 mock 提醒信的內文都包含 DISCLAIMER_TEXT", async () => {
    const summary = await dispatch([
      makeTestContract({ id: "c-a", reminderDaysBefore: 45, expiresAt: inDays(45) }),
      makeTestContract({ id: "c-b", expiresAt: inDays(7) }),
      makeTestContract({ id: "c-c", expiresAt: inDays(0) }),
    ]);
    expect(summary.sent).toHaveLength(3);
    const outbox = await store.list();
    expect(outbox).toHaveLength(3);
    for (const email of outbox) {
      expect(email.body).toContain(DISCLAIMER_TEXT);
      expect(email.body).toContain("未實際寄出");
    }
  });

  it("AC-008 buildReminderEmail 的內文以免責聲明結尾", () => {
    const message = buildReminderEmail(
      makeTestContract({ expiresAt: inDays(7) }),
      7,
      TODAY_KEY,
      members
    );
    expect(message.body.endsWith(DISCLAIMER_TEXT)).toBe(true);
  });
});
