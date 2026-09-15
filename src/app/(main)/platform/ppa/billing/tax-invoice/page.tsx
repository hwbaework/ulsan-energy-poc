// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  Search,
  Eye,
  ArrowRightLeft,
  RefreshCcw,
  Building2,
  Factory,
  Hash,
  Lock,
  ExternalLink,
  ChevronDown,
  Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { cn, exportTaxInvoiceCsv, exportTaxInvoiceExcel, exportTaxInvoicePdf } from '@/lib/utils';
import type { TaxInvoiceExportData } from '@/lib/utils';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { usePpaSettlements } from '@/hooks/ppa/usePpa';
import Link from 'next/link';
import { AMENDMENT_REASONS, type AmendmentReasonCode } from '@/types/tax-invoice';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */
type Tab = 'issued' | 'mapping' | 'amended';
type InvoiceState = 'issued' | 'pending' | 'failed';

const STATE_META: Record<InvoiceState, { label: string; tone: string; bg: string; ring: string }> = {
  issued: { label: '발행 완료', tone: 'text-emerald-300', bg: 'bg-emerald-500/[0.10]', ring: 'ring-emerald-500/30' },
  pending: { label: '발행 대기', tone: 'text-amber-300', bg: 'bg-amber-500/[0.10]', ring: 'ring-amber-500/30' },
  failed: { label: '발행 실패', tone: 'text-rose-300', bg: 'bg-rose-500/[0.10]', ring: 'ring-rose-500/30' },
};

/* ─────────────────────────────────────────────
   1 정산건 = 매입 1장 + 매출 1장 매핑
   ───────────────────────────────────────────── */
type PartyInfo = {
  name: string;
  bizNo: string;
  representative: string;
  address: string;
  bizType: string;
  bizCategory: string;
};

type Mapping = {
  id: string;
  cycle: string;
  settlementId: string;
  generator: string;
  consumer: string;
  amount: number;
  purchaseInvoice: { no: string; state: InvoiceState; issuedAt?: string };
  saleInvoice: { no: string; state: InvoiceState; issuedAt?: string };
  amended: boolean;
  esero: boolean;
  supplier: PartyInfo;
  receiver: PartyInfo;
};

const _SPC_PARTY: PartyInfo = {
  name: '울산에너지(SPC)',
  bizNo: '610-88-12345',
  representative: '박영호',
  address: '울산광역시 남구 산업로 915',
  bizType: '서비스업',
  bizCategory: '전력중개',
};
const GEN_PARTIES: Record<string, PartyInfo> = {
  C발전소: {
    name: '(주)알엠에스플랫폼',
    bizNo: '123-45-67890',
    representative: '김성호',
    address: '울산광역시 남구 테크노산업로 55',
    bizType: '제조업',
    bizCategory: '발전',
  },
  '제2공장 옥상': {
    name: '에스에너지',
    bizNo: '234-56-78901',
    representative: '이수진',
    address: '울산광역시 울주군 범서읍 산업로 120',
    bizType: '서비스업',
    bizCategory: '태양광발전',
  },
  '본사 옥상': {
    name: '라씨',
    bizNo: '345-67-89012',
    representative: '최준혁',
    address: '서울특별시 강남구 테헤란로 427',
    bizType: '서비스업',
    bizCategory: '에너지솔루션',
  },
};
const CONSUMER_PARTY: PartyInfo = {
  name: '한일튜브(주)',
  bizNo: '610-81-00123',
  representative: '장기원',
  address: '울산광역시 북구 산업로 1033',
  bizType: '제조업',
  bizCategory: '금속관 제조',
};

type Amendment = {
  id: string;
  originalNo: string;
  amendedNo: string;
  cycle: string;
  consumer: string;
  reasonCode: AmendmentReasonCode;
  reasonDetail?: string;
  delta: number;
  amendedAt: string;
  type: 'sale' | 'purchase';
};

function fmtKrw(n: number) {
  if (Math.abs(n) >= 100_000_000) return `₩ ${(n / 100_000_000).toFixed(2)}억`;
  if (Math.abs(n) >= 10_000) return `₩ ${(n / 10_000).toFixed(0)}만`;
  return `₩ ${n.toLocaleString()}`;
}

function toParty(p: PartyInfo) {
  return {
    name: p.name,
    bizNo: p.bizNo,
    representative: p.representative,
    address: p.address,
    bizType: p.bizType,
    bizCategory: p.bizCategory,
  };
}

