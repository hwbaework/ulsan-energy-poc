'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, FileEdit } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { ContractChange } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { ChangeRequestModal } from './ChangeRequestModal';
import { CHANGE_STATES, CHANGE_STATE_TONE, changeStateOf, changeTypeLabel, fmtDate, kindLabel, type ChangeState } from './meta';
import { StatusPill } from '@/components/ui/Design';
import { PageHeader, cell, cellMuted, cellStrong } from './Bits';

/** 목록 정렬 순서 — 진행 중인 단계가 위, 끝난 것(승인 · 해지 · 반려 · 취소)이 아래 */
const STATE_ORDER: Record<ChangeState, number> = { 신청: 0, '조건 입력': 1, '조건 동의': 2, 전자서명: 3, 승인: 4, 해지: 5, 반려: 6, 취소: 7 };
type Turn = '확인' | '대기';
/** 최근 협의 — 협의 채팅의 마지막 글 날짜(글이 없으면 마지막 진행 이력, 그것도 없으면 신청한 날). 거래 이력과 같은 칸 */
const lastTalkOf = (ch: ContractChange) =>
  ch.messages?.length ? ch.messages[ch.messages.length - 1]!.at : ch.events?.length ? ch.events[ch.events.length - 1]!.at : ch.requestedAt;
/**
 * 내가 볼 차례인지 — 확인(상대가 한 일이 와서 내 차례) / 대기(내가 하고 상대를 기다림). 끝난 것은 없음(거래 이력과 같은 기준, 2026-11-18 사용자)
 *  - 신청: 받는 쪽 차례(변경 동의 · 해지 동의). 신청한 쪽은 대기
 *  - 조건 입력: 관리자 차례 / 조건 동의: 기업 차례
 *  - 전자서명: 아직 서명 안 한 쪽 차례
 */
function changeTurnOf(ch: ContractChange, isAdmin: boolean): Turn | null {
  const st = changeStateOf(ch);
  if (st === '신청') return (ch.requestedBy === 'spc') === isAdmin ? '대기' : '확인';
  if (st === '조건 입력') return isAdmin ? '확인' : '대기';
  if (st === '조건 동의') return isAdmin ? '대기' : '확인';
  if (st === '전자서명') return (isAdmin ? !!ch.spcSign : !!ch.companySign) ? '대기' : '확인';
  return null;
}

/** 변경·해지 — 요청 목록. 신청은 신청 화면, 줄을 누르면 상세(단계 · 협의 채팅 · 합의서 양쪽 서명). 팝업 없음 */
export function ContractChangesScreen() {
  const router = useRouter();
  const role = useTradingRole();
  const [status, setStatus] = useState('all');
  const [newOpen, setNewOpen] = useState(false);
  const base = role.isAdmin ? '/platform/trading/changes' : '/generator/trading/changes';

  const active = useMemo(() => role.contracts.filter((c) => c.status === 'ACTIVE'), [role.contracts]);
  const contractOf = (id?: number) => role.contracts.find((c) => c.id === id);
  const rows = useMemo(
    () =>
      [...role.changes]
        // 상태 순서, 같은 상태 안에서는 확인(내 차례)이 위, 그다음 최근 협의 순 — 거래 이력과 같은 기준
        .sort(
          (a, b) =>
            STATE_ORDER[changeStateOf(a)] - STATE_ORDER[changeStateOf(b)] ||
            Number(changeTurnOf(a, role.isAdmin) !== '확인') - Number(changeTurnOf(b, role.isAdmin) !== '확인') ||
            lastTalkOf(b).localeCompare(lastTalkOf(a)),
        )
        .filter((c) => status === 'all' || changeStateOf(c) === status),
    [role.changes, status, role.isAdmin],
  );
  const year = String(new Date().getFullYear());
  const stats = {
    pending: role.changes.filter((c) => c.status === 'REQUESTED').length,
    approved: role.changes.filter((c) => c.status === 'APPROVED' && c.type !== 'TERMINATE' && (c.decidedAt ?? '').startsWith(year)).length, // 해지는 해지 완료 계약에
    rejected: role.changes.filter((c) => c.status === 'REJECTED' && (c.decidedAt ?? '').startsWith(year)).length,
    terminated: role.contracts.filter((c) => c.status === 'TERMINATED').length,
  };

  const columns: Column<ContractChange>[] = [
    { key: 'no', header: '신청번호', width: '160px', render: (c) => cellStrong(c.no) },
    { key: 'contract', header: '계약번호', width: '160px', render: (c) => cell(contractOf(c.contractId)?.no ?? '') },
    // 어느 기업인지만 — 요청한 쪽은 계약한 그 기업이라 따로 보이지 않는다. 내용은 줄을 눌러 안에서
    {
      key: 'company',
      header: '기업',
      render: (c) => cell(contractOf(c.contractId)?.consumerCompanyName ?? '', 'text-white'),
    },
    {
      key: 'kind',
      header: '계약 유형',
      width: '100px',
      render: (c) => cell(contractOf(c.contractId) ? kindLabel(contractOf(c.contractId)!.kind) : ''),
    },
    {
      key: 'type',
      header: '변경 유형',
      width: '100px',
      render: (c) => cell(changeTypeLabel(c.type, contractOf(c.contractId)?.kind)),
    },
    {
      key: 'at',
      header: '최근 협의',
      width: '130px',
      sortable: true,
      sortValue: (c) => lastTalkOf(c),
      render: (c) => cellMuted(fmtDate(lastTalkOf(c))),
    },
    // 상태 — 머리글을 눌러 단계 순서로 정렬, 진행 중이면 · 확인 / · 대기
    {
      key: 'status',
      header: '상태',
      width: '170px',
      sortable: true,
      sortValue: (c) => STATE_ORDER[changeStateOf(c)],
      render: (c) => {
        const st = changeStateOf(c);
        const turn = changeTurnOf(c, role.isAdmin);
        return <StatusPill tone={CHANGE_STATE_TONE[st]} label={turn ? `${st} · ${turn}` : st} />;
      },
    },
    { key: 'go', header: '', width: '40px', render: () => <ChevronRight size={15} className="text-slate-600" /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="변경·해지"
        actions={
          // 관리자도 신청한다 — 계약의 한쪽 당사자(단가 조정 · 요금 미납 해지 등, 2026-11-18 사용자). 팝업에서 계약(기업)을 고른다
          active.length > 0 && (
            <Button onClick={() => setNewOpen(true)}>
              <FileEdit size={16} className="mr-1" /> 변경·해지 신청
            </Button>
          )
        }
      />

      <StatsGrid columns={4}>
        <StatCard label="진행 중" value={`${stats.pending}건`} />
        <StatCard label="금년 승인" value={`${stats.approved}건`} />
        <StatCard label="금년 반려" value={`${stats.rejected}건`} />
        <StatCard label="해지 완료 계약" value={`${stats.terminated}건`} />
      </StatsGrid>

      <SectionCard
        title="변경·해지 신청"
        actions={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              상태
              <Select
                options={[{ value: 'all', label: '전체' }, ...CHANGE_STATES.map((s) => ({ value: s, label: s }))]}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-32"
              />
            </label>
          </div>
        }
        noPadding
      >
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(c) => c.id}
          emptyMessage="변경·해지 신청 없음"
          onRowClick={(c) => router.push(`${base}/view?id=${c.id}`)}
        />
      </SectionCard>
      <ChangeRequestModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        contracts={active}
        requestedBy={role.party}
        requestedByName={role.companyName}
        onSubmitted={(id) => router.push(`${base}/view?id=${id}`)}
      />
    </div>
  );
}
