'use client';

import { Suspense, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { SectionCard } from '@/components/features/SectionCard';
import { cn } from '@/lib/utils';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useProfile } from '@/hooks/consulting/useConsultations';
import { useQuery } from '@tanstack/react-query';
import { getSpecializations } from '@/api/consulting/consultations';
import { useCreateConsultation } from '@/hooks/consulting/useConsultations';
import { useToastStore } from '@/stores/useToastStore';
import { useAuthStore } from '@/stores/useAuthStore';

const SCOPE_ITEMS = [
  { id: 'diagnosis', label: '에너지 현황 진단', checked: true },
  { id: 'strategy', label: '전환 전략 수립', checked: true },
  { id: 'roadmap', label: '이행 로드맵 작성', checked: true },
  { id: 'ppa', label: 'PPA 계약 지원', checked: false },
];

const AVAILABLE_SLOTS = [
  { date: '2026-05-22', time: '10:00', available: true },
  { date: '2026-05-22', time: '14:00', available: true },
  { date: '2026-05-23', time: '10:00', available: true },
  { date: '2026-05-23', time: '15:00', available: false },
  { date: '2026-05-26', time: '10:00', available: true },
  { date: '2026-05-26', time: '14:00', available: true },
];

const BASE_MILESTONES = [
  { title: '설문 조사', duration: '1주', cost: 500_000 },
  { title: '현장 방문', duration: '1주', cost: 1_000_000 },
  { title: '초안 작성', duration: '2주', cost: 2_500_000 },
  { title: '최종 보고', duration: '2주', cost: 3_500_000 },
  { title: '완료/리뷰', duration: '1주', cost: 500_000 },
];

const PPA_MILESTONES = [
  { title: 'PPA 계약 지원', duration: '3주', cost: 2_500_000 },
  { title: '검수/완료', duration: '1주', cost: 1_000_000 },
];

const formatCost = (n: number) => `${(n / 10000).toLocaleString()}만원`;

export default function MatchConfirmationPage() {
  return (
    <Suspense>
      <MatchConfirmationContent />
    </Suspense>
  );
}

function MatchConfirmationContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get('referral');
  const toast = useToastStore((s) => s.add);
  const user = useAuthStore((s) => s.user);
  const numId = Number(id) || 0;
  const { data: profileData } = useProfile(numId);
  const { data: apiSpecs } = useQuery({
    queryKey: ['consultant', 'specializations', numId],
    queryFn: () => getSpecializations(numId),
    staleTime: 60_000,
    enabled: !!numId,
  });
  const createConsultation = useCreateConsultation();

  const consultant = {
    id: (profileData as any)?.id ?? numId,
    name: ((profileData as any)?.userName ?? (profileData as any)?.name ?? '컨설턴트') as string,
    initial: (((profileData as any)?.userName ?? (profileData as any)?.name ?? '?') as string).charAt(0),
    specialization: (apiSpecs?.[0] ?? '컨설팅') + ' 전문',
    experience: ((profileData as any)?.experience ?? 0) as number,
    matchScore: ((profileData as any)?.matchScore ?? undefined) as number | undefined,
  };

  const [scope, setScope] = useState(SCOPE_ITEMS);
  const [includePpa, setIncludePpa] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [companyDetail, setCompanyDetail] = useState({
    name: '',
    address: '',
    representative: '',
    registrationNumber: '',
  });

  const milestones = includePpa ? [...BASE_MILESTONES, ...PPA_MILESTONES] : BASE_MILESTONES;
  const totalCost = milestones.reduce((sum, m) => sum + m.cost, 0);

  const handleToggleScope = (scopeId: string) => {
    setScope(scope.map((s) => (s.id === scopeId ? { ...s, checked: !s.checked } : s)));
    if (scopeId === 'ppa') {
      setIncludePpa((prev) => !prev);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-3xl mx-4 my-8 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-2xl overflow-hidden">
        {/* Breadcrumb */}
        <div className="px-8 pt-5">
          <Breadcrumb
            items={[
              { label: '통합에너지 컨설팅', path: '/consulting' },
              { label: '마켓플레이스', path: '/consulting/marketplace' },
              { label: '매칭 확인' },
            ]}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-8 py-5">
          <div>
            <h1 className="text-xl font-bold text-white">매칭 확인 및 계약</h1>
            <p className="mt-0.5 text-xs text-slate-400">프로젝트 범위와 일정을 확인하고 계약을 요청하세요</p>
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
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                {consultant.initial}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{consultant.name} 컨설턴트</p>
                <p className="text-xs text-slate-500">
                  {consultant.specialization} · 경력 {consultant.experience}년
                </p>
              </div>
              {consultant.matchScore && (
                <Badge variant="primary" className="ml-auto">
                  매칭 {consultant.matchScore}%
                </Badge>
              )}
            </div>
            {referralCode && (
              <div className="mt-3 rounded-lg bg-blue-500/5 ring-1 ring-blue-500/20 px-3 py-2">
                <p className="text-[10px] text-blue-400">추천 코드를 통해 연결된 컨설턴트입니다</p>
              </div>
            )}
          </div>

          <SectionCard title="프로젝트 범위" description="수행 항목을 선택하세요">
            <div className="space-y-2">
              {scope.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleToggleScope(item.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-4 py-3 ring-1 transition-colors text-left',
                    item.checked ? 'ring-primary/30 bg-primary/5' : 'ring-white/[0.06] bg-white/[0.02]',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded',
                      item.checked ? 'bg-primary text-white' : 'bg-white/[0.06]',
                    )}
                  >
                    {item.checked && <CheckCircle2 size={12} />}
                  </div>
                  <span className={cn('text-sm', item.checked ? 'text-white' : 'text-slate-400')}>{item.label}</span>
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="마일스톤 및 일정">
            <div className="space-y-3">
              {milestones.map((milestone, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                      {i + 1}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-white">{milestone.title}</p>
                      {i >= BASE_MILESTONES.length && (
                        <Badge variant="info" className="ml-1">
                          PPA
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar size={10} /> {milestone.duration}
                    </span>
                    <span className="text-sm text-slate-300">{formatCost(milestone.cost)}</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                <span className="text-sm font-medium text-white">총 비용 (예상)</span>
                <span className="text-base font-bold text-primary">{formatCost(totalCost)}</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="사전 상담 예약" description="컨설턴트와 사전 상담 일정을 선택하세요">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {AVAILABLE_SLOTS.filter((s) => s.available).map((slot) => {
                const key = `${slot.date}_${slot.time}`;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedSlot(key)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-4 py-3 ring-1 transition-colors text-left',
                      selectedSlot === key
                        ? 'ring-primary/40 bg-primary/10'
                        : 'ring-white/[0.06] bg-white/[0.02] hover:ring-white/[0.12]',
                    )}
                  >
                    <Calendar size={14} className={selectedSlot === key ? 'text-primary' : 'text-slate-400'} />
                    <div>
                      <p className={cn('text-sm', selectedSlot === key ? 'text-white font-medium' : 'text-slate-300')}>
                        {slot.date}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock size={10} /> {slot.time}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="기업 정보">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="회사명"
                required
                value={companyDetail.name}
                onChange={(e) => setCompanyDetail({ ...companyDetail, name: e.target.value })}
                placeholder="주식회사 그린에너지"
              />
              <Input
                label="사업자등록번호"
                value={companyDetail.registrationNumber}
                onChange={(e) => setCompanyDetail({ ...companyDetail, registrationNumber: e.target.value })}
                placeholder="123-45-67890"
              />
              <Input
                label="대표자"
                value={companyDetail.representative}
                onChange={(e) => setCompanyDetail({ ...companyDetail, representative: e.target.value })}
                placeholder="홍길동"
              />
              <Input
                label="주소"
                value={companyDetail.address}
                onChange={(e) => setCompanyDetail({ ...companyDetail, address: e.target.value })}
                placeholder="서울시 강남구..."
              />
            </div>
          </SectionCard>

          {/* Footer */}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => router.back()}>
              취소
            </Button>
            <Button
              disabled={createConsultation.isPending}
              onClick={() => {
                const origin = referralCode ? 'REFERRAL' : 'MARKETPLACE';
                createConsultation.mutate(
                  {
                    clientCompanyId: user?.companyId ?? 0,
                    origin,
                    domain: 'RE100',
                    includePpaSupport: includePpa,
                  },
                  {
                    onSuccess: (data: any) => {
                      toast('success', '계약 합의 요청이 완료되었습니다');
                      router.push(`/consulting/status/${data?.id ?? id}`);
                    },
                    onError: () => toast('error', '요청에 실패했습니다'),
                  },
                );
              }}
            >
              계약 합의 요청
            </Button>
          </div>
        </div>
        {/* end p-8 */}
      </div>
      {/* end modal */}
    </div>
  );
}
