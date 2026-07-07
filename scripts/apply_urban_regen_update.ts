import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SEOUL_DISTRICTS } from "../lib/seoulDistricts";

const ROOT = process.cwd();
const PUBLIC_DATA_DIR = path.join(ROOT, "public", "data");

type AreaSeed = {
  name: string;
  supportType: string;
  selectionYear: number;
  notificationYear?: number;
  notificationDate?: string;
  districts: string[];
  type: string;
  cancelled?: boolean;
  cancelledDate?: string;
};

const districtCenters: Record<string, [number, number]> = {
  종로구: [37.5735, 126.9788],
  중구: [37.5636, 126.9976],
  용산구: [37.5326, 126.9905],
  성동구: [37.5633, 127.0369],
  광진구: [37.5385, 127.0823],
  동대문구: [37.5744, 127.0396],
  중랑구: [37.6063, 127.0925],
  성북구: [37.5894, 127.0167],
  강북구: [37.6396, 127.0257],
  도봉구: [37.6688, 127.0471],
  노원구: [37.6542, 127.0568],
  은평구: [37.6176, 126.9227],
  서대문구: [37.5791, 126.9368],
  마포구: [37.5663, 126.9019],
  양천구: [37.5169, 126.8664],
  강서구: [37.5509, 126.8495],
  구로구: [37.4955, 126.8876],
  금천구: [37.4569, 126.8955],
  영등포구: [37.5264, 126.8962],
  동작구: [37.5124, 126.9393],
  관악구: [37.4784, 126.9516],
  서초구: [37.4837, 127.0324],
  강남구: [37.5172, 127.0473],
  송파구: [37.5145, 127.1059],
  강동구: [37.5301, 127.1238],
};

