import path from "node:path";
import type { FeatureCollection, Geometry } from "geojson";
import { DATA_DIR, readJson } from "./lib/io";
import { readDataSources } from "./lib/dataSources";
import { writeIndicator } from "./lib/indicatorOutput";
import { findValue, numberValue, readRawTables, yearValue } from "./lib/tabular";
import { SEOUL_DISTRICT_NAMES } from "../lib/seoulDistricts";

type BoundaryProperties = { adm_nm?: string; name?: string };
type Position = [number, number];

function ringContains(point: Position, ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polygonContains(point: Position, polygon: Position[][]) {
  return polygon.length > 0 && ringContains(point, polygon[0]) && polygon.slice(1).every((ring) => !ringContains(point, ring));
}

function geometryContains(point: Position, geometry: Geometry) {
  if (geometry.type === "Polygon") return polygonContains(point, geometry.coordinates as Position[][]);
  if (geometry.type === "MultiPolygon") return (geometry.coordinates as Position[][][]).some((polygon) => polygonContains(point, polygon));
  return false;
}

const source = (await readDataSources()).illegal_parking;
const districtNames: Set<string> = SEOUL_DISTRICT_NAMES;
const tables = await readRawTables(source.rawDir as string);
if (!tables.files.length) {
  await writeIndicator("illegal_parking", source, [], { dataStatus: "needs_file_download", missingReason: `${source.rawDir}에 CSV/XLSX 파일이 없습니다.` });
  console.log("불법주정차 원본 파일 없음: 빈 series 유지");
  process.exit(0);
}

const boundary = await readJson<FeatureCollection<Geometry, BoundaryProperties>>(path.join(DATA_DIR, "geo", "seoul_gu.geojson"));
const counts = new Map<string, number>();
let unmatched = 0;
for (const row of tables.rows) {
  const year = yearValue(findValue(row, ["단속일시", "단속일자", "단속일", "date", "datetime"]));
  const address = String(findValue(row, ["단속주소", "주소", "도로명주소", "지번주소", "address"]) ?? "");
  let district: string | undefined = [...SEOUL_DISTRICT_NAMES].find((name) => address.includes(name));
  if (!district) {
    const latitude = numberValue(findValue(row, ["위도", "lat", "latitude", "y"]));
    const longitude = numberValue(findValue(row, ["경도", "lng", "lon", "longitude", "x"]));
    if (latitude !== null && longitude !== null) {
      const feature = boundary.features.find((item) => geometryContains([longitude, latitude], item.geometry));
      const fullName = feature?.properties?.adm_nm ?? feature?.properties?.name ?? "";
      district = fullName.split(/\s+/).at(-1);
    }
  }
  if (!year || !district || !districtNames.has(district)) { unmatched += 1; continue; }
  const key = `${district}:${year}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

const series = [...counts].map(([key, value]) => {
  const [district, year] = key.split(":");
  return { district, year: Number(year), value, unit: "건", dataStatus: "available" as const, confidence: "exact" as const };
});
await writeIndicator("illegal_parking", source, series, { spatialLevel: "gu", metadata: { inputFiles: tables.files, inputRows: tables.rows.length, unmatchedRows: unmatched } });
console.log(`불법주정차 ${tables.rows.length}행 처리, ${series.length}개 구-연도 원자료 생성`);
