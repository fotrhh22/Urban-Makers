"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GoogleMap,
  InfoWindowF,
  MarkerF,
  OverlayViewF,
  PolygonF,
  useJsApiLoader,
} from "@react-google-maps/api";
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from "geojson";
import type { UrbanArea } from "@/lib/types";

type DistrictProperties = { adm_cd?: string; adm_nm?: string; name?: string };
type DistrictFeature = Feature<Polygon | MultiPolygon, DistrictProperties>;
type DistrictCollection = FeatureCollection<Polygon | MultiPolygon, DistrictProperties>;
type LatLng = google.maps.LatLngLiteral;

const MAP_LIBRARIES: Parameters<typeof useJsApiLoader>[0]["libraries"] = [];
const SEOUL_CENTER = { lat: 37.5665, lng: 126.978 };
const FIT_PADDING = 56;

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
  clickableIcons: false,
  gestureHandling: "greedy",
  zoomControl: true,
  styles: [
    { featureType: "poi.business", stylers: [{ visibility: "off" }] },
    { featureType: "poi", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { featureType: "road", elementType: "labels", stylers: [{ saturation: -20 }, { lightness: 10 }] },
  ],
};

const DIMMER_OUTER_PATH: LatLng[] = [
  { lat: 37.25, lng: 126.45 },
  { lat: 37.25, lng: 127.55 },
  { lat: 37.9, lng: 127.55 },
  { lat: 37.9, lng: 126.45 },
];

function districtName(feature?: Feature<Geometry, DistrictProperties>): string {
  const fullName = feature?.properties?.adm_nm ?? feature?.properties?.name ?? "";
  return fullName.split(" ").at(-1) ?? fullName;
}

function ringToPath(ring: number[][]): LatLng[] {
  return ring.map(([lng, lat]) => ({ lat, lng }));
}

function outerPaths(feature: DistrictFeature): LatLng[][] {
  const { geometry } = feature;
  if (geometry.type === "Polygon") return [ringToPath(geometry.coordinates[0])];
  return geometry.coordinates.map((polygon) => ringToPath(polygon[0]));
}

function featurePaths(feature: DistrictFeature): LatLng[][] {
  const { geometry } = feature;
  if (geometry.type === "Polygon") return geometry.coordinates.map(ringToPath);
  return geometry.coordinates.flatMap((polygon) => polygon.map(ringToPath));
}

function allGeometryPoints(features: DistrictFeature[]): LatLng[] {
  return features.flatMap((feature) => outerPaths(feature).flat());
}

function labelPosition(feature: DistrictFeature): LatLng {
  const points = outerPaths(feature).flat();
  const bounds = points.reduce(
    (acc, point) => ({
      minLat: Math.min(acc.minLat, point.lat),
      maxLat: Math.max(acc.maxLat, point.lat),
      minLng: Math.min(acc.minLng, point.lng),
      maxLng: Math.max(acc.maxLng, point.lng),
    }),
    { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity },
  );
  return { lat: (bounds.minLat + bounds.maxLat) / 2, lng: (bounds.minLng + bounds.maxLng) / 2 };
}

function districtOptions(selected: boolean, hovered: boolean): google.maps.PolygonOptions {
  if (selected) {
    return {
      fillColor: "#86EFAC",
      fillOpacity: 0.58,
      strokeColor: "#047857",
      strokeOpacity: 1,
      strokeWeight: 3,
      clickable: true,
      zIndex: 4,
    };
  }
  return {
    fillColor: hovered ? "#F0F8F5" : "#FFFFFF",
    fillOpacity: hovered ? 0.34 : 0.2,
    strokeColor: hovered ? "#7FA49C" : "#FFFFFF",
    strokeOpacity: hovered ? 0.95 : 0.88,
    strokeWeight: hovered ? 1.4 : 1,
    clickable: true,
    zIndex: hovered ? 3 : 2,
  };
}

function markerIcon(selected: boolean): google.maps.Symbol {
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    scale: selected ? 7 : 5,
    fillColor: selected ? "#0F8F3D" : "#169B45",
    fillOpacity: selected ? 1 : 0.88,
    strokeColor: "#FFFFFF",
    strokeOpacity: 1,
    strokeWeight: selected ? 2.5 : 2,
  };
}

function MapMessage({ children }: { children: React.ReactNode }) {
  return <div className="map-canvas map-loading">{children}</div>;
}

