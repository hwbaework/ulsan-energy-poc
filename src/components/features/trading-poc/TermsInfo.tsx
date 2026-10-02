'use client';

import type { ReactNode } from 'react';
import type { Contract, TradeRequest } from '@/types/trading-poc';
import { estimateMonthlyKwh, fmtKw, fmtKwh, fmtNum, kindLabel, totalCostOf } from './meta';
import { Info } from './Bits';

const won = (n: number) => `₩${fmtNum(Math.round(n))}`;

/** 조건 협의에서 그 자리에서 고치는 칸 — 주면 그 칸은 입력으로 바뀐다 */
export type TermsEdit = Partial<
  Record<'capacity' | 'term' | 'installUnit' | 'extraCost' | 'omRatePct' | 'segments', ReactNode>
>;

/**
 * 신청 내용 — 거래 신청에서 넣은 값. 거래 이력 · 거래 승인 · 내 계약이 같은 칸으로 보여 준다.
 * 3열 그리드 안에 넣는 칸들(Fragment). edit 를 주면 조건 칸은 입력으로(조건 협의).
 *  - 자가소비: 설치 가능 단가 · 추가 시공비 → 예상 설치비(총사업비), 연간 O&M(총사업비 대비 %)
 *  - onsite : 1구간 · 2구간 단가, 사용분 × 단가
 */
export function TermsInfo({ x, edit }: { x: TradeRequest | Contract; edit?: TermsEdit }) {
  const self = x.kind === 'SELF_CONSUMPTION';
  const total = totalCostOf(x);
  const annualOm = x.omRatePct ? (total * x.omRatePct) / 100 : 0;
  const monthlyKwh = estimateMonthlyKwh(x.capacityKw);
  const firstPrice = x.segments?.[0]?.price ?? x.unitPrice;
  const surveyDoneAt = 'surveyDoneAt' in x ? x.surveyDoneAt : undefined;
  return (
    <>
      <Info label="계약 유형" value={kindLabel(x.kind)} />
      <Info label="기업명" value={x.consumerCompanyName} />
      <div />
      <Info label="기업 주소" value={x.address} className="col-span-3" />
      {edit?.capacity ?? <Info label="설치 용량" value={fmtKw(x.capacityKw)} />}
      {edit?.term ?? <Info label="계약 기간" value={`${x.termYears}년`} />}
      <Info label="O&M" value={x.omIncluded ? '포함 (필수)' : undefined} />
      <Info label="요금제" value={x.tariffPlan} />
      <Info label="요금 기준" value={x.tariffBasis} />
      <Info label="무료진단" value={x.reviewNo} />
      {self ? (
        <>
          <Info label="예상 설치단가 (무료진단)" value={x.estInstallUnit ? `${won(x.estInstallUnit)}/kW` : undefined} />
          {edit?.installUnit ?? (
            <Info label="설치 가능 단가" value={x.installUnit ? `${won(x.installUnit)}/kW` : undefined} />
          )}
          {edit?.extraCost ?? <Info label="추가 시공비" value={x.extraCost != null ? won(x.extraCost) : undefined} />}
          <Info label="예상 설치비" value={total ? won(total) : undefined} />
          {edit?.omRatePct ?? (
            <Info label="연간 O&M (총사업비 대비)" value={x.omRatePct ? `${x.omRatePct}%` : undefined} />
          )}
          <Info label="연간 O&M" value={annualOm ? `${won(annualOm)} (월 ${won(annualOm / 12)})` : undefined} />
        </>
      ) : (
        <>
          {edit?.segments ?? (
            <Info
              label="구간 단가"
              value={
                x.segments?.length
                  ? x.segments
                      .map((g, i) => `${i + 1}구간 ${g.from}~${g.to}년차 ₩${fmtNum(g.price, 1)}/kWh`)
                      .join(' · ')
                  : `₩${fmtNum(x.unitPrice, 1)}/kWh`
              }
              className="col-span-3"
            />
          )}
          <Info label="예상 월 사용량" value={fmtKwh(monthlyKwh)} />
          <Info label="예상 월 납입료 (1구간)" value={won(monthlyKwh * firstPrice)} />
          <div />
        </>
      )}
      <Info
        label="현장 실측"
        value={
          surveyDoneAt
            ? `완료 ${surveyDoneAt}`
            : x.surveyRequested
              ? `요청${x.surveyDate ? ` · 희망일 ${x.surveyDate}` : ''}`
              : x.surveyRequested === false
                ? '요청 안 함'
                : undefined
        }
      />
      <Info
        label="담당자"
        value={x.contact ? [x.contact.name, x.contact.phone, x.contact.email].filter(Boolean).join(' · ') : undefined}
        className="col-span-2"
      />
    </>
  );
}
