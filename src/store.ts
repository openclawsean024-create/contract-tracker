// Zustand store for app state
import { create } from "zustand";
import type { Contract, LegalDB, Template } from "./types";
import { loadLegalDb, loadTemplates } from "./lib/storage";

interface AppState {
  contracts: Contract[];
  legalDb: LegalDB | null;
  templates: Template[];
  refreshContracts: () => Promise<void>;
  bootstrap: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  contracts: [],
  legalDb: null,
  templates: [],
  refreshContracts: async () => {
    const { listContracts } = await import("./lib/storage");
    const list = await listContracts();
    set({ contracts: list });
  },
  bootstrap: async () => {
    const legalDb = await loadLegalDb();
    const templates = await loadTemplates();
    const { listContracts } = await import("./lib/storage");
    const contracts = await listContracts();
    set({ legalDb, templates, contracts });
  },
}));
