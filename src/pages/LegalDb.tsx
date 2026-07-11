import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useAppStore } from "../store";

const CATEGORIES = [
  { key: "all", label: "全部" },
  { key: "civil_law", label: "民法" },
  { key: "labor_standard", label: "勞動基準法" },
  { key: "consumer_protection", label: "消費者保護法" },
  { key: "privacy", label: "個人資料保護法" },
  { key: "copyright", label: "著作權法" },
  { key: "trade_secret", label: "營業秘密法" },
  { key: "criminal", label: "刑法" },
  { key: "company", label: "公司法" },
  { key: "commercial", label: "商業法規" },
];

export default function LegalDbPage() {
  const legalDb = useAppStore((s) => s.legalDb);
  const bootstrap = useAppStore((s) => s.bootstrap);

  const [keyword, setKeyword] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!legalDb) void bootstrap();
  }, [legalDb, bootstrap]);

  const filtered = useMemo(() => {
    if (!legalDb) return [];
    return legalDb.articles.filter((a) => {
      if (activeCat !== "all" && a.category !== activeCat) return false;
      if (!keyword.trim()) return true;
      const q = keyword.toLowerCase();
      return (
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.fullText.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.riskKeywords.some((k) => k.includes(q))
      );
    });
  }, [legalDb, activeCat, keyword]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">台灣常用法條庫</h1>
        <p className="text-sm text-slate-600 mt-1">
          共 {legalDb?.count ?? 100} 條 — 預載民法／勞動基準法／消費者保護法／個人資料保護法／著作權法／營業秘密法 等
        </p>
        <p className="text-xs text-slate-500 mt-1">
          資料來源：全國法規資料庫 law.moj.gov.tw · 版本日期 {legalDb?.version}{" "}
          (F-002)
        </p>
      </header>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="relative mb-3">
          <Search
            size={18}
            className="absolute top-2.5 left-3 text-slate-400"
          />
          <input
            type="search"
            placeholder="搜尋法條關鍵字（如：保密、違約金、個人資料、著作權）"
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setActiveCat(c.key)}
              className={`text-xs px-3 py-1.5 rounded-full transition ${
                activeCat === c.key
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-slate-500">
        顯示 {filtered.length} / {legalDb?.count ?? 100} 條
      </div>

      <div className="space-y-2">
        {filtered.map((a) => (
          <article
            key={a.id}
            className="bg-white rounded-xl border border-slate-200 p-4"
          >
            <button
              type="button"
              onClick={() => setOpenId((cur) => (cur === a.id ? null : a.id))}
              className="w-full text-left"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {a.id}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                  {a.categoryLabel}
                </span>
                <span className="font-semibold">{a.title}</span>
              </div>
              <p className="text-sm text-slate-700 mt-2">{a.summary}</p>
              {a.riskKeywords?.length > 0 && (
                <div className="text-xs text-slate-500 mt-2 flex flex-wrap gap-1.5">
                  風險觸發詞：
                  {a.riskKeywords.map((k) => (
                    <span
                      key={k}
                      className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              )}
            </button>
            {openId === a.id && (
              <div className="mt-3 border-t border-slate-100 pt-3 text-sm">
                <div className="text-xs text-slate-500 mb-1">全文</div>
                <div className="leading-relaxed">{a.fullText}</div>
                <div className="text-xs text-slate-400 mt-2">
                  來源：{a.source} · 版本日期 {a.versionDate}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
