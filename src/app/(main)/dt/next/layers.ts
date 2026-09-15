// LayerDef 레지스트리 — 모든 지오메트리는 dt-map-server(PostGIS GIS)에서 온다.
// geojson/cluster = bbox 질의, tile = MVT 벡터타일({z}/{x}/{y}). 레이어 추가 = 선언 1개.
import type { LensKey, Tier } from './world';

/** 자기 origin 프록시 (next.config.ts beforeFiles → dt-map-server) */
export const MAP_SERVER = '/api/mapserver';

export interface LayerDef {
  id: string;
  name: string;
  /** dt-map-server 엔드포인트 (GET /{endpoint}?bbox= 또는 /{endpoint}/{z}/{x}/{y}) */
  endpoint: string;
  lens: LensKey;
  tiers: Tier[];
  kind: 'cluster' | 'geojson' | 'heatmap' | 'tile';
  layerType: 'circle' | 'line' | 'fill' | 'heatmap';
  /** MVT일 때 ST_AsMVT 레이어명 (= 서버 LayerDef.id) */
  sourceLayer?: string;
  paint: Record<string, unknown>;
  minZoom?: number;
  /** 클릭 선택 가능 여부 (assetId 속성 보유 레이어) */
  selectable?: boolean;
  /** bbox 응답 후처리 (예: 격자점 → 셀 폴리곤) */
  transform?: (fc: GeoJSON.FeatureCollection) => GeoJSON.FeatureCollection;
}

// 일사량 격자점(0.05° 간격) → 셀 폴리곤 — 블러 서클 대신 선명한 격자 타일링
const IRR_CELL = 0.05;
function pointsToCells(fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const h = IRR_CELL / 2;
  return {
    type: 'FeatureCollection',
    features: fc.features
      .filter((f) => f.geometry.type === 'Point')
      .map((f) => {
        const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        return {
          type: 'Feature' as const,
          properties: f.properties,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [
              [
                [lng - h, lat - h],
                [lng + h, lat - h],
                [lng + h, lat + h],
                [lng - h, lat + h],
                [lng - h, lat - h],
              ],
            ],
          },
        };
      }),
  };
}

// 전압별 색 (dt-frontend 검증 팔레트)
const kvColor = [
  'case',
  ['>=', ['coalesce', ['get', 'kv'], 0], 765],
  '#ef4444',
  ['>=', ['coalesce', ['get', 'kv'], 0], 345],
  '#a855f7',
  '#38bdf8',
];

