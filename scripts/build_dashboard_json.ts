import path from "node:path";
import { DATA_DIR, percentChange, readJson, writeJson } from "./lib/io";
import { SEOUL_DISTRICTS } from "../lib/seoulDistricts";
import type { DataStatus } from "../lib/types";

type SeriesRow = { district: string; year: number; value: number; unit: string; dataStatus: string; confidence?: "exact" | "gu_proxy" | "police_station_proxy" };
type IndicatorFile = { indicatorCode: string; sourceName: string; spatialLevel: string; unit?: string; series: SeriesRow[]; dataStatus?: DataStatus; missingReason?: string };
type Area = { district: string };

const definitions = [
  ["population_change", "인구증감률", "명"], ["floating_population_change", "유동인구 변화", "명"],
  ["building_permit_change", "건축허가 증감률", "건"], ["housing_permit_change", "주택 인허가 증감률", "건"],
  ["employee_change", "종사자 증감률", "명"], ["crime_change", "범죄 발생 변화", "건"],
  ["vacant_house_change", "빈집 변화", "호"], ["complaints", "생활불편 민원", "건"],
  ["illegal_parking", "불법주정차 단속", "건"],
] as const;
const indicatorFiles = await Promise.all(definitions.map(async ([indicatorCode, label, defaultUnit]) => ({
  label, defaultUnit, data: await readJson<IndicatorFile>(path.join(DATA_DIR, "indicators", `${indicatorCode}.json`)),
})));
const areas = await readJson<Area[]>(path.join(DATA_DIR, "urban_areas.json"));
const districts = [["11", "서울 전체"], ...SEOUL_DISTRICTS] as readonly (readonly [string, string])[];
const allYears = [...new Set(indicatorFiles.flatMap(({ data }) => data.series.map((row) => row.year)))].toSorted((a, b) => a - b);
const baseYear = allYears.includes(2015) ? 2015 : allYears[0] ?? null;
const compareYear = allYears.at(-1) ?? null;
const inversePositive = new Set(["crime_change", "vacant_house_change", "complaints", "illegal_parking"]);

function districtSeries(file: IndicatorFile, districtName: string): SeriesRow[] {
  const direct = file.series.filter((row) => row.district === districtName);
  if (districtName !== "서울 전체" || direct.length) return direct.toSorted((a, b) => a.year - b.year);
  return [...new Set(file.series.map((row) => row.year))].toSorted((a, b) => a - b).flatMap((year) => {
    const rows = file.series.filter((row) => row.year === year && row.district !== "서울 전체");
    return new Set(rows.map((row) => row.district)).size === 25
      ? [{ district: "서울 전체", year, value: rows.reduce((sum, row) => sum + row.value, 0), unit: file.unit ?? rows[0]?.unit ?? "", dataStatus: "available" }]
      : [];
  });
}

function buildIndicator(file: IndicatorFile, label: string, defaultUnit: string, districtName: string) {
  const rows = districtSeries(file, districtName);
  const series = rows.map(({ year, value }) => ({ year, value }));
  const latest = rows.at(-1);
  const recentOnly = file.dataStatus === "recent_only";
  const cityUnavailableForGu = file.spatialLevel === "city" && districtName !== "서울 전체";
  const base = rows.find((row) => row.year === baseYear);
  const compare = rows.find((row) => row.year === compareYear);
  let dataStatus: DataStatus = file.dataStatus ?? "source_unavailable";
  if (recentOnly) dataStatus = "recent_only";
  else if (cityUnavailableForGu) dataStatus = "source_unavailable";
  else if (!rows.length) dataStatus = file.dataStatus ?? "source_unavailable";
  else if (!base && !compare) dataStatus = "missing_both";
  else if (!base) dataStatus = "missing_base";
  else if (!compare) dataStatus = "missing_compare";
  else if (base.value === 0) dataStatus = "zero_base";
  else dataStatus = "available";
  const changeRate = dataStatus === "available" && base && compare ? percentChange(compare.value, base.value) : null;
  const direction = changeRate === null || changeRate === 0 ? "flat" : changeRate > 0 ? "up" : "down";
  const tone = changeRate === null || changeRate === 0 ? "neutral" : inversePositive.has(file.indicatorCode) ? (changeRate < 0 ? "positive" : "negative") : (changeRate > 0 ? "positive" : "negative");
  const confidence = rows.some((row) => row.confidence === "police_station_proxy") ? "police_station_proxy" : rows.some((row) => row.confidence === "gu_proxy") ? "gu_proxy" : rows.length ? "exact" : null;
  return {
    id: file.indicatorCode, label, value: changeRate, changeRate, unit: file.unit ?? rows[0]?.unit ?? defaultUnit,
    formatted: changeRate === null ? "자료 준비 필요" : `${changeRate > 0 ? "+" : ""}${changeRate}%`,
    direction, tone,
    comparison: recentOnly && latest ? `${latest.year}년 최근값 (변화율 미산정)` : changeRate === null ? (file.missingReason ?? "비교 가능한 원자료 없음") : `${baseYear}년 대비 ${compareYear}년`,
    available: changeRate !== null,
    baseYear: recentOnly ? null : base?.year ?? null,
    compareYear: recentOnly ? latest?.year ?? null : compare?.year ?? null,
    baseValue: recentOnly ? null : base?.value ?? null,
    compareValue: recentOnly ? latest?.value ?? null : compare?.value ?? null,
    confidence, dataStatus, sourceName: file.sourceName, series,
  };
}

const dashboard = districts.map(([districtCode, districtName]) => ({
  districtCode, districtName,
  regenerationAreas: districtCode === "11" ? areas.length : areas.filter((area) => area.district === districtName).length,
  lastUpdated: compareYear ? String(compareYear) : "운영 데이터 없음",
  indicators: indicatorFiles.map(({ data, label, defaultUnit }) => buildIndicator(data, label, defaultUnit, districtName)),
}));
await writeJson(path.join(DATA_DIR, "dashboard_by_district.json"), dashboard);
