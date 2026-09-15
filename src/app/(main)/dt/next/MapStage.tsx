'use client';

// 맵 스테이지 — mapbox 초기화 + GIS 레이어 마운트 + 줌→tier(디바운스·히스테리시스)
// + tier×lens 가시성 게이팅 + bbox refetch(취소) + 클릭→selection.
// 모든 지오메트리는 dt-map-server(자기 origin 프록시 /api/mapserver)에서 온다.
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { LAYERS, fetchLayerData, tileUrl, type LayerDef } from './layers';
import { useWorld, nextTier, TIER_META, type CamView } from './world';
import { syncModelLayer } from './ModelLayer';
import { modelAnchorsGeo, DT_MODELS } from './models';

const ANCHOR_LAYER = 'next-ly-model-anchors';
const BLD3D_LAYER = 'next-ly-3d-bld';

// 모델 footprint 구멍(제외 영역) — 이 영역과 교차(1m 이내)하는 건물은 돌출에서 제외
function rectAround(c: [number, number], halfWm: number, halfHm: number): GeoJSON.Polygon {
  const dLng = halfWm / (111320 * Math.cos((c[1] * Math.PI) / 180));
  const dLat = halfHm / 110574;
  return {
    type: 'Polygon',
    coordinates: [
      [
        [c[0] - dLng, c[1] - dLat],
        [c[0] + dLng, c[1] - dLat],
        [c[0] + dLng, c[1] + dLat],
        [c[0] - dLng, c[1] + dLat],
        [c[0] - dLng, c[1] - dLat],
      ],
    ],
  };
}
// 초기(대상 id 판별 전) 필터 — 모델 footprint와 교차하는 건물을 잠시 제외 (플리커 방지)
const HOLE_CONDS = DT_MODELS.map((m) => ['>', ['distance', rectAround(m.lngLat, 34, 25)], 1]);

