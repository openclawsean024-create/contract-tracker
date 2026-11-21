import { DISCLAIMER_DRAFT_NOTE, DISCLAIMER_TEXT } from "../lib/disclaimer";

/** 固定的免責聲明（FR-021）。文案集中在 lib/disclaimer.ts，待 Sean 定稿。 */
export default function Disclaimer({
  testId = "disclaimer",
  className = "",
}: {
  testId?: string;
  className?: string;
}) {
  return (
    <p
      role="note"
      data-testid={testId}
      className={`text-xs leading-relaxed text-slate-600 ${className}`}
    >
      <span>{DISCLAIMER_TEXT}</span>
      <span className="ml-1 text-[10px] text-slate-400">
        （{DISCLAIMER_DRAFT_NOTE}）
      </span>
    </p>
  );
}
