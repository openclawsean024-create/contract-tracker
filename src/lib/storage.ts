// IndexedDB layer via Dexie (FR-020 storage)
// 合約只存在本機瀏覽器（明文、未加密）；M1 不上雲。
import Dexie, { type Table } from "dexie";
import type {
  Contract,
  LegalDB,
  OutboxEmail,
  TeamMember,
  Template,
} from "../types";
import { TEAM_ROLE_LABELS } from "../types";
import { isValidDateKey } from "./dates";
import { isAllowedMockEmail } from "./team";

export const DB_NAME = "contract-tracker-db";
export const V1_CONTRACT_STORES = "id, category, riskScore, expiresAt, createdAt";

/** schema v2 新增欄位的預設值；不覆寫既有欄位，v1 資料不會遺失。 */
export function withContractDefaults(c: Contract): Contract {
  return {
    ...c,
    workflowStatus: c.workflowStatus ?? "draft",
    notes: Array.isArray(c.notes) ? c.notes : [],
    ownerId: c.ownerId ?? null,
    reminderRecipientIds: Array.isArray(c.reminderRecipientIds)
      ? c.reminderRecipientIds
      : [],
    riskNotes: Array.isArray(c.riskNotes) ? c.riskNotes : [],
  };
}

export class ContractDB extends Dexie {
  contracts!: Table<Contract, string>;
  teamMembers!: Table<TeamMember, string>;
  outbox!: Table<OutboxEmail, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      contracts: V1_CONTRACT_STORES,
    });
    // v2（M1）：工作流狀態、註解、負責人／提醒收件人；新增團隊成員與 mock 寄件匣
    this.version(2)
      .stores({
        contracts: `${V1_CONTRACT_STORES}, workflowStatus`,
        teamMembers: "id, email",
        outbox: "id, contractId, scheduledFor, createdAt",
      })
      .upgrade((tx) =>
        tx
          .table<Contract, string>("contracts")
          .toCollection()
          .modify((c) => {
            Object.assign(c, withContractDefaults(c));
          })
      );
  }
}

export const db = new ContractDB();

export async function listContracts(): Promise<Contract[]> {
  const rows = await db.contracts.orderBy("createdAt").reverse().toArray();
  return rows.map(withContractDefaults);
}

export async function getContract(id: string): Promise<Contract | undefined> {
  const c = await db.contracts.get(id);
  return c ? withContractDefaults(c) : undefined;
}

export async function saveContract(contract: Contract): Promise<void> {
  await db.contracts.put(withContractDefaults(contract));
}

export class ContractNotFoundError extends Error {
  constructor(id: string) {
    super(`找不到合約（可能已在其他分頁刪除）：${id}`);
    this.name = "ContractNotFoundError";
  }
}

/**
 * 在同一個 IndexedDB 交易中讀取「最新」的合約、套用變更後寫回。
 * 多個分頁同時編輯同一份合約時，只會改到這次變動的部分，不會用舊畫面的快照
 * 覆蓋其他分頁已寫入的工作流狀態、註解或指派（Codex 審查 #1）。
 */
export async function updateContract(
  id: string,
  mutate: (latest: Contract) => Contract,
  database: ContractDB = db
): Promise<Contract> {
  return database.transaction("rw", database.contracts, async () => {
    const latest = await database.contracts.get(id);
    if (!latest) throw new ContractNotFoundError(id);
    const next = withContractDefaults(mutate(withContractDefaults(latest)));
    await database.contracts.put(next);
    return next;
  });
}

/** 只更新指定欄位（以最新資料為基礎） */
export function patchContract(
  id: string,
  patch: Partial<Contract>,
  database: ContractDB = db
): Promise<Contract> {
  return updateContract(id, (latest) => ({ ...latest, ...patch, id: latest.id }), database);
}

export async function deleteContract(id: string): Promise<void> {
  await db.contracts.delete(id);
}

export const BACKUP_VERSION = "2";

export async function buildBackup(database: ContractDB = db, now: Date = new Date()) {
  const contracts = (await database.contracts.toArray()).map(withContractDefaults);
  const teamMembers = await database.teamMembers.toArray();
  return {
    app: "contract-tracker",
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    contracts,
    // 一併匯出成員，匯入到其他瀏覽器時負責人與提醒收件人才不會失聯
    teamMembers,
  };
}

export async function exportAll(): Promise<Blob> {
  return new Blob([JSON.stringify(await buildBackup(), null, 2)], {
    type: "application/json",
  });
}

export class InvalidBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBackupError";
  }
}

const RISK_LEVELS = new Set(["green", "yellow", "red"]);

/** 備份中的合約至少要有這些欄位且型別正確，否則略過 */
export function isValidBackupContract(c: unknown): c is Contract {
  if (!c || typeof c !== "object") return false;
  const x = c as Record<string, unknown>;
  return (
    typeof x.id === "string" &&
    x.id.length > 0 &&
    typeof x.title === "string" &&
    typeof x.counterparty === "string" &&
    typeof x.category === "string" &&
    typeof x.expiresAt === "string" &&
    // 詳情頁可以把到期日清空（存成 ""），這種合約也要能備份還原
    (x.expiresAt === "" || isValidDateKey(x.expiresAt)) &&
    typeof x.riskScore === "string" &&
    RISK_LEVELS.has(x.riskScore) &&
    Array.isArray(x.riskAnalysis) &&
    Array.isArray(x.clauses) &&
    typeof x.reminderDaysBefore === "number" &&
    Number.isInteger(x.reminderDaysBefore) &&
    x.reminderDaysBefore >= 0 &&
    typeof x.isActive === "boolean" &&
    typeof x.createdAt === "string"
  );
}

