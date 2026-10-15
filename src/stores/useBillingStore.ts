import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ssrSafeStorage } from '@/lib/ssr-storage';

/**
 * 기업 결제 수단 — 기업 카드(법인카드) 여러 장, 그중 하나가 기본 카드(매달 자동결제). 기업관리자가 추가 · 기본 지정 · 삭제,
 * 소속 멤버는 등록된 카드로 결제(신청할 때 카드를 고르고, 신청한 사람 이름이 남는다).
 * 저장하는 건 토스페이먼츠 빌링키 · 카드사 · 끝 4자리뿐 — 카드 번호 · CVC 는 저장하지 않는다. POC 는 브라우저에 저장(실서비스는 서버 DB)
 */
export interface CompanyCard {
  id: string;
  companyId: number;
  /** 토스페이먼츠 고객 키 — 기업마다 고정 */
  customerKey: string;
  billingKey: string;
  cardCompany: string;
  /** 끝 4자리 — '1234' (가린 번호의 끝) */
  last4: string;
  /** 토스가 준 가린 카드 번호 — '43301234****123*' */
  maskedNumber?: string;
  /** 신용 / 체크 / 기프트 */
  cardType?: string;
  /** 개인 / 법인 */
  ownerType?: string;
  /** 기본 카드 — 매달 자동결제 · 신청 때 먼저 골라 둔다 */
  isDefault: boolean;
  registeredAt: string;
  registeredBy: string;
}
export interface Charge {
  id: number;
  companyId: number;
  cardId: string;
  tradeId: number;
  orderName: string;
  amount: number;
  approvedAt: string;
  paymentKey: string;
  by: string;
}

const SEED_VERSION = 3; // 3 — 토스가 주는 값(가린 번호 · 신용/체크 · 개인/법인). 2 — 기업 카드 여러 장 · 기본 카드
const at = (d: string) => `${d}T09:00:00`;
const BIN: Record<string, string> = { 신한: '45181500', KB국민: '94110300', 하나: '46179400', 삼성: '53653900', 현대: '43301200' };
const seedCard = (companyId: number, n: number, cardCompany: string, last4: string, isDefault: boolean, date: string, by: string): CompanyCard => ({
  id: `card-${companyId}-${n}`,
  companyId,
  customerKey: `company-${companyId}-demo`,
  billingKey: `bk_demo_${companyId}_${n}`,
  cardCompany,
  last4,
  maskedNumber: `${BIN[cardCompany] ?? '43301200'}****${last4.slice(0, 3)}*`,
  cardType: '신용',
  ownerType: '법인',
  isDefault,
  registeredAt: at(date),
  registeredBy: by,
});
/** 데모 — 데이터를 산 기업마다 법인카드. 한일튜브는 두 장(기본 KB국민) */
const SEED_CARDS: CompanyCard[] = [
  seedCard(2, 1, '신한', '4021', true, '2026-06-30', '이수용'),
  seedCard(3, 1, '신한', '4021', true, '2026-06-30', '이수용'),
  seedCard(4, 1, 'KB국민', '7718', true, '2026-06-15', '박발전'),
  seedCard(4, 2, '신한', '0932', false, '2026-09-01', '박발전'),
  seedCard(5, 1, '하나', '3306', true, '2026-06-10', '박용인'),
  seedCard(6, 1, '삼성', '9152', true, '2026-07-15', '태성산업'),
  seedCard(7, 1, '현대', '2480', true, '2026-09-01', '건호이엔씨'),
];

