// 간편 배출 입력 — 활동 중심 매핑 상수 (기획 17 §5 · 기획 21 산단 업종별 배출 입력 탭)
//
// 목적: 고객이 "무엇을(배출활동)·얼마나(실단위 사용량)"만 입력하면
//   Scope·계수·표준단위·산정이 자동으로 결정되도록 친화 라벨 ↔ BE 파라미터를 잇는다.
//
// 각 항목은 다음을 확정한다:
//   scope       — Scope 1(직접) / 2(간접). BE SourceReq.scope 는 1|2 만 허용.
//   type        — 활동 유형(ActivityReq.type). ELEC | FUEL | STEAM.
//   category    — 배출원 분류(SourceReq.category). 상세 sources 페이지 표기와 정합.
//   factorCode  — useGhgFactors 조회 키. 미존재 시 fallbackFactor 사용.
//   inputUnit   — 고객이 실제로 보고 입력하는 단위(청구서·계량기 표기 단위).
//   toStd       — 실단위 → 표준단위 환산 계수(표준단위 = 입력값 × toStd).
//   stdUnit     — 계수의 분모 단위(= 저장·산정에 쓰는 표준단위). tCO2eq = 표준사용량 × factor.
//   fallbackFactor — 계수 미조회 시 사용할 표준 계수(FALLBACK_FACTORS 와 동일 값).
//   defaultTier — 기본 Tier(대부분 1). Tier3(사업장 실측) 항목만 직접입력 override 노출.
//   note        — UI 보조 설명(선택).
//
// ⚠ 불확실 환산값 분리:
//   도시가스(Nm³ → GJ)는 표준 발열량(NCV)에 의존한다. NCV 는 공급사·열량기준에 따라
//   달라지는 값으로 여기서 "확정값"으로 단정하지 않는다. 명명 상수 CITY_GAS_NCV_GJ_PER_NM3
//   로 분리하고, UI 라벨/주석에 "표준 발열량(확정 필요)"임을 명시한다.
//
// ⚠ 기획 21 — 업종별 배출원 템플릿:
//   산단(석유화학·정유·비철금속·자동차·일반제조)은 지배적 배출원이 서로 다르다.
//   배출원 빌딩블록(BUILDING_BLOCKS)을 정의하고, 업종 탭(INDUSTRY_TEMPLATES)마다
//   해당 업종 배출원 세트만 노출한다. 공정·부생가스·공정가스는 사업장 고유값이므로
//   단일 계수를 노출하지 않고 Tier3 직접입력만 허용한다(placeholder 값 노출 금지).

import type { ActivityType } from '@/mocks/edm/ghg';

// ── 불확실 환산 상수 (확정 필요) ─────────────────────────────────────────────
// 도시가스 표준 발열량. 국내 도시가스(LNG) 총발열량 약 42.7 MJ/Nm³ ≒ 0.0427 GJ/Nm³ 근사.
// 실제 값은 공급사 고시 열량·월별 열량단가에 따라 달라지므로 반드시 검증 후 확정해야 한다.
// NOTE(확정 필요): 이 값은 잠정 표준 발열량이다. 공급사 고시 발열량으로 대체할 것.
export const CITY_GAS_NCV_GJ_PER_NM3 = 0.0427; // GJ per Nm³ — 표준 발열량(확정 필요)

// LNG 계수 FUEL_LNG 는 tCO₂/TJ 기준. 도시가스는 Nm³ → GJ → TJ 로 이단 환산이 필요하다.
// GJ → TJ = ÷1000. 따라서 Nm³ → TJ 종합 계수 = NCV(GJ/Nm³) / 1000.
const GJ_PER_TJ = 1000;

