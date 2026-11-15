# Status — 合約到期與風險條款提醒（contract-tracker）

- 更新日期：2026-11-16
- 狀態：🟡 **文件重建完成，尚未開始 M1 開發**。本次只改寫 5 份文件（`PRD/SPEC.md`、`GOAL.md`、`AGENTS.md`、`SOP.md`、`STATUS.md`），沒有修改任何程式碼、設定或測試。
- 主 repo：`openclawsean024-create/contract-tracker`（`main` HEAD `1e016a7`）
- 併入來源：`openclawsean024-create/contract-reviewer`（`main` HEAD `ef08fd8`，只讀）

## Notion 商品資料庫對應

| 欄位（Notion「可產品化商品」） | 值 |
|---|---|
| 產品名稱 | 合約到期與風險條款提醒 |
| 優先順序 | P3 |
| 開發順位 | 第 10 個 |
| 主 repo | openclawsean024-create/contract-tracker |
| 要併入的 repo | openclawsean024-create/contract-reviewer |
| 獲利潛力／模式 | 中／SaaS 訂閱 |
| 目標客群 | 中小企業行政、法務與採購 |
| 現況完成度 | 50（Notion 值；依程式碼看，React app 目前無法從入口載入，見下方「主要阻斷」） |
| 上市前要補 | 合併兩個 repo、到期提醒寄送、團隊共用（三者都已寫進 M1 的 AC-002～AC-007，寄送與團隊共用以 mock 實作） |
| 主要風險 | 不得構成法律意見，需明確免責；條款判讀錯誤責任（見 SPEC §8、GOAL AC-008） |

## 主要阻斷

1. 根目錄的 `index.html` 在 commit `3d3ff3d` 被改成轉址到 `dashboard.html`（與產品無關的通用 mockup），React app 沒有被打包，瀏覽器裡看不到任何合約功能。
2. CI deploy job 失敗（repo 未啟用 Pages）；test 步驟會吞掉失敗，所以 CI 綠燈不代表測試真的通過。
3. 舊版 SPEC 把客群收斂為「裝潢／工程業主」，與 Notion 目標客群（中小企業行政、法務、採購）不一致；本次已改以 Notion 為準。

## FR 實作對照（詳見 SPEC §5）

| 狀態 | FR |
|---|---|
| 已實作（T，僅程式邏輯） | FR-002 PDF 擷取、FR-004 條款擷取、FR-008 基本資料編輯、FR-010 90 天到期清單、FR-016 風險儀表板、FR-017 法條庫、FR-018 範本庫、FR-019 全文搜尋、FR-020 JSON 匯出入 |
| 部分 | FR-005 規則引擎（T，只有 4 類、法條隨機）、FR-011 瀏覽器通知（T，忽略提醒天數）、FR-021 免責（T，只有頁尾一行）、FR-003 多格式輸入（R）、FR-006 擴充規則（R）、FR-007 類型偵測（R）、FR-014 工作流（R）、FR-015 狀態儀表板（R） |
| 未實作 | FR-001 可用入口（退化）、FR-009 到期日擷取、FR-012 提醒寄送、FR-013 團隊共用、FR-022 帳號與雲端、FR-023 金流、FR-024 本機加密 |

## Deterministic checks（2026-11-16，本機 Node v26.13.1，scratch clone）

| Repo | 指令 | Exit | 結果 |
|---|---|---:|---|
| contract-tracker | `npm ci --legacy-peer-deps --ignore-scripts` | 0 | — |
| contract-tracker | `npm run lint` | 0 | `tsc --noEmit` |
| contract-tracker | `npm test` | 0 | 33／33 通過 |
| contract-tracker | `npm run build` | 0 | 只產出 0.11 kB 轉址頁，沒有 app bundle |
| contract-reviewer/web | `npm test` | 0 | 8／8 通過（函式層測試，不是 UI E2E） |
| contract-reviewer/web | `npm run typecheck` | 0 | — |
| contract-reviewer/web | `npm run build` | 0 | 只產出轉址頁，沒有 app bundle |
| GitHub Actions（tracker） | run 34027979349 | failure | lint／test／build 成功，deploy 的 `Setup Pages` 失敗 |

## 風險與發現

- 個資／憑證：兩個 repo 中都沒有發現真實個資、真實合約或憑證。`legal-db.json` 是法條條文摘要；R 的 `GOAL.md` 只提到「已有 token」，沒有包含 token 值。
- README 與程式不一致之處共 13 項，見 SPEC §11（例如宣稱有加密但實際沒有、宣稱 15 種風險但實際 13 條、宣稱「AI」但實際是關鍵字比對）。
- 規則引擎用 `Math.random()` 選擇法條對照，輸出不可重現（M1 AC-004 修正）。
- `pnpm-workspace.yaml` 含有未填的佔位值；npm 與 pnpm 兩份 lockfile 並存。

## 待 Sean 決定／確認

1. 合約類別是否擴充（採購、授權、顧問、服務），以承接 R 的類型偵測。
2. 風險呈現保留綠／黃／紅三級，或加入 R 的 1–10 數值分數。
3. 定價（R 文件寫的 NT$990／NT$3,990 是未經驗證的假設）與付費分層。
4. 免責聲明最終文案，以及「非律師提供條款分析」是否有法規限制（需律師意見）。
5. M2 的 Email 服務商、雲端儲存方案與資料存放地區。
6. M1 驗收後是否封存 `contract-reviewer`。
7. 競品資訊與市場規模（目前全部標為待確認）。

## 下一步

Sean 覆審本 PR 的 SPEC 與 GOAL → 核准後依 `GOAL.md` 開始 M1 開發（建議順序：AC-001 → AC-004 → AC-002／003 → AC-005 → AC-006／007 → AC-008 → AC-009／010）。
