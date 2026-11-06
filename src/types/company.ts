import type { BaseEntity } from './common';

export interface Company extends BaseEntity {
  name: string;
  businessNumber: string;
  representativeName?: string;
  /** 업태 · 종목 — 사업자등록증 '사업의 종류'. 세금계산서에 들어간다 */
  bizType?: string;
  bizCategory?: string;
  /** 설립일 — 사업자등록증 '개업연월일'(YYYY-MM-DD). 가입일(createdAt)과 다르다 */
  foundedAt?: string;
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
