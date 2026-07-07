import { fetchJson } from "./io";

export type PublicDataEnvelope<T> = {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: { items?: T[] | { item?: T | T[] }; totalCount?: number | string };
  };
  header?: { resultCode?: string; resultMsg?: string };
  body?: { items?: T[] | { item?: T | T[] }; totalCount?: number | string };
};

function asItems<T>(items: PublicDataEnvelope<T>["body"] extends never ? never : unknown): T[] {
  if (Array.isArray(items)) return items as T[];
  if (items && typeof items === "object" && "item" in items) {
    const item = (items as { item?: T | T[] }).item;
    if (!item) return [];
    return Array.isArray(item) ? item : [item];
  }
  return [];
}

export async function fetchPublicDataPage<T>(url: URL) {
  const payload = await fetchJson<PublicDataEnvelope<T>>(url);
  const root = payload.response ?? payload;
  const code = root.header?.resultCode;
  if (code && !["00", "0", "INFO-000"].includes(code)) {
    throw new Error(`Public Data API ${code}: ${root.header?.resultMsg ?? "unknown error"}`);
  }
  return {
    items: asItems<T>(root.body?.items),
    totalCount: Number(root.body?.totalCount ?? 0),
  };
}

export async function fetchAllPublicData<T>(
  baseUrl: string,
  params: Record<string, string>,
  pageSize = 1000,
) {
  const rows: T[] = [];
  let pageNo = 1;
  let totalCount = Number.POSITIVE_INFINITY;
  while (rows.length < totalCount) {
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("pageNo", String(pageNo));
    url.searchParams.set("numOfRows", String(pageSize));
    const page = await fetchPublicDataPage<T>(url);
    totalCount = page.totalCount;
    rows.push(...page.items);
    if (page.items.length === 0 || rows.length >= totalCount) break;
    pageNo += 1;
  }
  return rows;
}

export function decodedServiceKey(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}
