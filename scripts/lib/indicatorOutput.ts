import path from "node:path";
import { DATA_DIR, writeJson } from "./io";
import type { DataSource, SourceStatus } from "./dataSources";

export type IndicatorSeriesRow = {
  district: string;
  year: number;
  value: number;
  unit: string;
  dataStatus: SourceStatus | "available";
  confidence?: "exact" | "gu_proxy" | "police_station_proxy";
};

export async function writeIndicator(
  indicatorCode: string,
  source: DataSource,
  series: IndicatorSeriesRow[],
  options: { dataStatus?: SourceStatus; spatialLevel?: string; missingReason?: string; metadata?: Record<string, unknown> } = {},
) {
  const sorted = series.toSorted((left, right) => left.year - right.year || left.district.localeCompare(right.district, "ko"));
  await writeJson(path.join(DATA_DIR, "indicators", `${indicatorCode}.json`), {
    indicatorCode,
    sourceName: source.sourceName,
    sourceType: source.sourceType,
    spatialLevel: options.spatialLevel ?? source.spatialLevel ?? "unknown",
    unit: source.unit ?? sorted[0]?.unit ?? "",
    dataStatus: options.dataStatus ?? (sorted.length ? "available" : source.status),
    missingReason: sorted.length ? null : options.missingReason ?? source.outputRule,
    generatedAt: new Date().toISOString(),
    availableYears: [...new Set(sorted.map((row) => row.year))],
    series: sorted,
    ...options.metadata,
  });
}

