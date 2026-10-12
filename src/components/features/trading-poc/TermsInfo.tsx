'use client';

import type { ReactNode } from 'react';
import type { Contract, TradeRequest } from '@/types/trading-poc';
import { fmtKw, fmtNum, kindLabel } from './meta';
import { Info } from './Bits';

/** 미팅 단계에서 그 자리에서 넣는 칸 — 주면 그 칸은 입력으로 바뀐다 */
export type TermsEdit = Partial<Record<'capacity' | 'term' | 'price', ReactNode>>;

/**
 * 신청 내용 — 거래 신청에서 넣은 것(유형 · 기업 · 주소 · 희망 용량 · 미팅 희망일 · 담당자)과
 * 미팅 뒤 관리자가 넣는 조건(설치 용량 · 계약 기간 · 단가). 거래 이력 · 거래 승인 · 내 계약이 같은 칸.
 *  - 자가소비: 운영관리 단가(₩/kWh) × 발전량 / PPA: PPA 단가(₩/kWh) × 사용량. 설치비 · O&M% · 요금제는 없다(2026-10-12)
 */
export function TermsInfo({ x, edit }: { x: TradeRequest | Contract; edit?: TermsEdit }) {
  const self = x.kind === 'SELF_CONSUMPTION';
  const surveyDoneAt = 'surveyDoneAt' in x ? x.surveyDoneAt : undefined;
  return (
    <>
      <Info label="계약 유형" value={kindLabel(x.kind)} />
      <Info label="기업명" value={x.consumerCompanyName} />
      <div />
      <Info label="기업 주소" value={x.address} className="col-span-3" />
      {edit?.capacity ?? <Info label="설치 용량" value={x.capacityKw > 0 ? fmtKw(x.capacityKw) : undefined} />}
      {edit?.term ?? <Info label="계약 기간" value={x.termYears > 0 ? `${x.termYears}년` : undefined} />}
      {edit?.price ?? (
        <Info label={self ? '운영관리 단가' : 'PPA 단가'} value={x.unitPrice > 0 ? `₩${fmtNum(x.unitPrice, 1)}/kWh` : undefined} />
      )}
      <Info label="O&M" value={x.omIncluded ? '포함 (필수)' : undefined} />
      <Info label="미팅" value={surveyDoneAt ? `완료 ${surveyDoneAt}` : x.surveyDate ? `희망일 ${x.surveyDate}` : undefined} />
      <Info
        label="담당자"
        value={x.contact ? [x.contact.name, x.contact.phone, x.contact.email].filter(Boolean).join(' · ') : undefined}
      />
    </>
  );
}
