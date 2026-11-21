# 合約到期與風險條款提醒 — 開發 SOP

## 環境

- 在 repo 根目錄執行（沒有 `web/` 子目錄）。
- Node：CI 使用 Node 20；2026-11-16 本機以 Node v26.13.1 驗證，下列指令皆可執行。
- 套件管理：npm（以 `package-lock.json` 為準）。

```bash
npm ci --legacy-peer-deps
npx playwright install chromium   # 第一次跑 E2E 前需要（CI 用 --with-deps）
```

## 驗證指令（依 `package.json` scripts 查證）

| 類型 | 指令 | 狀態 | 2026-11-16 實測結果（feat/m1） |
|---|---|---|---|
| 安裝 | `npm ci --legacy-peer-deps` | 可用 | exit 0 |
| Lint／型別檢查 | `npm run lint`（`tsc --noEmit && tsc --noEmit -p tsconfig.e2e.json`） | 可用 | exit 0 |
| Typecheck | `npm run typecheck`（與 lint 相同） | 可用 | exit 0 |
| 單元測試 | `npm test`（`vitest --run`，只收 `src/**/*.test.ts(x)`） | 可用 | exit 0；18 個檔案、265 個測試通過 |
| 單一測試檔 | `npx vitest run src/lib/<name>.test.ts` | 可用 | — |
| 監看測試 | `npm run test:watch` | 可用 | 未執行（互動式） |
| Build | `npm run build`（`tsc -b && vite build`） | 可用 | exit 0；`dist/index.html` 含 `#root`，`dist/assets/` 有 React app bundle |
| 開發伺服器 | `npm run dev`（http://localhost:5173） | 可用 | 首頁直接載入 React app |
| 預覽 | `npm run preview`（port 4173） | 可用 | 提供 build 產物 |
| E2E | `npm run e2e`（先 build，再以 Playwright 跑在本機 `vite preview` 127.0.0.1:4173） | 可用 | exit 0；17 個測試通過 |
| ESLint | — | **尚未配置** | 沒有 eslint 設定與 script（`lint` 實際是 tsc） |
| Format | — | **尚未配置** | 沒有 prettier 設定與 script |
| Integration | — | **尚未配置** | — |
| 部署 | GitHub Actions `deploy` job | **只限手動** | 只有在 `main` 上手動 `workflow_dispatch` 才會執行；push 不會部署。repo 未啟用 Pages；agent 不得自行啟用或部署 |

## 提交前檢查

```bash
npm run lint
npm test
npm run build
npm run e2e
git diff --check
```

另外跑 `GOAL.md` 中每條 AC 列出的驗證指令，並把指令與 exit code 記錄到 `STATUS.md`。

## CI

`.github/workflows/ci.yml`：`lint`、`test` → `build`（驗證 `dist` 內有 React app）與 `e2e`（Playwright）→ `deploy`（僅限手動 `workflow_dispatch`）。
任何一步失敗都會讓 CI 失敗：沒有 `|| echo`、沒有 `continue-on-error`，安裝使用嚴格的 `npm ci`。

## 測試慣例

- 單元測試放在 `src/**/*.test.ts`，E2E 放在 `tests/e2e/*.spec.ts`，假資料放在 `tests/fixtures/`。
- 測試名稱以對應的 AC 編號開頭（例如 `AC-006 自訂天數命中…`）。
- 只能用明顯的假資料；Email 只能用 `example.com`／`example.test`。
- 日期一律注入（單元測試傳入固定的 `Date`；E2E 用 `page.clock.setFixedTime`），不依賴執行當天的日期。
- 所有 E2E 透過 `tests/e2e/fixtures.ts` 攔截網路請求：只允許對本機 app 靜態資源的 GET，其他請求（含同源 POST）即失敗。

## 開發流程

1. 讀 `AGENTS.md`、`GOAL.md` 與 `PRD/SPEC.md` 的對應 FR。
2. 從 `main` 開分支（`feat/...`、`fix/...`、`chore/...`）；不得直接 push 到 `main`。
3. 每個 AC 都要附上測試；外部服務只能用 mock adapter。
4. 跑完上面的提交前檢查，並把指令和 exit code 記錄到 `STATUS.md`。
5. 開 Draft PR，由 Sean 覆審。

## 故意不做（M1）

真實寄信、雲端團隊共用與登入、金流、真實合約、LLM、OCR、電子簽章、正式部署。詳見 `GOAL.md` 的 Out of scope。
