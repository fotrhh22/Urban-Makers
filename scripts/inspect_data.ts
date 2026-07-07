import path from "node:path";
import { readdir } from "node:fs/promises";
import { DATA_DIR, readJson } from "./lib/io";
import { SEOUL_DISTRICTS } from "../lib/seoulDistricts";

type IndicatorFile = { indicatorCode: string; series: { district: string; year: number }[]; dataStatus?: string };
const areas = await readJson<unknown[]>(path.join(DATA_DIR, "urban_areas.json"));
const dashboard = await readJson<{ districtCode: string; districtName: string; indicators: { available: boolean }[] }[]>(path.join(DATA_DIR, "dashboard_by_district.json"));
const files = (await readdir(path.join(DATA_DIR, "indicators"))).filter((file) => file.endsWith(".json")).toSorted();
let sampleCount = 0;
console.log(`urban_areas.json 총 개수: ${areas.length}`);
console.log(`dashboard district count: ${dashboard.filter((row) => row.districtCode !== "11").length} + 서울 전체`);
console.log("indicator별 availableYears / missingDistrictCount:");
for (const file of files) {
  const indicator = await readJson<IndicatorFile & { status?: string }>(path.join(DATA_DIR, "indicators", file));
  if (indicator.status === "sample") sampleCount += 1;
  const years = [...new Set(indicator.series.map((row) => row.year))].toSorted((a, b) => a - b);
  const districts = new Set(indicator.series.map((row) => row.district));
  console.log(`- ${indicator.indicatorCode}: availableYears=[${years.join(", ")}], missingDistrictCount=${25 - districts.size}`);
}
const present = new Set(dashboard.filter((row) => row.districtCode !== "11").map((row) => row.districtName));
const missing = SEOUL_DISTRICTS.map(([, name]) => name).filter((name) => !present.has(name));
const population = await readJson<IndicatorFile>(path.join(DATA_DIR, "indicators", "population_change.json"));
console.log(`production indicator sample count = ${sampleCount}`);
console.log(`population_change 실제 series 존재 여부: ${population.series.length > 0 ? `예 (${population.series.length}행)` : "아니오"}`);
console.log(`dashboard 누락 자치구: ${missing.length ? missing.join(", ") : "없음"}`);
