// 日曆日期（YYYY-MM-DD）的共用處理。到期日、提醒門檻、儀表板都用同一個基準：
// 「使用者所在時區的今天」對上「合約上寫的日期」，以日為單位比較，不受 UTC 偏移影響。

const pad = (n: number) => String(n).padStart(2, "0");

/** 以本地時區取得 YYYY-MM-DD */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 嚴格解析 YYYY-MM-DD；格式錯誤或不存在的日期（例如 2026-02-30）回傳 null。 */
export function parseDateKey(key: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key ?? "");
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = Date.UTC(y, mo - 1, d);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d
  ) {
    return null;
  }
  return utc;
}

export function isValidDateKey(key: string): boolean {
  return parseDateKey(key) !== null;
}

/** 距離到期還有幾天（當天＝0、已過期為負數）；日期無效時回傳 null。 */
export function daysUntil(expiresAt: string, todayKey: string): number | null {
  const exp = parseDateKey(expiresAt);
  const today = parseDateKey(todayKey);
  if (exp === null || today === null) return null;
  return Math.round((exp - today) / 86_400_000);
}

/** 本地日曆上的 n 天後（YYYY-MM-DD） */
export function addDaysKey(date: Date, days: number): string {
  return toDateKey(
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
  );
}
