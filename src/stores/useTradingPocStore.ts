/**
 * 전력거래 POC 스토어 — 신청·계약·변경해지·문서 전부를 브라우저(localStorage)에 들고,
 * 화면의 모든 행동(검토·승인·서명·변경·문서 등록)이 즉시 반영된다.
 * 시드 버전이 바뀌면 저장된 데모 데이터를 버리고 새 시드로 시작한다.
 *
 * 정적 export 라 서버에서는 시드 그대로, 브라우저에서 useHydrateTradingPoc() 가 저장본을 올린다.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useEffect } from 'react';
import { ssrSafeStorage } from '@/lib/ssr-storage';
import type { PlantContractKind } from '@/types/monitoring';
import type { PpaSettlement } from '@/types/ppa';
import type {
  ChangeSign,
  ChangeTerms,
  SignMark,
  ChangeStage,
  ChangeType,
  Contract,
  ContractTerms,
  ContractChange,
  DocCategory,
  Party,
  TradeDocument,
  TradeRequest,
  TradeRequestStatus,
} from '@/types/trading-poc';
import { signatureImage } from '@/lib/demo-signature';

export const SEED_VERSION = 113; // 2026-11-24 PPA 계약만 있는 기업 미포테크(100 kW, CT-2026-0016). 112 — 2026-11-20 청구서 알림 데모 다시 시작(발행 예정 D-5 · 발행). 111 — 2026-11-20 납부 기한 = 청구일 + 30일 이상. 110 — 2026-11-20 수익 · 정산 데모 2026-05부터. 109 — 2026-11-20 청구서 2026-10 발행 전(청구일 2026-11-25) · 2026-09 납부 대기, 기본 청구일 익월 10일. 108 — 2026-11-19 세금계산서 데모 원본에 샘플 표시. 107 — 2026-11-19 세금계산서 원본은 관리자가 올림(확정). 106 — 2026-11-19 세금계산서 원본은 관리자가 올림. 105 — 2026-11-19 변경 데모 신청 접수 글자를 변경 조건 꼴로. 104 — 2026-11-19 승인 알림 — 두 건은 기업이 마지막 서명(관리자가 받음). 103 — 2026-11-19 변경 데모 이력에서 옛 단계(조건 입력 · 조건 동의) 뺌. 102 — 2026-11-19 변경·해지 합의서 서명도 펜으로 그린 사인. 101 — 2026-11-19 조건 변경 데모 4건 모두 바뀐 칸 2개. 100 — 2026-11-19 고쳐 보낸 건 협의 채팅에 조건 확정 줄. 99 — 2026-11-19 관리자 → 기업 건은 로그인 계정 있는 기업(한길 · 한일튜브)으로. 98 — 2026-11-19 조건 변경 4가지 추가(신청 단계 = 신청 4 + 조건 변경 4). 97 — 2026-11-19 변경 신청 자가소비 · PPA × 양방향(4건 모두 신청). 96 — 2026-11-19 변경 신청 단계 4건만(자가소비 · PPA × 받는 쪽). 95 — 2026-11-18 전자서명도 자가소비 · PPA × 방향 하나씩(관리자 신청 · 기업 동의 건). 94 — 2026-11-18 변경 신청은 자가소비 · PPA × 받는 쪽 하나씩, 나머지는 조건 변경 4가지. 93 — 2026-11-18 변경 항목 기간 · 단가 · 연간 O&M 셋, 용량 변경 데모 → O&M. 92 — 2026-11-18 희망 해지일 · 변경 적용일 없음. 91 — 2026-11-18 변경에 조건 확정 없음 — 조건 변경 팝업에서 고쳐 바로 보냄. 90 — 2026-11-18 변경 3단계(신청 → 전자서명 → 승인), 조건 변경은 누른 쪽이 고침. 89 — 2026-11-18 변경은 구분 하나(단가 · 용량 · 기간 → 변경), 요금제 데모 선택Ⅰ. 88 — 2026-11-18 관리자 신청 변경 PPA · 해지 자가소비 추가(신청 8가지). 87 — 2026-11-18 관리자가 신청한 변경 · 해지 데모. 86 — 2026-11-18 변경·해지 모든 경우, 취소 뺌, 예전 PPA 계약(해지). 85 — 2026-11-18 데모 서명은 사람 이름의 펜 서명(직접 서명). 84 — 2026-11-18 한일튜브 PPA 새 승인 건 빼고 원래 계약에 신규. 83 — 2026-11-18 건호이엔씨 옛 계약 · 옛 신청 · 해지 신청 뺌(신규 승인과 중복). 82 — 2026-11-18 최근 승인 2건(건호이엔씨 자가소비 · 한일튜브 PPA) — 거래 승인 '신규'. 79 — 2026-11-18 최근 승인 2건 뺌(건호이엔씨 · 한일튜브 PPA 계약 중복). 80 — 2026-11-18 최근 승인 2건(건호이엔씨 자가소비 · 한일튜브 PPA) — 거래 승인 '신규'. 79 — 2026-11-17 자동 채팅 글 짧게. 78 — 2026-11-17 조건 변경은 누른 쪽이 고쳐 다시 확정(termsConfirmedBy), 상대는 바뀐 칸 보고 동의. 77 — 2026-11-17 '확정 취소' → '조건 변경'. 76 — 2026-11-17 전자서명 4건(자가소비 · PPA × 관리자 먼저 / 기업 먼저), 둘 다 서명 전(건호이엔씨 · 한일튜브 PPA) 뺌. 75 — 2026-11-17 전자서명 경우의 수 4건(한길 · 용인금속 · 한일튜브 PPA 2) 추가, 반려는 2건(자가소비 · PPA)만. 74 — 2026-11-17 미팅 4가지(자가소비 · PPA × 보낸 것 · 받은 것) — PPA 조건 변경로 돌아온 건(id 21). 73 — 2026-11-17 한일튜브 PPA(id 5) 조건 변경 뒤 다시 확정 — 발전사업자 화면에서 바뀐 칸 표시. 72 — 2026-11-17 조건 변경는 양쪽 확인창(사유 칸 없음, 이유는 채팅). 71 — 2026-11-17 용인금속(id 20) 조건 변경 뒤 다시 확정 — 바뀐 연간 O&M 노란색. 70 — 2026-11-17 조건 변경(관리자 · 기업 양쪽, 사유 → 미팅으로) — 태성산업(id 15)이 조건 변경한 샘플. 69 — 2026-11-17 자가소비 조건 확정(용인금속) · 해지 반려(태성산업) 샘플 — 알림마다 그 상태의 줄이 있게. 68 — 2026-10-14 세금계산서 원본 1건(한일튜브 PPA 2026-09). 67 — 2026-10-14 변경·해지 신청은 모두 기업(태성산업 · 한길 · 용인금속 진행 이력). 66 — 2026-10-14 받는 쪽은 변경 동의 / 해지 동의, 승인은 마지막에만. 65 — 2026-10-13 관리자는 변경·해지 신청 안 함(받아서 승인 · 반려 · 서명만), 신청 단계엔 합의서 · 서명 없음. 63 — 2026-10-13 한일튜브 해지 신청(CH-2026-0014). 62 — 2026-10-13 관리자가 신청한 해지(용인금속, 전자서명 1/2). 61 — 2026-10-13 해지: 신청 → 전자서명 → 해지 승인, 문서 분류 변경 합의서 · 해지 합의서. 60 — 2026-10-13 해지 완료 1건(한길 예전 계약 CT-2024-0001 · CH-2025-0001). 59 — 2026-10-13 해지 3칸 · 상태 해지. 58 — 2026-10-13 신청 상태 PPA(CH-2026-0012) 추가. 57 — 2026-10-13 변경 조건은 지금 계약 값으로 시작. 56 — 2026-10-13 변경: 변경 동의 → 조건 입력(관리자) → 조건 동의 → 전자서명 → 승인. 55 — 2026-10-13 변경·해지 동의 → 변경 동의 / 해지 동의. 54 — 2026-10-13 승인된 변경·해지 합의서(서명본) 시드. 53 — 2026-10-13 변경·해지도 신청 접수 → 동의 → 전자서명 → 승인 완료. 52 — 2026-10-13 진행 이력 조건 동의(관리자 · 신청한 쪽) → 전자서명 → 승인 완료, 표시 SPC → 관리자. 51 — 2026-10-13 진행 이력 '승인'은 양측 서명 완료만, 동의는 '조건 동의'. 50 — 2026-10-13 서명 흔적(그림 · 이름) 저장. 49 — 2026-10-13 전자서명 자가소비(건호) · PPA(한일튜브) 1건씩. 48 — 2026-10-13 연간 O&M % → 금액(원/년). 47 — 2026-10-13 신청 상태 자가소비(한길) · PPA(한일튜브) 1건씩. 46 — 2026-10-12 거래 5단계(접수 → 미팅 → 승인 → 전자서명 → 체결) · 조건 = 용량 · 기간 · 단가 하나 (저장본 다시 시작)

/* ── 회사 (로그인 계정은 useAuthStore 와 동일: 1 SPC(관리자) · 2 한길(전기사용자) · 4 한일튜브(발전사업자)) ───────── */
export const CO = {
  SPC: { id: 1, name: '울산 에너지 플랫폼' },
  CONSUMER_LOGIN: { id: 2, name: '한길' }, // 데모 전기사용자 계정 = 한길
  HANIL: { id: 4, name: '한일튜브' }, // 데모 발전사업자 계정 = 한일튜브
  YONGIN: { id: 5, name: '용인금속' },
  TAESUNG: { id: 6, name: '태성산업' },
  GUNHO: { id: 7, name: '건호이엔씨' },
  MIPO: { id: 9, name: '미포테크' }, // PPA 계약만 있는 기업 — 데모 기업(실제 대상 5곳 아님, 2026-11-24 사용자)
  TEST: { id: 8, name: '테스트 기업' }, // 가입만 한 기업 — 계약 없음(2026-11-24 사용자)
} as const;

/** 발전사업자 선택지 (관리자 대리 등록용) — 에스에너지는 EPC(시공)라 발전사업자가 아니다 */
export const GENERATOR_COMPANIES = [CO.HANIL, CO.SPC];

/** 가입한 기업 — 거래 신청의 기업 선택. 실제 대상 5곳(주소는 통합관제 발전소 주소와 같다) + 가입만 하고 계약이 없는 테스트 기업 */
export const CONSUMERS: { id: number; name: string; address: string }[] = [
  { ...CO.CONSUMER_LOGIN, address: '울산 남구 용연동 490-11' },
  { ...CO.TAESUNG, address: '울산 남구 여천동 358-8' },
  { ...CO.GUNHO, address: '울산 남구 부곡동 22-5' },
  { ...CO.HANIL, address: '울산 남구 부곡동 273-6' },
  { ...CO.YONGIN, address: '울산 남구 여천동 887-18' },
  { ...CO.MIPO, address: '울산 남구 여천로 120' },
  { ...CO.TEST, address: '울산 남구 처용로 8' },
];
/** 계약 기간 기본값 — onsite 20년 · 자가소비 10년 */
export const defaultTermYears = (kind: PlantContractKind) => (kind === 'ONSITE' ? 20 : 10);

const DEFAULT_PRICE: Record<PlantContractKind, number> = { ONSITE: 138, SELF_CONSUMPTION: 28 };
export const defaultUnitPrice = (kind: PlantContractKind) => DEFAULT_PRICE[kind];

const iso = (d: string, t = '09:00:00') => `${d}T${t}`;
/** 오늘(이 PC 시각)에서 n일 전 — 최근 승인 데모가 언제 열어도 '신규'(7일 안)로 보이게 */
const daysAgoIso = (n: number, t = '10:00:00') => {
  const d = new Date(Date.now() - n * 86_400_000);
  return `${new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)}T${t}`;
};
/** 계약의 지금 조건 — 변경 조건의 '현재' */
export const changeTermsOf = (c: Contract): ChangeTerms => ({
  capacityKw: c.capacityKw,
  termYears: c.termYears,
  unitPrice: c.kind === 'ONSITE' ? c.unitPrice : 0,
  installUnit: c.installUnit,
  extraCost: c.extraCost ?? 0,
  omAnnual: c.omAnnual,
  tariffPlan: c.tariffPlan,
});
/** 바뀐 칸만 한 줄로 — '단가 ₩138 → ₩140 · 계약 기간 20년 → 22년' */
export function changeSummary(before: ChangeTerms, after: ChangeTerms, kind: Contract['kind']): string {
  const w = (n?: number) => `₩${Math.round(n ?? 0).toLocaleString('ko-KR')}`;
  const out: string[] = [];
  if (before.termYears !== after.termYears) out.push(`계약 기간 ${before.termYears}년 → ${after.termYears}년`);
  if (kind === 'ONSITE' && before.unitPrice !== after.unitPrice) out.push(`PPA 단가 ₩${before.unitPrice} → ₩${after.unitPrice}/kWh`);
  if ((before.omAnnual ?? 0) !== (after.omAnnual ?? 0)) out.push(`연간 O&M ${w(before.omAnnual)} → ${w(after.omAnnual)}/년`);
  return out.join(' · ');
}
/** 시드 — 예전 단가 · 용량 · 기간 변경을 '변경' 하나로. 신청 값(terms)이 없으면 바꾸자던 한 칸을 지금 조건에 얹는다 */
function asOneChange(ch: ContractChange, contracts: Contract[]): ContractChange {
  if (ch.type === 'TERMINATE' || ch.type === 'CHANGE') return ch;
  const c = contracts.find((x) => x.id === ch.contractId);
  if (!c) return ch;
  const termsBefore = ch.termsBefore ?? changeTermsOf(c);
  const terms = ch.stage === 'TERMS' || !ch.terms ? termsFromRequest(c, ch) : ch.terms;
  return { ...ch, type: 'CHANGE', termsBefore, terms };
}
/** 시드 — 변경 3단계로 맞춤(누가 값을 보냈는지 · 고치는 중인지) */
function asThreeStep(ch: ContractChange): ContractChange {
  if (ch.type !== 'CHANGE' || ch.status !== 'REQUESTED' || ch.stage === 'SIGN') return ch;
  if (ch.stage === 'TERMS') return { ...ch, stage: 'AGREE', proposedBy: ch.requestedBy, editingBy: undefined };
  if (ch.stage === 'AGREE') return { ...ch, proposedBy: ch.proposedBy ?? 'spc' };
  return { ...ch, stage: 'AGREE', proposedBy: ch.proposedBy ?? ch.requestedBy };
}
/** 요청에서 바꾸자는 값을 지금 조건에 얹은 것 — 관리자 조건 입력의 시작값 */
export function termsFromRequest(c: Contract, ch: Pick<ContractChange, 'type' | 'after'> & { terms?: ChangeTerms }): ChangeTerms {
  const t = changeTermsOf(c);
  if (ch.type === 'CHANGE') return ch.terms ? { ...ch.terms } : t;
  const v = Number(ch.after);
  if (ch.type === 'PRICE' && Number.isFinite(v)) return c.kind === 'ONSITE' ? { ...t, unitPrice: v } : { ...t, omAnnual: v };
  if (ch.type === 'CAPACITY' && Number.isFinite(v)) return { ...t, capacityKw: v };
  if (ch.type === 'TERM' && ch.after) {
    // 종료일 → 계약 기간(년) — 시작일부터 종료일 다음 날까지
    const years = Math.round((new Date(ch.after).getTime() + 86_400_000 - new Date(c.startDate).getTime()) / (365.25 * 86_400_000));
    return { ...t, termYears: Math.max(1, years) };
  }
  return t;
}
const addYears = (date: string, years: number) => {
  const [y = 2026, m = 1, d = 1] = date.split('-').map(Number);
  const end = new Date(Date.UTC(y + years, m - 1, d));
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
};
const ev = (at: string, by: Party, label: string, note?: string) => ({
  at,
  by,
  label,
  ...(note ? { note } : {}),
});

/* ── 시드: 체결 = 실제 6건(자가소비 5 · onsite 1) / 상태별 샘플 1건씩(실제 기업·용량·조건) ───────────────────────────────────────── */
/** 시드 계약 조건 — 두 유형 모두 설치 단가 ₩1,350,000/kW · 연간 O&M 금액 = 설치비의 1%(원 단위), PPA 단가는 계약의 unitPrice */
export function seedTermsOf(x: { kind: PlantContractKind; unitPrice: number; termYears: number; capacityKw: number }): ContractTerms {
  const installUnit = 1_350_000;
  return { installUnit, extraCost: 0, omAnnual: Math.round(x.capacityKw * installUnit * 0.01), tariffPlan: '고압A 선택Ⅱ', omIncluded: true };
}

