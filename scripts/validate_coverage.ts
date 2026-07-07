import path from "node:path";
import { DATA_DIR, readJson } from "./lib/io";

type CoverageItem = { indicatorCode: string; availableYears: number[]; availableDistrictCount: number; missingDistrictCount: number; dataStatus: string; missingReason?: string };
type Coverage = { generatedAt: string; districtCount: number; indicators: CoverageItem[] };
type IndicatorFile = { indicatorCode: string; series: { district: string; year: number; value: number; dataStatus: string }[] };
const coverage = await readJson<Coverage>(path.join(DATA_DIR, "meta", "data_coverage.json"));
if (coverage.districtCount !== 25 || coverage.indicators.length !== 9) throw new Error("coverage 기본 구조 불일치");
for (const item of coverage.indicators) {
  if (item.availableDistrictCount + item.missingDistrictCount !== 25) throw new Error(`${item.indicatorCode}: 자치구 coverage 합계 불일치`);
  const indicator = await readJson<IndicatorFile>(path.join(DATA_DIR, "indicators", `${item.indicatorCode}.json`));
  const years = [...new Set(indicator.series.map((row) => row.year))].toSorted((a, b) => a - b);
  if (JSON.stringify(years) !== JSON.stringify(item.availableYears)) throw new Error(`${item.indicatorCode}: availableYears 불일치`);
  console.log(`${item.indicatorCode}: availableYears=[${item.availableYears.join(", ")}], missingDistrictCount=${item.missingDistrictCount}, dataStatus=${item.dataStatus}${item.missingReason ? `, missingReason=${item.missingReason}` : ""}`);
}
const population = await readJson<IndicatorFile>(path.join(DATA_DIR, "indicators", "population_change.json"));
if (population.series.length === 0 || new Set(population.series.map((row) => row.district)).size !== 25) throw new Error("population_change 실제 series가 불완전합니다.");
console.log(`population_change 실제 series 존재 여부: 예 (${population.series.length}행)`);
console.log("coverage validation passed");
