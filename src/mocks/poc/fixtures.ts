/**
 * POC 픽스처 — 주요 화면(통합관제 지도·대시보드·수용가)이 비어 보이지 않을 정도의 최소 데이터.
 * 나머지 엔드포인트는 라우터의 기본 빈 응답으로 처리된다.
 */
import { registerMock, pageOf } from './registry';
import { LASEE_PLANTS } from '@/constants/plant-mapping';
import { useAuthStore } from '@/stores/useAuthStore';
import type { LaseeMonitoringPlant } from '@/api/monitoring/monitoring';
import type { MonitoringConsumer, PlantContractKind, PlantAnomalySummary } from '@/types/monitoring';
import type { PowerStation } from '@/types/power-station';
import type { ConsumerSite } from '@/types/consumer';
import type { MarketPrice } from '@/types/trading';
import './adminFixtures'; // 관리(ADMIN) 축 목업

const NOW = '2026-09-15T10:00:00';

/* ── 발전소·발전자산 (울산미포 7개소 — DT정리 v0.84 "2. 건물" 기준) ─────── */
const PLANT_SPECS: Record<
  number,
  { type: 'SOLAR' | 'ORC' | 'FUEL_CELL'; capacity: number; status: LaseeMonitoringPlant['status']; contract?: PlantContractKind; contracts?: PlantContractKind[] }
> = {
  17511: { type: 'SOLAR', capacity: 152.32, status: 'NORMAL', contract: 'SELF_CONSUMPTION' }, // 용인금속 · 자가소비
  17512: { type: 'SOLAR', capacity: 46.08, status: 'NORMAL', contract: 'SELF_CONSUMPTION' }, // 태성산업 · 자가소비
  17513: { type: 'SOLAR', capacity: 33.92, status: 'ANOMALY', contract: 'SELF_CONSUMPTION' }, // 건호이엔씨 · 자가소비 (미조치 이상감지 1건)
  17514: { type: 'SOLAR', capacity: 429.44, status: 'NORMAL', contract: 'ONSITE', contracts: ['SELF_CONSUMPTION', 'ONSITE'] }, // 한일튜브 · 자가소비(99.84)+PPA(329.6)
  17515: { type: 'SOLAR', capacity: 90.88, status: 'NORMAL', contract: 'SELF_CONSUMPTION' }, // 한길 · 자가소비
  17601: { type: 'FUEL_CELL', capacity: 2000, status: 'NORMAL' }, // 연료전지 — 계약 유형 없음 (용량 미확인, 임시 2MW)
  17602: { type: 'ORC', capacity: 500, status: 'NORMAL' }, // ORC — 계약 유형 없음 (용량 미확인, 임시)
};

function inverter(n: number, capacity: number, ratio: number): LaseeMonitoringPlant['inverters'][number] {
  const power = Math.round(capacity * ratio);
  return {
    number: n,
    capacity,
    connectionState: 'NORMAL',
    lastDataAt: NOW,
    dc: { voltage: 612, current: Math.round((power * 1000) / 612), power },
    ac: { voltR: 380, voltS: 381, voltT: 379, currentR: 120, currentS: 118, currentT: 121, power },
    powerFactor: 0.98,
    frequency: 60,
    dailyEnergy: Math.round(capacity * 3.1),
    totalEnergy: Math.round(capacity * 1650),
    statusMessages: [], // 비어 있어야 정상. 메시지가 있으면 화면이 알람(경고 배너·빨간 배지)으로 취급한다
  };
}

const PLANT_ADDRESS: Record<number, string> = {
  17511: '울산 남구 여천동 887-18',
  17512: '울산 남구 여천동 358-8',
  17513: '울산 남구 부곡동 22-5',
  17514: '울산 남구 부곡동 273-6',
  17515: '울산 남구 용연동 490-11',
  17601: '울산 남구 상개동 427-5',
  17602: '울산 남구 사평로 119',
};

