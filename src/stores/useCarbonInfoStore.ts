import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ssrSafeStorage } from '@/lib/ssr-storage';

// 카본 마켓 정보 표 — 관리자가 고친 줄(거래 종목 · 참여 자격 · 매매시간 · 회원 구분 · 공식 사이트(이름, 주소) 등 제도가 바뀌면).
// 고친 적 없으면 화면 코드의 기본 줄. 이력은 두지 않는다. POC — 브라우저(localStorage), 백엔드 구현 시 서버 저장으로 교체

interface CarbonInfoState {
  rows: Record<string, string[][]>;
  setRows: (key: string, rows: string[][]) => void;
}

export const useCarbonInfoStore = create<CarbonInfoState>()(
  persist(
    (set) => ({
      rows: {},
      setRows: (key, rows) => set((s) => ({ rows: { ...s.rows, [key]: rows } })),
    }),
    { name: 'carbon-info', storage: createJSONStorage(() => ssrSafeStorage) },
  ),
);
