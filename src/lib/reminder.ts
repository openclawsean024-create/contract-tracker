// Local notifications for expiry reminders (F-005)
// Uses Notification API + setInterval for in-browser scheduling.
// Per ADR-005, this is purely local. v2 may add Email / LINE.

import { listContracts } from "./storage";
import type { Contract } from "../types";

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

export async function listExpiringContracts(
  withinDays = 90
): Promise<ExpiringContract[]> {
  const contracts = await listContracts();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const results: ExpiringContract[] = [];
  for (const c of contracts) {
    if (!c.isActive || !c.expiresAt) continue;
    const exp = new Date(c.expiresAt);
    exp.setHours(0, 0, 0, 0);
    const days = daysBetween(exp, today);
    if (days >= 0 && days <= withinDays) {
      results.push({ contract: c, daysUntilExpiry: days });
    }
  }
  return results.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
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

export async function checkAndNotify(): Promise<number> {
  const expiring = await listExpiringContracts(90);
  let count = 0;
  for (const { contract, daysUntilExpiry } of expiring) {
    const d = daysUntilExpiry;
    if (d === 30 || d === 60 || d === 90 || d === 7) {
      const ok = sendNotification(
        `合約到期提醒 — ${contract.title}`,
        `將於 ${d} 天後到期（${contract.expiresAt}），對象：${contract.counterparty}`
      );
      if (ok) count++;
    }
  }
  return count;
}

export function startReminderScheduler(): void {
  if (intervalHandle != null) return;
  // initial check after short delay
  setTimeout(() => void checkAndNotify(), 5000);
  intervalHandle = window.setInterval(
    () => void checkAndNotify(),
    REMINDER_CHECK_INTERVAL
  );
}

export function stopReminderScheduler(): void {
  if (intervalHandle != null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
