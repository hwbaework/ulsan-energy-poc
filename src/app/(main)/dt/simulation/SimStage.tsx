'use client';

// 시뮬레이션 맵 스테이지 — dt 세계와 동일한 벡터 3D(standard) + 날씨·태양 연출.
// LOD·GIS 레이어 없이, 맵 클릭 → 한일튜브 설치(먼지 이펙트)만 담당한다.
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { applyWeather, applySunLight, type WeatherKey } from '../next/MapStage';
import { SimModelLayer } from './SimModelLayer';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
const STYLE_URL = 'mapbox://styles/mapbox/standard';

// 시작 카메라 — 부곡동 한일튜브 실부지 일대
const START = { center: [129.3308, 35.5045] as [number, number], zoom: 16.2, pitch: 60, bearing: -20 };

// 고대비 조준경 커서 — 흰색 링/십자 + 검정 외곽선(어떤 배경에서도 보임). hotspot = 중앙(20,20)
const RETICLE_CURSOR = (() => {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'>` +
    `<g fill='none' stroke='#000' stroke-width='4' opacity='0.55'>` +
    `<circle cx='20' cy='20' r='11'/><path d='M20 1V12M20 28V39M1 20H12M28 20H39'/></g>` +
    `<g fill='none' stroke='#fff' stroke-width='2'>` +
    `<circle cx='20' cy='20' r='11'/><path d='M20 1V12M20 28V39M1 20H12M28 20H39'/></g>` +
    `<circle cx='20' cy='20' r='2.4' fill='#22d3ee' stroke='#000' stroke-width='1'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 20 20, crosshair`;
})();

// 설치용량(kW) → 건물 최장변(m). 지붕면적 = kW/0.12(=면적×0.6×0.2 역산), GLB(126.45×78.82≈9,967㎡) 비례 스케일
const kwToSizeM = (kw: number) => {
  const roof = Math.max(50, kw) / 0.12;
  return Math.min(280, Math.max(24, 126.45 * Math.sqrt(roof / 9967)));
};

export function SimStage({
  weather,
  hour,
  rotationDeg,
  capacityKw,
  clearSignal,
  placeSignal,
  recenterSignal,
  onPlaced,
}: {
  weather: WeatherKey;
  hour: number;
  rotationDeg: number;
  capacityKw: number;
  clearSignal: number;
  /** 주소검색/내위치 — 카메라 이동 + 임시 마커 (건물은 클릭으로 설치) */
  placeSignal: { key: number; lngLat: [number, number] } | null;
  /** 핀으로 이동 — 카메라만 */
  recenterSignal: { key: number; lngLat: [number, number] } | null;
  onPlaced: (lngLat: [number, number]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const layerRef = useRef<SimModelLayer | null>(null);
  const tempMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const readyRef = useRef(false);
  const weatherRef = useRef(weather);
  weatherRef.current = weather;
  const hourRef = useRef(hour);
  hourRef.current = hour;
  const rotRef = useRef(rotationDeg);
  rotRef.current = rotationDeg;
  const kwRef = useRef(capacityKw);
  kwRef.current = capacityKw;
  const onPlacedRef = useRef(onPlaced);
  onPlacedRef.current = onPlaced;

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
      minZoom: 5.5,
      maxZoom: 18,
      maxBounds: [
        [116.0, 28.0],
        [142.0, 44.0],
      ],
      localIdeographFontFamily: "'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif",
    });
    mapRef.current = map;

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
      if (!map.getLayer('sim-ly-model')) {
        const layer = new SimModelLayer();
        layerRef.current = layer;
        map.addLayer(layer);
        layer.setRotation(rotRef.current);
      }
      readyRef.current = true;
    });

    // 클릭 → 설치 + 먼지 (임시 마커 제거)
    map.on('click', (e) => {
      const layer = layerRef.current;
      if (!layer) return;
      tempMarkerRef.current?.remove();
      tempMarkerRef.current = null;
      layer.setTargetSize(kwToSizeM(kwRef.current));
      layer.setRotation(rotRef.current);
      layer.placeAt([e.lngLat.lng, e.lngLat.lat]);
      onPlacedRef.current([e.lngLat.lng, e.lngLat.lat]);
    });
    map.getCanvas().style.cursor = RETICLE_CURSOR;
    // 드래그(팬) 중에도 조준경 유지
    map.on('dragstart', () => {
      map.getCanvas().style.cursor = RETICLE_CURSOR;
    });
    map.on('dragend', () => {
      map.getCanvas().style.cursor = RETICLE_CURSOR;
    });

    return () => {
      readyRef.current = false;
      layerRef.current = null;
      tempMarkerRef.current?.remove();
      tempMarkerRef.current = null;
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

  useEffect(() => {
    layerRef.current?.setRotation(rotationDeg);
  }, [rotationDeg]);

  // 설치용량 변경 시 건물 크기 실시간 반영
  useEffect(() => {
    if (readyRef.current) layerRef.current?.setTargetSize(kwToSizeM(capacityKw));
  }, [capacityKw]);

  // 초기화 신호 (카운터 증가 시 설치 해제 + 임시 마커 제거)
  useEffect(() => {
    if (clearSignal > 0) {
      layerRef.current?.clear();
      tempMarkerRef.current?.remove();
      tempMarkerRef.current = null;
    }
  }, [clearSignal]);

  // 핀으로 이동 — 카메라만 (설치된 건물로 복귀)
  useEffect(() => {
    const map = mapRef.current;
    if (map && recenterSignal)
      map.flyTo({
        center: recenterSignal.lngLat,
        zoom: 17,
        pitch: 55,
        bearing: 0,
        speed: 1.6,
        curve: 1.2,
        essential: true,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterSignal?.key]);

  // 주소검색/내위치 → 카메라 이동 + 임시 마커만 표시 (건물은 십자 클릭으로 지음 — scout 방식)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !placeSignal) return;
    map.flyTo({
      center: placeSignal.lngLat,
      zoom: 16.6,
      pitch: 55,
      bearing: 0,
      speed: 1.6,
      curve: 1.2,
      essential: true,
    });
    // 임시 물방울 마커 (여기 클릭해서 건물 설치)
    tempMarkerRef.current?.remove();
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none;';
    el.innerHTML = `
      <svg width="30" height="42" viewBox="0 0 24 34" style="filter:drop-shadow(0 3px 4px rgba(0,0,0,.5));animation:sim-mk 0.6s ease-in-out infinite;">
        <path d="M12 0C5.9 0 1 4.9 1 11c0 8 11 22 11 22s11-14 11-22C23 4.9 18.1 0 12 0z" fill="#22d3ee" stroke="#fff" stroke-width="1.6"/>
        <circle cx="12" cy="11" r="4.2" fill="#fff"/></svg>
      <span style="font-size:11px;font-weight:700;color:#fff;white-space:nowrap;text-shadow:0 1px 3px #000,0 0 4px #000;">여기 클릭해 설치</span>`;
    if (!document.getElementById('sim-mk-style')) {
      const st = document.createElement('style');
      st.id = 'sim-mk-style';
      st.textContent = '@keyframes sim-mk{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}';
      document.head.appendChild(st);
    }
    tempMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat(placeSignal.lngLat)
      .addTo(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeSignal?.key]);

  return <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />;
}
