import type { BaseEntity } from './common';

export type DatasetFormat = 'FILE' | 'API' | 'STREAMING';
export type UpdateFrequency = 'REALTIME' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ONCE';
export type PriceModelType =
  | 'FREE'
  | 'ONETIME'
  | 'SUBSCRIPTION'
  | 'PAY_PER_USE'
  | 'VOLUME'
  | 'ENTERPRISE';
export type DatasetStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
export type LicenseType = 'STANDARD' | 'COMMERCIAL' | 'RESEARCH' | 'CUSTOM';

export interface Category {
  id: number;
  name: string;
  slug: string;
  parentId?: number;
  children?: Category[];
  icon?: string;
  datasetCount: number;
  order: number;
}

export interface Tag {
  id: number;
  name: string;
  datasetCount: number;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  period: 'MONTHLY' | 'YEARLY';
  price: number;
  features: string[];
  apiCallLimit?: number;
}

export interface PriceModel {
  type: PriceModelType;
  basePrice?: number;
  plans?: SubscriptionPlan[];
  perUsePrice?: number;
  freeQuota?: number;
  trialDays?: number;
}

export interface SchemaColumn {
  name: string;
  type: 'STRING' | 'INTEGER' | 'FLOAT' | 'BOOLEAN' | 'DATETIME' | 'JSON';
  description: string;
  unit?: string;
  nullable: boolean;
  sampleValues?: string[];
}

export interface DatasetListItem {
  id: number;
  title: string;
  description: string;
  provider: { id: number; name: string; organization?: string };
  category: { id: number; name: string; slug: string };
  tags: { id: number; name: string }[];
  format: DatasetFormat;
  updateFrequency: UpdateFrequency;
  priceModel: PriceModel;
  qualityScore: number;
  avgRating: number;
  reviewCount: number;
  viewCount: number;
  downloadCount: number;
  thumbnailUrl?: string;
  createdAt: string;
  // 실API 정합(설계 16 §3.2) — DRAFT 등 미게시/미수집분 표기. 수집예정 배지 판단.
  status?: DatasetStatus;
  collectingSoon?: boolean;
}

export interface Dataset extends BaseEntity {
  title: string;
  description: string;
  providerId: number;
  provider: { id: number; name: string; organization?: string };
  category: Category;
  tags: Tag[];
  format: DatasetFormat;
  updateFrequency: UpdateFrequency;
  priceModel: PriceModel;
  licenseType: LicenseType;
  status: DatasetStatus;
  qualityScore: number;
  viewCount: number;
  downloadCount: number;
  avgRating: number;
  reviewCount: number;
  sampleFileUrl?: string;
  schema?: { columns: SchemaColumn[] };
}

export interface CatalogFilters {
  q?: string;
  category?: string;
  format?: DatasetFormat;
  priceModel?: PriceModelType;
  priceMin?: number;
  priceMax?: number;
  updateFrequency?: UpdateFrequency;
  qualityMin?: number;
  sort?: 'popular' | 'newest' | 'price_asc' | 'price_desc' | 'rating';
  page?: number;
  size?: number;
}
