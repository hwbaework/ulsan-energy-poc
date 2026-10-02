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
  ChangeType,
  Contract,
  ContractTerms,
  ContractChange,
  DocCategory,
  Party,
  TradeDocument,
  TermsProposal,
  TradeRequest,
  TradeRequestStatus,
} from '@/types/trading-poc';

export const SEED_VERSION = 16;

/* ── 회사 (로그인 계정은 useAuthStore 와 동일: 1 SPC · 2 전기사용자 · 3 발전사업자) ───────── */
export const CO = {
  SPC: { id: 1, name: '울산 에너지 플랫폼' },
  CONSUMER_LOGIN: { id: 2, name: '한길' }, // 데모 전기사용자 계정 = 한길
  GENERATOR_LOGIN: { id: 3, name: '울산 발전(주)' },
  HANIL: { id: 4, name: '한일튜브' },
  YONGIN: { id: 5, name: '용인금속' },
  TAESUNG: { id: 6, name: '태성산업' },
  GUNHO: { id: 7, name: '건호이엔씨' },
} as const;

/** 발전사업자 선택지 (관리자 대리 등록용) — 에스에너지는 EPC(시공)라 발전사업자가 아니다 */
export const GENERATOR_COMPANIES = [CO.GENERATOR_LOGIN, CO.SPC];

/** 기존 기업 — 거래 신청 '기존 기업 선택'. 실제 대상 5곳, 주소는 통합관제 발전소 주소와 같다 */
export const CONSUMERS: { id: number; name: string; address: string }[] = [
  { ...CO.CONSUMER_LOGIN, address: '울산 남구 용연동 490-11' },
  { ...CO.TAESUNG, address: '울산 남구 여천동 358-8' },
  { ...CO.GUNHO, address: '울산 남구 부곡동 22-5' },
  { ...CO.HANIL, address: '울산 남구 부곡동 273-6' },
  { ...CO.YONGIN, address: '울산 남구 여천동 887-18' },
];
/** 계약 기간 기본값 — onsite 20년 · 자가소비 10년 */
export const defaultTermYears = (kind: PlantContractKind) => (kind === 'ONSITE' ? 20 : 10);

const DEFAULT_PRICE: Record<PlantContractKind, number> = { ONSITE: 138, SELF_CONSUMPTION: 28 };
export const defaultUnitPrice = (kind: PlantContractKind) => DEFAULT_PRICE[kind];

const iso = (d: string, t = '09:00:00') => `${d}T${t}`;
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
/** 시드 계약 조건 — 무료진단 기본값(설치단가 ₩1,350,000/kW · 추가 시공비 ₩20,000,000 · O&M 1%) · onsite 는 1~3년 / 4년~ 두 구간 */
const TARIFF = { tariffPlan: '고압A 선택Ⅱ', tariffBasis: '2025-04 확정단가 (고시)' };
export function seedTermsOf(x: {
  kind: PlantContractKind;
  unitPrice: number;
  termYears: number;
}): ContractTerms {
  return x.kind === 'SELF_CONSUMPTION'
    ? {
        ...TARIFF,
        estInstallUnit: 1_350_000,
        installUnit: 1_350_000,
        extraCost: 20_000_000,
        omRatePct: 1,
        omIncluded: true,
      }
    : {
        ...TARIFF,
        omIncluded: true,
        segments: [
          { from: 1, to: 3, price: x.unitPrice },
          { from: 4, to: x.termYears, price: x.unitPrice },
        ],
      };
}

