// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  FileText,
  Search,
  Download,
  Clock,
  AlertCircle,
  Wallet,
  Receipt as ReceiptIcon,
  CreditCard,
  ChevronDown,
} from 'lucide-react';
import { SectionCard } from '@/components/features';
import { InvoiceStatusPill, InvoiceDetailPanel, type InvoiceStatus } from '@/components/features/billing';
import { MiniStat } from '@/components/features/billing';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { useToastStore } from '@/stores/useToastStore';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { RmsBarChart } from '@/components/ui/Chart';
import { cn, exportTaxInvoicePdf, generateTaxInvoiceHtml, type TaxInvoiceExportData } from '@/lib/utils';
import { buildMonthlyChart } from '@/lib/billing/buildMonthlyChart';
import { usePpaSettlements } from '@/hooks/ppa/usePpa';
import { useAllLeaseInvoices } from '@/hooks/lease/useLease';
import type { PpaSettlement } from '@/types/ppa';
import type { LeaseInvoice as LeaseInvoiceType } from '@/types/lease';
import { useAuthStore } from '@/stores/useAuthStore';
import { getPersona } from '@/lib/persona';

/* ───────────────────────── Types & Fallback ───────────────────────── */

type PaymentStatus = 'pending' | 'completed' | 'none';

const GENERATOR_STATUS_LABELS: Record<InvoiceStatus, string> = {
  issued: '발급완료',
  unissued: '미발급',
  paid: '입금완료',
};

interface PartyInfo {
  name: string;
  bizNo: string;
  representative: string;
  address: string;
  bizType: string;
  bizCategory: string;
}

