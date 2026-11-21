# Goal — 合約到期與風險條款提醒 M1

## Objective

把 `contract-reviewer` 的可用功能併入 `contract-tracker`，成為一個只用假資料、不接任何外部服務、可以在瀏覽器實際操作的本機 MVP。MVP 要做到三件事：修好應用程式入口；讓到期提醒依使用者設定觸發，並寫入 mock 寄件匣；以本機 mock 方式支援團隊負責人與提醒收件人。所有畫面與提醒內容都要清楚標示「不構成法律意見」。

規格依據：`PRD/SPEC.md` §5（FR）、§9（M1）、§12（合併清單）。

## Acceptance criteria

除非另有說明，所有指令都在 repo 根目錄執行。新增的測試只能使用假資料（`tests/fixtures/` 或測試檔內的明顯假字串）。

- **AC-001：應用程式入口可載入 React SPA**（FR-001）
  根目錄的 `index.html` 改回 Vite entry（`<div id="root">` + `/src/main.tsx`）；`dashboard.html` 不再是入口，也不會出現在 build 產物中。
  驗證：`npm run build && grep -q 'id="root"' dist/index.html && ls dist/assets/*.js && ! test -f dist/dashboard.html`，exit 0；並由 AC-009 的 E2E 開啟首頁時看到「儀表板」標題。

- **AC-002：多格式輸入（併入 M-01、M-02）**（FR-003）
  可以上傳 `.pdf`、`.txt`、`.docx`，也可以直接貼上合約內文；四種輸入都會進入同一條條款擷取與風險評估流程。不支援的格式或解析失敗時，要顯示錯誤訊息並提示改用貼上文字。
  驗證：`npx vitest run src/lib/textExtract.test.ts` 通過，至少涵蓋 txt、docx（以測試內產生的假 docx）、不支援格式三種情境；E2E 涵蓋「貼上文字 → 看到風險結果」。

- **AC-003：契約類型自動偵測（併入 M-03）**（FR-007）
  新建合約時自動帶入偵測到的類別，使用者可以手動修改。
  驗證：`npx vitest run src/lib/contractType.test.ts` 通過，至少包含 R 原有的 6 個情境（NDA、僱傭、租賃、採購、顧問、未知），斷言結果對應到 T 的 `ContractCategory`。

- **AC-004：擴充風險規則並改為決定性輸出（併入 M-04、M-05）**（FR-005、FR-006）
  R 的 13 條規則改寫進 `RISK_RULES`，每條規則都有 `suggestion` 與 `category`；管轄／仲裁、不可抗力改為資訊提示，不計入風險分數；移除 `Math.random()`，同一份輸入兩次評估的結果完全相同。風險結果只呈現綠／黃／紅三級，不提供 1–10 數值分數（Sean 2026-11-16 決定）。
  驗證：`npx vitest run src/lib/legalDb.test.ts` 通過；每條新規則至少有一個命中案例和一個不命中案例；有一個測試對同一份輸入呼叫兩次 `evaluateRisk` 並斷言 `toEqual`；`git grep -n "Math.random" src/lib/legalDb.ts` 沒有結果。原有的 14 個測試斷言不得刪除或放寬。

- **AC-005：審核工作流與註解（併入 M-06、M-07）**（FR-014、FR-015）
  合約有 5 階段狀態（草擬建立 → 送審核中 → 法務覆核 → 主管核准 → 對方簽署），只能依序往下推進；註解存成獨立的 `notes[]`（含時間與作者），不修改合約內文。Dexie schema 升到 v2，v1 的既有資料升級後不遺失。儀表板顯示待辦／待覆核／已簽署的數量。
  驗證：`npx vitest run src/lib/workflow.test.ts` 通過，涵蓋：依序推進、不可跳關或倒退、註解不改動 `extractedText`、v1 → v2 migration 後資料筆數與欄位都保留（使用 fake-indexeddb）。

