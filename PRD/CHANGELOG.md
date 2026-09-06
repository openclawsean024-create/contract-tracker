# contract-tracker · 變更日誌

> 自動生成：2026-09-06（fleet-upgrade）
> 對齊 SPEC v3.0 契約

---

## v3.0.2 — 2026-09-06（fleet-upgrade）

**升級者**：Sean 10-repo-fleet worker

### Changed

- **PRD/SPEC.md** — 從 v2.2.2（698 行 19 節，Sophia CPO 2026-07-19）升級至 v3.0.2（9 節 + 2 附錄），對齊 fleet SPEC v3.0 契約（§1-§19 全部套用）
- **.github/workflows/ci.yml** — 新增 4-job CI：lint / test / build / deploy-to-pages（取代原 Vercel 設定，統一 fleet 規格）
- **package.json** — 新增 `test` / `test:watch` scripts + `vitest@^2.1.9` + `fake-indexeddb@^6.2.5`
- **vitest.config.ts** — 新增（設定 test environment + setupFiles）
- **src/test/setup.ts** — 新增（fake-indexeddb 註冊）
- **src/lib/legalDb.test.ts** — 新增 14 個單元測試（風險評分引擎：confidentiality / penalty / ip / term / 聚合）
- **src/lib/pdfParser.test.ts** — 新增 11 個單元測試（條款擷取 + SHA-256）
- **src/lib/reminder.test.ts** — 新增 8 個單元測試（daysBetween + listExpiringContracts with fake-indexeddb）

### Notes

- 升級前：無單元測試、無 GHA CI、Vercel 部署設定
- 升級後：33 tests pass、tsc strict 綠、build 綠、4-job GHA CI ready、Pages 部署
- 既有 v2.2.2 PRD 完整內容保留在 git history（commit before v3.0.2 upgrade），本 SPEC.md 附錄 B 列出章節索引

### Risk

- 根目錄 `index.html` 仍是 meta refresh redirect → `dashboard.html`（靜態 demo 頁），React app 實際上是 `dashboard.html` 用 Tailwind CDN 還原。Vite build 不打包進 `dist/index.html`，因此 Pages 部署後使用者看到的是 `dashboard.html` 靜態 demo。如要部署真正的 React SPA，需修改 root `index.html` 為 Vite entry（含 `<div id="root">` + `main.tsx` script tag）。**此次升級不動 production code，僅升級 PRD + CI + 測試基礎建設。**
- 8 個 npm audit 漏洞（4 moderate + 4 high）— 多為 devDependencies 傳遞依賴，不影響 production；建議下個 sprint 升級 vite 6 / vitest 3。

---

## v2.2.2 — 2026-07-19（sweet-spot-driven rewrite）

**作者**：Sophia (CPO) for Sean

### Changed

- 從「通用 CLM」收斂為「**裝潢/工程承包業主的合約進度 + 風險條款**」
- 問題陳述從「合約散落」切到「**裝潢/工程承包業主被承包商拖延完工，求償無據**」
- 定位為「**裝潢糾紛存證 + 完工進度 + 風險條款三合一**」
- 明確不做企業 CLM、不做 AI 法條解釋、不做電子簽
- MVP 縮減為「裝潢合約上傳 + 進度照片時序 + 風險條款標記」3 個核心功能
- 新增 ADR-005：為何切到裝潢/工程而非通用 CLM
- 新增 §11：5 場裝潢業主訪談 + 1 個 Landing Page
- 新增 §15：完整 sweet spot 體檢

完整內容見 git history commit `bdfb972..v2.2.2`（PRD/SPEC.md 698 行）

---

## v1.0.0 — 2026-06（初始版本）

**作者**：Sean 開發

### Added

- React 18 + Vite + TypeScript 初始架構
- PDF.js 純前端解析（個資 100% 在裝置）
- 預載 100 條台灣常用法條（`public/data/legal-db.json`）
- 條款擷取（保密/違約/智財/期限 4 類）
- 風險評分引擎（綠/黃/紅）
- 到期提醒 30/60/90 天（Notification API）
- 10 種範本（服務/聘僱/租賃/NDA/買賣/承攬/供應商/外包/委任/和解）
- FlexSearch 全文搜尋（中文 tokenizer）
- 6 個路由頁面（Dashboard / Contracts / ContractDetail / LegalDb / Templates / Search）
- Tailwind CSS 3（@apply + JIT）
- Zustand 狀態管理
- Dexie / IndexedDB 本地儲存
- Recharts 風險儀表板
- Vercel 部署設定（`vercel.json`）
