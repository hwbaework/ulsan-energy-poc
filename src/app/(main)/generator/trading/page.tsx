'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/useAuthStore';
import { useAllTradingMatches, useLeaseProposalsByGenerator } from '@/hooks/trading/useTrading';
import { usePpaContracts } from '@/hooks/ppa/usePpa';

/* ────────── 발전사 거래 현황 — 내 전력거래(PPA 매칭 + Lease 제안) 전용
 * 공급 자원 등록·관리는 '자원 관리' 메뉴로 분리. ────────── */
export default function GeneratorTradingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  // PPA 매칭 (SPC가 우리 발전사에 제안)
  const { data: matchData } = useAllTradingMatches(
    user?.companyId ? { generatorCompanyId: user.companyId } : undefined,
  );
  // 계약 발효(ACTIVE) 여부 — 매칭별 자동 계약 AUTO-M{matchId} 상태로 '서명 대기 vs 완료' 판정
  const { data: contractsData } = usePpaContracts();
  const contractRows = ((contractsData as any)?.content ?? contractsData ?? []) as any[];
  const contractStatusOf = (matchId: number) =>
    contractRows.find((c) => c.contractNumber === `AUTO-M${matchId}`)?.status as string | undefined;

  const receivedMatches = (Array.isArray(matchData) ? matchData : [])
    .filter((m: any) => ['PROPOSED', 'GEN_ACCEPTED', 'ACCEPTED'].includes(m.status))
    // 양측 서명 완료(계약 ACTIVE)된 매칭은 완료되어 진행 목록에서 제외
    .filter((m: any) => !(m.status === 'ACCEPTED' && contractStatusOf(m.id) === 'ACTIVE'))
    // 체결 완료/취소(거래 FINALIZED·CANCELLED)된 거래는 '거래 완료'로 이동 → 진행 목록 제외
    .filter((m: any) => !['FINALIZED', 'COMPLETED', 'CANCELLED'].includes(m.requestStatus));

  // Lease 배정 제안 (SPC가 우리 발전사를 배정)
  const { data: leasePropData } = useLeaseProposalsByGenerator(user?.companyId ?? 0, {
    enabled: !!user?.companyId,
  });
  const myLeaseProps = (Array.isArray(leasePropData) ? leasePropData : []) as any[];

  // 내 전력거래 — PPA 매칭 + Lease 제안 통합 (거래 관점)
  const trades = [
    ...receivedMatches.map((m: any) => ({
      key: `m${m.id}`,
      type: m.ppaSubType === 'onsite' ? 'Onsite PPA' : 'Offsite PPA',
      typeVariant: (m.ppaSubType === 'onsite' ? 'success' : 'primary') as 'success' | 'primary',
      consumer: m.consumerCompanyName ?? '수용가',
      kw: m.capacityKw ?? 0,
      terms: m.proposedPriceKrw ? `₩${Number(m.proposedPriceKrw).toLocaleString()}/kWh` : '—',
      statusLabel:
        m.status === 'PROPOSED' ? '응답 필요' : m.status === 'GEN_ACCEPTED' ? '수용가 확인 대기' : '계약 서명 대기',
      statusVariant: (m.status === 'PROPOSED' ? 'warning' : m.status === 'GEN_ACCEPTED' ? 'primary' : 'warning') as
        | 'warning'
        | 'primary'
        | 'success',
      cta: m.status === 'ACCEPTED' ? '계약 서명하기' : '상세에서 진행',
      requestId: m.requestId,
      createdAt: m.createdAt ?? '',
    })),
    ...myLeaseProps.map((p: any) => ({
      key: `l${p.id}`,
      type: '직접 PPA',
      typeVariant: 'info' as const,
      consumer: p.consumerCompanyName ?? '수용가',
      kw: p.installCapacityKw ?? 0,
      terms: `분배율 ${p.sharePct ?? 0}%`,
      statusLabel: !p.genAgreed ? '응답 필요' : !p.consumerAgreed ? '수용가 합의 대기' : '계약 서명 대기',
      statusVariant: (!p.genAgreed ? 'warning' : !p.consumerAgreed ? 'primary' : 'warning') as
        | 'warning'
        | 'primary'
        | 'success',
      cta: p.genAgreed && p.consumerAgreed ? '계약 서명하기' : '상세에서 진행',
      requestId: p.requestId,
      createdAt: p.createdAt ?? '',
    })),
  ].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '전력거래' }, { label: '거래 현황' }]} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">거래 현황</h1>
          <p className="mt-1 text-sm text-slate-400">
            진행 중인 전력거래 {trades.length}건 · 공급 자원 등록은 &apos;자원 관리&apos; 메뉴에서
          </p>
        </div>
      </div>

      {/* 내 전력거래 — PPA 매칭 + Lease 제안 통합 */}
      <SectionCard
        title={
          <>
            내 전력거래{' '}
            <Badge variant="primary" className="ml-2">
              {trades.length}건
            </Badge>
          </>
        }
      >
        {trades.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-slate-400">진행 중인 전력거래가 없습니다</p>
            <p className="text-xs text-slate-500 mt-1">
              SPC가 수용가과 매칭(PPA)하거나 PPA 설비를 배정(Lease)하면 여기에 표시됩니다
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                  <th className="px-4 py-2 text-left font-medium">거래번호</th>
                  <th className="px-4 py-2 text-left font-medium">거래유형</th>
                  <th className="px-4 py-2 text-left font-medium">수용가</th>
                  <th className="px-4 py-2 text-left font-medium">용량</th>
                  <th className="px-4 py-2 text-left font-medium">조건</th>
                  <th className="px-4 py-2 text-right font-medium">처리</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.key} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-xs text-slate-300 tabular-nums font-medium">거래 #{t.requestId}</td>
                    <td className="px-4 py-3">
                      <Badge variant={t.typeVariant}>{t.type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-white font-medium">{t.consumer}</td>
                    <td className="px-4 py-3 text-xs text-slate-300 tabular-nums">
                      {Number(t.kw).toLocaleString()} kW
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300 tabular-nums">{t.terms}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end items-center gap-2">
                        <Badge variant={t.statusVariant}>{t.statusLabel}</Badge>
                        <Button size="sm" variant="primary" onClick={() => router.push(`/trading/deal/${t.requestId}`)}>
                          {t.cta}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
