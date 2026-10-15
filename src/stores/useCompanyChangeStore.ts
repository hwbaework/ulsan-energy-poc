import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ssrSafeStorage } from '@/lib/ssr-storage';

/**
 * 기업 정보 변경 요청 — 기업관리자가 기업 상세를 고치고 새 사업자 등록증을 올리면 요청이 쌓인다.
 * 바로 바뀌지 않는다. 플랫폼 관리자가 승인 관리에서 등록증을 보고 [확인]하면 기업 정보에 반영, [반려]하면 사유와 함께 돌려보낸다.
 * POC 는 브라우저에 저장(실서비스는 서버 DB + 등록증 파일 저장소)
 */
export type CompanyFields = {
  name: string;
  representativeName: string;
  bizType: string;
  bizCategory: string;
  phone: string;
  address: string;
};
/** 사업자등록증에 적힌 항목 — 바뀌면 새 등록증 + 관리자 검토. 그 밖(연락처)은 바로 반영 */
export const LICENSE_FIELDS: (keyof CompanyFields)[] = ['name', 'representativeName', 'bizType', 'bizCategory', 'address'];
export const FIELD_LABEL: Record<keyof CompanyFields, string> = {
  name: '기업명',
  representativeName: '대표자',
  bizType: '업태',
  bizCategory: '종목',
  phone: '연락처',
  address: '주소',
};
export interface CompanyChangeRequest {
  id: number;
  companyId: number;
  companyName: string;
  /** 바뀌는 칸만 — 전 · 후 */
  changes: { key: keyof CompanyFields; before: string; after: string }[];
  /** 새 사업자 등록증 파일 이름 */
  fileName: string;
  /** 올린 파일(data URL — 이미지 · PDF). POC 는 브라우저에 그대로, 실서비스는 파일 저장소 주소 */
  fileUrl?: string;
  requestedAt: string;
  requestedBy: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decidedAt?: string;
  note?: string;
}

interface State {
  version: number;
  requests: CompanyChangeRequest[];
  request: (r: Omit<CompanyChangeRequest, 'id' | 'status'>) => void;
  approve: (id: number, at: string) => void;
  reject: (id: number, note: string, at: string) => void;
}

const SEED_VERSION = 4; // 4 — 데모 요청은 등록증 항목(업태 · 종목). 3 — 등록증 파일. 2 — 데모 변경 요청 한 건
/** 데모 — 한길 기업관리자(이수용)가 업태 · 종목을 새 등록증과 함께 바꾼 요청(검토 대기) */
const SEED: CompanyChangeRequest[] = [
  {
    id: 1,
    companyId: 3,
    companyName: '한길',
    changes: [
      { key: 'bizType', before: '', after: '제조업' },
      { key: 'bizCategory', before: '', after: '금속 가공' },
    ],
    fileName: '사업자등록증_한길.webp',
    fileUrl: '/samples/biz-license-sample.webp',
    requestedAt: '2026-10-14T16:20:00',
    requestedBy: '이수용',
    status: 'PENDING',
  },
];
export const useCompanyChangeStore = create<State>()(
  persist(
    (set, get) => ({
      version: SEED_VERSION,
      requests: SEED,
      request: (r) =>
        set({ requests: [{ ...r, id: get().requests.reduce((m, x) => Math.max(m, x.id), 0) + 1, status: 'PENDING' }, ...get().requests] }),
      approve: (id, at) => set({ requests: get().requests.map((x) => (x.id === id ? { ...x, status: 'APPROVED', decidedAt: at } : x)) }),
      reject: (id, note, at) => set({ requests: get().requests.map((x) => (x.id === id ? { ...x, status: 'REJECTED', decidedAt: at, note } : x)) }),
    }),
    {
      name: 'ulsan-company-change-poc',
      storage: createJSONStorage(() => ssrSafeStorage),
      skipHydration: true,
      partialize: (s) => ({ version: s.version, requests: s.requests }),
      merge: (persisted, current) => {
        const p = persisted as Partial<State> | undefined;
        if (!p || p.version !== SEED_VERSION) return current;
        return { ...current, ...p };
      },
    },
  ),
);

export function useHydrateCompanyChange() {
  useEffect(() => {
    void useCompanyChangeStore.persist.rehydrate();
  }, []);
}
