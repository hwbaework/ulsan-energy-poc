// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  _FileText,
  Search,
  Download,
  _Clock,
  AlertCircle,
  Wallet,
  Receipt as ReceiptIcon,
  CreditCard,
  ChevronDown,
  _Sun,
} from 'lucide-react';
import { SectionCard } from '@/components/features';
import {
  InvoiceStatusPill,
  InvoiceDetailPanel,
  INVOICE_STATUS_META,
  type InvoiceStatus,
} from '@/components/features/billing';
import { MiniStat } from '@/components/features/billing';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { RmsBarChart } from '@/components/ui/Chart';
import { cn, exportTaxInvoiceCsv, exportTaxInvoiceExcel, exportTaxInvoicePdf } from '@/lib/utils';
import type { TaxInvoiceExportData } from '@/lib/utils';
import { buildMonthlyChart } from '@/lib/billing/buildMonthlyChart';
import { useAllLeaseInvoices } from '@/hooks/lease/useLease';
import { FileText, FileSpreadsheet, Loader2 } from 'lucide-react';

/* ───────────────────────── Types & Mock ───────────────────────── */

interface LeaseInvoice {
  id: string;
  number: string;
  issueMonth: string;
  lessor: string;
  lessorBizId: string;
  equipmentName: string;
  site: string;
  issueDate: string; // 항상 익월 15일 (status 가 unissued 면 예정일)
  type: string;
  status: InvoiceStatus;
  leaseFee: number;
  maintenanceFee: number;
  supplyAmount: number;
  vat: number;
  total: number;
  paymentDate: string; // 항상 익익월 25일 (paid 가 아니면 예정일)
  paymentScheduled: boolean;
  paymentStatus: 'pending' | 'completed' | 'none';
  virtualAccount?: string;
  issuePeriodStart: string;
  issuePeriodEnd: string;
}

interface Site {
  id: string;
  label: string;
}

const SITES: Site[] = [{ id: 'hanil', label: '한일튜브 본사' }];

