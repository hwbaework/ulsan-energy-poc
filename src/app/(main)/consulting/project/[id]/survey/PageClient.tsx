'use client';

import { Suspense, useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  Zap,
  Leaf,
  Sun,
  ArrowLeft,
  ArrowRight,
  HelpCircle,
  CheckCircle,
  Building2,
  Globe,
  Target,
  Wallet,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import type { ConsultationDomain, DiagnosisForm } from '@/types/consultation';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useSurvey, useCreateSurvey, useConsultation, useTransitionStatus } from '@/hooks/consulting/useConsultations';
import { useToastStore } from '@/stores/useToastStore';

const COMPANY_SIZES = ['소기업 (50인 미만)', '중기업 (50~300인)', '대기업 (300인 이상)'];
const INDUSTRIES = [
  '제조업',
  '전자/반도체',
  '화학/소재',
  '건설/건축',
  '물류/유통',
  'IT/서비스',
  '식품/음료',
  '섬유/의류',
  '기타',
];
const TIMELINES = ['1년 이내', '1~3년', '3~5년', '5년 이상'];
const RE_METHODS = [
  '자가발전 (태양광 등)',
  'PPA (전력구매계약)',
  'REC (신재생에너지 인증서)',
  '녹색프리미엄',
  '해당 없음',
];
const CONSULTING_DRIVERS = [
  'RE100 가입/이행 의무',
  '수출 규제 대응 (CBAM)',
  '고객사 요구',
  'ESG 경영/평가',
  '비용 절감',
  '자발적 전환',
];
const BUDGET_RANGES = ['1,000만원 미만', '1,000~3,000만원', '3,000~5,000만원', '5,000만원~1억원', '1억원 이상', '미정'];
const CARBON_METHODS = [
  '고효율 설비 교체',
  '공정 개선',
  '연료 전환',
  '폐열 회수',
  '재생에너지 전환',
  'CCS/CCU',
  '해당 없음',
];
const EXISTING_DER = ['태양광 (PV)', 'ESS (배터리)', '풍력', '연료전지', 'EV 충전기', '해당 없음'];
const GRID_TYPES = ['고압 수전 (22.9kV)', '특고압 수전 (154kV)', '저압 수전', '자가발전 병행', '모름'];

type SurveyForm = Omit<
  DiagnosisForm,
  'domain' | 'contactName' | 'contactEmail' | 'contactPhone' | 'companyName' | 'referralCode'
>;

const INITIAL_FORM: SurveyForm = {
  companySize: '',
  industry: '',
  currentREPercent: 0,
  targetTimeline: '',
  currentREMethods: [],
  consultingDrivers: [],
};

export default function SurveyPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">로딩 중...</div>}>
      <SurveyContent />
    </Suspense>
  );
}

