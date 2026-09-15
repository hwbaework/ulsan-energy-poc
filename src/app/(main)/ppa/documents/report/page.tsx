'use client';

import { useMemo, useState } from 'react';
import { Download, Zap, Banknote, TrendingDown, Sun, CircleDot } from 'lucide-react';
import { SectionCard, StatCard, StatsGrid, DataTable } from '@/components/features';
import type { Column } from '@/components/features';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { RmsBarLineChart, RmsAreaChart } from '@/components/ui/Chart';
import { exportPdf } from '@/lib/utils';
import { useAllMonthlyRecords, useAllLeaseInvoices, useVolumeContracts } from '@/hooks/lease';
import { useMonitoringPlants } from '@/hooks/monitoring/useMonitoring';
import type { LeaseMonthlyRecord, LeaseInvoice } from '@/types';

const CO2_FACTOR = 0.4594;

const PERIOD_LABELS: Record<string, string> = {
  '2026-02': '2월',
  '2026-03': '3월',
  '2026-04': '4월',
  '2026-05': '5월',
  '2026-06': '6월',
  '2026-07': '7월',
  '2026-08': '8월',
  '2026-09': '9월',
  '2026-10': '10월',
  '2026-11': '11월',
  '2026-12': '12월',
};

function fmtKrw(v: number) {
  if (Math.abs(v) >= 1_000_000) return `₩${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `₩${(v / 1_000).toFixed(0)}K`;
  return `₩${v.toLocaleString()}`;
}

function fmtKwh(v: number) {
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)} MWh`;
  return `${v.toFixed(0)} kWh`;
}

