// M1 主要流程（AC-009）：
// 勾選免責 → 貼上假合約文字 → 看到風險標記 → 設定到期日與負責人 → 觸發提醒檢查 → 在 mock 寄件匣看到信件
import {
  test,
  expect,
  openApp,
  gotoRoute,
  addMember,
  FIXED_TODAY,
} from "./fixtures";
import { DISCLAIMER_ACK_LABEL, DISCLAIMER_TEXT } from "../../src/lib/disclaimer";
import { FAKE_RISKY_CONTRACT } from "../fixtures/fake-contracts";

const TITLE = "【測試】軟體維護服務合約";
const MEMBER_NAME = "測試成員甲";
const MEMBER_EMAIL = "member.a@example.com";

test("AC-009 主流程：免責 → 貼上 → 風險標記 → 到期日與負責人 → 提醒檢查 → mock 寄件匣", async ({
  page,
  networkGuard,
}) => {
  // --- 首頁 ---
  await openApp(page);
  // AC-008：首頁可見免責聲明
  await expect(page.getByTestId("disclaimer-footer")).toContainText(DISCLAIMER_TEXT);

  // --- 團隊（本機 mock）：新增成員並設為目前身分 ---
  await addMember(page, MEMBER_NAME, MEMBER_EMAIL);
  await page.getByTestId("current-member-select").selectOption({ label: MEMBER_NAME });

  // --- 合約列表：未勾選免責時不能上傳 ---
  await gotoRoute(page, "/contracts");
  await expect(page.getByRole("heading", { level: 1, name: "合約管理" })).toBeVisible();
  // AC-008：合約列表頁可見免責聲明（頁尾與上傳區）
  await expect(page.getByTestId("disclaimer-footer")).toContainText(DISCLAIMER_TEXT);
  await expect(page.getByTestId("disclaimer-upload")).toContainText(DISCLAIMER_TEXT);
  await expect(page.getByLabel(DISCLAIMER_ACK_LABEL)).not.toBeChecked();
  await expect(page.getByTestId("file-input")).toBeDisabled();
  await expect(page.getByTestId("paste-submit")).toBeDisabled();

  await page.getByTestId("paste-title").fill(TITLE);
  await page.getByTestId("paste-textarea").fill(FAKE_RISKY_CONTRACT);
  // 已貼上文字但還沒勾選：仍然不能送出
  await expect(page.getByTestId("paste-submit")).toBeDisabled();

  // --- 勾選免責 ---
  await page.getByLabel(DISCLAIMER_ACK_LABEL).check();
  await expect(page.getByTestId("file-input")).toBeEnabled();
  await expect(page.getByTestId("paste-submit")).toBeEnabled();

  // --- 貼上假合約文字 → 看到風險標記 ---
  await page.getByTestId("paste-submit").click();
  await expect(page.getByTestId("risk-section")).toBeVisible();
  await expect(page.getByTestId("title-input")).toHaveValue(TITLE);
  await expect(page.getByTestId("risk-badge")).toHaveText("高風險");
  expect(await page.getByTestId("risk-item").count()).toBeGreaterThan(0);
  await expect(page.getByTestId("risk-list")).toContainText("自動續約");
  await expect(page.getByTestId("risk-list")).toContainText("單方變更或決定條款");
  // 管轄條款是資訊提示，不在風險清單內
  await expect(page.getByTestId("risk-info-list")).toContainText("已約定管轄或仲裁");
  await expect(page.getByTestId("risk-list")).not.toContainText("已約定管轄或仲裁");
  // 只有綠／黃／紅三級，沒有 1–10 數值分數
  await expect(page.getByTestId("risk-section")).not.toContainText("/10");
  // AC-008：合約詳情頁可見免責聲明（頁尾與風險結果區）
  await expect(page.getByTestId("disclaimer-footer")).toContainText(DISCLAIMER_TEXT);
  await expect(page.getByTestId("disclaimer-risk")).toContainText(DISCLAIMER_TEXT);

  // --- 設定負責人、提醒天數與到期日（固定時鐘的今天＋45 天）---
  await page.getByTestId("owner-select").selectOption({ label: `${MEMBER_NAME}（行政／總務）` });
  await page.getByTestId("reminder-days-input").fill("45");
  await page.getByTestId("reminder-days-input").blur();
  await expect(page.getByTestId("reminder-thresholds")).toContainText("到期前 45 天");
  await page.getByTestId("expires-input").fill("2026-12-31");
  await expect(page.getByTestId("resolved-recipients")).toContainText(MEMBER_EMAIL);

  // --- 觸發提醒檢查 → 在 mock 寄件匣看到信件 ---
  await gotoRoute(page, "/outbox");
  await expect(page.getByTestId("outbox-mock-notice")).toBeVisible();
  await page.getByTestId("run-reminder-check").click();
  await expect(page.getByTestId("outbox-status")).toContainText(FIXED_TODAY);
  const emails = page.getByTestId("outbox-email");
  await expect(emails).toHaveCount(1);
  await expect(emails.getByTestId("outbox-subject")).toContainText(TITLE);
  await expect(emails.getByTestId("outbox-subject")).toContainText("45 天後到期");
  await expect(emails.getByTestId("outbox-to")).toContainText(MEMBER_EMAIL);
  await expect(emails.getByTestId("outbox-body")).toContainText("2026-12-31");
  // AC-008：提醒信內文包含免責聲明
  await expect(emails.getByTestId("outbox-body")).toContainText(DISCLAIMER_TEXT);

  // 再檢查一次不會重寄
  await page.getByTestId("run-reminder-check").click();
  await expect(page.getByTestId("outbox-status")).toContainText("本次新增 0 封");
  await expect(emails).toHaveCount(1);

  // --- 儀表板：「我負責的」篩選與待辦數量 ---
  await gotoRoute(page, "/");
  await expect(page.getByTestId("total-count")).toHaveText("1");
  await expect(page.getByTestId("todo-count")).toHaveText("1");
  await page.getByTestId("filter-mine").click();
  await expect(page.getByTestId("total-count")).toHaveText("1");
  await expect(page.getByTestId("expiring-row")).toContainText(MEMBER_NAME);

  // AC-010：整個流程只有對本機 origin 的請求
  expect(networkGuard.external).toEqual([]);
  expect(networkGuard.seen.length).toBeGreaterThan(0);
});

