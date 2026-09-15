export type PlantStatus = 'NORMAL' | 'WARNING' | 'ANOMALY' | 'MAINTENANCE' | 'OFFLINE';
export type AnomalyActionStatus =
  | 'DETECTED'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'FALSE_ALARM';
export type EnergySource = 'SOLAR' | 'ORC' | 'FUEL_CELL';
export interface InverterStatus {
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
}

export interface PlantConnectionStatus {
  rtuPower: 'ON' | 'OFF';
  rtuConnection: 'NORMAL' | 'ERROR';
  inverterConnections: { number: number; state: 'NORMAL' | 'ERROR' }[];
}

export interface MonitoringPlant {
  plantId: number;
  name: string;
  type: string;
  status: PlantStatus;
  address: string;
  capacity: number;
  currentOutput: number;
  dailyEnergy?: number;
  monthlyEnergy?: number;
  totalEnergy?: number;
  utilizationRate?: number;
  dailyCo2Reduction?: number;
  connectionStatus?: PlantConnectionStatus;
  inverters?: InverterStatus[];
  latitude?: number;
  longitude?: number;
}

export interface MonitoringConsumer {
  id: number;
  companyId: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  reTargetPct: number;
  reCurrentPct: number;
  monthlyDemandKwh: number;
  monthlySupplyKwh: number;
  todaySupplyKwh?: number;
}

export interface PlantContract {
  id: number;
  powerStationId: number;
  powerStationName: string;
  consumerCompanyId: number;
  consumerCompanyName: string;
  contractType: string;
  contractCapacityKw: number;
  contractStart: string;
  contractEnd: string;
  status: string;
}

export interface AnomalyEvent {
  id: number;
  plantId: number;
  plantName: string;
  severity: string;
  status: string;
  title: string;
  detectedAt: string;
  resolvedAt?: string;
}

export interface ConsumerSupplyImpact {
  companyId: number;
  consumerName: string;
  activeAnomalies: {
    anomalyId: number;
    plantId: number;
    plantName: string;
    title: string;
    severity: string;
    status: string;
    contractCapacityKw: number;
  }[];
  totalContractCapacityKw: number;
  impactedCapacityKw: number;
}

export interface ConsumerSupplyDemand {
  companyId: number;
  consumerName: string;
  monthlyDemandKwh: number;
  monthlySupplyKwh: number;
  todaySupplyKwh: number;
  supplyDemandRatioPct: number;
  reTargetPct: number;
  reCurrentPct: number;
  ppaDetails: {
    contractNumber: string;
    plantName: string;
    contractCapacityKw: number;
    monthlyGenerationKwh: number;
    fulfillmentPct: number;
  }[];
}

export interface AnomalyImpact {
  anomalyId: number;
  title: string;
  severity: string;
  status: string;
  plantId: number;
  plantName: string;
  affectedConsumers: {
    companyId: number;
    companyName: string;
    contractCapacityKw: number;
    contractType: string;
  }[];
  affectedPpaContracts: {
    contractId: number;
    contractNumber: string;
    status: string;
    allocatedCapacityKw: number;
    consumerName: string;
  }[];
}
