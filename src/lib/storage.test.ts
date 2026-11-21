// Codex 審查 #1、#2 的回歸測試：跨分頁編輯不得讓審核進度倒退；匯入舊備份不得覆蓋較新的資料。
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ContractDB,
  ContractNotFoundError,
  InvalidBackupError,
  buildBackup,
  importAll,
  patchContract,
  updateContract,
  withContractDefaults,
} from "./storage";
import { addNote, advanceWorkflow } from "./workflow";
import { assignOwner } from "./team";
import { makeTestContract, makeTestMember } from "../test/factories";
import type { Contract } from "../types";

let database: ContractDB;
let seq = 0;
const now = new Date("2026-11-16T01:00:00.000Z");

beforeEach(async () => {
  seq += 1;
  database = new ContractDB(`storage-test-${seq}`);
  await database.open();
});

afterEach(async () => {
  await database.delete();
});

const get = async (id: string) => (await database.contracts.get(id))!;

describe("AC-005 跨分頁編輯不會讓資料倒退", () => {
  beforeEach(async () => {
    await database.contracts.put(withContractDefaults(makeTestContract({ id: "c1" })));
  });

  it("AC-005 分頁 A 推進工作流後，分頁 B 以舊畫面改標題，工作流不會倒退", async () => {
    const staleSnapshotInTabB = await get("c1"); // 分頁 B 打開時的快照：草擬建立
    await updateContract("c1", (latest) => advanceWorkflow(latest), database); // 分頁 A 推進
    await patchContract("c1", { title: "【測試】分頁 B 改的標題" }, database); // 分頁 B 只改標題

    const saved = await get("c1");
    expect(staleSnapshotInTabB.workflowStatus).toBe("draft");
    expect(saved.workflowStatus).toBe("in_review");
    expect(saved.title).toBe("【測試】分頁 B 改的標題");
  });

  it("AC-005 兩個分頁各自新增註解，兩則都保留", async () => {
    await updateContract("c1", (l) => addNote(l, { id: "n-a", text: "分頁 A 的註解", author: "測試成員甲", now }), database);
    await updateContract("c1", (l) => addNote(l, { id: "n-b", text: "分頁 B 的註解", author: "測試成員乙", now }), database);
    expect((await get("c1")).notes!.map((n) => n.id)).toEqual(["n-a", "n-b"]);
  });

  it("AC-005 改標題、推進、新增註解交錯進行，彼此都不覆蓋", async () => {
    await Promise.all([
      patchContract("c1", { title: "【測試】新標題" }, database),
      updateContract("c1", (l) => advanceWorkflow(l), database),
      updateContract("c1", (l) => addNote(l, { id: "n1", text: "測試", author: "測試成員甲", now }), database),
      patchContract("c1", { reminderDaysBefore: 45 }, database),
    ]);
    const saved = await get("c1");
    expect(saved).toMatchObject({
      title: "【測試】新標題",
      workflowStatus: "in_review",
      reminderDaysBefore: 45,
    });
    expect(saved.notes).toHaveLength(1);
  });

  it("AC-007 其他分頁清掉的負責人，不會被舊畫面寫回", async () => {
    const members = [makeTestMember({ id: "member-a" })];
    await updateContract("c1", (l) => assignOwner(l, "member-a", members), database);
    await patchContract("c1", { ownerId: null }, database); // 例如成員被移除
    await patchContract("c1", { counterparty: "測試供應商有限公司" }, database); // 舊畫面只改對方
    expect((await get("c1")).ownerId).toBeNull();
  });

  it("AC-005 依最新狀態驗證推進：其他分頁已推進時，以舊目標推進會被拒絕", async () => {
    await updateContract("c1", (l) => advanceWorkflow(l), database); // 已到送審核中
    await expect(
      updateContract("c1", (l) => advanceWorkflow(l, "in_review"), database)
    ).rejects.toThrow();
    expect((await get("c1")).workflowStatus).toBe("in_review");
  });

  it("AC-005 合約已在其他分頁刪除時回報錯誤，不會重新建立", async () => {
    await database.contracts.delete("c1");
    await expect(patchContract("c1", { title: "x" }, database)).rejects.toBeInstanceOf(ContractNotFoundError);
    expect(await database.contracts.count()).toBe(0);
  });

  it("AC-005 patchContract 不能改掉 id", async () => {
    await patchContract("c1", { id: "other" } as Partial<Contract>, database);
    expect(await database.contracts.get("other")).toBeUndefined();
    expect(await get("c1")).toBeDefined();
  });
});

