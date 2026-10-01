'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Circle } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { SectionCard } from '@/components/features/SectionCard';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Textarea } from '@/components/ui/Textarea';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToastStore } from '@/stores/useToastStore';
import { DOC_CATEGORY_LABEL, useTradingPocStore } from '@/stores/useTradingPocStore';
import { useTradingRole } from './useTradingRole';
import { PARTY_LABEL, amountLabel, estimateMonthlyAmount, estimateMonthlyKwh, fmtDate, fmtDateTime, fmtKrw, fmtKw, fmtKwh, fmtPrice, kindLabel, priceLabel } from './meta';
import { ContractStatusPill, DealStepper, EventTimeline, Info, ModalFooter, RequestStatusPill } from './Bits';

/**
 * 거래 상세 — 관리자·발전사업자가 같은 화면을 보고, "지금 할 일"만 역할에 따라 다르다.
 * 신청 접수 → SPC 검토 → 승인(계약 초안) → 전자서명(발전사업자·수용가) → 체결(계약 발효)
 */
export function DealDetailScreen({ id }: { id: number }) {
  const router = useRouter();
  const role = useTradingRole();
  const addToast = useToastStore((s) => s.add);
  // 액션은 하나씩 고른다 — 객체로 묶어 고르면 렌더마다 새 객체라 무한 렌더
  const startReview = useTradingPocStore((s) => s.startReview);
  const approve = useTradingPocStore((s) => s.approveRequest);
  const reject = useTradingPocStore((s) => s.rejectRequest);
  const cancel = useTradingPocStore((s) => s.cancelRequest);
  const sign = useTradingPocStore((s) => s.signAsGenerator);
  const confirmConsumer = useTradingPocStore((s) => s.confirmConsumerSign);
  const actions = { startReview, approve, reject, cancel, sign, confirmConsumer };
  const r = role.requests.find((x) => x.id === id);
  const contract = r?.contractId ? role.contracts.find((c) => c.id === r.contractId) : undefined;
  const docs = contract ? role.documents.filter((d) => d.contractId === contract.id) : [];

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState<null | 'cancel' | 'sign' | 'approve' | 'consumer'>(null);

  if (!r) {
    return (
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'RE100', path: '/re100' }, { label: '거래 신청', path: role.isAdmin ? '/platform/trading' : '/generator/trading' }, { label: '거래 상세' }]} />
        <EmptyState
          title="신청을 찾을 수 없음"
          description="삭제되었거나 열람 권한이 없는 신청"
          action={
            <Button variant="secondary" onClick={() => router.push(role.isAdmin ? '/platform/trading' : '/generator/trading')}>
              <ArrowLeft size={14} className="mr-1" /> 거래 신청
            </Button>
          }
        />
      </div>
    );
  }

  const signedCount = contract ? Number(contract.signedByGenerator) + Number(contract.signedByConsumer) : 0;
  const listPath = role.isAdmin ? '/platform/trading' : '/generator/trading';
  const isMyGenerator = !role.isAdmin && r.generatorCompanyId === role.companyId;

  /* ── 지금 할 일 — 역할·상태별 ── */
  let todo: { text: string; buttons?: React.ReactNode } = { text: '' };
  if (r.status === 'SUBMITTED') {
    todo = role.isAdmin
      ? { text: '신청 접수 — 검토를 시작하면 발전사업자에게 알림', buttons: <Button onClick={() => { actions.startReview(r.id); addToast('success', `${r.no} 검토를 시작했습니다`); }}>검토 시작</Button> }
      : { text: 'SPC 검토 대기', buttons: isMyGenerator && <Button variant="secondary" onClick={() => setConfirm('cancel')}>신청 취소</Button> };
  } else if (r.status === 'REVIEW') {
    todo = role.isAdmin
      ? {
          text: 'SPC 검토 중 — 승인하면 계약서 초안이 만들어지고 양측 전자서명으로 넘어감',
          buttons: (
            <>
              <Button variant="danger" onClick={() => { setReason(''); setRejectOpen(true); }}>반려</Button>
              <Button onClick={() => setConfirm('approve')}>승인</Button>
            </>
          ),
        }
      : { text: 'SPC 검토 중', buttons: isMyGenerator && <Button variant="secondary" onClick={() => setConfirm('cancel')}>신청 취소</Button> };
  } else if (r.status === 'APPROVED' && contract) {
    if (!role.isAdmin) {
      todo = !contract.signedByGenerator
        ? { text: '승인 완료 — 발전사업자 전자서명 필요', buttons: isMyGenerator && <Button onClick={() => setConfirm('sign')}>전자서명</Button> }
        : { text: `발전사업자 서명 완료 — 수용가(${contract.consumerCompanyName}) 서명 대기` };
    } else {
      todo = !contract.signedByConsumer
        ? {
            text: contract.signedByGenerator ? '발전사업자 서명 완료 — 수용가 서명을 확인하면 체결' : '발전사업자 서명 대기 — 수용가 서명은 먼저 확인해 둘 수 있음',
            buttons: <Button onClick={() => setConfirm('consumer')}>수용가 서명 확인</Button>,
          }
        : { text: `수용가 서명 완료 — 발전사업자(${contract.generatorCompanyName}) 서명 대기` };
    }
  } else if (r.status === 'SIGNED' && contract) {
    todo = { text: `체결 완료 — 계약 ${contract.no} 발효 (${contract.startDate} 시작)`, buttons: <Link href={role.isAdmin ? '/platform/ppa/contracts' : '/generator/ppa/contracts'}><Button variant="secondary">내 계약</Button></Link> };
  } else if (r.status === 'REJECTED') {
    todo = { text: `반려 — ${r.rejectReason ?? ''}` };
  } else if (r.status === 'CANCELLED') {
    todo = { text: '신청자가 취소한 신청' };
  }

  const confirmMeta = {
    cancel: { title: '신청 취소', message: `${r.no} 신청을 취소합니다. 취소한 신청은 거래 이력에 남습니다.`, variant: 'danger' as const, label: '신청 취소', run: () => { actions.cancel(r.id); addToast('success', `${r.no} 신청을 취소했습니다`); } },
    sign: { title: '전자서명', message: `${contract?.no ?? ''} 계약서에 ${role.companyName} 명의로 서명합니다. 수용가 서명까지 끝나면 계약이 발효됩니다.`, variant: 'primary' as const, label: '서명', run: () => { if (contract) { actions.sign(contract.id); addToast('success', '전자서명을 완료했습니다'); } } },
    approve: { title: '승인', message: `${r.no} 신청을 승인합니다. 계약서 초안이 만들어지고 발전사업자·수용가 전자서명으로 넘어갑니다.`, variant: 'primary' as const, label: '승인', run: () => { actions.approve(r.id); addToast('success', `${r.no} 신청을 승인했습니다 — 계약서 초안 생성`); } },
    consumer: { title: '수용가 서명 확인', message: `수용가 ${r.consumerCompanyName} 의 전자서명을 확인 처리합니다.`, variant: 'primary' as const, label: '서명 확인', run: () => { if (contract) { actions.confirmConsumer(contract.id); addToast('success', '수용가 서명을 확인했습니다'); } } },
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'RE100', path: '/re100' }, { label: '거래 신청', path: listPath }, { label: r.no }]} />
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">
          {r.no} · {r.plantName}
        </h1>
        <RequestStatusPill status={r.status} />
      </div>

      {/* 진행 단계 + 지금 할 일 */}
      <SectionCard title="진행 단계">
        <div className="space-y-5">
          <DealStepper status={r.status} signedCount={signedCount} />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-3">
            <p className="text-sm text-white">{todo.text}</p>
            {todo.buttons && <div className="flex items-center gap-2">{todo.buttons}</div>}
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <SectionCard title="거래 정보">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Info label="계약 유형" value={kindLabel(r.kind)} />
              <Info label="신청자" value={`${r.applicantCompanyName} (${PARTY_LABEL[r.applicant]})`} />
              <Info label="발전사업자" value={r.generatorCompanyName} />
              <Info label="수용가" value={r.consumerCompanyName} />
              <Info label="사업장" value={r.siteName} />
              <Info label="주소" value={r.address} />
              <Info label="발전소(설비)" value={r.plantName} />
              <Info label="설비 용량" value={fmtKw(r.capacityKw)} />
              <Info label={priceLabel(r.kind)} value={fmtPrice(r.unitPrice)} />
              <Info label="계약 기간" value={`${r.termYears}년`} />
              <Info label="신청일" value={fmtDateTime(r.submittedAt)} />
              <Info label="최근 변경" value={fmtDateTime(r.updatedAt)} />
              <Info label="비고" value={r.note} className="col-span-2 md:col-span-3" />
            </div>
          </SectionCard>

          <SectionCard title="예상 정산">
            <div className="grid grid-cols-3 gap-4">
              <Info label={`월 ${r.kind === 'ONSITE' ? '공급량' : '발전량'}`} value={fmtKwh(estimateMonthlyKwh(r.capacityKw))} />
              <Info label={`월 ${amountLabel(r.kind)}`} value={fmtKrw(estimateMonthlyAmount(r.capacityKw, r.unitPrice))} />
              <Info label="계약 기간 합계" value={fmtKrw(estimateMonthlyAmount(r.capacityKw, r.unitPrice) * 12 * r.termYears)} />
            </div>
          </SectionCard>

          {contract && (
            <SectionCard title="계약" actions={<ContractStatusPill status={contract.status} />}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Info label="계약번호" value={contract.no} />
                <Info label="시작일" value={contract.startDate} />
                <Info label="종료일" value={contract.endDate} />
                <Info label="체결일" value={fmtDateTime(contract.signedAt)} />
                <div className="col-span-2 md:col-span-4 flex flex-wrap gap-6 pt-2 border-t border-white/[0.06]">
                  {[
                    { label: `발전사업자 · ${contract.generatorCompanyName}`, done: contract.signedByGenerator },
                    { label: `수용가 · ${contract.consumerCompanyName}`, done: contract.signedByConsumer },
                  ].map((s) => (
                    <span key={s.label} className={`inline-flex items-center gap-1.5 text-sm ${s.done ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {s.done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                      {s.label} {s.done ? '서명 완료' : '서명 대기'}
                    </span>
                  ))}
                </div>
              </div>
            </SectionCard>
          )}
        </div>

        <div className="space-y-6">
          <SectionCard title="진행 이력" count={r.events.length}>
            <EventTimeline events={r.events} />
          </SectionCard>
          {contract && (
            <SectionCard title="문서" count={docs.length}>
              {docs.length === 0 ? (
                <p className="text-sm text-slate-500">문서 없음</p>
              ) : (
                <ul className="space-y-2">
                  {docs.map((d) => (
                    <li key={d.id} className="text-sm">
                      <p className="text-white">{d.title}</p>
                      <p className="text-slate-500 tabular-nums">
                        {DOC_CATEGORY_LABEL[d.category]} · {fmtDate(d.issuedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}
        </div>
      </div>

      {/* 반려 — 사유를 발전사업자에게 전달 */}
      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="신청 반려" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            <span className="font-medium text-white">{r.no}</span> · {r.plantName} · {fmtKw(r.capacityKw)}
          </p>
          <Textarea label="반려 사유" placeholder="신청자에게 전달할 사유" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          <ModalFooter>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              취소
            </Button>
            <Button
              variant="danger"
              disabled={!reason.trim()}
              onClick={() => {
                actions.reject(r.id, reason.trim());
                addToast('success', `${r.no} 신청을 반려하고 사유를 전달했습니다`);
                setRejectOpen(false);
              }}
            >
              반려 전달
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) confirmMeta[confirm].run();
          setConfirm(null);
        }}
        title={confirm ? confirmMeta[confirm].title : ''}
        message={confirm ? confirmMeta[confirm].message : ''}
        confirmLabel={confirm ? confirmMeta[confirm].label : '확인'}
        variant={confirm ? confirmMeta[confirm].variant : 'primary'}
      />
    </div>
  );
}
