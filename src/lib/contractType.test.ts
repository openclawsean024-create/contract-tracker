// AC-003：契約類型自動偵測（併入 contract-reviewer 的 6 個情境，改寫成 vitest）
import { describe, it, expect } from "vitest";
import {
  DETECTED_TYPE_TO_CATEGORY,
  detectContractCategory,
  detectContractType,
} from "./contractType";
import { analyzeContract } from "./analyze";
import { CATEGORY_LABELS, type ContractCategory } from "../types";

describe("AC-003 契約類型自動偵測", () => {
  it("AC-003 NDA → nda", () => {
    const text = "本協議為保密協議,雙方應保守機密";
    expect(detectContractType(text)).toBe("NDA");
    expect(detectContractCategory(text)).toBe<ContractCategory>("nda");
  });

  it("AC-003 僱傭 → employment", () => {
    const text = "甲方僱用乙方,月薪 NT$50000";
    expect(detectContractType(text)).toBe("僱傭");
    expect(detectContractCategory(text)).toBe<ContractCategory>("employment");
  });

  it("AC-003 租賃 → lease", () => {
    const text = "出租人出租房屋,月租金 NT$30000,押金 2 個月";
    expect(detectContractType(text)).toBe("租賃");
    expect(detectContractCategory(text)).toBe<ContractCategory>("lease");
  });

  it("AC-003 採購 → vendor", () => {
    const text = "甲方同意向乙方採購貨品,貨款 NT$100000";
    expect(detectContractType(text)).toBe("採購");
    expect(detectContractCategory(text)).toBe<ContractCategory>("vendor");
  });

  it("AC-003 顧問 → other（既有類別沒有對應，保留偵測標籤）", () => {
    const text = "甲方聘任乙方為顧問,提供諮詢";
    expect(detectContractType(text)).toBe("顧問");
    expect(detectContractCategory(text)).toBe<ContractCategory>("other");
  });

  it("AC-003 未知 → other", () => {
    const text = "某某某某某某";
    expect(detectContractType(text)).toBe("一般");
    expect(detectContractCategory(text)).toBe<ContractCategory>("other");
  });

  it("AC-003 所有偵測結果都對應到 tracker 既有的 ContractCategory", () => {
    const valid = Object.keys(CATEGORY_LABELS);
    for (const category of Object.values(DETECTED_TYPE_TO_CATEGORY)) {
      expect(valid).toContain(category);
    }
  });

  it("AC-003 英文關鍵字不分大小寫（nda／MOU）", () => {
    expect(detectContractType("This NDA is a test document")).toBe("NDA");
    expect(detectContractType("雙方簽署 mou 作為測試")).toBe("合作 MOU");
  });

  it("AC-003 新建合約時自動帶入偵測到的類別", () => {
    const text = "出租人出租測試辦公室,月租金 NT$1000,押金 2 個月";
    const contract = analyzeContract({
      id: "test-contract-1",
      title: "測試租約",
      source: "paste",
      fullText: text,
      pages: [{ pageNumber: 1, text }],
      articles: [],
      now: new Date(2026, 10, 16, 9, 0, 0),
    });
    expect(contract.category).toBe<ContractCategory>("lease");
    expect(contract.detectedType).toBe("租賃");
  });

  it("AC-003 自動偵測 + 分析（reviewer 情境：智慧財產、保密、單方變更）", () => {
    const text = "本合約涉及智慧財產、保密、單方變更條款";
    const contract = analyzeContract({
      id: "test-contract-2",
      title: "自動偵測測試",
      source: "paste",
      fullText: text,
      pages: [{ pageNumber: 1, text }],
      articles: [],
      now: new Date(2026, 10, 16, 9, 0, 0),
    });
    expect(contract.detectedType).toBe("NDA");
    expect(contract.category).toBe<ContractCategory>("nda");
    expect(contract.riskAnalysis.length).toBeGreaterThan(0);
  });
});

describe("AC-003 混合條款時以明確的契約名稱為準（Codex 審查 #6）", () => {
  it.each([
    ["勞動契約。甲方僱用乙方，乙方應保密。", "僱傭"],
    ["房屋租賃契約。承租人對出租人之資料負保密義務。", "租賃"],
    ["採購合約：乙方應交貨，並對報價保密。", "採購"],
    ["軟體授權合約。被授權方應保密原始碼。", "授權"],
    ["顧問合約。乙方提供諮詢並負保密義務。", "顧問"],
    ["保密協議。本協議適用於雙方之採購洽談。", "NDA"],
    ["甲方僱用乙方，月薪 NT$50000，乙方應保密。", "僱傭"],
  ])("AC-003 %s → %s", (text, expected) => {
    expect(detectContractType(text)).toBe(expected);
  });

  it("AC-003 多個契約名稱時取最早出現者（通常是標題）", () => {
    expect(detectContractType("勞動契約\n附件：保密協議")).toBe("僱傭");
    expect(detectContractType("保密協議\n附件：勞動契約範本")).toBe("NDA");
  });
});

describe("AC-003 明確名稱的邊界情況（Claude 子代理複審）", () => {
  it("AC-003 「顧問服務合約」判為顧問，不被「服務合約」蓋過", () => {
    expect(detectContractType("顧問服務合約\n甲方委任乙方提供顧問諮詢")).toBe("顧問");
  });

  it("AC-003 英文 nda 必須是完整單字（Standard 不算）", () => {
    expect(detectContractType("Standard Terms：月租金 1,000 元，押金 2 個月")).toBe("租賃");
    expect(detectContractType("This NDA applies to the parties")).toBe("NDA");
  });
});
