import type { BaseEntity, Status } from './common';

export interface Equipment extends BaseEntity {
  powerStationId: number;
  name: string;
  equipmentType: string;
  manufacturer?: string;
  modelName?: string;
  serialNumber?: string;
  installedDate?: string;
  capacityKw?: number;
  status: Status;
  isActive: boolean;
}
