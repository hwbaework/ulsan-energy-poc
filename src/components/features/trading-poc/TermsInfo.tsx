'use client';

import type { ReactNode } from 'react';
import type { Contract, TradeRequest } from '@/types/trading-poc';
import { Checkbox } from '@/components/ui/Checkbox';
import { fmtKw, fmtNum, kindLabel, totalCostOf } from './meta';

const won = (n: number) => `₩${fmtNum(Math.round(n))}`;
import { Info } from './Bits';

/** 미팅 단계에서 그 자리에서 넣는 칸 — 주면 그 칸은 입력으로 바뀐다 */
export type TermsEdit = Partial<Record<'capacity' | 'term' | 'price' | 'installUnit' | 'extraCost' | 'omRatePct' | 'tariffPlan' | 'meetDate', ReactNode>>;

/**
 * 신청 내용 — 거래 신청에서 넣은 것(유형 · 기업 · 주소 · 희망 용량 · 미팅 희망일 · 담당자)과
 * 미팅 뒤 관리자가 넣는 조건(설치 용량 · 계약 기간 · 단가). 거래 이력 · 거래 승인 · 내 계약이 같은 칸.
 *  - 두 유형 모두 설치 단가 · 추가 설치비용 → 예상 설치비(자가소비 기업 부담 · PPA EPC 부담), 연간 O&M(설치비 대비 %). PPA 는 단가(₩/kWh)도. 요금제 · 요금 기준은 없다(2026-10-12)
 */
export function TermsInfo({ x, edit }: { x: TradeRequest | Contract; edit?: TermsEdit }) {
  const self = x.kind === 'SELF_CONSUMPTION';
  const total = totalCostOf(x);
  const hasTerms = !!x.installUnit || !!x.omRatePct || !!x.tariffPlan || x.unitPrice > 0;
  // 접수 · 미팅 중인 신청 — 값이 아직 없으면 빈칸 대신 '협의 후 작성'. 취소 · 반려는 조건 칸을 안 그린다
  const pending = 'status' in x && (x.status === 'SUBMITTED' || x.status === 'REVIEW');
  const LATER = '협의 후 작성'; // 현업이 미팅해서 정한 뒤 넣는다
  const cell = (editNode: ReactNode | undefined, label: string, value?: string) =>
    editNode ?? (value !== undefined && value !== '' ? <Info label={label} value={value} /> : pending ? <Info label={label} value={LATER} /> : null);
  return (
    <>
      <Info label="계약 유형" value={kindLabel(x.kind)} />
      <Info label="기업명" value={x.consumerCompanyName} />
      <div />
      <Info label="기업 주소" value={x.address} className="col-span-3" />
      {edit?.capacity ?? <Info label="설치 용량" value={x.capacityKw > 0 ? fmtKw(x.capacityKw) : undefined} />}
      {cell(edit?.term, '계약 기간', x.termYears > 0 ? `${x.termYears}년` : undefined)}
      {/* 실제 거래에 필요한 값 — 두 유형 모두: 설치 단가 · 추가 설치비용 → 예상 설치비, 연간 O&M. PPA 는 단가도(사용분 × 단가) */}
      {/* 조건 칸 — 넣는 중이거나 값이 있을 때만. 취소 · 반려 · 미팅 전처럼 값이 없으면 아예 안 보인다 */}
      {!self && cell(edit?.price, 'PPA 단가', x.unitPrice > 0 ? `₩${fmtNum(x.unitPrice, 1)}/kWh` : undefined)}
      {cell(edit?.installUnit, '설치 단가', x.installUnit ? `${won(x.installUnit)}/kW` : undefined)}
      {cell(edit?.extraCost, '추가 설치비용', x.extraCost != null ? won(x.extraCost) : undefined)}
      {cell(edit?.omRatePct, '연간 O&M (설치비 대비)', x.omRatePct ? `${x.omRatePct}%` : undefined)}
      {cell(edit?.tariffPlan, '요금제', x.tariffPlan)}
      {(edit || hasTerms || pending) && <Info label="O&M 포함" value={<Checkbox label="포함 (설치비에 포함 · 필수)" checked={!!x.omIncluded} onChange={() => {}} />} />}
      {/* 설치비 — 민감한 금액이라 색으로만 살짝 포인트. O&M 은 설치비에 포함이라 따로 금액 없음. 월 사용료는 실제 쓴 만큼 내는 거라 미리 적지 않는다 */}
      {(total > 0 || pending) && (
        <Info label="설치비 (O&M 포함)" value={total ? <span className="font-semibold text-emerald-300 tabular-nums">{won(total)}</span> : LATER} className="col-span-3" />
      )}
      {/* 맨 아래 — 미팅일 · 담당자 */}
      {edit?.meetDate ?? (x.surveyDate ? <Info label={'status' in x && x.status === 'SUBMITTED' ? '미팅 희망일' : '미팅일'} value={x.surveyDate} className="col-span-3" /> : null)}
      {x.contact && (
        <>
          <Info label="담당자" value={x.contact.name} />
          <Info label="연락처" value={x.contact.phone} />
          <Info label="이메일" value={x.contact.email} />
        </>
      )}
    </>
  );
}
