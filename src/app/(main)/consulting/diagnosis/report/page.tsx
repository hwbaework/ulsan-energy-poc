'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Zap, TrendingUp, AlertTriangle, ArrowRight, Star, CheckCircle2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SectionCard } from '@/components/features/SectionCard';
import {
  getMaturityGrade,
  MATURITY_GRADE_CONFIG,
  getDomainGradeDescription,
  DOMAIN_METRIC_LABEL,
  type MaturityGrade,
} from '@/lib/maturity';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useProfiles, useDiagnosis } from '@/hooks/consulting/useConsultations';
import { Download } from 'lucide-react';
import { exportDiagnosisReport } from '@/lib/utils/exportDiagnosisReport';

const GHG_FACTOR = 0.4781; // tCO2eq / MWh
const PPA_MARKET_PRICE = 116; // 원/kWh
const DEFAULT_ELEC_COST = 154; // 원/kWh
const CAPACITY_FACTOR = 0.16; // 태양광 이용률
const CAPEX_PER_KW = 1_200_000; // 원/kW
const ETS_PRICE = 9_000; // 원/tCO2eq (배출권 단가)
const CARBON_REDUCTION_RATE = 0.3; // 보수적 감축 잠재 비율
const SELF_GEN_COVER = 0.3; // 분산: 사용량 대비 권장 자가발전 커버율

const toEok = (won: number) => (won / 100_000_000).toFixed(1); // 원 → 억원

const DOMAIN_LABELS: Record<string, string> = {
  RE100: 'RE100 이행 전략',
  CARBON_REDUCTION: '탄소감축 전략',
  DISTRIBUTED_ENERGY: '분산에너지 전환',
};