interface BillingState {
  version: number;
  cards: CompanyCard[];
  charges: Charge[];
  /** 고객 키 꼬리 — 기업마다 한 번 만들고 계속 쓴다 */
  salts: Record<number, string>;
  saltOf: (companyId: number) => string;
  /** 카드 추가 — 기업의 첫 카드면 기본 카드 */
  addCard: (card: Omit<CompanyCard, 'id' | 'isDefault'>) => void;
  setDefault: (cardId: string) => void;
  /** 삭제 — 기본 카드를 지우면 남은 카드 중 먼저 등록한 것이 기본 */
  removeCard: (cardId: string) => void;
  addCharge: (c: Omit<Charge, 'id'>) => void;
  /** 서비스(거래)마다 매달 자동결제할 카드 — 없으면 기본 카드. 신청 때 고른 카드로 시작, 결제 수단에서 바꾼다 */
  subCard: Record<number, string>;
  setSubCard: (tradeId: number, cardId: string) => void;
}

export const useBillingStore = create<BillingState>()(
  persist(
    (set, get) => ({
      version: SEED_VERSION,
      cards: SEED_CARDS,
      charges: [],
      salts: {},
      saltOf: (companyId) => {
        const cur = get().salts[companyId];
        if (cur) return cur;
        const s = Math.random().toString(36).slice(2, 12);
        set({ salts: { ...get().salts, [companyId]: s } });
        return s;
      },
      addCard: (card) => {
        const first = !get().cards.some((c) => c.companyId === card.companyId);
        const id = `card-${card.companyId}-${Date.now().toString(36)}`;
        set({ cards: [...get().cards, { ...card, id, isDefault: first }] });
      },
      setDefault: (cardId) => {
        const target = get().cards.find((c) => c.id === cardId);
        if (!target) return;
        set({ cards: get().cards.map((c) => (c.companyId === target.companyId ? { ...c, isDefault: c.id === cardId } : c)) });
      },
      removeCard: (cardId) => {
        const target = get().cards.find((c) => c.id === cardId);
        if (!target) return;
        let rest = get().cards.filter((c) => c.id !== cardId);
        if (target.isDefault) {
          const next = rest.filter((c) => c.companyId === target.companyId).sort((a, b) => a.registeredAt.localeCompare(b.registeredAt))[0];
          if (next) rest = rest.map((c) => (c.id === next.id ? { ...c, isDefault: true } : c));
        }
        set({ cards: rest });
      },
      addCharge: (c) =>
        set({
          charges: [{ ...c, id: get().charges.reduce((m, x) => Math.max(m, x.id), 0) + 1 }, ...get().charges],
          subCard: { ...get().subCard, [c.tradeId]: c.cardId },
        }),
      subCard: {},
      setSubCard: (tradeId, cardId) => set({ subCard: { ...get().subCard, [tradeId]: cardId } }),
    }),
    {
      name: 'ulsan-billing-poc',
      storage: createJSONStorage(() => ssrSafeStorage),
      skipHydration: true,
      partialize: (s) => ({ version: s.version, cards: s.cards, charges: s.charges, salts: s.salts, subCard: s.subCard }),
      merge: (persisted, current) => {
        const p = persisted as Partial<BillingState> | undefined;
        if (!p || p.version !== SEED_VERSION) return current;
        return { ...current, ...p };
      },
    },
  ),
);

export function useHydrateBilling() {
  useEffect(() => {
    void useBillingStore.persist.rehydrate();
  }, []);
}

/** 기업 카드 — 기본 카드 먼저, 그다음 등록 순 */
export const cardsOf = (cards: CompanyCard[], companyId: number) =>
  cards
    .filter((c) => c.companyId === companyId)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.registeredAt.localeCompare(b.registeredAt));

/** 지금 시각(한국, 브라우저 현지) — 'YYYY-MM-DDTHH:MM:SS'. toISOString 은 UTC 라 9시간 어긋난다 */
export const localNow = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
/** 카드 표시 — 토스가 준 값만: 'KB국민 신용(법인) 94110300****771*' */
export const cardText = (c: Pick<CompanyCard, 'cardCompany' | 'last4' | 'maskedNumber' | 'cardType' | 'ownerType'>) =>
  `${c.cardCompany}${c.cardType ? ` ${c.cardType}` : ''}${c.ownerType ? `(${c.ownerType})` : ''} ${c.maskedNumber ?? `****${c.last4}`}`;
