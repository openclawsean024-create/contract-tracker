// Unit tests for risk evaluation engine (F-004)
// Pure rule-based risk evaluation: keyword overlap + clause-pattern rules
import { describe, it, expect } from "vitest";
import { evaluateRisk, RISK_RULES } from "./legalDb";
import type { ClauseRecord, LegalArticle } from "../types";

const makeArticle = (id: string, category: string): LegalArticle => ({
  id,
  category,
  categoryLabel: category,
  title: `Article ${id}`,
  summary: "Test article",
  fullText: "Test full text",
  versionDate: "2026-01-01",
  source: "test",
  riskKeywords: [],
});

const makeClause = (
  id: string,
  type: ClauseRecord["type"],
  text: string
): ClauseRecord => ({
  id,
  type,
  originalText: text,
  pageNumber: 1,
  riskLevel: "green",
  legalRefs: [],
});

describe("RISK_RULES", () => {
  it("exposes rules for the 4 main clause types", () => {
    const types = RISK_RULES.map((r) => r.type);
    expect(types).toContain("confidentiality");
    expect(types).toContain("penalty");
    expect(types).toContain("ip");
    expect(types).toContain("term");
  });

  it("each rule has at least one trigger", () => {
    for (const rule of RISK_RULES) {
      expect(rule.triggers.length).toBeGreaterThan(0);
    }
  });
});

describe("evaluateRisk — confidentiality", () => {
  const articles = [makeArticle("art-1", "trade_secret")];

  it("flags permanent confidentiality as red", () => {
    const clauses = [
      makeClause(
        "c1",
        "confidentiality",
        "乙方應永久保密不得揭露任何機密資料"
      ),
    ];
    const result = evaluateRisk("contract-1", clauses, articles);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.score).toBe("red");
  });

  it("flags overbroad scope as yellow", () => {
    const clauses = [
      makeClause(
        "c1",
        "confidentiality",
        "乙方不得使用所有資料作為其他用途"
      ),
    ];
    const result = evaluateRisk("contract-1", clauses, articles);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.score).toBe("yellow");
  });

  it("returns green for normal confidentiality clause", () => {
    const clauses = [
      makeClause(
        "c1",
        "confidentiality",
        "乙方應就本合約之機密資訊負保密義務"
      ),
    ];
    const result = evaluateRisk("contract-1", clauses, articles);
    expect(result.score).toBe("green");
  });
});

describe("evaluateRisk — penalty", () => {
  const articles = [makeArticle("art-civil", "civil_law")];

  it("flags 30%+ penalty as red", () => {
    const clauses = [
      makeClause(
        "c1",
        "penalty",
        "違約者應支付契約總額之50%作為違約金"
      ),
    ];
    const result = evaluateRisk("contract-1", clauses, articles);
    expect(result.score).toBe("red");
    expect(result.issues[0].severity).toBe("red");
  });

  it("flags per-day penalty as yellow", () => {
    const clauses = [
      makeClause("c1", "penalty", "違約者應每日支付逾期罰款 5000 元"),
    ];
    const result = evaluateRisk("contract-1", clauses, articles);
    expect(result.score).toBe("yellow");
  });

  it("returns green for normal penalty clause", () => {
    const clauses = [
      makeClause("c1", "penalty", "違約者應支付合理之損害賠償"),
    ];
    const result = evaluateRisk("contract-1", clauses, articles);
    expect(result.score).toBe("green");
  });
});

describe("evaluateRisk — IP", () => {
  const articles = [makeArticle("art-ip", "copyright")];

  it("flags broad IP assignment as yellow", () => {
    const clauses = [
      makeClause(
        "c1",
        "ip",
        "所有智慧財產權均歸甲方所有"
      ),
    ];
    const result = evaluateRisk("contract-1", clauses, articles);
    expect(result.score).toBe("yellow");
  });

  it("returns green when no IP issue", () => {
    const clauses = [makeClause("c1", "ip", "本條款說明技術文件用途")];
    const result = evaluateRisk("contract-1", clauses, articles);
    expect(result.score).toBe("green");
  });
});

describe("evaluateRisk — term", () => {
  const articles = [makeArticle("art-civil", "civil_law")];

  it("flags automatic renewal as yellow", () => {
    const clauses = [
      makeClause("c1", "term", "本合約到期後將自動續約一年"),
    ];
    const result = evaluateRisk("contract-1", clauses, articles);
    expect(result.score).toBe("yellow");
  });
});

