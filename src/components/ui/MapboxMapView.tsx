'use client';

/**
 * Mapbox GL 지도 뷰 (POC 통합관제용).
 * - 원본의 GoogleMapView 를 대체. 마커는 DOM 요소 기반 mapboxgl.Marker 로 그린다.
 * - 사용자 자체 mapbox 구현으로 교체할 때는 이 컴포넌트만 바꾸면 된다 (props 계약 유지).
 */
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * 관제 홈이 쓰는 지도 조작 — mapbox-gl Map 과 Leaflet 대체 지도가 같은 모양으로 제공한다.
 * 좌표는 mapbox 규칙([lng, lat]) 그대로.
 */
export interface MapLike {
  fitBounds(
    bounds: [[number, number], [number, number]],
    opts: { padding: { top: number; bottom: number; left: number; right: number }; maxZoom?: number; duration?: number },
  ): void;
  flyTo(opts: { center: [number, number]; zoom: number; offset?: [number, number]; duration?: number; essential?: boolean }): void;
  getZoom(): number;
}

/** mapbox 스타일 URL(mapbox://styles/mapbox/dark-v11) → 래스터 타일 URL. Leaflet 대체 지도가 쓴다 */
function rasterTileUrl(mapStyle: string, token: string): string {
  const id = mapStyle.replace(/^mapbox:\/\/styles\//, '') || 'mapbox/dark-v11';
  return `https://api.mapbox.com/styles/v1/${id}/tiles/{z}/{x}/{y}?access_token=${token}`;
}

/** Leaflet 지도를 관제 홈이 쓰는 MapLike 모양으로 */
function leafletAdapter(map: L.Map): MapLike {
  return {
    fitBounds(b, o) {
      map.fitBounds(
        [
          [b[0][1], b[0][0]],
          [b[1][1], b[1][0]],
        ],
        {
          paddingTopLeft: [o.padding.left, o.padding.top],
          paddingBottomRight: [o.padding.right, o.padding.bottom],
          maxZoom: o.maxZoom,
          animate: (o.duration ?? 0) > 0,
        },
      );
    },
    flyTo(o) {
      const target = L.latLng(o.center[1], o.center[0]);
      // mapbox offset = 화면 중심에서 픽셀만큼 비껴 놓기 → 목표점을 반대로 밀어서 같은 효과
      const pt = map.project(target, o.zoom).subtract(L.point(o.offset?.[0] ?? 0, o.offset?.[1] ?? 0));
      map.flyTo(map.unproject(pt, o.zoom), o.zoom, { duration: (o.duration ?? 0) / 1000 });
    },
    getZoom: () => map.getZoom(),
  };
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
const DEFAULT_CENTER: [number, number] = [129.35, 35.508]; // 울산미포 (lng, lat)
const DEFAULT_ZOOM = 15;
const ICON_W = 66;
const ICON_H = 80;

export interface MapMarkerSpec {
  id: string | number;
  lat: number;
  lng: number;
  /** 아이콘 이미지 URL (66x80 기준, size 배율 적용) */
  iconUrl?: string;
  size?: number;
  opacity?: number;
  title?: string;
  /** 아이콘 이미지에 추가로 적용할 CSS filter (예: 이상감지 빨간 핀) */
  iconFilter?: string;
  /** 반투명 원(히트맵 등) */
  halo?: { color: string; radius: number };
  onClick?: () => void;
  onMouseEnter?: (e: MouseEvent) => void;
  onMouseLeave?: () => void;
}

export interface MapboxMapViewProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  mapStyle?: string;
  markers?: MapMarkerSpec[];
  onMapClick?: () => void;
  onZoomChanged?: (zoom: number) => void;
  onMapLoad?: (map: MapLike) => void;
}

function buildMarkerElement(spec: MapMarkerSpec): HTMLElement {
  const el = document.createElement('div');
  el.className = 'poc-marker';
  el.style.opacity = String(spec.opacity ?? 1);
  el.style.transition = 'opacity 200ms ease';
  if (spec.title) el.title = spec.title;

  if (spec.halo) {
    const d = spec.halo.radius * 2;
    el.style.width = `${d}px`;
    el.style.height = `${d}px`;
    el.style.borderRadius = '50%';
    el.style.background = `${spec.halo.color}33`;
    el.style.border = `1px solid ${spec.halo.color}66`;
    el.style.pointerEvents = 'none';
  }

  if (spec.iconUrl) {
    const scale = spec.size ?? 1;
    const img = document.createElement('img');
    img.src = spec.iconUrl;
    img.alt = spec.title ?? '';
    img.draggable = false;
    img.style.width = `${Math.round(ICON_W * scale)}px`;
    img.style.height = `${Math.round(ICON_H * scale)}px`;
    img.style.display = 'block';
    img.style.filter = `${spec.iconFilter ? `${spec.iconFilter} ` : ''}drop-shadow(0 2px 4px rgba(0,0,0,0.5))`;
    el.appendChild(img);
    el.style.cursor = spec.onClick ? 'pointer' : 'default';
  }

  if (spec.onClick) {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      spec.onClick?.();
    });
  }
  if (spec.onMouseEnter) el.addEventListener('mouseenter', (e) => spec.onMouseEnter?.(e));
  if (spec.onMouseLeave) el.addEventListener('mouseleave', () => spec.onMouseLeave?.());
  return el;
}

