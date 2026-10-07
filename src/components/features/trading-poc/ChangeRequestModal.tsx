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
import { changeTypeLabel, fmtKw, fmtNum, kindLabel } from './meta';
import { Info, ModalFooter } from './Bits';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 운영 중 계약만 */
  contracts: Contract[];
  /** 미리 고른 계약 (계약 상세에서 열 때) */
  contractId?: number;
  /** 미리 고른 유형 (해지 신청 버튼) */
  type?: ChangeType;
  requestedBy: Party;
  requestedByName: string;
  /** 신청 뒤 — 그 건 상세 화면으로 */
  onSubmitted?: (changeId: number) => void;
}

/**
 * 변경·해지 신청 — 계약 조건에 맞춰:
 *  - onsite 단가 변경: 적용일부터 남은 기간 단가를 바꾼다(구간을 고르지 않는다 — 실제로 구간만 바꾸는 일은 없다)
 *  - 자가소비 O&M 변경: 연간 O&M(총사업비 대비 %)을 바꾼다
 *  - 용량 · 기간 변경, 해지(희망 해지일)
 * SPC(관리자)와 기업 양쪽 다 신청한다. 위에 누가 → 누구에게(SPC → 한일튜브)를 보인다.
 * 신청은 팝업(짧은 양식), 그 뒤 승인 · 서명 · 반영은 상세 화면.
 */
export function ChangeRequestModal({
  open,
  onClose,
  contracts,
  contractId,
  type,
  requestedBy,
  requestedByName,
  onSubmitted,
}: Props) {
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
  const self = c?.kind === 'SELF_CONSUMPTION';
  // 지금 적용 중인 단가 — 첫 구간(구간을 나누지 않고 한 단가로 바꾼다)
  const seg = c?.segments?.[0];
  const before = !c
    ? ''
    : ctype === 'PRICE'
      ? self
        ? c.omRatePct != null
          ? `${c.omRatePct}%`
          : ''
        : `₩${fmtNum(seg?.price ?? c.unitPrice, 1)}/kWh`
      : ctype === 'CAPACITY'
        ? fmtKw(c.capacityKw)
        : c.endDate;
  const needsDate = ctype === 'TERMINATE' || (ctype === 'PRICE' && !self);
  const valid =
    !!c &&
    reason.trim().length > 0 &&
    (ctype === 'TERMINATE' ? !!effective : after.trim().length > 0 && (!needsDate || !!effective));
  const typeOptions = (['PRICE', 'CAPACITY', 'TERM', 'TERMINATE'] as ChangeType[]).map((t) => ({
    value: t,
    label: changeTypeLabel(t, c?.kind),
  }));

  const handleSubmit = () => {
    if (!c) return;
    const ch = request({
      contractId: c.id,
      type: ctype,
      requestedBy,
      requestedByName,
      reason: reason.trim(),
      after: ctype === 'TERMINATE' ? undefined : after.trim(),
      effectiveDate: needsDate ? effective : undefined,
    });
    addToast('success', `${ch.no} ${changeTypeLabel(ctype, c.kind)} 신청 접수`);
    onClose();
    onSubmitted?.(ch.id);
  };

  return (
    <Modal open={open} onClose={onClose} title="변경·해지 신청" size="md">
      <div className="space-y-5">
        {/* 누가 → 누구에게 */}
        {c && (
          <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-4 py-2.5 text-base ring-1 ring-white/[0.06]">
            <span className="font-semibold text-white">{requestedBy === 'spc' ? 'SPC' : c.consumerCompanyName}</span>
            <span className="text-slate-500">→</span>
            <span className="font-semibold text-white">{requestedBy === 'spc' ? c.consumerCompanyName : 'SPC'}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Select
              label="계약"
              options={contracts.map((x) => ({
                value: String(x.id),
                label: `${x.no} · ${x.consumerCompanyName} · ${kindLabel(x.kind)}`,
              }))}
              value={cid}
              onChange={(e) => setCid(e.target.value)}
            />
          </div>
          <Select
            label="변경 유형"
            options={typeOptions}
            value={ctype}
            onChange={(e) => setCtype(e.target.value as ChangeType)}
          />
          <Info label="계약 유형" value={c ? kindLabel(c.kind) : undefined} />
          <Info label={ctype === 'TERMINATE' ? '현재 종료일' : '변경 전'} value={before || undefined} />
          {ctype === 'PRICE' &&
            (self ? (
              <Input
                label="변경 후 연간 O&M (총사업비 대비, %)"
                type="number"
                min={0.1}
                step="0.1"
                value={after}
                onChange={(e) => setAfter(e.target.value)}
                required
              />
            ) : (
              <Input
                label="변경 후 단가 (₩/kWh)"
                type="number"
                min={1}
                step="0.1"
                value={after}
                onChange={(e) => setAfter(e.target.value)}
                required
              />
            ))}
          {ctype === 'CAPACITY' && (
            <Input
              label="변경 후 용량 (kW)"
              type="number"
              min={1}
              step="0.01"
              value={after}
              onChange={(e) => setAfter(e.target.value)}
              required
            />
          )}
          {ctype === 'TERM' && (
            <Input
              label="변경 후 종료일"
              type="date"
              value={after}
              onChange={(e) => setAfter(e.target.value)}
              required
            />
          )}
          {needsDate && (
            <Input
              label={ctype === 'TERMINATE' ? '희망 해지일' : '적용일'}
              type="date"
              value={effective}
              onChange={(e) => setEffective(e.target.value)}
              required
            />
          )}
          <div className="col-span-2">
            <Textarea
              label="사유"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="min-h-[88px] resize-none"
              required
            />
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
