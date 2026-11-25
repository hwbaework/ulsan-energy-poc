import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ssrSafeStorage } from '@/lib/ssr-storage';
import type { ConsultingDoc } from '@/lib/consulting-docs';

/**
 * 컨설팅 › 문서 관리에 관리자가 직접 업로드한 문서(2026-11-25 사용자: 문서를 올릴 수 있어야 한다).
 * 기본 문서(lib/consulting-docs 의 결과보고서)에 더해진다. POC 는 브라우저에 저장(파일은 3MB 이하 PDF 를 그대로)
 */
interface State {
  added: ConsultingDoc[];
  add: (doc: Omit<ConsultingDoc, 'id'>) => void;
}

export const useConsultingDocStore = create<State>()(
  persist(
    (set) => ({
      added: [],
      // 기본 문서 번호와 겹치지 않게 1000 번대부터
      add: (doc) => set((s) => ({ added: [{ ...doc, id: 1000 + s.added.length + 1 }, ...s.added] })),
    }),
    { name: 'ulsan-consulting-docs-v1', storage: createJSONStorage(() => ssrSafeStorage) },
  ),
);
