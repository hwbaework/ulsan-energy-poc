'use client';

import { useMemo, useState } from 'react';
import { FileEdit } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToastStore } from '@/stores/useToastStore';
import { useTradingPocStore } from '@/stores/useTradingPocStore';
import type { ContractChange } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { CHANGE_TYPE, PARTY_LABEL, fmtDate, fmtDateTime, fmtKw, fmtPrice, kindLabel } from './meta';
import { ChangeStatusPill, Info, ModalFooter, PageHeader, cell, cellMuted, cellStrong } from './Bits';
import { ChangeRequestModal } from './ChangeRequestModal';

type Row = ContractChange & { contractNo: string; plantName: string; kindLabel: string; detail: string; mine: boolean };

/** 변경·해지 — 단가·용량·기간 변경과 해지 신청. 관리자가 승인하면 계약에 바로 반영되고 합의서가 문서로 남는다. */
export function ContractChangesScreen() {
  const role = useTradingRole();
  const addToast = useToastStore((s) => s.add);
  const approve = useTradingPocStore((s) => s.approveChange);
  const reject = useTradingPocStore((s) => s.rejectChange);
  const cancel = useTradingPocStore((s) => s.cancelChange);

  const [status, setStatus] = useState('all');
  const [detail, setDetail] = useState<Row | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Row | null>(null);
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState<{ row: Row; action: 'approve' | 'cancel' } | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const rows = useMemo<Row[]>(() => {
    return role.changes
      .map((ch) => {
        const c = role.contracts.find((x) => x.id === ch.contractId);
        const detailText =
          ch.type === 'TERMINATE'
            ? `해지일 ${ch.effectiveDate ?? '-'}`
            : ch.type === 'PRICE'
              ? `${fmtPrice(Number(ch.before))} → ${fmtPrice(Number(ch.after))}`
              : ch.type === 'CAPACITY'
                ? `${fmtKw(Number(ch.before))} → ${fmtKw(Number(ch.after))}`
                : `${ch.before} → ${ch.after}`;
        return {
          ...ch,
          contractNo: c?.no ?? '-',
          plantName: c?.plantName ?? '-',
          kindLabel: c ? kindLabel(c.kind) : '-',
          detail: detailText,
          mine: role.isAdmin || (!!c && c.generatorCompanyId === role.companyId && ch.requestedBy === 'generator'),
        };
      })
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }, [role.changes, role.contracts, role.isAdmin, role.companyId]);

  const pending = rows.filter((r) => r.status === 'REQUESTED');
  const year = String(new Date().getFullYear());
  const stats = {
    pending: pending.length,
    approved: rows.filter((r) => r.status === 'APPROVED' && (r.decidedAt ?? '').startsWith(year)).length,
    rejected: rows.filter((r) => r.status === 'REJECTED' && (r.decidedAt ?? '').startsWith(year)).length,
    terminated: role.contracts.filter((c) => c.status === 'TERMINATED').length,
  };
  const visible = status === 'all' ? rows : rows.filter((r) => r.status === status);
  const activeContracts = role.contracts.filter((c) => c.status === 'ACTIVE');

  const runApprove = (r: Row) => {
    approve(r.id);
    addToast('success', `${r.no} ${CHANGE_TYPE[r.type]}을 승인했습니다 — 계약 ${r.contractNo} 반영`);
    setDetail(null);
  };
  const runCancel = (r: Row) => {
    cancel(r.id);
    addToast('success', `${r.no} 신청을 취소했습니다`);
    setDetail(null);
  };

  const actionButtons = (r: Row, size: 'sm' | 'md' = 'sm') => {
    if (r.status !== 'REQUESTED') return null;
    if (role.isAdmin)
      return (
        <>
          <Button size={size} variant="danger" onClick={() => { setRejectTarget(r); setNote(''); }}>
            반려
          </Button>
          <Button size={size} onClick={() => setConfirm({ row: r, action: 'approve' })}>
            승인
          </Button>
        </>
      );
    if (r.mine)
      return (
        <Button size={size} variant="secondary" onClick={() => setConfirm({ row: r, action: 'cancel' })}>
          취소
        </Button>
      );
    return null;
  };

  const columns: Column<Row>[] = [
    { key: 'no', header: '요청번호', width: '130px', render: (r) => cellStrong(r.no) },
    { key: 'contract', header: '계약번호 · 발전소', render: (r) => cell(`${r.contractNo} · ${r.plantName}`, 'text-white') },
    { key: 'kind', header: '계약 유형', width: '100px', render: (r) => cell(r.kindLabel) },
    { key: 'type', header: '변경 유형', width: '100px', render: (r) => cell(CHANGE_TYPE[r.type]) },
    { key: 'detail', header: '내용', width: '220px', render: (r) => cell(r.detail) },
    { key: 'by', header: '요청자', width: '150px', render: (r) => cell(`${r.requestedByName} (${PARTY_LABEL[r.requestedBy]})`) },
    { key: 'at', header: '요청일', width: '110px', sortable: true, sortValue: (r) => r.requestedAt, render: (r) => cellMuted(fmtDate(r.requestedAt)) },
    { key: 'status', header: '상태', width: '90px', render: (r) => <ChangeStatusPill status={r.status} /> },
    {
      key: 'actions',
      header: '',
      width: '170px',
      render: (r) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="secondary" onClick={() => setDetail(r)}>
            상세
          </Button>
          {actionButtons(r)}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="변경·해지"
        actions={
          activeContracts.length > 0 && (
            <Button onClick={() => setNewOpen(true)}>
              <FileEdit size={16} className="mr-1" /> 변경·해지 신청
            </Button>
          )
        }
      />

      <StatsGrid columns={4}>
        <StatCard label="처리 대기" value={`${stats.pending}건`} />
        <StatCard label={`${year} 승인`} value={`${stats.approved}건`} />
        <StatCard label={`${year} 반려`} value={`${stats.rejected}건`} />
        <StatCard label="해지 완료 계약" value={`${stats.terminated}건`} />
      </StatsGrid>

      <SectionCard
        title="변경·해지 요청"
        actions={
          <label className="flex items-center gap-2 text-sm text-slate-400">
            상태
            <Select
              options={[
                { value: 'all', label: '전체' },
                { value: 'REQUESTED', label: '처리 대기' },
                { value: 'APPROVED', label: '승인' },
                { value: 'REJECTED', label: '반려' },
                { value: 'CANCELLED', label: '취소' },
              ]}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-32"
            />
          </label>
        }
        noPadding
      >
        <DataTable columns={columns} data={visible} rowKey={(r) => r.id} emptyMessage="변경·해지 요청 없음" onRowClick={(r) => setDetail(r)} />
      </SectionCard>

      {/* 상세 */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="변경·해지 상세" size="md">
        {detail && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Info label="요청번호" value={detail.no} />
              <Info label="상태" value={<ChangeStatusPill status={detail.status} />} />
              <Info label="계약번호" value={detail.contractNo} />
              <Info label="발전소" value={detail.plantName} />
              <Info label="계약 유형" value={detail.kindLabel} />
              <Info label="변경 유형" value={CHANGE_TYPE[detail.type]} />
              <Info label="내용" value={detail.detail} className="col-span-2" />
              <Info label="요청자" value={`${detail.requestedByName} (${PARTY_LABEL[detail.requestedBy]})`} />
              <Info label="요청일" value={fmtDateTime(detail.requestedAt)} />
              <Info label="사유" value={detail.reason} className="col-span-2" />
              {detail.decidedAt && <Info label="처리일" value={fmtDateTime(detail.decidedAt)} />}
              {detail.decisionNote && <Info label="처리 의견" value={detail.decisionNote} />}
            </div>
            <ModalFooter>
              <Button variant="secondary" onClick={() => setDetail(null)}>
                닫기
              </Button>
              {actionButtons(detail, 'md')}
            </ModalFooter>
          </div>
        )}
      </Modal>

      {/* 반려 */}
      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="변경·해지 반려" size="sm">
        {rejectTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              <span className="font-medium text-white">{rejectTarget.no}</span> · {CHANGE_TYPE[rejectTarget.type]} · {rejectTarget.contractNo}
            </p>
            <Textarea label="반려 사유" placeholder="요청자에게 전달할 사유" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
            <ModalFooter>
              <Button variant="secondary" onClick={() => setRejectTarget(null)}>
                취소
              </Button>
              <Button
                variant="danger"
                disabled={!note.trim()}
                onClick={() => {
                  reject(rejectTarget.id, note.trim());
                  addToast('success', `${rejectTarget.no} 요청을 반려했습니다`);
                  setRejectTarget(null);
                  setDetail(null);
                }}
              >
                반려 전달
              </Button>
            </ModalFooter>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) (confirm.action === 'approve' ? runApprove : runCancel)(confirm.row);
          setConfirm(null);
        }}
        title={confirm?.action === 'approve' ? '변경·해지 승인' : '신청 취소'}
        message={
          confirm?.action === 'approve'
            ? `${confirm.row.no} ${CHANGE_TYPE[confirm.row.type]}을 승인합니다. 계약 ${confirm.row.contractNo} 에 바로 반영되고 합의서가 문서 관리에 생성됩니다.`
            : confirm
              ? `${confirm.row.no} 신청을 취소합니다.`
              : ''
        }
        confirmLabel={confirm?.action === 'approve' ? '승인' : '신청 취소'}
        variant={confirm?.action === 'approve' && confirm.row.type !== 'TERMINATE' ? 'primary' : 'danger'}
      />

      <ChangeRequestModal open={newOpen} onClose={() => setNewOpen(false)} contracts={activeContracts} requestedBy={role.party} requestedByName={role.companyName} />
    </div>
  );
}
