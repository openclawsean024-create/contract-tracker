import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { v4 as uuid } from "uuid";
import { Upload, Trash2, Download, FileText, ClipboardPaste } from "lucide-react";
import { sha256Hex } from "../lib/pdfParser";
import {
  FILE_ACCEPT,
  extractFromPastedText,
  extractTextFromFile,
  type TextExtractSuccess,
} from "../lib/textExtract";
import { analyzeContract } from "../lib/analyze";
import { deleteContract, exportAll } from "../lib/storage";
import { commitAnalyzedContract, importBackup } from "../lib/contractIntake";
import { currentAckReader, useAppStore } from "../store";
import { invalidateIndex, ensureIndex } from "../lib/search";
import { DISCLAIMER_ACK_LABEL, canUpload } from "../lib/disclaimer";
import { WORKFLOW_LABELS, getWorkflowStatus } from "../lib/workflow";
import { ownerLabel } from "../lib/team";
import Disclaimer from "../components/Disclaimer";
import { RiskBadge } from "./Dashboard";
import type { ContractCategory } from "../types";
import { CATEGORY_LABELS } from "../types";

export default function ContractsPage() {
  const contracts = useAppStore((s) => s.contracts);
  const legalDb = useAppStore((s) => s.legalDb);
  const members = useAppStore((s) => s.members);
  const refresh = useAppStore((s) => s.refreshContracts);
  const refreshMembers = useAppStore((s) => s.refreshMembers);
  const ack = useAppStore((s) => s.disclaimerAck);
  const setAck = useAppStore((s) => s.setDisclaimerAck);
  const navigate = useNavigate();

  const [filter, setFilter] = useState<ContractCategory | "all">("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");

  const uploadAllowed = canUpload(ack);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered =
    filter === "all"
      ? contracts
      : contracts.filter((c) => c.category === filter);

  /** 四種輸入（PDF／TXT／DOCX／貼上）共用的分析流程 */
  async function analyzeAndSave(
    extracted: TextExtractSuccess,
    title: string,
    fileHash?: string
  ) {
    if (!legalDb) {
      setError("法條庫尚未預載完成，請稍候再試");
      return;
    }
    setStatus("擷取條款並比對規則中…");
    const contract = analyzeContract({
      id: uuid(),
      title,
      source: extracted.source,
      fullText: extracted.fullText,
      pages: extracted.pages,
      articles: legalDb.articles,
      now: new Date(),
      pdfHash: fileHash,
    });
    // 解析期間使用者可能已取消勾選：以「當下」的狀態為準
    await commitAnalyzedContract(contract, currentAckReader);
    invalidateIndex();
    await ensureIndex();
    await refresh();
    navigate(`/contracts/${contract.id}`);
  }

  async function handleUpload(file: File) {
    if (!uploadAllowed) return;
    setBusy(true);
    setError(null);
    setStatus("讀取檔案中…");
    try {
      const extracted = await extractTextFromFile(file);
      if (!extracted.ok) {
        setError(extracted.message);
        return;
      }
      const hash = await sha256Hex(await file.arrayBuffer());
      await analyzeAndSave(
        extracted,
        file.name.replace(/\.[^.]+$/, ""),
        hash.slice(0, 16)
      );
    } catch (err) {
      setError(
        `分析失敗：${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setBusy(false);
    }
  }

  async function handlePaste() {
    if (!uploadAllowed) return;
    setError(null);
    const extracted = extractFromPastedText(pasteText);
    if (!extracted.ok) {
      setError("請先貼上合約內文。");
      return;
    }
    setBusy(true);
    try {
      await analyzeAndSave(extracted, pasteTitle || "貼上的合約");
    } catch (err) {
      setError(
        `分析失敗：${err instanceof Error ? err.message : String(err)}`
      );
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
    setError(null);
    try {
      const text = await file.text();
      const r = await importBackup(text, currentAckReader);
      invalidateIndex();
      await refresh();
      await refreshMembers();
      setStatus(
        `已匯入 ${r.contractsAdded} 份合約、${r.membersAdded} 位成員` +
          (r.contractsSkipped + r.membersSkipped > 0
            ? `；本機已有的 ${r.contractsSkipped} 份合約、${r.membersSkipped} 位成員保留本機版本，未覆蓋`
            : "") +
          (r.assignmentsCleared > 0
            ? `；${r.assignmentsCleared} 個負責人／收件人在本機找不到對應成員，已改為未指派`
            : "") +
          (r.contractsInvalid + r.membersInvalid > 0
            ? `；${r.contractsInvalid + r.membersInvalid} 筆資料格式不正確，已略過`
            : "")
      );
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
            上傳 PDF／TXT／DOCX 或貼上內文 → 擷取條款 → 規則比對風險標記
          </p>
        </div>
        <div className="flex flex-col items-start md:items-end gap-1">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExport}
              className="px-3 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center gap-1"
            >
              <Download size={16} /> 匯出 JSON
            </button>
            <label
              className={`px-3 py-2 text-sm rounded-lg bg-slate-100 flex items-center gap-1 ${
                uploadAllowed && !busy ? "hover:bg-slate-200 cursor-pointer" : "opacity-50 cursor-not-allowed"
              }`}
            >
              <Upload size={16} /> 匯入 JSON
              <input
                type="file"
                data-testid="import-input"
                aria-label="匯入 JSON 備份"
                accept="application/json"
                className="hidden"
                disabled={!uploadAllowed || busy}
                onChange={handleImport}
              />
            </label>
          </div>
          <span className="text-[11px] text-slate-500">
            匯出的 JSON 為明文，請妥善保存。匯入不會覆蓋本機已有的合約。
          </span>
        </div>
      </header>

      {/* Upload card */}
      <section
        className="bg-white rounded-xl p-5 border-2 border-dashed border-slate-300 space-y-4"
        data-testid="upload-area"
      >
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2">
          <Disclaimer testId="disclaimer-upload" />
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              data-testid="disclaimer-ack"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            {DISCLAIMER_ACK_LABEL}
          </label>
          {!uploadAllowed && (
            <p className="text-xs text-amber-700" data-testid="ack-required">
              請先勾選上方確認，才能上傳或貼上合約。
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h2 className="font-semibold text-sm flex items-center gap-1">
              <Upload size={16} className="text-blue-500" /> 上傳檔案
            </h2>
            <input
              type="file"
              data-testid="file-input"
              aria-label="上傳合約檔案"
              accept={FILE_ACCEPT}
              className="block w-full text-sm file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white disabled:opacity-50"
              disabled={!uploadAllowed || busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void handleUpload(f);
              }}
            />
            <p className="text-xs text-slate-500">
              支援 .pdf、.txt、.docx。檔案只在瀏覽器內解析，不會上傳到任何伺服器。
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="font-semibold text-sm flex items-center gap-1">
              <ClipboardPaste size={16} className="text-blue-500" /> 貼上合約內文
            </h2>
            <input
              data-testid="paste-title"
              aria-label="合約標題"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="合約標題（選填）"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
            />
            <textarea
              data-testid="paste-textarea"
              aria-label="合約內文"
              rows={6}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
              placeholder="把合約文字貼在這裡…"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <button
              data-testid="paste-submit"
              onClick={() => void handlePaste()}
              disabled={!uploadAllowed || busy}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              分析貼上的內文
            </button>
          </div>
        </div>

        {busy && <div className="text-sm text-blue-600">{status}</div>}
        {!busy && status && !error && (
          <div className="text-sm text-emerald-700">{status}</div>
        )}
        {error && (
          <div className="text-sm text-red-600" data-testid="upload-error" role="alert">
            {error}
          </div>
        )}
      </section>

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
      <div className="space-y-3" data-testid="contract-list">
        {filtered.length === 0 && (
          <div className="text-slate-500 text-sm py-8 text-center bg-white rounded-xl border border-slate-200">
            <FileText className="mx-auto mb-2 text-slate-400" />
            尚無合約，請上傳檔案或貼上合約內文
          </div>
        )}
        {filtered.map((c) => (
          <article
            key={c.id}
            data-testid="contract-row"
            className="bg-white rounded-xl p-4 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <RiskBadge level={c.riskScore} />
                <span className="text-xs text-slate-500">
                  {CATEGORY_LABELS[c.category as ContractCategory] ||
                    CATEGORY_LABELS.other}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  {WORKFLOW_LABELS[getWorkflowStatus(c)]}
                </span>
              </div>
              <Link
                to={`/contracts/${c.id}`}
                className="font-semibold text-blue-700 hover:underline block mt-1 truncate"
              >
                {c.title}
              </Link>
              <div className="text-xs text-slate-500 mt-1">
                {c.counterparty} · 到期 {c.expiresAt} · 負責人{" "}
                {ownerLabel(c, members)} · {c.clauses.length} 條款
                {c.riskAnalysis.length > 0
                  ? ` · ${c.riskAnalysis.length} 項風險標記`
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
                aria-label={`刪除 ${c.title}`}
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
