export type Direction = "up" | "down" | "flat";
export type Tone = "positive" | "negative" | "neutral" | "info";
export type DataStatus = "available" | "missing_base" | "missing_compare" | "missing_both" | "zero_base" | "recent_only" | "source_unavailable" | "needs_check" | "needs_file_download" | "needs_stat_download" | "needs_kosis_dimension_check" | "configured" | "not_recommended" | "data_preparation_required";
export type Confidence = "exact" | "gu_proxy" | "police_station_proxy";

export interface IndicatorValue {
  id: string;
  label: string;
  value: number | null;
  changeRate: number | null;
  unit: string;
  formatted: string;
  direction: Direction;
  tone: Tone;
  comparison: string;
  available: boolean;
  baseYear: number | null;
  compareYear: number | null;
  baseValue: number | null;
  compareValue: number | null;
  confidence: Confidence | null;
  dataStatus: DataStatus;
  sourceName: string;
  series?: { year: number; value: number }[];
}

export interface DistrictDashboard {
  districtCode: string;
  districtName: string;
  regenerationAreas: number;
  lastUpdated: string;
  indicators: IndicatorValue[];
}

export interface UrbanArea {
  id: string;
  name: string;
  district: string;
  districts?: string[];
  type: string;
  status: string;
  latitude: number;
  longitude: number;
  selected?: boolean;
  auxiliary?: {
    selectionYear?: number | null;
    notificationYear?: number | null;
    notificationDate?: string | null;
    startYear?: number | null;
    cancelled?: boolean;
    cancelledDate?: string | null;
    supportType?: string | null;
  } | null;
}
