import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { v4 as uuid } from "uuid";
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
  Info,
  MessageSquare,
  GitBranch,
} from "lucide-react";
import { getContract, saveContract } from "../lib/storage";
import type { Contract, ContractCategory } from "../types";
import { CATEGORY_LABELS, RISK_CATEGORY_LABELS, TEAM_ROLE_LABELS } from "../types";
import {
  WORKFLOW_LABELS,
  WORKFLOW_ORDER,
  addNote,
  advanceWorkflow,
  getWorkflowStatus,
  nextWorkflowStatus,
} from "../lib/workflow";
import {
  UNASSIGNED_LABEL,
  assignOwner,
  resolveReminderRecipients,
  setReminderRecipients,
} from "../lib/team";
import { reminderThresholds } from "../lib/reminderDispatch";
import { useAppStore } from "../store";
import Disclaimer from "../components/Disclaimer";
import { RiskBadge } from "./Dashboard";

const FIELD_LABELS: Partial<Record<keyof Contract, string>> = {
  title: "標題",
  counterparty: "對方",
  category: "類別",
  expiresAt: "到期日",
  reminderDaysBefore: "提醒天數",
  isActive: "提醒狀態",
};

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
  const members = useAppStore((s) => s.members);
  const currentMemberId = useAppStore((s) => s.currentMemberId);
  const refreshMembers = useAppStore((s) => s.refreshMembers);
  const [contract, setContract] = useState<Contract | null>(null);
  const [savedMsg, setSavedMsg] = useState<string>("");
  const [daysDraft, setDaysDraft] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void getContract(id).then((c) => setContract(c ?? null));
  }, [id]);

  useEffect(() => {
    void refreshMembers();
  }, [refreshMembers]);

  if (!id)
    return <div className="p-8 text-center text-slate-500">無合約 ID</div>;
  if (!contract)
    return (
      <div className="p-8 text-center text-slate-500">
        載入中… / 找不到合約
      </div>
    );

  /**
   * 儲存合約。表單欄位（文字、選單、勾選框）採 optimistic：先更新畫面再寫入；
   * 工作流推進與註解則先寫入本機資料庫，成功後才更新畫面，
   * 避免畫面顯示已完成但資料其實還沒寫入。
   */
  async function persist(
    updated: Contract,
    message: string,
    options: { optimistic?: boolean } = {}
  ) {
    if (options.optimistic) setContract(updated);
    await saveContract(updated);
    if (!options.optimistic) setContract(updated);
    setSavedMsg(message);
    setTimeout(() => setSavedMsg(""), 2000);
  }

  async function update<K extends keyof Contract>(key: K, value: Contract[K]) {
    await persist({ ...contract!, [key]: value }, `已更新：${FIELD_LABELS[key] ?? String(key)}`, {
      optimistic: true,
    });
  }

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const status = getWorkflowStatus(contract);
  const statusIndex = WORKFLOW_ORDER.indexOf(status);
  const next = nextWorkflowStatus(status);
  const notes = contract.notes ?? [];
  const riskNotes = contract.riskNotes ?? [];
  const recipientIds = contract.reminderRecipientIds ?? [];
  const resolvedRecipients = resolveReminderRecipients(contract, members);
  const currentMember = members.find((m) => m.id === currentMemberId);
  const segmentUnit = !contract.source || contract.source === "pdf" ? "頁" : "段";
  const thresholds = reminderThresholds(contract)
    .map((d) => (d === 0 ? "到期當天" : `到期前 ${d} 天`))
    .join("、");

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
          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
            {WORKFLOW_LABELS[status]}
          </span>
          <span className="text-xs text-slate-500">
            建立 {new Date(contract.createdAt).toLocaleDateString()}
          </span>
        </div>

        <input
          aria-label="合約標題"
          data-testid="title-input"
          className="text-2xl font-bold w-full outline-none mb-3"
          value={contract.title}
          onChange={(e) => update("title", e.target.value)}
        />

        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <Field label="對方">
            <input
              data-testid="counterparty-input"
              className="w-full border-b border-slate-300 outline-none py-1 focus:border-blue-500"
              value={contract.counterparty}
              onChange={(e) => update("counterparty", e.target.value)}
            />
          </Field>
          <Field label="類別（可手動修改）">
            <select
              data-testid="category-select"
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
            {contract.detectedType && (
              <div className="text-xs text-slate-500 mt-1" data-testid="detected-type">
                規則偵測類型：{contract.detectedType}
              </div>
            )}
          </Field>
          <Field label="到期日">
            <input
              type="date"
              data-testid="expires-input"
              className="w-full border-b border-slate-300 outline-none py-1"
              value={contract.expiresAt}
              onChange={(e) => update("expiresAt", e.target.value)}
            />
            <div className="text-xs text-slate-500 mt-1">
              到期日不會從內文自動擷取，請自行確認。
            </div>
          </Field>
          <Field label="提醒天數（到期前幾天）">
            <input
              type="number"
              min={0}
              max={3650}
              step={1}
              data-testid="reminder-days-input"
              className="w-full border-b border-slate-300 outline-none py-1"
              value={daysDraft ?? String(contract.reminderDaysBefore)}
              onChange={(e) => {
                const raw = e.target.value;
                setDaysDraft(raw);
                const n = Number(raw);
                if (raw.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= 3650) {
                  void update("reminderDaysBefore", n);
                }
              }}
              onBlur={() => setDaysDraft(null)}
            />
            <div className="text-xs text-slate-500 mt-1" data-testid="reminder-thresholds">
              提醒時點：{thresholds}
            </div>
          </Field>
          <Field label="負責人">
            <select
              data-testid="owner-select"
              className="w-full border-b border-slate-300 outline-none py-1 bg-transparent"
              value={
                contract.ownerId && members.some((m) => m.id === contract.ownerId)
                  ? contract.ownerId
                  : ""
              }
              onChange={(e) =>
                void run(() =>
                  persist(
                    assignOwner(contract, e.target.value || null, members),
                    "已更新：負責人",
                    { optimistic: true }
                  )
                )
              }
            >
              <option value="">{UNASSIGNED_LABEL}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}（{TEAM_ROLE_LABELS[m.role]}）
                </option>
              ))}
            </select>
            {members.length === 0 && (
              <div className="text-xs text-slate-500 mt-1">
                尚無成員，請先到
                <Link to="/team" className="text-blue-600 hover:underline">
                  團隊
                </Link>
                頁新增。
              </div>
            )}
          </Field>
          <Field label="提醒收件人">
            <div className="space-y-1" data-testid="recipient-list">
              {members.length === 0 && (
                <div className="text-xs text-slate-500">尚無成員</div>
              )}
              {members.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={recipientIds.includes(m.id)}
                    onChange={(e) =>
                      void run(() => persist(
                        setReminderRecipients(
                          contract,
                          e.target.checked
                            ? [...recipientIds, m.id]
                            : recipientIds.filter((r) => r !== m.id),
                          members
                        ),
                        "已更新：提醒收件人",
                        { optimistic: true }
                      ))
                    }
                  />
                  {m.name}
                  <span className="text-xs text-slate-500">{m.email}</span>
                </label>
              ))}
            </div>
            <div className="text-xs text-slate-500 mt-1" data-testid="resolved-recipients">
              提醒將寄給：
              {resolvedRecipients.length > 0
                ? resolvedRecipients.map((m) => m.email).join("、")
                : "（未設定；未勾選收件人時會寄給負責人）"}
            </div>
          </Field>
          <Field label="提醒狀態">
            <label className="flex items-center gap-2 text-sm py-1">
              <input
                type="checkbox"
                data-testid="active-toggle"
                checked={contract.isActive}
                onChange={(e) => update("isActive", e.target.checked)}
              />
              啟用到期提醒（停用後不會產生提醒）
            </label>
          </Field>
        </div>

        {savedMsg && (
          <div className="mt-2 text-xs text-emerald-600">{savedMsg}</div>
        )}
        {error && (
          <div className="mt-2 text-xs text-red-600" role="alert">
            {error}
          </div>
        )}
      </div>

      {/* 審核工作流（FR-014） */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <GitBranch size={18} /> 審核流程
        </h2>
        <ol className="flex gap-2 overflow-x-auto" data-testid="workflow-bar">
          {WORKFLOW_ORDER.map((s, i) => (
            <li
              key={s}
              data-testid={`workflow-step-${s}`}
              aria-current={i === statusIndex ? "step" : undefined}
              className={`flex-1 min-w-24 px-3 py-2 rounded text-center text-sm ${
                i < statusIndex
                  ? "bg-emerald-100 text-emerald-800"
                  : i === statusIndex
                  ? "bg-emerald-600 text-white font-semibold"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {WORKFLOW_LABELS[s]}
            </li>
          ))}
        </ol>
        {next ? (
          <button
            data-testid="advance-status"
            onClick={() =>
              void run(() =>
                persist(
                  advanceWorkflow(contract),
                  `已推進到「${WORKFLOW_LABELS[next]}」`
                )
              )
            }
            className="mt-3 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            推進到「{WORKFLOW_LABELS[next]}」
          </button>
        ) : (
          <p className="mt-3 text-sm text-emerald-700">流程已完成（對方簽署）。</p>
        )}
        <p className="text-xs text-slate-500 mt-2">
          只能依序往下一階段推進，不能跳關或倒退。此流程為本機紀錄，沒有角色權限控管。
        </p>
      </div>

      {/* Risk issues（FR-005／FR-006） */}
      <div
        className="bg-white rounded-xl border border-slate-200 p-5"
        data-testid="risk-section"
      >
        <h2 className="font-semibold mb-2 flex items-center gap-2">
          <AlertTriangle size={18} />
          規則比對結果 ({contract.riskAnalysis.length})
          <span data-testid="risk-badge">
            <RiskBadge level={contract.riskScore} />
          </span>
        </h2>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 mb-3">
          <Disclaimer testId="disclaimer-risk" />
        </div>
        {contract.riskAnalysis.length === 0 && (
          <div className="text-slate-500 text-sm" data-testid="risk-empty">
            規則沒有比對到需要注意的條款。規則比對可能漏判，仍建議人工複核。
          </div>
        )}
        <div className="space-y-3" data-testid="risk-list">
          {contract.riskAnalysis.map((r, i) => (
            <div
              key={i}
              data-testid="risk-item"
              className={`rounded-lg p-3 border ${
                r.severity === "red"
                  ? "border-red-200 bg-red-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge level={r.severity} />
                {r.category && (
                  <span className="text-xs px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                    {RISK_CATEGORY_LABELS[r.category]}
                  </span>
                )}
                {r.legalRef && (
                  <span className="text-xs text-slate-600">
                    參考法條 {r.legalRef}
                  </span>
                )}
              </div>
              <div className="text-sm mt-1 font-medium">{r.issue}</div>
              <div className="text-xs text-slate-600 mt-1">
                建議：{r.suggestion}
              </div>
            </div>
          ))}
        </div>

        {riskNotes.length > 0 && (
          <div className="mt-4" data-testid="risk-info-list">
            <h3 className="text-sm font-semibold flex items-center gap-1 text-slate-700">
              <Info size={16} /> 資訊提示（不計入風險分級）
            </h3>
            <div className="space-y-2 mt-2">
              {riskNotes.map((r, i) => (
                <div
                  key={i}
                  data-testid="risk-info-item"
                  className="rounded-lg p-3 border border-slate-200 bg-slate-50"
                >
                  {r.category && (
                    <span className="text-xs px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                      {RISK_CATEGORY_LABELS[r.category]}
                    </span>
                  )}
                  <div className="text-sm mt-1">{r.issue}</div>
                  <div className="text-xs text-slate-600 mt-1">{r.suggestion}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Clauses with risk highlights */}
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
                  第 {c.pageNumber} {segmentUnit}
                </span>
                <RiskBadge level={c.riskLevel} />
                {c.legalRefs.length > 0 && (
                  <span className="text-xs text-slate-500">
                    參考法條：{c.legalRefs.join("、")}
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

      {/* 註解（FR-014）：存成獨立的 notes[]，不修改合約內文 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <MessageSquare size={18} /> 註解 ({notes.length})
        </h2>
        {notes.length > 0 && (
          <ul className="space-y-2 mb-3" data-testid="note-list">
            {notes.map((n) => (
              <li
                key={n.id}
                data-testid="note-item"
                className="rounded-lg border border-slate-100 bg-slate-50 p-3"
              >
                <div className="text-xs text-slate-500">
                  {n.author} · {new Date(n.createdAt).toLocaleString()}
                </div>
                <div className="text-sm mt-1 whitespace-pre-wrap">{n.text}</div>
              </li>
            ))}
          </ul>
        )}
        <textarea
          data-testid="note-input"
          aria-label="新增註解"
          rows={3}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          placeholder="例：第四條違約金比例請再確認"
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
        />
        <div className="flex items-center gap-3 mt-2">
          <button
            data-testid="add-note"
            onClick={() =>
              void run(async () => {
                await persist(
                  addNote(contract, {
                    id: uuid(),
                    text: noteDraft,
                    author: currentMember?.name ?? "",
                    now: new Date(),
                  }),
                  "已新增註解"
                );
                setNoteDraft("");
              })
            }
            className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 hover:bg-slate-200"
          >
            新增註解
          </button>
          <span className="text-xs text-slate-500">
            作者：{currentMember?.name ?? "未具名（可到團隊頁選擇目前身分）"}
            ；註解不會改動合約內文。
          </span>
        </div>
      </div>

      {/* Raw text view */}
      {contract.extractedText && (
        <details className="bg-white rounded-xl border border-slate-200 p-5">
          <summary className="font-semibold cursor-pointer">
            完整擷取文字（顯示 / 隱藏）
          </summary>
          <pre
            data-testid="extracted-text"
            className="mt-3 text-xs whitespace-pre-wrap max-h-96 overflow-y-auto text-slate-700 bg-slate-50 p-3 rounded"
          >
            {contract.extractedText}
          </pre>
        </details>
      )}

      <div className="text-xs text-slate-500 flex items-center gap-1">
        <Clock size={12} />
        提醒會寫入「模擬寄件匣」（本機模擬，未實際寄出），並在瀏覽器允許時顯示通知。
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