// ── 신규 표준계수 (기획 21 §1 — 표준·검증필요) ───────────────────────────────
// 중유(B-C유)·LPG 는 기획 21 에서 신규 도입한 연료다. 아래 값은 배출권거래제/IPCC
// 관행에 기반한 "표준·검증필요" 잠정 상수로, NCV 방식과 동일하게 명명 상수로 분리하고
// UI 에 "표준·검증필요" 배지/주석을 노출한다. 정본화는 후속(factor 테이블 시드).
// NOTE(검증 필요): 아래 두 값은 잠정 표준 계수다. 공식 배출계수로 대체할 것.
export const HEAVY_OIL_FACTOR_TCO2_PER_KL = 3.1; // tCO₂/kL — 중유(B-C유) 표준·검증필요
export const LPG_FACTOR_TCO2_PER_T = 3.0; // tCO₂/t — LPG 표준·검증필요

export interface EmissionActivity {
  /** 안정적 식별 키(코드) */
  key: string;
  /** 친화 라벨(고객이 카드에서 보는 이름) */
  label: string;
  /** 한 줄 설명 */
  desc: string;
  scope: 1 | 2;
  type: ActivityType;
  category: string;
  factorCode: string;
  inputUnit: string;
  /** 표준사용량 = 입력값 × toStd */
  toStd: number;
  stdUnit: string;
  /** 계수 미조회 시 폴백(FALLBACK_FACTORS 와 동일) */
  fallbackFactor: number;
  /** 폴백 계수 단위(표기용) */
  fallbackFactorUnit: string;
  defaultTier: 1 | 2 | 3;
  /** Tier3(실측) 항목 — 직접입력 override 허용 */
  allowFactorOverride: boolean;
  /** 환산에 불확실 상수가 개입하는지(UI 경고 노출용) */
  uncertainConversion?: boolean;
  /** 신규 표준계수(중유·LPG) — "표준·검증필요" 배지 노출용 */
  factorNeedsVerification?: boolean;
  /** Tier3 직접입력 전용(공정·부생가스·공정가스) — 기본계수 미노출·직접입력 강제 */
  directInputOnly?: boolean;
  note?: string;
}

