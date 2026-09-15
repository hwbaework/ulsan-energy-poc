// @ts-nocheck
'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  Download,
  FileText,
  FileSpreadsheet,
  Send,
  Receipt,
  Wallet,
  AlertCircle,
  CreditCard,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { InvoiceStatusPill, INVOICE_STATUS_META, type InvoiceStatus } from '@/components/features/billing';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { cn, exportTaxInvoiceCsv, exportTaxInvoiceExcel, exportTaxInvoicePdf } from '@/lib/utils';
import type { TaxInvoiceExportData } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { useAllLeaseInvoices } from '@/hooks/lease/useLease';

/* ─── Types ─── */

interface TaxInvoice {
  id: string;
  number: string;
  issueMonth: string;
  company: string;
  site: string;
  lessor: string;
  lessorBizId: string;
  equipmentName: string;
  supplyAmount: number;
  vat: number;
  total: number;
  issueDate: string;
  paymentDate: string;
  status: InvoiceStatus;
  paymentStatus: 'pending' | 'completed' | 'none';
  leaseFee: number;
  maintenanceFee: number;
  issuePeriodStart: string;
  issuePeriodEnd: string;
}

/* ─── Helpers ─── */

function fmtKrw(n: number) {
  if (Math.abs(n) >= 100_000_000) return `₩${(n / 100_000_000).toFixed(2)}억`;
  if (Math.abs(n) >= 10_000) return `₩${(n / 10_000).toFixed(0)}만`;
  return `₩${n.toLocaleString()}`;
}

