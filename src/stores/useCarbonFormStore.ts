import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ssrSafeStorage } from '@/lib/ssr-storage';

// 카본 마켓 서식 — 관리자가 올린 새 서식(법령 개정 시) + 그 서식의 시행일. 없으면 법제처 원본(lib/carbon-docs CARBON_FORMS).
// 이력은 두지 않는다 — 서식마다 최신 하나. POC — 브라우저(localStorage)에 data URL 로 저장, 백엔드 구현 시 파일 서버로 교체

export interface UploadedForm {
  name: string;
  /** data URL */
  url: string;
  /** 올린 일시 YYYY-MM-DD HH:mm */
  at: string;
  by: string;
}
export type FormFileKind = 'pdf' | 'hwp';

export interface FormOverride {
  pdf?: UploadedForm;
  hwp?: UploadedForm;
  /** 시행일 YYYY-MM-DD — 올린 날과 다를 수 있어 관리자가 넣는다 */
  from: string;
}

interface CarbonFormState {
  files: Record<string, FormOverride>;
  /** 새 서식 저장 — 넘긴 파일만 바꾸고, 시행일은 서식 전체에 */
  save: (key: string, from: string, files: Partial<Record<FormFileKind, UploadedForm>>) => void;
  /** 법제처 원본으로 되돌린다 */
  reset: (key: string) => void;
}

export const useCarbonFormStore = create<CarbonFormState>()(
  persist(
    (set) => ({
      files: {},
      save: (key, from, files) => set((s) => ({ files: { ...s.files, [key]: { ...s.files[key], ...files, from } } })),
      reset: (key) =>
        set((s) => {
          const files = { ...s.files };
          delete files[key];
          return { files };
        }),
    }),
    { name: 'carbon-forms-v2', storage: createJSONStorage(() => ssrSafeStorage) },
  ),
);
