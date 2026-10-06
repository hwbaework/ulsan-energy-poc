/**
 * 데이터 마켓플레이스(WBS 3.3) POC 스토어 — 등록 → 관리자 승인(가격 확정) / 반려 → 신청 → 토큰 발급 → 사용량 · 정산.
 * 품질 점수 · 심사 같은 단계는 없다. 등록은 발전사업자 · 전기사용자, 승인은 관리자(플랫폼).
 * 브라우저 localStorage 에 저장(데모). 시드가 바뀌면 SEED_VERSION 을 올린다.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ssrSafeStorage } from '@/lib/ssr-storage';

export const DM_SEED_VERSION = 2;

export const DATA_KINDS = ['발전량', '전력 사용량', '배출량', '기타'] as const;
export type DataKind = (typeof DATA_KINDS)[number];
export const DELIVERIES = ['API', '파일'] as const;
/** 수집 주기 — 값 하나가 몇 분/시간/일/월마다 찍히는지. 15분 단위 = 한전 전자식 계량기(AMI)가 15분마다 기록하는 사용량 */
export const INTERVALS = ['15분 단위', '시간별', '일별', '월별'] as const;
export type DataInterval = (typeof INTERVALS)[number];
export type Delivery = (typeof DELIVERIES)[number];
/** 가격 방식 — 월 이용료 / 1회 구매 */
export type PriceType = 'MONTHLY' | 'ONCE';
export const PRICE_TYPE_LABEL: Record<PriceType, string> = {
  MONTHLY: '월 이용료',
  ONCE: '1회 구매',
};
export type DatasetStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export const DATASET_STATUS_LABEL: Record<DatasetStatus, string> = {
  PENDING: '승인 대기',
  APPROVED: '승인',
  REJECTED: '반려',
};

export interface Dataset {
  id: number;
  name: string;
  kind: DataKind;
  delivery: Delivery;
  interval: DataInterval;
  /** 데이터 기간 — 2025-03 ~ 2026-09 (끝이 없으면 계속) */
  periodFrom: string;
  periodTo?: string;
  description?: string;
  ownerCompanyId: number;
  ownerCompanyName: string;
  priceType: PriceType;
  /** 등록할 때 제시한 가격 */
  proposedPrice: number;
  /** 승인할 때 정한 가격 */
  price?: number;
  status: DatasetStatus;
  registeredAt: string;
  decidedAt?: string;
  rejectReason?: string;
}

/** 거래 — 신청하면 바로 성립하고 토큰이 발급된다 */
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
}

/** 지금 날짜(데모 기준) · 마지막으로 끝난 달 */
export const DM_TODAY = '2026-10-02';
const LAST_MONTH = '2026-09';

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

