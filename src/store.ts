// Zustand store for app state
import { create } from "zustand";
import { v4 as uuid } from "uuid";
import type { Contract, LegalDB, TeamMember, Template } from "./types";
import { db, loadLegalDb, loadTemplates } from "./lib/storage";
import {
  LocalTeamAdapter,
  getCurrentMemberId,
  setCurrentMemberId,
  type TeamAdapter,
} from "./lib/team";
import {
  hasAcknowledgedDisclaimer,
  setDisclaimerAcknowledged,
} from "./lib/disclaimer";

// M1 只有本機實作；M2 換成雲端實作時只需替換這個 adapter。
export const teamAdapter: TeamAdapter = new LocalTeamAdapter(db, {
  generateId: () => uuid(),
  now: () => new Date(),
});

interface AppState {
  contracts: Contract[];
  legalDb: LegalDB | null;
  templates: Template[];
  members: TeamMember[];
  /** 目前身分（本機模擬，非登入） */
  currentMemberId: string | null;
  /** 是否已勾選「我了解本服務不構成法律意見」 */
  disclaimerAck: boolean;
  refreshContracts: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  setCurrentMember: (id: string | null) => void;
  setDisclaimerAck: (value: boolean) => void;
  bootstrap: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  contracts: [],
  legalDb: null,
  templates: [],
  members: [],
  currentMemberId: getCurrentMemberId(),
  disclaimerAck: hasAcknowledgedDisclaimer(),
  refreshContracts: async () => {
    const { listContracts } = await import("./lib/storage");
    const list = await listContracts();
    set({ contracts: list });
  },
  refreshMembers: async () => {
    const members = await teamAdapter.listMembers();
    const current = get().currentMemberId;
    // 目前身分指向的成員若已被移除，回到未選擇
    if (current && !members.some((m) => m.id === current)) {
      setCurrentMemberId(null);
      set({ members, currentMemberId: null });
    } else {
      set({ members });
    }
  },
  setCurrentMember: (id) => {
    setCurrentMemberId(id);
    set({ currentMemberId: id });
  },
  setDisclaimerAck: (value) => {
    setDisclaimerAcknowledged(value);
    set({ disclaimerAck: value });
  },
  bootstrap: async () => {
    const { listContracts } = await import("./lib/storage");
    // 本機資料先載入，不被靜態資料（法條庫／範本）的載入失敗擋住
    const [contracts, members] = await Promise.all([
      listContracts(),
      teamAdapter.listMembers(),
    ]);
    set({ contracts, members });
    const legalDb = await loadLegalDb();
    const templates = await loadTemplates();
    set({ legalDb, templates });
  },
}));
