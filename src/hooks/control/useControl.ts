'use client';

// 통합관제 — energy-backend /api/v1/control 배선. 설계문서 17.
// 프로덕션 mock 폴백 제거(캐논 useGhg 패턴): 조회 훅은 실데이터/빈/오류 상태를 정확히 노출.
// isLive = 실데이터 성공. isError = 호출 실패(인증만료·네트워크). 회사 미귀속은 페이지가 companyId로 판정.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';

const api = () => getApiClient();

export interface SopEvent {
  id: number;
  event: string;
  matchedSop: string;
  operator: string;
  status: string;
  at: string;
  currentStep?: number;
  sourceAnomalyId?: number;
  timeline?: string;
}
export interface PredictAsset {
  id: number;
  facility: string;
  current: number;
  healthIndex: number;
  rul: number;
  status: string;
}
export interface PredictSignal {
  id: number;
  facility: string;
  symptom: string;
  predictedAt: string;
  recommendation: string;
}
export interface SafetyAlert {
  id: number;
  type: string;
  facility: string;
  level: string;
  at: string;
}

// ── 전기안전 진단 (ITS API-006 최신 / API-007 이력) — data.items[] ──
// 참조: ITS_울산_에자자_수집데이터_API_명세서 v1.2.
export type SafetyRiskLevel = 'normal' | 'caution' | 'warning';
/** 항목별 위험 점수 키: 전류·전압·누설·고조파·온도·전력품질·아크 */
export type SafetyRiskKey =
  | 'current'
  | 'voltage'
  | 'leakage'
  | 'harmonic'
  | 'temperature'
  | 'powerQuality'
  | 'arc';

export interface SafetyItem {
  /** 행 키 (API 필드 아님) */
  id: number;
  /** 진단 산출 시각 (API: diagnosedAt) */
  diagnosedAt: string;
  /** 발전소 코드 (API: plantCode = LASEE 발전소 ID). 회사 스코프 필터용 */
  plantId: number;
  /** 발전소명 (API: plantName) */
  plantName: string;
  /** 전기안전지수 0~100 (API: safetyIndex) */
  safetyIndex: number;
  /** 위험 등급 normal/caution/warning (API: riskLevel) */
  riskLevel: SafetyRiskLevel;
  /** 이상 점수 (API: anomalyScore) */
  anomalyScore?: number;
  /** 항목별 위험 점수 — 각 항목 Double (API: risks) */
  risks?: Partial<Record<SafetyRiskKey, number>>;
  /** 산출 근거 객체 (API: reason, 예: { summary }) */
  reason?: { summary?: string; [k: string]: unknown };
}
export interface Inspection {
  id: number;
  target: string;
  type: string;
  scheduled: string;
  status: string;
}
export interface SopScenario {
  id: number;
  type: string;
  steps: string[];
  active: boolean;
}
export interface SafetyMapRow {
  id: number;
  site: string;
  facilities: number;
  risk: string;
  overheat: number;
  smoke: number;
}
export interface SafetyRule {
  id: number;
  name: string;
  version: string;
  updatedAt: string;
}

export interface ListResult<T> {
  data: T[];
  isLoading: boolean;
  isLive: boolean;
  isError: boolean;
}

function useList<T>(key: string, endpoint: string, companyId?: number): ListResult<T> {
  const q = useQuery({
    queryKey: ['control', key, companyId],
    queryFn: async () => await api().get<T[]>(endpoint, { companyId }),
    enabled: !!companyId,
    retry: false,
  });
  return {
    data: (q.data ?? []) as T[],
    isLoading: q.isLoading,
    isLive: q.isSuccess,
    isError: q.isError,
  };
}

export const useSopEvents = (companyId?: number) =>
  useList<SopEvent>('sop', ENDPOINTS.control.sopEvents, companyId);
export const usePredictAssets = (companyId?: number) =>
  useList<PredictAsset>('assets', ENDPOINTS.control.predictAssets, companyId);
export const usePredictSignals = (companyId?: number) =>
  useList<PredictSignal>('signals', ENDPOINTS.control.predictSignals, companyId);
export const useSafetyAlerts = (companyId?: number) =>
  useList<SafetyAlert>('alerts', ENDPOINTS.control.safetyAlerts, companyId);
export const useSafetyItems = (companyId?: number) =>
  useList<SafetyItem>('safetyItems', ENDPOINTS.control.safetyItems, companyId);
export const useInspections = (companyId?: number) =>
  useList<Inspection>('inspections', ENDPOINTS.control.inspections, companyId);
export const useSopScenarios = (companyId?: number) =>
  useList<SopScenario>('scenarios', ENDPOINTS.control.sopScenarios, companyId);
