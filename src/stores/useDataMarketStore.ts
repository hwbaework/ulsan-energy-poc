/**
 * 데이터 마켓플레이스(WBS 3.3) POC 스토어 — 내 정보를 판다.
 * 기업이 판매에 동의하면 그 기업의 데이터가 바로 상품으로 공개된다(등록 · 승인 없음). 동의 = 등록.
 * 상품은 기업별 태양광 발전량 하나 — 계산한 값(배출량 · 탄소 감축 · 소나무 등)이 아니라 발전 정보 그대로.
 * 탄소 · 온실가스 · 소나무 환산은 사는 쪽이 각자 계산식으로 한다.
 * 제공은 모두 API(토큰) + CSV 다운로드. 가격은 모두 월 1,000원.
 * 브라우저 localStorage 에 저장(데모). 시드가 바뀌면 SEED_VERSION 을 올린다.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ssrSafeStorage } from '@/lib/ssr-storage';
import { HOLIDAYS_SEED, OP_RULE_DEFAULT, dayStatus, offAt, weekdayOf, WEEKDAY, type DayStatus } from '@/lib/op-calendar';

export const DM_SEED_VERSION = 16; // 16 — 판매 중지 · 이용 취소는 금월 말일까지(태성산업 판매 중지 예약, 한길 이용 취소 예약). 15 — 한일튜브 자가소비 · PPA 데이터 따로(설비 · 인버터가 따로), PPA 는 운전 칸

export const DATA_KINDS = ['태양광 발전량'] as const;
export type DataKind = (typeof DATA_KINDS)[number];
/** 가격 방식 — 월 이용료 / 1회 구매 */
export type PriceType = 'MONTHLY' | 'ONCE';
export const PRICE_TYPE_LABEL: Record<PriceType, string> = {
  MONTHLY: '월 이용료',
  ONCE: '1회 구매',
};
export const DM_PRICE = 1_000;
/** 플랫폼 수수료율 — 이용 기업에게 받은 금액에서 떼고 판매 기업에게 넘긴다. 아직 정하지 않아 0 */
export const DM_FEE_RATE = 0;

/** 지금 날짜(데모 기준) · 금월 · 마지막으로 끝난 달 */
export const DM_TODAY = '2026-10-02';
export const THIS_MONTH = DM_TODAY.slice(0, 7);
const LAST_MONTH = '2026-09';
const PERIOD_FROM = '2025-03';
/* ── 판매 데이터 단위 — 설비(계약) 하나 = 데이터 하나. 설비 · 인버터가 따로라 한일튜브는 자가소비 · PPA 둘(2026-10-15).
 *  id = 데이터 단위 id(기업 id 와 같거나, 한일튜브 PPA 는 8), companyId = 판매 기업 ── */
export interface SellerCompany {
  id: number;
  /** 판매 기업 — 없으면 id 와 같다 */
  companyId?: number;
  name: string;
  /** 계약 유형 — 한 기업에 설비가 둘일 때만(자가소비 / PPA) */
  unit?: '자가소비' | 'PPA';
  /** 태양광 설비 용량(kW) — 그 설비 하나 */
  solarKw: number;
  /** 데이터 시작 달 = 전력거래 계약 시작 달(PERIOD_FROM 보다 늦을 때만). 온실가스 배출원과 같은 범위 */
  from?: string;
}
export const DM_SELLERS: SellerCompany[] = [
  { id: 2, name: '한길', solarKw: 90.88, from: '2025-05' }, // 계약 CT-2025-0003 시작 2025-05-01
  { id: 4, companyId: 4, name: '한일튜브', unit: '자가소비', solarKw: 99.84 },
  { id: 8, companyId: 4, name: '한일튜브', unit: 'PPA', solarKw: 329.6 },
  { id: 5, name: '용인금속', solarKw: 152.32 },
  { id: 6, name: '태성산업', solarKw: 46.08 },
  { id: 7, name: '건호이엔씨', solarKw: 33.92 },
];
/** 판매 기업 id */
export const companyOfSeller = (c: SellerCompany) => c.companyId ?? c.id;
/** PPA 운전 — 기본 규칙(주말 · 공휴일 OFF, 매일 10:00 ~ 17:00 운전)으로 시간마다 꺼졌는지. PPA 설비만 */
const HOLIDAYS = new Map(Object.values(HOLIDAYS_SEED).flat().map((h) => [h.date, h.name]));
const ppaDay = (date: string): DayStatus => dayStatus(date, HOLIDAYS, OP_RULE_DEFAULT);
/** 운전 칸 글자 — ON / OFF(사유) */
export function runText(date: string, hour?: number): string {
  const d = ppaDay(date);
  if (!d.on) return `OFF · ${d.reason === '요일 OFF' ? `${WEEKDAY[weekdayOf(date)]}요일` : d.reason}`;
  if (hour === undefined) return d.run ? `ON ${d.run.from}~${d.run.to}` : 'ON';
  return offAt(d, `${String(hour).padStart(2, '0')}:00`) ? 'OFF · 설정' : 'ON';
}

