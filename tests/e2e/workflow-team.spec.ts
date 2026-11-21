// AC-005／AC-007：審核工作流、註解、團隊負責人（本機 mock）
import {
  test,
  expect,
  openApp,
  gotoRoute,
  acknowledgeDisclaimer,
  addMember,
  pasteContract,
} from "./fixtures";
import { FAKE_RISKY_CONTRACT } from "../fixtures/fake-contracts";

const TITLE = "【測試】工作流合約";

test("AC-005 審核流程只能依序推進，註解不改動合約內文，儀表板顯示分組數量", async ({ page }) => {
  await openApp(page);
  await acknowledgeDisclaimer(page);
  await pasteContract(page, TITLE, FAKE_RISKY_CONTRACT);

  const current = () => page.locator('[data-testid^="workflow-step-"][aria-current="step"]');
  await expect(current()).toHaveText("草擬建立");
  // 只提供「推進到下一階段」，沒有跳關或倒退的操作
  await expect(page.getByTestId("advance-status")).toHaveText("推進到「送審核中」");

  // 新增註解
  await page.getByTestId("note-input").fill("第四條違約金比例請再確認");
  await page.getByTestId("add-note").click();
  await expect(page.getByTestId("note-item")).toHaveCount(1);
  await expect(page.getByTestId("note-item")).toContainText("第四條違約金比例請再確認");
  await expect(page.getByTestId("note-item")).toContainText("未具名");
  await page.getByText("完整擷取文字").click();
  await expect(page.getByTestId("extracted-text")).not.toContainText("請再確認");

  // 儀表板：待辦 1
  await gotoRoute(page, "/");
  await expect(page.getByTestId("todo-count")).toHaveText("1");
  await expect(page.getByTestId("review-count")).toHaveText("0");
  await expect(page.getByTestId("signed-count")).toHaveText("0");

  // 推進到法務覆核 → 待覆核 1
  await page.goBack();
  await page.getByTestId("advance-status").click();
  await expect(current()).toHaveText("送審核中");
  await page.getByTestId("advance-status").click();
  await expect(current()).toHaveText("法務覆核");
  await gotoRoute(page, "/");
  await expect(page.getByTestId("todo-count")).toHaveText("0");
  await expect(page.getByTestId("review-count")).toHaveText("1");

  // 推進到對方簽署 → 已簽署 1，且沒有下一步
  await page.goBack();
  await page.getByTestId("advance-status").click();
  await expect(current()).toHaveText("主管核准");
  await page.getByTestId("advance-status").click();
  await expect(current()).toHaveText("對方簽署");
  await expect(page.getByTestId("advance-status")).toHaveCount(0);

  // 重新載入後狀態與註解都保留
  await page.reload();
  await expect(current()).toHaveText("對方簽署");
  await expect(page.getByTestId("note-item")).toHaveCount(1);
  await gotoRoute(page, "/");
  await expect(page.getByTestId("signed-count")).toHaveText("1");
});

test("AC-007 指派負責人、「我負責的」篩選；移除成員後合約顯示未指派", async ({ page }) => {
  await openApp(page);
  await addMember(page, "測試成員甲", "member.a@example.com");
  await addMember(page, "測試成員乙", "member.b@example.test");

  // 非假資料網域的 Email 會被拒絕
  await page.getByTestId("member-name-input").fill("測試成員丙");
  await page.getByTestId("member-email-input").fill(["member.c", "example.org"].join("@"));
  await page.getByTestId("add-member").click();
  await expect(page.getByTestId("team-error")).toContainText("example.com");
  await expect(page.getByTestId("member-row")).toHaveCount(2);

  await page.getByTestId("current-member-select").selectOption({ label: "測試成員甲" });

  await acknowledgeDisclaimer(page);
  await pasteContract(page, "【測試】甲負責的合約", FAKE_RISKY_CONTRACT);
  await page.getByTestId("owner-select").selectOption({ label: "測試成員甲（行政／總務）" });
  await expect(page.getByTestId("resolved-recipients")).toContainText("member.a@example.com");
  // 指定提醒收件人後，以收件人為準
  await page.getByTestId("recipient-list").getByLabel("測試成員乙").check();
  await expect(page.getByTestId("resolved-recipients")).toContainText("member.b@example.test");
  await expect(page.getByTestId("resolved-recipients")).not.toContainText("member.a@example.com");

  await pasteContract(page, "【測試】沒人負責的合約", FAKE_RISKY_CONTRACT);

  // 儀表板：全部 2 份；我負責的 1 份
  await gotoRoute(page, "/");
  await expect(page.getByTestId("total-count")).toHaveText("2");
  await page.getByTestId("filter-mine").click();
  await expect(page.getByTestId("total-count")).toHaveText("1");
  await page.getByTestId("filter-all").click();
  await expect(page.getByTestId("total-count")).toHaveText("2");

  // 合約列表顯示負責人
  await gotoRoute(page, "/contracts");
  const owned = page.getByTestId("contract-row").filter({ hasText: "甲負責的合約" });
  await expect(owned).toContainText("負責人 測試成員甲");

  // 移除成員甲 → 合約顯示未指派
  await gotoRoute(page, "/team");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "移除 測試成員甲" }).click();
  await expect(page.getByTestId("member-row")).toHaveCount(1);
  await gotoRoute(page, "/contracts");
  await expect(owned).toContainText("負責人 未指派");
  await owned.getByRole("link", { name: "檢視" }).click();
  await expect(page.getByTestId("owner-select")).toHaveValue("");
});
