# Status — 合約到期與風險條款提醒（contract-tracker）

- 更新日期：2026-11-16
- 狀態：🟢 **M1 開發完成，AC-001～AC-010 的驗證指令全數通過；待 Sean 覆審**（GOAL.md Exit gate：scope 與免責文案須由 Sean 覆審）。
- 分支：`feat/m1`（從 `chore/prd-rebuild` 開出；PR #1 尚未合併）
- PR：[openclawsean024-create/contract-tracker#2](https://github.com/openclawsean024-create/contract-tracker/pull/2)（Draft，base `main`）
- 主 repo：`openclawsean024-create/contract-tracker`
- 併入來源：`openclawsean024-create/contract-reviewer`（`main` HEAD `ef08fd8`，只讀；未在該 repo 做任何操作）
- 未做的事：沒有 push 到 `main`、沒有合併 PR、沒有部署、沒有啟用 Pages、沒有封存 `contract-reviewer`、沒有接任何外部服務。

## M1 驗收條件對照

驗證環境：本機 Node v26.13.1（CI 為 Node 20）、`npm ci --legacy-peer-deps`、Playwright Chromium headless。所有指令在 repo 根目錄執行。

| AC | 狀態 | Commit | 測試（名稱皆以 AC 編號開頭） | 驗證指令 | 結果（2026-11-16） |
|---|---|---|---|---|---|
| AC-001 入口載入 React SPA | ✅ | `9a412d9` | `src/entry.test.ts`（3）、`tests/e2e/entry.spec.ts`（2） | `npm run build && grep -q 'id="root"' dist/index.html && ls dist/assets/*.js && ! test -f dist/dashboard.html` | exit 0；`dist/assets/` 有 `index-*.js`、`react-*.js`、`pdfjs-*.js`、`mammoth.browser-*.js`；E2E 首頁看到「儀表板」標題 |
| AC-002 多格式輸入 | ✅ | `427aebb`、`8c8df5e` | `src/lib/textExtract.test.ts`（10）、`src/lib/search.test.ts`（2）、`tests/e2e/inputs.spec.ts`（4）、主流程 E2E（貼上） | `npx vitest run src/lib/textExtract.test.ts` | exit 0，10／10；涵蓋 txt、假 docx、不支援格式、損壞檔、貼上、三種輸入結果一致 |
| AC-003 契約類型偵測 | ✅ | `427aebb`、`8c8df5e` | `src/lib/contractType.test.ts`（10）、`tests/e2e/inputs.spec.ts`（1） | `npx vitest run src/lib/contractType.test.ts` | exit 0，10／10；含 reviewer 原有 6 情境 |
| AC-004 擴充規則＋決定性 | ✅ | `427aebb` | `src/lib/legalDb.test.ts`（59＝原有 14＋新增 45） | `npx vitest run src/lib/legalDb.test.ts`；`git grep -n "Math.random" src/lib/legalDb.ts` | exit 0，59／59；grep 無結果（exit 1）；原有 14 個測試未改動 |
| AC-005 工作流與註解 | ✅ | `ea742e1`、`8c8df5e` | `src/lib/workflow.test.ts`（16）、`tests/e2e/workflow-team.spec.ts`（1） | `npx vitest run src/lib/workflow.test.ts` | exit 0，16／16；含 fake-indexeddb 的 v1 → v2 migration |
| AC-006 到期提醒（mock 寄件匣） | ✅ | `4596a52`、`8c8df5e` | `src/lib/reminderDispatch.test.ts`（18，其中 2 個屬 AC-008）、`tests/e2e/m1-flow.spec.ts`（2） | `npx vitest run src/lib/reminderDispatch.test.ts` | exit 0，18／18；每個測試結束都斷言 `fetch` 呼叫次數為 0 |
| AC-007 團隊共用（本機 mock） | ✅ | `4596a52`、`8c8df5e` | `src/lib/team.test.ts`（15）、`tests/e2e/workflow-team.spec.ts`（1） | `npx vitest run src/lib/team.test.ts` | exit 0，15／15 |
| AC-008 免責聲明與文案 | ✅（文案待 Sean 定稿） | `4596a52`、`8c8df5e` | `src/lib/disclaimer.test.ts`（9）、`reminderDispatch.test.ts`（2）、主流程 E2E、`AC-008 免責確認狀態…` E2E | `git grep -nE "AI ?(摘要\|解釋\|分析\|審核)\|法律意見書" src/` | grep 無結果（exit 1）；E2E 在首頁、合約列表、合約詳情三頁斷言聲明可見，未勾選時上傳與分析按鈕皆 disabled |
| AC-009 E2E 與品質閘門 | ✅ | `03e2dc0`、`04850bd` | `src/ci.test.ts`（3）、`tests/e2e/*.spec.ts`（12） | `npm run lint`、`npm test`、`npm run build`、`npm run e2e`；`grep -n "\|\| echo\\\|continue-on-error" .github/workflows/ci.yml` | 四個指令皆 exit 0；grep 無結果（exit 1） |
| AC-010 資料與憑證衛生 | ✅ | `04850bd` | `src/hygiene.test.ts`（6）、所有 E2E 的網路攔截 fixture | `git grep -nIE "(sk-[A-Za-z0-9]{20}\|ghp_[A-Za-z0-9]{20}\|AKIA[0-9A-Z]{16}\|BEGIN [A-Z ]*PRIVATE KEY)"`；`git grep -nE "@[A-Za-z0-9.-]+\.[a-z]{2,}" -- src tests` | 第一個 grep 無結果（exit 1）；第二個 grep 的 36 筆全部是 `example.com`／`example.test`；E2E 攔截到的請求全部是 `http://127.0.0.1:4173` |

## 品質閘門輸出摘要（2026-11-16，全新 `npm ci` 後執行）

| 指令 | Exit | 輸出摘要 |
|---|---:|---|
| `npm ci --legacy-peer-deps` | 0 | — |
| `npm run lint`（`tsc --noEmit && tsc --noEmit -p tsconfig.e2e.json`） | 0 | 無錯誤 |
| `npm run typecheck`（同 lint） | 0 | 無錯誤 |
| `npm test`（`vitest --run`） | 0 | 13 個檔案、170 個測試全部通過（原有 33 個仍在其中） |
| `npm run build`（`tsc -b && vite build`） | 0 | 2439 modules；`index-*.js` 600 kB、`pdfjs-*.js` 359 kB、`mammoth.browser-*.js` 305 kB（lazy）、`react-*.js` 164 kB；有 chunk 大於 500 kB 的警告（非錯誤） |
| `npm run e2e`（build + Playwright，本機 `vite preview`） | 0 | 12 passed（約 11 秒） |
| `git diff --check` | 0 | — |

另外以 headless Chromium 實際開啟 build 產物走過一次完整流程（儀表板 → 團隊 → 貼上合約 → 詳情 → 模擬寄件匣；桌機與 390px 寬度），console 無錯誤。

## 待確認決策：M1 沿用的預設（未自行擴大範圍）

| 決策 | M1 採用的預設 | 依據 |
|---|---|---|
| 風險分級 | 只有綠／黃／紅三級，不搬 1–10 數值分數。reviewer 的 high → 紅、medium → 黃；r8 管轄／仲裁、r9 不可抗力為資訊提示，不計入分級 | GOAL AC-004（Sean 2026-11-16 決定） |
| 合約類別擴充 | **不擴充**，維持既有 6 類。偵測結果對應：NDA → 保密協議、僱傭 → 聘僱合約、採購 → 供應商合約、租賃 → 租賃合約；授權／顧問／服務／合作 MOU／一般 → 其他（合約上保留「規則偵測類型」標籤，使用者可手動改類別） | GOAL AC-003「對應到 T 的 `ContractCategory`」 |
| 定價 | 沒有實作任何定價、方案或付費牆 | GOAL Out of scope |
| 免責聲明文案 | 使用 SPEC §8 草案原文（常數 `DISCLAIMER_TEXT`），畫面上標示「文案草稿，待 Sean 定稿」（常數 `DISCLAIMER_DRAFT_NOTE`，定稿後移除） | GOAL AC-008 |

## 實作時做的設計選擇（請 Sean 覆審）

1. **自動續約的分級不一致**：tracker 原有的條款層級規則把自動續約標為黃，reviewer 的 r3 標為 high（紅）。兩條都保留，因此含自動續約的合約整體會是紅。是否調整其中一條的分級，請 Sean 決定。
2. **提醒收件人的退回順序**：合約有勾選收件人 → 用收件人；沒有 → 寄給負責人；兩者皆無 → 信件仍寫入寄件匣，收件人顯示「（未設定收件人）」，避免提醒無聲消失。
3. **去重鍵**為「合約 ID＋門檻＋日期」。同一天改了收件人或負責人後再檢查，不會重寫當天已存在的那封信。
4. **純文字來源以「段」計**：.txt／.docx／貼上的內文以空行（或換行）分段，條款擷取逐段比對；合約詳情對非 PDF 來源顯示「第 N 段」。
5. **瀏覽器通知**只對「本次新寫入寄件匣」的提醒發出，等同共用同一套去重。
6. **「目前身分」**是本機選單（非登入），只用於「我負責的」篩選與註解作者；工作流沒有角色權限控管。
7. **`dashboard.html` 已刪除**（與產品無關的 mockup，可從 git history 取回）。
8. **法條對照固定 ID** 由我依法條庫現有條目挑選（例如排他條款對照「公平交易法 §1」），**未經律師覆核**，屬 M2 範圍。

## 發現但未處理（不在 M1 AC 範圍）

- **FR-019 全文搜尋對中文關鍵字查不到結果**：FlexSearch 預設編碼會丟掉 CJK 字元，自訂 tokenizer 沒有生效。本次只修了 production build 的「Document is not a constructor」（它會讓建檔流程整個中斷），英文關鍵字可搜尋；中文搜尋需另案處理。
- **CI deploy job**：邏輯未改（只多了 `needs: e2e`）。repo 未啟用 Pages，合併到 `main` 後該 job 仍會在 `Setup Pages` 失敗；是否移除或改寫由 Sean 決定。
- `pnpm-lock.yaml`／`pnpm-workspace.yaml` 未更新（非 canonical；本次新增的依賴只寫入 `package-lock.json`）。
- JSON 匯出只含合約，不含團隊成員與模擬寄件匣。

## FR 實作對照（M1 後；SPEC.md §5 的狀態欄未改動，以本表為準）

| 狀態 | FR |
|---|---|
| 已實作（本機、有測試） | FR-001 入口、FR-002 PDF 擷取、FR-003 多格式輸入、FR-004 條款擷取、FR-005／006 規則引擎與擴充規則、FR-007 類型偵測、FR-008 基本資料編輯、FR-010 到期清單、FR-011 瀏覽器通知（依自訂天數、有去重）、FR-012 提醒寄送（**mock 寄件匣**）、FR-013 團隊共用（**本機 mock**）、FR-014 工作流與註解、FR-015 狀態分組儀表板、FR-016 風險儀表板、FR-021 免責聲明 |
| 已實作（無測試，M1 未動） | FR-017 法條庫、FR-018 範本庫、FR-020 JSON 匯出入 |
| 部分 | FR-019 全文搜尋（中文查不到，見上） |
| 未實作（M2 以後） | FR-009 到期日擷取、FR-022 帳號與雲端、FR-023 金流、FR-024 本機加密；FR-001 的「可部署」部分（M1 不部署） |

## Notion 商品資料庫對應

| 欄位（Notion「可產品化商品」） | 值 |
|---|---|
| 產品名稱 | 合約到期與風險條款提醒 |
| 優先順序／開發順位 | P3／第 10 個 |
| 主 repo／要併入的 repo | openclawsean024-create/contract-tracker／openclawsean024-create/contract-reviewer |
| 上市前要補 | 合併兩個 repo（M1 完成）、到期提醒寄送（M1 為 mock）、團隊共用（M1 為本機 mock） |
| 主要風險 | 不得構成法律意見，需明確免責；條款判讀錯誤責任 |

## 待 Sean 決定／確認

1. 覆審 M1 scope 與免責文案（Exit gate）。
2. 合約類別是否擴充（採購、授權、顧問、服務）。
3. 自動續約的分級（黃或紅，見上）。
4. 定價與付費分層。
5. 「非律師提供條款分析」是否有法規限制（需律師意見）；法條對照與規則文案的律師覆核。
6. M2 的 Email 服務商、雲端儲存方案與資料存放地區。
7. M1 驗收後是否封存 `contract-reviewer`。
8. CI deploy job 與 Pages 的處置。

## 下一步

Sean 覆審 PR → 核准後合併（agent 不合併）。M2 開始前不接任何外部服務。
