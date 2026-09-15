/**
 * POC 픽스처 — 주요 화면(통합관제 지도·대시보드·수용가)이 비어 보이지 않을 정도의 최소 데이터.
 * 나머지 엔드포인트는 라우터의 기본 빈 응답으로 처리된다.
 */
import { registerMock, pageOf } from './registry';
import { LASEE_PLANTS } from '@/constants/plant-mapping';
import { useAuthStore } from '@/stores/useAuthStore';
import type { LaseeMonitoringPlant } from '@/api/monitoring/monitoring';
import type { MonitoringConsumer } from '@/types/monitoring';
import type { PowerStation } from '@/types/power-station';
import type { ConsumerSite } from '@/types/consumer';

const NOW = '2026-09-15T10:00:00';

/* ── 발전소 (울산미포 6개소) ─────────────────────────────────── */
const PLANT_SPECS: Record<number, { type: 'SOLAR' | 'ORC' | 'FUEL_CELL'; capacity: number; status: LaseeMonitoringPlant['status'] }> = {
  17511: { type: 'SOLAR', capacity: 498, status: 'NORMAL' },
  17512: { type: 'SOLAR', capacity: 312, status: 'NORMAL' },
  17513: { type: 'SOLAR', capacity: 256, status: 'WARNING' },
  17514: { type: 'SOLAR', capacity: 880, status: 'NORMAL' },
  17515: { type: 'ORC', capacity: 150, status: 'MAINTENANCE' },
  17558: { type: 'FUEL_CELL', capacity: 440, status: 'NORMAL' },
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
    statusMessages: ['정상 운전'],
  };
}

export const PLANTS: LaseeMonitoringPlant[] = LASEE_PLANTS.map((p, idx) => {
  const spec = PLANT_SPECS[p.laseeId] ?? { type: 'SOLAR', capacity: 300, status: 'NORMAL' };
  const ratio = spec.status === 'MAINTENANCE' ? 0 : spec.status === 'WARNING' ? 0.42 : 0.68 + (idx % 3) * 0.06;
  const half = Math.round(spec.capacity / 2);
  return {
    plantId: p.laseeId,
    name: p.name,
    type: spec.type,
    status: spec.status,
    address: `울산광역시 남구 미포산단 ${idx + 1}길`,
    capacity: spec.capacity,
    currentOutput: Math.round(spec.capacity * ratio),
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
registerMock(/^\/monitoring\/plants\/(\d+)$/, ({ match }) => {
  const id = Number(match[1]);
  return PLANTS.find((p) => p.plantId === id) ?? PLANTS[0];
});
registerMock(/^\/monitoring\/plants\/(\d+)\/history$/, ({ match }) => {
  const id = Number(match[1]);
  const plant = PLANTS.find((p) => p.plantId === id) ?? PLANTS[0]!;
  const points: { time: string; dcPower: number; acPower: number; dailyEnergy: number }[] = [];
  let energy = 0;
  for (let h = 0; h < 24; h++) {
    const sun = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
    const ac = Math.round(plant.capacity * 0.85 * sun);
    energy += ac;
    points.push({
      time: `2026-09-15T${String(h).padStart(2, '0')}:00:00`,
      dcPower: Math.round(ac * 1.04),
      acPower: ac,
      dailyEnergy: energy,
    });
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

/* ── 발전사업자 소유 발전소 (통합관제 노출 조건) ─────────────── */
export const POWER_STATIONS: PowerStation[] = PLANTS.slice(0, 4).map((p, i) => ({
  id: i + 1,
  ownerCompanyId: 3,
  ownerCompanyName: '울산 발전(주)',
  name: p.name,
  generationType: p.type,
  capacityKw: p.capacity,
  address: p.address,
  latitude: LASEE_PLANTS[i]?.latitude,
  longitude: LASEE_PLANTS[i]?.longitude,
  externalPlantId: String(p.plantId),
  commissionedAt: '2024-03-01',
  status: 'ACTIVE',
  createdAt: NOW,
  updatedAt: NOW,
}));
registerMock(/^\/power-stations\/by-company\/(\d+)$/, ({ match }) =>
  Number(match[1]) === 3 ? POWER_STATIONS : [],
);
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
registerMock(/^\/notifications\/unread-count$/, () => 0);
registerMock(/^\/notifications$/, () => pageOf([]));
