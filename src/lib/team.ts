// 團隊共用（本機 mock）（FR-013）
// 透過 TeamAdapter 介面存取；M1 只提供本機（IndexedDB）實作，不連任何雲端或帳號服務。
// 成員 Email 只接受 example.com／example.test 網域的假資料。
import type { Contract, TeamMember, TeamRole } from "../types";
import { TEAM_ROLE_LABELS } from "../types";
import type { ContractDB } from "./storage";

export const UNASSIGNED_LABEL = "未指派";
export const ALLOWED_MOCK_EMAIL_DOMAINS = ["example.com", "example.test"] as const;
export const CURRENT_MEMBER_KEY = "contract-tracker:current-member";

export class TeamValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamValidationError";
  }
}

export interface NewMemberInput {
  name: string;
  email: string;
  role: TeamRole;
}

export interface TeamAdapter {
  listMembers(): Promise<TeamMember[]>;
  addMember(input: NewMemberInput): Promise<TeamMember>;
  /** 移除成員；該成員負責的合約改為未指派，並從提醒收件人中移除。 */
  removeMember(id: string): Promise<void>;
}

/** M1 只允許假資料網域：精確比對 example.com 或 example.test（GOAL AC-007），不含子網域。 */
export function isAllowedMockEmail(email: string): boolean {
  const m = /^[^\s@]+@([^\s@]+)$/.exec((email ?? "").trim().toLowerCase());
  if (!m) return false;
  return (ALLOWED_MOCK_EMAIL_DOMAINS as readonly string[]).includes(m[1]);
}

export function validateMemberInput(
  input: NewMemberInput,
  existing: ReadonlyArray<TeamMember> = []
): NewMemberInput {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) throw new TeamValidationError("請填寫姓名");
  if (!isAllowedMockEmail(email)) {
    throw new TeamValidationError(
      "M1 為本機模擬，Email 只接受 example.com 或 example.test 網域的假資料"
    );
  }
  if (!(input.role in TEAM_ROLE_LABELS)) {
    throw new TeamValidationError("角色不正確");
  }
  if (existing.some((m) => m.email === email)) {
    throw new TeamValidationError("此 Email 已在成員清單中");
  }
  return { name, email, role: input.role };
}

export interface LocalTeamAdapterOptions {
  generateId: () => string;
  now: () => Date;
}

/** 本機實作：成員存在 IndexedDB（teamMembers）。 */
export class LocalTeamAdapter implements TeamAdapter {
  constructor(
    private readonly database: ContractDB,
    private readonly options: LocalTeamAdapterOptions
  ) {}

  async listMembers(): Promise<TeamMember[]> {
    const rows = await this.database.teamMembers.toArray();
    return rows.sort((a, b) =>
      a.createdAt === b.createdAt
        ? a.id < b.id
          ? -1
          : 1
        : a.createdAt < b.createdAt
        ? -1
        : 1
    );
  }

  async addMember(input: NewMemberInput): Promise<TeamMember> {
    const { database } = this;
    // 檢查與新增在同一個讀寫交易中：同時新增兩筆相同 Email 時，第二筆會看到第一筆而被拒絕
    return database.transaction("rw", database.teamMembers, async () => {
      const existing = await database.teamMembers.toArray();
      const valid = validateMemberInput(input, existing);
      const member: TeamMember = {
        id: this.options.generateId(),
        ...valid,
        createdAt: this.options.now().toISOString(),
      };
      await database.teamMembers.add(member);
      return member;
    });
  }

  async removeMember(id: string): Promise<void> {
    const { database } = this;
    await database.transaction(
      "rw",
      database.teamMembers,
      database.contracts,
      async () => {
        await database.teamMembers.delete(id);
        await database.contracts.toCollection().modify((c) => {
          if (c.ownerId === id) c.ownerId = null;
          if (Array.isArray(c.reminderRecipientIds)) {
            c.reminderRecipientIds = c.reminderRecipientIds.filter(
              (r) => r !== id
            );
          }
        });
      }
    );
  }
}

function findMember(
  members: ReadonlyArray<TeamMember>,
  id: string | null | undefined
): TeamMember | undefined {
  return id ? members.find((m) => m.id === id) : undefined;
}

/** 指派負責人；傳入 null 表示取消指派。成員不存在時丟出錯誤。 */
export function assignOwner<T extends Contract>(
  contract: T,
  memberId: string | null,
  members: ReadonlyArray<TeamMember>
): T {
  if (memberId !== null && !findMember(members, memberId)) {
    throw new TeamValidationError("找不到指定的成員");
  }
  return { ...contract, ownerId: memberId };
}

/** 設定提醒收件人（去除重複與不存在的成員）。 */
export function setReminderRecipients<T extends Contract>(
  contract: T,
  memberIds: ReadonlyArray<string>,
  members: ReadonlyArray<TeamMember>
): T {
  const valid = [...new Set(memberIds)].filter((id) => findMember(members, id));
  return { ...contract, reminderRecipientIds: valid };
}

export function getOwner(
  contract: Pick<Contract, "ownerId">,
  members: ReadonlyArray<TeamMember>
): TeamMember | undefined {
  return findMember(members, contract.ownerId);
}

/** 負責人顯示名稱；沒有負責人或成員已被移除時顯示「未指派」。 */
export function ownerLabel(
  contract: Pick<Contract, "ownerId">,
  members: ReadonlyArray<TeamMember>
): string {
  return getOwner(contract, members)?.name ?? UNASSIGNED_LABEL;
}

/**
 * 解析提醒收件人：先取合約設定的收件人（依設定順序、略過已不存在的成員）；
 * 沒有設定收件人時退回負責人；兩者皆無則為空陣列。
 */
export function resolveReminderRecipients(
  contract: Pick<Contract, "ownerId" | "reminderRecipientIds">,
  members: ReadonlyArray<TeamMember>
): TeamMember[] {
  const seen = new Set<string>();
  const recipients: TeamMember[] = [];
  for (const id of contract.reminderRecipientIds ?? []) {
    const m = findMember(members, id);
    if (m && !seen.has(m.id)) {
      seen.add(m.id);
      recipients.push(m);
    }
  }
  if (recipients.length > 0) return recipients;
  const owner = getOwner(contract, members);
  return owner ? [owner] : [];
}

/** 儀表板「我負責的」篩選 */
export function filterOwnedBy<T extends Pick<Contract, "ownerId">>(
  contracts: ReadonlyArray<T>,
  memberId: string | null | undefined
): T[] {
  if (!memberId) return [];
  return contracts.filter((c) => c.ownerId === memberId);
}

/** 示範用假成員（明顯的假資料，example.com 網域） */
export const DEMO_MEMBERS: ReadonlyArray<NewMemberInput> = [
  { name: "測試成員甲", email: "admin.demo@example.com", role: "admin" },
  { name: "測試成員乙", email: "procurement.demo@example.com", role: "procurement" },
  { name: "測試成員丙", email: "legal.demo@example.com", role: "legal" },
];

type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): KV | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** 「目前身分」只是本機模擬（沒有登入），用於「我負責的」篩選與註解作者。 */
export function getCurrentMemberId(storage: KV | null = defaultStorage()): string | null {
  try {
    return storage?.getItem(CURRENT_MEMBER_KEY) || null;
  } catch {
    return null;
  }
}

export function setCurrentMemberId(
  id: string | null,
  storage: KV | null = defaultStorage()
): void {
  try {
    if (id) storage?.setItem(CURRENT_MEMBER_KEY, id);
    else storage?.removeItem(CURRENT_MEMBER_KEY);
  } catch {
    /* 本機儲存不可用時忽略 */
  }
}
