/**
 * 탄소배출권 KRX 거래 — 시세 데모 데이터(연동 없음).
 *
 * KRX 배출권시장 정보플랫폼 › 시세정보 › 시세조회(https://ets.krx.co.kr/contents/ETS/03/03010000/ETS03010000.jsp, 확인 2026-11-09 13:46)와 같은 구성:
 *   종목선택(전체 / 종목) · 조회기간(1일 · 1개월 · 6개월 · 1년) · 조회
 *   현재가 표: 종목명 · 현재가 · 대비 · 등락률(%) · 시가 · 고가 · 저가 · 거래량(톤) · 거래대금(원)
 *   경매 정보: 경매일별 · 종목별 · 입찰수량 · 응찰수량 · 응찰비율 · 응찰자수 · 낙찰자수 · 최고응찰가격 · 최저응찰가격 · 낙찰수량 · 낙찰가격
 *   일자별 정보: 일자 · 종목명 · 종가 · 대비 · 등락률 · 시가 · 고가 · 저가 · 거래량 · 거래대금 · 가중평균
 * KRX 시세는 사전 동의 없이 복제 · 배포할 수 없어(docs/카본마켓-조사.md ③) 실시간으로 받아 오지 않는다.
 * 그 날 화면에서 본 값(KAU26 2026-09-21~11-09 일자별, 다른 종목 현재가, 경매 2건)은 그대로 두고, 그 앞은 거래일마다 만든다.
 * 매매시간: 호가접수 09:00~12:00, 10:00 시가 단일가, 10:00~11:30 복수가격, 12:00 종가 단일가. 휴장: 주말 · 공휴일 · 근로자의 날 · 12-31.
 * 장중 체결은 공개되지 않는다(회원사 단말에만) — 현재가 표도 그날 일자별 값 한 줄, 시각 따라 움직이지 않는다(2026-11-09).
 * 가격제한폭 ±10%(기준가 = 전일 종가), 호가 단위 50원.
 */

import { HOLIDAYS_SEED, weekdayOf } from '@/lib/op-calendar';

/* ── 종목(KRX 종목선택 순서) ── */
export interface KrxItem {
  code: string;
  /** KAU26 종가 대비 가격 비율(거래가 있는 날) */
  ratio: number;
  /** 마지막으로 본 거래일 앞에서 거래가 있는 날의 비율(0~1) */
  tradeRate: number;
  /** 거래가 있는 날 거래량 배율(KAU26 = 1) */
  volScale: number;
}
export const KRX_ITEMS: KrxItem[] = [
  { code: 'KAU26', ratio: 1, tradeRate: 1, volScale: 1 },
  { code: 'KAU27', ratio: 1.0, tradeRate: 0.3, volScale: 0.04 },
  { code: 'KAU28', ratio: 1.0, tradeRate: 0.18, volScale: 0.02 },
  { code: 'KAU29', ratio: 1.0, tradeRate: 0.15, volScale: 0.01 },
  { code: 'KAU30', ratio: 1.0, tradeRate: 0.15, volScale: 0.01 },
  { code: 'KCU26', ratio: 1.015, tradeRate: 0.2, volScale: 0.03 },
  { code: 'KOC21-26', ratio: 0.95, tradeRate: 0.15, volScale: 0.03 },
  { code: 'KOC22-27', ratio: 0.995, tradeRate: 0.15, volScale: 0.05 },
  { code: 'KOC23-28', ratio: 1.015, tradeRate: 0.15, volScale: 0.03 },
  { code: 'KOC24-29', ratio: 1.015, tradeRate: 0.15, volScale: 0.03 },
  { code: 'KOC25-30', ratio: 1.015, tradeRate: 0.15, volScale: 0.03 },
  { code: 'KOC26-31', ratio: 1.015, tradeRate: 0.15, volScale: 0.03 },
  { code: 'i-KCU26', ratio: 1.015, tradeRate: 0.12, volScale: 0.01 },
  { code: 'i-KOC21-26', ratio: 1.015, tradeRate: 0.12, volScale: 0.01 },
  { code: 'i-KOC22-27', ratio: 1.015, tradeRate: 0.12, volScale: 0.01 },
  { code: 'i-KOC23-28', ratio: 1.03, tradeRate: 0.12, volScale: 0.01 },
  { code: 'i-KOC24-29', ratio: 1.015, tradeRate: 0.12, volScale: 0.01 },
  { code: 'i-KOC25-30', ratio: 1.015, tradeRate: 0.12, volScale: 0.01 },
  { code: 'i-KOC26-31', ratio: 1.015, tradeRate: 0.12, volScale: 0.01 },
];

