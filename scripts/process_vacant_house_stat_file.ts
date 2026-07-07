import { readDataSources } from "./lib/dataSources";
import { writeIndicator } from "./lib/indicatorOutput";
import { findValue, numberValue, readRawTables, yearValue } from "./lib/tabular";
import { SEOUL_DISTRICT_NAMES } from "../lib/seoulDistricts";

const source = (await readDataSources()).vacant_house_change;
const tables = await readRawTables(source.rawDir as string);
if (!tables.files.length) {
  await writeIndicator("vacant_house_change", source, [], { dataStatus: "needs_stat_download", missingReason: `${source.rawDir}에 CSV/XLSX 파일이 없습니다.` });
  console.log("빈집 통계 원본 파일 없음: 빈 series 유지");
  process.exit(0);
}

const counts = new Map<string, number>();
let rejected = 0;
for (const row of tables.rows) {
  const year = yearValue(findValue(row, ["연도", "년도", "시점", "기간", "year"]));
  const place = String(findValue(row, ["자치구", "구별", "지역", "구", "district"]) ?? "");
  const district = [...SEOUL_DISTRICT_NAMES].find((name) => place.includes(name));
  const value = numberValue(findValue(row, ["빈집수", "미거주주택", "미거주 주택 수", "계", "합계", "value"]));
  if (!year || !district || value === null || value < 0) { rejected += 1; continue; }
  counts.set(`${district}:${year}`, value);
}

const series = [...counts].map(([key, value]) => {
  const [district, year] = key.split(":");
  return { district, year: Number(year), value, unit: "호", dataStatus: "available" as const, confidence: "exact" as const };
});
await writeIndicator("vacant_house_change", source, series, { spatialLevel: "gu", metadata: { inputFiles: tables.files, inputRows: tables.rows.length, rejectedRows: rejected } });
console.log(`빈집 ${tables.rows.length}행 처리, ${series.length}개 구-연도 원자료 생성`);
