// @ts-nocheck
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt, CheckCircle2, AlertTriangle, ChevronDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { RmsBarLineChart } from '@/components/ui/Chart';
import { StatCard, StatsGrid, SectionCard, DataTable } from '@/components/features';
import type { Column } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useVolumeContracts, useSavingsContracts, useAllMonthlyRecords } from '@/hooks/lease/useLease';

const KEPCO_AVG_PRICE = 119.6;

interface LeaseConsumer {
  id: string;
  company: string;
  site: string;
  plantName: string;
  capacityKw: number;
  resource: string;
  contractStart: string;
  contractEnd: string;
  unitPriceKrw: number;
  status: '운영중' | '점검' | '중단';
  monthGenKwh: number;
  monthLeaseFee: number;
  monthGridSaving: number;
  cumulativeGenKwh: number;
}

export default function PlatformLeaseDashboardPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | '운영중' | '점검' | '중단'>('all');

  const { data: volumeData } = useVolumeContracts({ page: 0, size: 100 });
  const { data: savingsData } = useSavingsContracts({ page: 0, size: 100 });
  const { data: monthlyRecords } = useAllMonthlyRecords({ year: new Date().getFullYear() });

  const records = (monthlyRecords ?? []) as any[];
  const latestPeriod =
    records.length > 0 ? records.reduce((max, r) => (r.period > max ? r.period : max), records[0].period) : null;

  const recordsByContract = useMemo(() => {
    const map = new Map<number, any[]>();
    for (const r of records) {
      const list = map.get(r.leaseContractId) ?? [];
      list.push(r);
      map.set(r.leaseContractId, list);
    }
    return map;
  }, [records]);

  const CONSUMERS: LeaseConsumer[] = useMemo(() => {
    const volumeContracts = (volumeData as any)?.content ?? [];
    const savingsContracts = (savingsData as any)?.content ?? [];
    const allContracts = [...volumeContracts, ...savingsContracts];

    return allContracts.map((c: any) => {
      const contractRecords = recordsByContract.get(c.id) ?? [];
      const latestRecord = contractRecords.find((r: any) => r.period === latestPeriod);
      const monthGen = latestRecord ? Number(latestRecord.generatedKwh) || 0 : 0;
      const unitPrice = latestRecord
        ? Number(latestRecord.unitPriceKrw) || 0
        : c.monthlyRent && c.warrantyHours
          ? Math.round((c.monthlyRent / c.warrantyHours) * 12)
          : 0;
      const monthFee = latestRecord?.rent ?? Math.round(monthGen * unitPrice);
      const cumulativeGen = contractRecords.reduce((s: number, r: any) => s + (Number(r.generatedKwh) || 0), 0);
      const endYear = c.startDate ? new Date(c.startDate).getFullYear() + (c.contractYears ?? 20) : 2046;

      const statusMap: Record<string, '운영중' | '점검' | '중단'> = {
        ACTIVE: '운영중',
        MAINTENANCE: '점검',
        TERMINATED: '중단',
        SUSPENDED: '중단',
      };

      return {
        id: String(c.id),
        company: c.consumerCompanyName ?? '—',
        site: c.siteName ?? '—',
        plantName: c.siteName ?? '—',
        capacityKw: c.capacityKw ?? 0,
        resource: '태양광',
        contractStart: c.startDate ?? '—',
        contractEnd: `${endYear}-12-31`,
        unitPriceKrw: unitPrice,
        status: statusMap[c.status] ?? '운영중',
        monthGenKwh: monthGen,
        monthLeaseFee: monthFee,
        monthGridSaving: Math.round(monthGen * KEPCO_AVG_PRICE),
        cumulativeGenKwh: cumulativeGen,
      };
    });
  }, [volumeData, savingsData, recordsByContract, latestPeriod]);

  const monthlyTrend = useMemo(() => {
    const byMonth = new Map<string, { generation: number; leaseFee: number; gridSaving: number }>();
    for (const r of records) {
      const monthNum = parseInt(r.period?.split('-')[1] ?? '0', 10);
      const label = `${monthNum}월`;
      const entry = byMonth.get(label) ?? { generation: 0, leaseFee: 0, gridSaving: 0 };
      const gen = Number(r.generatedKwh) || 0;
      const unit = Number(r.unitPriceKrw) || 0;
      const fee = r.rent ?? Math.round(gen * unit);
      entry.generation += gen;
      entry.leaseFee += fee / 1_000_000;
      entry.gridSaving += Math.round(gen * KEPCO_AVG_PRICE) / 1_000_000;
      byMonth.set(label, entry);
    }
    return [...byMonth.entries()]
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([month, v]) => ({ month, ...v }));
  }, [records]);

  const totalCapacity = CONSUMERS.reduce((s, c) => s + c.capacityKw, 0);
  const totalMonthGen = CONSUMERS.reduce((s, c) => s + c.monthGenKwh, 0);
  const totalMonthFee = CONSUMERS.reduce((s, c) => s + c.monthLeaseFee, 0);
  const totalMonthSaving = CONSUMERS.reduce((s, c) => s + c.monthGridSaving, 0);
  const totalNetSaving = totalMonthSaving - totalMonthFee;
  const activeCount = CONSUMERS.filter((c) => c.status === '운영중').length;

  const filtered = useMemo(() => {
    return CONSUMERS.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (search && !c.company.includes(search) && !c.site.includes(search)) return false;
      return true;
    });
  }, [CONSUMERS, search, statusFilter]);

  const columns: Column<LeaseConsumer>[] = [
    {
      key: 'company',
      header: '수용가',
      render: (r) => (
        <div>
          <div className="font-medium text-white">{r.company}</div>
          <div className="text-xs text-accent">{r.site}</div>
        </div>
      ),
    },
    {
      key: 'plant',
      header: '발전소',
      render: (r) => (
        <div>
          <div className="text-sm text-white/80">{r.plantName}</div>
          <div className="text-xs text-accent">
            {r.resource} · {r.capacityKw.toLocaleString()} kW
          </div>
        </div>
      ),
    },
    {
      key: 'contract',
      header: '계약',
      render: (r) => (
        <div className="text-xs">
          <div className="text-white/70">₩{r.unitPriceKrw}/kWh</div>
          <div className="text-accent">
            {r.contractStart.slice(0, 7)} ~ {r.contractEnd.slice(0, 7)}
          </div>
        </div>
      ),
    },
    {
      key: 'monthGen',
      header: '당월 발전',
      render: (r) => <span className="text-white/80">{(r.monthGenKwh / 1000).toFixed(1)} MWh</span>,
    },
    {
      key: 'monthFee',
      header: '당월 PPA 요금',
      render: (r) => <span className="text-white/80">₩{r.monthLeaseFee.toLocaleString()}</span>,
    },
    {
      key: 'saving',
      header: '절감액',
      render: (r) => {
        const net = r.monthGridSaving - r.monthLeaseFee;
        return <span className={net >= 0 ? 'text-emerald-400' : 'text-rose-400'}>₩{net.toLocaleString()}</span>;
      },
    },
    {
      key: 'status',
      header: '상태',
      render: (r) => (
        <Badge variant={r.status === '운영중' ? 'success' : r.status === '점검' ? 'warning' : 'destructive'}>
          {r.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '전력거래' }, { label: '전력 현황 (온사이트)' }]} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">전력 현황 (온사이트)</h1>
          <p className="mt-1 text-sm text-slate-400">전체 직접 PPA 계약의 운영 현황을 관리합니다</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/platform/lease/billing/settlement')}>
          <Receipt size={14} className="mr-1.5" />
          정산 관리
        </Button>
      </div>

      <StatsGrid columns={5}>
        <StatCard
          label="총 설비 용량"
          value={`${(totalCapacity / 1000).toFixed(1)} MW`}
          sub={`${CONSUMERS.length}개 사업장`}
        />
        <StatCard label="당월 발전량" value={`${(totalMonthGen / 1000).toFixed(1)} MWh`} sub="전체 합산" />
        <StatCard label="당월 PPA 요금" value={`₩${(totalMonthFee / 1_000_000).toFixed(1)}M`} sub="전체 합산" />
        <StatCard
          label="당월 순절감"
          value={`₩${(totalNetSaving / 1_000_000).toFixed(1)}M`}
          change={
            totalMonthSaving > 0
              ? { value: Math.round((totalNetSaving / totalMonthSaving) * 100), label: '한전 대비' }
              : undefined
          }
        />
        <StatCard label="정상 운영" value={`${activeCount}/${CONSUMERS.length}`} sub="사업장" />
      </StatsGrid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SectionCard title="월별 PPA 요금 vs 한전 절감">
            {monthlyTrend.length > 0 ? (
              <RmsBarLineChart
                data={monthlyTrend}
                bars={[
                  { key: 'leaseFee', name: 'PPA 요금 (백만원)', color: '#f59e0b' },
                  { key: 'gridSaving', name: '한전 절감 (백만원)', color: '#10b981' },
                ]}
                xKey="month"
              />
            ) : (
              <p className="text-sm text-slate-500 py-8 text-center">데이터가 없습니다</p>
            )}
          </SectionCard>
        </div>
        <SectionCard title="알림">
          <div className="space-y-3">
            {CONSUMERS.length === 0 ? (
              <p className="text-sm text-slate-500">알림이 없습니다</p>
            ) : (
              CONSUMERS.map((c) => (
                <div key={c.id} className="flex items-start gap-2 text-sm">
                  {c.status === '운영중' ? (
                    <CheckCircle2 size={14} className="text-blue-400 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className="text-white/80">
                      {c.company} — {c.status === '운영중' ? '정상 운영 중' : c.status}
                    </div>
                    <div className="text-xs text-accent">{c.site}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="직접 PPA 계약 목록"
        headerRight={
          <div className="flex items-center gap-2">
            <Input
              placeholder="수용가 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48"
              icon={<Search size={14} />}
            />
            <Dropdown
              trigger={
                <Button variant="ghost" size="sm">
                  {statusFilter === 'all' ? '전체 상태' : statusFilter} <ChevronDown size={12} className="ml-1" />
                </Button>
              }
            >
              <DropdownItem onClick={() => setStatusFilter('all')}>전체</DropdownItem>
              <DropdownItem onClick={() => setStatusFilter('운영중')}>운영중</DropdownItem>
              <DropdownItem onClick={() => setStatusFilter('점검')}>점검</DropdownItem>
              <DropdownItem onClick={() => setStatusFilter('중단')}>중단</DropdownItem>
            </Dropdown>
          </div>
        }
      >
        <DataTable data={filtered} rowKey={(r) => r.id} columns={columns} emptyMessage="해당하는 계약이 없습니다" />
      </SectionCard>
    </div>
  );
}
