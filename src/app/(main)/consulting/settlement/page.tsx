'use client';

import { useMemo } from 'react';
import { Wallet, TrendingUp, Banknote, Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { StatCard, StatsGrid, SectionCard } from '@/components/features';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import {
  useConsultations,
  useSettlements,
  useApproveSettlement,
  usePaySettlement,
} from '@/hooks/consulting/useConsultations';
import { getPersona, usePersonaOverride } from '@/lib/persona';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { cn } from '@/lib/utils';

const STATUS_MAP: Record<string, { variant: 'info' | 'warning' | 'success'; label: string }> = {
  PENDING: { variant: 'info', label: '검수 대기' },
  APPROVED: { variant: 'warning', label: '승인/미지급' },
  PAID: { variant: 'success', label: '지급 완료' },
};

function SettlementList({ consultationId, projectName }: { consultationId: number; projectName: string }) {
  const { data: settlements = [] } = useSettlements(consultationId);
  const approveSettlement = useApproveSettlement();
  const paySettlement = usePaySettlement();

  if ((settlements as any[]).length === 0) return null;

  return (
    <>
      {(settlements as any[]).map((s: any) => {
        const status = STATUS_MAP[s.status as string] ?? { variant: 'info' as const, label: '검수 대기' };
        return (
          <tr key={s.id} className="hover:bg-white/[0.03] transition-colors">
            <td className="px-6 py-3 text-slate-300 tabular-nums">S-{s.id}</td>
            <td className="px-6 py-3 text-white">{s.agencyName ?? '-'}</td>
            <td className="px-6 py-3 text-slate-300">{projectName}</td>
            <td className="px-6 py-3 text-slate-300">{s.milestoneTitle ?? '-'}</td>
            <td className="px-6 py-3 text-white tabular-nums">₩ {Number(s.amount ?? 0).toLocaleString()}</td>
            <td className="px-6 py-3">
              <Badge variant={status.variant}>{status.label}</Badge>
            </td>
            <td className="px-6 py-3 text-slate-500 tabular-nums">
              {s.createdAt ? new Date(s.createdAt).toLocaleDateString('ko-KR') : '-'}
            </td>
            <td className="px-6 py-3">
              {s.status === 'PENDING' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] px-2"
                  onClick={() => approveSettlement.mutate(s.id)}
                  disabled={approveSettlement.isPending}
                >
                  승인
                </Button>
              )}
              {s.status === 'APPROVED' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] px-2"
                  onClick={() => paySettlement.mutate(s.id)}
                  disabled={paySettlement.isPending}
                >
                  지급
                </Button>
              )}
              {s.status === 'PAID' && (
                <span className="text-xs text-slate-500">
                  {s.paidAt ? new Date(s.paidAt).toLocaleDateString('ko-KR') : '-'}
                </span>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}

const SETTLEMENT_STATUS_META: Record<string, { variant: 'success' | 'warning' | 'default'; label: string }> = {
  PAID: { variant: 'success', label: '지급 완료' },
  APPROVED: { variant: 'warning', label: '승인/미지급' },
  PENDING: { variant: 'default', label: '검수 대기' },
};

function ConsumerSettlementView() {
  const { data: apiData, isLoading: loadingConsultations } = useConsultations();

  const consultations = useMemo(() => {
    if (!apiData?.content) return [];
    return (apiData.content as any[]).filter((c: any) => !['CANCELLED'].includes(c.status));
  }, [apiData]);

  const latestConsultation = consultations[0];

  if (loadingConsultations) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!latestConsultation) {
    return (
      <div className="space-y-6">
        <div className="mb-4">
          <Breadcrumb items={[{ label: '통합에너지 컨설팅', path: '/consulting' }, { label: '정산 확인' }]} />
        </div>
        <div className="py-16 text-center text-sm text-slate-500">진행 중인 컨설팅이 없습니다</div>
      </div>
    );
  }

  return <ConsumerSettlementDetail consultation={latestConsultation} />;
}

function ConsumerSettlementDetail({ consultation }: { consultation: any }) {
  const toast = useToastStore((s) => s.add);
  const { data: settlements = [], isLoading: loadingSettlements } = useSettlements(consultation.id);
  const approveSettlement = useApproveSettlement();

  const items = settlements as any[];
  const totalAmount = items.reduce((s: number, m: any) => s + Number(m.amount ?? 0), 0);
  const paidSum = items
    .filter((m: any) => m.status === 'PAID')
    .reduce((s: number, m: any) => s + Number(m.amount ?? 0), 0);
  const remainSum = totalAmount - paidSum;

  const DOMAIN_LABEL: Record<string, string> = {
    RE100: 'RE100',
    CARBON_REDUCTION: '탄소감축',
    DISTRIBUTED_ENERGY: '분산에너지',
  };
  const domainLabel = DOMAIN_LABEL[consultation.domain] || consultation.domain || '';
  const title = `${domainLabel} 컨설팅`;

  const handleApprove = (settlementId: number) => {
    approveSettlement.mutate(settlementId, {
      onSuccess: () => toast('success', '검수를 승인했습니다 — 해당 보수가 지급 처리됩니다'),
      onError: () => toast('error', '승인에 실패했습니다. 잠시 후 다시 시도해 주세요.'),
    });
  };

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Breadcrumb items={[{ label: '통합에너지 컨설팅', path: '/consulting' }, { label: '정산 확인' }]} />
      </div>
      <div>
        <h1 className="text-xl font-bold text-white">정산 확인</h1>
        <p className="mt-1 text-sm text-slate-400">
          컨설팅 보수 지급 현황 — 검수를 승인하면 해당 단계 보수가 지급됩니다
        </p>
      </div>

      <StatsGrid columns={3}>
        <StatCard
          icon={<Wallet size={18} className="text-sky-400" />}
          label="계약 금액"
          value={`₩ ${totalAmount.toLocaleString()}`}
          sub={`${consultation.consultantName ?? '미배정'} · ${title}`}
        />
        <StatCard
          icon={<CheckCircle2 size={18} className="text-emerald-400" />}
          label="지급 완료"
          value={`₩ ${paidSum.toLocaleString()}`}
          sub={`${items.filter((m: any) => m.status === 'PAID').length}/${items.length} 단계`}
        />
        <StatCard
          icon={<Banknote size={18} className="text-amber-400" />}
          label="지급 예정"
          value={`₩ ${remainSum.toLocaleString()}`}
          sub="검수 완료 시 단계별 지급"
        />
      </StatsGrid>

      <div className="rounded-xl bg-blue-500/[0.04] ring-1 ring-blue-500/20 px-5 py-4 flex items-start gap-3">
        <ShieldCheck size={16} className="text-blue-300 mt-0.5 shrink-0" />
        <div className="text-xs text-slate-300 space-y-1">
          <p className="text-blue-200 font-medium">성공보수 중심 구조 — 결과가 나와야 큰 금액이 나갑니다</p>
          <p>검수 승인 시 해당 단계 보수가 지급 처리됩니다. 최종 검수 후 30일간 하자 보완 무상 보증이 적용됩니다.</p>
        </div>
      </div>

      <SectionCard
        title="정산 내역"
        description={`${title} · ${consultation.appliedAt ? new Date(consultation.appliedAt).toLocaleDateString('ko-KR') : ''} 계약`}
      >
        {loadingSettlements ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">등록된 정산 내역이 없습니다</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-400 border-b border-white/[0.06]">
                  <tr>
                    <th className="px-6 py-3 font-medium">단계</th>
                    <th className="px-6 py-3 font-medium">금액</th>
                    <th className="px-6 py-3 font-medium">상태</th>
                    <th className="px-6 py-3 font-medium">요청일</th>
                    <th className="px-6 py-3 font-medium">처리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {items.map((s: any) => {
                    const meta = SETTLEMENT_STATUS_META[s.status as string] ?? {
                      variant: 'default' as const,
                      label: s.status,
                    };
                    return (
                      <tr key={s.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="px-6 py-3 text-white font-medium">{s.milestoneTitle ?? '-'}</td>
                        <td className="px-6 py-3 text-white tabular-nums">
                          ₩ {Number(s.amount ?? 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </td>
                        <td className="px-6 py-3 text-slate-500 tabular-nums">
                          {s.createdAt ? new Date(s.createdAt).toLocaleDateString('ko-KR') : '—'}
                        </td>
                        <td className="px-6 py-3">
                          {s.status === 'PENDING' && (
                            <Button
                              size="sm"
                              variant="primary"
                              className="h-7 text-xs"
                              onClick={() => handleApprove(s.id)}
                              disabled={approveSettlement.isPending}
                            >
                              검수 승인
                            </Button>
                          )}
                          {s.status === 'APPROVED' && <span className="text-xs text-amber-400">승인 완료</span>}
                          {s.status === 'PAID' && (
                            <span className="text-xs text-emerald-400/70">
                              {s.paidAt ? new Date(s.paidAt).toLocaleDateString('ko-KR') : '완료'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-white/[0.06]">
              <div className="flex h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                {items.map((s: any) => (
                  <div
                    key={s.id}
                    className={cn(
                      'h-full flex-1',
                      s.status === 'PAID'
                        ? 'bg-emerald-500'
                        : s.status === 'APPROVED'
                          ? 'bg-amber-400'
                          : 'bg-white/[0.04]',
                    )}
                    title={s.milestoneTitle}
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  지급 완료
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  승인/미지급
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-white/[0.08]" />
                  검수 대기
                </span>
              </div>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}

export default function SettlementPage() {
  const user = useAuthStore((s) => s.user);
  const override = usePersonaOverride((s) => s.override);
  const persona = override ?? getPersona(user);
  const { data: apiData, isLoading } = useConsultations();

  const consultations = useMemo(() => {
    if (!apiData?.content) return [];
    return apiData.content as any[];
  }, [apiData]);

  const totalAmount = useMemo(
    () => consultations.reduce((sum: number, c: any) => sum + (c.contractAmount ?? 0), 0),
    [consultations],
  );

  // 수용가 = 잡코리아 헤드헌터 보수 모델 기반 정산 확인 (SPC/용역사 = 기존 사업비 집행 뷰)
  if (persona === 'consumer') {
    return <ConsumerSettlementView />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Breadcrumb items={[{ label: '통합에너지 컨설팅', path: '/consulting' }, { label: '사업비 집행' }]} />
      </div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">사업비 집행</h1>
          <p className="mt-1 text-sm text-slate-400">컨설팅 프로젝트별 정산 현황을 관리합니다</p>
        </div>
      </div>

      <StatsGrid columns={3}>
        <StatCard
          icon={<Wallet size={18} className="text-emerald-400" />}
          label="전체 프로젝트"
          value={`${consultations.length}건`}
        />
        <StatCard
          icon={<TrendingUp size={18} className="text-sky-400" />}
          label="총 계약 금액"
          value={`₩ ${totalAmount.toLocaleString()}`}
        />
        <StatCard
          icon={<Banknote size={18} className="text-violet-400" />}
          label="진행중"
          value={`${consultations.filter((c: any) => !['COMPLETED', 'CANCELLED'].includes(c.status)).length}건`}
        />
      </StatsGrid>

      <SectionCard title="정산 내역">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-400 border-b border-white/[0.06]">
              <tr>
                <th className="px-6 py-3 font-medium">정산번호</th>
                <th className="px-6 py-3 font-medium">용역사</th>
                <th className="px-6 py-3 font-medium">프로젝트</th>
                <th className="px-6 py-3 font-medium">마일스톤</th>
                <th className="px-6 py-3 font-medium">금액</th>
                <th className="px-6 py-3 font-medium">상태</th>
                <th className="px-6 py-3 font-medium">요청일</th>
                <th className="px-6 py-3 font-medium">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {consultations.map((c: any) => (
                <SettlementList key={c.id} consultationId={c.id} projectName={`${c.domain} 컨설팅`} />
              ))}
              <tr className="only:table-row hidden">
                <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                  정산 데이터가 없습니다
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
