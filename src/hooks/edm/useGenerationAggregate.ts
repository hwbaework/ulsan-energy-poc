'use client';

// 발전 실적 집계 — energy-backend GET /monitoring/plants/compare?from&to 배선.
// 감축량·자립률(지표3·8) 페이지가 자원별 실 발전량(MWh)을 소비한다.
// 설계 22 정직성: mock 폴백 금지 — 실데이터/빈/오류를 {data, isLive, isError}로 정확 노출.
// 경로는 공용 endpoints 수정 금지 정책에 따라 이 도메인 훅의 인라인 상수로 둔다.
import { useQuery } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';

const api = () => getApiClient();

// 인라인 경로 상수 — /monitoring/plants/compare (기간별 발전소 성능 비교).
// client(axios) baseURL 이 '/api/v1' 를 붙이므로 여기선 접두 없이(이중접두 /api/v1/api/v1 → 404 방지).
const PLANTS_COMPARE_PATH = '/monitoring/plants/compare';

// BE PlantPerformanceResponse 계약(필요 필드만).
interface ApiPlantPerformance {
  plantId: number;
  name: string;
  capacityKw: number | string;
  period: string;
  totalGenerationKwh: number | string;
}

export interface GenerationRow {
  plantId: number;
  name: string;
  capacityKw: number;
  generationMwh: number;
}

export interface GenerationAggregate {
  rows: GenerationRow[];
  totalGenerationMwh: number;
}

const EMPTY: GenerationAggregate = { rows: [], totalGenerationMwh: 0 };

// 기본 조회 구간 — 최근 12개월(연간 발전 실적). from/to는 yyyy-MM-dd.
function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

export function useGenerationAggregate(range?: { from: string; to: string }) {
  const { from, to } = range ?? defaultRange();
  const q = useQuery({
    queryKey: ['edm', 'generation-aggregate', from, to],
    queryFn: async () => await api().get<ApiPlantPerformance[]>(PLANTS_COMPARE_PATH, { from, to }),
    retry: false,
  });

  if (q.isSuccess && q.data) {
    const rows: GenerationRow[] = q.data.map((p) => ({
      plantId: p.plantId,
      name: p.name,
      capacityKw: Number(p.capacityKw) || 0,
      generationMwh: (Number(p.totalGenerationKwh) || 0) / 1000,
    }));
    const totalGenerationMwh = rows.reduce((s, r) => s + r.generationMwh, 0);
    return {
      data: { rows, totalGenerationMwh },
      isLive: true,
      isError: false,
      isLoading: q.isLoading,
    };
  }
  return { data: EMPTY, isLive: false, isError: q.isError, isLoading: q.isLoading };
}
