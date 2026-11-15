# AGENTS.md — 合約到期與風險條款提醒（contract-tracker）

## 1. 權威文件與範圍

- 產品規格：[`PRD/SPEC.md`](./PRD/SPEC.md)（v4.0 重建版）；目前里程碑：[`GOAL.md`](./GOAL.md)（M1）。
- 商業依據只有 Notion「可產品化商品」中的「合約到期與風險條款提醒」；README 與舊版文件如果和 SPEC 衝突，以 SPEC 和實際程式為準。
- `openclawsean024-create/contract-reviewer` 是併入來源，**只讀**。要搬的內容見 SPEC §12，不得在該 repo 上 commit、開 PR、封存或改設定。
- 本產品**不提供法律意見**。任何新的 UI 文案、提醒內容或文件都不得把規則比對稱為「AI 判斷」「法律意見」或「合規保證」。

## 2. 專案結構（實際狀態，2026-11-16）

```
index.html            # 目前是轉址到 dashboard.html 的 meta refresh（M1 AC-001 要修正）
dashboard.html        # 與產品無關的靜態 mockup（假 KPI），不是產品功能
public/data/
  legal-db.json       # 100 筆台灣法條摘要（未經律師覆核）
  templates.json      # 10 份合約範本
src/
  main.tsx, App.tsx   # HashRouter + 6 個路由
  store.ts            # Zustand
  types.ts            # Contract / ClauseRecord / RiskIssue / LegalArticle / Template
  lib/
    pdfParser.ts      # PDF.js 擷取 + 8 類條款擷取（有測試）
    legalDb.ts        # 風險規則引擎（有測試；法條對照目前用 Math.random）
    reminder.ts       # 到期清單 + 瀏覽器通知（部分有測試）
    storage.ts        # Dexie IndexedDB、JSON 匯出入
    search.ts         # FlexSearch 全文搜尋
  pages/              # Dashboard / Contracts / ContractDetail / LegalDb / Templates / Search
  test/setup.ts       # 註冊 fake-indexeddb
.github/workflows/ci.yml  # lint / test / build / deploy-to-pages
PRD/                  # SPEC.md、CHANGELOG.md
```

## 3. 技術棧

- React 18.3 + TypeScript（strict）+ Vite 5 + Tailwind CSS 3
- 路由：react-router-dom 6（HashRouter）；狀態：Zustand 4
- 儲存：Dexie 4（IndexedDB，目前**未加密**）
- 解析：pdfjs-dist 4；搜尋：FlexSearch 0.7；圖表：Recharts 2；日期：date-fns 4
- 測試：Vitest 2（`environment: node`）+ fake-indexeddb
- 套件管理：以 **npm + `package-lock.json`** 為準（CI 也用 npm）；repo 中的 `pnpm-lock.yaml`／`pnpm-workspace.yaml` 不是 canonical，其中 `allowBuilds` 是未填的佔位字串
- M1 將新增（尚未存在）：mammoth（docx）、Playwright（E2E）

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

指令與現況見 [`SOP.md`](./SOP.md)。提交前至少要跑 `npm run lint`、`npm test`、`npm run build`，並記錄 exit code。

## 6. Commit 規則

格式為 `<type>(scope): <說明或 FR／AC 編號>`，例如 `feat(reminder): AC-006 mock email outbox`。