export const PLANTS: LaseeMonitoringPlant[] = LASEE_PLANTS.map((p, idx) => {
  const spec = PLANT_SPECS[p.laseeId] ?? { type: 'SOLAR', capacity: 300, status: 'NORMAL', contract: 'SELF_CONSUMPTION' };
  const ratio = spec.status === 'MAINTENANCE' ? 0 : spec.status === 'WARNING' ? 0.42 : 0.68 + (idx % 3) * 0.06;
  const half = Math.round(spec.capacity / 2);
  return {
    plantId: p.laseeId,
    name: p.name,
    type: spec.type,
    status: spec.status,
    address: PLANT_ADDRESS[p.laseeId] ?? '울산광역시 남구',
    capacity: spec.capacity,
    currentOutput: Math.round(spec.capacity * ratio),
    contractType: spec.contract,
    contractTypes: spec.contracts ?? (spec.contract ? [spec.contract] : undefined),
    dailyEnergy: Math.round(spec.capacity * 3.1 * (ratio > 0 ? 1 : 0.2)),
    totalEnergy: Math.round(spec.capacity * 1650),
    connectionStatus: {
      rtuPower: 'ON',
      rtuConnection: spec.status === 'MAINTENANCE' ? 'ERROR' : 'NORMAL',
      inverterConnections: [
        { number: 1, state: 'NORMAL' },
        { number: 2, state: spec.status === 'WARNING' ? 'ERROR' : 'NORMAL' },
      ],
    },
    inverters: [inverter(1, half, ratio), inverter(2, spec.capacity - half, ratio)],
  };
});

registerMock(/^\/monitoring\/map\/plants$/, () => PLANTS);
registerMock(/^\/monitoring\/plants\/(\d+)\/history$/, ({ match, query }) => {
  const id = Number(match[1]);
  const plant = PLANTS.find((p) => p.plantId === id) ?? PLANTS[0]!;
  const from = new Date(query.get('from') ?? '2026-09-15');
  const to = new Date(query.get('to') ?? '2026-09-15');
  const points: { time: string; dcPower: number; acPower: number; dailyEnergy: number }[] = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const dayIdx = Math.floor(d.getTime() / 86_400_000);
    const dateStr = d.toISOString().slice(0, 10);
    // 일별 기상 계수(0.55~1.0) — 예상(표준 곡선)과 차이가 나도록 흐린 날을 섞는다
    const dayFactor = 0.78 + Math.sin(dayIdx / 1.9) * 0.14 + Math.sin(dayIdx / 5.3) * 0.08;
    let energy = 0;
    for (let h = 0; h < 24; h++) {
      const sun = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
      // 시간대 구름 감쇠(0.7~1.0) + 오후 약간 저하
      const cloud = 0.85 + Math.sin((dayIdx * 7 + h) / 1.3) * 0.15;
      const ac = Math.round(plant.capacity * 0.85 * sun * dayFactor * cloud);
      energy += ac;
      points.push({
        time: `${dateStr}T${String(h).padStart(2, '0')}:00:00`,
        dcPower: Math.round(ac * 1.04),
        acPower: ac,
        dailyEnergy: energy,
      });
    }
  }
  return points;
});

/* ── 수용가 (지도 마커) ───────────────────────────────────── */
export const CONSUMERS: MonitoringConsumer[] = [
  { id: 1, companyId: 2, name: '울산 수용가(주) 본사공장', address: '울산 남구 처용로 100', latitude: 35.5091, longitude: 129.3402, reTargetPct: 30, reCurrentPct: 18.4, monthlyDemandKwh: 184000, monthlySupplyKwh: 33800, todaySupplyKwh: 1260 },
  { id: 2, companyId: 4, name: '미포 정밀화학', address: '울산 남구 장생포로 55', latitude: 35.5012, longitude: 129.3521, reTargetPct: 20, reCurrentPct: 12.1, monthlyDemandKwh: 96000, monthlySupplyKwh: 11600, todaySupplyKwh: 410 },
  { id: 3, companyId: 5, name: '온산 스틸', address: '울산 울주군 온산읍 산업로 12', latitude: 35.4788, longitude: 129.3574, reTargetPct: 40, reCurrentPct: 27.5, monthlyDemandKwh: 402000, monthlySupplyKwh: 110500, todaySupplyKwh: 3980 },
];
registerMock(/^\/monitoring\/map\/consumers$/, () => CONSUMERS);
registerMock(/^\/monitoring\/consumers\/(\d+)$/, ({ match }) => CONSUMERS.find((c) => c.id === Number(match[1])) ?? CONSUMERS[0]);

