'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { RmsPaybackChart } from '@/components/ui/Chart';
import { Select } from '@/components/ui/Select';
import type { ChangeType, Contract } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { KEPCO_UNIT_PRICE, fmtKw, kindLabel, totalCostOf } from './meta';
import { PageHeader } from './Bits';
import { ContractDetailCard, monthOfContract } from './ContractDetailModal';
import { ChangeRequestModal } from './ChangeRequestModal';
import { PpaMonthlyCard } from './PpaMonthlyCard';
import { useLocationSearch } from '@/lib/use-location-search';

/** 내 계약 — 용량 요약 · 월별 사용료 그래프(onsite 있을 때) · 계약마다 상세 카드(팝업 없음). 관리자는 기업을 골라 보고, 전체일 때만 표(줄 → 그 기업) */
export function MyContractsScreen() {
  const router = useRouter();
  const role = useTradingRole();
  const [change, setChange] = useState<{ open: boolean; contractId?: number; type?: ChangeType }>({ open: false });
  // 계약 하나씩 본다 — '전체'도, 자가소비 · PPA 를 한 화면에 섞는 것도 없다. 여러 계약을 한눈에 보는 것은 계약 현황(관리자)이 한다(2026-11-25 사용자)
  // 선택지 = 지금 유효한 계약. 한 기업에 계약이 둘이면 {기업}(자가소비) · {기업}(PPA), 하나면 기업 이름(관리자). 기업 계정은 계약 유형만
  const live = useMemo(() => role.contracts.filter((c) => c.status === 'ACTIVE'), [role.contracts]);
  const choices = useMemo(
    () =>
      [...live]
        .sort((a, b) => a.consumerCompanyName.localeCompare(b.consumerCompanyName, 'ko') || Number(b.kind === 'ONSITE') - Number(a.kind === 'ONSITE'))
        .map((c) => {
          const two = live.some((x) => x.consumerCompanyId === c.consumerCompanyId && x.kind !== c.kind);
          const label = role.isAdmin ? (two ? `${c.consumerCompanyName}(${kindLabel(c.kind)})` : c.consumerCompanyName) : kindLabel(c.kind);
          return { value: String(c.id), label, companyId: c.consumerCompanyId };
        }),
    [live, role.isAdmin],
  );
  // 계약 현황에서 줄을 누르면 ?contract= 로 그 계약, 예전 주소 ?company= 는 그 기업의 첫 계약
  const [pick, setPick] = useState('');
  const search = useLocationSearch();
  useEffect(() => {
    const sp = new URLSearchParams(search);
    const ct = sp.get('contract');
    const co = sp.get('company');
    const hit = ct ? choices.find((x) => x.value === ct) : co ? choices.find((x) => String(x.companyId) === co) : undefined;
    if (hit) setPick(hit.value);
  }, [search, choices]);
  const current = choices.find((x) => x.value === pick) ?? choices[0];
  const active = useMemo(() => live.filter((c) => String(c.id) === current?.value), [live, current]);
  const one = active[0];

  // 요약 — 고른 계약 하나(용량 · 기간 · 시작일)
  /**
   * 누적 금액 — 기업 입장에서 언제부터 이득인지. 계약 시작부터 지난 해(0년 = 투자 시점, 1년, 2년 …)마다 값, 만원 단위.
   * 자가소비: −설치비에서 시작해 매달 절감액(한전에 안 낸 요금)만큼, onsite: 0에서 매달 (한전 요금 − 사용료)만큼. 계약 기간이 끝나면 그대로.
   * 발전량은 울산 연 1,385 kWh/kW, 한전 단가는 에너지 설정 값으로 계약 기간 내내 같다고 본다.
   */
  /** 단가 — 계약 기간 한 단가 */
  const priceIn = (c: Contract, _k: number) => c.unitPrice;
  /** k년 동안 쌓인 금액 — fn(그 해 1년치) 을 계약 기간까지만 더한다 */
  const upTo = (c: Contract, k: number, perYear: (year: number) => number) =>
    Array.from({ length: Math.min(k, c.termYears) }, (_, i) => perYear(i + 1)).reduce((a, x) => a + x, 0);
  const kwhYear = (c: Contract) => monthOfContract(c).kwh * 12;

  const payback = useMemo(() => {
    if (active.length === 0) return { data: [] as Record<string, string | number>[], breakEven: '', total: 0 };
    // 계약 기간에 맞춘다 — 10년 계약이면 10년까지, 20년이면 20년까지. 유형별 선도 그 유형 계약 기간에서 끝난다
    const years = Math.max(...active.map((c) => c.termYears));
    // 자가소비: −설치비 + 해마다 한전에 안 낸 요금 / PPA: 해마다 (한전 단가 − PPA 단가) × 연 사용량
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

  return (
    <div className="space-y-6">
      {/* 제목은 메뉴 이름 · 고른 계약(문서 · 보고서 화면과 같은 꼴). 고를 것이 둘 이상일 때만 셀렉트 */}
      <PageHeader
        title={current && (role.isAdmin || choices.length > 1) ? `내 계약 · ${role.isAdmin ? current.label : `${one?.consumerCompanyName ?? ''}(${current.label})`}` : '내 계약'}
        crumb="내 계약"
        actions={
          choices.length > 1 ? (
            <div className="w-52">
              <Select options={choices.map(({ value, label }) => ({ value, label }))} value={current?.value ?? ''} onChange={(e) => setPick(e.target.value)} />
            </div>
          ) : undefined
        }
      />

      {/* 고른 계약 하나 — 계약 용량 · 계약 기간 · 시작일 */}
      {one && (
        <StatsGrid columns={3}>
          <StatCard label="계약 용량" value={fmtKw(one.capacityKw)} />
          <StatCard label="계약 기간" value={`${one.termYears}년`} />
          <StatCard label="시작일" value={one.startDate} />
        </StatsGrid>
      )}
      {role.isAdmin ? (
        // 관리자 — 달마다 얼마 들어와야 하는지(회사 골랐으면 그 회사만). ROI 는 기업 쪽에서만
        <PpaMonthlyCard contracts={active} mode="income" label={current?.label ?? ''} />
      ) : (
        active.length > 0 && (
          // 기업 — 언제부터 이득인지(ROI = 누적 금액)
          <SectionCard
            title="ROI · 누적 금액 (만원)"
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
                ...(active.some((c) => c.kind === 'ONSITE') ? [{ key: 'onsite', name: 'PPA' }] : []),
              ]}
              height={260}
            />
          </SectionCard>
        )
      )}
      {/* 기업 — PPA 달마다 얼마 냈는지(계약 현황은 관리자만) */}
      {!role.isAdmin && <PpaMonthlyCard contracts={active} mode="pay" />}

      {active.length === 0 ? (
        <SectionCard title="계약">
          <p className="py-10 text-center text-base text-slate-400">계약 없음</p>
        </SectionCard>
      ) : (
        // 고른 계약 하나의 상세
        active.map((c) => (
            <ContractDetailCard
              key={c.id}
              contract={c}
              canRequestChange={!role.isAdmin}
              onRequestChange={(ct) => setChange({ open: true, contractId: ct.id })}
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
