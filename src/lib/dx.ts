/**
 * DX 스마트센서 — 예지보전 · 전기안전지수 (아이티공간 「울산에자자_예지보전_데이터_연계_정리_v1.1」).
 * · API-003 /external/dx/predictive/latest : 장비마다 최신 측정 1건 + 직전 1시간 Health Index
 * · API-006 /external/dx/safety/latest     : 장비마다 최신 전기안전지수(5분)
 * · API-007 /external/dx/safety/history    : 전기안전지수 이력(추이)
 * · 발전량 예측: 외부 제공 방식(MQTT/API) 결정 전 — 응답 형식은 문서 6.3 기준
 * 값이 없으면 0이 아니라 '미산출'(문서 6.2·7).
 */

/** 대상 DX 센서 — 문서 3장 9대 + 한길 · 건호이엔씨(들어온다고 가정) */
export interface DxSensor {
  /** 우리 발전소 id(LASEE) — 회사 단위 */
  plantId: number;
  /** DX 쪽 발전소 코드 — 용인금속은 17511 · 17558 두 개 */
  plantCode: number;
  deviceName: string;
  clientId: string;
  mac: string;
}
export const DX_SENSORS: DxSensor[] = [
  { plantId: 17514, plantCode: 17514, deviceName: '한일튜브1', clientId: 'ictm_d53812d1', mac: 'F4:69:D5:38:12:D1' },
  { plantId: 17514, plantCode: 17514, deviceName: '한일튜브2', clientId: 'ictm_d53812df', mac: 'F4:69:D5:38:12:DF' },
  { plantId: 17514, plantCode: 17514, deviceName: '한일튜브3', clientId: 'ictm_d53812d3', mac: 'F4:69:D5:38:12:D3' },
  { plantId: 17514, plantCode: 17514, deviceName: '한일튜브4', clientId: 'ictm_d53812cf', mac: 'F4:69:D5:38:12:CF' },
  { plantId: 17511, plantCode: 17511, deviceName: '용인금속01', clientId: 'USG_YI01', mac: 'F4:69:D5:38:12:CA' },
  { plantId: 17511, plantCode: 17511, deviceName: '용인금속02', clientId: 'USG_YI02', mac: 'F4:69:D5:38:12:CE' },
  { plantId: 17511, plantCode: 17558, deviceName: '용인금속03', clientId: 'USG_YI03', mac: 'F4:69:D5:38:12:C3' },
  { plantId: 17511, plantCode: 17558, deviceName: '용인금속04', clientId: 'USG_YI04', mac: 'F4:69:D5:38:12:C8' },
  { plantId: 17512, plantCode: 17512, deviceName: '태성산업', clientId: 'USG_TS01', mac: 'F4:69:D5:38:12:D4' },
  // 한길(17515) · 건호이엔씨(17513) — 연계 문서 v1.1 센서 목록에 아직 없음. 들어온다고 가정한 자리이며
  // clientId · MAC 은 아이티공간에서 받으면 교체(지금 값은 자리표시)
  { plantId: 17515, plantCode: 17515, deviceName: '한길', clientId: 'USG_HG01', mac: 'PENDING:17515:01' },
  { plantId: 17513, plantCode: 17513, deviceName: '건호이엔씨', clientId: 'USG_GH01', mac: 'PENDING:17513:01' },
];
/** 그 발전소(회사)의 DX 발전소 코드들 */
export const dxCodesOf = (plantId: number) => [...new Set(DX_SENSORS.filter((s) => s.plantId === plantId).map((s) => s.plantCode))];
export const dxSensorsOf = (plantId: number) => DX_SENSORS.filter((s) => s.plantId === plantId);
export const hasDx = (plantId: number) => DX_SENSORS.some((s) => s.plantId === plantId);

/* ── 응답 형식 ── */
export interface DxMeasurement {
  metricCode: string;
  metricName?: string;
  value: number | number[] | null;
  unit?: string;
}
export interface DxHealth {
  healthIndex: number | null;
  peak?: number | null;
  mean?: number | null;
  minVolt?: number | null;
  maxPf?: number | null;
  maxGround?: number | null;
  maxThdi?: number | null;
  maxTemp?: number | null;
  windowStartedAt: string | null;
  windowEndedAt: string | null;
}
export interface DxLatest {
  sourceType: 'DX_PREDICTIVE';
  plantCode: number | null;
  clientId: string;
  macAddress: string;
  deviceName: string | null;
  observedAt: string;
  receivedAt: string;
  measurements: DxMeasurement[];
  health: DxHealth | null;
}
export type DxRiskLevel = 'danger' | 'warning' | 'caution' | 'watch' | 'normal';
export type DxRiskKey = 'current' | 'voltage' | 'leakage' | 'harmonic' | 'temperature' | 'powerQuality' | 'arc' | 'communication';
export interface DxSafety {
  sourceType: 'DX_SAFETY';
  plantCode: number | null;
  plantName: string | null;
  clientId: string;
  macAddress: string;
  windowStartedAt: string;
  windowEndedAt: string;
  diagnosedAt: string;
  modelName: string;
  modelVersion: string;
  safetyIndex: number | null;
  riskLevel: DxRiskLevel;
  anomalyScore?: number | null;
  risks: Partial<Record<DxRiskKey, number | null>>;
}
/** 발전량 예측 1시간 구간(문서 6.3) */
export interface DxForecast {
  start: string;
  p50: number;
  p10: number;
  p90: number;
  issuedAt: string;
  modelVersion: string;
}

