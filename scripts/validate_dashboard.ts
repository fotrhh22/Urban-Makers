import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { DATA_DIR, readJson } from "./lib/io";
import { SEOUL_DISTRICTS } from "../lib/seoulDistricts";

type Indicator = { id: string; value: number | null; baseValue: number | null; compareValue: number | null; available: boolean; dataStatus: string; sourceName: string };
type Dashboard = { districtCode: string; districtName: string; regenerationAreas: number; indicators: Indicator[] };
const dashboard = await readJson<Dashboard[]>(path.join(DATA_DIR, "dashboard_by_district.json"));
const districts = dashboard.filter((row) => row.districtCode !== "11");
const missing = SEOUL_DISTRICTS.filter(([code]) => !districts.some((row) => row.districtCode === code));
console.log(`dashboard district count = ${districts.length} + 서울 전체`);
console.log(`서울 25개 자치구 존재 여부: ${missing.length ? `실패 (${missing.map(([, name]) => name).join(", ")})` : "통과"}`);
for (const district of districts) console.log(`- ${district.districtName}: urbanAreas=${district.regenerationAreas}, indicators=${district.indicators.length}`);
const values = districts.flatMap((district) => district.indicators.flatMap((indicator) => [indicator.value, indicator.baseValue, indicator.compareValue]));
const nullCount = values.filter((value) => value === null).length;
console.log(`null 값 비율: ${((nullCount / values.length) * 100).toFixed(1)}% (${nullCount}/${values.length})`);
const files = (await readdir(path.join(DATA_DIR, "indicators"))).filter((file) => file.endsWith(".json"));
let sampleCount = 0;
for (const file of files) {
  const text = await readFile(path.join(DATA_DIR, "indicators", file), "utf8");
  if (/"status"\s*:\s*"sample"|"dataStatus"\s*:\s*"sample"/.test(text)) sampleCount += 1;
}
const source = await readFile(path.join(process.cwd(), "components", "dashboard.tsx"), "utf8");
const mockTokens = [...source.matchAll(/mockData|placeholderData|sampleData|fallbackIndicator|mockGeometry/g)];
console.log(`production indicator sample count = ${sampleCount}`);
console.log(`화면에서 sample value 사용 여부 = ${sampleCount + mockTokens.length}`);
if (missing.length || districts.length !== 25 || dashboard.length !== 26 || sampleCount || mockTokens.length) throw new Error("dashboard 검증 실패");
