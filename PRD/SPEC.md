# 合約到期與風險條款提醒 · PRD（v4.0 重建版）

> 重建日期：2026-11-16（文件重建，未改任何程式碼）
> 商業依據：Notion 資料庫「可產品化商品」中的「合約到期與風險條款提醒」（唯一商業依據）
> 主 repo：`openclawsean024-create/contract-tracker`（`main`）
> 併入來源：`openclawsean024-create/contract-reviewer`（`main`，只讀）
> 現況以兩個 repo 的實際程式碼為準；README 或舊版 SPEC 與程式不一致之處，於 §11 列出。
> 舊版 v3.0.2 的「裝潢／工程業主」定位與 Notion 目標客群不一致，本版以 Notion 為準重寫，舊內容見 git history。

---

## 1. 問題

中小企業通常沒有專職法務，合約散落在共用資料夾、Email 附件與個人電腦裡，造成：

1. **到期與續約漏接**：自動續約、通知期限、租約和維護合約到期日沒有人追蹤，錯過就只能多續一年，或者服務突然中斷。
2. **風險條款看不出來**：行政、採購人員不一定能辨認違約金過高、單方變更、自動續約、排他、無限責任這類條款。
3. **團隊之間沒有共用狀態**：誰負責哪份合約、審到哪一關、提醒要寄給誰，都靠口頭或試算表。

本產品要做的是**整理與提醒**：記下到期日並主動提醒，用規則比對標出可能需要注意的條款，再交由使用者或專業律師判斷。**本產品不提供法律意見。**

## 2. 目標客群

| 客群 | 情境 | 主要任務 |
|---|---|---|
| Primary：中小企業行政／總務 | 管理租約、維護合約、供應商合約，負責續約提醒 | 建檔 → 設到期日 → 收提醒 → 指派負責人 |
| Primary：中小企業採購 | 與多家供應商簽約，需掌握到期與價格條款 | 上傳合約 → 看風險標記 → 送審 |
| Secondary：中小企業法務（一人法務或兼任） | 初審大量制式合約 | 依規則標記做初篩，決定哪些要細看或外送律師 |

排除對象：大型企業法務（需要完整 CLM、SSO、稽核，不在本產品範圍）、個人消費者。

## 3. 獲利模式

- Notion 標示：**SaaS 訂閱**，獲利潛力「中」。
- 既有 repo 文件（`contract-reviewer/README.md`）曾提出 Free／Solo Pro NT$990／Team NT$3,990 每月的定價。這是**內部假設，沒有市場驗證，待 Sean 確認**。
- 付費分層草案（待確認）：免費版（單人、本機、少量合約）→ 團隊版（雲端共用、Email 提醒、成員管理）。真實金流在 M3 之後才處理。

## 4. 競品與差異

| 類型 | 代表（名稱取自既有 repo 文件） | 差異假設 | 備註 |
|---|---|---|---|
| 企業 CLM | Ironclad、Evisort | 本產品針對中小企業，功能聚焦在到期提醒與條款初篩，導入成本低 | 價格、在地化程度**待確認** |
| AI 合約審閱 | Spellbook、Harvey AI、LawGrasp | 本產品不提供 AI 法律判斷，只做規則比對和提醒，降低誤導風險 | 功能與價格**待確認** |
| 台灣在地服務 | 「契約市集」 | 待研究 | 服務內容、價格**待確認** |
| 試算表／共用雲端硬碟 | Excel、Google Sheets | 本產品會主動提醒、解析條款、提供團隊狀態 | — |

市場規模、競品價格和使用者數目前都沒有可靠出處，一律標「待確認」，不在本文件中引用數字。

## 5. 功能需求

狀態定義：**已實作**＝程式碼存在且有測試或可追溯的程式路徑；**部分**＝有程式碼，但缺少關鍵行為、測試，或在瀏覽器中無法使用；**未實作**＝程式碼中不存在。
所在 repo：`T`＝contract-tracker（主 repo），`R`＝contract-reviewer（併入來源）。

> **全域阻斷**：主 repo 根目錄的 `index.html` 已被改成 meta refresh，導向 `dashboard.html`（與合約無關的通用 mockup，內含「本月營收」等假 KPI）。因此 `npm run build` 只會產出一個 0.11 kB 的轉址頁，React 應用程式**沒有被打包，也無法在瀏覽器中使用**。下表的「已實作」僅指程式邏輯，在 FR-001 修好之前，使用者實際上都用不到。`R` 的 `web/index.html` 也有相同問題。

