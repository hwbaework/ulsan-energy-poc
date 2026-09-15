'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import * as THREE from 'three';
import krProvinces from './kr-provinces.json';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export type MapStyleKey = 'standard' | 'satellite' | 'dark';
export type LightPreset = 'dawn' | 'day' | 'dusk' | 'night';
export type Weather = 'clear' | 'rain' | 'snow';

// 기상 관측소 오버레이 (KMA)
export interface WxStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  rainfall: number;
  precipitationType: string;
}
export type WxLayer = 'none' | 'temp' | 'precip' | 'wind';
// ── 기상 코로플레스(시도 폴리곤 채색) — 원본과 동일 방식 ──
function centroid(geom: GeoJSON.Geometry): [number, number] {
  let x = 0,
    y = 0,
    n = 0;
  const acc = (ring: number[][]) => {
    for (const p of ring) {
      x += p[0]!;
      y += p[1]!;
      n++;
    }
  };
  if (geom.type === 'Polygon') (geom.coordinates as number[][][]).forEach((r) => acc(r));
  else if (geom.type === 'MultiPolygon')
    (geom.coordinates as number[][][][]).forEach((poly) => poly.forEach((r) => acc(r)));
  return n ? [x / n, y / n] : [128, 36];
}
function nearestStation(stations: WxStation[], lng: number, lat: number): WxStation | null {
  let best: WxStation | null = null,
    bd = Infinity;
  for (const s of stations) {
    const d = (s.lng - lng) ** 2 + (s.lat - lat) ** 2;
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}
function hexLerp(a: string, b: string, t: number): string {
  const c = Math.max(0, Math.min(1, t));
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  return (
    '#' +
    pa
      .map((v, i) =>
        Math.round(v + (pb[i]! - v) * c)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
function metricColor(metric: WxLayer, s: WxStation): string {
  if (metric === 'precip') return hexLerp('#e0e7ff', '#312e81', Math.min(1, s.rainfall / 15));
  if (metric === 'wind') return hexLerp('#cffafe', '#0e7490', Math.min(1, s.windSpeed / 12));
  return hexLerp('#dcfce7', '#166534', Math.max(0, Math.min(1, (s.temperature - 8) / 22)));
}
function buildChoropleth(
  provinces: GeoJSON.FeatureCollection,
  stations: WxStation[],
  metric: WxLayer,
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: provinces.features.map((f) => {
      const [cx, cy] = centroid(f.geometry);
      const st = nearestStation(stations, cx, cy);
      return { ...f, properties: { ...(f.properties ?? {}), wxColor: st ? metricColor(metric, st) : '#334155' } };
    }),
  };
}
function applyWxChoropleth(
  map: mapboxgl.Map,
  provinces: GeoJSON.FeatureCollection | null,
  stations: WxStation[],
  layer: WxLayer,
) {
  const show = layer !== 'none' && !!provinces && stations.length > 0;
  const ids = ['wx-fill', 'wx-fill-line'];
  if (!show) {
    for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
    return;
  }
  const src = map.getSource('wx-fill') as mapboxgl.GeoJSONSource | undefined;
  src?.setData(buildChoropleth(provinces!, stations, layer));
  for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
}

const STYLE_URL: Record<MapStyleKey, string> = {
  standard: 'mapbox://styles/mapbox/standard',
  satellite: 'mapbox://styles/mapbox/standard-satellite',
  dark: 'mapbox://styles/mapbox/dark-v11',
};
// lightPreset(시간대 조명·그림자)은 Standard 계열에서만 동작
const SUPPORTS_LIGHT = (s: MapStyleKey) => s === 'standard' || s === 'satellite';

export interface MapView {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

type Tier = 'L0' | 'L1' | 'L2' | 'L3';

// ── 실데이터: 발전소·변전소 앵커 (실좌표) ──
const ANCHORS: { key: string; name: string; kind: string; lng: number; lat: number; sub: string }[] = [
  { key: 'singori', name: '신고리원전', kind: 'nuke', lng: 129.29, lat: 35.32, sub: '원자력 · 765kV 송출' },
  { key: 'ulsanTP', name: '울산화력', kind: 'lng', lng: 129.36, lat: 35.492, sub: 'LNG 복합 · 345kV' },
  { key: 'samcheonpo', name: '삼천포화력', kind: 'coal', lng: 128.15, lat: 34.943, sub: '석탄 · 고성 하이면' },
  { key: 'bukgn', name: '북경남변전소', kind: 'ss765', lng: 128.48, lat: 35.52, sub: '765kV S/S · 창녕' },
  { key: 'sinjinju', name: '신진주변전소', kind: 'ss345', lng: 128.18, lat: 35.2, sub: '345kV S/S · 진주' },
];
const LINES: { name: string; kv: number; coords: [number, number][] }[] = [
  {
    name: '765kV 신고리–북경남',
    kv: 765,
    coords: [
      [129.29, 35.32],
      [129.12, 35.42],
      [128.9, 35.5],
      [128.78, 35.55],
      [128.48, 35.52],
    ],
  },
  {
    name: '345kV 삼천포–신진주',
    kv: 345,
    coords: [
      [128.15, 34.943],
      [128.16, 35.05],
      [128.18, 35.2],
    ],
  },
  {
    name: '345kV 울산화력–신고리',
    kv: 345,
    coords: [
      [129.36, 35.492],
      [129.33, 35.4],
      [129.29, 35.32],
    ],
  },
  {
    name: '345kV 신진주–북경남',
    kv: 345,
    coords: [
      [128.18, 35.2],
      [128.3, 35.35],
      [128.48, 35.52],
    ],
  },
];
const anchorsGeo: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: ANCHORS.map((a) => ({
    type: 'Feature',
    properties: { name: a.name, sub: a.sub, kind: a.kind },
    geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
  })),
};
const linesGeo: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: LINES.map((l) => ({
    type: 'Feature',
    properties: { name: l.name, kv: l.kv },
    geometry: { type: 'LineString', coordinates: l.coords },
  })),
};

// ── L1 산단 / L2 트윈 건물 / L3 설비 ──
const mLat = (m: number) => m / 110540;
const mLng = (m: number, lat: number) => m / (111320 * Math.cos((lat * Math.PI) / 180));
function rect(clng: number, clat: number, wM: number, hM: number): [number, number][][] {
  const dx = mLng(wM / 2, clat),
    dy = mLat(hM / 2);
  return [
    [
      [clng - dx, clat - dy],
      [clng + dx, clat - dy],
      [clng + dx, clat + dy],
      [clng - dx, clat + dy],
      [clng - dx, clat - dy],
    ],
  ];
}
const ZONES: { id: string; name: string; c: [number, number] }[] = [
  { id: 'onsan', name: '온산국가산단', c: [129.34, 35.435] },
  { id: 'mipo', name: '미포국가산단', c: [129.385, 35.5] },
  { id: 'yongyeon', name: '용연공단', c: [129.36, 35.47] },
];
const zonesGeo: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: ZONES.map((z) => ({
    type: 'Feature',
    properties: { name: z.name },
    geometry: { type: 'Polygon', coordinates: rect(z.c[0], z.c[1], 2600, 2200) },
  })),
};
const TWIN = ZONES[0]!;
const PPA_COLOR: Record<string, string> = { Onsite: '#22c55e', Lease: '#22c55e', Offsite: '#f59e0b' };
let seed = 7;
const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
const twinFeatures: GeoJSON.Feature[] = [];
for (let gx = 0; gx < 5; gx++)
  for (let gy = 0; gy < 4; gy++) {
    const lng = TWIN.c[0] + mLng((gx - 2) * 260, TWIN.c[1]);
    const lat = TWIN.c[1] + mLat((gy - 1.5) * 260);
    const type = rnd() < 0.6 ? 'Onsite' : rnd() < 0.5 ? 'Onsite' : 'Offsite';
    twinFeatures.push({
      type: 'Feature',
      properties: { height: 40 + Math.round(rnd() * 120), color: PPA_COLOR[type], ppa: type },
      geometry: { type: 'Polygon', coordinates: rect(lng, lat, 120 + rnd() * 60, 120 + rnd() * 60) },
    });
  }
const twinGeo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: twinFeatures };
const FAC: { name: string; c: [number, number]; st: string; kw: string }[] = [
  { name: 'INV-01 인버터', c: [TWIN.c[0] - 0.004, TWIN.c[1] + 0.002], st: '정상', kw: '420 kW' },
  { name: 'PCS-02', c: [TWIN.c[0] + 0.002, TWIN.c[1] + 0.003], st: '정상', kw: '380 kW' },
  { name: 'ESS-01', c: [TWIN.c[0] + 0.004, TWIN.c[1] - 0.001], st: '경보', kw: '-120 kW' },
  { name: '계량기 M-07', c: [TWIN.c[0] - 0.002, TWIN.c[1] - 0.003], st: '정상', kw: '수전 210 kW' },
];
const facGeo: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: FAC.map((f) => ({
    type: 'Feature',
    properties: { name: f.name, kw: f.kw, color: f.st === '경보' ? '#ef4444' : '#38bdf8' },
    geometry: { type: 'Point', coordinates: f.c },
  })),
};

