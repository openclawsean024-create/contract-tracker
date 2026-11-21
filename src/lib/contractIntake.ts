// 新增合約的唯一入口（貼上、上傳、JSON 匯入）：寫入前一律再確認一次免責勾選狀態。
// 解析是非同步的，使用者可能在解析途中取消勾選；匯入備份同樣是新增合約，不能繞過確認（Codex 審查 #7）。
import type { Contract } from "../types";
import { canUpload } from "./disclaimer";
import { importAll, saveContract, type ImportResult } from "./storage";

export class DisclaimerNotAcknowledgedError extends Error {
  constructor() {
    super("請先勾選「我了解本服務不構成法律意見」，才能新增或匯入合約。");
    this.name = "DisclaimerNotAcknowledgedError";
  }
}

/** 讀取「當下」的勾選狀態（不是開始解析時的狀態） */
export type AckReader = () => boolean;

function assertAcknowledged(isAcknowledged: AckReader) {
  if (!canUpload(isAcknowledged())) throw new DisclaimerNotAcknowledgedError();
}

export async function commitAnalyzedContract(
  contract: Contract,
  isAcknowledged: AckReader,
  save: (c: Contract) => Promise<void> = saveContract
): Promise<void> {
  assertAcknowledged(isAcknowledged);
  await save(contract);
}

export async function importBackup(
  json: string,
  isAcknowledged: AckReader,
  importer: (json: string) => Promise<ImportResult> = importAll
): Promise<ImportResult> {
  assertAcknowledged(isAcknowledged);
  return importer(json);
}