export default function PpaReportPage() {
  const [year] = useState(2026);

  const { data: monthlyRes, isLoading: monthlyLoading } = useAllMonthlyRecords({ year });
  const { data: invoiceRes, isLoading: invoiceLoading } = useAllLeaseInvoices({ year });
  const { data: volumeRes } = useVolumeContracts();
  const { data: plantsRaw } = useMonitoringPlants();

  const records: LeaseMonthlyRecord[] = useMemo(() => {
    const raw = monthlyRes ?? [];
    return [...raw].sort((a, b) => a.period.localeCompare(b.period));
  }, [monthlyRes]);

  const invoices: LeaseInvoice[] = useMemo(() => {
    const raw = invoiceRes ?? [];
    return [...raw].sort((a, b) => (b.period ?? '').localeCompare(a.period ?? ''));
  }, [invoiceRes]);

  const contracts = useMemo(() => {
    return volumeRes?.content ?? [];
  }, [volumeRes]);

  const plants = useMemo(() => {
    return (plantsRaw ?? []) as any[];
  }, [plantsRaw]);

  const totalGenKwh = records.reduce((s, r) => s + (r.generatedKwh ?? 0), 0);
  const totalRent = records.reduce((s, r) => s + (r.rent ?? 0), 0);
  const totalSaved = records.reduce((s, r) => s + (r.savedAmount ?? 0), 0);
  const totalBaseline = records.reduce((s, r) => s + (r.baselineBill ?? 0), 0);
  const co2Reduction = (totalGenKwh * CO2_FACTOR) / 1000;

  const monthlyChartData = records.map((r) => ({
    month: PERIOD_LABELS[r.period] ?? r.period,
    rent: Math.round((r.rent ?? 0) / 10000),
    baseline: Math.round((r.baselineBill ?? 0) / 10000),
    saved: Math.round((r.savedAmount ?? 0) / 10000),
  }));

  const genChartData = records.map((r) => ({
    month: PERIOD_LABELS[r.period] ?? r.period,
    generated: Math.round(r.generatedKwh ?? 0),
    co2: +(((r.generatedKwh ?? 0) * CO2_FACTOR) / 1000).toFixed(2),
  }));

  const plantSummary = plants.map((p: any) => ({
    name: p.name,
    capacity: p.capacity,
    dailyEnergy: p.dailyEnergy ?? 0,
    monthlyEnergy: p.monthlyEnergy ?? 0,
    status: p.status,
    utilizationRate: p.utilizationRate ?? 0,
  }));

  const isLoading = monthlyLoading || invoiceLoading;

  const invoiceCols: Column<LeaseInvoice>[] = [
    {
      key: 'invoiceNumber',
      header: '번호',
      render: (r) => <span className="text-xs text-slate-300 font-mono">{r.invoiceNumber}</span>,
    },
    {
      key: 'period',
      header: '기간',
      render: (r) => r.period,
    },
    {
      key: 'siteName',
      header: '사이트',
      render: (r) => <span className="text-accent">{r.siteName}</span>,
    },
    {
      key: 'total',
      header: '합계(VAT 포함)',
      render: (r) => <span className="font-medium text-white">{fmtKrw(r.total ?? 0)}</span>,
    },
    {
      key: 'invoiceStatus',
      header: '발급',
      render: (r) => (
        <Badge variant={r.invoiceStatus === 'ISSUED' || r.invoiceStatus === 'PAID' ? 'success' : 'warning'}>
          {r.invoiceStatus === 'ISSUED' || r.invoiceStatus === 'PAID' ? '발급' : '대기'}
        </Badge>
      ),
    },
    {
      key: 'paymentStatus',
      header: '납부',
      render: (r) => (
        <Badge
          variant={r.paymentStatus === 'COMPLETED' ? 'success' : r.paymentStatus === 'PENDING' ? 'warning' : 'default'}
        >
          {r.paymentStatus === 'COMPLETED' ? '완료' : r.paymentStatus === 'PENDING' ? '대기' : r.paymentStatus}
        </Badge>
      ),
    },
  ];

  const handlePdfExport = () => {
    exportPdf(
      '운영보고서_' + year,
      `${year}년 에너지 거래 운영 보고서`,
      ['기간', '발전량(kWh)', 'PPA 요금(원)', '한전비용(원)', '절감액(원)'],
      records.map((r) => [
        r.period,
        (r.generatedKwh ?? 0).toLocaleString(),
        (r.rent ?? 0).toLocaleString(),
        (r.baselineBill ?? 0).toLocaleString(),
        (r.savedAmount ?? 0).toLocaleString(),
      ]),
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">운영 보고서</h1>
          <p className="mt-1 text-sm text-slate-400">{year}년 에너지 거래 운영 실적 종합 보고서</p>
        </div>
        <Button variant="primary" onClick={handlePdfExport}>
          <Download size={14} className="mr-1.5" />
          PDF 다운로드
        </Button>
      </div>

      {/* KPI Cards */}
      <StatsGrid columns={4}>
        <StatCard
          icon={<Zap size={18} />}
          label="누적 발전량"
          value={fmtKwh(totalGenKwh)}
          sub={records.length > 0 ? `${records.length}개월 집계` : '데이터 없음'}
          loading={isLoading}
        />
        <StatCard
          icon={<Banknote size={18} />}
          label="누적 거래액"
          value={fmtKrw(totalRent)}
          sub={totalBaseline > 0 ? `한전 기준 ${fmtKrw(totalBaseline)}` : '—'}
          loading={isLoading}
        />
        <StatCard
          icon={<TrendingDown size={18} />}
          label="한전 대비 절감"
          value={fmtKrw(totalSaved)}
          sub={totalBaseline > 0 ? `절감률 ${((totalSaved / totalBaseline) * 100).toFixed(1)}%` : '—'}
          loading={isLoading}
        />
        <StatCard
          icon={<Sun size={18} />}
          label="CO₂ 감축"
          value={`${co2Reduction.toFixed(1)} tCO₂`}
          sub={`배출계수 ${CO2_FACTOR} tCO₂/MWh`}
          loading={isLoading}
        />
      </StatsGrid>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="월별 비용 비교" description="PPA 요금 vs 한전 기준 비용 (만원)">
          {monthlyChartData.length > 0 ? (
            <RmsBarLineChart
              data={monthlyChartData}
              bars={[
                { key: 'rent', name: 'PPA 요금', color: '#3b82f6' },
                { key: 'baseline', name: '한전 비용', color: '#f59e0b' },
              ]}
              lines={[{ key: 'saved', name: '절감액', color: '#10b981' }]}
              xKey="month"
            />
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-slate-500">데이터가 없습니다</div>
          )}
        </SectionCard>

        <SectionCard title="월별 발전량 추이" description="발전량(kWh) 및 CO₂ 감축(tCO₂)">
          {genChartData.length > 0 ? (
            <RmsAreaChart
              data={genChartData}
              areas={[{ key: 'generated', name: '발전량 (kWh)', color: '#6366f1' }]}
              xKey="month"
            />
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-slate-500">데이터가 없습니다</div>
          )}
        </SectionCard>
      </div>

      {/* Contract Summary + Plant Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="계약 현황" count={contracts.length} countUnit="건">
          {contracts.length > 0 ? (
            <div className="space-y-3">
              {contracts.map((c: any) => (
                <div key={c.id} className="rounded-lg bg-[#0d1520] ring-1 ring-white/[0.06] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{c.consumerCompanyName}</span>
                    <Badge variant={c.status === 'ACTIVE' ? 'success' : 'default'}>
                      {c.status === 'ACTIVE' ? '운영 중' : c.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{c.siteName}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">설비용량</span>
                      <p className="text-white font-medium">{c.capacityKw} kW</p>
                    </div>
                    <div>
                      <span className="text-slate-500">계약기간</span>
                      <p className="text-white font-medium">{c.contractYears}년</p>
                    </div>
                    <div>
                      <span className="text-slate-500">월 PPA 요금</span>
                      <p className="text-white font-medium">{fmtKrw(c.monthlyRent ?? 0)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-sm text-slate-500">활성 계약이 없습니다</div>
          )}
        </SectionCard>

        <SectionCard title="발전소 현황" count={plantSummary.length} countUnit="개소">
          {plantSummary.length > 0 ? (
            <div className="space-y-2">
              {plantSummary.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between rounded-lg bg-[#0d1520] ring-1 ring-white/[0.06] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <CircleDot
                      size={10}
                      className={
                        p.status === 'NORMAL'
                          ? 'text-emerald-400'
                          : p.status === 'ANOMALY'
                            ? 'text-amber-400'
                            : 'text-slate-500'
                      }
                    />
                    <div>
                      <span className="text-sm text-white">{p.name}</span>
                      <span className="text-xs text-slate-500 ml-2">{p.capacity} kW</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right">
                      <span className="text-slate-500">금일</span>
                      <p className="text-white">{p.dailyEnergy.toFixed(1)} kWh</p>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500">이용률</span>
                      <p className="text-white">{p.utilizationRate.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-sm text-slate-500">발전소 데이터가 없습니다</div>
          )}
        </SectionCard>
      </div>

      {/* Monthly Detail Table */}
      <SectionCard
        title="월별 운영 실적"
        count={records.length}
        countUnit="건"
        description="직접 PPA 월별 발전·정산 상세"
      >
        <DataTable
          data={records}
          rowKey={(r) => r.id}
          emptyMessage="월별 실적 데이터가 없습니다"
          columns={
            [
              {
                key: 'period',
                header: '기간',
                render: (r) => <span className="font-medium text-white">{r.period}</span>,
              },
              { key: 'generatedKwh', header: '발전량', render: (r) => `${(r.generatedKwh ?? 0).toLocaleString()} kWh` },
              { key: 'unitPriceKrw', header: '단가', render: (r) => `₩${r.unitPriceKrw ?? 0}/kWh` },
              {
                key: 'rent',
                header: 'PPA 요금',
                render: (r) => <span className="text-blue-400">{fmtKrw(r.rent ?? 0)}</span>,
              },
              { key: 'baselineBill', header: '한전 비용', render: (r) => fmtKrw(r.baselineBill ?? 0) },
              {
                key: 'savedAmount',
                header: '절감액',
                render: (r) => <span className="text-emerald-400">{fmtKrw(r.savedAmount ?? 0)}</span>,
              },
              {
                key: 'netSavings',
                header: '순이익',
                render: (r) => (
                  <span className={(r.netSavings ?? 0) >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                    {fmtKrw(r.netSavings ?? 0)}
                  </span>
                ),
              },
            ] satisfies Column<LeaseMonthlyRecord>[]
          }
        />
      </SectionCard>

      {/* Invoice History */}
      <SectionCard title="세금계산서 발급 이력" count={invoices.length} countUnit="건">
        <DataTable
          data={invoices}
          rowKey={(r) => r.id}
          emptyMessage="세금계산서 이력이 없습니다"
          columns={invoiceCols}
        />
      </SectionCard>
    </div>
  );
}