const LAYER_TIERS: Record<Tier, string[]> = {
  L0: ['flow-line', 'flow-label', 'anchor-dot', 'anchor-label'],
  L1: ['flow-line', 'flow-label', 'anchor-dot', 'anchor-label', 'zone-fill', 'zone-line', 'zone-label'],
  L2: ['twin-3d', 'zone-line', 'zone-label'],
  L3: ['twin-3d', 'fac-dot', 'fac-label'],
};
const ALL_LAYERS = [
  'flow-line',
  'flow-label',
  'anchor-dot',
  'anchor-label',
  'zone-fill',
  'zone-line',
  'zone-label',
  'twin-3d',
  'fac-dot',
  'fac-label',
];

// ── Three.js 헬퍼 ──
function lineLen(c: [number, number][]) {
  let L = 0;
  for (let i = 1; i < c.length; i++) {
    const a = c[i - 1]!,
      b = c[i]!;
    L += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return L;
}
function sampleLine(c: [number, number][], t: number): [number, number] {
  let d = t * lineLen(c);
  for (let i = 1; i < c.length; i++) {
    const a = c[i - 1]!,
      b = c[i]!;
    const s = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= s) {
      const r = s ? d / s : 0;
      return [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r];
    }
    d -= s;
  }
  return c[c.length - 1]!;
}
function placeAt(mesh: THREE.Object3D, lng: number, lat: number, altM: number, sizeM: number) {
  const m = mapboxgl.MercatorCoordinate.fromLngLat([lng, lat], altM);
  mesh.position.set(m.x, m.y, m.z);
  mesh.scale.setScalar(m.meterInMercatorCoordinateUnits() * sizeM);
}

