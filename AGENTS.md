# AGENTS.md — 合約到期與風險條款提醒（contract-tracker）

## 1. 權威文件與範圍

- 產品規格：[`PRD/SPEC.md`](./PRD/SPEC.md)（v4.0 重建版）；目前里程碑：[`GOAL.md`](./GOAL.md)（M1）。
- 商業依據只有 Notion「可產品化商品」中的「合約到期與風險條款提醒」；README 與舊版文件如果和 SPEC 衝突，以 SPEC 和實際程式為準。
- `openclawsean024-create/contract-reviewer` 是併入來源，**只讀**。要搬的內容見 SPEC §12，不得在該 repo 上 commit、開 PR、封存或改設定。
- 本產品**不提供法律意見**。任何新的 UI 文案、提醒內容或文件都不得把規則比對稱為「AI 判斷」「法律意見」或「合規保證」。

## 2. 專案結構（實際狀態，2026-11-16，M1）

```
index.html            # Vite entry（<div id="root"> + /src/main.tsx）
public/data/
  legal-db.json       # 100 筆台灣法條摘要（未經律師覆核）
  templates.json      # 10 份合約範本
src/
  main.tsx, App.tsx   # HashRouter + 8 個路由
  store.ts            # Zustand；teamAdapter（本機實作）在此建立
  types.ts            # Contract / ClauseRecord / RiskIssue / TeamMember / OutboxEmail …
  components/
    Disclaimer.tsx    # 固定免責聲明
  lib/
    pdfParser.ts      # PDF.js 擷取 + 8 類條款擷取
    textExtract.ts    # .txt／.docx（mammoth）／貼上內文 → 與 PDF 相同的結構
    analyze.ts        # 四種輸入共用的分析流程（純函式）
    contractType.ts   # 契約類型偵測 → ContractCategory
    legalDb.ts        # 風險規則引擎（4 條條款層級 + 13 條全文層級；決定性）
    workflow.ts       # 5 階段審核工作流、註解
    reminderDispatch.ts # 提醒門檻、EmailAdapter、MockEmailAdapter、寄件匣
    reminder.ts       # 到期清單、瀏覽器通知、排程
    team.ts           # TeamAdapter、LocalTeamAdapter、負責人／收件人
    disclaimer.ts     # DISCLAIMER_TEXT 與首次使用確認
    storage.ts        # Dexie IndexedDB（schema v2）、JSON 匯出入
    search.ts         # FlexSearch 全文搜尋（中文關鍵字目前查不到，見 STATUS.md）
  pages/              # Dashboard / Contracts / ContractDetail / Team / Outbox / LegalDb / Templates / Search
  test/               # setup.ts（fake-indexeddb）、factories.ts（假資料工廠）
tests/
  e2e/                # Playwright（跑在本機 vite preview）
  fixtures/           # 假合約文字、假 docx 產生器
.github/workflows/ci.yml  # lint / test / build / e2e / deploy-to-pages（deploy 未啟用）
PRD/                  # SPEC.md、CHANGELOG.md
```

## 3. 技術棧

- React 18.3 + TypeScript（strict）+ Vite 5 + Tailwind CSS 3
- 路由：react-router-dom 6（HashRouter）；狀態：Zustand 4
- 儲存：Dexie 4（IndexedDB，目前**未加密**）
- 解析：pdfjs-dist 4、mammoth 1（docx，lazy load）；搜尋：FlexSearch 0.7；圖表：Recharts 2；日期：date-fns 4
- 測試：Vitest 2（`environment: node`）+ fake-indexeddb；E2E：Playwright
- 套件管理：以 **npm + `package-lock.json`** 為準（CI 也用 npm）；repo 中的 `pnpm-lock.yaml`／`pnpm-workspace.yaml` 不是 canonical，其中 `allowBuilds` 是未填的佔位字串

## 4. 開發規則

1. **只用假資料**：測試、種子資料、截圖、demo 都只能使用明顯的假資料（例如「範例科技股份有限公司」「測試供應商有限公司」、`user@example.com`）。不得放入真實合約、真實公司或自然人資料、身分證字號、銀行帳號。
2. **不得提交憑證**：不得 commit API key、token、密碼、`.env`、服務帳號金鑰；M1 不需要任何 secret。若發現 repo 中疑似有憑證，停止工作並回報檔案路徑，不要複製其內容。
3. **測試不可為了通過而刪改斷言**：不得刪除、跳過（`.skip`／`.only`）或放寬既有斷言，讓失敗的測試變綠。行為確實改變時，要在 PR 說明原因，並由 Sean 確認。
4. **外部服務一律走 adapter + mock**：Email、團隊共用、儲存層都要透過介面接入；M1 只能實作 mock，不得發出真實網路請求。
5. **決定性**：規則引擎與提醒排程不得使用亂數或直接讀系統時鐘，日期要可注入。
6. **合約內容不出瀏覽器**：M1 不得把合約內容送到任何第三方服務（包含錯誤回報與分析工具）。
7. **併入時改寫，不整包複製**：從 `contract-reviewer` 搬入時，要改寫成本 repo 的型別、Dexie 儲存與 React 18 寫法，並附上對應的測試。
8. **不做未授權的 repo 操作**：agent 不得 push 到 `main`、合併 PR、`git push --force`、修改 repo 設定、啟用 Pages，也不得封存、刪除或改名任何 repo。

## 5. 驗證

指令與現況見 [`SOP.md`](./SOP.md)。提交前至少要跑 `npm run lint`、`npm test`、`npm run build`、`npm run e2e`，並記錄 exit code。

## 6. Commit 規則

格式為 `<type>(scope): <說明或 FR／AC 編號>`，例如 `feat(reminder): AC-006 mock email outbox`。