test("AC-008 免責確認狀態存在本機，重新整理後仍然有效", async ({ page }) => {
  await openApp(page);
  await gotoRoute(page, "/contracts");
  await expect(page.getByTestId("file-input")).toBeDisabled();
  await page.getByTestId("disclaimer-ack").check();
  await expect(page.getByTestId("file-input")).toBeEnabled();
  await page.reload();
  await expect(page.getByTestId("disclaimer-ack")).toBeChecked();
  await expect(page.getByTestId("file-input")).toBeEnabled();
  // 取消勾選後再次鎖住
  await page.getByTestId("disclaimer-ack").uncheck();
  await expect(page.getByTestId("file-input")).toBeDisabled();
  await expect(page.getByTestId("paste-submit")).toBeDisabled();
});

test("AC-006 使用者設定的提醒天數實際生效：未命中的日期不會產生信件", async ({ page }) => {
  await openApp(page);
  await gotoRoute(page, "/contracts");
  await page.getByTestId("disclaimer-ack").check();
  await page.getByTestId("paste-title").fill(TITLE);
  await page.getByTestId("paste-textarea").fill(FAKE_RISKY_CONTRACT);
  await page.getByTestId("paste-submit").click();
  await expect(page.getByTestId("risk-section")).toBeVisible();

  // 距到期 45 天，但提醒天數設為 30 → 不應產生信件
  await page.getByTestId("reminder-days-input").fill("30");
  await page.getByTestId("reminder-days-input").blur();
  await page.getByTestId("expires-input").fill("2026-12-31");
  await gotoRoute(page, "/outbox");
  await page.getByTestId("run-reminder-check").click();
  await expect(page.getByTestId("outbox-status")).toContainText("本次新增 0 封");
  await expect(page.getByTestId("outbox-email")).toHaveCount(0);

  // 改成 45 天 → 產生一封；因為沒有負責人與收件人，顯示未設定收件人
  await page.goBack();
  await expect(page.getByTestId("risk-section")).toBeVisible();
  await page.getByTestId("reminder-days-input").fill("45");
  await page.getByTestId("reminder-days-input").blur();
  await expect(page.getByTestId("reminder-thresholds")).toContainText("到期前 45 天");
  await gotoRoute(page, "/outbox");
  await page.getByTestId("run-reminder-check").click();
  await expect(page.getByTestId("outbox-email")).toHaveCount(1);
  await expect(page.getByTestId("outbox-to")).toContainText("未設定收件人");
});
