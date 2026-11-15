// AC-005：5 階段審核工作流、獨立註解、Dexie v1 → v2 migration、儀表板分組數量
import { describe, it, expect } from "vitest";
import Dexie from "dexie";
import {
  WORKFLOW_LABELS,
  WORKFLOW_ORDER,
  WorkflowError,
  addNote,
  advanceWorkflow,
  canTransition,
  countByWorkflow,
  getWorkflowStatus,
  nextWorkflowStatus,
} from "./workflow";
import { ContractDB, V1_CONTRACT_STORES, withContractDefaults } from "./storage";
import { makeTestContract } from "../test/factories";
import type { Contract, WorkflowStatus } from "../types";

describe("AC-005 審核工作流", () => {
  it("AC-005 共 5 個階段，名稱與順序正確", () => {
    expect(WORKFLOW_ORDER.map((s) => WORKFLOW_LABELS[s])).toEqual([
      "草擬建立",
      "送審核中",
      "法務覆核",
      "主管核准",
      "對方簽署",
    ]);
  });

  it("AC-005 沒有狀態的舊合約視為「草擬建立」", () => {
    expect(getWorkflowStatus(makeTestContract())).toBe("draft");
  });

  it("AC-005 可以依序從草擬建立推進到對方簽署", () => {
    let contract = makeTestContract();
    const visited: WorkflowStatus[] = [getWorkflowStatus(contract)];
    while (nextWorkflowStatus(getWorkflowStatus(contract)) !== null) {
      contract = advanceWorkflow(contract);
      visited.push(getWorkflowStatus(contract));
    }
    expect(visited).toEqual([...WORKFLOW_ORDER]);
  });

  it("AC-005 advanceWorkflow 不修改傳入的物件", () => {
    const original = makeTestContract({ workflowStatus: "draft" });
    const advanced = advanceWorkflow(original);
    expect(original.workflowStatus).toBe("draft");
    expect(advanced.workflowStatus).toBe("in_review");
  });

  it("AC-005 不可跳關", () => {
    const contract = makeTestContract({ workflowStatus: "draft" });
    expect(() => advanceWorkflow(contract, "legal_review")).toThrow(WorkflowError);
    expect(() => advanceWorkflow(contract, "counterparty_signed")).toThrow(WorkflowError);
    expect(canTransition("draft", "manager_approval")).toBe(false);
  });

  it("AC-005 不可倒退，也不可停在原階段", () => {
    const contract = makeTestContract({ workflowStatus: "legal_review" });
    expect(() => advanceWorkflow(contract, "in_review")).toThrow(WorkflowError);
    expect(() => advanceWorkflow(contract, "draft")).toThrow(WorkflowError);
    expect(() => advanceWorkflow(contract, "legal_review")).toThrow(WorkflowError);
  });

  it("AC-005 最後階段無法再推進", () => {
    const contract = makeTestContract({ workflowStatus: "counterparty_signed" });
    expect(nextWorkflowStatus("counterparty_signed")).toBeNull();
    expect(() => advanceWorkflow(contract)).toThrow(WorkflowError);
  });

  it("AC-005 只有相鄰的下一階段可以轉移（完整矩陣）", () => {
    for (const [i, from] of WORKFLOW_ORDER.entries()) {
      for (const [j, to] of WORKFLOW_ORDER.entries()) {
        expect(canTransition(from, to)).toBe(j === i + 1);
      }
    }
  });
});

describe("AC-005 註解", () => {
  const now = new Date("2026-11-16T01:00:00.000Z");

  it("AC-005 註解存成獨立的 notes[]，含時間與作者", () => {
    const contract = addNote(makeTestContract(), {
      id: "note-1",
      text: "  第四條違約金比例請再確認  ",
      author: "測試成員甲",
      now,
    });
    expect(contract.notes).toEqual([
      {
        id: "note-1",
        text: "第四條違約金比例請再確認",
        author: "測試成員甲",
        createdAt: "2026-11-16T01:00:00.000Z",
      },
    ]);
  });

  it("AC-005 新增註解不改動 extractedText（合約原文）", () => {
    const original = makeTestContract();
    const before = original.extractedText;
    let contract = addNote(original, { id: "n1", text: "第一則註解", author: "測試成員甲", now });
    contract = addNote(contract, { id: "n2", text: "第二則註解", author: "測試成員乙", now });
    expect(contract.extractedText).toBe(before);
    expect(contract.extractedText).not.toContain("註解");
    expect(original.notes).toBeUndefined();
    expect(contract.notes).toHaveLength(2);
  });

  it("AC-005 空白註解會被拒絕；未填作者時記為「未具名」", () => {
    expect(() =>
      addNote(makeTestContract(), { id: "n1", text: "   ", author: "測試成員甲", now })
    ).toThrow(WorkflowError);
    const contract = addNote(makeTestContract(), { id: "n1", text: "測試", author: " ", now });
    expect(contract.notes![0].author).toBe("未具名");
  });
});