| FR | 名稱 | 優先 | 狀態 | 所在 | 實際程式依據／缺口 |
|---|---|---|---|---|---|
| FR-001 | 應用程式入口可載入 React SPA 並可部署 | P0 | 未實作（退化） | T | `index.html` 轉址到 `dashboard.html`；`dist/` 中沒有 React bundle；GitHub Pages 未啟用，CI deploy job 失敗 |
| FR-002 | PDF 純前端文字擷取（加密 PDF、200 頁上限、無文字偵測） | P0 | 已實作 | T（R 亦有，但未設 workerSrc） | `src/lib/pdfParser.ts` `extractPdfText` |
| FR-003 | .txt／.docx 上傳與「貼上合約內文」輸入 | P0 | 部分 | R | `web/src/lib/parser.ts`（mammoth）、`UploadPage`／`DraftPage` 文字框；T 只接受 PDF；docx 沒有測試 |
| FR-004 | 條款擷取 8 類（保密／違約／智財／期限／付款／保固／責任／終止） | P0 | 已實作 | T | `extractClauses`，關鍵字比對，每頁每類只取第一個命中 |
| FR-005 | 風險規則引擎：綠／黃／紅 + 修正建議 + 法條對照 | P0 | 部分 | T | `src/lib/legalDb.ts` 只有 4 類規則；法條是用 `Math.random()` 從候選中**隨機挑選**，同一份合約兩次結果可能不同 |
| FR-006 | 擴充風險規則（單方變更、排他、無限責任、提前終止、競業、權益轉讓、懲罰性違約金、管轄／仲裁、不可抗力等） | P0 | 部分 | R | `web/src/lib/db.ts` `generateRisks` 有 13 條關鍵字規則；README 寫「15 種」與程式不符；UI 把它稱為「AI」，但實際是關鍵字比對 |
| FR-007 | 契約類型自動偵測 | P1 | 部分 | R | `detectContractType` 已實作並有 6 個測試；T 上傳後類別一律為 `other` |
| FR-008 | 合約基本資料編輯（標題、對方、類別、到期日、提醒天數） | P0 | 已實作 | T | `ContractDetail.tsx`；上傳時到期日**預設為今天 + 365 天**，不會從內文擷取 |
| FR-009 | 到期日從合約內文擷取（需人工確認） | P1 | 未實作 | — | — |
| FR-010 | 儀表板列出 90 天內到期合約，依剩餘天數排序 | P0 | 已實作 | T | `listExpiringContracts` + `Dashboard.tsx`，有 4 個測試 |
| FR-011 | 瀏覽器本機通知 | P1 | 部分 | T | `checkAndNotify` 固定在 7／30／60／90 天觸發，**忽略使用者設定的 `reminderDaysBefore`**；沒有去重；沒有測試 |
| FR-012 | 到期提醒寄送（Email） | P0 | 未實作 | — | Notion「上市前要補」。M1 只做 mock 寄件匣，真實寄送在 M2 |
| FR-013 | 團隊共用（成員、合約負責人、提醒收件人、共用狀態） | P0 | 未實作 | — | Notion「上市前要補」。M1 只做本機 mock，雲端共用在 M2 |
| FR-014 | 5 階段審核工作流（草擬→送審→法務覆核→主管核准→對方簽署）+ 註解 | P1 | 部分 | R | `ContractDetailPage.tsx`；單人使用，沒有角色權限；註解會被**附加到合約內文**，污染原文 |
| FR-015 | 依工作流狀態分組的待辦儀表板（待辦／待覆核／已簽署） | P2 | 部分 | R | `DashboardPage.tsx` 只依狀態分桶，沒有「我起草的／我覆核的」；問候語寫死假名 |
| FR-016 | 風險儀表板（風險分布圓餅圖、類別分布） | P1 | 已實作 | T | `Dashboard.tsx`（Recharts） |
| FR-017 | 法條庫 100 條瀏覽、分類、搜尋 | P1 | 已實作 | T | `public/data/legal-db.json`（100 筆，版本 2026-07-11）；內容正確性**未經律師覆核** |
| FR-018 | 合約範本庫 10 種（下載、編輯後另存） | P2 | 已實作 | T | `public/data/templates.json`；R 另有 10 個簡短 stub（不搬） |
| FR-019 | 全文搜尋（標題／對方／內文，中文 bigram） | P1 | 已實作 | T | `src/lib/search.ts`（FlexSearch）；沒有測試 |
| FR-020 | JSON 匯出／匯入備份 | P1 | 已實作 | T | `storage.ts` `exportAll`／`importAll`；匯出檔為明文，沒有測試 |
| FR-021 | 免責聲明（全站、上傳處、風險結果旁、提醒內容、首次使用確認） | P0 | 部分 | T | 目前只有頁尾一行「風險評分僅供參考，非法律建議」，以及範本頁一行；R 完全沒有 |
| FR-022 | 帳號登入、雲端加密儲存與同步 | P1 | 未實作 | — | M2 |
| FR-023 | 訂閱方案與金流 | P1 | 未實作 | — | M3 |
| FR-024 | 本機資料加密（IndexedDB） | P2 | 未實作 | — | README 寫「加密層」，但程式是明文 Dexie |

