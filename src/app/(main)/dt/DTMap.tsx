'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import NextImage from 'next/image';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMonitoringPlants } from '@/hooks/monitoring/useMonitoring';
import type { MonitoringPlant, EnergySource, PlantStatus } from '@/types/monitoring';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
const DT_URL = `/dt-unity/index.html?v=${Date.now()}`;
const ICON_SIZE = 52;

const TYPE_ICON_URLS: Record<EnergySource, string> = {
  SOLAR: '/assets/icon/icon_zoom_out_sun.svg',
  ORC: '/assets/icon/icon_zoom_out_orc.svg',
  FUEL_CELL: '/assets/icon/icon_zoom_out_fuel_cell.svg',
};

const TYPE_LABELS: Record<EnergySource, string> = {
  SOLAR: '태양광',
  ORC: 'ORC',
  FUEL_CELL: '연료전지',
};

const STATUS_COLORS: Record<PlantStatus, string> = {
  NORMAL: '#10B981',
  WARNING: '#F59E0B',
  ANOMALY: '#EF4444',
  MAINTENANCE: '#6366F1',
  OFFLINE: '#6B7280',
};

const STATUS_LABELS: Record<PlantStatus, string> = {
  NORMAL: '정상',
  WARNING: '주의',
  ANOMALY: '이상',
  MAINTENANCE: '정비',
  OFFLINE: '정지',
};

function rasterizeSvg(url: string, size: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(size, size);
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function buildGeoJson(plants: MonitoringPlant[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: plants
      .filter((p) => p.latitude && p.longitude)
      .map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.longitude!, p.latitude!] },
        properties: {
          id: p.plantId,
          name: p.name,
          type: p.type,
          status: p.status,
          capacity: p.capacity,
          currentOutput: p.currentOutput,
          icon: `marker-${p.type}`,
        },
      })),
  };
}

function buildPopupHtml(plant: MonitoringPlant) {
  const pct = plant.capacity > 0 ? ((plant.currentOutput / plant.capacity) * 100).toFixed(0) : '0';
  const statusColor = STATUS_COLORS[plant.status] ?? '#6B7280';
  return `
    <div style="padding:8px 12px;min-width:180px;font-family:system-ui,sans-serif;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor};"></span>
        <span style="font-size:13px;font-weight:700;color:#1e293b;">${plant.name}</span>
      </div>
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">
        <span style="font-size:11px;color:#64748b;background:#f1f5f9;padding:1px 6px;border-radius:4px;">${TYPE_LABELS[plant.type as EnergySource] ?? plant.type}</span>
        <span style="font-size:11px;color:#64748b;">${STATUS_LABELS[plant.status] ?? plant.status}</span>
      </div>
      <div style="font-size:12px;color:#334155;">
        <span style="font-weight:600;">${plant.currentOutput.toLocaleString()}</span>
        <span style="color:#94a3b8;"> / ${plant.capacity.toLocaleString()} kW</span>
        <span style="color:${statusColor};font-weight:600;margin-left:4px;">${pct}%</span>
      </div>
    </div>
  `;
}

const PLANTS_SOURCE = 'plants-source';
const PLANTS_LAYER = 'plants-layer';
const PLANTS_LABEL_LAYER = 'plants-label-layer';

