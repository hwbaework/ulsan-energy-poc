/**
 * DX 스마트센서 목업 — 아이티공간 연계 문서 v1.1 의 응답 형식 그대로(API-003 · 006 · 007).
 * 실연동 때는 이 파일만 빠지고 같은 경로를 UMEI 로 넘긴다(키는 서버에서 붙임).
 * 값은 지금 시각의 해 높이로 만든다 — 낮에는 전류·전력이 오르고 밤엔 0, 역률은 무부하라 null(문서 5.4).
 * 경우의 수: 정상 / 관찰(한일튜브3 — 전류 불평형) / 주의(용인금속03 — 누설전류) / 수집 중단·갱신 지연(용인금속04).
 */
import { registerMock } from './registry';
import { DX_SENSORS, DX_SAFETY_MODEL, isDxTarget, kst, type DxFeature, type DxLatest, type DxRiskLevel, type DxSafety, type DxSensor } from '@/lib/dx';
import { LASEE_PLANTS } from '@/constants/plant-mapping';

/** 결정적 난수 0~1 */
const rnd = (a: number, b: number) => {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
/** 해 높이 0~1 — 6시~18시 산 모양(KST) */
const sunAt = (ms: number) => {
  const d = new Date(ms + 9 * 3600_000);
  const h = d.getUTCHours() + d.getUTCMinutes() / 60;
  return Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
};
/** 센서 정격(kW) — 발전소 설비 용량을 센서 수로 나눔 */
const RATED: Record<number, number> = { 17514: 429.44 / 4, 17511: 152.32 / 4, 17512: 46.08, 17515: 90.88, 17513: 33.92 };
const idx = (s: DxSensor) => DX_SENSORS.indexOf(s);

/** 센서별 특성 — 관찰·주의·중단 경우를 하나씩 */
const PROFILE: Record<string, { unbalance?: number; leakage?: number; health: number; staleMin?: number }> = {
  '한일튜브1': { health: 96.5 },
  '한일튜브2': { health: 98.2 },
  '한일튜브3': { health: 93.1, unbalance: 4.8 },
  '한일튜브4': { health: 97.0 },
  '용인금속01': { health: 97.4 },
  '용인금속02': { health: 96.1 },
  '용인금속03': { health: 89.6, leakage: 0.17 },
  '용인금속04': { health: 95.0, staleMin: 132 },
  태성산업: { health: 97.8 },
  한길: { health: 96.9 },
  건호이엔씨: { health: 97.3 },
};

function latestOf(s: DxSensor, now: number): DxLatest {
  const p = PROFILE[s.deviceName] ?? { health: 96 };
  const at = now - (p.staleMin ?? 0) * 60_000 - 20_000;
  const i = idx(s);
  const sun = sunAt(at);
  const kw = (RATED[s.plantId] ?? 50) * 0.82 * sun * (0.94 + rnd(i, at / 60_000) * 0.08);
  const amp = sun > 0 ? (kw * 1000) / (Math.sqrt(3) * 380 * 0.97) : 0;
  const ub = p.unbalance ?? 0.9 + rnd(i, 3) * 1.1;
  const r = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
  const hourStart = new Date(Math.floor((at + 9 * 3600_000) / 3600_000) * 3600_000 - 9 * 3600_000).getTime();
  return {
    sourceType: 'DX_PREDICTIVE',
    plantCode: s.plantCode,
    clientId: s.clientId,
    macAddress: s.mac,
    deviceName: s.deviceName,
    observedAt: kst(at),
    receivedAt: kst(at + 1000),
    measurements: [
      { metricCode: 'current_rst', metricName: 'R/S/T 전류', value: [r(amp * (1 + ub / 200)), r(amp), r(amp * (1 - ub / 200))], unit: 'A' },
      { metricCode: 'voltage_rst', metricName: 'R/S/T 전압', value: [r(380.4 + rnd(i, 4)), r(379.6 + rnd(i, 5)), r(381.1 - rnd(i, 6))], unit: 'V' },
      { metricCode: 'active_power', metricName: '유효 전력', value: Math.round(kw * 1000), unit: 'W' },
      { metricCode: 'power_factor', metricName: '역률', value: sun > 0.05 ? r(96.4 + rnd(i, 7) * 2) : null, unit: '%' },
      { metricCode: 'frequency', metricName: '주파수', value: r(59.98 + rnd(i, at / 60_000) * 0.04, 2), unit: 'Hz' },
      { metricCode: 'ground_current', metricName: '누설/지락 전류', value: r(p.leakage ?? 0.01 + rnd(i, 8) * 0.03, 3), unit: 'A' },
      // 온도 · 고조파 — 들어온다고 가정(2026-10-29 사용자). 낮엔 THD 가 낮고 무부하(밤)엔 높다, 온도는 해 따라 오른다
      { metricCode: 'thdi', metricName: '전류 고조파 왜곡률', value: r(sun > 0.05 ? 2.6 + rnd(i, 9) * 2.2 : 7.5 + rnd(i, 9) * 2), unit: '%' },
      { metricCode: 'temperature', metricName: '온도, 습도', value: [r(27 + sun * 9 + rnd(i, 10) * 2), r(48 + rnd(i, 11) * 10)], unit: 'degC' },
      { metricCode: 'current_unbalance', metricName: '전류 불평형률', value: r(ub), unit: '%' },
      { metricCode: 'voltage_unbalance', metricName: '전압 불평형률', value: r(0.2 + rnd(i, 12) * 0.3), unit: '%' },
    ],
    health: {
      healthIndex: p.health,
      peak: r(amp * 1.12),
      mean: r(amp * 0.9),
      maxPf: sun > 0.05 ? 98.0 : null,
      maxGround: r((p.leakage ?? 0.03) * 1.2, 3),
      maxThdi: r(sun > 0.05 ? 5.1 : 9.6),
      maxTemp: r(29 + sun * 9),
      windowStartedAt: kst(hourStart - 3600_000),
      windowEndedAt: kst(hourStart),
    },
  };
}

/** 그 시각의 안전지수 — 관찰·주의 센서는 최근 몇 시간에 떨어진다 */
function safetyAt(s: DxSensor, t: number, now: number): DxSafety {
  const i = idx(s);
  const p = PROFILE[s.deviceName] ?? { health: 96 };
  const hoursAgo = (now - t) / 3600_000;
  const wave = Math.sin(t / 2_700_000 + i) * 0.9 + (rnd(i, Math.floor(t / 300_000)) - 0.5) * 0.6;
  // 위험점수는 정수(2026-10-29 사용자)
  const r1 = (v: number) => Math.round(v);
  const risks: DxSafety['risks'] = {
    current: r1(4.5 + rnd(i, 21) * 3 + wave),
    voltage: r1(1.5 + rnd(i, 22) * 2),
    leakage: r1(0.5 + rnd(i, 23) * 2),
    harmonic: r1(2 + rnd(i, 24) * 3),
    temperature: r1(1 + sunAt(t) * 3),
    powerQuality: sunAt(t) > 0.05 ? r1(1 + rnd(i, 25) * 2) : null,
    arc: null, // 아크 지수 제공 전까지 null(문서 6.4)
    communication: 0,
  };
  // 관찰(한일튜브3 — 전류 불평형) · 주의(용인금속03 — 누설전류) 는 최근 몇 시간에 그 항목 점수가 오른다
  if (p.unbalance && hoursAgo < 3) risks.current = r1(11 + wave * 0.6);
  if (p.leakage && hoursAgo < 6) risks.leakage = r1(28 + wave);
  // 전기안전지수 = 100 − 가장 높은 위험점수(문서 5.4 응답 예시: current 8.6 → 91.4), anomalyScore 도 그 점수
  const top = Math.max(...Object.entries(risks).filter(([k, v]) => k !== 'communication' && typeof v === 'number').map(([, v]) => v as number));
  const index = 100 - top;
  const level: DxRiskLevel = index < 60 ? 'warning' : index < 80 ? 'caution' : index < 90 ? 'watch' : 'normal';
  const ws = Math.floor(t / 300_000) * 300_000;
  const plant = LASEE_PLANTS.find((x) => x.laseeId === s.plantId);
  return {
    sourceType: 'DX_SAFETY',
    plantCode: s.plantCode,
    plantName: `울산 ${plant?.name ?? ''}${s.plantId === 17511 ? (s.plantCode === 17511 ? '1' : '2') : ''}`,
    clientId: s.clientId,
    macAddress: s.mac,
    windowStartedAt: kst(ws),
    windowEndedAt: kst(ws + 300_000),
    diagnosedAt: kst(ws + 300_000 + 240_000),
    modelName: DX_SAFETY_MODEL,
    modelVersion: 'v1',
    safetyIndex: Math.round(index * 10) / 10,
    riskLevel: level,
    anomalyScore: top,
    risks,
  };
}

// 실제 API 처럼 연계 대상 9대만 돌려준다(아직 목록에 없는 한길 · 건호이엔씨는 응답 없음 → 미수신)
const pick = (codes: string | null, mac: string | null) =>
  DX_SENSORS.filter(
    (s) => isDxTarget(s.mac) && (!codes || codes.split(',').map(Number).includes(s.plantCode)) && (!mac || s.mac === mac),
  );

// API-003 예지보전 최신
registerMock(/^\/external\/dx\/predictive\/latest$/, ({ query }) => {
  const now = Date.now();
  return { items: pick(query.get('plantCode'), query.get('macAddress')).map((s) => latestOf(s, now)) };
});
// API-006 전기안전지수 최신 — 용인금속04 는 2시간 전 결과에 멈춤(갱신 지연)
registerMock(/^\/external\/dx\/safety\/latest$/, ({ query }) => {
  const now = Date.now();
  return {
    items: pick(query.get('plantCode'), query.get('macAddress')).map((s) => {
      const late = PROFILE[s.deviceName]?.staleMin ?? 0;
      return safetyAt(s, now - 600_000 - late * 60_000, now);
    }),
  };
});
// API-007 전기안전지수 이력 — 5분 단위, 기본 최근 24시간
registerMock(/^\/external\/dx\/safety\/history$/, ({ query }) => {
  const now = Date.now();
  const hours = Number(query.get('hours') ?? 24);
  const items: DxSafety[] = [];
  for (const s of pick(query.get('plantCode'), query.get('macAddress'))) {
    const late = (PROFILE[s.deviceName]?.staleMin ?? 0) * 60_000;
    for (let t = now - hours * 3600_000; t <= now - 600_000 - late; t += 300_000) items.push(safetyAt(s, t, now));
  }
  return { items };
});

/** 그 5분 구간의 특징값(API-005) — 최신 측정과 같은 식(온도 · 고조파 포함) */
function featureAt(s: DxSensor, t: number): DxFeature {
  const i = idx(s);
  const p = PROFILE[s.deviceName] ?? { health: 96 };
  const sun = sunAt(t);
  const kw = (RATED[s.plantId] ?? 50) * 0.82 * sun * (0.94 + rnd(i, t / 300_000) * 0.08);
  const amp = sun > 0 ? (kw * 1000) / (Math.sqrt(3) * 380 * 0.97) : 0;
  const ub = p.unbalance ?? 0.9 + rnd(i, 3) * 1.1;
  const r = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
  return {
    sourceType: 'DX_PREDICTIVE_FEATURE',
    plantCode: s.plantCode,
    macAddress: s.mac,
    observedAt: kst(t),
    windowEndedAt: kst(t + 300_000),
    sampleCount: 297 + Math.floor(rnd(i, t / 300_000) * 4),
    measurements: [
      { metricCode: 'current_rst', metricName: 'R/S/T 최대 전류', value: [r(amp * 1.04 * (1 + ub / 200)), r(amp * 1.04), r(amp * 1.04 * (1 - ub / 200))], unit: 'A' },
      { metricCode: 'voltage_mean', metricName: '평균 전압', value: r(380.3 + (rnd(i, t / 300_000) - 0.5) * 1.6), unit: 'V' },
      { metricCode: 'temperature', metricName: '평균 온도', value: r(27 + sun * 9 + rnd(i, t / 300_000) * 1.5), unit: 'degC' },
      { metricCode: 'thdi', metricName: '평균 전류 THD', value: r(sun > 0.05 ? 2.6 + rnd(i, t / 300_000) * 2 : 7.5 + rnd(i, t / 300_000) * 1.8), unit: '%' },
      { metricCode: 'ground_current', metricName: '평균 누설 전류', value: r(p.leakage ?? 0.01 + rnd(i, 8) * 0.03, 3), unit: 'A' },
      { metricCode: 'power_factor', metricName: '평균 역률', value: sun > 0.05 ? r(96.4 + rnd(i, t / 300_000) * 2) : null, unit: '%' },
    ],
  };
}
// API-005 예지보전 5분 특징값 이력 — 기본 최근 24시간, 수집이 멈춘 센서는 멈춘 뒤 구간 없음
registerMock(/^\/external\/dx\/predictive\/features\/history$/, ({ query }) => {
  const now = Date.now();
  const hours = Number(query.get('hours') ?? 24);
  const items: DxFeature[] = [];
  for (const s of pick(query.get('plantCode'), query.get('macAddress'))) {
    const late = (PROFILE[s.deviceName]?.staleMin ?? 0) * 60_000;
    const start = Math.floor((now - hours * 3600_000) / 300_000) * 300_000;
    for (let t = start; t <= now - 300_000 - late; t += 300_000) items.push(featureAt(s, t));
  }
  return { items };
});
