export type MaturityGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export function getMaturityGrade(currentREPercent: number): MaturityGrade {
  if (currentREPercent >= 80) return 'A';
  if (currentREPercent >= 50) return 'B';
  if (currentREPercent >= 20) return 'C';
  if (currentREPercent >= 5) return 'D';
  return 'F';
}

export function getMaturityFlowType(grade: MaturityGrade): 'guided' | 'autonomous' | 'advanced' {
  if (grade === 'D' || grade === 'F') return 'guided';
  if (grade === 'B' || grade === 'C') return 'autonomous';
  return 'advanced';
}

export const MATURITY_GRADE_CONFIG: Record<
  MaturityGrade,
  { label: string; color: string; bgColor: string; description: string }
> = {
  A: {
    label: 'A등급 (우수)',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    description: 'RE100 이행이 상당히 진전된 상태입니다',
  },
  B: {
    label: 'B등급 (양호)',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    description: '기본적인 RE 전환이 이루어진 상태입니다',
  },
  C: {
    label: 'C등급 (보통)',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    description: 'RE 전환 초기 단계로 전문 컨설팅이 권장됩니다',
  },
  D: {
    label: 'D등급 (미흡)',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    description: 'RE 전환이 시급하며 전문가 가이드가 필요합니다',
  },
  F: {
    label: 'F등급 (위험)',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    description: '즉각적인 RE 전환 계획 수립이 필요합니다',
  },
};

/* ──────────────────────────────────────────────────────────────
 * 도메인별 진단 채점
 * 진입점(분야)만 다르고 결과가 RE% 하나로만 계산되던 문제를 해결.
 * 각 도메인의 수집 항목으로 0~100 성숙도 점수를 산출하고 등급으로 매핑한다.
 * ────────────────────────────────────────────────────────────── */

export interface DiagnosisScoreInput {
  domain?: string | null;
  currentREPercent?: number;
  currentRePercent?: number; // DB 네이밍 호환
  // 탄소감축
  carbonTargetPercent?: number;
  carbonMethods?: string[];
  etsParticipant?: boolean;
  cdpParticipant?: boolean;
  sbtiCommitted?: boolean;
  // 분산에너지
  existingDER?: string[];
  essInterest?: boolean;
  evChargerInterest?: boolean;
  rooftopArea?: number;
  peakDemand?: number;
}

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function computeDiagnosisScore(input: DiagnosisScoreInput): number {
  const domain = input.domain ?? 'RE100';

  if (domain === 'CARBON_REDUCTION') {
    // 탄소관리 성숙도: 과학기반 목표·공시·감축목표·감축수단
    let s = 0;
    if (input.sbtiCommitted) s += 22; // 과학기반 감축목표(SBTi)
    if (input.cdpParticipant) s += 16; // 탄소정보공개(CDP)
    if (input.etsParticipant) s += 12; // 배출권거래제(탄소회계 보유)
    const tgt = input.carbonTargetPercent ?? 0;
    s += tgt >= 50 ? 28 : tgt >= 30 ? 18 : tgt >= 10 ? 10 : 0; // 감축목표 야심도
    s += Math.min((input.carbonMethods?.length ?? 0) * 7, 22); // 현재 감축수단 다양성
    return clamp100(s);
  }

  if (domain === 'DISTRIBUTED_ENERGY') {
    // 분산자원 성숙도: 기존 도입자원 + 자가발전 잠재력 + 도입 의향
    let s = 0;
    s += Math.min((input.existingDER?.length ?? 0) * 16, 48); // 기존 분산자원 보유
    if (input.essInterest) s += 16;
    if (input.evChargerInterest) s += 12;
    const rooftop = input.rooftopArea ?? 0;
    const peak = input.peakDemand ?? 0;
    if (rooftop > 0 && peak > 0) {
      const potentialKw = rooftop / 10; // 약 10㎡당 1kW 가정
      const ratio = potentialKw / peak; // 피크수요 대비 자가발전 잠재 비율
      s += ratio >= 0.5 ? 24 : ratio >= 0.2 ? 14 : ratio >= 0.05 ? 6 : 0;
    }
    return clamp100(s);
  }

  // RE100 (기본): 현재 재생에너지 비율
  return clamp100(input.currentREPercent ?? input.currentRePercent ?? 0);
}

export function getDiagnosisGrade(input: DiagnosisScoreInput): MaturityGrade {
  const domain = input.domain ?? 'RE100';
  const score = computeDiagnosisScore(input);
  if (domain === 'RE100') return getMaturityGrade(score); // 80/50/20/5 임계 유지
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

const RE100_GRADE_DESCRIPTION: Record<MaturityGrade, string> = {
  A: 'RE100 이행이 상당히 진전된 상태입니다',
  B: '기본적인 RE 전환이 이루어진 상태입니다',
  C: 'RE 전환 초기 단계로 전문 컨설팅이 권장됩니다',
  D: 'RE 전환이 시급하며 전문가 가이드가 필요합니다',
  F: '즉각적인 RE 전환 계획 수립이 필요합니다',
};

const DOMAIN_GRADE_DESCRIPTION: Record<string, Record<MaturityGrade, string>> = {
  RE100: RE100_GRADE_DESCRIPTION,
  CARBON_REDUCTION: {
    A: '탄소관리 체계가 고도화된 상태입니다 (목표·공시·감축수단 확립)',
    B: '탄소감축 기반이 마련된 상태입니다',
    C: '탄소감축 초기 단계로 감축 전략 수립이 권장됩니다',
    D: '탄소관리 체계가 미흡하여 전문가 가이드가 필요합니다',
    F: '탄소배출 관리 체계 구축이 시급합니다',
  },
  DISTRIBUTED_ENERGY: {
    A: '분산자원 도입·운영이 성숙한 상태입니다',
    B: '분산자원 도입 기반이 마련된 상태입니다',
    C: '분산에너지 도입 초기 단계로 설계 컨설팅이 권장됩니다',
    D: '분산자원 도입이 미흡하여 전문가 가이드가 필요합니다',
    F: '분산에너지 도입 계획 수립이 시급합니다',
  },
};

export function getDomainGradeDescription(
  domain: string | null | undefined,
  grade: MaturityGrade,
): string {
  const table = DOMAIN_GRADE_DESCRIPTION[domain ?? 'RE100'] ?? RE100_GRADE_DESCRIPTION;
  return table[grade];
}

export const DOMAIN_METRIC_LABEL: Record<string, string> = {
  RE100: '재생에너지 비율',
  CARBON_REDUCTION: '탄소관리 성숙도',
  DISTRIBUTED_ENERGY: '분산자원 성숙도',
};