export function MapboxMapView({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  className = '',
  mapStyle = 'mapbox://styles/mapbox/dark-v11', // 위성은 산만해서 다크 벡터 지도로 (UI 톤과 일치)
  markers = [],
  onMapClick,
  onZoomChanged,
  onMapLoad,
}: MapboxMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const markerObjsRef = useRef<{ remove(): void }[]>([]);
  const callbacksRef = useRef({ onMapClick, onZoomChanged, onMapLoad });
  callbacksRef.current = { onMapClick, onZoomChanged, onMapLoad };
  const initialRef = useRef({ center, zoom, mapStyle });
  // 지도를 못 띄운 이유 — WebGL 불가·토큰 오류 등. 있으면 지도 자리에 안내만 보이고 나머지 화면은 그대로 동작한다
  const [mapError, setMapError] = useState<string | null>(null);
  // 어느 지도 엔진으로 그리고 있는지 — 마커 갱신이 이 값이 정해진 뒤에 돌아야 한다
  const [engine, setEngine] = useState<'mapbox' | 'leaflet' | null>(null);

  // WebGL 이 안 되는 브라우저는 Leaflet + Mapbox 래스터 타일로 같은 지도를 그린다 (?map=leaflet 로 강제 가능)
  const startLeaflet = (container: HTMLDivElement) => {
    const { center, zoom, mapStyle } = initialRef.current;
    const lmap = L.map(container, {
      center: [center[1], center[0]],
      zoom,
      minZoom: 9,
      maxZoom: 17,
      zoomControl: false,
      attributionControl: false,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(lmap);
    L.tileLayer(rasterTileUrl(mapStyle, MAPBOX_TOKEN), { tileSize: 512, zoomOffset: -1, maxZoom: 17 }).addTo(lmap);
    const adapter = leafletAdapter(lmap);
    lmap.on('click', () => callbacksRef.current.onMapClick?.());
    lmap.on('zoomend', () => callbacksRef.current.onZoomChanged?.(lmap.getZoom()));
    lmap.whenReady(() => callbacksRef.current.onMapLoad?.(adapter));
    leafletRef.current = lmap;
    setEngine('leaflet');
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current || leafletRef.current || !MAPBOX_TOKEN) return;
    const container = containerRef.current;
    const cleanup = () => {
      markerObjsRef.current.forEach((m) => m.remove());
      markerObjsRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current?.remove();
      leafletRef.current = null;
    };
    const forceLeaflet = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('map') === 'leaflet';
    // mapbox-gl v3 는 WebGL2 가 있어야 한다. 새 캔버스 하나에 webgl2 만 한 번 물어본다(한 캔버스에 두 종류를 물으면 두 번째는 항상 null)
    const hasWebGL2 = (() => {
      try {
        return !!document.createElement('canvas').getContext('webgl2');
      } catch {
        return false;
      }
    })();
    if (forceLeaflet || !hasWebGL2) {
      if (!hasWebGL2) console.warn('[MapboxMapView] WebGL2 를 쓸 수 없어 Mapbox 래스터 타일(Leaflet)로 그립니다');
      startLeaflet(container);
      return cleanup;
    }
    mapboxgl.accessToken = MAPBOX_TOKEN;
    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container,
        style: initialRef.current.mapStyle,
        center: initialRef.current.center,
        zoom: initialRef.current.zoom,
        minZoom: 9,
        maxZoom: 17,
        attributionControl: false,
      });
    } catch (e) {
      // 생성 자체가 실패하면 래스터 지도로. 지도 데이터는 똑같이 Mapbox 에서 온다
      console.warn('[MapboxMapView] WebGL 지도 초기화 실패 → 래스터 지도로 대체:', e);
      startLeaflet(container);
      return cleanup;
    }
    setEngine('mapbox');
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.on('load', () => callbacksRef.current.onMapLoad?.(map));
    map.on('click', () => callbacksRef.current.onMapClick?.());
    map.on('zoomend', () => callbacksRef.current.onZoomChanged?.(map.getZoom()));
    // mapbox 는 WebGL 실패를 던지지 않고 error 이벤트로 알린다 → 그때도 래스터 지도로 갈아탄다. 토큰 오류는 안내만
    map.on('error', (ev) => {
      const err = (ev as { error?: { message?: string; status?: number } }).error;
      if (err?.message?.includes('WebGL')) {
        console.warn('[MapboxMapView] WebGL 실패 → 래스터 지도로 대체:', err.message);
        map.remove();
        mapRef.current = null;
        startLeaflet(container);
        return;
      }
      console.warn('[MapboxMapView] 지도 오류:', err);
      if (err?.status === 401 || err?.status === 403) setMapError('Mapbox 토큰이 유효하지 않습니다 (NEXT_PUBLIC_MAPBOX_TOKEN 확인)');
    });
    mapRef.current = map;
    return cleanup;
  }, []);

  useEffect(() => {
    const valid = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng) && (m.lat !== 0 || m.lng !== 0));
    markerObjsRef.current.forEach((m) => m.remove());
    markerObjsRef.current = [];
    if (engine === 'mapbox' && mapRef.current) {
      const map = mapRef.current;
      markerObjsRef.current = valid.map((spec) =>
        new mapboxgl.Marker({ element: buildMarkerElement(spec), anchor: spec.halo ? 'center' : 'bottom' })
          .setLngLat([spec.lng, spec.lat])
          .addTo(map),
      );
    } else if (engine === 'leaflet' && leafletRef.current) {
      const lmap = leafletRef.current;
      markerObjsRef.current = valid.map((spec) => {
        const el = buildMarkerElement(spec);
        const scale = spec.size ?? 1;
        const w = spec.halo ? spec.halo.radius * 2 : Math.round(ICON_W * scale);
        const h = spec.halo ? spec.halo.radius * 2 : Math.round(ICON_H * scale);
        // 같은 DOM 마커를 Leaflet divIcon 으로 — 클릭·호버 리스너 유지
        const icon = L.divIcon({ html: el, className: '', iconSize: [w, h], iconAnchor: spec.halo ? [w / 2, h / 2] : [w / 2, h] });
        return L.marker([spec.lat, spec.lng], { icon, interactive: true, keyboard: false }).addTo(lmap);
      });
    }
  }, [markers, engine]);

  if (!MAPBOX_TOKEN) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-accent/20 bg-[#0d1520] text-slate-500 text-sm ${className}`}
        style={{ minHeight: 400 }}
      >
        Mapbox 토큰(NEXT_PUBLIC_MAPBOX_TOKEN)이 설정되지 않았습니다
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ minHeight: 400 }}>
      <div ref={containerRef} className="absolute inset-0" />
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d1520] px-6 text-center text-sm text-slate-400">
          {mapError}
        </div>
      )}
    </div>
  );
}
