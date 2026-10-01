'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToastStore } from '@/stores/useToastStore';
import { useTradingPocStore } from '@/stores/useTradingPocStore';
import type { TradeRequest } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { PARTY_LABEL, fmtDate, fmtDateTime, fmtKw, fmtPrice, kindLabel, priceLabel } from './meta';
import { Info, ModalFooter, PageHeader, RequestStatusPill, cell, cellMuted, cellNum, cellStrong } from './Bits';

type TabId = 'queue' | 'signing' | 'done';
const TABS: { id: TabId; label: string }[] = [
  { id: 'queue', label: '승인 대기' },
  { id: 'signing', label: '서명 진행' },
  { id: 'done', label: '처리 완료' },
];

/**
 * 거래 승인 — 관리자(SPC)는 신청을 검토·승인·반려하고 수용가 서명을 확인한다.
 * 발전사업자는 자기 신청이 어느 승인 단계인지와 지금 해야 할 일(전자서명)을 본다.
 */
export function TradeApprovalsScreen() {
  const router = useRouter();
  const role = useTradingRole();
  const addToast = useToastStore((s) => s.add);
  const startReview = useTradingPocStore((s) => s.startReview);
  const approve = useTradingPocStore((s) => s.approveRequest);
  const reject = useTradingPocStore((s) => s.rejectRequest);
  const confirmConsumer = useTradingPocStore((s) => s.confirmConsumerSign);

  const [tab, setTab] = useState<TabId>('queue');
  const [detail, setDetail] = useState<TradeRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<TradeRequest | null>(null);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState<{ r: TradeRequest; action: 'approve' | 'consumer' } | null>(null);

  const byTab = useMemo(() => {
    const sorted = [...role.requests].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return {
      queue: sorted.filter((r) => r.status === 'SUBMITTED' || r.status === 'REVIEW'),
      signing: sorted.filter((r) => r.status === 'APPROVED'),
      done: sorted.filter((r) => r.status === 'SIGNED' || r.status === 'REJECTED' || r.status === 'CANCELLED'),
    };
  }, [role.requests]);
  const month = new Date().toISOString().slice(0, 7);
  const stats = {
    submitted: byTab.queue.filter((r) => r.status === 'SUBMITTED').length,
    review: byTab.queue.filter((r) => r.status === 'REVIEW').length,
    signing: byTab.signing.length,
    doneThisMonth: byTab.done.filter((r) => r.updatedAt.startsWith(month)).length,
  };
  const contractOf = (r: TradeRequest) => role.contracts.find((c) => c.id === r.contractId);

  /** 승인 단계 설명 — 발전사업자 화면의 핵심 */
  const stageText = (r: TradeRequest) => {
    const c = contractOf(r);
    switch (r.status) {
      case 'SUBMITTED':
        return 'SPC 검토 대기';
      case 'REVIEW':
        return 'SPC 검토 중';
      case 'APPROVED':
        if (!c) return '승인 — 서명 대기';
        if (!c.signedByGenerator) return '승인 — 발전사업자 서명 필요';
        if (!c.signedByConsumer) return '승인 — 수용가 서명 대기';
        return '승인 — 체결 처리 중';
      case 'SIGNED':
        return `체결 — ${c?.no ?? ''}`;
      case 'REJECTED':
        return `반려 — ${r.rejectReason ?? ''}`;
      case 'CANCELLED':
        return '신청자 취소';
    }
  };

  const adminActions = (r: TradeRequest, size: 'sm' | 'md' = 'sm') => {
    const c = contractOf(r);
    if (r.status === 'SUBMITTED')
      return (
        <Button size={size} onClick={() => { startReview(r.id); addToast('success', `${r.no} 검토를 시작했습니다`); setDetail(null); }}>
          검토 시작
        </Button>
      );
    if (r.status === 'REVIEW')
      return (
        <>
          <Button size={size} variant="danger" onClick={() => { setRejectTarget(r); setReason(''); }}>
            반려
          </Button>
          <Button size={size} onClick={() => setConfirm({ r, action: 'approve' })}>
            승인
          </Button>
        </>
      );
    if (r.status === 'APPROVED' && c && !c.signedByConsumer)
      return (
        <Button size={size} onClick={() => setConfirm({ r, action: 'consumer' })}>
          수용가 서명 확인
        </Button>
      );
    return null;
  };
  const generatorActions = (r: TradeRequest, size: 'sm' | 'md' = 'sm') => {
    const c = contractOf(r);
    if (r.status === 'APPROVED' && c && !c.signedByGenerator && r.generatorCompanyId === role.companyId)
      return (
        <Button size={size} onClick={() => router.push(`/trading/deal/${r.id}`)}>
          전자서명
        </Button>
      );
    return null;
  };
  const actionsOf = role.isAdmin ? adminActions : generatorActions;

  const columns: Column<TradeRequest>[] = [
    { key: 'no', header: '신청번호', width: '140px', render: (r) => cellStrong(r.no) },
    ...(role.isAdmin ? [{ key: 'gen', header: '발전사업자', width: '140px', render: (r: TradeRequest) => cell(r.generatorCompanyName, 'text-white') }] : []),
    { key: 'kind', header: '계약 유형', width: '100px', render: (r) => cell(kindLabel(r.kind)) },
    { key: 'plant', header: '발전소(설비)', render: (r) => cell(r.plantName, role.isAdmin ? undefined : 'text-white') },
    { key: 'consumer', header: '수용가', width: '140px', render: (r) => cell(r.consumerCompanyName) },
    { key: 'capacity', header: '용량', width: '110px', render: (r) => cellNum(fmtKw(r.capacityKw)) },
    { key: 'price', header: '단가', width: '110px', render: (r) => cellNum(fmtPrice(r.unitPrice)) },
    { key: 'submittedAt', header: '신청일', width: '110px', sortable: true, sortValue: (r) => r.submittedAt, render: (r) => cellMuted(fmtDate(r.submittedAt)) },
    { key: 'stage', header: '승인 단계', width: '220px', render: (r) => cell(stageText(r)) },
    { key: 'status', header: '상태', width: '90px', render: (r) => <RequestStatusPill status={r.status} /> },
    {
      key: 'actions',
      header: '',
      width: '190px',
      render: (r) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="secondary" onClick={() => setDetail(r)}>
            상세
          </Button>
          {actionsOf(r)}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="거래 승인" />

      <StatsGrid columns={4}>
        <StatCard label="접수" value={`${stats.submitted}건`} sub={role.isAdmin ? '검토 시작 필요' : 'SPC 검토 대기'} />
        <StatCard label="검토 중" value={`${stats.review}건`} sub={role.isAdmin ? '승인·반려 필요' : 'SPC 검토 중'} />
        <StatCard label="서명 진행" value={`${stats.signing}건`} sub="승인 완료 · 전자서명 단계" />
        <StatCard label="이달 처리" value={`${stats.doneThisMonth}건`} sub="체결 · 반려 · 취소" />
      </StatsGrid>

      <SectionCard title={TABS.find((t) => t.id === tab)!.label} count={byTab[tab].length} actions={<Tabs tabs={TABS} activeId={tab} onChange={(id) => setTab(id as TabId)} />} noPadding>
        <DataTable
          columns={columns}
          data={byTab[tab]}
          rowKey={(r) => r.id}
          emptyMessage={tab === 'queue' ? '승인 대기 신청 없음' : tab === 'signing' ? '서명 진행 중 신청 없음' : '처리 완료 신청 없음'}
          onRowClick={(r) => setDetail(r)}
        />
      </SectionCard>

      {/* 상세 — 신청 내용을 전부 보고 처리 */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="신청 상세" size="md">
        {detail && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Info label="신청번호" value={detail.no} />
              <Info label="상태" value={<RequestStatusPill status={detail.status} />} />
              <Info label="신청자" value={`${detail.applicantCompanyName} (${PARTY_LABEL[detail.applicant]})`} />
              <Info label="발전사업자" value={detail.generatorCompanyName} />
              <Info label="수용가" value={detail.consumerCompanyName} />
              <Info label="사업장" value={detail.siteName} />
              <Info label="주소" value={detail.address} className="col-span-2" />
              <Info label="계약 유형" value={kindLabel(detail.kind)} />
              <Info label="발전소(설비)" value={detail.plantName} />
              <Info label="설비 용량" value={fmtKw(detail.capacityKw)} />
              <Info label={priceLabel(detail.kind)} value={fmtPrice(detail.unitPrice)} />
              <Info label="계약 기간" value={`${detail.termYears}년`} />
              <Info label="신청일" value={fmtDateTime(detail.submittedAt)} />
              <Info label="승인 단계" value={stageText(detail)} className="col-span-2" />
              <Info label="비고" value={detail.note} className="col-span-2" />
            </div>
            <ModalFooter>
              <Button variant="ghost" className="mr-auto" onClick={() => router.push(`/trading/deal/${detail.id}`)}>
                거래 상세
              </Button>
              <Button variant="secondary" onClick={() => setDetail(null)}>
                닫기
              </Button>
              {actionsOf(detail, 'md')}
            </ModalFooter>
          </div>
        )}
      </Modal>

      {/* 반려 */}
      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="신청 반려" size="sm">
        {rejectTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              <span className="font-medium text-white">{rejectTarget.no}</span> · {rejectTarget.plantName} · {fmtKw(rejectTarget.capacityKw)}
            </p>
            <Textarea label="반려 사유" placeholder="발전사업자에게 전달할 사유" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            <ModalFooter>
              <Button variant="secondary" onClick={() => setRejectTarget(null)}>
                취소
              </Button>
              <Button
                variant="danger"
                disabled={!reason.trim()}
                onClick={() => {
                  reject(rejectTarget.id, reason.trim());
                  addToast('success', `${rejectTarget.no} 신청을 반려하고 사유를 전달했습니다`);
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
          if (confirm?.action === 'approve') {
            approve(confirm.r.id);
            addToast('success', `${confirm.r.no} 신청을 승인했습니다 — 계약서 초안 생성`);
          } else if (confirm?.action === 'consumer') {
            const c = contractOf(confirm.r);
            if (c) confirmConsumer(c.id);
            addToast('success', '수용가 서명을 확인했습니다');
          }
          setConfirm(null);
          setDetail(null);
        }}
        title={confirm?.action === 'approve' ? '승인' : '수용가 서명 확인'}
        message={
          confirm?.action === 'approve'
            ? `${confirm.r.no} 신청을 승인합니다. 계약서 초안이 만들어지고 발전사업자·수용가 전자서명으로 넘어갑니다.`
            : confirm
              ? `수용가 ${confirm.r.consumerCompanyName} 의 전자서명을 확인 처리합니다.`
              : ''
        }
        confirmLabel={confirm?.action === 'approve' ? '승인' : '서명 확인'}
      />
    </div>
  );
}