// 실제 줌 레벨 → LOD tier (VIEW 줌: L0 6, L1 10.4, L2 13.6, L3 15.6 사이 경계)
function tierFromZoom(z: number): Tier {
  return z < 8 ? 'L0' : z < 12 ? 'L1' : z < 14.8 ? 'L2' : 'L3';
}

interface MapBackdropProps {
  view: MapView;
  tier: Tier;
  mapStyle: MapStyleKey;
  lightPreset: LightPreset;
  weather: Weather;
  wxStations: WxStation[];
  wxLayer: WxLayer;
  onTierChange: (t: Tier) => void;
  onMapClick: () => void;
}

export function MapBackdrop({
  view,
  tier,
  mapStyle,
  lightPreset,
  weather,
  wxStations,
  wxLayer,
  onTierChange,
  onMapClick,
}: MapBackdropProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const readyRef = useRef(false);
  const tierRef = useRef<Tier>(tier);
  tierRef.current = tier;
  const lightRef = useRef<LightPreset>(lightPreset);
  lightRef.current = lightPreset;
  const weatherRef = useRef<Weather>(weather);
  weatherRef.current = weather;
  const styleRef = useRef<MapStyleKey>(mapStyle);
  styleRef.current = mapStyle;
  const wxLayerRef = useRef<WxLayer>(wxLayer);
  wxLayerRef.current = wxLayer;
  const wxDataRef = useRef<WxStation[]>(wxStations);
  wxDataRef.current = wxStations;
  const onTierRef = useRef(onTierChange);
  onTierRef.current = onTierChange;
  const onClickRef = useRef(onMapClick);
  onClickRef.current = onMapClick;
  // 시도 경계 (번들 import) — 코로플레스용
  const provincesRef = useRef<GeoJSON.FeatureCollection>(krProvinces as unknown as GeoJSON.FeatureCollection);

  // 초기화 (한 번)
  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLE_URL[mapStyle],
      center: view.center,
      zoom: view.zoom,
      pitch: view.pitch,
      bearing: view.bearing,
      interactive: true,
      attributionControl: false,
      projection: 'mercator',
      dragRotate: false,
      pitchWithRotate: false,
      minZoom: 5.9, // L0 계통·거래 = 줌아웃 한계(전국 프레이밍 고정)
      maxZoom: 18,
      maxBounds: [
        [123.5, 32.0],
        [133.0, 40.0],
      ], // 한반도 밖으로 이동 방지
      localIdeographFontFamily: "'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif",
    });
    mapRef.current = map;

    // 줌 상태 → LOD tier (메뉴/대시보드 반영). 사용자 줌으로 구간이 바뀌면 tier 갱신.
    map.on('moveend', () => {
      const t = tierFromZoom(map.getZoom());
      if (t !== tierRef.current) onTierRef.current(t);
    });
    // 맵 클릭 → info 토글
    map.on('click', () => onClickRef.current());

    // style.load 는 최초 로드 + setStyle 이후마다 발생 → 오버레이·조명·날씨 재적용
    map.on('style.load', () => {
      map.resize();
      setupOverlays(map);
      applyLight(map, styleRef.current, lightRef.current);
      applyWeather(map, weatherRef.current);
      applyTierVisibility(map, tierRef.current);
      applyWxChoropleth(map, provincesRef.current, wxDataRef.current, wxLayerRef.current);
      readyRef.current = true;
    });

    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 스타일 전환 (초기 스타일은 생성자에서 이미 적용됨 → ready 이후 변경만 setStyle)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    readyRef.current = false;
    map.setStyle(STYLE_URL[mapStyle]); // → style.load 에서 오버레이·조명·날씨 재적용
  }, [mapStyle]);

  // 시간대 조명(그림자)
  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) applyLight(map, styleRef.current, lightPreset);
  }, [lightPreset]);

  // 날씨(비주얼)
  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) applyWeather(map, weather);
  }, [weather]);

  // 기상 데이터/레이어 갱신 → 코로플레스 재계산
  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) applyWxChoropleth(map, provincesRef.current, wxStations, wxLayer);
  }, [wxStations, wxLayer]);

  // tier 변경 시: 레일 클릭이면 flyTo(현재 줌이 그 tier가 아님), 사용자 줌이면 flyTo 생략(이미 그 위치)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tierFromZoom(map.getZoom()) !== tier) map.flyTo({ ...view, duration: 1400, essential: true });
    if (readyRef.current) applyTierVisibility(map, tier);
  }, [view, tier]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
      <div className="pointer-events-none absolute inset-0 bg-[#060a14]/15" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#060a14]/45 via-transparent to-[#060a14]/35" />
    </div>
  );
}