function invoiceToExport(inv: TaxInvoice): TaxInvoiceExportData {
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
      name: inv.company,
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

/* ─── Page ─── */

export default function PlatformLeaseTaxInvoicePage() {
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState<number>(currentYear);
  const { data: apiInvoices } = useAllLeaseInvoices({ year: yearFilter });

  const allInvoices: TaxInvoice[] = useMemo(() => {
    const statusMap: Record<string, InvoiceStatus> = { PAID: 'paid', ISSUED: 'issued', UNISSUED: 'unissued' };
    const payMap: Record<string, 'pending' | 'completed' | 'none'> = { PENDING: 'pending', COMPLETED: 'completed' };
    return ((apiInvoices ?? []) as any[]).map((r: any) => {
      const period = r.period ?? '';
      const [y, m] = period.split('-').map(Number);
      const nextMonth = m === 12 ? 1 : (m || 0) + 1;
      const nextYear = m === 12 ? (y || 0) + 1 : y || 0;
      const payMonth = nextMonth === 12 ? 1 : nextMonth + 1;
      const payYear = nextMonth === 12 ? nextYear + 1 : nextYear;
      const daysInMonth = new Date(y || 0, m || 0, 0).getDate();
      return {
        id: String(r.id),
        number: r.invoiceNumber ?? '—',
        issueMonth: period,
        company: r.receiverName ?? '—',
        site: r.siteName ?? '—',
        lessor: r.lessorName ?? '—',
        lessorBizId: r.supplierBizNo ?? '—',
        equipmentName: r.equipmentName ?? '—',
        supplyAmount: r.supplyAmount ?? 0,
        vat: r.vat ?? 0,
        total: r.total ?? 0,
        issueDate: r.issuedAt ? r.issuedAt.slice(0, 10) : `${nextYear}-${String(nextMonth).padStart(2, '0')}-15`,
        paymentDate: r.paidAt
          ? r.paidAt.slice(0, 10)
          : (r.dueDate ?? `${payYear}-${String(payMonth).padStart(2, '0')}-25`),
        status: statusMap[r.invoiceStatus] ?? 'unissued',
        paymentStatus: payMap[r.paymentStatus] ?? 'none',
        leaseFee: r.leaseFee ?? r.supplyAmount ?? 0,
        maintenanceFee: r.maintenanceFee ?? 0,
        issuePeriodStart: `${period}-01`,
        issuePeriodEnd: `${period}-${String(daysInMonth).padStart(2, '0')}`,
      };
    });
  }, [apiInvoices]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [detail, setDetail] = useState<TaxInvoice | null>(null);

  const availableYears = useMemo(() => {
    const yrs = new Set(allInvoices.map((m) => m.issueMonth.split('-')[0]));
    for (let y = currentYear; y >= currentYear - 4; y--) yrs.add(String(y));
    return Array.from(yrs).sort().reverse();
  }, [allInvoices, currentYear]);

  const [monthFilter, setMonthFilter] = useState<'all' | string>('all');

  const filtered = useMemo(() => {
    return allInvoices
      .filter((r) => {
        const [my, mm] = r.issueMonth.split('-');
        if (my !== String(yearFilter)) return false;
        if (monthFilter !== 'all' && mm !== monthFilter) return false;
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            r.company.toLowerCase().includes(q) ||
            r.lessor.toLowerCase().includes(q) ||
            r.number.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => b.issueMonth.localeCompare(a.issueMonth));
  }, [allInvoices, search, yearFilter, monthFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = allInvoices.length;
    const paid = allInvoices.filter((r) => r.status === 'paid').length;
    const issued = allInvoices.filter((r) => r.status === 'issued').length;
    const unissued = allInvoices.filter((r) => r.status === 'unissued').length;
    const totalAmount = allInvoices.reduce((s, r) => s + r.total, 0);
    return { total, paid, issued, unissued, totalAmount };
  }, [allInvoices]);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: '전력거래', path: '/platform/trading' }, { label: '직접 PPA' }, { label: '세금계산서' }]}
      />

      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">세금계산서</h1>
          <p className="mt-1 text-sm text-slate-400">직접 PPA PPA 요금 세금계산서 발급 · 결제 관리</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            const targets = filtered.filter((r) => r.status === 'unissued');
            if (targets.length === 0) {
              useToastStore.getState().add('info', '발급 대상 미발급 건이 없습니다');
              return;
            }
            if (!window.confirm(`미발급 ${targets.length}건을 일괄 발급하시겠습니까?`)) return;
            useToastStore.getState().add('success', `${targets.length}건 세금계산서 발급 요청 완료`);
          }}
        >
          <Send size={14} className="mr-1.5" />
          일괄 발급
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="총 금액"
          value={fmtKrw(stats.totalAmount)}
          sub={`${stats.total}건`}
          icon={Wallet}
          tone="emerald"
        />
        <KpiCard label="결제 완료" value={`${stats.paid}건`} sub="입금 확인" icon={CheckCircle2} tone="blue" />
        <KpiCard label="발급 완료" value={`${stats.issued}건`} sub="결제 대기" icon={Receipt} tone="amber" />
        <KpiCard
          label="미발급"
          value={`${stats.unissued}건`}
          sub={stats.unissued > 0 ? '발급 필요' : '없음'}
          icon={AlertCircle}
          tone={stats.unissued > 0 ? 'rose' : 'slate'}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
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
              <DropdownItem key={y} onClick={() => setYearFilter(Number(y))}>
                <span className="tabular-nums">{y}년</span>
              </DropdownItem>
            ))}
          </Dropdown>

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

        <div className="flex rounded-lg bg-white/[0.04] p-1 ring-1 ring-white/[0.06]">
          {(['all', 'paid', 'issued', 'unissued'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'rounded px-2.5 h-7 text-xs transition-colors whitespace-nowrap',
                statusFilter === s ? 'bg-primary text-white font-medium' : 'text-slate-400 hover:text-white',
              )}
            >
              {s === 'all' ? '전체' : INVOICE_STATUS_META[s].label}
            </button>
          ))}
        </div>

        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            type="text"
            placeholder="수용가·발전사업자·계산서 번호"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Dropdown
          align="right"
          trigger={
            <button className="ml-auto flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] px-3.5 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/[0.12]">
              <Download size={11} />
              추출
              <ChevronDown size={11} />
            </button>
          }
        >
          <DropdownItem
            onClick={() => {
              const invoices = filtered.map(invoiceToExport);
              exportTaxInvoiceCsv(`세금계산서-${new Date().toISOString().slice(0, 10)}`, invoices);
            }}
          >
            <FileText size={12} className="mr-2 inline" />
            CSV (세금계산서 양식)
          </DropdownItem>
          <DropdownItem
            onClick={() => {
              const invoices = filtered.map(invoiceToExport);
              exportTaxInvoiceExcel(`세금계산서-${new Date().toISOString().slice(0, 10)}`, invoices);
            }}
          >
            <FileSpreadsheet size={12} className="mr-2 inline" />
            Excel (부가세 신고용)
          </DropdownItem>
          <DropdownItem
            onClick={() => {
              const invoices = filtered.map(invoiceToExport);
              exportTaxInvoicePdf(`세금계산서_감사용-${new Date().toISOString().slice(0, 10)}`, invoices);
            }}
          >
            <FileText size={12} className="mr-2 inline" />
            PDF (감사용)
          </DropdownItem>
        </Dropdown>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] flex flex-col items-center justify-center py-20 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] mb-4">
            <Receipt size={22} className="text-slate-500" />
          </span>
          <p className="text-sm font-medium text-slate-300">세금계산서가 없습니다</p>
          <p className="mt-1.5 text-xs text-slate-500 max-w-sm">
            해당 조건에 맞는 세금계산서가 없습니다. 필터를 변경해보세요.
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="text-[11px] text-slate-500 bg-white/[0.02] border-b border-white/[0.06]">
                  <th className="text-left font-medium px-4 py-3">정산월</th>
                  <th className="text-left font-medium px-3 py-3">수용가</th>
                  <th className="text-left font-medium px-3 py-3">발전사업자 · 설비</th>
                  <th className="font-medium px-3 py-3">공급가액</th>
                  <th className="font-medium px-3 py-3">VAT</th>
                  <th className="font-medium px-3 py-3">합계</th>
                  <th className="font-medium px-3 py-3">발급일</th>
                  <th className="font-medium px-3 py-3">결제일</th>
                  <th className="font-medium px-3 py-3">상태</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white tabular-nums">{r.issueMonth}</p>
                      <p className="text-[10px] text-slate-600 font-mono">{r.number}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-300">{r.company}</td>
                    <td className="px-3 py-3">
                      <p className="text-white text-sm">{r.lessor}</p>
                      <p className="text-[10px] text-slate-500">
                        {r.site} · {r.equipmentName}
                      </p>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-slate-300 text-xs">
                      ₩{r.supplyAmount.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-slate-300 text-xs">₩{r.vat.toLocaleString()}</td>
                    <td className="px-3 py-3 tabular-nums text-white font-semibold">{fmtKrw(r.total)}</td>
                    <td className="px-3 py-3 text-xs tabular-nums text-slate-400 whitespace-nowrap">
                      {r.issueDate}
                      {r.status === 'unissued' && <span className="ml-1 text-amber-400 text-[10px]">(예정)</span>}
                    </td>
                    <td className="px-3 py-3 text-xs tabular-nums text-slate-400 whitespace-nowrap">
                      {r.paymentDate}
                      {r.paymentStatus !== 'completed' && (
                        <span className="ml-1 text-amber-400 text-[10px]">(예정)</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <InvoiceStatusPill status={r.status} />
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => setDetail(r)}
                        className="rounded p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-white"
                        title="상세"
                      >
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <Modal
          open={!!detail}
          onClose={() => setDetail(null)}
          size="lg"
          title={`${detail.issueMonth} · 세금계산서 상세`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDetail(null)}>
                닫기
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  exportTaxInvoicePdf(`세금계산서-${detail.issueMonth}-${detail.number}`, [invoiceToExport(detail)]);
                }}
              >
                <Download size={12} className="mr-1.5" />
                PDF 다운로드
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {/* 기본 정보 */}
            <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-slate-500">계산서 번호</p>
                  <p className="font-mono text-sm text-white tabular-nums">{detail.number}</p>
                </div>
                <InvoiceStatusPill status={detail.status} />
              </div>
              <div className="text-2xl font-bold text-white tabular-nums">₩{detail.total.toLocaleString()}</div>
              <p className="text-xs text-slate-500 mt-1">
                {detail.issuePeriodStart} ~ {detail.issuePeriodEnd}
              </p>
            </div>

            {/* 공급자 / 공급받는자 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg ring-1 ring-amber-500/30 bg-amber-500/[0.04] p-3">
                <p className="text-[11px] text-amber-300 font-medium mb-2">공급자 (발전사업자)</p>
                <p className="text-sm text-white font-medium">{detail.lessor}</p>
                <p className="text-[11px] text-slate-500 mt-1">{detail.lessorBizId}</p>
                <p className="text-[11px] text-slate-500">
                  {detail.site} · {detail.equipmentName}
                </p>
              </div>
              <div className="rounded-lg ring-1 ring-blue-500/30 bg-blue-500/[0.04] p-3">
                <p className="text-[11px] text-blue-300 font-medium mb-2">공급받는자</p>
                <p className="text-sm text-white font-medium">{detail.company}</p>
                <p className="text-[11px] text-slate-500 mt-1">610-81-00123</p>
                <p className="text-[11px] text-slate-500">울산광역시 북구 산업로 1033</p>
              </div>
            </div>

            {/* 금액 상세 */}
            <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">PPA 요금</span>
                <span className="text-white tabular-nums">₩{detail.leaseFee.toLocaleString()}</span>
              </div>
              {detail.maintenanceFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">유지보수비</span>
                  <span className="text-white tabular-nums">₩{detail.maintenanceFee.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t border-white/[0.06] pt-2 mt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">공급가액</span>
                  <span className="text-white tabular-nums">₩{detail.supplyAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-slate-400">부가세</span>
                  <span className="text-white tabular-nums">₩{detail.vat.toLocaleString()}</span>
                </div>
              </div>
              <div className="border-t border-white/[0.06] pt-2">
                <div className="flex justify-between">
                  <span className="text-sm font-semibold text-white">합계</span>
                  <span className="text-lg font-bold text-white tabular-nums">₩{detail.total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* 일정 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-[11px] text-slate-500 mb-1">발급일</p>
                <p className="text-sm text-white tabular-nums">
                  {detail.issueDate}
                  {detail.status === 'unissued' && <span className="ml-1 text-amber-400 text-[10px]">(예정)</span>}
                </p>
              </div>
              <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-[11px] text-slate-500 mb-1">결제일</p>
                <p className="text-sm text-white tabular-nums">
                  {detail.paymentDate}
                  {detail.paymentStatus !== 'completed' && (
                    <span className="ml-1 text-amber-400 text-[10px]">(예정)</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── KpiCard ─── */

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