// point-in-polygon (ray casting) — 모델 중심이 들어있는 건물 footprint 판별
function ringContains(ring: GeoJSON.Position[], p: [number, number]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function geomContains(g: GeoJSON.Geometry, p: [number, number]): boolean {
  if (g.type === 'Polygon') return ringContains(g.coordinates[0] as GeoJSON.Position[], p);
  if (g.type === 'MultiPolygon') return g.coordinates.some((poly) => ringContains(poly[0] as GeoJSON.Position[], p));
  return false;
}

// 자체 3D 건물 레이어 — streets-v8 building을 직접 돌출시키되 모델 자리는 within 필터로 제외.
// L3에서 basemap 3D 대신 이 레이어를 켠다 → 주변은 입체 유지 + 모델은 파묻히지 않음.
function ensureCustom3dBuildings(map: mapboxgl.Map) {
  if (map.getLayer(BLD3D_LAYER)) return;
  if (!map.getSource('next-src-streets')) {
    map.addSource('next-src-streets', { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' });
  }
  map.addLayer({
    id: BLD3D_LAYER,
    type: 'fill-extrusion',
    source: 'next-src-streets',
    'source-layer': 'building',
    minzoom: 13,
    filter: ['all', ['==', ['get', 'extrude'], 'true'], ...HOLE_CONDS] as unknown as mapboxgl.FilterSpecification,
    layout: { visibility: 'none' },
    paint: {
      'fill-extrusion-color': '#e7dfd6',
      'fill-extrusion-height': ['coalesce', ['get', 'height'], 6],
      'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
      'fill-extrusion-opacity': 0.95,
      'fill-extrusion-vertical-gradient': true,
    } as never,
  });
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export type WeatherKey = 'clear' | 'rain' | 'snow';

// ── 태양 위치 (suncalc 알고리즘 내장 — TerraWatt 시각 슬라이더와 동일 동작) ──
// 반환: 고도(도, -90~90) · 방위각(도, 북 기준 시계방향 0~360 = mapbox direction 규약)
export function sunPositionDeg(date: Date, lat: number, lng: number): { altitudeDeg: number; azimuthDeg: number } {
  const rad = Math.PI / 180;
  const d = date.valueOf() / 86400000 - 0.5 + 2440588 - 2451545;
  const M = rad * (357.5291 + 0.98560028 * d);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + Math.PI;
  const e = rad * 23.4397;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L));
  const theta = rad * (280.16 + 360.9856235 * d) + rad * lng;
  const H = theta - ra;
  const phi = rad * lat;
  const altitude = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const azimuth = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { altitudeDeg: altitude / rad, azimuthDeg: (azimuth / rad + 180) % 360 };
}

/** 오늘 기준 hour(0~24 소수)의 Date */
export function dateAtHour(hour: number): Date {
  const d = new Date();
  const h = Math.floor(hour);
  d.setHours(h, Math.round((hour - h) * 60), 0, 0);
  return d;
}

// 태양 기준점 = 한일튜브 부지
export const SUN_REF = { lat: 35.50515, lng: 129.33079 };

function presetFromAltitude(altitudeDeg: number): 'dawn' | 'day' | 'dusk' | 'night' {
  if (altitudeDeg < -6) return 'night';
  if (altitudeDeg < 3) return 'dawn';
  return 'day';
}

// 시각 → 태양 위치 → 조명(그림자)·lightPreset (TerraWatt와 동일)
export function applySunLight(map: mapboxgl.Map, hour: number) {
  const { altitudeDeg, azimuthDeg } = sunPositionDeg(dateAtHour(hour), SUN_REF.lat, SUN_REF.lng);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const daylight = Math.max(0, Math.sin((altitudeDeg * Math.PI) / 180));
  const m = map as unknown as {
    setConfigProperty: (s: string, k: string, v: unknown) => void;
    setLights: (l: unknown[]) => void;
  };
  try {
    m.setConfigProperty('basemap', 'lightPreset', presetFromAltitude(altitudeDeg));
    m.setLights([
      {
        id: 'sun',
        type: 'directional',
        properties: {
          direction: [clamp(azimuthDeg, 0, 360), clamp(90 - altitudeDeg, 0, 90)],
          color: altitudeDeg < 8 ? '#ffd9a0' : '#ffffff',
          intensity: 0.2 + daylight * 0.6,
          'cast-shadows': true,
        },
      },
      { id: 'ambient', type: 'ambient', properties: { color: '#ffffff', intensity: 0.25 + daylight * 0.25 } },
    ]);
  } catch {
    /* 스타일 미지원 시 무시 */
  }
}

// 줌 기반 페이드 (TerraWatt zoomReveal) — 광역(z11↓)에선 0, 상세(z13↑)에서 최대
const zoomReveal = (value: number) => ['interpolate', ['linear'], ['zoom'], 11, 0, 13, value] as unknown as number;

// ── 광역 날씨 마커 (TerraWatt weatherMarkerEl 방식 + 실기상 /api/weather) ──
interface WxStation {
  name: string;
  lat: number;
  lng: number;
  temperature: number;
  rainfall: number;
  precipitationType: string;
}
function wxIcon(s: WxStation): string {
  if (s.precipitationType?.includes('눈')) return '🌨️';
  if ((s.precipitationType && s.precipitationType !== '없음') || s.rainfall > 0) return '🌧️';
  return '☀️';
}
function wxMarkerEl(s: WxStation): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none;';
  el.innerHTML = `
    <div style="font-size:26px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35));">${wxIcon(s)}</div>
    <div style="font-size:11px;font-weight:700;color:#0f172a;white-space:nowrap;text-shadow:0 0 3px #fff,0 1px 2px #fff;">${s.name}</div>
    <div style="font-size:11px;font-weight:800;white-space:nowrap;color:#dc2626;text-shadow:0 0 3px #fff,0 1px 2px #fff;">${s.temperature.toFixed(1)}°</div>`;
  return el;
}

// 날씨 파티클 (TerraWatt v1 설정 그대로 — mapbox GL v3 setRain/setSnow)
export function applyWeather(map: mapboxgl.Map, weather: WeatherKey) {
  const m = map as unknown as { setRain: (o: unknown) => void; setSnow: (o: unknown) => void };
  try {
    m.setRain(
      weather === 'rain'
        ? {
            density: zoomReveal(0.5),
            intensity: 1.0,
            color: '#a8adbc',
            opacity: 0.7,
            vignette: zoomReveal(1.0),
            'vignette-color': '#464646',
            direction: [0, 80],
            'droplet-size': [2.6, 18.2],
            'distortion-strength': 0.7,
            'center-thinning': 0,
          }
        : null,
    );
    m.setSnow(
      weather === 'snow'
        ? {
            density: zoomReveal(0.85),
            intensity: 1.0,
            'center-thinning': 0.1,
            direction: [0, 50],
            opacity: 1.0,
            color: '#ffffff',
            'flake-size': 0.71,
            vignette: zoomReveal(0.3),
            'vignette-color': '#ffffff',
          }
        : null,
    );
  } catch {
    /* 스타일/버전 미지원 시 무시 */
  }
}
// 단일 스타일 — 지도(standard 벡터 3D: 건물 돌출 + 지형 + 조명)
const STYLE_URL = 'mapbox://styles/mapbox/standard';

const srcId = (id: string) => `next-src-${id}`;
const lyrId = (id: string) => `next-ly-${id}`;

function ensureLayer(map: mapboxgl.Map, def: LayerDef) {
  const s = srcId(def.id),
    l = lyrId(def.id);
  if (map.getLayer(l)) return;
  if (def.kind === 'tile') {
    if (!map.getSource(s)) {
      map.addSource(s, { type: 'vector', tiles: [tileUrl(def)], minzoom: def.minZoom ?? 0, maxzoom: 14 });
    }
    map.addLayer({
      id: l,
      type: def.layerType as 'line',
      source: s,
      'source-layer': def.sourceLayer ?? '',
      layout: { visibility: 'none' },
      paint: def.paint as never,
    });
    return;
  }
  if (!map.getSource(s)) {
    map.addSource(s, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      ...(def.kind === 'cluster' ? { cluster: true, clusterRadius: 48, clusterMaxZoom: 13 } : {}),
    });
  }
  map.addLayer({
    id: l,
    type: def.layerType as 'circle',
    source: s,
    layout: { visibility: 'none' },
    paint: def.paint as never,
  });
}