/* ── 계약 발전소 — 발전사업자·전기사용자 모두 발전소 1개(한일튜브)만 보유 ──── */
function stationOf(plant: LaseeMonitoringPlant, id: number, ownerCompanyId: number, ownerCompanyName: string): PowerStation {
  const coords = LASEE_PLANTS.find((l) => l.laseeId === plant.plantId);
  return {
    id,
    ownerCompanyId,
    ownerCompanyName,
    name: plant.name,
    generationType: plant.type,
    capacityKw: plant.capacity,
    address: plant.address,
    latitude: coords?.latitude,
    longitude: coords?.longitude,
    externalPlantId: String(plant.plantId),
    commissionedAt: '2024-03-01',
    status: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
  };
}
const HANIL = PLANTS.find((p) => p.plantId === 17514) ?? PLANTS[0]!;
/** 발전사업자(회사 3) 소유 발전소 — 1개 */
export const POWER_STATIONS: PowerStation[] = [stationOf(HANIL, 1, 3, '울산 발전(주)')];
/** 전기사용자(회사 2) 계약 사업장 발전소 — 1개 */
export const CONSUMER_STATIONS: PowerStation[] = [stationOf(HANIL, 101, 2, '울산 수용가(주)')];
registerMock(/^\/power-stations\/by-company\/(\d+)$/, ({ match }) => {
  const companyId = Number(match[1]);
  if (companyId === 3) return POWER_STATIONS;
  if (companyId === 2) return CONSUMER_STATIONS;
  return [];
});
registerMock(/^\/power-stations$/, () => pageOf(POWER_STATIONS));
registerMock(/^\/power-stations\/(\d+)$/, ({ match }) => POWER_STATIONS.find((s) => s.id === Number(match[1])) ?? POWER_STATIONS[0]);

/* ── 전기사용자 사업장 ────────────────────────────────────── */
export const SITES: ConsumerSite[] = [
  { id: 1, companyId: 2, name: '본사공장', siteType: 'FACTORY', siteCode: 'ULS-01', address: '울산 남구 처용로 100', contractPowerKw: 1200, peakDemandKw: 940, rePercent: 18.4, status: 'ACTIVE' },
  { id: 2, companyId: 2, name: '제2공장', siteType: 'FACTORY', siteCode: 'ULS-02', address: '울산 남구 용잠로 210', contractPowerKw: 800, peakDemandKw: 610, rePercent: 9.7, status: 'ACTIVE' },
];
registerMock(/^\/consumer\/sites$/, () => pageOf(SITES));
registerMock(/^\/consumer\/sites\/(\d+)$/, ({ match }) => SITES.find((s) => s.id === Number(match[1])) ?? SITES[0]);

/* ── 공통 ─────────────────────────────────────────────── */
registerMock(/^\/me$/, () => useAuthStore.getState().user);
registerMock(/^\/me\/menus$/, () => []);
/* ── 알림 항목(알림 설정 카탈로그) — 이름은 메뉴명 그대로. 그 메뉴에 새로 확인할 일이 생기면 알린다.
 *    통신오류는 이상감지에 포함(이상 = 등급 정상 아님 또는 통신오류). 웹 알림/이메일 설정은 메모리에 반영 ── */
