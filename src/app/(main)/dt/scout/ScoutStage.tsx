'use client';

// 스카우팅 맵 스테이지 — 벡터 3D + 후보 지붕 랭킹 핀(factory-roof) + 리드 선택 + 트윈 설치(시뮬 연출).
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { applyWeather, applySunLight, type WeatherKey } from '../next/MapStage';
import { SimModelLayer } from '../simulation/SimModelLayer';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
const STYLE_URL = 'mapbox://styles/mapbox/standard';
const MAP_SERVER = '/api/mapserver';
const ULSAN_BBOX = '129.25,35.37,129.48,35.60';

// 시작 카메라 — 온산·미포 산단 광역
const START = { center: [129.355, 35.47] as [number, number], zoom: 12.0, pitch: 45, bearing: -10 };

export interface LeadFeature {
  assetId: string;
  name: string;
  complex: string;
  address: string;
  roofM2: number;
  estKw: number;
  estDemandMwh: number;
  score: number;
  grade: string;
  rank: number;
  sRoof: number;
  sIrr: number;
  sGrid: number;
  sDemand: number;
  irr: number;
  subDistM: number;
  bearingDeg: number;
  lngLat: [number, number];
}

// TerraWatt(plantMarker) 물방울 핀 — 마커 형태 동일, 등급별 색만 다름
const GRADE_COLOR: Record<string, string> = { S: '#fbbf24', A: '#fb923c', B: '#64748b' };