/** 판매 동의 — 데이터 단위(설비) × 종류. 있으면 공개 중 */
export interface Consent {
  /** 데이터 단위 id(DM_SELLERS.id) */
  sellerId: number;
  kind: DataKind;
  consentedAt: string;
  /** 판매 중지 예약 — 그 달 말일. 이날까지 판매, 다음 날 목록에서 내려간다 */
  endsAt?: string;
}

/** 상품 — 동의에서 만들어진다(따로 저장하지 않는다) */
export interface Dataset {
  id: number;
  name: string;
  kind: DataKind;
  periodFrom: string;
  periodTo: string;
  description: string;
  /** 데이터 단위(설비) — DM_SELLERS.id */
  sellerId: number;
  /** 계약 유형 — 한 기업에 설비가 둘일 때만 */
  unit?: '자가소비' | 'PPA';
  ownerCompanyId: number;
  ownerCompanyName: string;
  priceType: PriceType;
  price: number;
  /** 공개 중 — 판매 동의(종료 예정 포함) */
  onSale: boolean;
  /** 공개일 */
  consentedAt?: string;
  /** 판매 종료 예정일 — 판매 중지를 예약하면 그 달 말일. 이때부터 새 신청은 받지 않는다 */
  endsAt?: string;
}

/** 거래 — 신청하면 바로 성립하고 토큰이 발급된다. 이용 취소하면 토큰을 더 쓸 수 없다 */
export interface DataTrade {
  id: number;
  datasetId: number;
  datasetName: string;
  sellerCompanyId: number;
  sellerCompanyName: string;
  buyerCompanyId: number;
  buyerCompanyName: string;
  priceType: PriceType;
  price: number;
  startedAt: string;
  token: string;
  tokenUpdatedAt: string;
  /** 이용 취소를 누른 날 */
  cancelledAt?: string;
  /** 이용 종료일 — 이용 취소 · 판매 중지를 한 달 말일. 월 이용료라 그날까지 쓴다 */
  endsAt?: string;
  /** 누가 끝냈나 — 사는 쪽 이용 취소 / 파는 쪽 판매 중지 */
  endBy?: 'buyer' | 'seller';
}

const tokenOf = (seed: number) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let x = seed * 2654435761;
  let out = '';
  for (let i = 0; i < 40; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    out += chars[x % chars.length];
  }
  return `ue.${out}`;
};
const randomToken = () => tokenOf(Math.floor(Math.random() * 1_000_000) + 1000);
const nowIso = () => new Date().toISOString().slice(0, 19);

/* ── 발전 정보 — 발전량 = 설비 용량 × 그 달 하루 평균 발전시간 × 날수 (일조시간 아님) ── */
/** 울산 월별 하루 평균 발전시간(h) — 1월 ~ 12월 */
const GEN_HOURS = [3.0, 3.5, 3.9, 4.3, 4.4, 3.8, 3.4, 3.7, 3.4, 3.5, 3.0, 2.8];
const r1 = (v: number) => Math.round(v * 10) / 10;

