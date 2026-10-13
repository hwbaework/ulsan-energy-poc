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

/** 쉬는 날 OFF 규칙 — 관리 › 에너지 설정 */
export interface OpRule {
  weekendOff: boolean;
  holidayOff: boolean;
  /** 매일 고정 OFF 시각 · ON 시각(HH:MM). 둘 다 있으면 그 시간엔 설정으로 꺼진다(2026-10-13 — 날짜가 아니라 시간으로) */
  offStart?: string;
  onTime?: string;
}
export const OP_RULE_DEFAULT: OpRule = { weekendOff: true, holidayOff: true, offStart: '18:00', onTime: '06:00' };
/** 에너지 설정 값('1' / '0' · HH:MM)에서 규칙으로 */
export const opRuleOf = (es: Record<string, string> | undefined): OpRule => ({
  weekendOff: (es?.PPA_WEEKEND_OFF ?? '1') !== '0',
  holidayOff: (es?.PPA_HOLIDAY_OFF ?? '1') !== '0',
  offStart: es?.PPA_OFF_START ?? OP_RULE_DEFAULT.offStart,
  onTime: es?.PPA_ON_TIME ?? OP_RULE_DEFAULT.onTime,
});
/** 지금 시각(HH:MM)이 고정 OFF 시간대 안인지 — 18:00~06:00 처럼 자정을 넘는 구간도 */
export function inOffWindow(rule: OpRule, hhmm: string) {
  if (!rule.offStart || !rule.onTime || rule.offStart === rule.onTime) return false;
  return rule.offStart < rule.onTime ? hhmm >= rule.offStart && hhmm < rule.onTime : hhmm >= rule.offStart || hhmm < rule.onTime;
}

/** 날짜별 수동 지정 — 자동 일정 위에 겹쳐 쓴다 */
export type DayOverride = 'ON' | 'OFF';

export type DayReason = '가동' | '주말' | '공휴일' | '수동 OFF' | '수동 ON';
export interface DayStatus {
  date: string;
  on: boolean;
  reason: DayReason;
  holiday?: string;
  weekend: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
export const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1~12
export const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 일 ~ 6 토

/** 하루 — 수동 지정 → 주말 → 공휴일 → 가동 순 */
export function dayStatus(date: string, holidays: Map<string, string>, rule: OpRule, overrides?: Record<string, DayOverride>): DayStatus {
  const wd = weekdayOf(date);
  const weekend = wd === 0 || wd === 6;
  const holiday = holidays.get(date);
  const ov = overrides?.[date];
  if (ov === 'OFF') return { date, on: false, reason: '수동 OFF', holiday, weekend };
  if (ov === 'ON') return { date, on: true, reason: '수동 ON', holiday, weekend };
  // 주말과 겹친 공휴일은 주말로 센다(평일 공휴일만 '공휴일')
  if (weekend && rule.weekendOff) return { date, on: false, reason: '주말', holiday, weekend };
  if (holiday && rule.holidayOff) return { date, on: false, reason: '공휴일', holiday, weekend };
  return { date, on: true, reason: '가동', holiday, weekend };
}

export const holidayMap = (hs: Holiday[] | undefined) => new Map((hs ?? []).map((h) => [h.date, h.name]));

/** 달 하나의 날짜별 상태 */
export function monthStatus(y: number, m: number, holidays: Map<string, string>, rule: OpRule, overrides?: Record<string, DayOverride>) {
  return Array.from({ length: daysIn(y, m) }, (_, k) => dayStatus(ymd(y, m, k + 1), holidays, rule, overrides));
}

export interface OpMonth {
  m: number;
  days: number;
  weekend: number; // 주말로 OFF
  holiday: number; // 평일 공휴일로 OFF
  manualOff: number;
  manualOn: number;
  op: number; // 가동일
}
/** 해 하나 — 달마다 가동일 · OFF 사유별 일수 */
export function opYear(y: number, holidays: Map<string, string>, rule: OpRule, overrides?: Record<string, DayOverride>) {
  const months: OpMonth[] = Array.from({ length: 12 }, (_, k) => {
    const ds = monthStatus(y, k + 1, holidays, rule, overrides);
    const n = (r: DayReason) => ds.filter((d) => d.reason === r).length;
    return { m: k + 1, days: ds.length, weekend: n('주말'), holiday: n('공휴일'), manualOff: n('수동 OFF'), manualOn: n('수동 ON'), op: ds.filter((d) => d.on).length };
  });
  const sum = (k: keyof OpMonth) => months.reduce((a, x) => a + x[k], 0);
  return { year: y, months, days: sum('days'), weekend: sum('weekend'), holiday: sum('holiday'), op: sum('op') };
}
/** 달마다 가동 비율(가동일 ÷ 그 달 일수) — 무료진단 PPA 발전량에 곱한다 */
export const opRatios = (yr: ReturnType<typeof opYear>) => yr.months.map((x) => x.op / x.days);
