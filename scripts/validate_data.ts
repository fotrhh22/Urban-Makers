import path from "node:path";
import { access, readFile } from "node:fs/promises";
import { z } from "zod";
import { DATA_DIR, readJson } from "./lib/io";

const indicatorIds = ["population_change","floating_population_change","building_permit_change","housing_permit_change","employee_change","crime_change","vacant_house_change","complaints","illegal_parking"] as const;
const indicatorSchema = z.object({
  id: z.enum(indicatorIds), label: z.string().min(1), value: z.number().nullable(), unit: z.string(),
  formatted: z.string(), direction: z.enum(["up","down","flat"]), tone: z.enum(["positive","negative","neutral","info"]),
  comparison: z.string(), available: z.boolean(), series: z.array(z.object({ year: z.number().int(), value: z.number() })).optional(),
  baseYear: z.number().int().nullable(), compareYear: z.number().int().nullable(),
  baseValue: z.number().nullable(), compareValue: z.number().nullable(),
  confidence: z.enum(["exact", "gu_proxy"]).nullable(),
});
const dashboardSchema = z.array(z.object({
  districtCode: z.string(), districtName: z.string(), regenerationAreas: z.number().nonnegative(), lastUpdated: z.string(),
  indicators: z.array(indicatorSchema).superRefine((items, context) => {
    for (const id of indicatorIds) if (!items.some((item) => item.id === id)) context.addIssue({ code: "custom", message: `missing indicator: ${id}` });
  }),
})).length(26);

for (const file of ["urban_areas.json","anchor_facilities.json","dashboard_by_district.json","meta/indicator_meta.json","meta/source_meta.json","meta/data_coverage.json","geo/seoul_gu.geojson","geo/seoul_dong.geojson"]) await access(path.join(DATA_DIR, file));
const dashboard = dashboardSchema.parse(await readJson(path.join(DATA_DIR, "dashboard_by_district.json")));
if (dashboard.some((district) => district.indicators.some((indicator) => indicator.id.includes("startup") || indicator.id.includes("closure")))) throw new Error("Deferred startup/closure indicator found in dashboard");
await Promise.all(indicatorIds.map((id) => access(path.join(DATA_DIR, "indicators", `${id}.json`))));
for (const forbidden of [
  path.join(process.cwd(), "scripts", "fetch_publicdata_local_license.ts"),
  path.join(DATA_DIR, "indicators", "startup_closure.json"),
]) {
  try {
    await access(forbidden);
    throw new Error(`Forbidden phase-1 artifact exists: ${path.relative(process.cwd(), forbidden)}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
const allowedPublicDataKeyFiles = new Set(["fetch_publicdata_urban_regen.ts", "fetch_building_hub.ts"]);
for (const file of ["fetch_publicdata_urban_regen.ts", "fetch_building_hub.ts", "fetch_seoul_openapi.ts", "fetch_kosis.ts", "fetch_sgis_boundary.ts", "geocode_urban_areas.ts", "geocode_anchor_facilities.ts", "build_indicators.ts", "build_dashboard_json.ts"]) {
  const source = await readFile(path.join(process.cwd(), "scripts", file), "utf8");
  if (source.includes("DATA_GO_KR_SERVICE_KEY") && !allowedPublicDataKeyFiles.has(file)) throw new Error(`DATA_GO_KR_SERVICE_KEY used by unauthorized ETL: ${file}`);
}
console.log(`validation passed: ${dashboard.length} district records, ${indicatorIds.length} active indicators, startup/closure deferred`);
