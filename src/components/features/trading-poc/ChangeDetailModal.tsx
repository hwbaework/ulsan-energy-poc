'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Textarea } from '@/components/ui/Textarea';
import { useToastStore } from '@/stores/useToastStore';
import { useTradingPocStore } from '@/stores/useTradingPocStore';
import type { Contract, ContractChange } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { CHANGE_TYPE, PARTY_LABEL, fmtDateTime, fmtKw, fmtPrice, kindLabel } from './meta';
import { ChangeStatusPill, Info, ModalFooter } from './Bits';

/** 변경 내용 한 줄 — 단가·용량은 전 → 후, 해지는 해지일 */
export function changeText(ch: ContractChange) {
  if (ch.type === 'TERMINATE') return `해지일 ${ch.effectiveDate ?? ''}`;
  if (ch.type === 'PRICE') return `${fmtPrice(Number(ch.before))} → ${fmtPrice(Number(ch.after))}`;
  if (ch.type === 'CAPACITY') return `${fmtKw(Number(ch.before))} → ${fmtKw(Number(ch.after))}`;
  return `${ch.before ?? ''} → ${ch.after ?? ''}`;
}

/** 변경·해지 상세 — 관리자는 승인·반려(승인하면 계약에 바로 반영), 요청한 쪽은 처리 전 취소 */
export function ChangeDetailModal({ change, contract, onClose }: { change: ContractChange | null; contract?: Contract; onClose: () => void }) {
  const role = useTradingRole();
  const addToast = useToastStore((s) => s.add);
  const approve = useTradingPocStore((s) => s.approveChange);
  const reject = useTradingPocStore((s) => s.rejectChange);
  const cancel = useTradingPocStore((s) => s.cancelChange);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState<'approve' | 'cancel' | null>(null);

  const ch = change;
  const open = ch?.status === 'REQUESTED';
  const canDecide = open && role.isAdmin;
  const canCancel = open && !role.isAdmin && ch?.requestedBy === role.party;

  return (
    <>
      <Modal open={!!ch} onClose={onClose} title="변경·해지 상세" size="md">
        {ch && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Info label="요청번호" value={ch.no} />
              <Info label="상태" value={<ChangeStatusPill status={ch.status} />} />
              <Info label="계약번호" value={contract?.no} />
              <Info label="발전소" value={contract?.plantName} />
              <Info label="계약 유형" value={contract ? kindLabel(contract.kind) : undefined} />
              <Info label="변경 유형" value={CHANGE_TYPE[ch.type]} />
              <Info label="내용" value={changeText(ch)} className="col-span-2" />
              <Info label="요청자" value={`${ch.requestedByName} (${PARTY_LABEL[ch.requestedBy]})`} />
              <Info label="요청일" value={fmtDateTime(ch.requestedAt)} />
              <Info label="사유" value={ch.reason} className="col-span-2" />
              {ch.decidedAt && <Info label="처리일" value={fmtDateTime(ch.decidedAt)} />}
              {ch.decisionNote && <Info label="처리 의견" value={ch.decisionNote} />}
            </div>
            <ModalFooter>
              <Button variant="secondary" onClick={onClose}>
                닫기
              </Button>
              {canCancel && (
                <Button variant="danger" onClick={() => setConfirm('cancel')}>
                  요청 취소
                </Button>
              )}
              {canDecide && (
                <>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setNote('');
                      setRejectOpen(true);
                    }}
                  >
                    반려
                  </Button>
                  <Button onClick={() => setConfirm('approve')}>승인</Button>
                </>
              )}
            </ModalFooter>
          </div>
        )}
      </Modal>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="변경·해지 반려" size="sm">
        <div className="space-y-4">
          <Textarea label="반려 사유" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          <ModalFooter>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              취소
            </Button>
            <Button
              variant="danger"
              disabled={!note.trim()}
              onClick={() => {
                if (ch) {
                  reject(ch.id, note.trim());
                  addToast('success', `${ch.no} 반려`);
                }
                setRejectOpen(false);
                onClose();
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
          if (ch && confirm === 'approve') {
            approve(ch.id);
            addToast('success', `${ch.no} 승인 — ${contract?.no ?? ''} 반영`);
          } else if (ch && confirm === 'cancel') {
            cancel(ch.id);
            addToast('success', `${ch.no} 요청 취소`);
          }
          setConfirm(null);
          onClose();
        }}
        title={confirm === 'approve' ? `${ch ? CHANGE_TYPE[ch.type] : ''} 승인` : '요청 취소'}
        message={confirm === 'approve' ? `${ch?.no} 승인 — 계약 ${contract?.no ?? ''} 에 바로 반영되고 합의서가 문서 관리에 남습니다.` : `${ch?.no} 요청을 취소합니다.`}
        confirmLabel={confirm === 'approve' ? '승인' : '요청 취소'}
        variant={confirm === 'approve' && ch?.type !== 'TERMINATE' ? 'primary' : 'danger'}
      />
    </>
  );
}