/** 기업 쪽 서명한 사람 — 한길 이수용 · 한일튜브 박발전(데모 계정), 나머지는 기업 정보의 대표자 */
const SIGNER_OF: Record<number, string> = { 2: '이수용', 4: '박발전', 5: '정용인', 6: '강태성', 7: '윤건호', 9: '오세진' };
/** 데모 서명 — 펜으로 그린 사인(직접 서명) */
const penMark = (person: string, at: string) => ({ method: 'draw' as const, image: signatureImage(person), person, at });
function seedContracts(): Contract[] {
  const base = (
    c: Omit<Contract, 'endDate' | 'createdAt' | 'address'> & { address?: string },
  ): Contract => ({
    address: '울산광역시',
    ...c,
    endDate: addYears(c.startDate, c.termYears),
    createdAt: iso(c.startDate),
    ...seedTermsOf(c),
    // 시드 체결 계약 — 서명한 사람이 펜으로 그린 서명(작업 규칙: 서명 표시는 이름 (회사)). 관리자 쪽 김관리, 기업 쪽은 그 기업 담당
    ...(c.signedByGenerator && !c.signMarkGenerator ? { signMarkGenerator: penMark('김관리', c.signedAt ?? iso(c.startDate)) } : {}),
    ...(c.signedByConsumer && !c.signMarkConsumer ? { signMarkConsumer: penMark(SIGNER_OF[c.consumerCompanyId] ?? c.consumerCompanyName, c.signedAt ?? iso(c.startDate)) } : {}),
  });
  return [
    base({
      id: 1,
      no: 'CT-2025-0001',
      requestId: 1,
      kind: 'ONSITE',
      plantId: 17514,
      plantName: '한일튜브(PPA)',
      generatorCompanyId: CO.SPC.id,
      generatorCompanyName: CO.SPC.name,
      consumerCompanyId: 4,
      consumerCompanyName: CO.HANIL.name,
      siteName: '한일튜브 울산공장',
      address: '울산 남구 부곡동 273-6',
      capacityKw: 329.6,
      unitPrice: 138,
      termYears: 20,
      startDate: '2025-03-01',
      status: 'ACTIVE',
      signedByGenerator: true,
      signedByConsumer: true,
      // 알림 샘플 — 승인 알림이 가리키는 건이라 승인일을 최근으로(거래 승인 '신규')
      signedAt: daysAgoIso(1, '11:00:00'),
    }),
    base({
      id: 2,
      no: 'CT-2025-0002',
      requestId: 2,
      kind: 'SELF_CONSUMPTION',
      plantId: 17514,
      plantName: '한일튜브(자가소비)',
      generatorCompanyId: CO.SPC.id,
      generatorCompanyName: CO.SPC.name,
      consumerCompanyId: 4,
      consumerCompanyName: CO.HANIL.name,
      siteName: '한일튜브 울산공장',
      address: '울산 남구 부곡동 273-6',
      capacityKw: 99.84,
      unitPrice: 28,
      termYears: 20,
      startDate: '2025-03-01',
      status: 'ACTIVE',
      signedByGenerator: true,
      signedByConsumer: true,
      signedAt: iso('2025-02-20', '14:35:00'),
    }),
    base({
      id: 3,
      no: 'CT-2025-0003',
      requestId: 3,
      kind: 'SELF_CONSUMPTION',
      plantId: 17515,
      plantName: '한길',
      generatorCompanyId: 1,
      generatorCompanyName: CO.SPC.name,
      consumerCompanyId: 2,
      consumerCompanyName: CO.CONSUMER_LOGIN.name,
      siteName: '한길',
      address: '울산 남구 용연동 490-11',
      capacityKw: 90.88,
      unitPrice: 28,
      termYears: 20,
      startDate: '2025-05-01',
      status: 'ACTIVE',
      signedByGenerator: true,
      signedByConsumer: true,
      signedAt: iso('2025-04-18', '11:00:00'),
    }),
    base({
      id: 4,
      no: 'CT-2024-0004',
      requestId: 10,
      kind: 'SELF_CONSUMPTION',
      plantId: 17511,
      plantName: '용인금속',
      generatorCompanyId: 1,
      generatorCompanyName: CO.SPC.name,
      consumerCompanyId: 5,
      consumerCompanyName: CO.YONGIN.name,
      siteName: '용인금속 울산공장',
      address: '울산 남구 여천동 887-18',
      capacityKw: 152.32,
      unitPrice: 26,
      termYears: 20,
      startDate: '2024-09-01',
      status: 'ACTIVE',
      signedByGenerator: true,
      signedByConsumer: true,
      signedAt: iso('2024-08-22', '10:10:00'),
    }),
    base({
      id: 5,
      no: 'CT-2024-0005',
      requestId: 11,
      kind: 'SELF_CONSUMPTION',
      plantId: 17512,
      plantName: '태성산업',
      generatorCompanyId: 1,
      generatorCompanyName: CO.SPC.name,
      consumerCompanyId: 6,
      consumerCompanyName: CO.TAESUNG.name,
      siteName: '태성산업 본사',
      address: '울산 남구 여천동 358-8',
      capacityKw: 46.08,
      unitPrice: 26,
      termYears: 20,
      startDate: '2024-11-01',
      status: 'ACTIVE',
      signedByGenerator: true,
      signedByConsumer: true,
      signedAt: iso('2024-10-25', '15:40:00'),
    }),
    // 거래 승인 — 전자서명: 기업 서명 끝, 관리자 서명 남음(자가소비 · PPA × 관리자 먼저 / 기업 먼저 4건은 아래와 함께)
    {
      ...base({
        id: 8,
        no: 'CT-2026-0008',
        requestId: 17,
        kind: 'ONSITE',
        plantName: '한일튜브(PPA)',
        generatorCompanyId: CO.SPC.id,
        generatorCompanyName: CO.SPC.name,
        consumerCompanyId: 4,
        consumerCompanyName: CO.HANIL.name,
        siteName: '한일튜브 울산공장',
        address: '울산 남구 부곡동 273-6',
        capacityKw: 200,
        unitPrice: 138,
        termYears: 20,
        startDate: '2026-12-01',
        status: 'PENDING_SIGN',
        signedByGenerator: false,
        signedByConsumer: true,
        signMarkConsumer: penMark('박발전', iso('2026-09-23', '11:00:00')),
      }),
      createdAt: iso('2026-09-22', '15:00:00'),
    },
    // 전자서명 경우의 수 — 서명 대기 계약. 자가소비 · PPA × 관리자 먼저 / 기업 먼저(둘 다 서명 전은 양쪽 다 '확인'이라 기업 먼저와 같아 두지 않음)
    {
      ...base({
        id: 10,
        no: 'CT-2026-0010',
        requestId: 22,
        kind: 'SELF_CONSUMPTION',
        plantName: '한길',
        generatorCompanyId: CO.SPC.id,
        generatorCompanyName: CO.SPC.name,
        consumerCompanyId: 2,
        consumerCompanyName: CO.CONSUMER_LOGIN.name,
        siteName: '한길',
        address: '울산 남구 용연동 490-11',
        capacityKw: 90.88,
        unitPrice: 26,
        termYears: 20,
        startDate: '2026-11-01',
        status: 'PENDING_SIGN',
        signedByGenerator: false,
        signedByConsumer: true,
        signMarkConsumer: penMark('이수용', iso('2026-09-26', '10:00:00')),
      }),
      createdAt: iso('2026-09-24', '15:00:00'),
    },
    {
      ...base({
        id: 11,
        no: 'CT-2026-0011',
        requestId: 23,
        kind: 'SELF_CONSUMPTION',
        plantName: '용인금속',
        generatorCompanyId: CO.SPC.id,
        generatorCompanyName: CO.SPC.name,
        consumerCompanyId: CO.YONGIN.id,
        consumerCompanyName: CO.YONGIN.name,
        siteName: '용인금속 울산공장',
        address: '울산 남구 여천동 887-18',
        capacityKw: 152.32,
        unitPrice: 26,
        termYears: 20,
        startDate: '2026-11-01',
        status: 'PENDING_SIGN',
        signedByGenerator: true,
        signedByConsumer: false,
        signMarkGenerator: penMark('김관리', iso('2026-09-27', '09:30:00')),
      }),
      createdAt: iso('2026-09-25', '15:00:00'),
    },
    {
      ...base({
        id: 13,
        no: 'CT-2026-0013',
        requestId: 25,
        kind: 'ONSITE',
        plantName: '한일튜브(PPA)',
        generatorCompanyId: CO.SPC.id,
        generatorCompanyName: CO.SPC.name,
        consumerCompanyId: 4,
        consumerCompanyName: CO.HANIL.name,
        siteName: '한일튜브 울산공장',
        address: '울산 남구 부곡동 273-6',
        capacityKw: 329.6,
        unitPrice: 138,
        termYears: 20,
        startDate: '2026-12-01',
        status: 'PENDING_SIGN',
        signedByGenerator: true,
        signedByConsumer: false,
        signMarkGenerator: penMark('김관리', iso('2026-09-28', '10:00:00')),
      }),
      createdAt: iso('2026-09-27', '15:00:00'),
    },
    // 최근 승인 — 거래 승인 목록에서 '신규'(승인 7일 안). 자가소비 건호이엔씨(PPA 는 CT-2025-0001 의 승인일을 최근으로)
    {
      ...base({
        id: 7,
        no: 'CT-2026-0007',
        requestId: 4,
        kind: 'SELF_CONSUMPTION',
        plantId: 17513,
        plantName: '건호이엔씨',
        generatorCompanyId: CO.SPC.id,
        generatorCompanyName: CO.SPC.name,
        consumerCompanyId: 7,
        consumerCompanyName: CO.GUNHO.name,
        siteName: '건호이엔씨 공장',
        address: '울산 남구 부곡동 22-5',
        capacityKw: 33.92,
        unitPrice: 26,
        termYears: 20,
        startDate: firstOfNextMonth(),
        status: 'ACTIVE',
        signedByGenerator: true,
        signedByConsumer: true,
        signedAt: daysAgoIso(2, '15:00:00'),
      }),
      createdAt: daysAgoIso(4, '16:00:00'),
    },
    // PPA 계약만 있는 기업 — 미포테크 100 kW
    base({
      id: 16,
      no: 'CT-2026-0016',
      requestId: 26,
      kind: 'ONSITE',
      plantId: 17516,
      plantName: '미포테크',
      generatorCompanyId: CO.SPC.id,
      generatorCompanyName: CO.SPC.name,
      consumerCompanyId: CO.MIPO.id,
      consumerCompanyName: CO.MIPO.name,
      siteName: '미포테크 공장',
      address: '울산 남구 여천로 120',
      capacityKw: 100,
      unitPrice: 138,
      termYears: 20,
      startDate: '2026-07-01',
      status: 'ACTIVE',
      signedByGenerator: true,
      signedByConsumer: true,
      signedAt: iso('2026-06-19', '15:10:00'),
    }),
    // 해지 완료 — 한일튜브 예전 PPA 계약. 해지하고 지금 계약 CT-2025-0001 로 다시 맺음(PPA 해지 승인 경우)
    base({
      id: 15,
      no: 'CT-2024-0002',
      kind: 'ONSITE',
      plantName: '한일튜브(PPA)',
      generatorCompanyId: CO.SPC.id,
      generatorCompanyName: CO.SPC.name,
      consumerCompanyId: 4,
      consumerCompanyName: CO.HANIL.name,
      siteName: '한일튜브 울산공장',
      address: '울산 남구 부곡동 273-6',
      capacityKw: 329.6,
      unitPrice: 136,
      termYears: 20,
      startDate: '2024-03-01',
      status: 'TERMINATED',
      signedByGenerator: true,
      signedByConsumer: true,
      signedAt: iso('2024-02-20', '10:00:00'),
      terminatedAt: '2025-02-28',
    }),
    // 해지 완료 — 한길 예전 계약(같은 공장 · 같은 용량). 해지하고 지금 계약 CT-2025-0003 으로 다시 맺음
    base({
      id: 9,
      no: 'CT-2024-0001',
      kind: 'SELF_CONSUMPTION',
      plantId: 17515,
      plantName: '한길',
      generatorCompanyId: 1,
      generatorCompanyName: CO.SPC.name,
      consumerCompanyId: 2,
      consumerCompanyName: CO.CONSUMER_LOGIN.name,
      siteName: '한길',
      address: '울산 남구 용연동 490-11',
      capacityKw: 90.88,
      unitPrice: 28,
      termYears: 20,
      startDate: '2024-05-01',
      status: 'TERMINATED',
      signedByGenerator: true,
      signedByConsumer: true,
      signedAt: iso('2024-04-20', '10:00:00'),
      terminatedAt: '2025-04-30',
    }),
  ];
}

