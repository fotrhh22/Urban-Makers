import path from "node:path";
import { readFile } from "node:fs/promises";
import { DATA_DIR, ROOT, requireEnv, writeJson } from "./lib/io";
import { decodedServiceKey, fetchAllPublicData } from "./lib/publicdata";
import { parseCsv, similarity } from "./lib/csv";

type StandardRow = {
  BIZ_NM?: string;
  CTPV_NM?: string;
  SGG_NM?: string;
  LCTN_ROAD_NM_ADDR?: string;
  LCTN_LOTNO_ADDR?: string;
  BIZ_CN?: string;
  BIZ_BGNG_YR?: string;
  BIZ_END_YR?: string;
  MNG_INST_NM?: string;
  DATA_CRTR_YMD?: string;
};

type SeedRow = Record<string, string>;
type ManualMatches = Record<string, string>;

const serviceKey = decodedServiceKey(requireEnv("DATA_GO_KR_SERVICE_KEY"));
const seedFile = process.env.SMAP_SEED_CSV ?? path.join(ROOT, "config", "smap_urban_areas.csv");
const manualFile = path.join(ROOT, "config", "urban-area-manual-matches.json");
const seeds = parseCsv(await readFile(seedFile, "utf8"));
const manual = JSON.parse(await readFile(manualFile, "utf8")) as ManualMatches;
if (seeds.length === 0) throw new Error(`S-map seed CSV is empty: ${seedFile}`);

let rows = await fetchAllPublicData<StandardRow>(
  "https://api.data.go.kr/openapi/tn_pubr_public_urban_renewal_info_api",
  { serviceKey, type: "json", CTPV_NM: "서울특별시" },
);
const seoulRows = rows.filter((row) => /서울/.test(row.CTPV_NM ?? "") || /서울/.test(row.LCTN_ROAD_NM_ADDR ?? row.LCTN_LOTNO_ADDR ?? ""));
await writeJson(path.join(ROOT, "data", "raw", "urban_regen_standard", "urban_regeneration_seoul.json"), {
  source: "전국도시재생사업정보표준데이터",
  fetchedAt: new Date().toISOString(),
  rows: seoulRows,
});

function findMatch(seed: SeedRow) {
  const forcedName = manual[seed.id];
  if (forcedName) {
    const forced = seoulRows.find((row) => row.BIZ_NM === forcedName);
    if (!forced) throw new Error(`Manual urban-area match not found: ${seed.id} -> ${forcedName}`);
    return { row: forced, score: 1, method: "manual" as const };
  }
  const districtCandidates = seoulRows.filter((row) => !seed.district || !row.SGG_NM || row.SGG_NM.includes(seed.district));
  const ranked = districtCandidates
    .map((row) => ({ row, score: similarity(seed.name, row.BIZ_NM ?? "") }))
    .toSorted((left, right) => right.score - left.score);
  const best = ranked[0];
  return best && best.score >= Number(process.env.URBAN_MATCH_THRESHOLD ?? 0.55)
    ? { ...best, method: "fuzzy" as const }
    : null;
}

const matchReport: unknown[] = [];
const enriched = seeds.map((seed) => {
  const match = findMatch(seed);
  matchReport.push({ seedId: seed.id, seedName: seed.name, matchedName: match?.row.BIZ_NM ?? null, score: match?.score ?? 0, method: match?.method ?? "unmatched" });
  return {
    id: seed.id,
    name: seed.name,
    district: seed.district,
    type: seed.type,
    status: seed.status,
    address: seed.address,
    latitude: Number(seed.latitude),
    longitude: Number(seed.longitude),
    auxiliary: match ? {
      source: "전국도시재생사업정보표준데이터",
      sourceName: match.row.BIZ_NM ?? null,
      roadAddress: match.row.LCTN_ROAD_NM_ADDR ?? null,
      lotAddress: match.row.LCTN_LOTNO_ADDR ?? null,
      description: match.row.BIZ_CN ?? null,
      startYear: match.row.BIZ_BGNG_YR ? Number(match.row.BIZ_BGNG_YR) : null,
      endYear: match.row.BIZ_END_YR ? Number(match.row.BIZ_END_YR) : null,
      managingAgency: match.row.MNG_INST_NM ?? null,
      sourceDate: match.row.DATA_CRTR_YMD ?? null,
      matchMethod: match.method,
      matchScore: Math.round(match.score * 1000) / 1000,
    } : null,
  };
});

await writeJson(path.join(ROOT, "data", "processed", "urban_regeneration_matches.json"), matchReport);
await writeJson(path.join(DATA_DIR, "urban_areas.json"), enriched);
await writeJson(path.join(DATA_DIR, "meta", "urban_regen_standard_coverage.json"), {
  generatedAt: new Date().toISOString(),
  sourceRows: rows.length,
  seoulRows: seoulRows.length,
  seedRows: seeds.length,
  matchedRows: matchReport.filter((item: any) => item.matchedName).length,
  unmatchedRows: matchReport.filter((item: any) => !item.matchedName).length,
  emptySeoulResultAllowed: true,
});
console.log(`S-map seed ${seeds.length}건을 기준으로 보강: 매칭 ${matchReport.filter((item: any) => item.matchedName).length}건`);
