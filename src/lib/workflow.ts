// 5 階段審核工作流與註解（FR-014／FR-015，併入 contract-reviewer，M-06／M-07）
// 純函式：不寫入儲存層、不讀系統時鐘（時間由呼叫端注入）。
import type { Contract, ContractNote, WorkflowStatus } from "../types";

export const WORKFLOW_ORDER: readonly WorkflowStatus[] = [
  "draft",
  "in_review",
  "legal_review",
  "manager_approval",
  "counterparty_signed",
] as const;

export const WORKFLOW_LABELS: Record<WorkflowStatus, string> = {
  draft: "草擬建立",
  in_review: "送審核中",
  legal_review: "法務覆核",
  manager_approval: "主管核准",
  counterparty_signed: "對方簽署",
};

export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowError";
  }
}

export function getWorkflowStatus(contract: Pick<Contract, "workflowStatus">): WorkflowStatus {
  const s = contract.workflowStatus;
  return s && WORKFLOW_ORDER.includes(s) ? s : "draft";
}

export function nextWorkflowStatus(status: WorkflowStatus): WorkflowStatus | null {
  const idx = WORKFLOW_ORDER.indexOf(status);
  return idx >= 0 && idx < WORKFLOW_ORDER.length - 1
    ? WORKFLOW_ORDER[idx + 1]
    : null;
}

/** 只允許推進到「下一階段」：不可跳關、不可倒退、不可原地踏步。 */
export function canTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
  return nextWorkflowStatus(from) === to;
}

/**
 * 推進工作流。未指定 to 時推進到下一階段；指定 to 時必須剛好是下一階段。
 * 回傳新的合約物件，不修改傳入的物件。
 */
export function advanceWorkflow<T extends Contract>(contract: T, to?: WorkflowStatus): T {
  const from = getWorkflowStatus(contract);
  const next = nextWorkflowStatus(from);
  if (next === null) {
    throw new WorkflowError(`「${WORKFLOW_LABELS[from]}」已是最後階段，無法再推進`);
  }
  const target = to ?? next;
  if (!canTransition(from, target)) {
    throw new WorkflowError(
      `只能依序推進：目前「${WORKFLOW_LABELS[from]}」的下一階段是「${WORKFLOW_LABELS[next]}」，不能改為「${WORKFLOW_LABELS[target] ?? String(target)}」`
    );
  }
  return { ...contract, workflowStatus: target };
}

export interface AddNoteInput {
  id: string;
  text: string;
  author: string;
  /** 由呼叫端注入的時間 */
  now: Date;
}

/** 新增註解到獨立的 notes[]；不會修改 extractedText（合約原文）。 */
export function addNote<T extends Contract>(contract: T, input: AddNoteInput): T {
  const text = input.text.trim();
  if (!text) throw new WorkflowError("註解內容不可為空白");
  const note: ContractNote = {
    id: input.id,
    text,
    author: input.author.trim() || "未具名",
    createdAt: input.now.toISOString(),
  };
  return { ...contract, notes: [...(contract.notes ?? []), note] };
}

export interface WorkflowCounts {
  /** 待辦：草擬建立＋送審核中 */
  todo: number;
  /** 待覆核：法務覆核＋主管核准 */
  review: number;
  /** 已簽署：對方簽署 */
  signed: number;
}

export function countByWorkflow(
  contracts: ReadonlyArray<Pick<Contract, "workflowStatus">>
): WorkflowCounts {
  const counts: WorkflowCounts = { todo: 0, review: 0, signed: 0 };
  for (const c of contracts) {
    const s = getWorkflowStatus(c);
    if (s === "draft" || s === "in_review") counts.todo++;
    else if (s === "legal_review" || s === "manager_approval") counts.review++;
    else counts.signed++;
  }
  return counts;
}