const seeds: AreaSeed[] = [
  { supportType: "국가지원", selectionYear: 2014, name: "창신숭인", notificationDate: "2015-02-26", notificationYear: 2015, districts: ["종로구"], type: "근린재생형" },
  { supportType: "국가지원", selectionYear: 2015, name: "창동상계", notificationDate: "2017-03-02", notificationYear: 2017, districts: ["도봉구", "노원구"], type: "경제기반형" },
  { supportType: "국가지원", selectionYear: 2015, name: "가리봉", notificationDate: "2017-05-11", notificationYear: 2017, districts: ["구로구"], type: "근린재생형" },
  { supportType: "국가지원", selectionYear: 2015, name: "해방촌", notificationDate: "2017-05-11", notificationYear: 2017, districts: ["용산구"], type: "근린재생형" },
  { supportType: "국가지원", selectionYear: 2017, name: "독산동 우시장", notificationDate: "2019-08-01", notificationYear: 2019, districts: ["금천구"], type: "중심시가지형" },
  { supportType: "국가지원", selectionYear: 2017, name: "안암동 캠퍼스타운", notificationDate: "2020-12-24", notificationYear: 2020, districts: ["성북구"], type: "일반근린형" },
  { supportType: "국가지원", selectionYear: 2017, name: "수유1동", notificationDate: "2019-01-15", notificationYear: 2019, districts: ["강북구"], type: "일반근린형" },
  { supportType: "국가지원", selectionYear: 2017, name: "불광2동", notificationDate: "2019-11-14", notificationYear: 2019, districts: ["은평구"], type: "일반근린형" },
  { supportType: "국가지원", selectionYear: 2017, name: "묵2동", notificationDate: "2019-11-28", notificationYear: 2019, districts: ["중랑구"], type: "일반근린형" },
  { supportType: "국가지원", selectionYear: 2017, name: "천연·충현동", notificationDate: "2019-11-20", notificationYear: 2019, districts: ["서대문구"], type: "일반근린형" },
  { supportType: "국가지원", selectionYear: 2017, name: "난곡·난향동", notificationDate: "2019-11-21", notificationYear: 2019, districts: ["관악구"], type: "일반근린형" },
  { supportType: "국가지원", selectionYear: 2018, name: "도봉2동", notificationDate: "2021-04-22", notificationYear: 2021, districts: ["도봉구"], type: "일반근린형" },
  { supportType: "국가지원", selectionYear: 2018, name: "사당4동", notificationDate: "2020-06-11", notificationYear: 2020, districts: ["동작구"], type: "일반근린형" },
  { supportType: "국가지원", selectionYear: 2019, name: "홍릉일대", notificationDate: "2020-03-26", notificationYear: 2020, districts: ["동대문구", "성북구"], type: "경제기반형" },
  { supportType: "국가지원", selectionYear: 2019, name: "목3동", notificationDate: "2020-01-30", notificationYear: 2020, districts: ["양천구"], type: "일반근린형" },
  { supportType: "국가지원", selectionYear: 2019, name: "신월3동", notificationDate: "2021-05-18", notificationYear: 2021, districts: ["양천구"], type: "일반근린형" },
  { supportType: "국가지원", selectionYear: 2019, name: "중화2동", notificationDate: "2021-12-30", notificationYear: 2021, districts: ["중랑구"], type: "일반근린형" },
  { supportType: "서울시 자체", selectionYear: 2014, name: "성수동", notificationDate: "2017-06-01", notificationYear: 2017, districts: ["성동구"], type: "근린재생형" },
  { supportType: "서울시 자체", selectionYear: 2014, name: "신촌동", notificationDate: "2016-12-29", notificationYear: 2016, districts: ["서대문구"], type: "근린재생형" },
  { supportType: "서울시 자체", selectionYear: 2014, name: "암사동", notificationDate: "2017-06-08", notificationYear: 2017, districts: ["강동구"], type: "근린재생형" },
  { supportType: "서울시 자체", selectionYear: 2014, name: "장위동", notificationDate: "2017-09-14", notificationYear: 2017, districts: ["성북구"], type: "근린재생형" },
  { supportType: "서울시 자체", selectionYear: 2014, name: "상도4동", notificationDate: "2017-08-17", notificationYear: 2017, districts: ["동작구"], type: "근린재생형" },
  { supportType: "서울시 자체", selectionYear: 2015, name: "서울역 일대", notificationDate: "2017-12-28", notificationYear: 2017, districts: ["중구", "용산구"], type: "경제기반형" },
  { supportType: "서울시 자체", selectionYear: 2015, name: "세운상가 일대", notificationDate: "2017-06-01", notificationYear: 2017, districts: ["종로구", "중구"], type: "중심시가지형" },
  { supportType: "서울시 자체", selectionYear: 2015, name: "창덕궁앞 도성한복판", notificationDate: "2018-05-10", notificationYear: 2018, districts: ["종로구"], type: "중심시가지형" },
  { supportType: "서울시 자체", selectionYear: 2015, name: "장안평 일대", notificationDate: "2016-08-04", notificationYear: 2016, districts: ["성동구", "동대문구"], type: "경제기반형" },
  { supportType: "서울시 자체", selectionYear: 2017, name: "영등포경인로", notificationDate: "2020-04-16", notificationYear: 2020, districts: ["영등포구"], type: "경제기반형" },
  { supportType: "서울시 자체", selectionYear: 2017, name: "용산전자상가", notificationDate: "2019-09-05", notificationYear: 2019, districts: ["용산구"], type: "중심시가지형" },
  { supportType: "서울시 자체", selectionYear: 2017, name: "마장동", notificationDate: "2019-09-11", notificationYear: 2019, districts: ["성동구"], type: "중심시가지형" },
  { supportType: "서울시 자체", selectionYear: 2017, name: "4.19사거리", notificationDate: "2019-06-20", notificationYear: 2019, districts: ["강북구"], type: "중심시가지형" },
  { supportType: "서울시 자체", selectionYear: 2017, name: "정동", notificationDate: "2020-05-28", notificationYear: 2020, districts: ["중구"], type: "중심시가지형" },
  { supportType: "서울시 자체", selectionYear: 2017, name: "청량리·제기동", notificationDate: "2020-01-09", notificationYear: 2020, districts: ["동대문구"], type: "중심시가지형", cancelled: true, cancelledDate: "2022-12-29" },
  { supportType: "서울시 자체", selectionYear: 2017, name: "창3동", notificationDate: "2020-01-30", notificationYear: 2020, districts: ["도봉구"], type: "일반근린형" },
  { supportType: "서울시 자체", selectionYear: 2018, name: "송정동", notificationDate: "2021-02-25", notificationYear: 2021, districts: ["성동구"], type: "일반근린형" },
  { supportType: "서울시 자체", selectionYear: 2018, name: "인수동", notificationDate: "2021-04-30", notificationYear: 2021, districts: ["강북구"], type: "일반근린형" },
  { supportType: "서울시 자체", selectionYear: 2018, name: "성내2동", notificationDate: "2021-03-24", notificationYear: 2021, districts: ["강동구"], type: "일반근린형" },
  { supportType: "서울시 자체", selectionYear: 2019, name: "구의역", notificationDate: "2022-06-02", notificationYear: 2022, districts: ["광진구"], type: "중심시가지형" },
  { supportType: "서울시 자체", selectionYear: 2019, name: "풍납동", notificationDate: "2022-06-30", notificationYear: 2022, districts: ["송파구"], type: "역사문화형/근린" },
  { supportType: "서울시 자체", selectionYear: 2019, name: "북촌가회동", notificationDate: "2023-12-28", notificationYear: 2023, districts: ["종로구"], type: "일반근린형" },
  { supportType: "서울시 자체", selectionYear: 2019, name: "홍제역", districts: ["서대문구"], type: "중심시가지형" },
  { supportType: "서울시 자체", selectionYear: 2019, name: "효창공원", districts: ["용산구"], type: "중심시가지형" },
  { supportType: "서울시 자체", selectionYear: 2019, name: "면목패션", districts: ["중랑구"], type: "중심시가지형" },
  { supportType: "서울시 자체", selectionYear: 2019, name: "경복궁 서측", notificationDate: "2023-01-05", notificationYear: 2023, districts: ["종로구"], type: "일반근린형" },
  { supportType: "서울시 자체", selectionYear: 2019, name: "공항동", notificationDate: "2023-07-19", notificationYear: 2023, districts: ["강서구"], type: "일반근린형" },
  { supportType: "서울시 자체", selectionYear: 2019, name: "응암3동", notificationDate: "2024-12-19", notificationYear: 2024, districts: ["은평구"], type: "일반근린형" },
  { supportType: "서울시 자체", selectionYear: 2019, name: "사근동", districts: ["성동구"], type: "일반근린형" },
  { supportType: "서울시 자체", selectionYear: 2020, name: "망우본동", notificationDate: "2023-12-21", notificationYear: 2023, districts: ["중랑구"], type: "일반근린형" },
  { supportType: "서울시 자체", selectionYear: 2020, name: "신월1동", notificationDate: "2025-03-27", notificationYear: 2025, districts: ["양천구"], type: "일반근린형" },
  { supportType: "서울시 자체", selectionYear: 2021, name: "용답상가시장", districts: ["성동구"], type: "중심시가지형" },
  { supportType: "서울시 자체", selectionYear: 2021, name: "화곡중앙시장", districts: ["강서구"], type: "중심시가지형" },
  { supportType: "서울시 자체", selectionYear: 2024, name: "김포공항 일대", notificationDate: "2025-01-31", notificationYear: 2025, districts: ["강서구"], type: "경제기반형" },
  { supportType: "서울시 자체", selectionYear: 2024, name: "남산 일대", districts: ["중구"], type: "시가지형/기타" },
];

