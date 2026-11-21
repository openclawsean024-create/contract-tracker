// FR-019 全文搜尋。
// 1) production build 曾因 FlexSearch 匯入方式在建立索引時失敗，導致上傳／貼上合約後
//    整個分析流程中斷（AC-002 的前置條件）。
// 2) 預設編碼器會丟掉 CJK 字元，中文關鍵字查不到任何結果。
import { describe, it, expect, beforeEach } from "vitest";
import {
  buildSearchIndex,
  encodeForSearch,
  ensureIndex,
  invalidateIndex,
  searchContracts,
} from "./search";
import { db, deleteContract, saveContract } from "./storage";
import { makeTestContract } from "../test/factories";

const ids = async (query: string) =>
  (await searchContracts(query)).map((m) => m.id).sort();

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
    const found = (await searchContracts("Maintenance")).map((m) => m.id);
    expect(found).toContain("s-2");
    expect(found).not.toContain("s-3");
    expect(await searchContracts("   ")).toEqual([]);
  });
});

describe("FR-019 encodeForSearch", () => {
  it("FR-019 中文拆成單字與相鄰兩字，英數轉小寫取單字", () => {
    expect(encodeForSearch("自動續約")).toEqual(["自", "自動", "動", "動續", "續", "續約", "約"]);
    expect(encodeForSearch("NDA 2026")).toEqual(["nda", "2026"]);
    expect(encodeForSearch("甲方 Sample-Tech，乙方")).toEqual([
      "sample",
      "tech",
      "甲",
      "甲方",
      "方",
      "乙",
      "乙方",
    ]);
  });

  it("FR-019 空白、標點或空字串沒有可搜尋的詞", () => {
    expect(encodeForSearch("")).toEqual([]);
    expect(encodeForSearch("  ，。！  ")).toEqual([]);
  });

  it("FR-019 同一份輸入的編碼結果固定", () => {
    const text = "本合約期滿後自動續約一年 automatic renewal";
    expect(encodeForSearch(text)).toEqual(encodeForSearch(text));
  });
});

describe("FR-019 中文全文搜尋", () => {
  beforeEach(async () => {
    await saveContract(
      makeTestContract({
        id: "zh-maintenance",
        title: "【測試】軟體維護服務合約",
        counterparty: "測試供應商有限公司",
        extractedText: "【測試用假合約】第二條 本合約期滿後自動續約一年。第五條 乙方負無限責任。",
      })
    );
    await saveContract(
      makeTestContract({
        id: "zh-lease",
        title: "【測試】辦公室租約",
        counterparty: "範例不動產股份有限公司",
        extractedText: "【測試用假合約】出租人出租測試辦公室，月租金新台幣 1,000 元，押金 2 個月。",
      })
    );
    await saveContract(
      makeTestContract({
        id: "en-nda",
        title: "Sample NDA",
        counterparty: "Test Vendor Ltd",
        extractedText: "FAKE SAMPLE AGREEMENT. All confidential information shall be protected.",
      })
    );
  });

  it("FR-019 以中文標題關鍵字搜尋", async () => {
    expect(await ids("維護")).toEqual(["zh-maintenance"]);
    expect(await ids("租約")).toEqual(["zh-lease"]);
  });

  it("FR-019 以中文內文關鍵字搜尋", async () => {
    expect(await ids("自動續約")).toEqual(["zh-maintenance"]);
    expect(await ids("押金")).toEqual(["zh-lease"]);
    expect(await ids("無限責任")).toEqual(["zh-maintenance"]);
  });

  it("FR-019 以對方名稱搜尋", async () => {
    expect(await ids("測試供應商")).toEqual(["zh-maintenance"]);
    expect(await ids("不動產")).toEqual(["zh-lease"]);
  });

  it("FR-019 多份合約都符合時全部回傳，同一份合約只出現一次", async () => {
    expect(await ids("測試")).toEqual(["zh-lease", "zh-maintenance"]);
    const matches = await searchContracts("測試");
    expect(new Set(matches.map((m) => m.id)).size).toBe(matches.length);
  });

  it("FR-019 回傳命中的欄位", async () => {
    const byId = async (q: string) =>
      Object.fromEntries((await searchContracts(q)).map((m) => [m.id, m.field]));
    expect((await byId("維護"))["zh-maintenance"]).toBe("title");
    expect((await byId("自動續約"))["zh-maintenance"]).toBe("extractedText");
    expect((await byId("不動產"))["zh-lease"]).toBe("counterparty");
  });

  it("FR-019 不存在的詞查不到結果（不會因為個別單字出現就誤中）", async () => {
    expect(await ids("仲裁")).toEqual([]);
    // 「續」「約」「金」各自出現在不同合約，但「續約金」這個詞不存在
    expect(await ids("續約金")).toEqual([]);
    // 「租」「金」「續」「約」都存在，但沒有任何一份同時含「租金」與「續約」
    expect(await ids("租金 續約")).toEqual([]);
  });

  it("FR-019 單一中文字也能搜尋", async () => {
    expect(await ids("押")).toEqual(["zh-lease"]);
  });

  it("FR-019 英文關鍵字不分大小寫，並支援前綴", async () => {
    expect(await ids("confidential")).toEqual(["en-nda"]);
    expect(await ids("CONFIDENTIAL")).toEqual(["en-nda"]);
    expect(await ids("confid")).toEqual(["en-nda"]);
    expect(await ids("nda")).toEqual(["en-nda"]);
  });

  it("FR-019 只有空白或標點的查詢回傳空陣列", async () => {
    expect(await searchContracts("")).toEqual([]);
    expect(await searchContracts("  ，。 ")).toEqual([]);
  });

  it("FR-019 修改標題後搜尋結果跟著更新，不留過期索引", async () => {
    const contract = (await db.contracts.get("zh-lease"))!;
    await saveContract({ ...contract, title: "【測試】倉庫使用協議" });
    expect(await ids("倉庫")).toEqual(["zh-lease"]);
    expect(await ids("租約")).toEqual([]);
  });

  it("FR-019 刪除的合約不會出現在結果中", async () => {
    await deleteContract("zh-maintenance");
    expect(await ids("維護")).toEqual([]);
    expect(await ids("測試")).toEqual(["zh-lease"]);
  });
});

describe("FR-019 完整詞確認（Codex 審查 #11）", () => {
  it("FR-019 bigram 分散在不同位置時不誤中", async () => {
    await saveContract(
      makeTestContract({
        id: "scattered",
        title: "【測試】分散",
        extractedText: "約定自動，日後才動續，最終再續約。",
      })
    );
    expect(await ids("自動續約")).not.toContain("scattered");
    expect(await ids("續約")).toContain("scattered");
  });
});
