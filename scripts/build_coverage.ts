import path from "node:path";
import { DATA_DIR, readJson, writeJson } from "./lib/io";
import { SEOUL_DISTRICTS } from "../lib/seoulDistricts";

type IndicatorFile = { indicatorCode: string; sourceName: string; series: { district: string; year: number }[]; dataStatus?: string; missingReason?: string };
const indicatorCodes = ["population_change","floating_population_change","building_permit_change","housing_permit_change","employee_change","crime_change","vacant_house_change","complaints","illegal_parking"];
const districtNames = new Set(SEOUL_DISTRICTS.map(([, name]) => name));
const indicators = [];
for (const indicatorCode of indicatorCodes) {
  const file = await readJson<IndicatorFile>(path.join(DATA_DIR, "indicators", `${indicatorCode}.json`));
  const availableYears = [...new Set(file.series.map((row) => row.year))].toSorted((a, b) => a - b);
  const availableDistricts = new Set(file.series.filter((row) => districtNames.has(row.district as never)).map((row) => row.district));
  const availableDistrictCount = availableDistricts.size;
  const missingDistrictCount = 25 - availableDistrictCount;
  const dataStatus = availableYears.length && availableDistrictCount === 25 ? "available" : file.dataStatus ?? "needs_check";
  indicators.push({
    indicatorCode,
    sourceName: file.sourceName,
    availableYears,
    availableDistrictCount,
    missingDistrictCount,
    dataStatus,
    ...(dataStatus === "available" ? {} : { missingReason: file.missingReason ?? "일부 자치구 또는 연도 누락" }),
  });
}
await writeJson(path.join(DATA_DIR, "meta", "data_coverage.json"), { generatedAt: new Date().toISOString(), districtCount: 25, indicators });
