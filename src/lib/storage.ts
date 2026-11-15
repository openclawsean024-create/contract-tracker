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

export async function deleteContract(id: string): Promise<void> {
  await db.contracts.delete(id);
}

export async function exportAll(): Promise<Blob> {
  const contracts = await listContracts();
  const blob = new Blob(
    [
      JSON.stringify(
        {
          app: "contract-tracker",
          version: "1.0.0",
          exportedAt: new Date().toISOString(),
          contracts,
        },
        null,
        2
      ),
    ],
    { type: "application/json" }
  );
  return blob;
}

export async function importAll(json: string): Promise<number> {
  const parsed = JSON.parse(json);
  if (!parsed.contracts || !Array.isArray(parsed.contracts)) {
    throw new Error("Invalid backup file");
  }
  let count = 0;
  await db.transaction("rw", db.contracts, async () => {
    for (const c of parsed.contracts as Contract[]) {
      await db.contracts.put(withContractDefaults(c));
      count++;
    }
  });
  return count;
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
