// 카본 마켓플레이스 mock — 설계 docs/기획/02 §2.7~2.11.
// 규제적(KAU·KOC·KCU) + 자발적. KRX 연계·장외거래·외부사업(KOC).

export interface KrxQuote {
  name: string;
  last: number;
  change: number;
  bid: number;
  ask: number;
}
export interface OtcOrder {
  id: string;
  company: string;
  side: 'BUY' | 'SELL';
  type: 'KAU' | 'KOC';
  amount: number;
  price: number;
  etrs: 'PENDING' | 'FILED' | 'NONE';
}
export interface OffsetProject {
  id: string;
  name: string;
  methodology: string;
  status: 'PLAN' | 'APPROVED' | 'MONITORING' | 'ISSUED';
  kocIssued: number;
  recDuplicate: boolean;
}
export interface VoluntaryMarket {
  name: string;
  region: string;
  standard: string;
}

export const KRX_QUOTES: KrxQuote[] = [
  { name: 'KAU24', last: 9120, change: -1.3, bid: 9100, ask: 9150 },
  { name: 'KAU25', last: 8850, change: 0.8, bid: 8830, ask: 8880 },
  { name: 'KCU24', last: 8400, change: -0.5, bid: 8380, ask: 8420 },
];

export const KAU_TREND = [
  { date: '5/1', price: 9600 },
  { date: '5/8', price: 9400 },
  { date: '5/15', price: 9250 },
  { date: '5/22', price: 9180 },
  { date: '5/29', price: 9120 },
];

export const OTC_ORDERS: OtcOrder[] = [
  {
    id: 'O1',
    company: '롯데이네오스화학',
    side: 'SELL',
    type: 'KAU',
    amount: 5000,
    price: 9000,
    etrs: 'FILED',
  },
  {
    id: 'O2',
    company: 'SK어드밴스드',
    side: 'BUY',
    type: 'KAU',
    amount: 3000,
    price: 9050,
    etrs: 'PENDING',
  },
  {
    id: 'O3',
    company: '한화임팩트',
    side: 'SELL',
    type: 'KOC',
    amount: 1200,
    price: 8600,
    etrs: 'NONE',
  },
];

export const OFFSET_PROJECTS: OffsetProject[] = [
  {
    id: 'P1',
    name: 'ORC 배열활용 발전 (에너루트 2호)',
    methodology: '재생에너지 전력 대체',
    status: 'MONITORING',
    kocIssued: 0,
    recDuplicate: false,
  },
  {
    id: 'P2',
    name: '태양광 자가소비 감축',
    methodology: '재생에너지 전력 대체',
    status: 'APPROVED',
    kocIssued: 0,
    recDuplicate: true,
  },
  {
    id: 'P3',
    name: '공정배열 회수',
    methodology: '폐열회수',
    status: 'ISSUED',
    kocIssued: 3200,
    recDuplicate: false,
  },
];

export const VOLUNTARY_MARKETS: VoluntaryMarket[] = [
  { name: 'Verra VCS', region: '국제', standard: 'VCS' },
  { name: 'Gold Standard', region: '국제', standard: 'GS' },
  { name: 'KVER (자발적 감축)', region: '국내', standard: 'KVER' },
];

export const CARBON_HOLDINGS = { kau: 12000, koc: 3200, kcu: 800 };