const NOTIFICATION_EVENTS = [
  // 통합관제
  { eventKey: 'ANOMALY', label: '이상감지 관리', domain: '통합관제' },
  // RE100 — 신청·계약·정산·청구·세금계산서가 생기는 메뉴 (하위 메뉴는 상위 › 하위)
  { eventKey: 'TRADING_REQUEST', label: '거래 신청', domain: 'RE100' },
  { eventKey: 'CONTRACT', label: '내 계약', domain: 'RE100' },
  { eventKey: 'SETTLEMENT', label: '수익·정산 › 정산', domain: 'RE100' },
  { eventKey: 'PAYMENT', label: '수익·정산 › 수금·지급', domain: 'RE100' },
  { eventKey: 'INVOICE', label: '수익·정산 › 청구서', domain: 'RE100' },
  { eventKey: 'TAX_INVOICE', label: '수익·정산 › 세금계산서', domain: 'RE100' },
  // E-데이터마켓 — 등록/신청·거래·정산·계약이 생기는 메뉴
  { eventKey: 'EDATA_CATALOG', label: '데이터 마켓플레이스 › 데이터 등록/신청', domain: 'E-데이터마켓' },
  { eventKey: 'EDATA_TRADING', label: '데이터 마켓플레이스 › 거래 현황', domain: 'E-데이터마켓' },
  { eventKey: 'EDATA_SETTLEMENT', label: '데이터 마켓플레이스 › 정산', domain: 'E-데이터마켓' },
  { eventKey: 'CARBON_OTC', label: '카본 마켓플레이스 › 탄소배출권 장외거래', domain: 'E-데이터마켓' },
  { eventKey: 'CARBON_ETRS', label: '카본 마켓플레이스 › 탄소배출권 계약관리', domain: 'E-데이터마켓' },
  // 관리
  { eventKey: 'APPROVAL', label: '승인 관리', domain: '관리' },
  { eventKey: 'TRADING_APPROVAL', label: '거래 승인', domain: '관리' },
];
// 기본값: 웹 알림 전부 켬 · 이메일은 즉시 대응이 필요한 것만
const EMAIL_DEFAULT_ON = new Set(['ANOMALY', 'APPROVAL', 'TRADING_APPROVAL', 'EDATA_CATALOG']);
const NOTIFICATION_SETTINGS = NOTIFICATION_EVENTS.map((e) => ({ eventKey: e.eventKey, inAppEnabled: true, emailEnabled: EMAIL_DEFAULT_ON.has(e.eventKey) }));
registerMock(/^\/notifications\/event-catalog$/, () => NOTIFICATION_EVENTS);
registerMock(/^\/notifications\/settings$/, () => NOTIFICATION_SETTINGS, 'GET');
registerMock(/^\/notifications\/settings$/, ({ body }) => {
  const list = (Array.isArray(body) ? body : []) as { eventKey: string; inAppEnabled: boolean; emailEnabled: boolean }[];
  for (const s of list) {
    const cur = NOTIFICATION_SETTINGS.find((x) => x.eventKey === s.eventKey);
    if (cur) {
      cur.inAppEnabled = !!s.inAppEnabled;
      cur.emailEnabled = !!s.emailEnabled;
    }
  }
  return {};
}, 'PUT');

// 알림 목업(종 아이콘) — 제목은 알림 항목(메뉴명)과 동일. 8개(안 읽음 3 + 읽음 5)
const NOTIFICATIONS = [
  { id: 1, type: 'ANOMALY', title: '이상감지 관리', message: '태성산업 RTU 통신오류 — 3분간 응답 없음', isRead: false, createdAt: '2026-09-18T17:40:00' },
  { id: 2, type: 'ANOMALY', title: '이상감지 관리', message: '건호이엔씨 인버터 #2 통신 끊김', isRead: false, createdAt: '2026-09-18T16:20:00' },
  { id: 3, type: 'APPROVAL', title: '승인 관리', message: '용인금속 박용인 가입 신청 (기업 관리자)', isRead: false, createdAt: '2026-09-18T14:05:00' },
  { id: 4, type: 'TRADING_APPROVAL', title: '거래 승인', message: '울산 발전(주) 한일튜브 공급 신청', isRead: true, createdAt: '2026-09-18T09:00:00' },
  { id: 5, type: 'SETTLEMENT', title: '수익·정산 › 정산', message: '8월분 정산이 확정되었습니다.', isRead: true, createdAt: '2026-09-17T18:30:00' },
  { id: 6, type: 'EDATA_CATALOG', title: '데이터 마켓플레이스 › 데이터 등록/신청', message: '새 데이터 이용 신청이 접수되었습니다.', isRead: true, createdAt: '2026-09-17T11:10:00' },
  { id: 7, type: 'TRADING_REQUEST', title: '거래 신청', message: '신규 전력 거래 신청이 등록되었습니다.', isRead: true, createdAt: '2026-09-16T15:45:00' },
  { id: 8, type: 'CONTRACT', title: '내 계약', message: 'PPA-2026-ON-001 계약이 생성되었습니다.', isRead: true, createdAt: '2026-09-16T10:00:00' },
];
registerMock(/^\/notifications\/unread-count$/, () => NOTIFICATIONS.filter((n) => !n.isRead).length);
registerMock(/^\/notifications\/read-all$/, () => {
  NOTIFICATIONS.forEach((n) => (n.isRead = true));
  return {};
});
registerMock(/^\/notifications\/(\d+)\/read$/, ({ match }) => {
  const n = NOTIFICATIONS.find((x) => x.id === Number(match[1]));
  if (n) n.isRead = true;
  return {};
});
registerMock(/^\/notifications$/, () => pageOf(NOTIFICATIONS));