function isValidBackupMember(m: unknown): m is TeamMember {
  if (!m || typeof m !== "object") return false;
  const x = m as Record<string, unknown>;
  return (
    typeof x.id === "string" &&
    x.id.length > 0 &&
    typeof x.name === "string" &&
    x.name.trim().length > 0 &&
    typeof x.email === "string" &&
    isAllowedMockEmail(x.email) &&
    typeof x.role === "string" &&
    x.role in TEAM_ROLE_LABELS &&
    typeof x.createdAt === "string"
  );
}

export interface ImportResult {
  contractsAdded: number;
  /** 本機已有同 ID 的合約：保留本機版本，不覆蓋 */
  contractsSkipped: number;
  contractsInvalid: number;
  membersAdded: number;
  /** 本機已有同 ID 或同 Email 的成員 */
  membersSkipped: number;
  membersInvalid: number;
  /** 指向備份與本機都不存在的成員、因此改為未指派的負責人／收件人數 */
  assignmentsCleared: number;
}

/**
 * 匯入備份。預設**不覆蓋**本機已存在的合約與成員（Codex 審查 #2），
 * 避免舊備份把較新的審核進度、註解與指派倒回去。
 * 指向不存在成員的負責人／收件人會被清除，畫面顯示「未指派」。
 */
export async function importAll(
  json: string,
  database: ContractDB = db
): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new InvalidBackupError("備份檔不是有效的 JSON");
  }
  const backup = parsed as { app?: unknown; contracts?: unknown; teamMembers?: unknown };
  if (!backup || backup.app !== "contract-tracker" || !Array.isArray(backup.contracts)) {
    throw new InvalidBackupError("不是本工具匯出的備份檔");
  }
  const rawMembers = Array.isArray(backup.teamMembers) ? backup.teamMembers : [];
  const result: ImportResult = {
    contractsAdded: 0,
    contractsSkipped: 0,
    contractsInvalid: 0,
    membersAdded: 0,
    membersSkipped: 0,
    membersInvalid: 0,
    assignmentsCleared: 0,
  };

  await database.transaction("rw", database.contracts, database.teamMembers, async () => {
    const existingMembers = await database.teamMembers.toArray();
    const localIds = new Set(existingMembers.map((m) => m.id));
    const localIdByEmail = new Map(existingMembers.map((m) => [m.email.toLowerCase(), m.id]));
    /** 備份中的成員 ID → 本機成員 ID（同 Email 的成員視為同一人） */
    const idMap = new Map<string, string>(existingMembers.map((m) => [m.id, m.id]));
    for (const m of rawMembers) {
      if (!isValidBackupMember(m)) {
        result.membersInvalid++;
        continue;
      }
      const email = m.email.trim().toLowerCase();
      const sameEmail = localIdByEmail.get(email);
      if (sameEmail) {
        idMap.set(m.id, sameEmail);
        result.membersSkipped++;
        continue;
      }
      if (localIds.has(m.id)) {
        // ID 相同但 Email 不同：視為不同的人，不把指派對應到本機那位
        result.membersSkipped++;
        continue;
      }
      await database.teamMembers.add({ ...m, email, name: m.name.trim() });
      localIds.add(m.id);
      localIdByEmail.set(email, m.id);
      idMap.set(m.id, m.id);
      result.membersAdded++;
    }

    for (const c of backup.contracts as unknown[]) {
      if (!isValidBackupContract(c)) {
        result.contractsInvalid++;
        continue;
      }
      if (await database.contracts.get(c.id)) {
        result.contractsSkipped++;
        continue;
      }
      const withDefaults = withContractDefaults(c);
      const ownerId = withDefaults.ownerId ? idMap.get(withDefaults.ownerId) ?? null : null;
      const recipients = [
        ...new Set(
          (withDefaults.reminderRecipientIds ?? [])
            .map((id) => idMap.get(id))
            .filter((id): id is string => typeof id === "string")
        ),
      ];
      const cleared =
        (withDefaults.ownerId && !ownerId ? 1 : 0) +
        (withDefaults.reminderRecipientIds ?? []).filter((id) => !idMap.has(id)).length;
      result.assignmentsCleared += cleared;
      await database.contracts.add({ ...withDefaults, ownerId, reminderRecipientIds: recipients });
      result.contractsAdded++;
    }
  });
  return result;
}

// 100 條法條庫（靜態 JSON asset，同 origin）
let cachedLegalDb: LegalDB | null = null;
export async function loadLegalDb(): Promise<LegalDB> {
  if (cachedLegalDb) return cachedLegalDb;
  const res = await fetch("/data/legal-db.json");
  if (!res.ok) throw new Error("Failed to load legal-db.json");
  cachedLegalDb = (await res.json()) as LegalDB;
  return cachedLegalDb;
}

let cachedTemplates: Template[] | null = null;
export async function loadTemplates(): Promise<Template[]> {
  if (cachedTemplates) return cachedTemplates;
  const res = await fetch("/data/templates.json");
  if (!res.ok) throw new Error("Failed to load templates.json");
  const data = await res.json();
  cachedTemplates = data.templates as Template[];
  return cachedTemplates;
}
