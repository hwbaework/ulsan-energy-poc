import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ssrSafeStorage } from '@/lib/ssr-storage';

// 카본 마켓 정보 표 — 관리자가 고친 표 제목 · 줄(거래 종목 · 참여 자격 · 매매시간 · 회원 구분 · 공식 사이트(이름, 주소) 등 제도가 바뀌면).
// 고친 적 없으면 화면 코드의 기본 줄. 이력은 두지 않는다. POC — 브라우저(localStorage), 백엔드 구현 시 서버 저장으로 교체

interface CarbonInfoState {
  rows: Record<string, string[][]>;
  /** 관리자가 고친 표 제목 — 없으면 화면 코드의 제목 */
  titles: Record<string, string>;
  /** 화면마다 관리자가 더한 섹션(표) — 표 id 목록. 제목 · 줄은 titles · rows 에 */
  sections: Record<string, string[]>;
  setRows: (key: string, rows: string[][], title?: string) => void;
  addSection: (screen: string, id: string, title: string) => void;
  /** 더한 섹션 삭제 — 제목 · 줄도 함께 */
  removeSection: (screen: string, id: string) => void;
  /** 화면마다 지운 원래 섹션 — 그 화면에서만 숨긴다 */
  hiddenSections: Record<string, string[]>;
  hideSection: (screen: string, id: string) => void;
}

export const useCarbonInfoStore = create<CarbonInfoState>()(
  persist(
    (set) => ({
      rows: {},
      titles: {},
      sections: {},
      hiddenSections: {},
      hideSection: (screen, id) =>
        set((s) => ({ hiddenSections: { ...s.hiddenSections, [screen]: [...new Set([...(s.hiddenSections?.[screen] ?? []), id])] } })),
      addSection: (screen, id, title) =>
        set((s) => ({
          sections: { ...s.sections, [screen]: [...(s.sections?.[screen] ?? []), id] },
          titles: { ...s.titles, [id]: title },
        })),
      removeSection: (screen, id) =>
        set((s) => {
          const rows = { ...s.rows };
          const titles = { ...s.titles };
          delete rows[id];
          delete titles[id];
          return { sections: { ...s.sections, [screen]: (s.sections?.[screen] ?? []).filter((x) => x !== id) }, rows, titles };
        }),
      setRows: (key, rows, title) =>
        set((s) => ({ rows: { ...s.rows, [key]: rows }, titles: title ? { ...s.titles, [key]: title } : s.titles })),
    }),
    { name: 'carbon-info', storage: createJSONStorage(() => ssrSafeStorage) },
  ),
);