- **AC-006：到期提醒寄送（mock 寄件匣）**（FR-011、FR-012，Notion「到期提醒寄送」）
  提醒依每份合約的 `reminderDaysBefore` 觸發（另外固定在到期前 7 天與當天各觸發一次）。寄送透過 `EmailAdapter` 介面；M1 只提供 `MockEmailAdapter`，把信件（收件人、主旨、內文、預定日期）寫入本機寄件匣，畫面上可以瀏覽。同一份合約、同一個門檻、同一天只會寫入一次；已停用（`isActive=false`）或已過期的合約不會寄。
  驗證：`npx vitest run src/lib/reminderDispatch.test.ts` 通過，使用注入的固定日期（不依賴系統時鐘），涵蓋：自訂天數命中、未命中、重複執行不重寄、停用合約不寄、測試期間 `fetch` 沒有被呼叫（以 `vi.spyOn(globalThis, 'fetch')` 斷言呼叫次數為 0）。

- **AC-007：團隊共用（本機 mock）**（FR-013，Notion「團隊共用」）
  可以管理團隊成員清單（姓名、Email、角色），並為每份合約指定負責人與提醒收件人；儀表板可篩選「我負責的」；AC-006 的提醒收件人取自合約設定的成員。團隊資料透過 `TeamAdapter` 介面存取，M1 只提供本機實作。成員 Email 只接受 `example.com`／`example.test` 網域的假資料（測試與預設種子資料皆同）。
  驗證：`npx vitest run src/lib/team.test.ts` 通過，涵蓋：新增／移除成員、指派負責人、刪除成員後該成員負責的合約顯示為「未指派」、提醒收件人解析結果正確。

- **AC-008：免責聲明與文案**（FR-021）
  固定的免責聲明文字（常數 `DISCLAIMER_TEXT`，文案見 SPEC §8）出現在：全站頁尾、上傳區、合約詳情的風險結果區，以及每封 mock 提醒信的內文。首次使用時必須勾選「我了解本服務不構成法律意見」才能上傳合約，勾選狀態存在本機。UI 不得把規則比對結果稱為 AI 判斷或法律意見。
  驗證：E2E（AC-009）在首頁、合約列表、合約詳情三個頁面斷言聲明文字可見，並驗證未勾選時上傳按鈕無法使用；`reminderDispatch.test.ts` 斷言信件內文包含 `DISCLAIMER_TEXT`；`git grep -nE "AI ?(摘要|解釋|分析|審核)|法律意見書" src/` 沒有結果。

- **AC-009：E2E 與品質閘門**
  新增 Playwright E2E（`npm run e2e`），跑在本機 `vite preview` 上，主要流程：勾選免責 → 貼上假合約文字 → 看到風險標記 → 設定到期日與負責人 → 觸發提醒檢查 → 在 mock 寄件匣看到信件。CI 的 test 步驟要移除 `|| echo`，lint 要移除 `continue-on-error`，任何失敗都要讓 CI 失敗。
  驗證：`npm run lint`、`npm test`、`npm run build`、`npm run e2e` 全部 exit 0；`grep -n "|| echo\|continue-on-error" .github/workflows/ci.yml` 沒有結果。

- **AC-010：資料與憑證衛生**
  repo 中沒有真實合約、真實個資或憑證；分析流程不會把合約內容送到網路上。
  驗證：`git grep -nIE "(sk-[A-Za-z0-9]{20}|ghp_[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY)"` 沒有結果；`git grep -nE "@[A-Za-z0-9.-]+\.[a-z]{2,}" -- src tests` 只出現 `example.com`／`example.test`；E2E 期間攔截網路請求，斷言只有對本機 origin 的請求。

## Out of scope

- 真實寄信（SMTP、任何 Email 服務商 API、測試寄到真實信箱）、LINE 與推播服務。
- 雲端團隊共用、帳號登入、SSO、角色權限、雲端資料庫與同步。
- 真實金流、訂閱、付費牆。
- 真實合約與真實個資（包含測試、截圖與 demo）。
- LLM／AI 串接、OCR、電子簽章、到期日自動擷取（FR-009，列為 M2）。
- 法條庫內容的法律正確性覆核（M2，需要律師）。
- 框架升級（React 19／Tailwind 4／Vite 6）。
- 正式部署、啟用 GitHub Pages 或 Vercel、修改 repo 設定。
- 封存、刪除或改名 `contract-reviewer`（M1 驗收後由 Sean 決定）。

## Exit gate

M1 完成前，需由 Sean 覆審 scope 與免責文案，並通過 AC-001 至 AC-010 的全部驗證指令（保留指令輸出與 exit code，記錄在 `STATUS.md`）。不得為了通過驗證而刪除或放寬既有測試斷言。未通過前，不得接入任何外部服務（Email、雲端、金流），也不得進行 production release。