// ── 오버레이(소스+레이어+Three) 구성 — style.load 마다 재실행 ──
function setupOverlays(map: mapboxgl.Map) {
  if (!map.getSource('grid-lines')) map.addSource('grid-lines', { type: 'geojson', data: linesGeo });
  if (!map.getLayer('flow-line'))
    map.addLayer({
      id: 'flow-line',
      type: 'line',
      source: 'grid-lines',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['case', ['>=', ['get', 'kv'], 765], '#a855f7', '#60a5fa'],
        'line-width': ['case', ['>=', ['get', 'kv'], 765], 3.2, 1.8],
        'line-opacity': 0.85,
      },
    });
  if (!map.getLayer('flow-label'))
    map.addLayer({
      id: 'flow-label',
      type: 'symbol',
      source: 'grid-lines',
      layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-size': 11, 'symbol-spacing': 320 },
      paint: { 'text-color': '#cbb6f5', 'text-halo-color': '#0b1120', 'text-halo-width': 1.3 },
    });

  if (!map.getSource('anchors')) map.addSource('anchors', { type: 'geojson', data: anchorsGeo });
  if (!map.getLayer('anchor-dot'))
    map.addLayer({
      id: 'anchor-dot',
      type: 'circle',
      source: 'anchors',
      paint: {
        'circle-radius': 7,
        'circle-color': [
          'match',
          ['get', 'kind'],
          'nuke',
          '#38bdf8',
          'coal',
          '#f59e0b',
          'lng',
          '#22c55e',
          'ss765',
          '#a855f7',
          'ss345',
          '#60a5fa',
          '#3b82f6',
        ],
        'circle-stroke-color': '#e5edf7',
        'circle-stroke-width': 1.6,
        'circle-opacity': 0.95,
      },
    });
  if (!map.getLayer('anchor-label'))
    map.addLayer({
      id: 'anchor-label',
      type: 'symbol',
      source: 'anchors',
      layout: {
        'text-field': ['concat', ['get', 'name'], '\n', ['get', 'sub']],
        'text-size': 12,
        'text-offset': [0, 1.5],
      },
      paint: { 'text-color': '#e5edf7', 'text-halo-color': '#0b1120', 'text-halo-width': 1.4 },
    });

  if (!map.getSource('zones')) map.addSource('zones', { type: 'geojson', data: zonesGeo });
  if (!map.getLayer('zone-fill'))
    map.addLayer({
      id: 'zone-fill',
      type: 'fill',
      source: 'zones',
      paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.14 },
    });
  if (!map.getLayer('zone-line'))
    map.addLayer({
      id: 'zone-line',
      type: 'line',
      source: 'zones',
      paint: { 'line-color': '#60a5fa', 'line-width': 1.6, 'line-opacity': 0.85 },
    });
  if (!map.getLayer('zone-label'))
    map.addLayer({
      id: 'zone-label',
      type: 'symbol',
      source: 'zones',
      layout: { 'text-field': ['get', 'name'], 'text-size': 13 },
      paint: { 'text-color': '#dbeafe', 'text-halo-color': '#0b1120', 'text-halo-width': 1.4 },
    });

  if (!map.getSource('twin')) map.addSource('twin', { type: 'geojson', data: twinGeo });
  if (!map.getLayer('twin-3d'))
    map.addLayer({
      id: 'twin-3d',
      type: 'fill-extrusion',
      source: 'twin',
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.88,
      },
    });

  if (!map.getSource('fac')) map.addSource('fac', { type: 'geojson', data: facGeo });
  if (!map.getLayer('fac-dot'))
    map.addLayer({
      id: 'fac-dot',
      type: 'circle',
      source: 'fac',
      paint: {
        'circle-radius': 7,
        'circle-color': ['get', 'color'],
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1.5,
      },
    });
  if (!map.getLayer('fac-label'))
    map.addLayer({
      id: 'fac-label',
      type: 'symbol',
      source: 'fac',
      layout: {
        'text-field': ['concat', ['get', 'name'], '  ', ['get', 'kw']],
        'text-size': 11,
        'text-offset': [0, 1.4],
      },
      paint: { 'text-color': '#e5edf7', 'text-halo-color': '#0b1120', 'text-halo-width': 1.3 },
    });

  // ── 기상 코로플레스 (시도 폴리곤 채색) — 기본 숨김, wxLayer 토글로 표시 ──
  if (!map.getSource('wx-fill'))
    map.addSource('wx-fill', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  if (!map.getLayer('wx-fill'))
    map.addLayer({
      id: 'wx-fill',
      type: 'fill',
      source: 'wx-fill',
      layout: { visibility: 'none' },
      paint: { 'fill-color': ['coalesce', ['get', 'wxColor'], '#334155'], 'fill-opacity': 0.55 },
    });
  if (!map.getLayer('wx-fill-line'))
    map.addLayer({
      id: 'wx-fill-line',
      type: 'line',
      source: 'wx-fill',
      layout: { visibility: 'none' },
      paint: { 'line-color': '#ffffff', 'line-opacity': 0.25, 'line-width': 0.6 },
    });

  addThreeFlow(map);
}

