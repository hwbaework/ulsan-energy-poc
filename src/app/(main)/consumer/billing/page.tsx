'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, TrendingDown, Receipt, ChevronRight } from 'lucide-react';
import { StatCard, StatsGrid, SectionCard } from '@/components/features';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { RmsBarChart } from '@/components/ui/Chart';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/useAuthStore';
import { exportPdf } from '@/lib/utils';
import { downloadPdf } from '@/lib/downloadPdf';
import { ENDPOINTS } from '@/api/endpoints';
import { useConsumerBilling } from '@/hooks/consumer/useConsumer';
import { useMonitoringPlantDetail } from '@/hooks/monitoring/useMonitoring';
import { useKepcoAvgPrice } from '@/hooks/platform/useBillingRates';

const HANIL_PLANT_ID = 17514;

// 백엔드 status enum → 한국어 라벨 + 색상
// 정산 확정 규칙: 당월 정산은 익월 15일 이후 확정
//   · 5월 → 6/15 이후 확정. 그 전까지는 "예상" 상태 (PENDING)
const STATUS_BADGE: Record<string, { variant: 'success' | 'warning' | 'danger' | 'default'; label: string }> = {
  PAID: { variant: 'success', label: '납부 완료' },
  PENDING: { variant: 'warning', label: '예상 (미확정)' },
  OVERDUE: { variant: 'danger', label: '연체' },
};

