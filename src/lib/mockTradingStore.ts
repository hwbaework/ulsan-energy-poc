/* ════════════════════════════════════════════════════════════════════
 * MOCK TRADING STORE — API 미연결 단계 전용 (2026-06-10 지시)
 *
 * /platform/trading (SPC) · /ppa/trading (수용가) · /generator/trading (발전사)
 * 세 페이지가 공유하는 localStorage 기반 mock 데이터.
 * 같은 키를 보고 같은 데이터를 읽으며, 한쪽에서 mutate 하면 storage 이벤트로
 * 다른 탭에도 즉시 반영됨.
 *
 * 데이터 shape 은 백엔드 타입(TradingRequest, TradingMatch — src/types/trading.ts)과
 * 100% 동일 + mock 전용 확장 필드만 추가 (MockTradingMatch 참고).
 *
 * API 연결 시:
 *   1) 이 파일 삭제
 *   2) 호출부의 useMockTrading* 훅을 실 API 훅(useTradingRequests 등)으로 교체
 *   탐색 키워드: TODO(API)
 *
 * ── 매칭 협상 흐름 (발전사 먼저) ──
 *   SPC 매칭(제안단가+메모)   → match: PROPOSED      → 발전사 카드 (수락/거절)
 *   발전사 수락               → match: GEN_ACCEPTED  → 수용가 카드 (수락/거절), 수용가 step 3
 *   수용가 수락               → match: ACCEPTED      → 양측 MATCHED (step 4)
 *   어느 쪽이든 거절          → match: DECLINED      → 양측 SUBMITTED 복귀 (SPC 재매칭)
 * ════════════════════════════════════════════════════════════════════ */

'use client';

import { useSyncExternalStore } from 'react';
import type {
  TradingRequest,
  TradingMatch,
  CreateTradingRequest,
  CreateTradingMatch,
} from '@/types';

/* ───────────────────────── Types ───────────────────────── */

// mock 전용 확장 — 백엔드 TradingRequest 에 없는 필드 (API 연결 시 백엔드 협의 필요)
export interface MockTradingRequest extends TradingRequest {
  ppaSubType?: 'onsite' | 'offsite'; // 직접 PPA 하위 유형 — 백엔드 dealType 은 'PPA' 단일
  contractKind?: 'SELF_CONSUMPTION' | 'ONSITE'; // 울산 에자자 계약 유형: 자가소비 / 온사이트 PPA
}

// mock 전용 확장 — 백엔드 TradingMatch 에 없는 필드 (API 연결 시 백엔드 협의 필요)
export interface MockTradingMatch extends TradingMatch {
  generatorRequestId?: number; // 발전사 본인 신청에서 매칭을 찾기 위한 역참조
  consumerCompanyName?: string; // 발전사 카드에 수용가 표시용
  notes?: string; // SPC 협상 메모
  tradeFeeSupplyKwh?: number; // SPC 거래수수료 (전력공급거래 ₩/kWh)
  declinedBy?: 'GENERATOR' | 'CONSUMER'; // 어느 쪽이 거절했는지
  declineReason?: string; // 거절 사유 (재매칭 시 SPC 참고)
  ppaSubType?: 'onsite' | 'offsite'; // 직접 PPA 하위 유형 — 발전사 쪽 표시용
  // ── 직접 PPA 전용 — 단가(₩/kWh) 대신 수익 분배율 구조 ──
  sharePct?: number; // 발전사 분배율 (%)
  monthlyRevenue?: number; // 월 발전 수익 예상 총액 (₩)
}

export interface MockTradingState {
  requests: MockTradingRequest[];
  matches: MockTradingMatch[];
  nextRequestId: number;
  nextMatchId: number;
}

/* ───────────────────────── Seeds ───────────────────────── */

// v3 — showcase 모드 (버튼 상태변경 제거 이전에 localStorage 에 저장된 v1/v2 데이터 무시)
// 현재는 어떤 버튼도 mutation 을 호출하지 않으므로 이 키에 데이터가 쓰일 일 없음 = 항상 seed 고정
// v10 — 승인 대기 시드를 POC 발전사(울산 발전(주) · 한일튜브)로 교체. 키를 올려 저장된 옛 상태를 버린다
const STORAGE_KEY = 'energy-frontend:mock-trading-v10';

