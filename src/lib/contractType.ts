// 契約類型自動偵測（FR-007，併入 contract-reviewer 的 detectContractType，M-03）
// 純關鍵字比對，決定性輸出。偵測結果只是預設值，使用者可手動修改類別。
import type { ContractCategory } from "../types";

export type DetectedContractType =
  | "NDA"
  | "僱傭"
  | "採購"
  | "租賃"
  | "授權"
  | "顧問"
  | "服務"
  | "合作 MOU"
  | "一般";

// 對應到 tracker 既有的 6 類 ContractCategory。
// 「授權／顧問／服務／合作 MOU」在既有類別中沒有明確對應（無法從內文判斷己方是買方或賣方），
// M1 先歸為 other 並保留偵測標籤；是否擴充類別待 Sean 決定（見 STATUS.md）。
export const DETECTED_TYPE_TO_CATEGORY: Record<
  DetectedContractType,
  ContractCategory
> = {
  NDA: "nda",
  僱傭: "employment",
  採購: "vendor",
  租賃: "lease",
  授權: "other",
  顧問: "other",
  服務: "other",
  "合作 MOU": "other",
  一般: "other",
};

export function detectContractType(content: string): DetectedContractType {
  const lower = (content ?? "").toLowerCase();
  const has = (...keywords: string[]) => keywords.some((k) => lower.includes(k));
  if (has("保密", "nda")) return "NDA";
  if (has("勞動契約", "僱用", "月薪", "離職")) return "僱傭";
  if (has("採購", "貨款", "交貨")) return "採購";
  if (has("租賃", "租金", "押金", "出租人")) return "租賃";
  if (has("授權", "使用許可")) return "授權";
  if (has("顧問", "諮詢")) return "顧問";
  if (lower.includes("服務") && lower.includes("報酬")) return "服務";
  if (has("合作意向", "mou")) return "合作 MOU";
  return "一般";
}

export function detectContractCategory(content: string): ContractCategory {
  return DETECTED_TYPE_TO_CATEGORY[detectContractType(content)];
}
