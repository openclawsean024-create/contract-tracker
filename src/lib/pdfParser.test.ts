// Unit tests for clause extraction (F-003)
import { describe, it, expect } from "vitest";
import { extractClauses, sha256Hex } from "./pdfParser";
import type { ExtractedPage } from "./pdfParser";

describe("extractClauses", () => {
  it("extracts confidentiality clause", () => {
    const pages: ExtractedPage[] = [
      {
        pageNumber: 1,
        text: "第一條 乙方應負保密義務，不得洩漏本合約機密資料。",
      },
    ];
    const clauses = extractClauses(pages);
    const conf = clauses.find((c) => c.type === "confidentiality");
    expect(conf).toBeDefined();
    expect(conf?.pageNumber).toBe(1);
    expect(conf?.originalText).toContain("保密");
  });

  it("extracts penalty clause", () => {
    const pages: ExtractedPage[] = [
      {
        pageNumber: 2,
        text: "違約金：違約者應支付契約總額之 20%。",
      },
    ];
    const clauses = extractClauses(pages);
    const pen = clauses.find((c) => c.type === "penalty");
    expect(pen).toBeDefined();
    expect(pen?.originalText).toContain("違約金");
  });

  it("extracts IP clause", () => {
    const pages: ExtractedPage[] = [
      {
        pageNumber: 3,
        text: "智慧財產權歸屬：所有著作權及專利權歸甲方所有。",
      },
    ];
    const clauses = extractClauses(pages);
    const ip = clauses.find((c) => c.type === "ip");
    expect(ip).toBeDefined();
  });

  it("extracts term clause", () => {
    const pages: ExtractedPage[] = [
      {
        pageNumber: 1,
        text: "契約期間自 2026 年 1 月 1 日起至 2027 年 12 月 31 日止，期滿自動續約。",
      },
    ];
    const clauses = extractClauses(pages);
    const term = clauses.find((c) => c.type === "term");
    expect(term).toBeDefined();
  });

  it("returns empty array for plain text without legal keywords", () => {
    const pages: ExtractedPage[] = [
      {
        pageNumber: 1,
        text: "Hello world, this is a simple text with no legal terms.",
      },
    ];
    const clauses = extractClauses(pages);
    expect(clauses.length).toBe(0);
  });

  it("dedups near-identical snippets on the same page", () => {
    const pages: ExtractedPage[] = [
      {
        pageNumber: 1,
        text: "保密保密保密保密保密保密保密",
      },
    ];
    const clauses = extractClauses(pages);
    const conf = clauses.filter((c) => c.type === "confidentiality");
    expect(conf.length).toBe(1);
  });

  it("initial riskLevel is green for extracted clauses", () => {
    const pages: ExtractedPage[] = [
      { pageNumber: 1, text: "保密義務之約定" },
    ];
    const clauses = extractClauses(pages);
    for (const c of clauses) {
      expect(c.riskLevel).toBe("green");
      expect(c.legalRefs).toEqual([]);
    }
  });

  it("handles multiple pages with multiple clause types", () => {
    const pages: ExtractedPage[] = [
      { pageNumber: 1, text: "第一條 乙方應負保密義務。" },
      { pageNumber: 2, text: "第二條 違約金為契約總額之 10%。" },
      { pageNumber: 3, text: "第三條 智慧財產權歸甲方所有。" },
    ];
    const clauses = extractClauses(pages);
    const types = new Set(clauses.map((c) => c.type));
    expect(types.has("confidentiality")).toBe(true);
    expect(types.has("penalty")).toBe(true);
    expect(types.has("ip")).toBe(true);
  });
});

describe("sha256Hex", () => {
  it("produces a 64-character hex string", async () => {
    const buf = new TextEncoder().encode("hello world").buffer;
    const hash = await sha256Hex(buf);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a deterministic hash", async () => {
    const buf = new TextEncoder().encode("contract-tracker").buffer;
    const hash1 = await sha256Hex(buf);
    const hash2 = await sha256Hex(buf);
    expect(hash1).toBe(hash2);
  });

  it("produces a known SHA-256 for empty input", async () => {
    const buf = new ArrayBuffer(0);
    const hash = await sha256Hex(buf);
    // SHA-256 of empty string
    expect(hash).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });
});