function seedRequests(): TradeRequest[] {
  const mk = (
    r: Omit<TradeRequest, 'events' | 'updatedAt' | 'no'> & {
      no?: string;
      events?: TradeRequest['events'];
      updatedAt?: string;
    },
  ): TradeRequest => ({
    // 조건은 미팅 뒤에 들어온다 — 미팅 전(접수 · 미팅 대기 · 취소 · 반려)은 비워 둔다
    ...(r.status === 'APPROVED' || r.status === 'SIGNED' || r.surveyDoneAt ? seedTermsOf(r) : { omIncluded: true }),
    ...r,
    no: r.no ?? `TR-${r.submittedAt.slice(0, 4)}-${String(r.id).padStart(4, '0')}`,
    updatedAt: r.updatedAt ?? r.submittedAt,
    events: r.events ?? [ev(r.submittedAt, r.applicant, '신청 접수')],
  });
  const signedEvents = (submitted: string, review: string, approved: string, signed: string) => [
    ev(submitted, 'generator', '신청 접수'),
    ev(review, 'spc', '미팅 확정'),
    ev(approved, 'spc', '조건 동의'),
    ev(approved, 'generator', '조건 동의', '계약서 초안 생성'),
    ev(signed, 'spc', '전자서명'),
    ev(signed, 'consumer', '전자서명'),
    ev(signed, 'spc', '승인 완료'),
  ];
  // 발전사업자 계정(한일튜브)이 신청한 건 — 계약 상대는 SPC
  const gen = {
    applicant: 'generator' as Party,
    applicantCompanyId: CO.HANIL.id,
    applicantCompanyName: CO.HANIL.name,
    generatorCompanyId: CO.SPC.id,
    generatorCompanyName: CO.SPC.name,
  };
  const spc = {
    applicant: 'spc' as Party,
    applicantCompanyId: 1,
    applicantCompanyName: CO.SPC.name,
    generatorCompanyId: 1,
    generatorCompanyName: CO.SPC.name,
  };
  return [
    // 체결 — 실제 계약 6건(자가소비 5 · onsite 1)
    mk({
      id: 1,
      ...gen,
      kind: 'ONSITE',
      plantId: 17514,
      plantName: '한일튜브(PPA)',
      consumerCompanyId: 4,
      consumerCompanyName: CO.HANIL.name,
      siteName: '한일튜브 울산공장',
      address: '울산 남구 부곡동 273-6',
      capacityKw: 329.6,
      unitPrice: 138,
      termYears: 20,
      status: 'SIGNED',
      contractId: 1,
      submittedAt: iso('2025-01-10'),
      updatedAt: iso('2025-02-20', '14:20:00'),
      events: signedEvents(
        iso('2025-01-10'),
        iso('2025-01-13'),
        iso('2025-01-27'),
        iso('2025-02-20', '14:20:00'),
      ),
      note: '한일튜브 울산공장 지붕 태양광 329.6kW — 전량 PPA 공급',
    }),
    mk({
      id: 26,
      applicant: 'generator' as Party,
      applicantCompanyId: CO.MIPO.id,
      applicantCompanyName: CO.MIPO.name,
      generatorCompanyId: CO.SPC.id,
      generatorCompanyName: CO.SPC.name,
      kind: 'ONSITE',
      plantId: 17516,
      plantName: '미포테크',
      consumerCompanyId: CO.MIPO.id,
      consumerCompanyName: CO.MIPO.name,
      siteName: '미포테크 공장',
      address: '울산 남구 여천로 120',
      capacityKw: 100,
      unitPrice: 138,
      termYears: 20,
      status: 'SIGNED',
      contractId: 16,
      submittedAt: iso('2026-05-11'),
      updatedAt: iso('2026-06-19', '15:10:00'),
      events: signedEvents(iso('2026-05-11'), iso('2026-05-14'), iso('2026-06-02'), iso('2026-06-19', '15:10:00')),
    }),
    mk({
      id: 2,
      ...gen,
      kind: 'SELF_CONSUMPTION',
      plantId: 17514,
      plantName: '한일튜브(자가소비)',
      consumerCompanyId: 4,
      consumerCompanyName: CO.HANIL.name,
      siteName: '한일튜브 울산공장',
      address: '울산 남구 부곡동 273-6',
      capacityKw: 99.84,
      unitPrice: 28,
      termYears: 20,
      status: 'SIGNED',
      contractId: 2,
      submittedAt: iso('2025-01-10', '09:20:00'),
      updatedAt: iso('2025-02-20', '14:35:00'),
      events: signedEvents(
        iso('2025-01-10', '09:20:00'),
        iso('2025-01-13'),
        iso('2025-01-27'),
        iso('2025-02-20', '14:35:00'),
      ),
      note: '한일튜브 자가소비 설비 99.84kW 설치·운영 관리',
    }),
    mk({
      id: 3,
      applicant: 'consumer',
      applicantCompanyId: 2,
      applicantCompanyName: CO.CONSUMER_LOGIN.name,
      generatorCompanyId: 1,
      generatorCompanyName: CO.SPC.name,
      kind: 'SELF_CONSUMPTION',
      plantId: 17515,
      plantName: '한길',
      consumerCompanyId: 2,
      consumerCompanyName: CO.CONSUMER_LOGIN.name,
      siteName: '한길',
      address: '울산 남구 용연동 490-11',
      capacityKw: 90.88,
      unitPrice: 28,
      termYears: 20,
      status: 'SIGNED',
      contractId: 3,
      submittedAt: iso('2025-03-15'),
      updatedAt: iso('2025-04-18', '11:00:00'),
      events: [
        ev(iso('2025-03-15'), 'consumer', '신청 접수'),
        ev(iso('2025-03-17'), 'spc', '미팅 확정'),
        ev(iso('2025-03-28'), 'spc', '조건 동의'),
        ev(iso('2025-03-28'), 'consumer', '조건 동의', '계약서 초안 생성'),
        ev(iso('2025-04-18', '10:40:00'), 'spc', '전자서명'),
        ev(iso('2025-04-18', '11:00:00'), 'consumer', '전자서명'),
        ev(iso('2025-04-18', '11:00:00'), 'spc', '승인 완료'),
      ],
    }),
    mk({
      id: 10,
      ...spc,
      kind: 'SELF_CONSUMPTION',
      plantId: 17511,
      plantName: '용인금속',
      consumerCompanyId: 5,
      consumerCompanyName: CO.YONGIN.name,
      siteName: '용인금속 울산공장',
      address: '울산 남구 여천동 887-18',
      capacityKw: 152.32,
      unitPrice: 26,
      termYears: 20,
      status: 'SIGNED',
      contractId: 4,
      submittedAt: iso('2024-07-15'),
      updatedAt: iso('2024-08-22', '10:10:00'),
      events: signedEvents(
        iso('2024-07-15'),
        iso('2024-07-17'),
        iso('2024-08-01'),
        iso('2024-08-22', '10:10:00'),
      ),
    }),
    mk({
      id: 11,
      ...spc,
      kind: 'SELF_CONSUMPTION',
      plantId: 17512,
      plantName: '태성산업',
      consumerCompanyId: 6,
      consumerCompanyName: CO.TAESUNG.name,
      siteName: '태성산업 본사',
      address: '울산 남구 여천동 358-8',
      capacityKw: 46.08,
      unitPrice: 26,
      termYears: 20,
      status: 'SIGNED',
      contractId: 5,
      submittedAt: iso('2024-09-20'),
      updatedAt: iso('2024-10-25', '15:40:00'),
      events: signedEvents(
        iso('2024-09-20'),
        iso('2024-09-23'),
        iso('2024-10-07'),
        iso('2024-10-25', '15:40:00'),
      ),
    }),
    // ── 상태별 샘플 1건씩 — 실제 기업·용량·조건만 ──
    // 접수 — 미팅 전(조건 없음)
    mk({
      id: 6,
      applicant: 'consumer',
      applicantCompanyId: 2,
      applicantCompanyName: CO.CONSUMER_LOGIN.name,
      generatorCompanyId: CO.SPC.id,
      generatorCompanyName: CO.SPC.name,
      kind: 'SELF_CONSUMPTION',
      consumerCompanyId: 2,
      consumerCompanyName: CO.CONSUMER_LOGIN.name,
      plantName: '한길',
      siteName: '한길',
      address: '울산 남구 용연동 490-11',
      capacityKw: 90.88,
      unitPrice: 0,
      termYears: 0,
      status: 'SUBMITTED',
      submittedAt: iso('2026-09-29', '15:10:00'),
      surveyDate: '2026-10-15',
      contact: { name: '이수용', phone: '010-3000-0003', email: 'consumer@test.com' },
      messages: [
        {
          at: iso('2026-09-29', '15:12:00'),
          by: 'consumer',
          byName: CO.CONSUMER_LOGIN.name,
          text: '한길 자가소비 90.88kW 신청합니다. 미팅 일정 조율 부탁드립니다.',
        },
      ],
    }),
    // 미팅
    mk({
      id: 15,
      ...spc,
      kind: 'SELF_CONSUMPTION',
      consumerCompanyId: 6,
      consumerCompanyName: CO.TAESUNG.name,
      plantName: '태성산업',
      siteName: '태성산업 본사',
      address: '울산 남구 여천동 358-8',
      capacityKw: 46.08,
      unitPrice: 0,
      termYears: 20,
      status: 'REVIEW',
      submittedAt: iso('2026-09-25', '10:00:00'),
      updatedAt: iso('2026-10-01', '16:00:00'),
      surveyDate: '2026-09-29',
      surveyDoneAt: '2026-09-29',
      termsConfirmedAt: iso('2026-10-01', '16:00:00'),
      termsConfirmedBy: 'spc',
      // 처음 확정한 조건(O&M 1.2%) — 관리자가 조건 변경으로 1%로 고쳐 다시 확정
      termsBeforeCancel: { capacityKw: 46.08, termYears: 20, unitPrice: 0, installUnit: 1_350_000, extraCost: 0, omAnnual: 746496, tariffPlan: '고압A 선택Ⅱ' },
      contact: { name: '설비 담당', phone: '052-000-0000', email: 'facility@taesung.co.kr' },
      events: [
        ev(iso('2026-09-25', '10:00:00'), 'spc', '신청 접수', '전화 문의 대리 접수'),
        ev(iso('2026-09-26', '09:30:00'), 'spc', '미팅 확정'),
        ev(iso('2026-09-26', '09:40:00'), 'spc', '미팅', '2026-09-29 예정'),
        ev(iso('2026-09-30', '10:00:00'), 'spc', '조건 입력', '46.08 kW · 20년'),
        ev(iso('2026-09-30', '10:10:00'), 'spc', '조건 확정', '상대 동의 대기'),
        ev(iso('2026-10-01', '15:40:00'), 'spc', '조건 변경', '조건 다시 입력'),
        ev(iso('2026-10-01', '15:50:00'), 'spc', '조건 입력', '연간 O&M ₩746,496 → ₩622,080'),
        ev(iso('2026-10-01', '16:00:00'), 'spc', '조건 확정', '상대 동의 대기'),
      ],
      messages: [
        {
          at: iso('2026-09-25', '10:05:00'),
          by: 'spc',
          byName: CO.SPC.name,
          text: '전화 문의 접수 — 9월 29일 미팅 예정',
        },
        {
          at: iso('2026-10-01', '15:20:00'),
          by: 'consumer',
          byName: CO.TAESUNG.name,
          text: '연간 O&M 금액이 예상보다 높아 조정을 요청합니다.',
        },
        {
          at: iso('2026-10-01', '16:00:00'),
          by: 'spc',
          byName: CO.SPC.name,
          text: '[조건 변경] 연간 O&M 을 1% 로 고쳤습니다',
        },
      ],
    }),
    // 미팅 완료 — 조건 입력 뒤 승인 대기
    mk({
      id: 5,
      ...gen,
      kind: 'ONSITE',
      plantName: '한일튜브(PPA)',
      consumerCompanyId: 4,
      consumerCompanyName: CO.HANIL.name,
      siteName: '한일튜브 울산공장',
      address: '울산 남구 부곡동 273-6',
      capacityKw: 329.6,
      unitPrice: 138,
      termYears: 20,
      status: 'REVIEW',
      submittedAt: iso('2026-09-20'),
      updatedAt: iso('2026-09-29', '10:30:00'),
      surveyDate: '2026-09-26',
      surveyDoneAt: '2026-09-26',
      // 관리자가 조건을 확정 — 박발전 동의 대기([동의] · [반려])
      termsConfirmedAt: iso('2026-09-29', '10:30:00'),
      termsConfirmedBy: 'spc',
      // 처음 확정한 조건(O&M 1.2%) — 한일튜브가 조건 변경, 관리자가 1%로 고쳐 다시 확정
      termsBeforeCancel: { capacityKw: 329.6, termYears: 20, unitPrice: 138, installUnit: 1_350_000, extraCost: 0, omAnnual: 5339520, tariffPlan: '고압A 선택Ⅱ' },
      contact: { name: '박발전', phone: '010-2000-0002', email: 'operator@test.com' },
      events: [
        ev(iso('2026-09-20'), 'generator', '신청 접수'),
        ev(iso('2026-09-23', '10:30:00'), 'spc', '미팅 확정', '2026-09-26'),
        ev(iso('2026-09-27', '11:00:00'), 'spc', '조건 입력', '329.6 kW · 20년 · PPA ₩138/kWh'),
        ev(iso('2026-09-27', '11:30:00'), 'spc', '조건 동의', '신청한 쪽 동의 대기'),
        ev(iso('2026-09-28', '14:00:00'), 'spc', '조건 변경', '조건 다시 입력'),
        ev(iso('2026-09-29', '10:20:00'), 'spc', '조건 입력', '연간 O&M ₩5,339,520 → ₩4,449,600'),
        ev(iso('2026-09-29', '10:30:00'), 'spc', '조건 동의', '신청한 쪽 동의 대기'),
      ],
      messages: [
        {
          at: iso('2026-09-22', '14:00:00'),
          by: 'spc',
          byName: CO.SPC.name,
          text: '9월 26일 오전 10시 미팅 가능하실까요?',
        },
        {
          at: iso('2026-09-22', '15:30:00'),
          by: 'generator',
          byName: CO.HANIL.name,
          text: '네, 26일 10시로 하겠습니다.',
        },
        {
          at: iso('2026-09-27', '11:00:00'),
          by: 'spc',
          byName: CO.SPC.name,
          text: '[조건 확정] 329.6 kW · 20년 · PPA ₩138/kWh · 설치 ₩1,350,000/kW · O&M 1.2% · 고압A 선택Ⅱ',
        },
        {
          at: iso('2026-09-28', '14:00:00'),
          by: 'generator',
          byName: CO.HANIL.name,
          text: '연간 O&M 을 1% 로 맞춰 주실 수 있을까요?',
        },
        {
          at: iso('2026-09-29', '10:30:00'),
          by: 'spc',
          byName: CO.SPC.name,
          text: '[조건 변경] 연간 O&M 을 1% 로 고쳤습니다',
        },
      ],
    }),
    // 조건 확정 — 자가소비. 관리자가 조건을 확정, 용인금속 동의 대기(PPA 는 위 id 5)
    mk({
      id: 20,
      applicant: 'consumer',
      applicantCompanyId: CO.YONGIN.id,
      applicantCompanyName: CO.YONGIN.name,
      generatorCompanyId: CO.SPC.id,
      generatorCompanyName: CO.SPC.name,
      kind: 'SELF_CONSUMPTION',
      consumerCompanyId: CO.YONGIN.id,
      consumerCompanyName: CO.YONGIN.name,
      plantName: '용인금속',
      siteName: '용인금속 울산공장',
      address: '울산 남구 여천동 887-18',
      capacityKw: 152.32,
      unitPrice: 0,
      termYears: 20,
      status: 'REVIEW',
      submittedAt: iso('2026-09-18', '10:00:00'),
      updatedAt: iso('2026-10-01', '11:00:00'),
      surveyDate: '2026-09-29',
      surveyDoneAt: '2026-09-29',
      termsConfirmedAt: iso('2026-10-01', '11:00:00'),
      termsConfirmedBy: 'consumer',
      // 관리자가 처음 확정한 조건(O&M 1.2%) — 용인금속이 조건 변경으로 1%로 고쳐 다시 확정
      termsBeforeCancel: { capacityKw: 152.32, termYears: 20, unitPrice: 0, installUnit: 1_350_000, extraCost: 0, omAnnual: 2467584, tariffPlan: '고압A 선택Ⅱ' },
      contact: { name: '설비 담당', phone: '052-000-0000', email: 'facility@yongin.co.kr' },
      events: [
        ev(iso('2026-09-18', '10:00:00'), 'consumer', '신청 접수'),
        ev(iso('2026-09-22', '10:00:00'), 'spc', '미팅 확정', '2026-09-29'),
        ev(iso('2026-09-30', '13:40:00'), 'spc', '조건 입력', '152.32 kW · 20년'),
        ev(iso('2026-09-30', '14:00:00'), 'spc', '조건 확정', '상대 동의 대기'),
        ev(iso('2026-09-30', '16:30:00'), 'consumer', '조건 변경', '조건 다시 입력'),
        ev(iso('2026-10-01', '10:50:00'), 'consumer', '조건 입력', '연간 O&M ₩2,467,584 → ₩2,056,320'),
        ev(iso('2026-10-01', '11:00:00'), 'consumer', '조건 확정', '상대 동의 대기'),
      ],
      messages: [
        {
          at: iso('2026-09-30', '14:00:00'),
          by: 'spc',
          byName: CO.SPC.name,
          text: '[조건 확정] 152.32 kW · 20년',
        },
        {
          at: iso('2026-09-30', '16:30:00'),
          by: 'consumer',
          byName: CO.YONGIN.name,
          text: '연간 O&M 비율을 1% 로 조정하고 싶습니다.',
        },
        {
          at: iso('2026-10-01', '11:00:00'),
          by: 'consumer',
          byName: CO.YONGIN.name,
          text: '[조건 변경] 연간 O&M 을 1% 로 고쳤습니다',
        },
      ],
    }),
    // 조건 변경해 보낸 PPA — 한일튜브가 요금제를 고쳐 다시 확정, 관리자가 바뀐 칸을 보고 동의할 차례(자가소비는 id 20 용인금속)
    mk({
      id: 21,
      ...gen,
      kind: 'ONSITE',
      plantName: '한일튜브(PPA)',
      consumerCompanyId: 4,
      consumerCompanyName: CO.HANIL.name,
      siteName: '한일튜브 울산공장',
      address: '울산 남구 부곡동 273-6',
      capacityKw: 329.6,
      unitPrice: 138,
      termYears: 20,
      status: 'REVIEW',
      submittedAt: iso('2026-09-15', '10:00:00'),
      updatedAt: iso('2026-10-01', '10:00:00'),
      surveyDate: '2026-09-24',
      surveyDoneAt: '2026-09-24',
      tariffPlan: '고압A 선택Ⅰ',
      termsConfirmedAt: iso('2026-10-01', '10:00:00'),
      termsConfirmedBy: 'generator',
      // 관리자가 처음 확정한 조건(요금제 고압A 선택Ⅱ) — 한일튜브가 조건 변경으로 고쳐 다시 확정
      termsBeforeCancel: { capacityKw: 329.6, termYears: 20, unitPrice: 138, installUnit: 1_350_000, extraCost: 0, omAnnual: 4449600, tariffPlan: '고압A 선택Ⅱ' },
      contact: { name: '박발전', phone: '010-2000-0002', email: 'operator@test.com' },
      events: [
        ev(iso('2026-09-15', '10:00:00'), 'generator', '신청 접수'),
        ev(iso('2026-09-18', '11:00:00'), 'spc', '미팅 확정', '2026-09-24'),
        ev(iso('2026-09-25', '14:00:00'), 'spc', '조건 입력', '329.6 kW · 20년 · PPA ₩138/kWh'),
        ev(iso('2026-09-25', '14:10:00'), 'spc', '조건 확정', '상대 동의 대기'),
        ev(iso('2026-10-01', '09:40:00'), 'generator', '조건 변경', '조건 다시 입력'),
        ev(iso('2026-10-01', '09:55:00'), 'generator', '조건 입력', '요금제 고압A 선택Ⅱ → 고압A 선택Ⅰ'),
        ev(iso('2026-10-01', '10:00:00'), 'generator', '조건 확정', '상대 동의 대기'),
      ],
      messages: [
        {
          at: iso('2026-09-25', '14:10:00'),
          by: 'spc',
          byName: CO.SPC.name,
          text: '[조건 확정] 329.6 kW · 20년 · PPA ₩138/kWh',
        },
        {
          at: iso('2026-10-01', '09:40:00'),
          by: 'generator',
          byName: CO.HANIL.name,
          text: '[조건 변경] 요금제를 고압A 선택Ⅰ 으로 고쳤습니다',
        },
      ],
    }),
    // 반려
    mk({
      id: 8,
      ...spc,
      kind: 'SELF_CONSUMPTION',
      consumerCompanyId: 7,
      consumerCompanyName: CO.GUNHO.name,
      plantName: '건호이엔씨',
      siteName: '건호이엔씨 공장',
      address: '울산 남구 부곡동 22-5',
      capacityKw: 33.92,
      unitPrice: 26,
      termYears: 20,
      status: 'REJECTED',
      rejectReason: '설치 위치 도면 미제출 — 보완 후 재신청',
      submittedAt: iso('2026-08-03'),
      updatedAt: iso('2026-08-12', '17:20:00'),
      events: [
        ev(iso('2026-08-03'), 'spc', '신청 접수', '전화 문의 대리 접수'),
        ev(iso('2026-08-05'), 'spc', '미팅 확정'),
        ev(iso('2026-08-12', '17:20:00'), 'spc', '반려', '설치 위치 도면 미제출 — 보완 후 재신청'),
      ],
    }),
    // 박발전(한일튜브) — 신청 PPA 1건(자가소비 신청은 id 6 한길, PPA 미팅 중은 id 5), 반려 PPA 1건(자가소비 반려는 id 9)
    mk({
      id: 18,
      ...gen,
      kind: 'ONSITE',
      plantName: '한일튜브(PPA)',
      consumerCompanyId: 4,
      consumerCompanyName: CO.HANIL.name,
      siteName: '한일튜브 울산공장',
      address: '울산 남구 부곡동 273-6',
      capacityKw: 50,
      unitPrice: 0,
      termYears: 0,
      // 접수 — 관리자가 미팅을 확정하기 전. 박발전은 여기서 [신청 취소]를 누를 수 있다
      status: 'SUBMITTED',
      submittedAt: iso('2026-10-02', '09:30:00'),
      surveyDate: '2026-10-14',
      contact: { name: '박발전', phone: '010-2000-0002', email: 'operator@test.com' },
      events: [ev(iso('2026-10-02', '09:30:00'), 'generator', '신청 접수')],
      messages: [
        { at: iso('2026-10-02', '09:35:00'), by: 'generator', byName: CO.HANIL.name, text: '제2공장 지붕 50kW PPA 추가 설치 검토 요청드립니다. 10월 14일 미팅 가능할까요?' },
      ],
    }),
    mk({
      id: 19,
      ...gen,
      kind: 'ONSITE',
      plantName: '한일튜브(PPA)',
      consumerCompanyId: 4,
      consumerCompanyName: CO.HANIL.name,
      siteName: '한일튜브 울산공장',
      address: '울산 남구 부곡동 273-6',
      capacityKw: 200,
      unitPrice: 0,
      termYears: 0,
      status: 'REJECTED',
      rejectReason: '지붕 구조 보강 필요로 보류',
      submittedAt: iso('2026-08-12', '10:00:00'),
      updatedAt: iso('2026-08-28', '16:00:00'),
      contact: { name: '박발전', phone: '010-2000-0002', email: 'operator@test.com' },
      events: [
        ev(iso('2026-08-12', '10:00:00'), 'generator', '신청 접수'),
        ev(iso('2026-08-28', '16:00:00'), 'generator', '반려', '지붕 구조 보강 필요로 보류'),
      ],
    }),
    // 최근 승인(신규) — 신청 → 미팅 → 양측 서명 → 승인까지 끝난 지 1~2일
    mk({
      id: 4,
      ...spc,
      kind: 'SELF_CONSUMPTION',
      plantId: 17513,
      consumerCompanyId: 7,
      consumerCompanyName: CO.GUNHO.name,
      plantName: '건호이엔씨',
      siteName: '건호이엔씨 공장',
      address: '울산 남구 부곡동 22-5',
      capacityKw: 33.92,
      unitPrice: 26,
      termYears: 20,
      status: 'SIGNED',
      contractId: 7,
      submittedAt: daysAgoIso(20, '10:00:00'),
      updatedAt: daysAgoIso(2, '15:00:00'),
      events: signedEvents(daysAgoIso(20, '10:00:00'), daysAgoIso(15), daysAgoIso(4, '16:00:00'), daysAgoIso(2, '15:00:00')),
    }),
    // ── 전자서명 경우의 수(2026-11-17 사용자) — 자가소비 · PPA × 관리자 먼저(관리자 대기) / 기업 먼저(관리자 확인)
    //    둘 다 서명 전은 양쪽 다 '확인'이라 기업 먼저와 같아 두지 않는다
    //    자가소비: 기업 먼저 id 22 한길 · 관리자 먼저 id 23 용인금속 / PPA: 기업 먼저 id 17 · 관리자 먼저 id 25 (한일튜브)
    mk({
      id: 22,
      ...spc,
      kind: 'SELF_CONSUMPTION',
      consumerCompanyId: 2,
      consumerCompanyName: CO.CONSUMER_LOGIN.name,
      plantName: '한길',
      siteName: '한길',
      address: '울산 남구 용연동 490-11',
      capacityKw: 90.88,
      unitPrice: 26,
      termYears: 20,
      status: 'APPROVED',
      contractId: 10,
      submittedAt: iso('2026-09-01'),
      updatedAt: iso('2026-09-26', '10:00:00'),
      events: [
        ev(iso('2026-09-01'), 'spc', '신청 접수', '전화 문의 대리 접수'),
        ev(iso('2026-09-03'), 'spc', '미팅 확정'),
        ev(iso('2026-09-24', '14:00:00'), 'spc', '조건 동의'),
        ev(iso('2026-09-24', '15:00:00'), 'consumer', '조건 동의', '계약서 초안 생성 — 양측 전자서명 대기'),
        ev(iso('2026-09-26', '10:00:00'), 'consumer', '전자서명', '이수용 서명'),
      ],
    }),
    mk({
      id: 23,
      ...spc,
      kind: 'SELF_CONSUMPTION',
      consumerCompanyId: CO.YONGIN.id,
      consumerCompanyName: CO.YONGIN.name,
      plantName: '용인금속',
      siteName: '용인금속 울산공장',
      address: '울산 남구 여천동 887-18',
      capacityKw: 152.32,
      unitPrice: 26,
      termYears: 20,
      status: 'APPROVED',
      contractId: 11,
      submittedAt: iso('2026-09-02'),
      updatedAt: iso('2026-09-27', '09:30:00'),
      events: [
        ev(iso('2026-09-02'), 'spc', '신청 접수', '전화 문의 대리 접수'),
        ev(iso('2026-09-05'), 'spc', '미팅 확정'),
        ev(iso('2026-09-25', '14:00:00'), 'spc', '조건 동의'),
        ev(iso('2026-09-25', '15:00:00'), 'consumer', '조건 동의', '계약서 초안 생성 — 양측 전자서명 대기'),
        ev(iso('2026-09-27', '09:30:00'), 'spc', '전자서명', '김관리 서명'),
      ],
    }),
    mk({
      id: 25,
      ...gen,
      kind: 'ONSITE',
      plantName: '한일튜브(PPA)',
      consumerCompanyId: 4,
      consumerCompanyName: CO.HANIL.name,
      siteName: '한일튜브 울산공장',
      address: '울산 남구 부곡동 273-6',
      capacityKw: 329.6,
      unitPrice: 138,
      termYears: 20,
      status: 'APPROVED',
      contractId: 13,
      submittedAt: iso('2026-09-04'),
      updatedAt: iso('2026-09-28', '10:00:00'),
      events: [
        ev(iso('2026-09-04'), 'generator', '신청 접수'),
        ev(iso('2026-09-08'), 'spc', '미팅 확정'),
        ev(iso('2026-09-27', '14:00:00'), 'spc', '조건 동의'),
        ev(iso('2026-09-27', '15:00:00'), 'generator', '조건 동의', '계약서 초안 생성 — 양측 전자서명 대기'),
        ev(iso('2026-09-28', '10:00:00'), 'spc', '전자서명', '김관리 서명'),
      ],
    }),
    // 전자서명 — PPA, 기업 서명 끝 · 관리자 남음
    mk({
      id: 17,
      ...gen,
      kind: 'ONSITE',
      plantName: '한일튜브(PPA)',
      consumerCompanyId: 4,
      consumerCompanyName: CO.HANIL.name,
      siteName: '한일튜브 울산공장',
      address: '울산 남구 부곡동 273-6',
      capacityKw: 200,
      unitPrice: 138,
      termYears: 20,
      status: 'APPROVED',
      contractId: 8,
      submittedAt: iso('2026-09-05'),
      updatedAt: iso('2026-09-23', '11:00:00'),
      events: [
        ev(iso('2026-09-05'), 'generator', '신청 접수'),
        ev(iso('2026-09-08'), 'spc', '미팅 확정'),
        ev(iso('2026-09-22', '14:00:00'), 'spc', '조건 동의'),
        ev(iso('2026-09-22', '15:00:00'), 'generator', '조건 동의', '계약서 초안 생성 — 양측 전자서명 대기'),
        ev(iso('2026-09-23', '11:00:00'), 'consumer', '전자서명'),
      ],
    }),
  ];
}