describe("AC-005 儀表板分組數量", () => {
  it("AC-005 待辦／待覆核／已簽署的數量", () => {
    const contracts = [
      makeTestContract({ id: "1" }), // 無狀態 → draft
      makeTestContract({ id: "2", workflowStatus: "draft" }),
      makeTestContract({ id: "3", workflowStatus: "in_review" }),
      makeTestContract({ id: "4", workflowStatus: "legal_review" }),
      makeTestContract({ id: "5", workflowStatus: "manager_approval" }),
      makeTestContract({ id: "6", workflowStatus: "counterparty_signed" }),
    ];
    expect(countByWorkflow(contracts)).toEqual({ todo: 3, review: 2, signed: 1 });
    expect(countByWorkflow([])).toEqual({ todo: 0, review: 0, signed: 0 });
  });
});

describe("AC-005 Dexie schema v1 → v2 migration（fake-indexeddb）", () => {
  // v1 時期的合約資料（沒有 workflowStatus／notes／ownerId 等欄位）
  const v1Contracts: Contract[] = [
    makeTestContract({
      id: "v1-a",
      title: "【測試】v1 租約",
      category: "lease",
      riskScore: "yellow",
      reminderDaysBefore: 60,
      riskAnalysis: [
        { issue: "測試風險", suggestion: "測試建議", legalRef: "民法 §252", severity: "yellow" },
      ],
      clauses: [
        {
          id: "clause-0",
          type: "term",
          originalText: "本合約期滿後自動續約一年",
          pageNumber: 1,
          riskLevel: "yellow",
          legalRefs: ["民法 §247-1"],
        },
      ],
    }),
    makeTestContract({ id: "v1-b", title: "【測試】v1 保密協議", category: "nda", isActive: false }),
    makeTestContract({ id: "v1-c", title: "【測試】v1 採購合約", expiresAt: "2027-03-01" }),
  ];

  async function seedV1(name: string) {
    const v1 = new Dexie(name);
    v1.version(1).stores({ contracts: V1_CONTRACT_STORES });
    await v1.table("contracts").bulkAdd(v1Contracts);
    expect(v1.verno).toBe(1);
    v1.close();
  }

  it("AC-005 升級後資料筆數與既有欄位都保留", async () => {
    const name = "migration-test-preserve";
    await seedV1(name);

    const v2 = new ContractDB(name);
    await v2.open();
    expect(v2.verno).toBe(2);
    const rows = await v2.contracts.toArray();
    expect(rows).toHaveLength(v1Contracts.length);
    for (const original of v1Contracts) {
      const migrated = rows.find((r) => r.id === original.id)!;
      expect(migrated).toBeDefined();
      // 既有欄位逐一比對，值不變
      for (const key of Object.keys(original) as (keyof Contract)[]) {
        expect(migrated[key], `${original.id}.${key}`).toEqual(original[key]);
      }
    }
    v2.close();
  });

  it("AC-005 升級後補上 v2 欄位的預設值", async () => {
    const name = "migration-test-defaults";
    await seedV1(name);

    const v2 = new ContractDB(name);
    const rows = await v2.contracts.toArray();
    for (const row of rows) {
      expect(row.workflowStatus).toBe("draft");
      expect(row.notes).toEqual([]);
      expect(row.ownerId).toBeNull();
      expect(row.reminderRecipientIds).toEqual([]);
    }
    // 新資料表存在且為空
    expect(await v2.teamMembers.count()).toBe(0);
    expect(await v2.outbox.count()).toBe(0);
    // 新索引可用
    expect(await v2.contracts.where("workflowStatus").equals("draft").count()).toBe(3);
    v2.close();
  });

  it("AC-005 全新安裝直接建立 v2 schema", async () => {
    const fresh = new ContractDB("migration-test-fresh");
    await fresh.open();
    expect(fresh.verno).toBe(2);
    expect(fresh.tables.map((t) => t.name).sort()).toEqual(["contracts", "outbox", "teamMembers"]);
    fresh.close();
  });

  it("AC-005 withContractDefaults 不覆寫已存在的 v2 欄位", () => {
    const contract = makeTestContract({
      workflowStatus: "legal_review",
      ownerId: "member-a",
      reminderRecipientIds: ["member-b"],
      notes: [{ id: "n1", text: "測試", author: "測試成員甲", createdAt: "2026-11-16T00:00:00.000Z" }],
    });
    expect(withContractDefaults(contract)).toMatchObject({
      workflowStatus: "legal_review",
      ownerId: "member-a",
      reminderRecipientIds: ["member-b"],
      notes: contract.notes,
    });
  });
});