// ── 배출원 빌딩블록 (기획 21 §1) ─────────────────────────────────────────────
// 업종 템플릿이 참조하는 단일 진실 소스. key 로 조합하여 각 업종 탭 세트를 구성한다.
export const BUILDING_BLOCKS = {
  // 구매전력 — 국가계수(Scope 2)
  ELEC: {
    key: 'PURCHASED_ELEC',
    label: '구매전력',
    desc: '한전·산단에서 구매한 전력 사용량',
    scope: 2,
    type: 'ELEC',
    category: '구매전력',
    factorCode: 'GHG_ELEC',
    inputUnit: 'kWh',
    toStd: 1 / 1000, // kWh → MWh
    stdUnit: 'MWh',
    fallbackFactor: 0.4781,
    fallbackFactorUnit: 'tCO₂eq/MWh',
    defaultTier: 1,
    allowFactorOverride: false,
  },
  // LNG(직접연소) — 대형 사업장 보일러/공정 연료
  LNG: {
    key: 'LNG',
    label: 'LNG(직접연소)',
    desc: '고정연소 — LNG 직접연소 사용량',
    scope: 1,
    type: 'FUEL',
    category: '고정연소',
    factorCode: 'FUEL_LNG',
    inputUnit: 'Nm³',
    // Nm³ → TJ : NCV(GJ/Nm³) ÷ 1000. NCV 는 불확실값(확정 필요).
    toStd: CITY_GAS_NCV_GJ_PER_NM3 / GJ_PER_TJ,
    stdUnit: 'TJ',
    fallbackFactor: 56.1,
    fallbackFactorUnit: 'tCO₂/TJ',
    defaultTier: 1,
    allowFactorOverride: false,
    uncertainConversion: true,
    note: '표준 발열량(NCV)로 부피(Nm³)를 열량(TJ)으로 환산합니다. NCV 는 확정 필요 값입니다.',
  },
  // 도시가스 — 중소 보일러(LNG 계수 재사용)
  CITYGAS: {
    key: 'CITY_GAS',
    label: '도시가스',
    desc: '고정연소 — 도시가스(LNG) 사용량',
    scope: 1,
    type: 'FUEL',
    category: '고정연소',
    factorCode: 'FUEL_LNG',
    inputUnit: 'Nm³',
    toStd: CITY_GAS_NCV_GJ_PER_NM3 / GJ_PER_TJ,
    stdUnit: 'TJ',
    fallbackFactor: 56.1,
    fallbackFactorUnit: 'tCO₂/TJ',
    defaultTier: 1,
    allowFactorOverride: false,
    uncertainConversion: true,
    note: '표준 발열량(NCV)로 부피(Nm³)를 열량(TJ)으로 환산합니다. NCV 는 확정 필요 값입니다.',
  },
  // 경유(이동연소)
  DIESEL: {
    key: 'DIESEL',
    label: '경유',
    desc: '이동연소 — 경유 사용량',
    scope: 1,
    type: 'FUEL',
    category: '이동연소',
    factorCode: 'FUEL_DIESEL',
    inputUnit: 'L',
    toStd: 1 / 1000, // L → kL (계수 분모가 kL)
    stdUnit: 'kL',
    fallbackFactor: 2.582,
    fallbackFactorUnit: 'tCO₂/kL',
    defaultTier: 1,
    allowFactorOverride: false,
  },
  // 중유(B-C유) — 신규 표준계수(검증필요)
  HEAVYOIL: {
    key: 'HEAVY_OIL',
    label: '중유(B-C유)',
    desc: '고정연소 — 중유(B-C유) 사용량',
    scope: 1,
    type: 'FUEL',
    category: '고정연소',
    factorCode: 'FUEL_HEAVYOIL',
    inputUnit: 'L',
    toStd: 1 / 1000, // L → kL (계수 분모가 kL)
    stdUnit: 'kL',
    fallbackFactor: HEAVY_OIL_FACTOR_TCO2_PER_KL,
    fallbackFactorUnit: 'tCO₂/kL',
    defaultTier: 1,
    allowFactorOverride: false,
    factorNeedsVerification: true,
    note: '중유(B-C유) 표준 배출계수는 잠정값(표준·검증필요)입니다. 공식 계수로 확정 시 재산정됩니다.',
  },
  // LPG — 신규 표준계수(검증필요)
  LPG: {
    key: 'LPG',
    label: 'LPG',
    desc: '고정연소 — LPG 사용량',
    scope: 1,
    type: 'FUEL',
    category: '고정연소',
    factorCode: 'FUEL_LPG',
    inputUnit: 'kg',
    toStd: 1 / 1000, // kg → t (계수 분모가 t)
    stdUnit: 't',
    fallbackFactor: LPG_FACTOR_TCO2_PER_T,
    fallbackFactorUnit: 'tCO₂/t',
    defaultTier: 1,
    allowFactorOverride: false,
    factorNeedsVerification: true,
    note: 'LPG 표준 배출계수는 잠정값(표준·검증필요)입니다. 공식 계수로 확정 시 재산정됩니다.',
  },
  // 부생가스/정제가스 — Tier3 직접입력(사업장 고유, 계수 미노출)
  BYPRODUCT: {
    key: 'BYPRODUCT',
    label: '부생가스/정제가스',
    desc: '공정 부생가스·정제가스 — 사업장 고유(Tier3 직접입력)',
    scope: 1,
    type: 'FUEL', // BE ActivityType 에 공정 없음 → FUEL 로 수용(계수는 사업장 실측 직접입력)
    category: '부생가스',
    factorCode: 'BYPRODUCT_SITE',
    inputUnit: 't',
    toStd: 1, // t → t
    stdUnit: 't',
    fallbackFactor: 0, // 미노출(직접입력 강제) — placeholder 값 노출 금지
    fallbackFactorUnit: 'tCO₂/t',
    defaultTier: 3,
    allowFactorOverride: true,
    directInputOnly: true,
    note: '부생가스/정제가스는 사업장별로 조성이 달라 단일 계수가 없습니다. 실측 계수를 직접 입력하세요(Tier3).',
  },
  // 스팀 — 외부 공급 열(Scope 2)
  STEAM: {
    key: 'STEAM',
    label: '스팀',
    desc: '외부에서 공급받은 스팀(열) 사용량',
    scope: 2,
    type: 'STEAM',
    category: '스팀',
    factorCode: 'STEAM',
    inputUnit: 'GJ',
    toStd: 1, // GJ → GJ (계수 분모가 GJ)
    stdUnit: 'GJ',
    fallbackFactor: 0.0752,
    fallbackFactorUnit: 'tCO₂/GJ',
    defaultTier: 2,
    allowFactorOverride: false,
  },
  // 공정배출 — Tier3 직접입력(제품·원료 기반, 단일계수 폐기)
  PROCESS: {
    key: 'PROCESS',
    label: '공정배출',
    desc: '공정배출 — 사업장 실측(제품·원료 기반, Tier3 직접입력)',
    scope: 1,
    type: 'FUEL', // BE ActivityType 에 공정 없음 → FUEL 로 수용(단위·계수는 t 기준 직접입력)
    category: '공정',
    factorCode: 'PROC_SITE',
    inputUnit: 't',
    toStd: 1, // t → t
    stdUnit: 't',
    fallbackFactor: 0, // 미노출(직접입력 강제) — placeholder 값(0.512 등) 노출 금지
    fallbackFactorUnit: 'tCO₂/t',
    defaultTier: 3,
    allowFactorOverride: true,
    directInputOnly: true,
    note: '공정배출은 제품·원료 기반 사업장 실측(Tier3)입니다. 실측 계수를 직접 입력하세요(단일계수 미사용).',
  },
  // 공정가스(N₂O·PFC·SF₆) — Tier3+GWP 직접입력(화학·반도체)
  PROCGAS: {
    key: 'PROC_GAS',
    label: '공정가스(N₂O·PFC·SF₆)',
    desc: '공정가스(N₂O·PFC·SF₆) — GWP 반영 사업장 실측(Tier3 직접입력)',
    scope: 1,
    type: 'FUEL', // BE ActivityType 에 공정 없음 → FUEL 로 수용(GWP 반영 tCO₂eq 직접입력)
    category: '공정가스',
    factorCode: 'PROCGAS_SITE',
    inputUnit: 't',
    toStd: 1, // t → t (가스 실물량, GWP 는 실측 계수에 반영)
    stdUnit: 't',
    fallbackFactor: 0, // 미노출(직접입력 강제) — placeholder 값 노출 금지
    fallbackFactorUnit: 'tCO₂eq/t',
    defaultTier: 3,
    allowFactorOverride: true,
    directInputOnly: true,
    note: '공정가스(N₂O·PFC·SF₆)는 GWP 를 반영한 사업장 실측(Tier3)입니다. 실측 계수(GWP 포함)를 직접 입력하세요.',
  },
} satisfies Record<string, EmissionActivity>;