// 에너지 설정 — SMP 상한가 · CO₂ 배출계수 (관리자 설정에서 관리, 대시보드가 참조)
registerMock(/^\/settings\/public\/energy$/, () => ({
  SMP_PRICE_CAP: '180', // ₩/kWh — SMP 상한제 값(설정)
  CO2_EMISSION_FACTOR: '0.4594', // tCO₂/MWh
}));

/* ── SMP 시장 정보 (대시보드 최근 30일 일평균) ───────────────── */
registerMock(/^\/trading\/market-prices$/, ({ query }) => {
  const from = new Date(query.get('from') ?? '2026-08-16');
  const to = new Date(query.get('to') ?? '2026-09-15');
  const rows: MarketPrice[] = [];
  let id = 1;
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const day = d.getTime() / 86_400_000;
    // 결정적 의사난수 — 육지 118~152, 제주 128~172 ₩/kWh 대역에서 완만하게 변동
    const wave = Math.sin(day / 3.1) * 9 + Math.sin(day / 7.7) * 6;
    const noise = ((Math.sin(day * 12.9898) * 43758.5453) % 1) * 6;
    const land = Math.round((135 + wave + noise) * 10) / 10;
    const jeju = Math.round((150 + wave * 1.3 + noise) * 10) / 10;
    const priceDate = d.toISOString().slice(0, 10);
    rows.push({ id: id++, priceDate, priceType: 'SMP', region: 'LAND', price: land, unit: 'KRW/kWh' });
    rows.push({ id: id++, priceDate, priceType: 'SMP', region: 'JEJU', price: jeju, unit: 'KRW/kWh' });
  }
  return rows;
});

/* ── RE100 월별 이행률 (관제 HUD·RE100 화면) ─────────────────────── */
registerMock(/^\/re100\/monthly-progress$/, ({ query }) => {
  const year = Number(query.get('year') ?? 2026);
  const nowMonth = 9;
  return Array.from({ length: nowMonth }, (_, i) => {
    const month = i + 1;
    const actualPct = Math.round((12 + i * 0.9 + Math.sin(i / 1.5) * 1.2) * 10) / 10;
    return { year, month, period: `${year}-${String(month).padStart(2, '0')}`, targetPct: 30, actualPct, achievedPct: actualPct };
  });
});

/* ── 이상감지 (최근 7일) — 단계별로 섞어 둔다: 감지 → 확인 → 조치중 → 완료 ─────
 * 상태 변경(확인/조치중/완료/오탐)과 조치 등록은 메모리에서 반영되어 화면 흐름을 그대로 볼 수 있다. */