// 도메인별로 수집 항목에 맞는 재무·로드맵 추정과 리스크/기회를 산출
function estimateFromConsultation(c: any): any {
  const domain = c.domain ?? 'RE100';
  const annualEnergyUsage = c.annualEnergyUsage ?? 0;
  const currentElecCost = c.currentElecCost ?? DEFAULT_ELEC_COST;
  const hasUserElecCost = !!c.currentElecCost;
  const annualGhgEmission = c.annualGhgEmission ?? Math.round(annualEnergyUsage * GHG_FACTOR);
  const currentRE = c.currentRePercent ?? 0;
  const maturityGrade = c.maturityGrade ?? null;

  const base = {
    domain,
    domainLabel: DOMAIN_LABELS[domain] ?? DOMAIN_LABELS.RE100,
    maturityGrade,
    currentRE,
    targetRE: 100,
    gap: 100 - currentRE,
    annualEnergyUsage,
    annualGhgEmission,
    currentElecCost,
    hasUserElecCost,
  };

  if (domain === 'CARBON_REDUCTION') {
    const reductionPotential = Math.round(annualGhgEmission * CARBON_REDUCTION_RATE);
    const etsExposure = annualGhgEmission * ETS_PRICE; // 원/년
    const etsSaving = reductionPotential * ETS_PRICE; // 원/년
    return {
      ...base,
      summaryMetrics: [
        { label: '연간 GHG 배출량', value: `${annualGhgEmission.toLocaleString()} tCO2eq`, isInput: true },
        { label: '감축 잠재량(30%)', value: `${reductionPotential.toLocaleString()} tCO2eq`, isInput: false },
        { label: '배출권 비용 노출', value: `${toEok(etsExposure)}억원/년`, isInput: false },
        { label: '감축 시 절감', value: `${toEok(etsSaving)}억원/년`, isInput: false },
        { label: '연간 에너지 사용량', value: `${annualEnergyUsage.toLocaleString()} MWh`, isInput: true },
        { label: '탄소관리 등급', value: maturityGrade ?? '-', isInput: false },
      ],
      risks: [
        '배출권거래제(ETS) 비용 부담 증가',
        'CBAM 등 탄소국경조정 대응 미비',
        '지속가능성 공시·CDP 의무 미충족 위험',
      ],
      opportunities: [
        '감축 수단 도입으로 배출권 비용 절감',
        'SBTi·CDP 대응으로 ESG 평가 향상',
        '재생에너지 전환과 연계한 Scope2 감축',
      ],
    };
  }

  if (domain === 'DISTRIBUTED_ENERGY') {
    const targetMWh = annualEnergyUsage * SELF_GEN_COVER;
    const recommendedKw = Math.round((targetMWh * 1000) / (8760 * CAPACITY_FACTOR));
    const annualSaving = Math.round(targetMWh * 1000 * currentElecCost); // 원/년
    const capex = recommendedKw * CAPEX_PER_KW;
    const paybackYears = annualSaving > 0 ? Math.round((capex / annualSaving) * 10) / 10 : 0;
    return {
      ...base,
      summaryMetrics: [
        { label: '연간 에너지 사용량', value: `${annualEnergyUsage.toLocaleString()} MWh`, isInput: true },
        { label: '권장 자가발전 용량', value: `${recommendedKw.toLocaleString()} kW`, isInput: false },
        { label: '예상 자가소비 절감', value: `${toEok(annualSaving)}억원/년`, isInput: false },
        { label: '분산자원 투자비', value: `${toEok(capex)}억원`, isInput: false },
        { label: '투자 회수 기간', value: `${paybackYears}년`, isInput: false },
        { label: '분산자원 성숙도', value: maturityGrade ?? '-', isInput: false },
      ],
      risks: ['계통 수용성·인허가 지연 위험', '피크·기본요금 부담 지속', '분산에너지 활성화 특별법 대응 미비'],
      opportunities: [
        '자가발전·ESS로 전력비·피크요금 절감',
        '잉여전력 거래·VPP 참여 수익화',
        'RE100·탄소감축과 연계 시너지',
      ],
    };
  }

  // RE100 (기본)
  const gap = 100 - currentRE;
  const requiredMWh = annualEnergyUsage * (gap / 100);
  const requiredCapacity = Math.round((requiredMWh * 1000) / (8760 * CAPACITY_FACTOR));
  const annualSaving = Math.round(annualEnergyUsage * 1000 * (currentElecCost - PPA_MARKET_PRICE)); // 원/년
  const totalCapex = requiredCapacity * CAPEX_PER_KW;
  const paybackYears = annualSaving > 0 ? Math.round((totalCapex / annualSaving) * 10) / 10 : 0;
  return {
    ...base,
    estimatedPpaCost: PPA_MARKET_PRICE,
    estimatedSaving: annualSaving,
    paybackYears,
    requiredCapacity,
    summaryMetrics: [
      { label: '연간 에너지 사용량', value: `${annualEnergyUsage.toLocaleString()} MWh`, isInput: true },
      { label: '연간 GHG 배출량', value: `${annualGhgEmission.toLocaleString()} tCO2eq`, isInput: false },
      { label: '필요 설비 용량', value: `${requiredCapacity.toLocaleString()} kW`, isInput: false },
      { label: '투자 회수 기간', value: `${paybackYears}년`, isInput: false },
      { label: 'PPA 예상 단가', value: `${PPA_MARKET_PRICE} 원/kWh`, isInput: false },
      { label: '현재 전기요금 단가', value: `${currentElecCost} 원/kWh`, isInput: hasUserElecCost },
      { label: '연간 예상 절감', value: `${toEok(annualSaving)}억원/년`, isInput: false },
      { label: '단가 차이', value: `${currentElecCost - PPA_MARKET_PRICE} 원/kWh`, isInput: false },
    ],
    risks: ['RE100 가입 기업 요구사항 미충족 위험', '공급망 탄소 규제 대응 필요', '전력 조달 비용 상승 가능성'],
    opportunities: ['PPA 계약을 통한 장기 전력비 절감', 'REC 구매 전략으로 단기 대응 가능', 'ESG 경영 평가 점수 향상'],
  };
}

export default function DiagnosisReportPage() {
  return (
    <Suspense>
      <DiagnosisReportContent />
    </Suspense>
  );
}

function DiagnosisReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const diagnosisId = Number(searchParams.get('id')) || 0;
  const referralCode = searchParams.get('referral');
  const alreadyMatched = searchParams.get('matched') === 'true';
  const { data: diagnosis, isLoading } = useDiagnosis(diagnosisId);
  const { data: profileData } = useProfiles();

  const RECOMMENDED_CONSULTANTS = useMemo(() => {
    const profiles = (profileData?.content ?? []) as any[];
    return profiles
      .filter((p: any) => p.userName)
      .sort((a: any, b: any) => (b.rating ?? 4.5) - (a.rating ?? 4.5))
      .slice(0, 2)
      .map((p: any) => ({
        id: p.id as number,
        name: p.userName as string,
        rating: (p.rating ?? 4.5) as number,
        matchScore: (p.matchScore || 80) as number,
        initial: (p.userName as string).charAt(0),
        type: 'independent' as const,
      }));
  }, [profileData]);

  const result = useMemo(() => {
    if (!diagnosis) return null;
    return estimateFromConsultation(diagnosis);
  }, [diagnosis]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative z-10 text-white text-sm">진단 결과를 불러오는 중...</div>
      </div>
    );
  }

  if (!diagnosis || !result) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.08] p-8 text-center">
          <p className="text-sm text-slate-400">진단 결과를 찾을 수 없습니다</p>
          <Button size="sm" className="mt-4" onClick={() => router.push('/consulting/diagnosis')}>
            진단 다시 시작하기
          </Button>
        </div>
      </div>
    );
  }

  // 저장된 도메인별 등급 우선 (구 레코드는 RE% 기반 폴백)
  const maturityGrade = (result.maturityGrade as MaturityGrade) ?? getMaturityGrade(result.currentRE);
  const gradeConfig = MATURITY_GRADE_CONFIG[maturityGrade];
  const gradeDescription = getDomainGradeDescription(result.domain, maturityGrade);
  const referralConsultant = RECOMMENDED_CONSULTANTS[0];

  const handleDownloadPdf = () => {
    exportDiagnosisReport({
      domainLabel: result.domainLabel,
      grade: maturityGrade,
      gradeLabel: gradeConfig.label,
      gradeDescription,
      metricLabel: DOMAIN_METRIC_LABEL[result.domain] ?? '재생에너지 비율',
      summaryMetrics: result.summaryMetrics,
      risks: result.risks,
      opportunities: result.opportunities,
      companyName: (diagnosis as any)?.companyName ?? undefined,
      contactName: (diagnosis as any)?.contactName ?? undefined,
    }).catch(() => undefined);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-2xl overflow-hidden">
        <div className="shrink-0 px-8 pt-5">
          <Breadcrumb
            items={[
              { label: '통합에너지 컨설팅', path: '/consulting' },
              { label: '무료 진단', path: '/consulting/diagnosis' },
              { label: '진단 결과' },
            ]}
          />
        </div>

        <div className="shrink-0 flex items-center justify-between border-b border-white/[0.06] px-8 py-5">
          <div>
            <Badge variant="success" className="mb-1">
              진단 완료
            </Badge>
            <h1 className="text-lg font-bold text-white">진단 결과 리포트</h1>
            <p className="mt-0.5 text-xs text-slate-400">AI 분석 결과를 바탕으로 맞춤형 전략을 제안합니다</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handleDownloadPdf}>
              <Download size={13} className="mr-1.5" /> PDF 다운로드
            </Button>
            <button
              onClick={() => router.push('/consulting')}
              className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              aria-label="닫기"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="rounded-xl bg-gradient-to-br from-primary/10 to-[#0d1520] ring-1 ring-white/[0.06] p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={18} className="text-primary" />
                  <span className="text-sm font-medium text-white">{result.domainLabel}</span>
                </div>
                <p className="text-xs text-slate-400">
                  {DOMAIN_METRIC_LABEL[result.domain] ?? '재생에너지 비율'} 기반 분석
                </p>
              </div>
              <div className="text-center">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full ${gradeConfig.bgColor} ring-2 ring-white/[0.08]`}
                >
                  <span className={`text-lg font-bold ${gradeConfig.color}`}>{maturityGrade}</span>
                </div>
                <span className={`text-[10px] mt-1 block ${gradeConfig.color}`}>{gradeConfig.label}</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {result.domain === 'RE100' && (
                <>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>현재 RE 비율</span>
                    <span>
                      {result.currentRE}% → 목표 {result.targetRE}%
                    </span>
                  </div>
                  <ProgressBar value={result.currentRE} />
                  <p className="text-xs text-slate-500">
                    목표 달성까지 <span className="text-amber-400 font-medium">{result.gap}%p</span> 추가 전환 필요
                  </p>
                </>
              )}
              <p className={`text-xs mt-2 ${gradeConfig.color}`}>{gradeDescription}</p>
            </div>
          </div>

          <SectionCard
            title="에너지 현황 요약"
            description="입력값 기반 AI 추정 · 실제 수치는 컨설팅 진행 시 정밀 진단됩니다"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {result.summaryMetrics.map((item: { label: string; value: string; isInput: boolean }, i: number) => (
                <div key={i} className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3 text-center">
                  <p className="text-[10px] text-slate-500">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
                  <p className="text-[9px] mt-0.5">
                    {item.isInput ? (
                      <span className="text-emerald-500">입력값</span>
                    ) : (
                      <span className="text-blue-400/60">추정</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SectionCard title="주요 리스크">
              <div className="space-y-3">
                {result.risks.map((risk: string, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                    <span className="text-sm text-slate-300">{risk}</span>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="기회 요인">
              <div className="space-y-3">
                {result.opportunities.map((opp: string, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <TrendingUp size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                    <span className="text-sm text-slate-300">{opp}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          {alreadyMatched ? (
            <div className="rounded-xl bg-gradient-to-r from-emerald-500/10 to-blue-500/10 ring-1 ring-emerald-500/20 p-6">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={20} className="text-emerald-400" />
                <p className="text-sm font-semibold text-emerald-400">컨설턴트 매칭 제안이 전송되었습니다</p>
              </div>
              <p className="text-xs text-slate-400">
                마켓플레이스에서 선택한 컨설턴트에게 진단 결과와 함께 매칭 제안이 자동 전송되었습니다. 제안서가 도착하면
                알림으로 안내드립니다.
              </p>
              <div className="flex gap-3 mt-4">
                <Button size="sm" onClick={() => router.push('/consulting')}>
                  컨설팅 홈으로
                </Button>
                <Button size="sm" variant="secondary" onClick={() => router.push('/consulting/status')}>
                  내 컨설팅 확인
                </Button>
              </div>
            </div>
          ) : referralCode && referralConsultant ? (
            <div className="rounded-xl bg-gradient-to-r from-emerald-500/10 to-blue-500/10 ring-1 ring-emerald-500/20 p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 size={20} className="text-emerald-400" />
                <p className="text-sm font-semibold text-emerald-400">컨설턴트 자동 매칭 완료</p>
              </div>

              <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                    {referralConsultant.initial}
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-semibold text-white">{referralConsultant.name} 컨설턴트</p>
                    <p className="text-xs text-slate-400 mt-0.5">{result.domainLabel} 전문</p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1">
                        <Star size={12} className="text-amber-400 fill-amber-400" />
                        <span className="text-xs text-slate-300">{referralConsultant.rating}</span>
                      </div>
                      <Badge variant="primary" className="text-[10px]">
                        매칭 {referralConsultant.matchScore}%
                      </Badge>
                    </div>
                  </div>
                  <UserCheck size={24} className="text-emerald-400/60" />
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] px-4 py-3">
                <p className="text-xs text-slate-400">
                  초대 링크를 통해 진단이 완료되어{' '}
                  <span className="text-emerald-400 font-medium">{referralConsultant.name}</span> 컨설턴트와 자동으로
                  매칭되었습니다. 바로 프로젝트 범위와 일정을 확인하세요.
                </p>
              </div>

              <Button
                className="mt-4 w-full"
                onClick={() =>
                  router.push(`/consulting/quote/request/${referralConsultant.id}?referral=${referralCode}`)
                }
              >
                견적 요청 및 계약 진행
                <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          ) : RECOMMENDED_CONSULTANTS.length > 0 ? (
            <SectionCard title="추천 독립 컨설턴트" description="AI 매칭 점수 기반 마켓플레이스 추천">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {RECOMMENDED_CONSULTANTS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => router.push(`/consulting/quote/request/${c.id}`)}
                    className="rounded-xl bg-white/[0.02] ring-1 ring-white/[0.06] p-4 text-center hover:ring-primary/30 transition-all"
                  >
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {c.initial}
                    </div>
                    <p className="mt-2 text-sm font-medium text-white">{c.name}</p>
                    <div className="mt-1 flex items-center justify-center gap-1">
                      <Star size={12} className="text-amber-400 fill-amber-400" />
                      <span className="text-xs text-slate-400">{c.rating}</span>
                    </div>
                    <Badge variant="primary" className="mt-2 text-[10px]">
                      매칭 {c.matchScore}%
                    </Badge>
                  </button>
                ))}
              </div>
              <div className="mt-4 px-6 pb-2">
                <Button variant="secondary" className="w-full" onClick={() => router.push('/consulting/marketplace')}>
                  마켓플레이스에서 더 찾아보기
                  <ArrowRight size={14} className="ml-1" />
                </Button>
              </div>
            </SectionCard>
          ) : (
            <SectionCard title="추천 컨설턴트">
              <div className="py-8 text-center">
                <p className="text-sm text-slate-500">등록된 컨설턴트가 아직 없습니다</p>
              </div>
            </SectionCard>
          )}

          {!referralCode && !alreadyMatched && (
            <>
              <div className="flex justify-center">
                <Button size="lg" onClick={() => router.push('/consulting/marketplace')}>
                  컨설턴트 상세 비교하기
                  <ArrowRight size={16} className="ml-1" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