/** 2025-03 ~ 2026-09 */
function months(): { month: string; m: number; days: number; i: number }[] {
  const out: { month: string; m: number; days: number; i: number }[] = [];
  let [y = 2025, m = 3] = PERIOD_FROM.split('-').map(Number);
  for (let i = 0; ; i++) {
    const month = `${y}-${String(m).padStart(2, '0')}`;
    if (month > LAST_MONTH) break;
    out.push({ month, m, days: new Date(Date.UTC(y, m, 0)).getUTCDate(), i });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}
/** 같은 기업 · 같은 달이면 늘 같은 작은 흔들림(±3%) */
const wiggle = (id: number, i: number) => 1 + (((id * 7 + i * 5) % 13) - 6) / 200;

/** 달마다 발전시간 · 발전량 — 같은 기업 · 같은 달이면 늘 같은 흔들림(±3%). 온실가스 인벤토리 감축량도 이 값을 쓴다.
 *  PPA 설비는 꺼진 시간(주말 · 공휴일 · 10:00 ~ 17:00 밖)을 뺀 날마다 합 */
export function generationOf(c: SellerCompany) {
  if (c.unit === 'PPA') {
    const days = dailyOf(c.id);
    return potentialOf(c).map((g) => {
      const ds = days.filter((x) => x.date.startsWith(g.month));
      const kwh = ds.reduce((a, x) => a + x.kwh, 0);
      return { month: g.month, hours: r1(kwh / c.solarKw / (ds.length || 1)), kwh, opDays: ds.filter((x) => x.run).length };
    });
  }
  return potentialOf(c);
}
/** 그 달 하루 평균 발전시간 — 데이터 기간 밖(금월 등)도 같은 식. 온실가스 인벤토리 금월 · 금일 감축량에 쓴다 */
export function genHoursOf(id: number, month: string): number {
  const [y0 = 2025, m0 = 3] = PERIOD_FROM.split('-').map(Number);
  const [y = 2025, m = 1] = month.split('-').map(Number);
  return r1((GEN_HOURS[m - 1] ?? 0) * wiggle(id, (y - y0) * 12 + (m - m0)));
}
/** 꺼지지 않았다면의 발전량(설비 용량 × 발전시간 × 날수) */
function potentialOf(c: SellerCompany): { month: string; hours: number; kwh: number; opDays?: number }[] {
  return months()
    .filter(({ month }) => !c.from || month >= c.from)
    .map(({ month, m, days, i }) => {
      const hours = r1((GEN_HOURS[m - 1] ?? 0) * wiggle(c.id, i));
      return { month, hours, kwh: Math.round(c.solarKw * hours * days) };
    });
}
/* ── 상품 — 기업 × 종류. id = 기업 id × 10 + 종류 번호 ── */
const kindNo = (k: DataKind) => DATA_KINDS.indexOf(k) + 1;
function describe(c: SellerCompany): string {
  return `${c.name}${c.unit ? ` ${c.unit}` : ''} 태양광 ${c.solarKw} kW 시간별 발전량(kWh)`;
}

/* ── 시간별 발전량(데모 시드) — 수집 단위. 달 발전량(generationOf)을 날마다 · 시간마다 나눈다
 *  · 날: 같은 기업 · 같은 날이면 늘 같은 흔들림(맑음 · 흐림 0.6 ~ 1.1배), 합계는 그 달 발전량과 같게
 *  · 시간: 해 뜨는 시각 ~ 지는 시각 사이 산 모양(정오 최대), 합계는 그 날 발전량과 같게
 *  · 일조시간이 아니라 발전시간(발전량 ÷ 설비 용량) 기준 ── */
/** 울산 월별 해 뜨는 · 지는 시각(시, 소수) — 1월 ~ 12월 */
const DAYLIGHT: [number, number][] = [
  [7.5, 17.7],
  [7.2, 18.2],
  [6.7, 18.6],
  [6.0, 19.0],
  [5.5, 19.4],
  [5.2, 19.7],
  [5.3, 19.7],
  [5.8, 19.3],
  [6.2, 18.7],
  [6.6, 18.0],
  [7.0, 17.4],
  [7.4, 17.3],
];
/** 0 ~ 1 사이 고정 난수 — 같은 입력이면 같은 값 */
const noise = (a: number, b: number) => {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
/** 그 달 하루 발전 모양 — 24칸 비중(합 1) */
function hourShape(m: number): number[] {
  const [rise, set] = DAYLIGHT[m - 1] ?? [6, 19];
  const w = Array.from({ length: 24 }, (_, h) => {
    const t = (h + 0.5 - rise) / (set - rise);
    return t <= 0 || t >= 1 ? 0 : Math.pow(Math.sin(Math.PI * t), 1.2);
  });
  const sum = w.reduce((a, v) => a + v, 0) || 1;
  return w.map((v) => v / sum);
}
export interface DayGen {
  date: string;
  kwh: number;
  /** 그 날 발전시간 = 발전량 ÷ 설비 용량 */
  hours: number;
  /** 0시 ~ 23시 발전량(kWh, 소수 1자리) — 합 = kwh */
  hourly: number[];
  /** PPA 운전한 날인지 — PPA 설비만 */
  run?: boolean;
}
/** 달 하나의 날마다 발전량 */
function daysOf(c: SellerCompany, month: string, monthKwh: number, days: number): DayGen[] {
  const ppa = c.unit === 'PPA';
  const m = Number(month.slice(5, 7));
  const day0 = Number(month.replace('-', '')) * 100;
  const f = Array.from({ length: days }, (_, i) => 0.6 + 0.5 * noise(c.id, day0 + i + 1));
  const fs = f.reduce((a, v) => a + v, 0);
  const shape = hourShape(m);
  let left = monthKwh;
  return f.map((v, i) => {
    const kwh = i === days - 1 ? left : Math.round((monthKwh * v) / fs);
    left -= kwh;
    const hourly = shape.map((s) => Math.round(kwh * s * 10) / 10);
    const peak = hourly.indexOf(Math.max(...hourly));
    hourly[peak] = Math.round((hourly[peak]! + kwh - hourly.reduce((a, x) => a + x, 0)) * 10) / 10;
    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
    if (ppa) {
      // PPA — 인버터가 꺼진 시간은 데이터가 0(쉬는 날은 종일)
      const st = ppaDay(date);
      const on = hourly.map((v, h) => (offAt(st, `${String(h).padStart(2, '0')}:00`) ? 0 : v));
      const sum = Math.round(on.reduce((a, x) => a + x, 0));
      return { date, kwh: sum, hours: r1(sum / c.solarKw), hourly: on, run: st.on };
    }
    return {
      date,
      kwh,
      hours: r1(kwh / c.solarKw),
      hourly,
    };
  });
}
/** 기간 전체 날마다 발전량 — 기업마다 한 번만 계산 */
const dayCache = new Map<number, DayGen[]>();
export function dailyOf(companyId: number): DayGen[] {
  const hit = dayCache.get(companyId);
  if (hit) return hit;
  const c = DM_SELLERS.find((x) => x.id === companyId);
  if (!c) return [];
  const out = potentialOf(c).flatMap((g) => daysOf(c, g.month, g.kwh, daysIn(g.month)));
  dayCache.set(companyId, out);
  return out;
}

/** 그 달 날수 */
const daysIn = (month: string) => {
  const [y = 2025, m = 1] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
/** 기업 데이터 시작 달 */
const fromOf = (c: SellerCompany) => (c.from && c.from > PERIOD_FROM ? c.from : PERIOD_FROM);

export function productsOf(consents: Consent[]): Dataset[] {
  const base = {
    periodTo: LAST_MONTH,
    priceType: 'MONTHLY' as PriceType,
    price: DM_PRICE,
  };
  return DM_SELLERS.flatMap((c) =>
    DATA_KINDS.map((kind) => {
      // 종료일이 지난 판매 중지는 동의가 없는 것과 같다
      const consent = consents.find((x) => x.sellerId === c.id && x.kind === kind && !(x.endsAt && x.endsAt < DM_TODAY));
      return {
        ...base,
        periodFrom: fromOf(c),
        id: c.id * 10 + kindNo(kind),
        name: `${c.name}${c.unit ? ` ${c.unit}` : ''} ${kind}`,
        kind,
        description: describe(c),
        sellerId: c.id,
        unit: c.unit,
        ownerCompanyId: companyOfSeller(c),
        ownerCompanyName: c.name,
        onSale: !!consent,
        consentedAt: consent?.consentedAt,
        endsAt: consent?.endsAt,
      };
    }),
  );
}

/** 수집 주기 · 데이터 항목 — 모든 데이터가 같다 */
export const DATA_INTERVAL = '시간별';
export const DATA_ITEMS = '시간·일·월별 발전량 (kWh)';
/** 데이터 항목 — PPA 는 운전(ON / OFF) 칸이 더 있다 */
export const itemsOf = (d: Pick<Dataset, 'unit'>) => (d.unit === 'PPA' ? `${DATA_ITEMS} · 운전` : DATA_ITEMS);
/** 보기 단위 */
export type SheetUnit = 'hour' | 'day' | 'month';
export const UNIT_LABEL: Record<SheetUnit, string> = { hour: '시간별', day: '일별', month: '월별' };

/** 데이터 요약 — 상세 위 칸. 월별 표(generationOf)에서 계산해 표와 어긋나지 않게 */
export interface DataSummary {
  /** 설비 용량 — 그 설비 하나 */
  kwText: string;
  /** 기간 하루 평균 발전시간(h) — 날수 가중 */
  avgHours: number;
  /** 기간 누적 발전량(kWh) */
  totalKwh: number;
}
export function summaryOf(d: Pick<Dataset, 'sellerId'>): DataSummary | undefined {
  const c = DM_SELLERS.find((x) => x.id === d.sellerId);
  if (!c) return undefined;
  const g = generationOf(c);
  const days = g.reduce((a, r) => a + daysIn(r.month), 0);
  const hourDays = g.reduce((a, r) => a + r.hours * daysIn(r.month), 0);
  const kw = c.solarKw.toFixed(2);
  return {
    kwText: `${kw} kW`,
    avgHours: days ? Math.round((hourDays / days) * 10) / 10 : 0,
    totalKwh: g.reduce((a, r) => a + r.kwh, 0),
  };
}

/** 표 — 칸 이름 · 줄. 첫 칸(월) 말고는 숫자, 오른쪽 정렬 */
export interface DataSheet {
  columns: { key: string; label: string; strong?: boolean }[];
  rows: Record<string, string | number>[];
}
const fmt1 = (v: number) =>
  v.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 시간별 — 고른 날 하루 24줄 */
export function hourSheetOf(d: Pick<Dataset, 'sellerId' | 'unit'>, date: string): DataSheet {
  const g = dailyOf(d.sellerId).find((x) => x.date === date);
  const ppa = d.unit === 'PPA';
  return {
    columns: [
      { key: 'at', label: '일시' },
      ...(ppa ? [{ key: 'run', label: '운전' }] : []),
      { key: 'kwh', label: '발전량 (kWh)', strong: true },
    ],
    rows: (g?.hourly ?? []).map((v, h) => ({
      at: `${date} ${String(h).padStart(2, '0')}:00`,
      ...(ppa ? { run: runText(date, h) } : {}),
      kwh: fmt1(v),
    })),
  };
}
/** 일별 — 고른 달의 날마다 */
export function daySheetOf(d: Pick<Dataset, 'sellerId' | 'unit'>, month: string): DataSheet {
  const ppa = d.unit === 'PPA';
  return {
    columns: [
      { key: 'date', label: '날짜' },
      ...(ppa ? [{ key: 'run', label: '운전' }] : []),
      { key: 'hours', label: '발전시간 (h)' },
      { key: 'kwh', label: '발전량 (kWh)', strong: true },
    ],
    rows: dailyOf(d.sellerId)
      .filter((g) => g.date.startsWith(month))
      .map((g) => ({ date: g.date, ...(ppa ? { run: runText(g.date) } : {}), hours: fmt1(g.hours), kwh: g.kwh.toLocaleString('ko-KR') })),
  };
}
/** 시간별 전체 — CSV 내려받기(기간 전체, 한 시간 한 줄) */
export function hourlyCsvOf(d: Pick<Dataset, 'sellerId' | 'unit'>): string {
  const ppa = d.unit === 'PPA';
  const lines = dailyOf(d.sellerId).flatMap((g) =>
    g.hourly.map((v, h) => `${g.date} ${String(h).padStart(2, '0')}:00,${ppa ? `${runText(g.date, h)},` : ''}${v.toFixed(1)}`),
  );
  return [ppa ? '일시,운전,발전량 (kWh)' : '일시,발전량 (kWh)', ...lines].join('\n');
}
/** 데이터가 있는 날짜 · 달 */
export const dataDates = (sellerId: number) => dailyOf(sellerId).map((g) => g.date);
export const dataMonths = (sellerId: number) => {
  const c = DM_SELLERS.find((x) => x.id === sellerId);
  return months()
    .map((m) => m.month)
    .filter((m) => !c?.from || m >= c.from);
};

/** 월별 — 기간 전체(2025-03 ~ 2026-09) */
export function sheetOf(d: Dataset): DataSheet {
  const c = DM_SELLERS.find((x) => x.id === d.sellerId);
  if (!c) return { columns: [], rows: [] };
  const ppa = c.unit === 'PPA';
  return {
    columns: [
      { key: 'month', label: '월' },
      { key: 'kw', label: '설비 용량 (kW)' },
      ...(ppa ? [{ key: 'op', label: '운전일' }] : []),
      { key: 'hours', label: '하루 평균 발전시간 (h)' },
      { key: 'kwh', label: '발전량 (kWh)', strong: true },
    ],
    rows: generationOf(c).map((r) => ({
      month: r.month,
      kw: c.solarKw.toFixed(2),
      ...(ppa ? { op: `${r.opDays ?? 0}일` } : {}),
      hours: fmt1(r.hours),
      kwh: r.kwh.toLocaleString('ko-KR'),
    })),
  };
}

/** CSV — 표 그대로(천 단위 쉼표는 뺀다) */
export function csvOf(t: DataSheet): string {
  const esc = (v: string | number) => String(v).replace(/,/g, '');
  const head = t.columns.map((c) => c.label).join(',');
  const body = t.rows.map((r) => t.columns.map((c) => esc(r[c.key] ?? '')).join(','));
  return [head, ...body].join('\n');
}

/* ── 시드 — 동의 · 거래. 실제 기업 5곳 중 4곳 판매 중(데이터마다 이용 중 2곳)
 *  한길은 아직 동의 안 함 — 전기사용자 데모 계정으로 판매 동의(등록)를 직접 해 본다
 *  취소 섞임: 태성산업(한길 취소) · 건호이엔씨(태성산업 취소)
 *  사는 쪽: 한길 이용 중 2 + 취소 1(다시 신청 가능), 한일튜브(발전사업자 데모 계정 박발전) 이용 중 2 ── */
function seed(): { consents: Consent[]; trades: DataTrade[] } {
  const consents: Consent[] = [
    { sellerId: 7, kind: '태양광 발전량', consentedAt: '2026-06-02T10:00:00' },
    { sellerId: 5, kind: '태양광 발전량', consentedAt: '2026-06-18T11:00:00' },
    { sellerId: 6, kind: '태양광 발전량', consentedAt: '2026-06-25T10:00:00', endsAt: '2026-10-31' }, // 판매 중지 예약
    { sellerId: 4, kind: '태양광 발전량', consentedAt: '2026-08-28T09:00:00' },
    { sellerId: 8, kind: '태양광 발전량', consentedAt: '2026-08-28T09:00:00' },
  ];
  const products = productsOf(consents);
  const by = (id: number) => products.find((d) => d.id === id)!;
  const t = (
    id: number,
    d: Dataset,
    buyer: [number, string],
    startedAt: string,
    cancelledAt?: string,
    end?: Pick<DataTrade, 'endsAt' | 'endBy'>,
  ): DataTrade => ({
    id,
    datasetId: d.id,
    datasetName: d.name,
    sellerCompanyId: d.ownerCompanyId,
    sellerCompanyName: d.ownerCompanyName,
    buyerCompanyId: buyer[0],
    buyerCompanyName: buyer[1],
    priceType: d.priceType,
    price: d.price,
    startedAt,
    token: tokenOf(id * 11),
    tokenUpdatedAt: startedAt,
    cancelledAt,
    ...end,
  });
  const trades: DataTrade[] = [
    t(1, by(71), [5, '용인금속'], '2026-06-15T09:00:00'),
    t(3, by(71), [2, '한길'], '2026-08-01T11:00:00'),
    t(4, by(61), [5, '용인금속'], '2026-09-20T15:00:00', undefined, { endsAt: '2026-10-31', endBy: 'seller' }),
    t(5, by(41), [2, '한길'], '2026-09-02T09:00:00', '2026-10-01T14:00:00', { endsAt: '2026-10-31', endBy: 'buyer' }),
    t(8, by(61), [4, '한일튜브'], '2026-09-01T09:00:00', undefined, { endsAt: '2026-10-31', endBy: 'seller' }),
    t(9, by(71), [6, '태성산업'], '2026-07-20T11:00:00', '2026-08-28T16:00:00'),
    t(10, by(51), [4, '한일튜브'], '2026-06-20T10:00:00'),
    t(11, by(61), [2, '한길'], '2026-07-05T09:00:00', '2026-08-20T17:00:00'),
    t(12, by(41), [7, '건호이엔씨'], '2026-09-10T10:00:00'),
    t(13, by(51), [6, '태성산업'], '2026-08-05T13:00:00'),
    t(14, by(81), [5, '용인금속'], '2026-09-05T10:00:00'), // 한일튜브 PPA 데이터
  ];
  return { consents, trades };
}

interface DataMarketState {
  version: number;
  consents: Consent[];
  trades: DataTrade[];
  /** 판매 동의 · 중지 — 동의하면 바로 공개, 중지는 금월 말일까지 판매(예약). 말일 전에 다시 켜면 예약 취소 */
  /** sellerId — 데이터 단위(설비) */
  setConsent: (sellerId: number, kind: DataKind, on: boolean) => void;
  apply: (d: Dataset, buyer: { id: number; name: string }) => DataTrade | undefined;
  refreshToken: (tradeId: number) => void;
  /** 이용 취소 — 구매 기업 또는 관리자. 금월 말일까지 쓰고 끝난다 */
  cancel: (tradeId: number) => void;
}

const nextId = (xs: { id: number }[]) => xs.reduce((m, x) => Math.max(m, x.id), 0) + 1;
const same = (x: Consent, sellerId: number, kind: DataKind) => x.sellerId === sellerId && x.kind === kind;

export const useDataMarketStore = create<DataMarketState>()(
  persist(
    (set, get) => ({
      version: DM_SEED_VERSION,
      ...seed(),
      setConsent: (sellerId, kind, on) =>
        set((s) => {
          const datasetId = sellerId * 10 + kindNo(kind);
          const cur = s.consents.find((x) => same(x, sellerId, kind) && !(x.endsAt && x.endsAt < DM_TODAY));
          const rest = s.consents.filter((x) => !same(x, sellerId, kind));
          if (on) {
            // 종료 예정이면 예약 취소 — 판매 중지로 끝날 예정이던 이용도 되살린다
            if (cur?.endsAt)
              return {
                consents: [...rest, { ...cur, endsAt: undefined }],
                trades: s.trades.map((t) =>
                  t.datasetId === datasetId && t.endBy === 'seller' && isActive(t) ? { ...t, endsAt: undefined, endBy: undefined } : t,
                ),
              };
            return { consents: [...rest, { sellerId, kind, consentedAt: nowIso() }] };
          }
          if (!cur) return {};
          // 판매 중지 예약 — 금월 말일까지 판매, 이용 중인 기업도 그날까지 쓰고 끝
          const endsAt = monthEndOf(DM_TODAY);
          return {
            consents: [...rest, { ...cur, endsAt }],
            trades: s.trades.map((t) =>
              t.datasetId === datasetId && isActive(t) && !endOf(t) ? { ...t, endsAt, endBy: 'seller' as const } : t,
            ),
          };
        }),
      apply: (d, buyer) => {
        // 판매 종료 예정이면 새 신청은 받지 않는다
        if (!d.onSale || d.endsAt) return undefined;
        const at = nowIso();
        const t: DataTrade = {
          id: nextId(get().trades),
          datasetId: d.id,
          datasetName: d.name,
          sellerCompanyId: d.ownerCompanyId,
          sellerCompanyName: d.ownerCompanyName,
          buyerCompanyId: buyer.id,
          buyerCompanyName: buyer.name,
          priceType: d.priceType,
          price: d.price,
          startedAt: at,
          token: randomToken(),
          tokenUpdatedAt: at,
        };
        set((s) => ({ trades: [t, ...s.trades] }));
        return t;
      },
      cancel: (tradeId) =>
        set((s) => ({
          trades: s.trades.map((t) =>
            t.id === tradeId && !endOf(t) ? { ...t, cancelledAt: nowIso(), endsAt: monthEndOf(DM_TODAY), endBy: 'buyer' as const } : t,
          ),
        })),
      refreshToken: (tradeId) =>
        set((s) => ({
          trades: s.trades.map((t) =>
            t.id === tradeId ? { ...t, token: randomToken(), tokenUpdatedAt: nowIso() } : t,
          ),
        })),
    }),
    {
      name: 'ulsan-data-market-poc',
      storage: createJSONStorage(() => ssrSafeStorage),
      skipHydration: true,
      partialize: (s) => ({ version: s.version, consents: s.consents, trades: s.trades }),
      // 시드 버전이 다르면 저장본을 버린다
      merge: (persisted, current) => {
        const p = persisted as Partial<DataMarketState> | undefined;
        if (!p || p.version !== DM_SEED_VERSION) return current;
        return { ...current, ...p };
      },
    },
  ),
);

/** 브라우저에서 저장본을 올린다 — 화면 최상단에서 한 번 */
export function useHydrateDataMarket() {
  useEffect(() => {
    void useDataMarketStore.persist.rehydrate();
  }, []);
}

/* ── 정산 — 판매 기업에 들어오는 돈. 월 이용료는 시작한 달부터 끝나는 달까지 매달 ── */
/** 그 달 말일 — 2026-10-02 → 2026-10-31 */
export function monthEndOf(day: string): string {
  const [y = 2026, m = 1] = day.slice(0, 7).split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
/** 이용 종료일 — 이용 취소 · 판매 중지를 한 달 말일(예전 저장본은 취소한 달 말일) */
export const endOf = (t: DataTrade) => t.endsAt ?? (t.cancelledAt ? monthEndOf(t.cancelledAt) : undefined);
/** 이용 중 — 종료 예정(금월 말일까지)도 이용 중 */
export const isActive = (t: DataTrade) => {
  const end = endOf(t);
  return !end || end >= DM_TODAY;
};
/** 종료 예정 — 이용 취소 · 판매 중지로 금월 말일에 끝난다 */
export const isEnding = (t: DataTrade) => !!endOf(t) && isActive(t);
/** 그 달에 돈을 내는 거래인지 — 시작한 달 ~ 끝나는 달 */
export const billedIn = (t: DataTrade, month: string) => {
  const end = endOf(t);
  return t.startedAt.slice(0, 7) <= month && (!end || end.slice(0, 7) >= month);
};

/** 2026-06 처럼 첫 거래 달부터 금월까지 */
export function monthsUntilNow(trades: DataTrade[]): string[] {
  const first = trades.map((t) => t.startedAt.slice(0, 7)).sort()[0];
  if (!first) return [];
  const out: string[] = [];
  let [y = 2026, m = 1] = first.split('-').map(Number);
  for (;;) {
    const p = `${y}-${String(m).padStart(2, '0')}`;
    if (p > THIS_MONTH) break;
    out.push(p);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** 정산 한 줄 — 이용 기업 × 이용한 달. 그 달 이용분은 익월 15일에 들어온다(다른 정산과 같은 익월 15일 확정) */
export interface SettleRow {
  key: string;
  /** 이용한 달 */
  period: string;
  /** 들어오는 날 — 익월 15일 */
  payDate: string;
  trade: DataTrade;
  amount: number;
  /** 들어온 것(확정) — 아니면 예상 */
  confirmed: boolean;
}
export const payDateOf = (period: string) => {
  let [y = 2026, m = 1] = period.split('-').map(Number);
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}-15`;
};
/** 정산 내역 — 최근 달이 위 */
export function settleRows(trades: DataTrade[]): SettleRow[] {
  return monthsUntilNow(trades)
    .flatMap((period) =>
      trades
        .filter((t) => billedIn(t, period))
        .map((t) => {
          const payDate = payDateOf(period);
          return {
            key: `${t.id}-${period}`,
            period,
            payDate,
            trade: t,
            amount: t.price,
            confirmed: payDate <= DM_TODAY,
          };
        }),
    )
    .sort(
      (a, b) =>
        b.period.localeCompare(a.period) ||
        a.trade.buyerCompanyName.localeCompare(b.trade.buyerCompanyName, 'ko'),
    );
}

/* ── 사용량 — 토큰별 일별 API 호출 수(최근 30일, 데모 값) ── */
/** 최근 30일 호출 합계 */
export const usage30 = (t: DataTrade) => usageDays().reduce((a, d) => a + usageOf(t, d), 0);
/** 시작일 ~ 종료일 사이 날짜(양 끝 포함) */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  if (!from || !to || from > to) return out;
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
/** 고른 기간의 호출 합계 */
export const usageIn = (t: DataTrade, days: string[]) =>
  days.reduce((a, d) => a + usageOf(t, d), 0);
export function usageDays(days = 30): string[] {
  const end = new Date(`${DM_TODAY}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}
export function usageOf(t: DataTrade, day: string): number {
  if (day < t.startedAt.slice(0, 10)) return 0;
  // 종료일 다음 날부터는 호출할 수 없다
  const end = endOf(t);
  if (end && day > end) return 0;
  const n = Number(day.slice(8, 10));
  const wd = new Date(`${day}T00:00:00Z`).getUTCDay();
  const weekend = wd === 0 || wd === 6;
  const base = ((t.id * 37 + n * 13) % 40) + 20;
  return weekend ? Math.round(base * 0.3) : base;
}
