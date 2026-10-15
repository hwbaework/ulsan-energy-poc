/**
 * PPA 가동일 — 쉬는 날(주말 · 공휴일)에는 인버터를 OFF 한다(2026-10-12 정건호: PPA 는 공장이 쉬는 날 쓸 사람이 없어 역송되므로 OFF).
 * 자가소비는 365일 그대로.
 *  - 공휴일: 공공데이터포털 '한국천문연구원 특일 정보'(getRestDeInfo) — 서버가 해마다 받아 둔다. POC 는 목업이 같은 모양으로 돌려준다
 *  - 주말: 달력으로 계산
 *  - 발전소마다 날짜별 수동 OFF / ON(겹쳐 쓰기)
 */

/** 특일 정보 한 줄 — 날짜 · 이름 (주말과 겹친 날도 온다) */
export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
}

/** 특일 정보 API 응답(2026) — locdate · dateName 을 날짜 · 이름으로 */
export const HOLIDAYS_SEED: Record<number, Holiday[]> = {
  2025: [
    { date: '2025-01-01', name: '1월1일' },
    { date: '2025-01-27', name: '임시공휴일' },
    { date: '2025-01-28', name: '설날' },
    { date: '2025-01-29', name: '설날' },
    { date: '2025-01-30', name: '설날' },
    { date: '2025-03-01', name: '삼일절' },
    { date: '2025-03-03', name: '대체공휴일(삼일절)' },
    { date: '2025-05-05', name: '어린이날' },
    { date: '2025-05-05', name: '부처님오신날' },
    { date: '2025-05-06', name: '대체공휴일' },
    { date: '2025-06-03', name: '대통령선거' },
    { date: '2025-06-06', name: '현충일' },
    { date: '2025-08-15', name: '광복절' },
    { date: '2025-10-03', name: '개천절' },
    { date: '2025-10-05', name: '추석' },
    { date: '2025-10-06', name: '추석' },
    { date: '2025-10-07', name: '추석' },
    { date: '2025-10-08', name: '대체공휴일(추석)' },
    { date: '2025-10-09', name: '한글날' },
    { date: '2025-12-25', name: '기독탄신일' },
  ],
  2026: [
    { date: '2026-01-01', name: '1월1일' },
    { date: '2026-02-16', name: '설날' },
    { date: '2026-02-17', name: '설날' },
    { date: '2026-02-18', name: '설날' },
    { date: '2026-03-01', name: '삼일절' },
    { date: '2026-03-02', name: '대체공휴일(삼일절)' },
    { date: '2026-05-01', name: '노동절' },
    { date: '2026-05-05', name: '어린이날' },
    { date: '2026-05-24', name: '부처님오신날' },
    { date: '2026-05-25', name: '대체공휴일(부처님오신날)' },
    { date: '2026-06-03', name: '전국동시지방선거' },
    { date: '2026-06-06', name: '현충일' },
    { date: '2026-07-17', name: '제헌절' },
    { date: '2026-08-15', name: '광복절' },
    { date: '2026-08-17', name: '대체공휴일(광복절)' },
    { date: '2026-09-24', name: '추석' },
    { date: '2026-09-25', name: '추석' },
    { date: '2026-09-26', name: '추석' },
    { date: '2026-10-03', name: '개천절' },
    { date: '2026-10-05', name: '대체공휴일(개천절)' },
    { date: '2026-10-09', name: '한글날' },
    { date: '2026-12-25', name: '기독탄신일' },
  ],
  // 2027 — 우주항공청 2027년도 월력요항(2026-06-29 발표) 기준, 24일
  2027: [
    { date: '2027-01-01', name: '1월1일' },
    { date: '2027-02-06', name: '설날' },
    { date: '2027-02-07', name: '설날' },
    { date: '2027-02-08', name: '설날' },
    { date: '2027-02-09', name: '대체공휴일(설날)' },
    { date: '2027-03-01', name: '삼일절' },
    { date: '2027-05-01', name: '노동절' },
    { date: '2027-05-03', name: '대체공휴일(노동절)' },
    { date: '2027-05-05', name: '어린이날' },
    { date: '2027-05-13', name: '부처님오신날' },
    { date: '2027-06-06', name: '현충일' },
    { date: '2027-07-17', name: '제헌절' },
    { date: '2027-07-19', name: '대체공휴일(제헌절)' },
    { date: '2027-08-15', name: '광복절' },
    { date: '2027-08-16', name: '대체공휴일(광복절)' },
    { date: '2027-09-14', name: '추석' },
    { date: '2027-09-15', name: '추석' },
    { date: '2027-09-16', name: '추석' },
    { date: '2027-10-03', name: '개천절' },
    { date: '2027-10-04', name: '대체공휴일(개천절)' },
    { date: '2027-10-09', name: '한글날' },
    { date: '2027-10-11', name: '대체공휴일(한글날)' },
    { date: '2027-12-25', name: '기독탄신일' },
    { date: '2027-12-27', name: '대체공휴일(기독탄신일)' },
  ],
};

