// FR-019 全文搜尋：production build 曾因 FlexSearch 匯入方式而在建立索引時失敗，
// 導致上傳／貼上合約後整個分析流程中斷（AC-002 的前置條件）。
import { describe, it, expect, beforeEach } from "vitest";
import { buildSearchIndex, ensureIndex, invalidateIndex, searchContracts } from "./search";
import { db, saveContract } from "./storage";
import { makeTestContract } from "../test/factories";

beforeEach(async () => {
  await db.contracts.clear();
  buildSearchIndex();
  invalidateIndex();
});

describe("AC-002 分析流程的搜尋索引", () => {
  it("AC-002 可以建立搜尋索引（FlexSearch.Document 可用）", async () => {
    await saveContract(makeTestContract({ id: "s-1" }));
    await expect(ensureIndex()).resolves.toBeDefined();
  });

  it("AC-002 新增合約後可用標題關鍵字搜尋到", async () => {
    await saveContract(
      makeTestContract({ id: "s-2", title: "Maintenance agreement sample", counterparty: "測試供應商有限公司" })
    );
    await saveContract(makeTestContract({ id: "s-3", title: "Office lease sample" }));
    const ids = (await searchContracts("Maintenance")).map((m) => m.id);
    expect(ids).toContain("s-2");
    expect(ids).not.toContain("s-3");
    expect(await searchContracts("   ")).toEqual([]);
  });
});
