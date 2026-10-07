'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { RmsPaybackChart } from '@/components/ui/Chart';
import { DataTable, type Column } from '@/components/features/DataList';
import { Select } from '@/components/ui/Select';
import { settlementsOf } from '@/stores/useTradingPocStore';
import type { ChangeType, Contract } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { KEPCO_UNIT_PRICE, KIND_OPTIONS, fmtKrw, fmtKw, kindLabel, totalCostOf } from './meta';
import { PageHeader, cell, cellNum, cellStrong } from './Bits';
import { ContractDetailCard, monthOfContract } from './ContractDetailModal';
import { ChangeRequestModal } from './ChangeRequestModal';

const YEAR = '2026';
const arrow = {
  key: 'go',
  header: '',
  width: '40px',
  render: () => <ChevronRight size={15} className="text-slate-600" />,
};

/** 내 계약 — 용량 요약 · 월별 반납 그래프(onsite 있을 때) · 계약마다 상세 카드(팝업 없음). 관리자는 기업을 골라 보고, 전체일 때만 표(줄 → 그 기업) */
export function MyContractsScreen() {
  const router = useRouter();
  const role = useTradingRole();
  const [change, setChange] = useState<{ open: boolean; contractId?: number; type?: ChangeType }>({ open: false });
  const [kind, setKind] = useState('all');
  // 관리자 — 기업 고르기(계약 현황에서 기업을 누르면 ?company= 로 들어온다)
  const [company, setCompany] = useState('');
  useEffect(() => {
    setCompany(new URLSearchParams(window.location.search).get('company') ?? '');
  }, []);

  const companies = useMemo(
    () => [...new Map(role.contracts.map((c) => [c.consumerCompanyId, c.consumerCompanyName] as const))],
    [role.contracts],
  );
  const active = useMemo(
    () =>
      role.contracts.filter(
        (c) => c.status === 'ACTIVE' && (!role.isAdmin || !company || String(c.consumerCompanyId) === company),
      ),
    [role.contracts, role.isAdmin, company],
  );
  const settlements = useMemo(() => settlementsOf(active), [active]);

  // 요약 — 용량만(기업마다 유형별 1건이라 건수는 보이지 않는다)
  const stats = useMemo(() => {
    const kw = (xs: Contract[]) => xs.reduce((s, c) => s + c.capacityKw, 0);
    return {
      total: fmtKw(kw(active)),
      self: fmtKw(kw(active.filter((c) => c.kind === 'SELF_CONSUMPTION'))),
      onsite: fmtKw(kw(active.filter((c) => c.kind === 'ONSITE'))),
    };
  }, [active]);
  /**
   * 누적 금액 — 기업 입장에서 언제부터 이득인지. 계약 시작부터 지난 해(0년 = 투자 시점, 1년, 2년 …)마다 값, 만원 단위.
   * 자가소비: −설치비에서 시작해 매달 절감액(한전에 안 낸 요금)만큼, onsite: 0에서 매달 (한전 요금 − 반납 금액)만큼. 계약 기간이 끝나면 그대로.
   * 발전량은 울산 연 1,385 kWh/kW, 한전 단가는 에너지 설정 값으로 계약 기간 내내 같다고 본다.
   */
  /** onsite 그 해(k년차) 구간 단가 — 1구간 · 2구간 */
  const priceIn = (c: Contract, k: number) =>
    c.segments?.find((g) => k >= g.from && k <= g.to)?.price ??
    c.segments?.[c.segments.length - 1]?.price ??
    c.unitPrice;
  /** k년 동안 쌓인 금액 — fn(그 해 1년치) 을 계약 기간까지만 더한다 */
  const upTo = (c: Contract, k: number, perYear: (year: number) => number) =>
    Array.from({ length: Math.min(k, c.termYears) }, (_, i) => perYear(i + 1)).reduce((a, x) => a + x, 0);
  const kwhYear = (c: Contract) => monthOfContract(c).kwh * 12;

  /**
   * SPC 가 받는 돈 — 관리자 전체. onsite 반납 금액만(자가소비는 SPC 수입이 없다) 0년 ~ 20년 누적, 만원 단위.
   * 에스에너지(EPC)에 줄 몫은 아직 정하지 않아 빼지 않는다.
   */
  const income = useMemo(() => {
    const onsite = active.filter((c) => c.kind === 'ONSITE');
    const years = Math.max(0, ...onsite.map((c) => c.termYears));
    // 해마다 그 해 구간 단가 × 연 사용량
    const at = (k: number) => onsite.reduce((a, c) => a + upTo(c, k, (y) => kwhYear(c) * priceIn(c, y)), 0);
    return {
      has: onsite.length > 0,
      data: Array.from({ length: years + 1 }, (_, k) => ({
        year: k === 0 ? '0년' : `${k}년`,
        반납: Math.round(at(k) / 10_000),
      })),
      total: at(years),
    };
  }, [active]);

  const payback = useMemo(() => {
    if (active.length === 0) return { data: [] as Record<string, string | number>[], breakEven: '', total: 0 };
    // 계약 기간에 맞춘다 — 10년 계약이면 10년까지, 20년이면 20년까지. 유형별 선도 그 유형 계약 기간에서 끝난다
    const years = Math.max(...active.map((c) => c.termYears));
    // 자가소비: −설치비 + 해마다 한전에 안 낸 요금 / onsite: 해마다 (한전 단가 − 그 해 구간 단가) × 연 사용량
    const valueAt = (c: Contract, k: number) =>
      c.kind === 'SELF_CONSUMPTION'
        ? upTo(c, k, () => kwhYear(c) * KEPCO_UNIT_PRICE) - totalCostOf(c)
        : upTo(c, k, (y) => kwhYear(c) * (KEPCO_UNIT_PRICE - priceIn(c, y)));
    const self = active.filter((c) => c.kind === 'SELF_CONSUMPTION');
    const onsite = active.filter((c) => c.kind === 'ONSITE');
    const sum = (xs: Contract[], k: number) => Math.round(xs.reduce((a, c) => a + valueAt(c, k), 0) / 10_000);
    const lastOf = (xs: Contract[]) => Math.max(0, ...xs.map((c) => c.termYears));
    const data = Array.from({ length: years + 1 }, (_, k) => ({
      year: k === 0 ? '0년(투자)' : `${k}년`,
      ...(self.length && k <= lastOf(self) ? { 자가소비: sum(self, k) } : {}),
      ...(onsite.length && k <= lastOf(onsite) ? { onsite: sum(onsite, k) } : {}),
    }));
    // 흑자 전환 — 자가소비 설치비를 절감액으로 다 갚는 때(몇 년 몇 개월 · 그 달)
    const cost = self.reduce((a, c) => a + totalCostOf(c), 0);
    const perMonth = self.reduce((a, c) => a + monthOfContract(c).saving, 0);
    const first = self.map((c) => c.startDate).sort()[0];
    let breakEven = '';
    if (first && perMonth > 0) {
      const m = Math.ceil(cost / perMonth);
      const d = new Date(`${first.slice(0, 7)}-01T00:00:00`);
      d.setMonth(d.getMonth() + m);
      breakEven = `${Math.floor(m / 12)}년 ${m % 12}개월 · ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    const total = active.reduce((a, c) => a + valueAt(c, c.termYears), 0);
    return { data, breakEven, total };
  }, [active]);

  // 계약별 올해 반납 금액(확정) — onsite 만
  const yearOf = (id: number) =>
    settlements
      .filter((s) => s.contractId === id && s.status === 'CONFIRMED' && s.period.startsWith(YEAR))
      .reduce((a, s) => a + s.total, 0);

  const rows = useMemo(
    () =>
      active.filter((c) => kind === 'all' || c.kind === kind).sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [active, kind],
  );

  const columns: Column<Contract>[] = [
    {
      key: 'no',
      header: '계약번호',
      width: '160px',
      sortable: true,
      sortValue: (c) => c.no,
      render: (c) => cellStrong(c.no),
    },
    { key: 'kind', header: '계약 유형', width: '100px', render: (c) => cell(kindLabel(c.kind)) },
    { key: 'consumer', header: '기업명', render: (c) => cell(c.consumerCompanyName, 'text-white') },
    {
      key: 'capacity',
      header: '용량',
      width: '110px',
      sortable: true,
      sortValue: (c) => c.capacityKw,
      render: (c) => cellNum(fmtKw(c.capacityKw)),
    },
    { key: 'term', header: '계약 기간', width: '100px', render: (c) => cellNum(`${c.termYears}년`) },
    {
      key: 'year',
      header: '올해 반납 금액',
      width: '140px',
      sortable: true,
      sortValue: (c) => yearOf(c.id),
      render: (c) => cellNum(c.kind === 'ONSITE' ? fmtKrw(yearOf(c.id)) : '-'),
    },
    arrow,
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={role.isAdmin ? '계약' : '내 계약'}
        actions={
          role.isAdmin ? (
            <div className="w-48">
              <Select
                options={[
                  { value: '', label: '전체 기업' },
                  ...companies.map(([id, name]) => ({ value: String(id), label: name })),
                ]}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
          ) : undefined
        }
      />

      {/* 용량만 — 총 계약 · 자가소비 · onsite */}
      <StatsGrid columns={3}>
        <StatCard label="총 계약 용량" value={stats.total} />
        <StatCard label="자가소비 용량" value={stats.self} />
        <StatCard label="onsite 용량" value={stats.onsite} />
      </StatsGrid>
      {role.isAdmin && !company ? (
        // 관리자 전체 — SPC 가 받는 돈(onsite 반납 금액 누적)
        <SectionCard title="받는 반납 금액 누적 (만원, onsite)">
          <RmsPaybackChart
            data={income.data}
            xKey="year"
            lines={[{ key: '반납', name: 'onsite 반납 금액' }]}
            height={260}
          />
        </SectionCard>
      ) : (
        active.length > 0 && (
          // 기업 — 언제부터 이득인지
          <SectionCard
            title="누적 금액 (만원)"
            actions={
              <div className="flex items-center gap-4 text-sm">
                {payback.breakEven && (
                  <span className="text-slate-400">
                    흑자 전환 <span className="font-semibold tabular-nums text-white">{payback.breakEven}</span>
                  </span>
                )}
              </div>
            }
          >
            <RmsPaybackChart
              data={payback.data}
              xKey="year"
              lines={[
                ...(active.some((c) => c.kind === 'SELF_CONSUMPTION') ? [{ key: '자가소비', name: '자가소비' }] : []),
                ...(active.some((c) => c.kind === 'ONSITE') ? [{ key: 'onsite', name: 'onsite' }] : []),
              ]}
              height={260}
            />
          </SectionCard>
        )
      )}

      {role.isAdmin && !company ? (
        <SectionCard
          title={`계약 (${rows.length})`}
          actions={
            <label className="flex items-center gap-2 text-sm text-slate-400">
              계약 유형
              <Select
                options={[{ value: 'all', label: '전체' }, ...KIND_OPTIONS]}
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="w-32"
              />
            </label>
          }
          noPadding
        >
          <DataTable
            columns={columns}
            data={rows}
            rowKey={(c) => c.id}
            emptyMessage="계약 없음"
            onRowClick={(c) => setCompany(String(c.consumerCompanyId))}
          />
        </SectionCard>
      ) : active.length === 0 ? (
        <SectionCard title="계약">
          <p className="py-10 text-center text-base text-slate-400">계약 없음</p>
        </SectionCard>
      ) : (
        // 계약마다 카드 — onsite 먼저
        [...active]
          .sort((x, y) => Number(y.kind === 'ONSITE') - Number(x.kind === 'ONSITE'))
          .map((c) => (
            <ContractDetailCard
              key={c.id}
              contract={c}
              canRequestChange
              onRequestChange={(ct, type) => setChange({ open: true, contractId: ct.id, type })}
            />
          ))
      )}
      <ChangeRequestModal
        open={change.open}
        onClose={() => setChange({ open: false })}
        contracts={active}
        contractId={change.contractId}
        type={change.type}
        requestedBy={role.party}
        requestedByName={role.companyName}
        onSubmitted={(id) => router.push(`${role.isAdmin ? '/platform' : '/generator'}/trading/changes/view?id=${id}`)}
      />
    </div>
  );
}