describe("evaluateRisk — contract-level score aggregation", () => {
  const articles = [
    makeArticle("art-ts", "trade_secret"),
    makeArticle("art-civil", "civil_law"),
  ];

  it("red dominates over yellow", () => {
    const clauses = [
      makeClause("c1", "penalty", "違約者應支付契約總額之50%違約金"),
      makeClause("c2", "term", "本合約到期後自動續約"),
    ];
    const result = evaluateRisk("contract-1", clauses, articles);
    expect(result.score).toBe("red");
  });

  it("ignores clauses of other types", () => {
    const clauses = [
      makeClause("c1", "payment", "付款方式：月結 30 天"),
    ];
    const result = evaluateRisk("contract-1", clauses, articles);
    expect(result.score).toBe("green");
    expect(result.issues.length).toBe(0);
  });

  it("returns clauseUpdates for matched clauses", () => {
    const clauses = [
      makeClause("c1", "penalty", "違約者應支付契約總額之50%違約金"),
    ];
    const result = evaluateRisk("contract-1", clauses, articles);
    expect(result.clauseUpdates.has("c1")).toBe(true);
    const update = result.clauseUpdates.get("c1");
    expect(update?.riskLevel).toBe("red");
  });
});

// ---------------------------------------------------------------------------
// AC-004：併入 contract-reviewer 的 13 條規則、資訊提示、決定性輸出
// （以上原有的 14 個測試維持原樣，以下為新增）
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasAffirmativeAutoRenewal, pickArticle, splitSentences } from "./legalDb";
import { extractClauses } from "./pdfParser";
import { textToPages } from "./textExtract";
import { RISK_CATEGORY_LABELS, type LegalDB } from "../types";
import { FAKE_CLEAN_TEXT, FAKE_RISKY_CONTRACT } from "../../tests/fixtures/fake-contracts";

const realDb = JSON.parse(
  readFileSync(resolve(__dirname, "../../public/data/legal-db.json"), "utf8")
) as LegalDB;

const evalText = (fullText: string, articles: LegalArticle[] = realDb.articles) =>
  evaluateRisk("contract-doc", [], articles, { fullText });

const firedRuleIds = (fullText: string) => {
  const r = evalText(fullText);
  return [...r.issues, ...r.infos].map((i) => i.ruleId);
};

// 每條新規則：一個命中案例、一個不命中案例（皆為假條文）
const DOCUMENT_RULE_CASES: Array<{
  id: string;
  hit: string;
  miss: string;
  severity: "red" | "yellow" | "green";
  kind: "risk" | "info";
}> = [
  { id: "r1", hit: "本公司得隨時調整服務費用", miss: "經雙方書面同意後得調整服務費用", severity: "red", kind: "risk" },
  { id: "r2", hit: "違約時應支付價金三倍之違約金", miss: "違約時應支付合理之違約金", severity: "red", kind: "risk" },
  { id: "r3", hit: "本合約期滿後自動延長一年", miss: "本合約期滿後由雙方另行議定是否續約", severity: "red", kind: "risk" },
  { id: "r4", hit: "乙方為甲方之獨家經銷商", miss: "乙方為甲方之經銷商之一", severity: "red", kind: "risk" },
  { id: "r5", hit: "本專案產生之智慧財產由雙方另行議定", miss: "本專案產生之智慧財產歸屬甲方", severity: "red", kind: "risk" },
  { id: "r6", hit: "乙方應就所生損害負一切責任", miss: "乙方之賠償責任以合約總金額為上限", severity: "red", kind: "risk" },
  { id: "r7", hit: "乙方應負保密義務", miss: "乙方應負保密義務，期限為二年", severity: "yellow", kind: "risk" },
  { id: "r8", hit: "以臺灣臺北地方法院為第一審管轄法院", miss: "雙方應本於誠信原則協商解決", severity: "green", kind: "info" },
  { id: "r9", hit: "因不可抗力致無法履約者不負遲延責任", miss: "乙方應如期交付測試貨品", severity: "green", kind: "info" },
  { id: "r10", hit: "甲方得提前終止本合約", miss: "本合約期間為一年", severity: "yellow", kind: "risk" },
  { id: "r11", hit: "乙方不得為債權讓與", miss: "乙方應親自履行本合約", severity: "yellow", kind: "risk" },
  { id: "r12", hit: "乙方應支付懲罰性違約金", miss: "乙方應賠償甲方所受損害", severity: "red", kind: "risk" },
  { id: "r13", hit: "乙方離職後二年內負競業禁止義務", miss: "乙方離職時應辦理交接", severity: "yellow", kind: "risk" },
];

