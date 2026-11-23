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

/* ── 계약 유형 — 울산 에자자는 자가소비 · onsite 두 가지만 ── */
export const CONTRACT_KIND_LABEL: Record<PlantContractKind, string> = {
  SELF_CONSUMPTION: '자가소비',
  ONSITE: 'PPA',
};
/** 계약 유형 메타 — 색으로 구분하지 않는다(글자만). 금액 라벨·단가 설정 키를 화면들이 같이 쓴다 */
export const CONTRACT_KIND: Record<PlantContractKind, { label: string; amountLabel: string; priceLabel: string; priceKey: string }> = {
  SELF_CONSUMPTION: { label: '자가소비', amountLabel: '절감액', priceLabel: '한전 단가', priceKey: 'KEPCO_UNIT_PRICE' },
  ONSITE: { label: 'PPA', amountLabel: 'PPA 요금', priceLabel: '계약 단가', priceKey: 'PPA_UNIT_PRICE' },
};
export const CONTRACT_KIND_ORDER: PlantContractKind[] = ['SELF_CONSUMPTION', 'ONSITE'];
/** 발전소의 계약 유형 목록 — 혼합 계약(한일튜브)은 2개, 연료전지·ORC 처럼 계약이 없으면 빈 배열 */
export function contractKindsOf(p: { contractType?: string; contractTypes?: string[] }): PlantContractKind[] {
  const raw: string[] = p.contractTypes?.length ? p.contractTypes : p.contractType ? [p.contractType] : [];
  return CONTRACT_KIND_ORDER.filter((k) => raw.includes(k));
}
/**
 * 계약별 몫 — 유형마다 계약 용량 kW. 응답에 contracts 가 있으면 그대로, 없으면 유형 하나가 설비 전체.
 * 혼합인데 분할 정보가 없으면 설비 용량을 균등 분할한다(임시).
 */
export function contractSplitOf(p: {
  capacity?: number;
  contractType?: string;
  contractTypes?: string[];
  contracts?: { kind: string; capacityKw: number }[];
}): { kind: PlantContractKind; capacityKw: number }[] {
  const kinds = contractKindsOf(p);
  if (p.contracts?.length) {
    return CONTRACT_KIND_ORDER.filter((k) => p.contracts!.some((c) => c.kind === k)).map((k) => ({
      kind: k,
      capacityKw: p.contracts!.find((c) => c.kind === k)!.capacityKw,
    }));
  }
  const cap = p.capacity ?? 0;
  return kinds.map((k) => ({ kind: k, capacityKw: kinds.length > 1 ? Math.round((cap / kinds.length) * 100) / 100 : cap }));
}

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
/** DX 전기안전지수 riskLevel (API-006/007, 연계 문서 v1.1 5단계). 이상은 위험 · 경고만 — 주의 · 관찰은 이상이 아니다(2026-11-23 사용자).
 *  통신오류 건은 등급이 정상이어도 목록에 뜬다 */
export const ANOMALY_GRADE: Record<string, PillSpec> = {
  danger: { label: '위험', tone: 'danger', order: 0 },
  warning: { label: '경고', tone: 'danger', order: 1 },
  caution: { label: '주의', tone: 'warning', order: 2 },
  watch: { label: '관찰', tone: 'muted', order: 3 },
  normal: { label: '정상', tone: 'normal', order: 4 },
};
/** S-Energy 통신 상태 (API-001): 0 정상 / 1 통신오류 */
export const COMM_STATUS: Record<string, PillSpec> = {
  COMM_ERROR: { label: '통신오류', tone: 'danger', order: 0 },
  NORMAL: { label: '정상', tone: 'normal', order: 1 },
};
/** 이상 건 하나의 상태 칸 — 통신오류(LASEE) · 수집 중단(DX 센서 값이 안 들어옴, 연계 문서 8-4) · 그 밖은 전기안전지수 등급(위험 · 경고).
 *  통신 상태만 찍으면 경고 건에 '정상'이 뜨므로 그 건이 무슨 이상인지를 보여 준다(2026-11-23 사용자) */
export const SENSOR_STOP = 'SENSOR_STOP';
export const anomalyStateOf = (severity: string, status: string): PillSpec & { code: string } =>
  status === 'COMM_ERROR'
    ? { code: status, label: '통신오류', tone: 'danger', order: -2 }
    : status === SENSOR_STOP
      ? { code: status, label: '수집 중단', tone: 'danger', order: -1 }
      : { code: severity, ...gradeOf(severity) };
/** 이상감지 관리 › 전체 상태 — 사업장(계약) 한 줄. 진행 중인 이상(통신 · 전원, 전기안전지수 위험 · 경고, 센서 수집 중단)이 하나라도 있으면 이상감지.
 *  재난 경보(태풍 · 강풍)는 지역 특보라 알림만 보내고 여기 세지 않는다(2026-11-23 사용자) */
export const SITE_STATUS: Record<string, PillSpec> = {
  ANOMALY: { label: '이상감지', tone: 'danger', order: 0 },
  NORMAL: { label: '정상', tone: 'normal', order: 1 },
};
export const siteStatusOf = (code: string): PillSpec => SITE_STATUS[code] ?? { label: code, tone: 'muted', order: 99 };
export const gradeOf = (code: string): PillSpec => ANOMALY_GRADE[code] ?? { label: code, tone: 'muted', order: 99 };
export const commStatusOf = (code: string): PillSpec => COMM_STATUS[code] ?? { label: code, tone: 'muted', order: 99 };
/** 이상 목록 포함 조건 — 등급이 위험 · 경고이거나 통신오류. 주의 · 관찰 · 정상은 이상이 아니다(2026-11-23 사용자) */
export const isAnomaly = (severity: string, status: string): boolean =>
  severity === 'danger' || severity === 'warning' || status === 'COMM_ERROR';

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
