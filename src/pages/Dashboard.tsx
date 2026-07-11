// F-008: 風險儀表板
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
import { AlertTriangle, FileText, Clock, ShieldCheck } from "lucide-react";
import { useAppStore } from "../store";
import { listExpiringContracts, type ExpiringContract } from "../lib/reminder";
import type { RiskLevel } from "../types";
import { RISK_LABELS } from "../types";

const RISK_COLORS: Record<"green" | "yellow" | "red", string> = {
  green: "#10b981",
  yellow: "#f59e0b",
  red: "#ef4444",
};

export default function DashboardPage() {
  const contracts = useAppStore((s) => s.contracts);
  const refresh = useAppStore((s) => s.refreshContracts);
  const [expiring, setExpiring] = useState<ExpiringContract[]>([]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void listExpiringContracts(90).then(setExpiring);
  }, [contracts]);

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
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">風險儀表板</h1>
        <p className="text-sm text-slate-600 mt-1">
          合約總覽 · 風險分佈 · 即將到期提醒
        </p>
      </header>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          icon={<FileText size={20} />}
          label="合約總數"
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
                  <th className="text-left p-2">到期日</th>
                  <th className="text-right p-2">剩餘天數</th>
                  <th className="text-left p-2">風險</th>
                </tr>
              </thead>
              <tbody>
                {expiring.map(({ contract, daysUntilExpiry }) => (
                  <tr key={contract.id} className="border-t border-slate-100">
                    <td className="p-2">
                      <Link
                        to={`/contracts/${contract.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {contract.title}
                      </Link>
                    </td>
                    <td className="p-2">{contract.counterparty}</td>
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
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold leading-tight">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
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
