import path from "node:path";
import { readFile } from "node:fs/promises";
import { ROOT, requireEnv, writeJson } from "./lib/io";
import { decodedServiceKey, fetchAllPublicData } from "./lib/publicdata";
import { readDataSources } from "./lib/dataSources";
import { writeIndicator } from "./lib/indicatorOutput";

type District = { code: string; name: string; bjdongCodes: string[] };
type Permit = {
  mgmPmsrgstPk?: string; sigunguCd?: string; bjdongCd?: string; platPlc?: string;
  archPmsDay?: string; mainPurpsCdNm?: string; crtnDay?: string;
};
type HousingType = {
  mgmPmsrgstPk?: string; hstpGbCd?: string; hstpGbCdNm?: string;
  silHoHhldCnt?: string; silHoHhldArea?: string;
};
type CachedRows<T> = { rows: T[] };

const sources = await readDataSources();
const buildingSource = sources.building_permit_change;
const housingSource = sources.housing_permit_change;
const testMode = process.argv.includes("--test") || process.env.BUILDING_HUB_DRY_RUN === "1";
const serviceKey = decodedServiceKey(requireEnv("DATA_GO_KR_SERVICE_KEY"));
const baseUrl = "https://apis.data.go.kr/1613000/ArchPmsHubService";
const startYear = Number(process.env.BUILDING_HUB_START_YEAR ?? 2015);
const endYear = Number(process.env.BUILDING_HUB_END_YEAR ?? new Date().getFullYear());
const cacheDir = path.join(ROOT, "data", "raw", "building_hub", "cache");

let districts = JSON.parse(await readFile(path.join(ROOT, "config", "seoul-building-districts.json"), "utf8")) as District[];
if (testMode) {
  const districtCode = process.env.BUILDING_HUB_DISTRICT_CODE ?? "11680";
  const bjdongCode = process.env.BUILDING_HUB_BJDONG_CODE ?? "10300";
  districts = districts.filter((district) => district.code === districtCode).map((district) => ({ ...district, bjdongCodes: [bjdongCode] }));
}

