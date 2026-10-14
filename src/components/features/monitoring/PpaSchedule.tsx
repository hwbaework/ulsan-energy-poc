'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SectionCard } from '@/components/features';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { getPersona, usePersonaOverride } from '@/lib/persona';
import { useHydrateTradingPoc, useTradingPocStore } from '@/stores/useTradingPocStore';
import { scheduleOf, useHydrateOpSchedule, useOpScheduleStore } from '@/stores/useOpScheduleStore';
import { useEnergySettings, useHolidays } from '@/hooks/common/useSettings';
import {
  WEEKDAY,
  WEEK_ORDER,
  dayStatus,
  holidayMap,
  isManual,
  monthStatus,
  offAt,
  opRuleOf,
  opYear,
  runOfOverride,
  weekOf,
  weekText,
  weekdayOf,
  type DayOverride,
  type DayStatus,
  type WeekDayRun,
} from '@/lib/op-calendar';

/**
 * PPA 운전 일정 — 요일별 운전 시간(월 ~ 일, 켜는 시각 ~ 끄는 시각) + 공휴일 OFF + 날짜별 지정(그날 OFF · 그날 운전 시간).
 * 쉬는 날 만든 전기는 PPA 로 팔 곳이 없어(돈이 안 됨) 끈다. 자가소비는 365일 그대로.
 * 고치는 건 발전사업자만(설정 › 설정, 자기 발전소). 관리자는 기본값(관리 › 에너지 설정)만 정한다. 전기사용자는 없음.
 * 대시보드 · 발전소 상세는 같은 일정으로 상태만 본다(조작 없음).
 */

const pad = (n: number) => String(n).padStart(2, '0');
// 오늘 — 브라우저 현지 날짜(UTC 로 하면 오전 9시 전엔 어제가 된다)
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
/** 지금 시각 HH:MM */
const nowHHMM = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** PPA 기업 — control: 끄고 켜는 발전사업자 자기 발전소(공급하는 곳 · 자기 회사 PPA 발전소, 박발전 = 한일튜브)만.
 *  view: 거기에 관리자 전체(조회만). 전기사용자는 둘 다 없음 */
export function usePpaCompanies(scope: 'control' | 'view' = 'control') {
  useHydrateTradingPoc();
  const contracts = useTradingPocStore((s) => s.contracts);
  const user = useAuthStore((s) => s.user);
  const override = usePersonaOverride((s) => s.override);
  const persona = override ?? getPersona(user);
  const companyId = user?.companyId ?? 0;
  return useMemo(() => {
    const ppa = contracts.filter((c) => c.kind === 'ONSITE' && c.status === 'ACTIVE');
    const mine =
      persona === 'generator'
        ? ppa.filter((c) => c.generatorCompanyId === companyId || c.consumerCompanyId === companyId)
        : persona === 'admin' && scope === 'view'
          ? ppa
          : [];
    return [...new Map(mine.map((c) => [c.consumerCompanyId, { id: c.consumerCompanyId, name: c.consumerCompanyName, plant: c.plantName, plantId: c.plantId }])).values()];
  }, [contracts, persona, companyId, scope]);
}

const by = () => useAuthStore.getState().user?.name ?? '사용자';

/** OFF 사유 — '수동' · '주말' · '공휴일' · '수요일'(운전 안 하는 평일) */
const offReason = (d: DayStatus) =>
  d.reason === '수동 OFF' ? '수동' : d.reason === '요일 OFF' ? `${WEEKDAY[weekdayOf(d.date)]}요일` : d.reason;
/** 날짜 하나의 글자 — 운전 시간 또는 OFF(사유) */
const dayText = (d: DayStatus) => (d.run ? `${d.run.from}~${d.run.to}` : `OFF · ${offReason(d)}`);
/** 그날을 요일 설정대로 두면 어떤 지정과 같은지 — 같은 값을 고르면 지정을 지운다 */
const autoKeyOf = (d: DayStatus): DayOverride => (d.run ? `${d.run.from}~${d.run.to}` : 'OFF');

type DayMode = 'auto' | 'OFF' | 'RUN';
const TIME_INPUT =
  'h-9 w-28 rounded-md bg-white/[0.04] px-2 text-sm text-white tabular-nums ring-1 ring-white/[0.08] [color-scheme:dark] focus:outline-none focus:ring-primary/60 disabled:opacity-40';

