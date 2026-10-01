'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToastStore } from '@/stores/useToastStore';
import { useTradingPocStore } from '@/stores/useTradingPocStore';
import type { ChangeType, Contract, Party } from '@/types/trading-poc';
import { CHANGE_TYPE, fmtKw, fmtPrice, kindLabel, priceLabel } from './meta';
import { Info, ModalFooter } from './Bits';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 운영 중 계약만 — 발전사업자는 자기 계약, 관리자는 전부 */
  contracts: Contract[];
  /** 미리 고른 계약 (내 계약 상세에서 열 때) */
  contractId?: number;
  /** 미리 고른 유형 (해지 신청 버튼) */
  type?: ChangeType;
  requestedBy: Party;
  requestedByName: string;
}

const TYPE_OPTIONS = (Object.keys(CHANGE_TYPE) as ChangeType[]).map((t) => ({ value: t, label: CHANGE_TYPE[t] }));

/** 변경·해지 신청 — 단가·용량·기간 변경은 전·후 값을, 해지는 희망 해지일을 적는다 */
export function ChangeRequestModal({ open, onClose, contracts, contractId, type, requestedBy, requestedByName }: Props) {
  const request = useTradingPocStore((s) => s.requestChange);
  const addToast = useToastStore((s) => s.add);
  const [cid, setCid] = useState(String(contractId ?? contracts[0]?.id ?? ''));
  const [ctype, setCtype] = useState<ChangeType>(type ?? 'PRICE');
  const [after, setAfter] = useState('');
  const [effective, setEffective] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setCid(String(contractId ?? contracts[0]?.id ?? ''));
    setCtype(type ?? 'PRICE');
    setAfter('');
    setEffective('');
    setReason('');
  }, [open, contractId, type, contracts]);

  const c = contracts.find((x) => String(x.id) === cid);
  const before = !c ? '' : ctype === 'PRICE' ? fmtPrice(c.unitPrice) : ctype === 'CAPACITY' ? fmtKw(c.capacityKw) : ctype === 'TERM' ? c.endDate : c.endDate;
  const valid = !!c && reason.trim().length > 0 && (ctype === 'TERMINATE' ? !!effective : after.trim().length > 0);

  const handleSubmit = () => {
    if (!c) return;
    const ch = request({
      contractId: c.id,
      type: ctype,
      requestedBy,
      requestedByName,
      reason: reason.trim(),
      after: ctype === 'TERMINATE' ? undefined : after.trim(),
      effectiveDate: ctype === 'TERMINATE' ? effective : undefined,
    });
    addToast('success', `${ch.no} ${CHANGE_TYPE[ctype]} 신청을 접수했습니다`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="변경·해지 신청" size="md">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Select label="계약" options={contracts.map((x) => ({ value: String(x.id), label: `${x.no} · ${x.plantName}` }))} value={cid} onChange={(e) => setCid(e.target.value)} />
          </div>
          <Select label="변경 유형" options={TYPE_OPTIONS} value={ctype} onChange={(e) => setCtype(e.target.value as ChangeType)} />
          <Info label="계약 유형" value={c ? kindLabel(c.kind) : '-'} />
          <Info label={ctype === 'TERMINATE' ? '현재 종료일' : '변경 전'} value={before || '-'} />
          {ctype === 'PRICE' && <Input label={`변경 후 ${c ? priceLabel(c.kind) : '단가'} (₩/kWh)`} type="number" min={1} step="0.1" value={after} onChange={(e) => setAfter(e.target.value)} required />}
          {ctype === 'CAPACITY' && <Input label="변경 후 용량 (kW)" type="number" min={1} step="0.01" value={after} onChange={(e) => setAfter(e.target.value)} required />}
          {ctype === 'TERM' && <Input label="변경 후 종료일" type="date" value={after} onChange={(e) => setAfter(e.target.value)} required />}
          {ctype === 'TERMINATE' && <Input label="희망 해지일" type="date" value={effective} onChange={(e) => setEffective(e.target.value)} required />}
          <div className="col-span-2">
            <Textarea label="사유" placeholder="변경·해지가 필요한 이유" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="min-h-[88px]" required />
          </div>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button variant={ctype === 'TERMINATE' ? 'danger' : 'primary'} disabled={!valid} onClick={handleSubmit}>
            {ctype === 'TERMINATE' ? '해지 신청' : '변경 신청'}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
