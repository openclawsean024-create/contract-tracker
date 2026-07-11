// IndexedDB layer via Dexie (F-007 storage)
// Store contracts locally; 100% on-device per ADR-004
import Dexie, { type Table } from "dexie";
import type { Contract, LegalDB, Template } from "../types";

class ContractDB extends Dexie {
  contracts!: Table<Contract, string>;

  constructor() {
    super("contract-tracker-db");
    this.version(1).stores({
      contracts: "id, category, riskScore, expiresAt, createdAt",
    });
  }
}

export const db = new ContractDB();

export async function listContracts(): Promise<Contract[]> {
  return db.contracts.orderBy("createdAt").reverse().toArray();
}

export async function getContract(id: string): Promise<Contract | undefined> {
  return db.contracts.get(id);
}

export async function saveContract(contract: Contract): Promise<void> {
  await db.contracts.put(contract);
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
      await db.contracts.put(c);
      count++;
    }
  });
  return count;
}

// F-002: 100 條法條庫（pure JSON asset, fallback to public/data/legal-db.json)
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
