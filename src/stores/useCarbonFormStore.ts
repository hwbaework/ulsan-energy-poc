import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ssrSafeStorage } from '@/lib/ssr-storage';
import type { CarbonForm } from '@/lib/carbon-docs';

// 카본 마켓 서식 — 관리자가 올린 새 서식(법령 개정 시) + 그 서식의 시행일. 없으면 법제처 원본(lib/carbon-docs CARBON_FORMS).
// 화면마다 관리자가 추가한 서식(added).
// POC — 브라우저(localStorage)에 data URL 로 저장, 백엔드 구현 시 파일 서버로 교체

export interface UploadedForm {
  name: string;
  /** data URL */
  url: string;
  /** 올린 일시 YYYY-MM-DD HH:mm */
  at: string;
  by: string;
}
export type FormFileKind = 'pdf' | 'hwp' | 'xls';

export interface FormOverride {
  pdf?: UploadedForm;
  hwp?: UploadedForm;
  /** 엑셀 자료(업체 명단) — 매년 새 파일로 */
  xls?: UploadedForm;
  /** 시행일 YYYY-MM-DD — 올린 날과 다를 수 있어 관리자가 넣는다 */
  from: string;
}

interface CarbonFormState {
  files: Record<string, FormOverride>;
  /** 화면(문서 목록)마다 관리자가 추가한 서식 */
  added: Record<string, CarbonForm[]>;
  /** 새 서식 저장 — 넘긴 파일만 바꾸고, 시행일은 서식 전체에 */
  save: (key: string, from: string, files: Partial<Record<FormFileKind, UploadedForm>>) => void;
  /** 법제처 원본으로 되돌린다 */
  reset: (key: string) => void;
  /** 문서 등록 — 그 화면 목록 맨 아래 */
  add: (board: string, form: CarbonForm) => void;
  /** 추가한 서식 삭제 — 올린 파일도 함께 */
  remove: (board: string, key: string) => void;
}

export const useCarbonFormStore = create<CarbonFormState>()(
  persist(
    (set) => ({
      files: {},
      added: {},
      save: (key, from, files) => set((s) => ({ files: { ...s.files, [key]: { ...s.files[key], ...files, from } } })),
      reset: (key) =>
        set((s) => {
          const files = { ...s.files };
          delete files[key];
          return { files };
        }),
      add: (board, form) => set((s) => ({ added: { ...s.added, [board]: [...(s.added[board] ?? []), form] } })),
      remove: (board, key) =>
        set((s) => {
          const files = { ...s.files };
          delete files[key];
          return { added: { ...s.added, [board]: (s.added[board] ?? []).filter((f) => f.key !== key) }, files };
        }),
    }),
    { name: 'carbon-forms-v2', storage: createJSONStorage(() => ssrSafeStorage) },
  ),
);