interface Invoice {
  id: string;
  number: string;
  issueMonth: string;
  buyer: string;
  buyerBizId: string;
  plantName: string;
  plant: string;
  issueDate: string | null;
  type: string;
  status: InvoiceStatus;
  supply: number;
  unitPrice: number;
  supplyAmount: number;
  vat: number;
  total: number;
  paymentDate: string | null;
  paymentScheduled: boolean;
  paymentStatus: PaymentStatus;
  virtualAccount?: string;
  issuePeriodStart: string;
  issuePeriodEnd: string;
  supplierParty?: PartyInfo;
  buyerParty?: PartyInfo;
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

interface Plant {
  id: string;
  label: string;
}

// PPA 유형 뱃지 — SPC 정산과 동일 색 체계
const KIND_META: Record<string, { label: string; cls: string }> = {
  offsite: { label: 'Offsite PPA', cls: 'bg-blue-500/[0.10] text-blue-300 ring-blue-500/30' },
  onsite: { label: 'Onsite PPA', cls: 'bg-emerald-500/[0.10] text-emerald-300 ring-emerald-500/30' },
  lease: { label: '직접 PPA', cls: 'bg-violet-500/[0.10] text-violet-300 ring-violet-500/30' },
};

/** PPA 정산 → 통합 Invoice 변환 */
function settlementToInvoice(s: PpaSettlement): Invoice {
  const periodParts = s.period.split('-');
  const issueMonth = `${periodParts[0]}.${periodParts[1]}`;
  const lastDay = new Date(Number(periodParts[0]), Number(periodParts[1]), 0).getDate();
  const status: InvoiceStatus = s.status === 'CONFIRMED' ? 'paid' : 'unissued';
  return {
    id: `ppa-${s.id}`,
    number: `PPA-${s.period}-${s.plantName}`,
    issueMonth,
    buyer: s.plantName,
    buyerBizId: '',
    plantName: s.plantName,
    plant: s.plantName,
    issueDate: null,
    type: '전자',
    kind: s.ppaKind ?? 'offsite',
    status,
    supply: Math.round(s.generationKwh / 100) / 10,
    unitPrice: s.smpUnitPrice,
    supplyAmount: s.supplyAmount,
    vat: s.vat,
    total: s.total,
    paymentDate: null,
    paymentScheduled: false,
    paymentStatus: (status === 'paid' ? 'completed' : 'none') as PaymentStatus,
    issuePeriodStart: `${s.period}-01`,
    issuePeriodEnd: `${s.period}-${lastDay}`,
    breakdown: {
      ppaRevenue: s.supplyAmount,
      surcharge: s.adjustAmount ?? 0,
      network: s.networkFee ?? 0,
      tradeFee: s.tradeFee ?? 0,
      supplyFee: s.supplyFee ?? 0,
      manageFee: s.manageFee ?? 0,
      fund: s.fundAmount ?? 0,
      adjust: 0,
    },
  };
}

/** Lease 세금계산서 → 통합 Invoice 변환 */
function leaseInvoiceToInvoice(li: LeaseInvoiceType): Invoice {
  const issueMonth = li.period.replace('-', '.');
  const periodParts = li.period.split('-');
  const lastDay = new Date(Number(periodParts[0]), Number(periodParts[1]), 0).getDate();
  const statusMap: Record<string, InvoiceStatus> = { PAID: 'paid', ISSUED: 'issued', UNISSUED: 'unissued' };
  const paymentMap: Record<string, PaymentStatus> = { COMPLETED: 'completed', PENDING: 'pending', NONE: 'none' };
  return {
    id: `lease-${li.id}`,
    number: li.invoiceNumber,
    issueMonth,
    buyer: li.siteName ?? li.equipmentName ?? '',
    buyerBizId: '',
    plantName: li.siteName ?? li.equipmentName ?? '',
    plant: li.siteName ?? li.equipmentName ?? '',
    issueDate: li.issuedAt ? li.issuedAt.split('T')[0] : null,
    type: '전자',
    kind: 'lease',
    status: statusMap[li.invoiceStatus] ?? 'unissued',
    supply: Math.round(li.supplyAmount / 92.6) / 10,
    unitPrice: 92.6,
    supplyAmount: li.supplyAmount,
    vat: li.vat,
    total: li.total,
    paymentDate: li.paidAt ? li.paidAt.split('T')[0] : (li.dueDate ?? null),
    paymentScheduled: li.paymentStatus === 'PENDING',
    paymentStatus: paymentMap[li.paymentStatus] ?? 'none',
    issuePeriodStart: `${li.period}-01`,
    issuePeriodEnd: `${li.period}-${lastDay}`,
    breakdown: {
      ppaRevenue: li.supplyAmount,
      surcharge: 0,
      network: 0,
      tradeFee: 0,
      supplyFee: 0,
      manageFee: li.maintenanceFee ?? 0,
      fund: 0,
      adjust: 0,
    },
    supplierParty:
      li.supplierName || li.supplierName2 || li.lessorName
        ? {
            name: li.supplierName || li.supplierName2 || li.lessorName || '',
            bizNo: li.supplierBizNo ?? '',
            representative: li.supplierRepresentative ?? '',
            address: li.supplierAddress ?? '',
            bizType: li.supplierBizType ?? '',
            bizCategory: li.supplierBizCategory ?? '',
          }
        : undefined,
    buyerParty: li.receiverName
      ? {
          name: li.receiverName,
          bizNo: li.receiverBizNo ?? '',
          representative: li.receiverRepresentative ?? '',
          address: li.receiverAddress ?? '',
          bizType: li.receiverBizType ?? '',
          bizCategory: li.receiverBizCategory ?? '',
        }
      : undefined,
  };
}

/** 통합 Invoice → 표준 세금계산서(별지 제11호) 추출 데이터 */
function invoiceToExport(inv: Invoice): TaxInvoiceExportData {
  const [yy, mm] = inv.issueMonth.split('.');
  const lastDay = inv.issuePeriodEnd?.split('-')[2] ?? '';
  const kindLabel = (KIND_META[inv.kind] ?? KIND_META.offsite).label;
  return {
    invoiceNo: inv.number,
    issueDate: (inv.issueDate ?? `${yy}.${mm}.15`).replace(/-/g, '.'),
    supplier: {
      name: inv.supplierParty?.name ?? '주식회사 알엠에스플랫폼',
      bizNo: inv.supplierParty?.bizNo ?? '101-76-15679',
      representative: inv.supplierParty?.representative ?? '김영광',
      address: inv.supplierParty?.address ?? '울산광역시 남구 산업로 915',
      bizType: inv.supplierParty?.bizType ?? '전기업',
      bizCategory: inv.supplierParty?.bizCategory ?? '전력공급',
    },
    receiver: {
      name: inv.buyerParty?.name ?? inv.buyer,
      bizNo: inv.buyerParty?.bizNo ?? inv.buyerBizId ?? '',
      representative: inv.buyerParty?.representative ?? '',
      address: inv.buyerParty?.address ?? '',
      bizType: inv.buyerParty?.bizType ?? '',
      bizCategory: inv.buyerParty?.bizCategory ?? '',
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
    type: 'sale',
  };
}

function downloadInvoicePdf(inv: Invoice) {
  // 발전사 = 공급하는 자 → 공급자 보관본
  exportTaxInvoicePdf(`세금계산서_${inv.issueMonth}_${inv.plantName}`, [invoiceToExport(inv)], '공급자');
}

/* ───────────────────────── Sub-components ───────────────────────── */

/* ───────────────────────── Page ───────────────────────── */

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

export default function GeneratorTaxInvoicePage() {
  const pathname = usePathname();
  const isDirect = pathname.includes('/direct/');

  // API 호출 — PPA 정산 + Lease 세금계산서
  const { data: apiSettlements } = usePpaSettlements();
  const { data: apiLeaseInvoices } = useAllLeaseInvoices();
  const user = useAuthStore((s) => s.user);
  const persona = getPersona(user);
  const isGeneratorView = persona === 'generator';

  // API 데이터 → 통합 Invoice 변환 (경로에 따라 필터링)
  const allInvoices = useMemo<Invoice[]>(() => {
    const ppaList = (
      Array.isArray(apiSettlements) ? apiSettlements : ((apiSettlements as any)?.content ?? [])
    ) as PpaSettlement[];
    const leaseList = (apiLeaseInvoices ?? []) as LeaseInvoiceType[];
    const fromPpa = ppaList.map(settlementToInvoice);
    const fromLease = leaseList.map(leaseInvoiceToInvoice);
    let merged = [...fromPpa, ...fromLease].sort((a, b) => a.issueMonth.localeCompare(b.issueMonth));
    if (isGeneratorView) {
      merged = merged.map((i) => {
        if (i.kind !== 'lease') {
          const kindLabel = i.kind === 'offsite' ? 'Offsite PPA 계약' : 'Onsite PPA 계약';
          return { ...i, buyer: kindLabel, plantName: kindLabel, plant: kindLabel };
        }
        return i;
      });
    }
    if (isDirect) {
      merged = merged.filter((i) => i.kind !== 'lease');
    } else {
      merged = merged.filter((i) => i.kind === 'lease');
    }
    return merged;
  }, [apiSettlements, apiLeaseInvoices, isGeneratorView, user?.companyName, isDirect]);

  // 발전소 목록 (API 데이터에서 추출)
  const plants = useMemo<Plant[]>(() => {
    const seen = new Map<string, string>();
    allInvoices.forEach((i) => {
      if (!seen.has(i.plantName)) seen.set(i.plantName, `p-${seen.size + 1}`);
    });
    return Array.from(seen.entries()).map(([label, id]) => ({ id, label }));
  }, [allInvoices]);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [monthFilter, setMonthFilter] = useState<string>('전체');
  const [selectedId, setSelectedId] = useState<string>('');
  const [plantId, setPlantId] = useState<'all' | string>('all');

  // 첫 로드 시 첫 번째 항목 자동 선택
  const firstId = allInvoices[0]?.id ?? '';
  if (selectedId === '' && firstId) setSelectedId(firstId);

  const selectedPlant = useMemo(
    () => (plantId === 'all' ? null : (plants.find((p) => p.id === plantId) ?? null)),
    [plantId, plants],
  );

  // Scope 적용된 base 리스트
  const scopedInvoices = useMemo(
    () =>
      allInvoices.filter((i) => {
        if (selectedPlant && i.plant !== selectedPlant.label) return false;
        return true;
      }),
    [selectedPlant, allInvoices],
  );

  // Stats (scope-aware)
  const stats = useMemo(() => {
    const total = scopedInvoices.length;
    const issued = scopedInvoices.filter((i) => i.status === 'issued').length;
    const unissued = scopedInvoices.filter((i) => i.status === 'unissued').length;
    const paid = scopedInvoices.filter((i) => i.status === 'paid').length;
    const pendingPayment = scopedInvoices.filter((i) => i.paymentStatus === 'pending').length;
    const sumTotal = scopedInvoices.reduce((s, i) => s + i.total, 0);
    return { total, issued, unissued, paid, pendingPayment, sumTotal };
  }, [scopedInvoices]);

  const monthOptions = useMemo(
    () => ['전체', ...Array.from(new Set(allInvoices.map((i) => i.issueMonth)))],
    [allInvoices],
  );

  const monthlyChart = useMemo(() => {
    const dataMap = new Map(buildMonthlyChart(scopedInvoices).map((d) => [d.month, d.amount]));
    const year = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, i) => {
      const m = `${year}.${String(i + 1).padStart(2, '0')}`;
      return { month: m, amount: dataMap.get(m) ?? 0 };
    });
  }, [scopedInvoices]);