export const LAYERS: LayerDef[] = [
  // ── grid: 계통·거래 ──
  {
    id: 'power-plants',
    name: '발전소',
    endpoint: 'power-plant',
    lens: 'grid',
    tiers: ['L0', 'L1', 'L2', 'L3'],
    kind: 'cluster',
    layerType: 'circle',
    selectable: true,
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'capacityMw'], 50],
        10,
        4,
        500,
        9,
        3000,
        16,
        7000,
        26,
      ],
      'circle-color': [
        'match',
        ['get', 'source'],
        'nuclear',
        '#dc2626',
        'coal',
        '#525252',
        'gas',
        '#f97316',
        'oil',
        '#a16207',
        'hydro',
        '#2563eb',
        'wind',
        '#06b6d4',
        'bio',
        '#16a34a',
        '#94a3b8',
      ],
      'circle-opacity': 0.85,
      'circle-stroke-color': '#0b1120',
      'circle-stroke-width': 1,
    },
  },
  {
    id: 'substations',
    name: '변전소',
    endpoint: 'substation',
    lens: 'grid',
    tiers: ['L0', 'L1', 'L2', 'L3'],
    kind: 'cluster',
    layerType: 'circle',
    selectable: true,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 3, 10, 5.5, 14, 9],
      'circle-color': [
        'case',
        ['>=', ['coalesce', ['get', 'kv'], 0], 345],
        '#6d28d9',
        ['>=', ['coalesce', ['get', 'kv'], 0], 154],
        '#a855f7',
        '#c4b5fd',
      ],
      'circle-opacity': 0.85,
      'circle-stroke-color': '#1e1b4b',
      'circle-stroke-width': 1,
    },
  },
  {
    id: 'power-lines',
    name: '송전선로',
    endpoint: 'power-connection',
    lens: 'grid',
    tiers: ['L0', 'L1', 'L2', 'L3'],
    kind: 'tile',
    layerType: 'line',
    sourceLayer: 'power_line',
    selectable: true,
    paint: {
      'line-color': kvColor,
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        6,
        ['case', ['>=', ['coalesce', ['get', 'kv'], 0], 765], 3, 1.6],
        12,
        ['case', ['>=', ['coalesce', ['get', 'kv'], 0], 765], 6, 3.5],
      ],
      'line-opacity': 0.85,
    },
  },
  // ── vpp: 분산자원 ──
  {
    id: 'vpp-plants',
    name: 'VPP 태양광',
    endpoint: 'vpp-plant',
    lens: 'vpp',
    tiers: ['L0', 'L1', 'L2', 'L3'],
    kind: 'cluster',
    layerType: 'circle',
    selectable: true,
    paint: {
      'circle-radius': [
        'step',
        ['coalesce', ['get', 'point_count'], 1],
        7,
        20,
        12,
        100,
        18,
        500,
        26,
      ],
      'circle-color': [
        'step',
        ['coalesce', ['get', 'point_count'], 1],
        '#fbbf24',
        20,
        '#f59e0b',
        100,
        '#ea580c',
        500,
        '#dc2626',
      ],
      'circle-opacity': 0.82,
      'circle-stroke-color': '#1c1917',
      'circle-stroke-width': 1.2,
    },
  },
  // ── sun: 일사량(예측 근거) — 0.05° 격자 셀 fill. 광역(L0~L1) 전용, 산단/설비 뷰에선 미표시 ──
  {
    id: 'irradiance',
    name: '일사량',
    endpoint: 'irradiance',
    lens: 'sun',
    tiers: ['L0', 'L1'],
    kind: 'geojson',
    layerType: 'fill',
    transform: pointsToCells,
    paint: {
      // NASA POWER 실값 범위(3.75~4.05)에 맞춘 스케일 — 양이 같으면 같은 색 (파랑 없음: 저값=초록)
      'fill-color': [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'value'], 3.9],
        3.7,
        '#22c55e',
        3.85,
        '#facc15',
        3.95,
        '#f97316',
        4.05,
        '#dc2626',
      ],
      'fill-opacity': 0.45,
      'fill-outline-color': 'rgba(255,255,255,0.08)',
    },
  },
  // ── monitor: 설비 (고줌 밀집 → MVT) ──
  {
    id: 'power-towers',
    name: '송전탑',
    endpoint: 'power-tower',
    lens: 'monitor',
    tiers: ['L2', 'L3'],
    kind: 'tile',
    layerType: 'circle',
    sourceLayer: 'power_tower',
    minZoom: 10,
    selectable: true,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 14, 3.5],
      'circle-color': '#64748b',
      'circle-opacity': 0.75,
    },
  },
];

/** bbox GeoJSON 질의 (cluster/geojson/heatmap 레이어). 서버가 GiST 필터 + 줌 일반화. */
export async function fetchLayerData(
  def: LayerDef,
  bbox: [number, number, number, number],
  zoom: number,
  signal?: AbortSignal,
): Promise<GeoJSON.FeatureCollection> {
  const q = new URLSearchParams({ bbox: bbox.join(','), z: String(Math.round(zoom)) });
  const r = await fetch(`${MAP_SERVER}/${def.endpoint}?${q}`, { signal });
  if (!r.ok) throw new Error(`${def.endpoint} ${r.status}`);
  const data = await r.json();
  const fc: GeoJSON.FeatureCollection =
    data?.type === 'FeatureCollection'
      ? data
      : data?.data?.type === 'FeatureCollection'
        ? data.data
        : Array.isArray(data?.features)
          ? { type: 'FeatureCollection', features: data.features }
          : { type: 'FeatureCollection', features: [] };
  return def.transform ? def.transform(fc) : fc;
}

/** MVT 타일 URL 템플릿 — mapbox 워커가 파싱하므로 절대 URL 필요. */
export function tileUrl(def: LayerDef): string {
  const rel = `${MAP_SERVER}/${def.endpoint}/{z}/{x}/{y}`;
  return (typeof window !== 'undefined' ? window.location.origin : '') + rel;
}
