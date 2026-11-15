// AC-002：多格式輸入（txt／docx／貼上／不支援格式）
import { describe, it, expect, vi } from "vitest";
import {
  PASTE_HINT,
  detectFileKind,
  extractFromPastedText,
  extractTextFromFile,
  textToPages,
} from "./textExtract";
import { analyzeContract } from "./analyze";
import { FAKE_RISKY_CONTRACT } from "../../tests/fixtures/fake-contracts";
import { makeFakeDocx } from "../../tests/fixtures/fake-docx";

const fakeFile = (name: string, content: string | ArrayBuffer) =>
  new File([content], name);

const analyze = (fullText: string, pages: { pageNumber: number; text: string }[]) =>
  analyzeContract({
    id: "test-contract",
    title: "測試合約",
    source: "paste",
    fullText,
    pages,
    articles: [],
    now: new Date(2026, 10, 16, 9, 0, 0),
  });

describe("AC-002 多格式輸入", () => {
  it("AC-002 detectFileKind 辨識 pdf／txt／md／docx，其他回傳 null", () => {
    expect(detectFileKind("測試合約.PDF")).toBe("pdf");
    expect(detectFileKind("測試合約.txt")).toBe("txt");
    expect(detectFileKind("notes.md")).toBe("txt");
    expect(detectFileKind("測試合約.docx")).toBe("docx");
    expect(detectFileKind("測試合約.xlsx")).toBeNull();
    expect(detectFileKind("測試合約.doc")).toBeNull();
  });

  it("AC-002 .txt 可擷取文字並分段", async () => {
    const result = await extractTextFromFile(
      fakeFile("測試合約.txt", FAKE_RISKY_CONTRACT)
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe("txt");
    expect(result.fullText).toContain("自動續約");
    expect(result.pages.length).toBeGreaterThan(1);
    expect(result.pages[0].pageNumber).toBe(1);
  });

  it("AC-002 .docx（測試內產生的假 docx）可擷取文字", async () => {
    const docx = await makeFakeDocx([
      "【測試用假合約】範例科技股份有限公司與測試供應商有限公司",
      "第二條 本合約期滿後自動續約一年。",
      "第三條 本公司得單方變更服務內容。",
    ]);
    const result = await extractTextFromFile(fakeFile("測試合約.docx", docx));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe("docx");
    expect(result.fullText).toContain("範例科技股份有限公司");
    expect(result.fullText).toContain("自動續約");
    expect(result.pages.length).toBe(3);
  });

  it("AC-002 不支援的格式顯示錯誤並提示改用貼上文字", async () => {
    const result = await extractTextFromFile(fakeFile("測試合約.xlsx", "假內容"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("UNSUPPORTED");
    expect(result.message).toContain("不支援的檔案格式");
    expect(result.message).toContain(PASTE_HINT);
  });

  it("AC-002 解析失敗（損壞的 docx）顯示錯誤並提示改用貼上文字", async () => {
    const result = await extractTextFromFile(
      fakeFile("損壞的測試檔.docx", "這不是 zip 檔")
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("PARSE_FAILED");
    expect(result.message).toContain(PASTE_HINT);
  });

  it("AC-002 空白內容回報 EMPTY", async () => {
    const empty = await extractTextFromFile(fakeFile("空白.txt", "   \n\n  "));
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.code).toBe("EMPTY");
    const pasted = extractFromPastedText("  ");
    expect(pasted.ok).toBe(false);
  });

  it("AC-002 貼上內文可擷取並標記來源為 paste", () => {
    const result = extractFromPastedText(FAKE_RISKY_CONTRACT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe("paste");
    expect(result.pages.length).toBeGreaterThan(1);
  });

  it("AC-002 textToPages：沒有空行時改以單行分段", () => {
    const pages = textToPages("第一條 測試\n第二條 測試\r\n第三條 測試");
    expect(pages.map((p) => p.pageNumber)).toEqual([1, 2, 3]);
    expect(textToPages("")).toEqual([]);
  });

  it("AC-002 txt、docx、貼上三種輸入進入同一條分析流程，得到相同的風險結果", async () => {
    const paragraphs = FAKE_RISKY_CONTRACT.split("\n\n");
    const fromTxt = await extractTextFromFile(
      fakeFile("測試合約.txt", FAKE_RISKY_CONTRACT)
    );
    const fromDocx = await extractTextFromFile(
      fakeFile("測試合約.docx", await makeFakeDocx(paragraphs))
    );
    const fromPaste = extractFromPastedText(FAKE_RISKY_CONTRACT);
    expect(fromTxt.ok && fromDocx.ok && fromPaste.ok).toBe(true);
    if (!fromTxt.ok || !fromDocx.ok || !fromPaste.ok) return;

    const results = [fromTxt, fromDocx, fromPaste].map((r) =>
      analyze(r.fullText, r.pages)
    );
    expect(results[0].riskScore).toBe("red");
    expect(results[0].riskAnalysis.length).toBeGreaterThan(0);
    expect(results[1].riskScore).toBe(results[0].riskScore);
    expect(results[2].riskScore).toBe(results[0].riskScore);
    expect(results[1].riskAnalysis).toEqual(results[0].riskAnalysis);
    expect(results[2].riskAnalysis).toEqual(results[0].riskAnalysis);
    expect(results[1].clauses).toEqual(results[0].clauses);
  });

  it("AC-002 文字擷取與分析過程不會呼叫 fetch（合約內容不出瀏覽器）", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await extractTextFromFile(fakeFile("測試合約.txt", FAKE_RISKY_CONTRACT));
    if (r.ok) analyze(r.fullText, r.pages);
    await extractTextFromFile(
      fakeFile("測試合約.docx", await makeFakeDocx(["測試段落"]))
    );
    expect(fetchSpy).toHaveBeenCalledTimes(0);
    fetchSpy.mockRestore();
  });
});
