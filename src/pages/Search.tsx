import { useState } from "react";
import { Link } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import { useAppStore } from "../store";
import { searchContracts } from "../lib/search";
import { RiskBadge } from "./Dashboard";

export default function SearchPage() {
  const contracts = useAppStore((s) => s.contracts);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<
    Array<{
      contract: typeof contracts[number];
      snippet: string;
      field: string;
    }>
  >([]);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearched(true);
    const matches = await searchContracts(q);
    const matchedIds = new Set(matches.map((m) => m.id));
    const found = contracts
      .filter((c) => matchedIds.has(c.id))
      .map((c) => {
        const m = matches.find((x) => x.id === c.id)!;
        const text = c.extractedText || "";
        const idx = text.indexOf(q);
        const snippet =
          idx >= 0
            ? text.slice(Math.max(0, idx - 60), idx + q.length + 80)
            : c.title;
        return { contract: c, snippet, field: m.field };
      });
    setResults(found);
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">全文搜尋</h1>
        <p className="text-sm text-slate-600 mt-1">
          以 FlexSearch + 中文 tokenizer 搜尋合約（F-007）
        </p>
      </header>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon
              size={18}
              className="absolute top-2.5 left-3 text-slate-400"
            />
            <input
              type="search"
              placeholder="輸入關鍵字，如「個人資料」、「保密」、「違約金」"
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSearch();
              }}
            />
          </div>
          <button
            onClick={() => void handleSearch()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            搜尋
          </button>
        </div>
      </div>

      {searched && (
        <div className="space-y-3">
          <div className="text-sm text-slate-600">
            找到 {results.length} 份合約
          </div>
          {results.length === 0 && (
            <div className="text-sm text-slate-500 bg-white rounded-xl border border-slate-200 p-6 text-center">
              無符合「{q}」的合約，請嘗試其他關鍵字
            </div>
          )}
          {results.map(({ contract, snippet, field }) => (
            <article
              key={contract.id}
              className="bg-white rounded-xl border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <RiskBadge level={contract.riskScore} />
                <Link
                  to={`/contracts/${contract.id}`}
                  className="text-blue-700 hover:underline font-semibold"
                >
                  {contract.title}
                </Link>
                <span className="text-xs text-slate-500">
                  對方：{contract.counterparty}
                </span>
                <span className="text-xs text-slate-400">
                  命中欄位：{field}
                </span>
              </div>
              <div className="text-sm text-slate-700">
                …{snippet.length > 200 ? snippet.slice(0, 200) + "…" : snippet}
              </div>
            </article>
          ))}
        </div>
      )}

      {!searched && (
        <div className="text-sm text-slate-500 bg-white rounded-xl border border-slate-200 p-6 text-center">
          {contracts.length === 0
            ? "請先上傳合約後再搜尋"
            : "請輸入關鍵字開始搜尋"}
        </div>
      )}
    </div>
  );
}
