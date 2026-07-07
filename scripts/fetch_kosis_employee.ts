import { readDataSources } from "./lib/dataSources";
import { writeIndicator } from "./lib/indicatorOutput";

const source = (await readDataSources()).employee_change;
if (source.status !== "available" || typeof source.objL1 !== "string" || typeof source.itmId !== "string") {
  await writeIndicator("employee_change", source, [], { dataStatus: "needs_kosis_dimension_check", missingReason: "objL1과 itmId가 확정되지 않아 실제 통계자료를 호출하지 않았습니다." });
  console.log("KOSIS employee 실제 호출 차단: dimension 미확정");
  process.exit(0);
}
throw new Error("employee_change가 available로 전환되었지만 승인된 실제 통계자료 endpoint가 config에 없습니다.");

