'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import { SectionCard } from '@/components/features/SectionCard';
import { Button } from '@/components/ui/Button';
import type { Contract } from '@/types/trading-poc';
import {
  KEPCO_UNIT_PRICE,
  daysLeft,
  estimateMonthlyKwh,
  fmtDateTime,
  fmtKrw,
  fmtNum,
  kindLabel,
  savingOf,
} from './meta';
import { ContractStatusPill, Info } from './Bits';
import { TermsInfo } from './TermsInfo';

interface Props {
  contract: Contract;
  /** 운영 중 계약에서만 변경·해지 신청 버튼 */
  canRequestChange: boolean;
  onRequestChange?: (contract: Contract, type?: 'TERMINATE') => void;
}

/** 한 달 — 예상 발전량 · 절감액(자가소비: 한전으로 냈을 요금, onsite: 한전 요금 − 반납 금액) · 반납 금액(onsite) */
export function monthOfContract(c: Contract) {
  const kwh = estimateMonthlyKwh(c.capacityKw);
  const price = c.segments?.[0]?.price ?? c.unitPrice;
  const onsite = c.kind === 'ONSITE';
  return {
    kwh,
    saving: onsite ? savingOf(kwh, price).saving : Math.round(kwh * KEPCO_UNIT_PRICE),
    payback: onsite ? Math.round(kwh * price) : 0,
  };
}

/**
 * 계약 상세 — 팝업이 아니라 화면 안의 카드. 신청 때 넣은 계약 조건 · 기간 · 한 달 금액 · 서명.
 * 정산은 수익·정산, 문서는 문서 관리, 변경·해지 진행은 변경·해지 메뉴에서 본다.
 * 변경 · 해지 신청은 카드 제목 오른쪽.
 */
export function ContractDetailCard({ contract: c, canRequestChange, onRequestChange }: Props) {
  const onsite = c.kind === 'ONSITE';
  const left = daysLeft(c.endDate);
  const m = monthOfContract(c);

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-3">
          {kindLabel(c.kind)} · {c.no}
          <ContractStatusPill status={c.status} />
        </span>
      }
      actions={
        canRequestChange && c.status === 'ACTIVE' ? (
          <>
            <Button size="sm" variant="danger" onClick={() => onRequestChange?.(c, 'TERMINATE')}>
              해지 신청
            </Button>
            <Button size="sm" onClick={() => onRequestChange?.(c)}>
              변경 신청
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <TermsInfo x={c} />
          <Info label="시작일" value={c.startDate} />
          <Info
            label="종료일"
            value={
              c.status === 'TERMINATED'
                ? `${c.terminatedAt ?? ''} (해지)`
                : `${c.endDate} (${left > 0 ? `${left.toLocaleString()}일 남음` : '만료'})`
            }
          />
          <Info label="체결일" value={fmtDateTime(c.signedAt)} />
        </div>

        {/* 한 달 — 예상 */}
        <div className="grid grid-cols-3 gap-4 rounded-lg bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.06]">
          <Info label="예상 월 발전량" value={`${fmtNum(m.kwh)} kWh`} />
          <Info label="예상 월 절감액" value={fmtKrw(m.saving)} />
          <Info label="월 반납 금액" value={onsite ? fmtKrw(m.payback) : '-'} />
        </div>

        {/* 서명 */}
        <div className="flex flex-wrap gap-6">
          {[
            { label: `계약 상대 · ${c.generatorCompanyName}`, done: c.signedByGenerator },
            { label: `기업 · ${c.consumerCompanyName}`, done: c.signedByConsumer },
          ].map((s) => (
            <span
              key={s.label}
              className={`inline-flex items-center gap-1.5 text-sm ${s.done ? 'text-emerald-400' : 'text-slate-500'}`}
            >
              {s.done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
              {s.label} {s.done ? '서명 완료' : '서명 대기'}
            </span>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