function seedChanges(): ContractChange[] {
  // 변경·해지 — 모든 경우(2026-11-18 사용자): 변경 · 해지 × 자가소비 · PPA × 신청 / 조건(확인 · 대기) / 전자서명(확인 · 대기) / 승인 · 해지, 반려는 변경 · 해지 1건씩. 취소 없음
  const HANIL = CO.HANIL.name;
  return [
    {
      id: 8,
      no: 'CH-2026-0008',
      contractId: 3,
      type: 'CHANGE',
      requestedBy: 'consumer',
      requestedByName: CO.CONSUMER_LOGIN.name,
      requestedAt: iso('2026-10-01', '11:00:00'),
      reason: '설비 교체 일정에 맞춰 계약 기간 1년 연장',
      status: 'REQUESTED',
      stage: 'AGREE',
      proposedBy: 'consumer',
      termsBefore: { capacityKw: 90.88, termYears: 20, unitPrice: 0, installUnit: 1_350_000, extraCost: 0, omAnnual: 1226880, tariffPlan: '고압A 선택Ⅱ' },
      terms: { capacityKw: 90.88, termYears: 21, unitPrice: 0, installUnit: 1_350_000, extraCost: 0, omAnnual: 1226880, tariffPlan: '고압A 선택Ⅱ' },
      events: [ev(iso('2026-10-01', '11:00:00'), 'consumer', '신청 접수', '계약 기간 20년 → 21년')],
    },
    // 신청 — PPA(한일튜브가 관리자에게). 자가소비 신청은 위 한길 · 건호이엔씨(해지)
    {
      id: 12,
      no: 'CH-2026-0012',
      contractId: 1,
      type: 'CHANGE',
      requestedBy: 'generator',
      requestedByName: HANIL,
      requestedAt: iso('2026-10-08', '13:00:00'),
      reason: '모듈 교체로 설비 사용 기간이 늘어 계약 기간 1년 연장',
      status: 'REQUESTED',
      stage: 'AGREE',
      proposedBy: 'generator',
      termsBefore: { capacityKw: 329.6, termYears: 20, unitPrice: 138, installUnit: 1_350_000, extraCost: 0, omAnnual: 4449600, tariffPlan: '고압A 선택Ⅱ' },
      terms: { capacityKw: 329.6, termYears: 21, unitPrice: 138, installUnit: 1_350_000, extraCost: 0, omAnnual: 4449600, tariffPlan: '고압A 선택Ⅱ' },
      events: [ev(iso('2026-10-08', '13:00:00'), 'generator', '신청 접수', '계약 기간 20년 → 21년')],
    },
    {
      id: 10,
      no: 'CH-2026-0010',
      contractId: 5,
      type: 'PRICE',
      requestedBy: 'consumer',
      requestedByName: CO.TAESUNG.name,
      requestedAt: iso('2026-09-10', '10:00:00'),
      reason: '인버터 정기 점검을 O&M 범위에 포함',
      before: '622080',
      after: '746496',
      status: 'REQUESTED',
      stage: 'SIGN',
      termsBefore: { capacityKw: 46.08, termYears: 20, unitPrice: 0, installUnit: 1_350_000, extraCost: 0, omAnnual: 622080, tariffPlan: '고압A 선택Ⅱ' },
      terms: { capacityKw: 46.08, termYears: 20, unitPrice: 0, installUnit: 1_350_000, extraCost: 0, omAnnual: 746496, tariffPlan: '고압A 선택Ⅱ' },
      events: [
        ev(iso('2026-09-10', '10:00:00'), 'consumer', '신청 접수', 'O&M ₩622,080 → ₩746,496/년'),
        ev(iso('2026-09-15', '10:00:00'), 'spc', '변경 동의'),
        ev(iso('2026-09-22', '10:00:00'), 'spc', '조건 입력', '연간 O&M ₩622,080 → ₩746,496'),
        ev(iso('2026-09-22', '10:10:00'), 'spc', '조건 동의', '상대 조건 동의 대기'),
        ev(iso('2026-09-25', '10:00:00'), 'consumer', '조건 동의', '전자서명 대기'),
        ev(iso('2026-09-26', '11:20:00'), 'consumer', '전자서명', `${CO.TAESUNG.name} 서명`),
      ],
      messages: [
        {
          at: iso('2026-09-15', '14:05:00'),
          by: 'spc',
          byName: CO.SPC.name,
          text: '점검 범위와 횟수는 연 2회로 정리했습니다.',
        },
        {
          at: iso('2026-09-16', '09:40:00'),
          by: 'consumer',
          byName: CO.TAESUNG.name,
          text: '확인했습니다. 합의서로 진행해 주세요.',
        },
      ],
      companySign: { at: iso('2026-09-26', '11:20:00'), name: CO.TAESUNG.name },
    },
    {
      id: 6,
      no: 'CH-2026-0006',
      contractId: 2,
      type: 'PRICE',
      requestedBy: 'generator',
      requestedByName: HANIL,
      requestedAt: iso('2026-01-12'),
      reason: '인버터 정기 점검을 O&M 범위에 포함',
      before: '1078272',
      after: '1347840',
      status: 'APPROVED',
      termsBefore: { capacityKw: 99.84, termYears: 20, unitPrice: 0, installUnit: 1_350_000, extraCost: 0, omAnnual: 1078272, tariffPlan: '고압A 선택Ⅱ' },
      terms: { capacityKw: 99.84, termYears: 20, unitPrice: 0, installUnit: 1_350_000, extraCost: 0, omAnnual: 1347840, tariffPlan: '고압A 선택Ⅱ' },
      decidedAt: iso('2026-01-28', '15:00:00'),
      decisionNote: '2026-02 정산분부터 적용',
      events: [
        ev(iso('2026-01-12', '09:00:00'), 'generator', '신청 접수', 'O&M ₩1,078,272 → ₩1,347,840/년'),
        ev(iso('2026-01-14', '10:00:00'), 'spc', '변경 동의'),
        ev(iso('2026-01-20', '10:00:00'), 'spc', '조건 입력', '연간 O&M ₩1,078,272 → ₩1,347,840'),
        ev(iso('2026-01-20', '10:10:00'), 'spc', '조건 동의', '상대 조건 동의 대기'),
        ev(iso('2026-01-26', '10:00:00'), 'generator', '조건 동의', '전자서명 대기'),
        ev(iso('2026-01-27', '16:00:00'), 'generator', '전자서명', `${HANIL} 서명`),
        ev(iso('2026-01-28', '15:00:00'), 'spc', '전자서명', `${CO.SPC.name} 서명`),
        ev(
          iso('2026-01-28', '15:00:00'),
          'spc',
          '승인 완료',
          '2026-02 정산분부터 적용 · 합의서(서명본) 문서 관리',
        ),
      ],
      companySign: { at: iso('2026-01-27', '16:00:00'), name: HANIL },
      spcSign: { at: iso('2026-01-28', '15:00:00'), name: CO.SPC.name },
    },
    {
      id: 3,
      no: 'CH-2026-0003',
      contractId: 2,
      type: 'TERM',
      requestedBy: 'generator',
      requestedByName: HANIL,
      requestedAt: iso('2026-07-01'),
      reason: '운영관리 기간 5년 연장',
      before: '2045-02-28',
      after: '2050-02-28',
      status: 'REJECTED',
      decidedAt: iso('2026-07-10', '16:30:00'),
      decisionNote: '기간 연장은 만료 1년 전부터 신청 가능',
      events: [
        ev(
          iso('2026-07-01', '09:00:00'),
          'generator',
          '신청 접수',
          '종료일 2045-02-28 → 2050-02-28',
        ),
        ev(iso('2026-07-10', '16:30:00'), 'spc', '반려', '기간 연장은 만료 1년 전부터 신청 가능'),
      ],
    },
    // 해지 반려 — 태성산업이 신청, 관리자가 반려
    {
      id: 16,
      no: 'CH-2026-0015',
      contractId: 5,
      type: 'TERMINATE',
      requestedBy: 'consumer',
      requestedByName: CO.TAESUNG.name,
      requestedAt: iso('2026-05-11', '10:00:00'),
      reason: '사업장 축소 검토',
      status: 'REJECTED',
      decidedAt: iso('2026-05-18', '15:00:00'),
      decisionNote: '잔여 계약 기간 정산을 협의한 뒤 다시 신청',
      events: [
        ev(iso('2026-05-11', '10:00:00'), 'consumer', '신청 접수'),
        ev(iso('2026-05-18', '15:00:00'), 'spc', '반려', '잔여 계약 기간 정산을 협의한 뒤 다시 신청'),
      ],
    },
    // 해지 신청 — 한일튜브가 신청(박발전 계정에서도 보임), 아직 아무도 서명 안 함
    {
      id: 15,
      no: 'CH-2026-0014',
      contractId: 2,
      type: 'TERMINATE',
      requestedBy: 'generator',
      requestedByName: HANIL,
      requestedAt: iso('2026-10-10', '14:00:00'),
      reason: '공장 증축으로 지붕 설비 이전 예정',
      status: 'REQUESTED', // 신청 단계 — 관리자 해지 동의 대기
      events: [ev(iso('2026-10-10', '14:00:00'), 'generator', '신청 접수')],
    },
    // 해지 — 용인금속이 신청, 관리자 승인 → 전자서명, 관리자 서명 끝 · 용인금속 서명 남음
    {
      id: 14,
      no: 'CH-2026-0013',
      contractId: 4,
      type: 'TERMINATE',
      requestedBy: 'spc',
      requestedByName: CO.SPC.name,
      requestedAt: iso('2026-10-06', '10:00:00'),
      reason: '공장 지붕 보수 공사로 설비 철거 예정',
      status: 'REQUESTED',
      stage: 'SIGN',
      events: [
        ev(iso('2026-10-06', '10:00:00'), 'spc', '신청 접수'),
        ev(iso('2026-10-06', '10:20:00'), 'consumer', '해지 동의'),
        ev(iso('2026-10-06', '10:30:00'), 'spc', '전자서명', '김관리 서명'),
      ],
      messages: [
        { at: iso('2026-10-06', '10:40:00'), by: 'spc', byName: CO.SPC.name, text: '지붕 보수 일정이 정해져 해지 합의서를 올렸습니다. 확인 후 서명 부탁드립니다.' },
      ],
      spcSign: { at: iso('2026-10-06', '10:30:00'), name: '김관리' },
    },
    // 해지 — 끝난 것(상태 해지). 한길이 예전 계약을 해지하고 재계약
    {
      id: 13,
      no: 'CH-2025-0001',
      contractId: 9,
      type: 'TERMINATE',
      requestedBy: 'consumer',
      requestedByName: CO.CONSUMER_LOGIN.name,
      requestedAt: iso('2025-03-20', '10:00:00'),
      reason: '운영관리 조건을 바꿔 새 계약으로 다시 체결',
      status: 'APPROVED',
      decidedAt: iso('2025-04-10', '15:00:00'),
      decisionNote: '2025-04-30 해지 · 2025-05-01 새 계약(CT-2025-0003) 시작',
      events: [
        ev(iso('2025-03-20', '10:00:00'), 'consumer', '신청 접수'),
        ev(iso('2025-03-25', '10:00:00'), 'spc', '해지 동의'),
        ev(iso('2025-04-09', '16:00:00'), 'spc', '전자서명', '김관리 서명'),
        ev(iso('2025-04-10', '15:00:00'), 'consumer', '전자서명', '이수용 서명'),
        ev(iso('2025-04-10', '15:00:00'), 'consumer', '해지 승인', '합의서(서명본) 문서 관리'),
      ],
      companySign: { at: iso('2025-04-10', '15:00:00'), name: '이수용' },
      spcSign: { at: iso('2025-04-09', '16:00:00'), name: '김관리' },
    },
    // ── 빠진 경우 채움(2026-11-18) ──
    // 자가소비 변경 · 조건 입력(관리자 확인) — 한길 O&M
    // 자가소비 변경 · 조건 동의(관리자 대기) — 태성산업 기간
    {
      id: 18,
      no: 'CH-2026-0017',
      contractId: 2,
      type: 'CHANGE',
      requestedBy: 'spc',
      requestedByName: CO.SPC.name,
      requestedAt: iso('2026-09-29', '10:00:00'),
      reason: '설비 교체 주기에 맞춰 계약 기간 연장',
      status: 'REQUESTED',
      stage: 'AGREE',
      proposedBy: 'spc',
      termsBefore: { capacityKw: 99.84, termYears: 20, unitPrice: 0, installUnit: 1_350_000, extraCost: 0, omAnnual: 1347840, tariffPlan: '고압A 선택Ⅱ' },
      terms: { capacityKw: 99.84, termYears: 21, unitPrice: 0, installUnit: 1_350_000, extraCost: 0, omAnnual: 1347840, tariffPlan: '고압A 선택Ⅱ' },
      events: [ev(iso('2026-09-29', '10:00:00'), 'spc', '신청 접수', '계약 기간 20년 → 21년')],
    },
    // 자가소비 변경 · 전자서명(관리자 먼저 서명, 관리자 대기) — 한길 기간
    {
      id: 19,
      no: 'CH-2026-0018',
      contractId: 3,
      type: 'CHANGE',
      requestedBy: 'spc',
      requestedByName: CO.SPC.name,
      requestedAt: iso('2026-09-12', '10:00:00'),
      reason: '모듈 교체 일정에 맞춰 계약 기간 1년 연장',
      status: 'REQUESTED',
      stage: 'SIGN',
      proposedBy: 'spc',
      termsBefore: { capacityKw: 90.88, termYears: 20, unitPrice: 0, installUnit: 1_350_000, extraCost: 0, omAnnual: 1226880, tariffPlan: '고압A 선택Ⅱ' },
      terms: { capacityKw: 90.88, termYears: 21, unitPrice: 0, installUnit: 1_350_000, extraCost: 0, omAnnual: 1226880, tariffPlan: '고압A 선택Ⅱ' },
      events: [
        ev(iso('2026-09-12', '10:00:00'), 'spc', '신청 접수', '계약 기간 20년 → 21년'),
        ev(iso('2026-09-14', '10:00:00'), 'consumer', '변경 동의'),
        ev(iso('2026-09-21', '11:00:00'), 'spc', '전자서명', '김관리 서명'),
      ],
      spcSign: { at: iso('2026-09-21', '11:00:00'), name: '김관리' },
    },
    // PPA 변경 · 전자서명(기업 먼저 서명, 관리자 확인) — 단가
    {
      id: 20,
      no: 'CH-2026-0019',
      contractId: 1,
      type: 'PRICE',
      requestedBy: 'generator',
      requestedByName: HANIL,
      requestedAt: iso('2026-08-20', '10:00:00'),
      reason: '한전 요금 인상분 일부 반영',
      before: '138',
      after: '140',
      status: 'REQUESTED',
      stage: 'SIGN',
      termsBefore: { capacityKw: 329.6, termYears: 20, unitPrice: 138, installUnit: 1_350_000, extraCost: 0, omAnnual: 4449600, tariffPlan: '고압A 선택Ⅱ' },
      terms: { capacityKw: 329.6, termYears: 20, unitPrice: 140, installUnit: 1_350_000, extraCost: 0, omAnnual: 4449600, tariffPlan: '고압A 선택Ⅱ' },
      events: [
        ev(iso('2026-08-20', '10:00:00'), 'generator', '신청 접수', '단가 ₩138 → ₩140'),
        ev(iso('2026-08-24', '10:00:00'), 'spc', '변경 동의'),
        ev(iso('2026-08-28', '10:00:00'), 'spc', '조건 입력', 'PPA 단가 ₩138 → ₩140'),
        ev(iso('2026-08-28', '10:10:00'), 'spc', '조건 동의', '상대 조건 동의 대기'),
        ev(iso('2026-09-01', '10:00:00'), 'generator', '조건 동의', '전자서명 대기'),
        ev(iso('2026-09-02', '11:00:00'), 'generator', '전자서명', '박발전 서명'),
      ],
      companySign: { at: iso('2026-09-02', '11:00:00'), name: '박발전' },
    },
    // PPA 변경 · 전자서명(관리자 먼저 서명, 관리자 대기) — 기간
    {
      id: 21,
      no: 'CH-2026-0020',
      contractId: 1,
      type: 'CHANGE',
      requestedBy: 'spc',
      requestedByName: CO.SPC.name,
      requestedAt: iso('2026-08-25', '10:00:00'),
      reason: '모듈 수명에 맞춰 계약 기간 2년 연장',
      status: 'REQUESTED',
      stage: 'SIGN',
      proposedBy: 'spc',
      termsBefore: { capacityKw: 329.6, termYears: 20, unitPrice: 138, installUnit: 1_350_000, extraCost: 0, omAnnual: 4449600, tariffPlan: '고압A 선택Ⅱ' },
      terms: { capacityKw: 329.6, termYears: 22, unitPrice: 138, installUnit: 1_350_000, extraCost: 0, omAnnual: 4449600, tariffPlan: '고압A 선택Ⅱ' },
      events: [
        ev(iso('2026-08-25', '10:00:00'), 'spc', '신청 접수', '계약 기간 20년 → 22년'),
        ev(iso('2026-08-27', '10:00:00'), 'generator', '변경 동의'),
        ev(iso('2026-09-06', '11:00:00'), 'spc', '전자서명', '김관리 서명'),
      ],
      spcSign: { at: iso('2026-09-06', '11:00:00'), name: '김관리' },
    },
    // PPA 변경 · 승인 — 단가 ₩136 → ₩138(지금 계약의 단가가 이 변경으로 정해짐)
    {
      id: 22,
      no: 'CH-2025-0003',
      contractId: 1,
      type: 'PRICE',
      requestedBy: 'generator',
      requestedByName: HANIL,
      requestedAt: iso('2025-06-02', '10:00:00'),
      reason: '모듈 효율 저하분 반영',
      before: '136',
      after: '138',
      status: 'APPROVED',
      termsBefore: { capacityKw: 329.6, termYears: 20, unitPrice: 136, installUnit: 1_350_000, extraCost: 0, omAnnual: 4449600, tariffPlan: '고압A 선택Ⅱ' },
      terms: { capacityKw: 329.6, termYears: 20, unitPrice: 138, installUnit: 1_350_000, extraCost: 0, omAnnual: 4449600, tariffPlan: '고압A 선택Ⅱ' },
      decidedAt: iso('2025-06-20', '15:00:00'),
      decisionNote: '2025-07 정산분부터 적용',
      events: [
        ev(iso('2025-06-02', '10:00:00'), 'generator', '신청 접수', '단가 ₩136 → ₩138'),
        ev(iso('2025-06-05', '10:00:00'), 'spc', '변경 동의'),
        ev(iso('2025-06-10', '10:00:00'), 'spc', '조건 입력', 'PPA 단가 ₩136 → ₩138'),
        ev(iso('2025-06-10', '10:10:00'), 'spc', '조건 동의', '상대 조건 동의 대기'),
        ev(iso('2025-06-16', '10:00:00'), 'generator', '조건 동의', '전자서명 대기'),
        ev(iso('2025-06-18', '16:00:00'), 'spc', '전자서명', '김관리 서명'),
        ev(iso('2025-06-20', '15:00:00'), 'generator', '전자서명', '박발전 서명'),
        ev(iso('2025-06-20', '15:00:00'), 'generator', '승인 완료', '2025-07 정산분부터 적용 · 합의서(서명본) 문서 관리'),
      ],
      companySign: { at: iso('2025-06-20', '15:00:00'), name: '박발전' },
      spcSign: { at: iso('2025-06-18', '16:00:00'), name: '김관리' },
    },
    // PPA 해지 · 신청(관리자 확인)
    {
      id: 23,
      no: 'CH-2026-0021',
      contractId: 1,
      type: 'TERMINATE',
      requestedBy: 'generator',
      requestedByName: HANIL,
      requestedAt: iso('2026-10-09', '10:00:00'),
      reason: '공장 이전 검토로 PPA 해지 협의',
      status: 'REQUESTED',
      events: [ev(iso('2026-10-09', '10:00:00'), 'generator', '신청 접수')],
    },
    // PPA 해지 · 전자서명(기업 먼저 서명, 관리자 확인)
    {
      id: 24,
      no: 'CH-2026-0022',
      contractId: 1,
      type: 'TERMINATE',
      requestedBy: 'generator',
      requestedByName: HANIL,
      requestedAt: iso('2026-09-15', '10:00:00'),
      reason: '설비 이전 계획에 따른 해지',
      status: 'REQUESTED',
      stage: 'SIGN',
      events: [
        ev(iso('2026-09-15', '10:00:00'), 'generator', '신청 접수'),
        ev(iso('2026-09-17', '10:00:00'), 'spc', '해지 동의'),
        ev(iso('2026-09-18', '11:00:00'), 'generator', '전자서명', '박발전 서명'),
      ],
      companySign: { at: iso('2026-09-18', '11:00:00'), name: '박발전' },
    },
    // PPA 해지 · 전자서명(관리자 먼저 서명, 관리자 대기)
    {
      id: 25,
      no: 'CH-2026-0023',
      contractId: 1,
      type: 'TERMINATE',
      requestedBy: 'spc',
      requestedByName: CO.SPC.name,
      requestedAt: iso('2026-09-20', '10:00:00'),
      reason: '사업장 통합에 따른 해지',
      status: 'REQUESTED',
      stage: 'SIGN',
      events: [
        ev(iso('2026-09-20', '10:00:00'), 'spc', '신청 접수'),
        ev(iso('2026-09-22', '10:00:00'), 'generator', '해지 동의'),
        ev(iso('2026-09-22', '10:30:00'), 'spc', '전자서명', '김관리 서명'),
      ],
      spcSign: { at: iso('2026-09-22', '10:30:00'), name: '김관리' },
    },
    // PPA 해지 · 해지(끝) — 예전 PPA 계약 CT-2024-0002
    {
      id: 26,
      no: 'CH-2025-0002',
      contractId: 15,
      type: 'TERMINATE',
      requestedBy: 'generator',
      requestedByName: HANIL,
      requestedAt: iso('2025-01-10', '10:00:00'),
      reason: '단가를 바꿔 새 계약으로 다시 체결',
      status: 'APPROVED',
      decidedAt: iso('2025-02-18', '15:00:00'),
      decisionNote: '2025-02-28 해지 · 2025-03-01 새 계약(CT-2025-0001) 시작',
      events: [
        ev(iso('2025-01-10', '10:00:00'), 'generator', '신청 접수'),
        ev(iso('2025-01-13', '10:00:00'), 'spc', '해지 동의'),
        ev(iso('2025-02-17', '16:00:00'), 'generator', '전자서명', '박발전 서명'),
        ev(iso('2025-02-18', '15:00:00'), 'spc', '전자서명', '김관리 서명'),
        ev(iso('2025-02-18', '15:00:00'), 'spc', '해지 승인', '합의서(서명본) 문서 관리'),
      ],
      companySign: { at: iso('2025-02-17', '16:00:00'), name: '박발전' },
      spcSign: { at: iso('2025-02-18', '15:00:00'), name: '김관리' },
    },
    // 자가소비 해지 · 전자서명(기업 먼저 서명, 관리자 확인) — 건호이엔씨
    {
      id: 27,
      no: 'CH-2026-0024',
      contractId: 7,
      type: 'TERMINATE',
      requestedBy: 'consumer',
      requestedByName: CO.GUNHO.name,
      requestedAt: iso('2026-09-24', '10:30:00'),
      reason: '공장 이전으로 설비 철거 예정',
      status: 'REQUESTED',
      stage: 'SIGN',
      events: [
        ev(iso('2026-09-24', '10:30:00'), 'consumer', '신청 접수'),
        ev(iso('2026-09-26', '10:00:00'), 'spc', '해지 동의'),
        ev(iso('2026-09-27', '11:00:00'), 'consumer', '전자서명', '윤건호 서명'),
      ],
      companySign: { at: iso('2026-09-27', '11:00:00'), name: '윤건호' },
    },
    // 관리자가 신청한 변경 · 해지(받는 쪽은 기업 — 한일튜브라 발전사업자 계정에서 변경 동의 / 해지 동의 / 반려)
    {
      id: 29,
      no: 'CH-2026-0026',
      contractId: 1,
      type: 'TERMINATE',
      requestedBy: 'spc',
      requestedByName: CO.SPC.name,
      requestedAt: iso('2026-10-13', '10:00:00'),
      reason: 'PPA 요금 3개월 미납',
      status: 'REQUESTED',
      events: [ev(iso('2026-10-13', '10:00:00'), 'spc', '신청 접수')],
    },
    // 관리자가 신청 — 나머지 두 경우(변경 PPA · 해지 자가소비). 신청은 변경 · 해지 × 자가소비 · PPA × 누가 신청 = 8가지
    {
      id: 30,
      no: 'CH-2026-0027',
      contractId: 1,
      type: 'PRICE',
      requestedBy: 'spc',
      requestedByName: CO.SPC.name,
      requestedAt: iso('2026-10-14', '10:00:00'),
      reason: '한전 산업용 요금 개편 반영',
      before: '138',
      after: '141',
      status: 'REQUESTED',
      events: [ev(iso('2026-10-14', '10:00:00'), 'spc', '신청 접수', '단가 ₩138 → ₩141')],
    },
    {
      id: 31,
      no: 'CH-2026-0028',
      contractId: 4,
      type: 'TERMINATE',
      requestedBy: 'spc',
      requestedByName: CO.SPC.name,
      requestedAt: iso('2026-10-15', '10:00:00'),
      reason: 'O&M 요금 3개월 미납',
      status: 'REQUESTED',
      events: [ev(iso('2026-10-15', '10:00:00'), 'spc', '신청 접수')],
    },
    // ── 조건 변경 4가지 — 받은 값을 고쳐 다시 조건 확정, 상대 화면에 바뀐 칸 '기존 → 새 값' ──
    {
      id: 32,
      no: 'CH-2026-0029',
      contractId: 3,
      type: 'CHANGE',
      requestedBy: 'consumer',
      requestedByName: CO.CONSUMER_LOGIN.name,
      requestedAt: iso('2026-10-12', '10:00:00'),
      reason: '설비 교체 일정에 맞춰 계약 기간 연장, 인버터 점검을 연 2회로 늘려 연간 O&M 조정',
      status: 'REQUESTED',
      stage: 'AGREE',
      proposedBy: 'spc',
      termsBefore: { capacityKw: 90.88, termYears: 20, unitPrice: 0, installUnit: 1_350_000, extraCost: 0, omAnnual: 1226880, tariffPlan: '고압A 선택Ⅱ' },
      termsPrev: { capacityKw: 90.88, termYears: 21, unitPrice: 0, installUnit: 1_350_000, extraCost: 0, omAnnual: 1472256, tariffPlan: '고압A 선택Ⅱ' },
      terms: { capacityKw: 90.88, termYears: 21, unitPrice: 0, installUnit: 1_350_000, extraCost: 0, omAnnual: 1349568, tariffPlan: '고압A 선택Ⅱ' },
      events: [
        ev(iso('2026-10-12', '10:00:00'), 'consumer', '신청 접수', '계약 기간 20년 → 21년 · 연간 O&M ₩1,226,880 → ₩1,472,256/년'),
        ev(iso('2026-10-14', '10:00:00'), 'spc', '조건 변경'),
        ev(iso('2026-10-14', '10:20:00'), 'spc', '조건 확정', '계약 기간 20년 → 21년 · 연간 O&M ₩1,226,880 → ₩1,349,568/년'),
      ],
      messages: [{ at: iso('2026-10-14', '10:20:00'), by: 'spc', byName: CO.SPC.name, text: '[조건 확정] 계약 기간 20년 → 21년 · 연간 O&M ₩1,226,880 → ₩1,349,568/년' }],
    },
    {
      id: 33,
      no: 'CH-2026-0030',
      contractId: 4,
      type: 'CHANGE',
      requestedBy: 'spc',
      requestedByName: CO.SPC.name,
      requestedAt: iso('2026-10-05', '10:00:00'),
      reason: '설비 교체 주기에 맞춰 계약 기간 연장, 인버터 점검을 연 2회로 늘려 연간 O&M 조정',
      status: 'REQUESTED',
      stage: 'AGREE',
      proposedBy: 'consumer',
      termsBefore: { capacityKw: 152.32, termYears: 20, unitPrice: 0, installUnit: 1_350_000, extraCost: 0, omAnnual: 2056320, tariffPlan: '고압A 선택Ⅱ' },
      termsPrev: { capacityKw: 152.32, termYears: 22, unitPrice: 0, installUnit: 1_350_000, extraCost: 0, omAnnual: 2467584, tariffPlan: '고압A 선택Ⅱ' },
      terms: { capacityKw: 152.32, termYears: 21, unitPrice: 0, installUnit: 1_350_000, extraCost: 0, omAnnual: 2261952, tariffPlan: '고압A 선택Ⅱ' },
      events: [
        ev(iso('2026-10-05', '10:00:00'), 'spc', '신청 접수', '계약 기간 20년 → 22년 · 연간 O&M ₩2,056,320 → ₩2,467,584/년'),
        ev(iso('2026-10-07', '10:00:00'), 'consumer', '조건 변경'),
        ev(iso('2026-10-07', '10:30:00'), 'consumer', '조건 확정', '계약 기간 20년 → 21년 · 연간 O&M ₩2,056,320 → ₩2,261,952/년'),
      ],
      messages: [{ at: iso('2026-10-07', '10:30:00'), by: 'consumer', byName: CO.YONGIN.name, text: '[조건 확정] 계약 기간 20년 → 21년 · 연간 O&M ₩2,056,320 → ₩2,261,952/년' }],
    },
    {
      id: 34,
      no: 'CH-2026-0031',
      contractId: 1,
      type: 'CHANGE',
      requestedBy: 'generator',
      requestedByName: HANIL,
      requestedAt: iso('2026-09-18', '14:00:00'),
      reason: '모듈 교체, 유지보수 비용 상승분 반영과 계약 기간 1년 연장',
      status: 'REQUESTED',
      stage: 'AGREE',
      proposedBy: 'spc',
      termsBefore: { capacityKw: 329.6, termYears: 20, unitPrice: 138, installUnit: 1_350_000, extraCost: 0, omAnnual: 4449600, tariffPlan: '고압A 선택Ⅱ' },
      termsPrev: { capacityKw: 329.6, termYears: 21, unitPrice: 142, installUnit: 1_350_000, extraCost: 0, omAnnual: 4449600, tariffPlan: '고압A 선택Ⅱ' },
      terms: { capacityKw: 329.6, termYears: 21, unitPrice: 141, installUnit: 1_350_000, extraCost: 0, omAnnual: 4449600, tariffPlan: '고압A 선택Ⅱ' },
      events: [
        ev(iso('2026-09-18', '14:00:00'), 'generator', '신청 접수', '계약 기간 20년 → 21년 · PPA 단가 ₩138 → ₩142/kWh'),
        ev(iso('2026-09-23', '10:00:00'), 'spc', '조건 변경'),
        ev(iso('2026-09-23', '10:20:00'), 'spc', '조건 확정', '계약 기간 20년 → 21년 · PPA 단가 ₩138 → ₩141/kWh'),
      ],
      messages: [{ at: iso('2026-09-22', '15:31:00'), by: 'spc', byName: CO.SPC.name, text: '인상 근거(모듈 교체 비용)를 설명해 주실 수 있을까요?' }, { at: iso('2026-09-23', '09:12:00'), by: 'generator', byName: HANIL, text: '모듈 교체 비용 기준으로 ₩142를 요청드렸고, ₩141까지는 가능합니다.' }, { at: iso('2026-09-23', '10:20:00'), by: 'spc', byName: CO.SPC.name, text: '[조건 확정] 계약 기간 20년 → 21년 · PPA 단가 ₩138 → ₩141/kWh' }],
    },
    {
      id: 35,
      no: 'CH-2026-0032',
      contractId: 1,
      type: 'CHANGE',
      requestedBy: 'spc',
      requestedByName: CO.SPC.name,
      requestedAt: iso('2026-10-15', '10:00:00'),
      reason: '모듈 수명에 맞춰 계약 기간 연장, 점검 주기 조정에 맞춘 연간 O&M 조정',
      status: 'REQUESTED',
      stage: 'AGREE',
      proposedBy: 'generator',
      termsBefore: { capacityKw: 329.6, termYears: 20, unitPrice: 138, installUnit: 1_350_000, extraCost: 0, omAnnual: 4449600, tariffPlan: '고압A 선택Ⅱ' },
      termsPrev: { capacityKw: 329.6, termYears: 22, unitPrice: 138, installUnit: 1_350_000, extraCost: 0, omAnnual: 4004640, tariffPlan: '고압A 선택Ⅱ' },
      terms: { capacityKw: 329.6, termYears: 21, unitPrice: 138, installUnit: 1_350_000, extraCost: 0, omAnnual: 4004640, tariffPlan: '고압A 선택Ⅱ' },
      events: [
        ev(iso('2026-10-15', '10:00:00'), 'spc', '신청 접수', '계약 기간 20년 → 22년 · 연간 O&M ₩4,449,600 → ₩4,004,640/년'),
        ev(iso('2026-10-17', '10:00:00'), 'generator', '조건 변경'),
        ev(iso('2026-10-17', '10:30:00'), 'generator', '조건 확정', '계약 기간 20년 → 21년 · 연간 O&M ₩4,449,600 → ₩4,004,640/년'),
      ],
      messages: [{ at: iso('2026-10-17', '10:30:00'), by: 'generator', byName: HANIL, text: '[조건 확정] 계약 기간 20년 → 21년 · 연간 O&M ₩4,449,600 → ₩4,004,640/년' }],
    },
  ];
}

