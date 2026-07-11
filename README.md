# 合約狀況 + 審核法條｜Contract Tracker

> **上傳合約 PDF，自動標出潛在風險條款 + 到期前 30/60/90 天提醒** — 預載 100 條台灣常用法條摘要 + 風險評分引擎 + 月底到期儀表板，零月費零上傳雲端。

## 技術棧

依據 SPEC §7 ADR：
- **React 18 + Vite** — 純前端 SPA
- **PDF.js** — 純前端 PDF 解析（個資 100% 在裝置）
- **FlexSearch** — 全文搜尋 + 中文 tokenizer
- **Dexie/IndexedDB** — 合約資料加密層
- **Zustand** — 輕量狀態管理
- **Recharts** — 風險儀表板圖表
- **Tailwind CSS 3** — RWD 三斷點 (375 / 768 / 1440)
- **TypeScript** — strict mode

## 功能（F-001 ~ F-008）

| ID | 功能 | 對應 SPEC AC |
|---|---|---|
| F-001 | PDF.js 純前端解析 + 文字擷取 | AC-001 / AC-010 |
| F-002 | 預載 100 條台灣常用法條 | AC-002 |
| F-003 | 4+ 類條款擷取（保密/違約/智財/期限/付款/保固/責任/終止） | AC-003 |
| F-004 | 風險評分引擎（綠/黃/紅） + 修正建議 | AC-004 |
| F-005 | 到期提醒 30/60/90 天（瀏覽器 Notification API） | AC-005 |
| F-006 | 10 種範本（服務/聘僱/租賃/NDA/買賣/承攬/供應商/外包/委任/和解） | F-006 |
| F-007 | FlexSearch 全文搜尋 + 中文 tokenizer | AC-006 |
| F-008 | 條款高亮（黃底/紅底）+ 風險儀表板（Recharts） | AC-008 |

額外：
- F-009 JSON 匯出 / 匯入（AC-009）
- F-010 合約分類 6 種 + RWD 三斷點

## 開發

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build → dist/
npm run preview  # 啟動靜態伺服器
```

## 部署

```bash
vercel deploy --prod
```

vercel.json 已配置 SPA rewrite：`/(.*) → /index.html`

## 資料來源

- **法條庫** `public/data/legal-db.json`：100 條真實台灣法律條文摘要，來源為全國法規資料庫（law.moj.gov.tw），含民法 / 勞動基準法 / 消費者保護法 / 個人資料保護法 / 著作權法 / 營業秘密法 / 刑法 / 公司法 / 票據法 / 電子簽章法 / 公平交易法 / 食品安全衛生管理法 / 通訊保障及監察法 等
- **範本庫** `public/data/templates.json`：10 種常見合約範本

## 免責聲明

本平台「風險評分」僅為**資訊整理**用途，**非法律諮詢**或律師意見。簽約前建議諮詢專業律師（律師法 §1）。

## 規格書

完整 SPEC 請見 [SPEC.md](./SPEC.md)（v2.2.1）。
