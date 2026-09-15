/**
 * POC API 클라이언트 — 네트워크 호출 없이 목업 라우터(src/mocks/poc)로 응답한다.
 * 원본(energy-v2-frontend)의 IApiClient 계약(get/post/put/patch/delete)은 그대로 유지하므로
 * api/{domain} 함수와 hooks 는 수정 없이 동작한다.
 */
import { resolveMock } from '@/mocks/poc';

export interface IApiClient {
  get<T, P extends object = object>(endpoint: string, params?: P): Promise<T>;
  post<T>(endpoint: string, body?: unknown): Promise<T>;
  put<T>(endpoint: string, body?: unknown): Promise<T>;
  patch<T>(endpoint: string, body?: unknown): Promise<T>;
  delete<T>(endpoint: string, body?: unknown): Promise<T>;
}

class MockApiClient implements IApiClient {
  async get<T, P extends object = object>(endpoint: string, params?: P): Promise<T> {
    return resolveMock('GET', endpoint, params) as Promise<T>;
  }
  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return resolveMock('POST', endpoint, undefined, body) as Promise<T>;
  }
  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return resolveMock('PUT', endpoint, undefined, body) as Promise<T>;
  }
  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return resolveMock('PATCH', endpoint, undefined, body) as Promise<T>;
  }
  async delete<T>(endpoint: string, body?: unknown): Promise<T> {
    return resolveMock('DELETE', endpoint, undefined, body) as Promise<T>;
  }
}

export const apiClient: IApiClient = new MockApiClient();

let _apiClient: IApiClient = apiClient;
export function getApiClient(): IApiClient {
  return _apiClient;
}
export function setApiClient(client: IApiClient): void {
  _apiClient = client;
}
