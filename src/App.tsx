import { useEffect } from "react";
import { Routes, Route, NavLink, Link } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Library,
  Search as SearchIcon,
  BookOpen,
  Bell,
} from "lucide-react";
import DashboardPage from "./pages/Dashboard";
import ContractsPage from "./pages/Contracts";
import ContractDetailPage from "./pages/ContractDetail";
import LegalDbPage from "./pages/LegalDb";
import TemplatesPage from "./pages/Templates";
import SearchPage from "./pages/Search";
import { useAppStore } from "./store";
import { startReminderScheduler } from "./lib/reminder";

const NAV = [
  { to: "/", label: "儀表板", icon: LayoutDashboard },
  { to: "/contracts", label: "合約", icon: FileText },
  { to: "/legal-db", label: "法條庫 (100)", icon: Library },
  { to: "/templates", label: "範本庫", icon: BookOpen },
  { to: "/search", label: "全文搜尋", icon: SearchIcon },
];

export default function App() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const legalDb = useAppStore((s) => s.legalDb);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    startReminderScheduler();
  }, []);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar — desktop, topbar — mobile */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-slate-900 text-white">
        <div className="p-5 border-b border-slate-700">
          <div className="text-lg font-bold leading-tight">
            合約狀況 + 審核法條
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Contract Tracker · v1.0
          </div>
          <div className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
            <Bell size={12} />
            到期提醒 30/60/90 天
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700 text-xs text-slate-500">
          <div>{legalDb?.count || 100} 條法條已預載</div>
          <div className="mt-1">PDF.js 純前端，個資不上雲</div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="md:hidden bg-slate-900 text-white">
          <div className="p-3 font-bold">合約狀況 + 審核法條</div>
          <nav className="px-2 pb-2 flex gap-1 overflow-x-auto">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-xs whitespace-nowrap ${
                    isActive ? "bg-blue-600 text-white" : "bg-slate-700"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/contracts" element={<ContractsPage />} />
            <Route path="/contracts/:id" element={<ContractDetailPage />} />
            <Route path="/legal-db" element={<LegalDbPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        <footer className="border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 flex justify-between items-center">
          <span>
            純前端 SPA · React 18 + Vite ·{" "}
            <Link to="/" className="text-blue-600 hover:underline">
              首頁
            </Link>
          </span>
          <span className="text-slate-400">
            風險評分僅供參考，非法律建議
          </span>
        </footer>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-bold mb-2">404</h1>
      <p className="text-slate-600">找不到頁面</p>
      <Link to="/" className="text-blue-600 hover:underline">
        回首頁
      </Link>
    </div>
  );
}
