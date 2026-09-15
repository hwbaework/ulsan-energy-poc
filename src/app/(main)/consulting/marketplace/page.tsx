'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Star, MapPin, Briefcase, SlidersHorizontal, SearchX, CheckCircle, ArrowRight, Clock, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { ConsultationDomain, Diagnosis } from '@/types/consultation';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import {
  useProfiles,
  useRecommendedConsultants,
  useRecentDiagnoses,
  useCreateConsultation,
  useCreateProposal,
} from '@/hooks/consulting/useConsultations';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { useQueries } from '@tanstack/react-query';
import { getSpecializations } from '@/api/consulting/consultations';
import { getMaturityGrade, MATURITY_GRADE_CONFIG } from '@/lib/maturity';

type SortOption = 'match' | 'rating' | 'experience';

// 현 단계 showcase = RE100 단일 (탄소감축·분산에너지 제외)
const DOMAIN_LABELS: Partial<Record<ConsultationDomain, string>> = {
  RE100: 'RE100',
};

const SORT_LABELS: Record<SortOption, string> = {
  match: 'AI추천순',
  rating: '평점순',
  experience: '경력순',
};

export default function MarketplacePage() {
  return (
    <Suspense>
      <MarketplaceContent />
    </Suspense>
  );
}

function MarketplaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tier = searchParams.get('tier');
  const [sort, setSort] = useState<SortOption>(tier === 'advanced' ? 'experience' : 'match');
  const [domainFilter, setDomainFilter] = useState<ConsultationDomain | 'ALL'>('ALL');
  const [selectedConsultant, setSelectedConsultant] = useState<{ id: number; name: string } | null>(null);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<Diagnosis | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [matchResult, setMatchResult] = useState<{ consultantName: string; diagnosisId: number } | null>(null);

  const { user } = useAuthStore();
  const toast = useToastStore((s) => s.add);
  const companyId = user?.companyId ?? 0;
  const { data: recentDiagnoses } = useRecentDiagnoses(companyId);
  const diagnosisList = (recentDiagnoses ?? []) as Diagnosis[];
  const createConsultation = useCreateConsultation();
  const createProposal = useCreateProposal();

  const handleConsultantClick = (consultant: { id: number; name: string }) => {
    if (diagnosisList.length > 0) {
      setSelectedConsultant(consultant);
      setSelectedDiagnosis(null);
    } else {
      router.push(`/consulting/diagnosis?consultantId=${consultant.id}`);
    }
  };

  const handleMatchWithDiagnosis = async () => {
    if (!selectedConsultant || !selectedDiagnosis || !user?.companyId) return;
    setSubmitting(true);
    try {
      await createConsultation.mutateAsync({
        clientCompanyId: user.companyId,
        origin: 'MARKETPLACE',
        domain: selectedDiagnosis.domain,
        diagnosisId: selectedDiagnosis.id,
        includePpaSupport: false,
      });
      try {
        await createProposal.mutateAsync({
          profileId: selectedConsultant.id,
          domain: selectedDiagnosis.domain,
          proposedScope: JSON.stringify(['diagnosis', 'strategy']),
          estimatedCost: 0,
          coverLetter: `기존 진단(#${selectedDiagnosis.id}) 기반 매칭 요청`,
        });
      } catch {
        toast('warning', '컨설팅은 생성되었으나 매칭 제안 전송에 실패했습니다');
      }
      setMatchResult({ consultantName: selectedConsultant.name, diagnosisId: selectedDiagnosis.id });
      setSelectedConsultant(null);
    } catch {
      toast('error', '매칭 처리에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const { data: apiData } = useProfiles();
  // AI추천순 = 백엔드 recommend 점수(도메인·지역·경력·평점·가용) 순위. 목록 렌더는 useProfiles 유지, 정렬만 흡수.
  const { data: recData } = useRecommendedConsultants({ maxResults: 100 });
  const recRank = new Map<number, number>();
  ((recData as any[]) ?? []).forEach((p, i) => {
    if (p?.id != null) recRank.set(p.id as number, i);
  });
  const profileIds = (apiData?.content ?? []).map((p: any) => p.id as number);
  const specQueries = useQueries({
    queries: profileIds.map((id: number) => ({
      queryKey: ['consultant', 'specializations', id],
      queryFn: () => getSpecializations(id),
      staleTime: 60_000,
      enabled: !!id,
    })),
  });
  const specsMap = new Map<number, string[]>();
  profileIds.forEach((id: number, i: number) => {
    const d = specQueries[i]?.data;
    if (Array.isArray(d)) specsMap.set(id, d);
  });

  const allConsultants = (apiData?.content ?? []).map((p: any) => ({
    id: p.id,
    userId: p.userId ?? 0,
    name: p.userName ?? '',
    specializations: specsMap.get(p.id) ?? [],
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    experience: p.experienceYears ?? 0,
    completedProjects: p.completedProjects ?? 0,
    bio: p.bio ?? '',
    region: p.region ?? '',
    maxConcurrent: p.maxConcurrent ?? 3,
    available: p.available ?? true,
    status: p.status ?? 'ACTIVE',
  }));

  const filtered = allConsultants
    .filter((c) => c.status === 'ACTIVE')
    .filter((c) => domainFilter === 'ALL' || c.specializations.includes(domainFilter))
    .filter((c) => tier !== 'advanced' || c.experience >= 10)
    .sort((a, b) => {
      if (sort === 'match') {
        const ra = recRank.has(a.id) ? (recRank.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
        const rb = recRank.has(b.id) ? (recRank.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
        if (ra !== rb) return ra - rb; // 백엔드 추천 점수 순위 우선
        return b.rating * b.completedProjects - a.rating * a.completedProjects; // 동순위 폴백
      }
      if (sort === 'rating') return b.rating - a.rating;
      return b.experience - a.experience;
    });

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-5xl mx-4 my-8 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-2xl overflow-hidden">
        {/* Breadcrumb */}
        <div className="px-8 pt-5">
          <Breadcrumb items={[{ label: '통합에너지 컨설팅', path: '/consulting' }, { label: '마켓플레이스' }]} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-8 py-5">
          <div>
            <h1 className="text-lg font-bold text-white">컨설턴트 마켓플레이스</h1>
            <p className="mt-0.5 text-xs text-slate-400">검증된 독립 컨설턴트를 비교하고 선택하세요</p>
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

        <div className="p-8 space-y-6">
          {tier === 'advanced' && (
            <div className="rounded-xl bg-emerald-500/5 ring-1 ring-emerald-500/20 p-4 flex items-start gap-3">
              <SlidersHorizontal size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-400">고급 최적화 컨설팅</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  RE100 이행이 우수한 기업을 위한 경력 10년 이상 컨설턴트를 추천합니다
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-4">
            <SlidersHorizontal size={16} className="text-slate-400" />
            <div className="flex gap-2">
              <button
                onClick={() => setDomainFilter('ALL')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs ring-1 transition-colors',
                  domainFilter === 'ALL'
                    ? 'bg-primary/10 ring-primary/40 text-primary'
                    : 'ring-white/[0.06] text-slate-400 hover:text-white',
                )}
              >
                전체
              </button>
              {(Object.entries(DOMAIN_LABELS) as [ConsultationDomain, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setDomainFilter(key)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs ring-1 transition-colors',
                    domainFilter === key
                      ? 'bg-primary/10 ring-primary/40 text-primary'
                      : 'ring-white/[0.06] text-slate-400 hover:text-white',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-2">
              {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSort(key)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs transition-colors',
                    sort === key ? 'text-primary font-medium' : 'text-slate-500 hover:text-white',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-slate-500 -mt-2">
            마켓플레이스는 검증된 독립 컨설턴트만 표시됩니다. 용역사를 통한 컨설팅은 SPC 담당자에게 문의하세요.
          </p>

          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <SearchX size={40} className="mx-auto text-slate-600 mb-4" />
              <p className="text-sm text-slate-400 mb-2">조건에 맞는 컨설턴트가 없습니다</p>
              <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">필터 조건을 변경하거나 초기화해 보세요</p>
              <button
                onClick={() => {
                  setDomainFilter('ALL');
                  setSort('match');
                }}
                className="inline-flex items-center rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary ring-1 ring-primary/20 hover:bg-primary/20 transition-colors"
              >
                필터 초기화
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((consultant) => (
                <button
                  key={consultant.id}
                  onClick={() => handleConsultantClick({ id: consultant.id, name: consultant.name })}
                  className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5 text-left hover:ring-primary/30 transition-all hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {consultant.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">{consultant.name}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                          <Star size={12} className="text-amber-400 fill-amber-400" />
                          <span className="text-xs text-slate-400">{consultant.rating}</span>
                        </div>
                        <span className="text-xs text-slate-600">|</span>
                        <span className="text-xs text-slate-400">리뷰 {consultant.reviewCount}</span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-400 line-clamp-2">{consultant.bio}</p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {consultant.specializations.map((s) => (
                      <Badge key={s} variant="default" className="text-[10px]">
                        {DOMAIN_LABELS[s as ConsultationDomain] ?? s}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} /> {consultant.region}
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase size={12} /> {consultant.experience}년
                    </span>
                    <span className="ml-auto text-slate-600">{consultant.completedProjects}건 완료</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* end p-8 */}
      </div>
      {/* end modal */}

      {/* 진단 선택 오버레이 */}
      {selectedConsultant && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedConsultant(null)} />
          <div className="relative z-10 w-full max-w-lg mx-4 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">진단 결과 선택</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  <span className="text-primary font-medium">{selectedConsultant.name}</span> 컨설턴트에게 매칭할 진단을
                  선택하세요
                </p>
              </div>
              <button
                onClick={() => setSelectedConsultant(null)}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-4 max-h-[50vh] overflow-y-auto space-y-2">
              {diagnosisList.map((d) => {
                const grade = d.maturityGrade || getMaturityGrade(d.currentRePercent ?? 0);
                const gc = MATURITY_GRADE_CONFIG[grade as keyof typeof MATURITY_GRADE_CONFIG];
                const isSelected = selectedDiagnosis?.id === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDiagnosis(isSelected ? null : d)}
                    className={cn(
                      'w-full rounded-xl p-4 text-left transition-all ring-1',
                      isSelected
                        ? 'bg-primary/10 ring-primary/40'
                        : 'bg-[#0d1520] ring-white/[0.06] hover:ring-white/[0.12]',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold shrink-0',
                          gc?.color ?? 'text-white',
                        )}
                        style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                      >
                        {grade}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">
                            {d.domain === 'RE100'
                              ? 'RE100'
                              : d.domain === 'CARBON_REDUCTION'
                                ? '탄소감축'
                                : '분산에너지'}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-slate-500">
                            <Clock size={10} />
                            {d.createdAt?.split('T')[0]}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {d.industry ?? '업종 미입력'} · {d.annualEnergyUsage?.toLocaleString() ?? '-'} MWh · RE{' '}
                          {d.currentRePercent ?? 0}%
                        </p>
                      </div>
                      {isSelected && <CheckCircle size={16} className="text-primary shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="px-6 py-4 border-t border-white/[0.06] flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setSelectedConsultant(null);
                  router.push(`/consulting/diagnosis?consultantId=${selectedConsultant.id}`);
                }}
              >
                새로 진단하기
              </Button>
              <Button className="flex-1" disabled={!selectedDiagnosis || submitting} onClick={handleMatchWithDiagnosis}>
                {submitting ? '처리 중...' : '이 진단으로 매칭'}
                {!submitting && <ArrowRight size={14} className="ml-1" />}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* 매칭 제안 완료 다이얼로그 */}
      {matchResult && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-2xl overflow-hidden text-center">
            <div className="px-8 pt-8 pb-2">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 ring-2 ring-emerald-500/20 mb-4">
                <CheckCircle size={32} className="text-emerald-400" />
              </div>
              <h2 className="text-lg font-bold text-white">매칭 제안을 보냈습니다</h2>
              <p className="mt-2 text-sm text-slate-400">
                <span className="text-primary font-medium">{matchResult.consultantName}</span> 컨설턴트에게 진단 결과와
                함께 매칭 제안이 전송되었습니다.
              </p>
              <p className="mt-1 text-xs text-slate-500">컨설턴트가 제안을 확인하면 알림으로 안내드립니다.</p>
            </div>
            <div className="px-8 pb-8 pt-4 flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setMatchResult(null);
                  router.push(`/consulting/diagnosis/report?id=${matchResult.diagnosisId}`);
                }}
              >
                진단 리포트 보기
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setMatchResult(null);
                  router.push('/consulting');
                }}
              >
                컨설팅 홈으로
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
