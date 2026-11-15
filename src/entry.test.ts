// AC-001：應用程式入口必須是 Vite entry，不得轉址到靜態 mockup。
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");

describe("AC-001 應用程式入口", () => {
  it("AC-001 index.html 含 #root 與 /src/main.tsx 模組入口", () => {
    expect(html).toContain('<div id="root"></div>');
    expect(html).toMatch(/<script type="module" src="\/src\/main\.tsx"><\/script>/);
  });

  it("AC-001 index.html 不再轉址到 dashboard.html", () => {
    expect(html).not.toMatch(/http-equiv=["']?refresh/i);
    expect(html).not.toContain("dashboard.html");
  });

  it("AC-001 dashboard.html 不在 repo 根目錄，也不在 public/（不會進 build 產物）", () => {
    expect(existsSync(resolve(root, "dashboard.html"))).toBe(false);
    expect(existsSync(resolve(root, "public", "dashboard.html"))).toBe(false);
  });
});
