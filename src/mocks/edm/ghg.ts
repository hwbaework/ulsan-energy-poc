// 온실가스 인벤토리 mock — 설계 docs/기획/02. 계수 0.4781(2021 승인 국가계수).
// 목표관리제 지침 기반. 실제 백엔드 연계 전 화면 우선 구현용.

export const ELEC_FACTOR = 0.4781; // tCO₂eq/MWh (소비단, 2021 승인)

export type Scope = 1 | 2;
export type ActivityType = 'ELEC' | 'FUEL' | 'STEAM';
export type StatementStatus = 'DRAFT' | 'SUBMITTED' | 'VERIFIED';

export interface EmissionSource {
  id: string;
  site: string;
  facility: string;
  scope: Scope;
  category: string;
  tier: 1 | 2 | 3;
  fuelFactor?: number | null;
}

export interface ActivityRow {
  id: string;
  sourceId: string;
  year: number;
  type: ActivityType;
  amount: number; // MWh(전력) / TJ(연료) / GJ(스팀)
  unit: string;
  isAuto: boolean;
  evidence?: string;
}

export interface CalcRow {
  sourceId: string;
  facility: string;
  scope: Scope;
  activity: number;
  unit: string;
  factor: number;
  tCO2eq: number;
}

export interface StatementRow {
  id: string;
  year: number;
  status: StatementStatus;
  scope1: number;
  scope2: number;
  total: number;
  submittedAt?: string;
}

export const MOCK_SOURCES: EmissionSource[] = [
  {
    id: 'S1',
    site: '울산1공장',
    facility: '수전설비(한전)',
    scope: 2,
    category: '구매전력',
    tier: 1,
  },
  {
    id: 'S2',
    site: '울산1공장',
    facility: '보일러 #1',
    scope: 1,
    category: '고정연소(LNG)',
    tier: 2,
  },
  { id: 'S3', site: '울산1공장', facility: '공정 배출', scope: 1, category: '공정배출', tier: 2 },
  {
    id: 'S4',
    site: '울산2공장',
    facility: '수전설비(한전)',
    scope: 2,
    category: '구매전력',
    tier: 1,
  },
  {
    id: 'S5',
    site: '울산2공장',
    facility: '지게차(경유)',
    scope: 1,
    category: '이동연소',
    tier: 1,
  },
];

export const MOCK_ACTIVITY: ActivityRow[] = [
  { id: 'A1', sourceId: 'S1', year: 2026, type: 'ELEC', amount: 12400, unit: 'MWh', isAuto: true },
  {
    id: 'A2',
    sourceId: 'S2',
    year: 2026,
    type: 'FUEL',
    amount: 38.2,
    unit: 'TJ',
    isAuto: false,
    evidence: '도시가스요금_2026.pdf',
  },
  {
    id: 'A3',
    sourceId: 'S3',
    year: 2026,
    type: 'FUEL',
    amount: 12.0,
    unit: 'TJ',
    isAuto: false,
    evidence: '공정일지_2026.xlsx',
  },
  { id: 'A4', sourceId: 'S4', year: 2026, type: 'ELEC', amount: 8600, unit: 'MWh', isAuto: true },
  { id: 'A5', sourceId: 'S5', year: 2026, type: 'FUEL', amount: 2.1, unit: 'TJ', isAuto: false },
];

// 연료 배출계수(간이): TJ당 tCO₂eq (LNG 56, 경유 74 예시)
const FUEL_FACTOR: Record<string, number> = { S2: 56, S3: 56, S5: 74 };

export function calcRows(year = 2026): CalcRow[] {
  return MOCK_ACTIVITY.filter((a) => a.year === year).map((a) => {
    const src = MOCK_SOURCES.find((s) => s.id === a.sourceId)!;
    const factor = a.type === 'ELEC' ? ELEC_FACTOR : (FUEL_FACTOR[a.sourceId] ?? 56);
    return {
      sourceId: a.sourceId,
      facility: src.facility,
      scope: src.scope,
      activity: a.amount,
      unit: a.unit,
      factor,
      tCO2eq: Math.round(a.amount * factor),
    };
  });
}

export function scopeTotals(year = 2026) {
  const rows = calcRows(year);
  const scope1 = rows.filter((r) => r.scope === 1).reduce((s, r) => s + r.tCO2eq, 0);
  const scope2 = rows.filter((r) => r.scope === 2).reduce((s, r) => s + r.tCO2eq, 0);
  return { scope1, scope2, total: scope1 + scope2 };
}

export const MOCK_STATEMENTS: StatementRow[] = (() => {
  const t26 = scopeTotals(2026);
  return [
    {
      id: 'ST-2026',
      year: 2026,
      status: 'DRAFT',
      scope1: t26.scope1,
      scope2: t26.scope2,
      total: t26.total,
    },
    {
      id: 'ST-2025',
      year: 2025,
      status: 'VERIFIED',
      scope1: 5200,
      scope2: 9800,
      total: 15000,
      submittedAt: '2026-03-28',
    },
    {
      id: 'ST-2024',
      year: 2024,
      status: 'VERIFIED',
      scope1: 5400,
      scope2: 10100,
      total: 15500,
      submittedAt: '2025-03-30',
    },
  ];
})();

export const YEARLY_TREND = [
  { year: '2024', total: 15500 },
  { year: '2025', total: 15000 },
  { year: '2026', total: scopeTotals(2026).total },
];

export const QC_CHECKS = [
  { key: 'no_missing_source', label: '누락 배출원 없음', passed: true },
  { key: 'unit_valid', label: '활동자료 단위 정합', passed: true },
  { key: 'factor_version', label: '계수 버전 확정(2021 승인)', passed: true },
  { key: 'evidence', label: 'Scope1 증빙 첨부', passed: false },
];