/* 수용가 신청 12종 — 3개 유형 × 4단계 전부 노출 (mock 뽑아내기 모드)
 *   Offsite PPA: id 1~4 (step 1~4)
 *   Onsite  PPA: id 5~8 (step 1~4)
 *   Lease   PPA: id 9~12 (step 1~4)
 * step 매핑: 1=SUBMITTED, 2·3=MATCHING, 4=MATCHED */
const consumerSeed = (
  id: number,
  step: number,
  sub: 'onsite' | 'offsite' | undefined,
  dealType: string,
  capacityKw: number,
  desiredUnitPrice: number,
  siteName: string,
): MockTradingRequest => ({
  id,
  requesterType: 'CONSUMER',
  companyId: 1,
  companyName: '한일튜브(주)',
  dealType,
  status: step === 4 ? 'MATCHED' : step === 1 ? 'SUBMITTED' : 'MATCHING',
  capacityKw,
  durationYears: 20,
  desiredUnitPrice,
  region: '울산',
  siteName,
  // plantName / expectedAnnualKwh / recEligible: 수용가 신청이라 없음
  notes: undefined,
  currentStep: step,
  submittedAt: `2026-06-${String(2 + id).padStart(2, '0')}T09:00:00`,
  createdAt: `2026-06-${String(2 + id).padStart(2, '0')}T09:00:00`,
  ppaSubType: sub, // mock 전용 — 직접 PPA 하위 유형
});

/* 매칭 9건 — step 2(PROPOSED)·3(GEN_ACCEPTED)·4(ACCEPTED) 행에 1건씩 */
const matchSeed = (
  id: number,
  requestId: number,
  status: string,
  generatorCompanyId: number,
  generatorCompanyName: string,
  plantName: string,
  capacityKw: number,
  proposedPriceKrw: number,
  notes: string,
  ppaSubType?: 'onsite' | 'offsite',
  lease?: { sharePct: number; monthlyRevenue: number }, // Lease 전용 — 분배율·월 수익
): MockTradingMatch => ({
  ppaSubType,
  sharePct: lease?.sharePct,
  monthlyRevenue: lease?.monthlyRevenue,
  id,
  requestId,
  generatorCompanyId,
  generatorCompanyName,
  plantName,
  resourceType: '태양광',
  capacityKw,
  proposedPriceKrw,
  status,
  createdAt: '2026-06-11T10:00:00',
  // generatorRequestId: showcase 매칭이라 발전사 신청과 미연결 (발전사 페이지 오염 방지)
  consumerCompanyName: '한일튜브(주)',
  notes,
  tradeFeeSupplyKwh: 1.0,
});

