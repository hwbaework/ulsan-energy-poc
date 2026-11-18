'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToastStore } from '@/stores/useToastStore';
import { changeTermsOf, useTradingPocStore } from '@/stores/useTradingPocStore';
import { cn } from '@/lib/utils';
import type { ChangeTerms, ChangeType, Contract, ContractChange, Party } from '@/types/trading-poc';
import { TERM_LIM, fmtNum, fmtPrice, kindLabel, numIn } from './meta';
import { ModalFooter, TEXT_MAX } from './Bits';
import { TABLE, TABLE_HEAD_ROW, TABLE_TH, TABLE_ROW, TABLE_TD } from '@/components/features/DataList';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 운영 중 계약만 */
  contracts: Contract[];
  /** 미리 고른 계약 (계약 상세에서 열 때) */
  contractId?: number;
  /** 미리 고른 구분 (해지 신청 버튼) */
  type?: ChangeType;
  requestedBy: Party;
  requestedByName: string;
  /** 신청 뒤 — 그 건 상세 화면으로 */
  onSubmitted?: (changeId: number) => void;
  /** 조건 변경 — 받은 변경 건. 주면 그 값으로 채워 시작하고, 보내면 상대에게 다시 간다(계약 · 구분은 고정) */
  change?: ContractChange;
}

/** 칸 — 상세 화면의 변경 조건 표와 같은 항목 · 순서 */
type Key = 'termYears' | 'unitPrice' | 'omAnnual';
const LIM: Record<Key, readonly [number, number, number]> = {
  termYears: TERM_LIM.termYears,
  unitPrice: TERM_LIM.price,
  omAnnual: TERM_LIM.omAnnual,
};

/**
 * 변경·해지 신청 — 구분은 변경 / 해지 둘(2026-11-18 사용자: 무엇 하나만 바뀌어도 합의서를 다시 쓰니 변경은 하나로).
 *  - 변경: 기간 · 단가(PPA) · 연간 O&M 셋(용량은 허가를 다시 받는 일이라 없음, 2026-11-18 사용자). 지금 값 옆에 바꿀 칸 오른쪽에 새 값. 빈칸은 그대로, 하나 이상은 써야 신청. 적용일은 받지 않는다(협의 채팅으로 정해 합의서에)
 *  - 해지: 사유만 — 양측 서명으로 해지 승인되면 그때 바로 해지(희망 해지일 없음)
 * 관리자 · 기업 양쪽 다 신청한다. 위에 누가 → 누구에게를 보인다. 그 뒤 동의 · 조건 · 서명은 상세 화면
 */