function seedContracts(): Contract[] {
  const base = (
    c: Omit<Contract, 'endDate' | 'createdAt' | 'address'> & { address?: string },
  ): Contract => ({
    address: '울산광역시',
    ...c,
    endDate: addYears(c.startDate, c.termYears),
    createdAt: iso(c.startDate),
    ...seedTermsOf(c),
  });
  return [
    base({
      id: 1,
      no: 'CT-2025-0001',
      requestId: 1,
      kind: 'ONSITE',
      plantId: 17514,
      plantName: '한일튜브(onsite)',
      generatorCompanyId: 3,
      generatorCompanyName: CO.GENERATOR_LOGIN.name,
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
      signedAt: iso('2025-02-20', '14:20:00'),
    }),
    base({
      id: 2,
      no: 'CT-2025-0002',
      requestId: 2,
      kind: 'SELF_CONSUMPTION',
      plantId: 17514,
      plantName: '한일튜브(자가소비)',
      generatorCompanyId: 3,
      generatorCompanyName: CO.GENERATOR_LOGIN.name,
      consumerCompanyId: 4,
      consumerCompanyName: CO.HANIL.name,
      siteName: '한일튜브 울산공장',
      address: '울산 남구 부곡동 273-6',
      capacityKw: 99.84,
      unitPrice: 28,
      termYears: 10,
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
      termYears: 10,
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
      termYears: 10,
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
      termYears: 10,
      startDate: '2024-11-01',
      status: 'ACTIVE',
      signedByGenerator: true,
      signedByConsumer: true,
      signedAt: iso('2024-10-25', '15:40:00'),
    }),
    base({
      id: 6,
      no: 'CT-2024-0006',
      requestId: 12,
      kind: 'SELF_CONSUMPTION',
      plantId: 17513,
      plantName: '건호이엔씨',
      generatorCompanyId: 1,
      generatorCompanyName: CO.SPC.name,
      consumerCompanyId: 7,
      consumerCompanyName: CO.GUNHO.name,
      siteName: '건호이엔씨 공장',
      address: '울산 남구 부곡동 22-5',
      capacityKw: 33.92,
      unitPrice: 26,
      termYears: 10,
      startDate: '2024-12-01',
      status: 'ACTIVE',
      signedByGenerator: true,
      signedByConsumer: true,
      signedAt: iso('2024-11-20', '09:30:00'),
    }),
    // 거래 승인 상태별 샘플(실제 기업·용량) — 승인: 아직 서명 없음 / 전자서명: 기업 서명 끝, 계약 상대 서명 남음
    {
      ...base({
        id: 7,
        no: 'CT-2026-0007',
        requestId: 4,
        kind: 'SELF_CONSUMPTION',
        plantName: '건호이엔씨',
        generatorCompanyId: 3,
        generatorCompanyName: CO.GENERATOR_LOGIN.name,
        consumerCompanyId: 7,
        consumerCompanyName: CO.GUNHO.name,
        siteName: '건호이엔씨 공장',
        address: '울산 남구 부곡동 22-5',
        capacityKw: 33.92,
        unitPrice: 26,
        termYears: 10,
        startDate: '2026-11-01',
        status: 'PENDING_SIGN',
        signedByGenerator: false,
        signedByConsumer: false,
      }),
      createdAt: iso('2026-09-15', '16:00:00'),
    },
    {
      ...base({
        id: 8,
        no: 'CT-2026-0008',
        requestId: 17,
        kind: 'SELF_CONSUMPTION',
        plantName: '한일튜브(자가소비)',
        generatorCompanyId: 3,
        generatorCompanyName: CO.GENERATOR_LOGIN.name,
        consumerCompanyId: 4,
        consumerCompanyName: CO.HANIL.name,
        siteName: '한일튜브 울산공장',
        address: '울산 남구 부곡동 273-6',
        capacityKw: 99.84,
        unitPrice: 28,
        termYears: 10,
        startDate: '2026-12-01',
        status: 'PENDING_SIGN',
        signedByGenerator: false,
        signedByConsumer: true,
      }),
      createdAt: iso('2026-09-22', '15:00:00'),
    },
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
    ...seedTermsOf(r),
    ...r,
    no: r.no ?? `TR-${r.submittedAt.slice(0, 4)}-${String(r.id).padStart(4, '0')}`,
    updatedAt: r.updatedAt ?? r.submittedAt,
    events: r.events ?? [ev(r.submittedAt, r.applicant, '신청 접수')],
  });
  const signedEvents = (submitted: string, review: string, approved: string, signed: string) => [
    ev(submitted, 'generator', '신청 접수'),
    ev(review, 'spc', '검토 시작'),
    ev(approved, 'spc', '승인', '계약서 초안 생성'),
    ev(signed, 'generator', '전자서명'),
    ev(signed, 'consumer', '전자서명'),
    ev(signed, 'spc', '체결'),
  ];
  const gen = {
    applicant: 'generator' as Party,
    applicantCompanyId: 3,
    applicantCompanyName: CO.GENERATOR_LOGIN.name,
    generatorCompanyId: 3,
    generatorCompanyName: CO.GENERATOR_LOGIN.name,
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
      plantName: '한일튜브(onsite)',
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
      note: '한일튜브 울산공장 지붕 태양광 329.6kW — 전량 onsite 공급',
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
      termYears: 10,
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
      termYears: 10,
      status: 'SIGNED',
      contractId: 3,
      submittedAt: iso('2025-03-15'),
      updatedAt: iso('2025-04-18', '11:00:00'),
      events: [
        ev(iso('2025-03-15'), 'consumer', '신청 접수'),
        ev(iso('2025-03-17'), 'spc', '검토 시작'),
        ev(iso('2025-03-28'), 'spc', '승인', '계약서 초안 생성'),
        ev(iso('2025-04-18', '10:40:00'), 'generator', '전자서명'),
        ev(iso('2025-04-18', '11:00:00'), 'consumer', '전자서명'),
        ev(iso('2025-04-18', '11:00:00'), 'spc', '체결'),
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
      termYears: 10,
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
      termYears: 10,
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
    mk({
      id: 12,
      ...spc,
      kind: 'SELF_CONSUMPTION',
      plantId: 17513,
      plantName: '건호이엔씨',
      consumerCompanyId: 7,
      consumerCompanyName: CO.GUNHO.name,
      siteName: '건호이엔씨 공장',
      address: '울산 남구 부곡동 22-5',
      capacityKw: 33.92,
      unitPrice: 26,
      termYears: 10,
      status: 'SIGNED',
      contractId: 6,
      submittedAt: iso('2024-10-20'),
      updatedAt: iso('2024-11-20', '09:30:00'),
      events: signedEvents(
        iso('2024-10-20'),
        iso('2024-10-22'),
        iso('2024-11-05'),
        iso('2024-11-20', '09:30:00'),
      ),
    }),
    // ── 상태별 샘플 1건씩 — 실제 기업·용량·조건만 ──
    // 신청 접수
    mk({
      id: 6,
      ...gen,
      kind: 'SELF_CONSUMPTION',
      consumerCompanyId: 2,
      consumerCompanyName: CO.CONSUMER_LOGIN.name,
      plantName: '한길',
      siteName: '한길',
      address: '울산 남구 용연동 490-11',
      capacityKw: 90.88,
      unitPrice: 28,
      termYears: 10,
      status: 'SUBMITTED',
      submittedAt: iso('2026-09-29', '15:10:00'),
      surveyRequested: true,
      surveyDate: '2026-10-15',
      contact: { name: '이수용', phone: '010-3000-0003', email: 'consumer@test.com' },
      messages: [
        {
          at: iso('2026-09-29', '15:12:00'),
          by: 'generator',
          byName: CO.GENERATOR_LOGIN.name,
          text: '한길 자가소비 90.88kW 신청합니다. 실측 일정 조율 부탁드립니다.',
        },
      ],
    }),
    // SPC 검토
    mk({
      id: 16,
      ...gen,
      kind: 'SELF_CONSUMPTION',
      consumerCompanyId: 5,
      consumerCompanyName: CO.YONGIN.name,
      plantName: '용인금속',
      siteName: '용인금속 울산공장',
      address: '울산 남구 여천동 887-18',
      capacityKw: 152.32,
      unitPrice: 26,
      termYears: 10,
      status: 'REVIEW',
      surveyRequested: false,
      submittedAt: iso('2026-09-28', '09:00:00'),
      updatedAt: iso('2026-09-30', '10:00:00'),
      events: [
        ev(iso('2026-09-28', '09:00:00'), 'generator', '신청 접수'),
        ev(iso('2026-09-30', '10:00:00'), 'spc', '검토 시작'),
      ],
      messages: [
        {
          at: iso('2026-09-30', '10:05:00'),
          by: 'spc',
          byName: CO.SPC.name,
          text: '도면으로 설치 면적 확인 중입니다.',
        },
      ],
    }),
    // 현장 실측
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
      unitPrice: 26,
      termYears: 10,
      status: 'REVIEW',
      submittedAt: iso('2026-09-25', '10:00:00'),
      updatedAt: iso('2026-09-26', '09:30:00'),
      surveyRequested: true,
      surveyDate: '2026-10-08',
      contact: { name: '설비 담당', phone: '052-000-0000' },
      events: [
        ev(iso('2026-09-25', '10:00:00'), 'spc', '신청 접수', '전화 문의 대리 접수'),
        ev(iso('2026-09-26', '09:30:00'), 'spc', '검토 시작'),
        ev(iso('2026-09-26', '09:40:00'), 'spc', '현장 실측', '2026-10-08 예정'),
      ],
      messages: [
        {
          at: iso('2026-09-25', '10:05:00'),
          by: 'spc',
          byName: CO.SPC.name,
          text: '전화 문의 접수 — 10월 8일 현장 실측 예정',
        },
      ],
    }),
    // 조건 협의 — 실측 끝, 신청 내용에서 조건을 바로 고친다
    mk({
      id: 5,
      ...gen,
      kind: 'ONSITE',
      plantName: '한일튜브(onsite)',
      consumerCompanyId: 4,
      consumerCompanyName: CO.HANIL.name,
      siteName: '한일튜브 울산공장',
      address: '울산 남구 부곡동 273-6',
      capacityKw: 329.6,
      unitPrice: 138,
      termYears: 20,
      status: 'REVIEW',
      submittedAt: iso('2026-09-20'),
      updatedAt: iso('2026-09-27', '11:00:00'),
      surveyRequested: true,
      surveyDate: '2026-09-26',
      surveyDoneAt: '2026-09-26',
      contact: { name: '시설 담당', phone: '052-000-0000' },
      events: [
        ev(iso('2026-09-20'), 'generator', '신청 접수'),
        ev(iso('2026-09-23', '10:30:00'), 'spc', '검토 시작'),
        ev(iso('2026-09-26', '12:00:00'), 'spc', '현장 실측 완료', '2026-09-26'),
      ],
      messages: [
        {
          at: iso('2026-09-22', '14:00:00'),
          by: 'spc',
          byName: CO.SPC.name,
          text: '9월 26일 오전 10시 현장 실측 가능하실까요?',
        },
        {
          at: iso('2026-09-22', '15:30:00'),
          by: 'generator',
          byName: CO.GENERATOR_LOGIN.name,
          text: '네, 26일 10시로 하겠습니다.',
        },
        {
          at: iso('2026-09-27', '11:00:00'),
          by: 'spc',
          byName: CO.SPC.name,
          text: '실측 결과 신청 조건 그대로 진행 가능합니다. 확인 부탁드립니다.',
        },
      ],
    }),
    // 반려
    mk({
      id: 8,
      ...gen,
      kind: 'SELF_CONSUMPTION',
      consumerCompanyId: 7,
      consumerCompanyName: CO.GUNHO.name,
      plantName: '건호이엔씨',
      siteName: '건호이엔씨 공장',
      address: '울산 남구 부곡동 22-5',
      capacityKw: 33.92,
      unitPrice: 26,
      termYears: 10,
      status: 'REJECTED',
      rejectReason: '설치 위치 도면 미제출 — 보완 후 재신청',
      submittedAt: iso('2026-08-03'),
      updatedAt: iso('2026-08-12', '17:20:00'),
      events: [
        ev(iso('2026-08-03'), 'generator', '신청 접수'),
        ev(iso('2026-08-05'), 'spc', '검토 시작'),
        ev(iso('2026-08-12', '17:20:00'), 'spc', '반려', '설치 위치 도면 미제출 — 보완 후 재신청'),
      ],
    }),
    // 취소
    mk({
      id: 9,
      ...gen,
      kind: 'SELF_CONSUMPTION',
      plantName: '한일튜브(자가소비)',
      consumerCompanyId: 4,
      consumerCompanyName: CO.HANIL.name,
      siteName: '한일튜브 울산공장',
      address: '울산 남구 부곡동 273-6',
      capacityKw: 99.84,
      unitPrice: 28,
      termYears: 10,
      status: 'CANCELLED',
      submittedAt: iso('2026-07-08'),
      updatedAt: iso('2026-07-21', '09:00:00'),
      events: [
        ev(iso('2026-07-08'), 'generator', '신청 접수'),
        ev(iso('2026-07-21', '09:00:00'), 'generator', '신청 취소', '설치 일정 보류'),
      ],
    }),
    // 승인 — 서명 전(거래 승인)
    mk({
      id: 4,
      ...gen,
      kind: 'SELF_CONSUMPTION',
      consumerCompanyId: 7,
      consumerCompanyName: CO.GUNHO.name,
      plantName: '건호이엔씨',
      siteName: '건호이엔씨 공장',
      address: '울산 남구 부곡동 22-5',
      capacityKw: 33.92,
      unitPrice: 26,
      termYears: 10,
      status: 'APPROVED',
      contractId: 7,
      submittedAt: iso('2026-09-02'),
      updatedAt: iso('2026-09-15', '16:00:00'),
      events: [
        ev(iso('2026-09-02'), 'generator', '신청 접수'),
        ev(iso('2026-09-04'), 'spc', '검토 시작'),
        ev(iso('2026-09-15', '16:00:00'), 'spc', '승인', '계약서 초안 생성 — 양측 전자서명 대기'),
      ],
    }),
    // 전자서명 — 기업 서명 끝(거래 승인)
    mk({
      id: 17,
      ...gen,
      kind: 'SELF_CONSUMPTION',
      plantName: '한일튜브(자가소비)',
      consumerCompanyId: 4,
      consumerCompanyName: CO.HANIL.name,
      siteName: '한일튜브 울산공장',
      address: '울산 남구 부곡동 273-6',
      capacityKw: 99.84,
      unitPrice: 28,
      termYears: 10,
      status: 'APPROVED',
      contractId: 8,
      submittedAt: iso('2026-09-05'),
      updatedAt: iso('2026-09-23', '11:00:00'),
      events: [
        ev(iso('2026-09-05'), 'generator', '신청 접수'),
        ev(iso('2026-09-08'), 'spc', '검토 시작'),
        ev(iso('2026-09-22', '15:00:00'), 'spc', '승인', '계약서 초안 생성 — 양측 전자서명 대기'),
        ev(iso('2026-09-23', '11:00:00'), 'consumer', '전자서명'),
      ],
    }),
  ];
}

