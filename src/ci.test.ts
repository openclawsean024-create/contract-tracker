// AC-009：CI 不得吞掉失敗（test 步驟不得有 `|| echo`，lint 不得 continue-on-error）。
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ci = readFileSync(
  resolve(__dirname, "..", ".github", "workflows", "ci.yml"),
  "utf8"
);

describe("AC-009 CI 品質閘門", () => {
  it("AC-009 ci.yml 沒有 `|| echo` 也沒有 continue-on-error", () => {
    expect(ci).not.toMatch(/\|\|\s*echo/);
    expect(ci).not.toMatch(/continue-on-error/);
  });

  it("AC-009 ci.yml 會執行 lint、test、build、e2e", () => {
    for (const cmd of ["npm run lint", "npm test", "npm run build", "npm run e2e"]) {
      expect(ci).toContain(`run: ${cmd}`);
    }
  });

  it("AC-009 安裝步驟不得以 `|| npm install` 掩蓋 lockfile 不一致", () => {
    expect(ci).not.toMatch(/npm ci[^\n]*\|\|/);
  });
});
