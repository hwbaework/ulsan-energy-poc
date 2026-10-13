import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ssrSafeStorage } from '@/lib/ssr-storage';
import { OP_RULE_DEFAULT, type DayOverride, type OpRule } from '@/lib/op-calendar';

/**
 * PPA 운전 일정 — 발전사업자가 자기 발전소(PPA 계약 기업)마다 쉬는 날 OFF 규칙 · 날짜별 수동 지정, 발전소마다 원격 ON / OFF 이력.
 * 쉬는 날은 자동 OFF, 다음 가동일 자동 ON. POC 는 브라우저에 저장
 */
export interface CompanySchedule extends OpRule {
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

const SEED_VERSION = 2; // 2 — 원격 ON / OFF 를 그날 일정(수동 지정)으로 합침
const nowIso = () => new Date().toISOString();

interface OpScheduleState {
  version: number;
  schedules: Record<number, CompanySchedule>;

  logs: RemoteLog[];
  setRule: (companyId: number, patch: Partial<OpRule>, by: string, base?: OpRule) => void;
  /** 날짜 지정 — null 이면 자동(설정대로). 하루 가동 · 하루 OFF · 시간 OFF('HH:MM~HH:MM'). 자동과 같으면 지정을 지운다 */
  setDay: (companyId: number, date: string, value: DayOverride | null, autoOn: boolean, by: string, base?: OpRule) => void;
  /** 날짜 누르기 — 자동 일정과 반대로 수동 지정, 이미 수동이면 자동으로 되돌린다 */
  toggleDay: (companyId: number, date: string, autoOn: boolean, by: string, base?: OpRule) => void;
  /** 원격 ON / OFF — 그날 일정에 바로 반영(자동과 같으면 수동 지정을 지운다). 운전 일정 · 대시보드 · 발전소 상세가 같은 값 */
  setRemote: (companyId: number, date: string, on: boolean, autoOn: boolean, by: string, base?: OpRule) => void;
}

/** 기업 일정 — 아직 안 고쳤으면 관리자 전체 기준(관리 › 에너지 설정 가동일)을 그대로 */
export const scheduleOf = (s: Pick<OpScheduleState, 'schedules'>, companyId: number, base: OpRule = OP_RULE_DEFAULT): CompanySchedule =>
  s.schedules[companyId] ?? { ...base, overrides: {} };

export const useOpScheduleStore = create<OpScheduleState>()(
  persist(
    (set, get) => {
      const log = (l: Omit<RemoteLog, 'id' | 'at'>) => {
        const id = get().logs.reduce((m, x) => Math.max(m, x.id), 0) + 1;
        return [{ ...l, id, at: nowIso() }, ...get().logs].slice(0, 200);
      };
      return {
        version: SEED_VERSION,
        schedules: {},
        logs: [],
        setRule: (companyId, patch, by, base) => {
          const cur = scheduleOf(get(), companyId, base);
          const note = [
            patch.weekendOff !== undefined ? `주말 ${patch.weekendOff ? 'OFF' : '가동'}` : '',
            patch.holidayOff !== undefined ? `공휴일 ${patch.holidayOff ? 'OFF' : '가동'}` : '',
          ].filter(Boolean).join(' · ');
          set({
            schedules: { ...get().schedules, [companyId]: { ...cur, ...patch } },
            logs: log({ companyId, action: patch.weekendOff === false || patch.holidayOff === false ? 'ON' : 'OFF', how: '일정 변경', by, note }),
          });
        },
        setDay: (companyId, date, value, autoOn, by, base) => {
          const cur = scheduleOf(get(), companyId, base);
          const overrides = { ...cur.overrides };
          const asAuto = value === null || (value === 'ON' && autoOn) || (value === 'OFF' && !autoOn);
          if (asAuto) delete overrides[date];
          else overrides[date] = value;
          const timeOff = value && value !== 'ON' && value !== 'OFF' ? value : '';
          set({
            schedules: { ...get().schedules, [companyId]: { ...cur, overrides } },
            logs: log({ companyId, action: value === 'ON' || (value === null && autoOn) ? 'ON' : 'OFF', how: '일정 변경', by, note: timeOff ? `${date} ${timeOff}` : date }),
          });
        },
        toggleDay: (companyId, date, autoOn, by, base) => {
          const cur = scheduleOf(get(), companyId, base);
          const overrides = { ...cur.overrides };
          let action: 'ON' | 'OFF';
          if (overrides[date]) {
            delete overrides[date];
            action = autoOn ? 'ON' : 'OFF';
          } else {
            overrides[date] = autoOn ? 'OFF' : 'ON';
            action = overrides[date]!;
          }
          set({
            schedules: { ...get().schedules, [companyId]: { ...cur, overrides } },
            logs: log({ companyId, action, how: '일정 변경', by, note: date }),
          });
        },
        setRemote: (companyId, date, on, autoOn, by, base) => {
          const cur = scheduleOf(get(), companyId, base);
          const overrides = { ...cur.overrides };
          if (on === autoOn) delete overrides[date];
          else overrides[date] = on ? 'ON' : 'OFF';
          set({
            schedules: { ...get().schedules, [companyId]: { ...cur, overrides } },
            logs: log({ companyId, action: on ? 'ON' : 'OFF', how: '원격', by, note: date }),
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