## 6. 非功能需求

| 面向 | 需求 |
|---|---|
| 隱私 | M1 期間，合約內容只存在使用者瀏覽器（IndexedDB），不得送往任何第三方 API；分析流程不得發出網路請求（靜態 `data/*.json` 除外） |
| 可重現性 | 同一份輸入分析兩次，風險結果與法條對照必須相同（不得使用亂數） |
| 效能 | 目標值待 M1 量測後訂定；舊版 SPEC 的「≤ 2 秒」等數字沒有量測依據，視為待確認 |
| 相容性 | 主流桌面瀏覽器最新版；RWD 支援手機寬度 |
| 語系 | 繁體中文 UI；合約內容可中英夾雜 |
| 可測試性 | 規則引擎、提醒排程、寄送 adapter、團隊指派都必須是純函式或可注入時鐘／adapter，方便單元測試 |
| 可替換性 | Email 寄送、團隊共用、儲存層各自透過介面（adapter）接入；M1 使用 mock 實作，M2 才換成真實服務 |
| 文案 | 規則比對結果不得稱為「AI 判斷」「法律意見」「合規保證」 |

## 7. 資料與個資處理

合約內容屬於**使用者的機密資料**，常含有對方公司與自然人的姓名、地址、身分證字號、銀行帳號、價格等資訊。

- **現況**：合約存在 IndexedDB（`contract-tracker-db`），**未加密**；`extractedText` 截斷保留前 8,000 字元；JSON 匯出為明文檔案。R 存在 localStorage（未加密）。
- **M1 規則**：
  - repo 與測試只能使用明顯的假資料（例如「範例科技股份有限公司」「測試供應商有限公司」、`@example.com`），不得放入真實合約或真實個資。
  - mock 寄件匣與團隊成員只能使用 `example.com`／`example.test` 網域。
  - 不加任何追蹤或分析 SDK。
  - UI 須提示「匯出的 JSON 為明文，請妥善保存」。
- **M2 前必須完成（待確認，需專業意見）**：雲端儲存的加密方式（傳輸中與靜態）、資料存放地區、保存與刪除政策、使用者刪除帳號後的資料處理、存取稽核紀錄、與 Email 服務商之間的資料處理約定、個人資料保護法適用的告知與同意流程。

## 8. 法規與風險

| 風險 | 說明 | 對策 |
|---|---|---|
| 構成法律意見 | 風險標記與修正建議可能被使用者當成法律意見 | 全站固定免責聲明；首次使用需勾選知悉；文案只用「可能需要注意」「建議諮詢律師」；不稱為 AI 判斷 |
| 條款判讀錯誤責任 | 關鍵字規則會有誤判（漏報、誤報），使用者可能因此受損 | 結果旁標示「規則比對，可能漏判或誤判」；服務條款中的責任限制須由律師撰寫（待確認）；規則與法條對照須經法律專業覆核後才能上市（M2） |
| 非律師提供法律服務的法規限制 | 提供條款分析是否涉及律師法等規範 | **待確認**：須由律師評估產品定位與文案 |
| 法條資料過期或錯誤 | `legal-db.json` 的版本日期固定，法規修正後可能過時 | 每筆法條顯示來源與版本日期；建立更新流程（M2） |
| 提醒漏寄 | Email 寄送失敗導致錯過到期日 | 寄送紀錄與失敗重試；儀表板作為備援提醒；條款載明提醒僅為輔助（待確認） |
| 個資外洩 | 合約含有機密與個資 | 見 §7；M1 不上雲 |

