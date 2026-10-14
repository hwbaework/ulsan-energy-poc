import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ssrSafeStorage } from '@/lib/ssr-storage';
import { OP_RULE_DEFAULT, weekText, type DayOverride, type OpRule } from '@/lib/op-calendar';

/**
 * PPA 운전 일정 — 발전사업자가 자기 발전소(PPA 계약 기업)마다 요일별 운전 시간 · 공휴일 OFF · 날짜별 지정.
 * 기업이 고친 값만 저장하고 나머지는 관리자 기본값(관리 › 에너지 설정)을 따른다. POC 는 브라우저에 저장
 */
export interface CompanySchedule extends Partial<OpRule> {
  overrides: Record<string, DayOverride>;
}
/** 기본값 위에 기업 값을 얹은 일정 */
export interface ResolvedSchedule extends OpRule {
  overrides: Record<string, DayOverride>;
}
export interface RemoteLog {
  id: number;
  at: string; // ISO
  companyId: number;
  action: 'ON' | 'OFF';
  how: '원격' | '일정 변경';
  by: string;
  note?: string;
}

const SEED_VERSION = 3; // 3 — 요일별 운전 시간 · 날짜 지정은 그날 운전 시간(2026-10-15). 2 — 원격 ON / OFF 를 그날 일정으로 합침
const nowIso = () => new Date().toISOString();

/**
 * 데모 — 한일튜브(박발전) PPA 발전소. 요일표는 기본값(월~금 10:00~17:00 · 토·일 OFF)을 그대로 두고 날짜 지정만 두 건:
 * 금요일 하루 OFF · 토요일 하루 10:00~14:00 운전
 */
const SEED_SCHEDULES: Record<number, CompanySchedule> = {
  4: { overrides: { '2026-10-23': 'OFF', '2026-10-24': '10:00~14:00' } },
};

interface OpScheduleState {
  version: number;
  schedules: Record<number, CompanySchedule>;
  logs: RemoteLog[];
  /** 요일표 · 공휴일 OFF 저장 — 고친 값만 */
  setRule: (companyId: number, patch: Partial<OpRule>, by: string, base?: OpRule) => void;
  /** 날짜 지정 — null 이면 요일 설정대로. 'OFF' 그날 OFF · 'HH:MM~HH:MM' 그날 운전 시간. 요일 설정과 같은 값(auto)이면 지정을 지운다 */
  setDay: (companyId: number, date: string, value: DayOverride | null, auto: DayOverride, by: string, base?: OpRule) => void;
}

/** 기업 일정 — 기업이 고친 값 위로, 나머지는 관리자 기본값(관리 › 에너지 설정) */
export const scheduleOf = (s: Pick<OpScheduleState, 'schedules'>, companyId: number, base: OpRule = OP_RULE_DEFAULT): ResolvedSchedule => {
  const own = s.schedules[companyId];
  const picked = Object.fromEntries(Object.entries(own ?? {}).filter(([k, v]) => k !== 'overrides' && v !== undefined));
  return { ...base, ...picked, overrides: own?.overrides ?? {} };
};

export const useOpScheduleStore = create<OpScheduleState>()(
  persist(
    (set, get) => {
      const log = (l: Omit<RemoteLog, 'id' | 'at'>) => {
        const id = get().logs.reduce((m, x) => Math.max(m, x.id), 0) + 1;
        return [{ ...l, id, at: nowIso() }, ...get().logs].slice(0, 200);
      };
      const own = (companyId: number): CompanySchedule => get().schedules[companyId] ?? { overrides: {} };
      return {
        version: SEED_VERSION,
        schedules: SEED_SCHEDULES,
        logs: [],
        setRule: (companyId, patch, by) => {
          const note = [patch.week ? `요일별 운전 ${weekText(patch.week)}` : '', patch.holidayOff !== undefined ? `공휴일 ${patch.holidayOff ? 'OFF' : '운전'}` : '']
            .filter(Boolean)
            .join(' · ');
          set({
            schedules: { ...get().schedules, [companyId]: { ...own(companyId), ...patch } },
            logs: log({ companyId, action: patch.holidayOff === false ? 'ON' : 'OFF', how: '일정 변경', by, note }),
          });
        },
        setDay: (companyId, date, value, auto, by) => {
          const cur = own(companyId);
          const overrides = { ...cur.overrides };
          if (value === null || value === auto) delete overrides[date];
          else overrides[date] = value;
          set({
            schedules: { ...get().schedules, [companyId]: { ...cur, overrides } },
            logs: log({ companyId, action: value === 'OFF' ? 'OFF' : 'ON', how: '일정 변경', by, note: `${date} ${value ?? '요일 설정대로'}` }),
          });
        },
      };
    },
    {
      name: 'ulsan-op-schedule-poc',
      storage: createJSONStorage(() => ssrSafeStorage),
      skipHydration: true,
      partialize: (s) => ({ version: s.version, schedules: s.schedules, logs: s.logs }),
      merge: (persisted, current) => {
        const p = persisted as Partial<OpScheduleState> | undefined;
        if (!p || p.version !== SEED_VERSION) return current;
        return { ...current, ...p };
      },
    },
  ),
);

export function useHydrateOpSchedule() {
  useEffect(() => {
    void useOpScheduleStore.persist.rehydrate();
  }, []);
}