async function readCached<T>(file: string) {
  try { return (JSON.parse(await readFile(file, "utf8")) as CachedRows<T>).rows; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function fetchCurrentSeoulLegalDongs() {
  const cacheFile = path.join(ROOT, "data", "raw", "reference", "seoul_legal_dongs.json");
  try {
    const cached = JSON.parse(await readFile(cacheFile, "utf8")) as Record<string, string[]>;
    if (Object.values(cached).flat().length >= 300) return new Map(Object.entries(cached).map(([code, values]) => [code, new Set(values)]));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const response = await fetch("https://www.code.go.kr/stdcode/regCodeL.do", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "sidoCd=11&sggCd=*&umdCd=*&riCd=*&disuseAt=0&pageSize=1000&cPage=1&searchOk=0&codeseId=00002",
    signal: AbortSignal.timeout(Number(process.env.ETL_HTTP_TIMEOUT_MS ?? 60_000)),
  });
  if (!response.ok) throw new Error(`법정동 코드 조회 실패: ${response.status} ${response.statusText}`);
  const html = await response.text();
  const byDistrict = new Map<string, Set<string>>();
  for (const match of html.matchAll(/class="table_left">\s*(11\d{8})<\/td>[\s\S]*?class="table_center01">\s*(서울특별시[^<]*)<\/td>/g)) {
    const districtCode = match[1].slice(0, 5);
    const bjdongCode = match[1].slice(5);
    if (match[2].trim().split(/\s+/).length < 3 || bjdongCode === "00000") continue;
    const codes = byDistrict.get(districtCode) ?? new Set<string>();
    codes.add(bjdongCode);
    byDistrict.set(districtCode, codes);
  }
  if ([...byDistrict.values()].reduce((sum, codes) => sum + codes.size, 0) < 300) throw new Error("서울 법정동 코드 결과가 비정상적으로 적습니다.");
  await writeJson(cacheFile, Object.fromEntries([...byDistrict].map(([code, values]) => [code, [...values].toSorted()])));
  return byDistrict;
}

if (!testMode && districts.some((district) => district.bjdongCodes.includes("00000") || district.bjdongCodes.includes("AUTO"))) {
  const legalDongs = await fetchCurrentSeoulLegalDongs();
  districts = districts.map((district) => ({ ...district, bjdongCodes: [...(legalDongs.get(district.code) ?? [])] }));
}
if (!districts.length || districts.some((district) => !district.bjdongCodes.length)) throw new Error("수집할 서울 법정동 코드가 없습니다.");

const permitRows: (Permit & { districtName: string })[] = [];
const housingRows: (HousingType & { districtName: string })[] = [];
const tasks = districts.flatMap((district) => district.bjdongCodes.map((bjdongCd) => ({ district, bjdongCd })));
let taskIndex = 0;
async function worker() {
  while (taskIndex < tasks.length) {
    const { district, bjdongCd } = tasks[taskIndex++];
    const common = { serviceKey, sigunguCd: district.code, bjdongCd, startDate: `${startYear}0101`, endDate: `${endYear}1231`, _type: "json" };
    const stem = `${district.code}_${bjdongCd}_${startYear}_${endYear}`;
    const permitCache = path.join(cacheDir, `${stem}_permits.json`);
    const housingCache = path.join(cacheDir, `${stem}_housing.json`);
    let permits = await readCached<Permit>(permitCache);
    if (!permits) {
      permits = await fetchAllPublicData<Permit>(`${baseUrl}/getApBasisOulnInfo`, common);
      await writeJson(permitCache, { rows: permits });
    }
    let housing = await readCached<HousingType>(housingCache);
    if (!housing) {
      housing = await fetchAllPublicData<HousingType>(`${baseUrl}/getApHsTpInfo`, common);
      await writeJson(housingCache, { rows: housing });
    }
    permitRows.push(...permits.map((row) => ({ ...row, districtName: district.name })));
    housingRows.push(...housing.map((row) => ({ ...row, districtName: district.name })));
  }
}
await Promise.all(Array.from({ length: Math.min(Number(process.env.BUILDING_HUB_CONCURRENCY ?? 4), tasks.length) }, () => worker()));

const uniquePermits = [...new Map(permitRows.filter((row) => row.mgmPmsrgstPk).map((row) => [row.mgmPmsrgstPk as string, row])).values()];
if (testMode) {
  if (!uniquePermits.length) throw new Error("건축HUB 테스트 결과가 0건입니다.");
  await writeJson(path.join(ROOT, "data", "raw", "building_hub", "building_hub_test.json"), { period: { startYear, endYear }, districts, permits: uniquePermits, housingTypes: housingRows });
  console.log(`건축HUB 테스트 완료: 허가 ${uniquePermits.length}건, 주택유형 ${housingRows.length}건`);
  process.exit(0);
}

const permitByPk = new Map(uniquePermits.map((row) => [row.mgmPmsrgstPk as string, row]));
const validHousingPks = new Set(housingRows
  .filter((row) => row.mgmPmsrgstPk && (row.hstpGbCd || row.hstpGbCdNm) && row.silHoHhldCnt !== undefined)
  .map((row) => row.mgmPmsrgstPk as string)
  .filter((pk) => permitByPk.has(pk)));
const buildingCounts = new Map<string, number>();
const housingCounts = new Map<string, number>();
for (const row of uniquePermits) {
  const year = Number((row.archPmsDay ?? "").slice(0, 4));
  if (!Number.isInteger(year) || year < startYear || year > endYear) continue;
  const key = `${row.districtName}:${year}`;
  buildingCounts.set(key, (buildingCounts.get(key) ?? 0) + 1);
  if (validHousingPks.has(row.mgmPmsrgstPk as string)) housingCounts.set(key, (housingCounts.get(key) ?? 0) + 1);
}
const toSeries = (counts: Map<string, number>) => [...counts].map(([key, value]) => {
  const [district, year] = key.split(":");
  return { district, year: Number(year), value, unit: "건", dataStatus: "available" as const, confidence: "exact" as const };
});
await writeIndicator("building_permit_change", buildingSource, toSeries(buildingCounts), { spatialLevel: "gu", metadata: { rawPermitRows: uniquePermits.length, dateField: "archPmsDay" } });
if (validHousingPks.size) {
  await writeIndicator("housing_permit_change", housingSource, toSeries(housingCounts), { spatialLevel: "gu", metadata: { rawHousingTypeRows: housingRows.length, matchedPermitPks: validHousingPks.size } });
} else {
  await writeIndicator("housing_permit_change", housingSource, [], { dataStatus: "needs_check", missingReason: "주택유형 코드/명과 세대수 필드가 함께 확인된 허가 PK가 없습니다.", metadata: { rawHousingTypeRows: housingRows.length } });
}
console.log(`건축HUB 집계 완료: 건축허가 ${uniquePermits.length}건, 주택유형 확인 허가 ${validHousingPks.size}건`);
