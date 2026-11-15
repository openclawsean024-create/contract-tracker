# 合約到期與風險條款提醒 — 開發 SOP

## 環境

- 在 repo 根目錄執行（沒有 `web/` 子目錄）。
- Node：CI 使用 Node 20；2026-11-16 本機以 Node v26.13.1 驗證，下列指令皆可執行。
- 套件管理：npm（以 `package-lock.json` 為準）。

```bash
npm ci --legacy-peer-deps
```

## 驗證指令（依 `package.json` scripts 查證）

| 類型 | 指令 | 狀態 | 2026-11-16 實測結果 |
|---|---|---|---|
| 安裝 | `npm ci --legacy-peer-deps` | 可用 | exit 0 |
| Lint／型別檢查 | `npm run lint`（實際是 `tsc --noEmit`） | 可用 | exit 0 |
| 單元測試 | `npm test`（`vitest --run`） | 可用 | exit 0；3 個檔案、33 個測試通過（legalDb 14、pdfParser 11、reminder 8） |
| 單一測試檔 | `npx vitest run src/lib/<name>.test.ts` | 可用 | — |
| 監看測試 | `npm run test:watch` | 可用 | 未執行（互動式） |
| Build | `npm run build`（`tsc -b && vite build`） | 可用，但**產物無效** | exit 0；只轉換 1 個模組，`dist/index.html` 是轉址頁，pdfjs／react chunk 為空；`dist/` 中沒有 `dashboard.html`，所以轉址目標不存在 |
| 開發伺服器 | `npm run dev`（http://localhost:5173） | 可啟動，但**看不到產品** | 首頁會轉到靜態 mockup，React app 不會載入（原因見 SPEC §5 全域阻斷） |
| 預覽 | `npm run preview`（port 4173） | 可啟動，但 build 產物無效 | — |
| ESLint | — | **尚未配置** | 沒有 eslint 設定與 script |
| Format | — | **尚未配置** | 沒有 prettier 設定與 script |
| E2E | `npm run e2e` | **尚未配置**（M1 AC-009 新增） | 不得視為通過 |
| Integration | — | **尚未配置** | — |
| 部署 | GitHub Actions `deploy` job | **失敗中** | repo 未啟用 Pages，`Setup Pages` 步驟失敗（run 34027979349）；agent 不得自行啟用 |

## 提交前檢查

```bash
npm run lint
npm test
npm run build
git diff --check
```

M1 完成後再加上 `npm run e2e`，以及 `GOAL.md` 中每條 AC 列出的驗證指令。

## CI 注意事項

- `.github/workflows/ci.yml` 的 test 步驟是 `npm test -- --run 2>&1 || echo "no test script"`，**測試失敗也不會讓 CI 失敗**；lint 步驟設為 `continue-on-error: true`。所以 CI 綠燈目前不能當作品質證據（M1 AC-009 修正）。
- CI 的 build 步驟會成功，但產物裡沒有 app（見上表）。

## 開發流程

1. 讀 `AGENTS.md`、`GOAL.md` 與 `PRD/SPEC.md` 的對應 FR。
2. 從 `main` 開分支（`feat/...`、`fix/...`、`chore/...`）；不得直接 push 到 `main`。
3. 每個 AC 都要附上測試；外部服務只能用 mock adapter。
4. 跑完上面的提交前檢查，並把指令和 exit code 記錄到 `STATUS.md`。
5. 開 Draft PR，由 Sean 覆審。

## 故意不做（M1）

真實寄信、雲端團隊共用與登入、金流、真實合約、LLM、OCR、電子簽章、正式部署。詳見 `GOAL.md` 的 Out of scope。
