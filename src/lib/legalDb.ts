// Risk evaluation engine (F-003 + F-004)
// Pure rule-based: keyword overlap + clause-pattern rules
import type {
  ClauseRecord,
  ClauseType,
  Contract,
  LegalArticle,
  RiskIssue,
  RiskLevel,
} from "../types";

export interface RiskRule {
  type: ClauseType;
  triggers: RegExp[];
  apply: (
    snippet: string,
    matchedArticle: LegalArticle
  ) => RiskIssue | null;
}

// F-004 risk rules per clause type
export const RISK_RULES: RiskRule[] = [
  {
    type: "confidentiality",
    triggers: [
      /永久|無限期|forever|perpetual/gi,
      /(?:不{0,1}得使用|禁止使用|不得揭露|嚴禁洩漏).{0,12}(?:任何|所有|全部)/gi,
      /\d{1,3}\s*年.{0,4}(?:保密|不得)[\u4e00-\u9fa5A-Za-z0-9]{0,30}/gi,
    ],
    apply: (snippet, art) => {
      // Permanently/very long confidentiality → red; overbroad scope → yellow
      if (/永久|無限期|forever|perpetual|10\s*年(?:以上)?/gi.test(snippet)) {
        return {
          issue: `保密條款範圍過廣或期限過長：「${snippet.slice(
            0,
            60
          )}...」`,
          suggestion:
            "建議明確列舉機密範圍，並將保密期縮短為 2-5 年。",
          legalRef: art.id,
          severity: "red",
        };
      }
      if (
        /(任何|所有|全部).{0,5}(資料|資訊|文件)/gi.test(snippet)
      ) {
        return {
          issue: `保密範圍過於概括：「${snippet.slice(0, 60)}...」`,
          suggestion:
            "應以列舉方式定義機密範圍，並排除已公開或受領方獨立開發之資訊。",
          legalRef: art.id,
          severity: "yellow",
        };
      }
      return null;
    },
  },
  {
    type: "penalty",
    triggers: [
      /.{0,4}(?:契約|合約|價金|報酬|租金|總額).{0,4}之[\u4e00-\u9fa5\d]{1,4}(?:%|百分之)/gi,
      /(每日|每逾一日|每逾期一日|per day)/gi,
    ],
    apply: (snippet, art) => {
      // Very high penalty → red
      const percentMatch = snippet.match(/(\d{1,3})\s*(?:%|百分之)/);
      if (percentMatch) {
        const pct = parseInt(percentMatch[1], 10);
        if (pct >= 30) {
          return {
            issue: `違約金可能過高（${pct}%）：「${snippet.slice(
              0,
              60
            )}...」`,
            suggestion:
              "民法 §252 規定違約金過高者法院得酌減，建議將違約金上限控制在合理範圍。",
            legalRef: art.id,
            severity: "red",
          };
        }
      }
      if (/(每日|per day)/gi.test(snippet)) {
        return {
          issue: `按日累計違約金：「${snippet.slice(0, 60)}...」`,
          suggestion:
            "建議設定違約金上限，避免累積天數過多導致金額過於龐大。",
          legalRef: art.id,
          severity: "yellow",
        };
      }
      return null;
    },
  },
  {
    type: "ip",
    triggers: [
      /(?:所有|全部).{0,4}(?:智慧財產|著作權|專利|商標).{0,4}(?:歸|屬).{0,4}(?:甲方|乙方|僱主|業主)/gi,
      /(?:無條件|永久|全球|不限地域)/gi,
    ],
    apply: (snippet, art) => {
      // Unfavorable, perpetual, broad IP assignment → yellow/red
      if (
        /(?:所有|全部)/gi.test(snippet) &&
        /(智慧財產|著作權|專利|商標)/gi.test(snippet)
      ) {
        return {
          issue: `智慧財產權約定可能不利：「${snippet.slice(
            0,
            60
          )}...」`,
          suggestion:
            "建議明確列舉歸屬範圍，並限制地域、期間及用途。",
          legalRef: art.id,
          severity: "yellow",
        };
      }
      return null;
    },
  },
  {
    type: "term",
    triggers: [
      /(?:自動|默示)續約|視為.{0,8}續約/gi,
      /(?:不{0,1}得|禁止).{0,8}(?:終止|解除)/gi,
    ],
    apply: (snippet, art) => {
      if (/自動續約|視為.{0,4}續約/gi.test(snippet)) {
        return {
          issue: `條款含自動續約：「${snippet.slice(0, 60)}...」`,
          suggestion:
            "自動續約可能造成長期拘束，建議要求期滿前書面確認。",
          legalRef: art.id,
          severity: "yellow",
        };
      }
      return null;
    },
  },
];

// Match each clause against rules + articles
export interface RiskEvaluationResult {
  contractId: string;
  score: RiskLevel;
  issues: RiskIssue[];
  clauseUpdates: Map<string, Partial<ClauseRecord>>;
}

export function evaluateRisk(
  contractId: string,
  clauses: ClauseRecord[],
  articles: LegalArticle[]
): RiskEvaluationResult {
  const issues: RiskIssue[] = [];
  const clauseUpdates = new Map<string, Partial<ClauseRecord>>();

  for (const clause of clauses) {
    const matchedRefs: string[] = [];
    let clauseRisk: RiskLevel = "green";

    for (const rule of RISK_RULES) {
      if (rule.type !== clause.type) continue;
      for (const trigger of rule.triggers) {
        if (trigger.test(clause.originalText)) {
          // pick relevant law (privacy for confidentiality, civil_law for penalty etc.)
          const candidates = articles.filter(
            (a) =>
              (rule.type === "confidentiality" &&
                a.category === "trade_secret") ||
              (rule.type === "confidentiality" &&
                a.category === "privacy") ||
              (rule.type === "penalty" && a.category === "civil_law") ||
              (rule.type === "ip" &&
                (a.category === "copyright" || a.category === "civil_law")) ||
              (rule.type === "term" && a.category === "civil_law")
          );
          const art =
            candidates[Math.floor(Math.random() * candidates.length)] ||
            articles[0];
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
          trigger.lastIndex = 0;
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

  // Contract-level score: red if any red issue, else yellow if any yellow, else green
  let score: RiskLevel = "green";
  for (const iss of issues) {
    if (iss.severity === "red") {
      score = "red";
      break;
    }
    if (iss.severity === "yellow") score = "yellow";
  }

  return { contractId, score, issues, clauseUpdates };
}
