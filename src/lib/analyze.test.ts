// AC-002（Codex 審查 #11）：長內文只保存前 8,000 字時，分析仍用完整原文，並記錄原文字數以便畫面揭露截斷。
import { describe, it, expect } from "vitest";
import { EXTRACTED_TEXT_LIMIT, analyzeContract } from "./analyze";
import { textToPages } from "./textExtract";

describe("AC-002 長內文的截斷揭露", () => {
  const filler = "【測試用假合約】一般條款內容。\n".repeat(700); // 超過 8,000 字
  const tail = "\n第九十九條 本合約期滿後自動續約一年。";
  const fullText = filler + tail;

  const contract = analyzeContract({
    id: "long",
    title: "長合約",
    source: "paste",
    fullText,
    pages: textToPages(fullText),
    articles: [],
    now: new Date(2026, 10, 16, 9),
  });

  it("AC-002 只保存前 8,000 字，並記錄原文字數", () => {
    expect(fullText.length).toBeGreaterThan(EXTRACTED_TEXT_LIMIT);
    expect(contract.extractedText).toHaveLength(EXTRACTED_TEXT_LIMIT);
    expect(contract.extractedTextLength).toBe(fullText.length);
  });

  it("AC-002 第 8,000 字之後的條款仍會被規則比對到", () => {
    expect(contract.extractedText).not.toContain("第九十九條");
    expect(contract.riskAnalysis.map((r) => r.ruleId)).toContain("r3");
  });

  it("AC-002 短內文不標示截斷", () => {
    const short = analyzeContract({
      id: "short",
      title: "短合約",
      source: "paste",
      fullText: "【測試用假合約】短內容",
      pages: [{ pageNumber: 1, text: "【測試用假合約】短內容" }],
      articles: [],
      now: new Date(2026, 10, 16, 9),
    });
    expect(short.extractedTextLength).toBe(short.extractedText!.length);
  });
});
