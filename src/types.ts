// Type definitions for the contract tracker
export type RiskLevel = "green" | "yellow" | "red";

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

export interface RiskIssue {
  clauseId?: string;
  issue: string;
  suggestion: string;
  legalRef: string;
  severity: RiskLevel;
}

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

export const RISK_LABELS: Record<RiskLevel, string> = {
  green: "低風險",
  yellow: "中風險",
  red: "高風險",
};
