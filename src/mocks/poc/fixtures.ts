/**
 * POC 픽스처 — 주요 화면(통합관제 지도·대시보드·전기사용자)이 비어 보이지 않을 정도의 최소 데이터.
 * 나머지 엔드포인트는 라우터의 기본 빈 응답으로 처리된다.
 */
import { registerMock, pageOf } from './registry';
import { NOTIFICATION_CATALOG } from '@/lib/notification-catalog';
import { LASEE_PLANTS } from '@/constants/plant-mapping';
import { useAuthStore } from '@/stores/useAuthStore';
import type { LaseeMonitoringPlant } from '@/api/monitoring/monitoring';
import type { MonitoringConsumer, PlantContractKind, PlantAnomalySummary } from '@/types/monitoring';
import type { PowerStation } from '@/types/power-station';
import type { ConsumerSite } from '@/types/consumer';
import type { MarketPrice } from '@/types/trading';
import { HOLIDAYS_SEED, type Holiday } from '@/lib/op-calendar';
import { TARIFF_YEAR_SEED, cleanBook, type TariffYear, type TariffYearTable } from '@/lib/solar-sim';
import './adminFixtures'; // 관리(ADMIN) 축 목업
import { ELEC_FACTOR } from '@/lib/constants/emission-factor';
import { FC_CAPACITY_KW, ORC_CAPACITY_KW, fuelCellAt, fuelCellTodayKwh, orcAt, orcTodayKwh } from '@/lib/heat-plants';

const NOW = '2026-09-15T10:00:00';

/* ── 발전소·발전자산 (울산미포 7개소 — DT정리 v0.84 "2. 건물" 기준) ─────── */
const PLANT_SPECS: Record<
  number,
  { type: 'SOLAR' | 'ORC' | 'FUEL_CELL'; capacity: number; status: LaseeMonitoringPlant['status']; contract?: PlantContractKind; contracts?: PlantContractKind[]; split?: { kind: PlantContractKind; capacityKw: number }[] }
