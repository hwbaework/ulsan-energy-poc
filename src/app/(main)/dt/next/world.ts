// /dt/next 세계 상태 — { tier, lens, selection, view } 4개 변수가 세계의 전부.
// tier는 줌에서 파생(히스테리시스), selection은 tier가 바뀌어도 유지(선택 관통).
import { create } from 'zustand';

export type Tier = 'L0' | 'L1' | 'L2' | 'L3';
export type LensKey = 'grid' | 'vpp' | 'sun' | 'monitor';

export interface Selection {
  /** dt-map-server 피처의 assetId (예: 'gen:plant:12', 'grid:sub:3', 'vpp:solar:88') */
  assetId: string;
  layerId: string;
  name: string;
  props: Record<string, unknown>;
  lngLat: [number, number];
}

export interface WorldState {
  tier: Tier;
  lens: LensKey[];
  selection: Selection | null;
  /** 렌즈별 뷰포트 내 피처 수 (GIS bbox 응답 기반 — info 요약에 사용) */
  counts: Record<string, number>;
  /** 현재 맵 베어링(도) — 태양 다이얼의 방위 정렬용 */
  bearing: number;
  setTier: (t: Tier) => void;
  toggleLens: (l: LensKey) => void;
  setLens: (ls: LensKey[]) => void;
  select: (s: Selection | null) => void;
  setCount: (layerId: string, n: number) => void;
  setBearing: (b: number) => void;
}

export const useWorld = create<WorldState>((set) => ({
  tier: 'L0',
  lens: ['grid'],
  selection: null,
  counts: {},
  bearing: 0,
  setTier: (tier) => set({ tier }),
  setBearing: (bearing) => set({ bearing }),
  toggleLens: (l) =>
    set((s) => ({ lens: s.lens.includes(l) ? s.lens.filter((x) => x !== l) : [...s.lens, l] })),
  setLens: (lens) => set({ lens }),
  select: (selection) => set({ selection }),
  setCount: (layerId, n) => set((s) => ({ counts: { ...s.counts, [layerId]: n } })),
}));

// ── 줌 ↔ tier ──────────────────────────────────────────────
// 경계: L0 <8 · L1 8~13.4 · L2 13.4~15.8 · L3 ≥15.8
// (L1 울산 시가지 뷰가 z12.6이라 L1 상한을 13.4로 — 각 tier 카메라 줌이 자기 구간 안에 있어야 함)
const BOUNDS: [number, number, number] = [8, 13.4, 15.8];
const HYSTERESIS = 0.3;

export function tierFromZoom(z: number): Tier {
  return z < BOUNDS[0] ? 'L0' : z < BOUNDS[1] ? 'L1' : z < BOUNDS[2] ? 'L2' : 'L3';
}

/** 히스테리시스 적용 — 현재 tier 경계 ±0.3z 안에서는 tier를 바꾸지 않는다 (경계 진동 방지). */
export function nextTier(current: Tier, zoom: number): Tier {
  const target = tierFromZoom(zoom);
  if (target === current) return current;
  const idx = ['L0', 'L1', 'L2', 'L3'].indexOf(current);
  // 현재 tier의 위/아래 경계
  const lower = idx > 0 ? BOUNDS[idx - 1]! : -Infinity;
  const upper = idx < 3 ? BOUNDS[idx]! : Infinity;
  if (zoom > lower - HYSTERESIS && zoom < upper + HYSTERESIS) return current;
  return target;
}

// ── tier별 카메라 (LOD 레일 점프용 — 진실은 줌, 버튼은 flyTo 수단) ──
export interface CamView {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

export const TIER_META: Record<Tier, { name: string; scope: string; sees: string; view: CamView }> =
  {
    L0: {
      name: '전국·계통',
      scope: '전국 송전망',
      sees: '발전소 · 변전소 · 시장',
      view: { center: [128.15, 36.2], zoom: 6.7, pitch: 24, bearing: -8 },
    },
    L1: {
      name: '지역',
      scope: '울산권',
      sees: '지역 자원 · 계약',
      view: { center: [129.33, 35.53], zoom: 12.6, pitch: 0, bearing: 0 },
    },
    // L2: 트윈 렌더 하한(z15) 이상으로 — 한일튜브가 단지 맥락 속에 작게 보인다
    L2: {
      name: '산단',
      scope: '부곡동 산업단지',
      sees: '단지 · 트윈 모델',
      view: { center: [129.3309, 35.5043], zoom: 15.3, pitch: 55, bearing: -20 },
    },
    // L3: TerraWatt 한일튜브 뷰 각도(피치 62·베어링 -20) + 건물 포커스 줌인
    L3: {
      name: '설비',
      scope: '부곡동 · 한일튜브',
      sees: '3D 트윈 · 실시간',
      view: { center: [129.3308, 35.5048], zoom: 17.5, pitch: 62, bearing: -20 },
    },
  };
export const TIERS: Tier[] = ['L0', 'L1', 'L2', 'L3'];

// ── 렌즈 정의 (칩 UI) ──
export const LENSES: { key: LensKey; label: string; color: string }[] = [
  { key: 'grid', label: '계통·거래', color: '#a855f7' },
  { key: 'vpp', label: 'VPP 자원', color: '#f59e0b' },
  { key: 'sun', label: '일사량', color: '#facc15' },
  { key: 'monitor', label: '설비', color: '#38bdf8' },
];

// ── 페르소나 진입 프리셋 — /dt/next?p=... 별도 트리 없이 착지만 다르게 ──
export const PRESETS: Record<string, { tier: Tier; lens: LensKey[] }> = {
  generator: { tier: 'L1', lens: ['vpp', 'grid'] },
  consumer: { tier: 'L2', lens: ['monitor', 'grid'] },
  consultant: { tier: 'L0', lens: ['vpp', 'sun'] },
  admin: { tier: 'L0', lens: ['grid', 'vpp', 'sun', 'monitor'] },
};
