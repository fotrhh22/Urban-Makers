import path from "node:path";
import { DATA_DIR, readJson } from "./lib/io";
import { SEOUL_DISTRICT_NAMES } from "../lib/seoulDistricts";

type Feature = { properties: Record<string, unknown>; geometry: { coordinates: unknown } };
type GeoJson = { features: Feature[] };
const geojson = await readJson<GeoJson>(path.join(DATA_DIR, "geo", "seoul_gu.geojson"));
const coordinates: [number, number][] = [];
function collect(value: unknown): void {
  if (!Array.isArray(value)) return;
  if (typeof value[0] === "number" && typeof value[1] === "number") coordinates.push([value[0], value[1]]);
  else value.forEach(collect);
}
geojson.features.forEach((feature) => collect(feature.geometry.coordinates));
const names = geojson.features.map((feature) => String(feature.properties.adm_nm ?? feature.properties.name ?? "").split(" ").at(-1) ?? "");
const bbox = [Math.min(...coordinates.map(([x]) => x)), Math.min(...coordinates.map(([, y]) => y)), Math.max(...coordinates.map(([x]) => x)), Math.max(...coordinates.map(([, y]) => y))];
const isWgs84 = bbox[0] >= 124 && bbox[2] <= 132 && bbox[1] >= 33 && bbox[3] <= 39;
const invalid = coordinates.filter(([longitude, latitude]) => longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90);
const missing = [...SEOUL_DISTRICT_NAMES].filter((name) => !names.includes(name));

console.log(`seoul_gu.geojson feature 개수: ${geojson.features.length}`);
console.log(`자치구명 목록: ${names.join(", ")}`);
console.log(`좌표계 추정 결과: ${isWgs84 ? "EPSG:4326 (경위도)" : "투영좌표 또는 알 수 없음"}`);
console.log(`좌표 범위: ${bbox.join(", ")}`);
console.log(`위도/경도 범위 이상 여부: ${invalid.length ? `이상 ${invalid.length}개` : "없음"}`);
if (geojson.features.length !== 25 || missing.length || !isWgs84 || invalid.length) throw new Error(`GeoJSON 검증 실패 (누락: ${missing.join(", ") || "없음"})`);
