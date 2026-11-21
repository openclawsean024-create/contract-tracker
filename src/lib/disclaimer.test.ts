// AC-008：免責聲明與首次使用確認
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  DISCLAIMER_ACK_KEY,
  DISCLAIMER_ACK_LABEL,
  DISCLAIMER_DRAFT_NOTE,
  DISCLAIMER_TEXT,
  canUpload,
  hasAcknowledgedDisclaimer,
  setDisclaimerAcknowledged,
} from "./disclaimer";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const srcDir = resolve(__dirname, "..");
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|css)$/.test(name) ? [full] : [];
  });
}
const read = (relative: string) => readFileSync(resolve(srcDir, relative), "utf8");

describe("AC-008 免責聲明文案", () => {
  it("AC-008 DISCLAIMER_TEXT 與 SPEC §8 草案一致，且明示不構成法律意見", () => {
    const spec = readFileSync(resolve(srcDir, "..", "PRD", "SPEC.md"), "utf8");
    expect(spec).toContain(DISCLAIMER_TEXT);
    expect(DISCLAIMER_TEXT).toContain("不構成法律意見");
    expect(DISCLAIMER_TEXT).toContain("可能漏判或誤判");
    expect(DISCLAIMER_TEXT).toContain("諮詢專業律師");
  });

  it("AC-008 文案標示為待 Sean 定稿", () => {
    expect(DISCLAIMER_DRAFT_NOTE).toContain("待 Sean 定稿");
    expect(read("lib/disclaimer.ts")).toContain("待 Sean 定稿");
  });

  it("AC-008 首次使用確認文字", () => {
    expect(DISCLAIMER_ACK_LABEL).toBe("我了解本服務不構成法律意見");
  });
});

describe("AC-008 首次使用確認（存在本機）", () => {
  it("AC-008 未勾選時不得上傳", () => {
    const storage = memoryStorage();
    expect(hasAcknowledgedDisclaimer(storage)).toBe(false);
    expect(canUpload(hasAcknowledgedDisclaimer(storage))).toBe(false);
  });

  it("AC-008 勾選後可上傳，狀態存在本機並可取消", () => {
    const storage = memoryStorage();
    setDisclaimerAcknowledged(true, storage);
    expect(storage.data.get(DISCLAIMER_ACK_KEY)).toBe("1");
    expect(hasAcknowledgedDisclaimer(storage)).toBe(true);
    expect(canUpload(hasAcknowledgedDisclaimer(storage))).toBe(true);
    setDisclaimerAcknowledged(false, storage);
    expect(hasAcknowledgedDisclaimer(storage)).toBe(false);
  });

  it("AC-008 本機儲存不可用時視為未勾選", () => {
    expect(hasAcknowledgedDisclaimer(null)).toBe(false);
    const broken = {
      getItem: () => {
        throw new Error("storage disabled");
      },
      setItem: () => {
        throw new Error("storage disabled");
      },
      removeItem: () => undefined,
    };
    expect(hasAcknowledgedDisclaimer(broken)).toBe(false);
    expect(() => setDisclaimerAcknowledged(true, broken)).not.toThrow();
  });
});

describe("AC-008 聲明出現的位置與禁用文案", () => {
  it("AC-008 全站頁尾、上傳區、合約詳情風險結果區都使用 Disclaimer 元件", () => {
    expect(read("components/Disclaimer.tsx")).toContain("DISCLAIMER_TEXT");
    for (const file of ["App.tsx", "pages/Contracts.tsx", "pages/ContractDetail.tsx"]) {
      expect(read(file), file).toMatch(/<Disclaimer[\s/>]/);
    }
  });

  it("AC-008 上傳與分析按鈕受免責確認控制", () => {
    const contracts = read("pages/Contracts.tsx");
    expect(contracts).toContain("DISCLAIMER_ACK_LABEL");
    expect(contracts).toContain("canUpload(");
  });

  it("AC-008 src/ 內沒有 GOAL.md 禁用的文案", () => {
    // 與 GOAL.md AC-008 的 git grep 樣式相同（此處以字串組合避免本檔自己被比對到）
    const banned = new RegExp(["A", "I ?(摘要|解釋|分析|審核)|法律意見", "書"].join(""));
    const offenders = sourceFiles(srcDir).filter((f) => banned.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
