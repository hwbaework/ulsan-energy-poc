'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Search } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Input } from '@/components/ui/Input';
import { RmsBarChart, RmsPaybackChart } from '@/components/ui/Chart';
import { settlementsOf } from '@/stores/useTradingPocStore';
import type { Contract } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { KEPCO_UNIT_PRICE, estimateMonthlyKwh, fmtKrw, fmtKw, kindLabel, totalCostOf } from './meta';
import { PageHeader, cell, cellMuted, cellNum, cellStrong } from './Bits';

const kw = (xs: Contract[]) => xs.reduce((s, c) => s + c.capacityKw, 0);
/** 월 사용료 — onsite 만(예상 월 사용량 × 1구간 단가). 자가소비는 매달 내는 돈이 없다 */
const returnOf = (c: Contract) =>
  c.kind === 'ONSITE' ? estimateMonthlyKwh(c.capacityKw) * c.unitPrice : 0;
const arrow = {
  key: 'go',
  header: '',
  width: '40px',
  render: () => <ChevronRight size={15} className="text-slate-600" />,
};

/**
 * 계약 현황 — 체결된(서명이 끝난) 계약만. 서명 대기는 거래 승인에서. 통합관제처럼 위 KPI(용량) · 그래프 · 표.
 *  - 관리자: 전체. 기업별 용량(자가소비 · onsite 쌓은 막대) + 기업별 계약 표(기업마다 한 줄, 누르면 내 계약에서 그 기업)
 *  - 기업: 내 계약만. 계약마다 한 줄
 */