**免責聲明文案（草案，最終版待律師確認）**：
> 本服務僅協助整理合約資訊與到期提醒。風險標記是依關鍵字規則自動比對產生，可能漏判或誤判，不構成法律意見，也不能取代律師審閱。簽約、續約或終止前，請自行判斷並諮詢專業律師。

## 9. 里程碑

| 里程碑 | 目標 | 內容 | 外部服務 |
|---|---|---|---|
| **M1**（見 `GOAL.md`） | 單一 repo、可在瀏覽器實際操作的本機 MVP | 修好入口（FR-001）；併入 R 的多格式輸入、類型偵測、擴充規則、工作流（FR-003／006／007／014／015）；法條對照改為決定性（FR-005）；提醒天數生效 + mock Email 寄件匣（FR-011／012）；本機 mock 團隊共用（FR-013）；免責聲明（FR-021）；E2E 與 CI 閘門 | 全部使用 mock，不接任何外部服務 |
| **M2** | 可給小規模試用團隊使用 | 帳號與雲端加密儲存（FR-022）；真實 Email 寄送（先用服務商的測試模式，再小量正式寄送）；雲端團隊共用與角色權限；到期日擷取（FR-009）；規則與法條經法律專業覆核；資料保存與刪除政策 | 需 Sean 核准服務商與費用 |
| **M3** | 上市 | 訂閱與金流（FR-023）；服務條款、隱私權政策、免責條款定稿（律師）；試用轉付費流程；營運指標 | 需 Sean 核准金流商 |

## 10. 成功指標

| 階段 | 指標 | 目標值 |
|---|---|---|
| M1 | `GOAL.md` 中的 AC 全數通過；`npm run lint`／`npm test`／`npm run build`／`npm run e2e` 全部 exit 0 | 100% |
| M1 | 同一份測試合約重跑分析，結果一致 | 100% |
| M2 | 試用團隊在試用期內至少建檔一份合約並設定提醒的比例 | 待確認 |
| M2 | 提醒在預定日期送達的比例（以寄送紀錄計） | 待確認 |
| M2 | 使用者回報的規則誤判率 | 待確認（需先定義量測方式） |
| M3 | 付費團隊數、MRR | 待確認（舊版 R 文件寫「6 個月 30 家、NT$60,000 MRR」，屬於未經驗證的內部目標） |

## 11. README／舊文件與程式不一致之處

| 文件說法 | 程式實際 |
|---|---|
| T README：「Dexie/IndexedDB — 合約資料加密層」 | Dexie 明文儲存，沒有加密 |
| T README：開發時可用 `npm run dev` 操作功能 | `index.html` 轉址到靜態 mockup，React app 不會載入 |
| T README：部署用 `vercel deploy`；舊 SPEC：部署到 GitHub Pages | CI deploy job 因 repo 未啟用 Pages 而失敗（run 34027979349）；`dist/` 也沒有 app |
| T README：規格書在 `./SPEC.md` | 實際位置是 `PRD/SPEC.md` |
| T README／App 側欄：「到期提醒 30/60/90 天」 | 程式固定在 7／30／60／90 天觸發，忽略 `reminderDaysBefore` |
| 舊 SPEC：「PWA-ready：service worker」「IndexedDB 不可用 → 記憶體模式」「PDF 失敗 → 請貼 text」 | 都沒有實作 |
| 舊 SPEC：「上傳 .txt／.docx」（S2、S3） | T 只接受 PDF |
| T CI：test 步驟 | `npm test -- --run 2>&1 \|\| echo "no test script"` 會吞掉失敗；lint 設為 `continue-on-error` |
| R README：「15 種條款級風險」「AI 解釋」 | 13 條關鍵字規則 + 1 條預設；解釋是寫死的字串 |
| R README：「一鍵插入範本」 | 只有「複製到剪貼簿」；`/draft` 頁面不在導覽列中 |
| R README／GOAL：「5 個 E2E」 | `tests/e2e.test.tsx` 實際是 8 個函式層單元測試，沒有 UI 測試 |
| R `parser.ts`：真實 PDF 解析 | 沒有設定 `GlobalWorkerOptions.workerSrc`，在瀏覽器中可能失敗（未實測） |
| R README：Team 方案含 SSO／Audit log／API | 都沒有實作 |