function mappingToInvoices(m: Mapping): TaxInvoiceExportData[] {
  const supply = Math.round(m.amount / 1.1);
  const vat = m.amount - supply;
  const [yr, mo] = m.cycle.split('-');
  const lastDay = new Date(Number(yr), Number(mo), 0).getDate();
  const issueDate = `${yr}.${mo}.${String(lastDay).padStart(2, '0')}`;

  const item = {
    month: String(Number(mo)),
    day: String(lastDay),
    description: '전력공급(PPA)',
    spec: 'kWh',
    quantity: '—',
    unitPrice: '—',
    supplyAmount: supply,
    tax: vat,
    note: m.cycle,
  };

  return [
    {
      invoiceNo: m.purchaseInvoice.no,
      issueDate,
      supplier: toParty(m.supplier),
      receiver: toParty({
        name: '울산에너지(SPC)',
        bizNo: '610-88-12345',
        representative: '박영호',
        address: '울산광역시 남구 산업로 915',
        bizType: '서비스업',
        bizCategory: '전력중개',
      }),
      items: [item],
      supplyTotal: supply,
      vatTotal: vat,
      grandTotal: m.amount,
      receiptOrClaim: 'claim',
      type: 'purchase',
    },
    {
      invoiceNo: m.saleInvoice.no,
      issueDate,
      supplier: toParty({
        name: '울산에너지(SPC)',
        bizNo: '610-88-12345',
        representative: '박영호',
        address: '울산광역시 남구 산업로 915',
        bizType: '서비스업',
        bizCategory: '전력중개',
      }),
      receiver: toParty(m.receiver),
      items: [item],
      supplyTotal: supply,
      vatTotal: vat,
      grandTotal: m.amount,
      receiptOrClaim: 'claim',
      type: 'sale',
    },
  ];
}

/* ─────────────────────────────────────────────
   Page
   ───────────────────────────────────────────── */