// ── Three.js 전력흐름 파티클 커스텀 레이어 ──
function addThreeFlow(map: mapboxgl.Map) {
  if (map.getLayer('three-flow')) return;
  let camera: THREE.Camera | null = null;
  let scene: THREE.Scene | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  const parts: { mesh: THREE.Mesh; ln: (typeof LINES)[number]; t: number; speed: number }[] = [];
  let lastT = performance.now();
  const layer: mapboxgl.CustomLayerInterface = {
    id: 'three-flow',
    type: 'custom',
    renderingMode: '3d',
    onAdd(m, gl) {
      camera = new THREE.Camera();
      scene = new THREE.Scene();
      renderer = new THREE.WebGLRenderer({
        canvas: m.getCanvas(),
        context: gl as WebGLRenderingContext,
        antialias: true,
      });
      renderer.autoClear = false;
      const pgeo = new THREE.SphereGeometry(1, 10, 10);
      for (const ln of LINES) {
        const col = ln.kv >= 765 ? 0xc084fc : 0x7dd3fc;
        const n = ln.kv >= 765 ? 7 : 4;
        for (let i = 0; i < n; i++) {
          const mesh = new THREE.Mesh(pgeo, new THREE.MeshBasicMaterial({ color: col }));
          scene.add(mesh);
          parts.push({ mesh, ln, t: i / n, speed: 0.05 + (ln.kv >= 765 ? 0.05 : 0.03) });
        }
      }
    },
    render(_gl, matrix) {
      if (!camera || !scene || !renderer) return;
      const now = performance.now();
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix as number[]);
      const show = tierGlobal === 'L0' || tierGlobal === 'L1';
      const pSize = tierGlobal === 'L0' ? 2200 : 700;
      const alt = tierGlobal === 'L0' ? 900 : 300;
      for (const p of parts) {
        p.mesh.visible = show;
        if (!show) continue;
        p.t = (p.t + dt * p.speed) % 1;
        const pt = sampleLine(p.ln.coords, p.t);
        placeAt(p.mesh, pt[0], pt[1], alt, pSize);
      }
      renderer.resetState();
      renderer.render(scene, camera);
      map.triggerRepaint();
    },
  };
  map.addLayer(layer);
}

