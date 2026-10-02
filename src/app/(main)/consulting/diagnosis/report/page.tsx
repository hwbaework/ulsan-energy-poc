'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Zap, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
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
import { useCreateConsultation, useDiagnosis } from '@/hooks/consulting/useConsultations';
import { useToastStore } from '@/stores/useToastStore';
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
  const { data: diagnosis, isLoading } = useDiagnosis(diagnosisId);
  // 컨설턴트 선택 단계는 없다 — 진단 결과에서 바로 컨설팅을 신청하면 내 컨설팅에 쌓인다
  const createConsultation = useCreateConsultation();
  const toast = useToastStore((s) => s.add);
  const [applying, setApplying] = useState(false);

  const result = useMemo(() => {
    if (!diagnosis) return null;
    return estimateFromConsultation(diagnosis);
  }, [diagnosis]);

  if (isLoading) {
    return (
      <div className="py-20 text-center text-sm text-slate-400">진단 결과를 불러오는 중...</div>
    );
  }

  if (!diagnosis || !result) {
    return (
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'RE100', path: '/re100' }, { label: '무료진단', path: '/consulting/diagnosis' }, { label: '진단 결과' }]} />
        <div className="rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.06] p-8 text-center">
          <p className="text-sm text-slate-400">진단 결과 없음</p>
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
  const handleApply = async () => {
    setApplying(true);
    try {
      await createConsultation.mutateAsync({
        clientCompanyId: diagnosis.companyId,
        clientCompanyName: diagnosis.companyName,
        origin: 'MARKETPLACE',
        domain: diagnosis.domain,
        diagnosisId: diagnosis.id,
      });
      toast('success', '컨설팅을 신청했습니다');
      router.push('/consulting/status');
    } catch {
      toast('error', '컨설팅 신청에 실패했습니다');
    } finally {
      setApplying(false);
    }
  };

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
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'RE100', path: '/re100' }, { label: '무료진단', path: '/consulting/diagnosis' }, { label: '진단 결과' }]} />
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">진단 결과</h1>
        <div className="flex items-center gap-2">
          <Badge variant="success">진단 완료</Badge>
          <Button size="sm" variant="secondary" onClick={handleDownloadPdf}>
            <Download size={13} className="mr-1.5" /> PDF 다운로드
          </Button>
        </div>
      </div>
      {/* 팝업이 아니라 페이지 */}
      <div className="max-w-4xl rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
        <div className="p-8 space-y-6">
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
                <span className={`text-xs mt-1 block ${gradeConfig.color}`}>{gradeConfig.label}</span>
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
                  <p className="text-xs text-slate-500">{item.label}</p>
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

          {/* 컨설팅 신청 */}
          <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] p-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-base font-semibold text-white">이 진단 결과로 컨설팅 신청</p>
              <p className="text-sm text-slate-400 mt-1">신청하면 내 컨설팅에서 진행 단계를 확인</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => router.push('/consulting/status')}>
                내 컨설팅
              </Button>
              <Button disabled={applying} onClick={handleApply}>
                {applying ? '신청 중...' : '컨설팅 신청'}
                <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
