import dashboardData from "@/public/data/dashboard_by_district.json";
import urbanAreas from "@/public/data/urban_areas.json";
import indicatorMeta from "@/public/data/meta/indicator_meta.json";
import sourceMeta from "@/public/data/meta/source_meta.json";
import coverage from "@/public/data/meta/data_coverage.json";
import type { DistrictDashboard, UrbanArea } from "./types";

export const districts = dashboardData as DistrictDashboard[];
export const areas = urbanAreas as UrbanArea[];
export const metadata = indicatorMeta;
export const sources = sourceMeta;
export const dataCoverage = coverage;
