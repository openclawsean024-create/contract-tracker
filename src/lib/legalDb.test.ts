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