function seedChanges(): ContractChange[] {
  return [
    {
      id: 1,
      no: 'CH-2026-0001',
      contractId: 1,
      type: 'PRICE',
      segment: 2,
      requestedBy: 'generator',
      requestedByName: CO.GENERATOR_LOGIN.name,
      requestedAt: iso('2026-09-18', '14:00:00'),
      reason: '모듈 교체·유지보수 비용 상승분 반영 (2027년 1월 적용 희망)',
      before: '138',
      after: '142',
      status: 'REQUESTED',
    },
    {
      id: 3,
      no: 'CH-2026-0003',
      contractId: 2,
      type: 'TERM',
      requestedBy: 'generator',
      requestedByName: CO.GENERATOR_LOGIN.name,
      requestedAt: iso('2026-07-01'),
      reason: '운영관리 기간 5년 연장',
      before: '2035-02-28',
      after: '2040-02-28',
      status: 'REJECTED',
      decidedAt: iso('2026-07-10', '16:30:00'),
      decisionNote: '기간 연장은 만료 1년 전부터 신청 가능',
    },
    {
      id: 6,
      no: 'CH-2026-0006',
      contractId: 2,
      type: 'PRICE',
      requestedBy: 'generator',
      requestedByName: CO.GENERATOR_LOGIN.name,
      requestedAt: iso('2026-01-12'),
      reason: '인버터 정기 점검을 O&M 범위에 포함',
      before: '0.8',
      after: '1',
      status: 'APPROVED',
      decidedAt: iso('2026-01-28', '15:00:00'),
      decisionNote: '2026-02 정산분부터 적용',
    },
    {
      id: 7,
      no: 'CH-2026-0007',
      contractId: 1,
      type: 'CAPACITY',
      requestedBy: 'generator',
      requestedByName: CO.GENERATOR_LOGIN.name,
      requestedAt: iso('2026-06-02'),
      reason: '용량 변경 검토',
      before: '329.6',
      after: '429.44',
      status: 'CANCELLED',
      decidedAt: iso('2026-06-20', '09:00:00'),
    },
  ];
}