  const filtered = useMemo(() => {
    return scopedInvoices.filter((i) => {
      if (monthFilter !== '전체' && i.issueMonth !== monthFilter) return false;
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          i.number.toLowerCase().includes(q) ||
          i.buyer.toLowerCase().includes(q) ||
          i.plantName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [scopedInvoices, monthFilter, statusFilter, query]);

  const selected = allInvoices.find((i) => i.id === selectedId) ?? allInvoices[0] ?? null;

  // 동의/이의 제기 팝업 — SPC 정산 통보 건에 대해 발전사가 확인 후 확정
  const [consentTarget, setConsentTarget] = useState<{ inv: Invoice; mode: 'agree' | 'object' } | null>(null);
  const [objectReason, setObjectReason] = useState('');
  const closeConsent = () => {
    setConsentTarget(null);
    setObjectReason('');
  };
  // 발급 전 미리보기 — 동의 대기 건의 세금계산서 draft (PDF 다운로드 없음)
  const [previewTarget, setPreviewTarget] = useState<Invoice | null>(null);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: '전력거래', path: '/generator/trading' },
          { label: isDirect ? '직접 PPA' : '온사이트 PPA' },
          { label: '세금계산서' },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">세금계산서</h1>
          <p className="mt-1 text-sm text-slate-400">월별 매출 세금계산서 발급 · 입금 통합 관리</p>
        </div>

        {/* Scope: 발전소 */}
        <div className="flex flex-wrap gap-2">
          <Dropdown align="left" trigger={<ScopeTrigger label="발전소" value={selectedPlant?.label ?? '전체 합산'} />}>
            <DropdownItem onClick={() => setPlantId('all')}>
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-sm">전체 합산</p>
                  <p className="text-xs text-slate-500">{plants.length}개 발전소</p>
                </div>
              </div>
            </DropdownItem>
            <div className="my-1 border-t border-white/[0.06]" />
            {plants.map((p) => {
              const count = allInvoices.filter((i) => i.plant === p.label).length;
              return (
                <DropdownItem key={p.id} onClick={() => setPlantId(p.id)}>
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="text-sm">{p.label}</p>
                      <p className="text-xs text-slate-500">{count}건</p>
                    </div>
                  </div>
                </DropdownItem>
              );
            })}
          </Dropdown>
        </div>
      </div>

      {/* Main grid: 8 + 4 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* === Left main === */}
        <div className="xl:col-span-8 space-y-6">
          {/* Monthly chart */}
          <SectionCard title="세금계산서 발급 현황" description="월별 발급 합계 (단위: 백만원)" className="!h-auto">
            <RmsBarChart
              data={monthlyChart}
              xKey="month"
              bars={[{ key: 'amount', name: '발급 합계 (백만원)', color: '#10B981' }]}
              height={250}
              className="bg-transparent p-0 !h-auto"
            />
          </SectionCard>

          {/* Table */}
          <SectionCard
            className="!h-auto"
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
                      {s === 'all' ? '전체' : GENERATOR_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
                <Button size="sm" variant="ghost">
                  <Download size={14} />
                </Button>
              </div>
            }
          >
            <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
              <table className="w-full text-sm min-w-[1400px]">
                <thead className="text-left">
                  {/* 그룹 헤더 — SPC 정산과 동일 구조 */}
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
                      className="px-3.5 font-medium whitespace-nowrap text-emerald-300 border-r border-white/[0.04]"
                    >
                      실 지급액
                    </th>
                    <th colSpan={1} className="px-3.5 font-medium whitespace-nowrap">
                      상태
                    </th>
                  </tr>
                  {/* 개별 컬럼 */}
                  <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">발급년월</th>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">유형</th>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">
                      공급받는자
                      <br />
                      <span className="text-[10px] font-normal text-slate-500">발전소</span>
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
                    <th className="px-3 py-2 font-medium whitespace-nowrap border-r border-white/[0.04] text-emerald-300">
                      SPC → 발전사
                      <br />
                      <span className="text-[10px] font-normal text-slate-500">실 수령액</span>
                    </th>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">
                      상태
                      <br />
                      <span className="text-[10px] font-normal text-slate-500">입금일</span>
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
                    const dash = i.estimated ? <span className="text-slate-600">—</span> : null;
                    const fmt = (n: number) => (i.estimated ? dash : `₩${n.toLocaleString()}`);
                    const minus = (n: number) =>
                      i.estimated ? dash : <span className="text-amber-300">−₩{n.toLocaleString()}</span>;
                    return (
                      <tr
                        key={i.id}
                        onClick={() => setSelectedId(i.id)}
                        className={cn(
                          'border-b border-white/[0.04] cursor-pointer transition-colors text-xs',
                          i.id === selectedId ? 'bg-primary/[0.06]' : 'hover:bg-white/[0.02]',
                        )}
                      >
                        {/* 기본 · 계약 */}
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
                          <p className="text-white font-medium">{i.buyer}</p>
                          <p className="text-[11px] text-slate-500">
                            {i.plantName} · {i.number}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 text-slate-300 tabular-nums whitespace-nowrap">
                          {i.estimated ? dash : `${i.supply} MWh`}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300 tabular-nums whitespace-nowrap border-r border-white/[0.04]">
                          ₩{i.unitPrice}
                        </td>
                        {/* 과세 */}
                        <td className="px-3 py-2.5 text-emerald-300 font-semibold tabular-nums whitespace-nowrap">
                          {fmt(bk.ppaRevenue)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300 tabular-nums whitespace-nowrap">
                          {fmt(bk.surcharge)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300 tabular-nums whitespace-nowrap">{fmt(bk.network)}</td>
                        <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">{minus(bk.tradeFee)}</td>
                        <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">{minus(bk.supplyFee)}</td>
                        <td className="px-3 py-2.5 tabular-nums whitespace-nowrap border-r border-white/[0.04]">
                          {minus(bk.manageFee)}
                        </td>
                        {/* 부가세 */}
                        <td className="px-3 py-2.5 text-slate-300 tabular-nums whitespace-nowrap border-r border-white/[0.04]">
                          {fmt(i.vat)}
                        </td>
                        {/* 비과세 */}
                        <td className="px-3 py-2.5 text-slate-500 tabular-nums whitespace-nowrap border-r border-white/[0.04]">
                          {fmt(bk.fund)}
                        </td>
                        {/* 실 지급액 */}
                        <td className="px-3 py-2.5 font-semibold tabular-nums whitespace-nowrap border-r border-white/[0.04]">
                          {i.estimated ? (
                            <span className="text-slate-600 font-normal">정산 확정 시</span>
                          ) : (
                            <span className="text-emerald-300">₩{i.total.toLocaleString()}</span>
                          )}
                        </td>
                        {/* 처리 — 상태 + 입금일 + 액션 */}
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
                              <InvoiceStatusPill status={i.status} labelOverride={GENERATOR_STATUS_LABELS[i.status]} />
                            )}
                            <span className="text-[11px] text-slate-500 tabular-nums">
                              {i.paymentDate ? (
                                <>
                                  {i.paymentDate}
                                  {i.paymentScheduled && <span className="text-slate-600 ml-1">(예정)</span>}
                                </>
                              ) : (
                                '입금일 미정'
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
          {/* Stats card */}
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
                label="총 발급 합계"
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
                label="입금 대기"
                value={`${stats.pendingPayment}건`}
              />
            </div>
          </div>

          {/* Detail panel for selected invoice */}
          {selected && (
            <InvoiceDetailPanel
              issueMonth={selected.issueMonth}
              headerSuffix={selected.estimated ? '(예상 — SPC 정산 확정 시 값 반영)' : '(매출)'}
              issuePeriodStart={selected.issuePeriodStart}
              issuePeriodEnd={selected.issuePeriodEnd}
              status={selected.status}
              statusLabelOverride={GENERATOR_STATUS_LABELS[selected.status]}
              number={selected.number}
              issueDate={selected.issueDate ?? '—'}
              type={selected.type}
              counterparty={{
                label: '공급자',
                name: selected.supplierParty?.name ?? selected.plantName,
                bizId: selected.supplierParty?.bizNo ?? '',
                representative: selected.supplierParty?.representative,
                address: selected.supplierParty?.address,
                bizType: selected.supplierParty?.bizType,
                bizCategory: selected.supplierParty?.bizCategory,
              }}
              receiver={{
                label: '공급받는자',
                name: selected.buyerParty?.name ?? selected.buyer,
                bizId: selected.buyerParty?.bizNo ?? selected.buyerBizId,
                representative: selected.buyerParty?.representative,
                address: selected.buyerParty?.address,
                bizType: selected.buyerParty?.bizType,
                bizCategory: selected.buyerParty?.bizCategory,
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
                const minus = (n: number) => (selected.estimated ? dash : `−₩${n.toLocaleString()}`);
                return [
                  { label: '공급량', value: selected.estimated ? dash : `${selected.supply.toLocaleString()} MWh` },
                  { label: '단가', value: `₩${selected.unitPrice}/kWh` },
                  // 과세 — SPC 정산 분해
                  { label: '전력량 대금', value: v(bk.ppaRevenue), valueClass: 'text-emerald-300 font-semibold' },
                  { label: '부가정산금', value: v(bk.surcharge) },
                  { label: '망이용요금', value: v(bk.network) },
                  { label: '거래수수료 (거래소, 차감)', value: minus(bk.tradeFee), valueClass: 'text-amber-300' },
                  { label: '거래수수료 (공급, 차감)', value: minus(bk.supplyFee), valueClass: 'text-amber-300' },
                  { label: '관리 수수료 (차감)', value: minus(bk.manageFee), valueClass: 'text-amber-300' },
                  // 비과세
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
                sectionTitle: '입금',
                dateLabel: '입금일',
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
                accountLabel: '입금계좌',
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
                  /* 그 외: 미리보기 ↔ 정산서 다운로드 좌우 */
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

      {/* ─────────── 미리보기 — SPC 정산 분해 양식 (어떤 상태에서도 동일 형식) ─────────── */}
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
          // 헤더 안내 톤
          const headerNote = isEstimated
            ? {
                tone: 'bg-teal-500/[0.06] ring-teal-400/30 text-teal-200',
                text: '정산 대기 (예상치) — SPC 정산 확정 시 값이 채워집니다',
              }
            : isDraft
              ? {
                  tone: 'bg-amber-500/[0.06] ring-amber-500/30 text-amber-200',
                  text: '정산서 (발행 전) — 양측(발전사·수용가) 동의 확정 시 이 내용으로 전자세금계산서가 발행됩니다',
                }
              : {
                  tone: 'bg-emerald-500/[0.06] ring-emerald-500/30 text-emerald-200',
                  text: '발급 완료된 세금계산서 — PDF 다운로드 가능',
                };

          const showFormPreview = !isDraft && !isEstimated;

          return (
            <Modal
              open={!!previewTarget}
              onClose={() => setPreviewTarget(null)}
              title={`${isDraft ? '정산서' : '세금계산서'} 미리보기 — ${inv.issueMonth} ${kindMeta.label}`}
              size={showFormPreview ? 'xl' : 'lg'}
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
              {showFormPreview ? (
                /* 발급 완료 건: 별지 제11호 양식 HTML 미리보기 */
                <iframe
                  srcDoc={generateTaxInvoiceHtml(invoiceToExport(inv), '공급자')}
                  title="세금계산서 미리보기"
                  className="w-full rounded"
                  style={{ height: '70vh', border: 'none', background: '#fff' }}
                />
              ) : (
                /* draft / estimated: 기존 정산 분해 내용 */
                <div className="space-y-4">
                  <div className={cn('rounded-lg ring-1 px-4 py-3', headerNote.tone)}>
                    <p className="text-xs">{headerNote.text}</p>
                  </div>

                  {/* 발급 정보 */}
                  <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-slate-500">정산 기간</span>
                      <span className="text-sm text-white tabular-nums">
                        {inv.issuePeriodStart} ~ {inv.issuePeriodEnd}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-slate-500">문서 번호</span>
                      <span className="text-sm text-slate-300 tabular-nums">{inv.number}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-slate-500">공급자</span>
                      <span className="text-sm text-white">주식회사 알엠에스플랫폼 · {inv.plantName}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-slate-500">공급받는자</span>
                      <span className="text-sm text-white">
                        {inv.buyer} · {inv.buyerBizId}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-slate-500">공급량 · 단가</span>
                      <span className="text-sm text-slate-300 tabular-nums">
                        {inv.supply.toLocaleString()} MWh · ₩{inv.unitPrice}/kWh
                      </span>
                    </div>
                  </div>

                  {/* 정산 분해 — SPC 정산 패널과 동일 양식 */}
                  <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] px-4 py-3">
                    <p className="text-xs font-semibold text-slate-300 mb-2">정산 분해 (발전사 수령 기준)</p>

                    <p className="text-[10px] uppercase tracking-wide text-slate-500 mt-1 mb-1">과세</p>
                    <div className="space-y-0.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">전력량 대금 (매출)</span>
                        <span className="text-emerald-300 font-semibold tabular-nums">
                          ₩{bk.ppaRevenue.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">부가정산금</span>
                        <span className="text-slate-300 tabular-nums">₩{bk.surcharge.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">망이용요금</span>
                        <span className="text-slate-300 tabular-nums">₩{bk.network.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">거래수수료 (거래소, 차감)</span>
                        <span className="text-amber-300 tabular-nums">−₩{bk.tradeFee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">거래수수료 (공급, 차감)</span>
                        <span className="text-amber-300 tabular-nums">−₩{bk.supplyFee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">관리 수수료 (차감)</span>
                        <span className="text-amber-300 tabular-nums">−₩{bk.manageFee.toLocaleString()}</span>
                      </div>
                    </div>

                    <p className="text-[10px] uppercase tracking-wide text-slate-500 mt-2 mb-1">부가세</p>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">부가세 (+10%)</span>
                      <span className="text-slate-300 tabular-nums">+₩{inv.vat.toLocaleString()}</span>
                    </div>

                    <p className="text-[10px] uppercase tracking-wide text-slate-500 mt-2 mb-1">비과세</p>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">전력산업기반기금</span>
                      <span className="text-slate-500 tabular-nums">₩{bk.fund.toLocaleString()}</span>
                    </div>

                    {bk.adjust !== 0 && (
                      <div className="flex justify-between text-xs mt-2">
                        <span className="text-slate-500">요금 조정 (SPC 반영)</span>
                        <span className={cn('tabular-nums', bk.adjust >= 0 ? 'text-amber-300' : 'text-rose-300')}>
                          {bk.adjust >= 0 ? '+' : ''}₩{bk.adjust.toLocaleString()}
                        </span>
                      </div>
                    )}

                    <div className="my-2 mt-3 rounded-md bg-emerald-500/[0.10] ring-1 ring-emerald-500/30 px-3 py-2 flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-emerald-200">실 지급액 (SPC → 발전사)</span>
                      <span className="text-base font-bold text-emerald-300 tabular-nums">
                        ₩{inv.total.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* 입금 정보 */}
                  <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-slate-500">입금일</span>
                      <span className="text-sm text-white tabular-nums">
                        {inv.paymentDate ?? <span className="text-slate-500">미정</span>}
                        {inv.paymentScheduled && <span className="ml-1 text-[11px] text-slate-500">(예정)</span>}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-slate-500">입금 상태</span>
                      <span
                        className={cn(
                          'text-sm',
                          inv.paymentStatus === 'completed'
                            ? 'text-emerald-300'
                            : inv.paymentStatus === 'pending'
                              ? 'text-amber-300'
                              : 'text-slate-500',
                        )}
                      >
                        {inv.paymentStatus === 'completed' ? '완료' : inv.paymentStatus === 'pending' ? '대기' : '—'}
                      </span>
                    </div>
                    {inv.virtualAccount && (
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-xs text-slate-500">입금 계좌</span>
                        <span className="text-sm text-slate-300 tabular-nums">{inv.virtualAccount}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                        // showcase 모드 — 토스트만 (TODO(API): 정산서 동의 → 양측 동의 완료 시 세금계산서 발행 연결)
                        useToastStore
                          .getState()
                          .add(
                            'success',
                            `${inv.issueMonth} ${kindMeta.label} 정산서에 동의했습니다 — 수용가 동의 완료 시 세금계산서가 발행됩니다`,
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
                        // showcase 모드 — 토스트만 (TODO(API): 이의 제기 + 사유 → SPC 재정산 연결)
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

                {/* 정산 내역 점검 */}
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
                    <span className="text-xs font-semibold text-white">합계 (지급 예정액)</span>
                    <span className="text-base font-bold text-emerald-300 tabular-nums">
                      ₩{inv.total.toLocaleString()}
                    </span>
                  </div>
                </div>

                {mode === 'agree' ? (
                  <div className="rounded-lg bg-emerald-500/[0.06] ring-1 ring-emerald-500/30 px-4 py-3">
                    <p className="text-xs text-emerald-200">
                      양측(발전사·수용가)이 모두 동의하면 세금계산서가 발행되고 입금 일정이 확정됩니다. 동의 후에는
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
                        placeholder="예: 5월 공급량이 자체 계량값(22.1 MWh)과 다릅니다. 재검토 부탁드립니다."
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
