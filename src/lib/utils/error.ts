import axios from 'axios';
import type { ApiError } from '@/types';

function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    (value as ApiError).success === false
  );
}

export function getErrorMessage(error: unknown, fallback = '처리에 실패했습니다'): string {
  if (isApiError(error)) {
    if (error.error) return error.error;
    if (error.statusCode === 409) return '이미 존재하는 데이터입니다';
    if (error.statusCode === 404) return '데이터를 찾을 수 없습니다';
    if (error.statusCode === 403) return '권한이 없습니다';
  }

  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data?.error) return data.error;
    if (data?.message) return data.message;
  }

  if (error instanceof Error) return error.message;
  return fallback;
}
