// 儀表板：風險分布（FR-016）、工作流分組（FR-015）、即將到期（FR-010）、「我負責的」篩選（FR-013）
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { AlertTriangle, FileText, Clock, ShieldCheck, ListTodo, UserCheck, PenLine } from "lucide-react";
import { useAppStore } from "../store";
import { listExpiringContracts, type ExpiringContract } from "../lib/reminder";
import { RISK_LABELS } from "../types";
import { countByWorkflow } from "../lib/workflow";
import { filterOwnedBy, ownerLabel } from "../lib/team";

const RISK_COLORS: Record<"green" | "yellow" | "red", string> = {
  green: "#10b981",
  yellow: "#f59e0b",
  red: "#ef4444",
};

export default function DashboardPage() {
  const allContracts = useAppStore((s) => s.contracts);
  const members = useAppStore((s) => s.members);
  const currentMemberId = useAppStore((s) => s.currentMemberId);
  const refresh = useAppStore((s) => s.refreshContracts);
  const refreshMembers = useAppStore((s) => s.refreshMembers);
  const [allExpiring, setAllExpiring] = useState<ExpiringContract[]>([]);
  const [mineOnly, setMineOnly] = useState(false);

  useEffect(() => {
    void refresh();
    void refreshMembers();
  }, [refresh, refreshMembers]);

  useEffect(() => {
    void listExpiringContracts(90).then(setAllExpiring);
  }, [allContracts]);

  const currentMember = members.find((m) => m.id === currentMemberId);
  const filterMine = mineOnly && !!currentMember;
  const contracts = useMemo(
    () => (filterMine ? filterOwnedBy(allContracts, currentMemberId) : allContracts),
    [filterMine, allContracts, currentMemberId]
  );
  const expiring = useMemo(
    () =>
      filterMine
        ? allExpiring.filter((e) => e.contract.ownerId === currentMemberId)
        : allExpiring,
    [filterMine, allExpiring, currentMemberId]
  );
  const workflow = useMemo(() => countByWorkflow(contracts), [contracts]);

  const stats = useMemo(() => {
    const groups: Record<"green" | "yellow" | "red", number> = {
      green: 0,
      yellow: 0,
      red: 0,
    };
    for (const c of contracts) {
      groups[c.riskScore] = (groups[c.riskScore] || 0) + 1;
    }
    const total = contracts.length;
    const byCategory: Record<string, number> = {};
    for (const c of contracts) {
      byCategory[c.category] = (byCategory[c.category] || 0) + 1;
    }
    return { groups, total, byCategory };
  }, [contracts]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">儀表板</h1>
          <p className="text-sm text-slate-600 mt-1">
            合約總覽 · 審核進度 · 風險分佈 · 即將到期提醒
          </p>
        </div>
        <div className="flex flex-col items-start md:items-end gap-1">
          <div className="flex gap-2" role="group" aria-label="合約範圍">
            <button
              data-testid="filter-all"
              aria-pressed={!filterMine}
              onClick={() => setMineOnly(false)}
              className={`px-3 py-1.5 text-xs rounded-full transition ${
                !filterMine
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              全部合約
            </button>
            <button
              data-testid="filter-mine"
              aria-pressed={filterMine}
              disabled={!currentMember}
              onClick={() => setMineOnly(true)}
              className={`px-3 py-1.5 text-xs rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed ${
                filterMine
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              我負責的
            </button>
          </div>
          <span className="text-[11px] text-slate-500" data-testid="current-identity">
            {currentMember ? (
              <>目前身分：{currentMember.name}（本機模擬）</>
            ) : (
              <>
                尚未選擇目前身分，請到
                <Link to="/team" className="text-blue-600 hover:underline">
                  團隊
                </Link>
                頁設定
              </>
            )}
          </span>
        </div>
      </header>

      {/* 工作流分組（FR-015） */}
      <div className="grid grid-cols-3 gap-4" data-testid="workflow-counts">
        <WorkflowTile
          icon={<ListTodo size={20} />}
          label="待辦"
          hint="草擬建立＋送審核中"
          value={workflow.todo}
          testId="todo-count"
          color="bg-orange-50 text-orange-700"
        />
        <WorkflowTile
          icon={<UserCheck size={20} />}
          label="待覆核"
          hint="法務覆核＋主管核准"
          value={workflow.review}
          testId="review-count"
          color="bg-amber-50 text-amber-700"
        />
        <WorkflowTile
          icon={<PenLine size={20} />}
          label="已簽署"
          hint="對方簽署"
          value={workflow.signed}
          testId="signed-count"
          color="bg-emerald-50 text-emerald-700"
        />
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          icon={<FileText size={20} />}
          label="合約總數"
          testId="total-count"
          value={stats.total}
          color="bg-blue-50 text-blue-700"
        />
        <StatTile
          icon={<ShieldCheck size={20} />}
          label="低風險 (綠)"
          value={stats.groups.green}
          color="bg-emerald-50 text-emerald-700"
        />
        <StatTile
          icon={<AlertTriangle size={20} />}
          label="中風險 (黃)"
          value={stats.groups.yellow}
          color="bg-amber-50 text-amber-700"
        />
        <StatTile
          icon={<AlertTriangle size={20} />}
          label="高風險 (紅)"
          value={stats.groups.red}
          color="bg-red-50 text-red-700"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Risk distribution */}
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <h2 className="text-base font-semibold mb-3">風險分佈</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: "低風險", value: stats.groups.green, color: RISK_COLORS.green },
                    { name: "中風險", value: stats.groups.yellow, color: RISK_COLORS.yellow },
                    { name: "高風險", value: stats.groups.red, color: RISK_COLORS.red },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                  label={(d: any) => `${d.name} ${d.value}`}
                >
                  {stats.total > 0 && (
                    <>
                      <Cell fill={RISK_COLORS.green} />
                      <Cell fill={RISK_COLORS.yellow} />
                      <Cell fill={RISK_COLORS.red} />
                    </>
                  )}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category distribution */}
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <h2 className="text-base font-semibold mb-3">合約類別分佈</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={Object.entries(stats.byCategory).map(([k, v]) => ({
                  name: categoryChinese(k),
                  value: v,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Expiring contracts */}
      <div className="bg-white rounded-xl p-5 border border-slate-200">
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Clock size={18} />
          即將到期 (90 天內)
        </h2>
        {expiring.length === 0 ? (
          <p className="text-slate-500 text-sm">無即將到期合約</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left p-2">合約</th>
                  <th className="text-left p-2">對方</th>
                  <th className="text-left p-2">負責人</th>
                  <th className="text-left p-2">到期日</th>
                  <th className="text-right p-2">剩餘天數</th>
                  <th className="text-left p-2">風險</th>
                </tr>
              </thead>
              <tbody>
                {expiring.map(({ contract, daysUntilExpiry }) => (
                  <tr key={contract.id} className="border-t border-slate-100" data-testid="expiring-row">
                    <td className="p-2">
                      <Link
                        to={`/contracts/${contract.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {contract.title}
                      </Link>
                    </td>
                    <td className="p-2">{contract.counterparty}</td>
                    <td className="p-2">{ownerLabel(contract, members)}</td>
                    <td className="p-2">{contract.expiresAt}</td>
                    <td className="p-2 text-right">
                      <ExpiryBadge days={daysUntilExpiry} />
                    </td>
                    <td className="p-2">
                      <RiskBadge level={contract.riskScore} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  color,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  testId?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold leading-tight" data-testid={testId}>
          {value}
        </div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}

function WorkflowTile({
  icon,
  label,
  hint,
  value,
  color,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: number;
  color: string;
  testId: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold leading-tight" data-testid={testId}>
          {value}
        </div>
        <div className="text-xs text-slate-700">{label}</div>
        <div className="text-[11px] text-slate-400">{hint}</div>
      </div>
    </div>
  );
}

function ExpiryBadge({ days }: { days: number }) {
  const color =
    days <= 7
      ? "bg-red-100 text-red-800"
      : days <= 30
      ? "bg-amber-100 text-amber-800"
      : "bg-blue-100 text-blue-800";
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${color}`}>{days} 天</span>
  );
}

export function RiskBadge({ level }: { level: "green" | "yellow" | "red" }) {
  const cls =
    level === "red"
      ? "bg-red-100 text-red-800"
      : level === "yellow"
      ? "bg-amber-100 text-amber-800"
      : "bg-emerald-100 text-emerald-800";
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${cls}`}>
      {RISK_LABELS[level]}
    </span>
  );
}

function categoryChinese(key: string) {
  const m: Record<string, string> = {
    client: "客戶",
    vendor: "供應商",
    lease: "租賃",
    nda: "保密",
    employment: "聘僱",
    other: "其他",
  };
  return m[key] || key;
}
