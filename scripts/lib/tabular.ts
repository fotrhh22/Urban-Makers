import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import iconv from "iconv-lite";
import * as XLSX from "xlsx";
import { ROOT } from "./io";
import { parseCsv } from "./csv";

export type TabularRow = Record<string, string | number | null | undefined>;

function decodeCsv(buffer: Buffer) {
  const utf8 = buffer.toString("utf8");
  const invalid = (utf8.match(/�/g) ?? []).length;
  return invalid > 0 ? iconv.decode(buffer, "cp949") : utf8.replace(/^\uFEFF/, "");
}

export async function readRawTables(relativeDir: string) {
  const directory = path.resolve(ROOT, relativeDir);
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { directory, files: [], rows: [] as TabularRow[] };
    throw error;
  }
  const files = names.filter((name) => /\.(csv|xlsx|xls)$/i.test(name)).toSorted();
  const rows: TabularRow[] = [];
  for (const name of files) {
    const file = path.join(directory, name);
    const buffer = await readFile(file);
    if (/\.csv$/i.test(name)) rows.push(...parseCsv(decodeCsv(buffer)));
    else {
      const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
      for (const sheetName of workbook.SheetNames) {
        rows.push(...XLSX.utils.sheet_to_json<TabularRow>(workbook.Sheets[sheetName], { defval: null, raw: false }));
      }
    }
  }
  return { directory, files, rows };
}

export function normalizedKey(value: string) {
  return value.toLowerCase().replace(/[\s_()\-./]/g, "");
}

export function findValue(row: TabularRow, aliases: string[]) {
  const wanted = new Set(aliases.map(normalizedKey));
  const entry = Object.entries(row).find(([key]) => wanted.has(normalizedKey(key)));
  return entry?.[1] ?? null;
}

export function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value ?? "").replace(/[,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function yearValue(value: unknown) {
  const match = String(value ?? "").match(/(?:19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}
