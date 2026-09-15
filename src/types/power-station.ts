import type { BaseEntity } from './common';

export interface PowerStation extends BaseEntity {
  ownerCompanyId: number;
  ownerCompanyName: string;
  name: string;
  generationType: string;
  capacityKw: number;
  address?: string;
  detailAddress?: string;
  regionCode?: string;
  latitude?: number;
  longitude?: number;
  externalPlantId?: string;
  commissionedAt?: string;
  status: string;
}
