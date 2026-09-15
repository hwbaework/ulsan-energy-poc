/**
 * POC 목업 라우터(레지스트리). fixtures.ts 가 여기에 registerMock 으로 등록한다.
 * (index.ts 와 순환 import 를 피하기 위해 분리)
 *
 * - 등록된 패턴(registerMock)에 맞는 엔드포인트는 해당 픽스처를 반환
 * - 그 외는 "빈 응답"(emptyResponse) — 배열이면서 PageResponse 필드도 가진 객체라
 *   `data.map(...)`, `data.content.map(...)`, `data.totalElements` 어느 쪽으로 읽어도 안전하다.
 */
export type MockMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface MockContext {
  method: MockMethod;
  endpoint: string;
  path: string;
  query: URLSearchParams;
  params?: Record<string, unknown>;
  body?: unknown;
  match: RegExpMatchArray;
}

type Handler = (ctx: MockContext) => unknown;

interface Route {
  re: RegExp;
  method?: MockMethod;
  handler: Handler;
}

const routes: Route[] = [];

export function registerMock(re: RegExp, handler: Handler, method?: MockMethod): void {
  routes.push({ re, handler, method });
}

/** 빈 목록 + 빈 페이지 응답 겸용 객체 */
export function emptyResponse(): unknown {
  return Object.assign([], {
    content: [],
    items: [],
    page: 0,
    number: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
    last: true,
    first: true,
    empty: true,
  });
}

export function pageOf<T>(content: T[], size = 20): {
  content: T[];
  page: number;
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
  first: boolean;
  empty: boolean;
} {
  return {
    content,
    page: 0,
    number: 0,
    size,
    totalElements: content.length,
    totalPages: content.length > 0 ? Math.ceil(content.length / size) : 0,
    last: true,
    first: true,
    empty: content.length === 0,
  };
}

const LATENCY_MS = 120;

export async function resolveMock(
  method: MockMethod,
  endpoint: string,
  params?: object,
  body?: unknown,
): Promise<unknown> {
  const [rawPath, rawQuery = ''] = endpoint.split('?');
  const path = (rawPath ?? '').replace(/^\/api\/v1/, '');
  const query = new URLSearchParams(rawQuery);
  if (params) {
    for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
      if (v !== undefined && v !== null) query.set(k, String(v));
    }
  }

  await new Promise((r) => setTimeout(r, LATENCY_MS));

  for (const route of routes) {
    if (route.method && route.method !== method) continue;
    const match = path.match(route.re);
    if (match) {
      const result = route.handler({
        method,
        endpoint,
        path,
        query,
        params: params as Record<string, unknown> | undefined,
        body,
        match,
      });
      return structuredClone(result);
    }
  }
  return emptyResponse();
}
