// AC-002／AC-003：多格式輸入與類型偵測（在真實瀏覽器中驗證 .txt／.docx／不支援格式）
import { test, expect, openApp, acknowledgeDisclaimer, gotoRoute } from "./fixtures";
import { FAKE_RISKY_CONTRACT } from "../fixtures/fake-contracts";
import { makeFakeDocx } from "../fixtures/fake-docx";
import { makeFakePdf } from "../fixtures/fake-pdf";

test("AC-002 上傳 .txt → 進入同一條分析流程並看到風險結果", async ({ page }) => {
  await openApp(page);
  await acknowledgeDisclaimer(page);
  await page.getByTestId("file-input").setInputFiles({
    name: "測試維護合約.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(FAKE_RISKY_CONTRACT, "utf8"),
  });
  await expect(page.getByTestId("risk-section")).toBeVisible();
  await expect(page.getByTestId("title-input")).toHaveValue("測試維護合約");
  await expect(page.getByTestId("risk-badge")).toHaveText("高風險");
  await expect(page.getByTestId("risk-list")).toContainText("無限責任條款");
});

test("AC-002 上傳 .docx（測試內產生的假 docx）→ 看到風險結果", async ({ page }) => {
  await openApp(page);
  await acknowledgeDisclaimer(page);
  const docx = await makeFakeDocx(FAKE_RISKY_CONTRACT.split("\n\n"));
  await page.getByTestId("file-input").setInputFiles({
    name: "測試維護合約.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from(docx),
  });
  await expect(page.getByTestId("risk-section")).toBeVisible();
  await expect(page.getByTestId("risk-badge")).toHaveText("高風險");
  await expect(page.getByTestId("risk-list")).toContainText("自動續約");
  await page.getByText("完整擷取文字").click();
  await expect(page.getByTestId("extracted-text")).toContainText("範例科技股份有限公司");
});

test("AC-002 上傳 .pdf（測試內產生的假 PDF）→ 沿用 PDF 擷取並進入同一條分析流程", async ({ page }) => {
  await openApp(page);
  await acknowledgeDisclaimer(page);
  await page.getByTestId("file-input").setInputFiles({
    name: "fake-sample-agreement.pdf",
    mimeType: "application/pdf",
    buffer: makeFakePdf([
      "FAKE SAMPLE AGREEMENT - TEST DATA ONLY",
      "Sample Tech Co. and Test Vendor Ltd. agree to this NDA.",
      "All confidential information shall be protected.",
      "The breaching party shall pay liquidated damages.",
    ]),
  });
  await expect(page.getByTestId("risk-section")).toBeVisible();
  await expect(page.getByTestId("title-input")).toHaveValue("fake-sample-agreement");
  await expect(page.getByTestId("detected-type")).toContainText("NDA");
  await expect(page.getByTestId("category-select")).toHaveValue("nda");
  await expect(page.getByTestId("risk-badge")).toHaveText("高風險");
  await expect(page.getByTestId("risk-list")).toContainText("懲罰性違約金");
  await page.getByText("完整擷取文字").click();
  await expect(page.getByTestId("extracted-text")).toContainText("FAKE SAMPLE AGREEMENT");
});

test("AC-002 不支援的格式顯示錯誤並提示改用貼上文字", async ({ page }) => {
  await openApp(page);
  await acknowledgeDisclaimer(page);
  await page.getByTestId("file-input").setInputFiles({
    name: "測試試算表.xlsx",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("假內容", "utf8"),
  });
  await expect(page.getByTestId("upload-error")).toContainText("不支援的檔案格式");
  await expect(page.getByTestId("upload-error")).toContainText("貼上合約內文");
  await expect(page.getByTestId("contract-row")).toHaveCount(0);
});

test("AC-002 解析失敗（損壞的 docx）顯示錯誤並提示改用貼上文字", async ({ page }) => {
  await openApp(page);
  await acknowledgeDisclaimer(page);
  await page.getByTestId("file-input").setInputFiles({
    name: "損壞的測試檔.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from("這不是 zip 檔", "utf8"),
  });
  await expect(page.getByTestId("upload-error")).toContainText("檔案解析失敗");
  await expect(page.getByTestId("upload-error")).toContainText("貼上合約內文");
});

test("AC-003 新建合約自動帶入偵測到的類別，且可手動修改", async ({ page }) => {
  await openApp(page);
  await acknowledgeDisclaimer(page);
  await page.getByTestId("paste-title").fill("【測試】辦公室租約");
  await page
    .getByTestId("paste-textarea")
    .fill("【測試用假合約】出租人出租測試辦公室，月租金新台幣 1,000 元，押金 2 個月。");
  await page.getByTestId("paste-submit").click();
  await expect(page.getByTestId("risk-section")).toBeVisible();
  await expect(page.getByTestId("category-select")).toHaveValue("lease");
  await expect(page.getByTestId("detected-type")).toContainText("租賃");

  // 手動修改類別後，重新載入仍保留
  await page.getByTestId("category-select").selectOption("vendor");
  await page.reload();
  await expect(page.getByTestId("category-select")).toHaveValue("vendor");

  await gotoRoute(page, "/contracts");
  await expect(page.getByTestId("contract-row")).toContainText("供應商合約");
});
