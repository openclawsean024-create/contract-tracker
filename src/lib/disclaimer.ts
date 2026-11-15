// AC-008：免責聲明（FR-021）
// 文案取自 PRD/SPEC.md §8 草案。【待 Sean 定稿】最終版須經律師確認，定稿前不得上市。
export const DISCLAIMER_TEXT =
  "本服務僅協助整理合約資訊與到期提醒。風險標記是依關鍵字規則自動比對產生，可能漏判或誤判，不構成法律意見，也不能取代律師審閱。簽約、續約或終止前，請自行判斷並諮詢專業律師。";

/** 顯示在聲明旁的草稿標記；Sean 定稿後移除。 */
export const DISCLAIMER_DRAFT_NOTE = "文案草稿，待 Sean 定稿";

/** 首次使用必須勾選的確認文字 */
export const DISCLAIMER_ACK_LABEL = "我了解本服務不構成法律意見";

export const DISCLAIMER_ACK_KEY = "contract-tracker:disclaimer-ack";

type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): KV | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** 是否已勾選「我了解本服務不構成法律意見」（存在本機） */
export function hasAcknowledgedDisclaimer(storage: KV | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(DISCLAIMER_ACK_KEY) === "1";
  } catch {
    return false;
  }
}

export function setDisclaimerAcknowledged(
  value: boolean,
  storage: KV | null = defaultStorage()
): void {
  if (!storage) return;
  try {
    if (value) storage.setItem(DISCLAIMER_ACK_KEY, "1");
    else storage.removeItem(DISCLAIMER_ACK_KEY);
  } catch {
    /* 本機儲存不可用時維持未勾選狀態 */
  }
}

/** 未勾選免責確認時不得上傳／分析合約 */
export function canUpload(acknowledged: boolean): boolean {
  return acknowledged === true;
}
