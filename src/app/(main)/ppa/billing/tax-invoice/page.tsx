// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import {
  FileText,
  Search,
  Download,
  AlertCircle,
  Wallet,
  Receipt as ReceiptIcon,
  CreditCard,
  ChevronDown,
} from 'lucide-react';
import { SectionCard } from '@/components/features';
import {
  InvoiceStatusPill,
  InvoiceDetailPanel,
  TaxInvoicePreview,
  type InvoiceStatus,
} from '@/components/features/billing';
import { MiniStat } from '@/components/features/billing';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { useToastStore } from '@/stores/useToastStore';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { RmsBarChart } from '@/components/ui/Chart';
import { cn, exportTaxInvoicePdf, type TaxInvoiceExportData } from '@/lib/utils';
import { buildMonthlyChart } from '@/lib/billing/buildMonthlyChart';
import { usePpaSettlements } from '@/hooks/ppa/usePpa';

/* ───────────────────────── Types & Mock — 수용가 매입 세금계산서 ─────────────────────────
 * 발전사(/generator/ppa/revenue/tax-invoice)와 동일한 라이프사이클·정산 분해 양식.
 * 차이: 매입(SPC → 수용가) — 공급자가 SPC, 합계 = 수용가가 SPC에 지급해야 할 금액(SPC 수금).
 *      라이프사이클: 정산 통보 → 동의 대기(동의/이의) → 발급 → 납부 */

type PaymentStatus = 'pending' | 'completed' | 'none';

const CONSUMER_STATUS_LABELS: Record<InvoiceStatus, string> = {
  issued: '발급완료',
  unissued: '미발급',
  paid: '납부완료',
};

interface Invoice {
  id: string;
  kind: 'offsite' | 'onsite' | 'lease';
  estimated?: boolean;
  consent?: 'pending';
  number: string;
  issueMonth: string;
  supplier: string;
  supplierBizId: string;
  supplierRepresentative?: string;
  supplierAddress?: string;
  supplierBizType?: string;
  supplierBizCategory?: string;
  receiverName?: string;
  receiverBizId?: string;
  receiverRepresentative?: string;
  receiverAddress?: string;
  receiverBizType?: string;
  receiverBizCategory?: string;
  plantName: string;
  site: string;
  issueDate: string | null;
  type: string;
  status: InvoiceStatus;
  supply: number; // 공급량 (MWh)
  unitPrice: number; // 단가 (₩/kWh)
  supplyAmount: number; // 공급가액
  vat: number;
  total: number; // 합계 = 수용가 청구액
  paymentDate: string | null;
  paymentScheduled: boolean;
  paymentStatus: PaymentStatus;
  virtualAccount?: string;
  issuePeriodStart: string;
  issuePeriodEnd: string;
  breakdown?: {
    ppaRevenue: number;
    surcharge: number;
    network: number;
    tradeFee: number;
    supplyFee: number;
    manageFee: number;
    fund: number;
    adjust: number;
  };
}

interface Site {
  id: string;
  label: string;
}

const KIND_META: Record<string, { label: string; cls: string }> = {
  offsite: { label: 'Offsite PPA', cls: 'bg-blue-500/[0.10] text-blue-300 ring-blue-500/30' },
  onsite: { label: 'Onsite PPA', cls: 'bg-emerald-500/[0.10] text-emerald-300 ring-emerald-500/30' },
  lease: { label: '직접 PPA', cls: 'bg-violet-500/[0.10] text-violet-300 ring-violet-500/30' },
};

