// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import {
  FileText,
  Handshake,
  Receipt,
  Download,
  Sun,
  ChevronDown,
  TrendingUp,
  Zap,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { SectionCard } from '@/components/features';
import { BillingKpiCard } from '@/components/features/billing';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { cn, exportPdf } from '@/lib/utils';
import { useVolumeContracts, useAllMonthlyRecords, useAllLeaseInvoices } from '@/hooks/lease/useLease';
import { useKepcoAvgPrice } from '@/hooks/platform/useBillingRates';

function formatPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return `${y}년 ${m}월`;
}

export default function PpaEvidencePage() {
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState<number>(currentYear);
  const KEPCO_AVG_PRICE = useKepcoAvgPrice();

  const { data: volumeData } = useVolumeContracts();
  const { data: apiRecords } = useAllMonthlyRecords({ year: yearFilter });
  const { data: apiInvoices } = useAllLeaseInvoices({ year: yearFilter });

  const contracts = useMemo(() => {
    const list = volumeData?.content;
    if (!list || list.length === 0) return [];
    return list.map((c: any) => ({
      id: String(c.id),
      label: c.siteName ?? '—',
      lessor: c.generatorCompanyName ?? '—',
      consumer: c.consumerCompanyName ?? '—',
      capacityKw: Number(c.capacityKw) || 0,
      contractYears: c.contractYears ?? 0,
      startDate: c.startDate ?? '',
      status: c.status ?? 'ACTIVE',
    }));
  }, [volumeData]);

  const records = useMemo(() => {
    if (!apiRecords || !Array.isArray(apiRecords)) return [];
    return apiRecords.map((r: any) => ({
      id: String(r.id),
      contractId: String(r.leaseContractId),
      period: r.period ?? '',
      generatedKwh: Number(r.generatedKwh) || 0,
      unitPriceKrw: Number(r.unitPriceKrw) || 0,
      rent: r.rent ?? Math.round((Number(r.generatedKwh) || 0) * (Number(r.unitPriceKrw) || 0)),
      savedAmount: r.savedAmount ?? 0,
      netSavings: r.netSavings ?? 0,
    }));
  }, [apiRecords]);

  const invoices = useMemo(() => {
    if (!apiInvoices || !Array.isArray(apiInvoices)) return [];
    return apiInvoices.map((inv: any) => ({
      id: String(inv.id),
      invoiceNumber: inv.invoiceNumber ?? '',
      period: inv.period ?? '',
      invoiceStatus: inv.invoiceStatus ?? '',
      paymentStatus: inv.paymentStatus ?? '',
      total: inv.total ?? 0,
      siteName: inv.siteName ?? '',
      lessorName: inv.lessorName ?? '',
      issuedAt: inv.issuedAt ?? '',
    }));
  }, [apiInvoices]);

  // KPI 계산 — 실데이터 기반
  const totalGenMwh = records.reduce((s, r) => s + r.generatedKwh, 0) / 1000;
  const totalGridSaving = records.reduce((s, r) => s + Math.round(r.generatedKwh * KEPCO_AVG_PRICE), 0);
  const totalLeaseFee = records.reduce((s, r) => s + r.rent, 0);
  const totalNetSaving = totalGridSaving - Math.round(totalLeaseFee * 1.1);
  const monthCount = new Set(records.map((r) => r.period)).size;

  // 증빙 문서 자동 생성 — 실제 데이터에서 파생
  const evidenceDocs = useMemo(() => {
    const docs: {
      id: string;
      category: 'contract' | 'settlement' | 'invoice' | 'report';
      title: string;
      period: string;
      status: 'complete' | 'pending';
      source: string;
      detail: string;
    }[] = [];

    // 1. 계약서
    contracts.forEach((c) => {
      docs.push({
        id: `contract-${c.id}`,
        category: 'contract',
        title: `직접 PPA 계약서 — ${c.label}`,
        period: c.startDate?.slice(0, 7) ?? '',
        status: c.status === 'ACTIVE' ? 'complete' : 'pending',
        source: '온사이트 PPA 계약',
        detail: `${c.lessor} · ${c.capacityKw}kW · ${c.contractYears}년`,
      });
    });

    // 2. 월별 정산 내역 → 발전량 증빙
    const periodGroups = new Map<string, { totalKwh: number; contractIds: Set<string> }>();
    records.forEach((r) => {
      const existing = periodGroups.get(r.period) ?? { totalKwh: 0, contractIds: new Set() };
      existing.totalKwh += r.generatedKwh;
      existing.contractIds.add(r.contractId);
      periodGroups.set(r.period, existing);
    });

    Array.from(periodGroups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .forEach(([period, data]) => {
        docs.push({
          id: `gen-${period}`,
          category: 'settlement',
          title: `${formatPeriod(period)} 발전량 정산서`,
          period,
          status: 'complete',
          source: '월별 정산',
          detail: `${data.totalKwh.toLocaleString()} kWh · ${data.contractIds.size}개 계약`,
        });
      });

    // 3. 세금계산서
    invoices.forEach((inv) => {
      docs.push({
        id: `inv-${inv.id}`,
        category: 'invoice',
        title: `세금계산서 ${inv.invoiceNumber || inv.period}`,
        period: inv.period,
        status: inv.invoiceStatus === 'ISSUED' ? 'complete' : 'pending',
        source: inv.lessorName || '—',
        detail: `₩${inv.total.toLocaleString()} · ${inv.siteName}`,
      });
    });

    return docs;
  }, [contracts, records, invoices]);

  const completeCount = evidenceDocs.filter((d) => d.status === 'complete').length;
  const pendingCount = evidenceDocs.filter((d) => d.status === 'pending').length;

  const CATEGORY_META = {
    contract: {
      label: '계약서',
      icon: Handshake,
      tone: 'text-violet-300',
      bg: 'bg-violet-500/[0.08]',
      ring: 'ring-violet-500/30',
    },
    settlement: {
      label: '정산서',
      icon: TrendingUp,
      tone: 'text-emerald-300',
      bg: 'bg-emerald-500/[0.08]',
      ring: 'ring-emerald-500/30',
    },
    invoice: {
      label: '세금계산서',
      icon: Receipt,
      tone: 'text-sky-300',
      bg: 'bg-sky-500/[0.08]',
      ring: 'ring-sky-500/30',
    },
    report: {
      label: '보고서',
      icon: FileText,
      tone: 'text-amber-300',
      bg: 'bg-amber-500/[0.08]',
      ring: 'ring-amber-500/30',
    },
  };

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const filtered = categoryFilter === 'all' ? evidenceDocs : evidenceDocs.filter((d) => d.category === categoryFilter);

  if (contracts.length === 0 && records.length === 0) {
    return (
      <div className="space-y-6">
        <Breadcrumb items={[{ label: '전력거래', path: '/ppa/trading' }, { label: '이행 관리' }]} />
        <h1 className="text-2xl font-bold text-white">이행 관리</h1>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <p className="text-slate-400">등록된 PPA 계약이 없습니다.</p>
          <p className="mt-1 text-sm text-slate-500">계약이 체결되면 이행 증빙이 자동으로 생성됩니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '전력거래', path: '/ppa/trading' }, { label: '이행 관리' }]} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">이행 관리</h1>
          <p className="mt-1 text-sm text-slate-400">
            RE100 이행 증빙 · {contracts.length}개 계약 · {yearFilter}년
          </p>
        </div>
        <div className="flex gap-2">
          <Dropdown
            align="right"
            trigger={
              <button className="flex items-center gap-1.5 h-8 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs text-white hover:bg-white/[0.08] tabular-nums">
                {yearFilter}년
                <ChevronDown size={11} className="text-slate-500" />
              </button>
            }
          >
            {[currentYear, currentYear - 1].map((y) => (
              <DropdownItem key={y} onClick={() => setYearFilter(y)}>
                {y}년
              </DropdownItem>
            ))}
          </Dropdown>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              const headers = ['구분', '제목', '기간', '상태', '출처', '상세'];
              const rows = evidenceDocs.map((d) => [
                CATEGORY_META[d.category].label,
                d.title,
                formatPeriod(d.period),
                d.status === 'complete' ? '완료' : '대기',
                d.source,
                d.detail,
              ]);
              exportPdf(`RE100_이행증빙_${yearFilter}`, `RE100 이행 증빙 — ${yearFilter}년`, headers, rows);
            }}
          >
            <Download size={14} className="mr-1.5" />
            PDF 다운로드
          </Button>
        </div>
      </div>

      {/* KPI — 실데이터 기반 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <BillingKpiCard
          label="재생에너지 발전량"
          value={`${totalGenMwh.toFixed(1)} MWh`}
          sub={`${monthCount}개월 누적 · 직접 PPA`}
        />
        <BillingKpiCard
          label="전기요금 절감"
          value={`₩ ${totalGridSaving.toLocaleString()}`}
          valueColor="text-emerald-400"
          sub={`한전 ₩${KEPCO_AVG_PRICE}/kWh 대비`}
        />
        <BillingKpiCard
          label="증빙 문서"
          value={`${completeCount}건 완료`}
          valueColor="text-white"
          sub={pendingCount > 0 ? `${pendingCount}건 대기` : '전건 완료'}
        />
        <BillingKpiCard
          label="순절감 효과"
          value={`₩ ${totalNetSaving.toLocaleString()}`}
          valueColor={totalNetSaving >= 0 ? 'text-emerald-400' : 'text-amber-400'}
          sub="한전절감 - PPA 요금(VAT) 차이"
        />
      </div>

      {/* 계약별 이행 현황 */}
      {contracts.length > 0 && (
        <SectionCard title="계약별 이행 현황">
          <div className="divide-y divide-white/[0.04]">
            {contracts.map((c) => {
              const contractRecords = records.filter((r) => r.contractId === c.id);
              const genKwh = contractRecords.reduce((s, r) => s + r.generatedKwh, 0);
              const months = new Set(contractRecords.map((r) => r.period)).size;
              const contractInvoices = invoices.filter((inv) => inv.siteName === c.label);
              const issuedInvoices = contractInvoices.filter((inv) => inv.invoiceStatus === 'ISSUED').length;

              return (
                <div key={c.id} className="px-5 py-4 flex items-center gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/[0.10] ring-1 ring-amber-500/30">
                    <Sun size={18} className="text-amber-400" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{c.label}</p>
                    <p className="text-xs text-slate-500">
                      {c.lessor} · {c.capacityKw} kW · {c.contractYears}년 계약
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-xs">
                    <div className="text-center">
                      <p className="text-slate-500">발전량</p>
                      <p className="text-white font-bold tabular-nums">{(genKwh / 1000).toFixed(1)} MWh</p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-500">정산</p>
                      <p className="text-white font-bold tabular-nums">{months}개월</p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-500">세금계산서</p>
                      <p className="text-white font-bold tabular-nums">
                        {issuedInvoices}/{contractInvoices.length}건
                      </p>
                    </div>
                    <Badge variant={c.status === 'ACTIVE' ? 'success' : 'warning'}>
                      {c.status === 'ACTIVE' ? '이행중' : c.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* 증빙 문서 목록 */}
      <SectionCard
        title={`증빙 문서 (${filtered.length}건)`}
        actions={
          <div className="flex flex-wrap gap-1.5">
            {['all', 'contract', 'settlement', 'invoice'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs transition-colors ring-1',
                  categoryFilter === cat
                    ? 'bg-primary text-white ring-primary'
                    : 'bg-white/[0.04] text-slate-400 ring-white/[0.06] hover:text-white',
                )}
              >
                {cat === 'all' ? '전체' : CATEGORY_META[cat].label}
              </button>
            ))}
          </div>
        }
      >
        <div className="divide-y divide-white/[0.04]">
          <div className="flex items-center gap-3 px-5 py-2.5 text-[11px] text-slate-500 bg-white/[0.02]">
            <span className="w-10" />
            <span className="flex-1">제목</span>
            <span className="w-24">기간</span>
            <span className="w-20">상태</span>
            <span className="w-48">상세</span>
          </div>

          {filtered.map((d) => {
            const meta = CATEGORY_META[d.category];
            const Icon = meta.icon;
            return (
              <div key={d.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-md ring-1',
                    meta.bg,
                    meta.ring,
                  )}
                >
                  <Icon size={14} className={meta.tone} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{d.title}</p>
                  <p className="text-[11px] text-slate-500">{d.source}</p>
                </div>
                <span className="w-24 text-xs text-slate-400 tabular-nums shrink-0">
                  {d.period ? formatPeriod(d.period) : '—'}
                </span>
                <span className="w-20 shrink-0">
                  {d.status === 'complete' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                      <CheckCircle2 size={12} /> 완료
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-300">
                      <Clock size={12} /> 대기
                    </span>
                  )}
                </span>
                <span className="w-48 text-xs text-slate-500 truncate shrink-0">{d.detail}</span>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-slate-500">증빙 문서가 없습니다</div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
