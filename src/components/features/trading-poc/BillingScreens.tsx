'use client';

import { useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { StatusPill } from '@/components/ui/Design';
import { cn } from '@/lib/utils';
import {
  CO,
  billingStatusOf,
  dueDateOf,
  issueDateOf,
  settlementsOf,
  writtenDateOf,
  type TradeSettlement,
} from '@/stores/useTradingPocStore';
import { useTradingRole } from './useTradingRole';
import { fmtKrw, fmtKwh, fmtNum, savingOf } from './meta';
import { PageHeader, cell, cellMuted, cellNum, cellStrong } from './Bits';
import { BILLING_LABEL, DocumentSheet, billingDoc, printSheet } from './DocumentSheet';

const YEAR = '2026';
type Kind = 'TAX' | 'INVOICE';

/** 월 정산 — onsite 만(자가소비는 O&M 이 계약에 들어 있어 월 청구 없음). 달이 끝나고 발행된 달만 */
function useBilling() {
  const role = useTradingRole();
  const rows = useMemo(
    () =>
      settlementsOf(role.contracts)
        .filter((s) => s.period.startsWith(YEAR))
        .sort((a, b) => b.period.localeCompare(a.period) || b.total - a.total),
    [role.contracts],
  );
  const periods = useMemo(() => [...new Set(rows.map((s) => s.period))], [rows]);
  const companies = useMemo(() => [...new Set(rows.map((s) => s.consumerCompanyName))], [rows]);
  return { role, rows, periods, companies };
}

/** 오른쪽 — 고른 달 한 건: 기간 · 공급량 · 금액 · 한전 대비 할인 · 날짜 · PDF 저장 */
function BillingPanel({ kind, s }: { kind: Kind; s: TradeSettlement }) {
  const role = useTradingRole();
  const ref = useRef<HTMLDivElement>(null);
  const contract = role.contracts.find((c) => c.id === s.contractId);
  const doc = contract ? billingDoc(kind, contract, s.period) : undefined;
  const sv = savingOf(s.generationKwh, s.smpUnitPrice);
  const line = (label: string, value: string, cls?: string) => (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={cn('tabular-nums text-white', cls)}>{value}</span>
    </div>
  );
  return (
    <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] lg:sticky lg:top-6">
      <div className="border-b border-white/[0.06] px-5 py-4">
        <p className="text-lg font-bold text-white tabular-nums">
          {s.period}-01 ~ {writtenDateOf(s.period)}
        </p>
        <p className="mt-0.5 text-sm text-slate-400 tabular-nums">
          {s.consumerCompanyName} · {fmtKwh(s.generationKwh)} 공급
        </p>
      </div>
      <div className="space-y-5 px-5 py-4">
        <div className="space-y-2 rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
          {line('공급자', CO.SPC.name)}
          {line(kind === 'TAX' ? '공급받는자' : '청구 대상', s.consumerCompanyName)}
          {line('발전소', s.plantName)}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-white">정산</p>
          {line('공급량', fmtKwh(s.generationKwh))}
          {line('단가', `₩${fmtNum(s.smpUnitPrice, 1)}/kWh${s.segment ? ` (${s.segment}구간)` : ''}`)}
          {line('전력 사용료 (공급가액)', fmtKrw(s.supplyAmount))}
          {line(kind === 'TAX' ? '세액 (10%)' : '부가세 (10%)', fmtKrw(s.vat))}
        </div>
        <div className="flex items-center justify-between rounded-lg bg-primary/[0.08] px-4 py-3 ring-1 ring-primary/30">
          <span className="text-sm text-slate-300">{kind === 'TAX' ? '합계' : '청구 금액'}</span>
          <span className="text-xl font-bold text-white tabular-nums">{fmtKrw(s.total)}</span>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-white">한전 요금 대비</p>
          {line('한전 요금', fmtKrw(sv.kepco))}
          {line('할인', `${fmtKrw(sv.saving)} (${sv.rate.toFixed(1)}%)`, 'text-emerald-300')}
        </div>

        <div className="space-y-2">
          {line('작성일', writtenDateOf(s.period))}
          {line('발행일', issueDateOf(s.period))}
          {kind === 'INVOICE' && line('납부 기한', dueDateOf(s.period))}
          {kind === 'INVOICE' && line('상태', BILLING_LABEL[billingStatusOf(s.period)])}
        </div>

        {doc && contract && (
          <>
            <Button className="w-full" onClick={() => printSheet(ref.current, doc.title)}>
              <Download size={14} className="mr-1.5" /> PDF 저장
            </Button>
            {/* 인쇄용 A4 — 화면에는 숨김 */}
            <div className="hidden">
              <DocumentSheet doc={doc} contract={contract} sheetRef={ref} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** 세금계산서 · 청구서 — 왼쪽 표, 오른쪽 고른 건 */
function BillingScreen({ kind }: { kind: Kind }) {
  const { role, rows, periods, companies } = useBilling();
  const [period, setPeriod] = useState('');
  const [company, setCompany] = useState('');
  const [selected, setSelected] = useState<number | null>(null);

  const list = useMemo(
    () => rows.filter((s) => (!period || s.period === period) && (!company || s.consumerCompanyName === company)),
    [rows, period, company],
  );
  const current = list.find((s) => s.id === selected) ?? list[0];
  const sum = (xs: TradeSettlement[], f: (s: TradeSettlement) => number) => fmtKrw(xs.reduce((a, s) => a + f(s), 0));
  const saving = rows.reduce((a, s) => a + savingOf(s.generationKwh, s.smpUnitPrice).saving, 0);

  const columns: Column<TradeSettlement>[] = [
    {
      key: 'period',
      header: '기간',
      width: '90px',
      sortable: true,
      sortValue: (s) => s.period,
      render: (s) => cellStrong(s.period),
    },
    {
      key: 'consumer',
      header: kind === 'TAX' ? '공급받는자' : '청구 대상',
      width: '110px',
      render: (s) => cell(s.consumerCompanyName, 'text-white'),
    },
    { key: 'plant', header: '발전소', width: '130px', render: (s) => cell(s.plantName) },
    { key: 'kwh', header: '공급량', width: '120px', render: (s) => cellNum(fmtKwh(s.generationKwh)) },
    { key: 'price', header: '단가', width: '90px', render: (s) => cellNum(`₩${fmtNum(s.smpUnitPrice, 1)}`) },
    ...(kind === 'TAX'
      ? [
          {
            key: 'supply',
            header: '공급가액',
            width: '120px',
            render: (s: TradeSettlement) => cellNum(fmtKrw(s.supplyAmount)),
          },
          { key: 'vat', header: '세액', width: '100px', render: (s: TradeSettlement) => cellMuted(fmtKrw(s.vat)) },
          { key: 'total', header: '합계', width: '120px', render: (s: TradeSettlement) => cellStrong(fmtKrw(s.total)) },
        ]
      : [
          {
            key: 'total',
            header: '청구 금액',
            width: '120px',
            render: (s: TradeSettlement) => cellStrong(fmtKrw(s.total)),
          },
          {
            key: 'due',
            header: '납부 기한',
            width: '110px',
            render: (s: TradeSettlement) => cellMuted(dueDateOf(s.period)),
          },
          {
            key: 'status',
            header: '상태',
            width: '100px',
            render: (s: TradeSettlement) => (
              <StatusPill
                tone={billingStatusOf(s.period) === 'PAID' ? 'normal' : 'warning'}
                label={BILLING_LABEL[billingStatusOf(s.period)]}
              />
            ),
          },
        ]),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={kind === 'TAX' ? '세금계산서' : '청구서'} parent="수익·정산" />
      {/* StatsGrid 는 카드를 바로 자식으로 받는다 — Fragment 로 감싸지 않는다 */}
      <StatsGrid columns={3}>
        <StatCard
          label={kind === 'TAX' ? `${YEAR} 공급가액` : '납부 대기'}
          value={
            kind === 'TAX'
              ? sum(rows, (s) => s.supplyAmount)
              : sum(
                  rows.filter((s) => billingStatusOf(s.period) === 'BILLED'),
                  (s) => s.total,
                )
          }
        />
        <StatCard
          label={kind === 'TAX' ? `${YEAR} 세액` : `${YEAR} 납부 완료`}
          value={
            kind === 'TAX'
              ? sum(rows, (s) => s.vat)
              : sum(
                  rows.filter((s) => billingStatusOf(s.period) === 'PAID'),
                  (s) => s.total,
                )
          }
        />
        <StatCard label={`${YEAR} 한전 대비 할인`} value={fmtKrw(saving)} />
      </StatsGrid>

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <SectionCard
          title={`전체 ${list.length}건`}
          className="xl:col-span-2"
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-400">
                기간
                <Select
                  options={[{ value: '', label: '전체' }, ...periods.map((p) => ({ value: p, label: p }))]}
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-32"
                />
              </label>
              {role.isAdmin && companies.length > 1 && (
                <label className="flex items-center gap-2 text-sm text-slate-400">
                  기업
                  <Select
                    options={[{ value: '', label: '전체' }, ...companies.map((c) => ({ value: c, label: c }))]}
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-36"
                  />
                </label>
              )}
            </div>
          }
          noPadding
        >
          <DataTable
            columns={columns}
            data={list}
            rowKey={(s) => s.id}
            emptyMessage={kind === 'TAX' ? '세금계산서 없음' : '청구서 없음'}
            onRowClick={(s) => setSelected(s.id)}
            rowClassName={(s) => (s.id === current?.id ? 'bg-primary/[0.06]' : '')}
          />
        </SectionCard>
        {current && <BillingPanel key={current.id} kind={kind} s={current} />}
      </div>
    </div>
  );
}

/** 수익·정산 › 세금계산서 — onsite 전력 사용분, 달이 끝나면 발행. 공급자 = 플랫폼(SPC), 공급받는자 = 기업 */
export function TaxInvoiceScreen() {
  return <BillingScreen kind="TAX" />;
}

/** 수익·정산 › 청구서 — onsite 전력 사용분, 달이 끝나면 청구(다음 달 1일), 납부 기한 다음 달 25일 */
export function InvoiceScreen() {
  return <BillingScreen kind="INVOICE" />;
}
