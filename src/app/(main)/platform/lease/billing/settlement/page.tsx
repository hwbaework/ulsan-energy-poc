// @ts-nocheck
'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  Download,
  FileText,
  _Receipt,
  _CheckCircle2,
  _Clock,
  _AlertCircle,
  _Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { RmsBarLineChart } from '@/components/ui/Chart';
import { StatCard, StatsGrid, SectionCard, DataTable } from '@/components/features';
import type { Column } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { exportExcel } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { useAllMonthlyRecords, useVolumeContracts } from '@/hooks/lease/useLease';

/* ───────────────────────── Types ───────────────────────── */

interface SettlementRow {
  id: string;
  period: string;
  company: string;
  site: string;
  generation: number;
  unitPrice: number;
  leaseFee: number;
  vat: number;
  total: number;
  gridSaving: number;
  netSaving: number;
  status: 'confirmed' | 'pending' | 'overdue';
  billDate: string;
}

const KEPCO_AVG = 119.6;

/* ───────────────────────── Page ───────────────────────── */

export default function PlatformLeaseSettlementPage() {
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState<number>(currentYear);
  const { data: apiRecords } = useAllMonthlyRecords({ year: yearFilter });
  const { data: volumeData } = useVolumeContracts();

  const contractMap = useMemo(() => {
    const map = new Map<number, { consumerName: string; siteName: string }>();
    const list = volumeData?.content ?? [];
    for (const c of list) {
      map.set(c.id, { consumerName: c.consumerCompanyName ?? '—', siteName: c.siteName ?? '—' });
    }
    return map;
  }, [volumeData]);

  const allRows: SettlementRow[] = useMemo(() => {
    return ((apiRecords ?? []) as any[]).map((r: any) => {
      const gen = Number(r.generatedKwh) || 0;
      const unit = Number(r.unitPriceKrw) || 0;
      const leaseFee = r.rent ?? Math.round(gen * unit);
      const vat = Math.round(leaseFee * 0.1);
      const total = leaseFee + vat;
      const gridSaving = Math.round(gen * KEPCO_AVG);
      const contract = contractMap.get(r.leaseContractId);
      return {
        id: String(r.id),
        period: r.period,
        company: contract?.consumerName ?? '—',
        site: contract?.siteName ?? '—',
        generation: gen,
        unitPrice: unit,
        leaseFee,
        vat,
        total,
        gridSaving,
        netSaving: gridSaving - total,
        status: 'confirmed' as const,
        billDate: '—',
      };
    });
  }, [apiRecords, contractMap]);

  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const PERIODS_DYNAMIC = useMemo(() => [...new Set(allRows.map((r) => r.period))].sort().reverse(), [allRows]);
  const COMPANIES_DYNAMIC = useMemo(() => [...new Set(allRows.map((r) => r.company))], [allRows]);

  const monthlySummary = useMemo(() => {
    const byMonth = new Map<string, { totalFee: number; totalSaving: number; consumers: Set<string> }>();
    for (const r of allRows) {
      const m = r.period.replace(/^\d{4}-0?/, '') + '월';
      const entry = byMonth.get(m) ?? { totalFee: 0, totalSaving: 0, consumers: new Set<string>() };
      entry.totalFee += r.total;
      entry.totalSaving += r.gridSaving;
      entry.consumers.add(r.company);
      byMonth.set(m, entry);
    }
    return [...byMonth.entries()].map(([month, v]) => ({
      month,
      totalFee: +(v.totalFee / 1_000_000).toFixed(2),
      totalSaving: +(v.totalSaving / 1_000_000).toFixed(2),
      consumers: v.consumers.size,
    }));
  }, [allRows]);

  const filtered = useMemo(() => {
    return allRows.filter((r) => {
      if (periodFilter !== 'all' && r.period !== periodFilter) return false;
      if (companyFilter !== 'all' && r.company !== companyFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (search && !r.company.includes(search) && !r.site.includes(search)) return false;
      return true;
    });
  }, [allRows, periodFilter, companyFilter, statusFilter, search]);

  const totalFee = filtered.reduce((s, r) => s + r.total, 0);
  const totalSaving = filtered.reduce((s, r) => s + r.gridSaving, 0);
  const totalNet = filtered.reduce((s, r) => s + r.netSaving, 0);
  const pendingCount = filtered.filter((r) => r.status === 'pending').length;
  const confirmedCount = filtered.filter((r) => r.status === 'confirmed').length;

  const statusBadge = (s: SettlementRow['status']) => {
    if (s === 'confirmed') return <Badge variant="success">확정</Badge>;
    if (s === 'pending') return <Badge variant="warning">대기</Badge>;
    return <Badge variant="destructive">연체</Badge>;
  };

  const columns: Column<SettlementRow>[] = [
    { key: 'period', header: '정산월', render: (r) => <span className="text-white/80">{r.period}</span> },
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
      key: 'gen',
      header: '발전량',
      render: (r) => <span className="text-white/80">{(r.generation / 1000).toFixed(1)} MWh</span>,
    },
    { key: 'unit', header: '단가', render: (r) => <span className="text-accent">₩{r.unitPrice}/kWh</span> },
    {
      key: 'fee',
      header: 'PPA 요금(VAT포함)',
      render: (r) => <span className="text-white/80">₩{r.total.toLocaleString()}</span>,
    },
    {
      key: 'saving',
      header: '순절감',
      render: (r) => (
        <span className={r.netSaving >= 0 ? 'text-emerald-400' : 'text-rose-400'}>₩{r.netSaving.toLocaleString()}</span>
      ),
    },
    { key: 'billDate', header: '청구일', render: (r) => <span className="text-accent">{r.billDate}</span> },
    { key: 'status', header: '상태', render: (r) => statusBadge(r.status) },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '전력거래' }, { label: '정산 (온사이트)' }]} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">정산 (온사이트)</h1>
          <p className="mt-1 text-sm text-slate-400">전체 직접 PPA 수용가의 정산 현황을 관리합니다</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportExcel(
                `리스-정산-${new Date().toISOString().slice(0, 10)}`,
                '정산',
                ['기간', '수용가', '사업장', '발전량(kWh)', '단가(원)', 'PPA 요금', 'VAT', '합계', '상태', '청구일'],
                filtered.map((r) => [
                  r.period,
                  r.company,
                  r.site,
                  r.generation,
                  r.unitPrice,
                  r.leaseFee,
                  r.vat,
                  r.total,
                  r.status,
                  r.billDate,
                ]),
              )
            }
          >
            <Download size={14} className="mr-1.5" />
            엑셀 다운로드
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              const targets = filtered.filter((r) => r.status === 'pending');
              if (targets.length === 0) {
                useToastStore.getState().add('info', '확정 대상 대기 건이 없습니다');
                return;
              }
              if (!window.confirm(`대기 ${targets.length}건을 일괄 정산 확정하시겠습니까?`)) return;
              useToastStore.getState().add('success', `${targets.length}건 정산 확정 완료`);
            }}
          >
            <FileText size={14} className="mr-1.5" />
            일괄 정산 확정
          </Button>
        </div>
      </div>

      {/* KPI */}
      <StatsGrid columns={5}>
        <StatCard
          label="정산 건수"
          value={`${filtered.length}건`}
          sub={`확정 ${confirmedCount} / 대기 ${pendingCount}`}
        />
        <StatCard label="총 PPA 요금" value={`₩${(totalFee / 1_000_000).toFixed(1)}M`} sub="VAT 포함" />
        <StatCard
          label="한전 절감 합계"
          value={`₩${(totalSaving / 1_000_000).toFixed(1)}M`}
          sub="한전 ₩119.6/kWh 기준"
        />
        <StatCard
          label="순절감 합계"
          value={`₩${(totalNet / 1_000_000).toFixed(1)}M`}
          change={totalSaving > 0 ? { value: Math.round((totalNet / totalSaving) * 100), label: '절감률' } : undefined}
        />
        <StatCard label="미확정 건수" value={`${pendingCount}건`} sub={pendingCount > 0 ? '확정 필요' : '없음'} />
      </StatsGrid>

      {/* 추이 차트 */}
      <SectionCard title="월별 정산 추이">
        <RmsBarLineChart
          data={monthlySummary}
          bars={[
            { key: 'totalFee', name: 'PPA 요금 (백만원)', color: '#f59e0b' },
            { key: 'totalSaving', name: '한전 절감 (백만원)', color: '#10b981' },
          ]}
          xKey="month"
        />
      </SectionCard>

      {/* 정산 목록 */}
      <SectionCard
        title="정산 내역"
        headerRight={
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              placeholder="수용가 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-40"
              icon={<Search size={14} />}
            />
            <Dropdown
              trigger={
                <Button variant="ghost" size="sm">
                  {yearFilter}년 <ChevronDown size={12} className="ml-1" />
                </Button>
              }
            >
              {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                <DropdownItem key={y} onClick={() => setYearFilter(y)}>
                  {y}년
                </DropdownItem>
              ))}
            </Dropdown>
            <Dropdown
              trigger={
                <Button variant="ghost" size="sm">
                  {periodFilter === 'all' ? '전체 기간' : periodFilter} <ChevronDown size={12} className="ml-1" />
                </Button>
              }
            >
              <DropdownItem onClick={() => setPeriodFilter('all')}>전체</DropdownItem>
              {PERIODS_DYNAMIC.map((p) => (
                <DropdownItem key={p} onClick={() => setPeriodFilter(p)}>
                  {p}
                </DropdownItem>
              ))}
            </Dropdown>
            <Dropdown
              trigger={
                <Button variant="ghost" size="sm">
                  {companyFilter === 'all' ? '전체 수용가' : companyFilter} <ChevronDown size={12} className="ml-1" />
                </Button>
              }
            >
              <DropdownItem onClick={() => setCompanyFilter('all')}>전체</DropdownItem>
              {COMPANIES_DYNAMIC.map((c) => (
                <DropdownItem key={c} onClick={() => setCompanyFilter(c)}>
                  {c}
                </DropdownItem>
              ))}
            </Dropdown>
            <Dropdown
              trigger={
                <Button variant="ghost" size="sm">
                  {statusFilter === 'all' ? '전체 상태' : statusFilter === 'confirmed' ? '확정' : '대기'}{' '}
                  <ChevronDown size={12} className="ml-1" />
                </Button>
              }
            >
              <DropdownItem onClick={() => setStatusFilter('all')}>전체</DropdownItem>
              <DropdownItem onClick={() => setStatusFilter('confirmed')}>확정</DropdownItem>
              <DropdownItem onClick={() => setStatusFilter('pending')}>대기</DropdownItem>
            </Dropdown>
          </div>
        }
      >
        <DataTable
          data={filtered}
          rowKey={(r) => r.id}
          columns={columns}
          emptyMessage="해당하는 정산 내역이 없습니다"
        />
      </SectionCard>
    </div>
  );
}
