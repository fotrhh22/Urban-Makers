import path from "node:path";
import { ROOT, readJson } from "./io";

export type SourceStatus =
  | "available"
  | "configured"
  | "recent_only"
  | "needs_file_download"
  | "needs_stat_download"
  | "needs_kosis_dimension_check"
  | "needs_check"
  | "not_recommended"
  | "source_unavailable";

export type DataSource = {
  enabled: boolean;
  sourceType: string;
  sourceName: string;
  spatialLevel?: string;
  aggregationLevel?: string;
  unit?: string;
  status: SourceStatus;
  outputRule: string;
  rawDir?: string;
  serviceName?: string;
  requestUrlTemplate?: string;
  orgId?: string;
  tblId?: string;
  prdSe?: string;
  [key: string]: unknown;
};

export type DataSources = Record<string, DataSource>;

export async function readDataSources() {
  return readJson<DataSources>(path.join(ROOT, "config", "data_sources.json"));
}

