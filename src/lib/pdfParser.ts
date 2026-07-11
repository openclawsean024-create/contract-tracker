// PDF.js text extraction (F-001)
// Pure-frontend, no upload to cloud. Per ADR-001.
import * as pdfjsLib from "pdfjs-dist";
// Vite-friendly worker: use ?url to get the bundled worker path
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { ClauseRecord, ClauseType } from "../types";

// Initialize worker once
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface PdfExtractionResult {
  totalPages: number;
  fullText: string;
  pages: ExtractedPage[];
  metadata?: { title?: string; author?: string };
  warning?: string;
  isEncrypted?: boolean;
  hasNoText?: boolean;
}

// Calculate SHA-256 of an ArrayBuffer
export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function extractPdfText(
  file: File,
  options?: { password?: string }
): Promise<PdfExtractionResult> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: buf,
    password: options?.password,
    isEvalSupported: false,
  }).promise.catch((err: Error) => {
    if (err.message?.toLowerCase().includes("password")) {
      throw new Error("PDF_001");
    }
    throw err;
  });

  const meta = await pdf.getMetadata().catch(() => ({ info: {} as any }));
  const totalPages = pdf.numPages as number;
  if (totalPages > 200) {
    throw new Error("PDF_004");
  }

  const pages: ExtractedPage[] = [];
  let fullText = "";

  for (let p = 1; p <= totalPages; p++) {
    const page = await pdf.getPage(p);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((it: any) => (typeof it.str === "string" ? it.str : ""))
      .join(" ");
    pages.push({ pageNumber: p, text: pageText });
    fullText += `\n\n[Page ${p}]\n${pageText}`;
  }

  const hasNoText = !fullText || fullText.replace(/\s/g, "").length < 20;

  return {
    totalPages,
    fullText: fullText.trim(),
    pages,
    metadata: meta.info as any,
    hasNoText,
    isEncrypted: false,
  };
}

// F-003: Extract 4 types of clauses using keyword/pattern matching
// (confidentiality / penalty / ip / term)
export interface ClauseExtractionPattern {
  type: ClauseType;
  patterns: RegExp[];
  label: string;
  // Page-level search: split text by pages, identify page where clause appears
}

const CLAUSE_PATTERNS: Record<string, RegExp[]> = {
  confidentiality: [
    /(保密|機密|不得洩漏|不得揭露|不得公開|不得告知|不得洩露|保密切結|保密義務|nondisclosure|confidential)/gi,
  ],
  penalty: [
    /(違約金|罰款|逾期罰|滯納金|懲罰性賠償|損害賠償|違約罰|契約總額|每日罰)/gi,
  ],
  ip: [
    /(智慧財產|著作權|專利|商標|營業秘密|技術資料|研發成果|智財權|著作財產權|know-how|IP|intellectual property)/gi,
  ],
  term: [
    /(契約期間|有效期間|合約期限|屆滿|期限屆至|契約終止|自動續約|續約|到期|年____月|租期|僱傭期間|聘期)/gi,
  ],
  payment: [
    /(付款|報酬|價金|租金|月付|分期|預付款|尾款|應付帳款|應於.{0,15}前.{0,5}支付|帳號|匯款)/gi,
  ],
  warranty: [
    /(保固|保證|瑕疵擔保|品質保證|擔保責任)/gi,
  ],
  liability: [
    /(責任|賠償|免責|不可抗力|天災|事變|賠償責任|連帶責任|求償)/gi,
  ],
  termination: [
    /(解除|終止|提前.{0,8}通知|預告|片面|解除權|終止權|撤銷|解除契約)/gi,
  ],
};

export function extractClauses(
  pages: ExtractedPage[]
): ClauseRecord[] {
  const clauses: ClauseRecord[] = [];
  let idCounter = 0;

  for (const [typeStr, patterns] of Object.entries(CLAUSE_PATTERNS)) {
    for (const page of pages) {
      const text = page.text;
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = pattern.exec(text)) !== null) {
          const start = Math.max(0, m.index - 60);
          const end = Math.min(text.length, m.index + 200);
          const snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
          clauses.push({
            id: `clause-${idCounter++}`,
            type: typeStr as ClauseType,
            originalText: snippet,
            pageNumber: page.pageNumber,
            riskLevel: "green",
            legalRefs: [],
          });
          if (m.index === pattern.lastIndex) pattern.lastIndex++;
          // only first match per page per type to avoid spam
          break;
        }
      }
    }
  }

  // Dedup near-identical snippets
  const seen = new Set<string>();
  return clauses.filter((c) => {
    const key = `${c.type}::${c.pageNumber}::${c.originalText.slice(0, 30)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
