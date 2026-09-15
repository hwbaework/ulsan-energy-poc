'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Star, MapPin, Briefcase, ArrowLeft, Award, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';
import type { ConsultationDomain } from '@/types/consultation';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useProfile } from '@/hooks/consulting/useConsultations';
import { useQuery } from '@tanstack/react-query';
import { getSpecializations } from '@/api/consulting/consultations';

const DOMAIN_LABELS: Record<ConsultationDomain, string> = {
  RE100: 'RE100',
  CARBON_REDUCTION: '탄소감축',
  DISTRIBUTED_ENERGY: '분산에너지',
};

interface ConsultantDetail {
  id: number;
  name: string;
  specializations: ConsultationDomain[];
  rating: number;
  reviewCount: number;
  experience: number;
  completedProjects: number;
  matchScore?: number;
  bio: string;
  region: string;
  availableFrom: string;
  agencyId?: number;
  agencyName?: string;
}

const PORTFOLIO: { title: string; year: string; result: string }[] = [];
const REVIEWS: { author: string; rating: number; comment: string; date: string }[] = [];
const SCHEDULE: { date: string; available: boolean }[] = [];

const TABS_INDEPENDENT = [
  { id: 'specialization', label: '전문분야' },
  { id: 'portfolio', label: '포트폴리오' },
  { id: 'reviews', label: '리뷰' },
  { id: 'schedule', label: '일정' },
];

const TABS_AGENCY = [
  { id: 'specialization', label: '전문분야' },
  { id: 'portfolio', label: '포트폴리오' },
  { id: 'reviews', label: '리뷰' },
];

export default function ConsultantProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('specialization');
  const numId = Number(id);
  const { data: apiProfile, isError } = useProfile(numId);
  const { data: apiSpecs } = useQuery({
    queryKey: ['consultant', 'specializations', numId],
    queryFn: () => getSpecializations(numId),
    staleTime: 60_000,
    enabled: !!numId,
  });

  const consultant: ConsultantDetail =
    !isError && apiProfile
      ? {
          id: (apiProfile as any).id,
          name: (apiProfile as any).userName ?? '',
          specializations: (apiSpecs ?? []) as ConsultationDomain[],
          rating: (apiProfile as any).rating ?? 0,
          reviewCount: (apiProfile as any).reviewCount ?? 0,
          experience: (apiProfile as any).experienceYears ?? 0,
          completedProjects: (apiProfile as any).completedProjects ?? 0,
          matchScore: undefined,
          bio: (apiProfile as any).bio ?? '',
          region: (apiProfile as any).region ?? '',
          availableFrom: '',
          agencyId: undefined,
          agencyName: undefined,
        }
      : {
          id: numId,
          name: '',
          specializations: [],
          rating: 0,
          reviewCount: 0,
          experience: 0,
          completedProjects: 0,
          bio: '',
          region: '',
          availableFrom: '',
        };
  const isAgency = !!consultant.agencyId;
  const tabs = isAgency ? TABS_AGENCY : TABS_INDEPENDENT;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-4xl mx-4 my-8 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-8 py-5">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            돌아가기
          </button>
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
          <div className="mb-4">
            <Breadcrumb
              items={[
                { label: '통합에너지 컨설팅', path: '/consulting' },
                { label: '마켓플레이스', path: '/consulting/marketplace' },
                { label: consultant.name },
              ]}
            />
          </div>

          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-6">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                {consultant.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-xl font-bold text-white">{consultant.name}</h1>
                  {isAgency ? (
                    <Badge variant="default" className="flex items-center gap-1">
                      <Building2 size={10} />
                      {consultant.agencyName} 소속
                    </Badge>
                  ) : (
                    consultant.matchScore && <Badge variant="primary">매칭 {consultant.matchScore}%</Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-400">{consultant.bio}</p>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-400">
                  <span className="flex items-center gap-1">
                    <Star size={14} className="text-amber-400 fill-amber-400" />
                    {consultant.rating} ({consultant.reviewCount}개 리뷰)
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={14} /> {consultant.region}
                  </span>
                  <span className="flex items-center gap-1">
                    <Briefcase size={14} /> 경력 {consultant.experience}년
                  </span>
                  <span className="flex items-center gap-1">
                    <Award size={14} /> {consultant.completedProjects}건 완료
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                {isAgency ? (
                  <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-3 text-center">
                    <p className="text-[10px] text-slate-500">소속 용역사</p>
                    <p className="text-sm font-medium text-white mt-1">{consultant.agencyName}</p>
                    <p className="text-[10px] text-slate-500 mt-1">용역사를 통해 배정됩니다</p>
                  </div>
                ) : (
                  <Button onClick={() => router.push(`/consulting/quote/request/${id}`)}>견적 요청</Button>
                )}
              </div>
            </div>
          </div>

          <Tabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} />

          <div className="mt-4">
            {activeTab === 'specialization' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {consultant.specializations.map((s) => (
                  <div key={s} className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5">
                    <Badge variant="primary" className="mb-3">
                      {DOMAIN_LABELS[s]}
                    </Badge>
                    <p className="text-sm text-slate-300">
                      {s === 'RE100' &&
                        '기업별 맞춤 RE100 이행 로드맵 수립, PPA/REC/자가발전 전략 최적 조합 도출, 비용-효과 분석 및 단계별 실행 계획'}
                      {s === 'CARBON_REDUCTION' &&
                        '스코프 1,2,3 탄소 배출 분석, 감축 목표 설정 및 이행 전략, TCFD/CDP 대응 지원'}
                      {s === 'DISTRIBUTED_ENERGY' &&
                        '태양광/ESS 최적 용량 설계, 분산에너지 자원 통합 관리 전략, 피크 저감 및 요금 최적화'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'portfolio' && (
              <div className="space-y-3">
                {PORTFOLIO.map((item, i) => (
                  <div key={i} className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.year}</p>
                      </div>
                      <Badge variant="success" className="text-[10px]">
                        {item.result}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-3">
                {REVIEWS.map((review, i) => (
                  <div key={i} className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">{review.author}</span>
                      <span className="text-xs text-slate-500">{review.date}</span>
                    </div>
                    <div className="flex gap-0.5 mb-2">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star
                          key={j}
                          size={12}
                          className={j < review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-slate-400">{review.comment}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'schedule' && !isAgency && (
              <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5">
                <p className="text-sm font-medium text-white mb-4">가능한 상담 일정</p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {SCHEDULE.map((s) => (
                    <div
                      key={s.date}
                      className={cn(
                        'rounded-lg p-3 text-center text-xs ring-1',
                        s.available
                          ? 'ring-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                          : 'ring-white/[0.06] bg-white/[0.02] text-slate-500 line-through',
                      )}
                    >
                      {s.date.slice(5)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* end p-8 */}
      </div>
      {/* end modal */}
    </div>
  );
}
