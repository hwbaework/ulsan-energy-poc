'use client';

import type { ReactNode } from 'react';
import type { Contract, TradeRequest } from '@/types/trading-poc';
import { Checkbox } from '@/components/ui/Checkbox';
import { estimateMonthlyKwh, fmtKw, fmtNum, kindLabel, totalCostOf } from './meta';

const won = (n: number) => `₩${fmtNum(Math.round(n))}`;
import { Info } from './Bits';

/** 미팅 단계에서 그 자리에서 넣는 칸 — 주면 그 칸은 입력으로 바뀐다 */
export type TermsEdit = Partial<Record<'capacity' | 'term' | 'price' | 'installUnit' | 'extraCost' | 'omRatePct' | 'tariffPlan' | 'peakR' | 'priceEsc', ReactNode>>;

/**
 * 신청 내용 — 거래 신청에서 넣은 것(유형 · 기업 · 주소 · 희망 용량 · 미팅 희망일 · 담당자)과
 * 미팅 뒤 관리자가 넣는 조건(설치 용량 · 계약 기간 · 단가). 거래 이력 · 거래 승인 · 내 계약이 같은 칸.
 *  - 두 유형 모두 설치 단가 · 추가 설치비용 → 예상 설치비(자가소비 기업 부담 · PPA EPC 부담), 연간 O&M(설치비 대비 %). PPA 는 단가(₩/kWh)도. 요금제 · 요금 기준은 없다(2026-10-12)
 */
export function TermsInfo({ x, edit }: { x: TradeRequest | Contract; edit?: TermsEdit }) {
  const self = x.kind === 'SELF_CONSUMPTION';
  const total = totalCostOf(x);
  const annualOm = x.omRatePct ? (total * x.omRatePct) / 100 : 0;
  return (
    <>
      <Info label="계약 유형" value={kindLabel(x.kind)} />
      <Info label="기업명" value={x.consumerCompanyName} />
      <div />
      <Info label="기업 주소" value={x.address} className="col-span-3" />
      {edit?.capacity ?? <Info label="설치 용량" value={x.capacityKw > 0 ? fmtKw(x.capacityKw) : undefined} />}
      {edit?.term ?? <Info label="계약 기간" value={x.termYears > 0 ? `${x.termYears}년` : undefined} />}
      {/* 실제 거래에 필요한 값 — 두 유형 모두: 설치 단가 · 추가 설치비용 → 예상 설치비, 연간 O&M. PPA 는 단가도(사용분 × 단가) */}
      {!self && (edit?.price ?? <Info label="PPA 단가" value={x.unitPrice > 0 ? `₩${fmtNum(x.unitPrice, 1)}/kWh` : undefined} />)}
      {!self && (edit?.priceEsc ?? <Info label="PPA 단가 상승률" value={x.priceEscalationPct != null ? `${x.priceEscalationPct}%/yr` : undefined} />)}
      {edit?.installUnit ?? <Info label="설치 단가" value={x.installUnit ? `${won(x.installUnit)}/kW` : undefined} />}
      {edit?.extraCost ?? <Info label="추가 설치비용" value={x.extraCost != null ? won(x.extraCost) : undefined} />}
      {edit?.omRatePct ?? <Info label="연간 O&M (설치비 대비)" value={x.omRatePct ? `${x.omRatePct}%` : undefined} />}
      {edit?.tariffPlan ?? <Info label="요금제" value={x.tariffPlan} />}
      {edit?.peakR ?? <Info label="피크감축 반영률" value={x.peakReductionPct != null ? `${x.peakReductionPct}%` : undefined} />}
      <Info label="O&M 포함" value={<Checkbox label="포함 (필수)" checked={!!x.omIncluded} onChange={() => {}} />} />
      <Info label="미팅 희망일" value={x.surveyDate} />
      <Info
        label="담당자"
        value={x.contact ? [x.contact.name, x.contact.phone, x.contact.email].filter(Boolean).join(' · ') : undefined}
      />
      {/* 마지막 — 그래서 얼마 드는지. 칸을 나눠서: 설치비 · 연간 O&M · (PPA) 월 사용료 */}
      <Info label={self ? '설치비 (기업 부담)' : '설치비 (EPC 부담)'} value={total ? won(total) : undefined} />
      <Info label="연간 O&M" value={annualOm ? `${won(annualOm)} (월 ${won(annualOm / 12)})` : undefined} />
      {self ? (
        <div />
      ) : (
        <Info
          label="월 사용료 (예상 사용량 × 단가)"
          value={x.unitPrice > 0 && x.capacityKw > 0 ? won(estimateMonthlyKwh(x.capacityKw) * x.unitPrice) : undefined}
        />
      )}
    </>
  );
}