describe("AC-004 RISK_RULES 結構", () => {
  it("AC-004 併入 reviewer 的 13 條規則（r1–r13）都在 RISK_RULES 內", () => {
    const ids = RISK_RULES.map((r) => r.id);
    for (let i = 1; i <= 13; i++) expect(ids).toContain(`r${i}`);
    expect(RISK_RULES.filter((r) => r.scope === "document")).toHaveLength(13);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("AC-004 每條規則都有 suggestion 與 category", () => {
    const categories = Object.keys(RISK_CATEGORY_LABELS);
    for (const rule of RISK_RULES) {
      expect(rule.suggestion.trim().length).toBeGreaterThan(0);
      expect(categories).toContain(rule.category);
    }
  });

  it("AC-004 每個測試案例對應一條 document 規則，沒有遺漏", () => {
    const documentIds = RISK_RULES.filter((r) => r.scope === "document").map((r) => r.id);
    expect(DOCUMENT_RULE_CASES.map((c) => c.id)).toEqual(documentIds);
  });

  it("AC-004 管轄／仲裁（r8）與不可抗力（r9）是資訊提示，其餘皆為風險規則", () => {
    const infoIds = RISK_RULES.filter((r) => r.kind === "info").map((r) => r.id);
    expect(infoIds).toEqual(["r8", "r9"]);
  });

  it("AC-004 每條規則固定對照的法條都存在於法條庫", () => {
    const ids = new Set(realDb.articles.map((a) => a.id));
    for (const rule of RISK_RULES) {
      if (rule.kind === "info") continue;
      expect(rule.legalRefId, `規則 ${rule.id} 應指定 legalRefId`).toBeTruthy();
      expect(ids.has(rule.legalRefId!), `${rule.id} → ${rule.legalRefId}`).toBe(true);
    }
  });
});

describe("AC-004 13 條新規則：命中與不命中", () => {
  it.each(DOCUMENT_RULE_CASES)("AC-004 $id 命中：$hit", ({ id, hit, severity, kind }) => {
    const result = evalText(hit);
    const pool = kind === "info" ? result.infos : result.issues;
    const item = pool.find((i) => i.ruleId === id);
    expect(item).toBeDefined();
    expect(item!.severity).toBe(severity);
    expect(item!.kind).toBe(kind);
    expect(item!.suggestion.trim().length).toBeGreaterThan(0);
    expect(item!.category).toBe(RISK_RULES.find((r) => r.id === id)!.category);
    if (kind === "risk") {
      expect(item!.legalRef).toBe(RISK_RULES.find((r) => r.id === id)!.legalRefId);
    }
  });

  it.each(DOCUMENT_RULE_CASES)("AC-004 $id 不命中：$miss", ({ id, miss }) => {
    expect(firedRuleIds(miss)).not.toContain(id);
  });

  it("AC-004 r2 需同時出現「違約金」與倍數才命中", () => {
    expect(firedRuleIds("乙方應於三倍工時內完成測試")).not.toContain("r2");
    expect(firedRuleIds("違約金為報酬之雙倍")).toContain("r2");
  });

  it("AC-004 英文關鍵字不分大小寫（Liquidated Damages）", () => {
    expect(firedRuleIds("Seller shall pay Liquidated Damages.")).toContain("r12");
  });
});

describe("AC-004 資訊提示不計入風險分級", () => {
  it("AC-004 只命中管轄與不可抗力時，結果仍為綠燈且 issues 為空", () => {
    const result = evalText(
      "因不可抗力致無法履約者不負遲延責任。以臺灣臺北地方法院為第一審管轄法院。"
    );
    expect(result.issues).toEqual([]);
    expect(result.infos.map((i) => i.ruleId)).toEqual(["r8", "r9"]);
    expect(result.score).toBe("green");
  });

  it("AC-004 資訊提示不會把黃燈拉高或拉低", () => {
    const withoutInfo = evalText("甲方得提前終止本合約");
    const withInfo = evalText("甲方得提前終止本合約，並以仲裁解決爭議");
    expect(withoutInfo.score).toBe("yellow");
    expect(withInfo.score).toBe("yellow");
    expect(withInfo.infos).toHaveLength(1);
  });

  it("AC-004 風險結果只有綠／黃／紅三級，沒有數值分數", () => {
    const result = evalText(FAKE_RISKY_CONTRACT);
    expect(["green", "yellow", "red"]).toContain(result.score);
    expect(result).not.toHaveProperty("riskScore");
    for (const item of [...result.issues, ...result.infos]) {
      expect(["green", "yellow", "red"]).toContain(item.severity);
    }
  });

  it("AC-004 未提供全文時不執行 document 規則（原有呼叫方式行為不變）", () => {
    const clauses = [makeClause("c1", "confidentiality", "乙方應就本合約之機密資訊負保密義務")];
    const result = evaluateRisk("contract-1", clauses, realDb.articles);
    expect(result.issues).toEqual([]);
    expect(result.infos).toEqual([]);
  });

  it("AC-004 沒有命中任何規則的文字回傳綠燈", () => {
    const result = evalText(FAKE_CLEAN_TEXT);
    expect(result.issues).toEqual([]);
    expect(result.infos).toEqual([]);
    expect(result.score).toBe("green");
  });
});

describe("AC-004 決定性輸出", () => {
  const clausesFor = (text: string) => extractClauses(textToPages(text));

  it("AC-004 同一份輸入呼叫兩次 evaluateRisk，結果完全相同", () => {
    const clauses = clausesFor(FAKE_RISKY_CONTRACT);
    const first = evaluateRisk("contract-1", clauses, realDb.articles, {
      fullText: FAKE_RISKY_CONTRACT,
    });
    const second = evaluateRisk("contract-1", clauses, realDb.articles, {
      fullText: FAKE_RISKY_CONTRACT,
    });
    expect(first.issues.length).toBeGreaterThan(0);
    expect(second).toEqual(first);
  });

  it("AC-004 連續評估 20 次，法條對照與分級都不變", () => {
    const clauses = clausesFor(FAKE_RISKY_CONTRACT);
    const run = () =>
      evaluateRisk("contract-1", clauses, realDb.articles, {
        fullText: FAKE_RISKY_CONTRACT,
      });
    const baseline = run();
    for (let i = 0; i < 20; i++) expect(run()).toEqual(baseline);
  });

  it("AC-004 同一條規則有多個候選法條時，固定選到同一條", () => {
    const articles = [
      makeArticle("art-a", "civil_law"),
      makeArticle("art-b", "civil_law"),
      makeArticle("art-c", "civil_law"),
    ];
    const clauses = [makeClause("c1", "penalty", "違約者應支付契約總額之50%作為違約金")];
    const refs = new Set<string>();
    for (let i = 0; i < 30; i++) {
      refs.add(evaluateRisk("contract-1", clauses, articles).issues[0].legalRef);
    }
    expect([...refs]).toEqual(["art-a"]);
  });

  it("AC-004 pickArticle：固定 ID 優先，其次類別內第一筆，最後法條庫第一筆", () => {
    const articles = [
      makeArticle("art-x", "privacy"),
      makeArticle("art-y", "civil_law"),
      makeArticle("民法 §252", "civil_law"),
    ];
    expect(pickArticle({ legalRefId: "民法 §252", legalCategories: ["civil_law"] }, articles).id).toBe("民法 §252");
    expect(pickArticle({ legalRefId: "不存在", legalCategories: ["civil_law"] }, articles).id).toBe("art-y");
    expect(pickArticle({ legalCategories: ["copyright"] }, articles).id).toBe("art-x");
    expect(pickArticle({ legalCategories: ["copyright"] }, []).id).toBe("");
  });

  it("AC-004 legalDb.ts 不使用 Math.random", () => {
    const source = readFileSync(resolve(__dirname, "legalDb.ts"), "utf8");
    expect(source).not.toMatch(/Math\s*\.\s*random/);
  });

  it("AC-004 規則的 RegExp 沒有 g／y 旗標（避免 lastIndex 造成前後次結果不同）", () => {
    for (const rule of RISK_RULES) {
      for (const re of [...rule.triggers, ...(rule.requires ?? []), ...(rule.unless ?? [])]) {
        expect(re.global || re.sticky, `${rule.id} ${re}`).toBe(false);
      }
    }
  });
});

describe("AC-004 reviewer 測試情境改寫", () => {
  it("AC-004 綜合條款至少標出 3 項（reviewer：風險清單擴展）", () => {
    const allClause = "單方條款 智慧財產 保密 自動續約 排他 違約金 一倍 提前終止 不可抗力 仲裁";
    const result = evalText(allClause);
    expect(result.issues.length).toBeGreaterThanOrEqual(3);
    expect(result.issues.map((i) => i.ruleId)).toEqual(["r1", "r2", "r3", "r4", "r5", "r7", "r10"]);
    expect(result.infos.map((i) => i.ruleId)).toEqual(["r8", "r9"]);
    expect(result.score).toBe("red");
  });
});

// ---------------------------------------------------------------------------
// Codex 審查 #3、#4：不同條款的文字不得湊在一起判斷；否定句不得產生相反的結果
// ---------------------------------------------------------------------------
describe("AC-004 全文規則只在同一句內比對", () => {
  it("AC-004 r2：違約金與倍數在不同句時不命中，倍數直接修飾違約金才命中", () => {
    expect(firedRuleIds("違約金上限為新台幣一千元。\n交貨時乙方應提供一倍數量之備品。")).not.toContain("r2");
    expect(firedRuleIds("違約金上限一千元，並提供一倍數量之備品")).not.toContain("r2");
    expect(firedRuleIds("違約時應給付相當於報酬三倍之違約金。")).toContain("r2");
    expect(firedRuleIds("違約金為價金之雙倍。")).toContain("r2");
  });

  it("AC-004 r7：其他句子的期限不會讓保密條款漏報", () => {
    const text = "本契約期限一年。\n乙方對甲方之營業資料負保密義務。";
    expect(firedRuleIds(text)).toContain("r7");
  });

  it("AC-004 r7：「保密二年」「保密期間 3 年」視為已約定期限，不誤報", () => {
    expect(firedRuleIds("乙方應保密二年。")).not.toContain("r7");
    expect(firedRuleIds("乙方之保密期間為 3 年。")).not.toContain("r7");
    expect(firedRuleIds("乙方應於離職後 24 個月內保密。")).not.toContain("r7");
  });

  it("AC-004 r5：其他句子的「歸屬」不會讓智慧財產條款漏報", () => {
    const text = "本設備之所有權歸屬甲方。\n本案涉及之智慧財產由雙方日後協商。";
    expect(firedRuleIds(text)).toContain("r5");
  });

  it("AC-004 splitSentences 依句號、分號與換行切句並保留位置", () => {
    expect(splitSentences("甲。乙；丙\n丁").map((s) => [s.text, s.offset])).toEqual([
      ["甲", 0],
      ["乙", 2],
      ["丙", 4],
      ["丁", 6],
    ]);
  });
});

describe("AC-004 否定句與尚未約定", () => {
  it("AC-004 r3：「不自動續約」「不得自動延長」不命中", () => {
    for (const text of [
      "本合約期滿不自動續約。",
      "本合約期滿後不得自動延長。",
      "本合約非自動續約，須另訂新約。",
      "本合約到期後並不會自動續約。",
    ]) {
      expect(firedRuleIds(text), text).not.toContain("r3");
    }
    expect(firedRuleIds("本合約期滿後自動續約一年。")).toContain("r3");
  });

  it("AC-004 原有條款規則：否定的自動續約不標黃燈", () => {
    const negated = [makeClause("c1", "term", "本合約期滿不自動續約，雙方應另行協議")];
    expect(evaluateRisk("contract-1", negated, realDb.articles).score).toBe("green");
    const affirmative = [makeClause("c1", "term", "本合約期滿後自動續約一年")];
    expect(evaluateRisk("contract-1", affirmative, realDb.articles).score).toBe("yellow");
  });

  it("AC-004 hasAffirmativeAutoRenewal：同時有否定與肯定時仍視為有自動續約", () => {
    expect(hasAffirmativeAutoRenewal("本合約不自動續約")).toBe(false);
    expect(hasAffirmativeAutoRenewal("附約不自動續約，但主約自動續約一年")).toBe(true);
  });

  it("AC-004 r1：限制單方變更的句子不命中", () => {
    expect(firedRuleIds("非經雙方書面同意，任一方不得單方變更本合約。")).not.toContain("r1");
    expect(firedRuleIds("本公司得隨時調整費用。")).toContain("r1");
  });

  it("AC-004 r8／r9：「留待另議」不顯示提及管轄或不可抗力", () => {
    const result = evalText("不可抗力處理方式及仲裁地點均留待另議。");
    expect(result.infos).toEqual([]);
    expect(result.issues).toEqual([]);
  });

  it("AC-004 r8／r9 的文案只指出「提及」，不宣稱已約定", () => {
    for (const id of ["r8", "r9"]) {
      const rule = RISK_RULES.find((r) => r.id === id)!;
      expect(rule.title).toMatch(/^提及/);
      expect(rule.title).not.toContain("已約定");
    }
  });
});
