'use client';

import { Suspense, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Users,
  User,
  Zap,
  FileText,
  Shield,
  Handshake,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useProfile } from '@/hooks/consulting/useConsultations';
import { useCreateProposal } from '@/hooks/consulting/useConsultations';
import { useToastStore } from '@/stores/useToastStore';

const SERVICE_ITEMS = [
  {
    id: 'diagnosis',
    label: '에너지 현황 진단',
    description: '사업장 에너지 사용 현황 분석 및 과제 도출',
    required: true,
    icon: Zap,
  },
  {
    id: 'strategy',
    label: '전환 전략 수립',
    description: 'RE100 달성을 위한 단계별 전환 전략 설계',
    required: true,
    icon: FileText,
  },
  {
    id: 'roadmap',
    label: '이행 로드맵 작성',
    description: '연도별 목표 설정 및 실행 계획 수립',
    required: false,
    icon: Shield,
  },
  {
    id: 'ppa',
    label: 'PPA 계약 지원',
    description: 'PPA 계약서 초안 작성 및 협상 지원',
    required: false,
    icon: Handshake,
  },
];

type QuoteMode = 'single' | 'compare';

export default function QuoteRequestPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">로딩 중...</div>}>
      <QuoteRequestContent />
    </Suspense>
  );
}

function QuoteRequestContent() {
  const { consultantId } = useParams<{ consultantId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get('referral');
  const toast = useToastStore((s) => s.add);
  const { data: profileData } = useProfile(Number(consultantId) || 0);
  const createProposal = useCreateProposal();

  const consultant = {
    id: (profileData as any)?.id ?? Number(consultantId),
    name: ((profileData as any)?.userName ?? '컨설턴트') as string,
    bio: ((profileData as any)?.bio ?? '') as string,
    experience: ((profileData as any)?.experienceYears ?? 0) as number,
    rating: ((profileData as any)?.rating ?? 0) as number,
    region: ((profileData as any)?.region ?? '') as string,
  };

  const [selectedServices, setSelectedServices] = useState<string[]>(['diagnosis', 'strategy']);
  const [quoteMode, setQuoteMode] = useState<QuoteMode>('single');
  const [memo, setMemo] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const toggleService = (id: string) => {
    const item = SERVICE_ITEMS.find((s) => s.id === id);
    if (item?.required) return;
    setSelectedServices((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleSubmit = () => {
    createProposal.mutate(
      {
        profileId: consultant.id,
        domain: 'RE100',
        proposedScope: JSON.stringify(selectedServices),
        estimatedCost: 0,
        coverLetter: memo || undefined,
      },
      {
        onSuccess: () => {
          setSubmitted(true);
          toast('success', '견적 요청이 전송되었습니다');
        },
        onError: () => toast('error', '견적 요청에 실패했습니다'),
      },
    );
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative z-10 w-full max-w-lg mx-4 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-2xl overflow-hidden p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 mb-4">
            <CheckCircle2 size={32} className="text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white">견적 요청이 전송되었습니다</h2>
          <p className="text-sm text-slate-400 mt-2">
            {consultant.name} 컨설턴트에게 요청이 전달되었습니다.
            <br />
            제안서가 도착하면 알림으로 안내드립니다.
          </p>
          <p className="text-xs text-slate-500 mt-4">보통 1~3 영업일 내에 제안서가 도착합니다</p>
          <div className="flex gap-3 justify-center mt-6">
            <Button onClick={() => router.push('/consulting')}>컨설팅 홈으로</Button>
            <Button variant="secondary" onClick={() => router.push('/consulting/status')}>
              내 컨설팅 확인
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-3xl mx-4 my-8 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-2xl overflow-hidden">
        <div className="px-8 pt-5">
          <Breadcrumb
            items={[
              { label: '통합에너지 컨설팅', path: '/consulting' },
              { label: '마켓플레이스', path: '/consulting/marketplace' },
              { label: '견적 요청' },
            ]}
          />
        </div>

        <div className="flex items-center justify-between border-b border-white/[0.06] px-8 py-5">
          <div>
            <h1 className="text-xl font-bold text-white">견적 요청</h1>
            <p className="mt-0.5 text-xs text-slate-400">필요한 서비스를 선택하고 맞춤 견적을 요청하세요</p>
          </div>
          <button
            onClick={() => router.back()}
            className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="닫기"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-8 space-y-6">
          {/* Consultant Info */}
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
                {consultant.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{consultant.name} 컨설턴트</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {consultant.region && `${consultant.region} · `}경력 {consultant.experience}년
                  {consultant.rating > 0 && ` · ★ ${consultant.rating}`}
                </p>
              </div>
              {referralCode && (
                <Badge variant="info" className="shrink-0">
                  추천 연결
                </Badge>
              )}
            </div>
          </div>

          {/* Quote Mode */}
          <div>
            <p className="text-sm font-medium text-slate-400 mb-3">견적 유형</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setQuoteMode('single')}
                className={cn(
                  'rounded-xl p-4 text-left ring-1 transition-all',
                  quoteMode === 'single'
                    ? 'bg-primary/10 ring-primary/40'
                    : 'bg-white/[0.02] ring-white/[0.06] hover:ring-white/[0.12]',
                )}
              >
                <User size={18} className={quoteMode === 'single' ? 'text-primary' : 'text-slate-400'} />
                <p className="mt-2 text-sm font-medium text-white">지정 견적</p>
                <p className="mt-1 text-xs text-slate-500">이 컨설턴트에게만 견적을 요청합니다</p>
              </button>
              <div className="rounded-xl p-4 text-left ring-1 ring-white/[0.04] bg-white/[0.01] opacity-50 cursor-not-allowed relative">
                <Users size={18} className="text-slate-500" />
                <p className="mt-2 text-sm font-medium text-slate-500">비교 견적</p>
                <p className="mt-1 text-xs text-slate-600">유사 컨설턴트 최대 3명에게 동시 요청</p>
                <Badge variant="default" className="absolute top-3 right-3 text-[9px]">
                  준비 중
                </Badge>
              </div>
            </div>
          </div>

          {/* Service Selection */}
          <div>
            <p className="text-sm font-medium text-slate-400 mb-3">서비스 범위 선택</p>
            <div className="space-y-2">
              {SERVICE_ITEMS.map((item) => {
                const selected = selectedServices.includes(item.id);
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleService(item.id)}
                    className={cn(
                      'flex w-full items-center gap-4 rounded-xl px-5 py-4 ring-1 transition-all text-left',
                      selected
                        ? 'ring-primary/30 bg-primary/5'
                        : 'ring-white/[0.06] bg-white/[0.02] hover:ring-white/[0.12]',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg shrink-0',
                        selected ? 'bg-primary/20' : 'bg-white/[0.06]',
                      )}
                    >
                      <Icon size={16} className={selected ? 'text-primary' : 'text-slate-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm font-medium', selected ? 'text-white' : 'text-slate-400')}>
                          {item.label}
                        </span>
                        {item.required && (
                          <Badge variant="default" className="text-[9px]">
                            필수
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                    </div>
                    <div
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded shrink-0',
                        selected ? 'bg-primary text-white' : 'bg-white/[0.06]',
                      )}
                    >
                      {selected && <CheckCircle2 size={12} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Memo */}
          <div>
            <p className="text-sm font-medium text-slate-400 mb-3">요청 메모 (선택)</p>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              placeholder="견적 시 참고할 사항이 있으면 입력하세요. 예: 울산 사업장 2곳, 6월 중 시작 희망"
              className="w-full rounded-xl border border-accent/30 bg-surface-dark px-4 py-3 text-sm text-white placeholder:text-accent/40 resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </div>

          {/* Summary */}
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5">
            <p className="text-xs text-slate-500 mb-3">요청 요약</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-[10px] text-slate-500">서비스 항목</p>
                <p className="text-base font-bold text-white mt-1">{selectedServices.length}개</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">견적 유형</p>
                <p className="text-base font-bold text-white mt-1">{quoteMode === 'single' ? '지정' : '비교'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">예상 응답</p>
                <p className="text-base font-bold text-white mt-1">1~3일</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => router.back()}>
              <ArrowLeft size={14} className="mr-1" /> 돌아가기
            </Button>
            <Button onClick={handleSubmit} disabled={selectedServices.length === 0 || createProposal.isPending}>
              {createProposal.isPending ? (
                <Loader2 size={14} className="animate-spin mr-1" />
              ) : (
                <ArrowRight size={14} className="mr-1" />
              )}
              견적 요청 보내기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
