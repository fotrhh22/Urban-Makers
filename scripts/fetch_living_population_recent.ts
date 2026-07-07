import { readDataSources } from "./lib/dataSources";
import { writeIndicator } from "./lib/indicatorOutput";

const source = (await readDataSources()).floating_population_change;

// 고정 config에는 호출 서비스명/URL이 없다. recent_only 상태를 보존하되,
// 식별자를 코드에서 추가하거나 추정하여 호출하지 않는다.
await writeIndicator("floating_population_change", source, [], {
  dataStatus: "recent_only",
  spatialLevel: source.aggregationLevel === "gu" ? "gu" : source.spatialLevel,
  missingReason: "고정 config에 API 호출 경로가 없어 호출하지 않았습니다. 최근 원자료가 생성되기 전까지 변화율을 계산하지 않습니다.",
});
console.log("생활인구: 고정 config에 호출 경로 없음, recent_only 빈 series 유지");