## 12. 合併清單（contract-reviewer → contract-tracker）

**原則**：主 repo 維持 React 18 + Vite 5 + Tailwind 3 + Zustand + Dexie。R 的程式碼要改寫成 T 的型別與儲存層，不直接複製整個檔案。主 repo 已有的功能不重複搬。

### 12.1 要搬

| # | R 來源 | 搬到 T 後的形式 | 對應 FR |
|---|---|---|---|
| M-01 | `web/src/lib/parser.ts` 的 `.txt`／`.md`／`.docx`（mammoth）解析 | 新增 `src/lib/textExtract.ts`；PDF 仍沿用 T 的 `extractPdfText` | FR-003 |
| M-02 | `UploadPage.tsx`／`DraftPage.tsx` 的「貼上合約內文」文字框 | 合併到 T 的 `Contracts.tsx` 上傳區，與檔案上傳共用分析流程 | FR-003 |
| M-03 | `db.ts` `detectContractType` + 6 個測試 | 移入 T，偵測結果對應到 `ContractCategory`（T 的類別是否擴充「採購／授權／顧問／服務」，**待 Sean 決定**） | FR-007 |
| M-04 | `db.ts` `generateRisks` 的 13 條規則 | 改寫成 T 的 `RISK_RULES` 格式（每條含 `suggestion`，法條對照固定）；r8 管轄／仲裁、r9 不可抗力屬於「已約定」，改為資訊提示，不計入風險 | FR-005、FR-006 |
| M-05 | `RiskItem.category` 風險分類維度（有效性／權利義務／金流／爭端解決／競爭／損害賠償／就業） | `RiskIssue` 新增 `category` 欄位 | FR-006 |
| M-06 | `ContractDetailPage.tsx` 的 5 階段工作流 + 註解 | `Contract` 新增 `workflowStatus` 與獨立的 `notes[]`（不再附加到內文）；Dexie schema 升到 v2，並保留 v1 資料 | FR-014 |
| M-07 | `DashboardPage.tsx` 依狀態分組的卡片 | 加到 T 的 `Dashboard.tsx`，並結合 M1 團隊負責人篩選（「我負責的」） | FR-015 |
| M-08 | `tests/e2e.test.tsx` 的測試情境與假資料字串 | 轉成 T 的 vitest 測試 | — |

### 12.2 不搬

| R 項目 | 原因 |
|---|---|
| `web/src/lib/parser.ts` 的 PDF 解析 | T 版本較完整（有 worker 設定、加密與頁數檢查、無文字偵測），R 版本沒有設定 workerSrc |
| `web/src/lib/db.ts` 的 localStorage 儲存層、`createContract` 的 ID 產生方式 | T 使用 Dexie／IndexedDB，容量較大；R 的 `'CT' + Date.now() % 100000` 可能產生重複 ID |
| `web/src/lib/createStore.ts` | T 已使用 Zustand |
| R 的 10 個範本 stub | T 的 `templates.json` 已有 10 份完整範本；R 獨有的「顧問／軟體授權／競業／MOU」類別是否補成完整範本，列為 M2 待確認 |
| 1–10 數值風險分數 | 與 T 的綠／黃／紅三級衝突；**待 Sean 決定**是否保留數值分數 |
| 「AI 摘要」「AI 解釋」文案 | 實際是規則比對，稱為 AI 會造成誤導，也有法律意見風險 |
| `web/public/dashboard.html`、`web/index.html` | 與產品無關的靜態 mockup，以及損壞的入口 |
| `Layout.tsx`、`BrowserRouter`、`base: '/contract-reviewer/'`、React 19／Tailwind v4／Vite 6 | T 有自己的版面與 HashRouter；不在 M1 升級框架版本 |
| `GOAL.md`、`SPRINT*`、`PRD/`、CI workflow、`gh-pages` 部署 script | 屬於 R 的流程文件或設定，必要資訊已吸收進本 SPEC |
| 定價表 | 不是程式；以假設形式記錄在 §3，待確認 |

### 12.3 合併後處理（需 Sean 決定，agent 不執行）

- M1 驗收通過後，再決定 `contract-reviewer` 是否封存。agent 不封存、不刪除、不改名任何 repo。