/* ── 월 정산 — 계약에서 계산 (세금계산서·청구서 화면이 /ppa/settlements 로 읽는다) ───────── */
export const YIELD_KWH_PER_KW = [95, 100, 125, 135, 145, 130, 120, 125, 118, 112, 92, 88]; // 1월~12월, 울산 태양광 월 발전시간 근사
/** 마지막으로 끝난 달 — 2026-10-02 기준 9월분까지 발행 */
const LAST_CONFIRMED = '2026-10'; // 2026-11-20 — 2026-10 발행 전(청구일 D-5) · 2026-09 납부 대기
const CURRENT_PERIOD = LAST_CONFIRMED;

/** 월 정산 한 줄 — 계약 조건에 따른 금액 */
export type TradeSettlement = PpaSettlement & {
  consumerCompanyName: string;
  generatorCompanyName: string;
  kind: PlantContractKind;
};

/** 계약 조건 → 그 달 금액(부가세 전). 자가소비 = 연간 O&M 금액 ÷ 12, PPA = 단가 × 사용량 */
export function termsAmount(c: Contract, _period: string, kwh: number): { supply: number; price?: number } {
  if (c.kind === 'SELF_CONSUMPTION' && c.omAnnual) {
    return { supply: Math.round(c.omAnnual / 12) };
  }
  return { supply: Math.round(kwh * c.unitPrice), price: c.unitPrice };
}