/* ── 월 정산 — 계약에서 계산 (세금계산서·청구서 화면이 /ppa/settlements 로 읽는다) ───────── */
const YIELD_KWH_PER_KW = [95, 100, 125, 135, 145, 130, 120, 125, 118, 112, 92, 88]; // 1월~12월, 울산 태양광 월 발전시간 근사
/** 마지막으로 끝난 달 — 2026-10-02 기준 9월분까지 발행 */
const LAST_CONFIRMED = '2026-09';
const CURRENT_PERIOD = LAST_CONFIRMED;

/** 월 정산 한 줄 — 계약 조건에 따른 금액 */
export type TradeSettlement = PpaSettlement & {
  consumerCompanyName: string;
  generatorCompanyName: string;
  kind: PlantContractKind;
  segment?: number;
  omRatePct?: number;
};

/** 계약 연차(1부터) — 시작월 기준 */
function contractYear(start: string, period: string) {
  const [sy = 2026, sm = 1] = start.split('-').map(Number);
  const [py = 2026, pm = 1] = period.split('-').map(Number);
  return Math.floor((py * 12 + pm - (sy * 12 + sm)) / 12) + 1;
}
/** 계약 조건 → 그 달 금액(부가세 전). 조건이 없는 예전 계약은 단가 × 발전량 */
export function termsAmount(
  c: Contract,
  period: string,
  kwh: number,
): { supply: number; price?: number; segment?: number; omRatePct?: number } {
  if (c.kind === 'SELF_CONSUMPTION' && c.omRatePct && c.installUnit) {
    const total = c.capacityKw * c.installUnit + (c.extraCost ?? 0);
    return { supply: Math.round((total * c.omRatePct) / 100 / 12), omRatePct: c.omRatePct };
  }
  if (c.kind === 'ONSITE' && c.segments?.length) {
    const y = contractYear(c.startDate, period);
    const idx = Math.max(
      0,
      c.segments.findIndex((g) => y >= g.from && y <= g.to),
    );
    const g = c.segments[idx] ?? c.segments[c.segments.length - 1]!;
    return { supply: Math.round(kwh * g.price), price: g.price, segment: idx + 1 };
  }
  return { supply: Math.round(kwh * c.unitPrice), price: c.unitPrice };
}

