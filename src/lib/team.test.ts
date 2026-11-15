// AC-007：團隊共用（本機 mock）
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  DEMO_MEMBERS,
  LocalTeamAdapter,
  TeamValidationError,
  UNASSIGNED_LABEL,
  assignOwner,
  filterOwnedBy,
  getCurrentMemberId,
  isAllowedMockEmail,
  ownerLabel,
  resolveReminderRecipients,
  setCurrentMemberId,
  setReminderRecipients,
  validateMemberInput,
  type TeamAdapter,
} from "./team";
import { ContractDB, withContractDefaults } from "./storage";
import { makeTestContract, makeTestMember } from "../test/factories";

/** 組出「不在允許網域」的 Email；不寫成字面值，repo 內才只會出現 example.com／example.test（AC-010） */
const emailAt = (domain: string, local = "user") => [local, domain].join("@");

let database: ContractDB;
let adapter: TeamAdapter;
let seq = 0;

beforeEach(() => {
  seq += 1;
  let idCounter = 0;
  database = new ContractDB(`team-test-${seq}`);
  adapter = new LocalTeamAdapter(database, {
    generateId: () => `member-${++idCounter}`,
    now: () => new Date(Date.UTC(2026, 10, 16, 0, 0, idCounter)),
  });
});

afterEach(async () => {
  await database.delete();
});

describe("AC-007 成員管理", () => {
  it("AC-007 新增成員（姓名、Email、角色）", async () => {
    const member = await adapter.addMember({
      name: " 測試成員甲 ",
      email: "Member.A@Example.com",
      role: "admin",
    });
    expect(member).toMatchObject({
      id: "member-1",
      name: "測試成員甲",
      email: "member.a@example.com",
      role: "admin",
    });
    expect(await adapter.listMembers()).toEqual([member]);
  });

  it("AC-007 移除成員", async () => {
    const a = await adapter.addMember({ name: "測試成員甲", email: "a@example.com", role: "admin" });
    const b = await adapter.addMember({ name: "測試成員乙", email: "b@example.test", role: "legal" });
    await adapter.removeMember(a.id);
    expect((await adapter.listMembers()).map((m) => m.id)).toEqual([b.id]);
  });

  it("AC-007 Email 只接受 example.com／example.test 網域", async () => {
    expect(isAllowedMockEmail("user@example.com")).toBe(true);
    expect(isAllowedMockEmail("user@example.test")).toBe(true);
    expect(isAllowedMockEmail("user@team.example.com")).toBe(true);
    for (const bad of [
      emailAt("example.org"),
      emailAt("notexample.com"),
      emailAt("example.com.evil.invalid"),
      emailAt(""),
      "not-an-email",
      "",
    ]) {
      expect(isAllowedMockEmail(bad), bad).toBe(false);
    }
    await expect(
      adapter.addMember({ name: "測試成員", email: emailAt("example.org"), role: "admin" })
    ).rejects.toBeInstanceOf(TeamValidationError);
    expect(await adapter.listMembers()).toEqual([]);
  });

  it("AC-007 姓名必填、Email 不可重複", async () => {
    await adapter.addMember({ name: "測試成員甲", email: "a@example.com", role: "admin" });
    await expect(
      adapter.addMember({ name: "  ", email: "b@example.com", role: "admin" })
    ).rejects.toBeInstanceOf(TeamValidationError);
    await expect(
      adapter.addMember({ name: "測試成員乙", email: "A@example.com", role: "legal" })
    ).rejects.toBeInstanceOf(TeamValidationError);
    expect(() =>
      validateMemberInput({ name: "測試", email: "c@example.com", role: "ceo" as never })
    ).toThrow(TeamValidationError);
  });

  it("AC-007 預設的示範成員都是 example.com／example.test 假資料", async () => {
    expect(DEMO_MEMBERS.length).toBeGreaterThan(0);
    for (const seed of DEMO_MEMBERS) {
      expect(isAllowedMockEmail(seed.email)).toBe(true);
      await adapter.addMember(seed);
    }
    expect(await adapter.listMembers()).toHaveLength(DEMO_MEMBERS.length);
  });
});