/** 요일 하루의 운전 — 운전하는 날인지 · 켜는 시각 · 끄는 시각(HH:MM) */
export interface WeekDayRun {
  on: boolean;
  from: string;
  to: string;
}
/**
 * 운전 규칙.
 *  - 관리 › 에너지 설정 = 기본값(주말 OFF · 공휴일 OFF · 매일 ON / OFF 시각)
 *  - 설정 › 설정(발전사업자) = 요일별 운전(week) · 공휴일 OFF · 날짜별 지정 — 고치기 전엔 기본값으로 만든 요일표(2026-10-15)
 */
export interface OpRule {
  weekendOff: boolean;
  holidayOff: boolean;
  /** 매일 고정 OFF 시각 · ON 시각(HH:MM) — 요일표가 없을 때의 기본 운전 시간(ON ~ OFF) */
  offStart?: string;
  onTime?: string;
  /** 요일별 운전 — 0 일 ~ 6 토. 있으면 weekendOff · onTime · offStart 대신 이것 */
  week?: WeekDayRun[];
}
/** 요일표 — 없으면 기본값(주말 OFF · 매일 ON ~ OFF)으로 만든다 */
export function weekOf(rule: OpRule): WeekDayRun[] {
  if (rule.week && rule.week.length === 7) return rule.week;
  return Array.from({ length: 7 }, (_, wd) => ({
    on: !((wd === 0 || wd === 6) && rule.weekendOff),
    from: rule.onTime || '00:00',
    to: rule.offStart || '24:00',
  }));
}
/** 요일 이름 — 0 일 ~ 6 토 */
export const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'] as const;
/** 월요일부터 — 화면 순서 */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
/** 요일표 한 줄 — 같은 날끼리 묶어서 '월~금 10:00~17:00 · 토~일 OFF' */
export function weekText(week: WeekDayRun[]) {
  const key = (r: WeekDayRun) => (r.on ? `${r.from}~${r.to}` : 'OFF');
  const parts: string[] = [];
  let i = 0;
  while (i < WEEK_ORDER.length) {
    const k = key(week[WEEK_ORDER[i]!]!);
    let j = i;
    while (j + 1 < WEEK_ORDER.length && key(week[WEEK_ORDER[j + 1]!]!) === k) j++;
    const a = WEEKDAY[WEEK_ORDER[i]!];
    const b = WEEKDAY[WEEK_ORDER[j]!];
    parts.push(`${i === j ? a : j === i + 1 ? `${a}·${b}` : `${a}~${b}`} ${k}`);
    i = j + 1;
  }
  return parts.join(' · ');
}
export const OP_RULE_DEFAULT: OpRule = { weekendOff: true, holidayOff: true, offStart: '17:00', onTime: '10:00' };
/** 에너지 설정 값('1' / '0' · HH:MM)에서 규칙으로 */
export const opRuleOf = (es: Record<string, string> | undefined): OpRule => ({
  weekendOff: (es?.PPA_WEEKEND_OFF ?? '1') !== '0',
  holidayOff: (es?.PPA_HOLIDAY_OFF ?? '1') !== '0',
  offStart: es?.PPA_OFF_START ?? OP_RULE_DEFAULT.offStart,
  onTime: es?.PPA_ON_TIME ?? OP_RULE_DEFAULT.onTime,
});
/** 시각(HH:MM)이 시간대 안인지 — 18:00~06:00 처럼 자정을 넘는 구간도 */
export function inWindow(w: { from: string; to: string }, hhmm: string) {
  if (!w.from || !w.to || w.from === w.to) return false;
  return w.from < w.to ? hhmm >= w.from && hhmm < w.to : hhmm >= w.from || hhmm < w.to;
}
/** 지금 시각(HH:MM)이 고정 OFF 시간대 안인지 */
export function inOffWindow(rule: OpRule, hhmm: string) {
  return !!rule.offStart && !!rule.onTime && inWindow({ from: rule.offStart, to: rule.onTime }, hhmm);
}

/** 날짜별 수동 지정 — 요일 설정 위에 겹쳐 쓴다. 'OFF' 그날 OFF · 'HH:MM~HH:MM' 그날 운전 시간(쉬는 날이어도 운전) · 'ON' 그날 요일 시간대로 운전 */
export type DayOverride = 'ON' | 'OFF' | `${string}~${string}`;
/** 그날 운전 시간 지정이면 시작 · 끝 */
export function runOfOverride(ov?: DayOverride): { from: string; to: string } | undefined {
  if (!ov || ov === 'ON' || ov === 'OFF') return undefined;
  const [from, to] = ov.split('~');
  return from && to ? { from, to } : undefined;
}

