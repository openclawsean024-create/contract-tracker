// AC-008（Claude 子代理複審）：新增合約的入口必須讀「當下」的勾選狀態，而不是元件渲染時的快照。
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { currentAckReader, useAppStore } from "./store";
import { DisclaimerNotAcknowledgedError, commitAnalyzedContract } from "./lib/contractIntake";
import { makeTestContract } from "./test/factories";

describe("AC-008 currentAckReader", () => {
  it("AC-008 反映最新的勾選狀態", () => {
    useAppStore.getState().setDisclaimerAck(true);
    expect(currentAckReader()).toBe(true);
    useAppStore.getState().setDisclaimerAck(false);
    expect(currentAckReader()).toBe(false);
  });

  it("AC-008 勾選後開始解析、寫入前取消勾選 → 不寫入", async () => {
    useAppStore.getState().setDisclaimerAck(true);
    const ackAtStart = currentAckReader();
    const saved: string[] = [];
    // 解析進行中，使用者取消勾選
    useAppStore.getState().setDisclaimerAck(false);
    await expect(
      commitAnalyzedContract(makeTestContract(), currentAckReader, async (c) => {
        saved.push(c.id);
      })
    ).rejects.toBeInstanceOf(DisclaimerNotAcknowledgedError);
    expect(ackAtStart).toBe(true);
    expect(saved).toEqual([]);
  });

  it("AC-008 合約頁的上傳、貼上與匯入都傳入 currentAckReader，而不是渲染時的 ack", () => {
    const source = readFileSync(resolve(__dirname, "pages", "Contracts.tsx"), "utf8");
    expect(source.match(/commitAnalyzedContract\(contract, currentAckReader\)/g)).toHaveLength(1);
    expect(source.match(/importBackup\(text, currentAckReader\)/g)).toHaveLength(1);
    expect(source).not.toMatch(/commitAnalyzedContract\([^)]*\back\b/);
    expect(source).not.toMatch(/importBackup\([^)]*\back\b/);
  });
});
