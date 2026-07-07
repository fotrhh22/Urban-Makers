import path from "node:path";
import { ROOT, writeJson } from "./lib/io";
import { readDataSources } from "./lib/dataSources";
import { writeIndicator } from "./lib/indicatorOutput";

const source = (await readDataSources()).employee_change;
const endpoint = process.env.KOSIS_TABLE_META_ENDPOINT?.trim();
const apiKey = process.env.KOSIS_API_KEY?.trim();
const output = path.join(ROOT, "data", "processed", "kosis_employee_dimension_candidates.json");

if (!endpoint || !apiKey) {
  await writeJson(output, {
    indicatorCode: "employee_change",
    orgId: source.orgId,
    tblId: source.tblId,
    dataStatus: "needs_kosis_dimension_check",
    reason: !apiKey ? "KOSIS_API_KEY가 없습니다." : "고정 config 및 환경에 KOSIS_TABLE_META_ENDPOINT가 없습니다.",
    objL1Candidates: [],
    itmIdCandidates: [],
  });
  await writeIndicator("employee_change", source, [], { dataStatus: "needs_kosis_dimension_check", missingReason: "KOSIS dimension 후보가 확정되지 않았습니다." });
  console.log("KOSIS dimension inspect 보류: 인증키 또는 고정 metadata endpoint 없음");
  process.exit(0);
}

const url = new URL(endpoint);
for (const [key, value] of Object.entries({ apiKey, orgId: String(source.orgId), tblId: String(source.tblId), format: "json" })) url.searchParams.set(key, value);
const response = await fetch(url, { signal: AbortSignal.timeout(Number(process.env.ETL_HTTP_TIMEOUT_MS ?? 30_000)) });
if (!response.ok) throw new Error(`KOSIS 통계표설명 API 실패: ${response.status} ${response.statusText}`);
const payload = await response.json() as unknown;
const rows = Array.isArray(payload) ? payload : [];
const objL1Candidates = rows.filter((row) => /obj|분류/i.test(JSON.stringify(row)));
const itmIdCandidates = rows.filter((row) => /itm|항목|종사자/i.test(JSON.stringify(row)));
await writeJson(output, { indicatorCode: "employee_change", orgId: source.orgId, tblId: source.tblId, dataStatus: "needs_kosis_dimension_check", objL1Candidates, itmIdCandidates, raw: rows });
await writeIndicator("employee_change", source, [], { dataStatus: "needs_kosis_dimension_check", missingReason: "후보 파일을 검토해 objL1과 itmId를 확정해야 합니다." });
console.log(`KOSIS dimension 후보 저장: objL1 ${objL1Candidates.length}, itmId ${itmIdCandidates.length}`);