function daysAgo(days: number, hour = 9, minute = 0): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString().slice(0, 19);
}
interface MockAction {
  id: number;
  type: string;
  content: string;
  assignee: string;
  status: string;
  expectedResolution?: string;
  createdAt: string;
  updatedAt: string;
}
interface MockAnomaly {
  id: number;
  plantId: number;
  plantName: string;
  detectionType: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  detectedAt: string;
  resolvedAt: string | null;
  affectedConsumers: string[];
  actions: MockAction[];
  createdAt: string;
  updatedAt: string;
}
function act(id: number, type: string, content: string, assignee: string, status: string, at: string, expected?: string): MockAction {
  return { id, type, content, assignee, status, expectedResolution: expected, createdAt: at, updatedAt: at };
}
function anomaly(
  id: number, plantId: number, title: string, description: string, severity: string, status: string,
  detectedAt: string, actions: MockAction[], resolvedAt: string | null = null,
): MockAnomaly {
  const plant = PLANTS.find((p) => p.plantId === plantId);
  return {
    id, plantId, plantName: plant?.name ?? '', detectionType: plant?.type ?? 'SOLAR', title, description, severity, status,
    detectedAt, resolvedAt, affectedConsumers: [], actions, createdAt: detectedAt, updatedAt: resolvedAt ?? detectedAt,
  };
}
/**
 * 이상 목록 — 근거: ITS_울산_에자자_수집데이터_API_명세서_v1.2
 * severity = DX riskLevel(normal/caution/warning) · status = S-Energy 통신 상태(NORMAL=0 정상 / COMM_ERROR=1 통신오류)
 * actions·resolvedAt 은 원본 프론트의 처리 워크플로 잔재 — 스펙에 없으며 목록 화면에서는 쓰지 않는다.
 */
export const ANOMALY_ROWS: MockAnomaly[] = [
  // 경고 · 통신오류 진행 중 — 건호이엔씨
  anomaly(4, 17513, '인버터 #2 통신 끊김 (8분)', '인버터 #2 RTU 응답 없음. 8분간 계측값 미수신.', 'warning', 'COMM_ERROR', daysAgo(0, 8, 40), []),
  // 등급은 정상인데 통신만 오류 — 태성산업 (등급·통신은 별개 소스라 이런 건도 이상 목록에 뜬다)
  anomaly(6, 17512, 'RTU 통신 끊김 (3분)', 'RTU 폴링 응답 없음. 3분간 계측값 미수신. 전기안전지수는 정상.', 'normal', 'COMM_ERROR', daysAgo(0, 9, 55), []),
  // 주의 — 용인금속
  anomaly(3, 17511, '일사량 대비 발전량 편차 (-12%)', '동일 일사 조건 대비 발전량이 12% 낮음. 모듈 오염 또는 그늘 의심.', 'caution', 'NORMAL', daysAgo(1, 11, 10), [
    act(31, '확인', '이상 인지. 현장 육안 점검 예정.', '김운영', 'ACKNOWLEDGED', daysAgo(1, 11, 30)),
  ]),
  // 주의 — 한일튜브
  anomaly(1, 17514, '인버터 #2 출력 저하 (정격 대비 -18%)', '인버터 #2 AC 출력이 정격 대비 18% 낮음. DC 입력은 정상.', 'caution', 'NORMAL', daysAgo(2, 13, 5), [
    act(11, '확인', '출력 저하 확인. 인버터 로그 요청.', '김운영', 'ACKNOWLEDGED', daysAgo(2, 13, 20)),
    act(12, '현장 점검', '인버터 #2 냉각 팬 이상 확인. 부품 교체 예정.', '박기사', 'IN_PROGRESS', daysAgo(1, 15, 0), daysAgo(-2, 18, 0).slice(0, 10)),
  ]),
  // 경고였다가 통신 복구 — 한일튜브 (RTU 통신 지연)
  anomaly(2, 17514, 'RTU 통신 지연 (응답 > 60초)', 'RTU 폴링 응답 지연 60초 초과. 네트워크 점검.', 'warning', 'NORMAL', daysAgo(5, 8, 15), [
    act(21, '확인', '통신 지연 확인.', '김운영', 'ACKNOWLEDGED', daysAgo(5, 8, 30)),
    act(22, '원격 조치', '통신 모듈 원격 재기동 후 정상 응답 확인.', '김운영', 'RESOLVED', daysAgo(5, 9, 10)),
  ], daysAgo(5, 9, 10)),
  // 경고 — 연료전지
  anomaly(5, 17601, '스택 온도 상한 근접 (경고)', '스택 온도가 상한 경고치에 근접. 냉각 계통 점검.', 'warning', 'NORMAL', daysAgo(1, 16, 0), [
    act(51, '확인', '온도 경고 확인. 출력 80% 제한.', '이관제', 'ACKNOWLEDGED', daysAgo(1, 16, 10)),
    act(52, '현장 점검', '냉각 팬 1대 정지 확인, 교체 완료. 정격 복귀.', '박기사', 'RESOLVED', daysAgo(1, 18, 40)),
  ], daysAgo(1, 18, 40)),
];