// ── 업종 탭 키 (기획 21 §2) ──────────────────────────────────────────────────
export type IndustryKey = 'PETROCHEM' | 'REFINERY' | 'METAL' | 'AUTO' | 'GENERAL';

export interface IndustryTab {
  key: IndustryKey;
  label: string;
  /** 대상 업종 설명(탭 부제) */
  target: string;
}

export const INDUSTRY_TABS: IndustryTab[] = [
  { key: 'PETROCHEM', label: '석유화학·화학', target: '롯데케미칼 등' },
  { key: 'REFINERY', label: '정유', target: '정유사' },
  { key: 'METAL', label: '비철금속·금속', target: '제련·압연' },
  { key: 'AUTO', label: '자동차·조립·기계', target: '조립·도장' },
  { key: 'GENERAL', label: '일반제조(중소)', target: '비할당 중소' },
];

// ── 업종 탭 × 배출원 템플릿 (기획 21 §2) ─────────────────────────────────────
// 각 업종 탭에 노출할 배출원 세트. 정유 탭의 "정제가스(부생)"는 BYPRODUCT 블록을 재사용한다.
export const INDUSTRY_TEMPLATES: Record<IndustryKey, EmissionActivity[]> = {
  // 석유화학·화학: 구매전력·LNG·부생가스·스팀·공정배출·공정가스
  PETROCHEM: [
    BUILDING_BLOCKS.ELEC,
    BUILDING_BLOCKS.LNG,
    BUILDING_BLOCKS.BYPRODUCT,
    BUILDING_BLOCKS.STEAM,
    BUILDING_BLOCKS.PROCESS,
    BUILDING_BLOCKS.PROCGAS,
  ],
  // 정유: 구매전력·정제가스(부생)·중유·스팀·공정배출
  REFINERY: [
    BUILDING_BLOCKS.ELEC,
    BUILDING_BLOCKS.BYPRODUCT,
    BUILDING_BLOCKS.HEAVYOIL,
    BUILDING_BLOCKS.STEAM,
    BUILDING_BLOCKS.PROCESS,
  ],
  // 비철금속·금속: 구매전력(대량)·LNG·중유·공정배출
  METAL: [
    BUILDING_BLOCKS.ELEC,
    BUILDING_BLOCKS.LNG,
    BUILDING_BLOCKS.HEAVYOIL,
    BUILDING_BLOCKS.PROCESS,
  ],
  // 자동차·조립·기계: 구매전력·도시가스·경유·스팀
  AUTO: [
    BUILDING_BLOCKS.ELEC,
    BUILDING_BLOCKS.CITYGAS,
    BUILDING_BLOCKS.DIESEL,
    BUILDING_BLOCKS.STEAM,
  ],
  // 일반제조(중소): 구매전력·도시가스·경유·스팀·공정(간이) ← 현 5-card
  GENERAL: [
    BUILDING_BLOCKS.ELEC,
    BUILDING_BLOCKS.CITYGAS,
    BUILDING_BLOCKS.DIESEL,
    BUILDING_BLOCKS.STEAM,
    BUILDING_BLOCKS.PROCESS,
  ],
};