/** 운전 일정 카드(설정 › 설정) — 요일별 운전 시간 · 공휴일 OFF · 해 요약 · 달력(누르면 그날 지정) */
export function PpaScheduleCard({ companyId: fixed }: { companyId?: number }) {
  useHydrateOpSchedule();
  // 바로 반영하지 않는다 — 요일표 저장 · 공휴일 · 날짜 지정 전부 확인을 거친다
  const [pendingChange, setPendingChange] = useState<{ title: string; text: string; run: () => void } | null>(null);
  const [dayEdit, setDayEdit] = useState<{ date: string; auto: DayStatus; mode: DayMode; from: string; to: string } | null>(null);
  // 요일표 고치는 중 — 저장 전까지는 화면에만
  const [draft, setDraft] = useState<WeekDayRun[] | null>(null);
  const companies = usePpaCompanies();
  const [pick, setPick] = useState<number | null>(null);
  const companyId = fixed ?? pick ?? companies[0]?.id;
  const now = today();
  const [ym, setYm] = useState({ y: Number(now.slice(0, 4)), m: Number(now.slice(5, 7)) });
  const { data: hol } = useHolidays(ym.y);
  const holidays = useMemo(() => holidayMap(hol), [hol]);
  const store = useOpScheduleStore();
  const { data: es } = useEnergySettings();
  const base = opRuleOf(es);
  if (!companyId) return null;
  const sch = scheduleOf(store, companyId, base);
  const saved = weekOf(sch);
  const week = draft ?? saved;
  const view = { ...sch, week }; // 고치는 중이면 달력 · 가동일도 그 값으로 미리 보기
  const days = monthStatus(ym.y, ym.m, holidays, view, sch.overrides);
  const yr = opYear(ym.y, holidays, view, sch.overrides);
  const lead = weekdayOf(days[0]!.date);
  const move = (d: number) => setYm(({ y, m }) => (m + d < 1 ? { y: y - 1, m: 12 } : m + d > 12 ? { y: y + 1, m: 1 } : { y, m: m + d }));
  const manual = yr.months.reduce((a, x) => a + x.manualOff + x.manualOn + x.manualTime, 0);
  const weekBad = week.some((r) => r.on && (!r.from || !r.to || r.from >= r.to));
  const setDay = (wd: number, patch: Partial<WeekDayRun>) => setDraft(week.map((r, i) => (i === wd ? { ...r, ...patch } : r)));
  const openDay = (d: DayStatus) => {
    const ov = sch.overrides[d.date];
    const run = runOfOverride(ov);
    const auto = dayStatus(d.date, holidays, view);
    const wk = week[weekdayOf(d.date)]!;
    setDayEdit({
      date: d.date,
      auto,
      mode: ov === 'OFF' ? 'OFF' : run || ov === 'ON' ? 'RUN' : 'auto',
      from: run?.from ?? wk.from ?? base.onTime ?? '10:00',
      to: run?.to ?? wk.to ?? base.offStart ?? '17:00',
    });
  };
  const dayValid = !!dayEdit && (dayEdit.mode !== 'RUN' || (!!dayEdit.from && !!dayEdit.to && dayEdit.from < dayEdit.to));

  return (
    <SectionCard
      title="PPA 운전 일정"
      actions={
        <div className="flex items-center gap-2">
          {draft && (
            <>
              <Button size="sm" variant="cancel" onClick={() => setDraft(null)}>
                취소
              </Button>
              <Button
                size="sm"
                disabled={weekBad}
                onClick={() =>
                  setPendingChange({
                    title: '요일별 운전 저장',
                    text: `요일별 운전을 저장합니다. ${weekText(week)}. 대시보드 · 가동일이 이 시간으로 바뀝니다.`,
                    run: () => {
                      store.setRule(companyId, { week }, by(), base);
                      setDraft(null);
                    },
                  })
                }
              >
                저장
              </Button>
            </>
          )}
          {!fixed && companies.length > 1 && (
            <div className="w-48">
              <Select
                options={companies.map((c) => ({ value: String(c.id), label: c.plant }))}
                value={String(companyId)}
                onChange={(e) => {
                  setPick(Number(e.target.value));
                  setDraft(null);
                }}
              />
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* 요일별 운전 — 월 ~ 일, 운전하는 날 · 켜는 시각 · 끄는 시각 */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-white">요일별 운전</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400">
                  <th className="py-1.5 text-left font-medium">요일</th>
                  <th className="py-1.5 text-left font-medium">운전</th>
                  <th className="py-1.5 text-left font-medium">켜는 시각</th>
                  <th className="py-1.5 text-left font-medium">끄는 시각</th>
                </tr>
              </thead>
              <tbody>
                {WEEK_ORDER.map((wd) => {
                  const r = week[wd]!;
                  const bad = r.on && (!r.from || !r.to || r.from >= r.to);
                  return (
                    <tr key={wd} className="border-t border-white/[0.04]">
                      <td className={cn('py-1.5 font-medium', wd === 0 ? 'text-red-300' : wd === 6 ? 'text-sky-300' : 'text-slate-200')}>{WEEKDAY[wd]}</td>
                      <td className="py-1.5">
                        <label className="flex cursor-pointer items-center gap-2 text-slate-200">
                          <input type="checkbox" className="h-4 w-4 accent-primary" checked={r.on} onChange={(e) => setDay(wd, { on: e.target.checked })} />
                          {r.on ? '운전' : 'OFF'}
                        </label>
                      </td>
                      <td className="py-1.5">
                        <input
                          type="time"
                          aria-label={`${WEEKDAY[wd]}요일 켜는 시각`}
                          disabled={!r.on}
                          value={r.from}
                          onChange={(e) => setDay(wd, { from: e.target.value })}
                          className={cn(TIME_INPUT, bad && 'ring-red-500/70')}
                        />
                      </td>
                      <td className="py-1.5">
                        <input
                          type="time"
                          aria-label={`${WEEKDAY[wd]}요일 끄는 시각`}
                          disabled={!r.on}
                          value={r.to}
                          onChange={(e) => setDay(wd, { to: e.target.value })}
                          className={cn(TIME_INPUT, bad && 'ring-red-500/70')}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={sch.holidayOff}
                onChange={(e) => {
                  const v = e.target.checked;
                  setPendingChange({
                    title: `공휴일 OFF ${v ? '켜기' : '끄기'}`,
                    text: v ? '공휴일에는 운전하지 않습니다.' : '공휴일에도 요일 시간대로 운전합니다.',
                    run: () => store.setRule(companyId, { holidayOff: v }, by(), base),
                  });
                }}
              />
              공휴일 OFF
            </label>
          </div>

          {/* 해 요약 · 달마다 가동일 */}
          <div className="min-w-0 space-y-3">
            <p className="text-sm text-slate-300 tabular-nums">
              {ym.y}년 가동일 <b className="text-lg text-white">{yr.op}</b>일 / {yr.days}일 · OFF 주말 {yr.weekend}
              {yr.weekdayOff > 0 && ` · 평일 ${yr.weekdayOff}`} · 공휴일 {yr.holiday} · 수동 {manual}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-xs tabular-nums">
                <thead>
                  <tr className="text-slate-400">
                    <th className="py-1.5 pr-2 text-left font-medium">월</th>
                    {yr.months.map((x) => (
                      <th key={x.m} className={cn('py-1.5 text-right font-medium', x.m === ym.m && 'text-white')}>
                        {x.m}월
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-slate-200">
                    <td className="py-1.5 pr-2 text-slate-400">가동일</td>
                    {yr.months.map((x) => (
                      <td key={x.m} className={cn('py-1.5 text-right', x.m === ym.m && 'font-semibold text-white')}>
                        <button type="button" onClick={() => setYm({ y: ym.y, m: x.m })} className="hover:underline">
                          {x.op}
                        </button>
                      </td>
                    ))}
                  </tr>
                  <tr className="text-slate-400">
                    <td className="py-1.5 pr-2">OFF</td>
                    {yr.months.map((x) => (
                      <td key={x.m} className="py-1.5 text-right">
                        {x.days - x.op}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 달력 — 날마다 운전 시간 또는 OFF. 누르면 그날만 지정(그날 OFF · 그날 운전 시간) */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Button size="sm" variant="secondary" aria-label="전월" onClick={() => move(-1)}>
              <ChevronLeft size={14} />
            </Button>
            <span className="min-w-[90px] text-center text-sm font-semibold text-white tabular-nums">{`${ym.y}-${pad(ym.m)}`}</span>
            <Button size="sm" variant="secondary" aria-label="익월" onClick={() => move(1)}>
              <ChevronRight size={14} />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-xs">
            {WEEKDAY.map((w, i) => (
              <div key={w} className={cn('py-1 text-center', i === 0 ? 'text-red-300' : i === 6 ? 'text-sky-300' : 'text-slate-400')}>
                {w}
              </div>
            ))}
            {Array.from({ length: lead }, (_, k) => (
              <div key={`b${k}`} />
            ))}
            {days.map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => openDay(d)}
                className={cn(
                  'min-h-[62px] rounded-md px-1.5 py-1 text-left ring-1 transition-colors',
                  d.on ? 'bg-white/[0.04] ring-white/[0.08] hover:bg-white/[0.08]' : 'bg-black/30 ring-white/[0.04] hover:bg-white/[0.06]',
                  isManual(d) && 'ring-amber-400/60',
                  d.date === now && 'ring-2 ring-primary/70',
                )}
              >
                <span className={cn('flex items-center justify-between tabular-nums', d.on ? 'text-white' : 'text-slate-500')}>
                  {Number(d.date.slice(8))}
                  {isManual(d) && <span className="rounded bg-amber-500/20 px-1 text-[10px] text-amber-200">수동</span>}
                </span>
                <span className={cn('block text-[11px] tabular-nums', d.on ? 'text-emerald-200' : 'text-slate-500')}>{dayText(d)}</span>
                {d.holiday && <span className="block truncate text-[10px] text-slate-500">{d.holiday}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 확인 — 요일표 저장 · 공휴일 OFF */}
      <Modal
        open={pendingChange !== null}
        onClose={() => setPendingChange(null)}
        title={pendingChange?.title ?? ''}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="cancel" onClick={() => setPendingChange(null)}>
              취소
            </Button>
            <Button
              onClick={() => {
                pendingChange?.run();
                setPendingChange(null);
              }}
            >
              적용
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-200">{pendingChange?.text}</p>
      </Modal>

      {/* 날짜 지정 — 요일 설정대로 · 그날 OFF · 그날 운전 시간. 적용을 눌러야 반영 */}
      <Modal
        open={dayEdit !== null}
        onClose={() => setDayEdit(null)}
        title={dayEdit ? `${dayEdit.date} (${WEEKDAY[weekdayOf(dayEdit.date)]}) 운전` : ''}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="cancel" onClick={() => setDayEdit(null)}>
              취소
            </Button>
            <Button
              disabled={!dayValid}
              onClick={() => {
                if (!dayEdit) return;
                const v: DayOverride | null = dayEdit.mode === 'auto' ? null : dayEdit.mode === 'OFF' ? 'OFF' : `${dayEdit.from}~${dayEdit.to}`;
                store.setDay(companyId, dayEdit.date, v, autoKeyOf(dayEdit.auto), by(), base);
                setDayEdit(null);
              }}
            >
              적용
            </Button>
          </div>
        }
      >
        {dayEdit && (
          <div className="space-y-2.5 text-sm text-slate-200">
            {(
              [
                ['auto', `요일 설정대로 (${dayText(dayEdit.auto)})`],
                ['OFF', '그날 OFF'],
                ['RUN', '그날 운전 시간 지정'],
              ] as const
            ).map(([m, label]) => (
              <label key={m} className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="day-mode" className="h-4 w-4 accent-primary" checked={dayEdit.mode === m} onChange={() => setDayEdit({ ...dayEdit, mode: m })} />
                {label}
              </label>
            ))}
            {dayEdit.mode === 'RUN' && (
              <div className="flex items-center gap-2 pl-6">
                <input type="time" aria-label="켜는 시각" value={dayEdit.from} onChange={(e) => setDayEdit({ ...dayEdit, from: e.target.value })} className={TIME_INPUT} />
                <span className="text-slate-400">~</span>
                <input type="time" aria-label="끄는 시각" value={dayEdit.to} onChange={(e) => setDayEdit({ ...dayEdit, to: e.target.value })} className={TIME_INPUT} />
              </div>
            )}
          </div>
        )}
      </Modal>
    </SectionCard>
  );
}

/** 발전소 상세(PPA) — 누구나 보는 운전 안내. 지금 상태 · 금일 · 요일별 운전, 조작 없음 */
export function PpaOpInfo({ companyId }: { companyId: number }) {
  useHydrateOpSchedule();
  const now = today();
  const { data: hol } = useHolidays(Number(now.slice(0, 4)));
  const holidays = useMemo(() => holidayMap(hol), [hol]);
  const store = useOpScheduleStore();
  const { data: es } = useEnergySettings();
  const companies = usePpaCompanies();
  if (companies.some((c) => c.id === companyId)) return null; // 발전사업자는 대시보드 · 설정에서 본다
  const sch = scheduleOf(store, companyId, opRuleOf(es));
  const plan = dayStatus(now, holidays, sch, sch.overrides);
  const on = !offAt(plan, nowHHMM());
  return (
    <SectionCard title="운전">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-slate-400">금일</p>
          <p className={cn('mt-1 text-xl font-bold', on ? 'text-emerald-300' : 'text-red-300')}>인버터 {on ? 'ON' : 'OFF'}</p>
          <p className="mt-0.5 text-sm text-slate-300 tabular-nums">
            {plan.run ? `운전 ${plan.run.from}~${plan.run.to}` : `운전 없음 · ${offReason(plan)}`}
            {isManual(plan) && plan.run ? ' · 수동' : ''}
            {plan.holiday ? ` · ${plan.holiday}` : ''}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">요일별 운전</p>
          <p className="mt-1 text-sm text-slate-200 tabular-nums">
            {weekText(weekOf(sch))}
            {sch.holidayOff ? ' · 공휴일 OFF' : ''}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

/** 발전소 발전·공급 제목 옆(관리자 · 발전사업자) — [인버터 ON/OFF · 수동/설정] + 운전 시간 글자. 조회만(고치는 건 설정 › 설정) */
export function PpaOpInline({ plantId }: { plantId: number }) {
  useHydrateOpSchedule();
  useHydrateTradingPoc();
  // 관리자 · 발전사업자만 — 전기사용자는 운전을 안 본다
  const user = useAuthStore((s) => s.user);
  const override = usePersonaOverride((s) => s.override);
  const persona = override ?? getPersona(user);
  const companyId = useTradingPocStore((s) => s.contracts.find((c) => c.kind === 'ONSITE' && c.status === 'ACTIVE' && c.plantId === plantId)?.consumerCompanyId);
  const now = today();
  const { data: holNow } = useHolidays(Number(now.slice(0, 4)));
  const holidaysNow = useMemo(() => holidayMap(holNow), [holNow]);
  const store = useOpScheduleStore();
  const { data: es } = useEnergySettings();
  if (companyId === undefined || (persona !== 'admin' && persona !== 'generator')) return null;
  const sch = scheduleOf(store, companyId, opRuleOf(es));
  const plan = dayStatus(now, holidaysNow, sch, sch.overrides);
  const isOn = !offAt(plan, nowHHMM());
  const manual = isManual(plan);
  const opText = plan.run ? `운전 ${plan.run.from}~${plan.run.to}${manual ? ' · 수동' : ''}` : `운전 없음 · ${offReason(plan)}`;
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm ring-1',
          isOn ? 'text-emerald-100 ring-emerald-400/70 bg-emerald-500/10' : 'text-red-100 ring-red-400/70 bg-red-500/10',
        )}
      >
        <span className={cn('h-2 w-2 rounded-full', isOn ? 'bg-emerald-400' : 'bg-red-400')} />
        인버터 <b className={isOn ? 'text-emerald-300' : 'text-red-300'}>{isOn ? 'ON' : 'OFF'}</b>
        <span className={isOn ? 'text-emerald-200/80' : 'text-red-200/80'}>· {manual ? '수동' : '설정'}</span>
      </span>
      <span className="text-sm tabular-nums text-slate-400">{opText}</span>
    </span>
  );
}

/**
 * 대시보드 시간 그래프 — 그 PPA 발전소의 그날 일정(요일 운전 시간 · 공휴일 · 날짜 지정)으로 시각마다 꺼져 있는지.
 * 상태 한 줄(PpaOpInline)과 같은 일정을 쓴다. PPA 계약이 없는 발전소면 null
 */
export function usePpaOffAt(plantId: number | undefined, date: string) {
  useHydrateOpSchedule();
  useHydrateTradingPoc();
  const companyId = useTradingPocStore(
    (s) => s.contracts.find((c) => c.kind === 'ONSITE' && c.status === 'ACTIVE' && c.plantId === plantId)?.consumerCompanyId,
  );
  const { data: hol } = useHolidays(Number(date.slice(0, 4)));
  const holidays = useMemo(() => holidayMap(hol), [hol]);
  const store = useOpScheduleStore();
  const { data: es } = useEnergySettings();
  return useMemo(() => {
    if (companyId === undefined) return null;
    const sch = scheduleOf(store, companyId, opRuleOf(es));
    const d = dayStatus(date, holidays, sch, sch.overrides);
    return (hhmm: string) => offAt(d, hhmm);
  }, [companyId, es, store, date, holidays]);
}