const SEED: MockTradingState = {
  requests: [
    // ── 직접 PPA — Offsite (₩150 희망, 500 kW) ──
    consumerSeed(1, 1, 'offsite', 'PPA', 500, 150, '한일튜브 본사'),
    consumerSeed(2, 2, 'offsite', 'PPA', 500, 150, '한일튜브 본사'),
    consumerSeed(3, 3, 'offsite', 'PPA', 500, 150, '한일튜브 본사'),
    consumerSeed(4, 4, 'offsite', 'PPA', 500, 150, '한일튜브 본사'),
    // ── 직접 PPA — Onsite (₩145 희망, 300 kW) ──
    consumerSeed(5, 1, 'onsite', 'PPA', 300, 145, '한일튜브 제2공장'),
    consumerSeed(6, 2, 'onsite', 'PPA', 300, 145, '한일튜브 제2공장'),
    consumerSeed(7, 3, 'onsite', 'PPA', 300, 145, '한일튜브 제2공장'),
    consumerSeed(8, 4, 'onsite', 'PPA', 300, 145, '한일튜브 제2공장'),
    // ── 직접 PPA (₩92.6, 429.44 kW) ──
    consumerSeed(9, 1, undefined, 'SAVINGS_SHARE', 429.44, 92.6, '한일튜브 본사'),
    consumerSeed(10, 2, undefined, 'SAVINGS_SHARE', 429.44, 92.6, '한일튜브 본사'),
    consumerSeed(11, 3, undefined, 'SAVINGS_SHARE', 429.44, 92.6, '한일튜브 본사'),
    consumerSeed(12, 4, undefined, 'SAVINGS_SHARE', 429.44, 92.6, '한일튜브 본사'),
    // ── 거절 후 재매칭 대기 케이스 (SPC 액션 필요) ──
    consumerSeed(19, 1, 'offsite', 'PPA', 700, 145, '한일튜브 본사'),
    consumerSeed(20, 1, 'onsite', 'PPA', 250, 140, '한일튜브 제2공장'),
    /* ── 발전사 자원 등록 (발전사 페이지용) — 프로세스: ①자원 등록 ②SPC 승인 ③희망가격 기입 → 매칭 풀
     * status 매핑 (mock — TODO(API): 백엔드 status enum 에 APPROVED 추가 협의):
     *   SUBMITTED = 등록 접수·승인 대기 / APPROVED = 승인 완료·희망가 미기입 /
     *   MATCHING = 희망가 기입 완료·매칭 풀 / MATCHED = 계약 체결
     * desiredUnitPrice 0 = 희망가 미기입 (승인 후 발전사가 기입) */
    {
      // 승인 대기 — POC 발전사업자(울산 발전(주))의 한일튜브 추가 공급 신청
      id: 13,
      requesterType: 'GENERATOR',
      companyId: 3,
      companyName: '울산 발전(주)',
      dealType: 'PPA',
      contractKind: 'ONSITE', // 계약 유형: 자가소비 / 온사이트 PPA (PlantContractKind)
      status: 'SUBMITTED', // 승인 대기 — 희망가는 승인 후 기입
      capacityKw: 429.44,
      durationYears: 20,
      desiredUnitPrice: 0,
      region: '울산 남구',
      plantName: '한일튜브',
      expectedAnnualKwh: 560_000,
      recEligible: true,
      notes: '자원: 태양광 / 사업자번호: 610-81-20002',
      currentStep: 2,
      submittedAt: '2026-09-20T10:00:00',
      createdAt: '2026-09-20T10:00:00',
    },
    {
      id: 14,
      requesterType: 'GENERATOR',
      companyId: 2,
      companyName: '주식회사 알엠에스플랫폼',
      dealType: 'PPA',
      status: 'MATCHING', // 희망가 기입 완료 → 매칭 풀 등록
      capacityKw: 800,
      durationYears: 20,
      desiredUnitPrice: 148,
      region: '울산',
      plantName: 'D발전소',
      expectedAnnualKwh: 1_400_000,
      recEligible: true,
      notes: '자원: 풍력 / 사업자번호: 611-86-00591',
      currentStep: 4,
      submittedAt: '2026-06-11T09:30:00',
      createdAt: '2026-06-11T09:30:00',
    },
    {
      id: 15,
      requesterType: 'GENERATOR',
      companyId: 2,
      companyName: '주식회사 알엠에스플랫폼',
      dealType: 'PPA',
      status: 'APPROVED', // 승인 완료 — 희망가격 기입 대기
      capacityKw: 600,
      durationYears: 20,
      desiredUnitPrice: 0,
      region: '울산',
      plantName: 'E발전소',
      expectedAnnualKwh: 850_000,
      recEligible: true,
      notes: '자원: 태양광 / 사업자번호: 611-86-00591',
      currentStep: 3,
      submittedAt: '2026-06-09T14:00:00',
      createdAt: '2026-06-09T14:00:00',
    },
    // ── 발전사 거래 진행 4단계 showcase (F·G·H 발전소) ──
    {
      id: 16,
      requesterType: 'GENERATOR',
      companyId: 2,
      companyName: '주식회사 알엠에스플랫폼',
      dealType: 'PPA',
      status: 'MATCHING', // step 2 — SPC 매칭 (PROPOSED 매칭 도착)
      capacityKw: 1000,
      durationYears: 20,
      desiredUnitPrice: 152,
      region: '울산',
      plantName: 'F발전소',
      expectedAnnualKwh: 1_700_000,
      recEligible: true,
      notes: '자원: 태양광 / 사업자번호: 611-86-00591',
      currentStep: 2,
      submittedAt: '2026-06-08T10:00:00',
      createdAt: '2026-06-08T10:00:00',
    },
    {
      id: 17,
      requesterType: 'GENERATOR',
      companyId: 2,
      companyName: '주식회사 알엠에스플랫폼',
      dealType: 'PPA',
      status: 'MATCHING', // step 3 — 승인 대기 (GEN_ACCEPTED)
      capacityKw: 1200,
      durationYears: 20,
      desiredUnitPrice: 150,
      region: '울산',
      plantName: 'G발전소',
      expectedAnnualKwh: 2_000_000,
      recEligible: true,
      notes: '자원: 태양광 / 사업자번호: 611-86-00591',
      currentStep: 3,
      submittedAt: '2026-06-07T10:00:00',
      createdAt: '2026-06-07T10:00:00',
    },
    {
      id: 18,
      requesterType: 'GENERATOR',
      companyId: 2,
      companyName: '주식회사 알엠에스플랫폼',
      dealType: 'PPA',
      status: 'MATCHED', // step 4 — 계약 체결
      capacityKw: 1100,
      durationYears: 20,
      desiredUnitPrice: 153,
      region: '울산',
      plantName: 'H발전소',
      expectedAnnualKwh: 1_800_000,
      recEligible: true,
      notes: '자원: 태양광 / 사업자번호: 611-86-00591',
      currentStep: 4,
      submittedAt: '2026-06-05T10:00:00',
      createdAt: '2026-06-05T10:00:00',
    },
    // ── 발전사 거절 케이스 — 매칭됐다가 발전사가 거절, 재매칭 대기 ──
    {
      id: 21,
      requesterType: 'GENERATOR',
      companyId: 2,
      companyName: '주식회사 알엠에스플랫폼',
      dealType: 'PPA',
      status: 'MATCHING', // 매칭 풀 재대기 (거절 후)
      capacityKw: 900,
      durationYears: 20,
      desiredUnitPrice: 156,
      region: '울산',
      plantName: 'I발전소',
      expectedAnnualKwh: 1_500_000,
      recEligible: true,
      notes: '자원: 태양광 / 사업자번호: 611-86-00591',
      currentStep: 1,
      submittedAt: '2026-06-04T10:00:00',
      createdAt: '2026-06-04T10:00:00',
    },
  ],
  matches: [
    // Offsite — 파트너: 알엠에스플랫폼 (중간값 ₩152.5)
    matchSeed(
      1,
      2,
      'PROPOSED',
      2,
      '주식회사 알엠에스플랫폼',
      'C발전소',
      500,
      152.5,
      '150원에 가능할까요?',
      'offsite',
    ),
    matchSeed(
      2,
      3,
      'GEN_ACCEPTED',
      2,
      '주식회사 알엠에스플랫폼',
      'C발전소',
      500,
      152.5,
      '150원에 가능할까요?',
      'offsite',
    ),
    matchSeed(
      3,
      4,
      'ACCEPTED',
      2,
      '주식회사 알엠에스플랫폼',
      'C발전소',
      500,
      152.5,
      '150원에 가능할까요?',
      'offsite',
    ),
    // Onsite — 파트너: 에스에너지 (중간값 ₩147.5)
    matchSeed(
      4,
      6,
      'PROPOSED',
      3,
      '에스에너지',
      '한일튜브 제2공장 옥상 태양광',
      300,
      147.5,
      'Onsite 설치 — 부지 실사 후 단가 확정 예정',
      'onsite',
    ),
    matchSeed(
      5,
      7,
      'GEN_ACCEPTED',
      3,
      '에스에너지',
      '한일튜브 제2공장 옥상 태양광',
      300,
      147.5,
      'Onsite 설치 — 부지 실사 후 단가 확정 예정',
      'onsite',
    ),
    matchSeed(
      6,
      8,
      'ACCEPTED',
      3,
      '에스에너지',
      '한일튜브 제2공장 옥상 태양광',
      300,
      147.5,
      'Onsite 설치 — 부지 실사 후 단가 확정 예정',
      'onsite',
    ),
    // Lease — 파트너: 라씨 (수익 분배율 30% · 월 수익 ₩8,580,211 — 단가 아님)
    matchSeed(
      7,
      10,
      'PROPOSED',
      4,
      '라씨',
      '한일튜브 본사 옥상 태양광',
      429.44,
      92.6,
      '라씨 태양광 모듈 — 분배율 30% 제안 · 부지 평가 완료',
      undefined,
      { sharePct: 30, monthlyRevenue: 8_580_211 },
    ),
    matchSeed(
      8,
      11,
      'GEN_ACCEPTED',
      4,
      '라씨',
      '한일튜브 본사 옥상 태양광',
      429.44,
      92.6,
      '라씨 태양광 모듈 — 분배율 30% 제안 · 재매칭 반영 완료',
      undefined,
      { sharePct: 30, monthlyRevenue: 8_580_211 },
    ),
    matchSeed(
      9,
      12,
      'ACCEPTED',
      4,
      '라씨',
      '한일튜브 본사 옥상 태양광',
      429.44,
      92.6,
      '라씨 태양광 모듈 — 분배율 30% 확정 · 계약 체결',
      undefined,
      { sharePct: 30, monthlyRevenue: 8_580_211 },
    ),
    // ── 발전사 거래 진행 카드용 매칭 (F·G·H 발전소) — requestId 는 더미(999), generatorRequestId 로만 발전사 페이지 매칭 ──
    {
      id: 10,
      requestId: 999,
      generatorCompanyId: 2,
      generatorCompanyName: '주식회사 알엠에스플랫폼',
      plantName: 'F발전소',
      resourceType: '태양광',
      capacityKw: 1000,
      proposedPriceKrw: 153,
      status: 'PROPOSED',
      createdAt: '2026-06-12T10:00:00',
      generatorRequestId: 16,
      ppaSubType: 'offsite',
      consumerCompanyName: '한일튜브(주)',
      notes: 'F발전소 매칭 제안 — 검토 부탁드립니다',
      tradeFeeSupplyKwh: 1.0,
    },
    {
      id: 11,
      requestId: 999,
      generatorCompanyId: 2,
      generatorCompanyName: '주식회사 알엠에스플랫폼',
      plantName: 'G발전소',
      resourceType: '태양광',
      capacityKw: 1200,
      proposedPriceKrw: 151,
      status: 'GEN_ACCEPTED',
      createdAt: '2026-06-12T10:00:00',
      generatorRequestId: 17,
      ppaSubType: 'onsite',
      consumerCompanyName: '한일튜브(주)',
      notes: 'G발전소 매칭 — 발전사 수락 완료',
      tradeFeeSupplyKwh: 1.0,
    },
    {
      id: 12,
      requestId: 999,
      generatorCompanyId: 2,
      generatorCompanyName: '주식회사 알엠에스플랫폼',
      plantName: 'H발전소',
      resourceType: '태양광',
      capacityKw: 1100,
      proposedPriceKrw: 152,
      status: 'ACCEPTED',
      createdAt: '2026-06-12T10:00:00',
      generatorRequestId: 18,
      ppaSubType: 'offsite',
      consumerCompanyName: '한일튜브(주)',
      notes: 'H발전소 — 계약 체결 완료',
      tradeFeeSupplyKwh: 1.0,
    },
    // ── 거절 케이스 (SPC 재매칭 필요) ──
    // Offsite — 발전사 거절: 단가 부족
    {
      id: 13,
      requestId: 19,
      generatorCompanyId: 2,
      generatorCompanyName: '주식회사 알엠에스플랫폼',
      plantName: 'C발전소',
      resourceType: '태양광',
      capacityKw: 700,
      proposedPriceKrw: 146,
      status: 'DECLINED',
      createdAt: '2026-06-12T11:00:00',
      consumerCompanyName: '한일튜브(주)',
      notes: 'Offsite — SPC 중재가 ₩146 제안',
      tradeFeeSupplyKwh: 1.0,
      declinedBy: 'GENERATOR',
      declineReason: '단가가 희망가(₩155) 대비 낮습니다. ₩152 이상으로 재협상 부탁드립니다.',
    },
    // Onsite — 수용가 거절: 발전사 변경 요청
    {
      id: 14,
      requestId: 20,
      generatorCompanyId: 3,
      generatorCompanyName: '에스에너지',
      plantName: '한일튜브 제2공장 옥상 태양광',
      resourceType: '태양광',
      capacityKw: 250,
      proposedPriceKrw: 144,
      status: 'DECLINED',
      createdAt: '2026-06-12T11:30:00',
      consumerCompanyName: '한일튜브(주)',
      notes: 'Onsite — 부지 평가 완료',
      tradeFeeSupplyKwh: 1.0,
      declinedBy: 'CONSUMER',
      declineReason: '발전사 시공 이력 부족 — 다른 발전사로 매칭 부탁드립니다.',
    },
    // 발전사업자(I발전소)가 매칭 제안 거절 — 발전사업자 탭에서 확인
    {
      id: 15,
      requestId: 999,
      generatorCompanyId: 2,
      generatorCompanyName: '주식회사 알엠에스플랫폼',
      plantName: 'I발전소',
      resourceType: '태양광',
      capacityKw: 900,
      proposedPriceKrw: 150,
      status: 'DECLINED',
      createdAt: '2026-06-12T12:00:00',
      generatorRequestId: 21,
      ppaSubType: 'offsite',
      consumerCompanyName: '한일튜브(주)',
      notes: 'I발전소 매칭 제안',
      tradeFeeSupplyKwh: 1.0,
      declinedBy: 'GENERATOR',
      declineReason:
        'SPC 제안 단가가 희망가(₩156) 대비 낮습니다. ₩154 이상으로 재협상 부탁드립니다.',
    },
    // Lease 재매칭 — requestId 11(승인 대기) 의 이전 제안 거절: 수용가가 분배율 과다로 거절 → SPC 재제안(현재 id 8, 30%)
    {
      id: 16,
      requestId: 11,
      generatorCompanyId: 4,
      generatorCompanyName: '라씨',
      plantName: '한일튜브 본사 옥상 태양광',
      resourceType: '태양광',
      capacityKw: 429.44,
      proposedPriceKrw: 92.6,
      status: 'DECLINED',
      createdAt: '2026-06-10T09:00:00',
      consumerCompanyName: '한일튜브(주)',
      notes: '라씨 태양광 모듈 — 분배율 35% 제안 (1차)',
      tradeFeeSupplyKwh: 1.0,
      sharePct: 35,
      monthlyRevenue: 8_580_211,
      declinedBy: 'CONSUMER',
      declineReason: '발전사 분배율 35%가 높습니다. 30% 이하로 재협상 부탁드립니다.',
    },
  ],
  nextRequestId: 22,
  nextMatchId: 17,
};