// 선택 마커 바운스 애니메이션 (한 번만 주입)
let bounceStyleInjected = false;
function ensureBounceStyle() {
  if (bounceStyleInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes scout-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
    .scout-bounce svg { animation: scout-bounce 0.55s ease-in-out infinite; }
  `;
  document.head.appendChild(style);
  bounceStyleInjected = true;
}
function pinMarkerEl(lead: LeadFeature): HTMLElement {
  const color = GRADE_COLOR[lead.grade] ?? GRADE_COLOR.B!;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;';
  wrap.innerHTML = `
    <svg width="30" height="42" viewBox="0 0 24 34" style="filter:drop-shadow(0 3px 4px rgba(0,0,0,.5));">
      <path d="M12 0C5.9 0 1 4.9 1 11c0 8 11 22 11 22s11-14 11-22C23 4.9 18.1 0 12 0z"
            fill="${color}" stroke="#ffffff" stroke-width="1.6"/>
      <circle cx="12" cy="11" r="4.2" fill="#ffffff"/>
    </svg>
    <span style="font-size:12px;font-weight:700;color:#f1f5f9;white-space:nowrap;text-shadow:0 1px 3px #0a0f1c,0 0 4px #0a0f1c;">${lead.name}</span>
  `;
  return wrap;
}

function toLead(f: GeoJSON.Feature): LeadFeature {
  const p = (f.properties ?? {}) as Record<string, unknown>;
  const c = (f.geometry as GeoJSON.Point).coordinates as [number, number];
  const n = (k: string) => Number(p[k] ?? 0);
  return {
    assetId: String(p.assetId ?? ''),
    name: String(p.name ?? ''),
    complex: String(p.complex ?? ''),
    address: String(p.address ?? ''),
    roofM2: n('roofM2'),
    estKw: n('estKw'),
    estDemandMwh: n('estDemandMwh'),
    score: n('score'),
    grade: String(p.grade ?? 'B'),
    rank: n('rank'),
    sRoof: n('sRoof'),
    sIrr: n('sIrr'),
    sGrid: n('sGrid'),
    sDemand: n('sDemand'),
    irr: n('irr'),
    subDistM: n('subDistM'),
    bearingDeg: n('bearingDeg'),
    lngLat: [c[0], c[1]],
  };
}

export function ScoutStage({
  weather,
  hour,
  placeSignal,
  clearSignal,
  selectedId,
  onLeads,
  onLeadSelect,
  flyTo,
}: {
  weather: WeatherKey;
  hour: number;
  /** 트윈 설치 신호 — 리드 좌표·크기(m). key 증가 시 실행 */
  placeSignal: { key: number; lngLat: [number, number]; sizeM: number; rotationDeg: number } | null;
  clearSignal: number;
  /** 선택된 리드 assetId (마커 바운스 표시) */
  selectedId: string | null;
  onLeads: (leads: LeadFeature[]) => void;
  onLeadSelect: (lead: LeadFeature | null) => void;
  flyTo: { key: number; lngLat: [number, number]; zoom: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const simLayerRef = useRef<SimModelLayer | null>(null);
  const pinMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const readyRef = useRef(false);
  const weatherRef = useRef(weather);
  weatherRef.current = weather;
  const hourRef = useRef(hour);
  hourRef.current = hour;
  const onLeadsRef = useRef(onLeads);
  onLeadsRef.current = onLeads;
  const onSelectRef = useRef(onLeadSelect);
  onSelectRef.current = onLeadSelect;

  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      ...START,
      attributionControl: false,
      projection: 'mercator',
      dragRotate: false,
      pitchWithRotate: false,
      minZoom: 9,
      maxZoom: 18,
      maxBounds: [
        [128.6, 34.9],
        [130.1, 36.1],
      ],
      localIdeographFontFamily: "'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif",
    });
    mapRef.current = map;
    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as { __dtMap?: mapboxgl.Map }).__dtMap = map;
    }

    map.on('style.load', () => {
      map.resize();
      try {
        (map as unknown as { setConfigProperty: (s: string, k: string, v: unknown) => void }).setConfigProperty(
          'basemap',
          'show3dObjects',
          true,
        );
      } catch {
        /* 미지원 무시 */
      }
      applyWeather(map, weatherRef.current);
      applySunLight(map, hourRef.current);

      // 트윈 설치 레이어 (시뮬 연출)
      if (!map.getLayer('sim-ly-model')) {
        const sim = new SimModelLayer();
        simLayerRef.current = sim;
        if (process.env.NODE_ENV !== 'production') {
          (window as unknown as { __simLayer?: SimModelLayer }).__simLayer = sim;
        }
        map.addLayer(sim);
      }
      readyRef.current = true;

      // 후보 전체 1회 로드 (뷰포트 무관 전체) → TerraWatt식 물방울 핀 DOM 마커
      fetch(`${MAP_SERVER}/factory-roof?bbox=${ULSAN_BBOX}&z=12`)
        .then((r) => (r.ok ? r.json() : null))
        .then((fc: GeoJSON.FeatureCollection | null) => {
          if (!fc?.features || !mapRef.current) return;
          const leads = fc.features.map(toLead).sort((a, b) => a.rank - b.rank);
          for (const mk of pinMarkersRef.current.values()) mk.remove();
          pinMarkersRef.current = new Map(
            leads.map((lead) => {
              const el = pinMarkerEl(lead);
              el.addEventListener('click', (ev) => {
                ev.stopPropagation();
                onSelectRef.current(lead);
              });
              return [
                lead.assetId,
                new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat(lead.lngLat).addTo(map),
              ];
            }),
          );
          onLeadsRef.current(leads);
        })
        .catch(() => {});
    });

    // 빈 곳 클릭 → 선택 해제 (핀 클릭은 마커에서 stopPropagation)
    map.on('click', () => onSelectRef.current(null));

    return () => {
      readyRef.current = false;
      simLayerRef.current = null;
      for (const mk of pinMarkersRef.current.values()) mk.remove();
      pinMarkersRef.current = new Map();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) applyWeather(map, weather);
  }, [weather]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) applySunLight(map, hour);
  }, [hour]);

  // 트윈 설치 (수익 시뮬 시작 연출) — ① 먼저 건물로 줌인 이동 → ② 도착 후 건설(먼지)
  useEffect(() => {
    const map = mapRef.current;
    const sim = simLayerRef.current;
    if (!map || !sim || !placeSignal) return;
    const ps = placeSignal;
    // 카메라는 북고정 사선뷰 — 건물이 지면(footprint)의 실제 방위 그대로 서 보이게 한다.
    map.flyTo({
      center: ps.lngLat,
      zoom: 17.6,
      pitch: 55,
      bearing: 0,
      speed: 1.4,
      curve: 1.3,
      essential: true,
    });
    // 카메라 도착(moveend) 후에 건물을 세운다 — 이동 중 미리 서지 않도록
    let done = false;
    const build = () => {
      if (done) return;
      done = true;
      sim.setTargetSize(ps.sizeM);
      // mercator Y반전으로 three 회전이 지도상 반대방향 → footprint 방위에 맞추려면 negate
      sim.setRotation(-ps.rotationDeg);
      sim.placeAt(ps.lngLat); // 여기서 먼지 이펙트 발생
    };
    map.once('moveend', build);
    const t = setTimeout(build, 2200); // moveend 누락 대비 폴백
    return () => {
      clearTimeout(t);
      map.off('moveend', build);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeSignal?.key]);

  useEffect(() => {
    if (clearSignal > 0) simLayerRef.current?.clear();
  }, [clearSignal]);

  // 리드 선택 링 + 리스트 클릭 flyTo
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !flyTo) return;
    map.flyTo({
      center: flyTo.lngLat,
      zoom: flyTo.zoom,
      pitch: 50,
      bearing: -10,
      speed: 1.6,
      curve: 1.2,
      essential: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo?.key]);

  // 선택 마커 바운스 (링 대신 통통 튀는 애니메이션)
  useEffect(() => {
    ensureBounceStyle();
    for (const [id, mk] of pinMarkersRef.current) {
      mk.getElement().classList.toggle('scout-bounce', id === selectedId);
    }
  }, [selectedId]);

  return <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />;
}
