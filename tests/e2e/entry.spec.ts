import { test, expect } from "./fixtures";

test("AC-001 首頁載入 React SPA 並顯示「儀表板」標題", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.getByRole("heading", { level: 1, name: "儀表板" })).toBeVisible();
  expect(page.url()).not.toContain("dashboard.html");
});

test("AC-001 舊的 dashboard.html 不在 build 產物中（回傳的不是那份 mockup）", async ({ page, request }) => {
  const res = await request.get("/dashboard.html");
  // vite preview 對不存在的路徑回傳 SPA 的 index.html；重點是內容不是舊 mockup
  const body = await res.text();
  expect(body).not.toContain("本月營收");
  await page.goto("/");
  await expect(page.locator('script[type="module"][src*="/assets/"]')).toHaveCount(1);
});
