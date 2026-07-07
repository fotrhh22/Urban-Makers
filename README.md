# 서울시 도시재생 체감지도

서울시 도시재생활성화지역을 지도에서 선택하고 지표와 의견 수렴 흐름을 확인하는 Next.js 서비스입니다. DB를 사용하지 않습니다.

## 실행

```bash
npm install
npm run dev
```

## 데이터 상태

저장소의 초기 JSON은 UI와 데이터 계약 검증을 위한 예시 데이터입니다. 운영 수치로 사용하면 안 됩니다. `public/data/meta/data_coverage.json`의 `status`가 `production`인지 확인한 뒤 배포하십시오.

서울 열린데이터광장 API는 데이터셋별 서비스명이 필요합니다. `config/seoul-datasets.json`에서 실제 사용이 확정된 서비스만 `enabled: true`로 설정합니다. 현재 생활인구 서비스(`SPOP_LOCAL_RESD_DONG`)만 활성화되어 있습니다. 생활인구 Open API는 최근 2개월 범위이므로 장기 시계열은 월별 파일 원본을 별도로 적재해야 합니다.

KOSIS 수집에는 API 키 외에 대상 통계표의 `KOSIS_ORG_ID`, `KOSIS_TABLE_ID`가 필요합니다.

## 공공데이터포털 사용 범위

`DATA_GO_KR_SERVICE_KEY`는 다음 두 수집기에서만 사용합니다.

- `fetch_publicdata_urban_regen.ts`: 전국도시재생사업정보표준데이터를 서울 데이터로 필터링하고 S-map seed CSV에 보조 필드를 결합합니다. 최종 목록의 기준은 항상 `config/smap_urban_areas.csv`입니다.
- `fetch_building_hub.ts`: 국토교통부 건축HUB 기본개요와 주택유형을 결합하여 건축허가 증감률과 주택 인허가율을 생성합니다.

건축HUB는 `sigunguCd`와 `bjdongCd`를 필수로 요구합니다. `config/seoul-building-districts.json`의 `00000`은 자동 로드 표시값으로 처리되며, 수집기는 행정표준코드관리시스템에서 현존 서울 법정동 코드를 불러와 실제 5자리 코드로 변환합니다. 연도별로 API를 반복하지 않고 설정된 전체 기간을 법정동마다 한 번 조회한 뒤 허가일 기준으로 연도별 집계합니다.

```bash
npm run etl:boundary
npm run etl:geocode
npm run etl:seoul
npm run etl:urban
npm run etl:building
npm run etl:kosis
npm run etl:build
npm run etl:validate
```

지방행정 인허가정보 API는 호출하지 않습니다. `fetch_publicdata_local_license.ts`와 `startup_closure.json`은 생성하지 않으며 신규창업·폐업 지표는 `scripts/deferred/`에 보류합니다.
