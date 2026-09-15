'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Zap,
  Leaf,
  Sun,
  ArrowLeft,
  ArrowRight,
  UserCheck,
  HelpCircle,
  CheckCircle,
  Building2,
  Globe,
  Target,
  Wallet,
  Clock,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import type { ConsultationDomain, DiagnosisForm } from '@/types/consultation';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import {
  useCreateDiagnosis,
  useDeleteDiagnosis,
  useCreateConsultation,
  useCreateProposal,
  useRecentEnergyData,
} from '@/hooks/consulting/useConsultations';
import type { SurveyItem } from '@/api/consulting/consultations';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { getMaturityGrade, MATURITY_GRADE_CONFIG } from '@/lib/maturity';
import type { Diagnosis } from '@/types/consultation';

const DOMAINS: { id: ConsultationDomain; icon: typeof Zap; title: string; description: string }[] = [
  { id: 'RE100', icon: Zap, title: 'RE100 이행 전략', description: '재생에너지 100% 전환 로드맵 수립' },
  { id: 'CARBON_REDUCTION', icon: Leaf, title: '탄소감축', description: '탄소 배출량 분석 및 감축 전략' },
  { id: 'DISTRIBUTED_ENERGY', icon: Sun, title: '분산에너지', description: '태양광, ESS 등 분산자원 도입' },
];

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

const INITIAL_FORM: DiagnosisForm = {
  domain: null,
  companySize: '',
  industry: '',
  currentREPercent: 0,
  targetTimeline: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  companyName: '',
  currentREMethods: [],
  consultingDrivers: [],
};

export default function DiagnosisPage() {
  return (
    <Suspense>
      <DiagnosisContent />
    </Suspense>
  );
}

function DiagnosisContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get('referral');
  const consultantId = searchParams.get('consultantId');
  const preselectedDomain = (searchParams.get('domain') as DiagnosisForm['domain']) ?? null;
  const user = useAuthStore((s) => s.user);
  const toast = useToastStore((s) => s.add);
  const createDiagnosis = useCreateDiagnosis();
  const deleteDiagnosis = useDeleteDiagnosis();
  const createConsultation = useCreateConsultation();
  const createProposal = useCreateProposal();
  const companyId = user?.companyId ?? 0;
  const { data: recentEnergyData } = useRecentEnergyData(companyId);

  type EnergyDataItem = { type: 'diagnosis'; data: Diagnosis } | { type: 'survey'; data: SurveyItem };

  const recentItems: EnergyDataItem[] = (() => {
    const items: EnergyDataItem[] = [];
    (recentEnergyData?.diagnoses ?? []).forEach((d) => items.push({ type: 'diagnosis', data: d }));
    (recentEnergyData?.surveys ?? []).forEach((s) => items.push({ type: 'survey', data: s }));
    items.sort((a, b) => {
      const dateA = a.type === 'diagnosis' ? (a.data as Diagnosis).createdAt : (a.data as SurveyItem).createdAt;
      const dateB = b.type === 'diagnosis' ? (b.data as Diagnosis).createdAt : (b.data as SurveyItem).createdAt;
      return new Date(dateB ?? 0).getTime() - new Date(dateA ?? 0).getTime();
    });
    return items;
  })();

  const isStale = (dateStr?: string) => {
    if (!dateStr) return false;
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    return new Date(dateStr) < threeMonthsAgo;
  };

  const handleDeleteDiagnosis = (diagnosis: Diagnosis) => {
    if (!window.confirm('이 무료진단을 삭제하시겠습니까?')) return;
    deleteDiagnosis.mutate(diagnosis.id, {
      onSuccess: () => {
        setSelectedItem((prev) =>
          prev?.type === 'diagnosis' && (prev.data as Diagnosis).id === diagnosis.id ? null : prev,
        );
        toast('success', '무료진단이 삭제되었습니다.');
      },
      onError: () => toast('error', '삭제에 실패했습니다.'),
    });
  };

  const [reuseDiagnosisChoice, setReuseDiagnosisChoice] = useState<'pending' | 'new' | 'reuse'>('pending');
  const [selectedItem, setSelectedItem] = useState<EnergyDataItem | null>(null);
  const [step, setStep] = useState(preselectedDomain ? 1 : 0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<DiagnosisForm>({
    ...INITIAL_FORM,
    domain: preselectedDomain,
    referralCode: referralCode ?? undefined,
  });

  const hasRecentData = recentItems.length > 0 && reuseDiagnosisChoice === 'pending';

  const validateStep = (s: number): Record<string, string> => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!form.domain) e.domain = '컨설팅 분야를 선택하세요';
    }
    if (s === 1) {
      if (!form.companySize) e.companySize = '기업 규모를 선택하세요';
      if (!form.industry) e.industry = '업종을 선택하세요';
      if (!form.annualEnergyUsage || form.annualEnergyUsage <= 0) e.annualEnergyUsage = '연간 전력 사용량을 입력하세요';
      if (form.annualEnergyUsage && form.annualEnergyUsage > 10_000_000)
        e.annualEnergyUsage = '사용량이 너무 큽니다 (최대 10,000,000 MWh)';
      if (form.currentElecCost && (form.currentElecCost < 50 || form.currentElecCost > 500))
        e.currentElecCost = '전기요금 단가는 50~500 원/kWh 범위로 입력하세요';
      if (form.employeeCount && form.employeeCount < 0) e.employeeCount = '직원 수는 0 이상이어야 합니다';
    }
    if (s === 2) {
      if (!form.currentREMethods || form.currentREMethods.length === 0)
        e.currentREMethods = 'RE 조달 방식을 최소 1개 선택하세요';
      if (!form.targetTimeline) e.targetTimeline = '목표 달성 기간을 선택하세요';
    }
    if (s === 3) {
      if (!form.contactName?.trim()) e.contactName = '담당자 이름을 입력하세요';
      else if (form.contactName.trim().length < 2) e.contactName = '이름은 2자 이상 입력하세요';
      else if (/^\d+$/.test(form.contactName.trim())) e.contactName = '이름에 숫자만 입력할 수 없습니다';
      if (!form.contactEmail?.trim()) e.contactEmail = '이메일을 입력하세요';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) e.contactEmail = '올바른 이메일 형식이 아닙니다';
      if (!form.companyName?.trim()) e.companyName = '회사명을 입력하세요';
      else if (form.companyName.trim().length < 2) e.companyName = '회사명은 2자 이상 입력하세요';
      else if (/^\d+$/.test(form.companyName.trim())) e.companyName = '회사명에 숫자만 입력할 수 없습니다';
      if (form.contactPhone) {
        const digits = form.contactPhone.replace(/\D/g, '');
        if (!/^0\d{9,10}$/.test(digits)) e.contactPhone = '올바른 연락처를 입력하세요 (예: 010-1234-5678)';
      }
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
    (step === 0 && form.domain !== null) ||
    (step === 1 && form.companySize && form.industry && form.annualEnergyUsage) ||
    (step === 2 && form.currentREMethods && form.currentREMethods.length > 0 && form.targetTimeline) ||
    (step === 3 && form.contactName && form.contactEmail && form.companyName) ||
    step === 4;

  const handleReuseData = async (item: EnergyDataItem) => {
    if (!user?.companyId) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      if (item.type === 'diagnosis') {
        const diagnosis = item.data as Diagnosis;
        if (consultantId) {
          const result = await createConsultation.mutateAsync({
            clientCompanyId: user.companyId,
            origin: 'MARKETPLACE',
            domain: diagnosis.domain,
            diagnosisId: diagnosis.id,
            includePpaSupport: false,
          });
          try {
            await createProposal.mutateAsync({
              profileId: Number(consultantId),
              domain: diagnosis.domain,
              proposedScope: JSON.stringify(['diagnosis', 'strategy']),
              estimatedCost: 0,
              coverLetter: `기존 진단(#${diagnosis.id}) 기반 매칭 요청`,
            });
            toast('success', '기존 데이터로 컨설턴트에게 매칭 제안이 전송되었습니다');
          } catch {
            toast('warning', '컨설팅은 생성되었으나 매칭 제안 전송에 실패했습니다');
          }
          router.push(`/consulting/diagnosis/report?id=${(result as any).diagnosisId ?? diagnosis.id}&matched=true`);
        } else {
          router.push(`/consulting/diagnosis/report?id=${diagnosis.id}`);
        }
      } else {
        const survey = item.data as SurveyItem;
        const parseJsonField = (val: string | null): string | null => {
          if (!val) return null;
          try {
            const arr = JSON.parse(val);
            return Array.isArray(arr) ? arr.join(',') : val;
          } catch {
            return val;
          }
        };
        const maturityGrade = getMaturityGrade(0);
        const diagnosisResult = await createDiagnosis.mutateAsync({
          companyId: user.companyId,
          domain: survey.domain,
          industry: survey.industry || null,
          companySize: survey.companySize || null,
          currentRePercent: 0,
          targetTimeline: null,
          annualEnergyUsage: survey.annualEnergyUsage ?? null,
          currentElecCost: survey.currentElecCost ?? null,
          annualGhgEmission: survey.annualGhgEmission ?? null,
          budgetRange: survey.budgetRange ?? null,
          contactName: user.name || null,
          contactEmail: user.email || null,
          contactPhone: null,
          currentReMethods: parseJsonField(survey.currentREMethods),
          consultingDrivers: parseJsonField(survey.consultingDrivers),
          exportCountries: survey.exportCountries ?? null,
          siteCount: survey.siteCount ?? null,
          siteRegions: survey.siteRegions ?? null,
          annualRevenue: survey.annualRevenue ?? null,
          employeeCount: survey.employeeCount ?? null,
          maturityGrade,
        });
        toast('success', '컨설팅 설문 데이터로 진단이 생성되었습니다');
        if (consultantId) {
          await createConsultation.mutateAsync({
            clientCompanyId: user.companyId,
            origin: referralCode ? 'REFERRAL' : 'MARKETPLACE',
            domain: survey.domain,
            diagnosisId: (diagnosisResult as any).id,
            includePpaSupport: false,
          });
          try {
            await createProposal.mutateAsync({
              profileId: Number(consultantId),
              domain: survey.domain,
              proposedScope: JSON.stringify(['diagnosis', 'strategy']),
              estimatedCost: 0,
              coverLetter: `설문 데이터 기반 자동 매칭 요청 (진단 ID: ${(diagnosisResult as any).id})`,
            });
          } catch {
            /* ignore */
          }
          router.push(`/consulting/diagnosis/report?id=${(diagnosisResult as any).id}&matched=true`);
        } else {
          router.push(`/consulting/diagnosis/report?id=${(diagnosisResult as any).id}`);
        }
      }
    } catch (err: any) {
      setSubmitting(false);
      setSubmitError(err?.message || '처리에 실패했습니다.');
    }
  };

  const handleUpdateAndDiagnose = (item: EnergyDataItem) => {
    if (item.type === 'diagnosis') {
      const d = item.data as Diagnosis;
      setForm({
        ...INITIAL_FORM,
        domain: d.domain as ConsultationDomain,
        companySize: d.companySize || '',
        industry: d.industry || '',
        currentREPercent: Number(d.currentRePercent) || 0,
        targetTimeline: d.targetTimeline || '',
        annualEnergyUsage: d.annualEnergyUsage ?? undefined,
        currentElecCost: d.currentElecCost ?? undefined,
        annualGhgEmission: d.annualGhgEmission ?? undefined,
        budgetRange: d.budgetRange ?? undefined,
        currentREMethods: d.currentReMethods ? d.currentReMethods.split(',') : [],
        consultingDrivers: d.consultingDrivers ? d.consultingDrivers.split(',') : [],
        exportCountries: d.exportCountries ?? undefined,
        siteCount: d.siteCount ?? undefined,
        siteRegions: d.siteRegions ?? undefined,
        annualRevenue: d.annualRevenue ?? undefined,
        employeeCount: d.employeeCount ?? undefined,
        contactName: d.contactName || '',
        contactEmail: d.contactEmail || '',
        contactPhone: d.contactPhone || '',
        referralCode: referralCode ?? undefined,
      });
      setStep(1);
    } else {
      const s = item.data as SurveyItem;
      const parseJsonArray = (val: string | null): string[] => {
        if (!val) return [];
        try {
          const arr = JSON.parse(val);
          return Array.isArray(arr) ? arr : val.split(',');
        } catch {
          return val.split(',');
        }
      };
      setForm({
        ...INITIAL_FORM,
        domain: s.domain as ConsultationDomain,
        companySize: s.companySize || '',
        industry: s.industry || '',
        currentREPercent: 0,
        targetTimeline: '',
        annualEnergyUsage: s.annualEnergyUsage ?? undefined,
        currentElecCost: s.currentElecCost != null ? Number(s.currentElecCost) : undefined,
        annualGhgEmission: s.annualGhgEmission != null ? Number(s.annualGhgEmission) : undefined,
        budgetRange: s.budgetRange ?? undefined,
        currentREMethods: parseJsonArray(s.currentREMethods),
        consultingDrivers: parseJsonArray(s.consultingDrivers),
        exportCountries: s.exportCountries ?? undefined,
        siteCount: s.siteCount ?? undefined,
        siteRegions: s.siteRegions ?? undefined,
        annualRevenue: s.annualRevenue ?? undefined,
        employeeCount: s.employeeCount ?? undefined,
        contactName: user?.name || '',
        contactEmail: user?.email || '',
        contactPhone: '',
        referralCode: referralCode ?? undefined,
        scope1Emission: s.scope1Emission ?? undefined,
        scope2Emission: s.scope2Emission ?? undefined,
        scope3Emission: s.scope3Emission ?? undefined,
        carbonTargetPercent: s.carbonTargetPercent ?? undefined,
        carbonMethods: parseJsonArray(s.carbonMethods),
        etsParticipant: s.etsParticipant ?? undefined,
        cdpParticipant: s.cdpParticipant ?? undefined,
        sbtiCommitted: s.sbtiCommitted ?? undefined,
        rooftopArea: s.rooftopArea ?? undefined,
        peakDemand: s.peakDemand ?? undefined,
        monthlyPeakCost: s.monthlyPeakCost ?? undefined,
        existingDER: parseJsonArray(s.existingDER),
        gridType: s.gridType ?? undefined,
        essInterest: s.essInterest ?? undefined,
        evChargerInterest: s.evChargerInterest ?? undefined,
      });
      setStep(1);
    }
    setReuseDiagnosisChoice('new');
  };

  const handleSubmit = async () => {
    if (!form.domain) return;
    if (!user?.companyId) {
      setSubmitError('로그인 정보에 회사가 연결되어 있지 않습니다. 관리자에게 문의하세요.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const maturityGrade = getMaturityGrade(form.currentREPercent);
      const diagnosisResult = await createDiagnosis.mutateAsync({
        companyId: user.companyId,
        domain: form.domain,
        industry: form.industry || null,
        companySize: form.companySize || null,
        currentRePercent: form.currentREPercent,
        targetTimeline: form.targetTimeline || null,
        annualEnergyUsage: form.annualEnergyUsage ?? null,
        currentElecCost: form.currentElecCost ?? null,
        annualGhgEmission: form.annualGhgEmission ?? null,
        budgetRange: form.budgetRange ?? null,
        contactName: form.contactName || null,
        contactEmail: form.contactEmail || null,
        contactPhone: form.contactPhone || null,
        currentReMethods: form.currentREMethods?.join(',') ?? null,
        consultingDrivers: form.consultingDrivers?.join(',') ?? null,
        exportCountries: form.exportCountries ?? null,
        siteCount: form.siteCount ?? null,
        siteRegions: form.siteRegions ?? null,
        annualRevenue: form.annualRevenue ?? null,
        employeeCount: form.employeeCount ?? null,
        maturityGrade,
      });

      if (consultantId) {
        await createConsultation.mutateAsync({
          clientCompanyId: user.companyId,
          origin: referralCode ? 'REFERRAL' : 'MARKETPLACE',
          domain: form.domain,
          diagnosisId: (diagnosisResult as any).id,
          includePpaSupport: false,
        });
        try {
          await createProposal.mutateAsync({
            profileId: Number(consultantId),
            domain: form.domain,
            proposedScope: JSON.stringify(['diagnosis', 'strategy']),
            estimatedCost: 0,
            coverLetter: `무료진단 완료 후 자동 매칭 요청 (진단 ID: ${(diagnosisResult as any).id})`,
          });
          toast('success', '진단이 완료되고 컨설턴트에게 매칭 제안이 전송되었습니다');
        } catch {
          toast('warning', '진단은 완료되었으나 매칭 제안 전송에 실패했습니다');
        }
        router.push(`/consulting/diagnosis/report?id=${(diagnosisResult as any).id}&matched=true`);
      } else {
        router.push(`/consulting/diagnosis/report?id=${(diagnosisResult as any).id}`);
      }
    } catch (err: any) {
      setSubmitting(false);
      setSubmitError(err?.message || '진단 신청에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  const toggleArrayItem = (key: 'currentREMethods' | 'consultingDrivers', value: string) => {
    setForm((prev) => {
      const arr = prev[key] ?? [];
      return { ...prev, [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] };
    });
  };

  const STEP_TITLES = ['분야 선택', '기업 현황', 'RE 현황', '연락처', '확인'];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-2xl mx-4 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-2xl overflow-hidden">
        <div className="px-8 pt-5">
          <Breadcrumb items={[{ label: '통합에너지 컨설팅', path: '/consulting' }, { label: '무료 진단' }]} />
        </div>

        <div className="flex items-center justify-between border-b border-white/[0.06] px-8 py-5">
          <div>
            <h1 className="text-xl font-bold text-white">무료 진단</h1>
            <p className="mt-0.5 text-xs text-slate-400">5단계로 우리 기업에 맞는 에너지 전략을 진단합니다</p>
          </div>
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

        {consultantId && (
          <div className="mx-8 mt-4 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 p-4 flex items-center gap-3">
            <UserCheck size={20} className="text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-400">마켓플레이스에서 컨설턴트를 선택했습니다</p>
              <p className="text-xs text-slate-400 mt-0.5">
                진단 완료 후 해당 컨설턴트에게 자동으로 매칭 제안이 전송됩니다
              </p>
            </div>
          </div>
        )}

        {referralCode && !consultantId && (
          <div className="mx-8 mt-4 rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20 p-4 flex items-center gap-3">
            <UserCheck size={20} className="text-blue-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-400">컨설턴트 초대를 통해 진단을 시작합니다</p>
              <p className="text-xs text-slate-400 mt-0.5">진단 완료 후 해당 컨설턴트와 자동으로 매칭됩니다</p>
            </div>
          </div>
        )}

        {/* Recent energy data selection */}
        {hasRecentData && (
          <div className="px-8 py-6 space-y-4">
            <div className="rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20 p-4 flex items-center gap-3">
              <Clock size={20} className="text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-400">기존 에너지 데이터가 있습니다</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  최근 3개월 이내에 입력한 데이터가 {recentItems.length}건 있습니다. 기존 데이터를 활용하면 다시 입력할
                  필요가 없습니다.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {recentItems.map((item) => {
                const isDiag = item.type === 'diagnosis';
                const d = isDiag ? (item.data as Diagnosis) : null;
                const s = !isDiag ? (item.data as SurveyItem) : null;
                const itemDomain = isDiag ? d!.domain : s!.domain;
                const itemDate = isDiag ? d!.createdAt : s!.createdAt;
                const itemIndustry = isDiag ? d!.industry : s!.industry;
                const itemEnergy = isDiag ? d!.annualEnergyUsage : s!.annualEnergyUsage;
                const stale = isStale(itemDate);
                const rePercent = isDiag ? (d!.currentRePercent ?? 0) : 0;
                const grade = isDiag ? d!.maturityGrade || getMaturityGrade(Number(rePercent)) : null;
                const gc = grade ? MATURITY_GRADE_CONFIG[grade as keyof typeof MATURITY_GRADE_CONFIG] : null;
                const itemKey = isDiag ? `d-${d!.id}` : `s-${s!.surveyId}`;
                const isSelected =
                  selectedItem &&
                  ((selectedItem.type === 'diagnosis' && isDiag && (selectedItem.data as Diagnosis).id === d!.id) ||
                    (selectedItem.type === 'survey' &&
                      !isDiag &&
                      (selectedItem.data as SurveyItem).surveyId === s!.surveyId));

                return (
                  <button
                    key={itemKey}
                    onClick={() => setSelectedItem(item)}
                    className={cn(
                      'w-full text-left rounded-xl p-4 ring-1 transition-all',
                      isSelected
                        ? 'bg-primary/10 ring-primary/40'
                        : 'bg-white/[0.02] ring-white/[0.06] hover:ring-white/[0.12]',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'text-[9px] font-bold px-1.5 py-0.5 rounded',
                              isDiag ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400',
                            )}
                          >
                            {isDiag ? '무료진단' : '컨설팅 설문'}
                          </span>
                          <span className="text-sm font-medium text-white">
                            {itemDomain === 'RE100'
                              ? 'RE100 이행 전략'
                              : itemDomain === 'CARBON_REDUCTION'
                                ? '탄소감축'
                                : '분산에너지'}
                          </span>
                          {gc && <span className={cn('text-xs font-bold', gc.color)}>등급 {grade}</span>}
                          {stale && (
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400">
                              갱신 권장
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {itemDate?.split('T')[0]} · {itemIndustry ?? '업종 미입력'} ·{' '}
                          {itemEnergy != null ? `${Number(itemEnergy).toLocaleString()} MWh` : '-'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isDiag && (
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label="무료진단 삭제"
                            title="삭제"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (deleteDiagnosis.isPending) return;
                              handleDeleteDiagnosis(d!);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteDiagnosis(d!);
                              }
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                          >
                            {deleteDiagnosis.isPending ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                          </span>
                        )}
                        <div
                          className={cn(
                            'flex h-5 w-5 items-center justify-center rounded-full ring-1',
                            isSelected ? 'bg-primary ring-primary text-white' : 'ring-white/[0.12]',
                          )}
                        >
                          {isSelected && <CheckCircle size={12} />}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="secondary" onClick={() => router.push('/consulting')}>
                <ArrowLeft size={14} className="mr-1" /> 취소
              </Button>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setReuseDiagnosisChoice('new')}>
                  처음부터 새로 진단
                </Button>
                {selectedItem && (
                  <Button variant="secondary" onClick={() => handleUpdateAndDiagnose(selectedItem)}>
                    데이터 갱신 후 진단
                  </Button>
                )}
                <Button
                  disabled={!selectedItem || submitting}
                  onClick={() => selectedItem && handleReuseData(selectedItem)}
                >
                  {submitting ? '처리 중...' : '바로 진단 결과 보기'}
                  <ArrowRight size={14} className="ml-1" />
                </Button>
              </div>
            </div>

            {submitError && (
              <div className="rounded-lg bg-rose-500/10 ring-1 ring-rose-500/30 px-4 py-3">
                <p className="text-xs text-rose-400">{submitError}</p>
              </div>
            )}
          </div>
        )}

        {/* Step indicator */}
        {!hasRecentData && (
          <div className="flex items-center gap-0 border-b border-white/[0.06]">
            {[0, 1, 2, 3, 4].map((i) => (
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
        )}

        {/* Content (wizard steps) */}
        {!hasRecentData && (
          <>
            <div className="px-8 py-6 max-h-[60vh] overflow-y-auto">
              {/* Step 0: Domain */}
              {step === 0 && (
                <div className="space-y-4">
                  <h2 className="text-base font-semibold text-white">컨설팅 분야를 선택하세요</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {DOMAINS.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setForm({ ...form, domain: d.id })}
                        className={cn(
                          'rounded-xl p-5 text-left ring-1 transition-all',
                          form.domain === d.id
                            ? 'bg-primary/10 ring-primary/40'
                            : 'bg-white/[0.02] ring-white/[0.06] hover:ring-white/[0.12]',
                        )}
                      >
                        <d.icon size={20} className={form.domain === d.id ? 'text-primary' : 'text-slate-400'} />
                        <p className="mt-3 text-sm font-medium text-white">{d.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{d.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 1: Company Profile */}
              {step === 1 && (
                <div className="space-y-6">
                  <h2 className="text-base font-semibold text-white">기업 현황을 알려주세요</h2>

                  {/* Basic info */}
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

                  {/* Energy usage */}
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
                              setForm({
                                ...form,
                                annualEnergyUsage: e.target.value ? Number(e.target.value) : undefined,
                              });
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
                        {errors.annualEnergyUsage && (
                          <p className="text-xs text-rose-400">{errors.annualEnergyUsage}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-slate-400">현재 전기요금 단가 (원/kWh)</label>
                        <div className="relative">
                          <Input
                            type="number"
                            placeholder="예: 154"
                            value={form.currentElecCost ?? ''}
                            onChange={(e) => {
                              setForm({
                                ...form,
                                currentElecCost: e.target.value ? Number(e.target.value) : undefined,
                              });
                              setErrors((prev) => {
                                const { currentElecCost: _, ...rest } = prev;
                                return rest;
                              });
                            }}
                          />
                          <div className="group absolute right-3 top-1/2 -translate-y-1/2">
                            <HelpCircle size={14} className="text-slate-500 cursor-help" />
                            <div className="invisible group-hover:visible absolute bottom-full right-0 mb-2 w-52 rounded-lg bg-[#0d1520] ring-1 ring-white/[0.1] p-3 text-[11px] text-slate-400 shadow-xl z-10">
                              고지서의 &apos;청구금액 ÷ 사용량&apos;으로 산출합니다. 모르면 비워두세요.
                            </div>
                          </div>
                        </div>
                        {errors.currentElecCost && <p className="text-xs text-rose-400">{errors.currentElecCost}</p>}
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

              {/* Step 2: RE Status & Goals */}
              {step === 2 && (
                <div className="space-y-6">
                  <h2 className="text-base font-semibold text-white">재생에너지 현황 및 목표</h2>

                  {/* Current RE */}
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

                  {/* Goals */}
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
                  {form.domain === 'RE100' && (
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
                  {form.domain === 'CARBON_REDUCTION' && (
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
                                onClick={() => {
                                  const arr = form.carbonMethods ?? [];
                                  setForm({ ...form, carbonMethods: sel ? arr.filter((v) => v !== m) : [...arr, m] });
                                }}
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
                  {form.domain === 'DISTRIBUTED_ENERGY' && (
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
                                onClick={() => {
                                  const arr = form.existingDER ?? [];
                                  setForm({ ...form, existingDER: sel ? arr.filter((v) => v !== d) : [...arr, d] });
                                }}
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

              {/* Step 3: Contact */}
              {step === 3 && (
                <div className="space-y-5">
                  <h2 className="text-base font-semibold text-white">연락처 정보</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="담당자 이름"
                      required
                      placeholder="홍길동"
                      value={form.contactName}
                      error={errors.contactName}
                      onChange={(e) => {
                        setForm({ ...form, contactName: e.target.value });
                        setErrors((prev) => {
                          const { contactName: _, ...rest } = prev;
                          return rest;
                        });
                      }}
                    />
                    <Input
                      label="회사명"
                      required
                      placeholder="주식회사 그린에너지"
                      value={form.companyName}
                      error={errors.companyName}
                      onChange={(e) => {
                        setForm({ ...form, companyName: e.target.value });
                        setErrors((prev) => {
                          const { companyName: _, ...rest } = prev;
                          return rest;
                        });
                      }}
                    />
                  </div>
                  <Input
                    label="이메일"
                    required
                    type="email"
                    placeholder="hong@company.com"
                    value={form.contactEmail}
                    error={errors.contactEmail}
                    onChange={(e) => {
                      setForm({ ...form, contactEmail: e.target.value });
                      setErrors((prev) => {
                        const { contactEmail: _, ...rest } = prev;
                        return rest;
                      });
                    }}
                  />
                  <Input
                    label="연락처"
                    type="tel"
                    placeholder="010-1234-5678"
                    value={form.contactPhone}
                    error={errors.contactPhone}
                    onChange={(e) => {
                      setForm({ ...form, contactPhone: e.target.value });
                      setErrors((prev) => {
                        const { contactPhone: _, ...rest } = prev;
                        return rest;
                      });
                    }}
                  />
                </div>
              )}

              {/* Step 4: Confirm */}
              {step === 4 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-base font-semibold text-white">입력 내용을 확인하세요</h2>
                    <p className="text-xs text-slate-500 mt-1">아래 정보로 진단을 진행합니다</p>
                  </div>

                  <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] p-4 space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">컨설팅 분야</p>
                    <p className="text-sm font-medium text-white">
                      {DOMAINS.find((d) => d.id === form.domain)?.title ?? '-'}
                    </p>
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
                          {form.siteCount ? `${form.siteCount}개` : '-'}{' '}
                          {form.siteRegions ? `(${form.siteRegions})` : ''}
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

                  <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] p-4 space-y-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">연락처</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[11px] text-slate-500">담당자</p>
                        <p className="text-white">{form.contactName || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">회사명</p>
                        <p className="text-white">{form.companyName || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">이메일</p>
                        <p className="text-white">{form.contactEmail || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">연락처</p>
                        <p className="text-white">{form.contactPhone || '-'}</p>
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
              <Button variant="secondary" onClick={() => (step === 0 ? router.push('/consulting') : setStep(step - 1))}>
                <ArrowLeft size={14} className="mr-1" />
                {step === 0 ? '취소' : '이전'}
              </Button>
              {step < 4 ? (
                <Button onClick={handleNext} disabled={!canNext}>
                  다음 <ArrowRight size={14} className="ml-1" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={!canNext || submitting}>
                  <CheckCircle size={14} className="mr-1" /> {submitting ? '제출 중...' : '진단 결과 보기'}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
