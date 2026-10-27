'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { BackButton } from '@/components/layout/PageTitle';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatusPill } from '@/components/ui/Design';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  CO,
  billOf,
  invoiceKey,
  issueDateOf,
  settlementsOf,
  useTradingPocStore,
  writtenDateOf,
  type Bill,
} from '@/stores/useTradingPocStore';
import { useTradingRole } from './useTradingRole';
import { fmtKrw, fmtKwh, fmtNum } from './meta';
import { Info, PageHeader, TEXT_MAX, cell, cellMuted, cellNum, cellStrong } from './Bits';
import { BILLING_LABEL } from './DocumentSheet';
import { BillingPaper, UploadButton, useTaxOriginal } from './BillingPaper';

type Kind = 'TAX' | 'INVOICE';
const NAME: Record<Kind, string> = { TAX: '세금계산서', INVOICE: '청구서' };
/** 차액 표시 — +₩69,000 / −₩69,000 */
const signed = (n: number, f: (v: number) => string) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${f(Math.abs(n))}`;
const baseOf = (kind: Kind, admin: boolean) =>
  admin
    ? `/platform/ppa/billing/${kind === 'TAX' ? 'tax-invoice' : 'invoices'}`
    : `/generator/ppa/direct/revenue/${kind === 'TAX' ? 'tax-invoice' : 'invoices'}`;

/**
 * 월 정산 — onsite 만(자가소비는 매달 내는 돈이 없다). 달이 끝난 달만. 관리자가 고친 청구서 값(사용량 등)을 얹는다.
 * 청구서는 작성 중이면 관리자만 본다 — 기업은 발행된 것부터
 */
function useBilling(kind: Kind) {
  const role = useTradingRole();
  const invoices = useTradingPocStore((s) => s.invoices);
  const rows = useMemo(
    () =>
      settlementsOf(role.contracts)
        .map((s) => billOf(s, invoices[invoiceKey(s.contractId, s.period)]))
        .filter((b) => role.isAdmin || kind === 'TAX' || b.billStatus !== 'DRAFT')
        .sort((a, b) => b.period.localeCompare(a.period) || b.total - a.total),
    [role.contracts, role.isAdmin, invoices, kind],
  );
  return { role, rows };
}

/**
 * 청구서 작성 — 관리자. 사용량(기본 = 그 달 발전량)·청구일·납부 기한·결제 계좌를 고치면 오른쪽 미리보기가 바로 바뀐다.
 * [발행]하면 기업에 보이고 납부 대기, 그 뒤로는 고치지 않는다. 입금 확인 후 [납부 완료]
 */
function InvoiceEditor({ b }: { b: Bill }) {
  const key = invoiceKey(b.contractId, b.period);
  const save = useTradingPocStore((s) => s.saveInvoice);
  const issue = useTradingPocStore((s) => s.issueInvoice);
  const pay = useTradingPocStore((s) => s.payInvoice);
  const [confirm, setConfirm] = useState<'issue' | 'pay' | null>(null);
  const draft = b.billStatus === 'DRAFT';
  // 정산 차액 — 전월 중 고를 달, 차액 kWh(±), 사유. 사용량은 못 고친다
  const rec = useTradingPocStore((s) => s.invoices[key]);
  const adj = rec?.adjust;
  const [adjOpen, setAdjOpen] = useState(!!adj);
  useEffect(() => setAdjOpen(!!adj), [key, adj]);
  const prevPeriods = useMemo(() => {
    const out: string[] = [];
    let [y, m] = b.period.split('-').map(Number) as [number, number];
    for (let i = 0; i < 12; i++) {
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      out.push(`${y}-${String(m).padStart(2, '0')}`);
    }
    return out;
  }, [b.period]);
  const adjKwhText = adj ? String(adj.kwh) : '';
  const setAdj = (patch: Partial<NonNullable<typeof adj>>) =>
    save(key, { adjust: { period: adj?.period ?? prevPeriods[0]!, kwh: adj?.kwh ?? 0, reason: adj?.reason ?? '', ...patch } });
  const adjInvalid = !!adj && adj.kwh !== 0 && (!adj.reason.trim() || !adj.period);
  // 납부 기한은 청구일 이후
  const dateInvalid = !b.issueDate || !b.dueDate || b.dueDate < b.issueDate;
  return (
    <SectionCard
      title="청구서 작성"
      actions={
        <div className="flex items-center gap-2">
          <StatePill s={b} />
          {draft && (
            <Button size="sm" onClick={() => setConfirm('issue')} disabled={!(b.generationKwh > 0) || adjInvalid || dateInvalid}>
              발행
            </Button>
          )}
          {b.billStatus === 'BILLED' && (
            <Button size="sm" onClick={() => setConfirm('pay')}>
              납부 완료
            </Button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {/* 사용량 — 통합관제 발전량 그대로, 못 고친다. 틀린 달은 아래 정산 차액으로 */}
        <Info label="사용량 (통합관제 발전량)" value={fmtKwh(b.generationKwh)} />
        <Info label="단가" value={`₩${fmtNum(b.smpUnitPrice, 1)}/kWh`} />
        {/* 작성 중만 입력 칸 — 발행한 뒤(납부 대기 · 납부 완료)는 정해진 값이라 글자로 */}
        {draft ? (
          <>
            <Input label="청구일" type="date" value={b.issueDate} onChange={(e) => save(key, { issueDate: e.target.value })} />
            <Input
              label="납부 기한"
              type="date"
              min={b.issueDate}
              value={b.dueDate}
              error={b.dueDate && b.issueDate && b.dueDate < b.issueDate ? '청구일 이후' : undefined}
              onChange={(e) => save(key, { dueDate: e.target.value })}
            />
            <div className="col-span-2">
              <Input
                label="결제 계좌"
                placeholder="은행 · 계좌번호 · 예금주"
                maxLength={100}
                value={b.bankAccount}
                onChange={(e) => save(key, { bankAccount: e.target.value })}
              />
            </div>
          </>
        ) : (
          <>
            <Info label="청구일" value={b.issueDate} />
            <Info label="납부 기한" value={b.dueDate} />
            <Info label="결제 계좌" value={b.bankAccount || '-'} className="col-span-2" />
          </>
        )}
        {/* 정산 차액 — 작성 중엔 넣고 고치는 칸, 발행한 뒤엔 정해진 값 한 줄(없으면 0) */}
        {draft ? (
        <div className="col-span-2 rounded-lg bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">정산 차액</p>
            {draft &&
              (adjOpen ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    save(key, { adjust: undefined });
                    setAdjOpen(false);
                  }}
                >
                  차액 지우기
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setAdj({});
                    setAdjOpen(true);
                  }}
                >
                  차액 추가
                </Button>
              ))}
          </div>
          {adjOpen && adj ? (
            <div className="mt-3 grid grid-cols-2 gap-4">
              {draft ? (
                <>
                  <Select
                    label="바로잡는 달"
                    options={prevPeriods.map((p) => ({ value: p, label: p }))}
                    value={adj.period}
                    onChange={(e) => setAdj({ period: e.target.value })}
                  />
                  <Input
                    label="차액 (kWh, 돌려줄 땐 −)"
                    inputMode="numeric"
                    value={adjKwhText}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9-]/g, '').replace(/(?!^)-/g, '');
                      const n = raw === '-' || raw === '' ? 0 : Math.max(-1_000_000, Math.min(1_000_000, Number(raw)));
                      setAdj({ kwh: n });
                    }}
                  />
                  <div className="col-span-2">
                    <Textarea
                      label="사유"
                      required
                      maxLength={TEXT_MAX}
                      rows={2}
                      className="resize-none"
                      value={adj.reason}
                      onChange={(e) => setAdj({ reason: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <>
                  <Info label="바로잡는 달" value={adj.period} />
                  <Info label="차액" value={signed(adj.kwh, fmtKwh)} />
                  <Info label="사유" value={adj.reason} className="col-span-2" />
                </>
              )}
              <Info label="차액 금액" value={signed(b.adjustAmount, fmtKrw)} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">없음</p>
          )}
        </div>
        ) : (
          <Info
            label={adj && adj.kwh !== 0 ? `정산 차액 (${adj.period})` : '정산 차액'}
            value={adj && adj.kwh !== 0 ? `${signed(adj.kwh, fmtKwh)}, ${signed(b.adjustAmount, fmtKrw)}, ${adj.reason}` : '0'}
            className="col-span-2"
          />
        )}
        <Info label="사용량 금액" value={fmtKrw(b.usageAmount)} />
        <Info label="공급가액" value={fmtKrw(b.supplyAmount)} />
        <Info label="부가세 (10%)" value={fmtKrw(b.vat)} />
        <Info label="청구 금액" value={fmtKrw(b.total)} />
        {b.paidAt && <Info label="납부일" value={b.paidAt} />}
      </div>
      <ConfirmDialog
        open={confirm != null}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm === 'issue') issue(key);
          if (confirm === 'pay') pay(key);
          setConfirm(null);
        }}
        title={confirm === 'pay' ? '납부 완료' : '발행'}
        message={
          confirm === 'pay'
            ? `${b.period} 청구서 ${fmtKrw(b.total)} 납부 완료로 바꿉니다.`
            : `${b.period} 청구서 ${fmtKrw(b.total)}를 ${b.consumerCompanyName}에 발행합니다. 발행한 뒤에는 고칠 수 없습니다.`
        }
        confirmLabel={confirm === 'pay' ? '납부 완료' : '발행'}
      />
    </SectionCard>
  );
}

/** 원본 칸 — 올렸으면 등록, 아니면 기업 계정은 [올리기] · 관리자는 미등록 */
function OriginalCell({ s }: { s: Bill }) {
  const { original, upload, canUpload } = useTaxOriginal(s.contractId, s.period);
  if (original) return <StatusPill tone="normal" label="등록" />;
  if (canUpload) return <UploadButton onFile={upload} label="올리기" />;
  return <StatusPill tone="muted" label="미등록" />;
}

const STATE_TONE = { DRAFT: 'muted', BILLED: 'warning', PAID: 'normal' } as const;
const StatePill = ({ s }: { s: Bill }) => (
  <StatusPill tone={STATE_TONE[s.billStatus]} label={BILLING_LABEL[s.billStatus]} />
);

/**
 * 세금계산서 · 청구서 — 위에 연도 · 월, KPI(금액), 표.
 * 관리자는 왼쪽 표 + 검색, 오른쪽 문서 미리보기 + PDF(통합관제 보고서와 같은 방식). 기업은 표 → 줄을 누르면 상세.
 * 공급자 = SPC(울산 에너지 플랫폼), 공급받는자 = onsite 계약 기업. 사용료(사용량 × 단가 = 공급가액) + 부가세 10%.
 */
function BillingScreen({ kind }: { kind: Kind }) {
  const router = useRouter();
  const { role, rows } = useBilling(kind);
  const years = useMemo(() => [...new Set(rows.map((s) => s.period.slice(0, 4)))].sort(), [rows]);
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState<number | null>(null);
  useEffect(() => {
    if (!year && years.length) setYear(years[years.length - 1]!);
  }, [year, years]);
  const months = [...new Set(rows.filter((s) => s.period.startsWith(year)).map((s) => s.period))].sort().reverse();
  const shiftYear = (by: number) => {
    const y = String(Number(year) + by);
    if (years.includes(y)) {
      setYear(y);
      setMonth('');
    }
  };

  const list = rows.filter(
    (s) =>
      s.period.startsWith(year) &&
      (!month || s.period === month) &&
      (!q.trim() || [s.consumerCompanyName, s.plantName].some((v) => v.includes(q.trim()))),
  );
  const sum = (xs: Bill[], f: (s: Bill) => number) => fmtKrw(xs.reduce((a, s) => a + f(s), 0));
  const kpi =
    kind === 'TAX'
      ? [
          { label: '공급가액', value: sum(list, (s) => s.supplyAmount) },
          { label: '세액', value: sum(list, (s) => s.vat) },
          { label: '합계', value: sum(list, (s) => s.total) },
        ]
      : [
          {
            label: '청구 금액',
            value: sum(
              list.filter((s) => s.billStatus !== 'DRAFT'),
              (s) => s.total,
            ),
          },
          {
            label: '납부 대기',
            value: sum(
              list.filter((s) => s.billStatus === 'BILLED'),
              (s) => s.total,
            ),
          },
          {
            label: '납부 완료',
            value: sum(
              list.filter((s) => s.billStatus === 'PAID'),
              (s) => s.total,
            ),
          },
        ];

  // 세금계산서 원본 — 전자세금계산서 업체에서 발행한 파일을 올렸는지. 기업은 여기서 바로 올린다
  const originalCol: Column<Bill> = {
    key: 'original',
    header: '원본',
    width: '110px',
    render: (s) => <OriginalCell s={s} />,
  };
  // 기업 계정 — 한 달 한 줄이라 표에 다 보이고, 줄을 누르면 상세(문서 · PDF)
  const fullColumns: Column<Bill>[] = [
    {
      key: 'period',
      header: '기간',
      width: '110px',
      sortable: true,
      sortValue: (s) => s.period,
      render: (s) => cellStrong(s.period),
    },
    ...(role.isAdmin
      ? [
          {
            key: 'consumer',
            header: kind === 'TAX' ? '공급받는자' : '청구 대상',
            render: (s: Bill) => cell(s.consumerCompanyName, 'text-white'),
          },
        ]
      : []),
    { key: 'kwh', header: '사용량', width: '130px', sortable: true, sortValue: (s) => s.generationKwh, render: (s) => cellNum(fmtKwh(s.generationKwh)) },
    { key: 'price', header: '단가', width: '100px', render: (s) => cellNum(`₩${fmtNum(s.smpUnitPrice, 1)}`) },
    ...(kind === 'TAX'
      ? [
          {
            key: 'supply',
            header: '공급가액',
            width: '130px',
            sortable: true,
            sortValue: (s: Bill) => s.supplyAmount,
            render: (s: Bill) => cellNum(fmtKrw(s.supplyAmount)),
          },
          { key: 'vat', header: '세액', width: '120px', sortable: true, sortValue: (s: Bill) => s.vat, render: (s: Bill) => cellMuted(fmtKrw(s.vat)) },
          { key: 'total', header: '합계', width: '130px', sortable: true, sortValue: (s: Bill) => s.total, render: (s: Bill) => cellStrong(fmtKrw(s.total)) },
          {
            key: 'issue',
            header: '발행일',
            width: '120px',
            render: (s: Bill) => cellMuted(issueDateOf(s.period)),
          },
          originalCol,
        ]
      : [
          {
            key: 'total',
            header: '청구 금액',
            width: '130px',
            sortable: true,
            sortValue: (s: Bill) => s.total,
            render: (s: Bill) => cellStrong(fmtKrw(s.total)),
          },
          {
            key: 'due',
            header: '납부 기한',
            width: '120px',
            render: (s: Bill) => cellMuted(s.dueDate),
          },
          { key: 'status', header: '상태', width: '110px', render: (s: Bill) => <StatePill s={s} /> },
        ]),
  ];

  // 관리자 — 기업마다 매달 확인하니 옆에 문서를 띄운다. 표는 줄이고 세부 숫자는 옆 문서에서
  const sideColumns: Column<Bill>[] = [
    {
      key: 'period',
      header: '기간',
      width: '100px',
      sortable: true,
      sortValue: (s) => s.period,
      render: (s) => cellStrong(s.period),
    },
    ...(role.isAdmin
      ? [
          {
            key: 'consumer',
            header: kind === 'TAX' ? '공급받는자' : '청구 대상',
            render: (s: Bill) => cell(s.consumerCompanyName, 'text-white'),
          },
        ]
      : []),
    {
      key: 'total',
      header: kind === 'TAX' ? '합계' : '청구 금액',
      width: '140px',
      align: 'right',
      sortable: true,
      sortValue: (s) => s.total,
      render: (s) => cellNum(fmtKrw(s.total)),
    },
    kind === 'TAX'
      ? { key: 'issue', header: '발행일', width: '120px', render: (s) => cellMuted(issueDateOf(s.period)) }
      : { key: 'status', header: '상태', width: '110px', render: (s) => <StatePill s={s} /> },
    ...(kind === 'TAX' ? [originalCol] : []),
  ];
  const columns = role.isAdmin ? sideColumns : fullColumns;
  const sel = list.find((s) => s.id === selId) ?? list[0];
  const selContract = sel ? role.contracts.find((c) => c.id === sel.contractId) : undefined;

  const arrowBtn =
    'flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 ring-1 ring-white/[0.06] hover:bg-white/[0.08] hover:text-white disabled:opacity-30';

  return (
    <div className="space-y-6">
      <PageHeader title={NAME[kind]} parent="수익·정산" />

      {/* 위 — 연도 · 월 */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#0d1520] px-4 py-3 ring-1 ring-white/[0.06]">
        <span className="text-sm text-slate-400">연도</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="전년"
            onClick={() => shiftYear(-1)}
            disabled={!years.includes(String(Number(year) - 1))}
            className={arrowBtn}
          >
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[72px] text-center text-base font-semibold tabular-nums text-white">{year}년</span>
          <button
            type="button"
            aria-label="내년"
            onClick={() => shiftYear(1)}
            disabled={!years.includes(String(Number(year) + 1))}
            className={arrowBtn}
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <span className="ml-2 text-sm text-slate-400">월</span>
        <div className="w-28">
          <Select
            options={[{ value: '', label: '전체' }, ...months.map((p) => ({ value: p, label: `${p.slice(5)}월` }))]}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
      </div>

      <StatsGrid columns={3}>
        {kpi.map((k) => (
          <StatCard key={k.label} label={k.label} value={k.value} />
        ))}
      </StatsGrid>

      {/* 관리자 — 목록 왼쪽 · 문서 오른쪽(통합관제 보고서처럼). 줄을 누르면 오른쪽 문서가 바뀌어 하나씩 들어가 보지 않아도 된다 */}
      <div
        className={
          role.isAdmin
            ? 'grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] xl:grid-cols-[minmax(0,1fr)_560px]'
            : undefined
        }
      >
        <SectionCard
          title={`${NAME[kind]} (${list.length})`}
          actions={
            role.isAdmin ? (
              <div className="relative w-64">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="기업 검색" className="pl-8" />
              </div>
            ) : undefined
          }
          noPadding
          className="min-w-0 !h-auto"
        >
          <DataTable
            columns={columns}
            data={list}
            rowKey={(s) => s.id}
            emptyMessage={`${NAME[kind]} 없음`}
            onRowClick={(s) =>
              role.isAdmin
                ? setSelId(s.id)
                : router.push(`${baseOf(kind, false)}/view?contract=${s.contractId}&period=${s.period}`)
            }
            rowClassName={(s) => (role.isAdmin && s.id === sel?.id ? '!bg-primary/10' : '')}
          />
        </SectionCard>
        {role.isAdmin && sel && selContract && (
          <div className="min-w-0 space-y-4">
            {kind === 'INVOICE' && <InvoiceEditor b={sel} />}
            <BillingPaper kind={kind} contract={selContract} period={sel.period} admin={role.isAdmin} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 세금계산서 · 청구서 한 건 — ?contract=계약&period=달. 위에 금액, 내용, 아래에 문서 미리보기(세금계산서 = 별지 제11호, 청구서 = 견본) + PDF.
 * 청구서 = 납부 관리(청구 금액 · 납부 기한 · 상태), 세금계산서 = 증빙(공급가액 · 세액 · 합계 · 작성일 · 발행일)
 */
function BillingDetailScreen({ kind }: { kind: Kind }) {
  const { role, rows } = useBilling(kind);
  const [key, setKey] = useState<{ contract: number; period: string } | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setKey({ contract: Number(p.get('contract')), period: p.get('period') ?? '' });
  }, []);
  const s = key ? rows.find((x) => x.contractId === key.contract && x.period === key.period) : undefined;
  const contract = s ? role.contracts.find((c) => c.id === s.contractId) : undefined;
  const list = baseOf(kind, role.isAdmin);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'RE100', path: '/re100' },
          { label: '수익·정산' },
          { label: NAME[kind], path: list },
          { label: s ? `${s.period} ${s.consumerCompanyName}` : NAME[kind] },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <BackButton href={list} label={`${NAME[kind]}로`} />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white">
              {s ? `${s.period} ${NAME[kind]}` : NAME[kind]}
              {s && <span className="ml-2 text-slate-400">· {s.consumerCompanyName}</span>}
            </h1>
            {s && (
              <p className="mt-1.5 text-sm tabular-nums text-slate-400">
                {contract?.no} · {s.period}-01 ~ {writtenDateOf(s.period)}
              </p>
            )}
          </div>
        </div>
      </div>

      {key && !s ? (
        <div className="rounded-2xl bg-[#0d1520] p-10 text-center text-sm text-slate-400 ring-1 ring-white/[0.06]">
          {NAME[kind]}를 찾을 수 없습니다
        </div>
      ) : s && contract ? (
        <>
          {kind === 'TAX' ? (
            <>
              <StatsGrid columns={3}>
                <StatCard label="공급가액" value={fmtKrw(s.supplyAmount)} />
                <StatCard label="세액 (10%)" value={fmtKrw(s.vat)} />
                <StatCard label="합계" value={fmtKrw(s.total)} />
              </StatsGrid>
              <SectionCard title="내용">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <Info label="공급자" value={CO.SPC.name} />
                  <Info label="공급받는자" value={s.consumerCompanyName} />
                  <Info label="품목" value="전력 사용" />
                  <Info label="사용량" value={fmtKwh(s.generationKwh)} />
                  <Info label="단가" value={`₩${fmtNum(s.smpUnitPrice, 1)}/kWh`} />
                  <div />
                  <Info label="작성일" value={writtenDateOf(s.period)} />
                  <Info label="발행일" value={issueDateOf(s.period)} />
                </div>
              </SectionCard>
            </>
          ) : (
            <>
              <StatsGrid columns={3}>
                <StatCard label="청구 금액" value={fmtKrw(s.total)} />
                <StatCard label="납부 기한" value={s.dueDate} />
                <StatCard label="상태" value={BILLING_LABEL[s.billStatus]} />
              </StatsGrid>
              <SectionCard title="내용">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <Info label="청구하는 곳" value={CO.SPC.name} />
                  <Info label="청구 대상" value={s.consumerCompanyName} />
                  <Info label="사용량 (통합관제 발전량)" value={fmtKwh(s.generationKwh)} />
                  <Info label="단가" value={`₩${fmtNum(s.smpUnitPrice, 1)}/kWh`} />
                  {s.adjust && (
                    <Info
                      label={`정산 차액 (${s.adjust.period})`}
                      value={`${signed(s.adjust.kwh, fmtKwh)}, ${signed(s.adjustAmount, fmtKrw)}, ${s.adjust.reason}`}
                      className="md:col-span-3"
                    />
                  )}
                  <Info label="공급가액" value={fmtKrw(s.supplyAmount)} />
                  <Info label="부가세 (10%)" value={fmtKrw(s.vat)} />
                  <Info label="청구일" value={s.issueDate} />
                  <Info label="납부 기한" value={s.dueDate} />
                  <Info label="결제 계좌" value={s.bankAccount || '-'} />
                </div>
              </SectionCard>
            </>
          )}
          <BillingPaper kind={kind} contract={contract} period={s.period} admin={role.isAdmin} />
        </>
      ) : null}
    </div>
  );
}

/** 수익·정산 › 세금계산서 — onsite 사용료, 달이 끝나면 발행. 공급자 = SPC, 공급받는자 = 기업 */
export function TaxInvoiceScreen() {
  return <BillingScreen kind="TAX" />;
}
export function TaxInvoiceDetailScreen() {
  return <BillingDetailScreen kind="TAX" />;
}

/** 수익·정산 › 청구서 — onsite 사용료, 달이 끝나면 청구(익월 1일), 납부 기한 익월 25일 */
export function InvoiceScreen() {
  return <BillingScreen kind="INVOICE" />;
}
export function InvoiceDetailScreen() {
  return <BillingDetailScreen kind="INVOICE" />;
}