/** 청구 상태 — 달이 끝나야 발행되므로 예정은 없다. 마지막 달은 납부 대기, 그 전은 납부 완료 */
export type BillingStatus = 'PAID' | 'BILLED';
export const billingStatusOf = (period: string): BillingStatus =>
  period === LAST_CONFIRMED ? 'BILLED' : 'PAID';
/** 작성일 — 그 달 말일 · 발행일 — 다음 달 1일(달이 끝나고 사용량 확정) · 납부 기한 — 다음 달 25일 */
export const writtenDateOf = (period: string) => {
  const [y = 2026, m = 1] = period.split('-').map(Number);
  return `${period}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
};
export const issueDateOf = (period: string) => nextMonthDay(period, 1);
export const dueDateOf = (period: string) => nextMonthDay(period, 25);

export function settlementsOf(contracts: Contract[]): TradeSettlement[] {
  const out: TradeSettlement[] = [];
  let id = 1;
  for (const c of contracts) {
    if (c.status === 'PENDING_SIGN' || c.kind !== 'ONSITE') continue; // 자가소비는 월 청구 없음(O&M 은 계약에 포함)
    const firstMonth = c.startDate.slice(0, 7) > '2026-01' ? c.startDate.slice(0, 7) : '2026-01';
    const lastMonth = c.terminatedAt ? c.terminatedAt.slice(0, 7) : CURRENT_PERIOD;
    for (let m = 1; m <= 12; m++) {
      const period = `2026-${String(m).padStart(2, '0')}`;
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
        segment: t.segment,
        omRatePct: t.omRatePct,
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
function seedDocuments(contracts: Contract[]): TradeDocument[] {
  const docs: TradeDocument[] = [];
  let id = 1;
  const push = (d: Omit<TradeDocument, 'id'>) => docs.push({ id: id++, ...d });
  const parties = (c: Contract) => [c.generatorCompanyId, c.consumerCompanyId];
  for (const c of contracts) {
    if (!c.signedAt) continue;
    push({
      category: 'SIGNED',
      title: `${c.kind === 'ONSITE' ? 'onsite 전력공급계약서' : '태양광 발전설비 및 부동산 교차 임대차 계약서'} — ${c.consumerCompanyName}`,
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
  for (const s of settlementsOf(contracts)) {
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
  const changes = seedChanges();
  return {
    version: SEED_VERSION,
    requests: seedRequests(),
    contracts,
    changes,
    documents: seedDocuments(contracts),
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
  reviewNo?: string;
  tariffPlan?: string;
  tariffBasis?: string;
  estInstallUnit?: number;
  installUnit?: number;
  extraCost?: number;
  omRatePct?: number;
  omIncluded?: boolean;
  surveyRequested?: boolean;
  surveyDate?: string;
  segments?: { from: number; to: number; price: number }[];
  contact?: { name: string; phone: string; email?: string };
}

export interface NewChangeInput {
  contractId: number;
  type: ChangeType;
  /** onsite 단가 변경 — 몇 구간 */
  segment?: number;
  requestedBy: Party;
  requestedByName: string;
  reason: string;
  after?: string;
  effectiveDate?: string;
}

interface TradingPocState {
  version: number;
  requests: TradeRequest[];
  contracts: Contract[];
  changes: ContractChange[];
  documents: TradeDocument[];
  submitRequest: (input: NewRequestInput) => TradeRequest;
  startReview: (id: number, note?: string) => void;
  approveRequest: (id: number, note?: string) => void;
  /** 계약 현황 — 메시지 · 현장 실측 완료 · 조건 제안 · 제안 응답(수락 / 수정 요청) */
  addMessage: (id: number, by: Party, byName: string, text: string) => void;
  markSurveyDone: (id: number, date: string) => void;
  /** 검토 → 현장 실측 / 조건 협의로 넘긴다 */
  moveStage: (id: number, label: '현장 실측' | '조건 협의', note?: string) => void;
  /** 조건 협의 — 신청 내용의 조건을 그 자리에서 고친다 */
  updateTerms: (
    id: number,
    terms: Partial<
      Pick<
        TradeRequest,
        'capacityKw' | 'termYears' | 'installUnit' | 'extraCost' | 'omRatePct' | 'segments'
      >
    >,
    note?: string,
  ) => void;
  proposeTerms: (id: number, terms: TermsProposal['terms'], note?: string) => void;
  respondProposal: (id: number, accept: boolean, note?: string) => void;
  rejectRequest: (id: number, reason: string) => void;
  cancelRequest: (id: number, note?: string) => void;
  signAsGenerator: (contractId: number) => void;
  confirmConsumerSign: (contractId: number) => void;
  requestChange: (input: NewChangeInput) => ContractChange;
  approveChange: (id: number, note?: string) => void;
  rejectChange: (id: number, note: string) => void;
  cancelChange: (id: number) => void;
  addDocument: (doc: Omit<TradeDocument, 'id' | 'issuedAt'> & { issuedAt?: string }) => void;
  resetDemo: () => void;
}

// 로컬 시각(한국) 기준 — toISOString 은 UTC 라 9시간 어긋난다
/** 단가 변경 전 값 — onsite 는 그 구간 단가, 자가소비는 연간 O&M %, 예전 계약은 단가 */
function priceBefore(c: Contract, segment?: number) {
  if (c.kind === 'ONSITE' && c.segments?.length)
    return String(c.segments[(segment ?? 1) - 1]?.price ?? c.unitPrice);
  if (c.kind === 'SELF_CONSUMPTION' && c.omRatePct != null) return String(c.omRatePct);
  return String(c.unitPrice);
}
function applyPrice(c: Contract, after: number, segment?: number): Contract {
  if (c.kind === 'ONSITE' && c.segments?.length) {
    const i = (segment ?? 1) - 1;
    const segments = c.segments.map((g, k) => (k === i ? { ...g, price: after } : g));
    return { ...c, segments, unitPrice: segments[0]!.price };
  }
  if (c.kind === 'SELF_CONSUMPTION' && c.omRatePct != null) return { ...c, omRatePct: after };
  return { ...c, unitPrice: after };
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

      startReview: (id, note) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id ? patchReq(r, 'REVIEW', ev(nowIso(), 'spc', '검토 시작', note)) : r,
          ),
        })),

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

      markSurveyDone: (id, date) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id
              ? {
                  ...r,
                  surveyDoneAt: date,
                  updatedAt: nowIso(),
                  events: [...r.events, ev(nowIso(), 'spc', '현장 실측 완료', date)],
                }
              : r,
          ),
        })),

      moveStage: (id, label, note) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id
              ? {
                  ...r,
                  updatedAt: nowIso(),
                  events: [...r.events, ev(nowIso(), 'spc', label, note)],
                }
              : r,
          ),
        })),

      updateTerms: (id, terms, note) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id
              ? {
                  ...r,
                  ...terms,
                  updatedAt: nowIso(),
                  events: [...r.events, ev(nowIso(), 'spc', '조건 수정', note)],
                }
              : r,
          ),
        })),

      proposeTerms: (id, terms, note) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id
              ? {
                  ...r,
                  updatedAt: nowIso(),
                  proposal: { at: nowIso(), terms, note, status: 'OPEN' },
                  events: [...r.events, ev(nowIso(), 'spc', '조건 제안', note)],
                }
              : r,
          ),
        })),

      respondProposal: (id, accept, note) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id && r.proposal
              ? {
                  ...r,
                  updatedAt: nowIso(),
                  proposal: {
                    ...r.proposal,
                    status: accept ? 'ACCEPTED' : 'REVISE',
                    respondedAt: nowIso(),
                    responseNote: note,
                  },
                  events: [
                    ...r.events,
                    ev(nowIso(), r.applicant, accept ? '제안 수락' : '수정 요청', note),
                  ],
                }
              : r,
          ),
        })),

      approveRequest: (id, note) => {
        const r0 = get().requests.find((x) => x.id === id);
        if (!r0) return;
        // 수락한 조건 제안이 있으면 그 조건으로 계약
        const r: TradeRequest =
          r0.proposal?.status === 'ACCEPTED'
            ? {
                ...r0,
                ...r0.proposal.terms,
                unitPrice: r0.proposal.terms.segments?.[0]?.price ?? r0.unitPrice,
              }
            : r0;
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
          // 신청의 계약 조건 그대로 — 내 계약에서 같은 값
          reviewNo: r.reviewNo,
          tariffPlan: r.tariffPlan,
          tariffBasis: r.tariffBasis,
          estInstallUnit: r.estInstallUnit,
          installUnit: r.installUnit,
          extraCost: r.extraCost,
          omRatePct: r.omRatePct,
          omIncluded: r.omIncluded,
          segments: r.segments,
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
          title: `${r.kind === 'ONSITE' ? 'onsite 전력공급계약서' : '태양광 발전설비 및 부동산 교차 임대차 계약서'} (초안)`,
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
                    ev(at, 'spc', '승인', note ?? '계약서 초안 생성 — 양측 전자서명 대기'),
                  ),
                  contractId: contract.id,
                }
              : x,
          ),
        }));
      },

      rejectRequest: (id, reason) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id
              ? {
                  ...patchReq(r, 'REJECTED', ev(nowIso(), 'spc', '반려', reason)),
                  rejectReason: reason,
                }
              : r,
          ),
        })),

      cancelRequest: (id, note) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id
              ? patchReq(r, 'CANCELLED', ev(nowIso(), r.applicant, '신청 취소', note))
              : r,
          ),
        })),

      signAsGenerator: (contractId) => {
        if (get().contracts.some((c) => c.id === contractId))
          sign(set, get, contractId, 'generator');
      },
      confirmConsumerSign: (contractId) => {
        if (get().contracts.some((c) => c.id === contractId))
          sign(set, get, contractId, 'consumer');
      },

      requestChange: (input) => {
        const c = get().contracts.find((x) => x.id === input.contractId);
        const before = c
          ? input.type === 'PRICE'
            ? priceBefore(c, input.segment)
            : input.type === 'CAPACITY'
              ? String(c.capacityKw)
              : input.type === 'TERM'
                ? c.endDate
                : undefined
          : undefined;
        const ch: ContractChange = {
          id: nextId(get().changes),
          no: seqNo('CH', get().changes),
          contractId: input.contractId,
          type: input.type,
          segment: input.segment,
          requestedBy: input.requestedBy,
          requestedByName: input.requestedByName,
          requestedAt: nowIso(),
          reason: input.reason,
          before,
          after: input.after,
          effectiveDate: input.effectiveDate,
          status: 'REQUESTED',
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
          if (ch.type === 'PRICE') return applyPrice(c, Number(ch.after), ch.segment);
          if (ch.type === 'CAPACITY') return { ...c, capacityKw: Number(ch.after) };
          if (ch.type === 'TERM') return { ...c, endDate: String(ch.after) };
          return {
            ...c,
            status: 'TERMINATED' as const,
            terminatedAt: ch.effectiveDate ?? at.slice(0, 10),
          };
        });
        const c = contracts.find((x) => x.id === ch.contractId)!;
        const doc: TradeDocument = {
          id: nextId(get().documents),
          category: 'CHANGE',
          title: `${ch.type === 'TERMINATE' ? '계약 해지 합의서' : '계약 변경 합의서'} — ${c.plantName}`,
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

      rejectChange: (id, note) =>
        set((s) => ({
          changes: s.changes.map((x) =>
            x.id === id ? { ...x, status: 'REJECTED', decidedAt: nowIso(), decisionNote: note } : x,
          ),
        })),

      cancelChange: (id) =>
        set((s) => ({
          changes: s.changes.map((x) =>
            x.id === id ? { ...x, status: 'CANCELLED', decidedAt: nowIso() } : x,
          ),
        })),

      addDocument: (doc) =>
        set((s) => ({
          documents: [{ id: nextId(s.documents), issuedAt: today(), ...doc }, ...s.documents],
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

/** 전자서명 — 발전사업자·수용가 둘 다 서명하면 계약 발효(ACTIVE), 신청은 체결(SIGNED), 서명본 문서 생성 */
function sign(set: Set, get: Get, contractId: number, party: 'generator' | 'consumer') {
  const at = nowIso();
  const c0 = get().contracts.find((c) => c.id === contractId)!;
  const next: Contract = {
    ...c0,
    signedByGenerator: c0.signedByGenerator || party === 'generator',
    signedByConsumer: c0.signedByConsumer || party === 'consumer',
  };
  const done = next.signedByGenerator && next.signedByConsumer;
  if (done) {
    next.status = 'ACTIVE';
    next.signedAt = at;
  }
  const events = [
    ev(at, party, '전자서명', party === 'consumer' ? '수용가 서명 확인 (SPC)' : undefined),
  ];
  if (done) events.push(ev(at, 'spc', '체결', `계약 ${next.no} 발효 — 시작일 ${next.startDate}`));
  const docs: TradeDocument[] = done
    ? [
        {
          id: nextId(get().documents),
          category: 'SIGNED',
          title: `${next.kind === 'ONSITE' ? 'onsite 전력공급계약서' : '태양광 발전설비 및 부동산 교차 임대차 계약서'} (서명본)`,
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
  CHANGE: '변경·해지 합의서',
};