const indicatorMeta = [
  ["population_change", "인구증감률", "자료준비필요", "종합성과지표", "명"],
  ["floating_population_change", "유동인구 변화", "자료준비필요", "종합성과지표", "명"],
  ["building_permit_change", "건축허가 증감률", "자료준비필요", "종합성과지표", "건"],
  ["housing_permit_change", "주택 인허가율", "자료준비필요", "종합성과지표", "건"],
  ["employee_change", "종사자 증감률", "자료준비필요", "종합성과지표", "명"],
  ["crime_change", "범죄 발생 변화", "자료준비필요", "종합성과지표", "건"],
  ["vacant_house_change", "빈집 변화", "자료준비필요", "종합성과지표", "호"],
  ["complaints", "생활불편 민원", "자료준비필요", "체감 보완지표", "건"],
  ["illegal_parking", "불법주정차 단속", "자료준비필요", "체감 보완지표", "건"],
] as const;

function slug(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function coordinates(seed: AreaSeed, index: number): [number, number] {
  const [lat, lng] = districtCenters[seed.districts[0]];
  const offset = (index % 7) - 3;
  const ring = Math.floor(index / 7) % 3;
  return [Number((lat + offset * 0.004 + ring * 0.002).toFixed(6)), Number((lng + offset * 0.004 - ring * 0.002).toFixed(6))];
}

const areas = seeds.map((seed, index) => {
  const [latitude, longitude] = coordinates(seed, index);
  const fallbackYear = seed.notificationYear ?? seed.selectionYear;
  return {
    id: `area-${String(index + 1).padStart(3, "0")}-${slug(seed.name)}`,
    name: seed.name,
    district: seed.districts[0],
    districts: seed.districts,
    type: seed.type,
    status: seed.cancelled ? "계획취소" : "자료준비필요",
    address: `서울특별시 ${seed.districts.join(" / ")} ${seed.name}`,
    latitude,
    longitude,
    auxiliary: {
      supportType: seed.supportType,
      selectionYear: seed.selectionYear,
      notificationYear: fallbackYear,
      notificationDate: seed.notificationDate ?? null,
      startYear: fallbackYear,
      cancelled: seed.cancelled ?? false,
      cancelledDate: seed.cancelledDate ?? null,
    },
  };
});

function emptyIndicator([id, label, _description, _category, unit]: (typeof indicatorMeta)[number]) {
  return {
    id,
    label,
    value: null,
    changeRate: null,
    unit,
    formatted: "자료준비필요",
    direction: "flat",
    tone: "neutral",
    comparison: "자료준비필요",
    available: false,
    baseYear: null,
    compareYear: null,
    baseValue: null,
    compareValue: null,
    confidence: null,
    dataStatus: "data_preparation_required",
    sourceName: "자료준비필요",
    series: [],
  };
}

const dashboard = [
  {
    districtCode: "11",
    districtName: "서울 전체",
    regenerationAreas: areas.length,
    lastUpdated: "자료준비필요",
    indicators: indicatorMeta.map(emptyIndicator),
  },
  ...SEOUL_DISTRICTS.map(([districtCode, districtName]) => ({
    districtCode,
    districtName,
    regenerationAreas: areas.filter((area) => area.districts.includes(districtName)).length,
    lastUpdated: "자료준비필요",
    indicators: indicatorMeta.map(emptyIndicator),
  })),
];

const coverage = {
  generatedAt: new Date().toISOString(),
  districtCount: SEOUL_DISTRICTS.length,
  indicators: indicatorMeta.map(([indicatorCode]) => ({
    indicatorCode,
    sourceName: "자료준비필요",
    availableYears: [],
    availableDistrictCount: 0,
    missingDistrictCount: SEOUL_DISTRICTS.length,
    dataStatus: "data_preparation_required",
    missingReason: "자료준비필요",
  })),
};

const csvRows = [
  "id,name,district,type,status,address,latitude,longitude",
  ...areas.map((area) => [
    area.id,
    area.name,
    area.districts.join(" / "),
    area.type,
    area.status,
    area.address,
    area.latitude,
    area.longitude,
  ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")),
];

await mkdir(PUBLIC_DATA_DIR, { recursive: true });
await mkdir(path.join(PUBLIC_DATA_DIR, "indicators"), { recursive: true });
await mkdir(path.join(PUBLIC_DATA_DIR, "meta"), { recursive: true });

await writeFile(path.join(PUBLIC_DATA_DIR, "urban_areas.json"), `${JSON.stringify(areas, null, 2)}\n`);
await writeFile(path.join(PUBLIC_DATA_DIR, "dashboard_by_district.json"), `${JSON.stringify(dashboard, null, 2)}\n`);
await writeFile(path.join(PUBLIC_DATA_DIR, "anchor_facilities.json"), "[]\n");
await writeFile(path.join(PUBLIC_DATA_DIR, "meta", "data_coverage.json"), `${JSON.stringify(coverage, null, 2)}\n`);
await writeFile(path.join(PUBLIC_DATA_DIR, "meta", "indicator_meta.json"), `${JSON.stringify(indicatorMeta.map(([id, label, description, category]) => ({ id, label, description, category })), null, 2)}\n`);
await writeFile(path.join(PUBLIC_DATA_DIR, "meta", "urban_regen_standard_coverage.json"), `${JSON.stringify({ generatedAt: coverage.generatedAt, source: "사용자 제공 52개 서울 도시재생활성화지역 목록", totalAreas: areas.length, dataStatus: "data_preparation_required" }, null, 2)}\n`);
await writeFile(path.join(ROOT, "config", "smap_urban_areas.csv"), `${csvRows.join("\n")}\n`);

for (const [indicatorCode, _label, _description, _category, _unit] of indicatorMeta) {
  await writeFile(path.join(PUBLIC_DATA_DIR, "indicators", `${indicatorCode}.json`), `${JSON.stringify({
    indicatorCode,
    sourceName: "자료준비필요",
    sourceUrl: null,
    spatialLevel: "gu",
    generatedAt: coverage.generatedAt,
    availableYears: [],
    series: [],
    dataStatus: "data_preparation_required",
    missingReason: "자료준비필요",
  }, null, 2)}\n`);
}

console.log(`updated ${areas.length} urban areas and reset ${indicatorMeta.length} indicators`);