// 파티클 가시성용 전역 tier (커스텀 레이어 render 클로저에서 읽음)
let tierGlobal: Tier = 'L0';

function applyTierVisibility(map: mapboxgl.Map, tier: Tier) {
  tierGlobal = tier;
  const shown = new Set(LAYER_TIERS[tier]);
  for (const id of ALL_LAYERS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', shown.has(id) ? 'visible' : 'none');
  }
}

// 시간대 조명(그림자) — Standard 계열만
function applyLight(map: mapboxgl.Map, style: MapStyleKey, preset: LightPreset) {
  if (!SUPPORTS_LIGHT(style)) return;
  try {
    map.setConfigProperty('basemap', 'lightPreset', preset);
    map.setConfigProperty('basemap', 'show3dObjects', true);
  } catch {
    /* 스타일이 아직 준비 안 됐거나 미지원 */
  }
}

// 날씨 (mapbox-gl 3.7+)
function applyWeather(map: mapboxgl.Map, weather: Weather) {
  const m = map as unknown as { setRain?: (o: unknown) => void; setSnow?: (o: unknown) => void };
  try {
    m.setRain?.(
      weather === 'rain'
        ? { density: 0.5, intensity: 1.0, color: '#a8adbc', opacity: 0.7, vignette: 0.6, 'vignette-color': '#464646' }
        : null,
    );
    m.setSnow?.(
      weather === 'snow' ? { density: 0.6, intensity: 0.9, color: '#ffffff', opacity: 0.9, vignette: 0.4 } : null,
    );
  } catch {
    /* 미지원 버전 무시 */
  }
}
