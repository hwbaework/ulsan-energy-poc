// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import { Search, Zap, Percent, Sun, Factory, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { SectionCard, DataTable } from '@/components/features';
import type { Column } from '@/components/features';
import { cn } from '@/lib/utils';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { usePpaContracts } from '@/hooks/ppa/usePpa';
import { useVolumeContracts } from '@/hooks/lease/useLease';

type ContractStatus = 'active' | 'installing' | 'expiring' | 'terminated';

const STATUS_META: Record<ContractStatus, { label: string; cls: string }> = {
  active: { label: '운영중', cls: 'bg-emerald-500/[0.10] text-emerald-300 ring-emerald-500/30' },
  installing: { label: '설치중', cls: 'bg-teal-500/[0.10] text-teal-200 ring-teal-400/40' },
  expiring: { label: '만료임박', cls: 'bg-amber-500/[0.10] text-amber-300 ring-amber-500/30' },
  terminated: { label: '해지', cls: 'bg-rose-500/[0.10] text-rose-300 ring-rose-500/30' },
};

type Kind = 'offsite' | 'onsite' | 'lease';

const KIND_META: Record<Kind, { label: string; icon: typeof Zap; cls: string }> = {
  offsite: { label: '직접 PPA - Offsite PPA', icon: Zap, cls: 'bg-blue-500/[0.10] text-blue-300 ring-blue-500/30' },
  onsite: {
    label: '직접 PPA - Onsite PPA',
    icon: Percent,
    cls: 'bg-emerald-500/[0.10] text-emerald-300 ring-emerald-500/30',
  },
  lease: { label: '직접 PPA', icon: Sun, cls: 'bg-violet-500/[0.10] text-violet-300 ring-violet-500/30' },
};

interface SpcContract {
  id: string;
  number: string;
  kind: Kind;
  generator: string;
  plantName: string;
  consumer: string;
  site: string;
  capacityKw: number;
  unitPrice: number;
  sharePct?: number;
  monthlyRevenue?: number;
  start: string;
  end: string;
  status: ContractStatus;
}

const daysLeft = (end: string) => Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86400000));

