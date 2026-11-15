# 合約到期與風險條款提醒｜Contract Tracker

> 中小企業的合約整理與到期提醒工具：上傳或貼上合約 → 規則比對標出可能需要注意的條款 → 設定到期日、負責人與提醒。
> **本工具不構成法律意見。** 目前為 M1 本機 MVP：資料只存在瀏覽器，不接任何外部服務。

規格與現況請看：[`PRD/SPEC.md`](./PRD/SPEC.md)、[`GOAL.md`](./GOAL.md)、[`STATUS.md`](./STATUS.md)、[`SOP.md`](./SOP.md)、[`AGENTS.md`](./AGENTS.md)。

## M1 功能

- 輸入：PDF／TXT／DOCX 上傳，或直接貼上合約內文（全部在瀏覽器內解析）
- 條款擷取 8 類＋規則比對（17 條規則，綠／黃／紅三級；同一份輸入結果固定）
- 契約類型自動偵測（可手動修改類別）
- 到期提醒：每份合約自訂提醒天數，另固定在到期前 7 天與當天提醒；信件寫入**模擬寄件匣**（不會真的寄出）
- 團隊（本機模擬）：成員清單、合約負責人、提醒收件人、「我負責的」篩選
- 5 階段審核流程（草擬建立 → 送審核中 → 法務覆核 → 主管核准 → 對方簽署）與註解
- 法條庫 100 條、範本庫 10 份、JSON 匯出／匯入

## M1 限制

- 沒有帳號、雲端同步、真實 Email、金流；團隊與寄件匣都是本機模擬。
- 資料以**明文**存在瀏覽器 IndexedDB；匯出的 JSON 也是明文，請妥善保存。
- 規則是關鍵字比對，可能漏判或誤判；法條對照未經律師覆核。
- 到期日不會從內文自動擷取，需自行填寫。
- 只能使用假資料測試；請勿在 repo、測試或截圖中放入真實合約。

## 開發

```bash
npm ci --legacy-peer-deps
npm run dev        # http://localhost:5173
npm run lint       # tsc 型別檢查
npm test           # vitest
npm run build      # tsc -b && vite build → dist/
npm run e2e        # build 後以 Playwright 跑本機 vite preview（第一次需 npx playwright install chromium）
```

M1 不部署；請勿自行啟用 GitHub Pages 或部署到 production。

## 資料來源

- 法條庫 `public/data/legal-db.json`：100 筆台灣法律條文摘要（版本日期見各筆資料），**未經律師覆核**。
- 範本庫 `public/data/templates.json`：10 種常見合約範本。

## 免責聲明（草案，待定稿）

本服務僅協助整理合約資訊與到期提醒。風險標記是依關鍵字規則自動比對產生，可能漏判或誤判，不構成法律意見，也不能取代律師審閱。簽約、續約或終止前，請自行判斷並諮詢專業律師。
