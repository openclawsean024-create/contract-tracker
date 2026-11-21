// Risk evaluation engine (FR-005 + FR-006)
// 純關鍵字／樣式規則比對，結果為決定性輸出：同一份輸入必得同一份結果（不使用亂數、不讀系統時鐘）。
// 規則比對可能漏判或誤判，不構成法律意見；法條對照未經律師覆核（M2）。
import type {
  ClauseRecord,
  ClauseType,
  LegalArticle,
  RiskCategory,
  RiskIssue,
  RiskLevel,
} from "../types";

export type RuleScope = "clause" | "document";

export interface RiskRule {
  /** 規則 ID：t-* 為 tracker 原有的條款層級規則；r1–r13 為併入 contract-reviewer 的全文層級規則 */
  id: string;
  type: ClauseType;
  /** clause＝只比對同類型條款片段；document＝比對合約全文（需呼叫端提供 fullText） */
  scope: RuleScope;
  /** info＝資訊提示，不計入風險分級 */
  kind: "risk" | "info";
  category: RiskCategory;
  title: string;
  /** 規則層級的預設修正建議（個別分支可在 apply 內覆寫） */
  suggestion: string;
  /** 固定對照的法條 ID；法條庫中找不到時退回 legalCategories 的第一筆 */
  legalRefId?: string;
  legalCategories: string[];
  triggers: RegExp[];
  /** document 規則：全部都要命中才成立 */
  requires?: RegExp[];
  /** document 規則：任何一個命中就不成立 */
  unless?: RegExp[];
  /**
   * document 規則：自訂比對（取代 triggers）。用於需要「逐次」判斷否定語的規則，
   * 只排除被否定的那一次命中，不會因同一句另有否定就整句不報。
   */
  find?: (sentence: string) => { index: number; length: number } | null;
  apply: (snippet: string, matchedArticle: LegalArticle) => RiskIssue | null;
}

const NO_ARTICLE: LegalArticle = {
  id: "",
  category: "",
  categoryLabel: "",
  title: "",
  summary: "",
  fullText: "",
  versionDate: "",
  source: "",
  riskKeywords: [],
};

/** 決定性的法條對照：固定 ID → 類別內第一筆 → 法條庫第一筆。不使用亂數。 */
export function pickArticle(
  rule: Pick<RiskRule, "legalRefId" | "legalCategories">,
  articles: LegalArticle[]
): LegalArticle {
  if (rule.legalRefId) {
    const fixed = articles.find((a) => a.id === rule.legalRefId);
    if (fixed) return fixed;
  }
  const byCategory = articles.find((a) =>
    rule.legalCategories.includes(a.category)
  );
  return byCategory ?? articles[0] ?? NO_ARTICLE;
}

/** 否定語：「不自動續約」「不得自動延長」「非自動續約」等不應視為自動續約 */
const AUTO_RENEWAL_ANY = /自動(?:續約|延長)/g;
/** 緊鄰的否定（不自動、不得自動、並不會自動）或「不因……而自動」 */
const RENEWAL_NEGATION_BEFORE =
  /(?:(?:不|無|非|不得|不會|不予|不再)\s*(?:會\s*)?|不因[^，,。；;]{0,10}而\s*)$/;

/** 第一個「未被否定」的自動續約／延長的位置 */
export function findAffirmativeAutoRenewal(
  text: string
): { index: number; length: number } | null {
  for (const m of text.matchAll(AUTO_RENEWAL_ANY)) {
    const before = text.slice(Math.max(0, m.index! - 14), m.index!);
    if (!RENEWAL_NEGATION_BEFORE.test(before)) return { index: m.index!, length: m[0].length };
  }
  return null;
}

/** 文字中是否有「未被否定」的自動續約／延長 */
export function hasAffirmativeAutoRenewal(text: string): boolean {
  return findAffirmativeAutoRenewal(text) !== null;
}

const UNILATERAL_ANY = /單方|本公司得/g;
/** 第一個「未被否定」的單方權利（排除「不得單方」「不可單方」「禁止單方」「無權單方」） */
export function findUnilateralRight(
  text: string
): { index: number; length: number } | null {
  for (const m of text.matchAll(UNILATERAL_ANY)) {
    const before = text.slice(Math.max(0, m.index! - 3), m.index!);
    if (!/(?:不得|不可|不能|禁止|無權)\s*$/.test(before)) return { index: m.index!, length: m[0].length };
  }
  return null;
}

