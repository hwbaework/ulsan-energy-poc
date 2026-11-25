'use client';

import { useEffect, useMemo, useState } from 'react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { Select } from '@/components/ui/Select';
import { useTradingRole } from './useTradingRole';
import { fmtKw, kindLabel } from './meta';
import { PageHeader } from './Bits';
import { ContractDetailCard } from './ContractDetailModal';
import { PpaMonthlyCard } from './PpaMonthlyCard';
import { useLocationSearch } from '@/lib/use-location-search';

/** 내 계약 — 용량 요약 · 월별 사용료 그래프(onsite 있을 때) · 계약마다 상세 카드(팝업 없음). 관리자는 기업을 골라 보고, 전체일 때만 표(줄 → 그 기업) */
export function MyContractsScreen() {
  const role = useTradingRole();
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
  // ROI(누적 금액 · 흑자 전환)는 뺐다 — 사업계획서 · 기능 WBS 에 근거가 없고, PPA 는 기업 투자가 없어 ROI 가 맞지 않는다.
  // 근거가 있는 절감액(사업계획서 쪽 41, 자가소비 내부 정산)은 계약 상세 카드의 예상 월 절감액으로 보인다(2026-11-25 사용자)

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

      {/* 고른 계약 하나 — 설치 용량 · 계약 기간 · 시작일(거래 신청 내용과 같은 이름 "설치 용량") */}
      {one && (
        <StatsGrid columns={3}>
          <StatCard label="설치 용량" value={fmtKw(one.capacityKw)} />
          <StatCard label="계약 기간" value={`${one.termYears}년`} />
          <StatCard label="시작일" value={one.startDate} />
        </StatsGrid>
      )}
      {/* 관리자 — PPA 달마다 얼마 들어왔는지 */}
      {role.isAdmin && <PpaMonthlyCard contracts={active} mode="income" label={current?.label ?? ''} />}
      {/* 기업 — PPA 달마다 얼마 냈는지(계약 현황은 관리자만) */}
      {!role.isAdmin && <PpaMonthlyCard contracts={active} mode="pay" />}

      {active.length === 0 ? (
        <SectionCard title="계약">
          <p className="py-10 text-center text-base text-slate-400">계약 없음</p>
        </SectionCard>
      ) : (
        // 고른 계약 하나의 상세
        active.map((c) => (
            // 변경 · 해지 신청 버튼은 두지 않는다 — 신청은 관리자 · 기업 모두 변경·해지 메뉴에서 한 곳으로(2026-11-25 사용자)
            <ContractDetailCard key={c.id} contract={c} canRequestChange={false} />
        ))
      )}
    </div>
  );
}
