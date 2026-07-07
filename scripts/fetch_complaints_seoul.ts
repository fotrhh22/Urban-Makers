import path from "node:path";
import { ROOT, fetchJson, requireEnv, writeJson } from "./lib/io";
import { readDataSources } from "./lib/dataSources";
import { writeIndicator } from "./lib/indicatorOutput";
import { SEOUL_DISTRICT_NAMES } from "../lib/seoulDistricts";

type SeoulBody = { list_total_count?: number; RESULT?: { CODE?: string; MESSAGE?: string }; row?: Record<string, unknown>[] };
type SeoulResponse = Record<string, SeoulBody>;

const source = (await readDataSources()).complaints;
if (!source.serviceName || !source.requestUrlTemplate) {
  await writeIndicator("complaints", source, [], { dataStatus: "needs_check", missingReason: "config에 serviceName 또는 requestUrlTemplate이 없습니다." });
  process.exit(0);
}

const key = requireEnv("SEOUL_OPEN_API_KEY");
const rows: Record<string, unknown>[] = [];
let start = 1;
let total = Number.POSITIVE_INFINITY;
while (start <= total) {
  const end = start + 999;
  const url = source.requestUrlTemplate
    .replace("{SEOUL_OPEN_API_KEY}", encodeURIComponent(key))
    .replace("{START_INDEX}", String(start))
    .replace("{END_INDEX}", String(end));
  const payload = await fetchJson<SeoulResponse>(url);
  const body = payload[source.serviceName];
  if (!body) throw new Error(`서울 OpenAPI 응답에 ${source.serviceName} 루트가 없습니다.`);
  if (body.RESULT?.CODE && body.RESULT.CODE !== "INFO-000") throw new Error(`${body.RESULT.CODE}: ${body.RESULT.MESSAGE ?? "서울 OpenAPI 오류"}`);
  total = Number(body.list_total_count ?? 0);
  rows.push(...(body.row ?? []));
  start += 1000;
}
await writeJson(path.join(ROOT, "data", "raw", "complaints", "SmartUncomfStatSector.json"), { fetchedAt: new Date().toISOString(), serviceName: source.serviceName, rows });

const districtKeys = ["DISTRICT", "DISTRICT_NM", "GU_NM", "SGG_NM", "SIGUNGU", "자치구", "구명"];
const counts = new Map<string, number>();
let hasDistrict = false;
for (const row of rows) {
  const year = Number(row.YEAR ?? row.YR ?? row.연도);
  const value = Number(row.RCPT_CNT_TOTAL ?? row.TOTAL_CNT ?? row.CNT ?? row.신고건수);
  if (!Number.isInteger(year) || !Number.isFinite(value)) continue;
  const rawDistrict = districtKeys.map((field) => row[field]).find((item) => item !== undefined && item !== null);
  const district = [...SEOUL_DISTRICT_NAMES].find((name) => String(rawDistrict ?? "").includes(name));
  if (district) hasDistrict = true;
  const place = district ?? "서울 전체";
  counts.set(`${place}:${year}`, (counts.get(`${place}:${year}`) ?? 0) + value);
}
const series = [...counts].map(([keyName, value]) => {
  const [district, year] = keyName.split(":");
  return { district, year: Number(year), value, unit: "건", dataStatus: "available" as const, confidence: "exact" as const };
});
await writeIndicator("complaints", source, series, { spatialLevel: hasDistrict ? "gu" : "city", metadata: { rawRows: rows.length, cityOnly: !hasDistrict } });
console.log(`생활불편 민원 ${rows.length}행 수집, ${series.length}개 연도 집계 (${hasDistrict ? "자치구" : "서울 전체"})`);