export default function PlatformContractDashboardPage() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all');

  const { data: ppaData } = usePpaContracts({ page: 0, size: 200 });
  const { data: leaseData } = useVolumeContracts({ page: 0, size: 200 });

  const CONTRACTS: SpcContract[] = useMemo(() => {
    const ppaRaw = ((ppaData as any)?.content ?? []) as any[];
    const ppaContracts = ppaRaw.map((c: any) => {
      const statusMap: Record<string, ContractStatus> = {
        ACTIVE: 'active',
        NEW: 'installing', // 서명 대기 — 발효 전
        PENDING: 'installing',
        TERMINATED: 'terminated',
        EXPIRED: 'terminated',
      };
      // 유형 판정 — ppaSubType 우선, SAVINGS_SHARE/FIXED_RENT는 Lease (ContractWorkspace와 동일)
      const sub = String(c.ppaSubType ?? '').toLowerCase();
      const kind: Kind =
        sub === 'lease' ||
        c.contractType === 'SAVINGS_SHARE' ||
        c.contractType === 'FIXED_RENT' ||
        c.contractType === 'LEASE'
          ? 'lease'
          : sub === 'onsite' || c.contractType === 'ONSITE'
            ? 'onsite'
            : 'offsite';
      const expiry30 = c.endDate && daysLeft(c.endDate) < 30 && daysLeft(c.endDate) > 0;
      return {
        id: String(c.id),
        number: c.contractNumber ?? '—',
        kind,
        generator: c.generatorCompanyName ?? '—',
        plantName: c.plantName ?? '—',
        consumer: c.consumerCompanyName ?? '—',
        site: c.consumerSiteName ?? c.siteName ?? '—',
        capacityKw: c.totalCapacityKw ?? 0,
        unitPrice: c.unitPriceKrw ?? 0,
        start: c.startDate ?? '—',
        end: c.endDate ?? '—',
        status: expiry30 ? 'expiring' : (statusMap[c.status] ?? 'active'),
      };
    });

    const leaseRaw = ((leaseData as any)?.content ?? (Array.isArray(leaseData) ? leaseData : [])) as any[];
    const leaseContracts = leaseRaw.map((c: any) => {
      const statusMap: Record<string, ContractStatus> = {
        ACTIVE: 'active',
        PENDING: 'installing',
        TERMINATED: 'terminated',
      };
      const startDate = c.startDate ?? '—';
      const endYear = c.contractYears
        ? String(Number(startDate.slice(0, 4)) + c.contractYears) + startDate.slice(4)
        : '—';
      const expiry30 = endYear !== '—' && daysLeft(endYear) < 30 && daysLeft(endYear) > 0;
      return {
        id: `lease-${c.id}`,
        number: `LEASE-${String(c.id).padStart(3, '0')}`,
        kind: 'lease' as Kind,
        generator: c.generatorCompanyName ?? '—',
        plantName: c.siteName ?? '—',
        consumer: c.consumerCompanyName ?? '—',
        site: c.siteName ?? '—',
        capacityKw: Number(c.capacityKw) || 0,
        unitPrice: 0,
        monthlyRevenue: c.monthlyRent ?? 0,
        start: startDate,
        end: endYear,
        status: expiry30 ? 'expiring' : (statusMap[c.status] ?? 'active'),
      };
    });

    return [...ppaContracts, ...leaseContracts];
  }, [ppaData, leaseData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CONTRACTS.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (q && ![c.number, c.generator, c.consumer, c.plantName, c.site].some((v) => v.toLowerCase().includes(q)))
        return false;
      return true;
    });
  }, [CONTRACTS, query, statusFilter]);

  const counts = useMemo(
    () => ({
      all: CONTRACTS.length,
      active: CONTRACTS.filter((c) => c.status === 'active').length,
      installing: CONTRACTS.filter((c) => c.status === 'installing').length,
      expiring: CONTRACTS.filter((c) => c.status === 'expiring').length,
      totalKw: CONTRACTS.reduce((s, c) => s + c.capacityKw, 0),
    }),
    [CONTRACTS],
  );

  const kindCounts = useMemo(
    () =>
      (['offsite', 'onsite', 'lease'] as Kind[]).map((k) => ({
        kind: k,
        count: CONTRACTS.filter((c) => c.kind === k).length,
        kw: CONTRACTS.filter((c) => c.kind === k).reduce((s, c) => s + c.capacityKw, 0),
      })),
    [CONTRACTS],
  );

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '계약 현황' }]} />

      <div>
        <h1 className="text-2xl font-bold text-white">계약 현황</h1>
        <p className="mt-1 text-sm text-slate-400">
          SPC 체결 계약 전체 — {CONTRACTS.length}건 · {counts.totalKw.toLocaleString()} kW
        </p>
      </div>

      {/* KPI 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(['all', 'active', 'installing', 'expiring'] as const).map((key) => {
          const meta =
            key === 'all' ? { label: '전체', cls: 'bg-white/[0.05] text-white ring-white/[0.1]' } : STATUS_META[key];
          const isActive = statusFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(isActive ? 'all' : key)}
              className={cn(
                'rounded-xl p-4 text-left ring-1 transition-all',
                isActive ? 'ring-primary bg-primary/10' : 'ring-white/[0.06] bg-[#0d1520] hover:bg-white/[0.04]',
              )}
            >
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                  meta.cls,
                )}
              >
                {meta.label}
              </span>
              <p className="mt-2 text-2xl font-bold text-white tabular-nums">{counts[key]}건</p>
            </button>
          );
        })}
      </div>

      {/* 유형별 분포 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {kindCounts.map(({ kind, count, kw }) => {
          const m = KIND_META[kind];
          const Icon = m.icon;
          return (
            <div key={kind} className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-4 flex items-center gap-4">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg ring-1', m.cls)}>
                <Icon size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{m.label}</p>
                <p className="text-xs text-slate-400">
                  {count}건 · {kw.toLocaleString()} kW
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 계약 목록 */}
      <SectionCard
        title={`계약 목록 ${filtered.length}건`}
        headerRight={
          <Input
            placeholder="계약번호 / 발전사 / 수용가 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-64"
            icon={<Search size={14} />}
          />
        }
      >
        <DataTable
          data={filtered}
          rowKey={(r) => r.id}
          columns={
            [
              {
                key: 'number',
                header: '계약번호',
                render: (r) => (
                  <div>
                    <div className="text-white font-medium text-sm">{r.number}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-medium ring-1',
                          KIND_META[r.kind].cls,
                        )}
                      >
                        {KIND_META[r.kind].label.split(' - ').pop()}
                      </span>
                    </div>
                  </div>
                ),
              },
              {
                key: 'generator',
                header: '발전사',
                render: (r) => (
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold shrink-0">
                      <Factory size={13} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-white truncate">{r.generator}</div>
                      <div className="text-[11px] text-slate-500 truncate">{r.plantName}</div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'consumer',
                header: '수용가',
                render: (r) => (
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold shrink-0">
                      <Building2 size={13} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-white truncate">{r.consumer}</div>
                      <div className="text-[11px] text-slate-500 truncate">{r.site}</div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'capacity',
                header: '용량',
                render: (r) => (
                  <span className="text-sm text-white/80 tabular-nums">{r.capacityKw.toLocaleString()} kW</span>
                ),
              },
              {
                key: 'price',
                header: '단가',
                render: (r) =>
                  r.unitPrice > 0 ? (
                    <span className="text-sm text-white/80 tabular-nums">₩{r.unitPrice}/kWh</span>
                  ) : (
                    <span className="text-xs text-slate-500">—</span>
                  ),
              },
              {
                key: 'period',
                header: '계약기간',
                render: (r) => (
                  <div className="text-xs">
                    <div className="text-white/70">
                      {r.start.slice(0, 7)} ~ {r.end.slice(0, 7)}
                    </div>
                    {r.status !== 'terminated' && (
                      <div className="text-slate-500">잔여 {daysLeft(r.end).toLocaleString()}일</div>
                    )}
                  </div>
                ),
              },
              {
                key: 'status',
                header: '상태',
                render: (r) => {
                  const m = STATUS_META[r.status];
                  return (
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                        m.cls,
                      )}
                    >
                      {m.label}
                    </span>
                  );
                },
              },
            ] as Column<SpcContract>[]
          }
          emptyMessage="계약 데이터가 없습니다"
        />
      </SectionCard>
    </div>
  );
}
