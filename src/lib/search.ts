// FlexSearch 全文搜尋（FR-019）：標題／對方／內文，中文以單字＋bigram 編碼
import * as FlexSearchNS from "flexsearch";
import type { Contract } from "../types";
import { listContracts } from "./storage";

type FlexSearchDocument<T extends { id: string }> = {
  add(doc: T): void;
  search(
    query: string | string[],
    options?: { limit?: number; suggest?: boolean; enrich?: boolean }
  ): Array<{ field: string; result: Array<string | number> }>;
  remove(id: string): void;
  update(doc: T): void;
};

// FlexSearch 的 ESM bundle 只有 default export（{ Index, Document, ... }），CJS／UMD 則直接掛在模組上；
// 兩種形狀都要支援，否則 production build 會出現「Document is not a constructor」。
type FlexSearchModule = {
  Document: new <T extends { id: string }>(
    options: any
  ) => FlexSearchDocument<T>;
};
const flexSearchNamespace = FlexSearchNS as unknown as FlexSearchModule & {
  default?: FlexSearchModule;
};
const FlexSearch: FlexSearchModule =
  typeof flexSearchNamespace.Document === "function"
    ? flexSearchNamespace
    : (flexSearchNamespace.default as FlexSearchModule);

const CJK_RUN = /[\u3400-\u9fff]+/g;
const LATIN_WORD = /[a-z0-9]+/g;

/**
 * 中英文共用的編碼器（索引與查詢都用同一個）。
 * FlexSearch 預設的編碼器會把 CJK 字元全部丟掉，所以中文關鍵字查不到任何結果。
 * - 英數：轉小寫後以單字為單位（搭配 forward tokenizer 可做前綴比對）
 * - 中文：每一段連續中文拆成「單字＋相鄰兩字（bigram）」
 * 查詢的所有詞都必須命中（AND），因此「自動續約」需要 自動／動續／續約 都出現才算符合。
 */
export function encodeForSearch(text: string): string[] {
  const lower = (text ?? "").toLowerCase();
  const terms = new Set<string>();
  for (const word of lower.match(LATIN_WORD) ?? []) terms.add(word);
  for (const run of lower.match(CJK_RUN) ?? []) {
    for (let i = 0; i < run.length; i++) {
      terms.add(run[i]);
      if (i < run.length - 1) terms.add(run.slice(i, i + 2));
    }
  }
  return [...terms];
}

let docIndex: FlexSearchDocument<Contract> | null = null;
let indexed = false;

export function buildSearchIndex() {
  docIndex = new FlexSearch.Document<Contract>({
    document: {
      id: "id",
      index: ["title", "extractedText", "counterparty"],
    },
    tokenize: "forward",
    encode: encodeForSearch,
  });
  indexed = false;
}

export async function ensureIndex(): Promise<FlexSearchDocument<Contract>> {
  if (!docIndex) buildSearchIndex();
  if (!indexed) {
    const contracts = await listContracts();
    for (const c of contracts) {
      docIndex!.add({ ...c, extractedText: c.extractedText || "" });
    }
    indexed = true;
  }
  return docIndex!;
}

export function invalidateIndex() {
  indexed = false;
}

export type SearchField = "title" | "extractedText" | "counterparty";

export const SEARCH_FIELD_LABELS: Record<SearchField, string> = {
  title: "標題",
  extractedText: "內文",
  counterparty: "對方",
};

const SEARCH_LIMIT = 100;

/**
 * 搜尋合約的標題、對方與內文。每次搜尋都從本機資料庫重建索引，
 * 因此剛改過標題或剛刪除的合約不會出現過期的結果（本機資料量小，重建成本可忽略）。
 * 同一份合約只回傳一次，field 為第一個命中的欄位（標題 → 內文 → 對方）。
 */
/**
 * 查詢拆成「詞」，邊界和編碼器一致：連續的中文為一個詞、連續的英數為一個詞
 * （「NDA保密」→ nda、保密；「甲方/乙方」→ 甲方、乙方）。每個詞都要以連續字串出現在命中的欄位中。
 */
export function queryPhrases(query: string): string[] {
  const lower = (query ?? "").toLowerCase();
  return [...(lower.match(CJK_RUN) ?? []), ...(lower.match(LATIN_WORD) ?? [])];
}

export async function searchContracts(
  query: string
): Promise<Array<{ id: string; field: string }>> {
  const phrases = queryPhrases(query);
  if (phrases.length === 0) return [];
  buildSearchIndex();
  const idx = await ensureIndex();
  const byId = new Map((await listContracts()).map((c) => [c.id, c]));
  const results = idx.search(query, { limit: SEARCH_LIMIT });
  const matches: Array<{ id: string; field: string }> = [];
  const seen = new Set<string>();
  for (const res of results) {
    for (const rawId of res.result ?? []) {
      const id = String(rawId);
      if (seen.has(id)) continue;
      // 索引用 bigram 找出候選；再確認完整詞真的連續出現，
      // 避免「自動」「動續」「續約」分散在不同位置時誤中「自動續約」（Codex 審查 #11）
      const value = String(
        (byId.get(id) as Record<string, unknown> | undefined)?.[res.field] ?? ""
      ).toLowerCase();
      if (!phrases.every((p) => value.includes(p))) continue;
      seen.add(id);
      matches.push({ id, field: res.field });
    }
  }
  return matches;
}