export function ChangeRequestModal({ open, onClose, contracts, contractId, type, requestedBy, requestedByName, onSubmitted, change }: Props) {
  const request = useTradingPocStore((s) => s.requestChange);
  const counter = useTradingPocStore((s) => s.counterChange);
  const counterMode = !!change;
  const addToast = useToastStore((s) => s.add);
  const [cid, setCid] = useState(String(contractId ?? contracts[0]?.id ?? ''));
  const [term, setTerm] = useState(type === 'TERMINATE');
  const [draft, setDraft] = useState<Partial<Record<Key, string>>>({});
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setCid(String(contractId ?? contracts[0]?.id ?? ''));
    setTerm(type === 'TERMINATE');
    // 조건 변경 — 받은 값 중 지금 계약과 다른 칸을 채워 시작
    if (change?.terms && change.termsBefore) {
      const t = change.terms;
      const b = change.termsBefore;
      const init: Partial<Record<Key, string>> = {};
      (['termYears', 'unitPrice', 'omAnnual'] as const).forEach((k) => {
        if ((t[k] ?? 0) !== (b[k] ?? 0)) init[k] = String(t[k] ?? '');
      });
      setDraft(init);
    } else setDraft({});
    setReason('');
  }, [open, contractId, type, contracts, change]);

  const c = contracts.find((x) => String(x.id) === cid);
  const now = useMemo(() => (c ? changeTermsOf(c) : undefined), [c]);
  const won = (n?: number) => (n == null ? '-' : `₩${fmtNum(Math.round(n))}`);
  const rows: { key: Key; label: string; current: string }[] = !now || !c
    ? []
    : [
        { key: 'termYears', label: '계약 기간 (년)', current: `${now.termYears}년` },
        ...(c.kind === 'ONSITE' ? [{ key: 'unitPrice' as Key, label: 'PPA 단가 (₩/kWh)', current: fmtPrice(now.unitPrice) }] : []),
        { key: 'omAnnual', label: '연간 O&M (원/년)', current: `${won(now.omAnnual)}/년` },
      ];
  // 바꾸자는 값 — 쓴 칸만, 지금 값과 같으면 뺀다
  const changes = useMemo(() => {
    if (!now) return {} as Partial<ChangeTerms>;
    const out: Partial<ChangeTerms> = {};
    (Object.keys(draft) as Key[]).forEach((k) => {
      const v = draft[k];
      if (!v) return;
      const n = Number(v);
      if (Number.isFinite(n) && n !== (now[k] ?? 0)) (out as Record<string, number>)[k] = n;
    });
    return out;
  }, [draft, now]);
  const changedCount = Object.keys(changes).length;
  // 조건 변경은 사유 대신 협의 채팅 — 바꾼 칸이 하나라도 있어야 보낸다
  // 날짜는 받지 않는다 — 변경 적용일은 협의 채팅으로, 해지는 해지 승인 때 바로
  const valid = counterMode ? !!c && changedCount > 0 : !!c && reason.trim().length > 0 && (term || changedCount > 0);

  const handleSubmit = () => {
    if (!c) return;
    if (counterMode && change && now) {
      counter(change.id, { ...now, ...changes }, requestedBy, requestedByName);
      addToast('success', `${change.no} 조건 변경 — 상대 동의 대기`);
      onClose();
      return;
    }
    const ch = request({
      contractId: c.id,
      type: term ? 'TERMINATE' : 'CHANGE',
      requestedBy,
      requestedByName,
      reason: reason.trim(),
      terms: term ? undefined : changes,
    });
    addToast('success', `${ch.no} ${term ? '해지' : '변경'} 신청 접수`);
    onClose();
    onSubmitted?.(ch.id);
  };

  const input = (k: Key) => (
      <Input
        inputMode="decimal"
        placeholder="그대로"
        className="h-9"
        value={draft[k] ? (k === 'omAnnual' ? Number(draft[k]).toLocaleString('ko-KR') : draft[k]) : ''}
        onChange={(e) => setDraft((d) => ({ ...d, [k]: numIn(e.target.value, LIM[k]) }))}
      />
    );

  return (
    <Modal open={open} onClose={onClose} title={counterMode ? '조건 변경' : '변경·해지 신청'} size="lg">
      {/* 스크롤 없이 한눈에 — 표 줄을 낮게, 적용일 · 사유는 한 줄에(2026-11-18 사용자) */}
      <div className="space-y-4">
        {/* 누가 → 누구에게 */}
        {c && (
          <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-4 py-2.5 text-base ring-1 ring-white/[0.06]">
            <span className="font-semibold text-white">{requestedBy === 'spc' ? '관리자' : c.consumerCompanyName}</span>
            <span className="text-slate-500">→</span>
            <span className="font-semibold text-white">{requestedBy === 'spc' ? c.consumerCompanyName : '관리자'}</span>
          </div>
        )}
        {!counterMode && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
          <Select
            label="계약"
            options={contracts.map((x) => ({ value: String(x.id), label: `${x.no} · ${x.consumerCompanyName} · ${kindLabel(x.kind)}` }))}
            value={cid}
            onChange={(e) => {
              setCid(e.target.value);
              setDraft({});
            }}
          />
          </div>
          <Select
            label="구분"
            options={[
              { value: 'change', label: '변경' },
              { value: 'terminate', label: '해지' },
            ]}
            value={term ? 'terminate' : 'change'}
            onChange={(e) => setTerm(e.target.value === 'terminate')}
          />
        </div>
        )}

        {/* 변경 — 상세 화면의 '변경 조건' 표와 같은 모양(항목 · 현재 · 변경), 줄을 낮게 해서 스크롤 없이 한눈에.
            빈칸은 그대로, 쓴 줄은 노란색(상세와 같은 표시) — 2026-11-18 사용자 */}
        {!term && c && (
          <table className={cn(TABLE, 'table-fixed')}>
            {/* 위 계약 · 구분(2/3 · 1/3)과 칸 너비를 맞춤 — 변경 칸이 구분 아래 */}
            <colgroup>
              <col className="w-1/3" />
              <col className="w-1/3" />
              <col className="w-1/3" />
            </colgroup>
            <thead>
              <tr className={TABLE_HEAD_ROW}>
                <th className={cn(TABLE_TH, 'py-2')}>항목</th>
                <th className={cn(TABLE_TH, 'py-2')}>현재</th>
                <th className={cn(TABLE_TH, 'py-2')}>변경</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const on = changes[r.key as keyof ChangeTerms] !== undefined;
                return (
                  <tr key={r.key} className={cn(TABLE_ROW, on && 'bg-amber-500/[0.06]')}>
                    <td className={cn(TABLE_TD, 'py-1.5')}>{r.label}</td>
                    <td className={cn(TABLE_TD, 'py-1.5 tabular-nums')}>{r.current}</td>
                    <td className={cn(TABLE_TD, 'py-1.5')}>
                      <div className={cn('rounded', on && 'ring-1 ring-amber-400/70')}>{input(r.key)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!counterMode && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-3">
            <Textarea
              label="사유"
              maxLength={TEXT_MAX}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="resize-none"
              required
            />
          </div>
        </div>
        )}
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button variant={term ? 'danger' : 'primary'} disabled={!valid} onClick={handleSubmit}>
            {counterMode ? '조건 변경' : term ? '해지 신청' : '변경 신청'}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