/* ── 표시 규칙 ── */
export const DX_LEVEL: Record<DxRiskLevel, { label: string; tone: 'normal' | 'danger' | 'warning' | 'muted'; order: number }> = {
  danger: { label: '위험', tone: 'danger', order: 0 },
  warning: { label: '경고', tone: 'danger', order: 1 },
  caution: { label: '주의', tone: 'warning', order: 2 },
  watch: { label: '관찰', tone: 'muted', order: 3 },
  normal: { label: '정상', tone: 'normal', order: 4 },
};
/** 화면에 보여 줄 위험 항목 — communication 은 참고용이라 뺀다 */
export const DX_RISK_ITEMS: { key: DxRiskKey; label: string }[] = [
  { key: 'current', label: '전류' },
  { key: 'voltage', label: '전압' },
  { key: 'leakage', label: '누설' },
  { key: 'harmonic', label: '고조파' },
  { key: 'temperature', label: '온도' },
  { key: 'powerQuality', label: '전력품질' },
  { key: 'arc', label: '아크' },
];
/** 화면에 쓰는 산출 모델은 종합 지수 하나(문서 5.4) */
export const DX_SAFETY_MODEL = 'umei_integrated_safety';

export function dxMetric(d: DxLatest | undefined, code: string): number | number[] | null {
  return d?.measurements.find((m) => m.metricCode === code)?.value ?? null;
}
/** 숫자 하나로 — temperature 는 [온도, 습도] 라 첫 값 */
export const firstNum = (v: number | number[] | null): number | null =>
  v == null ? null : Array.isArray(v) ? (v[0] ?? null) : v;

/** 'YYYY-MM-DD HH:MM:SS'(KST) → 경과 분 */
export function minutesSince(kst: string | null | undefined, now = Date.now()): number | null {
  if (!kst) return null;
  const t = Date.parse(kst.replace(' ', 'T') + '+09:00');
  return Number.isNaN(t) ? null : (now - t) / 60000;
}
/** 수집 중단 — 최신 receivedAt 이 5분 넘게 멈춤(문서 8-4) */
export const isStale = (d: DxLatest | undefined) => {
  const m = minutesSince(d?.receivedAt);
  return m == null || m > 5;
};
/** 연계 대상 센서 — 문서 3장 9대. 아직 목록에 없는 장비(PENDING:)는 대상 아님 */
export const isDxTarget = (mac: string) => !mac.startsWith('PENDING:');
/** 값이 안 들어온 센서 — 대상이면 수집 중단(정상 응답에 없어도, 문서 8-4), 대상 아니면 미수신.
 *  응답 자체가 없으면(불러오는 중 · 오류) 판단할 수 없어 미산출 */
export const stopLabel = (mac: string, responded = true) => (!responded ? '미산출' : isDxTarget(mac) ? '수집 중단' : '미수신');
/** 갱신 지연 — diagnosedAt 이 15분 넘게 지남(문서 6.2) */
export const isSafetyLate = (s: DxSafety | undefined) => {
  const m = minutesSince(s?.diagnosedAt);
  return m == null || m > 15;
};
/** 가장 높은 위험 항목 — 값 없는 항목(미산출)은 제외 */
export function topRisk(s: DxSafety | undefined): { label: string; score: number } | null {
  if (!s) return null;
  let best: { label: string; score: number } | null = null;
  for (const it of DX_RISK_ITEMS) {
    const v = s.risks[it.key];
    if (typeof v === 'number' && (!best || v > best.score)) best = { label: it.label, score: v };
  }
  return best;
}
/** 센서 중 가장 나쁜 안전 결과 — 등급, 같으면 지수가 낮은 것 */
export function worstSafety(xs: DxSafety[]): DxSafety | undefined {
  return [...xs]
    .filter((x) => !isSafetyLate(x))
    .sort((a, b) => DX_LEVEL[a.riskLevel].order - DX_LEVEL[b.riskLevel].order || (a.safetyIndex ?? 101) - (b.safetyIndex ?? 101))[0];
}
/** KST 문자열 'YYYY-MM-DD HH:MM:SS' */
export function kst(ms: number): string {
  const d = new Date(ms + 9 * 3600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}
export const hhmm = (s: string | null | undefined) => (s ? s.slice(11, 16) : '');