export const useSafetyMap = (companyId?: number) =>
  useList<SafetyMapRow>('safetymap', ENDPOINTS.control.safetyMap, companyId);
export const useSafetyRules = (companyId?: number) =>
  useList<SafetyRule>('safetyrules', ENDPOINTS.control.safetyRules, companyId);

// ── 안전 점검 CRUD (05 §S10-1) — control_inspection 원장 (POST/PUT/DELETE) ──
// 상태 전이: 예정 → 진행 → 완료 (역행 금지 — BE 400). FE는 역행 옵션 비활성으로 선제 차단.
export const INSPECTION_STATUS_FLOW = ['예정', '진행', '완료'] as const;
export type InspectionStatus = (typeof INSPECTION_STATUS_FLOW)[number];
export const INSPECTION_TYPES = ['정기', '특별', '법정', '일상'] as const;

export interface InspectionInput {
  target: string;
  type: string;
  scheduled: string;
  status: string;
  note?: string;
}

const inspectionUrl = (id?: number) =>
  id != null ? `${ENDPOINTS.control.inspections}/${id}` : ENDPOINTS.control.inspections;

/** 안전 점검 등록 — onSuccess 시 목록 무효화. */
export const useCreateInspection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: InspectionInput) => api().post<Inspection>(inspectionUrl(), body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['control', 'inspections'] });
    },
  });
};

/** 안전 점검 수정 — 상태 전이 제약은 서버 검증(역행 400), FE는 선제 비활성. */
export const useUpdateInspection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: InspectionInput }) =>
      api().put<Inspection>(inspectionUrl(id), body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['control', 'inspections'] });
    },
  });
};

/** 안전 점검 삭제. */
export const useDeleteInspection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api().delete<void>(inspectionUrl(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['control', 'inspections'] });
    },
  });
};

// ── 관제 루프 브리지 (기획 02 §11) — 승격·워크플로 전이·종료 ──
function useSopMutation(fn: (id: number) => string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api().post<SopEvent>(fn(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['control'] });
      qc.invalidateQueries({ queryKey: ['anomalies'] });
    },
  });
}

/** 이상 이벤트 → DiSOP 승격 (HIGH/CRITICAL 한정, 원 이벤트 IN_PROGRESS 연동). */
export const usePromoteAnomaly = () => useSopMutation(ENDPOINTS.control.promoteAnomaly);
/** SOP 워크플로 다음 단계 전이 (마지막 단계 도달 시 자동 종료). */
export const useAdvanceSop = () => useSopMutation(ENDPOINTS.control.sopAdvance);
/** SOP 상황 종료 — 원 이벤트 resolve 역연동. */
export const useCloseSop = () => useSopMutation(ENDPOINTS.control.sopClose);

// ── V105: SOP 조치 이력 (설비관제·조치 이력) — 상태전이 자동 기록 원장 (빈=빈상태) ──
export interface SopAction {
  id: number;
  sopEventId: number;
  action: string;
  actorUserId?: number;
  fromStatus?: string;
  toStatus: string;
  note?: string;
  at?: string;
}

/** SOP 조치 이력 조회 — sopEventId 기준. 비면 빈배열(정직한 빈상태). */
export const useSopActions = (sopEventId?: number): ListResult<SopAction> => {
  const q = useQuery({
    queryKey: ['control', 'sopActions', sopEventId],
    queryFn: async () =>
      await api().get<SopAction[]>(ENDPOINTS.control.sopActions(sopEventId as number)),
    enabled: !!sopEventId,
    retry: false,
  });
  return {
    data: (q.data ?? []) as SopAction[],
    isLoading: q.isLoading,
    isLive: q.isSuccess,
    isError: q.isError,
  };
};

// ── V107: 예지보전 실시간 계측 (실시간 전류·온도 추이) — 시계열 (계측 대기 시 빈) ──
export interface PredictReading {
  id: number;
  assetId: number;
  readingTs: string;
  currentA: number | null;
  tempC: number | null;
}

/** 자산별 실시간 계측 추이 — 최근 hours 시간. 비면 빈배열(실시간 계측 수신 대기). */
export const usePredictReadings = (assetId?: number, hours = 24): ListResult<PredictReading> => {
  const q = useQuery({
    queryKey: ['control', 'predictReadings', assetId, hours],
    queryFn: async () =>
      await api().get<PredictReading[]>(ENDPOINTS.control.predictReadings(assetId as number), {
        hours,
      }),
    enabled: !!assetId,
    retry: false,
  });
  return {
    data: (q.data ?? []) as PredictReading[],
    isLoading: q.isLoading,
    isLive: q.isSuccess,
    isError: q.isError,
  };
};