function SurveyContent() {
  const { id } = useParams<{ id: string }>();
  const consultationId = Number(id);
  const router = useRouter();
  const searchParams = useSearchParams();
  const origin = searchParams.get('origin') ?? 'marketplace';
  const toast = useToastStore((s) => s.add);

  const { data: existingSurvey, isLoading: surveyLoading } = useSurvey(consultationId);
  const { data: consultation, isLoading: consultationLoading } = useConsultation(consultationId);
  const createSurvey = useCreateSurvey();
  const transitionStatus = useTransitionStatus();

  const c = (consultation ?? {}) as any;
  const domain: ConsultationDomain = c.domain ?? 'RE100';

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<SurveyForm>({ ...INITIAL_FORM });
  const [autoFilled, setAutoFilled] = useState(false);

  useEffect(() => {
    if (consultationLoading || surveyLoading) return;

    const s = existingSurvey as any;
    if (s) {
      setForm((prev) => ({
        ...prev,
        companySize: c.companySize || prev.companySize,
        industry: c.industry || prev.industry,
        currentREPercent: c.currentRePercent ?? prev.currentREPercent,
        targetTimeline: c.targetTimeline || prev.targetTimeline,
        annualEnergyUsage: s.annualEnergyUsage ?? s.totalEnergyUsage ?? prev.annualEnergyUsage,
        annualElectricityUsage: s.annualElectricityUsage ?? prev.annualElectricityUsage,
        annualGasUsage: s.annualGasUsage ?? prev.annualGasUsage,
        annualGhgEmission: s.annualGhgEmission ?? s.totalGhgEmission ?? prev.annualGhgEmission,
        currentElecCost: s.currentElecCost ?? prev.currentElecCost,
        employeeCount: s.employeeCount ?? prev.employeeCount,
        annualRevenue: s.annualRevenue ?? prev.annualRevenue,
        siteCount: s.siteCount ?? prev.siteCount,
        siteRegions: s.siteRegions ?? prev.siteRegions,
        currentREMethods: s.currentREMethods
          ? Array.isArray(s.currentREMethods)
            ? s.currentREMethods
            : typeof s.currentREMethods === 'string' && s.currentREMethods.startsWith('[')
              ? JSON.parse(s.currentREMethods)
              : s.currentREMethods.split(',')
          : prev.currentREMethods,
        consultingDrivers: s.consultingDrivers
          ? Array.isArray(s.consultingDrivers)
            ? s.consultingDrivers
            : typeof s.consultingDrivers === 'string' && s.consultingDrivers.startsWith('[')
              ? JSON.parse(s.consultingDrivers)
              : s.consultingDrivers.split(',')
          : prev.consultingDrivers,
        budgetRange: s.budgetRange ?? prev.budgetRange,
        exportCountries: s.exportCountries
          ? Array.isArray(s.exportCountries)
            ? s.exportCountries.join(', ')
            : typeof s.exportCountries === 'string' && s.exportCountries.startsWith('[')
              ? JSON.parse(s.exportCountries).join(', ')
              : s.exportCountries
          : prev.exportCountries,
        scope1Emission: s.scope1Emission ?? prev.scope1Emission,
        scope2Emission: s.scope2Emission ?? prev.scope2Emission,
        scope3Emission: s.scope3Emission ?? prev.scope3Emission,
        carbonTargetPercent: s.carbonTargetPercent ?? prev.carbonTargetPercent,
        carbonMethods: s.carbonMethods
          ? Array.isArray(s.carbonMethods)
            ? s.carbonMethods
            : typeof s.carbonMethods === 'string' && s.carbonMethods.startsWith('[')
              ? JSON.parse(s.carbonMethods)
              : s.carbonMethods.split(',')
          : prev.carbonMethods,
        etsParticipant: s.etsParticipant ?? prev.etsParticipant,
        cdpParticipant: s.cdpParticipant ?? prev.cdpParticipant,
        sbtiCommitted: s.sbtiCommitted ?? prev.sbtiCommitted,
        rooftopArea: s.rooftopArea ?? prev.rooftopArea,
        peakDemand: s.peakDemand ?? prev.peakDemand,
        monthlyPeakCost: s.monthlyPeakCost ?? prev.monthlyPeakCost,
        existingDER: s.existingDER
          ? Array.isArray(s.existingDER)
            ? s.existingDER
            : typeof s.existingDER === 'string' && s.existingDER.startsWith('[')
              ? JSON.parse(s.existingDER)
              : s.existingDER.split(',')
          : prev.existingDER,
        gridType: s.gridType ?? prev.gridType,
        essInterest: s.essInterest ?? prev.essInterest,
        evChargerInterest: s.evChargerInterest ?? prev.evChargerInterest,
      }));
      setAutoFilled(true);
      return;
    }

    if (c.industry || c.companySize) {
      setForm((prev) => ({
        ...prev,
        companySize: c.companySize || prev.companySize,
        industry: c.industry || prev.industry,
        currentREPercent: c.currentRePercent ?? prev.currentREPercent,
        targetTimeline: c.targetTimeline || prev.targetTimeline,
        annualEnergyUsage: c.annualEnergyUsage ?? prev.annualEnergyUsage,
        currentElecCost: c.currentElecCost ?? prev.currentElecCost,
        annualGhgEmission: c.annualGhgEmission ?? prev.annualGhgEmission,
        budgetRange: c.budgetRange ?? prev.budgetRange,
        currentREMethods: c.currentReMethods ? c.currentReMethods.split(',') : prev.currentREMethods,
        consultingDrivers: c.consultingDrivers ? c.consultingDrivers.split(',') : prev.consultingDrivers,
        exportCountries: c.exportCountries
          ? Array.isArray(c.exportCountries)
            ? c.exportCountries.join(', ')
            : c.exportCountries
          : prev.exportCountries,
        siteCount: c.siteCount ?? prev.siteCount,
        siteRegions: c.siteRegions ?? prev.siteRegions,
        annualRevenue: c.annualRevenue ?? prev.annualRevenue,
        employeeCount: c.employeeCount ?? prev.employeeCount,
      }));
      setAutoFilled(true);
    }
  }, [
    consultationLoading,
    surveyLoading,
    existingSurvey,
    c.industry,
    c.companySize,
    c.currentRePercent,
    c.targetTimeline,
    c.annualEnergyUsage,
    c.currentElecCost,
    c.annualGhgEmission,
    c.budgetRange,
    c.currentReMethods,
    c.consultingDrivers,
    c.exportCountries,
    c.siteCount,
    c.siteRegions,
    c.annualRevenue,
    c.employeeCount,
  ]);

  const STEP_TITLES = ['기업 현황', 'RE 현황', '확인'];

  const validateStep = (s: number): Record<string, string> => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!form.companySize) e.companySize = '기업 규모를 선택하세요';
      if (!form.industry) e.industry = '업종을 선택하세요';
      if (!form.annualEnergyUsage || form.annualEnergyUsage <= 0) e.annualEnergyUsage = '연간 전력 사용량을 입력하세요';
      if (form.annualEnergyUsage && form.annualEnergyUsage > 10_000_000)
        e.annualEnergyUsage = '사용량이 너무 큽니다 (최대 10,000,000 MWh)';
    }
    if (s === 1) {
      if (!form.currentREMethods || form.currentREMethods.length === 0)
        e.currentREMethods = 'RE 조달 방식을 최소 1개 선택하세요';
      if (!form.targetTimeline) e.targetTimeline = '목표 달성 기간을 선택하세요';
    }
    return e;
  };

  const handleNext = () => {
    const stepErrors = validateStep(step);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    setStep(step + 1);
  };

  const canNext =
    (step === 0 && form.companySize && form.industry && form.annualEnergyUsage) ||
    (step === 1 && form.currentREMethods && form.currentREMethods.length > 0 && form.targetTimeline) ||
    step === 2;

  const buildPayload = () => {
    const countries = form.exportCountries
      ? JSON.stringify(
          form.exportCountries
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        )
      : null;
    return {
      totalEnergyUsage: form.annualEnergyUsage ?? null,
      totalGhgEmission: form.annualGhgEmission ?? null,
      exportCountries: countries,
      annualEnergyUsage: form.annualEnergyUsage ?? null,
      annualElectricityUsage: form.annualElectricityUsage ?? null,
      annualGasUsage: form.annualGasUsage ?? null,
      annualGhgEmission: form.annualGhgEmission ?? null,
      currentElecCost: form.currentElecCost ?? null,
      employeeCount: form.employeeCount ?? null,
      annualRevenue: form.annualRevenue ?? null,
      siteCount: form.siteCount ?? null,
      siteRegions: form.siteRegions || null,
      currentREMethods: form.currentREMethods?.length ? JSON.stringify(form.currentREMethods) : null,
      consultingDrivers: form.consultingDrivers?.length ? JSON.stringify(form.consultingDrivers) : null,
      budgetRange: form.budgetRange || null,
      scope1Emission: form.scope1Emission ?? null,
      scope2Emission: form.scope2Emission ?? null,
      scope3Emission: form.scope3Emission ?? null,
      carbonTargetPercent: form.carbonTargetPercent ?? null,
      carbonMethods: form.carbonMethods?.length ? JSON.stringify(form.carbonMethods) : null,
      etsParticipant: form.etsParticipant ?? null,
      cdpParticipant: form.cdpParticipant ?? null,
      sbtiCommitted: form.sbtiCommitted ?? null,
      rooftopArea: form.rooftopArea ?? null,
      peakDemand: form.peakDemand ?? null,
      monthlyPeakCost: form.monthlyPeakCost ?? null,
      existingDER: form.existingDER?.length ? JSON.stringify(form.existingDER) : null,
      gridType: form.gridType || null,
      essInterest: form.essInterest ?? null,
      evChargerInterest: form.evChargerInterest ?? null,
    };
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      await createSurvey.mutateAsync({
        consultationId,
        data: buildPayload(),
      });
      if (c.status === 'ASSIGNED' || c.status === 'SURVEYING') {
        try {
          await transitionStatus.mutateAsync({ consultationId, status: 'VISITING' });
          toast('success', '설문이 완료되었습니다. 현장 방문 단계로 진행합니다.');
        } catch {
          toast('success', '설문이 저장되었습니다');
        }
      } else {
        toast('success', '설문이 저장되었습니다');
      }
      router.push(`/consulting/project/${id}?origin=${origin}`);
    } catch (err: any) {
      setSubmitting(false);
      setSubmitError(err?.message || '설문 저장에 실패했습니다.');
    }
  };

  const handleSave = () => {
    createSurvey.mutate(
      { consultationId, data: buildPayload() },
      {
        onSuccess: () => toast('success', '설문이 임시 저장되었습니다'),
        onError: () => toast('error', '설문 저장에 실패했습니다'),
      },
    );
  };

  const toggleArrayItem = (
    key: 'currentREMethods' | 'consultingDrivers' | 'carbonMethods' | 'existingDER',
    value: string,
  ) => {
    setForm((prev) => {
      const arr = (prev[key] as string[] | undefined) ?? [];
      return { ...prev, [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] };
    });
  };

  const DOMAIN_LABELS: Record<string, string> = {
    RE100: 'RE100 이행 전략',
    CARBON_REDUCTION: '탄소감축',
    DISTRIBUTED_ENERGY: '분산에너지',
  };

  if (surveyLoading || consultationLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-2xl mx-4 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-2xl overflow-hidden">
        <div className="px-8 pt-5">
          <Breadcrumb
            items={[
              { label: '통합에너지 컨설팅', path: '/consulting' },
              { label: '프로젝트', path: `/consulting/project/${id}?origin=${origin}` },
              { label: '설문 조사' },
            ]}
          />
        </div>

        <div className="flex items-center justify-between border-b border-white/[0.06] px-8 py-5">
          <div>
            <h1 className="text-xl font-bold text-white">에너지 현황 설문</h1>
            <p className="mt-0.5 text-xs text-slate-400">
              {DOMAIN_LABELS[domain] ?? domain} · 3단계로 에너지 현황을 입력합니다
            </p>
          </div>
          <button
            onClick={() => router.push(`/consulting/project/${id}?origin=${origin}`)}
            className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="닫기"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {autoFilled && (
          <div className="mx-8 mt-4 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 p-4 flex items-center gap-3">
            <CheckCircle size={20} className="text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-400">
                {existingSurvey ? '기존 설문 데이터가 불러와졌습니다' : '컨설팅 신청 정보가 자동으로 채워졌습니다'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">수정이 필요한 항목을 변경한 후 제출하세요</p>
            </div>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex items-center gap-0 border-b border-white/[0.06]">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors border-b-2',
                i === step && 'border-primary text-primary bg-primary/[0.04]',
                i < step && 'border-emerald-500/50 text-emerald-400',
                i > step && 'border-transparent text-slate-500',
              )}
            >
              <div
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold',
                  i === step && 'bg-primary/20 text-primary',
                  i < step && 'bg-emerald-500/20 text-emerald-400',
                  i > step && 'bg-white/[0.04] text-slate-500',
                )}
              >
                {i < step ? '✓' : i + 1}
              </div>
              {STEP_TITLES[i]}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="px-8 py-6 max-h-[60vh] overflow-y-auto">
          {/* Step 0: Company Profile */}
          {step === 0 && (
            <div className="space-y-6">
              <h2 className="text-base font-semibold text-white">기업 현황을 알려주세요</h2>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <Building2 size={12} /> 기본 정보
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-400">
                    기업 규모 <span className="text-primary">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {COMPANY_SIZES.map((size) => (
                      <button
                        key={size}
                        onClick={() => {
                          setForm({ ...form, companySize: size });
                          setErrors((e) => {
                            const { companySize: _, ...rest } = e;
                            return rest;
                          });
                        }}
                        className={cn(
                          'rounded-lg px-3 py-2.5 text-xs ring-1 transition-colors',
                          form.companySize === size
                            ? 'bg-primary/10 ring-primary/40 text-primary'
                            : 'bg-white/[0.02] ring-white/[0.06] text-slate-400 hover:ring-white/[0.12]',
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                  {errors.companySize && <p className="text-xs text-rose-400">{errors.companySize}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-400">
                    업종 <span className="text-primary">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {INDUSTRIES.map((ind) => (
                      <button
                        key={ind}
                        onClick={() => {
                          setForm({ ...form, industry: ind });
                          setErrors((e) => {
                            const { industry: _, ...rest } = e;
                            return rest;
                          });
                        }}
                        className={cn(
                          'rounded-lg px-3 py-2.5 text-xs ring-1 transition-colors',
                          form.industry === ind
                            ? 'bg-primary/10 ring-primary/40 text-primary'
                            : 'bg-white/[0.02] ring-white/[0.06] text-slate-400 hover:ring-white/[0.12]',
                        )}
                      >
                        {ind}
                      </button>
                    ))}
                  </div>
                  {errors.industry && <p className="text-xs text-rose-400">{errors.industry}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="직원 수"
                    type="number"
                    placeholder="예: 250"
                    value={form.employeeCount ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, employeeCount: e.target.value ? Number(e.target.value) : undefined })
                    }
                  />
                  <Input
                    label="연매출 (억원)"
                    type="number"
                    placeholder="예: 500"
                    value={form.annualRevenue ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, annualRevenue: e.target.value ? Number(e.target.value) : undefined })
                    }
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <Zap size={12} /> 에너지 사용 현황
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-400">
                      연간 전력 사용량 (MWh) <span className="text-primary">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="예: 15000"
                        value={form.annualEnergyUsage ?? ''}
                        onChange={(e) => {
                          setForm({ ...form, annualEnergyUsage: e.target.value ? Number(e.target.value) : undefined });
                          setErrors((prev) => {
                            const { annualEnergyUsage: _, ...rest } = prev;
                            return rest;
                          });
                        }}
                      />
                      <div className="group absolute right-3 top-1/2 -translate-y-1/2">
                        <HelpCircle size={14} className="text-slate-500 cursor-help" />
                        <div className="invisible group-hover:visible absolute bottom-full right-0 mb-2 w-52 rounded-lg bg-[#0d1520] ring-1 ring-white/[0.1] p-3 text-[11px] text-slate-400 shadow-xl z-10">
                          한전 전기요금 고지서의 &apos;사용량(kWh)&apos; × 12개월로 산출할 수 있습니다.
                        </div>
                      </div>
                    </div>
                    {errors.annualEnergyUsage && <p className="text-xs text-rose-400">{errors.annualEnergyUsage}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-400">현재 전기요금 단가 (원/kWh)</label>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="예: 154"
                        value={form.currentElecCost ?? ''}
                        onChange={(e) =>
                          setForm({ ...form, currentElecCost: e.target.value ? Number(e.target.value) : undefined })
                        }
                      />
                      <div className="group absolute right-3 top-1/2 -translate-y-1/2">
                        <HelpCircle size={14} className="text-slate-500 cursor-help" />
                        <div className="invisible group-hover:visible absolute bottom-full right-0 mb-2 w-52 rounded-lg bg-[#0d1520] ring-1 ring-white/[0.1] p-3 text-[11px] text-slate-400 shadow-xl z-10">
                          고지서의 &apos;청구금액 ÷ 사용량&apos;으로 산출합니다. 모르면 비워두세요.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="연간 가스 사용량 (TJ)"
                    type="number"
                    placeholder="예: 3.5"
                    value={form.annualGasUsage ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, annualGasUsage: e.target.value ? Number(e.target.value) : undefined })
                    }
                  />
                  <Input
                    label="온실가스 배출량 (tCO2eq)"
                    type="number"
                    placeholder="Scope 1+2 기준"
                    hint="모르면 비워두세요. 전력 사용량으로 추정합니다."
                    value={form.annualGhgEmission ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, annualGhgEmission: e.target.value ? Number(e.target.value) : undefined })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="사업장 수"
                    type="number"
                    placeholder="예: 3"
                    value={form.siteCount ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, siteCount: e.target.value ? Number(e.target.value) : undefined })
                    }
                  />
                  <Input
                    label="사업장 지역"
                    placeholder="예: 울산, 사천, 마산"
                    value={form.siteRegions ?? ''}
                    onChange={(e) => setForm({ ...form, siteRegions: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 1: RE Status & Goals + Domain-specific */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-base font-semibold text-white">재생에너지 현황 및 목표</h2>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <Zap size={12} /> 현재 재생에너지 조달
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-400">
                    현재 재생에너지 비율: <span className="text-primary font-bold">{form.currentREPercent}%</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={form.currentREPercent}
                    onChange={(e) => setForm({ ...form, currentREPercent: Number(e.target.value) })}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-400">
                    현재 RE 조달 방식 (복수 선택) <span className="text-primary">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {RE_METHODS.map((method) => {
                      const selected = form.currentREMethods?.includes(method);
                      return (
                        <button
                          key={method}
                          onClick={() => toggleArrayItem('currentREMethods', method)}
                          className={cn(
                            'flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs ring-1 transition-colors text-left',
                            selected
                              ? 'bg-primary/10 ring-primary/40 text-primary'
                              : 'bg-white/[0.02] ring-white/[0.06] text-slate-400 hover:ring-white/[0.12]',
                          )}
                        >
                          <div
                            className={cn(
                              'flex h-4 w-4 items-center justify-center rounded shrink-0',
                              selected ? 'bg-primary text-white' : 'bg-white/[0.06]',
                            )}
                          >
                            {selected && <CheckCircle size={10} />}
                          </div>
                          {method}
                        </button>
                      );
                    })}
                  </div>
                  {errors.currentREMethods && <p className="text-xs text-rose-400">{errors.currentREMethods}</p>}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <Target size={12} /> 목표 및 동기
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-400">
                    목표 달성 기간 <span className="text-primary">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {TIMELINES.map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setForm({ ...form, targetTimeline: t });
                          setErrors((e) => {
                            const { targetTimeline: _, ...rest } = e;
                            return rest;
                          });
                        }}
                        className={cn(
                          'rounded-lg px-3 py-2.5 text-xs ring-1 transition-colors',
                          form.targetTimeline === t
                            ? 'bg-primary/10 ring-primary/40 text-primary'
                            : 'bg-white/[0.02] ring-white/[0.06] text-slate-400 hover:ring-white/[0.12]',
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {errors.targetTimeline && <p className="text-xs text-rose-400">{errors.targetTimeline}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-400">컨설팅 요청 배경 (복수 선택)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CONSULTING_DRIVERS.map((driver) => {
                      const selected = form.consultingDrivers?.includes(driver);
                      return (
                        <button
                          key={driver}
                          onClick={() => toggleArrayItem('consultingDrivers', driver)}
                          className={cn(
                            'flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs ring-1 transition-colors text-left',
                            selected
                              ? 'bg-primary/10 ring-primary/40 text-primary'
                              : 'bg-white/[0.02] ring-white/[0.06] text-slate-400 hover:ring-white/[0.12]',
                          )}
                        >
                          <div
                            className={cn(
                              'flex h-4 w-4 items-center justify-center rounded shrink-0',
                              selected ? 'bg-primary text-white' : 'bg-white/[0.06]',
                            )}
                          >
                            {selected && <CheckCircle size={10} />}
                          </div>
                          {driver}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Domain-specific: RE100 */}
              {domain === 'RE100' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <Globe size={12} /> RE100 관련 추가 정보
                  </div>
                  <Input
                    label="수출 대상국"
                    placeholder="예: EU, US, JP (쉼표 구분)"
                    hint="CBAM/RE100 관련 수출국이 있으면 입력하세요"
                    value={form.exportCountries ?? ''}
                    onChange={(e) => setForm({ ...form, exportCountries: e.target.value })}
                  />
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'CDP 참여', key: 'cdpParticipant' as const, val: form.cdpParticipant },
                      { label: 'SBTi 가입', key: 'sbtiCommitted' as const, val: form.sbtiCommitted },
                      { label: '배출권거래제', key: 'etsParticipant' as const, val: form.etsParticipant },
                    ].map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setForm({ ...form, [item.key]: !item.val })}
                        className={cn(
                          'rounded-lg px-3 py-2.5 text-xs ring-1 transition-colors text-center',
                          item.val
                            ? 'bg-primary/10 ring-primary/40 text-primary'
                            : 'bg-white/[0.02] ring-white/[0.06] text-slate-400',
                        )}
                      >
                        {item.val ? '✓ ' : ''}
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Domain-specific: CARBON_REDUCTION */}
              {domain === 'CARBON_REDUCTION' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <Leaf size={12} /> 탄소 배출 상세
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Input
                      label="Scope 1 (직접배출)"
                      type="number"
                      placeholder="tCO2eq"
                      hint="연료 연소, 공정 배출"
                      value={form.scope1Emission ?? ''}
                      onChange={(e) =>
                        setForm({ ...form, scope1Emission: e.target.value ? Number(e.target.value) : undefined })
                      }
                    />
                    <Input
                      label="Scope 2 (간접배출)"
                      type="number"
                      placeholder="tCO2eq"
                      hint="구매 전력, 열"
                      value={form.scope2Emission ?? ''}
                      onChange={(e) =>
                        setForm({ ...form, scope2Emission: e.target.value ? Number(e.target.value) : undefined })
                      }
                    />
                    <Input
                      label="Scope 3 (기타간접)"
                      type="number"
                      placeholder="tCO2eq"
                      hint="공급망, 출장 등"
                      value={form.scope3Emission ?? ''}
                      onChange={(e) =>
                        setForm({ ...form, scope3Emission: e.target.value ? Number(e.target.value) : undefined })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-400">
                      감축 목표: <span className="text-primary font-bold">{form.carbonTargetPercent ?? 0}%</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={form.carbonTargetPercent ?? 0}
                      onChange={(e) => setForm({ ...form, carbonTargetPercent: Number(e.target.value) })}
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-400">현재 감축 수단 (복수 선택)</label>
                    <div className="grid grid-cols-2 gap-2">
                      {CARBON_METHODS.map((m) => {
                        const sel = form.carbonMethods?.includes(m);
                        return (
                          <button
                            key={m}
                            onClick={() => toggleArrayItem('carbonMethods', m)}
                            className={cn(
                              'flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs ring-1 transition-colors text-left',
                              sel
                                ? 'bg-primary/10 ring-primary/40 text-primary'
                                : 'bg-white/[0.02] ring-white/[0.06] text-slate-400',
                            )}
                          >
                            <div
                              className={cn(
                                'flex h-4 w-4 items-center justify-center rounded shrink-0',
                                sel ? 'bg-primary text-white' : 'bg-white/[0.06]',
                              )}
                            >
                              {sel && <CheckCircle size={10} />}
                            </div>
                            {m}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: '배출권거래제 참여', key: 'etsParticipant' as const, val: form.etsParticipant },
                      { label: 'CDP 참여', key: 'cdpParticipant' as const, val: form.cdpParticipant },
                      { label: 'SBTi 가입', key: 'sbtiCommitted' as const, val: form.sbtiCommitted },
                    ].map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setForm({ ...form, [item.key]: !item.val })}
                        className={cn(
                          'rounded-lg px-3 py-2.5 text-xs ring-1 transition-colors text-center',
                          item.val
                            ? 'bg-primary/10 ring-primary/40 text-primary'
                            : 'bg-white/[0.02] ring-white/[0.06] text-slate-400',
                        )}
                      >
                        {item.val ? '✓ ' : ''}
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <Input
                    label="수출 대상국"
                    placeholder="예: EU, US, JP"
                    hint="CBAM 대상국이 있으면 입력하세요"
                    value={form.exportCountries ?? ''}
                    onChange={(e) => setForm({ ...form, exportCountries: e.target.value })}
                  />
                </div>
              )}

              {/* Domain-specific: DISTRIBUTED_ENERGY */}
              {domain === 'DISTRIBUTED_ENERGY' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <Sun size={12} /> 분산에너지 설비 현황
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="옥상/부지 가용면적 (m²)"
                      type="number"
                      placeholder="예: 5000"
                      value={form.rooftopArea ?? ''}
                      onChange={(e) =>
                        setForm({ ...form, rooftopArea: e.target.value ? Number(e.target.value) : undefined })
                      }
                    />
                    <Input
                      label="최대 수요 (kW)"
                      type="number"
                      placeholder="예: 2000"
                      hint="계약전력 또는 피크수요"
                      value={form.peakDemand ?? ''}
                      onChange={(e) =>
                        setForm({ ...form, peakDemand: e.target.value ? Number(e.target.value) : undefined })
                      }
                    />
                  </div>
                  <Input
                    label="월 피크요금 (원)"
                    type="number"
                    placeholder="예: 5000000"
                    hint="전기요금 중 기본요금/피크 부분"
                    value={form.monthlyPeakCost ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, monthlyPeakCost: e.target.value ? Number(e.target.value) : undefined })
                    }
                  />
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-400">수전 형태</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {GRID_TYPES.map((g) => (
                        <button
                          key={g}
                          onClick={() => setForm({ ...form, gridType: g })}
                          className={cn(
                            'rounded-lg px-3 py-2.5 text-xs ring-1 transition-colors',
                            form.gridType === g
                              ? 'bg-primary/10 ring-primary/40 text-primary'
                              : 'bg-white/[0.02] ring-white/[0.06] text-slate-400',
                          )}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-400">기존 분산자원 (복수 선택)</label>
                    <div className="grid grid-cols-2 gap-2">
                      {EXISTING_DER.map((d) => {
                        const sel = form.existingDER?.includes(d);
                        return (
                          <button
                            key={d}
                            onClick={() => toggleArrayItem('existingDER', d)}
                            className={cn(
                              'flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs ring-1 transition-colors text-left',
                              sel
                                ? 'bg-primary/10 ring-primary/40 text-primary'
                                : 'bg-white/[0.02] ring-white/[0.06] text-slate-400',
                            )}
                          >
                            <div
                              className={cn(
                                'flex h-4 w-4 items-center justify-center rounded shrink-0',
                                sel ? 'bg-primary text-white' : 'bg-white/[0.06]',
                              )}
                            >
                              {sel && <CheckCircle size={10} />}
                            </div>
                            {d}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setForm({ ...form, essInterest: !form.essInterest })}
                      className={cn(
                        'rounded-lg px-3 py-2.5 text-xs ring-1 transition-colors text-center',
                        form.essInterest
                          ? 'bg-primary/10 ring-primary/40 text-primary'
                          : 'bg-white/[0.02] ring-white/[0.06] text-slate-400',
                      )}
                    >
                      {form.essInterest ? '✓ ' : ''}ESS 도입 관심
                    </button>
                    <button
                      onClick={() => setForm({ ...form, evChargerInterest: !form.evChargerInterest })}
                      className={cn(
                        'rounded-lg px-3 py-2.5 text-xs ring-1 transition-colors text-center',
                        form.evChargerInterest
                          ? 'bg-primary/10 ring-primary/40 text-primary'
                          : 'bg-white/[0.02] ring-white/[0.06] text-slate-400',
                      )}
                    >
                      {form.evChargerInterest ? '✓ ' : ''}EV 충전 인프라 관심
                    </button>
                  </div>
                </div>
              )}

              {/* Budget (all domains) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <Wallet size={12} /> 예산
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-400">컨설팅 예산 범위</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {BUDGET_RANGES.map((b) => (
                      <button
                        key={b}
                        onClick={() => setForm({ ...form, budgetRange: b })}
                        className={cn(
                          'rounded-lg px-3 py-2.5 text-xs ring-1 transition-colors',
                          form.budgetRange === b
                            ? 'bg-primary/10 ring-primary/40 text-primary'
                            : 'bg-white/[0.02] ring-white/[0.06] text-slate-400 hover:ring-white/[0.12]',
                        )}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Confirm */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-white">입력 내용을 확인하세요</h2>
                <p className="text-xs text-slate-500 mt-1">아래 정보로 설문을 제출합니다</p>
              </div>

              <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] p-4 space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">컨설팅 분야</p>
                <p className="text-sm font-medium text-white">{DOMAIN_LABELS[domain] ?? domain}</p>
              </div>

              <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] p-4 space-y-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">기업 현황</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] text-slate-500">기업 규모</p>
                    <p className="text-white">{form.companySize || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">업종</p>
                    <p className="text-white">{form.industry || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">연간 전력 사용량</p>
                    <p className="text-white">
                      {form.annualEnergyUsage ? `${form.annualEnergyUsage.toLocaleString()} MWh` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">전기요금 단가</p>
                    <p className="text-white">
                      {form.currentElecCost ? `${form.currentElecCost} 원/kWh` : '산업용 평균 적용'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">온실가스 배출량</p>
                    <p className="text-white">
                      {form.annualGhgEmission ? `${form.annualGhgEmission.toLocaleString()} tCO2eq` : '자동 추정'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">사업장</p>
                    <p className="text-white">
                      {form.siteCount ? `${form.siteCount}개` : '-'} {form.siteRegions ? `(${form.siteRegions})` : ''}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] p-4 space-y-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">RE 현황 및 목표</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] text-slate-500">현재 RE 비율</p>
                    <p className="text-white">{form.currentREPercent}%</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">목표 기간</p>
                    <p className="text-white">{form.targetTimeline || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">현재 RE 조달</p>
                    <p className="text-white">
                      {form.currentREMethods?.filter((m) => m !== '해당 없음').join(', ') || '없음'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">요청 배경</p>
                    <p className="text-white">{form.consultingDrivers?.join(', ') || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">수출 대상국</p>
                    <p className="text-white">{form.exportCountries || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">예산 범위</p>
                    <p className="text-white">{form.budgetRange || '-'}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStep(0)}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                처음부터 수정하기
              </button>

              {submitError && (
                <div className="rounded-lg bg-rose-500/10 ring-1 ring-rose-500/30 px-4 py-3">
                  <p className="text-xs text-rose-400">{submitError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.06] px-8 py-4">
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                step === 0 ? router.push(`/consulting/project/${id}?origin=${origin}`) : setStep(step - 1)
              }
            >
              <ArrowLeft size={14} className="mr-1" />
              {step === 0 ? '취소' : '이전'}
            </Button>
            {step < 2 && (
              <Button variant="secondary" onClick={handleSave} disabled={createSurvey.isPending}>
                {createSurvey.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
                임시 저장
              </Button>
            )}
          </div>
          {step < 2 ? (
            <Button onClick={handleNext} disabled={!canNext}>
              다음 <ArrowRight size={14} className="ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canNext || submitting}>
              <CheckCircle size={14} className="mr-1" /> {submitting ? '제출 중...' : '설문 완료'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