export type DayReason = '가동' | '주말' | '요일 OFF' | '공휴일' | '수동 OFF' | '수동 ON' | '수동 시간';
export interface DayStatus {
  date: string;
  on: boolean;
  reason: DayReason;
  holiday?: string;
  weekend: boolean;
  /** 그날 운전 시간(켜는 시각 ~ 끄는 시각). 운전하는 날만 */
  run?: { from: string; to: string };
}

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
export const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1~12
export const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 일 ~ 6 토

/** 하루 — 날짜 지정 → 요일 설정(운전 안 하는 요일) → 공휴일 → 요일 운전 시간 순 */
export function dayStatus(date: string, holidays: Map<string, string>, rule: OpRule, overrides?: Record<string, DayOverride>): DayStatus {
  const wd = weekdayOf(date);
  const weekend = wd === 0 || wd === 6;
  const holiday = holidays.get(date);
  const day = weekOf(rule)[wd]!;
  const ov = overrides?.[date];
  if (ov === 'OFF') return { date, on: false, reason: '수동 OFF', holiday, weekend };
  if (ov === 'ON') return { date, on: true, reason: '수동 ON', holiday, weekend, run: { from: day.from, to: day.to } };
  const run = runOfOverride(ov);
  if (run) return { date, on: true, reason: '수동 시간', holiday, weekend, run };
  if (!day.on) return { date, on: false, reason: weekend ? '주말' : '요일 OFF', holiday, weekend };
  if (holiday && rule.holidayOff) return { date, on: false, reason: '공휴일', holiday, weekend };
  return { date, on: true, reason: '가동', holiday, weekend, run: { from: day.from, to: day.to } };
}

/**
 * 그날 그 시각(HH:MM)에 인버터가 꺼져 있는지 — 대시보드 상태 · 그래프 · 발전소 상세가 같은 답을 쓴다
 *  - 운전 안 하는 날(요일 · 공휴일 · 그날 OFF) → 종일 OFF
 *  - 운전하는 날 → 그날 운전 시간(요일 시간 또는 그날 지정 시간) 밖이면 OFF
 */
export function offAt(d: DayStatus, hhmm: string) {
  if (!d.on) return true;
  if (!d.run) return false;
  return !inWindow(d.run, hhmm);
}
/** 수동으로 정한 날인지(그날 OFF · 그날 운전 시간 · 그날 운전) */
export const isManual = (d: DayStatus) => d.reason === '수동 OFF' || d.reason === '수동 ON' || d.reason === '수동 시간';

export const holidayMap = (hs: Holiday[] | undefined) => new Map((hs ?? []).map((h) => [h.date, h.name]));

/** 달 하나의 날짜별 상태 */
export function monthStatus(y: number, m: number, holidays: Map<string, string>, rule: OpRule, overrides?: Record<string, DayOverride>) {
  return Array.from({ length: daysIn(y, m) }, (_, k) => dayStatus(ymd(y, m, k + 1), holidays, rule, overrides));
}

export interface OpMonth {
  m: number;
  days: number;
  weekend: number; // 주말로 OFF
  weekdayOff: number; // 운전 안 하는 평일 요일로 OFF
  holiday: number; // 공휴일로 OFF
  manualOff: number;
  manualOn: number;
  manualTime: number; // 그날 운전 시간 지정(가동일로 센다)
  op: number; // 가동일
}
/** 해 하나 — 달마다 가동일 · OFF 사유별 일수 */
export function opYear(y: number, holidays: Map<string, string>, rule: OpRule, overrides?: Record<string, DayOverride>) {
  const months: OpMonth[] = Array.from({ length: 12 }, (_, k) => {
    const ds = monthStatus(y, k + 1, holidays, rule, overrides);
    const n = (r: DayReason) => ds.filter((d) => d.reason === r).length;
    return { m: k + 1, days: ds.length, weekend: n('주말'), weekdayOff: n('요일 OFF'), holiday: n('공휴일'), manualOff: n('수동 OFF'), manualOn: n('수동 ON'), manualTime: n('수동 시간'), op: ds.filter((d) => d.on).length };
  });
  const sum = (k: keyof OpMonth) => months.reduce((a, x) => a + x[k], 0);
  return { year: y, months, days: sum('days'), weekend: sum('weekend'), weekdayOff: sum('weekdayOff'), holiday: sum('holiday'), op: sum('op') };
}
/** 달마다 가동 비율(가동일 ÷ 그 달 일수) — 무료진단 PPA 발전량에 곱한다 */
export const opRatios = (yr: ReturnType<typeof opYear>) => yr.months.map((x) => x.op / x.days);
