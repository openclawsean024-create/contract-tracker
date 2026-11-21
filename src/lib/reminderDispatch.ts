// 到期提醒寄送（FR-011／FR-012）— M1 只做 mock 寄件匣，不會真的寄出任何信件。
// 寄送一律透過 EmailAdapter 介面；日期由呼叫端注入，不直接讀系統時鐘；不發出任何網路請求。
import type { Contract, OutboxEmail, TeamMember } from "../types";
import { DISCLAIMER_TEXT } from "./disclaimer";
import { ownerLabel, resolveReminderRecipients } from "./team";
import type { ContractDB } from "./storage";
import { daysUntil, toDateKey } from "./dates";

export { daysUntil, toDateKey };

/** 不論使用者設定為何，固定會在到期前 7 天與到期當天各提醒一次。 */
export const FIXED_REMINDER_THRESHOLDS: readonly number[] = [7, 0];

export interface EmailMessage {
  /** 去重鍵：同一份合約、同一個門檻、同一天只會寫入一次 */
  dedupeKey: string;
  contractId: string;
  threshold: number;
  /** 預定寄送日期（YYYY-MM-DD） */
  scheduledFor: string;
  to: string[];
  subject: string;
  body: string;
}

export interface EmailSendResult {
  /** false 表示相同 dedupeKey 的信已存在，本次未重複寫入 */
  accepted: boolean;
}

export interface EmailAdapter {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export interface OutboxStore {
  /** 不存在才寫入；回傳是否有寫入。 */
  addIfAbsent(email: OutboxEmail): Promise<boolean>;
  list(): Promise<OutboxEmail[]>;
  clear(): Promise<void>;
}

/** 測試用的記憶體寄件匣 */
export class MemoryOutboxStore implements OutboxStore {
  private readonly emails = new Map<string, OutboxEmail>();

  async addIfAbsent(email: OutboxEmail): Promise<boolean> {
    if (this.emails.has(email.id)) return false;
    this.emails.set(email.id, email);
    return true;
  }

  async list(): Promise<OutboxEmail[]> {
    return [...this.emails.values()];
  }

  async clear(): Promise<void> {
    this.emails.clear();
  }
}

/** 本機寄件匣（IndexedDB outbox 資料表） */
export class DexieOutboxStore implements OutboxStore {
  constructor(private readonly database: ContractDB) {}

  async addIfAbsent(email: OutboxEmail): Promise<boolean> {
    const { database } = this;
    return database.transaction("rw", database.outbox, async () => {
      if (await database.outbox.get(email.id)) return false;
      await database.outbox.add(email);
      return true;
    });
  }

  async list(): Promise<OutboxEmail[]> {
    const rows = await this.database.outbox.toArray();
    return rows.sort((a, b) =>
      a.createdAt === b.createdAt
        ? a.id < b.id
          ? -1
          : 1
        : a.createdAt < b.createdAt
        ? 1
        : -1
    );
  }

  async clear(): Promise<void> {
    await this.database.outbox.clear();
  }
}

/** M1 唯一的 EmailAdapter 實作：把信件寫入本機寄件匣，不連任何 Email 服務。 */
export class MockEmailAdapter implements EmailAdapter {
  constructor(
    private readonly store: OutboxStore,
    private readonly now: () => Date
  ) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const accepted = await this.store.addIfAbsent({
      id: message.dedupeKey,
      contractId: message.contractId,
      threshold: message.threshold,
      scheduledFor: message.scheduledFor,
      to: message.to,
      subject: message.subject,
      body: message.body,
      createdAt: this.now().toISOString(),
    });
    return { accepted };
  }
}

/** 這份合約的所有提醒門檻：使用者設定的天數＋固定的 7 天與當天（去重、由大到小）。 */
export function reminderThresholds(
  contract: Pick<Contract, "reminderDaysBefore">
): number[] {
  const set = new Set<number>(FIXED_REMINDER_THRESHOLDS);
  const custom = contract.reminderDaysBefore;
  if (Number.isInteger(custom) && custom >= 0) set.add(custom);
  return [...set].sort((a, b) => b - a);
}

/** 今天是否剛好命中某個門檻；停用、已過期或未命中時回傳 null。 */
export function dueThreshold(
  contract: Pick<Contract, "reminderDaysBefore" | "expiresAt" | "isActive">,
  todayKey: string
): number | null {
  if (!contract.isActive || !contract.expiresAt) return null;
  const days = daysUntil(contract.expiresAt, todayKey);
  if (days === null || days < 0) return null;
  return reminderThresholds(contract).includes(days) ? days : null;
}

export function buildReminderEmail(
  contract: Contract,
  threshold: number,
  todayKey: string,
  members: ReadonlyArray<TeamMember>
): EmailMessage {
  const recipients = resolveReminderRecipients(contract, members);
  const when = threshold === 0 ? "今天到期" : `將於 ${threshold} 天後到期`;
  const body = [
    `合約「${contract.title}」${when}。`,
    "",
    `到期日：${contract.expiresAt}`,
    `對方：${contract.counterparty}`,
    `負責人：${ownerLabel(contract, members)}`,
    `提醒門檻：${threshold === 0 ? "到期當天" : `到期前 ${threshold} 天`}`,
    "",
    "請確認是否續約、重新議約或終止，並留意合約約定的通知期限。",
    "",
    "（此為本機模擬信件，未實際寄出。）",
    "",
    DISCLAIMER_TEXT,
  ].join("\n");
  return {
    dedupeKey: `${contract.id}:${threshold}:${todayKey}`,
    contractId: contract.id,
    threshold,
    scheduledFor: todayKey,
    to: recipients.map((m) => m.email),
    subject: `【合約到期提醒】${contract.title} ${when}`,
    body,
  };
}

export interface DispatchInput {
  /** 注入的「今天」；函式內不讀系統時鐘 */
  today: Date;
  contracts: ReadonlyArray<Contract>;
  members: ReadonlyArray<TeamMember>;
  adapter: EmailAdapter;
}

export interface DispatchSummary {
  todayKey: string;
  checked: number;
  /** 本次新寫入寄件匣的信件 */
  sent: EmailMessage[];
  /** 已寄過（同合約、同門檻、同一天）而略過的數量 */
  skippedDuplicate: number;
}

/** 檢查所有合約並把到期提醒交給 adapter；重複執行不會重寄。 */
export async function dispatchReminders(
  input: DispatchInput
): Promise<DispatchSummary> {
  const todayKey = toDateKey(input.today);
  const summary: DispatchSummary = {
    todayKey,
    checked: input.contracts.length,
    sent: [],
    skippedDuplicate: 0,
  };
  for (const contract of input.contracts) {
    const threshold = dueThreshold(contract, todayKey);
    if (threshold === null) continue;
    const message = buildReminderEmail(contract, threshold, todayKey, input.members);
    const { accepted } = await input.adapter.send(message);
    if (accepted) summary.sent.push(message);
    else summary.skippedDuplicate++;
  }
  return summary;
}
