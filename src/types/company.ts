import type { BaseEntity } from './common';

export interface Company extends BaseEntity {
  name: string;
  businessNumber: string;
  representativeName?: string;
  address?: string;
  detailAddress?: string;
  zipcode?: string;
  phone?: string;
  email?: string;
  website?: string;
  industryCode?: string;
  employeeCount?: number;
  annualRevenue?: number;
  status: string;
  businessTypes: string[];
}