describe("AC-007 負責人與提醒收件人", () => {
  const memberA = makeTestMember({ id: "member-a", name: "測試成員甲", email: "a@example.com" });
  const memberB = makeTestMember({ id: "member-b", name: "測試成員乙", email: "b@example.com" });
  const memberC = makeTestMember({ id: "member-c", name: "測試成員丙", email: "c@example.test" });
  const members = [memberA, memberB, memberC];

  it("AC-007 指派負責人", () => {
    const contract = assignOwner(makeTestContract(), memberA.id, members);
    expect(contract.ownerId).toBe("member-a");
    expect(ownerLabel(contract, members)).toBe("測試成員甲");
    expect(assignOwner(contract, null, members).ownerId).toBeNull();
  });

  it("AC-007 不能指派不存在的成員", () => {
    expect(() => assignOwner(makeTestContract(), "ghost", members)).toThrow(TeamValidationError);
  });

  it("AC-007 沒有負責人時顯示「未指派」", () => {
    expect(UNASSIGNED_LABEL).toBe("未指派");
    expect(ownerLabel(makeTestContract(), members)).toBe("未指派");
    expect(ownerLabel(makeTestContract({ ownerId: null }), members)).toBe("未指派");
  });

  it("AC-007 刪除成員後，該成員負責的合約顯示為「未指派」", async () => {
    const a = await adapter.addMember({ name: "測試成員甲", email: "a@example.com", role: "admin" });
    const b = await adapter.addMember({ name: "測試成員乙", email: "b@example.com", role: "legal" });
    await database.contracts.bulkPut([
      withContractDefaults(
        makeTestContract({ id: "c-owned-by-a", ownerId: a.id, reminderRecipientIds: [a.id, b.id] })
      ),
      withContractDefaults(makeTestContract({ id: "c-owned-by-b", ownerId: b.id })),
    ]);
    expect(ownerLabel((await database.contracts.get("c-owned-by-a"))!, await adapter.listMembers())).toBe("測試成員甲");

    await adapter.removeMember(a.id);

    const remaining = await adapter.listMembers();
    const orphan = (await database.contracts.get("c-owned-by-a"))!;
    expect(ownerLabel(orphan, remaining)).toBe("未指派");
    expect(orphan.ownerId).toBeNull();
    expect(orphan.reminderRecipientIds).toEqual([b.id]);
    // 其他成員負責的合約不受影響
    const untouched = (await database.contracts.get("c-owned-by-b"))!;
    expect(ownerLabel(untouched, remaining)).toBe("測試成員乙");
    expect(await database.contracts.count()).toBe(2);
  });

  it("AC-007 即使合約仍指向已刪除的成員 ID，也顯示「未指派」", () => {
    const contract = makeTestContract({ ownerId: "deleted-member" });
    expect(ownerLabel(contract, members)).toBe("未指派");
  });

  it("AC-007 提醒收件人解析：依合約設定的成員與順序", () => {
    const contract = setReminderRecipients(
      makeTestContract({ ownerId: memberA.id }),
      [memberC.id, memberB.id, memberC.id, "ghost"],
      members
    );
    expect(contract.reminderRecipientIds).toEqual(["member-c", "member-b"]);
    expect(resolveReminderRecipients(contract, members).map((m) => m.email)).toEqual([
      "c@example.test",
      "b@example.com",
    ]);
  });

  it("AC-007 提醒收件人解析：未設定收件人時退回負責人；兩者皆無為空", () => {
    const owned = makeTestContract({ ownerId: memberB.id, reminderRecipientIds: [] });
    expect(resolveReminderRecipients(owned, members)).toEqual([memberB]);
    expect(resolveReminderRecipients(makeTestContract(), members)).toEqual([]);
  });

  it("AC-007 提醒收件人解析：略過已被移除的成員", () => {
    const contract = makeTestContract({
      ownerId: memberA.id,
      reminderRecipientIds: ["deleted-member", memberB.id],
    });
    expect(resolveReminderRecipients(contract, members)).toEqual([memberB]);
    const allGone = makeTestContract({ ownerId: memberA.id, reminderRecipientIds: ["deleted-member"] });
    expect(resolveReminderRecipients(allGone, members)).toEqual([memberA]);
  });

  it("AC-007 「我負責的」篩選", () => {
    const contracts = [
      makeTestContract({ id: "1", ownerId: memberA.id }),
      makeTestContract({ id: "2", ownerId: memberB.id }),
      makeTestContract({ id: "3", ownerId: null }),
      makeTestContract({ id: "4", ownerId: memberA.id }),
    ];
    expect(filterOwnedBy(contracts, memberA.id).map((c) => c.id)).toEqual(["1", "4"]);
    expect(filterOwnedBy(contracts, null)).toEqual([]);
  });

  it("AC-007 目前身分只存在本機（注入的 storage）", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
    expect(getCurrentMemberId(storage)).toBeNull();
    setCurrentMemberId("member-a", storage);
    expect(getCurrentMemberId(storage)).toBe("member-a");
    setCurrentMemberId(null, storage);
    expect(getCurrentMemberId(storage)).toBeNull();
  });
});
