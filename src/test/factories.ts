// 測試用工廠：只產生明顯的假資料。
import type { Contract, TeamMember } from "../types";

export function makeTestContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "contract-test-1",
    title: "【測試】範例科技維護合約",
    category: "vendor",
    counterparty: "測試供應商有限公司",
    expiresAt: "2026-12-31",
    extractedText: "【測試用假合約】本合約期滿後自動續約一年。",
    riskScore: "green",
    riskAnalysis: [],
    reminderDaysBefore: 30,
    isActive: true,
    clauses: [],
    createdAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeTestMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: "member-a",
    name: "測試成員甲",
    email: "member.a@example.com",
    role: "admin",
    createdAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}
