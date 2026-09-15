'use client';

import { Suspense, useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Star, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SectionCard } from '@/components/features/SectionCard';
import { cn } from '@/lib/utils';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useConsultation, useCreateReview, useReview } from '@/hooks/consulting/useConsultations';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';

function buildProjectSummary(c: any) {
  const appliedDate = c.appliedAt ? new Date(c.appliedAt) : null;
  const completedDate = c.completedAt ? new Date(c.completedAt) : new Date();
  const durationDays = appliedDate ? Math.round((completedDate.getTime() - appliedDate.getTime()) / 86400000) : 0;

  return {
    consultant: c.consultantName ?? '컨설턴트',
    domain:
      c.domain === 'CARBON_REDUCTION'
        ? '탄소감축 전략'
        : c.domain === 'DISTRIBUTED_ENERGY'
          ? '분산에너지 전환'
          : 'RE100 이행 전략',
    startDate: appliedDate ? appliedDate.toLocaleDateString('ko-KR') : '-',
    endDate: completedDate.toLocaleDateString('ko-KR'),
    duration: durationDays > 0 ? `${durationDays}일` : '-',
  };
}

const RATING_DIMENSIONS = [
  { id: 'expertise', label: '전문성' },
  { id: 'communication', label: '커뮤니케이션' },
  { id: 'timeliness', label: '시간 준수' },
  { id: 'quality', label: '결과물 품질' },
  { id: 'recommendation', label: '재계약 의향' },
];

export default function ReviewPage() {
  return (
    <Suspense>
      <ReviewContent />
    </Suspense>
  );
}

function ReviewContent() {
  const { id } = useParams();
  const consultationId = Number(id);
  const router = useRouter();
  const searchParams = useSearchParams();
  const origin = searchParams.get('origin') ?? 'marketplace';
  const toast = useToastStore((s) => s.add);
  const user = useAuthStore((s) => s.user);

  const { data: consultation } = useConsultation(consultationId);
  const { data: existingReview } = useReview(consultationId);
  const createReview = useCreateReview();

  const [ratings, setRatings] = useState<Record<string, number>>({
    expertise: 0,
    communication: 0,
    timeliness: 0,
    quality: 0,
    recommendation: 0,
  });
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const c = consultation as any;

  const handleRate = (dimension: string, value: number) => {
    setRatings({ ...ratings, [dimension]: value });
  };

  const handleSubmit = () => {
    const reviewerId = user?.id ?? (c?.consultantId ? c.consultantId : 1);
    createReview.mutate(
      {
        consultationId,
        params: {
          reviewerId,
          expertise: ratings.expertise ?? 0,
          communication: ratings.communication ?? 0,
          timeliness: ratings.timeliness ?? 0,
          quality: ratings.quality ?? 0,
          recommendation: ratings.recommendation ?? 0,
          comment: comment || undefined,
        },
      },
      {
        onSuccess: () => {
          setSubmitted(true);
          toast('success', '리뷰가 제출되었습니다');
        },
        onError: () => {
          toast('error', '리뷰 제출에 실패했습니다');
        },
      },
    );
  };

  const allRated = Object.values(ratings).every((r) => r > 0);

  useEffect(() => {
    if (existingReview && !submitted) {
      setSubmitted(true);
    }
  }, [existingReview, submitted]);

  if (submitted) {
    return (
      <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative z-10 w-full max-w-2xl mx-4 my-8 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-2xl overflow-hidden">
          <div className="p-8 space-y-6">
            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 mb-4">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <h1 className="text-xl font-bold text-white">리뷰가 제출되었습니다</h1>
              <p className="mt-2 text-sm text-slate-400">소중한 피드백 감사합니다</p>
              <Button className="mt-6" onClick={() => router.push('/consulting')}>
                컨설팅 홈으로
              </Button>
            </div>

            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-6 text-center">
              <p className="text-sm font-medium text-white mb-2">다음 컨설팅이 필요하신가요?</p>
              <p className="text-xs text-slate-500 mb-4">마켓플레이스에서 다양한 컨설턴트를 비교해보세요</p>
              <Button variant="secondary" onClick={() => router.push('/consulting/marketplace')}>
                마켓플레이스 둘러보기 <ArrowRight size={12} className="ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-2xl mx-4 my-8 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-2xl overflow-hidden">
        <div className="px-8 pt-5">
          <Breadcrumb
            items={[
              { label: '통합에너지 컨설팅', path: '/consulting' },
              { label: '프로젝트', path: `/consulting/project/${id}?origin=${origin}` },
              { label: '리뷰' },
            ]}
          />
        </div>

        <div className="flex items-center justify-between border-b border-white/[0.06] px-8 py-5">
          <div>
            <h1 className="text-xl font-bold text-white">컨설팅 완료 및 리뷰</h1>
            <p className="mt-0.5 text-xs text-slate-400">컨설팅 결과를 평가해 주세요</p>
          </div>
          <button
            onClick={() => router.push(`/consulting/project/${id}`)}
            className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="닫기"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-8 space-y-6">
          <SectionCard title="프로젝트 요약">
            {(() => {
              const summary = buildProjectSummary(c);
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="text-center">
                      <p className="text-xs text-slate-500">{origin === 'outsource' ? '배정 전문가' : '컨설턴트'}</p>
                      <p className="text-sm font-medium text-white mt-1">{summary.consultant}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-500">분야</p>
                      <p className="text-sm font-medium text-white mt-1">{summary.domain}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-500">기간</p>
                      <p className="text-sm font-medium text-white mt-1">{summary.duration}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-500">시작 ~ 종료</p>
                      <p className="text-sm font-medium text-white mt-1">
                        {summary.startDate} ~ {summary.endDate}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </SectionCard>

          <SectionCard title="평가">
            <div className="space-y-5">
              {RATING_DIMENSIONS.map((dim) => (
                <div key={dim.id} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{dim.label}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button key={value} onClick={() => handleRate(dim.id, value)} className="p-0.5">
                        <Star
                          size={20}
                          className={cn(
                            'transition-colors',
                            value <= (ratings[dim.id] ?? 0)
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-600 hover:text-slate-400',
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-6">
            <label className="block text-sm font-medium text-slate-400 mb-2">상세 리뷰 (선택)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="컨설팅 경험에 대해 자유롭게 작성해 주세요..."
              className="w-full rounded-lg border border-accent/30 bg-surface-dark px-4 py-3 text-sm text-white placeholder:text-accent/40 resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => router.push(`/consulting/project/${id}?origin=${origin}`)}>
              나중에 하기
            </Button>
            <Button onClick={handleSubmit} disabled={!allRated}>
              리뷰 제출
            </Button>
          </div>
        </div>
        {/* end p-8 */}
      </div>
      {/* end modal */}
    </div>
  );
}
