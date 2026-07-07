import { readDataSources } from "./lib/dataSources";
import { writeIndicator } from "./lib/indicatorOutput";
import { findValue, numberValue, readRawTables, yearValue } from "./lib/tabular";
import { SEOUL_DISTRICT_NAMES } from "../lib/seoulDistricts";

const source = (await readDataSources()).crime_change;
const tables = await readRawTables(source.rawDir as string);
if (!tables.files.length) {
  await writeIndicator("crime_change", source, [], { dataStatus: "needs_stat_download", missingReason: `${source.rawDir}에 CSV/XLSX 파일이 없습니다.` });
  console.log("범죄 통계 원본 파일 없음: 빈 series 유지");
  process.exit(0);
}

const crimeAliases = [
  ["살인발생", "살인 발생건수", "살인"],
  ["강도발생", "강도 발생건수", "강도"],
  ["강간강제추행발생", "강간·강제추행 발생건수", "강간강제추행", "강간"],
  ["절도발생", "절도 발생건수", "절도"],
  ["폭력발생", "폭력 발생건수", "폭력"],
];
const counts = new Map<string, { value: number; confidence: "exact" | "gu_proxy" }>();
let rejected = 0;
for (const row of tables.rows) {
  const year = yearValue(findValue(row, ["연도", "년도", "시점", "기간", "year"]));
  const place = String(findValue(row, ["자치구", "구별", "지역", "구", "경찰서", "관서명"]) ?? "");
  const district = [...SEOUL_DISTRICT_NAMES].find((name) => place.includes(name));
  const values = crimeAliases.map((aliases) => numberValue(findValue(row, aliases)));
  if (!year || !district || values.some((value) => value === null)) { rejected += 1; continue; }
  const value = values.reduce<number>((sum, item) => sum + (item as number), 0);
  const confidence = /경찰서|경찰청|관서/.test(Object.keys(row).join(" ")) ? "gu_proxy" as const : "exact" as const;
  const key = `${district}:${year}`;
  const current = counts.get(key);
  counts.set(key, { value: (current?.value ?? 0) + value, confidence: current?.confidence === "gu_proxy" || confidence === "gu_proxy" ? "gu_proxy" : "exact" });
}

const series = [...counts].map(([key, item]) => {
  const [district, year] = key.split(":");
  return { district, year: Number(year), value: item.value, unit: "건", dataStatus: "available" as const, confidence: item.confidence };
});
await writeIndicator("crime_change", source, series, { spatialLevel: series.some((row) => row.confidence === "gu_proxy") ? "police_station_proxy" : "gu", metadata: { inputFiles: tables.files, inputRows: tables.rows.length, rejectedRows: rejected } });
console.log(`5대 범죄 ${tables.rows.length}행 처리, ${series.length}개 구-연도 원자료 생성`);