/* ── 시드 — 실제 기업만(한길 · 태성산업 · 건호이엔씨 · 한일튜브 · 용인금속) ── */
function seed(): { datasets: Dataset[]; trades: DataTrade[] } {
  const datasets: Dataset[] = [
    {
      id: 1,
      name: '한일튜브 태양광 발전량',
      kind: '발전량',
      delivery: 'API',
      interval: '시간별',
      periodFrom: '2025-03',
      description:
        '한일튜브 울산공장 지붕 태양광 429.44 kW(자가소비 99.84 + onsite 329.6) — 시간마다 발전량(kWh)',
      ownerCompanyId: 4,
      ownerCompanyName: '한일튜브',
      priceType: 'MONTHLY',
      proposedPrice: 50_000,
      price: 50_000,
      status: 'APPROVED',
      registeredAt: '2026-06-02T10:00:00',
      decidedAt: '2026-06-04T15:00:00',
    },
    {
      id: 2,
      name: '한길 전력 사용량',
      kind: '전력 사용량',
      delivery: 'API',
      interval: '15분 단위',
      periodFrom: '2025-05',
      description: '한길 사업장 전력 사용량(kWh) — 한전 계량기가 15분마다 기록한 값',
      ownerCompanyId: 2,
      ownerCompanyName: '한길',
      priceType: 'MONTHLY',
      proposedPrice: 30_000,
      price: 30_000,
      status: 'APPROVED',
      registeredAt: '2026-06-10T09:30:00',
      decidedAt: '2026-06-12T11:00:00',
    },
    {
      id: 5,
      name: '건호이엔씨 태양광 발전량',
      kind: '발전량',
      delivery: 'API',
      interval: '시간별',
      periodFrom: '2024-12',
      description: '건호이엔씨 공장 태양광 33.92 kW — 시간마다 발전량(kWh)',
      ownerCompanyId: 7,
      ownerCompanyName: '건호이엔씨',
      priceType: 'MONTHLY',
      proposedPrice: 20_000,
      price: 20_000,
      status: 'APPROVED',
      registeredAt: '2026-07-20T10:00:00',
      decidedAt: '2026-07-22T14:00:00',
    },
    {
      id: 6,
      name: '한길 온실가스 배출량',
      kind: '배출량',
      delivery: '파일',
      interval: '월별',
      periodFrom: '2024-01',
      periodTo: '2026-08',
      description: '한길 사업장 Scope 1 · 2 배출량(tCO₂eq) — 달마다 합계, CSV',
      ownerCompanyId: 2,
      ownerCompanyName: '한길',
      priceType: 'ONCE',
      proposedPrice: 120_000,
      price: 120_000,
      status: 'APPROVED',
      registeredAt: '2026-08-25T09:00:00',
      decidedAt: '2026-08-27T10:00:00',
    },
    {
      id: 3,
      name: '용인금속 전력 사용량',
      kind: '전력 사용량',
      delivery: '파일',
      interval: '월별',
      periodFrom: '2024-09',
      periodTo: '2026-08',
      description: '용인금속 울산공장 전력 사용량(kWh) — 달마다 합계, CSV',
      ownerCompanyId: 5,
      ownerCompanyName: '용인금속',
      priceType: 'ONCE',
      proposedPrice: 100_000,
      status: 'PENDING',
      registeredAt: '2026-09-28T14:00:00',
    },
    {
      id: 4,
      name: '태성산업 태양광 발전량',
      kind: '발전량',
      delivery: '파일',
      interval: '일별',
      periodFrom: '2024-11',
      periodTo: '2026-08',
      description: '태성산업 본사 태양광 46.08 kW — 하루 발전량(kWh), CSV',
      ownerCompanyId: 6,
      ownerCompanyName: '태성산업',
      priceType: 'ONCE',
      proposedPrice: 80_000,
      status: 'REJECTED',
      registeredAt: '2026-09-15T10:00:00',
      decidedAt: '2026-09-17T16:00:00',
      rejectReason: '2025-01 ~ 2025-06 데이터 빠짐 — 보완 후 다시 등록',
    },
  ];
  const t = (id: number, d: Dataset, buyer: [number, string], startedAt: string): DataTrade => ({
    id,
    datasetId: d.id,
    datasetName: d.name,
    sellerCompanyId: d.ownerCompanyId,
    sellerCompanyName: d.ownerCompanyName,
    buyerCompanyId: buyer[0],
    buyerCompanyName: buyer[1],
    priceType: d.priceType,
    price: d.price ?? d.proposedPrice,
    startedAt,
    token: tokenOf(id * 11),
    tokenUpdatedAt: startedAt,
  });
  const by = (id: number) => datasets.find((d) => d.id === id)!;
  const trades: DataTrade[] = [
    t(1, by(2), [3, '울산 발전(주)'], '2026-07-01T09:00:00'),
    t(2, by(1), [2, '한길'], '2026-08-01T10:00:00'),
    t(3, by(5), [4, '한일튜브'], '2026-09-01T11:00:00'),
    t(4, by(6), [6, '태성산업'], '2026-09-10T15:00:00'),
  ];
  return { datasets, trades };
}