/** 依句號、分號、問號、驚嘆號與換行切句；全文規則只在同一句內比對條件 */
/**
 * 句子邊界：句號、分號、問號、驚嘆號、空行，以及「下一行是新條次」的換行
 * （第X條、一、、（一）、1.、PDF 的 [Page N]）。其他單一換行視為貼上文字的硬換行，不切句。
 */
const SENTENCE_BOUNDARY =
  /[。；;！!？?]|\n\s*\n|\n(?=\s*(?:第[一二三四五六七八九十百零〇0-9０-９]+條|[一二三四五六七八九十]+、|[（(][一二三四五六七八九十0-9０-９]+[）)]|[0-9０-９]+[.、．]|\[Page\s))/g;

export function splitSentences(text: string): Array<{ text: string; offset: number }> {
  const out: Array<{ text: string; offset: number }> = [];
  let start = 0;
  const push = (end: number) => {
    const chunk = text.slice(start, end);
    if (chunk.trim()) out.push({ text: chunk, offset: start });
  };
  for (const m of text.matchAll(SENTENCE_BOUNDARY)) {
    push(m.index!);
    start = m.index! + m[0].length;
  }
  push(text.length);
  return out;
}

/** 取出命中位置所在那一行的片段（不跨行），方便使用者回頭找原文。 */
function excerpt(text: string, index: number, length: number): string {
  const lineStart = text.lastIndexOf("\n", index - 1) + 1;
  const nextBreak = text.indexOf("\n", index + length);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  const start = Math.max(lineStart, index - 30);
  const end = Math.min(lineEnd, index + length + 40);
  const body = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > lineStart ? "…" : ""}${body}${end < lineEnd ? "…" : ""}`;
}

interface DocumentRuleSpec {
  id: string;
  type: ClauseType;
  kind?: "risk" | "info";
  category: RiskCategory;
  severity: RiskLevel;
  title: string;
  explanation: string;
  suggestion: string;
  legalRefId?: string;
  legalCategories?: string[];
  triggers: RegExp[];
  requires?: RegExp[];
  unless?: RegExp[];
  find?: RiskRule["find"];
}

function documentRule(spec: DocumentRuleSpec): RiskRule {
  const kind = spec.kind ?? "risk";
  return {
    id: spec.id,
    type: spec.type,
    scope: "document",
    kind,
    category: spec.category,
    title: spec.title,
    suggestion: spec.suggestion,
    legalRefId: spec.legalRefId,
    legalCategories: spec.legalCategories ?? ["civil_law"],
    triggers: spec.triggers,
    requires: spec.requires,
    unless: spec.unless,
    find: spec.find,
    apply: (snippet, art) => ({
      ruleId: spec.id,
      issue: `${spec.title}：${spec.explanation}（比對到：「${snippet}」）`,
      suggestion: spec.suggestion,
      legalRef: kind === "info" ? "" : art.id,
      severity: kind === "info" ? "green" : spec.severity,
      category: spec.category,
      kind,
    }),
  };
}

// ---- tracker 原有的 4 類條款層級規則 ----
const CLAUSE_RULES: RiskRule[] = [
  {
    id: "t-confidentiality",
    type: "confidentiality",
    scope: "clause",
    kind: "risk",
    category: "validity",
    title: "保密條款範圍或期限",
    suggestion: "建議明確列舉機密範圍，並約定合理的保密期限。",
    legalRefId: "營業秘密法 §2",
    legalCategories: ["trade_secret", "privacy"],
    triggers: [
      /永久|無限期|forever|perpetual/i,
      /(?:不{0,1}得使用|禁止使用|不得揭露|嚴禁洩漏).{0,12}(?:任何|所有|全部)/i,
      /\d{1,3}\s*年.{0,4}(?:保密|不得)[一-龥A-Za-z0-9]{0,30}/i,
    ],
    apply: (snippet, art) => {
      // Permanently/very long confidentiality → red; overbroad scope → yellow
      if (/永久|無限期|forever|perpetual|10\s*年(?:以上)?/i.test(snippet)) {
        return {
          ruleId: "t-confidentiality",
          issue: `保密條款範圍過廣或期限過長：「${snippet.slice(
            0,
            60
          )}...」`,
          suggestion:
            "建議明確列舉機密範圍，並將保密期縮短為 2-5 年。",
          legalRef: art.id,
          severity: "red",
          category: "validity",
          kind: "risk",
        };
      }
      if (/(任何|所有|全部).{0,5}(資料|資訊|文件)/i.test(snippet)) {
        return {
          ruleId: "t-confidentiality",
          issue: `保密範圍過於概括：「${snippet.slice(0, 60)}...」`,
          suggestion:
            "應以列舉方式定義機密範圍，並排除已公開或受領方獨立開發之資訊。",
          legalRef: art.id,
          severity: "yellow",
          category: "validity",
          kind: "risk",
        };
      }
      return null;
    },
  },
  {
    id: "t-penalty",
    type: "penalty",
    scope: "clause",
    kind: "risk",
    category: "payment",
    title: "違約金比例或計算方式",
    suggestion: "建議設定違約金上限，並確認金額與可能損害相當。",
    legalRefId: "民法 §252",
    legalCategories: ["civil_law"],
    triggers: [
      /.{0,4}(?:契約|合約|價金|報酬|租金|總額).{0,4}之[一-龥\d]{1,4}(?:%|百分之)/i,
      /(每日|每逾一日|每逾期一日|per day)/i,
    ],
    apply: (snippet, art) => {
      // Very high penalty → red
      const percentMatch = snippet.match(/(\d{1,3})\s*(?:%|百分之)/);
      if (percentMatch) {
        const pct = parseInt(percentMatch[1], 10);
        if (pct >= 30) {
          return {
            ruleId: "t-penalty",
            issue: `違約金可能過高（${pct}%）：「${snippet.slice(
              0,
              60
            )}...」`,
            suggestion:
              "民法 §252 規定違約金過高者法院得酌減，建議將違約金上限控制在合理範圍。",
            legalRef: art.id,
            severity: "red",
            category: "payment",
            kind: "risk",
          };
        }
      }
      if (/(每日|per day)/i.test(snippet)) {
        return {
          ruleId: "t-penalty",
          issue: `按日累計違約金：「${snippet.slice(0, 60)}...」`,
          suggestion:
            "建議設定違約金上限，避免累積天數過多導致金額過於龐大。",
          legalRef: art.id,
          severity: "yellow",
          category: "payment",
          kind: "risk",
        };
      }
      return null;
    },
  },
  {
    id: "t-ip",
    type: "ip",
    scope: "clause",
    kind: "risk",
    category: "rights",
    title: "智慧財產權歸屬範圍",
    suggestion: "建議明確列舉歸屬範圍，並限制地域、期間及用途。",
    legalRefId: "著作權法 §36",
    legalCategories: ["copyright", "civil_law"],
    triggers: [
      /(?:所有|全部).{0,4}(?:智慧財產|著作權|專利|商標).{0,4}(?:歸|屬).{0,4}(?:甲方|乙方|僱主|業主)/i,
      /(?:無條件|永久|全球|不限地域)/i,
    ],
    apply: (snippet, art) => {
      // Unfavorable, perpetual, broad IP assignment → yellow/red
      if (
        /(?:所有|全部)/i.test(snippet) &&
        /(智慧財產|著作權|專利|商標)/i.test(snippet)
      ) {
        return {
          ruleId: "t-ip",
          issue: `智慧財產權約定可能不利：「${snippet.slice(
            0,
            60
          )}...」`,
          suggestion:
            "建議明確列舉歸屬範圍，並限制地域、期間及用途。",
          legalRef: art.id,
          severity: "yellow",
          category: "rights",
          kind: "risk",
        };
      }
      return null;
    },
  },
  {
    id: "t-term",
    type: "term",
    scope: "clause",
    kind: "risk",
    category: "validity",
    title: "自動續約或限制終止",
    suggestion: "自動續約可能造成長期拘束，建議要求期滿前書面確認。",
    legalRefId: "民法 §247-1",
    legalCategories: ["civil_law"],
    triggers: [
      /(?:自動|默示)續約|視為.{0,8}續約/i,
      /(?:不{0,1}得|禁止).{0,8}(?:終止|解除)/i,
    ],
    apply: (snippet, art) => {
      if (
        hasAffirmativeAutoRenewal(snippet) ||
        (/視為.{0,4}續約/i.test(snippet) && !/不(?:得)?視為.{0,4}續約/.test(snippet))
      ) {
        return {
          ruleId: "t-term",
          issue: `條款含自動續約：「${snippet.slice(0, 60)}...」`,
          suggestion:
            "自動續約可能造成長期拘束，建議要求期滿前書面確認。",
          legalRef: art.id,
          severity: "yellow",
          category: "validity",
          kind: "risk",
        };
      }
      return null;
    },
  },
];

// ---- 併入 contract-reviewer 的 13 條全文層級規則（M-04、M-05）----
// 分級對應：reviewer 的 high → 紅、medium → 黃；r8、r9 屬於「已約定」，改為資訊提示，不計入風險。
/** 「留待另議」「另行協商」「未約定」等表示尚未約定 */
/** 「留待另議」「另行協商」「待定」等，且必須與關鍵字在同一句、距離相近，避免整句誤殺 */
const UNDECIDED_WORDS = "另議|另行(?:協商|約定|議定|協議)|待定|未約定|尚未約定";
function undecidedNear(keywords: string): RegExp {
  return new RegExp(
    `(?:${keywords})[^。；;]{0,15}?(?:${UNDECIDED_WORDS})|(?:${UNDECIDED_WORDS})[^。；;]{0,8}?(?:${keywords})`
  );
}

/** 具體期間：1～3 位數或中文數字＋年／個月（排除 2026年 這類日期的年份） */
const PERIOD = "(?:(?<![0-9０-９])[0-9０-９]{1,3}|[一二三四五六七八九十兩]+)\\s*(?:年|個月)";
const CONFIDENTIALITY_PERIOD = new RegExp(
  `保密[^。；;]{0,15}?(?:期限|期間|${PERIOD}|屆滿|終止後)|${PERIOD}[^。；;]{0,10}?保密`
);

const MULTIPLIER = "(?:一倍|雙倍|三倍|[二兩三四五六七八九十]倍|[0-9０-９]+\\s*倍)";

const DOCUMENT_RULES: RiskRule[] = [
  documentRule({
    id: "r1",
    type: "other",
    category: "rights",
    severity: "red",
    title: "單方變更或決定條款",
    explanation: "條款可能讓其中一方單方變更、解除或加重義務",
    suggestion:
      "建議改為雙方書面同意後才能變更，並約定通知期間；簽署前請與律師確認。",
    legalRefId: "民法 §247-1",
    triggers: [/單方|本公司得/i],
    // 「不得單方變更」是限制單方權利，不是霸王條款；只排除被否定的那一次，
    // 「本公司得單方調整價格，乙方不得單方終止」仍會命中
    find: findUnilateralRight,
  }),
  documentRule({
    id: "r2",
    type: "penalty",
    category: "payment",
    severity: "red",
    title: "違約金以倍數計算",
    explanation: "違約金以標的金額的倍數計算，金額可能偏高",
    suggestion:
      "建議設定違約金上限並確認與可能損害相當；是否過高請諮詢律師。",
    legalRefId: "民法 §252",
    // 倍數必須直接修飾違約金（同一句、相距不遠），避免「違約金上限一千元；提供一倍備品」誤判
    triggers: [
      // 同一子句內，違約金直接接倍數
      new RegExp(`違約金[^。；;，,]{0,12}${MULTIPLIER}`),
      // 跨逗號時，倍數必須接在金額基準之後（總價、價金、報酬……），避免「違約金上限一千元，並提供一倍備品」誤判
      new RegExp(
        `違約金[^。；;]{0,20}?(?:總價|總額|價金|價款|報酬|金額|租金|費用)[^。；;，,]{0,4}${MULTIPLIER}`
      ),
      new RegExp(`${MULTIPLIER}[^。；;，,]{0,8}違約金`),
    ],
  }),
  documentRule({
    id: "r3",
    type: "term",
    category: "validity",
    severity: "red",
    title: "自動續約條款",
    explanation: "合約可能在未另行確認的情況下自動續約或延長",
    suggestion:
      "建議約定「到期前若干天以書面通知不續約」的機制，並在本工具設定到期提醒。",
    legalRefId: "民法 §247-1",
    triggers: [/自動續約|自動延長/i],
    // 逐次判斷否定，「附約不自動續約，但主約自動續約一年」仍會命中
    find: findAffirmativeAutoRenewal,
  }),
  documentRule({
    id: "r4",
    type: "other",
    category: "competition",
    severity: "red",
    title: "排他或獨家條款",
    explanation: "條款可能限制其中一方與其他對象交易",
    suggestion:
      "建議明確約定排他的範圍、地域與期間；是否涉及競爭法規請諮詢律師。",
    legalRefId: "公平交易法 §1",
    legalCategories: ["consumer_protection", "civil_law"],
    triggers: [/排他|獨家/i],
  }),
  documentRule({
    id: "r5",
    type: "ip",
    category: "rights",
    severity: "red",
    title: "智慧財產權歸屬未約定",
    explanation: "內文提到智慧財產，但沒有比對到歸屬約定",
    suggestion:
      "建議明確約定工作成果與衍生著作的權利歸屬與授權範圍。",
    legalRefId: "著作權法 §12",
    legalCategories: ["copyright", "civil_law"],
    triggers: [/智慧財產/i],
    unless: [/歸屬|歸(?:甲方|乙方|屬|於)|屬於(?:甲方|乙方)/i],
  }),
  documentRule({
    id: "r6",
    type: "liability",
    category: "damages",
    severity: "red",
    title: "無限責任條款",
    explanation: "條款可能要求其中一方承擔沒有上限的賠償責任",
    suggestion:
      "建議約定賠償責任上限（例如以合約總金額為限）並排除間接損害。",
    legalRefId: "民法 §247-1",
    triggers: [/無限責任|一切責任/i],
  }),
  documentRule({
    id: "r7",
    type: "confidentiality",
    category: "validity",
    severity: "yellow",
    title: "保密義務未約定期限",
    explanation: "內文提到保密，但沒有比對到期限約定",
    suggestion: "建議約定明確的保密期限與機密資訊範圍。",
    legalRefId: "營業秘密法 §2",
    legalCategories: ["trade_secret", "privacy"],
    triggers: [/保密/i],
    // 同一句內有期限或具體期間（例如「保密二年」「保密期間 3 年」）即視為已約定期限
    // 期限必須和「保密」相鄰才算已約定；「合作期間」或生效日期中的年份不算
    unless: [CONFIDENTIALITY_PERIOD],
  }),
  documentRule({
    id: "r8",
    type: "other",
    kind: "info",
    category: "dispute",
    severity: "green",
    title: "提及管轄或仲裁",
    explanation: "內文提到管轄法院或仲裁，請確認是否已明確約定",
    suggestion: "請確認是否已明確約定法院或仲裁地點，以及該地點對己方是否方便。",
    triggers: [/管轄|仲裁/i],
    unless: [undecidedNear("管轄|仲裁")],
  }),
  documentRule({
    id: "r9",
    type: "liability",
    kind: "info",
    category: "validity",
    severity: "green",
    title: "提及不可抗力",
    explanation: "內文提到不可抗力或天災，請確認處理方式是否已明確約定",
    suggestion: "請確認不可抗力的範圍、通知義務與處理方式是否明確。",
    triggers: [/不可抗力|天災/i],
    unless: [undecidedNear("不可抗力|天災")],
  }),
  documentRule({
    id: "r10",
    type: "termination",
    category: "rights",
    severity: "yellow",
    title: "提前或任意終止條款",
    explanation: "其中一方可能可以提前或任意終止合約",
    suggestion:
      "建議約定終止的預告期間，以及終止後的費用結算或補償方式。",
    legalRefId: "民法 §148",
    triggers: [/提前終止|任意終止/i],
  }),
  documentRule({
    id: "r11",
    type: "other",
    category: "rights",
    severity: "yellow",
    title: "權益轉讓條款",
    explanation: "合約的權利義務可能被轉讓給第三方",
    suggestion: "建議約定轉讓前須取得他方書面同意。",
    legalRefId: "民法 §299",
    triggers: [/權益轉讓|債權讓與/i],
  }),
  documentRule({
    id: "r12",
    type: "penalty",
    category: "payment",
    severity: "red",
    title: "懲罰性違約金",
    explanation: "條款使用懲罰性違約金或類似用語",
    suggestion:
      "建議確認違約金的性質（損害賠償預定或懲罰性）與金額上限，並諮詢律師。",
    legalRefId: "民法 §250",
    triggers: [/懲罰性|liquidated damages/i],
  }),
  documentRule({
    id: "r13",
    type: "other",
    category: "employment",
    severity: "yellow",
    title: "競業禁止條款",
    explanation: "條款可能限制離職或合約結束後的從業自由",
    suggestion:
      "建議確認競業的期間、地域、職務範圍與補償是否合理；效力請諮詢律師。",
    legalRefId: "營業秘密法 §10-1",
    legalCategories: ["trade_secret", "labor_standard", "civil_law"],
    triggers: [/競業|禁止從事/i],
  }),
];

export const RISK_RULES: RiskRule[] = [...CLAUSE_RULES, ...DOCUMENT_RULES];

// Match each clause against rules + articles
export interface RiskEvaluationResult {
  contractId: string;
  score: RiskLevel;
  /** 計入風險分級的項目 */
  issues: RiskIssue[];
  /** 資訊提示（kind === "info"），不計入風險分級 */
  infos: RiskIssue[];
  clauseUpdates: Map<string, Partial<ClauseRecord>>;
}

export interface EvaluateRiskOptions {
  /** 提供合約全文時才會執行 document 層級規則（r1–r13） */
  fullText?: string;
}

/** 全文規則：逐句比對，requires／unless 只看同一句，避免把不同條款的文字湊在一起判斷 */
function firstMatch(
  rule: RiskRule,
  text: string
): { index: number; length: number } | null {
  for (const sentence of splitSentences(text)) {
    if (rule.requires?.some((re) => !re.test(sentence.text))) continue;
    if (rule.unless?.some((re) => re.test(sentence.text))) continue;
    if (rule.find) {
      const found = rule.find(sentence.text);
      if (found) return { index: sentence.offset + found.index, length: found.length };
      continue;
    }
    for (const trigger of rule.triggers) {
      const m = trigger.exec(sentence.text);
      if (m) return { index: sentence.offset + m.index, length: m[0].length };
    }
  }
  return null;
}

export function evaluateRisk(
  contractId: string,
  clauses: ClauseRecord[],
  articles: LegalArticle[],
  options: EvaluateRiskOptions = {}
): RiskEvaluationResult {
  const issues: RiskIssue[] = [];
  const infos: RiskIssue[] = [];
  const clauseUpdates = new Map<string, Partial<ClauseRecord>>();

  for (const clause of clauses) {
    const matchedRefs: string[] = [];
    let clauseRisk: RiskLevel = "green";

    for (const rule of RISK_RULES) {
      if (rule.scope !== "clause" || rule.type !== clause.type) continue;
      for (const trigger of rule.triggers) {
        if (trigger.test(clause.originalText)) {
          const art = pickArticle(rule, articles);
          matchedRefs.push(art.id);
          const issue = rule.apply(clause.originalText, art);
          if (issue) {
            issues.push({ ...issue, clauseId: clause.id });
            if (
              issue.severity === "red" ||
              (issue.severity === "yellow" && clauseRisk === "green")
            ) {
              clauseRisk = issue.severity;
            }
          }
          break;
        }
      }
    }

    if (matchedRefs.length > 0) {
      clauseUpdates.set(clause.id, {
        riskLevel: clauseRisk,
        legalRefs: matchedRefs,
      });
    }
  }

  // Document 層級規則（併入的 13 條）：依 RISK_RULES 的固定順序逐條比對全文
  const fullText = options.fullText;
  if (typeof fullText === "string" && fullText.length > 0) {
    for (const rule of RISK_RULES) {
      if (rule.scope !== "document") continue;
      const m = firstMatch(rule, fullText);
      if (!m) continue;
      const art = pickArticle(rule, articles);
      const item = rule.apply(excerpt(fullText, m.index, m.length), art);
      if (!item) continue;
      if (rule.kind === "info") infos.push(item);
      else issues.push(item);
    }
  }

  // Contract-level score: red if any red issue, else yellow if any yellow, else green
  // （資訊提示不在 issues 內，因此不影響分級）
  let score: RiskLevel = "green";
  for (const iss of issues) {
    if (iss.severity === "red") {
      score = "red";
      break;
    }
    if (iss.severity === "yellow") score = "yellow";
  }

  return { contractId, score, issues, infos, clauseUpdates };
}