// 3D 모델 앵커 — GLB 위치의 클릭 선택용 포인트 (모델 자체는 ModelLayer가 렌더)
function ensureModelAnchors(map: mapboxgl.Map) {
  if (map.getLayer(ANCHOR_LAYER)) return;
  map.addSource('next-src-model-anchors', { type: 'geojson', data: modelAnchorsGeo });
  map.addLayer({
    id: ANCHOR_LAYER,
    type: 'circle',
    source: 'next-src-model-anchors',
    layout: { visibility: 'none' },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 5, 16, 9],
      'circle-color': '#22d3ee',
      'circle-opacity': 0.25,
      'circle-stroke-color': '#22d3ee',
      'circle-stroke-width': 2,
    },
  });
}

// 선택 하이라이트 (선택 자산 위치에 링 1개)
function ensureSelectionLayer(map: mapboxgl.Map) {
  if (map.getLayer('next-ly-selected')) return;
  map.addSource('next-src-selected', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'next-ly-selected',
    type: 'circle',
    source: 'next-src-selected',
    paint: {
      'circle-radius': 14,
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': '#22d3ee',
      'circle-stroke-width': 2.5,
      'circle-stroke-opacity': 0.95,
    },
  });
}

export function MapStage({ flyTo, weather, hour }: { flyTo: CamView | null; weather: WeatherKey; hour: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const readyRef = useRef(false);
  const abortRef = useRef<Record<string, AbortController>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tier = useWorld((s) => s.tier);
  const lens = useWorld((s) => s.lens);
  const selection = useWorld((s) => s.selection);
  // 이벤트 핸들러에서 최신 상태 참조 (재바인딩 없이)
  const stateRef = useRef({ tier, lens });
  stateRef.current = { tier, lens };
  const weatherRef = useRef<WeatherKey>(weather);
  weatherRef.current = weather;
  const hourRef = useRef(hour);
  hourRef.current = hour;
  const wxMarkersRef = useRef<mapboxgl.Marker[]>([]);
  // 모델 중심이 들어있는 footprint의 feature id를 찾아 그 건물만 정밀 제외.
  // (초기 distance 필터 → id 판별 후 id 필터로 교체: 인접 건물은 전부 유지)
  const holeIdsRef = useRef<(number | string)[] | null>(null);
  const applyBuildingHole = (map: mapboxgl.Map) => {
    if (holeIdsRef.current || !map.getLayer(BLD3D_LAYER)) return;
    const feats = map.querySourceFeatures('next-src-streets', { sourceLayer: 'building' });
    const ids = new Set<number | string>();
    for (const m of DT_MODELS) {
      for (const f of feats) {
        if (f.id != null && geomContains(f.geometry, m.lngLat)) ids.add(f.id);
      }
    }
    if (!ids.size) return; // 타일 미로드 — 다음 idle에서 재시도
    holeIdsRef.current = [...ids];
    map.setFilter(BLD3D_LAYER, [
      'all',
      ['==', ['get', 'extrude'], 'true'],
      ['!', ['in', ['id'], ['literal', [...ids]]]],
    ] as unknown as mapboxgl.FilterSpecification);
  };

  // basemap 3D 건물 토글 — L3(트윈 클로즈업)에서는 끄고 GLB 모델만 세운다.
  // (buildings featureset의 per-feature hide state가 현 스타일에서 동작하지 않아 전역 토글로 대체)
  const syncBasemap3d = (map: mapboxgl.Map, on: boolean) => {
    try {
      (map as unknown as { setConfigProperty: (s: string, k: string, v: unknown) => void }).setConfigProperty(
        'basemap',
        'show3dObjects',
        on,
      );
    } catch {
      /* dark-v11 등 config 미지원 스타일 */
    }
  };

  // ── bbox refetch — 이전 요청 취소(last-wins), 피처 수를 store에 반영 ──
  const refetch = (map: mapboxgl.Map, def: LayerDef) => {
    const b = map.getBounds();
    if (!b) return;
    abortRef.current[def.id]?.abort();
    const ac = new AbortController();
    abortRef.current[def.id] = ac;
    fetchLayerData(def, [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], map.getZoom(), ac.signal)
      .then((fc) => {
        const src = map.getSource(srcId(def.id)) as mapboxgl.GeoJSONSource | undefined;
        src?.setData(fc);
        useWorld.getState().setCount(def.id, fc.features.length);
      })
      .catch(() => {
        /* 중단·맵서버 미기동 시 무시 */
      });
  };

  // ── tier×lens → 가시성 게이팅 + 보이는 geojson 레이어 refetch ──
  const applyVisibility = (map: mapboxgl.Map) => {
    const { tier: t, lens: ls } = stateRef.current;
    for (const def of LAYERS) {
      const vis = ls.includes(def.lens) && def.tiers.includes(t);
      const l = lyrId(def.id);
      if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', vis ? 'visible' : 'none');
      if (vis && def.kind !== 'tile') refetch(map, def);
    }
    // 3D GLB 모델 + 앵커 — L2~L3에서 렌즈와 무관하게 표시 (트윈은 세계의 일부)
    const modelsVis = t === 'L2' || t === 'L3';
    syncModelLayer(map, modelsVis);
    if (map.getLayer(ANCHOR_LAYER)) map.setLayoutProperty(ANCHOR_LAYER, 'visibility', modelsVis ? 'visible' : 'none');
    // 광역(L0~L1) 날씨 마커 — 줌인 몰입 뷰에서는 숨김 (TerraWatt 뎁스 전환과 동일)
    const wide = t === 'L0' || t === 'L1';
    for (const mk of wxMarkersRef.current) mk.getElement().style.display = wide ? '' : 'none';
    // L3: basemap 3D(모델을 파묻음) off + 자체 3D 건물(모델 자리만 구멍) on — 주변 입체 유지
    syncBasemap3d(map, t !== 'L3');
    if (map.getLayer(BLD3D_LAYER)) map.setLayoutProperty(BLD3D_LAYER, 'visibility', t === 'L3' ? 'visible' : 'none');
  };

  // ── 초기화 (한 번) ──
  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const initView = TIER_META[useWorld.getState().tier].view;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: initView.center,
      zoom: initView.zoom,
      pitch: initView.pitch,
      bearing: initView.bearing,
      attributionControl: false,
      projection: 'mercator',
      dragRotate: false,
      pitchWithRotate: false,
      minZoom: 5.5,
      maxZoom: 18,
      // 여유 있는 경계 — 타이트하면 L0 카메라(z6.05)가 클램프되어 비행 끝에서 화면이 덜컥인다
      maxBounds: [
        [116.0, 28.0],
        [142.0, 44.0],
      ],
      localIdeographFontFamily: "'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif",
    });
    mapRef.current = map;
    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as { __dtMap?: mapboxgl.Map }).__dtMap = map; // dev 디버그 훅
    }

    // 실기상(KMA) 관측소 → 광역 날씨 마커 (dt/info와 동일 프록시, self origin → CSP 통과)
    fetch('/mock/weather.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { stations?: WxStation[] } | null) => {
        if (!d?.stations || !mapRef.current) return;
        wxMarkersRef.current = d.stations.map((s) =>
          new mapboxgl.Marker({ element: wxMarkerEl(s), anchor: 'center' }).setLngLat([s.lng, s.lat]).addTo(map),
        );
        const wide = stateRef.current.tier === 'L0' || stateRef.current.tier === 'L1';
        for (const mk of wxMarkersRef.current) mk.getElement().style.display = wide ? '' : 'none';
      })
      .catch(() => {});

    map.on('style.load', () => {
      map.resize();
      // standard-satellite에서 3D 건물/랜드마크 렌더 활성화 (위성 실사 + 3D)
      try {
        (map as unknown as { setConfigProperty: (s: string, k: string, v: unknown) => void }).setConfigProperty(
          'basemap',
          'show3dObjects',
          true,
        );
      } catch {
        /* 스타일이 config 미지원이면 무시 */
      }
      applyWeather(map, weatherRef.current); // 스타일 로드 후 날씨 파티클 적용
      applySunLight(map, hourRef.current); // 시각 → 태양 조명·그림자
      for (const def of LAYERS) ensureLayer(map, def);
      holeIdsRef.current = null; // 스타일 전환 시 레이어 재생성 → id 재판별
      ensureCustom3dBuildings(map);
      ensureModelAnchors(map);
      ensureSelectionLayer(map);
      readyRef.current = true;
      applyVisibility(map);
    });

    // 줌/팬 멈춤(디바운스 200ms) → tier 재계산(히스테리시스) + refetch
    map.on('moveend', () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (!readyRef.current) return;
        useWorld.getState().setBearing(map.getBearing()); // 태양 다이얼 방위 정렬
        const t = nextTier(stateRef.current.tier, map.getZoom());
        if (t !== stateRef.current.tier)
          useWorld.getState().setTier(t); // → 아래 effect가 게이팅
        else applyVisibility(map); // tier 그대로면 bbox만 갱신
      }, 200);
    });

    // 타일 로드 완료(idle) 시 대상 건물 id 판별 → 그 건물만 제외하는 필터로 교체
    map.on('idle', () => {
      if (stateRef.current.tier === 'L3') applyBuildingHole(map);
    });

    // 클릭 → selection (selectable 레이어). 클러스터는 확대, 빈 곳은 선택 해제.
    const clickable = [...LAYERS.filter((d) => d.selectable).map((d) => lyrId(d.id)), ANCHOR_LAYER];
    map.on('click', (e) => {
      const feats = map.queryRenderedFeatures(e.point, { layers: clickable.filter((l) => map.getLayer(l)) });
      const f = feats[0];
      if (!f) {
        useWorld.getState().select(null);
        return;
      }
      const p = (f.properties ?? {}) as Record<string, unknown>;
      if (p.cluster) {
        map.flyTo({ center: e.lngLat, zoom: map.getZoom() + 2, duration: 700 });
        return;
      }
      const layerDef = LAYERS.find((d) => lyrId(d.id) === f.layer?.id);
      const isModel = f.layer?.id === ANCHOR_LAYER;
      useWorld.getState().select({
        assetId: String(p.assetId ?? `${layerDef?.id}:${p.id ?? '?'}`),
        layerId: isModel ? 'dt-models' : (layerDef?.id ?? 'unknown'),
        name: String(p.name ?? layerDef?.name ?? '자산'),
        props: p,
        lngLat: [e.lngLat.lng, e.lngLat.lat],
      });
    });
    map.on('mousemove', (e) => {
      const feats = map.queryRenderedFeatures(e.point, { layers: clickable.filter((l) => map.getLayer(l)) });
      map.getCanvas().style.cursor = feats.length ? 'pointer' : '';
    });

    return () => {
      readyRef.current = false;
      Object.values(abortRef.current).forEach((a) => a.abort());
      if (debounceRef.current) clearTimeout(debounceRef.current);
      for (const mk of wxMarkersRef.current) mk.remove();
      wxMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tier·lens 변경 → 게이팅 재적용
  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) applyVisibility(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, lens]);

  // 날씨(맑음/비/눈) — TerraWatt 파티클 설정, 줌 페이드로 광역에선 자동 해제
  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) applyWeather(map, weather);
  }, [weather]);

  // 시각 슬라이더 → 태양 위치 → 조명·그림자·lightPreset
  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) applySunLight(map, hour);
  }, [hour]);

  // LOD 레일 점프 (버튼은 flyTo 수단 — 진실은 줌)
  // 고정 duration 대신 거리 비례(speed/curve) — 장거리(지역→전국)도 끊김 없이 자연스러운 아크
  useEffect(() => {
    const map = mapRef.current;
    if (map && flyTo) map.flyTo({ ...flyTo, speed: 1.6, curve: 1.2, essential: true });
  }, [flyTo]);

  // 선택 하이라이트 반영
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource('next-src-selected') as mapboxgl.GeoJSONSource | undefined;
    src?.setData({
      type: 'FeatureCollection',
      features: selection
        ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: selection.lngLat } }]
        : [],
    });
  }, [selection]);

  // mapbox-gl.css의 .mapboxgl-map{position:relative}이 Tailwind .absolute를 덮어쓰므로 인라인 스타일 필수
  return <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />;
}
