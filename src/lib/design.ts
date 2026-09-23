/**
 * 울산 에자자 POC 디자인 정의 (단일 기준)
 * 근거: DT WEB 기본 디자인 가이드 — 28_디자인-토큰-가이드.pdf, 컬러가이드.html
 *
 * - 발전원(SOURCE): 색·아이콘·라벨. 지도 마커·범례·배지·목록·차트 모두 여기 값을 쓴다.
 * - 상태(STATUS): 정상 = green, 이상감지 = red. 그 외 세부 상태는 판정 근거가 없어 구분하지 않는다.
 * - 아이콘: 숫자 KPI 카드에는 쓰지 않는다. 발전원·상태·날씨처럼 아이콘이 뜻을 전달하는 곳에만 쓴다.
 * 가이드 페이지: /guide
 */
import type { LucideIcon } from 'lucide-react';
import { BatteryCharging, Flame, Sun, Sunrise, Sunset, Thermometer, Wind, Zap } from 'lucide-react';
import type { EnergySource, PlantContractKind, PlantStatus } from '@/types/monitoring';

/* ── 계약 유형 — 울산 에자자는 자가소비 · 온사이트 PPA 두 가지만 ── */
export const CONTRACT_KIND_LABEL: Record<PlantContractKind, string> = {
  SELF_CONSUMPTION: '자가소비',
  ONSITE: '온사이트 PPA',
};

/* ── 컬러 토큰 (컬러가이드.html) ───────────────────────────────── */
export const COLOR = {
  primary: '#2563EB',
  primaryHover: '#3B82F6',
  primaryLight: '#60A5FA',
  secondary: '#475569',
  accent: '#94A3B8',
  bg: '#000C17',
  card: '#0D1520',
  cardSolid: '#13233C',
  panel: '#1A2332',
  green: '#10B981',
  yellow: '#F59E0B',
  orange: '#F97316',
  red: '#F87171',
  redSolid: '#DC2626',
  blue: '#3B82F6',
  cyan: '#06B6D4',
  violet: '#8B5CF6',
  indigo: '#6366F1',
  rose: '#F43F5E',
  textBody: '#CBD5E1',
  textMuted: '#94A3B8',
  textCaption: '#64748B',
} as const;

/** 차트 시리즈 팔레트 (토큰 가이드 7장, 순서 고정) */
export const CHART_PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#6366F1'] as const;

/* ── 발전원 ─────────────────────────────────────────────── */
export interface SourceSpec {
  label: string;
  color: string;
  /** Tailwind 배경 클래스 (막대) */
  barClass: string;
  /** 화면용 아이콘 (배지·목록·범례·요약) — 핀 모양 마커 그림은 지도에서만 쓴다 */
  icon: LucideIcon;
  /** 지도 마커 전용 핀 SVG */
  markerUrl: string;
}

export const SOURCE: Record<EnergySource, SourceSpec> = {
  SOLAR: { label: '태양광', color: COLOR.yellow, barClass: 'bg-amber-500', icon: Sun, markerUrl: '/assets/icon/icon_zoom_out_sun.svg' },
  // ORC 는 바이올렛: 태양광(노랑)·연료전지(파랑)·이상감지(빨강)·정상(초록) 어느 것과도 겹치지 않는 색. 핀 SVG 색도 같이 맞춘다.
  ORC: { label: 'ORC', color: COLOR.violet, barClass: 'bg-violet-500', icon: Flame, markerUrl: '/assets/icon/icon_zoom_out_orc.svg' },
  FUEL_CELL: { label: '연료전지', color: COLOR.blue, barClass: 'bg-blue-500', icon: BatteryCharging, markerUrl: '/assets/icon/icon_zoom_out_fuel_cell.svg' },
};
export const SOURCE_ORDER: EnergySource[] = ['SOLAR', 'ORC', 'FUEL_CELL'];

export function sourceOf(type: string): SourceSpec {
  return SOURCE[type as EnergySource] ?? { label: type, color: COLOR.accent, barClass: 'bg-slate-500', icon: Zap, markerUrl: SOURCE.SOLAR.markerUrl };
}

