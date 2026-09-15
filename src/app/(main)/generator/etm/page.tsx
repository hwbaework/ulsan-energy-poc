'use client';

import { ArrowRightLeft, TrendingUp, Zap, DollarSign } from 'lucide-react';
import { StatCard, StatsGrid, SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Badge } from '@/components/ui/Badge';
import { RmsBarChart } from '@/components/ui/Chart';
import { ENDPOINTS } from '@/api/endpoints';
import { getApiClient } from '@/api/client';
import { useQuery } from '@tanstack/react-query';

function useEtmContracts() {
  return useQuery({
    queryKey: ['etm', 'contracts'],
    queryFn: () => getApiClient().get(ENDPOINTS.etm.contracts),
    staleTime: 30_000,
  });
}

function useEtmMarketPrice() {
  return useQuery({
    queryKey: ['etm', 'market-price'],
    queryFn: () => getApiClient().get(ENDPOINTS.etm.marketPrice),
    staleTime: 60_000,
  });
}

function useEtmRec() {
  return useQuery({
    queryKey: ['etm', 'rec'],
    queryFn: () => getApiClient().get(ENDPOINTS.etm.rec),
    staleTime: 60_000,
  });
}

const PRICE_TREND = Array.from({ length: 14 }, (_, i) => ({
  date: `5/${i + 1}`,
  SMP: +(80 + Math.random() * 30).toFixed(1),
  REC: +(40 + Math.random() * 15).toFixed(1),
}));

export default function GeneratorEtmPage() {
  const contractsQuery = useEtmContracts();
  const contracts = (contractsQuery.data as any)?.content ?? [];
  const activeContracts = contracts.filter((c: any) => c.status === 'ACTIVE');

  const priceQuery = useEtmMarketPrice();
  const prices = priceQuery.data ?? [];
  const latestSmp = (prices as any[])?.[0];

  const recQuery = useEtmRec();
  const recList = recQuery.data ?? [];
  const totalRec = (recList as any[]).reduce((s: number, r: any) => s + (r.quantity ?? 0), 0);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '발전사업자', path: '/generator' }, { label: '전력거래시장' }]} />
      <div>
        <h1 className="text-xl font-bold text-white">전력거래시장 (ETM)</h1>
        <p className="mt-1 text-sm text-slate-400">시장가격, 거래 계약, REC 현황</p>
      </div>

      <StatsGrid columns={4}>
        <StatCard
          icon={<TrendingUp size={18} className="text-amber-400" />}
          label="최신 SMP"
          value={latestSmp ? `${latestSmp.price}원/kWh` : '-'}
          sub={latestSmp?.priceDate ?? ''}
        />
        <StatCard
          icon={<ArrowRightLeft size={18} className="text-sky-400" />}
          label="활성 계약"
          value={`${activeContracts.length}건`}
        />
        <StatCard
          icon={<Zap size={18} className="text-emerald-400" />}
          label="REC 보유"
          value={`${totalRec.toLocaleString()} REC`}
        />
        <StatCard
          icon={<DollarSign size={18} className="text-violet-400" />}
          label="총 거래 계약"
          value={`${contracts.length}건`}
        />
      </StatsGrid>

      <SectionCard title="시장 가격 추이 (SMP / REC)">
        <div>
          <RmsBarChart
            data={PRICE_TREND}
            xKey="date"
            bars={[
              { key: 'SMP', name: 'SMP (원/kWh)', color: '#F59E0B' },
              { key: 'REC', name: 'REC (원/kWh)', color: '#10B981' },
            ]}
            height={280}
          />
        </div>
      </SectionCard>

      <SectionCard title="내 거래 계약 목록">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-400 border-b border-white/[0.06]">
              <tr>
                <th className="px-4 py-3 font-medium">계약번호</th>
                <th className="px-4 py-3 font-medium">유형</th>
                <th className="px-4 py-3 font-medium">수용가</th>
                <th className="px-4 py-3 font-medium">용량(kW)</th>
                <th className="px-4 py-3 font-medium">단가(원)</th>
                <th className="px-4 py-3 font-medium">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {activeContracts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    거래 계약 없음
                  </td>
                </tr>
              )}
              {activeContracts.map((c: any) => (
                <tr key={c.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-white font-mono text-xs">{c.contractNumber}</td>
                  <td className="px-4 py-3 text-slate-300">{c.contractType}</td>
                  <td className="px-4 py-3 text-slate-300">{c.consumerName}</td>
                  <td className="px-4 py-3 text-slate-300 tabular-nums">{c.capacityKw?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-300 tabular-nums">{c.pricePerKwh?.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <Badge variant="success">{c.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
