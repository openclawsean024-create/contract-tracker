// E2E 共用 fixture：攔截所有網路請求（AC-010）。
// 只允許對本機 origin 的 GET，且只能是 app 本身的靜態資源；任何帶 body 的請求或其他路徑都算違規，
// 因此「把合約內文 POST 到同源端點」也會被抓到（Codex 審查 #12）。
import { test as base, expect, type Page } from "@playwright/test";

export const FIXED_NOW = new Date("2026-11-16T10:00:00+08:00");
export const FIXED_TODAY = "2026-11-16";

const ALLOWED_LOCAL_PATHS =
  /^\/(?:index\.html)?$|^\/assets\/[\w.-]+$|^\/data\/(?:legal-db|templates)\.json$|^\/favicon\.svg$/;

function violation(
  request: import("@playwright/test").Request,
  origin: string
): string | null {
  const url = request.url();
  if (url.startsWith("data:") || url.startsWith("blob:")) return null;
  const parsed = new URL(url);
  if (parsed.origin !== origin) return `外部請求：${url}`;
  if (request.method() !== "GET") return `非 GET 請求：${request.method()} ${url}`;
  if (request.postData()) return `帶 body 的請求：${url}`;
  if (!ALLOWED_LOCAL_PATHS.test(parsed.pathname)) return `非預期的本機路徑：${parsed.pathname}`;
  return null;
}

export const test = base.extend<{ networkGuard: { seen: string[]; external: string[] } }>({
  networkGuard: [
    async ({ context, baseURL }, use) => {
      const origin = new URL(baseURL!).origin;
      const seen: string[] = [];
      const external: string[] = [];
      await context.route("**/*", async (route) => {
        const request = route.request();
        seen.push(request.url());
        const problem = violation(request, origin);
        if (problem) {
          external.push(problem);
          await route.abort();
        } else {
          await route.continue();
        }
      });
      await use({ seen, external });
      expect(seen.length, "應該至少攔截到載入 app 的請求").toBeGreaterThan(0);
      expect(external, "E2E 期間只能有對本機 app 靜態資源的 GET 請求").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** 固定瀏覽器時鐘後開啟首頁（提醒檢查因此不依賴執行當天的日期）。 */
export async function openApp(page: Page) {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "儀表板" })).toBeVisible();
}

export async function gotoRoute(page: Page, hash: string) {
  await page.evaluate((h) => {
    window.location.hash = h;
  }, hash);
}

export async function acknowledgeDisclaimer(page: Page) {
  await gotoRoute(page, "/contracts");
  await page.getByTestId("disclaimer-ack").check();
}

export async function addMember(page: Page, name: string, email: string) {
  await gotoRoute(page, "/team");
  await page.getByTestId("member-name-input").fill(name);
  await page.getByTestId("member-email-input").fill(email);
  await page.getByTestId("add-member").click();
  await expect(page.getByTestId("member-row").filter({ hasText: email })).toBeVisible();
}

/** 貼上假合約文字並送出分析，結束時停在合約詳情頁。 */
export async function pasteContract(page: Page, title: string, text: string) {
  await gotoRoute(page, "/contracts");
  await page.getByTestId("paste-title").fill(title);
  await page.getByTestId("paste-textarea").fill(text);
  await page.getByTestId("paste-submit").click();
  await expect(page.getByTestId("risk-section")).toBeVisible();
  await expect(page.getByTestId("title-input")).toHaveValue(title);
}
