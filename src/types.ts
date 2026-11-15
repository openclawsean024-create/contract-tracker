// Type definitions for the contract tracker
export type RiskLevel = "green" | "yellow" | "red";

// 類別沿用 M1 既有 6 類（是否擴充「採購／授權／顧問／服務」待 Sean 決定，見 STATUS.md）。
export type ContractCategory =
  | "client"
  | "vendor"
  | "lease"
  | "nda"
  | "employment"
  | "other";

export type ClauseType =
  | "confidentiality"
  | "penalty"
  | "ip"
  | "term"
  | "payment"
  | "warranty"
  | "liability"
  | "termination"
  | "other";

export interface ClauseRecord {
  id: string;
  type: ClauseType;
  originalText: string;
  pageNumber: number;
  riskLevel: RiskLevel;
  legalRefs: string[];
  notes?: string;
}

// 風險分類維度（併入 contract-reviewer 的 RiskItem.category，M-05）
export type RiskCategory =
  | "validity"
  | "rights"
  | "payment"
  | "dispute"
  | "competition"
  | "damages"
  | "employment";

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  validity: "有效性",
  rights: "權利義務",
  payment: "金流",
  dispute: "爭端解決",
  competition: "競爭",
  damages: "損害賠償",
  employment: "就業",
};

export interface RiskIssue {
  clauseId?: string;
  /** 產生此項目的規則 ID（決定性，可追溯） */
  ruleId?: string;
  issue: string;
  suggestion: string;
  legalRef: string;
  severity: RiskLevel;
  category?: RiskCategory;
  /** info＝資訊提示（例如已約定管轄、不可抗力），不計入風險分級 */
  kind?: "risk" | "info";
}

// 5 階段審核工作流（M-06），只能依序往下推進
export type WorkflowStatus =
  | "draft"
  | "in_review"
  | "legal_review"
  | "manager_approval"
  | "counterparty_signed";

export interface ContractNote {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export type ContractSource = "pdf" | "txt" | "docx" | "paste";

export interface Contract {
  id: string;
  title: string;
  category: ContractCategory;
  counterparty: string;
  signedAt?: string;
  effectiveAt?: string;
  expiresAt: string;
  pdfHash?: string;
  extractedText?: string;
  riskScore: RiskLevel;
  riskAnalysis: RiskIssue[];
  reminderDaysBefore: number;
  isActive: boolean;
  clauses: ClauseRecord[];
  createdAt: string;
  // ---- schema v2（M1）：v1 資料升級時補上預設值，型別上保持 optional 以相容舊備份 ----
  /** 資訊提示（不計入風險分級） */
  riskNotes?: RiskIssue[];
  /** 規則偵測到的契約類型標籤（例如「顧問」），category 可由使用者手動修改 */
  detectedType?: string;
  source?: ContractSource;
  workflowStatus?: WorkflowStatus;
  notes?: ContractNote[];
  /** 負責人（TeamMember.id）；null／undefined＝未指派 */
  ownerId?: string | null;
  /** 提醒收件人（TeamMember.id[]） */
  reminderRecipientIds?: string[];
}

export type TeamRole = "admin" | "procurement" | "legal" | "manager";

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  admin: "行政／總務",
  procurement: "採購",
  legal: "法務",
  manager: "主管",
};

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  createdAt: string;
}

/** mock 寄件匣中的一封提醒信（M1 不會真的寄出） */
export interface OutboxEmail {
  /** 去重鍵：contractId:threshold:scheduledFor */
  id: string;
  contractId: string;
  threshold: number;
  /** 預定寄送日期（YYYY-MM-DD） */
  scheduledFor: string;
  to: string[];
  subject: string;
  body: string;
  createdAt: string;
}

export interface LegalArticle {
  id: string;
  category: string;
  categoryLabel: string;
  title: string;
  summary: string;
  fullText: string;
  versionDate: string;
  source: string;
  riskKeywords: string[];
}

export interface LegalDB {
  version: string;
  source: string;
  count: number;
  articles: LegalArticle[];
}

export interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  content: string;
}

export const CATEGORY_LABELS: Record<ContractCategory, string> = {
  client: "客戶合約",
  vendor: "供應商合約",
  lease: "租賃合約",
  nda: "保密協議",
  employment: "聘僱合約",
  other: "其他",
};

// 只呈現綠／黃／紅三級，不提供數值分數（Sean 2026-11-16 決定）
export const RISK_LABELS: Record<RiskLevel, string> = {
  green: "低風險",
  yellow: "中風險",
  red: "高風險",
};
