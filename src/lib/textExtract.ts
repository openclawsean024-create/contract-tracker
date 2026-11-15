// 多格式輸入（FR-003，併入 contract-reviewer 的 parser，M-01／M-02）
// .txt／.md 直接讀文字、.docx 以 mammoth 擷取、.pdf 沿用 tracker 的 extractPdfText、另支援貼上內文。
// 四種輸入都轉成同一個 { fullText, pages } 結構，交給同一條條款擷取與風險評估流程。
// 全程在瀏覽器內處理，不發出任何網路請求。
import type { ContractSource } from "../types";
import type { ExtractedPage } from "./pdfParser";

export type TextExtractErrorCode =
  | "UNSUPPORTED"
  | "EMPTY"
  | "PARSE_FAILED"
  | "PDF_ENCRYPTED"
  | "PDF_TOO_LONG"
  | "PDF_NO_TEXT";

export interface TextExtractSuccess {
  ok: true;
  source: ContractSource;
  fullText: string;
  pages: ExtractedPage[];
}

export interface TextExtractFailure {
  ok: false;
  code: TextExtractErrorCode;
  /** 可直接顯示給使用者的訊息（已含改用貼上文字的提示） */
  message: string;
}

export type TextExtractResult = TextExtractSuccess | TextExtractFailure;

export const PASTE_HINT = "請改用「貼上合約內文」。";
export const SUPPORTED_EXTENSIONS = [".pdf", ".txt", ".md", ".docx"] as const;
export const FILE_ACCEPT = ".pdf,.txt,.md,.docx";

const ERROR_MESSAGES: Record<TextExtractErrorCode, string> = {
  UNSUPPORTED: "不支援的檔案格式（僅支援 .pdf、.txt、.docx）。",
  EMPTY: "沒有可分析的文字內容。",
  PARSE_FAILED: "檔案解析失敗。",
  PDF_ENCRYPTED: "PDF 已加密，無法讀取。",
  PDF_TOO_LONG: "PDF 超過 200 頁上限。",
  PDF_NO_TEXT: "此 PDF 為圖片型或沒有可擷取的文字。",
};

function fail(code: TextExtractErrorCode, detail?: string): TextExtractFailure {
  const base = ERROR_MESSAGES[code];
  return {
    ok: false,
    code,
    message: `${base}${detail ? `（${detail}）` : ""}${PASTE_HINT}`,
  };
}

export function detectFileKind(
  fileName: string
): Exclude<ContractSource, "paste"> | null {
  const name = fileName.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".txt") || name.endsWith(".md")) return "txt";
  return null;
}

/**
 * 把純文字切成「段」，沿用 ExtractedPage 結構（pageNumber＝段落序號），
 * 讓條款擷取可以逐段比對，不會整份文字每類只取到一個條款。
 */
export function textToPages(text: string): ExtractedPage[] {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];
  let blocks = normalized
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length === 1 && normalized.includes("\n")) {
    blocks = normalized
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean);
  }
  return blocks.map((block, i) => ({ pageNumber: i + 1, text: block }));
}

function fromText(text: string, source: ContractSource): TextExtractResult {
  const pages = textToPages(text);
  if (pages.length === 0) return fail("EMPTY");
  return {
    ok: true,
    source,
    fullText: pages.map((p) => p.text).join("\n\n"),
    pages,
  };
}

/** 貼上合約內文 */
export function extractFromPastedText(text: string): TextExtractResult {
  return fromText(text ?? "", "paste");
}

export async function extractDocxText(arrayBuffer: ArrayBuffer): Promise<string> {
  // 使用 mammoth 的獨立瀏覽器 bundle：瀏覽器與 Node（測試）走同一條程式路徑。
  const { default: mammoth } = await import("mammoth/mammoth.browser");
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

type FileLike = Pick<File, "name" | "arrayBuffer" | "text">;

export async function extractTextFromFile(
  file: FileLike
): Promise<TextExtractResult> {
  const kind = detectFileKind(file.name);
  if (!kind) return fail("UNSUPPORTED");
  try {
    if (kind === "txt") {
      return fromText(await file.text(), "txt");
    }
    if (kind === "docx") {
      return fromText(await extractDocxText(await file.arrayBuffer()), "docx");
    }
    // PDF：沿用 tracker 的 extractPdfText（有 worker 設定、加密與頁數檢查、無文字偵測）
    const { extractPdfText } = await import("./pdfParser");
    const result = await extractPdfText(file as File);
    if (result.hasNoText) return fail("PDF_NO_TEXT");
    return {
      ok: true,
      source: "pdf",
      fullText: result.fullText,
      pages: result.pages,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "PDF_001") return fail("PDF_ENCRYPTED");
    if (message === "PDF_004") return fail("PDF_TOO_LONG");
    return fail("PARSE_FAILED", message);
  }
}