/* ── 매매시간 ── */
export const MARKET = { orderStart: '09:00', open: '10:00', continuousEnd: '11:30', close: '12:00' } as const;
export const TICK = 50;
export const LIMIT_RATE = 0.1;

/* ── 날짜 ── */
const pad = (n: number) => String(n).padStart(2, '0');
export const ymdOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const HOLIDAY_SET = new Set(Object.values(HOLIDAYS_SEED).flat().map((h) => h.date));

/** 거래일 — 월~금, 공휴일 · 근로자의 날(05-01) · 12-31 휴장 */
export function isTradingDay(date: string) {
  const wd = weekdayOf(date);
  if (wd === 0 || wd === 6) return false;
  if (HOLIDAY_SET.has(date)) return false;
  const md = date.slice(5);
  return md !== '05-01' && md !== '12-31';
}
export const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const addMonths = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};
/** date 이거나 그 전의 마지막 거래일 */
export function lastTradingDay(date: string) {
  let d = date;
  while (!isTradingDay(d)) d = addDays(d, -1);
  return d;
}

/* ── 난수(같은 종목 · 날짜면 늘 같은 값) ── */
function seeded(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
const round50 = (v: number) => Math.round(v / TICK) * TICK;

/* ── KAU26 추세 기준점(언론 보도 가격대: 2026-03 15,000원 돌파, 1년 새 3배, 9월 가중평균 29,974원) ── */
const ANCHORS: [string, number][] = [
  ['2025-10-01', 9700],
  ['2025-11-28', 10400],
  ['2025-12-30', 10900],
  ['2026-01-30', 11800],
  ['2026-02-27', 13200],
  ['2026-03-13', 15100],
  ['2026-03-31', 16300],
  ['2026-04-30', 19500],
  ['2026-05-29', 23500],
  ['2026-06-30', 26500],
  ['2026-07-31', 28200],
  ['2026-08-31', 28600],
  ['2026-09-18', 30550],
  ['2026-09-21', 30450],
  ['2026-11-09', 29500],
  ['2027-06-30', 29800],
];
const dayNum = (date: string) => Math.round(new Date(`${date}T00:00:00Z`).getTime() / 86400000);
function trendOf(date: string) {
  const n = dayNum(date);
  for (let i = 1; i < ANCHORS.length; i++) {
    const [d0, p0] = ANCHORS[i - 1]!;
    const [d1, p1] = ANCHORS[i]!;
    const n0 = dayNum(d0);
    const n1 = dayNum(d1);
    if (n <= n1) return n <= n0 ? p0 : p0 + ((p1 - p0) * (n - n0)) / (n1 - n0);
  }
  return ANCHORS[ANCHORS.length - 1]![1];
}

/* ── 일별 시세 ── */
export interface DailyQuote {
  date: string;
  code: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** 전일 종가(기준가) */
  prev: number;
  /** 거래량(톤) */
  vol: number;
  /** 거래대금(원) */
  amount: number;
  /** 가중평균(원) — 거래 없으면 0 */
  vwap: number;
}

type Pin = { close: number; open?: number; high?: number; low?: number; vol: number; amount?: number; vwap?: number };
/** KRX 화면에서 본 값 — [일자, 종가, 시가, 고가, 저가, 거래량, 거래대금, 가중평균] */
const KAU26_SEEN: [string, number, number, number, number, number, number, number][] = [
  ['2026-09-21', 30450, 30450, 30500, 30450, 54276, 1654383000, 30481],
  ['2026-09-22', 30200, 30400, 30400, 29900, 268200, 8066935000, 30078],
  ['2026-09-23', 30150, 30200, 30200, 30050, 150000, 4519960000, 30133],
  ['2026-09-28', 29900, 30000, 30000, 29400, 333600, 9903770000, 29688],
  ['2026-09-29', 30050, 29900, 30050, 29800, 109502, 3279160100, 29946],
  ['2026-09-30', 30000, 29900, 30000, 29500, 333987, 9920254500, 29703],
  ['2026-10-01', 29600, 29900, 29900, 29500, 116750, 3462570000, 29658],
  ['2026-10-02', 29600, 29500, 29650, 29500, 86901, 2566964600, 29539],
  ['2026-10-06', 29650, 29550, 29650, 29550, 40001, 1183629650, 29590],
  ['2026-10-07', 29550, 29550, 29600, 29400, 222002, 6545244100, 29483],
  ['2026-10-08', 30450, 29550, 30450, 29550, 206777, 6164980250, 29815],
  ['2026-10-12', 30350, 30400, 30400, 30300, 89491, 2717954450, 30371],
  ['2026-10-13', 30350, 30400, 30400, 30300, 49662, 1507196700, 30349],
  ['2026-10-14', 30350, 30300, 30400, 30300, 62000, 1880450000, 30330],
  ['2026-10-15', 30200, 30300, 30300, 29600, 124351, 3712226700, 29853],
  ['2026-10-16', 29950, 29900, 29950, 29900, 53101, 1587719950, 29900],
  ['2026-10-19', 30150, 30000, 30200, 30000, 58801, 1771030150, 30119],
  ['2026-10-20', 30100, 30150, 30200, 30050, 98700, 2974170000, 30133],
  ['2026-10-21', 30150, 30100, 30150, 30050, 29701, 894035150, 30101],
  ['2026-10-22', 30250, 30100, 30250, 30000, 153337, 4621674250, 30141],
  ['2026-10-23', 29800, 30100, 30100, 29400, 254200, 7566770000, 29767],
  ['2026-10-26', 29950, 29900, 29950, 29800, 50000, 1495200000, 29904],
  ['2026-10-27', 30250, 30000, 30250, 30000, 98200, 2959545000, 30138],
  ['2026-10-28', 30250, 30200, 30250, 30150, 70100, 2116020000, 30186],
  ['2026-10-29', 30250, 30200, 30300, 30200, 35000, 1058925000, 30255],
  ['2026-10-30', 30250, 30200, 30250, 30150, 90500, 2733415000, 30203],
  ['2026-11-02', 30000, 30250, 30250, 29950, 78950, 2371712500, 30041],
  ['2026-11-03', 30000, 29950, 30000, 29850, 83500, 2497053700, 29905],
  ['2026-11-04', 29650, 29900, 29900, 29500, 167800, 4982255000, 29692],
  ['2026-11-05', 29500, 29650, 29650, 29300, 311700, 9177630000, 29444],
  ['2026-11-06', 29600, 29500, 29750, 29400, 237200, 7010470000, 29555],
  ['2026-11-09', 29500, 29600, 29600, 29400, 166000, 4894600000, 29486],
];
const PINS: Record<string, Record<string, Pin>> = {
  KAU26: Object.fromEntries(KAU26_SEEN.map(([d, close, open, high, low, vol, amount, vwap]) => [d, { close, open, high, low, vol, amount, vwap }])),
  // 다른 종목 — 2026-11-09 KRX 현재가와 맞도록 마지막 거래(그 뒤로는 거래 없음, 가격 유지)
  KAU27: { '2026-10-23': { close: 29450, vol: 5000 } },
  KAU28: { '2026-10-15': { close: 29450, vol: 2000 } },
  KAU29: { '2026-10-08': { close: 29450, vol: 1000 } },
  KAU30: { '2026-10-08': { close: 29450, vol: 1000 } },
  KCU26: { '2026-10-21': { close: 30450, vol: 3000 } },
  'KOC21-26': { '2026-09-29': { close: 28200, vol: 2500 } },
  'KOC22-27': { '2026-10-27': { close: 30000, vol: 5000 }, '2026-11-09': { close: 29500, open: 29500, high: 29500, low: 29500, vol: 10000, amount: 295000000, vwap: 29500 } },
  'KOC23-28': { '2026-09-21': { close: 30450, vol: 1000 } },
  'KOC24-29': { '2026-09-21': { close: 30450, vol: 1000 } },
  'KOC25-30': { '2026-09-21': { close: 30450, vol: 1000 } },
  'KOC26-31': { '2026-09-21': { close: 30450, vol: 1000 } },
  'i-KCU26': { '2026-09-21': { close: 30450, vol: 1000 } },
  'i-KOC21-26': { '2026-09-21': { close: 30450, vol: 1000 } },
  'i-KOC22-27': { '2026-09-21': { close: 30450, vol: 1000 } },
  'i-KOC23-28': { '2026-10-12': { close: 31000, vol: 1000 } },
  'i-KOC24-29': { '2026-09-21': { close: 30450, vol: 1000 } },
  'i-KOC25-30': { '2026-09-21': { close: 30450, vol: 1000 } },
  'i-KOC26-31': { '2026-09-21': { close: 30450, vol: 1000 } },
};
const lastPinDate = (code: string) => Object.keys(PINS[code] ?? {}).sort().pop() ?? '';

/** 시세 시작일 — 이 날부터 거래일마다 값이 있다 */
export const SERIES_START = '2025-11-03';

const dailyCache = new Map<string, DailyQuote[]>();
/** 종목의 일별 시세 — SERIES_START 부터 to(포함)까지 거래일만, 오래된 날부터 */
export function dailySeries(code: string, to: string): DailyQuote[] {
  const key = `${code}|${to}`;
  const hit = dailyCache.get(key);
  if (hit) return hit;
  const item = KRX_ITEMS.find((x) => x.code === code) ?? KRX_ITEMS[0]!;
  const pins = PINS[code] ?? {};
  const lastPin = lastPinDate(code);
  const r = seeded(`daily:${code}`);
  const out: DailyQuote[] = [];
  let e = 0;
  let prevClose = round50(trendOf(addDays(SERIES_START, -1)) * item.ratio);
  for (let d = SERIES_START; d <= to; d = addDays(d, 1)) {
    if (!isTradingDay(d)) continue;
    e = 0.7 * e + 0.006 * gauss(r);
    const pin = pins[d];
    const own = item.code === 'KAU26' ? 0 : 0.003 * gauss(r);
    const base = trendOf(d) * (1 + e) * item.ratio * (1 + own);
    // KAU26 은 늘 거래, 다른 종목은 마지막 본 거래일 앞에서만 드물게
    const traded = pin ? true : item.code === 'KAU26' ? true : d < lastPin && r() < item.tradeRate;
    if (!traded) {
      out.push({ date: d, code, open: 0, high: 0, low: 0, close: prevClose, prev: prevClose, vol: 0, amount: 0, vwap: 0 });
      continue;
    }
    // 화면에서 본 값은 그대로, 만든 값만 가격제한폭 안으로
    const close = pin ? pin.close : Math.min(round50(prevClose * (1 + LIMIT_RATE)), Math.max(round50(prevClose * (1 - LIMIT_RATE)), round50(base)));
    const vol = pin ? pin.vol : Math.max(100, Math.round(Math.exp(Math.log(120000) + 0.6 * gauss(r)) * item.volScale));
    const open = pin?.open ?? (pin ? close : round50(prevClose * (1 + 0.004 * gauss(r))));
    const spread = Math.abs(0.006 * gauss(r)) + 0.002;
    const high = pin?.high ?? (pin ? Math.max(open, close) : round50(Math.max(open, close) * (1 + spread)));
    const low = pin?.low ?? (pin ? Math.min(open, close) : round50(Math.min(open, close) * (1 - spread)));
    const amount = pin?.amount ?? Math.round(((open + high + low + close) / 4) * vol);
    const vwap = pin?.vwap ?? Math.round(amount / vol);
    out.push({ date: d, code, open, high, low, close, prev: prevClose, vol, amount, vwap });
    prevClose = close;
  }
  dailyCache.set(key, out);
  return out;
}

/* 매매 시간 — 10:00 시가 단일가 → 11:30 까지 복수가격 → 12:00 종가 단일가. 10:00 부터 초 */
const CONT_SECS = 90 * 60;
const CLOSE_SEC = 120 * 60;

/* ── 지금 장 상태 ── */
export type MarketPhase = '장전' | '장중' | '종가 단일가' | '장마감' | '휴장';
export interface MarketNow {
  /** 시세 기준 거래일(휴장이면 마지막 거래일) */
  date: string;
  phase: MarketPhase;
  /** 10:00 부터 초 */
  sec: number;
}
export function marketNow(now: Date): MarketNow {
  const today = ymdOf(now);
  if (!isTradingDay(today)) return { date: lastTradingDay(today), phase: '휴장', sec: CLOSE_SEC };
  const sec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() - 10 * 3600;
  if (sec < 0) return { date: today, phase: '장전', sec: -1 };
  if (sec < CONT_SECS) return { date: today, phase: '장중', sec };
  if (sec < CLOSE_SEC) return { date: today, phase: '종가 단일가', sec };
  return { date: today, phase: '장마감', sec: CLOSE_SEC };
}

/** 현재가 표 한 줄 — KRX 현재가 표와 같은 칸(거래 없는 날은 시가 · 고가 · 저가 · 거래량 · 거래대금 0) */
export interface BoardRow {
  code: string;
  price: number;
  prev: number;
  change: number;
  rate: number;
  open: number;
  high: number;
  low: number;
  vol: number;
  amount: number;
}

/** 현재가 표 한 줄 — KRX 가 공개하는 건 하루 값뿐(체결 시각 없음)이라 그날 일자별 값 그대로. 거래 없는 날은 전일 종가 유지, 나머지 0 (2026-11-09) */
export function boardRow(item: KrxItem, date: string): BoardRow {
  const series = dailySeries(item.code, date);
  const day = series[series.length - 1]!;
  const prev = day.prev;
  const rate = prev ? ((day.close - prev) / prev) * 100 : 0;
  return { code: item.code, prev, price: day.close, change: day.close - prev, rate, open: day.open, high: day.high, low: day.low, vol: day.vol, amount: day.amount };
}

/* ── 경매 정보(KRX 화면 값 그대로) ── */
export interface Auction {
  date: string;
  code: string;
  /** 입찰수량(톤) */
  offered: number;
  /** 응찰수량(톤) */
  bid: number;
  /** 응찰비율(%) */
  ratio: number;
  bidders: number;
  winners: number;
  maxBid: number;
  minBid: number;
  /** 낙찰수량(톤) */
  awarded: number;
  /** 낙찰가격(원) */
  price: number;
}
export const AUCTIONS: Auction[] = [
  { date: '2026-10-14', code: 'KAU26', offered: 2830000, bid: 3212100, ratio: 114.0, bidders: 23, winners: 17, maxBid: 34900, minBid: 27500, awarded: 2645400, price: 29300 },
  { date: '2026-09-09', code: 'KAU26', offered: 2830000, bid: 2797500, ratio: 99.0, bidders: 17, winners: 17, maxBid: 35950, minBid: 29500, awarded: 2797500, price: 29500 },
];

export const fmtWon = (v: number) => v.toLocaleString('ko-KR');
export const fmtRate = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
