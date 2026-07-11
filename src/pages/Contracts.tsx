import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { v4 as uuid } from "uuid";
import { Upload, Trash2, Download, FileText } from "lucide-react";
import {
  extractPdfText,
  extractClauses,
  sha256Hex,
} from "../lib/pdfParser";
import { evaluateRisk } from "../lib/legalDb";
import { saveContract, deleteContract, exportAll, importAll } from "../lib/storage";
import { useAppStore } from "../store";
import { invalidateIndex, ensureIndex } from "../lib/search";
import { RiskBadge } from "./Dashboard";
import type { Contract, ContractCategory, RiskLevel } from "../types";
import { CATEGORY_LABELS } from "../types";

export default function ContractsPage() {
  const contracts = useAppStore((s) => s.contracts);
  const legalDb = useAppStore((s) => s.legalDb);
  const refresh = useAppStore((s) => s.refreshContracts);

  const [filter, setFilter] = useState<ContractCategory | "all">("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered =
    filter === "all"
      ? contracts
      : contracts.filter((c) => c.category === filter);

  async function handleUpload(file: File) {
    if (!legalDb) {
      setError("法條庫尚未預載完成，請稍候");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus("📄 讀取 PDF…");
    try {
      const result = await extractPdfText(file);
      if (result.hasNoText) {
        setError("此 PDF 為圖片型或無可擷取文字，請改用 OCR 工具轉文字後再上傳。");
        return;
      }
      setStatus("🔍 擷取條款中…");
      const clauses = extractClauses(result.pages);
      setStatus("⚖️  風險評分計算中…");
      const evalRes = evaluateRisk(uuid(), clauses, legalDb.articles);
      const updated = clauses.map((c) => {
        const upd = evalRes.clauseUpdates.get(c.id);
        return upd ? { ...c, ...upd } : c;
      });

      const buffer = await file.arrayBuffer();
      const hash = await sha256Hex(buffer);

      const contract: Contract = {
        id: uuid(),
        title: file.name.replace(/\.pdf$/i, ""),
        category: "other",
        counterparty: "未設定",
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
        pdfHash: hash.slice(0, 16),
        extractedText: result.fullText.slice(0, 8000),
        riskScore: evalRes.score as RiskLevel,
        riskAnalysis: evalRes.issues,
        reminderDaysBefore: 30,
        isActive: true,
        clauses: updated,
        createdAt: new Date().toISOString(),
      };
      await saveContract(contract);
      invalidateIndex();
      await ensureIndex();
      await refresh();
      setStatus(`✅ 已新增合約，${updated.length} 條款 + ${evalRes.issues.length} 項風險`);
    } catch (err: any) {
      if (err?.message === "PDF_001") setError("PDF 已加密，請先解密後再上傳。");
      else setError(`解析失敗：${err.message || err}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    const blob = await exportAll();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contract-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const count = await importAll(text);
      await refresh();
      setStatus(`✅ 已匯入 ${count} 份合約`);
    } catch (err: any) {
      setError(`匯入失敗：${err.message || err}`);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("確認刪除此合約？")) return;
    await deleteContract(id);
    invalidateIndex();
    await refresh();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">合約管理</h1>
          <p className="text-sm text-slate-600 mt-1">
            上傳 PDF → 自動擷取條款 + 法條對照 + 風險評分
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            className="px-3 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center gap-1"
          >
            <Download size={16} /> 匯出 JSON
          </button>
          <label className="px-3 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer flex items-center gap-1">
            <Upload size={16} /> 匯入 JSON
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImport}
            />
          </label>
        </div>
      </header>

      {/* Upload card */}
      <div className="bg-white rounded-xl p-5 border-2 border-dashed border-slate-300">
        <label className="cursor-pointer flex flex-col items-center justify-center py-8">
          <Upload size={32} className="text-blue-500 mb-2" />
          <div className="font-medium">點擊選擇合約 PDF</div>
          <div className="text-xs text-slate-500 mt-1">
            純前端解析，個資 100% 在裝置
          </div>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
            }}
          />
        </label>
        {busy && <div className="text-sm text-blue-600 text-center">{status}</div>}
        {error && (
          <div className="text-sm text-red-600 text-center mt-2">{error}</div>
        )}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        <FilterBtn active={filter === "all"} onClick={() => setFilter("all")}>
          全部 ({contracts.length})
        </FilterBtn>
        {(Object.keys(CATEGORY_LABELS) as ContractCategory[]).map((k) => (
          <FilterBtn
            key={k}
            active={filter === k}
            onClick={() => setFilter(k)}
          >
            {CATEGORY_LABELS[k]} (
            {contracts.filter((c) => c.category === k).length})
          </FilterBtn>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-slate-500 text-sm py-8 text-center bg-white rounded-xl border border-slate-200">
            <FileText className="mx-auto mb-2 text-slate-400" />
            尚無合約，請上傳第一份 PDF
          </div>
        )}
        {filtered.map((c) => (
          <article
            key={c.id}
            className="bg-white rounded-xl p-4 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <RiskBadge level={c.riskScore} />
                <span className="text-xs text-slate-500">
                  {CATEGORY_LABELS[c.category as ContractCategory] ||
                    CATEGORY_LABELS.other}
                </span>
              </div>
              <Link
                to={`/contracts/${c.id}`}
                className="font-semibold text-blue-700 hover:underline block mt-1 truncate"
              >
                {c.title}
              </Link>
              <div className="text-xs text-slate-500 mt-1">
                {c.counterparty} · 到期 {c.expiresAt} · {c.clauses.length} 條款
                {c.riskAnalysis.length > 0
                  ? ` · ${c.riskAnalysis.length} 項風險`
                  : ""}
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                to={`/contracts/${c.id}`}
                className="px-3 py-1.5 text-sm rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100"
              >
                檢視
              </Link>
              <button
                onClick={() => void handleDelete(c.id)}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-50 text-red-700 hover:bg-red-100 flex items-center gap-1"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-full transition ${
        active
          ? "bg-blue-600 text-white"
          : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