// ── 후방호환: 일반제조(중소) 세트를 기본 활동 카탈로그로 노출 ──────────────────
// 기존 EMISSION_ACTIVITIES import 를 유지하기 위해 GENERAL 템플릿을 재노출한다.
export const EMISSION_ACTIVITIES: EmissionActivity[] = INDUSTRY_TEMPLATES.GENERAL;

// 전체 빌딩블록(키 조회용) — getActivity 는 업종 무관 전역 조회.
const ALL_ACTIVITIES: EmissionActivity[] = Object.values(BUILDING_BLOCKS);

export const getActivity = (key: string): EmissionActivity | undefined =>
  ALL_ACTIVITIES.find((a) => a.key === key);

// ── 온보딩 업종(KSIC) → 업종 탭 매핑 (기획 21 §2) ────────────────────────────
// 회사 마스터의 industryCode(KSIC 대·중분류)로 기본 탭을 자동선택한다.
// KSIC 제조업 코드(C, 10~34) 기준 근사 매핑:
//   20  화학물질·화학제품 제조 → 석유화학·화학
//   19  코크스·연탄·석유정제품 제조 → 정유
//   24 비철/1차금속, 25 금속가공 → 비철금속·금속
//   30 자동차·트레일러, 29 기타 기계·장비, 28 전기장비 → 자동차·조립·기계
//   그 외 제조/미상 → 일반제조(중소)
// KSIC 코드가 없거나 매핑 미상이면 GENERAL 로 폴백한다.
export function industryTabFromKsic(industryCode?: string | null): IndustryKey {
  if (!industryCode) return 'GENERAL';
  // 앞 2자리(대·중분류)만 사용. 문자(C 등) 접두 제거.
  const digits = industryCode.replace(/[^0-9]/g, '');
  const major2 = digits.slice(0, 2);
  switch (major2) {
    case '20':
      return 'PETROCHEM';
    case '19':
      return 'REFINERY';
    case '24':
    case '25':
      return 'METAL';
    case '28':
    case '29':
    case '30':
      return 'AUTO';
    default:
      return 'GENERAL';
  }
}