export default function DTMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const iconsLoadedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [showDT, setShowDT] = useState(false);
  const [clickedName, setClickedName] = useState('');

  const { data: plantsData } = useMonitoringPlants();
  const plants = useMemo(() => plantsData ?? [], [plantsData]);
  const plantsMapRef = useRef<Map<number, MonitoringPlant>>(new Map());

  useEffect(() => {
    plantsMapRef.current = new Map(plants.map((p) => [p.plantId, p]));
  }, [plants]);

  const loadIcons = useCallback(async (map: mapboxgl.Map) => {
    if (iconsLoadedRef.current) return;
    const entries = Object.entries(TYPE_ICON_URLS) as [EnergySource, string][];
    await Promise.all(
      entries.map(async ([type, url]) => {
        const img = await rasterizeSvg(url, ICON_SIZE);
        if (!map.hasImage(`marker-${type}`)) {
          map.addImage(`marker-${type}`, img, { sdf: false });
        }
      }),
    );
    iconsLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/standard-satellite',
      center: [129.28, 35.5],
      zoom: 11.5,
      pitch: 60,
      bearing: -20,
      antialias: true,
    });

    mapRef.current = map;

    map.on('style.load', async () => {
      map.setConfigProperty('basemap', 'lightPreset', 'dusk');
      map.setConfigProperty('basemap', 'showPlaceLabels', true);
      map.setConfigProperty('basemap', 'showPointOfInterestLabels', false);
      map.setConfigProperty('basemap', 'show3dObjects', true);

      // 3D 지형: DEM 고도 데이터를 입혀 입체 지형을 렌더 (위성 이미지는 standard-satellite 스타일이 내장)
      if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        });
      }
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.4 });

      await loadIcons(map);

      map.addSource(PLANTS_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: PLANTS_LAYER,
        type: 'symbol',
        source: PLANTS_SOURCE,
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-size': 0.8,
          'icon-allow-overlap': true,
          'icon-anchor': 'bottom',
        },
      });

      map.addLayer({
        id: PLANTS_LABEL_LAYER,
        type: 'symbol',
        source: PLANTS_SOURCE,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': 12,
          'text-offset': [0, 0.8],
          'text-anchor': 'top',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0,0,0,0.7)',
          'text-halo-width': 1.5,
        },
      });

      map.on('click', PLANTS_LAYER, (e) => {
        const feature = e.features?.[0];
        if (!feature || !feature.properties) return;
        const plantId = feature.properties.id as number;
        const plant = plantsMapRef.current.get(plantId);
        if (plant) {
          setClickedName(plant.name);
          setShowDT(true);
        }
      });

      map.on('mouseenter', PLANTS_LAYER, (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const feature = e.features?.[0];
        if (!feature || !feature.properties) return;
        const plantId = feature.properties.id as number;
        const plant = plantsMapRef.current.get(plantId);
        if (!plant) return;
        const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
        popupRef.current?.remove();
        popupRef.current = new mapboxgl.Popup({ offset: 25, closeButton: false, maxWidth: '260px' })
          .setLngLat(coords)
          .setHTML(buildPopupHtml(plant))
          .addTo(map);
      });

      map.on('mouseleave', PLANTS_LAYER, () => {
        map.getCanvas().style.cursor = '';
        popupRef.current?.remove();
        popupRef.current = null;
      });

      setLoaded(true);
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      map.remove();
      mapRef.current = null;
      iconsLoadedRef.current = false;
    };
  }, [loadIcons]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || plants.length === 0) return;

    const source = map.getSource(PLANTS_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    source.setData(buildGeoJson(plants));
  }, [loaded, plants]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />

      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <span className="text-sm text-slate-400">3D 맵 로딩 중...</span>
          </div>
        </div>
      )}

      <div className="absolute top-4 left-4 z-10 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Digital Twin</h2>
        <p className="text-xs text-slate-400 mt-0.5">마커 클릭 시 DT 시뮬레이션</p>
      </div>

      <div className="absolute bottom-4 left-4 z-10 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/10 px-4 py-3">
        <p className="text-[10px] font-medium text-slate-400 mb-2">발전소</p>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1.5 text-white/80">
            <NextImage src="/assets/icon/icon_zoom_out_sun.svg" width={24} height={24} alt="" /> 태양광
          </span>
          <span className="flex items-center gap-1.5 text-white/80">
            <NextImage src="/assets/icon/icon_zoom_out_orc.svg" width={24} height={24} alt="" /> ORC
          </span>
          <span className="flex items-center gap-1.5 text-white/80">
            <NextImage src="/assets/icon/icon_zoom_out_fuel_cell.svg" width={24} height={24} alt="" /> 연료전지
          </span>
        </div>
      </div>

      {showDT && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="relative w-[98vw] h-[96vh] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900 flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-800/90 border-b border-white/10 shrink-0">
              <div>
                <h3 className="text-md font-semibold text-white">DT 시뮬레이션</h3>
                <p className="text-xs text-slate-400">{clickedName}</p>
              </div>
              <button
                onClick={() => setShowDT(false)}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden flex items-center justify-center bg-black">
              <iframe
                src={DT_URL}
                className="border-0"
                style={{
                  width: '1920px',
                  height: '1080px',
                  transform: 'scale(var(--dt-scale))',
                  transformOrigin: 'center center',
                }}
                ref={(el) => {
                  if (!el) return;
                  const container = el.parentElement;
                  if (!container) return;
                  const update = () => {
                    const cw = container.clientWidth;
                    const ch = container.clientHeight;
                    const s = Math.min(cw / 1920, ch / 1080);
                    el.style.setProperty('--dt-scale', String(s));
                  };
                  update();
                  const ro = new ResizeObserver(update);
                  ro.observe(container);
                }}
                allow="fullscreen; autoplay"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
