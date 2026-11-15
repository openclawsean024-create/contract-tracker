// 團隊共用（本機 mock，FR-013）：成員清單、目前身分
import { useEffect, useState } from "react";
import { Trash2, UserPlus, Users } from "lucide-react";
import { teamAdapter, useAppStore } from "../store";
import { DEMO_MEMBERS } from "../lib/team";
import { TEAM_ROLE_LABELS, type TeamRole } from "../types";

export default function TeamPage() {
  const members = useAppStore((s) => s.members);
  const currentMemberId = useAppStore((s) => s.currentMemberId);
  const refreshMembers = useAppStore((s) => s.refreshMembers);
  const refreshContracts = useAppStore((s) => s.refreshContracts);
  const setCurrentMember = useAppStore((s) => s.setCurrentMember);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("admin");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshMembers();
  }, [refreshMembers]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await teamAdapter.addMember({ name, email, role });
      setName("");
      setEmail("");
      await refreshMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRemove(id: string, memberName: string) {
    if (
      !confirm(
        `確認移除「${memberName}」？此成員負責的合約會改為未指派，並從提醒收件人中移除。`
      )
    )
      return;
    await teamAdapter.removeMember(id);
    await refreshMembers();
    await refreshContracts();
  }

  async function handleLoadDemo() {
    setError(null);
    const existing = new Set(members.map((m) => m.email));
    for (const seed of DEMO_MEMBERS) {
      if (!existing.has(seed.email)) await teamAdapter.addMember(seed);
    }
    await refreshMembers();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">團隊</h1>
        <p className="text-sm text-slate-600 mt-1">
          管理成員清單，並在合約詳情指定負責人與提醒收件人。
        </p>
      </header>

      <div
        className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
        data-testid="team-mock-notice"
      >
        M1 為本機模擬：成員資料只存在這個瀏覽器，沒有登入、權限或雲端同步。Email
        只接受 example.com／example.test 網域的假資料。
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <label className="text-sm font-semibold block mb-1" htmlFor="current-member">
          目前身分（本機模擬，非登入）
        </label>
        <select
          id="current-member"
          data-testid="current-member-select"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          value={currentMemberId ?? ""}
          onChange={(e) => setCurrentMember(e.target.value || null)}
        >
          <option value="">未選擇</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">
          用於儀表板的「我負責的」篩選，以及註解的作者名稱。
        </p>
      </div>

      <form
        onSubmit={handleAdd}
        className="bg-white rounded-xl border border-slate-200 p-5 space-y-3"
      >
        <h2 className="font-semibold flex items-center gap-2">
          <UserPlus size={18} /> 新增成員
        </h2>
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <label className="block">
            <span className="text-xs text-slate-500">姓名</span>
            <input
              data-testid="member-name-input"
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：測試成員甲"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">Email（僅限假資料網域）</span>
            <input
              data-testid="member-email-input"
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">角色</span>
            <select
              data-testid="member-role-select"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
              value={role}
              onChange={(e) => setRole(e.target.value as TeamRole)}
            >
              {(Object.keys(TEAM_ROLE_LABELS) as TeamRole[]).map((r) => (
                <option key={r} value={r}>
                  {TEAM_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && (
          <div className="text-sm text-red-600" data-testid="team-error">
            {error}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            data-testid="add-member"
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            新增成員
          </button>
          <button
            type="button"
            onClick={() => void handleLoadDemo()}
            data-testid="load-demo-members"
            className="px-4 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200"
          >
            載入示範成員（假資料）
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <Users size={18} /> 成員清單（{members.length}）
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-slate-500">尚無成員</p>
        ) : (
          <ul className="divide-y divide-slate-100" data-testid="member-list">
            {members.map((m) => (
              <li
                key={m.id}
                className="py-2 flex items-center justify-between gap-3 text-sm"
                data-testid="member-row"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{m.name}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {m.email} · {TEAM_ROLE_LABELS[m.role]}
                  </div>
                </div>
                <button
                  onClick={() => void handleRemove(m.id, m.name)}
                  aria-label={`移除 ${m.name}`}
                  className="px-3 py-1.5 text-sm rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
