import path from "node:path";
import { readFile } from "node:fs/promises";
import { DATA_DIR, readJson } from "./lib/io";
import { readDataSources } from "./lib/dataSources";
import { SEOUL_DISTRICTS } from "../lib/seoulDistricts";

type SeriesRow = { district: string; year: number; value: number; unit: string; dataStatus: string };
type IndicatorFile = { indicatorCode: string; sourceName: string; unit?: string; dataStatus?: string; availableYears?: number[]; series: SeriesRow[]; changeRate?: unknown };
type Coverage = { districtCount: number; indicators: { indicatorCode: string; availableYears: number[]; availableDistrictCount: number; missingDistrictCount: number; dataStatus: string }[] };

const sources = await readDataSources();
const indicatorCodes = Object.keys(sources).filter((code) => code !== "urban_regen_standard");
const allowedDistricts = new Set(["서울 전체", ...SEOUL_DISTRICTS.map(([, name]) => name)]);
const forbiddenProductionTokens = ["mock", "sample", "fallback", "placeholder"];
let changeRateOnlyRecords = 0;

for (const indicatorCode of indicatorCodes) {
  const filePath = path.join(DATA_DIR, "indicators", `${indicatorCode}.json`);
  const text = await readFile(filePath, "utf8");
  const file = JSON.parse(text) as IndicatorFile;
  if (file.indicatorCode !== indicatorCode) throw new Error(`${indicatorCode}: indicatorCode 불일치`);
  if (!Array.isArray(file.series)) throw new Error(`${indicatorCode}: series 배열 없음`);
  if (Object.hasOwn(file, "changeRate")) throw new Error(`${indicatorCode}: production 원자료 파일에 changeRate 저장 금지`);
  if (forbiddenProductionTokens.some((token) => text.toLowerCase().includes(token))) throw new Error(`${indicatorCode}: 금지 production 토큰 발견`);
  const seen = new Set<string>();
  for (const row of file.series) {
    const key = `${row.district}:${row.year}`;
    if (seen.has(key)) throw new Error(`${indicatorCode}: 중복 series ${key}`);
    seen.add(key);
    if (!allowedDistricts.has(row.district)) throw new Error(`${indicatorCode}: 서울 외 공간값 ${row.district}`);
    if (!Number.isInteger(row.year) || !Number.isFinite(row.value) || row.value < 0) throw new Error(`${indicatorCode}: 유효하지 않은 원자료 ${key}`);
    if (row.unit !== sources[indicatorCode].unit) throw new Error(`${indicatorCode}: unit 불일치 ${row.unit}`);
    if (Object.keys(row).some((keyName) => /changeRate|percent|ratio/i.test(keyName))) changeRateOnlyRecords += 1;
  }
  const years = [...new Set(file.series.map((row) => row.year))].toSorted((a, b) => a - b);
  if (JSON.stringify(years) !== JSON.stringify(file.availableYears ?? [])) throw new Error(`${indicatorCode}: availableYears 불일치`);
}

if (changeRateOnlyRecords) throw new Error(`changeRate/ratio series record ${changeRateOnlyRecords}건`);
const population = await readJson<IndicatorFile>(path.join(DATA_DIR, "indicators", "population_change.json"));
if (population.series.length !== 275 || new Set(population.series.map((row) => row.district)).size !== 25) throw new Error("population_change production series 보존 실패");
const coverage = await readJson<Coverage>(path.join(DATA_DIR, "meta", "data_coverage.json"));
if (coverage.districtCount !== 25 || coverage.indicators.length !== indicatorCodes.length) throw new Error("coverage 기본 구조 불일치");
for (const item of coverage.indicators) {
  if (item.availableDistrictCount + item.missingDistrictCount !== 25) throw new Error(`${item.indicatorCode}: coverage 합계 불일치`);
}
console.log(`coverage validation passed: indicators=${indicatorCodes.length}, populationRows=${population.series.length}, changeRateOnlyRecords=0`);