/** 청구 상태 — 달이 끝나야 발행되므로 예정은 없다. 마지막 달은 납부 대기, 그 전은 납부 완료 */
/**
 * 청구서 상태 — 작성 중(관리자만 보임) → [발행] → 납부 대기 → [납부 완료](관리자가 입금 확인).
 * 데모(2026-05부터): 2026-10 발행 전(발행할 청구서, 청구일 2026-11-25 · D-5) · 2026-09 납부 대기(기본 청구일 · 납부 기한 그대로) · 2026-05~08 납부 완료
 */
export type BillingStatus = 'DRAFT' | 'BILLED' | 'PAID';
export const billingStatusOf = (period: string): BillingStatus =>
  period === LAST_CONFIRMED ? 'DRAFT' : period === '2026-09' ? 'BILLED' : 'PAID';
/** 청구서 작성 값 — 관리자가 고친 것만 저장한다(없으면 기본값). 키 = 계약 id : 달 */
export interface InvoiceRecord {
  /** (안 씀) 예전 저장본의 사용량 고침 — 사용량은 통합관제 발전량 고정(2026-10-14) */
  kwh?: number;
  /** 정산 차액 — 전월 사용량이 틀렸을 때 이번 청구서에 한 줄(± kWh × 단가). 사유 필수 */
  adjust?: InvoiceAdjust;
  issueDate?: string;
  dueDate?: string;
  bankAccount?: string;
  status?: BillingStatus;
  issuedAt?: string;
  paidAt?: string;
}
export interface InvoiceAdjust {
  /** 바로잡는 달 — YYYY-MM */
  period: string;
  /** 차액 kWh — 더 받을 땐 +, 돌려줄 땐 − */
  kwh: number;
  reason: string;
}
export const invoiceKey = (contractId: number, period: string) => `${contractId}:${period}`;
/** 청구서 — 사용량은 통합관제 발전량 그대로(못 고침). 틀린 달이 있으면 정산 차액 한 줄을 더한다 */
export type Bill = TradeSettlement & {
  billStatus: BillingStatus;
  issueDate: string;
  dueDate: string;
  bankAccount: string;
  meterKwh: number;
  /** 그 달 사용량 금액(사용량 × 단가) */
  usageAmount: number;
  adjust?: InvoiceAdjust;
  /** 정산 차액 금액(차액 kWh × 단가) */
  adjustAmount: number;
  paidAt?: string;
};
export function billOf(s: TradeSettlement, r?: InvoiceRecord): Bill {
  const kwh = s.generationKwh; // 통합관제 발전량 고정
  const usageAmount = Math.round(kwh * s.smpUnitPrice);
  const adjust = r?.adjust && r.adjust.kwh !== 0 ? r.adjust : undefined;
  const adjustAmount = adjust ? Math.round(adjust.kwh * s.smpUnitPrice) : 0;
  const supply = usageAmount + adjustAmount;
  const vat = Math.round(supply * 0.1);
  return {
    ...s,
    meterKwh: s.generationKwh,
    generationKwh: kwh,
    usageAmount,
    adjust,
    adjustAmount,
    supplyAmount: supply,
    vatBase: supply,
    vat,
    total: supply + vat,
    billStatus: r?.status ?? billingStatusOf(s.period),
    issueDate: r?.issueDate ?? issueDateOf(s.period),
    // 납부 기한 — 청구일 + 30일보다 앞이면 30일로(늘린 값만 남는다)
    dueDate: [r?.dueDate ?? '', minDueDateOf(r?.issueDate ?? issueDateOf(s.period))].sort().pop()!,
    bankAccount: r?.bankAccount ?? '',
    paidAt: r?.paidAt,
  };
}
/** 작성일 — 그 달 말일 · 청구일(발행일) — 익월 10일(1일에 사용량 확정, 5일부터 D-5 알림, 2026-11-20 사용자) · 납부 기한 — 청구일 + 30일 이상 */
export const writtenDateOf = (period: string) => {
  const [y = 2026, m = 1] = period.split('-').map(Number);
  return `${period}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
};
export const issueDateOf = (period: string) => nextMonthDay(period, 10);
/** 납부 기한 — 청구일부터 최소 30일(늘리는 것만 됨, 2026-11-20 사용자) */
export const INVOICE_MIN_DUE_DAYS = 30;
export const addDays = (date: string, days: number) => {
  const [y = 2026, m = 1, d = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
export const minDueDateOf = (issueDate: string) => addDays(issueDate, INVOICE_MIN_DUE_DAYS);
export const dueDateOf = (period: string) => minDueDateOf(issueDateOf(period));
/** 청구일까지 남은 날 — 오늘 기준(지나면 음수). 발행할 청구서 D-day · 발행 예정 알림(D-5부터) */
export const INVOICE_NOTICE_DAYS = 5;
export const daysUntil = (date: string) => {
  const t = new Date();
  const today = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  const [y = 2026, m = 1, d = 1] = date.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - today) / 86_400_000);
};
/** 오늘 — YYYY-MM-DD(이 컴퓨터 날짜) */
export const todayDate = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};
/** 청구일이 되어 기업에 나갔는지 — 발행을 눌러도 청구일이 미래면 그날 나간다(예약, 상태는 그대로 '발행', 2026-11-20 사용자) */
export const isInvoiceOut = (b: { billStatus: string; issueDate: string }) => b.billStatus !== 'DRAFT' && daysUntil(b.issueDate) <= 0;
/** D-5 · D-day · D+3(지남) */
export const dDayLabel = (n: number) => (n > 0 ? `D-${n}` : n === 0 ? 'D-day' : `D+${-n}`);

/** 수익 · 정산(청구서 · 세금계산서) 데모는 2026-05부터 — 그 전 달은 보이지 않게(데이터 많아지지 않게, 2026-11-20 사용자) */
export const BILLING_FROM = '2026-05';
export const billingSettlementsOf = (contracts: Contract[]) => settlementsOf(contracts).filter((s) => s.period >= BILLING_FROM);

export function settlementsOf(contracts: Contract[]): TradeSettlement[] {
  const out: TradeSettlement[] = [];
  let id = 1;
  for (const c of contracts) {
    if (c.status === 'PENDING_SIGN' || c.kind !== 'ONSITE') continue; // 자가소비는 월 청구 없음(O&M 은 계약에 포함)
    // 계약 시작 달부터 지금(또는 해지 달)까지 — 해마다(연도별 보기, 2026-10-13)
    const firstMonth = c.startDate.slice(0, 7);
    const lastMonth = c.terminatedAt ? c.terminatedAt.slice(0, 7) : CURRENT_PERIOD;
    const periods: string[] = [];
    for (let y = Number(firstMonth.slice(0, 4)); y <= Number(lastMonth.slice(0, 4)); y++)
      for (let m = 1; m <= 12; m++) periods.push(`${y}-${String(m).padStart(2, '0')}`);
    for (const period of periods) {
      const m = Number(period.slice(5, 7));
      if (period < firstMonth || period > lastMonth) continue;
      const variance = 1 + (((c.id * 7 + m * 3) % 9) - 4) / 100; // ±4% 계약·월별 편차
      const kwh = Math.round(c.capacityKw * (YIELD_KWH_PER_KW[m - 1] ?? 100) * variance);
      const t = termsAmount(c, period, kwh);
      const supply = t.supply;
      const vat = Math.round(supply * 0.1);
      const tradeFee = 0;
      out.push({
        id: id++,
        contractId: c.id,
        contractNumber: c.no,
        plantId: c.plantId ?? 0,
        plantName: c.plantName,
        period,
        status: period <= LAST_CONFIRMED ? 'CONFIRMED' : 'PENDING',
        generationKwh: kwh,
        smpUnitPrice: t.price ?? 0,
        kind: c.kind,
        supplyAmount: supply,
        vat,
        total: supply + vat,
        tradeFee,
        supplyFee: 0,
        manageFee: 0,
        adjustAmount: 0,
        networkFee: 0,
        fundAmount: 0,
        transmissionLoss: 0,
        welfareCost: 0,
        vatBase: supply,
        ppaKind: c.kind === 'ONSITE' ? 'onsite' : 'self',
        matchingRate: 100,
        createdAt: iso(`${period}-01`),
        consumerCompanyName: c.consumerCompanyName,
        generatorCompanyName: c.generatorCompanyName,
      });
    }
  }
  return out;
}

/* ── 문서 — 발행되고 받은 것만: 계약서(서명본) · 청구서 · 세금계산서 ───────────────── */
function seedDocuments(contracts: Contract[], changes: ContractChange[] = []): TradeDocument[] {
  const docs: TradeDocument[] = [];
  let id = 1;
  const push = (d: Omit<TradeDocument, 'id'>) => docs.push({ id: id++, ...d });
  const parties = (c: Contract) => [c.generatorCompanyId, c.consumerCompanyId];
  for (const c of contracts) {
    if (!c.signedAt) continue;
    push({
      category: 'SIGNED',
      title: `${c.kind === 'ONSITE' ? 'PPA 전력공급계약서' : '태양광 발전설비 및 부동산 교차 임대차 계약서'} — ${c.consumerCompanyName}`,
      fileName: `${c.no}_계약서_서명본.pdf`,
      contractId: c.id,
      contractNo: c.no,
      plantName: c.plantName,
      partyCompanyIds: parties(c),
      issuedAt: c.signedAt.slice(0, 10),
      fileType: 'PDF',
      sizeKb: 2260,
    });
  }
  // 발행된 달의 청구서·세금계산서 (onsite)
  for (const s of billingSettlementsOf(contracts)) {
    if (s.status !== 'CONFIRMED') continue;
    const c = contracts.find((x) => x.id === s.contractId)!;
    push({
      category: 'INVOICE',
      title: `${s.period} 청구서 — ${c.consumerCompanyName}`,
      fileName: `INV-${s.period}-${c.no}.pdf`,
      contractId: c.id,
      contractNo: c.no,
      plantName: c.plantName,
      partyCompanyIds: parties(c),
      issuedAt: issueDateOf(s.period),
      fileType: 'PDF',
      sizeKb: 312,
    });
    push({
      category: 'TAX',
      title: `${s.period} 세금계산서 — ${c.consumerCompanyName}`,
      fileName: `TX-${s.period}-${c.no}.pdf`,
      contractId: c.id,
      contractNo: c.no,
      plantName: c.plantName,
      partyCompanyIds: parties(c),
      issuedAt: issueDateOf(s.period),
      fileType: 'PDF',
      sizeKb: 268,
      // 데모 — 관리자(공급자)가 발행해 올린 한일튜브 PPA 2026-09 원본(40,060 kWh × ₩138, 한일튜브는 조회)
      ...(c.no === 'CT-2025-0001' && s.period === '2026-09'
        ? { original: { name: '세금계산서_2026-09_한일튜브.pdf', url: '/docs/tax-invoice-2026-09-hanil.pdf', sizeKb: 84, by: CO.SPC.name, at: '2026-10-02 10:00' } }
        : {}),
    });
  }
  // 승인된 변경·해지 — 합의서(서명본)
  for (const ch of changes) {
    if (ch.status !== 'APPROVED') continue;
    const c = contracts.find((x) => x.id === ch.contractId);
    if (!c) continue;
    push({
      category: ch.type === 'TERMINATE' ? 'TERMINATE' : 'CHANGE',
      title: `${ch.type === 'TERMINATE' ? '계약 해지 합의서' : '계약 변경 합의서'} (서명본) — ${c.plantName}`,
      fileName: `${ch.no}_합의서.pdf`,
      contractId: c.id,
      contractNo: c.no,
      plantName: c.plantName,
      partyCompanyIds: parties(c),
      issuedAt: (ch.decidedAt ?? ch.requestedAt).slice(0, 10),
      fileType: 'PDF',
      sizeKb: 640,
    });
  }
  return docs.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.id - a.id);
}
function nextMonthDay(period: string, day: number) {
  const [y = 2026, m = 1] = period.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function buildSeed() {
  const contracts = seedContracts();
  // 합의서 서명도 거래처럼 사람마다 펜으로 그린 사인(2026-11-19 사용자: 이름 입력 글자가 아니라 손으로 쓴 것처럼). 이름은 서명한 사람 — 관리자 김관리, 기업은 그 기업 담당자
  const penSign = (sg: ContractChange['spcSign'], person: string) => (sg ? { ...sg, name: person, image: sg.image ?? signatureImage(person) } : sg);
  const changes = seedChanges()
    .map((ch) => asThreeStep(asOneChange(ch, contracts)))
    .map((ch) => {
      const c = contracts.find((x) => x.id === ch.contractId);
      // 예전 데모 이력의 '조건 입력' · '조건 동의'는 지금 변경 흐름(신청 → 동의 → 전자서명)에 없는 단계라 뺀다(2026-11-19)
      // 신청 접수 줄 글자는 변경 조건 칸과 같은 꼴로(예전 데모의 '단가 ₩138 → ₩140' · '종료일 …' 대신 'PPA 단가 ₩138 → ₩140/kWh', 2026-11-19)
      const asked = ch.termsPrev ?? ch.terms;
      const reqNote = ch.type === 'CHANGE' && c && ch.termsBefore && asked ? changeSummary(ch.termsBefore, asked, c.kind) : undefined;
      const events = (ch.events ?? [])
        .filter((e) => e.label !== '조건 입력' && e.label !== '조건 동의')
        .map((e) => (e.label === '신청 접수' && reqNote ? { ...e, note: reqNote } : e));
      return { ...ch, events, spcSign: penSign(ch.spcSign, '김관리'), companySign: penSign(ch.companySign, SIGNER_OF[c?.consumerCompanyId ?? 0] ?? c?.consumerCompanyName ?? '') };
    });
  return {
    version: SEED_VERSION,
    requests: seedRequests(),
    contracts,
    changes,
    documents: seedDocuments(contracts, changes),
    // 데모 — 한일튜브 PPA 2026-10 청구서는 관리자가 청구일을 2026-11-25 로 잡아 둔 발행 전 건(발행할 청구서 D-5)
    invoices: {
      [invoiceKey(1, '2026-10')]: { issueDate: '2026-11-25' }, // 납부 기한은 청구일 + 30일(2026-12-25)
    } as Record<string, InvoiceRecord>,
  };
}

/* ── 스토어 ───────────────────────────────────────────────────────────────────── */
export interface NewRequestInput {
  kind: PlantContractKind;
  applicant: Party;
  applicantCompanyId: number;
  applicantCompanyName: string;
  generatorCompanyId: number;
  generatorCompanyName: string;
  plantId?: number;
  plantName: string;
  consumerCompanyId: number;
  consumerCompanyName: string;
  siteName: string;
  address: string;
  capacityKw: number;
  unitPrice: number;
  termYears: number;
  note?: string;
  omIncluded?: boolean;
  surveyDate?: string;
  contact?: { name: string; phone: string; email?: string };
}

export interface NewChangeInput {
  contractId: number;
  type: ChangeType;
  requestedBy: Party;
  requestedByName: string;
  reason: string;
  after?: string;
  /** 변경 — 바꾸자는 칸만(나머지는 지금 계약 그대로) */
  terms?: Partial<ChangeTerms>;
  effectiveDate?: string;
}

interface TradingPocState {
  version: number;
  requests: TradeRequest[];
  contracts: Contract[];
  changes: ContractChange[];
  documents: TradeDocument[];
  /** 청구서 작성 값 — invoiceKey(계약, 달) */
  invoices: Record<string, InvoiceRecord>;
  /** 청구서 작성(작성 중일 때만) · 발행 · 납부 완료 */
  saveInvoice: (key: string, patch: InvoiceRecord) => void;
  issueInvoice: (key: string) => void;
  payInvoice: (key: string) => void;
  submitRequest: (input: NewRequestInput) => TradeRequest;
  approveRequest: (id: number, note?: string) => void;
  /** 계약 현황 — 메시지 · 미팅 완료 */
  addMessage: (id: number, by: Party, byName: string, text: string) => void;
  /** 미팅 확정(관리자) — 접수 → 미팅. 이때부터 양쪽이 조건을 넣는다 */
  confirmMeeting: (id: number, date: string) => void;
  /** 조건 확정(관리자) — 신청한 쪽에 동의를 구한다. 채팅에도 자동으로 남긴다. 확정 뒤엔 못 고친다 → 조건 변경로 다시 연다 */
  confirmTerms: (id: number, by?: Party) => void;
  unconfirmTerms: (id: number) => void;
  markSurveyDone: (id: number, date: string) => void;
  /** 미팅 뒤 조건 입력 — 신청 내용에 그 자리에서 저장(접수 상태면 미팅 상태로) */
  updateTerms: (
    id: number,
    terms: Partial<Pick<TradeRequest, 'capacityKw' | 'termYears' | 'unitPrice' | 'installUnit' | 'extraCost' | 'omAnnual' | 'tariffPlan'>>,
    note?: string,
    by?: Party,
  ) => void;
  /** 반려 — 관리자든 신청한 쪽이든 사유를 적고. 서명 대기 중이면 계약 초안도 지운다 */
  rejectRequest: (id: number, reason: string, by?: Party) => void;
  /** 조건 변경 — 관리자 · 신청한 쪽 누구든(확인창) 미팅으로 되돌려 관리자가 조건을 고친다. 진행 이력 · 협의 채팅에 남는다. 서명 대기 계약 초안은 지운다 */
  cancelConfirm: (id: number, by: Party) => void;
  cancelRequest: (id: number, note?: string) => void;
  signAsGenerator: (contractId: number, mark?: Omit<SignMark, 'at'>) => void;
  confirmConsumerSign: (contractId: number, mark?: Omit<SignMark, 'at'>) => void;
  requestChange: (input: NewChangeInput) => ContractChange;
  approveChange: (id: number, note?: string) => void;
  /** 승인(받는 쪽) — 곧 합의. 서명 단계로 */
  moveChangeStage: (id: number, stage: ChangeStage, note?: string, by?: Party) => void;
  /** 받는 쪽 동의 — 해지는 바로 전자서명, 변경은 관리자 조건 입력(지금 조건 + 요청 값으로 시작) */
  agreeChange: (id: number, by: Party) => void;
  /** 조건 저장(관리자) */
  saveChangeTerms: (id: number, terms: ChangeTerms, note?: string, by?: Party) => void;
  /** 조건 확정(관리자) — 상대 조건 동의 대기 · 조건 변경로 다시 입력 */
  confirmChangeTerms: (id: number, by?: Party) => void;
  /** 변경 — 조건 변경으로 고친 값을 조건 확정으로 보낸다. 상대가 동의 / 조건 변경 / 반려 */
  counterChange: (id: number, terms: ChangeTerms, by: Party, byName: string) => void;
  unconfirmChangeTerms: (id: number, by?: Party) => void;
  /** 상대 조건 동의 — 전자서명으로 */
  agreeChangeTerms: (id: number, by: Party) => void;
  addChangeMessage: (id: number, by: Party, byName: string, text: string) => void;
  /** 협의 중 바뀐 값(관리자) */
  updateChange: (
    id: number,
    patch: { after?: string; effectiveDate?: string },
    note?: string,
  ) => void;
  /** 합의서 서명 — 둘 다 서명하면 계약에 반영 · 서명본 합의서가 문서 관리에 */
  signChange: (id: number, side: 'spc' | 'company', sign: ChangeSign) => void;
  rejectChange: (id: number, note: string, by?: Party) => void;
  cancelChange: (id: number) => void;
  addDocument: (doc: Omit<TradeDocument, 'id' | 'issuedAt'> & { issuedAt?: string }) => void;
  /** 원본 올리기 — 발행된 전자세금계산서 파일을 그 달 문서에 붙인다(다시 올리면 바꾼다) */
  attachOriginal: (id: number, original: NonNullable<TradeDocument['original']>) => void;
  resetDemo: () => void;
}

// 로컬 시각(한국) 기준 — toISOString 은 UTC 라 9시간 어긋난다
/** 단가 변경 전 값 — PPA 는 단가, 자가소비는 연간 O&M 금액(원/년) */
function priceBefore(c: Contract) {
  return c.kind === 'SELF_CONSUMPTION' && c.omAnnual != null ? String(c.omAnnual) : String(c.unitPrice);
}

const nowIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
};
const today = () => nowIso().slice(0, 10);
const nextId = (xs: { id: number }[]) => xs.reduce((m, x) => Math.max(m, x.id), 0) + 1;
/** 번호 = 접두사-연도-일련 — 일련은 전체 중 최대값 + 1 (시드 번호와 겹치지 않게) */
const seqNo = (prefix: string, xs: { no: string }[]) => {
  const max = xs.reduce((m, x) => Math.max(m, Number(x.no.match(/-(\d{4})$/)?.[1] ?? 0)), 0);
  return `${prefix}-${today().slice(0, 4)}-${String(max + 1).padStart(4, '0')}`;
};

export const useTradingPocStore = create<TradingPocState>()(
  persist(
    (set, get) => ({
      ...buildSeed(),

      submitRequest: (input) => {
        const at = nowIso();
        const r: TradeRequest = {
          id: nextId(get().requests),
          no: seqNo('TR', get().requests),
          ...input,
          status: 'SUBMITTED',
          submittedAt: at,
          updatedAt: at,
          events: [ev(at, input.applicant, '신청 접수')],
        };
        set((s) => ({ requests: [r, ...s.requests] }));
        return r;
      },

      addMessage: (id, by, byName, text) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id
              ? {
                  ...r,
                  updatedAt: nowIso(),
                  messages: [...(r.messages ?? []), { at: nowIso(), by, byName, text }],
                }
              : r,
          ),
        })),

      confirmTerms: (id, by = 'spc') =>
        set((s) => ({
          requests: s.requests.map((r) => {
            if (r.id !== id) return r;
            const summary = [
              `${r.capacityKw} kW`,
              `${r.termYears}년`,
              r.kind === 'ONSITE' ? `PPA ₩${r.unitPrice}/kWh` : '',
              r.installUnit ? `설치 ₩${r.installUnit.toLocaleString('ko-KR')}/kW` : '',
              r.omAnnual ? `O&M ₩${r.omAnnual.toLocaleString('ko-KR')}/년` : '',
              r.tariffPlan ?? '',
            ]
              .filter(Boolean)
              .join(' · ');
            return {
              ...r,
              termsConfirmedAt: nowIso(),
              termsConfirmedBy: by,
              returnedAt: undefined,
              returnedBy: undefined,
              returnReason: undefined,
              updatedAt: nowIso(),
              events: [...r.events, ev(nowIso(), by, '조건 확정', summary)],
              messages: [
                ...(r.messages ?? []),
                {
                  at: nowIso(),
                  by,
                  byName: by === 'spc' ? CO.SPC.name : r.applicantCompanyName,
                  text: r.termsBeforeCancel ? `[조건 변경] ${summary}` : `[조건 확정] ${summary}`,
                },
              ],
            };
          }),
        })),

      unconfirmTerms: (id) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id
              ? {
                  ...r,
                  termsConfirmedAt: undefined,
                  updatedAt: nowIso(),
                  events: [...r.events, ev(nowIso(), 'spc', '조건 변경', '조건 다시 입력')],
                  messages: [...(r.messages ?? []), { at: nowIso(), by: 'spc', byName: CO.SPC.name, text: '[조건 변경] 조건을 다시 정리해 보내드리겠습니다.' }],
                }
              : r,
          ),
        })),

      confirmMeeting: (id, date) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: 'REVIEW',
                  surveyDate: date,
                  updatedAt: nowIso(),
                  events: [...r.events, ev(nowIso(), 'spc', r.status === 'SUBMITTED' ? '미팅 확정' : '미팅일 변경', date)],
                }
              : r,
          ),
        })),

      markSurveyDone: (id, date) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: r.status === 'SUBMITTED' ? 'REVIEW' : r.status,
                  surveyDoneAt: date,
                  updatedAt: nowIso(),
                  events: [...r.events, ev(nowIso(), 'spc', '미팅 완료', date)],
                }
              : r,
          ),
        })),

      updateTerms: (id, terms, note, by = 'spc') =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id
              ? {
                  ...r,
                  ...terms,
                  termsConfirmedAt: undefined, // 값이 바뀌면 다시 확정 · 동의
                  status: r.status === 'SUBMITTED' ? 'REVIEW' : r.status,
                  updatedAt: nowIso(),
                  events: [...r.events, ev(nowIso(), by, '조건 입력', note)],
                }
              : r,
          ),
        })),

      approveRequest: (id, note) => {
        const r = get().requests.find((x) => x.id === id);
        if (!r) return;
        const at = nowIso();
        const start = firstOfNextMonth();
        const contract: Contract = {
          id: nextId(get().contracts),
          no: seqNo('CT', get().contracts),
          requestId: r.id,
          kind: r.kind,
          plantId: r.plantId,
          plantName: r.plantName,
          generatorCompanyId: r.generatorCompanyId,
          generatorCompanyName: r.generatorCompanyName,
          consumerCompanyId: r.consumerCompanyId,
          consumerCompanyName: r.consumerCompanyName,
          siteName: r.siteName,
          address: r.address,
          capacityKw: r.capacityKw,
          unitPrice: r.unitPrice,
          termYears: r.termYears,
          // 미팅에서 넣은 조건 그대로 — 내 계약에서 같은 값
          installUnit: r.installUnit,
          extraCost: r.extraCost,
          omAnnual: r.omAnnual,
          tariffPlan: r.tariffPlan,
          omIncluded: r.omIncluded,
          contact: r.contact,
          startDate: start,
          endDate: addYears(start, r.termYears),
          status: 'PENDING_SIGN',
          signedByGenerator: false,
          signedByConsumer: false,
          createdAt: at,
        };
        const doc: TradeDocument = {
          id: nextId(get().documents),
          category: 'CONTRACT',
          title: `${r.kind === 'ONSITE' ? 'PPA 전력공급계약서' : '태양광 발전설비 및 부동산 교차 임대차 계약서'} (초안)`,
          fileName: `${contract.no}_계약서_초안.pdf`,
          contractId: contract.id,
          contractNo: contract.no,
          plantName: contract.plantName,
          partyCompanyIds: [contract.generatorCompanyId, contract.consumerCompanyId],
          issuedAt: at.slice(0, 10),
          fileType: 'PDF',
          sizeKb: 1840,
        };
        set((s) => ({
          contracts: [contract, ...s.contracts],
          documents: [doc, ...s.documents],
          requests: s.requests.map((x) =>
            x.id === id
              ? {
                  ...patchReq(
                    { ...x, ...r, events: x.events },
                    'APPROVED',
                    ev(at, r.applicant, '조건 동의', note ?? '양측 전자서명 대기'),
                  ),
                  contractId: contract.id,
                }
              : x,
          ),
        }));
      },

      cancelConfirm: (id, by) =>
        set((s) => {
          const r0 = s.requests.find((r) => r.id === id);
          const pendingContractId = r0?.contractId && s.contracts.find((c) => c.id === r0.contractId && c.status === 'PENDING_SIGN')?.id;
          const byName = by === 'spc' ? CO.SPC.name : r0?.applicantCompanyName ?? '';
          return {
            requests: s.requests.map((r) =>
              r.id === id
                ? {
                    ...patchReq({ ...r, contractId: pendingContractId ? undefined : r.contractId }, 'REVIEW', ev(nowIso(), by, '조건 변경', '조건 다시 입력')),
                    termsConfirmedAt: undefined,
                    // 확정됐던 조건 — 다시 확정하면 바뀐 칸을 노란색으로
                    termsBeforeCancel: { capacityKw: r.capacityKw, termYears: r.termYears, unitPrice: r.unitPrice, installUnit: r.installUnit, extraCost: r.extraCost, omAnnual: r.omAnnual, tariffPlan: r.tariffPlan },
                    returnedAt: nowIso(),
                    returnedBy: by,
                    // 이유는 협의 채팅으로 — 조건 변경 자체는 사유를 받지 않는다
                    messages: [...(r.messages ?? []), { at: nowIso(), by, byName, text: by === 'spc' ? '[조건 변경] 조건을 고쳐 다시 보내드리겠습니다.' : '[조건 변경] 조건을 다시 협의하고 싶습니다.' }],
                  }
                : r,
            ),
            contracts: pendingContractId ? s.contracts.filter((c) => c.id !== pendingContractId) : s.contracts,
            documents: pendingContractId ? s.documents.filter((d) => d.contractId !== pendingContractId) : s.documents,
          };
        }),

      rejectRequest: (id, reason, by = 'spc') =>
        set((s) => {
          const r0 = s.requests.find((r) => r.id === id);
          const pendingContractId = r0?.contractId && s.contracts.find((c) => c.id === r0.contractId && c.status === 'PENDING_SIGN')?.id;
          return {
            requests: s.requests.map((r) =>
              r.id === id
                ? {
                    ...patchReq({ ...r, contractId: pendingContractId ? undefined : r.contractId }, 'REJECTED', ev(nowIso(), by, '반려', reason)),
                    rejectReason: reason,
                  }
                : r,
            ),
            contracts: pendingContractId ? s.contracts.filter((c) => c.id !== pendingContractId) : s.contracts,
            documents: pendingContractId ? s.documents.filter((d) => d.contractId !== pendingContractId) : s.documents,
          };
        }),

      cancelRequest: (id, note) =>
        set((s) => {
          // 서명 대기 중 취소면 아직 서명 안 한 계약(초안)도 지운다
          const r0 = s.requests.find((r) => r.id === id);
          const pendingContractId = r0?.contractId && s.contracts.find((c) => c.id === r0.contractId && c.status === 'PENDING_SIGN')?.id;
          return {
            requests: s.requests.map((r) =>
              r.id === id ? patchReq({ ...r, contractId: pendingContractId ? undefined : r.contractId }, 'CANCELLED', ev(nowIso(), r.applicant, '신청 취소', note)) : r,
            ),
            contracts: pendingContractId ? s.contracts.filter((c) => c.id !== pendingContractId) : s.contracts,
            documents: pendingContractId ? s.documents.filter((d) => d.contractId !== pendingContractId) : s.documents,
          };
        }),

      signAsGenerator: (contractId, mark) => {
        if (get().contracts.some((c) => c.id === contractId))
          sign(set, get, contractId, 'generator', mark);
      },
      confirmConsumerSign: (contractId, mark) => {
        if (get().contracts.some((c) => c.id === contractId))
          sign(set, get, contractId, 'consumer', mark);
      },

      requestChange: (input) => {
        const c = get().contracts.find((x) => x.id === input.contractId);
        const before = c
          ? input.type === 'PRICE'
            ? priceBefore(c)
            : input.type === 'CAPACITY'
              ? String(c.capacityKw)
              : input.type === 'TERM'
                ? c.endDate
                : undefined
          : undefined;
        // 변경 — 지금 조건에 바꾸자는 칸을 얹은 것이 신청 값(관리자가 조건 입력에서 이 값으로 시작)
        const nowTerms = c ? changeTermsOf(c) : undefined;
        const asked = input.type === 'CHANGE' && nowTerms ? { ...nowTerms, ...(input.terms ?? {}) } : undefined;
        const note = input.type === 'CHANGE' && nowTerms && asked ? changeSummary(nowTerms, asked, c!.kind) : undefined;
        const ch: ContractChange = {
          id: nextId(get().changes),
          no: seqNo('CH', get().changes),
          contractId: input.contractId,
          type: input.type,
          requestedBy: input.requestedBy,
          requestedByName: input.requestedByName,
          requestedAt: nowIso(),
          reason: input.reason,
          before,
          after: input.after,
          effectiveDate: input.effectiveDate,
          status: 'REQUESTED',
          // 해지도 신청 단계부터 — 받는 쪽이 해지 동의 / 반려를 한 뒤 전자서명(신청하자마자 서명으로 넘어가던 것을 고침, 2026-11-25 사용자)
          ...(asked ? { termsBefore: nowTerms, terms: asked, stage: 'AGREE' as const, proposedBy: input.requestedBy } : {}),
          events: [ev(nowIso(), input.requestedBy, '신청 접수', note ?? undefined)],
          messages: [],
        };
        set((s) => ({ changes: [ch, ...s.changes] }));
        return ch;
      },

      approveChange: (id, note) => {
        const ch = get().changes.find((x) => x.id === id);
        if (!ch) return;
        const at = nowIso();
        const contracts = get().contracts.map((c) => {
          if (c.id !== ch.contractId) return c;
          if (ch.type !== 'TERMINATE') {
            const t = ch.terms ?? termsFromRequest(c, ch);
            return {
              ...c,
              ...t,
              unitPrice: c.kind === 'ONSITE' ? t.unitPrice : c.unitPrice,
              endDate: addYears(c.startDate, t.termYears),
            };
          }
          return {
            ...c,
            status: 'TERMINATED' as const,
            terminatedAt: at.slice(0, 10), // 해지 승인된 날 바로(희망 해지일 없음)
          };
        });
        const c = contracts.find((x) => x.id === ch.contractId)!;
        const doc: TradeDocument = {
          id: nextId(get().documents),
          category: ch.type === 'TERMINATE' ? 'TERMINATE' : 'CHANGE',
          title: `${ch.type === 'TERMINATE' ? '계약 해지 합의서' : '계약 변경 합의서'} (서명본) — ${c.plantName}`,
          fileName: `${ch.no}_합의서.pdf`,
          contractId: c.id,
          contractNo: c.no,
          plantName: c.plantName,
          partyCompanyIds: [c.generatorCompanyId, c.consumerCompanyId],
          issuedAt: at.slice(0, 10),
          fileType: 'PDF',
          sizeKb: 640,
        };
        set((s) => ({
          contracts,
          documents: [doc, ...s.documents],
          changes: s.changes.map((x) =>
            x.id === id ? { ...x, status: 'APPROVED', decidedAt: at, decisionNote: note } : x,
          ),
        }));
      },

      agreeChange: (id, by) => {
        const ch0 = get().changes.find((x) => x.id === id);
        const c = ch0 && get().contracts.find((x) => x.id === ch0.contractId);
        if (!ch0 || !c) return;
        const terminate = ch0.type === 'TERMINATE';
        set((s) => ({
          changes: s.changes.map((x) =>
            x.id === id
              ? {
                  ...x,
                  // 변경도 동의하면 바로 전자서명(3단계) — 값은 신청 때 이미 들어 있다
                  stage: 'SIGN',
                  editingBy: undefined,
                  // 신청한 값 그대로 이어 간다 — 지금 계약 값으로 덮으면 신청한 값이 사라져 기본값으로 보였다(2026-11-18 사용자)
                  ...(terminate ? {} : { termsBefore: x.termsBefore ?? changeTermsOf(c), terms: x.terms ?? termsFromRequest(c, x) }),
                  events: [...(x.events ?? []), ev(nowIso(), by, terminate ? '해지 동의' : '변경 동의')],
                }
              : x,
          ),
        }));
      },
      saveChangeTerms: (id, terms, note, by = 'spc') =>
        set((s) => ({
          changes: s.changes.map((x) =>
            x.id === id ? { ...x, terms, events: [...(x.events ?? []), ev(nowIso(), by, '조건 입력', note)] } : x,
          ),
        })),
      confirmChangeTerms: (id, by = 'spc') =>
        set((s) => ({
          changes: s.changes.map((x) =>
            x.id === id
              ? {
                  ...x,
                  stage: 'AGREE',
                  proposedBy: by,
                  editingBy: undefined,
                  events: [...(x.events ?? []), ev(nowIso(), by, '조건 확정', '상대 동의 대기')],
                  messages: [...(x.messages ?? []), { at: nowIso(), by, byName: by === 'spc' ? CO.SPC.name : x.requestedByName, text: '[조건 변경] 바뀐 조건을 확인해 주세요.' }],
                }
              : x,
          ),
        })),
      counterChange: (id, terms, by, byName) =>
        set((s) => ({
          changes: s.changes.map((x) => {
            if (x.id !== id) return x;
            const c = s.contracts.find((k) => k.id === x.contractId);
            const note = c && x.termsBefore ? changeSummary(x.termsBefore, terms, c.kind) : undefined;
            return {
              ...x,
              terms,
              stage: 'AGREE',
              proposedBy: by,
              editingBy: undefined,
              events: [...(x.events ?? []), ev(nowIso(), by, '조건 확정', note)],
              messages: [...(x.messages ?? []), { at: nowIso(), by, byName, text: `[조건 확정] ${note ?? ''}` }],
            };
          }),
        })),
      unconfirmChangeTerms: (id, by = 'spc') =>
        set((s) => ({
          changes: s.changes.map((x) =>
            x.id === id ? { ...x, stage: 'TERMS', editingBy: by, termsPrev: x.terms, events: [...(x.events ?? []), ev(nowIso(), by, '조건 변경')] } : x,
          ),
        })),
      agreeChangeTerms: (id, by) =>
        set((s) => ({
          changes: s.changes.map((x) =>
            x.id === id ? { ...x, stage: 'SIGN', events: [...(x.events ?? []), ev(nowIso(), by, '조건 동의', '전자서명 대기')] } : x,
          ),
        })),
      moveChangeStage: (id, stage, note, by) =>
        set((s) => ({
          changes: s.changes.map((x) =>
            x.id === id
              ? {
                  ...x,
                  stage,
                  events: [...(x.events ?? []), ev(nowIso(), by ?? 'spc', x.type === 'TERMINATE' ? '해지 동의' : '변경 동의', note)],
                }
              : x,
          ),
        })),
      addChangeMessage: (id, by, byName, text) =>
        set((s) => ({
          changes: s.changes.map((x) =>
            x.id === id
              ? { ...x, messages: [...(x.messages ?? []), { at: nowIso(), by, byName, text }] }
              : x,
          ),
        })),
      updateChange: (id, patch, note) =>
        set((s) => ({
          changes: s.changes.map((x) =>
            x.id === id
              ? {
                  ...x,
                  ...patch,
                  events: [...(x.events ?? []), ev(nowIso(), 'spc', '조건 수정', note)],
                }
              : x,
          ),
        })),
      signChange: (id, side, sg) => {
        const ch0 = get().changes.find((x) => x.id === id);
        if (!ch0) return;
        const c0 = get().contracts.find((c) => c.id === ch0.contractId);
        const by: Party =
          side === 'spc'
            ? 'spc'
            : c0?.kind === 'ONSITE' || ch0.requestedBy === 'generator'
              ? 'generator'
              : 'consumer';
        const ch: ContractChange = {
          ...ch0,
          ...(side === 'spc' ? { spcSign: sg } : { companySign: sg }),
          events: [...(ch0.events ?? []), ev(sg.at, by, '전자서명', `${sg.name} 서명`)],
        };
        set((s) => ({ changes: s.changes.map((x) => (x.id === id ? ch : x)) }));
        // 둘 다 서명 — 계약 반영 · 서명본 합의서
        if (ch.spcSign && ch.companySign) {
          get().approveChange(id, '양쪽 합의서 서명');
          set((s) => ({
            changes: s.changes.map((x) =>
              x.id === id
                ? {
                    ...x,
                    events: [
                      ...(x.events ?? []),
                      ev(nowIso(), 'spc', x.type === 'TERMINATE' ? '해지 승인' : '승인 완료', '합의서(서명본) 문서 관리'),
                    ],
                  }
                : x,
            ),
          }));
        }
      },

      rejectChange: (id, note, by = 'spc') =>
        set((s) => ({
          changes: s.changes.map((x) =>
            x.id === id
              ? {
                  ...x,
                  status: 'REJECTED',
                  decidedAt: nowIso(),
                  decisionNote: note,
                  events: [...(x.events ?? []), ev(nowIso(), by, '반려', note)],
                }
              : x,
          ),
        })),

      cancelChange: (id) =>
        set((s) => ({
          changes: s.changes.map((x) =>
            x.id === id
              ? {
                  ...x,
                  status: 'CANCELLED',
                  decidedAt: nowIso(),
                  events: [...(x.events ?? []), ev(nowIso(), x.requestedBy, '신청 취소')],
                }
              : x,
          ),
        })),

      addDocument: (doc) =>
        set((s) => ({
          documents: [{ id: nextId(s.documents), issuedAt: today(), ...doc }, ...s.documents],
        })),

      attachOriginal: (id, original) =>
        set((s) => ({ documents: s.documents.map((d) => (d.id === id ? { ...d, original } : d)) })),

      saveInvoice: (key, patch) =>
        set((s) => ({ invoices: { ...s.invoices, [key]: { ...s.invoices[key], ...patch } } })),
      issueInvoice: (key) =>
        set((s) => ({
          invoices: {
            ...s.invoices,
            [key]: { ...s.invoices[key], status: 'BILLED', issuedAt: nowIso() },
          },
        })),
      payInvoice: (key) =>
        set((s) => ({
          invoices: {
            ...s.invoices,
            [key]: { ...s.invoices[key], status: 'PAID', paidAt: today() },
          },
        })),

      resetDemo: () => set(buildSeed()),
    }),
    {
      name: 'ulsan-trading-poc',
      storage: createJSONStorage(() => ssrSafeStorage),
      skipHydration: true,
      partialize: (s) => ({
        version: s.version,
        requests: s.requests,
        contracts: s.contracts,
        changes: s.changes,
        documents: s.documents,
        invoices: s.invoices,
      }),
      // 시드 버전이 다르면 저장본을 버린다
      merge: (persisted, current) => {
        const p = persisted as Partial<TradingPocState> | undefined;
        if (!p || p.version !== SEED_VERSION) return current;
        return { ...current, ...p };
      },
    },
  ),
);

function patchReq(
  r: TradeRequest,
  status: TradeRequestStatus,
  event: TradeRequest['events'][number],
): TradeRequest {
  return { ...r, status, updatedAt: event.at, events: [...r.events, event] };
}

function firstOfNextMonth() {
  const d = new Date();
  const y = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
  const m = d.getMonth() === 11 ? 1 : d.getMonth() + 2;
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

type Set = (fn: (s: TradingPocState) => Partial<TradingPocState>) => void;
type Get = () => TradingPocState;

/** 전자서명 — 발전사업자·전기사용자 둘 다 서명하면 계약 발효(ACTIVE), 신청은 체결(SIGNED), 서명본 문서 생성 */
function sign(set: Set, get: Get, contractId: number, party: 'generator' | 'consumer', mark?: Omit<SignMark, 'at'>) {
  const at = nowIso();
  const c0 = get().contracts.find((c) => c.id === contractId)!;
  const next: Contract = {
    ...c0,
    signedByGenerator: c0.signedByGenerator || party === 'generator',
    signedByConsumer: c0.signedByConsumer || party === 'consumer',
    ...(mark && party === 'generator' ? { signMarkGenerator: { ...mark, at } } : {}),
    ...(mark && party === 'consumer' ? { signMarkConsumer: { ...mark, at } } : {}),
  };
  const done = next.signedByGenerator && next.signedByConsumer;
  if (done) {
    next.status = 'ACTIVE';
    next.signedAt = at;
  }
  // 계약 상대가 플랫폼(SPC)이면 그쪽 서명은 SPC 로 남긴다
  const by: Party = party === 'consumer' ? 'consumer' : next.generatorCompanyId === CO.SPC.id ? 'spc' : 'generator';
  const events = [
    ev(at, by, '전자서명', party === 'consumer' ? `${next.consumerCompanyName} 서명` : `${next.generatorCompanyName} 서명`),
  ];
  if (done) events.push(ev(at, 'spc', '승인 완료', `계약 ${next.no} 발효 — 시작일 ${next.startDate}`));
  const docs: TradeDocument[] = done
    ? [
        {
          id: nextId(get().documents),
          category: 'SIGNED',
          title: `${next.kind === 'ONSITE' ? 'PPA 전력공급계약서' : '태양광 발전설비 및 부동산 교차 임대차 계약서'} (서명본)`,
          fileName: `${next.no}_계약서_서명본.pdf`,
          contractId: next.id,
          contractNo: next.no,
          plantName: next.plantName,
          partyCompanyIds: [next.generatorCompanyId, next.consumerCompanyId],
          issuedAt: at.slice(0, 10),
          fileType: 'PDF',
          sizeKb: 2260,
        },
      ]
    : [];
  set((s) => ({
    contracts: s.contracts.map((c) => (c.id === contractId ? next : c)),
    documents: [...docs, ...s.documents],
    requests: s.requests.map((r) => {
      if (r.id !== next.requestId) return r;
      const patched = { ...r, updatedAt: at, events: [...r.events, ...events] };
      return done ? { ...patched, status: 'SIGNED' as const } : patched;
    }),
  }));
}

/** 브라우저에서 저장본을 올린다 — 화면 최상단 컴포넌트에서 한 번 호출 */
export function useHydrateTradingPoc() {
  useEffect(() => {
    void useTradingPocStore.persist.rehydrate();
  }, []);
}

/** 발전사업자 로그인 회사가 당사자인지 */
export const isPartyOf = (
  companyId: number | null | undefined,
  x: { generatorCompanyId: number; consumerCompanyId: number },
) => !!companyId && (x.generatorCompanyId === companyId || x.consumerCompanyId === companyId);

export const DOC_CATEGORY_LABEL: Record<DocCategory, string> = {
  CONTRACT: '계약서 (초안)',
  SIGNED: '계약서',
  INVOICE: '청구서',
  TAX: '세금계산서',
  CHANGE: '변경 합의서',
  TERMINATE: '해지 합의서',
};