export default function PlatformPpaTaxInvoicePage() {
  const { data: apiSettlements } = usePpaSettlements();
  const [tab, setTab] = useState<Tab>('issued');
  const [search, setSearch] = useState('');

  const MAPPINGS: Mapping[] = useMemo(() => {
    const raw = ((apiSettlements as any)?.content ?? (Array.isArray(apiSettlements) ? apiSettlements : [])) as any[];
    return raw.map((s: any) => {
      const period = s.period ?? '';
      const statusMap: Record<string, InvoiceState> = { CONFIRMED: 'issued', PENDING: 'pending', DRAFT: 'pending' };
      const invoiceState = statusMap[s.status] ?? 'pending';
      const isIssued = invoiceState === 'issued';
      const amount = Number(s.supplyAmount) || Number(s.total) || 0;
      const plantName = s.plantName ?? '—';
      const contractNumber = s.contractNumber ?? '';
      const suffix = `${period.replace('-', '')}-${String(s.id).slice(-3)}`;
      return {
        id: String(s.id),
        cycle: period,
        settlementId: `stl-${s.id}`,
        generator: plantName,
        consumer: s.consumerCompanyName ?? '한일튜브(주)',
        amount,
        purchaseInvoice: { no: `PI-${suffix}`, state: invoiceState, ...(isIssued ? { issuedAt: period + '-15' } : {}) },
        saleInvoice: { no: `SI-${suffix}`, state: invoiceState, ...(isIssued ? { issuedAt: period + '-15' } : {}) },
        amended: false,
        esero: isIssued,
        supplier: GEN_PARTIES[plantName] ?? {
          name: plantName,
          bizNo: '—',
          representative: '—',
          address: '—',
          bizType: '—',
          bizCategory: '—',
        },
        receiver: CONSUMER_PARTY,
      };
    });
  }, [apiSettlements]);

  const AMENDMENTS: Amendment[] = [];

  const latestCycle = useMemo(() => {
    return (
      Array.from(new Set(MAPPINGS.map((m) => m.cycle)))
        .sort()
        .reverse()[0] ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    );
  }, [MAPPINGS]);
  const [latestYear, latestMonth] = latestCycle.split('-');

  const availableYears = useMemo(() => {
    const dataYears = new Set(MAPPINGS.map((m) => m.cycle.split('-')[0]));
    const currentYear = Number(latestYear);
    for (let y = currentYear; y >= currentYear - 4; y--) dataYears.add(String(y));
    return Array.from(dataYears).sort().reverse();
  }, [MAPPINGS, latestYear]);

  const [yearFilter, setYearFilter] = useState<string>(latestYear);
  const [monthFilter, setMonthFilter] = useState<'all' | string>(latestMonth);

  const [detail, setDetail] = useState<Mapping | null>(null);

  const _cycleFilter = monthFilter === 'all' ? `__year:${yearFilter}` : `${yearFilter}-${monthFilter}`;

  const visibleMappings = useMemo(() => {
    return MAPPINGS.filter((m) => {
      const [my, mm] = m.cycle.split('-');
      if (my !== yearFilter) return false;
      if (monthFilter !== 'all' && mm !== monthFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          m.generator.toLowerCase().includes(q) ||
          m.consumer.toLowerCase().includes(q) ||
          m.purchaseInvoice.no.toLowerCase().includes(q) ||
          m.saleInvoice.no.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [MAPPINGS, search, yearFilter, monthFilter]);

  const stats = useMemo(() => {
    const total = MAPPINGS.length;
    const issued = MAPPINGS.filter(
      (m) => m.purchaseInvoice.state === 'issued' && m.saleInvoice.state === 'issued',
    ).length;
    const pending = MAPPINGS.filter(
      (m) => m.purchaseInvoice.state === 'pending' || m.saleInvoice.state === 'pending',
    ).length;
    const eseroCount = MAPPINGS.filter((m) => m.esero).length;
    return { total, issued, pending, matchedAll: issued, eseroCount };
  }, [MAPPINGS]);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: '전력거래', path: '/platform/trading' }, { label: '직접 PPA' }, { label: '세금계산서' }]}
      />

      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">세금계산서</h1>
          <p className="mt-1 text-sm text-slate-400">
            매입·매출 1:1:1 매핑 자동 발행 · 국세청 e세로 연동 · 수정세금계산서 관리
          </p>
        </div>
        <div className="rounded-lg border border-violet-500/[0.20] bg-violet-500/[0.04] px-3 py-2 text-xs flex items-center gap-2">
          <Hash size={12} className="text-violet-300" />
          <span className="text-violet-200">e세로 자동 연동</span>
          <span className="text-emerald-300 font-semibold tabular-nums">
            {stats.eseroCount}/{stats.total}건
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="당월 매입"
          value={`${MAPPINGS.filter((m) => m.cycle === latestCycle).length}장`}
          sub="발전사 → SPC"
          icon={Factory}
          tone="amber"
        />
        <KpiCard
          label="당월 매출"
          value={`${MAPPINGS.filter((m) => m.cycle === latestCycle).length}장`}
          sub="SPC → 수용가"
          icon={Building2}
          tone="blue"
        />
        <KpiCard
          label="1:1:1 매핑 검증"
          value={`${stats.matchedAll}/${stats.total}`}
          sub="이중 발행 방지"
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiCard
          label="발행 대기"
          value={`${stats.pending}건`}
          sub="정산 확정 후 자동 발행"
          icon={AlertCircle}
          tone={stats.pending > 0 ? 'amber' : 'slate'}
        />
      </div>

      <div className="flex gap-1 border-b border-white/[0.06]">
        {[
          { v: 'issued' as Tab, l: '발행 현황', icon: Receipt, cnt: stats.total },
          { v: 'mapping' as Tab, l: '매입·매출 매핑 검증', icon: ArrowRightLeft, cnt: stats.matchedAll },
          { v: 'amended' as Tab, l: '수정세금계산서', icon: RefreshCcw, cnt: AMENDMENTS.length },
        ].map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 -mb-px text-sm border-b-2 transition-colors whitespace-nowrap',
              tab === t.v
                ? 'border-primary text-white font-semibold'
                : 'border-transparent text-slate-500 hover:text-white',
            )}
          >
            <t.icon size={14} />
            {t.l}
            <span className={cn('text-[10px] tabular-nums', tab === t.v ? 'text-primary' : 'text-slate-600')}>
              ({t.cnt})
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          {/* 연도 dropdown */}
          <Dropdown
            align="left"
            trigger={
              <button className="flex items-center gap-1.5 h-8 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs text-white hover:bg-white/[0.08] tabular-nums">
                <span>{yearFilter}년</span>
                <ChevronDown size={11} className="text-slate-500" />
              </button>
            }
          >
            {availableYears.map((y) => (
              <DropdownItem key={y} onClick={() => setYearFilter(y)}>
                <span className="tabular-nums">{y}년</span>
              </DropdownItem>
            ))}
          </Dropdown>

          {/* 월 dropdown */}
          <Dropdown
            align="left"
            trigger={
              <button className="flex items-center gap-1.5 h-8 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs text-white hover:bg-white/[0.08] tabular-nums">
                <span>{monthFilter === 'all' ? '전체' : `${Number(monthFilter)}월`}</span>
                <ChevronDown size={11} className="text-slate-500" />
              </button>
            }
          >
            <DropdownItem onClick={() => setMonthFilter('all')}>전체</DropdownItem>
            <div className="my-1 border-t border-white/[0.06]" />
            {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
              <DropdownItem key={m} onClick={() => setMonthFilter(m)}>
                <span className="tabular-nums">{Number(m)}월</span>
              </DropdownItem>
            ))}
          </Dropdown>
        </div>
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            type="text"
            placeholder="발전사·수용가·계산서 번호"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dropdown
          align="right"
          trigger={
            <button className="ml-auto flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] px-3.5 text-xs text-emerald-200 hover:bg-emerald-500/[0.12]">
              <Download size={11} />
              추출
              <ChevronDown size={11} />
            </button>
          }
        >
          <DropdownItem
            onClick={() => {
              const invoices = visibleMappings.flatMap(mappingToInvoices);
              exportTaxInvoiceCsv(`세금계산서-${new Date().toISOString().slice(0, 10)}`, invoices);
            }}
          >
            <FileText size={12} className="mr-2 inline" />
            CSV (세금계산서 양식)
          </DropdownItem>
          <DropdownItem
            onClick={() => {
              const invoices = visibleMappings.flatMap(mappingToInvoices);
              exportTaxInvoiceExcel(`세금계산서-${new Date().toISOString().slice(0, 10)}`, invoices);
            }}
          >
            <FileSpreadsheet size={12} className="mr-2 inline" />
            Excel (부가세 신고용)
          </DropdownItem>
          <DropdownItem
            onClick={() => {
              const invoices = visibleMappings.flatMap(mappingToInvoices);
              exportTaxInvoicePdf(`세금계산서_감사용-${new Date().toISOString().slice(0, 10)}`, invoices);
            }}
          >
            <FileText size={12} className="mr-2 inline" />
            PDF (감사용)
          </DropdownItem>
        </Dropdown>
      </div>

      {tab === 'issued' &&
        (visibleMappings.length === 0 ? (
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] flex flex-col items-center justify-center py-20 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] mb-4">
              <Receipt size={22} className="text-slate-500" />
            </span>
            <p className="text-sm font-medium text-slate-300">발행된 세금계산서가 없습니다</p>
            <p className="mt-1.5 text-xs text-slate-500 max-w-sm">
              정산이 확정되면 매입·매출 세금계산서가 자동 발행됩니다
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left">
                  <tr className="text-[11px] text-slate-500 bg-white/[0.02] border-b border-white/[0.06]">
                    <th className="text-left font-medium px-4 py-3">정산 사이클</th>
                    <th className="text-left font-medium px-3 py-3">발전사 (매입)</th>
                    <th className="text-left font-medium px-3 py-3">수용가 (매출)</th>
                    <th className="font-medium px-3 py-3">금액</th>
                    <th className="font-medium px-3 py-3">매입 계산서</th>
                    <th className="font-medium px-3 py-3">매출 계산서</th>
                    <th className="font-medium px-3 py-3">e세로</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {visibleMappings.map((m) => {
                    const purState = STATE_META[m.purchaseInvoice.state];
                    const salState = STATE_META[m.saleInvoice.state];
                    return (
                      <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-white tabular-nums">{m.cycle}</p>
                          <Link
                            href="/platform/ppa/billing/settlement"
                            className="text-[10px] text-primary hover:text-primary/80 font-mono"
                          >
                            {m.settlementId}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-slate-300">{m.generator}</td>
                        <td className="px-3 py-3 text-slate-300">{m.consumer}</td>
                        <td className="px-3 py-3 tabular-nums text-white font-semibold">{fmtKrw(m.amount)}</td>
                        <td className="px-3 py-3">
                          <div className="space-y-0.5">
                            <p className="font-mono text-[10px] tabular-nums text-slate-300">{m.purchaseInvoice.no}</p>
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ring-1',
                                purState.bg,
                                purState.tone,
                                purState.ring,
                              )}
                            >
                              {purState.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-0.5">
                            <p className="font-mono text-[10px] tabular-nums text-slate-300">{m.saleInvoice.no}</p>
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ring-1',
                                salState.bg,
                                salState.tone,
                                salState.ring,
                              )}
                            >
                              {salState.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {m.esero ? (
                            <CheckCircle2 size={14} className="text-emerald-400 inline" />
                          ) : (
                            <AlertCircle size={14} className="text-amber-400 inline" />
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => setDetail(m)}
                            className="rounded p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-white"
                            title="상세"
                          >
                            <Eye size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

      {tab === 'mapping' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-emerald-500/[0.20] bg-emerald-500/[0.04] p-3 text-xs">
            <div className="flex items-start gap-2">
              <Lock size={13} className="text-emerald-300 mt-0.5" />
              <div>
                <p className="text-emerald-200 font-medium">1 정산건 = 매입 1장 + 매출 1장 매핑 보장</p>
                <p className="text-emerald-300/70 mt-0.5">
                  이중 발행 방지를 위해 정산 확정 시 매입·매출이 동시에 발행됩니다. 시차 0초.
                </p>
              </div>
            </div>
          </div>
          {visibleMappings.filter((m) => m.purchaseInvoice.state === 'issued' && m.saleInvoice.state === 'issued')
            .length === 0 ? (
            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] flex flex-col items-center justify-center py-20 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] mb-4">
                <ArrowRightLeft size={22} className="text-slate-500" />
              </span>
              <p className="text-sm font-medium text-slate-300">매핑 검증 대상이 없습니다</p>
              <p className="mt-1.5 text-xs text-slate-500 max-w-sm">
                매입·매출 세금계산서가 모두 발행 완료되면 매핑 검증 결과가 표시됩니다
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleMappings
                .filter((m) => m.purchaseInvoice.state === 'issued' && m.saleInvoice.state === 'issued')
                .map((m) => (
                  <div key={m.id} className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white tabular-nums">{m.cycle}</p>
                        <span className="text-[10px] text-slate-500 font-mono">{m.settlementId}</span>
                        <CheckCircle2 size={12} className="text-emerald-400" />
                        <span className="text-[10px] text-emerald-300">매핑 검증 통과</span>
                      </div>
                      <span className="text-base font-bold text-white tabular-nums">{fmtKrw(m.amount)}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div className="rounded-lg ring-1 ring-amber-500/30 bg-amber-500/[0.04] p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Factory size={13} className="text-amber-300" />
                          <span className="text-[11px] text-amber-300 font-medium">매입 (발전사 → SPC)</span>
                        </div>
                        <p className="text-sm text-white">{m.generator}</p>
                        <p className="font-mono text-[11px] tabular-nums text-slate-400 mt-1">{m.purchaseInvoice.no}</p>
                        <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">{m.purchaseInvoice.issuedAt}</p>
                      </div>
                      <ArrowRightLeft size={20} className="text-emerald-400 mx-auto" />
                      <div className="rounded-lg ring-1 ring-blue-500/30 bg-blue-500/[0.04] p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 size={13} className="text-blue-300" />
                          <span className="text-[11px] text-blue-300 font-medium">매출 (SPC → 수용가)</span>
                        </div>
                        <p className="text-sm text-white">{m.consumer}</p>
                        <p className="font-mono text-[11px] tabular-nums text-slate-400 mt-1">{m.saleInvoice.no}</p>
                        <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">{m.saleInvoice.issuedAt}</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {tab === 'amended' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-violet-500/[0.20] bg-violet-500/[0.04] p-3 text-xs">
            <div className="flex items-start gap-2">
              <RefreshCcw size={13} className="text-violet-300 mt-0.5" />
              <div>
                <p className="text-violet-200 font-medium">매입·매출 동시 수정 (시차 0)</p>
                <p className="text-violet-300/70 mt-0.5">발행 이력·사유 기록 · 부가세 신고 기간 내 이중 검증</p>
              </div>
            </div>
          </div>
          {AMENDMENTS.length === 0 ? (
            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] flex flex-col items-center justify-center py-20 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] mb-4">
                <RefreshCcw size={22} className="text-slate-500" />
              </span>
              <p className="text-sm font-medium text-slate-300">수정세금계산서 이력이 없습니다</p>
              <p className="mt-1.5 text-xs text-slate-500 max-w-sm">세금계산서 수정 발행 시 이력이 표시됩니다</p>
            </div>
          ) : (
            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left">
                    <tr className="text-[11px] text-slate-500 bg-white/[0.02] border-b border-white/[0.06]">
                      <th className="text-left font-medium px-4 py-3">사이클</th>
                      <th className="text-left font-medium px-3 py-3">유형</th>
                      <th className="text-left font-medium px-3 py-3">원본 → 수정</th>
                      <th className="text-left font-medium px-3 py-3">대상</th>
                      <th className="text-left font-medium px-3 py-3">사유</th>
                      <th className="font-medium px-3 py-3">변경 금액</th>
                      <th className="font-medium px-3 py-3">수정일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {AMENDMENTS.map((a) => (
                      <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-white tabular-nums">{a.cycle}</td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ring-1',
                              a.type === 'sale'
                                ? 'bg-blue-500/[0.10] text-blue-300 ring-blue-500/30'
                                : 'bg-amber-500/[0.10] text-amber-300 ring-amber-500/30',
                            )}
                          >
                            {a.type === 'sale' ? '매출' : '매입'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-mono text-[11px] text-slate-400 tabular-nums">{a.originalNo}</p>
                          <p className="font-mono text-[11px] text-violet-300 tabular-nums">↓ {a.amendedNo}</p>
                        </td>
                        <td className="px-3 py-3 text-slate-300">{a.consumer}</td>
                        <td className="px-3 py-3 text-xs text-slate-400">
                          <span className="text-violet-300">{AMENDMENT_REASONS[a.reasonCode].code}.</span>{' '}
                          {AMENDMENT_REASONS[a.reasonCode].label}
                          {a.reasonDetail && <p className="text-slate-500 mt-0.5">{a.reasonDetail}</p>}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          <span className={a.delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                            {a.delta >= 0 ? '+' : ''}
                            {fmtKrw(a.delta)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-slate-500 tabular-nums">{a.amendedAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {detail && (
        <Modal
          open={!!detail}
          onClose={() => setDetail(null)}
          size="lg"
          title={`${detail.cycle} · 세금계산서 매핑`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDetail(null)}>
                닫기
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const invoices = mappingToInvoices(detail);
                  exportTaxInvoicePdf(`세금계산서-${detail.cycle}-${detail.settlementId}`, invoices);
                }}
              >
                <Download size={12} className="mr-1.5" />
                PDF 다운로드
              </Button>
              <Button variant="secondary" onClick={() => window.open('https://www.esero.go.kr', '_blank')}>
                <ExternalLink size={12} className="mr-1.5" />
                e세로 확인
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-xs text-slate-500 mb-1">정산건</p>
              <p className="font-mono text-sm tabular-nums text-white">{detail.settlementId}</p>
              <p className="text-base font-bold text-white tabular-nums mt-2">{fmtKrw(detail.amount)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg ring-1 ring-amber-500/30 bg-amber-500/[0.04] p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Factory size={13} className="text-amber-300" />
                  <span className="text-[11px] text-amber-300 font-medium">매입</span>
                </div>
                <p className="text-sm text-white">{detail.generator}</p>
                <p className="font-mono text-[11px] tabular-nums text-slate-400 mt-1">{detail.purchaseInvoice.no}</p>
              </div>
              <div className="rounded-lg ring-1 ring-blue-500/30 bg-blue-500/[0.04] p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 size={13} className="text-blue-300" />
                  <span className="text-[11px] text-blue-300 font-medium">매출</span>
                </div>
                <p className="text-sm text-white">{detail.consumer}</p>
                <p className="font-mono text-[11px] tabular-nums text-slate-400 mt-1">{detail.saleInvoice.no}</p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: any;
  tone: 'emerald' | 'amber' | 'rose' | 'blue' | 'violet' | 'slate';
}) {
  const map = {
    emerald: 'text-emerald-300 bg-emerald-500/[0.10]',
    amber: 'text-amber-300 bg-amber-500/[0.10]',
    rose: 'text-rose-300 bg-rose-500/[0.10]',
    blue: 'text-blue-300 bg-blue-500/[0.10]',
    violet: 'text-violet-300 bg-violet-500/[0.10]',
    slate: 'text-slate-300 bg-slate-500/[0.10]',
  };
  return (
    <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-4 flex items-center gap-3">
      <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', map[tone])}>
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold text-white tabular-nums truncate">{value}</p>
        {sub && <p className="text-[10px] text-slate-500 truncate">{sub}</p>}
      </div>
    </div>
  );
}
