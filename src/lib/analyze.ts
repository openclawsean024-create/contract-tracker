// 單一分析流程：PDF／TXT／DOCX／貼上文字 → 條款擷取 → 風險評估 → 類型偵測 → Contract
// 純函式（id 與時間由呼叫端注入），不發出網路請求。
import type { Contract, ContractSource, LegalArticle } from "../types";
import { detectContractType, DETECTED_TYPE_TO_CATEGORY } from "./contractType";
import { evaluateRisk } from "./legalDb";
import { extractClauses, type ExtractedPage } from "./pdfParser";

/** 本機保存的合約內文上限（字元） */
export const EXTRACTED_TEXT_LIMIT = 8000;
export const DEFAULT_REMINDER_DAYS = 30;

export interface AnalyzeInput {
  id: string;
  title: string;
  source: ContractSource;
  fullText: string;
  pages: ExtractedPage[];
  articles: LegalArticle[];
  /** 注入的現在時間 */
  now: Date;
  pdfHash?: string;
}

export function analyzeContract(input: AnalyzeInput): Contract {
  const clauses = extractClauses(input.pages);
  const evaluation = evaluateRisk(input.id, clauses, input.articles, {
    fullText: input.fullText,
  });
  const detectedType = detectContractType(input.fullText);
  const expires = new Date(input.now.getTime() + 365 * 24 * 60 * 60 * 1000);

  return {
    id: input.id,
    title: input.title.trim() || "未命名合約",
    category: DETECTED_TYPE_TO_CATEGORY[detectedType],
    detectedType,
    source: input.source,
    counterparty: "未設定",
    // 到期日不會從內文擷取（FR-009 屬 M2），先預設一年後，請使用者自行確認修改
    expiresAt: expires.toISOString().slice(0, 10),
    pdfHash: input.pdfHash,
    extractedText: input.fullText.slice(0, EXTRACTED_TEXT_LIMIT),
    riskScore: evaluation.score,
    riskAnalysis: evaluation.issues,
    riskNotes: evaluation.infos,
    reminderDaysBefore: DEFAULT_REMINDER_DAYS,
    isActive: true,
    clauses: clauses.map((c) => {
      const update = evaluation.clauseUpdates.get(c.id);
      return update ? { ...c, ...update } : c;
    }),
    createdAt: input.now.toISOString(),
    workflowStatus: "draft",
    notes: [],
    ownerId: null,
    reminderRecipientIds: [],
  };
}
