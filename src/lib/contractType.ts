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

/**
 * 明確的契約名稱（強訊號）。全文中最早出現的名稱優先，通常就是標題。
 * 例如「勞動契約……乙方應保密」應判為僱傭，而不是因為出現「保密」就判為 NDA。
 */
const EXPLICIT_TYPE_NAMES: ReadonlyArray<[RegExp, DetectedContractType]> = [
  [/保密(?:協議|合約|契約|切結書|同意書)|\bnda\b/, "NDA"],
  [/勞動(?:契約|合約)|(?:僱傭|僱用|聘僱|雇傭|雇用)(?:契約|合約)/, "僱傭"],
  [/(?:採購|買賣|供貨|供應)(?:契約|合約)/, "採購"],
  [/(?:租賃|房屋租賃)(?:契約|合約)|租約/, "租賃"],
  [/授權(?:契約|合約|書)/, "授權"],
  [/顧問(?:契約|合約)/, "顧問"],
  [/(?:服務|委任|承攬)(?:契約|合約)/, "服務"],
  [/合作備忘錄|合作意向書|\bmou\b/, "合作 MOU"],
];

export function detectContractType(content: string): DetectedContractType {
  const lower = (content ?? "").toLowerCase();

  // 第一輪：明確的契約名稱，取最早出現者
  let best: { index: number; type: DetectedContractType } | null = null;
  for (const [re, type] of EXPLICIT_TYPE_NAMES) {
    const m = re.exec(lower);
    if (m && (best === null || m.index < best.index)) best = { index: m.index, type };
  }
  if (best) return best.type;

  // 第二輪：一般關鍵字（沿用 contract-reviewer 的規則），
  // 「保密」是許多合約都有的一般條款，所以排在其他類型線索之後
  const has = (...keywords: string[]) => keywords.some((k) => lower.includes(k));
  if (has("nda")) return "NDA";
  if (has("勞動契約", "僱用", "月薪", "離職")) return "僱傭";
  if (has("採購", "貨款", "交貨")) return "採購";
  if (has("租賃", "租金", "押金", "出租人")) return "租賃";
  if (has("授權", "使用許可")) return "授權";
  if (has("顧問", "諮詢")) return "顧問";
  if (lower.includes("服務") && lower.includes("報酬")) return "服務";
  if (has("合作意向", "mou")) return "合作 MOU";
  if (has("保密")) return "NDA";
  return "一般";
}

export function detectContractCategory(content: string): ContractCategory {
  return DETECTED_TYPE_TO_CATEGORY[detectContractType(content)];
}
