// AC-008（Codex 審查 #7）：未勾選免責確認時，任何入口都不能新增合約；解析途中取消勾選也要擋下。
import { describe, it, expect, vi } from "vitest";
import {
  DisclaimerNotAcknowledgedError,
  commitAnalyzedContract,
  importBackup,
} from "./contractIntake";
import { makeTestContract } from "../test/factories";

describe("AC-008 新增合約前一律確認免責勾選", () => {
  it("AC-008 未勾選時不寫入", async () => {
    const save = vi.fn(async () => undefined);
    await expect(commitAnalyzedContract(makeTestContract(), () => false, save)).rejects.toBeInstanceOf(
      DisclaimerNotAcknowledgedError
    );
    expect(save).not.toHaveBeenCalled();
  });

  it("AC-008 解析途中取消勾選：以寫入當下的狀態為準", async () => {
    let acknowledged = true;
    const save = vi.fn(async () => undefined);
    // 模擬：開始解析時已勾選……解析完成前使用者取消勾選
    const parsing = Promise.resolve().then(() => {
      acknowledged = false;
    });
    await parsing;
    await expect(
      commitAnalyzedContract(makeTestContract(), () => acknowledged, save)
    ).rejects.toBeInstanceOf(DisclaimerNotAcknowledgedError);
    expect(save).not.toHaveBeenCalled();
  });

  it("AC-008 已勾選時正常寫入", async () => {
    const save = vi.fn(async () => undefined);
    const contract = makeTestContract();
    await commitAnalyzedContract(contract, () => true, save);
    expect(save).toHaveBeenCalledWith(contract);
  });

  it("AC-008 JSON 匯入也需要先勾選", async () => {
    const importer = vi.fn(async () => ({
      contractsAdded: 1,
      contractsSkipped: 0,
      contractsInvalid: 0,
      membersAdded: 0,
      membersSkipped: 0,
      membersInvalid: 0,
    }));
    await expect(importBackup("{}", () => false, importer)).rejects.toBeInstanceOf(
      DisclaimerNotAcknowledgedError
    );
    expect(importer).not.toHaveBeenCalled();
    await importBackup("{}", () => true, importer);
    expect(importer).toHaveBeenCalledOnce();
  });
});
