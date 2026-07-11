// FlexSearch-based full-text search (F-007)
// Pre-tokenize Chinese text for indexing
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

// FlexSearch package typings are ambiguous; access via namespace and cast.
const FlexSearch = FlexSearchNS as unknown as {
  Document: new <T extends { id: string }>(
    options: any
  ) => FlexSearchDocument<T>;
};

// Simple Chinese-friendly splitter: split by character
// (For production we'd use Intl.Segmenter or jieba; this keeps deps small)
function tokenize(text: string): string {
  if (!text) return "";
  // Split into Unicode CJK chars (basic range) + latin words
  const tokens: string[] = [];
  const cjk = /[\u4e00-\u9fff]/g;
  const latin = /[a-zA-Z0-9]+/g;

  // Push full text as one token for substring search
  tokens.push(text);
  // Push individual CJK chars
  let m: RegExpExecArray | null;
  while ((m = cjk.exec(text)) !== null) tokens.push(m[0]);
  // Push latin words
  while ((m = latin.exec(text)) !== null) tokens.push(m[0]);
  // Push bigrams (more Chinese-friendly)
  const cjkOnly = text.replace(/[^\u4e00-\u9fff]/g, "");
  for (let i = 0; i < cjkOnly.length - 1; i++) {
    tokens.push(cjkOnly.slice(i, i + 2));
  }
  return tokens.join(" ");
}

let docIndex: FlexSearchDocument<Contract> | null = null;
let indexed = false;

export function buildSearchIndex() {
  docIndex = new FlexSearch.Document<Contract>({
    document: {
      id: "id",
      index: [
        {
          field: "title",
          tokenize: "forward",
        } as const,
        {
          field: "extractedText",
          tokenize: "forward",
        } as const,
        {
          field: "counterparty",
          tokenize: "forward",
        } as const,
      ],
    },
    tokenize: (text: string) => tokenize(text).split(" "),
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

export async function searchContracts(
  query: string
): Promise<Array<{ id: string; field: string }>> {
  if (!query.trim()) return [];
  const idx = await ensureIndex();
  // Use simple index search across all string fields
  const results = idx.search(query, { limit: 20, suggest: true });
  const matches: Array<{ id: string; field: string }> = [];
  for (const res of results) {
    if (res.result) {
      for (const id of res.result) {
        matches.push({ id: String(id), field: res.field });
      }
    }
  }
  return matches;
}
