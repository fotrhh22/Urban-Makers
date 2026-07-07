# 네이버 데이터랩 기반 창신숭인 연도별 온라인 반응 proxy CSV 저장 전용 구현

이번 작업의 목표는 UI 출력이 아니라, 창신숭인 도시재생지역에 대해 2012년부터 2025년까지의 연도별 온라인 반응 proxy CSV를 만드는 것이다.

단, 네이버 데이터랩 검색어 트렌드 API는 2016-01-01부터 조회 가능하므로 2012~2015년은 실제 수집값으로 채우지 않는다.

2012~2015년은 CSV에 row는 만들되, 값은 비워두고 `dataStatus = unavailable_by_api_limit`로 표시한다.

## 1. 핵심 목표

UI 컴포넌트 수정 금지.  
dashboard JSON 생성 금지.  
public/data 대시보드 파일 수정 금지.  
월별 CSV 저장 금지.

이번 작업에서는 아래 연도별 CSV만 생성한다.

```text
data/processed/naver_datalab/changsin_sungin_yearly_indices_2012_2025.csv
data/processed/naver_datalab/changsin_sungin_online_reaction_proxy_2012_2025.csv
data/processed/naver_datalab/changsin_sungin_component_breakdown_2012_2025.csv

API 원본 응답 cache는 JSON으로만 저장한다.

data/cache/naver_datalab/changsin_sungin_core.json
data/cache/naver_datalab/changsin_sungin_reaction.json
2. 기간 처리

분석상 요청 기간:

2012-01-01 ~ 2025-12-31

네이버 데이터랩 실제 호출 기간:

2016-01-01 ~ 2025-12-31

규칙:

2012~2015:
  value = null
  dataStatus = unavailable_by_api_limit
  confidence = not_available

2016~2025:
  네이버 데이터랩 API 호출 결과를 연도별 평균으로 집계
  dataStatus = available
  confidence = search_interest_proxy

절대 2012~2015 값을 0으로 넣지 않는다.
절대 보간하지 않는다.
절대 sample/mock/fallback 값을 만들지 않는다.

3. 변수명 원칙

네이버 데이터랩 검색지수는 만족도가 아니다.

사용 금지 변수명:

satisfaction
anchor_satisfaction
facility_satisfaction
거점공간 만족도

사용할 최종 변수명:

anchor_online_reaction_proxy

의미:

네이버 검색어 트렌드 기반 온라인 반응 proxy.
실제 만족도, 실제 방문자 수, 설문조사 결과가 아니다.
4. 환경변수

.env.local에서 아래 값을 읽는다.

NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=

API 키를 코드에 하드코딩하지 않는다.

5. config 파일

아래 파일을 생성한다.

config/naver_datalab_keywords/changsin_sungin.json

내용:

{
  "urbanAreaId": "changsin_sungin",
  "urbanAreaName": "창신숭인",
  "district": "종로구",
  "adminDongs": ["창신1동", "창신2동", "창신3동", "숭인1동"],
  "requestedStartYear": 2012,
  "requestedEndYear": 2025,
  "apiStartDate": "2016-01-01",
  "apiEndDate": "2025-12-31",
  "timeUnit": "month",
  "calibrationGroupName": "창신숭인_지역인지도",
  "batches": [
    {
      "batchId": "changsin_sungin_core",
      "keywordGroups": [
        {
          "groupName": "창신숭인_지역인지도",
          "indicatorCode": "area_search_attention_index",
          "keywords": ["창신숭인", "창신 숭인", "창신동 숭인동", "창신동", "숭인동", "창신1동", "창신2동", "창신3동", "숭인1동", "종로 창신동", "종로 숭인동", "창신역", "동묘앞 창신동", "동묘앞 숭인동"]
        },
        {
          "groupName": "창신숭인_도시재생",
          "indicatorCode": "urban_regen_search_attention_index",
          "keywords": ["창신숭인 도시재생", "창신 숭인 도시재생", "창신동 도시재생", "숭인동 도시재생", "창신숭인 도시재생사업", "창신숭인 재생", "창신숭인 도시재생지역", "창신숭인 도시재생활성화지역", "창신숭인 선도지역", "창신숭인 뉴타운 해제", "창신숭인 도시재생지원센터", "창신숭인 주민협의체", "창신숭인 CRC", "창신숭인 도시재생협동조합"]
        },
        {
          "groupName": "창신숭인_거점공간",
          "indicatorCode": "anchor_facility_search_interest_index",
          "keywords": ["창신소통공작소", "창신 소통공작소", "창신숭인 채석장전망대", "창신숭인 채석장 전망대", "채석장전망대", "창신동 채석장", "창신동 채석장전망대", "산마루놀이터", "산마루 놀이터", "이음피움 봉제역사관", "이음피움", "봉제역사관", "백남준기념관", "백남준 기념관", "백남준 생가", "원각사 창신동", "창신동 원각사", "회오리마당", "창신동 회오리마당"]
        },
        {
          "groupName": "창신숭인_방문관광",
          "indicatorCode": "visit_intent_search_index",
          "keywords": ["창신동 가볼만한곳", "숭인동 가볼만한곳", "창신숭인 가볼만한곳", "창신동 데이트", "창신동 산책", "창신동 여행", "창신동 투어", "창신동 골목길", "창신동 절벽", "창신동 전망대", "창신동 야경", "창신동 카페", "숭인동 카페", "동묘 창신동", "낙산 창신동", "창신동 봉제거리", "창신동 봉제마을", "창신동 마을여행", "창신숭인 마을탐방"]
        },
        {
          "groupName": "창신숭인_봉제산업",
          "indicatorCode": "local_industry_search_index",
          "keywords": ["창신동 봉제", "창신동 봉제공장", "창신동 봉제거리", "창신동 봉제마을", "창신동 의류공장", "창신동 미싱", "창신동 패션", "동대문 봉제", "동대문 봉제공장", "창신동 옷공장", "숭인동 봉제", "봉제역사관", "이음피움 봉제역사관", "창신동 의류제작", "창신동 소공인"]
        }
      ]
    },
    {
      "batchId": "changsin_sungin_reaction",
      "keywordGroups": [
        {
          "groupName": "창신숭인_지역인지도",
          "indicatorCode": "area_search_attention_index",
          "keywords": ["창신숭인", "창신 숭인", "창신동 숭인동", "창신동", "숭인동", "창신1동", "창신2동", "창신3동", "숭인1동", "종로 창신동", "종로 숭인동", "창신역", "동묘앞 창신동", "동묘앞 숭인동"]
        },
        {
          "groupName": "창신숭인_생활환경",
          "indicatorCode": "living_environment_search_index",
          "keywords": ["창신동 주거환경", "숭인동 주거환경", "창신동 재개발", "숭인동 재개발", "창신동 뉴타운", "숭인동 뉴타운", "창신동 집값", "숭인동 집값", "창신동 원룸", "숭인동 원룸", "창신동 빈집", "숭인동 빈집", "창신동 노후주택", "숭인동 노후주택", "창신동 안전", "숭인동 안전", "창신동 골목길", "숭인동 골목길"]
        },
        {
          "groupName": "창신숭인_긍정반응",
          "indicatorCode": "positive_search_reaction_index",
          "keywords": ["창신동 좋다", "창신동 추천", "창신동 예쁘다", "창신동 핫플", "창신동 감성", "창신동 데이트", "창신동 산책 추천", "창신동 가볼만한곳", "창신동 카페 추천", "창신동 전망 좋다", "창신동 야경", "창신동 여행", "창신숭인 좋다", "창신숭인 가볼만한곳", "창신소통공작소 후기", "산마루놀이터 후기", "이음피움 후기"]
        },
        {
          "groupName": "창신숭인_부정불편",
          "indicatorCode": "negative_search_reaction_index",
          "keywords": ["창신동 불편", "창신동 위험", "창신동 치안", "창신동 낡은", "창신동 노후", "창신동 빈집", "창신동 주차", "창신동 교통 불편", "창신동 언덕", "창신동 계단", "창신동 폐가", "숭인동 불편", "숭인동 치안", "숭인동 빈집", "숭인동 주차", "창신숭인 문제", "창신숭인 한계", "창신숭인 도시재생 실패"]
        }
      ]
    }
  ]
}
6. 생성할 스크립트

아래 스크립트를 생성한다.

scripts/fetch_naver_datalab_yearly_to_csv.ts

역할:

config/naver_datalab_keywords/changsin_sungin.json을 읽는다.
네이버 데이터랩 API에는 apiStartDate = 2016-01-01, apiEndDate = 2025-12-31, timeUnit = month로 요청한다.
API 응답 원본은 data/cache/naver_datalab/에 JSON으로 저장한다.
월별 응답값은 메모리에서만 사용한다.
월별 CSV는 생성하지 않는다.
월별 ratio를 연도별 평균으로 집계한다.
2012~2015 row를 생성하되 값은 null로 둔다.
최종 연도별 CSV 3개만 생성한다.
7. CSV 1: 연도별 component index

파일:

data/processed/naver_datalab/changsin_sungin_yearly_indices_2012_2025.csv

컬럼:

urbanAreaId,urbanAreaName,district,year,indicatorCode,groupName,yearlyMeanRatio,validMonthCount,unit,isProxy,isSatisfaction,dataStatus,confidence,sourceName,note

계산:

2016~2025:
  yearlyMeanRatio = 해당 연도 월별 ratio 평균
  validMonthCount = 실제 ratio가 존재하는 월 수
  dataStatus = available

2012~2015:
  yearlyMeanRatio = null
  validMonthCount = 0
  dataStatus = unavailable_by_api_limit

예시:

changsin_sungin,창신숭인,종로구,2015,anchor_facility_search_interest_index,창신숭인_거점공간,,0,0-100_relative_index,true,false,unavailable_by_api_limit,not_available,naver_datalab,"네이버 데이터랩 API는 2016-01-01부터 조회 가능"
changsin_sungin,창신숭인,종로구,2024,anchor_facility_search_interest_index,창신숭인_거점공간,18.42,12,0-100_relative_index,true,false,available,search_interest_proxy,naver_datalab,"연도별 평균 ratio"
8. CSV 2: 최종 온라인 반응 proxy

파일:

data/processed/naver_datalab/changsin_sungin_online_reaction_proxy_2012_2025.csv

컬럼:

urbanAreaId,urbanAreaName,district,year,anchor_online_reaction_proxy,online_reaction_balance_index,availableComponentCount,missingComponentCodes,unit,isProxy,isSatisfaction,dataStatus,confidence,warning

계산:

online_reaction_balance_index =
  positive_search_reaction_index - negative_search_reaction_index

최종 proxy:

anchor_online_reaction_proxy =
  area_search_attention_index * 0.10
  + urban_regen_search_attention_index * 0.10
  + anchor_facility_search_interest_index * 0.25
  + visit_intent_search_index * 0.20
  + local_industry_search_index * 0.10
  + positive_search_reaction_index * 0.15
  - negative_search_reaction_index * 0.10

단, 특정 component가 없거나 전부 null이면 그 항목은 제외하고 남은 가중치를 재정규화한다.

2012~2015는 계산하지 않는다.

anchor_online_reaction_proxy = null
online_reaction_balance_index = null
availableComponentCount = 0
dataStatus = unavailable_by_api_limit
9. CSV 3: component breakdown

파일:

data/processed/naver_datalab/changsin_sungin_component_breakdown_2012_2025.csv

컬럼:

urbanAreaId,urbanAreaName,district,year,componentCode,componentName,yearlyMeanRatio,weight,weightedValue,includedInProxy,dataStatus,confidence

2012~2015 처리:

yearlyMeanRatio = null
weight = configured weight
weightedValue = null
includedInProxy = false
dataStatus = unavailable_by_api_limit
confidence = not_available

2016~2025 처리:

yearlyMeanRatio = 연도별 평균 ratio
weightedValue = yearlyMeanRatio * weight
includedInProxy = true
dataStatus = available
confidence = search_interest_proxy
10. API cache 저장

API 원본 응답은 아래에 저장한다.

data/cache/naver_datalab/changsin_sungin_core.json
data/cache/naver_datalab/changsin_sungin_reaction.json

cache에는 요청 payload와 응답 result를 함께 저장한다.

{
  "requestedAt": "ISO_DATE",
  "batchId": "changsin_sungin_core",
  "requestPayload": {},
  "response": {}
}
11. package.json script

아래 script를 추가한다.

{
  "scripts": {
    "etl:naver-datalab-yearly-csv": "tsx scripts/fetch_naver_datalab_yearly_to_csv.ts"
  }
}

실행:

npm run etl:naver-datalab-yearly-csv
12. 금지
월별 CSV 생성 금지
UI 컴포넌트 수정 금지
dashboard JSON 생성 금지
public/data/dashboard_by_urban_area.json 수정 금지
검색지수를 만족도라고 표시 금지
검색지수를 방문자수라고 표시 금지
API 실패 시 mock/sample/fallback 값 생성 금지
2012~2015 값을 0으로 대체 금지
2012~2015 값을 보간 금지
API 키 하드코딩 금지
13. 완료 보고 형식

작업 완료 후 아래 형식으로 보고한다.

## 네이버 데이터랩 연도별 CSV 생성 결과

| 파일 | row 수 | 연도 범위 | 설명 |
|---|---:|---|---|

## API batch 수집 결과

| batchId | group 수 | API 조회 기간 | 상태 |
|---|---:|---|---|

## 연도별 proxy 산출 결과

| year | anchor_online_reaction_proxy | online_reaction_balance_index | dataStatus |
|---:|---:|---:|---|

## API 한계 처리

| 연도 | 처리 |
|---:|---|
| 2012 | unavailable_by_api_limit |
| 2013 | unavailable_by_api_limit |
| 2014 | unavailable_by_api_limit |
| 2015 | unavailable_by_api_limit |

