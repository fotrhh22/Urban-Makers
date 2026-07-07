import path from "node:path";
import { DATA_DIR, RAW_DIR, fetchJson, readJson, writeJson } from "./lib/io";
import { SEOUL_DISTRICTS } from "../lib/seoulDistricts";

type Boundary = { features: { properties: { adm_cd?: string; adm_nm?: string } }[] };
type Metadata = { vslzInfo?: { minYy?: string; maxYy?: string }; header?: { resultCode?: string; message?: string } };
type PopulationRow = { adm_cd?: string; stats_yr?: string; popl_cnt?: number };
type PopulationResponse = { data?: PopulationRow[]; header?: { resultCode?: string; message?: string } };

const sourceName = "서울 열린데이터광장";
const sourceUrl = "https://data.seoul.go.kr/bsp/wgs/gis/gis03.do";
const apiBase = "https://data.seoul.go.kr/bsp";
const metadata = await fetchJson<Metadata>(`${apiBase}/wgs/gis/vslz.do?tableId=32`);
if (metadata.header?.resultCode !== "ok") throw new Error(`인구 메타데이터 조회 실패: ${metadata.header?.message ?? "unknown"}`);

const sourceMinYear = Number(metadata.vslzInfo?.minYy);
const sourceMaxYear = Number(metadata.vslzInfo?.maxYy);
if (!Number.isInteger(sourceMinYear) || !Number.isInteger(sourceMaxYear)) throw new Error("인구 데이터 연도 범위를 확인할 수 없습니다.");
const requestedStartYear = Number(process.env.POPULATION_START_YEAR ?? 2015);
const requestedEndYear = Number(process.env.POPULATION_END_YEAR ?? sourceMaxYear);
if (!Number.isInteger(requestedStartYear) || !Number.isInteger(requestedEndYear)) {
  throw new Error("POPULATION_START_YEAR와 POPULATION_END_YEAR는 정수여야 합니다.");
}
const startYear = Math.max(sourceMinYear, requestedStartYear);
const endYear = Math.min(sourceMaxYear, requestedEndYear);
if (startYear > endYear) throw new Error(`수집할 인구 데이터 연도 범위가 없습니다: ${startYear}–${endYear}`);

const boundary = await readJson<Boundary>(path.join(DATA_DIR, "geo", "seoul_gu.geojson"));
const districtBySgisCode = new Map(boundary.features.map((feature) => [
  String(feature.properties.adm_cd ?? ""),
  String(feature.properties.adm_nm ?? "").split(" ").at(-1) ?? "",
]));
const expectedDistricts = new Set<string>(SEOUL_DISTRICTS.map(([, name]) => name));
const mappedDistricts = new Set([...districtBySgisCode.values()].filter((district) => expectedDistricts.has(district)));
const unmappedDistricts = [...expectedDistricts].filter((district) => !mappedDistricts.has(district));
if (unmappedDistricts.length) {
  throw new Error(`SGIS 자치구 경계 코드 누락: ${unmappedDistricts.join(", ")}`);
}
const rawByYear: { year: number; rows: PopulationRow[] }[] = [];
const series: { district: string; year: number; value: number; unit: "명"; dataStatus: "available" }[] = [];

for (let year = startYear; year <= endYear; year += 1) {
  const payload = await fetchJson<PopulationResponse>(`${apiBase}/wgs/gis/map.do?vslzId=3&scopCd=SGG&statsYr=${year}`);
  if (payload.header?.resultCode !== "ok") throw new Error(`${year}년 인구 조회 실패: ${payload.header?.message ?? "unknown"}`);
  const rows = payload.data ?? [];
  const seen = new Set<string>();
  for (const row of rows) {
    const district = districtBySgisCode.get(String(row.adm_cd ?? ""));
    const value = Number(row.popl_cnt);
    if (!district || !expectedDistricts.has(district)) continue;
    if (String(row.stats_yr ?? "") !== String(year)) throw new Error(`${year}년 응답에 다른 연도 포함: ${row.stats_yr ?? "없음"}`);
    if (!Number.isInteger(value) || value < 0) throw new Error(`${year}년 ${district} 인구 값 오류: ${row.popl_cnt ?? "없음"}`);
    if (seen.has(district)) throw new Error(`${year}년 인구 데이터 자치구 중복: ${district}`);
    seen.add(district);
    series.push({ district, year, value, unit: "명", dataStatus: "available" });
  }
  const missing = [...expectedDistricts].filter((district) => !seen.has(district));
  if (missing.length) throw new Error(`${year}년 인구 데이터 자치구 누락: ${missing.join(", ")}`);
  rawByYear.push({ year, rows });
  console.log(`${year}: 자치구 ${seen.size}개 수집`);
}

const expectedRowCount = (endYear - startYear + 1) * expectedDistricts.size;
if (series.length !== expectedRowCount) throw new Error(`인구 데이터 행 수 오류: 기대 ${expectedRowCount}, 실제 ${series.length}`);

const generatedAt = new Date().toISOString();
await writeJson(path.join(RAW_DIR, "seoul", "population_gu_yearly.json"), { sourceName, sourceUrl, generatedAt, rawByYear });
await writeJson(path.join(DATA_DIR, "indicators", "population_change.json"), {
  indicatorCode: "population_change",
  sourceName,
  sourceUrl,
  spatialLevel: "gu",
  generatedAt,
  availableYears: [...new Set(series.map((row) => row.year))],
  series,
});
console.log(`population_change production 생성: ${startYear}–${endYear}, ${series.length}행`);
