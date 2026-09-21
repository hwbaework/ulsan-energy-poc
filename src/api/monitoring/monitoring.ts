import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { LASEE_PLANT_MAP } from '@/constants/plant-mapping';
import type {
  MonitoringPlant,
  MonitoringConsumer,
  PlantContract,
  ConsumerSupplyImpact,
  ConsumerSupplyDemand,
  AnomalyImpact,
  PlantContractKind,
  PlantAnomalySummary,
} from '@/types/monitoring';

export interface LaseeMonitoringPlant {
  plantId: number;
  name: string;
  type: string;
  status: string;
  address: string;
  capacity: number;
  currentOutput: number;
  dailyEnergy: number;
  totalEnergy: number;
  contractType?: PlantContractKind;
  contractTypes?: PlantContractKind[];
  anomalies?: PlantAnomalySummary[];
  connectionStatus: {
    rtuPower: 'ON' | 'OFF';
    rtuConnection: 'NORMAL' | 'ERROR';
    inverterConnections: { number: number; state: 'NORMAL' | 'ERROR' }[];
  };
  inverters: {
    number: number;
    capacity: number;
    connectionState: 'NORMAL' | 'ERROR';
    lastDataAt: string;
    dc: { voltage: number; current: number; power: number };
    ac: {
      voltR: number;
      voltS: number;
      voltT: number;
      currentR: number;
      currentS: number;
      currentT: number;
      power: number;
    };
    powerFactor: number;
    frequency: number;
    dailyEnergy: number;
    totalEnergy: number;
    statusMessages: string[];
  }[];
}

function toMonitoringPlant(p: LaseeMonitoringPlant): MonitoringPlant {
  const coords = LASEE_PLANT_MAP[p.plantId];
  return {
    plantId: p.plantId,
    name: p.name,
    type: p.type ?? 'SOLAR',
    status: p.status as MonitoringPlant['status'],
    capacity: p.capacity,
    currentOutput: p.currentOutput,
    address: p.address,
    connectionStatus: p.connectionStatus,
    inverters: p.inverters,
    dailyEnergy: p.dailyEnergy,
    totalEnergy: p.totalEnergy,
    latitude: coords?.latitude ?? 0,
    longitude: coords?.longitude ?? 0,
    contractType: p.contractType,
    contractTypes: p.contractTypes,
    anomalies: p.anomalies,
  };
}

export async function getMonitoringPlants(ownedOnly = false): Promise<MonitoringPlant[]> {
  const url = ownedOnly
    ? `${ENDPOINTS.monitoring.plants}?ownedOnly=true`
    : ENDPOINTS.monitoring.plants;
  const resp = await getApiClient().get<LaseeMonitoringPlant[]>(url);
  return resp.map(toMonitoringPlant);
}

export async function getMonitoringPlantDetail(laseeId: number): Promise<MonitoringPlant> {
  const resp = await getApiClient().get<LaseeMonitoringPlant>(
    ENDPOINTS.monitoring.plantDetail(laseeId),
  );
  return toMonitoringPlant(resp);
}

export interface PlantHistoryPoint {
  time: string;
  dcPower: number;
  acPower: number;
  dailyEnergy: number;
}

export async function getPlantHistory(
  laseeId: number,
  from: string,
  to: string,
): Promise<PlantHistoryPoint[]> {
  const fromDt = from.includes('T') ? from : `${from}T00:00:00+09:00`;
  const toDt = to.includes('T') ? to : `${to}T23:59:59+09:00`;
  return getApiClient().get(ENDPOINTS.monitoring.plantHistory(laseeId), { from: fromDt, to: toDt });
}

export interface MonitoringDashboard {
  totalPlants: number;
  normalPlants: number;
  anomalyPlants: number;
  offlinePlants: number;
  totalConsumers: number;
  activeContracts: number;
  unresolvedAnomalies: number;
  totalCurrentOutputKw: number;
  todayGenerationKwh: number;
}

export interface PlantDailySummary {
  date: string;
  plantId: number;
  dailyEnergyKwh: number;
  generationHours: number;
  unitPriceKrw: number;
  dailyAmountKrw: number;
  currentOutputKw: number;
  capacityKw: number;
}

export async function getPlantDailySummary(
  laseeId: number,
  date: string,
): Promise<PlantDailySummary> {
  return getApiClient().get(ENDPOINTS.monitoring.plantDailySummary(laseeId), { date });
}

export async function getMonitoringDashboard(): Promise<MonitoringDashboard> {
  return getApiClient().get(ENDPOINTS.monitoring.dashboard);
}

export async function getMonitoringConsumers(): Promise<MonitoringConsumer[]> {
  return getApiClient().get(ENDPOINTS.monitoring.consumers);
}

export async function getMonitoringConsumerDetail(id: number): Promise<MonitoringConsumer> {
  return getApiClient().get(ENDPOINTS.monitoring.consumerDetail(id));
}

export async function getMonitoringContracts(): Promise<PlantContract[]> {
  return getApiClient().get(ENDPOINTS.monitoring.contracts);
}

export async function getConsumerSupplyImpact(companyId: number): Promise<ConsumerSupplyImpact> {
  return getApiClient().get(ENDPOINTS.monitoring.consumerSupplyImpact(companyId));
}

export async function getConsumerSupplyDemand(companyId: number): Promise<ConsumerSupplyDemand> {
  return getApiClient().get(ENDPOINTS.monitoring.consumerSupplyDemand(companyId));
}

export async function getAnomalyImpact(id: number): Promise<AnomalyImpact> {
  return getApiClient().get(ENDPOINTS.monitoring.anomalyImpact(id));
}