export default function BillingPage() {
  const router = useRouter();
  const KEPCO_AVG_PRICE = useKepcoAvgPrice();
  const calcKepcoEquivalent = (selfGenKwh: number) => Math.round(selfGenKwh * KEPCO_AVG_PRICE);
  const calcSaved = (selfGenKwh: number, leaseAmount: number) => calcKepcoEquivalent(selfGenKwh) - leaseAmount;
  const companyId = useAuthStore((s) => s.user?.companyId ?? 0);
  const billingQuery = useConsumerBilling(companyId);
  const billingData = billingQuery.data as any;
  const apiBillings =
    !billingQuery.isError && billingData
      ? Array.isArray(billingData)
        ? billingData
        : (billingData?.content ?? [])
      : [];
  const invoices = apiBillings.length > 0 ? apiBillings : [];

  const latest = invoices[0]; // 이번 달 (5월)
  const prev = invoices[1]; // 전월 (4월)

  // 이번 달 청구액 = PPA + 한전 + 온사이트 PPA 요금
  const latestTotal = latest ? latest.ppaAmount + latest.kepcoAmount + latest.leaseAmount : 0;
  const prevTotal = prev ? prev.ppaAmount + prev.kepcoAmount + prev.leaseAmount : 0;

  // ─── 이번 달 예상 절감액 ───
  // 절감액 = (자가 발전량 × 한전 단가) − 온사이트 PPA 요금
  //   = 한전 환산값 − Lease 비용 = 순 절감
  // 이번 달은 plant API monthlyEnergy 실값 — 백엔드 monitoring이 당월 합산 제공(연동 완료)
  const plantDetailQuery = useMonitoringPlantDetail(HANIL_PLANT_ID);
  const monthlyPlantGenKwh = plantDetailQuery.data?.monthlyEnergy ?? 0;
  const expectedSaving = calcSaved(monthlyPlantGenKwh, latest?.leaseAmount ?? 0);

  // YTD 누적 절감 = 각 월 절감액 합산 (이번 달은 expectedSaving, 과거 달은 자동 계산)
  const currentYear = String(new Date().getFullYear());
  const ytdSaved = invoices
    .filter((i: any) => typeof i.period === 'string' && i.period.startsWith(currentYear))
    .reduce((s: number, i: any) => {
      const value = i.period === latest?.period ? expectedSaving : calcSaved(i.selfGenKwh ?? 0, i.leaseAmount ?? 0);
      return s + value;
    }, 0);

  const compareChart = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const byPeriod = new Map<string, any>();
    for (const i of invoices) {
      if (typeof i.period === 'string') byPeriod.set(i.period, i);
    }
    return Array.from({ length: 12 }, (_, idx) => {
      const m = idx + 1;
      const period = `${year}-${String(m).padStart(2, '0')}`;
      const i = m <= curMonth ? byPeriod.get(period) : null;
      return {
        month: `${m}월`,
        LEASE: i ? Math.round(i.leaseAmount / 10000) : 0,
        KEPCO: i ? Math.round(i.kepcoAmount / 10000) : 0,
      };
    });
  }, [invoices]);

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Breadcrumb items={[{ label: '대시보드', path: '/consumer' }, { label: '요금 내역' }]} />
      </div>
      <div>
        <h1 className="text-xl font-bold text-white">요금 내역</h1>
        <p className="mt-1 text-sm text-slate-400">
          Lease 청구 내역과 한전 대비 절감액 · 당월 청구액은 익월 15일 이후 확정 (그 전엔 예상치)
        </p>
      </div>

      {/* 카드 3개: 이번달 청구액 / 이번달 절감액 / YTD 누적 절감 */}
      <StatsGrid columns={3}>
        <StatCard
          icon={<Wallet size={18} className="text-emerald-400" />}
          label="이번 달 예상 청구액"
          value={billingQuery.isLoading ? '불러오는 중...' : !latest ? '₩ 0' : `₩ ${latestTotal.toLocaleString()}`}
          sub={prev ? `전월 확정 ₩ ${prevTotal.toLocaleString()}` : undefined}
        />
        {/* 이번달 예상 절감액 = 재생에너지 발전 × 한전 단가 − Lease (실시간 변동) */}
        <StatCard
          icon={<TrendingDown size={18} className="text-sky-400" />}
          label="이번 달 예상 절감액"
          value={
            plantDetailQuery.isLoading || billingQuery.isLoading
              ? '불러오는 중...'
              : `₩ ${expectedSaving.toLocaleString()}`
          }
          sub={
            prev
              ? `전월 실 절감 ₩ ${calcSaved(prev.selfGenKwh ?? 0, prev.leaseAmount ?? 0).toLocaleString()} · 발전 ${monthlyPlantGenKwh.toLocaleString()} kWh 기반`
              : `발전 ${monthlyPlantGenKwh.toLocaleString()} kWh 기반`
          }
        />
        <StatCard
          icon={<Receipt size={18} className="text-amber-400" />}
          label="YTD 누적 절감"
          value={billingQuery.isLoading ? '불러오는 중...' : `₩ ${ytdSaved.toLocaleString()}`}
          sub={`${invoices.length}개월 누적`}
        />
      </StatsGrid>

      {/* 단가 기준 안내 — 카드 아래 위치 (lease/volume 패턴과 통일) */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-4 py-2.5 text-[11px] text-slate-400">
        <span className="text-amber-300 font-medium">※ 단가 기준</span> 절감액·한전 환산은{' '}
        <span className="text-white font-semibold">한전 산업용 평균 단가 ₩{KEPCO_AVG_PRICE}/kWh</span> 기준 산정 · 실제
        한전 단가는 시간대·계절·계약 종별로 변동 (평균 약 ₩140~160/kWh)
      </div>

      {/* 한일튜브는 직접 PPA 없음 → 한전 청구 vs Lease 비교로 차트 의미 변경 */}
      <SectionCard title="월별 한전 청구 vs Lease" description="단위: 만원">
        <div>
          <RmsBarChart
            data={compareChart}
            xKey="month"
            bars={[
              { key: 'KEPCO', name: '한전 청구', color: '#94A3B8' },
              { key: 'LEASE', name: 'Lease', color: '#10B981' },
            ]}
            height={300}
          />
        </div>
      </SectionCard>

      <SectionCard title="청구서 목록">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-400 border-b border-white/[0.06]">
              <tr>
                <th className="px-6 py-3 font-medium">청구 ID</th>
                <th className="px-6 py-3 font-medium">기간</th>
                <th className="px-6 py-3 font-medium">재생에너지 공급 (kWh)</th>
                <th className="px-6 py-3 font-medium">한전 환산</th>
                <th className="px-6 py-3 font-medium">Lease</th>
                <th className="px-6 py-3 font-medium">절감액</th>
                <th className="px-6 py-3 font-medium">납부 기한</th>
                <th className="px-6 py-3 font-medium">상태</th>
                <th className="px-6 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {invoices.map((i: any) => {
                const statusMeta = STATUS_BADGE[i.status];
                // 이번 달은 plant API 실시간 발전량, 과거 달은 mock selfGenKwh
                const genKwh = i.period === latest?.period ? monthlyPlantGenKwh : (i.selfGenKwh ?? 0);
                const kepcoEquiv = calcKepcoEquivalent(genKwh);
                const saved = kepcoEquiv - (i.leaseAmount ?? 0);
                return (
                  <tr key={i.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-6 py-3 text-slate-300 tabular-nums">{i.id}</td>
                    <td className="px-6 py-3 text-white tabular-nums">{i.period}</td>
                    {/* 재생에너지 공급 (kWh) — 자가 발전 또는 외부 PPA. 이번 달은 plant API 실시간 */}
                    <td className="px-6 py-3 text-white tabular-nums">{genKwh.toLocaleString()}</td>
                    {/* 한전 환산 = 자가 발전 × 한전 단가 (한전에 청구되었다면 받을 금액) */}
                    <td className="px-6 py-3 text-slate-400 tabular-nums">₩ {kepcoEquiv.toLocaleString()}</td>
                    <td className="px-6 py-3 text-slate-400 tabular-nums">₩ {i.leaseAmount.toLocaleString()}</td>
                    {/* 절감액 = 한전 환산 − Lease (Lease 비용 빼고 순 절감) */}
                    <td className="px-6 py-3 text-emerald-400 tabular-nums">-₩ {saved.toLocaleString()}</td>
                    <td className="px-6 py-3 text-slate-400 tabular-nums">{i.dueDate ?? '—'}</td>
                    <td className="px-6 py-3">
                      {statusMeta ? (
                        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                      ) : (
                        <Badge variant="default">{i.status}</Badge>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          downloadPdf(
                            ENDPOINTS.consumer.billingPdf(companyId) + `?month=${i.month}`,
                            `청구서_${i.month}.pdf`,
                          ).catch(() =>
                            exportPdf(
                              `청구서-${i.month}`,
                              `${i.month} PPA 청구서`,
                              ['항목', '값'],
                              [
                                ['월', i.month],
                                ['공급가액', `₩${i.amount?.toLocaleString() ?? 0}`],
                                ['상태', i.status],
                              ],
                            ),
                          )
                        }
                      >
                        PDF
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <button
          onClick={() => router.push('/lease/billing/settlement')}
          className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          상세 정산 내역 <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