// 한일튜브 본사 옥상 직접 PPA 세금계산서 — /lease/billing/settlement, /lease/volume 정합
//   2026-02 ~ 2026-04: 발급 완료 (Feb/Mar 결제 완료, Apr 결제 대기)
//   2026-05: 미발급 (5월 정산 진행 중, 6/15 발급 예정)
//   total = PPA 요금 청구액 (VAT 포함) / supplyAmount = total/1.1 / vat = total - supplyAmount
const INVOICES: LeaseInvoice[] = (() => {
  type InvoiceSeed = {
    issueMonth: string;
    total: number;
    status: InvoiceStatus;
    issued: boolean;
    paid: boolean;
    daysInMonth: number;
  };
  const seeds: InvoiceSeed[] = [
    // Feb: 발급 3/15, 결제 4/25 완료
    { issueMonth: '2026-02', total: 3_005_952, status: 'paid', issued: true, paid: true, daysInMonth: 28 },
    // Mar: 발급 4/15, 결제 5/25 완료 (오늘 5/28 기준)
    { issueMonth: '2026-03', total: 4_904_448, status: 'paid', issued: true, paid: true, daysInMonth: 31 },
    // Apr: 발급 5/15, 결제 6/25 예정 (오늘 5/28 기준 결제 대기)
    { issueMonth: '2026-04', total: 4_746_240, status: 'issued', issued: true, paid: false, daysInMonth: 30 },
    // May: 미발급 — 5월 정산은 6/15 이후 확정. 표시값은 예상치 (settlement 정합 = 4,998,792, 단가 ₩92.6/kWh)
    { issueMonth: '2026-05', total: 4_998_792, status: 'unissued', issued: false, paid: false, daysInMonth: 31 },
  ];
  return seeds.map((s, i): LeaseInvoice => {
    const total = s.total;
    const supplyAmount = Math.round(total / 1.1);
    const vat = total - supplyAmount;
    const leaseFee = supplyAmount; // 한일튜브 — 유지보수비 별도 없음 → supplyAmount 전액 PPA 요금
    const maintenanceFee = 0;
    const [y, m] = s.issueMonth.split('-').map(Number);
    // 발급일 = 익월 15일, 결제일 = 익익월 25일 (항상 채움 — 미발급/미결제는 "예정")
    //   · 2월(완료) → 발급 3/15, 결제 4/25
    //   · 3월(완료) → 발급 4/15, 결제 5/25
    //   · 4월(발급완료/결제 대기) → 발급 5/15 ✓, 결제 6/25 (예정)
    //   · 5월(미발급) → 발급 6/15 (예정), 결제 7/25 (예정)
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? y + 1 : y;
    const payMonth = nextMonth === 12 ? 1 : nextMonth + 1;
    const payYear = nextMonth === 12 ? nextYear + 1 : nextYear;
    const issueDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-15`;
    const paymentDate = `${payYear}-${String(payMonth).padStart(2, '0')}-25`;
    return {
      id: `inv-${s.issueMonth}`,
      number: `TI-2026-${String(i + 1).padStart(3, '0')}`,
      issueMonth: s.issueMonth,
      lessor: '에스에너지',
      lessorBizId: '123-45-67890',
      equipmentName: '본사 옥상 태양광 429.22kW',
      site: '한일튜브 본사',
      issueDate,
      type: '전자세금계산서',
      status: s.status,
      leaseFee,
      maintenanceFee,
      supplyAmount,
      vat,
      total,
      paymentDate,
      paymentScheduled: s.issued && !s.paid,
      paymentStatus: s.paid ? 'completed' : s.issued ? 'pending' : 'none',
      virtualAccount: '우리은행 1005-xxx-xxxxxx',
      issuePeriodStart: `${s.issueMonth}-01`,
      issuePeriodEnd: `${s.issueMonth}-${String(s.daysInMonth).padStart(2, '0')}`,
    };
  });
})();

/* ───────────────────────── Page ───────────────────────── */

const _MONTH_OPTIONS = ['전체', ...Array.from(new Set(INVOICES.map((i) => i.issueMonth)))];

function leaseToTaxInvoice(inv: LeaseInvoice): TaxInvoiceExportData {
  const [yr, mo] = inv.issueMonth.split('-');
  const lastDay = new Date(Number(yr), Number(mo), 0).getDate();
  return {
    invoiceNo: inv.number,
    issueDate: inv.issueDate.replace(/-/g, '.'),
    supplier: {
      name: inv.lessor,
      bizNo: inv.lessorBizId,
      representative: '—',
      address: '—',
      bizType: '서비스업',
      bizCategory: '에너지솔루션',
    },
    receiver: {
      name: '한일튜브(주)',
      bizNo: '610-81-00123',
      representative: '장기원',
      address: '울산광역시 북구 산업로 1033',
      bizType: '제조업',
      bizCategory: '금속관 제조',
    },
    items: [
      {
        month: String(Number(mo)),
        day: String(lastDay),
        description: `PPA 요금 (${inv.equipmentName})`,
        spec: '월',
        quantity: '1',
        unitPrice: `₩${inv.leaseFee.toLocaleString()}`,
        supplyAmount: inv.supplyAmount,
        tax: inv.vat,
        note: `${inv.issuePeriodStart}~${inv.issuePeriodEnd}`,
      },
    ],
    supplyTotal: inv.supplyAmount,
    vatTotal: inv.vat,
    grandTotal: inv.total,
    receiptOrClaim: 'claim',
    type: 'sale',
  };
}

/* "2026-02" → "2026년 2월" — 페이지 전체 통일 */
function formatPeriod(period: string): string {
  if (period === '전체') return '전체';
  const [py, pm] = period.split('-').map(Number);
  if (!py || !pm) return period;
  return `${py}년 ${pm}월`;
}

function ScopeTrigger({ label, value, disabled }: { label: string; value: string; disabled?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm transition-colors min-w-[160px]',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer text-white hover:bg-white/[0.08]',
      )}
    >
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="font-medium truncate flex-1">{value}</span>
      <ChevronDown size={14} className="text-slate-500 shrink-0" />
    </div>
  );
}

export default function LeaseTaxInvoicePage() {
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState<number>(currentYear);
  const { data: apiInvoices, isLoading } = useAllLeaseInvoices({ year: yearFilter });

  const allInvoices: LeaseInvoice[] = useMemo(() => {
    if (apiInvoices && apiInvoices.length > 0) {
      return apiInvoices.map((r: any): LeaseInvoice => {
        const statusMap: Record<string, InvoiceStatus> = { PAID: 'paid', ISSUED: 'issued', UNISSUED: 'unissued' };
        const payStatusMap: Record<string, 'pending' | 'completed' | 'none'> = {
          PENDING: 'pending',
          COMPLETED: 'completed',
        };
        const period = r.period ?? '—';
        const [y, m] = period.split('-').map(Number);
        const nextMonth = m === 12 ? 1 : (m || 0) + 1;
        const nextYear = m === 12 ? (y || 0) + 1 : y || 0;
        const payMonth = nextMonth === 12 ? 1 : nextMonth + 1;
        const payYear = nextMonth === 12 ? nextYear + 1 : nextYear;
        return {
          id: String(r.id),
          number: r.invoiceNumber ?? '—',
          issueMonth: period,
          lessor: r.lessorName ?? '—',
          lessorBizId: r.supplierBizNo ?? '—',
          equipmentName: r.equipmentName ?? '—',
          site: r.siteName ?? '—',
          issueDate: r.issuedAt?.slice(0, 10) ?? `${nextYear}-${String(nextMonth).padStart(2, '0')}-15`,
          type: '전자세금계산서',
          status: statusMap[r.invoiceStatus] ?? 'unissued',
          leaseFee: r.leaseFee ?? 0,
          maintenanceFee: r.maintenanceFee ?? 0,
          supplyAmount: r.supplyAmount ?? 0,
          vat: r.vat ?? 0,
          total: r.total ?? 0,
          paymentDate: r.paidAt?.slice(0, 10) ?? r.dueDate ?? `${payYear}-${String(payMonth).padStart(2, '0')}-25`,
          paymentScheduled: r.invoiceStatus === 'ISSUED' && r.paymentStatus !== 'COMPLETED',
          paymentStatus: payStatusMap[r.paymentStatus] ?? 'none',
          virtualAccount: '우리은행 1005-xxx-xxxxxx',
          issuePeriodStart: `${period}-01`,
          issuePeriodEnd: `${period}-28`,
        };
      });
    }
    return INVOICES;
  }, [apiInvoices]);

  const MONTH_OPTIONS_DYNAMIC = useMemo(
    () => ['전체', ...Array.from(new Set(allInvoices.map((i) => i.issueMonth)))],
    [allInvoices],
  );

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [monthFilter, setMonthFilter] = useState<string>('전체');
  const [selectedId, setSelectedId] = useState<string>('');
  const [siteId, setSiteId] = useState<'all' | string>('all');

  useEffect(() => {
    if (allInvoices.length > 0 && !selectedId) {
      setSelectedId(allInvoices[allInvoices.length - 1].id);
    }
  }, [allInvoices, selectedId]);
  const [scopeLeaseId, setScopeLeaseId] = useState<'all' | string>('all');

  const selectedSite = useMemo(
    () => (siteId === 'all' ? null : (SITES.find((s) => s.id === siteId) ?? null)),
    [siteId],
  );

  const siteLessors = useMemo(() => {
    if (!selectedSite) return [];
    const seen = new Map<string, { id: string; lessor: string; equipmentName: string }>();
    for (const inv of allInvoices) {
      if (inv.site !== selectedSite.label) continue;
      if (!seen.has(inv.lessor)) {
        seen.set(inv.lessor, { id: inv.lessor, lessor: inv.lessor, equipmentName: inv.equipmentName });
      }
    }
    return Array.from(seen.values());
  }, [selectedSite]);

  const selectedScopeLease = useMemo(
    () => (scopeLeaseId === 'all' ? null : (siteLessors.find((l) => l.id === scopeLeaseId) ?? null)),
    [scopeLeaseId, siteLessors],
  );

  const handleSiteChange = (id: 'all' | string) => {
    setSiteId(id);
    setScopeLeaseId('all');
  };

  const scopedInvoices = useMemo(
    () =>
      allInvoices.filter((i) => {
        if (selectedSite && i.site !== selectedSite.label) return false;
        if (scopeLeaseId !== 'all' && i.lessor !== scopeLeaseId) return false;
        return true;
      }),
    [selectedSite, scopeLeaseId],
  );

  const stats = useMemo(() => {
    const total = scopedInvoices.length;
    const issued = scopedInvoices.filter((i) => i.status === 'issued').length;
    const unissued = scopedInvoices.filter((i) => i.status === 'unissued').length;
    const paid = scopedInvoices.filter((i) => i.status === 'paid').length;
    const pendingPayment = scopedInvoices.filter((i) => i.paymentStatus === 'pending').length;
    const sumTotal = scopedInvoices.reduce((s, i) => s + i.total, 0);
    return { total, issued, unissued, paid, pendingPayment, sumTotal };
  }, [scopedInvoices]);

  // x축은 12개월 고정, 데이터 있는 달만 막대 표시 → 막대가 과도하게 두꺼워지지 않음
  const monthlyChart = useMemo(() => {
    const raw = buildMonthlyChart(scopedInvoices);
    const dataMap = new Map(raw.map((d) => [d.month, d.amount]));
    const year = raw[0]?.month.split('-')[0] ?? String(new Date().getFullYear());
    return Array.from({ length: 12 }, (_, i) => {
      const m = `${year}-${String(i + 1).padStart(2, '0')}`;
      return { month: m, amount: dataMap.get(m) ?? 0 };
    });
  }, [scopedInvoices]);

  const filtered = useMemo(() => {
    return (
      scopedInvoices
        .filter((i) => {
          if (monthFilter !== '전체' && i.issueMonth !== monthFilter) return false;
          if (statusFilter !== 'all' && i.status !== statusFilter) return false;
          if (query) {
            const q = query.toLowerCase();
            return (
              i.number.toLowerCase().includes(q) ||
              i.lessor.toLowerCase().includes(q) ||
              i.equipmentName.toLowerCase().includes(q)
            );
          }
          return true;
        })
        // 최신 월이 위로 (대상월 내림차순)
        .sort((a, b) => b.issueMonth.localeCompare(a.issueMonth))
    );
  }, [scopedInvoices, monthFilter, statusFilter, query]);

  const selected = allInvoices.find((i) => i.id === selectedId) ?? allInvoices[allInvoices.length - 1] ?? null;

  if (isLoading && allInvoices.length === 0) {
    return (
      <div className="space-y-6">
        <Breadcrumb
          items={[{ label: '전력거래', path: '/ppa/trading' }, { label: '직접 PPA' }, { label: '세금계산서' }]}
        />
        <h1 className="text-2xl font-bold text-white">세금계산서</h1>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-slate-400">세금계산서 데이터를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: '전력거래', path: '/ppa/trading' }, { label: '직접 PPA' }, { label: '세금계산서' }]}
      />

      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">세금계산서</h1>
          <p className="mt-1 text-sm text-slate-400">
            {selectedSite
              ? `${selectedSite.label} · ${scopedInvoices.length}건`
              : `전사 합산 · ${SITES.length}개 사업장 · ${allInvoices.length}건`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Dropdown align="left" trigger={<ScopeTrigger label="회계년도" value={`${yearFilter}년`} />}>
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <DropdownItem key={y} onClick={() => setYearFilter(y)}>
                <p className="text-sm">{y}년</p>
              </DropdownItem>
            ))}
          </Dropdown>
          <Dropdown align="left" trigger={<ScopeTrigger label="사업장" value={selectedSite?.label ?? '전사 합산'} />}>
            <DropdownItem onClick={() => handleSiteChange('all')}>
              <div>
                <p className="text-sm">전사 합산</p>
                <p className="text-xs text-slate-500">{SITES.length}개 사업장</p>
              </div>
            </DropdownItem>
            <div className="my-1 border-t border-white/[0.06]" />
            {SITES.map((s) => {
              const count = allInvoices.filter((i) => i.site === s.label).length;
              return (
                <DropdownItem key={s.id} onClick={() => handleSiteChange(s.id)}>
                  <div>
                    <p className="text-sm">{s.label}</p>
                    <p className="text-xs text-slate-500">{count}건</p>
                  </div>
                </DropdownItem>
              );
            })}
          </Dropdown>

          {selectedSite ? (
            <Dropdown
              align="left"
              trigger={<ScopeTrigger label="발전사업자" value={selectedScopeLease?.lessor ?? '사업장 내 전체'} />}
            >
              <DropdownItem onClick={() => setScopeLeaseId('all')}>
                <div>
                  <p className="text-sm">사업장 내 전체</p>
                  <p className="text-xs text-slate-500">{siteLessors.length}개 발전사업자 합산</p>
                </div>
              </DropdownItem>
              <div className="my-1 border-t border-white/[0.06]" />
              {siteLessors.map((l) => (
                <DropdownItem key={l.id} onClick={() => setScopeLeaseId(l.id)}>
                  <div>
                    <p className="text-sm">{l.lessor}</p>
                    <p className="text-xs text-slate-500">{l.equipmentName}</p>
                  </div>
                </DropdownItem>
              ))}
            </Dropdown>
          ) : (
            <ScopeTrigger label="발전사업자" value="—" disabled />
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left */}
        <div className="xl:col-span-8 space-y-6">
          <SectionCard
            title="세금계산서 수취 현황"
            description="월별 리스 세금계산서 수취 합계 (단위: 백만원)"
            className="!h-auto"
          >
            <RmsBarChart
              data={monthlyChart}
              xKey="month"
              bars={[{ key: 'amount', name: '수취 합계 (백만원)', color: '#F59E0B' }]}
              height={220}
              className="bg-transparent p-0 !h-auto"
            />
          </SectionCard>

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
                      <span className="font-medium">{formatPeriod(monthFilter)}</span>
                      <ChevronDown size={14} className="text-slate-500" />
                    </button>
                  }
                >
                  {MONTH_OPTIONS_DYNAMIC.map((m) => (
                    <DropdownItem key={m} onClick={() => setMonthFilter(m)}>
                      {formatPeriod(m)}
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
                      {s === 'all' ? '전체' : INVOICE_STATUS_META[s].label}
                    </button>
                  ))}
                </div>
                <Dropdown
                  align="right"
                  trigger={
                    <button className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/[0.12]">
                      <Download size={11} />
                      추출
                      <ChevronDown size={11} />
                    </button>
                  }
                >
                  <DropdownItem
                    onClick={() => {
                      const invoices = filtered.map(leaseToTaxInvoice);
                      exportTaxInvoiceCsv(`세금계산서-${new Date().toISOString().slice(0, 10)}`, invoices);
                    }}
                  >
                    <FileText size={12} className="mr-2 inline" />
                    CSV (세금계산서 양식)
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => {
                      const invoices = filtered.map(leaseToTaxInvoice);
                      exportTaxInvoiceExcel(`세금계산서-${new Date().toISOString().slice(0, 10)}`, invoices);
                    }}
                  >
                    <FileSpreadsheet size={12} className="mr-2 inline" />
                    Excel (부가세 신고용)
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => {
                      const invoices = filtered.map(leaseToTaxInvoice);
                      exportTaxInvoicePdf(`세금계산서_감사용-${new Date().toISOString().slice(0, 10)}`, invoices);
                    }}
                  >
                    <FileText size={12} className="mr-2 inline" />
                    PDF (감사용)
                  </DropdownItem>
                </Dropdown>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px]">
                <thead className="text-left">
                  <tr className="border-b border-white/[0.06] text-xs text-slate-500 bg-white/[0.02]">
                    <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">대상월</th>
                    <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">리스 · 설비</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">공급가액</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">부가세</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap text-rose-300">합계</th>
                    <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">발급일</th>
                    <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">결제일</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => (
                    <tr
                      key={i.id}
                      onClick={() => setSelectedId(i.id)}
                      className={cn(
                        'border-b border-white/[0.04] cursor-pointer transition-colors',
                        i.id === selectedId ? 'bg-primary/[0.06]' : 'hover:bg-white/[0.02]',
                      )}
                    >
                      <td className="px-3 py-3 whitespace-nowrap">
                        <p className="text-slate-200 tabular-nums text-sm">{formatPeriod(i.issueMonth)}</p>
                        <p className="text-[10px] text-slate-600 tabular-nums">{i.number}</p>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <p className="text-white text-sm font-medium">{i.lessor}</p>
                        <p className="text-[11px] text-slate-500">
                          {i.site} · {i.equipmentName}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-slate-300 tabular-nums text-xs">
                        ₩{i.supplyAmount.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-slate-300 tabular-nums text-xs">₩{i.vat.toLocaleString()}</td>
                      <td className="px-3 py-3 text-rose-300 font-bold tabular-nums text-sm">
                        ₩{i.total.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-slate-300 tabular-nums text-xs whitespace-nowrap">
                        {i.issueDate}
                        {i.status === 'unissued' && <span className="ml-1 text-amber-400 text-[10px]">(예정)</span>}
                      </td>
                      <td className="px-3 py-3 text-slate-300 tabular-nums text-xs whitespace-nowrap">
                        {i.paymentDate}
                        {i.paymentStatus !== 'completed' && (
                          <span className="ml-1 text-amber-400 text-[10px]">(예정)</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <InvoiceStatusPill status={i.status} />
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-42 text-sm text-slate-500">
                        조건에 맞는 세금계산서가 없습니다
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        {/* Right sidebar */}
        <div className="xl:col-span-4 space-y-4">
          <div className="rounded-lg border border-white/[0.06] bg-surface-card p-5">
            <p className="text-sm font-semibold text-white mb-4">세금계산서 현황</p>
            <div className="grid grid-cols-2 gap-4">
              <MiniStat
                icon={ReceiptIcon}
                iconBg="bg-amber-500/10"
                iconColor="text-amber-400"
                label="총 발급건수"
                value={`${stats.total}건`}
              />
              <MiniStat
                icon={Wallet}
                iconBg="bg-emerald-500/10"
                iconColor="text-emerald-400"
                label="총 수취 합계"
                value={`${(stats.sumTotal / 1_000_000).toFixed(1)}M`}
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
                label="결제 대기"
                value={`${stats.pendingPayment}건`}
              />
            </div>
          </div>

          {selected && (
            <InvoiceDetailPanel
              issueMonth={selected.issueMonth}
              issuePeriodStart={selected.issuePeriodStart}
              issuePeriodEnd={selected.issuePeriodEnd}
              status={selected.status}
              number={selected.number}
              issueDate={
                <>
                  {selected.issueDate}
                  {selected.status === 'unissued' && <span className="ml-1 text-amber-400 text-[10px]">(예정)</span>}
                </>
              }
              type={selected.type}
              counterparty={{
                label: '공급자 (발전사업자)',
                name: selected.lessor,
                bizId: selected.lessorBizId,
                representative: '최준혁',
                address: '서울특별시 강남구 테헤란로 427',
                bizType: '서비스업',
                bizCategory: '에너지솔루션',
              }}
              receiver={{
                label: '공급받는자',
                name: '한일튜브(주)',
                bizId: '610-81-00123',
                representative: '장기원',
                address: '울산광역시 북구 산업로 1033',
                bizType: '제조업',
                bizCategory: '금속관 제조',
              }}
              assetLabel="설비"
              assetValue={selected.equipmentName}
              amountRows={[
                { label: 'PPA 요금', value: `${selected.leaseFee.toLocaleString()} 원` },
                { label: '유지보수비', value: `${selected.maintenanceFee.toLocaleString()} 원` },
              ]}
              supplyAmount={selected.supplyAmount}
              vat={selected.vat}
              total={selected.total}
              payment={{
                sectionTitle: '결제',
                dateLabel: '결제일',
                date: (
                  <>
                    {selected.paymentDate}
                    {selected.paymentStatus !== 'completed' && (
                      <span className="ml-1 text-amber-400 text-[10px]">(예정)</span>
                    )}
                  </>
                ),
                statusValue:
                  selected.paymentStatus === 'pending' ? '대기' : selected.paymentStatus === 'completed' ? '완료' : '—',
                statusClass:
                  selected.paymentStatus === 'pending'
                    ? 'text-amber-300'
                    : selected.paymentStatus === 'completed'
                      ? 'text-emerald-300'
                      : 'text-slate-500',
                accountLabel: '가상계좌',
                accountValue: selected.virtualAccount,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