> = {
  17511: { type: 'SOLAR', capacity: 152.32, status: 'NORMAL', contract: 'SELF_CONSUMPTION' }, // 용인금속 · 자가소비
  17512: { type: 'SOLAR', capacity: 46.08, status: 'NORMAL', contract: 'SELF_CONSUMPTION' }, // 태성산업 · 자가소비
  17513: { type: 'SOLAR', capacity: 33.92, status: 'ANOMALY', contract: 'SELF_CONSUMPTION' }, // 건호이엔씨 · 자가소비 (미조치 이상감지 1건)
  17514: { type: 'SOLAR', capacity: 429.44, status: 'NORMAL', contract: 'ONSITE', contracts: ['SELF_CONSUMPTION', 'ONSITE'], split: [{ kind: 'SELF_CONSUMPTION', capacityKw: 99.84 }, { kind: 'ONSITE', capacityKw: 329.6 }] }, // 한일튜브 · 자가소비(99.84)+PPA(329.6)
  17515: { type: 'SOLAR', capacity: 90.88, status: 'NORMAL', contract: 'SELF_CONSUMPTION' }, // 한길 · 자가소비
  17601: { type: 'FUEL_CELL', capacity: FC_CAPACITY_KW, status: 'NORMAL' }, // 연료전지 — 계약 유형 없음 · 39.6MW(사업계획서)
  17602: { type: 'ORC', capacity: ORC_CAPACITY_KW, status: 'NORMAL' }, // ORC — 계약 유형 없음 · 180kW × 12대(사업계획서 p.45, 수령 태그 ORC#1~#12)
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

export const PLANTS: LaseeMonitoringPlant[] = LASEE_PLANTS.map((p, idx): LaseeMonitoringPlant => {
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
    // 계약별 용량 — 혼합 계약만 분할, 단일 계약은 설비 전체
    contracts: spec.split ?? (spec.contract ? [{ kind: spec.contract, capacityKw: spec.capacity }] : undefined),
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
}).map((p) => {
  // 연료전지 · ORC — 목록 · 지도의 현재 출력 · 금일 발전량을 상세 화면(heat-plants)과 같은 값으로
  const now = new Date();
  if (p.type === 'FUEL_CELL')
    return { ...p, currentOutput: Math.round(fuelCellAt(now).reduce((s, u) => s + u.powerKw, 0)), dailyEnergy: fuelCellTodayKwh(now) };
  if (p.type === 'ORC') return { ...p, currentOutput: Math.round(orcAt(now).grossKw), dailyEnergy: orcTodayKwh(now).gross };
  return p;
});

registerMock(/^\/monitoring\/map\/plants$/, () => PLANTS);
/** 월별 일사 계수 — 울산 태양광: 봄·초가을이 좋고, 장마(6~7월)·한겨울이 낮다 */
const SEASON_FACTOR = [0.72, 0.8, 0.98, 1.08, 1.12, 0.92, 0.74, 0.88, 0.96, 0.92, 0.74, 0.66];
/** 해·월별 날씨 보정 — 2025년은 장마가 길고 4월이 맑았고, 2026년은 5월에 비가 잦고 8월이 맑았다 (연간 비교에서 차이가 보이게) */
const YEAR_MONTH_WEATHER: Record<string, number> = {
  '2025-04': 1.1, '2025-06': 0.85, '2025-07': 0.72, '2025-08': 0.95, '2025-11': 0.88,
  '2026-03': 0.9, '2026-05': 0.76, '2026-06': 1.02, '2026-07': 0.9, '2026-08': 1.08, '2026-09': 0.86,
  '2024-07': 0.7, '2024-09': 0.82, '2023-07': 0.66, '2023-08': 0.8, '2022-06': 0.78,
};
/** 비 오는 날 확률 — 장마철이 높다 */
const RAIN_PROB = [0.12, 0.12, 0.16, 0.16, 0.18, 0.28, 0.4, 0.28, 0.2, 0.12, 0.14, 0.12];
/** 결정적 난수 0~1 — 같은 날·같은 발전소면 늘 같은 값 */
const noise = (n: number, salt: number) => {
  const x = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
/**
 * 그날의 기상 계수(0.03~1.05). 맑음 0.85~1.05, 흐림 0.45~0.7, 비 0.03~0.25 — 비 오는 날은 발전이 거의 없다.
 * 계절·그 해 월별 날씨까지 곱해서 전년과 금년가 실제처럼 다르게 나온다.
 */
function weatherFactor(dateStr: string, dayIdx: number, plantId: number): number {
  const m = Number(dateStr.slice(5, 7)) - 1;
  const season = SEASON_FACTOR[m] ?? 0.9;
  const yearMonth = YEAR_MONTH_WEATHER[dateStr.slice(0, 7)] ?? 1;
  const r = noise(dayIdx, 1); // 날씨는 지역 공통(발전소마다 같은 날 비)
  // 그 해 그 달이 궂었으면(계수<1) 비 오는 날도 더 잦다
  const rainProb = (RAIN_PROB[m] ?? 0.15) * (yearMonth < 1 ? 1 + (1 - yearMonth) * 0.8 : 1);
  let sky: number;
  if (r < rainProb) sky = 0.03 + noise(dayIdx, 2) * 0.22;
  else if (r < rainProb + 0.25) sky = 0.45 + noise(dayIdx, 3) * 0.25;
  else sky = 0.85 + noise(dayIdx, 4) * 0.2;
  const local = 0.96 + noise(dayIdx, plantId) * 0.08; // 발전소별 미세 차이
  return Math.min(1.05, season * yearMonth * sky * local);
}

registerMock(/^\/monitoring\/plants\/(\d+)\/history$/, ({ match, query }) => {
  const id = Number(match[1]);
  const plant = PLANTS.find((p) => p.plantId === id) ?? PLANTS[0]!;
  const from = new Date(query.get('from') ?? '2026-09-15');
  const to = new Date(query.get('to') ?? '2026-09-15');
  const points: { time: string; dcPower: number; acPower: number; dailyEnergy: number }[] = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const dayIdx = Math.floor(d.getTime() / 86_400_000);
    const dateStr = d.toISOString().slice(0, 10);
    // 일별 기상 계수 — 계절(월) × 그 해 날씨(장마 길이 등) × 그날 날씨(맑음·흐림·비). 해마다 달라야 발전량 비교가 의미 있다
    const dayFactor = weatherFactor(dateStr, dayIdx, id);
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

/* ── 발전량 예측(아이티공간 연계 v1.1 6.3) — 다음 정시부터 36시간, 1시간 구간 P50·P10·P90 ──
   발전 이력과 같은 식(계절·그날 날씨 × 해 높이)에서 구름 흔들림만 뺀 값이 P50. 15분마다 발행 */
registerMock(/^\/external\/dx\/forecast$/, ({ query }) => {
  const id = Number(query.get('plantId') ?? 17514);
  const plant = PLANTS.find((p) => p.plantId === id) ?? PLANTS[0]!;
  const now = Date.now();
  const issued = Math.floor(now / 900_000) * 900_000;
  const nextHour = Math.ceil((now + 1) / 3600_000) * 3600_000;
  const p = (n: number) => String(n).padStart(2, '0');
  const kstOf = (ms: number) => {
    const d = new Date(ms + 9 * 3600_000);
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:00`;
  };
  const items = Array.from({ length: 36 }, (_, i) => {
    const t = nextHour + i * 3600_000;
    const k = kstOf(t);
    const dateStr = k.slice(0, 10);
    const h = Number(k.slice(11, 13));
    const dayIdx = Math.floor(Date.parse(dateStr) / 86_400_000);
    const sun = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
    const p50 = Math.round(plant.capacity * 0.85 * sun * weatherFactor(dateStr, dayIdx, id) * 0.85 * 10) / 10;
    return { start: k, p50, p10: Math.round(p50 * 0.72 * 10) / 10, p90: Math.round(Math.min(plant.capacity, p50 * 1.14) * 10) / 10, issuedAt: kstOf(issued), modelVersion: 'pv-forecast v2' };
  });
  return { items };
});

/* ── 전기사용자 (지도 마커) ───────────────────────────────────── */
export const CONSUMERS: MonitoringConsumer[] = [
  { id: 1, companyId: 2, name: '한길', address: '울산 남구 용연동 490-11', latitude: 35.5091, longitude: 129.3402, reTargetPct: 30, reCurrentPct: 18.4, monthlyDemandKwh: 184000, monthlySupplyKwh: 33800, todaySupplyKwh: 1260 },
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
// 계약 유형 2가지에 역할을 하나씩 — 발전사업자 = 온사이트 PPA(한일튜브) / 전기사용자 = 자가소비(한길)
const HANIL = PLANTS.find((p) => p.plantId === 17514) ?? PLANTS[0]!;
const HANGIL = PLANTS.find((p) => p.plantId === 17515) ?? PLANTS[0]!;
/** 발전사업자(한일튜브, 회사 4) 발전소 — 한일튜브 1개 (온사이트 PPA) */
export const POWER_STATIONS: PowerStation[] = [stationOf(HANIL, 1, 4, '한일튜브')];
/** 전기사용자(회사 2) 자가소비 발전소 — 한길 1개 */
export const CONSUMER_STATIONS: PowerStation[] = [stationOf(HANGIL, 101, 2, '한길')];
registerMock(/^\/power-stations\/by-company\/(\d+)$/, ({ match }) => {
  const companyId = Number(match[1]);
  if (companyId === 4) return POWER_STATIONS;
  if (companyId === 2) return CONSUMER_STATIONS;
  return [];
});
registerMock(/^\/power-stations$/, () => pageOf(POWER_STATIONS));
registerMock(/^\/power-stations\/(\d+)$/, ({ match }) => POWER_STATIONS.find((s) => s.id === Number(match[1])) ?? POWER_STATIONS[0]);

/* ── 전기사용자 사업장 ────────────────────────────────────── */
export const SITES: ConsumerSite[] = [
  { id: 1, companyId: 2, name: '한길', siteType: 'FACTORY', siteCode: 'ULS-01', address: '울산 남구 용연동 490-11', contractPowerKw: 1200, peakDemandKw: 940, rePercent: 18.4, status: 'ACTIVE' },
];
registerMock(/^\/consumer\/sites$/, () => pageOf(SITES));
registerMock(/^\/consumer\/sites\/(\d+)$/, ({ match }) => SITES.find((s) => s.id === Number(match[1])) ?? SITES[0]);

/* ── 공통 ─────────────────────────────────────────────── */
registerMock(/^\/me$/, () => useAuthStore.getState().user);
registerMock(/^\/me\/menus$/, () => []);
/* ── 알림 항목표 — src/lib/notification-catalog.ts 한 곳(개발팀 알림 기획 답변 2026-11-09). 웹 알림/이메일 설정은 메모리에 반영 ── */
const NOTIFICATION_EVENTS = NOTIFICATION_CATALOG.map((e) => ({
  eventKey: e.key,
  label: e.label,
  domain: e.domain,
  condition: e.condition,
  receivers: e.receivers,
  go: e.go,
  resolve: e.resolve,
  adminOnly: !!e.adminOnly,
}));
// 기본값: 웹 알림 전부 켬 · 이메일은 바로 처리해야 하는 것(설비 알림 · 거래 신청 · 가입 신청 · 자동결제 실패)만
// 저장값은 계정마다(이 아이디의 설정) — 사용자 id 로 나눠 메모리에
const defaultNotificationSettings = () => NOTIFICATION_CATALOG.map((e) => ({ eventKey: e.key, inAppEnabled: true, emailEnabled: !!e.emailDefault }));
const NOTIFICATION_SETTINGS_BY_USER: Record<number, { eventKey: string; inAppEnabled: boolean; emailEnabled: boolean }[]> = {};
const settingsOfMe = () => {
  const uid = useAuthStore.getState().user?.id ?? 0;
  if (!NOTIFICATION_SETTINGS_BY_USER[uid]) NOTIFICATION_SETTINGS_BY_USER[uid] = defaultNotificationSettings();
  return NOTIFICATION_SETTINGS_BY_USER[uid];
};
registerMock(/^\/notifications\/event-catalog$/, () => NOTIFICATION_EVENTS);
registerMock(/^\/notifications\/settings$/, () => settingsOfMe(), 'GET');
registerMock(/^\/notifications\/settings$/, ({ body }) => {
  const list = (Array.isArray(body) ? body : []) as { eventKey: string; inAppEnabled: boolean; emailEnabled: boolean }[];
  const mine = settingsOfMe();
  for (const s of list) {
    const cur = mine.find((x) => x.eventKey === s.eventKey);
    if (cur) {
      cur.inAppEnabled = !!s.inAppEnabled;
      cur.emailEnabled = !!s.emailEnabled;
    }
  }
  return {};
}, 'PUT');

// 종 알림 목업 — 제목은 알림 항목표의 이름 그대로(메뉴 › 구역 › 항목), 같은 대상 · 같은 알림은 해소 전까지 한 번(해소되면 '해소' 알림 한 건). 안 읽음 5 + 읽음 7
// link 는 클릭 시 이동(발전소는 그 발전소 상세, 전기안전은 안전, 태풍은 관제 홈, 가입 · 변경 요청은 기업 관리)
const NOTIFICATIONS = [
  { id: 1, type: 'SAFETY_DANGER', title: '안전 › 발전소별 안전 현황 › 전기안전지수 › 위험', message: '용인금속 인버터 #1 — 전기안전지수 48', link: '/control/safety', isRead: false, createdAt: '2026-11-09T10:40:00' },
  { id: 2, type: 'ANOMALY_RTU_COMM', title: '이상감지 관리 › 이상 감지 목록 › RTU 통신 끊김', message: '태성산업 — 전체 인버터 측정시각 20분 멈춤', link: '/monitoring/anomalies', isRead: false, createdAt: '2026-11-09T10:25:00' },
  { id: 3, type: 'RTU_POWER_OFF', title: '이상감지 관리 › 이상 감지 목록 › RTU 전원 꺼짐', message: '용인금속 — RTU 전원 신호 꺼짐, 전체 인버터 계측 중단', link: '/monitoring/anomalies', isRead: false, createdAt: '2026-11-09T09:50:00' },
  { id: 4, type: 'SIGNUP_MEMBER', title: '회원 관리 › 회원 목록 › 가입 신청', message: '한일튜브 이설비 — 기업 회원', link: '/platform/users', isRead: false, createdAt: '2026-11-09T08:30:00' },
  { id: 5, type: 'SIGNUP_COMPANY', title: '기업 관리 › 기업 목록 › 가입 신청', message: '용인금속 박용인 — 기업 관리자', link: '/platform/companies', isRead: false, createdAt: '2026-11-08T14:05:00' },
  { id: 6, type: 'ANOMALY_INVERTER_COMM', title: '이상감지 관리 › 이상 감지 목록 › 인버터 통신 끊김 해소', message: '한길 인버터 #3 — 측정 재개', link: '/monitoring/anomalies', isRead: true, createdAt: '2026-11-07T11:10:00' },
  { id: 7, type: 'COMPANY_CHANGE', title: '기업 관리 › 기업 목록 › 기업 정보 변경 요청', message: '한길 — 종목 변경, 새 사업자등록증 첨부', link: '/platform/companies', isRead: true, createdAt: '2026-11-06T16:20:00' },
  { id: 8, type: 'EDATA_REQUEST', title: '거래 현황 › 이용 신청', message: '한일튜브 — 태성산업 태양광 발전량', link: '/e-data/trading', isRead: true, createdAt: '2026-11-03T15:45:00' },
  { id: 10, type: 'EDATA_CONSENT', title: '데이터 등록/신청 › 판매 동의', message: '건호이엔씨 — 태양광 발전량', link: '/e-data/catalog', isRead: true, createdAt: '2026-10-30T13:20:00' },
  { id: 11, type: 'TRADING_SELF_RECEIVED', title: '거래 신청 › 자가소비 › 신청 접수', message: '한일튜브 99.84 kW', isRead: true, createdAt: '2026-10-28T09:00:00' },
  { id: 12, type: 'SETTLEMENT', title: '수익 · 정산 › 정산 › 확정', message: '2026-10 한일튜브 PPA', isRead: true, createdAt: '2026-10-25T18:30:00' },
  { id: 13, type: 'TRADING_PPA_APPROVED', title: '거래 신청 › PPA › 승인', message: 'PPA-2026-ON-001 한일튜브 329.6 kW', isRead: true, createdAt: '2026-10-20T10:00:00' },
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

// 에너지 설정 — 관리 › 시스템 › 에너지 설정에서 관리. 대시보드·RE100·PPA 보고서·무료진단이 같은 값을 읽는다.
// 새로고침해도 남게 브라우저에 저장 (POC)
const ENERGY_KEY = 'ulsan-energy-settings-v2'; // v2 — 예전 배출계수 0.4594 가 저장된 브라우저도 0.4173 기본값으로 다시 시작
let ENERGY: Record<string, string> = {
  SMP_PRICE_CAP: '180', // ₩/kWh — SMP 상한제 값(설정)
  CO2_EMISSION_FACTOR: String(ELEC_FACTOR), // tCO₂/MWh — 국가 전력배출계수
  CO2_FACTOR_YEAR: '2023', // 배출계수 기준 연도
  CO2_FACTOR_PUBLISHED: '2025-12-17', // 기후에너지환경부 공표일
  CLIMATE_CHG: '9.0', // ₩/kWh — 기후환경요금
  PPA_WEEKEND_OFF: '1', // 무료진단 PPA — 주말 인버터 OFF
  PPA_HOLIDAY_OFF: '1', // 무료진단 PPA — 공휴일 인버터 OFF
  PPA_OFF_START: '17:00', // PPA 인버터 매일 OFF 시각
  PPA_ON_TIME: '10:00', // PPA 인버터 매일 ON 시각
  FUEL_ADJ: '5.0', // ₩/kWh — 연료비조정요금 (2026 3분기)
  KEPCO_UNIT_PRICE: '152.3', // ₩/kWh — 한전 산업용 단가. 자가소비 절감액 = 발전량 × 이 값
  PPA_UNIT_PRICE: '138.0', // ₩/kWh — 온사이트 PPA 계약 단가. PPA 요금 = 발전량 × 이 값
};
if (typeof window !== 'undefined') {
  try {
    const saved = JSON.parse(window.localStorage.getItem(ENERGY_KEY) ?? 'null');
    if (saved && typeof saved === 'object') ENERGY = { ...ENERGY, ...saved };
    if (ENERGY.PPA_ON_TIME === '06:00') ENERGY.PPA_ON_TIME = '10:00'; // 2026-10-13 ON 시각 06 → 10
    if (ENERGY.PPA_OFF_START === '18:00') ENERGY.PPA_OFF_START = '17:00'; // 2026-10-14 OFF 시각 18 → 17
  } catch {
    /* 저장본이 깨졌으면 기본값으로 시작 */
  }
}
registerMock(/^\/settings\/public\/energy$/, () => ENERGY, 'GET');
registerMock(/^\/settings\/public\/energy$/, ({ body }) => {
  const patch = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  ENERGY = { ...ENERGY, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, String(v)])) };
  try {
    window.localStorage.setItem(ENERGY_KEY, JSON.stringify(ENERGY));
  } catch {
    /* 저장 실패는 무시 — 메모리에는 남는다 */
  }
  return ENERGY;
}, 'PUT');

// 산업용 평균판매단가 연도별 실적 — 관리 › 에너지 설정. 새로고침해도 남게 브라우저에 저장 (POC)
const TARIFF_KEY = 'ulsan-industrial-tariff-v2'; // v2 — 2019~2025 공개 실적 7개로 시드 교체
let TARIFF_YEARS: TariffYear[] = TARIFF_YEAR_SEED.map((r) => ({ ...r }));
if (typeof window !== 'undefined') {
  try {
    const saved = JSON.parse(window.localStorage.getItem(TARIFF_KEY) ?? 'null');
    if (Array.isArray(saved)) TARIFF_YEARS = saved;
  } catch {
    /* 저장본이 깨졌으면 시드로 시작 */
  }
}
registerMock(/^\/settings\/public\/industrial-tariff$/, () => TARIFF_YEARS, 'GET');
registerMock(/^\/settings\/public\/industrial-tariff$/, ({ body }) => {
  TARIFF_YEARS = (Array.isArray(body) ? (body as TariffYear[]) : []).map((r) => ({ year: Number(r.year), price: Number(r.price) })).sort((a, b) => a.year - b.year);
  try {
    window.localStorage.setItem(TARIFF_KEY, JSON.stringify(TARIFF_YEARS));
  } catch {
    /* 저장 실패는 무시 — 메모리에는 남는다 */
  }
  return TARIFF_YEARS;
}, 'PUT');

// 연도별 한전 요금표 — 관리 › 에너지 설정. 새로고침해도 남게 브라우저에 저장 (POC)
const KEPCO_KEY = 'ulsan-kepco-tariff-v6'; // v6 — 2026 개편 참고값 추가 · v5 — 2019~2025 원문 요금표 · v4 — 연도별(이름 없음) · 경부하 · 시간대 경부하 10h · 최대 2h · 중간 12h
let KEPCO_TABLE: TariffYearTable[] = cleanBook(null);
if (typeof window !== 'undefined') {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEPCO_KEY) ?? 'null');
    if (saved) KEPCO_TABLE = cleanBook(saved);
  } catch {
    /* 저장본이 깨졌으면 원본 값으로 시작 */
  }
}
registerMock(/^\/settings\/public\/kepco-tariff$/, () => KEPCO_TABLE, 'GET');
// 공휴일 — 특일 정보 API 응답을 날짜 · 이름으로(목업은 받아 둔 해만). 사람이 더하고 뺀 목록은 브라우저에 저장
const HOLIDAY_KEY = 'ulsan-holidays-v1';
let HOLIDAYS: Record<number, Holiday[]> = {};
if (typeof window !== 'undefined') {
  try {
    HOLIDAYS = JSON.parse(window.localStorage.getItem(HOLIDAY_KEY) ?? '{}') ?? {};
  } catch {
    /* 깨졌으면 API 값으로 */
  }
}
registerMock(/^\/settings\/public\/holidays$/, ({ query }) => HOLIDAYS[Number(query.get('year'))] ?? HOLIDAYS_SEED[Number(query.get('year'))] ?? [], 'GET');
registerMock(/^\/settings\/public\/holidays$/, ({ query, body }) => {
  const y = Number(query.get('year'));
  const list = (Array.isArray(body) ? (body as Holiday[]) : [])
    .filter((h) => typeof h?.date === 'string' && h.date.startsWith(`${y}-`) && typeof h?.name === 'string')
    .sort((a, b) => a.date.localeCompare(b.date));
  HOLIDAYS = { ...HOLIDAYS, [y]: list };
  try {
    window.localStorage.setItem(HOLIDAY_KEY, JSON.stringify(HOLIDAYS));
  } catch {
    /* 저장 실패는 무시 — 메모리에는 남는다 */
  }
  return list;
}, 'PUT');
registerMock(/^\/settings\/public\/kepco-tariff$/, ({ body }) => {
  KEPCO_TABLE = cleanBook(body);
  try {
    window.localStorage.setItem(KEPCO_KEY, JSON.stringify(KEPCO_TABLE));
  } catch {
    /* 저장 실패는 무시 — 메모리에는 남는다 */
  }
  return KEPCO_TABLE;
}, 'PUT');

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
  /** 이상이 속한 계약 — 인버터 단위 이상은 계약을 특정할 수 있다. 없으면 발전소 전체(RTU 등) */
  contractKind?: PlantContractKind;
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
function anomaly(
  id: number, plantId: number, title: string, description: string, severity: string, status: string,
  detectedAt: string, actions: MockAction[], resolvedAt: string | null = null, contractKind?: PlantContractKind,
): MockAnomaly {
  const plant = PLANTS.find((p) => p.plantId === plantId);
  // 이상 하나는 계약 하나에 속한다 — 계약이 하나뿐인 발전소는 그 계약, 혼합 계약은 호출부에서 지정
  const kind = contractKind ?? (plant?.contractTypes?.length === 1 ? plant.contractTypes[0] : plant?.contractType);
  return {
    id, plantId, contractKind: kind, plantName: plant?.name ?? '', detectionType: plant?.type ?? 'SOLAR', title, description, severity, status,
    detectedAt, resolvedAt, affectedConsumers: [], actions, createdAt: detectedAt, updatedAt: resolvedAt ?? detectedAt,
  };
}
/**
 * 이상 목록 — 근거: ITS_울산_에자자_수집데이터_API_명세서_v1.2
 * severity = DX riskLevel(normal/caution/warning) · status = S-Energy 통신 상태(NORMAL=0 정상 / COMM_ERROR=1 통신오류)
 * actions·resolvedAt 은 원본 프론트의 처리 워크플로 잔재 — 스펙에 없으며 목록 화면에서는 쓰지 않는다.
 * 수집 항목에 없는 이상(스택 온도 · 일사량 편차 · 통신 지연 · 출력 저하)은 넣지 않는다. 남은 건 통신 상태(COMM_ERROR) · RTU 전원뿐 — 2026-11-09 사용자가 지운 뒤 금지.
 */
export const ANOMALY_ROWS: MockAnomaly[] = [
  // 경고 · 통신오류 진행 중 — 건호이엔씨
  anomaly(4, 17513, '인버터 #2 통신 끊김 (8분)', '인버터 #2 RTU 응답 없음. 8분간 계측값 미수신.', 'warning', 'COMM_ERROR', daysAgo(0, 8, 40), []),
  // 등급은 정상인데 통신만 오류 — 태성산업 (등급·통신은 별개 소스라 이런 건도 이상 목록에 뜬다)
  anomaly(8, 17511, 'RTU 전원 꺼짐', 'RTU 전원 신호 꺼짐. 전체 인버터 계측 중단. 현장 전원 확인.', 'warning', 'COMM_ERROR', daysAgo(0, 7, 20), []),
  anomaly(6, 17512, 'RTU 통신 끊김 (3분)', 'RTU 폴링 응답 없음. 3분간 계측값 미수신. 전기안전지수는 정상.', 'normal', 'COMM_ERROR', daysAgo(0, 9, 55), []),
  // 주의 — 용인금속
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
