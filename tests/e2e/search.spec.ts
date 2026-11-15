// FR-019：中文全文搜尋（在 production build 的真實瀏覽器中驗證）
import { test, expect, openApp, gotoRoute, acknowledgeDisclaimer, pasteContract } from "./fixtures";
import { FAKE_RISKY_CONTRACT } from "../fixtures/fake-contracts";

const LEASE_TEXT =
  "【測試用假合約】出租人出租測試辦公室，月租金新台幣 1,000 元，押金 2 個月。";

async function search(page: import("@playwright/test").Page, keyword: string) {
  await page.getByTestId("search-input").fill(keyword);
  await page.getByTestId("search-submit").click();
}

test("FR-019 中文關鍵字可以搜尋到合約的標題與內文", async ({ page }) => {
  await openApp(page);
  await acknowledgeDisclaimer(page);
  await pasteContract(page, "【測試】軟體維護服務合約", FAKE_RISKY_CONTRACT);
  await pasteContract(page, "【測試】辦公室租約", LEASE_TEXT);

  await gotoRoute(page, "/search");
  const results = page.getByTestId("search-result");

  // 內文關鍵字
  await search(page, "自動續約");
  await expect(page.getByTestId("search-count")).toHaveText("找到 1 份合約");
  await expect(results).toHaveCount(1);
  await expect(results).toContainText("【測試】軟體維護服務合約");
  await expect(results).toContainText("命中欄位：內文");

  // 標題關鍵字
  await search(page, "租約");
  await expect(results).toHaveCount(1);
  await expect(results).toContainText("【測試】辦公室租約");
  await expect(results).toContainText("命中欄位：標題");

  // 兩份都符合
  await search(page, "測試用假合約");
  await expect(results).toHaveCount(2);

  // 不存在的詞
  await search(page, "仲裁");
  await expect(page.getByTestId("search-count")).toHaveText("找到 0 份合約");
  await expect(results).toHaveCount(0);

  // 按 Enter 也能搜尋
  await page.getByTestId("search-input").fill("押金");
  await page.getByTestId("search-input").press("Enter");
  await expect(results).toHaveCount(1);
  await expect(results).toContainText("【測試】辦公室租約");
});

test("FR-019 修改合約標題後，搜尋結果跟著更新", async ({ page }) => {
  await openApp(page);
  await acknowledgeDisclaimer(page);
  await pasteContract(page, "【測試】辦公室租約", LEASE_TEXT);
  await page.getByTestId("title-input").fill("【測試】倉庫使用協議");
  await expect(page.getByText("已更新：標題")).toBeVisible();

  await gotoRoute(page, "/search");
  await search(page, "倉庫");
  await expect(page.getByTestId("search-result")).toHaveCount(1);
  await expect(page.getByTestId("search-result")).toContainText("【測試】倉庫使用協議");
  await search(page, "租約");
  await expect(page.getByTestId("search-result")).toHaveCount(0);
});