export function ContractOverviewScreen() {
  const router = useRouter();
  const role = useTradingRole();
  const [q, setQ] = useState('');

  const active = useMemo(() => role.contracts.filter((c) => c.status === 'ACTIVE'), [role.contracts]);
  const self = active.filter((c) => c.kind === 'SELF_CONSUMPTION');
  const onsite = active.filter((c) => c.kind === 'ONSITE');
  const monthly = active.reduce((s, c) => s + returnOf(c), 0);

  /** 기업별 — 기업마다 한 줄 */
  const companies = useMemo(() => {
    const ids = [...new Set(active.map((c) => c.consumerCompanyId))];
    return ids
      .map((id) => {
        const cs = active.filter((c) => c.consumerCompanyId === id);
        return {
          id,
          name: cs[0]!.consumerCompanyName,
          selfKw: kw(cs.filter((c) => c.kind === 'SELF_CONSUMPTION')),
          onsiteKw: kw(cs.filter((c) => c.kind === 'ONSITE')),
          start: cs.map((c) => c.startDate).sort()[0] ?? '',
          monthly: cs.reduce((s, c) => s + returnOf(c), 0),
        };
      })
      .sort((a, b) => b.selfKw + b.onsiteKw - (a.selfKw + a.onsiteKw));
  }, [active]);
  type Co = (typeof companies)[number];
  const shownCos = companies.filter((c) => !q.trim() || c.name.includes(q.trim()));
  // 자가소비 ROI — −설치비에서 시작해 해마다 절감(한전 요금)만큼 쌓인다(만원). 흑자 전환 시점
  const roi = useMemo(() => {
    if (self.length === 0) return { data: [] as Record<string, string | number>[], breakEven: '', cost: 0 };
    const years = Math.max(...self.map((c) => c.termYears));
    const cost = self.reduce((a, c) => a + totalCostOf(c), 0);
    const perYear = self.reduce((a, c) => a + estimateMonthlyKwh(c.capacityKw) * 12 * KEPCO_UNIT_PRICE, 0);
    const data = Array.from({ length: years + 1 }, (_, k) => ({ year: k === 0 ? '0년(투자)' : `${k}년`, 자가소비: Math.round((perYear * k - cost) / 10_000) }));
    const m = perYear > 0 ? Math.ceil(cost / (perYear / 12)) : 0;
    const breakEven = m ? `${Math.floor(m / 12)}년 ${m % 12}개월` : '';
    return { data, breakEven, cost };
  }, [self]);
  // PPA 월별 — 들어온 실적만(정산). 관리자 = 수입, 기업 = 납부
  const ppaMonthly = useMemo(() => {
    const st = settlementsOf(onsite);
    const months = [...new Set(st.map((x) => x.period))].sort();
    return months.map((m) => {
      const rows = st.filter((x) => x.period === m);
      return { month: `${Number(m.slice(5, 7))}월`, period: m, 금액: Math.round(rows.reduce((a, x) => a + x.total, 0) / 10_000), confirmed: rows.every((x) => x.status === 'CONFIRMED') };
    });
  }, [onsite]);
  const ppaYear = ppaMonthly.reduce((a, x) => a + x.금액, 0);
  const ppaChart = ppaMonthly.map((x) => ({ month: x.month, 금액: x.금액 }));

  const coCols: Column<Co>[] = [
    { key: 'name', header: '기업', render: (c) => cellStrong(c.name) },
    { key: 'self', header: '자가소비', width: '130px', render: (c) => cellNum(c.selfKw ? fmtKw(c.selfKw) : '-') },
    { key: 'onsite', header: 'PPA', width: '130px', render: (c) => cellNum(c.onsiteKw ? fmtKw(c.onsiteKw) : '-') },
    { key: 'start', header: '첫 시작일', width: '130px', render: (c) => cellMuted(c.start || '-') },
    {
      key: 'monthly',
      header: '월 사용료',
      width: '140px',
      sortable: true,
      sortValue: (c) => c.monthly,
      render: (c) => cellNum(c.monthly ? fmtKrw(c.monthly) : '-'),
    },
    arrow,
  ];

  /* 기업 계정 — 계약마다 한 줄 */
  const contractCols: Column<Contract>[] = [
    { key: 'no', header: '계약번호', width: '160px', render: (c) => cellStrong(c.no) },
    { key: 'kind', header: '계약 유형', width: '100px', render: (c) => cell(kindLabel(c.kind)) },
    { key: 'capacity', header: '용량', width: '130px', render: (c) => cellNum(fmtKw(c.capacityKw)) },
    { key: 'term', header: '계약 기간', width: '100px', render: (c) => cellNum(`${c.termYears}년`) },
    { key: 'start', header: '시작일', width: '130px', render: (c) => cellMuted(c.startDate) },
    { key: 'end', header: '종료일', width: '130px', render: (c) => cellMuted(c.endDate) },
    {
      key: 'monthly',
      header: '월 사용료',
      width: '140px',
      render: (c) => cellNum(returnOf(c) ? fmtKrw(returnOf(c)) : '-'),
    },
  ];

  const contractsBase = role.isAdmin ? '/platform/ppa/contracts' : '/generator/ppa/contracts';

  return (
    <div className="space-y-6">
      <PageHeader title="계약 현황" />

      <StatsGrid columns={3}>
        <StatCard label="자가소비 용량" value={fmtKw(kw(self))} />
        <StatCard label="PPA 용량" value={fmtKw(kw(onsite))} />
        <StatCard label="월 사용료 (PPA)" value={fmtKrw(monthly)} />
      </StatsGrid>

      {role.isAdmin ? (
        <>
          {/* 자가소비 — ROI 만 */}
          {self.length > 0 && (
            <SectionCard title="자가소비 ROI (만원)">
              <p className="mb-3 text-sm text-slate-300 tabular-nums">
                설치비 {fmtKrw(roi.cost)}
                {roi.breakEven && (
                  <>
                    {' · '}흑자 전환 <span className="font-semibold text-white">{roi.breakEven}</span>
                  </>
                )}
              </p>
              <RmsPaybackChart data={roi.data} xKey="year" lines={[{ key: '자가소비', name: '누적 (설치비 차감)' }]} height={260} />
            </SectionCard>
          )}
          {/* PPA — 달마다 얼마 들어왔는지(정산 실적) */}
          {onsite.length > 0 && (
            <SectionCard title={`PPA 월별 수입 (만원) · 금년 ${fmtKrw(ppaYear * 10_000)}`}>
              <RmsBarChart data={ppaChart} xKey="month" bars={[{ key: '금액', name: '수입 (만원)' }]} height={240} />
            </SectionCard>
          )}
          <SectionCard
            title={`기업별 계약 (${shownCos.length})`}
            actions={
              <div className="relative w-64">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="기업 검색" className="pl-8" />
              </div>
            }
            noPadding
          >
            <DataTable
              columns={coCols}
              data={shownCos}
              rowKey={(c) => c.id}
              emptyMessage="계약 없음"
              onRowClick={(c) => router.push(`${contractsBase}?company=${c.id}`)}
            />
          </SectionCard>
        </>
      ) : (
        <>
          {/* 기업 — PPA 달마다 얼마 냈는지 · 내야 하는지 */}
          {onsite.length > 0 && (
            <SectionCard title={`PPA 월별 납부 (만원) · 금년 ${fmtKrw(ppaYear * 10_000)}`}>
              <RmsBarChart data={ppaChart} xKey="month" bars={[{ key: '금액', name: '납부 (만원)' }]} height={240} />
              <p className="mt-2 text-xs text-slate-400 tabular-nums">
                {ppaMonthly.map((x) => `${x.month} ${x.confirmed ? '납부' : '대기'}`).join(' · ')}
              </p>
            </SectionCard>
          )}
        <SectionCard title={`내 계약 (${active.length})`} noPadding>
          <DataTable
            columns={contractCols}
            data={[...active].sort((a, b) => a.startDate.localeCompare(b.startDate))}
            rowKey={(c) => c.id}
            emptyMessage="계약 없음"
            onRowClick={() => router.push(contractsBase)}
          />
        </SectionCard>
        </>
      )}
    </div>
  );
}
