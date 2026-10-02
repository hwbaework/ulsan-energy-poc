'use client';

import { useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Textarea } from '@/components/ui/Textarea';
import { useToastStore } from '@/stores/useToastStore';
import { CO, useTradingPocStore } from '@/stores/useTradingPocStore';
import { useTradingRole } from './useTradingRole';
import { PARTY_LABEL, amountLabel, estimateMonthlyAmount, estimateMonthlyKwh, fmtDateTime, fmtKrw, fmtKw, fmtKwh, fmtPrice, kindLabel, priceLabel } from './meta';
import { DealStepper, EventTimeline, Info, ModalFooter, RequestStatusPill } from './Bits';

type Action = 'review' | 'approve' | 'consumer' | 'sign' | 'cancel';

/**
 * 거래 상세 — 거래 현황 · 거래 승인에서 같은 창으로 연다(페이지 이동 없음).
 * 할 수 있는 일만 버튼으로: 관리자 검토·승인·반려·수용가 서명 확인 / 발전사업자 전자서명·신청 취소
 */
export function DealDetailModal({ requestId, onClose }: { requestId: number | null; onClose: () => void }) {
  const role = useTradingRole();
  const addToast = useToastStore((s) => s.add);
  const startReview = useTradingPocStore((s) => s.startReview);
  const approve = useTradingPocStore((s) => s.approveRequest);
  const reject = useTradingPocStore((s) => s.rejectRequest);
  const cancel = useTradingPocStore((s) => s.cancelRequest);
  const sign = useTradingPocStore((s) => s.signAsGenerator);
  const confirmConsumer = useTradingPocStore((s) => s.confirmConsumerSign);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState<Action | null>(null);

  const r = requestId == null ? undefined : role.requests.find((x) => x.id === requestId);
  const c = r?.contractId ? role.contracts.find((x) => x.id === r.contractId) : undefined;
  const signedCount = c ? Number(c.signedByGenerator) + Number(c.signedByConsumer) : 0;
  const mine = !!r && !role.isAdmin && r.generatorCompanyId === role.companyId;

  // 지금 할 수 있는 일 — 상태·역할별
  const actions: Action[] = !r
    ? []
    : role.isAdmin
      ? r.status === 'SUBMITTED'
        ? ['review']
        : r.status === 'REVIEW'
          ? ['approve']
          : r.status === 'APPROVED' && c
            ? // SPC 가 상대인 계약은 관리자가 SPC 명의로 서명, 수용가 서명은 확인 처리
              ([...(c.generatorCompanyId === CO.SPC.id && !c.signedByGenerator ? ['sign'] : []), ...(!c.signedByConsumer ? ['consumer'] : [])] as Action[])
            : []
      : mine && (r.status === 'SUBMITTED' || r.status === 'REVIEW')
        ? ['cancel']
        : mine && r.status === 'APPROVED' && c && !c.signedByGenerator
          ? ['sign']
          : [];

  const meta: Record<Action, { label: string; title: string; message: string; variant: 'primary' | 'danger'; run: () => void }> = {
    review: { label: '검토 시작', title: '검토 시작', message: `${r?.no} 검토를 시작합니다.`, variant: 'primary', run: () => r && startReview(r.id) },
    approve: { label: '승인', title: '승인', message: `${r?.no} 신청을 승인합니다. 계약서 초안이 만들어지고 전자서명 단계로 넘어갑니다.`, variant: 'primary', run: () => r && approve(r.id) },
    consumer: { label: '수용가 서명 확인', title: '수용가 서명 확인', message: `${r?.consumerCompanyName} 전자서명을 확인 처리합니다.`, variant: 'primary', run: () => c && confirmConsumer(c.id) },
    sign: { label: role.isAdmin ? 'SPC 전자서명' : '전자서명', title: '전자서명', message: `${c?.no} 계약서에 ${role.isAdmin ? CO.SPC.name : role.companyName} 명의로 서명합니다.`, variant: 'primary', run: () => c && sign(c.id) },
    cancel: { label: '신청 취소', title: '신청 취소', message: `${r?.no} 신청을 취소합니다.`, variant: 'danger', run: () => r && cancel(r.id) },
  };

  return (
    <>
      <Modal open={!!r} onClose={onClose} title="거래 상세" size="lg">
        {r && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg font-semibold text-white">
                {r.no} · {r.plantName}
              </p>
              <RequestStatusPill status={r.status} />
            </div>

            <DealStepper status={r.status} signedCount={signedCount} />

            <div className="grid grid-cols-3 gap-4">
              <Info label="계약 유형" value={kindLabel(r.kind)} />
              <Info label="기업명" value={r.consumerCompanyName} />
              <Info label="계약 상대" value={r.generatorCompanyName} />
              <Info label="기업 주소" value={r.address} className="col-span-3" />
              <Info label="설치 용량" value={fmtKw(r.capacityKw)} />
              <Info label={priceLabel(r.kind)} value={fmtPrice(r.unitPrice)} />
              <Info label="계약 기간" value={`${r.termYears}년`} />
              <Info label={`예상 월 ${r.kind === 'ONSITE' ? '공급량' : '발전량'}`} value={fmtKwh(estimateMonthlyKwh(r.capacityKw))} />
              <Info label={`예상 월 ${amountLabel(r.kind)}`} value={fmtKrw(estimateMonthlyAmount(r.capacityKw, r.unitPrice))} />
              <Info label="무료진단" value={r.reviewNo} />
              {r.segments && (
                <Info label="구간 단가" value={r.segments.map((g, i) => `${i + 1}구간 ${g.from}~${g.to}년차 ₩${g.price}/kWh`).join(' · ')} className="col-span-2" />
              )}
              <Info label="요금제" value={r.tariffPlan} />
              <Info label="요금 기준" value={r.tariffBasis} />
              <Info label="O&M" value={r.omIncluded ? '포함 (필수)' : undefined} />
              {r.kind === 'SELF_CONSUMPTION' && (
                <>
                  <Info label="예상 설치단가 (무료진단)" value={r.estInstallUnit ? `₩${r.estInstallUnit.toLocaleString('ko-KR')}/kW` : undefined} />
                  <Info label="설치 가능 단가" value={r.installUnit ? `₩${r.installUnit.toLocaleString('ko-KR')}/kW` : undefined} />
                  <Info label="예상 설치비" value={r.installUnit ? `₩${Math.round(r.installUnit * r.capacityKw).toLocaleString('ko-KR')}` : undefined} />
                </>
              )}
              <Info label="현장 실측" value={r.surveyRequested ? `요청${r.surveyDate ? ` · 희망일 ${r.surveyDate}` : ''}` : r.surveyRequested === false ? '요청 안 함' : undefined} />
              <Info label="담당자" value={r.contact ? [r.contact.name, r.contact.phone, r.contact.email].filter(Boolean).join(' · ') : undefined} className="col-span-2" />
              <Info label="신청자" value={`${r.applicantCompanyName} (${PARTY_LABEL[r.applicant]})`} />
              <Info label="신청일" value={fmtDateTime(r.submittedAt)} />
              {r.status === 'REJECTED' && <Info label="반려 사유" value={r.rejectReason} />}
              {r.note && <Info label="비고" value={r.note} className="col-span-3" />}
            </div>

            {c && (
              <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-3 space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <Info label="계약번호" value={c.no} />
                  <Info label="시작일" value={c.startDate} />
                  <Info label="종료일" value={c.endDate} />
                </div>
                <div className="flex flex-wrap gap-6">
                  {[
                    { label: `발전사업자 · ${c.generatorCompanyName}`, done: c.signedByGenerator },
                    { label: `수용가 · ${c.consumerCompanyName}`, done: c.signedByConsumer },
                  ].map((s) => (
                    <span key={s.label} className={`inline-flex items-center gap-1.5 text-sm ${s.done ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {s.done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                      {s.label} {s.done ? '서명 완료' : '서명 대기'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm text-slate-400 mb-3">진행 이력</p>
              <EventTimeline events={r.events} />
            </div>

            <ModalFooter>
              <Button variant="secondary" onClick={onClose}>
                닫기
              </Button>
              {role.isAdmin && r.status === 'REVIEW' && (
                <Button
                  variant="danger"
                  onClick={() => {
                    setReason('');
                    setRejectOpen(true);
                  }}
                >
                  반려
                </Button>
              )}
              {actions.map((a) => (
                <Button key={a} variant={meta[a].variant} onClick={() => setConfirm(a)}>
                  {meta[a].label}
                </Button>
              ))}
            </ModalFooter>
          </div>
        )}
      </Modal>

      {/* 반려 — 사유를 신청자에게 전달 */}
      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="신청 반려" size="sm">
        <div className="space-y-4">
          <Textarea label="반려 사유" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          <ModalFooter>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              취소
            </Button>
            <Button
              variant="danger"
              disabled={!reason.trim()}
              onClick={() => {
                if (r) {
                  reject(r.id, reason.trim());
                  addToast('success', `${r.no} 반려`);
                }
                setRejectOpen(false);
              }}
            >
              반려
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) {
            meta[confirm].run();
            addToast('success', `${r?.no} ${meta[confirm].label}`);
          }
          setConfirm(null);
        }}
        title={confirm ? meta[confirm].title : ''}
        message={confirm ? meta[confirm].message : ''}
        confirmLabel={confirm ? meta[confirm].label : '확인'}
        variant={confirm ? meta[confirm].variant : 'primary'}
      />
    </>
  );
}
