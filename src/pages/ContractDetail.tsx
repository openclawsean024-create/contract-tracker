import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Clock, AlertTriangle } from "lucide-react";
import { getContract, saveContract } from "../lib/storage";
import type { Contract, ContractCategory } from "../types";
import { CATEGORY_LABELS } from "../types";
import { RiskBadge } from "./Dashboard";

const CLAUSE_TYPE_LABELS: Record<string, string> = {
  confidentiality: "保密條款",
  penalty: "違約金",
  ip: "智慧財產權",
  term: "期限",
  payment: "付款",
  warranty: "保固",
  liability: "責任",
  termination: "終止",
  other: "其他",
};

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [savedMsg, setSavedMsg] = useState<string>("");

  useEffect(() => {
    if (!id) return;
    void getContract(id).then((c) => setContract(c ?? null));
  }, [id]);

  if (!id)
    return <div className="p-8 text-center text-slate-500">無合約 ID</div>;
  if (!contract)
    return (
      <div className="p-8 text-center text-slate-500">
        載入中… / 找不到合約
      </div>
    );

  async function update<K extends keyof Contract>(key: K, value: Contract[K]) {
    const updated = { ...contract!, [key]: value };
    setContract(updated);
    await saveContract(updated);
    setSavedMsg(`已更新：${String(key)}`);
    setTimeout(() => setSavedMsg(""), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/contracts"
          className="text-blue-600 hover:underline text-sm flex items-center gap-1"
        >
          <ArrowLeft size={16} /> 返回合約列表
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <RiskBadge level={contract.riskScore} />
          <span className="text-xs text-slate-500">
            建立 {new Date(contract.createdAt).toLocaleDateString()}
          </span>
        </div>

        <input
          className="text-2xl font-bold w-full outline-none mb-3"
          value={contract.title}
          onChange={(e) => update("title", e.target.value)}
        />

        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <Field label="對方">
            <input
              className="w-full border-b border-slate-300 outline-none py-1 focus:border-blue-500"
              value={contract.counterparty}
              onChange={(e) => update("counterparty", e.target.value)}
            />
          </Field>
          <Field label="類別">
            <select
              className="w-full border-b border-slate-300 outline-none py-1 bg-transparent"
              value={contract.category}
              onChange={(e) =>
                update("category", e.target.value as ContractCategory)
              }
            >
              {(Object.keys(CATEGORY_LABELS) as ContractCategory[]).map((k) => (
                <option key={k} value={k}>
                  {CATEGORY_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="到期日">
            <input
              type="date"
              className="w-full border-b border-slate-300 outline-none py-1"
              value={contract.expiresAt}
              onChange={(e) => update("expiresAt", e.target.value)}
            />
          </Field>
          <Field label="提醒天數">
            <select
              className="w-full border-b border-slate-300 outline-none py-1 bg-transparent"
              value={contract.reminderDaysBefore}
              onChange={(e) =>
                update("reminderDaysBefore", parseInt(e.target.value, 10))
              }
            >
              {[7, 14, 30, 60, 90].map((d) => (
                <option key={d} value={d}>
                  到期前 {d} 天
                </option>
              ))}
            </select>
          </Field>
        </div>

        {savedMsg && (
          <div className="mt-2 text-xs text-emerald-600">{savedMsg}</div>
        )}
      </div>

      {/* Clauses with risk highlights (F-008) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold mb-3">
          擷取條款 ({contract.clauses.length}){" "}
          <span className="text-xs text-slate-500 ml-2">
            <span className="risk-yellow px-1">黃底</span> = 中風險 ·{" "}
            <span className="risk-red px-1">紅底</span> = 高風險
          </span>
        </h2>
        {contract.clauses.length === 0 && (
          <div className="text-slate-500 text-sm">無擷取條款</div>
        )}
        <div className="space-y-3">
          {contract.clauses.map((c) => (
            <div
              key={c.id}
              className="border border-slate-100 rounded-lg p-3 hover:bg-slate-50"
            >
              <div className="flex flex-wrap gap-2 items-center mb-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                  {CLAUSE_TYPE_LABELS[c.type] || c.type}
                </span>
                <span className="text-xs text-slate-500">
                  第 {c.pageNumber} 頁
                </span>
                <RiskBadge level={c.riskLevel} />
                {c.legalRefs.length > 0 && (
                  <span className="text-xs text-slate-500">
                    對照法條：{c.legalRefs.join("、")}
                  </span>
                )}
              </div>
              <div
                className={`text-sm leading-relaxed ${
                  c.riskLevel === "red"
                    ? "risk-red"
                    : c.riskLevel === "yellow"
                    ? "risk-yellow"
                    : ""
                }`}
              >
                {c.originalText}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk issues (F-004) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle size={18} />
          風險建議 ({contract.riskAnalysis.length})
        </h2>
        {contract.riskAnalysis.length === 0 && (
          <div className="text-slate-500 text-sm">無風險評估</div>
        )}
        <div className="space-y-3">
          {contract.riskAnalysis.map((r, i) => (
            <div
              key={i}
              className={`rounded-lg p-3 border ${
                r.severity === "red"
                  ? "border-red-200 bg-red-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <RiskBadge level={r.severity} />
                <span className="text-xs text-slate-600">對照 {r.legalRef}</span>
              </div>
              <div className="text-sm mt-1 font-medium">{r.issue}</div>
              <div className="text-xs text-slate-600 mt-1">
                💡 {r.suggestion}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Raw text view */}
      {contract.extractedText && (
        <details className="bg-white rounded-xl border border-slate-200 p-5">
          <summary className="font-semibold cursor-pointer">
            完整擷取文字（顯示 / 隱藏）
          </summary>
          <pre className="mt-3 text-xs whitespace-pre-wrap max-h-96 overflow-y-auto text-slate-700 bg-slate-50 p-3 rounded">
            {contract.extractedText}
          </pre>
        </details>
      )}

      <div className="text-xs text-slate-500 flex items-center gap-1">
        <Clock size={12} />
        到期前 {contract.reminderDaysBefore} 天提醒將在背景瀏覽器通知
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-0.5">{label}</div>
      {children}
    </div>
  );
}
