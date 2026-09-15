'use client';

import Link from 'next/link';
import { Factory, Award, ArrowRightLeft, Leaf } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { StatCard, StatsGrid } from '@/components/edm/features/StatCard';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCarbonHolding, useCarbonOtc } from '@/hooks/edm/useCarbon';

// 카본 마켓플레이스 대시보드 — 설계 docs/기획/02 §2.7
export default function CarbonDashboardPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const { data: CARBON_HOLDINGS } = useCarbonHolding(companyId);
  const { data: OTC_ORDERS } = useCarbonOtc(companyId);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">카본 마켓플레이스</h1>
        <span className="text-xs text-slate-400">규제적(KAU·KOC·KCU) + 자발적 · 탄소중립기본법</span>
      </div>

      <StatsGrid columns={4}>
        <StatCard
          icon={<Award size={20} />}
          label="KAU 보유 (배출권)"
          value={CARBON_HOLDINGS.kau.toLocaleString()}
          sub="tCO₂eq"
        />
        <StatCard
          icon={<Leaf size={20} />}
          label="KOC 보유 (외부감축)"
          value={CARBON_HOLDINGS.koc.toLocaleString()}
          sub="tCO₂eq"
        />
        <StatCard
          icon={<ArrowRightLeft size={20} />}
          label="KCU (상쇄배출권)"
          value={CARBON_HOLDINGS.kcu.toLocaleString()}
          sub="tCO₂eq"
        />
        <StatCard
          icon={<Factory size={20} />}
          label="장외거래 진행"
          value={OTC_ORDERS.length}
          sub="건"
          onClick={() => (window.location.href = '/carbon/otc')}
        />
      </StatsGrid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="flex h-full min-h-[280px] flex-col p-6">
            <h3 className="text-sm font-semibold text-white">KAU24 시세 추이</h3>
            <p className="mt-1 text-xs text-slate-500">원/tCO₂eq</p>
            <div className="flex flex-1 items-center justify-center">
              <p className="text-xs text-slate-500">시세 추이 데이터가 없습니다.</p>
            </div>
          </Card>
        </div>
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-white mb-4">바로가기</h3>
          <div className="space-y-2">
            <Link
              href="/carbon/krx"
              className="block rounded-lg bg-white/[0.03] px-3 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06]"
            >
              KRX 연계거래 (시세·호가)
            </Link>
            <Link
              href="/carbon/otc"
              className="block rounded-lg bg-white/[0.03] px-3 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06]"
            >
              산단 장외거래 · ETRS 신고
            </Link>
            <Link
              href="/carbon/offset"
              className="block rounded-lg bg-white/[0.03] px-3 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06]"
            >
              상쇄배출권 외부사업 · KOC
            </Link>
            <Link
              href="/carbon/voluntary"
              className="block rounded-lg bg-white/[0.03] px-3 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06]"
            >
              자발적 탄소시장
            </Link>
            <Link
              href="/carbon/bulletins"
              className="block rounded-lg bg-white/[0.03] px-3 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06]"
            >
              협의매매 호가판
            </Link>
            <Link
              href="/carbon/vcm"
              className="block rounded-lg bg-white/[0.03] px-3 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06]"
            >
              자발적 크레딧 보유 원장 (VCM)
            </Link>
            <Link
              href="/carbon/kcu-ledger"
              className="block rounded-lg bg-white/[0.03] px-3 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06]"
            >
              KCU 원장
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