/* ── 샘플 — 데이터 앞부분 몇 줄(데모 값). 신청 전에 어떤 모양인지 본다 ── */
export const UNIT_OF: Record<DataKind, string> = {
  발전량: 'kWh',
  '전력 사용량': 'kWh',
  배출량: 'tCO₂eq',
  기타: '',
};
export function sampleRowsOf(
  d: Pick<Dataset, 'id' | 'kind' | 'interval' | 'periodFrom'>,
  n = 8,
): { at: string; value: number }[] {
  const start = new Date(`${d.periodFrom}-01T00:00:00Z`);
  const step = (i: number) => {
    const x = new Date(start);
    if (d.interval === '15분 단위') x.setUTCMinutes(i * 15 + 9 * 60);
    else if (d.interval === '시간별') x.setUTCHours(i + 9);
    else if (d.interval === '일별') x.setUTCDate(i + 1);
    else x.setUTCMonth(i);
    return x.toISOString();
  };
  const fmt = (iso: string) =>
    d.interval === '15분 단위' || d.interval === '시간별'
      ? iso.slice(0, 16).replace('T', ' ')
      : d.interval === '일별'
        ? iso.slice(0, 10)
        : iso.slice(0, 7);
  const base: Record<DataKind, number> = {
    발전량:
      d.interval === '15분 단위'
        ? 12
        : d.interval === '시간별'
          ? 48
          : d.interval === '일별'
            ? 420
            : 12_600,
    '전력 사용량':
      d.interval === '15분 단위'
        ? 31
        : d.interval === '시간별'
          ? 124
          : d.interval === '일별'
            ? 2_980
            : 89_400,
    배출량: 103,
    기타: 100,
  };
  return Array.from({ length: n }, (_, i) => {
    const wiggle = 1 + (((d.id * 7 + i * 5) % 11) - 5) / 40;
    const v = base[d.kind] * wiggle;
    return {
      at: fmt(step(i)),
      value: d.kind === '배출량' ? Math.round(v * 10) / 10 : Math.round(v),
    };
  });
}

interface DataMarketState {
  version: number;
  datasets: Dataset[];
  trades: DataTrade[];
  register: (
    d: Omit<Dataset, 'id' | 'status' | 'registeredAt' | 'price' | 'decidedAt' | 'rejectReason'>,
  ) => Dataset;
  approve: (id: number, price: number) => void;
  reject: (id: number, reason: string) => void;
  apply: (datasetId: number, buyer: { id: number; name: string }) => DataTrade | undefined;
  refreshToken: (tradeId: number) => void;
}

const nextId = (xs: { id: number }[]) => xs.reduce((m, x) => Math.max(m, x.id), 0) + 1;

export const useDataMarketStore = create<DataMarketState>()(
  persist(
    (set, get) => ({
      version: DM_SEED_VERSION,
      ...seed(),
      register: (d) => {
        const ds: Dataset = {
          ...d,
          id: nextId(get().datasets),
          status: 'PENDING',
          registeredAt: nowIso(),
        };
        set((s) => ({ datasets: [ds, ...s.datasets] }));
        return ds;
      },
      approve: (id, price) =>
        set((s) => ({
          datasets: s.datasets.map((d) =>
            d.id === id
              ? { ...d, status: 'APPROVED', price, decidedAt: nowIso(), rejectReason: undefined }
              : d,
          ),
        })),
      reject: (id, reason) =>
        set((s) => ({
          datasets: s.datasets.map((d) =>
            d.id === id
              ? { ...d, status: 'REJECTED', decidedAt: nowIso(), rejectReason: reason }
              : d,
          ),
        })),
      apply: (datasetId, buyer) => {
        const d = get().datasets.find((x) => x.id === datasetId);
        if (!d || d.status !== 'APPROVED' || d.price == null) return undefined;
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
      partialize: (s) => ({ version: s.version, datasets: s.datasets, trades: s.trades }),
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

/* ── 정산 — 월 이용료는 시작한 달부터 마지막으로 끝난 달까지 매달, 1회 구매는 산 달 한 번 ── */
export interface DataSettlement {
  key: string;
  period: string;
  trade: DataTrade;
  amount: number;
}
export function settlementsOfTrades(trades: DataTrade[]): DataSettlement[] {
  const out: DataSettlement[] = [];
  for (const t of trades) {
    const start = t.startedAt.slice(0, 7);
    if (start > LAST_MONTH) continue;
    if (t.priceType === 'ONCE') {
      out.push({ key: `${t.id}-${start}`, period: start, trade: t, amount: t.price });
      continue;
    }
    let [y = 2026, m = 1] = start.split('-').map(Number);
    for (;;) {
      const p = `${y}-${String(m).padStart(2, '0')}`;
      if (p > LAST_MONTH) break;
      out.push({ key: `${t.id}-${p}`, period: p, trade: t, amount: t.price });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
  }
  return out.sort((a, b) => b.period.localeCompare(a.period) || a.trade.id - b.trade.id);
}

/* ── 사용량 — 토큰별 일별 API 호출 수(최근 30일, 데모 값) ── */
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
  const n = Number(day.slice(8, 10));
  const wd = new Date(`${day}T00:00:00Z`).getUTCDay();
  const weekend = wd === 0 || wd === 6;
  const base = ((t.id * 37 + n * 13) % 40) + 20;
  return weekend ? Math.round(base * 0.3) : base;
}
