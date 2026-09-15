'use client';

import { Suspense, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, ArrowRight, Loader2, FileSignature, Building2, CreditCard, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { SectionCard } from '@/components/features/SectionCard';
import { cn } from '@/lib/utils';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useConsultation, useProposals, useTransitionStatus } from '@/hooks/consulting/useConsultations';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';

const SCOPE_LABELS: Record<string, string> = {
  diagnosis: '에너지 현황 진단',
  strategy: '전환 전략 수립',
  roadmap: '이행 로드맵',
  ppa: 'PPA 계약 지원',
};

function formatCost(n: number) {
  if (!n) return '협의 예정';
  if (n >= 10000) return `${(n / 10000).toLocaleString()}만원`;
  return `${n.toLocaleString()}원`;
}

export default function ContractPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">로딩 중...</div>}>
      <ContractContent />
    </Suspense>
  );
}

function ContractContent() {
  const { id } = useParams<{ id: string }>();
  const consultationId = Number(id);
  const router = useRouter();
  const toast = useToastStore((s) => s.add);
  const user = useAuthStore((s) => s.user);

  const { data: consultation, isLoading } = useConsultation(consultationId);
  const { data: apiProposals = [] } = useProposals(consultationId);
  const transitionStatus = useTransitionStatus();

  const c = (consultation ?? {}) as any;
  const acceptedProposal = (apiProposals as any[]).find((p: any) => p.status === 'ACCEPTED');

  let scope: string[] = [];
  try {
    scope = acceptedProposal?.proposedScope
      ? typeof acceptedProposal.proposedScope === 'string'
        ? JSON.parse(acceptedProposal.proposedScope)
        : acceptedProposal.proposedScope
      : [];
  } catch {
    /* JSON parse fallback */
  }

  const estimatedCost = acceptedProposal?.estimatedCost ?? 0;
  const estimatedDuration = acceptedProposal?.estimatedDuration ?? '';

  const [companyInfo, setCompanyInfo] = useState({
    name: c.clientCompanyName ?? user?.companyName ?? '',
    registrationNumber: '',
    representative: '',
    address: '',
  });
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [signed, setSigned] = useState(false);

  const canSubmit = agreedTerms && agreedPrivacy && companyInfo.name;

  const handleSign = () => {
    transitionStatus.mutate(
      { consultationId, status: 'ASSIGNED' },
      {
        onSuccess: () => {
          setSigned(true);
          toast('success', '계약이 체결되었습니다');
        },
        onError: () => toast('error', '계약 체결에 실패했습니다'),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative z-10">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative z-10 w-full max-w-lg mx-4 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-2xl overflow-hidden p-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 mb-4">
            <CheckCircle2 size={40} className="text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white">계약이 체결되었습니다!</h2>
          <p className="text-sm text-slate-400 mt-2">
            {c.consultantName ?? '컨설턴트'}와의 컨설팅 프로젝트가 시작됩니다.
          </p>

          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5 mt-6 text-left">
            <p className="text-xs text-slate-500 mb-3">프로젝트 시작 안내</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                  1
                </div>
                <div>
                  <p className="text-sm text-white font-medium">설문 조사 작성</p>
                  <p className="text-xs text-slate-500">에너지 사용 현황을 입력해주세요</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-slate-500 text-[10px] font-bold">
                  2
                </div>
                <div>
                  <p className="text-sm text-slate-400">현장 방문</p>
                  <p className="text-xs text-slate-500">컨설턴트가 사업장을 방문합니다</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-slate-500 text-[10px] font-bold">
                  3
                </div>
                <div>
                  <p className="text-sm text-slate-400">보고서 작성 및 검수</p>
                  <p className="text-xs text-slate-500">전략 보고서를 작성하고 검토합니다</p>
                </div>
              </div>
            </div>
          </div>

          <Button
            className="mt-6 w-full"
            onClick={() => router.push(`/consulting/project/${consultationId}?origin=${c.origin ?? 'marketplace'}`)}
          >
            프로젝트 시작하기 <ArrowRight size={14} className="ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-3xl mx-4 my-8 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-2xl overflow-hidden">
        <div className="px-8 pt-5">
          <Breadcrumb items={[{ label: '통합에너지 컨설팅', path: '/consulting' }, { label: '계약 체결' }]} />
        </div>

        <div className="flex items-center justify-between border-b border-white/[0.06] px-8 py-5">
          <div>
            <h1 className="text-xl font-bold text-white">계약 체결</h1>
            <p className="mt-0.5 text-xs text-slate-400">계약 조건을 확인하고 서명하세요</p>
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
          {/* Progress */}
          <div className="flex items-center gap-3">
            {['견적 요청', '제안서 비교', '사전 상담', '계약 체결'].map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold',
                      i < 3 && 'bg-emerald-500/20 text-emerald-400',
                      i === 3 && 'bg-primary/20 text-primary ring-2 ring-primary/30',
                    )}
                  >
                    {i < 3 ? <CheckCircle2 size={10} /> : <FileSignature size={10} />}
                  </div>
                  <span
                    className={cn('text-xs whitespace-nowrap', i === 3 ? 'text-primary font-medium' : 'text-slate-500')}
                  >
                    {step}
                  </span>
                </div>
                {i < 3 && <div className={cn('h-px w-8', i < 3 ? 'bg-emerald-500/40' : 'bg-white/[0.08]')} />}
              </div>
            ))}
          </div>

          {/* Contract summary */}
          <div className="rounded-xl bg-gradient-to-br from-primary/10 to-[#0d1520] ring-1 ring-primary/20 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} className="text-primary" />
              <p className="text-sm font-semibold text-white">계약 조건 요약</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] text-slate-500">컨설턴트</p>
                <p className="text-sm font-medium text-white mt-1">{c.consultantName ?? '미정'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">총 비용</p>
                <p className="text-sm font-medium text-white mt-1">{formatCost(estimatedCost)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">예상 기간</p>
                <p className="text-sm font-medium text-white mt-1">{estimatedDuration || '협의 예정'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">도메인</p>
                <p className="text-sm font-medium text-white mt-1">{c.domain ?? 'RE100'}</p>
              </div>
            </div>
            {scope.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-wrap gap-1.5">
                <p className="text-[10px] text-slate-500 w-full mb-1">서비스 범위</p>
                {scope.map((s: string) => (
                  <Badge key={s} variant="primary" className="text-[10px]">
                    {SCOPE_LABELS[s] ?? s}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Milestone payment */}
          <SectionCard
            title={
              <span className="flex items-center gap-2">
                <CreditCard size={14} /> 마일스톤별 결제
              </span>
            }
            description="각 단계 완료 시 해당 금액이 정산됩니다"
          >
            <div className="space-y-0">
              {[
                { title: '설문 완료', pct: 10 },
                { title: '현장 방문 완료', pct: 15 },
                { title: '보고서 초안 제출', pct: 35 },
                { title: '최종 보고 + 검수', pct: 40 },
              ].map((m, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.04] text-[10px] font-bold text-slate-500">
                      {i + 1}
                    </div>
                    <span className="text-sm text-white">{m.title}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-white">
                      {estimatedCost > 0 ? formatCost(Math.round((estimatedCost * m.pct) / 100)) : `${m.pct}%`}
                    </span>
                    <span className="text-[10px] text-slate-500 ml-2">({m.pct}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Company info */}
          <SectionCard
            title={
              <span className="flex items-center gap-2">
                <Building2 size={14} /> 기업 정보
              </span>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="회사명"
                required
                value={companyInfo.name}
                onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                placeholder="주식회사 그린에너지"
              />
              <Input
                label="사업자등록번호"
                value={companyInfo.registrationNumber}
                onChange={(e) => setCompanyInfo({ ...companyInfo, registrationNumber: e.target.value })}
                placeholder="123-45-67890"
              />
              <Input
                label="대표자"
                value={companyInfo.representative}
                onChange={(e) => setCompanyInfo({ ...companyInfo, representative: e.target.value })}
                placeholder="홍길동"
              />
              <Input
                label="주소"
                value={companyInfo.address}
                onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })}
                placeholder="서울시 강남구..."
              />
            </div>
          </SectionCard>

          {/* Terms */}
          <div className="space-y-3">
            <button onClick={() => setAgreedTerms(!agreedTerms)} className="flex items-center gap-3 w-full text-left">
              <div
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded shrink-0',
                  agreedTerms ? 'bg-primary text-white' : 'bg-white/[0.06] ring-1 ring-white/[0.12]',
                )}
              >
                {agreedTerms && <CheckCircle2 size={12} />}
              </div>
              <span className="text-sm text-slate-300">
                컨설팅 서비스 이용약관에 동의합니다
                <span className="text-primary ml-1">(필수)</span>
              </span>
            </button>
            <button
              onClick={() => setAgreedPrivacy(!agreedPrivacy)}
              className="flex items-center gap-3 w-full text-left"
            >
              <div
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded shrink-0',
                  agreedPrivacy ? 'bg-primary text-white' : 'bg-white/[0.06] ring-1 ring-white/[0.12]',
                )}
              >
                {agreedPrivacy && <CheckCircle2 size={12} />}
              </div>
              <span className="text-sm text-slate-300">
                개인정보 처리방침에 동의합니다
                <span className="text-primary ml-1">(필수)</span>
              </span>
            </button>
          </div>

          {/* Sign button */}
          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={() => router.back()}>
              돌아가기
            </Button>
            <Button onClick={handleSign} disabled={!canSubmit || transitionStatus.isPending} className="min-w-[200px]">
              {transitionStatus.isPending ? (
                <Loader2 size={14} className="animate-spin mr-2" />
              ) : (
                <FileSignature size={14} className="mr-2" />
              )}
              계약 체결하기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