// 발전소 상세 — 이상감지 요약 포함
registerMock(/^\/monitoring\/plants\/(\d+)$/, ({ match }) => {
  const id = Number(match[1]);
  const plant = PLANTS.find((p) => p.plantId === id) ?? PLANTS[0]!;
  const anomalies: PlantAnomalySummary[] = ANOMALY_ROWS.filter((a) => a.plantId === plant.plantId).map((a) => ({
    id: a.id, title: a.title, severity: a.severity, detectedAt: a.detectedAt, status: a.status,
  }));
  return { ...plant, anomalies };
});
// 이상감지 관리 목록 — 상세·상태 변경·조치 등록은 스펙에 없어 제공하지 않는다
registerMock(/^\/anomalies$/, () => pageOf(ANOMALY_ROWS, 100));

/* ── 전기안전 진단 (ITS API-006/007) — 발전소별 진단이 주기적으로 쌓이는 누적 로그 ── */
// safetyIndex 0~100(높을수록 안전). risks 는 항목별 위험 점수(Double). reason 은 산출 근거 객체.
type SafetyRiskScores = { current: number; voltage: number; leakage: number; harmonic: number; temperature: number; powerQuality: number; arc: number };
interface SafetyDiag {
  plantId: number;
  safetyIndex: number;
  riskLevel: string;
  anomalyScore: number;
  risks: SafetyRiskScores;
  reason: string;
}
const SAFETY_DIAGS: SafetyDiag[] = [
  { plantId: 17511, safetyIndex: 96, riskLevel: 'normal', anomalyScore: 4, risks: { current: 5.1, voltage: 3.2, leakage: 1.4, harmonic: 4.5, temperature: 2.0, powerQuality: 3.0, arc: 0.0 }, reason: '정상 범위' },
  { plantId: 17512, safetyIndex: 93, riskLevel: 'normal', anomalyScore: 6, risks: { current: 6.0, voltage: 3.5, leakage: 2.0, harmonic: 5.0, temperature: 3.0, powerQuality: 3.2, arc: 0.0 }, reason: '정상 범위' },
  { plantId: 17513, safetyIndex: 54, riskLevel: 'warning', anomalyScore: 41, risks: { current: 18.0, voltage: 6.0, leakage: 34.0, harmonic: 22.0, temperature: 9.0, powerQuality: 15.0, arc: 3.0 }, reason: '누설전류 상승 — 누전 점검 권장' },
  { plantId: 17514, safetyIndex: 79, riskLevel: 'caution', anomalyScore: 18, risks: { current: 8.0, voltage: 4.0, leakage: 6.0, harmonic: 16.0, temperature: 15.0, powerQuality: 7.0, arc: 0.0 }, reason: '설비 온도 상승 추세 — 주의 관찰' },
  { plantId: 17515, safetyIndex: 95, riskLevel: 'normal', anomalyScore: 5, risks: { current: 5.5, voltage: 3.0, leakage: 1.8, harmonic: 4.2, temperature: 2.5, powerQuality: 2.8, arc: 0.0 }, reason: '정상 범위' },
];
// 최근 6회분(10분 간격)을 발전소별로 쌓아 누적 로그를 만든다. 최신이 먼저.
const SAFETY_ITEMS = (() => {
  const rows: Record<string, unknown>[] = [];
  const now = Date.now();
  let id = 1;
  for (let step = 0; step < 6; step++) {
    const diagnosedAt = new Date(now - step * 10 * 60_000).toISOString().slice(0, 19);
    for (const d of SAFETY_DIAGS) {
      const plant = PLANTS.find((p) => p.plantId === d.plantId);
      if (!plant) continue;
      rows.push({
        id: id++,
        diagnosedAt,
        plantId: d.plantId,
        plantName: plant.name,
        safetyIndex: d.safetyIndex,
        riskLevel: d.riskLevel,
        anomalyScore: d.anomalyScore,
        risks: d.risks,
        reason: { summary: d.reason },
      });
    }
  }
  return rows;
})();
registerMock(/^\/control\/safety\/items$/, () => SAFETY_ITEMS);
