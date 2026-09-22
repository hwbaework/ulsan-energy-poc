'use client';

/**
 * Mapbox GL 지도 뷰 (POC 통합관제용).
 * - 원본의 GoogleMapView 를 대체. 마커는 DOM 요소 기반 mapboxgl.Marker 로 그린다.
 * - 사용자 자체 mapbox 구현으로 교체할 때는 이 컴포넌트만 바꾸면 된다 (props 계약 유지).
 */
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

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
  onMapLoad?: (map: mapboxgl.Map) => void;
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
  const markerObjsRef = useRef<mapboxgl.Marker[]>([]);
  const callbacksRef = useRef({ onMapClick, onZoomChanged, onMapLoad });
  callbacksRef.current = { onMapClick, onZoomChanged, onMapLoad };
  const initialRef = useRef({ center, zoom, mapStyle });

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !MAPBOX_TOKEN) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: initialRef.current.mapStyle,
      center: initialRef.current.center,
      zoom: initialRef.current.zoom,
      minZoom: 9,
      maxZoom: 17,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.on('load', () => callbacksRef.current.onMapLoad?.(map));
    map.on('click', () => callbacksRef.current.onMapClick?.());
    map.on('zoomend', () => callbacksRef.current.onZoomChanged?.(map.getZoom()));
    mapRef.current = map;
    return () => {
      markerObjsRef.current.forEach((m) => m.remove());
      markerObjsRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerObjsRef.current.forEach((m) => m.remove());
    markerObjsRef.current = markers
      .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng) && (m.lat !== 0 || m.lng !== 0))
      .map((spec) =>
        new mapboxgl.Marker({ element: buildMarkerElement(spec), anchor: spec.halo ? 'center' : 'bottom' })
          .setLngLat([spec.lng, spec.lat])
          .addTo(map),
      );
  }, [markers]);

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

  return <div ref={containerRef} className={className} style={{ minHeight: 400 }} />;
}
