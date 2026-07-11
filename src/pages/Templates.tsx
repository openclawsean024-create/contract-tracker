import { useEffect, useState } from "react";
import { Download, Edit3 } from "lucide-react";
import { useAppStore } from "../store";
import type { Template } from "../types";

export default function TemplatesPage() {
  const templates = useAppStore((s) => s.templates);
  const bootstrap = useAppStore((s) => s.bootstrap);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");

  useEffect(() => {
    if (templates.length === 0) void bootstrap();
  }, [templates.length, bootstrap]);

  function handleDownload(t: Template) {
    const blob = new Blob([t.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t.id}-${t.name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function startEdit(t: Template) {
    setEditingId(t.id);
    setDraft(t.content);
  }

  function saveEdit(t: Template) {
    const blob = new Blob([draft], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t.id}-${t.name}-編輯版.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setEditingId(null);
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">合約範本庫</h1>
        <p className="text-sm text-slate-600 mt-1">
          共 {templates.length} 種常見合約（F-006）— 可下載或編輯
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        {templates.map((t) => (
          <article
            key={t.id}
            className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col"
          >
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold flex-1">{t.name}</h3>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100">
                {t.category}
              </span>
            </div>
            <p className="text-sm text-slate-600 mb-2">{t.description}</p>
            <div className="text-xs flex flex-wrap gap-1 mb-3">
              {t.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700"
                >
                  #{tag}
                </span>
              ))}
            </div>

            {editingId === t.id ? (
              <div className="space-y-2">
                <textarea
                  className="w-full h-64 p-2 border border-slate-300 rounded text-sm font-mono"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(t)}
                    className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    下載編輯版
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 text-sm rounded bg-slate-100 text-slate-700"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 mt-auto">
                <button
                  onClick={() => handleDownload(t)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1"
                >
                  <Download size={14} /> 下載
                </button>
                <button
                  onClick={() => startEdit(t)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center gap-1"
                >
                  <Edit3 size={14} /> 編輯
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      <p className="text-xs text-slate-500 border-t pt-4">
        ⚠️ 範本僅供參考，簽署前建議諮詢律師（依律師法，非法律諮詢用途）
      </p>
    </div>
  );
}
