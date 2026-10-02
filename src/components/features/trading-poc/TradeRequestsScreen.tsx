'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Lock, Sun, Zap } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Button } from '@/components/ui/Button';
import type { TradeRequest } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { IN_PROGRESS, fmtDate, fmtKw, fmtPrice, kindLabel } from './meta';
import { PageHeader, RequestStatusPill, cell, cellMuted, cellNum, cellStrong } from './Bits';
import { NewRequestModal } from './NewRequestModal';

/**
 * 거래 신청 — 진행 중인 신청 표 + 아래 '신규 계약 시작하기' 카드(onsite · 자가소비).
 * onsite 만 신청할 수 있다 — 자가소비는 수용가 소유 설비라 거래 신청 대상이 아니다(계약은 내 계약에서 확인).
 */
export function TradeRequestsScreen() {
  const router = useRouter();
  const role = useTradingRole();
  const [open, setOpen] = useState(false);

  const inProgress = useMemo(
    () => role.requests.filter((r) => IN_PROGRESS.includes(r.status)).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [role.requests],
  );
  const year = String(new Date().getFullYear());
  const stats = {
    total: inProgress.length,
    review: inProgress.filter((r) => r.status === 'SUBMITTED' || r.status === 'REVIEW').length,
    sign: inProgress.filter((r) => r.status === 'APPROVED').length,
    signedThisYear: role.requests.filter((r) => r.status === 'SIGNED' && r.updatedAt.startsWith(year)).length,
  };

  const columns: Column<TradeRequest>[] = [
    { key: 'no', header: '신청번호', width: '140px', render: (r) => cellStrong(r.no) },
    { key: 'kind', header: '계약 유형', width: '100px', render: (r) => cell(kindLabel(r.kind)) },
    { key: 'consumer', header: '수용가', render: (r) => cell(r.consumerCompanyName, 'text-white') },
    { key: 'site', header: '사업장', render: (r) => cell(r.siteName) },
    ...(role.isAdmin ? [{ key: 'gen', header: '발전사업자', width: '140px', render: (r: TradeRequest) => cell(r.generatorCompanyName) }] : []),
    { key: 'capacity', header: '용량', width: '110px', render: (r) => cellNum(fmtKw(r.capacityKw)) },
    { key: 'price', header: '단가', width: '110px', render: (r) => cellNum(fmtPrice(r.unitPrice)) },
    { key: 'submittedAt', header: '신청일', width: '120px', sortable: true, sortValue: (r) => r.submittedAt, render: (r) => cellMuted(fmtDate(r.submittedAt)) },
    { key: 'status', header: '상태', width: '100px', render: (r) => <RequestStatusPill status={r.status} /> },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (r) => (
        <Button size="sm" onClick={() => router.push(`/trading/deal/${r.id}`)}>
          상세
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="거래 신청" />

      <StatsGrid columns={4}>
        <StatCard label="진행 중 신청" value={`${stats.total}건`} />
        <StatCard label="접수 · 검토 중" value={`${stats.review}건`} />
        <StatCard label="서명 대기" value={`${stats.sign}건`} />
        <StatCard label={`${year} 체결`} value={`${stats.signedThisYear}건`} />
      </StatsGrid>

      <SectionCard title="진행 중인 신청" count={inProgress.length} noPadding>
        <DataTable columns={columns} data={inProgress} rowKey={(r) => r.id} emptyMessage="진행 중인 신청 없음 — 아래에서 신규 계약을 신청" onRowClick={(r) => router.push(`/trading/deal/${r.id}`)} />
      </SectionCard>

      {/* 신규 계약 시작하기 — 카드를 눌러 신청 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">신규 계약 시작하기</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Zap size={18} />
              </span>
              <div>
                <p className="text-xl font-bold text-white">onsite</p>
                <p className="text-sm text-slate-400">발전사업자가 수용가 부지에 설치 → 공급량만큼 PPA 요금 청구</p>
              </div>
            </div>
            <Button className="w-full" onClick={() => setOpen(true)}>
              onsite 신청하기 <ArrowUpRight size={15} className="ml-1" />
            </Button>
            <ul className="space-y-1 text-sm text-slate-400">
              <li>수용가 사업장 지붕·부지에 발전소 설치</li>
              <li>생산 전력을 수용가에 직접 공급</li>
              <li>공급량 × 계약 단가로 매월 청구 · 20년 장기 계약</li>
            </ul>
          </div>
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.05] text-slate-400">
                <Sun size={18} />
              </span>
              <div>
                <p className="text-xl font-bold text-white">자가소비</p>
                <p className="text-sm text-slate-400">수용가 소유 설비를 설치·운영 — 교차 임대차 계약</p>
              </div>
            </div>
            <Button className="w-full" variant="secondary" disabled>
              <Lock size={14} className="mr-1.5" /> 신청 대상 아님
            </Button>
            <ul className="space-y-1 text-sm text-slate-400">
              <li>수용가 소유 설비라 거래 신청을 받지 않음</li>
              <li>체결된 계약은 내 계약 · 문서관리에서 확인</li>
            </ul>
          </div>
        </div>
      </div>

      <NewRequestModal open={open} onClose={() => setOpen(false)} isAdmin={role.isAdmin} companyId={role.companyId} companyName={role.companyName} onSubmitted={(id) => router.push(`/trading/deal/${id}`)} />
    </div>
  );
}
