'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Inbox, ArrowRight } from 'lucide-react';
import { SectionCard } from '@/components/features';
import { Button } from '@/components/ui/Button';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { getPersona } from '@/lib/persona';
import { useTradingRequests, useAllTradingMatches } from '@/hooks/trading/useTrading';

type Persona = 'consumer' | 'generator' | 'spc';

const RESULT: Record<string, { label: string; variant: 'success' | 'default'; icon: typeof CheckCircle2 }> = {
  FINALIZED: { label: '체결 완료', variant: 'success', icon: CheckCircle2 },
  COMPLETED: { label: '체결 완료', variant: 'success', icon: CheckCircle2 },
  CANCELLED: { label: '취소', variant: 'default', icon: XCircle },
};

function modelLabel(dealType?: string, subType?: string) {
  if (dealType === 'SAVINGS_SHARE') return '온사이트 PPA';
  if (subType === 'onsite') return 'Onsite PPA';
  if (subType === 'offsite') return 'Offsite PPA';
  return '직접 PPA';
}

// 거래관리(요청 목록)와 동일한 유형 배지 색상 — 테이블 패턴 통일
const TYPE_CLS: Record<string, string> = {
  'Offsite PPA': 'bg-blue-500/[0.10] text-blue-300 ring-blue-500/30',
  'Onsite PPA': 'bg-emerald-500/[0.10] text-emerald-300 ring-emerald-500/30',
  '온사이트 PPA': 'bg-violet-500/[0.10] text-violet-300 ring-violet-500/30',
  '직접 PPA': 'bg-blue-500/[0.10] text-blue-300 ring-blue-500/30',
};

export function TradeHistory() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const persona: Persona = (() => {
    const p = getPersona(user);
    if (p === 'generator') return 'generator';
    if (p === 'spc' || p === 'admin' || p === 'operator' || p === 'agency') return 'spc';
    return 'consumer';
  })();
  const isGenerator = persona === 'generator';

  // 수용가·SPC: 내 거래 요청 / 발전사: 내가 참여한 매칭
  const { data: reqData } = useTradingRequests({}, { enabled: !isGenerator });
  const { data: matchData } = useAllTradingMatches(
    isGenerator && user?.companyId ? { generatorCompanyId: user.companyId } : undefined,
  );

  const rows = useMemo(() => {
    if (isGenerator) {
      const ms = (Array.isArray(matchData) ? matchData : ((matchData as any)?.content ?? [])) as any[];
      // 매칭의 거래요청이 terminal(체결완료/취소)인 것만 — 요청 단위로 dedup
      const seen = new Map<number, any>();
      for (const m of ms) {
        if (!['FINALIZED', 'COMPLETED', 'CANCELLED'].includes(m.requestStatus)) continue;
        if (seen.has(m.requestId)) continue;
        seen.set(m.requestId, {
          id: m.requestId,
          model: modelLabel(m.dealType, m.ppaSubType),
          counterparty: m.consumerCompanyName ?? '수용가',
          kw: m.capacityKw ?? 0,
          price: m.proposedPriceKrw,
          dealType: m.dealType,
          result: m.requestStatus,
          createdAt: m.createdAt,
        });
      }
      return [...seen.values()];
    }
    const rs = ((reqData as any)?.content ?? reqData ?? []) as any[];
    return rs
      .filter((r) => ['FINALIZED', 'COMPLETED', 'CANCELLED'].includes(r.status))
      .map((r) => ({
        id: r.id,
        model: modelLabel(r.dealType, r.ppaSubType),
        counterparty: r.companyName ?? r.siteName ?? '—',
        kw: r.capacityKw ?? 0,
        price: r.desiredUnitPrice,
        dealType: r.dealType,
        result: r.status,
        createdAt: r.createdAt,
      }));
  }, [isGenerator, matchData, reqData]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    [rows],
  );

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '전력거래' }, { label: '거래 완료' }]} />
      <div>
        <h1 className="text-2xl font-bold text-white">거래 완료</h1>
        <p className="mt-1 text-sm text-slate-400">
          체결 완료·취소된 지난 거래 이력입니다. 진행 중 거래는 거래 현황에서 확인하세요.
        </p>
      </div>

      <SectionCard title={`거래 이력 ${sorted.length}건`}>
        {sorted.length === 0 ? (
          <div className="py-16 text-center">
            <Inbox size={26} className="mx-auto text-slate-600 mb-2" />
            <p className="text-sm text-slate-400">완료된 거래가 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                  <th className="px-4 py-2 text-left font-medium">거래번호</th>
                  <th className="px-4 py-2 text-left font-medium">완료일</th>
                  <th className="px-4 py-2 text-left font-medium">상대방</th>
                  <th className="px-4 py-2 text-left font-medium">유형</th>
                  <th className="px-4 py-2 font-medium">용량</th>
                  <th className="px-4 py-2 font-medium">조건</th>
                  <th className="px-4 py-2 text-left font-medium">결과</th>
                  <th className="px-4 py-2 text-right font-medium">계약</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => {
                  const res = RESULT[t.result] ?? { label: t.result, variant: 'default' as const, icon: XCircle };
                  const concluded = t.result === 'FINALIZED' || t.result === 'COMPLETED';
                  return (
                    <tr key={`${t.id}-${t.result}`} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-xs text-slate-300 tabular-nums font-medium">{t.id}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs tabular-nums">
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString('ko-KR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white font-medium text-sm">{t.counterparty}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 w-fit',
                            TYPE_CLS[t.model] ?? 'bg-slate-500/[0.10] text-slate-300 ring-slate-500/30',
                          )}
                        >
                          {t.model}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 tabular-nums text-xs">
                        {Number(t.kw).toLocaleString()} kW
                      </td>
                      <td className="px-4 py-3 text-slate-300 tabular-nums text-xs">
                        {t.dealType === 'SAVINGS_SHARE'
                          ? '수익 분배'
                          : t.price
                            ? `₩${Number(t.price).toLocaleString()}/kWh`
                            : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
                            res.variant === 'success'
                              ? 'bg-emerald-500/[0.08] text-emerald-300 ring-emerald-500/30'
                              : 'bg-slate-500/[0.08] text-slate-400 ring-slate-500/30',
                          )}
                        >
                          <res.icon size={11} /> {res.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {concluded ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(isGenerator ? '/generator/ppa/contracts' : '/ppa/contracts')}
                          >
                            계약 보기 <ArrowRight size={12} className="ml-1" />
                          </Button>
                        ) : (
                          <span className="text-[11px] text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
