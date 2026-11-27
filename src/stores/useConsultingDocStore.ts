import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ssrSafeStorage } from '@/lib/ssr-storage';
import type { ConsultingDoc } from '@/lib/consulting-docs';

/**
 * 컨설팅 › 문서 관리에 관리자가 직접 업로드한 문서(2026-11-25 사용자: 문서를 올릴 수 있어야 한다).
 * 기본 문서(lib/consulting-docs 의 결과보고서)에 더해진다. POC 는 브라우저에 저장(파일은 3MB 이하 PDF 를 그대로)
 * 다시 업로드 — 올린 문서는 그 문서를 바꾸고, 기본 문서는 replaced 에 새 파일을 겹쳐 둔다(원본 목록은 그대로)
 */
interface Replaced {
  pdf: string;
  title: string;
  issuedAt: string;
}
interface State {
  added: ConsultingDoc[];
  /** 기본 문서를 다시 업로드한 것 — 문서 번호 → 새 파일 */
  replaced: Record<number, Replaced>;
  add: (doc: Omit<ConsultingDoc, 'id'>) => void;
  /** 다시 업로드 — 어느 문서든 파일과 이름을 바꾼다(등록일은 다시 올린 날) */
  replace: (id: number, pdf: string, title: string) => void;
}

const today = () => new Date().toLocaleString('sv-SE').slice(0, 10);

export const useConsultingDocStore = create<State>()(
  persist(
    (set) => ({
      added: [],
      replaced: {},
      // 기본 문서 번호와 겹치지 않게 1000 번대부터
      add: (doc) => set((s) => ({ added: [{ ...doc, id: 1000 + s.added.length + 1 }, ...s.added] })),
      replace: (id, pdf, title) =>
        set((s) =>
          s.added.some((d) => d.id === id)
            ? { added: s.added.map((d) => (d.id === id ? { ...d, pdf, title, issuedAt: today() } : d)) }
            : { replaced: { ...s.replaced, [id]: { pdf, title, issuedAt: today() } } },
        ),
    }),
    { name: 'ulsan-consulting-docs-v1', storage: createJSONStorage(() => ssrSafeStorage) },
  ),
);