export default function SeoulMap({
  areas,
  district,
  selectedAreaId,
  onDistrictSelect,
  onAreaSelect,
}: {
  areas: UrbanArea[];
  district: string;
  selectedAreaId: string | null;
  onDistrictSelect: (district: string) => void;
  onAreaSelect: (area: UrbanArea) => void;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script-ko-kr",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries: MAP_LIBRARIES,
    language: "ko",
    region: "KR",
  });
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [geojson, setGeojson] = useState<DistrictCollection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const [didFitInitialBounds, setDidFitInitialBounds] = useState(false);

  useEffect(() => {
    fetch("/data/geo/seoul_gu.geojson")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data: DistrictCollection) => {
        if (data.features.length !== 25) throw new Error(`자치구 경계 ${data.features.length}개`);
        setGeojson(data);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "알 수 없는 오류"));
  }, []);

  const features = useMemo(() => geojson?.features ?? [], [geojson]);
  const visibleAreas = useMemo(
    () => district === "서울 전체" ? areas : areas.filter((area) => (area.districts ?? [area.district]).includes(district)),
    [areas, district],
  );
  const selectedArea = useMemo(() => visibleAreas.find((area) => area.id === selectedAreaId) ?? null, [selectedAreaId, visibleAreas]);
  const dimmerPaths = useMemo(() => [DIMMER_OUTER_PATH, ...features.flatMap(outerPaths)], [features]);
  const hideDistrictLabels = Boolean(selectedAreaId);

  useEffect(() => {
    if (!map || !isLoaded || !features.length || didFitInitialBounds) return;
    const allPoints = [
      ...allGeometryPoints(features),
      ...areas.map((area) => ({ lat: area.latitude, lng: area.longitude })),
    ];
    if (!allPoints.length) return;

    const bounds = new window.google.maps.LatLngBounds();
    allPoints.forEach((point) => bounds.extend(point));
    if (allPoints.length === 1) {
      map.setCenter(bounds.getCenter());
      map.setZoom(17);
      return;
    }
    map.fitBounds(bounds, FIT_PADDING);
    setDidFitInitialBounds(true);
  }, [areas, didFitInitialBounds, features, isLoaded, map]);

  const onLoad = useCallback((instance: google.maps.Map) => setMap(instance), []);
  const onUnmount = useCallback(() => setMap(null), []);

  if (loadError) return <MapMessage>Google 지도를 불러오지 못했습니다.</MapMessage>;
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) return <MapMessage>Google Maps API 키가 필요합니다.</MapMessage>;
  if (!isLoaded) return <MapMessage>지도 로딩 중...</MapMessage>;

  return (
    <div className="map-canvas" aria-label={`${district} 도시재생활성화지역 지도`}>
      {error ? <div className="map-error">지도 경계를 불러오지 못했습니다: {error}</div> : null}
      <GoogleMap
        mapContainerClassName="google-map"
        center={SEOUL_CENTER}
        zoom={11}
        options={MAP_OPTIONS}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={() => onDistrictSelect("서울 전체")}
      >
        {features.length ? (
          <PolygonF
            paths={dimmerPaths}
            options={{
              fillColor: "#0F172A",
              fillOpacity: 0.36,
              strokeOpacity: 0,
              clickable: false,
              zIndex: 1,
            }}
          />
        ) : null}

        {features.map((feature) => {
          const name = districtName(feature);
          const selected = district !== "서울 전체" && name === district;
          const hovered = hoveredDistrict === name;
          return (
            <div key={feature.properties?.adm_cd ?? name}>
              <PolygonF
                paths={featurePaths(feature)}
                options={districtOptions(selected, hovered)}
                onClick={() => onDistrictSelect(selected ? "서울 전체" : name)}
                onMouseOver={() => setHoveredDistrict(name)}
                onMouseOut={() => setHoveredDistrict(null)}
              />
              {!hideDistrictLabels ? (
                <OverlayViewF
                  position={labelPosition(feature)}
                  mapPaneName="floatPane"
                  getPixelPositionOffset={(width, height) => ({ x: -width / 2, y: -height / 2 })}
                >
                  <span className={`district-map-label${selected ? " selected" : ""}${hovered ? " hovered" : ""}`}>
                    {name}
                  </span>
                </OverlayViewF>
              ) : null}
            </div>
          );
        })}

        {visibleAreas.map((area) => (
          <MarkerF
            key={area.id}
            position={{ lat: area.latitude, lng: area.longitude }}
            icon={markerIcon(selectedAreaId === area.id)}
            title={area.name}
            zIndex={selectedAreaId === area.id ? 20 : 10}
            onClick={() => onAreaSelect(area)}
          />
        ))}

        {selectedArea ? (
          <InfoWindowF
            position={{ lat: selectedArea.latitude, lng: selectedArea.longitude }}
            onCloseClick={() => onAreaSelect(selectedArea)}
          >
            <div className="map-info-window">
              <b>{selectedArea.name}</b>
              <span>{(selectedArea.districts ?? [selectedArea.district]).join(" / ")} · {selectedArea.type}</span>
              {selectedArea.auxiliary?.cancelled ? <em>계획취소</em> : null}
            </div>
          </InfoWindowF>
        ) : null}
      </GoogleMap>
      <div className="map-legend"><span /> 서울시 도시재생활성화지역 {areas.length}개</div>
    </div>
  );
}
