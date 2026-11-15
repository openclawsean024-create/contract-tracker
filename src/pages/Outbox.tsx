// 模擬寄件匣（FR-012）：M1 的到期提醒信只寫入本機，不會真的寄出。
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, RefreshCw } from "lucide-react";
import { db } from "../lib/storage";
import { DexieOutboxStore } from "../lib/reminderDispatch";
import { runReminderCheck } from "../lib/reminder";
import type { OutboxEmail } from "../types";

const outboxStore = new DexieOutboxStore(db);

export default function OutboxPage() {
  const [emails, setEmails] = useState<OutboxEmail[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setEmails(await outboxStore.list());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleCheck() {
    setBusy(true);
    try {
      const summary = await runReminderCheck(new Date());
      await reload();
      setStatus(
        `已檢查 ${summary.checked} 份合約（${summary.todayKey}）：本次新增 ${summary.sent.length} 封，略過已寄過的 ${summary.skippedDuplicate} 封。`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">模擬寄件匣</h1>
          <p className="text-sm text-slate-600 mt-1">
            依每份合約設定的提醒天數（另固定在到期前 7 天與當天）產生的到期提醒信。
          </p>
        </div>
        <button
          onClick={() => void handleCheck()}
          disabled={busy}
          data-testid="run-reminder-check"
          className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 self-start"
        >
          <RefreshCw size={16} /> 立即檢查提醒
        </button>
      </header>

      <div
        className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
        data-testid="outbox-mock-notice"
      >
        這裡的信件都是本機模擬，沒有實際寄出，也沒有連到任何 Email 服務。
      </div>

      {status && (
        <div className="text-sm text-emerald-700" data-testid="outbox-status">
          {status}
        </div>
      )}

      {emails.length === 0 ? (
        <div className="text-slate-500 text-sm py-8 text-center bg-white rounded-xl border border-slate-200">
          <Mail className="mx-auto mb-2 text-slate-400" />
          寄件匣目前沒有信件
        </div>
      ) : (
        <div className="space-y-3" data-testid="outbox-list">
          {emails.map((email) => (
            <article
              key={email.id}
              data-testid="outbox-email"
              className="bg-white rounded-xl border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="px-2 py-0.5 rounded bg-slate-100">
                  預定日期 {email.scheduledFor}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100">
                  {email.threshold === 0
                    ? "到期當天"
                    : `到期前 ${email.threshold} 天`}
                </span>
                <Link
                  to={`/contracts/${email.contractId}`}
                  className="text-blue-600 hover:underline"
                >
                  檢視合約
                </Link>
              </div>
              <div className="font-semibold mt-2" data-testid="outbox-subject">
                {email.subject}
              </div>
              <div className="text-xs text-slate-600 mt-1" data-testid="outbox-to">
                收件人：
                {email.to.length > 0 ? email.to.join("、") : "（未設定收件人）"}
              </div>
              <pre
                className="mt-3 text-xs whitespace-pre-wrap text-slate-700 bg-slate-50 p-3 rounded"
                data-testid="outbox-body"
              >
                {email.body}
              </pre>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
