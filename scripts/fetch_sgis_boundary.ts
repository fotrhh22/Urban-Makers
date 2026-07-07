import path from "node:path";
import proj4 from "proj4";
import { DATA_DIR, fetchJson, requireEnv, writeJson } from "./lib/io";

type AuthResponse = { result?: { accessToken?: string }; errMsg?: string };

const consumerKey = requireEnv("SGIS_CONSUMER_KEY");
const consumerSecret = requireEnv("SGIS_CONSUMER_SECRET");
const auth = new URL("https://sgisapi.kostat.go.kr/OpenAPI3/auth/authentication.json");
auth.searchParams.set("consumer_key", consumerKey);
auth.searchParams.set("consumer_secret", consumerSecret);
const authResult = await fetchJson<AuthResponse>(auth);
const token = authResult.result?.accessToken;
if (!token) throw new Error(`SGIS authentication failed: ${authResult.errMsg ?? "no token"}`);

type GeoJson = { type: "FeatureCollection"; features: Array<{ type: "Feature"; properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }> };

const EPSG_5179 = "+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs";

function projectCoordinates(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    const [longitude, latitude] = proj4(EPSG_5179, "EPSG:4326", value as [number, number]);
    return [Number(longitude.toFixed(7)), Number(latitude.toFixed(7))];
  }
  return value.map(projectCoordinates);
}

async function fetchBoundary(lowSearch: number): Promise<GeoJson> {
  const url = new URL("https://sgisapi.kostat.go.kr/OpenAPI3/boundary/hadmarea.geojson");
  url.searchParams.set("accessToken", token!);
  url.searchParams.set("year", process.env.SGIS_BOUNDARY_YEAR ?? "2024");
  url.searchParams.set("adm_cd", "11");
  url.searchParams.set("low_search", String(lowSearch));
  const geojson = await fetchJson<GeoJson>(url);
  for (const feature of geojson.features) feature.geometry.coordinates = projectCoordinates(feature.geometry.coordinates);
  return geojson;
}

const gu = await fetchBoundary(1);
if (gu.features.length !== 25) throw new Error(`서울 자치구 경계는 25개여야 합니다: ${gu.features.length}개`);
await writeJson(path.join(DATA_DIR, "geo", "seoul_gu.geojson"), gu);
await writeJson(path.join(DATA_DIR, "geo", "seoul_dong.geojson"), await fetchBoundary(2));