/* ───────────────────────── Store core ───────────────────────── */

let state: MockTradingState = SEED;
let hydrated = false;
const listeners = new Set<() => void>();

function load(): MockTradingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MockTradingState;
  } catch {
    /* 손상된 데이터 → seed 로 초기화 */
  }
  return SEED;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota 초과 등 무시 */
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function setState(updater: (s: MockTradingState) => MockTradingState) {
  state = updater(state);
  persist();
  emit();
}

// 첫 구독 시 localStorage 에서 복원 + 다른 탭 변경 실시간 반영
function ensureHydrated() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  state = load();
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        state = JSON.parse(e.newValue) as MockTradingState;
        emit();
      } catch {
        /* 무시 */
      }
    }
  });
}

function subscribe(cb: () => void) {
  ensureHydrated();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/* ───────────────────────── Status ↔ Step 동기화 ───────────────────────── */

// 백엔드가 status 변경 시 currentStep 을 자동으로 올린다고 가정한 매핑
const stepForStatus = (status: string, current: number): number => {
  if (status === 'MATCHED') return 4;
  if (status === 'MATCHING') return Math.max(current, 2);
  if (status === 'SUBMITTED') return 1;
  return current;
};

/* ───────────────────────── Actions ───────────────────────── */
/* 모든 action 은 실 API 의 mutation 과 1:1 대응 — TODO(API) 교체 지점 */

// POST /trading/requests
export function mockCreateRequest(
  data: CreateTradingRequest & { ppaSubType?: 'onsite' | 'offsite' },
): MockTradingRequest {
  const now = new Date().toISOString();
  const req: MockTradingRequest = {
    id: state.nextRequestId,
    requesterType: data.requesterType,
    companyId: data.companyId,
    companyName: data.requesterType === 'GENERATOR' ? '주식회사 알엠에스플랫폼' : '한일튜브(주)',
    dealType: data.dealType,
    status: 'SUBMITTED',
    capacityKw: data.capacityKw,
    durationYears: data.durationYears,
    desiredUnitPrice: data.desiredUnitPrice ?? 0,
    region: data.region ?? '울산',
    siteName: data.siteName,
    plantName: data.plantName,
    expectedAnnualKwh: data.expectedAnnualKwh,
    recEligible: data.recEligible,
    notes: data.notes,
    currentStep: 1,
    submittedAt: now,
    createdAt: now,
    ppaSubType: data.ppaSubType, // mock 전용 — 직접 PPA 하위 유형
  };
  setState((s) => ({ ...s, requests: [...s.requests, req], nextRequestId: s.nextRequestId + 1 }));
  return req;
}

// PATCH /trading/requests/{id}/status
export function mockUpdateRequestStatus(id: number, status: string) {
  setState((s) => ({
    ...s,
    requests: s.requests.map((r) =>
      r.id === id ? { ...r, status, currentStep: stepForStatus(status, r.currentStep) } : r,
    ),
  }));
}

// POST /trading/matches — SPC 매칭 생성 (발전사로 먼저 전달 = PROPOSED)
export function mockCreateMatch(
  data: CreateTradingMatch & {
    generatorRequestId?: number;
    consumerCompanyName?: string;
    notes?: string;
    tradeFeeSupplyKwh?: number;
  },
): MockTradingMatch {
  const consumerReq = state.requests.find((r) => r.id === data.requestId);
  const genReq =
    data.generatorRequestId != null
      ? state.requests.find((r) => r.id === data.generatorRequestId)
      : state.requests.find(
          (r) => r.requesterType === 'GENERATOR' && r.companyId === data.generatorCompanyId,
        );
  const match: MockTradingMatch = {
    id: state.nextMatchId,
    requestId: data.requestId,
    generatorCompanyId: data.generatorCompanyId,
    generatorCompanyName: genReq?.companyName ?? '발전사',
    plantName: data.plantName ?? genReq?.plantName ?? '—',
    resourceType: data.resourceType ?? '태양광',
    capacityKw: data.capacityKw ?? genReq?.capacityKw ?? 0,
    proposedPriceKrw: data.proposedPriceKrw ?? 0,
    status: 'PROPOSED',
    createdAt: new Date().toISOString(),
    // ── mock 전용 확장 ──
    generatorRequestId: genReq?.id,
    consumerCompanyName: consumerReq?.companyName,
    notes: data.notes,
    tradeFeeSupplyKwh: data.tradeFeeSupplyKwh,
  };
  setState((s) => ({ ...s, matches: [...s.matches, match], nextMatchId: s.nextMatchId + 1 }));
  return match;
}

// PATCH /trading/matches/{id}/accept — 발전사 수락 → 수용가 승인 대기 (step 3)
export function mockGeneratorAcceptMatch(matchId: number) {
  setState((s) => {
    const match = s.matches.find((m) => m.id === matchId);
    if (!match) return s;
    return {
      ...s,
      matches: s.matches.map((m) => (m.id === matchId ? { ...m, status: 'GEN_ACCEPTED' } : m)),
      requests: s.requests.map((r) => {
        if (r.id === match.requestId) return { ...r, currentStep: 3 }; // 수용가 → 승인 대기
        if (r.id === match.generatorRequestId) return { ...r, currentStep: 3 }; // 발전사 → 승인 대기
        return r;
      }),
    };
  });
}

// PATCH /trading/matches/{id}/accept — 수용가 최종 수락 → 양측 MATCHED (step 4)
export function mockConsumerAcceptMatch(matchId: number) {
  setState((s) => {
    const match = s.matches.find((m) => m.id === matchId);
    if (!match) return s;
    return {
      ...s,
      matches: s.matches.map((m) => (m.id === matchId ? { ...m, status: 'ACCEPTED' } : m)),
      requests: s.requests.map((r) => {
        if (r.id === match.requestId || r.id === match.generatorRequestId) {
          return { ...r, status: 'MATCHED', currentStep: 4 };
        }
        return r;
      }),
    };
  });
}

// PATCH /trading/matches/{id}/decline — 거절 → 양측 SUBMITTED 복귀 (SPC 재매칭)
export function mockDeclineMatch(matchId: number) {
  setState((s) => {
    const match = s.matches.find((m) => m.id === matchId);
    if (!match) return s;
    return {
      ...s,
      matches: s.matches.map((m) => (m.id === matchId ? { ...m, status: 'DECLINED' } : m)),
      requests: s.requests.map((r) => {
        if (r.id === match.requestId || r.id === match.generatorRequestId) {
          return { ...r, status: 'SUBMITTED', currentStep: 1 };
        }
        return r;
      }),
    };
  });
}

// 시연 초기화 — seed 로 리셋 (개발 편의)
export function mockResetTrading() {
  setState(() => SEED);
}

/* ───────────────────────── Hooks ───────────────────────── */

// TODO(API): useTradingRequests() 로 교체
export function useMockTradingRequests(): MockTradingRequest[] {
  return useSyncExternalStore(
    subscribe,
    () => state.requests,
    () => SEED.requests,
  );
}

// TODO(API): useTradingMatches(requestId) 로 교체
export function useMockTradingMatches(): MockTradingMatch[] {
  return useSyncExternalStore(
    subscribe,
    () => state.matches,
    () => SEED.matches,
  );
}
