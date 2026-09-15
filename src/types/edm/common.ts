export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface ListQueryParams {
  page?: number;
  size?: number;
  sort?: string;
  dir?: 'ASC' | 'DESC';
  q?: string;
}

export interface BaseEntity {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface SoftDeletableEntity extends BaseEntity {
  deletedAt?: string | null;
}

export type ISODateString = string;
export type OmitCreateFields = 'id' | 'createdAt' | 'updatedAt' | 'deletedAt';

export interface ApiError {
  success: false;
  error: string;
  statusCode?: number;
}

export type Status = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'WITHDRAWN' | 'PENDING';
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';
