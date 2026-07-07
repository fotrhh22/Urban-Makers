import type { DistrictDashboard, IndicatorValue } from "./types";

export function getAvailableYears(districts: DistrictDashboard[]): number[] {
  return [...new Set(districts.flatMap((district) => district.indicators.flatMap((indicator) => indicator.series?.map((point) => point.year) ?? [])))].toSorted((a, b) => a - b);
}

export function calculateIndicator(item: IndicatorValue, baseYear: number | null, compareYear: number | null): IndicatorValue {
  if (item.dataStatus === "recent_only") {
    const latest = item.series?.at(-1);
    return {
      ...item,
      value: null,
      changeRate: null,
      formatted: latest ? `${latest.value.toLocaleString("ko-KR")}${item.unit}` : "자료준비필요",
      direction: "flat",
      tone: "neutral",
      comparison: latest ? `${latest.year}년 최근값 (변화율 미산정)` : "자료준비필요",
      available: false,
      baseYear: null,
      compareYear: latest?.year ?? null,
      baseValue: null,
      compareValue: latest?.value ?? null,
      confidence: latest ? item.confidence ?? "exact" : null,
    };
  }
  const base = item.series?.find((point) => point.year === baseYear);
  const compare = item.series?.find((point) => point.year === compareYear);
  let dataStatus = item.dataStatus;
  const preparationStatuses = new Set(["needs_file_download", "needs_stat_download", "needs_kosis_dimension_check", "needs_check", "configured", "source_unavailable"]);
  if (!item.series?.length && !preparationStatuses.has(dataStatus)) dataStatus = "source_unavailable";
  else if (!base && !compare) dataStatus = "missing_both";
  else if (!base) dataStatus = "missing_base";
  else if (!compare) dataStatus = "missing_compare";
  else if (base.value === 0) dataStatus = "zero_base";
  else dataStatus = "available";
  const value = dataStatus === "available" && base && compare ? Math.round(((compare.value - base.value) / Math.abs(base.value)) * 1000) / 10 : null;
  const inversePositive = ["crime_change", "vacant_house_change", "complaints", "illegal_parking"].includes(item.id);
  const direction = value === null || value === 0 ? "flat" : value > 0 ? "up" : "down";
  const tone = value === null || value === 0 ? "neutral" : inversePositive ? (value < 0 ? "positive" : "negative") : (value > 0 ? "positive" : "negative");
  return {
    ...item,
    value,
    changeRate: value,
    formatted: value === null ? "자료준비필요" : `${value > 0 ? "+" : ""}${value}%`,
    direction,
    tone,
    comparison: baseYear && compareYear ? `${baseYear}년 대비 ${compareYear}년` : "자료준비필요",
    available: value !== null,
    baseYear: base?.year ?? null,
    compareYear: compare?.year ?? null,
    baseValue: base?.value ?? null,
    compareValue: compare?.value ?? null,
    confidence: value === null ? null : item.confidence ?? "exact",
    dataStatus,
  };
}

export function formatOriginalValue(value: number | null, unit: string): string {
  return value === null ? "자료준비필요" : `${value.toLocaleString("ko-KR")}${unit}`;
}