function settlementToInvoice(s: any): Invoice {
  const kind = (s.ppaKind === 'onsite' ? 'onsite' : s.ppaKind === 'lease' ? 'lease' : 'offsite') as Invoice['kind'];
  const period = s.period ?? '';
  const issueMonth = period.length >= 7 ? `${period.slice(0, 4)}.${period.slice(5, 7)}` : period;
  const periodYear = period.slice(0, 4);
  const periodMonth = period.slice(5, 7);
  const lastDay = new Date(Number(periodYear), Number(periodMonth), 0).getDate();

  const statusMap: Record<string, InvoiceStatus> = { PAID: 'paid', ISSUED: 'issued' };
  const invoiceStatus: InvoiceStatus = statusMap[s.status] ?? 'unissued';
  const paymentStatus: PaymentStatus = s.status === 'PAID' ? 'completed' : s.status === 'ISSUED' ? 'pending' : 'none';

  return {
    id: String(s.id),
    kind,
    number: s.contractNumber ? `TI-${period.replace('-', '')}-${s.id}` : '—',
    issueMonth,
    supplier: s.supplierName ?? 'SPC',
    supplierBizId: s.supplierBizNo ?? '',
    supplierRepresentative: s.supplierRepresentative,
    supplierAddress: s.supplierAddress,
    supplierBizType: s.supplierBizType,
    supplierBizCategory: s.supplierBizCategory,
    receiverName: s.receiverName,
    receiverBizId: s.receiverBizNo,
    receiverRepresentative: s.receiverRepresentative,
    receiverAddress: s.receiverAddress,
    receiverBizType: s.receiverBizType,
    receiverBizCategory: s.receiverBizCategory,
    plantName: s.plantName ?? '',
    site: s.plantName ?? '',
    issueDate: s.createdAt?.slice(0, 10) ?? null,
    type: '전자',
    status: invoiceStatus,
    supply: Math.round((s.generationKwh ?? 0) / 100) / 10,
    unitPrice: s.smpUnitPrice ?? 0,
    supplyAmount: s.supplyAmount ?? 0,
    vat: s.vat ?? 0,
    total: s.total ?? 0,
    paymentDate: s.status === 'PAID' ? s.createdAt?.slice(0, 10) : null,
    paymentScheduled: false,
    paymentStatus,
    issuePeriodStart: `${periodYear}-${periodMonth}-01`,
    issuePeriodEnd: `${periodYear}-${periodMonth}-${String(lastDay).padStart(2, '0')}`,
    breakdown: {
      ppaRevenue: s.supplyAmount ?? 0,
      surcharge: s.supplyFee ?? 0,
      network: s.networkFee ?? 0,
      tradeFee: s.tradeFee ?? 0,
      supplyFee: s.supplyFee ?? 0,
      manageFee: s.manageFee ?? 0,
      fund: s.fundAmount ?? 0,
      adjust: s.adjustAmount ?? 0,
    },
  };
}

/* ───────────────────────── Page ───────────────────────── */

function ScopeTrigger({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm transition-colors min-w-[160px] cursor-pointer text-white hover:bg-white/[0.08]">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="font-medium truncate flex-1">{value}</span>
      <ChevronDown size={14} className="text-slate-500 shrink-0" />
    </div>
  );
}

/** 통합 Invoice → 표준 세금계산서(별지 제11호) 추출 데이터 (매입 — 수용가) */
function invoiceToExport(inv: Invoice): TaxInvoiceExportData {
  const [yy, mm] = inv.issueMonth.split('.');
  const lastDay = inv.issuePeriodEnd?.split('-')[2] ?? '';
  const kindLabel = (KIND_META[inv.kind] ?? KIND_META.offsite).label;
  return {
    invoiceNo: inv.number,
    issueDate: (inv.issueDate ?? `${yy}.${mm}.15`).replace(/-/g, '.'),
    supplier: {
      name: inv.supplier,
      bizNo: inv.supplierBizId,
      representative: inv.supplierRepresentative ?? '',
      address: inv.supplierAddress ?? '',
      bizType: inv.supplierBizType ?? '',
      bizCategory: inv.supplierBizCategory ?? '',
    },
    receiver: {
      name: inv.receiverName ?? '',
      bizNo: inv.receiverBizId ?? '',
      representative: inv.receiverRepresentative ?? '',
      address: inv.receiverAddress ?? '',
      bizType: inv.receiverBizType ?? '',
      bizCategory: inv.receiverBizCategory ?? '',
    },
    items: [
      {
        month: String(Number(mm)),
        day: lastDay ? String(Number(lastDay)) : '',
        description: `전력량 대금 (${kindLabel})`,
        spec: 'kWh',
        quantity: `${inv.supply.toLocaleString()} MWh`,
        unitPrice: `₩${inv.unitPrice}`,
        supplyAmount: inv.supplyAmount,
        tax: inv.vat,
        note: `${inv.issuePeriodStart}~${inv.issuePeriodEnd}`,
      },
    ],
    supplyTotal: inv.supplyAmount,
    vatTotal: inv.vat,
    grandTotal: inv.total,
    receiptOrClaim: 'claim',
    type: 'purchase',
  };
}

function downloadInvoicePdf(inv: Invoice) {
  // 수용가 = 공급받는 자 → 공급받는자 보관본
  exportTaxInvoicePdf(`세금계산서_${inv.issueMonth}_${inv.plantName}`, [invoiceToExport(inv)], '공급받는자');
}