describe("AC-005 備份匯入不覆蓋本機資料", () => {
  const memberA = makeTestMember({ id: "member-a", email: "member.a@example.com" });

  async function snapshotBackup() {
    return JSON.stringify(await buildBackup(database, now));
  }

  it("AC-005 匯入舊備份不會倒回本機較新的審核進度與註解", async () => {
    await database.contracts.put(withContractDefaults(makeTestContract({ id: "c1" })));
    const oldBackup = await snapshotBackup(); // 草擬建立、無註解
    await updateContract("c1", (l) => advanceWorkflow(l), database);
    await updateContract("c1", (l) => addNote(l, { id: "n1", text: "較新的註解", author: "測試成員甲", now }), database);

    const result = await importAll(oldBackup, database);

    expect(result).toMatchObject({ contractsAdded: 0, contractsSkipped: 1 });
    const saved = await get("c1");
    expect(saved.workflowStatus).toBe("in_review");
    expect(saved.notes).toHaveLength(1);
  });

  it("AC-005 匯入 v1 備份（沒有 v2 欄位）不會清空本機的工作流與指派", async () => {
    await database.teamMembers.add(memberA);
    await database.contracts.put(
      withContractDefaults(makeTestContract({ id: "c1", workflowStatus: "legal_review", ownerId: "member-a" }))
    );
    const v1Backup = JSON.stringify({
      app: "contract-tracker",
      version: "1.0.0",
      exportedAt: now.toISOString(),
      contracts: [makeTestContract({ id: "c1" })],
    });
    await importAll(v1Backup, database);
    expect(await get("c1")).toMatchObject({ workflowStatus: "legal_review", ownerId: "member-a" });
  });

  it("AC-007 備份包含成員；匯入到新瀏覽器後負責人與收件人仍有效", async () => {
    await database.teamMembers.add(memberA);
    await database.contracts.put(
      withContractDefaults(makeTestContract({ id: "c1", ownerId: "member-a", reminderRecipientIds: ["member-a"] }))
    );
    const backup = await snapshotBackup();
    expect(JSON.parse(backup).teamMembers).toHaveLength(1);

    const fresh = new ContractDB(`storage-test-fresh-${seq}`);
    try {
      const result = await importAll(backup, fresh);
      expect(result).toMatchObject({ contractsAdded: 1, membersAdded: 1 });
      expect(await fresh.contracts.get("c1")).toMatchObject({
        ownerId: "member-a",
        reminderRecipientIds: ["member-a"],
      });
    } finally {
      await fresh.delete();
    }
  });

  it("AC-007 指向不存在成員的負責人與收件人會被清除（顯示未指派）", async () => {
    const backup = JSON.stringify({
      app: "contract-tracker",
      version: "2",
      contracts: [makeTestContract({ id: "c1", ownerId: "ghost", reminderRecipientIds: ["ghost"] })],
      teamMembers: [],
    });
    await importAll(backup, database);
    expect(await get("c1")).toMatchObject({ ownerId: null, reminderRecipientIds: [] });
  });

  it("AC-010 匯入時拒絕非假資料網域的成員，以及格式錯誤的合約", async () => {
    const backup = JSON.stringify({
      app: "contract-tracker",
      version: "2",
      contracts: [
        makeTestContract({ id: "ok" }),
        makeTestContract({ id: "bad-date", expiresAt: "2026-02-30" }),
        { id: "no-fields" },
      ],
      teamMembers: [
        makeTestMember({ id: "m-ok", email: "ok@example.test" }),
        makeTestMember({ id: "m-bad", email: ["someone", "example.org"].join("@") }),
      ],
    });
    const result = await importAll(backup, database);
    expect(result).toMatchObject({
      contractsAdded: 1,
      contractsInvalid: 2,
      membersAdded: 1,
      membersInvalid: 1,
    });
    expect((await database.teamMembers.toArray()).map((m) => m.id)).toEqual(["m-ok"]);
  });

  it("AC-005 不是本工具的備份檔會被拒絕，且不寫入任何資料", async () => {
    await expect(importAll("not json", database)).rejects.toBeInstanceOf(InvalidBackupError);
    await expect(importAll(JSON.stringify({ contracts: [] }), database)).rejects.toBeInstanceOf(InvalidBackupError);
    expect(await database.contracts.count()).toBe(0);
  });
});

describe("AC-007 匯入時以 Email 對應成員（Claude 子代理複審）", () => {
  it("AC-007 本機已有同 Email、不同 ID 的成員時，指派改指向本機成員", async () => {
    await database.teamMembers.add(makeTestMember({ id: "m-new", email: "a@example.com" }));
    const backup = JSON.stringify({
      app: "contract-tracker",
      version: "2",
      contracts: [makeTestContract({ id: "c1", ownerId: "m-old", reminderRecipientIds: ["m-old"] })],
      teamMembers: [makeTestMember({ id: "m-old", email: "A@example.com" })],
    });
    const result = await importAll(backup, database);
    expect(result).toMatchObject({ membersSkipped: 1, membersAdded: 0, assignmentsCleared: 0 });
    expect(await get("c1")).toMatchObject({ ownerId: "m-new", reminderRecipientIds: ["m-new"] });
    expect(await database.teamMembers.count()).toBe(1);
  });

  it("AC-007 ID 相同但 Email 不同時不匯入備份的成員，本機成員保持不變", async () => {
    await database.teamMembers.add(makeTestMember({ id: "m1", email: "local@example.com" }));
    const backup = JSON.stringify({
      app: "contract-tracker",
      version: "2",
      contracts: [makeTestContract({ id: "c1", ownerId: "m1" })],
      teamMembers: [makeTestMember({ id: "m1", email: "other@example.com" })],
    });
    const result = await importAll(backup, database);
    expect(result.membersSkipped).toBe(1);
    expect((await database.teamMembers.get("m1"))!.email).toBe("local@example.com");
  });

  it("AC-007 匯入結果回報被清除的指派數", async () => {
    const backup = JSON.stringify({
      app: "contract-tracker",
      version: "2",
      contracts: [makeTestContract({ id: "c1", ownerId: "ghost", reminderRecipientIds: ["ghost", "ghost2"] })],
      teamMembers: [],
    });
    expect((await importAll(backup, database)).assignmentsCleared).toBe(3);
  });
});

describe("AC-005 到期日為空的合約也能備份還原（Claude 子代理複審）", () => {
  it("AC-005 expiresAt 為空字串時，匯出再匯入不會遺失", async () => {
    await database.contracts.put(withContractDefaults(makeTestContract({ id: "no-date", expiresAt: "" })));
    const backup = JSON.stringify(await buildBackup(database, now));
    const fresh = new ContractDB(`storage-test-nodate-${seq}`);
    try {
      expect(await importAll(backup, fresh)).toMatchObject({ contractsAdded: 1, contractsInvalid: 0 });
      expect((await fresh.contracts.get("no-date"))!.expiresAt).toBe("");
    } finally {
      await fresh.delete();
    }
  });
});
