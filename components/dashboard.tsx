"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  ChevronDown,
  CircleAlert,
  Database,
  House,
  Info,
  MapPin,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { DistrictDashboard, IndicatorValue, UrbanArea } from "@/lib/types";
import { calculateIndicator, formatOriginalValue } from "@/lib/indicators";

const SeoulMap = dynamic(() => import("./SeoulMap"), { ssr: false, loading: () => <div className="map-canvas map-loading">지도 로딩 중…</div> });

type Meta = { id: string; label: string; description: string; category: string };
type Source = { id: string; name: string; url: string; updatedAt: string };
type Coverage = { generatedAt: string; districtCount: number; indicators: { indicatorCode: string; dataStatus: string }[] };

const ICONS: Record<string, typeof Users> = {
  floating_population_change: Sparkles,
  building_permit_change: Building2,
  housing_permit_change: House,
  employee_change: Users,
  crime_change: ShieldCheck,
  vacant_house_change: House,
  complaints: CircleAlert,
  illegal_parking: MapPin,
};

const FEATURED_IDS = [
  "floating_population_change",
  "building_permit_change",
  "crime_change",
  "vacant_house_change",
  "complaints",
  "illegal_parking",
];

function MiniChart({ series = [], tone }: Pick<IndicatorValue, "series" | "tone">) {
  if (series.length < 2) return <div className="sparkline empty" />;
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = series
    .map((point, index) => {
      const x = (index / (series.length - 1)) * 100;
      const y = 34 - ((point.value - min) / range) * 28;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg className={`sparkline ${tone}`} viewBox="0 0 100 38" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function areaDistricts(area: UrbanArea): string[] {
  return area.districts?.length ? area.districts : [area.district];
}

function areaBaseYear(area: UrbanArea): number | null {
  return area.auxiliary?.notificationYear ?? area.auxiliary?.selectionYear ?? area.auxiliary?.startYear ?? null;
}

function statusLabel(status: IndicatorValue["dataStatus"]): string {
  return status === "available" ? "사용 가능" : "자료준비필요";
}

const AREA_DONGS: Record<string, string[]> = {
  창신숭인: ["창신동", "숭인동"],
  창동상계: ["창동", "상계동"],
  가리봉: ["가리봉동"],
  해방촌: ["용산동2가"],
  "독산동 우시장": ["독산동"],
  "안암동 캠퍼스타운": ["안암동"],
  "천연·충현동": ["천연동", "충현동"],
  "난곡·난향동": ["난곡동", "난향동"],
  "홍릉일대": ["청량리동", "회기동", "월곡동"],
  "서울역 일대": ["봉래동", "남영동"],
  "세운상가 일대": ["종로3가", "입정동"],
  "창덕궁앞 도성한복판": ["원서동", "와룡동"],
  "장안평 일대": ["용답동", "장안동"],
  영등포경인로: ["영등포동", "문래동"],
  용산전자상가: ["한강로동"],
  "4.19사거리": ["수유동"],
  "청량리·제기동": ["청량리동", "제기동"],
  구의역: ["구의동"],
  북촌가회동: ["가회동"],
  홍제역: ["홍제동"],
  효창공원: ["효창동"],
  면목패션: ["면목동"],
  "경복궁 서측": ["통인동", "누하동", "옥인동"],
  공항동: ["공항동"],
  "응암3동": ["응암동"],
  사근동: ["사근동"],
  망우본동: ["망우동"],
  "신월1동": ["신월동"],
  용답상가시장: ["용답동"],
  화곡중앙시장: ["화곡동"],
  "김포공항 일대": ["공항동", "방화동"],
  "남산 일대": ["회현동", "필동"],
};

function areaDongs(area: UrbanArea): string[] {
  if (AREA_DONGS[area.name]) return AREA_DONGS[area.name];
  if (area.name.endsWith("동")) return [area.name];
  return [area.name];
}

function IndicatorCard({ item }: { item: IndicatorValue }) {
  const Icon = ICONS[item.id] ?? Database;
  return (
    <article className="indicator-card">
      <div className="card-topline">
        <span className="metric-icon"><Icon size={18} /></span>
        <span className="comparison">{statusLabel(item.dataStatus)}</span>
      </div>
      <p className="metric-label">{item.label}</p>
      <div className="metric-row"><strong>{item.available ? `변화율: ${item.formatted}` : item.dataStatus === "recent_only" && item.compareValue !== null ? `최근값: ${formatOriginalValue(item.compareValue, item.unit)}` : "자료준비필요"}</strong></div>
      <div className="raw-values">
        <span>선택 조건:<b>구 + 법정동</b></span>
        <span>원자료:<b>{formatOriginalValue(item.compareValue, item.unit)}</b></span>
      </div>
      <small className="confidence">{item.comparison}<br />출처: {item.sourceName}<br />confidence: {item.confidence ?? "없음"}</small>
      <MiniChart series={item.series} tone={item.tone} />
    </article>
  );
}

export default function Dashboard({
  districts,
  areas,
  indicatorMeta,
  sourceMeta,
  coverage,
}: {
  districts: DistrictDashboard[];
  areas: UrbanArea[];
  indicatorMeta: Meta[];
  sourceMeta: Source[];
  coverage: Coverage;
}) {
  const [districtName, setDistrictName] = useState("서울 전체");
  const [tab, setTab] = useState<"dashboard" | "method">("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<UrbanArea | null>(null);
  const [overviewArea, setOverviewArea] = useState<UrbanArea | null>(null);
  const [selectedDongNames, setSelectedDongNames] = useState<string[]>([]);
  const district = useMemo(
    () => districts.find((item) => item.districtName === districtName) ?? districts[0],
    [districtName, districts],
  );
  const visibleAreas = useMemo(() => areas.filter((area) => districtName === "서울 전체" || areaDistricts(area).includes(districtName)), [areas, districtName]);
  const dongOptions = useMemo(() => [...new Set(visibleAreas.flatMap(areaDongs))].toSorted((a, b) => a.localeCompare(b, "ko-KR")), [visibleAreas]);
  const cards = FEATURED_IDS.map((id) => district.indicators.find((item) => item.id === id)).filter(Boolean).map((item) => calculateIndicator(item as IndicatorValue, null, null));
  const selectedLabel = selectedArea ? `${selectedArea.name} (${areaDongs(selectedArea).join(", ")})` : selectedDongNames.length ? selectedDongNames.join(", ") : null;

  const toggleDong = (dong: string) => {
    setSelectedArea(null);
    setOverviewArea(null);
    setSelectedDongNames((current) => current.includes(dong) ? current.filter((item) => item !== dong) : [...current, dong]);
  };

  const selectArea = (area: UrbanArea) => {
    if (selectedArea?.id === area.id) {
      setSelectedArea(null);
      setOverviewArea(null);
      setSelectedDongNames([]);
      return;
    }
    const nextDistricts = areaDistricts(area);
    if (districtName === "서울 전체" || !nextDistricts.includes(districtName)) setDistrictName(nextDistricts[0]);
    setSelectedArea(area);
    setSelectedDongNames(areaDongs(area));
  };

  const changeDistrict = (name: string) => {
    setDistrictName(name);
    setSelectedArea(null);
    setOverviewArea(null);
    setSelectedDongNames([]);
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="홈">
          <span className="brand-mark"><Building2 size={21} /></span>
          <span>서울시 도시재생 <b>체감지도</b></span>
        </a>
        <nav className={menuOpen ? "open" : ""}>
          <button className={tab === "dashboard" ? "active" : ""} onClick={() => { setTab("dashboard"); setMenuOpen(false); }}>대시보드</button>
          <button className={tab === "method" ? "active" : ""} onClick={() => { setTab("method"); setMenuOpen(false); }}>지표 설명</button>
          <a href="#sources" onClick={() => setMenuOpen(false)}>데이터 출처</a>
        </nav>
        <div className="header-status"><span /> 데이터 업데이트 {district.lastUpdated}</div>
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="메뉴">{menuOpen ? <X /> : <Menu />}</button>
      </header>

      {tab === "dashboard" ? (
        <>
          <section className="hero" id="top">
            <div className="hero-copy">
              <div className="eyebrow"><span /> SEOUL URBAN REGENERATION MAP</div>
              <h1>서울시 도시재생 성과,<br /><em>어떻게 생각하시나요?</em></h1>
              <p>지역을 선택하고 다양한 지표를 통해 도시재생 성과를 함께 살펴보세요.</p>
            </div>
            <div className="hero-stat">
              <span>서울시 도시재생활성화지역</span>
              <strong>{district.regenerationAreas}<small>개소</small></strong>
              <p><MapPin size={14} /> {districtName} 기준</p>
            </div>
          </section>

          <section className="controls" aria-label="조회 조건">
            <label><Search size={18} /><span>구 선택</span>
              <select value={districtName} onChange={(event) => changeDistrict(event.target.value)}>
                {districts.map((item) => <option key={item.districtCode} value={item.districtName}>{item.districtName}</option>)}
              </select><ChevronDown size={16} />
            </label>
            <div className="dong-filter" aria-label="법정동 선택">
              <span>법정동 선택</span>
              <div className="dong-tabs">
                {dongOptions.length ? dongOptions.map((dong) => (
                  <button key={dong} className={selectedDongNames.includes(dong) ? "active" : ""} onClick={() => toggleDong(dong)} type="button">{dong}</button>
                )) : <b>자료준비필요</b>}
              </div>
            </div>
            <div className="updated"><RefreshCw size={16} /> 최신 데이터 {district.lastUpdated}</div>
          </section>

          <section className="detail section-wrap">
            <div className="section-heading">
              <div><span className="section-kicker">SPATIAL VIEW</span><h2>지도 및 도시재생활성화지역 목록</h2></div>
              <p>지도에서 구를 누르면 구 선택이 바뀌고, 목록을 누르면 법정동이 자동 선택됩니다.</p>
            </div>
            <div className="spatial-grid">
              <SeoulMap
                areas={areas}
                district={districtName}
                selectedAreaId={selectedArea?.id ?? null}
                onDistrictSelect={changeDistrict}
                onAreaSelect={selectArea}
              />
              <aside className="area-panel">
                <span className="panel-label">URBAN REGENERATION AREAS</span>
                <h3>{districtName === "서울 전체" ? "서울 전체 도시재생활성화지역" : `${districtName} 도시재생활성화지역`}</h3>
                <p className="area-count"><b>{district.regenerationAreas}</b>개 활성화지역</p>
                <ul>
                  {visibleAreas.map((area) => (
                    <li key={area.id} className={selectedArea?.id === area.id ? "active" : ""} onClick={() => selectArea(area)}>
                      <span><MapPin size={14} /></span>
                      <div>
                        <b>{area.name}{area.auxiliary?.cancelled ? " (계획취소)" : ""}</b>
                        <small>{areaDistricts(area).join(" / ")} · {areaDongs(area).join(", ")} · {area.type} · 고시 {areaBaseYear(area) ?? "자료준비필요"}</small>
                        <button
                          className="area-detail-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOverviewArea(area);
                          }}
                        >
                          상세보기
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                {selectedArea ? (
                  <button className="survey-button" type="button" onClick={() => alert("준비중입니다")}>
                    설문조사하러가기
                  </button>
                ) : null}
              </aside>
            </div>
          </section>

          {overviewArea ? (
            <div className="modal-backdrop" role="presentation" onClick={() => setOverviewArea(null)}>
              <section className="area-modal" role="dialog" aria-modal="true" aria-labelledby="area-modal-title" onClick={(event) => event.stopPropagation()}>
                <button className="modal-close" type="button" onClick={() => setOverviewArea(null)} aria-label="상세보기 닫기"><X size={18} /></button>
                <span className="panel-label">PROJECT OVERVIEW</span>
                <h3 id="area-modal-title">{overviewArea.name}{overviewArea.auxiliary?.cancelled ? " (계획취소)" : ""}</h3>
                <dl>
                  <div><dt>구분</dt><dd>{overviewArea.auxiliary?.supportType ?? "자료준비필요"}</dd></div>
                  <div><dt>유형</dt><dd>{overviewArea.type}</dd></div>
                  <div><dt>관할 자치구</dt><dd>{areaDistricts(overviewArea).join(" / ")}</dd></div>
                  <div><dt>법정동</dt><dd>{areaDongs(overviewArea).join(", ")}</dd></div>
                  <div><dt>선정연도</dt><dd>{overviewArea.auxiliary?.selectionYear ?? "자료준비필요"}</dd></div>
                  <div><dt>고시</dt><dd>{overviewArea.auxiliary?.notificationDate ?? overviewArea.auxiliary?.notificationYear ?? "자료준비필요"}</dd></div>
                  <div><dt>상태</dt><dd>{overviewArea.auxiliary?.cancelled ? `계획취소 (${overviewArea.auxiliary.cancelledDate})` : overviewArea.status}</dd></div>
                </dl>
              </section>
            </div>
          ) : null}

          <section className="overview section-wrap">
            <div className="section-heading">
              <div><span className="section-kicker">INDICATORS</span><h2>{selectedLabel ?? "도시재생활성화지역을 선택하세요"}</h2></div>
              <p>선택한 구·법정동 기준의 지표 준비 상태입니다.</p>
            </div>
            {selectedLabel ? (
              <div className="metric-grid">
                {cards.map((item) => <IndicatorCard item={item} key={item.id} />)}
                <article className="indicator-card deferred">
                  <div className="card-topline"><span className="metric-icon"><Database size={18} /></span><span className="pending-badge">2차 구축</span></div>
                  <p className="metric-label">신규창업 / 폐업</p>
                  <strong className="deferred-title">자료준비필요</strong>
                  <p className="deferred-copy">기존 데이터는 초기화되었으며<br />신규 원자료 구축 후 반영 예정</p>
                </article>
              </div>
            ) : (
              <div className="indicator-empty">도시재생활성화지역 목록을 선택하면 지표 영역이 표시됩니다.</div>
            )}
          </section>

          <section className="notice section-wrap">
            <Info size={20} />
            <div><b>지표 해석 시 참고하세요</b><p>본 대시보드는 공개 통계의 집계 주기와 공간 단위가 서로 다를 수 있습니다. 지표별 기준은 ‘지표 설명’에서 확인할 수 있습니다.</p></div>
          </section>
        </>
      ) : (
        <section className="method-page section-wrap" id="top">
          <span className="section-kicker">INDICATOR GUIDE</span>
          <h1>지표 산정 기준</h1>
          <p>각 지표의 의미와 해석 기준을 확인하세요.</p>
          <div className="method-grid">
            {indicatorMeta.map((meta) => (
              <article key={meta.id}><span>{meta.category}</span><h2>{meta.label}</h2><p>{meta.description}</p></article>
            ))}
          </div>
        </section>
      )}

      <footer id="sources">
        <div><b>서울시 도시재생 체감지도</b><p>도시재생활성화지역 선택과 의견 수렴</p></div>
        <div className="source-list">{sourceMeta.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.name}</a>)}</div>
        <small>coverage 생성: {coverage.generatedAt} · 자치구 {coverage.districtCount}개</small>
      </footer>
    </main>
  );
}
