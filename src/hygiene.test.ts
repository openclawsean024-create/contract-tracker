// AC-010：資料與憑證衛生 — repo 內沒有憑證、沒有 example.com／example.test 以外的 Email，
// 也沒有把合約內容送到網路上的程式碼。
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(__dirname, "..");
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "test-results",
  "playwright-report",
  ".vercel",
]);
const BINARY = /\.(png|jpe?g|gif|ico|woff2?|ttf|pdf|zip|docx)$/i;

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (SKIP_DIRS.has(name)) return [];
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return BINARY.test(name) ? [] : [full];
  });
}

const rel = (f: string) => relative(root, f);

describe("AC-010 資料與憑證衛生", () => {
  it("AC-010 repo 內沒有 API key、token 或私鑰", () => {
    // 與 GOAL.md AC-010 的 git grep 樣式相同
    const credential =
      /(sk-[A-Za-z0-9]{20}|ghp_[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY)/;
    const offenders = walk(root).filter((f) => credential.test(readFileSync(f, "utf8")));
    expect(offenders.map(rel)).toEqual([]);
  });

  it("AC-010 repo 內沒有 .env 或金鑰檔", () => {
    const suspicious = walk(root).filter((f) =>
      /(^|\/)(\.env(\..*)?|.*\.pem|.*\.p12|id_rsa|service-account.*\.json)$/.test(f)
    );
    expect(suspicious.map(rel)).toEqual([]);
  });

  it("AC-010 src 與 tests 內的 Email 只出現 example.com／example.test 網域", () => {
    const emailLike = /@[A-Za-z0-9.-]+\.[a-z]{2,}/g;
    // 網域不分大小寫（Member.A@Example.com 仍是 example.com）
    const allowed = /^@([A-Za-z0-9-]+\.)*example\.(com|test)$/i;
    const offenders: string[] = [];
    for (const file of [...walk(join(root, "src")), ...walk(join(root, "tests"))]) {
      for (const match of readFileSync(file, "utf8").match(emailLike) ?? []) {
        if (!allowed.test(match)) offenders.push(`${rel(file)}: ${match}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("AC-010 分析流程的程式碼不發出網路請求", () => {
    const network = /\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|new WebSocket|EventSource/;
    const analysisFiles = [
      "lib/analyze.ts",
      "lib/legalDb.ts",
      "lib/contractType.ts",
      "lib/textExtract.ts",
      "lib/pdfParser.ts",
      "lib/workflow.ts",
      "lib/team.ts",
      "lib/reminderDispatch.ts",
      "lib/reminder.ts",
      "lib/disclaimer.ts",
      "lib/contractIntake.ts",
      "lib/dates.ts",
      "lib/search.ts",
      "pages/Contracts.tsx",
      "pages/ContractDetail.tsx",
      "pages/Outbox.tsx",
      "pages/Team.tsx",
    ];
    for (const file of analysisFiles) {
      const source = readFileSync(join(root, "src", file), "utf8");
      expect(network.test(source), `${file} 不應發出網路請求`).toBe(false);
    }
  });

  it("AC-010 整個 src 只有載入同源靜態 JSON 的兩個 fetch，且沒有外部網址", () => {
    const fetchCalls: string[] = [];
    const externalUrls: string[] = [];
    for (const file of walk(join(root, "src"))) {
      if (/\.test\.tsx?$/.test(file)) continue;
      const source = readFileSync(file, "utf8");
      for (const m of source.match(/\bfetch\s*\([^)]*\)/g) ?? []) {
        fetchCalls.push(`${rel(file)}: ${m}`);
      }
      for (const m of source.match(/https?:\/\/[^\s"'`)]+/g) ?? []) {
        externalUrls.push(`${rel(file)}: ${m}`);
      }
    }
    expect(fetchCalls).toEqual([
      'src/lib/storage.ts: fetch("/data/legal-db.json")',
      'src/lib/storage.ts: fetch("/data/templates.json")',
    ]);
    expect(externalUrls).toEqual([]);
  });

  it("AC-010 沒有加入追蹤或分析 SDK", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    const trackers = deps.filter((d) =>
      /sentry|analytics|gtag|segment|mixpanel|amplitude|posthog|hotjar|datadog/i.test(d)
    );
    expect(trackers).toEqual([]);
  });
});