/* ── 상태 ──────────────────────────────────────────────── */
export interface StatusSpec {
  label: string;
  color: string;
  dotClass: string;
  barClass: string;
  textClass: string;
  badgeClass: string;
}
const NORMAL_SPEC: StatusSpec = {
  label: '정상',
  color: COLOR.green,
  dotClass: 'bg-emerald-500',
  barClass: 'bg-emerald-500',
  textClass: 'text-emerald-400',
  badgeClass: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
};
const ANOMALY_SPEC: StatusSpec = {
  label: '이상감지',
  color: COLOR.red,
  dotClass: 'bg-red-500',
  barClass: 'bg-red-500',
  textClass: 'text-red-400',
  badgeClass: 'bg-red-500/10 text-red-400 ring-red-500/20',
};
/** 정상 계열은 전부 정상으로, 이상감지만 구분 */
export function statusOf(status: PlantStatus | string): StatusSpec {
  return status === 'ANOMALY' ? ANOMALY_SPEC : NORMAL_SPEC;
}
export const STATUS_KEY = [NORMAL_SPEC, ANOMALY_SPEC];

/* ── 이상 등급 · 통신 상태 (근거: ITS_울산_에자자_수집데이터_API_명세서_v1.2) ── */
export type PillTone = 'normal' | 'danger' | 'warning' | 'muted';
export interface PillSpec {
  label: string;
  tone: PillTone;
  order: number;
}
/** DX 전기안전지수 riskLevel (API-006/007). normal 은 이상이 아니지만 통신오류 건은 등급 정상으로도 목록에 뜬다 */
export const ANOMALY_GRADE: Record<string, PillSpec> = {
  warning: { label: '경고', tone: 'danger', order: 0 },
  caution: { label: '주의', tone: 'warning', order: 1 },
  normal: { label: '정상', tone: 'normal', order: 2 },
};
/** S-Energy 통신 상태 (API-001): 0 정상 / 1 통신오류 */
export const COMM_STATUS: Record<string, PillSpec> = {
  COMM_ERROR: { label: '통신오류', tone: 'danger', order: 0 },
  NORMAL: { label: '정상', tone: 'normal', order: 1 },
};
export const gradeOf = (code: string): PillSpec => ANOMALY_GRADE[code] ?? { label: code, tone: 'muted', order: 99 };
export const commStatusOf = (code: string): PillSpec => COMM_STATUS[code] ?? { label: code, tone: 'muted', order: 99 };
/** 이상 목록 포함 조건 — 등급이 정상이 아니거나 통신오류. 둘 다 정상이면 이상이 아니다 */
export const isAnomaly = (severity: string, status: string): boolean => severity !== 'normal' || status === 'COMM_ERROR';

/* ── 아이콘을 쓰는 지표 ────────────────────────────────── */
/**
 * 규칙: 숫자 KPI 카드(현재 출력·발전량·설비 용량·금액 …)에는 아이콘을 붙이지 않는다.
 * 아이콘은 그 자체로 의미를 전달하는 곳에만 쓴다 — 발전원(SOURCE), 상태(STATUS), 날씨(아래).
 */
export interface MetricSpec {
  label: string;
  icon: LucideIcon;
  color: string;
  /** 아이콘 텍스트 색 클래스 */
  className: string;
  /** 어떤 라벨에 쓰는지 (가이드 표기용) */
  usage: string;
}

export const METRICS = {
  temperature: { label: '기온', icon: Thermometer, color: COLOR.cyan, className: 'text-cyan-400', usage: '관제 HUD 기온 (℃)' },
  wind: { label: '풍향/풍속', icon: Wind, color: COLOR.cyan, className: 'text-cyan-400', usage: '관제 HUD 풍향 · 풍속 (m/s)' },
  sunrise: { label: '일출', icon: Sunrise, color: COLOR.yellow, className: 'text-amber-400', usage: '관제 HUD 일출 시각' },
  sunset: { label: '일몰', icon: Sunset, color: COLOR.orange, className: 'text-orange-400', usage: '관제 HUD 일몰 시각' },
} as const satisfies Record<string, MetricSpec>;

export type MetricKey = keyof typeof METRICS;
export const METRIC_ORDER: MetricKey[] = ['temperature', 'wind', 'sunrise', 'sunset'];
