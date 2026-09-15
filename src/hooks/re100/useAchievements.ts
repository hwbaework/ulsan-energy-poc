'use client';

// RE100 이행 폐곡선 실훅 (06 §13.0.1 데이터 계약 정본 — BE 신설분 소비).
// achievements(latest·refSettlementId)·portfolio·desk·support-activities.
// 불변식(06 §13.0.1): 화면은 actualPct·mwh·contribPct를 표시만 한다. 산식은 BE recalculateActualPct에서만 계산 — FE 재계산·재조인 금지.
// 되먹임 규약(06 §13.0.3): 진입 시 staleTime=0 재조회(정산 반영분 즉시 표출). FE는 재계산 트리거 안 함.
// 엔드포인트는 그룹 로컬 상수(공유 endpoints.ts 미수정 — 플랜 §5 정합, 통합 게이트에서 병합).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';

// 응답 언랩 규약: axios 인터셉터가 { success, data } 봉투에서 data를 언랩하므로
// getApiClient().get<T>()는 언랩된 T를 반환한다(re100Api·consumerApi 패턴과 동일).
const api = () => getApiClient();

// --- 로컬 엔드포인트 상수 (프리픽스 /api/v1/re100 — client baseURL /api/v1) ---
const RE100_ACHIEVEMENTS = '/re100/achievements';
const RE100_PORTFOLIO = '/re100/portfolio';
const RE100_DESK = '/re100/desk';
const RE100_SUPPORT_ACTIVITIES = '/re100/support-activities';

// --- 이행수단 taxonomy (06 §13.0.2 인용, 변경 금지) ---
export type Measure =
  | 'PPA_DIRECT'
  | 'PPA_THIRD'
  | 'SELF_CONSUME'
  | 'REC'
  | 'GREEN_PREMIUM'
  | 'EQUITY';
export type EnergyType = 'RENEWABLE' | 'CARBON_FREE';
export type AchievementSource = 'SETTLEMENT' | 'REGISTERED';
export type DeskStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';

// GET /achievements?companyId&year[&energyType]
export interface Achievement {
  measure: Measure;
  quarter: number;
  mwh: number;
  source: AchievementSource;
  energyType: EnergyType;
}

// GET /achievements?companyId&latest=N
export interface AchievementLatest {
  measure: Measure;
  plantName: string;
  mwh: number;
  contribDeltaPct: number;
  confirmedAt: string;
}

// GET /achievements?companyId&refSettlementId
export interface AchievementContrib {
  contribPct: number;
}

// GET/POST /portfolio
export interface PortfolioLine {
  measure: Measure;
  plannedMWh: number;
  unitCost: number;
  cost: number;
  ghgReduction: number;
}
export interface Portfolio {
  targetYear: number;
  annualDemandMWh: number;
  measureMix: PortfolioLine[];
}

// desk 티켓 (06 §13.11.2 상태머신 OPEN→ANSWERED→CLOSED)
export interface DeskTicket {
  id: number;
  companyId: number;
  category: string;
  question: string;
  answer?: string;
  status: DeskStatus;
  createdAt: string;
  answeredAt?: string;
  assigneeId?: number;
}
export interface CreateDeskTicketRequest {
  companyId: number;
  category: string;
  question: string;
}

// support-activities (지표9 SoR, 09 §3)
export interface SupportActivity {
  activityType: string;
  refId?: number;
  title: string;
  occurredAt: string;
  countedYear: number;
  source: string;
}
export interface SupportActivitiesResponse {
  activities: SupportActivity[];
  counter: { yearCount: number; cumulative: number };
}

// --- 로컬 쿼리키 (그룹 배타 — re100ext 네임스페이스 하위) ---
export const achievementKeys = {
  all: ['re100', 'achievements'] as const,
  list: (companyId?: number, year?: number, energyType?: EnergyType) =>
    ['re100', 'achievements', 'list', companyId, year, energyType] as const,
  latest: (companyId?: number, latest?: number) =>
    ['re100', 'achievements', 'latest', companyId, latest] as const,
  contrib: (companyId?: number, refSettlementId?: number) =>
    ['re100', 'achievements', 'contrib', companyId, refSettlementId] as const,
  portfolio: (companyId?: number) => ['re100', 'portfolio', companyId] as const,
  desk: (companyId?: number, status?: DeskStatus) => ['re100', 'desk', companyId, status] as const,
  supportActivities: (year?: number) => ['re100', 'support-activities', year] as const,
};

