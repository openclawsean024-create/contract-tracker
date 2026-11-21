// 到期清單（FR-010）、瀏覽器本機通知（FR-011）與提醒排程
// 提醒門檻與去重邏輯在 reminderDispatch.ts；這裡只負責把本機資料接上去。
// M1 不寄真實 Email：信件只寫入本機 mock 寄件匣。

import { db, listContracts } from "./storage";
import type { Contract } from "../types";
import {
  DexieOutboxStore,
  MockEmailAdapter,
  dispatchReminders,
  type DispatchSummary,
} from "./reminderDispatch";
import { daysUntil, toDateKey } from "./dates";
import { LocalTeamAdapter, type TeamAdapter } from "./team";

/** 提醒只讀成員清單；仍透過 TeamAdapter 介面存取，M2 換成雲端實作時不用改這裡。 */
const readOnlyTeam: TeamAdapter = new LocalTeamAdapter(db, {
  generateId: () => {
    throw new Error("readOnlyTeam 不新增成員");
  },
  now: () => new Date(),
});

const REMINDER_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
let intervalHandle: number | null = null;

export interface ExpiringContract {
  contract: Contract;
  daysUntilExpiry: number;
}

export function daysBetween(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/**
 * 純函式：與寄件匣使用同一個日曆日期基準（本地時區的今天 vs. 合約日期），
 * 因此在 UTC 負偏移時區也不會把當天到期的合約算成昨天。
 */
export function computeExpiring(
  contracts: ReadonlyArray<Contract>,
  withinDays: number,
  now: Date
): ExpiringContract[] {
  const todayKey = toDateKey(now);
  const results: ExpiringContract[] = [];
  for (const c of contracts) {
    if (!c.isActive || !c.expiresAt) continue;
    const days = daysUntil(c.expiresAt, todayKey);
    if (days !== null && days >= 0 && days <= withinDays) {
      results.push({ contract: c, daysUntilExpiry: days });
    }
  }
  return results.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

export async function listExpiringContracts(
  withinDays = 90,
  now: Date = new Date()
): Promise<ExpiringContract[]> {
  return computeExpiring(await listContracts(), withinDays, now);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const res = await Notification.requestPermission();
  return res === "granted";
}

export function sendNotification(title: string, body: string): boolean {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission !== "granted") return false;
  try {
    new Notification(title, { body });
    return true;
  } catch {
    return false;
  }
}

/**
 * 執行一次提醒檢查：依每份合約的 reminderDaysBefore（外加固定的 7 天與當天）
 * 把到期提醒寫入本機 mock 寄件匣；只有「本次新寫入」的提醒才會發瀏覽器通知，
 * 因此同一份合約、同一個門檻、同一天不會重複提醒。
 */
export async function runReminderCheck(
  now: Date = new Date()
): Promise<DispatchSummary> {
  const [contracts, members] = await Promise.all([
    listContracts(),
    readOnlyTeam.listMembers(),
  ]);
  const adapter = new MockEmailAdapter(new DexieOutboxStore(db), () => now);
  const summary = await dispatchReminders({
    today: now,
    contracts,
    members,
    adapter,
  });
  for (const message of summary.sent) {
    sendNotification(message.subject, message.body.split("\n")[0]);
  }
  return summary;
}

/** 相容舊介面：回傳本次新觸發的提醒數量。 */
export async function checkAndNotify(now: Date = new Date()): Promise<number> {
  const summary = await runReminderCheck(now);
  return summary.sent.length;
}

export function startReminderScheduler(now: () => Date = () => new Date()): void {
  if (intervalHandle != null) return;
  // initial check after short delay
  setTimeout(() => void checkAndNotify(now()), 5000);
  intervalHandle = window.setInterval(
    () => void checkAndNotify(now()),
    REMINDER_CHECK_INTERVAL
  );
}

export function stopReminderScheduler(): void {
  if (intervalHandle != null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