export default function PpaTaxInvoicePage() {
  const { data: apiSettlements } = usePpaSettlements();
  const INVOICES: Invoice[] = useMemo(() => {
    const raw = (apiSettlements?.content ?? []) as any[];
    return raw.map(settlementToInvoice);
  }, [apiSettlements]);
  const SITES: Site[] = useMemo(() => {
    const seen = new Map<string, Site>();
    for (const inv of INVOICES) {
      if (inv.site && !seen.has(inv.site)) seen.set(inv.site, { id: String(seen.size + 1), label: inv.site });
    }
    return Array.from(seen.values());
  }, [INVOICES]);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [monthFilter, setMonthFilter] = useState<string>('전체');
  const [siteFilter, setSiteFilter] = useState<'all' | string>('all');
  const [selectedId, setSelectedId] = useState<string>('');

  const filtered = useMemo(
    () =>
      INVOICES.filter((i) => {
        if (monthFilter !== '전체' && i.issueMonth !== monthFilter) return false;
        if (statusFilter !== 'all' && i.status !== statusFilter) return false;
        if (siteFilter !== 'all' && i.site !== SITES.find((s) => s.id === siteFilter)?.label) return false;
        if (query) {
          const q = query.toLowerCase();
          if (![i.supplier, i.number, i.plantName, i.site].some((v) => v.toLowerCase().includes(q))) return false;
        }
        return true;
      }),
    [query, statusFilter, monthFilter, siteFilter, INVOICES, SITES],
  );

  const selected = INVOICES.find((i) => i.id === selectedId) ?? INVOICES[0] ?? null;
  const monthlyChart = useMemo(() => buildMonthlyChart(filtered), [filtered]);

  const monthOptions = useMemo(
    () => ['전체', ...Array.from(new Set(INVOICES.map((i) => i.issueMonth))).sort((a, b) => b.localeCompare(a))],
    [INVOICES],
  );

  const stats = useMemo(
    () => ({
      total: INVOICES.filter((i) => !i.estimated).length,
      sumTotal: INVOICES.filter((i) => !i.estimated).reduce((s, i) => s + i.total, 0),
      unissued: INVOICES.filter((i) => i.status === 'unissued' && !i.estimated).length,
      pendingPayment: INVOICES.filter((i) => i.paymentStatus === 'pending').length,
    }),
    [INVOICES],
  );

  // 동의/이의 제기 + 미리보기 팝업
  const [consentTarget, setConsentTarget] = useState<{ inv: Invoice; mode: 'agree' | 'object' } | null>(null);
  const [objectReason, setObjectReason] = useState('');
  const closeConsent = () => {
    setConsentTarget(null);
    setObjectReason('');
  };
  const [previewTarget, setPreviewTarget] = useState<Invoice | null>(null);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: '전력거래', path: '/ppa/trading' }, { label: '직접 PPA' }, { label: '세금계산서' }]}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">세금계산서 (매입)</h1>
          <p className="mt-1 text-sm text-slate-400">월별 매입 세금계산서 — SPC 정산 통보 → 동의 → 발급 → 납부</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Dropdown
            align="left"
            trigger={
              <ScopeTrigger
                label="사업장"
                value={siteFilter === 'all' ? '전체' : (SITES.find((s) => s.id === siteFilter)?.label ?? '전체')}
              />
            }
          >
            <DropdownItem onClick={() => setSiteFilter('all')}>
              <p className="text-sm">전체 사업장</p>
              <p className="text-xs text-slate-500">{INVOICES.length}건</p>
            </DropdownItem>
            <div className="my-1 border-t border-white/[0.06]" />
            {SITES.map((s) => {
              const count = INVOICES.filter((i) => i.site === s.label).length;
              return (
                <DropdownItem key={s.id} onClick={() => setSiteFilter(s.id)}>
                  <p className="text-sm">{s.label}</p>
                  <p className="text-xs text-slate-500">{count}건</p>
                </DropdownItem>
              );
            })}
          </Dropdown>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* === Left main === */}
        <div className="xl:col-span-8 space-y-6">
          <SectionCard title="세금계산서 발급 현황" description="월별 합계 (단위: 백만원)">
            <RmsBarChart
              data={monthlyChart}
              xKey="month"
              bars={[{ key: 'amount', name: '청구 합계 (백만원)', color: '#3B82F6' }]}
              height={200}
              className="bg-transparent p-0"
            />
          </SectionCard>

          {/* Table */}
          <SectionCard
            title={`전체 ${filtered.length}건`}
            actions={
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative w-56">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input
                    type="text"
                    placeholder="검색"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Dropdown
                  align="right"
                  trigger={
                    <button className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white hover:bg-white/[0.08]">
                      <span className="text-xs text-slate-500">월</span>
                      <span className="font-medium">{monthFilter}</span>
                      <ChevronDown size={14} className="text-slate-500" />
                    </button>
                  }
                >
                  {monthOptions.map((m) => (
                    <DropdownItem key={m} onClick={() => setMonthFilter(m)}>
                      {m}
                    </DropdownItem>
                  ))}
                </Dropdown>
                <div className="flex rounded-lg bg-white/[0.04] p-1 ring-1 ring-white/[0.06]">
                  {(['all', 'issued', 'unissued', 'paid'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={cn(
                        'rounded px-2.5 h-7 text-xs transition-colors',
                        statusFilter === s ? 'bg-primary text-white font-medium' : 'text-slate-400 hover:text-white',
                      )}
                    >
                      {s === 'all' ? '전체' : CONSUMER_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1900px]">
                <thead className="text-left">
                  <tr className="border-b border-white/[0.04] text-[10px] text-slate-400 bg-white/[0.04]">
                    <th
                      colSpan={5}
                      className="px-3.5 text-left font-medium whitespace-nowrap border-r border-white/[0.04]"
                    >
                      기본 · 계약
                    </th>
                    <th colSpan={6} className="px-3.5 font-medium whitespace-nowrap border-r border-white/[0.04]">
                      과세
                    </th>
                    <th colSpan={1} className="px-3.5 font-medium whitespace-nowrap border-r border-white/[0.04]">
                      부가세
                    </th>
                    <th
                      colSpan={1}
                      className="px-3.5 font-medium whitespace-nowrap text-slate-500 border-r border-white/[0.04]"
                    >
                      비과세
                    </th>
                    <th
                      colSpan={1}
                      className="px-3.5 font-medium whitespace-nowrap text-blue-300 border-r border-white/[0.04]"
                    >
                      청구액
                    </th>
                    <th colSpan={1} className="px-3.5 font-medium whitespace-nowrap">
                      상태
                    </th>
                  </tr>
                  <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">발급년월</th>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">유형</th>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">
                      공급자
                      <br />
                      <span className="text-[10px] font-normal text-slate-500">발전소 · 사업장</span>
                    </th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">공급량</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap border-r border-white/[0.04]">
                      단가
                      <br />
                      <span className="text-[10px] font-normal text-slate-500">₩/kWh</span>
                    </th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap text-emerald-400">전력량 대금</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">부가정산금</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">망이용요금</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap text-amber-400">
                      거래수수료
                      <br />
                      <span className="text-[10px] font-normal text-slate-500">전력거래소</span>
                    </th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap text-amber-400">
                      거래수수료
                      <br />
                      <span className="text-[10px] font-normal text-slate-500">전력공급거래</span>
                    </th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap border-r border-white/[0.04] text-amber-400">
                      관리 수수료
                    </th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap border-r border-white/[0.04]">
                      부가세
                      <br />
                      <span className="text-[10px] font-normal text-slate-500">+10%</span>
                    </th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap border-r border-white/[0.04] text-slate-500">
                      전력산업
                      <br />
                      <span className="text-[10px] font-normal text-slate-500">기반기금</span>
                    </th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap border-r border-white/[0.04] text-blue-300">
                      수용가 → SPC
                      <br />
                      <span className="text-[10px] font-normal text-slate-500">청구액</span>
                    </th>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">
                      상태
                      <br />
                      <span className="text-[10px] font-normal text-slate-500">납부일</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => {
                    const bk = i.breakdown ?? {
                      ppaRevenue: 0,
                      surcharge: 0,
                      network: 0,
                      tradeFee: 0,
                      supplyFee: 0,
                      manageFee: 0,
                      fund: 0,
                      adjust: 0,
                    };
                    const dash = <span className="text-slate-600">—</span>;
                    const v = (n: number) => (i.estimated ? dash : `₩${n.toLocaleString()}`);
                    return (
                      <tr
                        key={i.id}
                        onClick={() => setSelectedId(i.id)}
                        className={cn(
                          'border-b border-white/[0.04] cursor-pointer transition-colors text-xs',
                          i.id === selectedId ? 'bg-primary/[0.06]' : 'hover:bg-white/[0.02]',
                        )}
                      >
                        <td className="px-3 py-2.5 text-slate-300 tabular-nums whitespace-nowrap">
                          {i.issueMonth}
                          {i.estimated && <span className="ml-1.5 text-[10px] text-teal-300">(예상)</span>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                              (KIND_META[i.kind] ?? KIND_META.offsite).cls,
                            )}
                          >
                            {(KIND_META[i.kind] ?? KIND_META.offsite).label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <p className="text-white font-medium">{i.supplier}</p>
                          <p className="text-[11px] text-slate-500">
                            {i.plantName} · {i.site}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 text-slate-300 tabular-nums whitespace-nowrap">
                          {i.estimated ? dash : `${i.supply} MWh`}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300 tabular-nums whitespace-nowrap border-r border-white/[0.04]">
                          ₩{i.unitPrice}
                        </td>
                        <td className="px-3 py-2.5 text-emerald-300 font-semibold tabular-nums whitespace-nowrap">
                          {v(bk.ppaRevenue)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300 tabular-nums whitespace-nowrap">{v(bk.surcharge)}</td>
                        <td className="px-3 py-2.5 text-slate-300 tabular-nums whitespace-nowrap">{v(bk.network)}</td>
                        <td className="px-3 py-2.5 text-amber-300 tabular-nums whitespace-nowrap">{v(bk.tradeFee)}</td>
                        <td className="px-3 py-2.5 text-amber-300 tabular-nums whitespace-nowrap">{v(bk.supplyFee)}</td>
                        <td className="px-3 py-2.5 text-amber-300 tabular-nums whitespace-nowrap border-r border-white/[0.04]">
                          {v(bk.manageFee)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300 tabular-nums whitespace-nowrap border-r border-white/[0.04]">
                          {v(i.vat)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 tabular-nums whitespace-nowrap border-r border-white/[0.04]">
                          {v(bk.fund)}
                        </td>
                        <td className="px-3 py-2.5 font-semibold tabular-nums whitespace-nowrap border-r border-white/[0.04]">
                          {i.estimated ? (
                            <span className="text-slate-600 font-normal">정산 확정 시</span>
                          ) : (
                            <span className="text-blue-300">₩{i.total.toLocaleString()}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            {i.estimated ? (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 bg-teal-500/[0.10] text-teal-200 ring-teal-400/40 w-fit">
                                정산 대기
                              </span>
                            ) : i.consent === 'pending' ? (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 bg-amber-500/[0.10] text-amber-300 ring-amber-500/30 w-fit">
                                동의 대기
                              </span>
                            ) : (
                              <InvoiceStatusPill status={i.status} labelOverride={CONSUMER_STATUS_LABELS[i.status]} />
                            )}
                            <span className="text-[11px] text-slate-500 tabular-nums">
                              {i.paymentDate ? (
                                <>
                                  {i.paymentDate}
                                  {i.paymentScheduled && <span className="text-slate-600 ml-1">(예정)</span>}
                                </>
                              ) : (
                                '납부일 미정'
                              )}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        {/* === Right sidebar === */}
        <div className="xl:col-span-4 space-y-4">
          <div className="rounded-lg border border-white/[0.06] bg-surface-card p-5">
            <p className="text-sm font-semibold text-white mb-4">세금계산서 현황</p>
            <div className="grid grid-cols-2 gap-4">
              <MiniStat
                icon={ReceiptIcon}
                iconBg="bg-blue-500/10"
                iconColor="text-blue-400"
                label="총 발급건수"
                value={`${stats.total}건`}
              />
              <MiniStat
                icon={Wallet}
                iconBg="bg-emerald-500/10"
                iconColor="text-emerald-400"
                label="총 청구 합계"
                value={`${(stats.sumTotal / 100_000_000).toFixed(1)}억`}
              />
              <MiniStat
                icon={AlertCircle}
                iconBg="bg-amber-500/10"
                iconColor="text-amber-400"
                label="미발급"
                value={`${stats.unissued}건`}
              />
              <MiniStat
                icon={CreditCard}
                iconBg="bg-violet-500/10"
                iconColor="text-violet-400"
                label="납부 대기"
                value={`${stats.pendingPayment}건`}
              />
            </div>
          </div>

          {selected && (
            <InvoiceDetailPanel
              issueMonth={selected.issueMonth}
              headerSuffix="(매입)"
              issuePeriodStart={selected.issuePeriodStart}
              issuePeriodEnd={selected.issuePeriodEnd}
              status={selected.status}
              statusLabelOverride={CONSUMER_STATUS_LABELS[selected.status]}
              number={selected.number}
              issueDate={selected.issueDate ?? '—'}
              type={selected.type}
              counterparty={{
                label: '공급자',
                name: selected.supplier,
                bizId: selected.supplierBizId,
                representative: selected.supplierRepresentative,
                address: selected.supplierAddress,
                bizType: selected.supplierBizType,
                bizCategory: selected.supplierBizCategory,
              }}
              receiver={{
                label: '공급받는자',
                name: selected.receiverName ?? '—',
                bizId: selected.receiverBizId ?? '',
                representative: selected.receiverRepresentative,
                address: selected.receiverAddress,
                bizType: selected.receiverBizType,
                bizCategory: selected.receiverBizCategory,
              }}
              assetLabel="발전소"
              assetValue={selected.plantName}
              amountRows={(() => {
                const bk = selected.breakdown ?? {
                  ppaRevenue: 0,
                  surcharge: 0,
                  network: 0,
                  tradeFee: 0,
                  supplyFee: 0,
                  manageFee: 0,
                  fund: 0,
                  adjust: 0,
                };
                const dash = <span className="text-slate-600">—</span>;
                const v = (n: number) => (selected.estimated ? dash : `₩${n.toLocaleString()}`);
                return [
                  { label: '공급량', value: selected.estimated ? dash : `${selected.supply.toLocaleString()} MWh` },
                  { label: '단가', value: `₩${selected.unitPrice}/kWh` },
                  { label: '전력량 대금', value: v(bk.ppaRevenue), valueClass: 'text-emerald-300 font-semibold' },
                  { label: '부가정산금', value: v(bk.surcharge) },
                  { label: '망이용요금', value: v(bk.network) },
                  { label: '거래수수료 (거래소)', value: v(bk.tradeFee), valueClass: 'text-amber-300' },
                  { label: '거래수수료 (공급)', value: v(bk.supplyFee), valueClass: 'text-amber-300' },
                  { label: '관리 수수료', value: v(bk.manageFee), valueClass: 'text-amber-300' },
                  { label: '전력산업기반기금', value: v(bk.fund), valueClass: 'text-slate-500' },
                  ...(bk.adjust !== 0
                    ? [
                        {
                          label: '요금 조정 (SPC 반영)',
                          value: `${bk.adjust >= 0 ? '+' : ''}₩${bk.adjust.toLocaleString()}`,
                          valueClass: bk.adjust >= 0 ? 'text-amber-300' : 'text-rose-300',
                        },
                      ]
                    : []),
                ];
              })()}
              supplyAmount={selected.supplyAmount}
              vat={selected.vat}
              total={selected.total}
              payment={{
                sectionTitle: '납부',
                dateLabel: '납부일',
                date: selected.paymentDate ? (
                  <>
                    {selected.paymentDate}
                    {selected.paymentScheduled && <span className="ml-1 text-slate-500">(예정)</span>}
                  </>
                ) : (
                  '—'
                ),
                statusValue:
                  selected.paymentStatus === 'pending' ? '대기' : selected.paymentStatus === 'completed' ? '완료' : '—',
                statusClass:
                  selected.paymentStatus === 'pending'
                    ? 'text-amber-300'
                    : selected.paymentStatus === 'completed'
                      ? 'text-emerald-300'
                      : 'text-slate-500',
                accountLabel: '납부 계좌',
                accountValue: selected.virtualAccount,
              }}
              actions={
                selected.consent === 'pending' ? (
                  /* 동의 대기: 동의 대상 = 정산서 (세금계산서는 양측 동의 후 발행) */
                  <div className="space-y-2">
                    <Button variant="ghost" size="md" className="w-full" onClick={() => setPreviewTarget(selected)}>
                      <FileText size={14} className="mr-1.5" />
                      정산서 미리보기
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => setConsentTarget({ inv: selected, mode: 'agree' })}
                      >
                        동의
                      </Button>
                      <Button
                        variant="danger"
                        size="md"
                        onClick={() => {
                          setConsentTarget({ inv: selected, mode: 'object' });
                          setObjectReason('');
                        }}
                      >
                        이의 제기
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="ghost" size="md" onClick={() => setPreviewTarget(selected)}>
                      <FileText size={14} className="mr-1.5" />
                      미리보기
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      disabled={selected.estimated}
                      onClick={() => downloadInvoicePdf(selected)}
                    >
                      <Download size={14} className="mr-1.5" />
                      세금계산서 다운로드
                    </Button>
                  </div>
                )
              }
            />
          )}
        </div>
      </div>

      {/* ─────────── 미리보기 — SPC 정산 분해 양식 ─────────── */}
      {previewTarget &&
        (() => {
          const inv = previewTarget;
          const kindMeta = KIND_META[inv.kind] ?? KIND_META.offsite;
          const bk = inv.breakdown ?? {
            ppaRevenue: 0,
            surcharge: 0,
            network: 0,
            tradeFee: 0,
            supplyFee: 0,
            manageFee: 0,
            fund: 0,
            adjust: 0,
          };
          const isDraft = inv.consent === 'pending';
          const isEstimated = inv.estimated;
          const headerNote = isEstimated
            ? {
                tone: 'bg-teal-500/[0.06] ring-teal-400/30 text-teal-200',
                text: '정산 대기 (예상치) — SPC 정산 확정 시 값이 채워집니다',
              }
            : isDraft
              ? {
                  tone: 'bg-amber-500/[0.06] ring-amber-500/30 text-amber-200',
                  text: '정산서 (발행 전) — 양측(발전사·수용가) 동의 확정 시 이 내용으로 매입 세금계산서가 발행됩니다',
                }
              : {
                  tone: 'bg-emerald-500/[0.06] ring-emerald-500/30 text-emerald-200',
                  text: '발급 완료된 세금계산서 — PDF 다운로드 가능',
                };
          return (
            <Modal
              open={!!previewTarget}
              onClose={() => setPreviewTarget(null)}
              title={`${isDraft ? '정산서' : '세금계산서'} 미리보기 — ${inv.issueMonth} ${kindMeta.label}`}
              size="lg"
              footer={
                <>
                  <Button variant="ghost" onClick={() => setPreviewTarget(null)}>
                    닫기
                  </Button>
                  {isDraft ? (
                    <Button
                      variant="primary"
                      onClick={() => {
                        setPreviewTarget(null);
                        setConsentTarget({ inv, mode: 'agree' });
                      }}
                    >
                      동의
                    </Button>
                  ) : (
                    <Button variant="primary" disabled={isEstimated} onClick={() => downloadInvoicePdf(inv)}>
                      <Download size={14} className="mr-1.5" />
                      세금계산서 다운로드
                    </Button>
                  )}
                </>
              }
            >
              <div className="space-y-4">
                <div className={cn('rounded-lg ring-1 px-4 py-3', headerNote.tone)}>
                  <p className="text-xs">{headerNote.text}</p>
                </div>
                <TaxInvoicePreview
                  title={isDraft ? '정 산 서' : '세 금 계 산 서'}
                  issueDate={inv.issueDate ?? undefined}
                  invoiceNumber={inv.number}
                  supplier={{
                    name: inv.supplier,
                    bizNo: inv.supplierBizId,
                    representative: inv.supplierRepresentative,
                    address: inv.supplierAddress,
                    bizType: inv.supplierBizType,
                    bizCategory: inv.supplierBizCategory,
                  }}
                  receiver={{
                    name: inv.receiverName ?? inv.site,
                    bizNo: inv.receiverBizId ?? '',
                    representative: inv.receiverRepresentative,
                    address: inv.receiverAddress,
                    bizType: inv.receiverBizType,
                    bizCategory: inv.receiverBizCategory,
                  }}
                  items={[
                    ...(bk.ppaRevenue
                      ? [
                          {
                            month: inv.issueMonth.split('.')[1] ?? '',
                            day: '',
                            description: '전력량 대금',
                            spec: `${inv.supply} MWh`,
                            quantity: inv.supply,
                            unitPrice: inv.unitPrice,
                            supplyAmount: bk.ppaRevenue,
                            tax: Math.round(bk.ppaRevenue * 0.1),
                          },
                        ]
                      : []),
                    ...(bk.surcharge
                      ? [
                          {
                            month: '',
                            day: '',
                            description: '부가정산금',
                            supplyAmount: bk.surcharge,
                            tax: Math.round(bk.surcharge * 0.1),
                          },
                        ]
                      : []),
                    ...(bk.network
                      ? [
                          {
                            month: '',
                            day: '',
                            description: '망이용요금',
                            supplyAmount: bk.network,
                            tax: Math.round(bk.network * 0.1),
                          },
                        ]
                      : []),
                    ...(bk.tradeFee
                      ? [
                          {
                            month: '',
                            day: '',
                            description: '거래수수료 (거래소)',
                            supplyAmount: bk.tradeFee,
                            tax: Math.round(bk.tradeFee * 0.1),
                          },
                        ]
                      : []),
                    ...(bk.supplyFee
                      ? [
                          {
                            month: '',
                            day: '',
                            description: '거래수수료 (공급)',
                            supplyAmount: bk.supplyFee,
                            tax: Math.round(bk.supplyFee * 0.1),
                          },
                        ]
                      : []),
                    ...(bk.manageFee
                      ? [
                          {
                            month: '',
                            day: '',
                            description: '관리 수수료',
                            supplyAmount: bk.manageFee,
                            tax: Math.round(bk.manageFee * 0.1),
                          },
                        ]
                      : []),
                    ...(bk.fund
                      ? [
                          {
                            month: '',
                            day: '',
                            description: '전력산업기반기금',
                            supplyAmount: bk.fund,
                            tax: 0,
                            note: '비과세',
                          },
                        ]
                      : []),
                    ...(bk.adjust
                      ? [{ month: '', day: '', description: '요금 조정', supplyAmount: bk.adjust, tax: 0 }]
                      : []),
                  ]}
                  supplyTotal={inv.supplyAmount}
                  vatTotal={inv.vat}
                  grandTotal={inv.total}
                  payment={{ credit: inv.total }}
                  receiptOrClaim="claim"
                />
              </div>
            </Modal>
          );
        })()}

      {/* ─────────── 동의/이의 제기 확인 팝업 ─────────── */}
      {consentTarget &&
        (() => {
          const { inv, mode } = consentTarget;
          const kindMeta = KIND_META[inv.kind] ?? KIND_META.offsite;
          return (
            <Modal
              open={!!consentTarget}
              onClose={closeConsent}
              title={mode === 'agree' ? '정산서 동의 확인' : '이의 제기'}
              size="md"
              footer={
                <>
                  <Button variant="ghost" onClick={closeConsent}>
                    돌아가기
                  </Button>
                  {mode === 'agree' ? (
                    <Button
                      variant="primary"
                      onClick={() => {
                        useToastStore
                          .getState()
                          .add(
                            'success',
                            `${inv.issueMonth} ${kindMeta.label} 정산서에 동의했습니다 — 발전사 동의 완료 시 매입 세금계산서가 발행됩니다`,
                          );
                        closeConsent();
                      }}
                    >
                      동의 확정
                    </Button>
                  ) : (
                    <Button
                      variant="danger"
                      disabled={!objectReason.trim()}
                      onClick={() => {
                        useToastStore.getState().add('warning', `이의 제기 접수 — 사유: ${objectReason.trim()}`);
                        closeConsent();
                      }}
                    >
                      이의 제기 접수
                    </Button>
                  )}
                </>
              }
            >
              <div className="space-y-4">
                <p className="text-sm text-slate-300">SPC가 통보한 정산서를 확인해주세요.</p>
                <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-slate-500">정산월 · 유형</span>
                    <span className="text-sm text-white">
                      {inv.issueMonth} ·{' '}
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                          kindMeta.cls,
                        )}
                      >
                        {kindMeta.label}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-slate-500">발전소</span>
                    <span className="text-sm text-white">{inv.plantName}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-slate-500">공급량 · 단가</span>
                    <span className="text-sm text-white tabular-nums">
                      {inv.supply.toLocaleString()} MWh · ₩{inv.unitPrice}/kWh
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-slate-500">공급가액 / 부가세</span>
                    <span className="text-sm text-slate-300 tabular-nums">
                      ₩{inv.supplyAmount.toLocaleString()} / ₩{inv.vat.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02]">
                    <span className="text-xs font-semibold text-white">합계 (청구액)</span>
                    <span className="text-base font-bold text-blue-300 tabular-nums">
                      ₩{inv.total.toLocaleString()}
                    </span>
                  </div>
                </div>
                {mode === 'agree' ? (
                  <div className="rounded-lg bg-emerald-500/[0.06] ring-1 ring-emerald-500/30 px-4 py-3">
                    <p className="text-xs text-emerald-200">
                      양측(발전사·수용가)이 모두 동의하면 매입 세금계산서가 발행되고 납부 일정이 확정됩니다. 동의 후에는
                      변경할 수 없습니다.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-xs text-accent block mb-1.5">이의 제기 사유 *</label>
                      <Textarea
                        value={objectReason}
                        onChange={(e) => setObjectReason(e.target.value)}
                        placeholder="예: 5월 공급량이 자체 계량값과 다릅니다. 재검토 부탁드립니다."
                      />
                      <p className="text-[11px] text-accent/70 mt-1">
                        사유는 SPC에 전달되며, 재정산 후 다시 통보됩니다.
                      </p>
                    </div>
                    <div className="rounded-lg bg-rose-500/[0.06] ring-1 ring-rose-500/30 px-4 py-3">
                      <p className="text-xs text-rose-200">
                        이의 제기 시 발급이 보류되고 SPC 재정산 절차가 진행됩니다.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </Modal>
          );
        })()}
    </div>
  );
}