// GET /achievements?companyId&year[&energyType] — 이행수단별 실적 (staleTime=0 되먹임)
export function useAchievements(companyId?: number, year?: number, energyType?: EnergyType) {
  return useQuery({
    queryKey: achievementKeys.list(companyId, year, energyType),
    queryFn: () => api().get<Achievement[]>(RE100_ACHIEVEMENTS, { companyId, year, energyType }),
    enabled: !!companyId && !!year,
    staleTime: 0,
    retry: false,
  });
}

// GET /achievements?companyId&latest=N — 최근 확정 정산 (홈 최근정산 위젯)
export function useAchievementsLatest(companyId?: number, latest = 3) {
  return useQuery({
    queryKey: achievementKeys.latest(companyId, latest),
    queryFn: () => api().get<AchievementLatest[]>(RE100_ACHIEVEMENTS, { companyId, latest }),
    enabled: !!companyId,
    staleTime: 0,
    retry: false,
  });
}

// GET /achievements?companyId&refSettlementId — 정산 연계 조회 (조인 금지 — 연계 키 조회만)
export function useAchievementContrib(companyId?: number, refSettlementId?: number) {
  return useQuery({
    queryKey: achievementKeys.contrib(companyId, refSettlementId),
    queryFn: () =>
      api().get<AchievementContrib>(RE100_ACHIEVEMENTS, { companyId, refSettlementId }),
    enabled: !!companyId && !!refSettlementId,
    staleTime: 0,
    retry: false,
  });
}

// GET /portfolio?companyId — measureMix (갭 처방 top1·measures 목표)
export function usePortfolio(companyId?: number) {
  return useQuery({
    queryKey: achievementKeys.portfolio(companyId),
    queryFn: () => api().get<Portfolio>(RE100_PORTFOLIO, { companyId }),
    enabled: !!companyId,
    retry: false,
  });
}

// GET /desk?companyId — 내 문의 목록
export function useDeskTickets(companyId?: number, status?: DeskStatus) {
  return useQuery({
    queryKey: achievementKeys.desk(companyId, status),
    queryFn: () => api().get<DeskTicket[]>(RE100_DESK, { companyId, status }),
    enabled: !!companyId,
    retry: false,
  });
}

// POST /desk — 문의 등록 (status=OPEN)
export function useCreateDeskTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDeskTicketRequest) => api().post<DeskTicket>(RE100_DESK, body),
    onSuccess: (_, { companyId }) =>
      qc.invalidateQueries({ queryKey: achievementKeys.desk(companyId) }),
  });
}

// GET /support-activities?year — 31건 카운터
export function useSupportActivities(year?: number) {
  return useQuery({
    queryKey: achievementKeys.supportActivities(year),
    queryFn: () => api().get<SupportActivitiesResponse>(RE100_SUPPORT_ACTIVITIES, { year }),
    enabled: !!year,
    retry: false,
  });
}

// --- 집계 유틸 (표시용 — 산식 재계산 아님, 응답 mwh 단순 합산) ---
export function sumMwhByMeasure(items: Achievement[] | undefined): Record<Measure, number> {
  const acc = {
    PPA_DIRECT: 0,
    PPA_THIRD: 0,
    SELF_CONSUME: 0,
    REC: 0,
    GREEN_PREMIUM: 0,
    EQUITY: 0,
  } as Record<Measure, number>;
  (items ?? []).forEach((a) => {
    if (a.measure in acc) acc[a.measure] += a.mwh ?? 0;
  });
  return acc;
}

// 3트랙 집계(06 §13.1.1-4): A=PPA_DIRECT+PPA_THIRD+SELF_CONSUME / B=REC+GREEN_PREMIUM / C=이행지원(별도)
export function trackMwh(items: Achievement[] | undefined): {
  A: number;
  B: number;
  total: number;
} {
  const m = sumMwhByMeasure(items);
  const A = m.PPA_DIRECT + m.PPA_THIRD + m.SELF_CONSUME;
  const B = m.REC + m.GREEN_PREMIUM;
  return { A, B, total: A + B };
}
