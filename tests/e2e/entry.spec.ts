import { test, expect } from "@playwright/test";

test("AC-001 首頁載入 React SPA 並顯示「儀表板」標題", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.getByRole("heading", { level: 1, name: "儀表板" })).toBeVisible();
  expect(page.url()).not.toContain("dashboard.html");
});
