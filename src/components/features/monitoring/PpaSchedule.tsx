'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SectionCard } from '@/components/features';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { TABLE, TABLE_HEAD_ROW, TABLE_ROW, TABLE_TD, TABLE_TH } from '@/components/features/DataList';
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
  'h-9 w-[150px] shrink-0 rounded-md bg-white/[0.04] px-2.5 text-sm text-white tabular-nums ring-1 ring-white/[0.08] [color-scheme:dark] focus:outline-none focus:ring-primary/60 disabled:opacity-40';

/** 달마다 운전 — ON(가동일) · OFF 일수만(사유는 달력에서, 2026-10-15). 달을 누르면 그 달 달력 */
function OpMonthTable({ yr, sel, onPick }: { yr: ReturnType<typeof opYear>; sel: number; onPick: (m: number) => void }) {
  const rows: [string, (x: ReturnType<typeof opYear>['months'][number]) => number, string][] = [
    ['ON', (x) => x.op, 'text-emerald-200'],
    ['OFF', (x) => x.days - x.op, 'text-red-300'],
  ];
  return (
    <div className="overflow-x-auto">
      <table className={cn(TABLE, 'min-w-[720px] tabular-nums')}>
        <thead>
          <tr className={TABLE_HEAD_ROW}>
            <th className={cn(TABLE_TH, 'px-3')}>월</th>
            {yr.months.map((x) => (
              <th key={x.m} className={cn(TABLE_TH, 'px-3 text-right', x.m === sel && 'text-white')}>
                <button type="button" onClick={() => onPick(x.m)} className="hover:underline">
                  {x.m}월
                </button>
              </th>
            ))}
            <th className={cn(TABLE_TH, 'px-3 text-right')}>합계</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, f, cls]) => (
            <tr key={label} className={TABLE_ROW}>
              <td className={cn(TABLE_TD, 'px-3 whitespace-nowrap', cls)}>{label}</td>
              {yr.months.map((x) => (
                <td key={x.m} className={cn(TABLE_TD, 'px-3 text-right', cls, x.m === sel && 'font-semibold')}>
                  {f(x) || ''}
                </td>
              ))}
              <td className={cn(TABLE_TD, 'px-3 text-right font-semibold', cls)}>{yr.months.reduce((a, x) => a + f(x), 0) || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 한 달 달력 — 날마다 운전 시간 또는 OFF(사유), 수동 표시. onDay 가 있으면 눌러서 그 날짜 지정(설정), 없으면 보기만 */
function OpCalendar({
  ym,
  days,
  now,
  onMove,
  onDay,
}: {
  ym: { y: number; m: number };
  days: DayStatus[];
  now: string;
  onMove: (d: number) => void;
  onDay?: (d: DayStatus) => void;
}) {
  const lead = days.length ? weekdayOf(days[0]!.date) : 0;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Button size="sm" variant="secondary" aria-label="전월" onClick={() => onMove(-1)}>
          <ChevronLeft size={14} />
        </Button>
        <span className="min-w-[90px] text-center text-sm font-semibold text-white tabular-nums">{`${ym.y}-${pad(ym.m)}`}</span>
        <Button size="sm" variant="secondary" aria-label="익월" onClick={() => onMove(1)}>
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
        {days.map((d) => {
          const cls = cn(
            'min-h-[62px] rounded-md px-1.5 py-1 text-left ring-1 transition-colors',
            d.on ? 'bg-white/[0.04] ring-white/[0.08]' : 'bg-black/30 ring-white/[0.04]',
            onDay && (d.on ? 'hover:bg-white/[0.08]' : 'hover:bg-white/[0.06]'),
            isManual(d) && 'ring-amber-400/60',
            d.date === now && 'ring-2 ring-primary/70',
          );
          const body = (
            <>
              <span className={cn('flex items-center justify-between tabular-nums', d.on ? 'text-white' : 'text-slate-500')}>
                {Number(d.date.slice(8))}
                {isManual(d) && <span className="rounded bg-amber-500/20 px-1 text-[10px] text-amber-200">수동</span>}
              </span>
              <span className={cn('block text-[11px] tabular-nums', d.on ? 'text-emerald-200' : 'text-slate-500')}>{dayText(d)}</span>
              {d.holiday && <span className="block truncate text-[10px] text-slate-500">{d.holiday}</span>}
            </>
          );
          return onDay ? (
            <button key={d.date} type="button" onClick={() => onDay(d)} className={cls}>
              {body}
            </button>
          ) : (
            <div key={d.date} className={cls}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 운전 일정 카드(설정 › 설정) — 요일별 운전 시간 · 공휴일 OFF · 해 요약 · 달력(누르면 그날 지정) */
/** readOnly — 소속 멤버(기업관리자 아님)는 보기만 */
export function PpaScheduleCard({ companyId: fixed, readOnly }: { companyId?: number; readOnly?: boolean }) {
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
      title={readOnly ? 'PPA 운전 일정 · 보기' : 'PPA 운전 일정'}
      actions={
        <div className="flex items-center gap-2">
          {draft && !readOnly && (
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
        <div className="grid gap-6 lg:grid-cols-[minmax(0,500px)_1fr]">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-white">요일별 운전</h4>
            <table className={TABLE}>
              <thead>
                <tr className={TABLE_HEAD_ROW}>
                  <th className={TABLE_TH}>요일</th>
                  <th className={TABLE_TH}>운전</th>
                  <th className={TABLE_TH}>켜는 시각</th>
                  <th className={TABLE_TH}>끄는 시각</th>
                </tr>
              </thead>
              <tbody>
                {WEEK_ORDER.map((wd) => {
                  const r = week[wd]!;
                  const bad = r.on && (!r.from || !r.to || r.from >= r.to);
                  return (
                    <tr key={wd} className={TABLE_ROW}>
                      <td className={cn(TABLE_TD, 'py-2 font-medium', wd === 0 ? 'text-red-300' : wd === 6 ? 'text-sky-300' : 'text-white')}>{WEEKDAY[wd]}</td>
                      <td className={cn(TABLE_TD, 'py-2')}>
                        <label className="flex cursor-pointer items-center gap-2 text-slate-200">
                          <input type="checkbox" className="h-4 w-4 accent-primary disabled:opacity-60" disabled={readOnly} checked={r.on} onChange={(e) => setDay(wd, { on: e.target.checked })} />
                          {r.on ? '운전' : 'OFF'}
                        </label>
                      </td>
                      <td className={cn(TABLE_TD, 'py-2')}>
                        <input
                          type="time"
                          aria-label={`${WEEKDAY[wd]}요일 켜는 시각`}
                          disabled={!r.on || readOnly}
                          value={r.from}
                          onChange={(e) => setDay(wd, { from: e.target.value })}
                          className={cn(TIME_INPUT, bad && 'ring-red-500/70')}
                        />
                      </td>
                      <td className={cn(TABLE_TD, 'py-2')}>
                        <input
                          type="time"
                          aria-label={`${WEEKDAY[wd]}요일 끄는 시각`}
                          disabled={!r.on || readOnly}
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
                className="h-4 w-4 accent-primary disabled:opacity-60"
                disabled={readOnly}
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
            <OpMonthTable yr={yr} sel={ym.m} onPick={(m) => setYm({ y: ym.y, m })} />
          </div>
        </div>

        {/* 달력 — 날마다 운전 시간 또는 OFF. 누르면 그 날짜만 지정(OFF · 시간 지정) */}
        <OpCalendar ym={ym} days={days} now={now} onMove={move} onDay={readOnly ? undefined : openDay} />
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

      {/* 날짜 지정 — 요일 설정대로 · OFF · 시간 지정(시각 칸은 처음부터 보이고, 고치면 시간 지정으로). 적용을 눌러야 반영 */}
      <Modal
        open={dayEdit !== null}
        onClose={() => setDayEdit(null)}
        title={dayEdit ? `${dayEdit.date} (${WEEKDAY[weekdayOf(dayEdit.date)]}) 운전` : ''}
        size="md"
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
          <div className="space-y-2 text-sm text-slate-200">
            {(
              [
                ['auto', '요일 설정대로'],
                ['OFF', 'OFF'],
                ['RUN', '시간 지정'],
              ] as const
            ).map(([m, label]) => (
              <label
                key={m}
                className={cn(
                  'flex cursor-pointer flex-wrap items-center gap-3 rounded-lg px-3 py-2.5 ring-1 transition-colors',
                  dayEdit.mode === m ? 'bg-primary/10 ring-primary/60' : 'bg-white/[0.02] ring-white/[0.08] hover:bg-white/[0.05]',
                )}
              >
                <input type="radio" name="day-mode" className="h-4 w-4 accent-primary" checked={dayEdit.mode === m} onChange={() => setDayEdit({ ...dayEdit, mode: m })} />
                <span className="w-24 font-medium text-white">{label}</span>
                {m === 'auto' && (
                  <span className="tabular-nums text-slate-400">
                    {WEEKDAY[weekdayOf(dayEdit.date)]}요일 · {dayText(dayEdit.auto)}
                  </span>
                )}
                {m === 'OFF' && <span className="text-slate-400">종일 운전 안 함</span>}
                {m === 'RUN' && (
                  <span className="flex items-center gap-2">
                    <input
                      type="time"
                      aria-label="켜는 시각"
                      value={dayEdit.from}
                      onChange={(e) => setDayEdit({ ...dayEdit, mode: 'RUN', from: e.target.value })}
                      className={TIME_INPUT}
                    />
                    <span className="text-slate-400">~</span>
                    <input
                      type="time"
                      aria-label="끄는 시각"
                      value={dayEdit.to}
                      onChange={(e) => setDayEdit({ ...dayEdit, mode: 'RUN', to: e.target.value })}
                      className={TIME_INPUT}
                    />
                  </span>
                )}
              </label>
            ))}
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
  // 한 달 달력 · 달마다 ON / OFF — 고른 달(기본 금월)
  const [ym, setYm] = useState({ y: Number(now.slice(0, 4)), m: Number(now.slice(5, 7)) });
  const { data: holYm } = useHolidays(ym.y);
  const holidaysYm = useMemo(() => holidayMap(holYm), [holYm]);
  const store = useOpScheduleStore();
  const { data: es } = useEnergySettings();
  const companies = usePpaCompanies();
  const user = useAuthStore((s) => s.user);
  const override = usePersonaOverride((s) => s.override);
  const isAdmin = (override ?? getPersona(user)) === 'admin';
  if (companies.some((c) => c.id === companyId)) return null; // 발전사업자는 대시보드 · 설정에서 본다
  const sch = scheduleOf(store, companyId, opRuleOf(es));
  const plan = dayStatus(now, holidays, sch, sch.overrides);
  const on = !offAt(plan, nowHHMM());
  const days = monthStatus(ym.y, ym.m, holidaysYm, sch, sch.overrides);
  const yr = opYear(ym.y, holidaysYm, sch, sch.overrides);
  const move = (d: number) => setYm(({ y, m }) => (m + d < 1 ? { y: y - 1, m: 12 } : m + d > 12 ? { y: y + 1, m: 1 } : { y, m: m + d }));
  // 관리자 — 발전사업자가 날짜별로 따로 정한 날(오늘 이후, 날짜순). 보기만
  const picked = Object.entries(sch.overrides)
    .filter(([d]) => d >= now)
    .sort(([a], [b]) => a.localeCompare(b));
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
      {isAdmin && (
        <div className="mt-5 border-t border-white/[0.06] pt-4">
          <h4 className="mb-2 text-sm font-semibold text-white">{`날짜 지정 (${picked.length})`}</h4>
          {picked.length === 0 ? (
            <p className="py-3 text-sm text-slate-400">지정 없음</p>
          ) : (
            <table className={cn(TABLE, 'max-w-xl tabular-nums')}>
              <thead>
                <tr className={TABLE_HEAD_ROW}>
                  <th className={TABLE_TH}>날짜</th>
                  <th className={TABLE_TH}>요일</th>
                  <th className={TABLE_TH}>운전</th>
                </tr>
              </thead>
              <tbody>
                {picked.map(([d, v]) => {
                  const run = runOfOverride(v);
                  const wd = weekdayOf(d);
                  return (
                    <tr key={d} className={TABLE_ROW}>
                      <td className={TABLE_TD}>{d}</td>
                      <td className={cn(TABLE_TD, wd === 0 ? 'text-red-300' : wd === 6 ? 'text-sky-300' : 'text-white')}>{WEEKDAY[wd]}</td>
                      <td className={cn(TABLE_TD, run ? 'text-emerald-200' : 'text-red-300')}>
                        {run ? `${run.from}~${run.to}` : v === 'ON' ? '요일 시간대로 운전' : 'OFF'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
      {/* 달마다 ON / OFF · 한 달 달력 — 보기만(고치는 건 발전사업자 설정 › 설정) */}
      <div className="mt-5 space-y-4 border-t border-white/[0.06] pt-4">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-white">월별 운전</h4>
          <OpMonthTable yr={yr} sel={ym.m} onPick={(m) => setYm({ y: ym.y, m })} />
        </div>
        <OpCalendar ym={ym} days={days} now={now} onMove={move} />
      </div>
    </SectionCard>
  );
}

/**
 * 지금 그 PPA 발전소 인버터 — 켜져 있는지 · 수동으로 정한 날인지 · 운전 글자. 대시보드 · 발전소 상세 · 관제 홈이 같은 답을 쓴다.
 * 관리자 · 발전사업자만(전기사용자는 운전을 안 본다). PPA 계약이 없는 발전소면 null
 */
export function usePpaOpNow(plantId: number | undefined) {
  useHydrateOpSchedule();
  useHydrateTradingPoc();
  const user = useAuthStore((s) => s.user);
  const override = usePersonaOverride((s) => s.override);
  const persona = override ?? getPersona(user);
  const companyId = useTradingPocStore((s) => s.contracts.find((c) => c.kind === 'ONSITE' && c.status === 'ACTIVE' && c.plantId === plantId)?.consumerCompanyId);
  const now = today();
  const { data: holNow } = useHolidays(Number(now.slice(0, 4)));
  const holidaysNow = useMemo(() => holidayMap(holNow), [holNow]);
  const store = useOpScheduleStore();
  const { data: es } = useEnergySettings();
  if (plantId === undefined || companyId === undefined || (persona !== 'admin' && persona !== 'generator')) return null;
  const sch = scheduleOf(store, companyId, opRuleOf(es));
  const plan = dayStatus(now, holidaysNow, sch, sch.overrides);
  const on = !offAt(plan, nowHHMM());
  const manual = isManual(plan);
  const opText = plan.run ? `운전 ${plan.run.from}~${plan.run.to}${manual ? ' · 수동' : ''}` : `운전 없음 · ${offReason(plan)}`;
  return { on, manual, opText };
}

/** [● 인버터 ON/OFF · 수동/설정] 테두리 박스 — compact 면 운전 글자 없이 박스만(목록 · 지도) */
export function PpaOpBadge({ plantId, compact }: { plantId: number | undefined; compact?: boolean }) {
  const op = usePpaOpNow(plantId);
  if (!op) return null;
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md ring-1',
          compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
          op.on ? 'text-emerald-100 ring-emerald-400/70 bg-emerald-500/10' : 'text-red-100 ring-red-400/70 bg-red-500/10',
        )}
      >
        <span className={cn('h-2 w-2 rounded-full', op.on ? 'bg-emerald-400' : 'bg-red-400')} />
        인버터 <b className={op.on ? 'text-emerald-300' : 'text-red-300'}>{op.on ? 'ON' : 'OFF'}</b>
        <span className={op.on ? 'text-emerald-200/80' : 'text-red-200/80'}>· {op.manual ? '수동' : '설정'}</span>
      </span>
      {!compact && <span className="whitespace-nowrap text-sm tabular-nums text-slate-400">{op.opText}</span>}
    </span>
  );
}

/** 발전소 발전·공급 제목 옆(관리자 · 발전사업자) — [인버터 ON/OFF · 수동/설정] + 운전 시간 글자. 조회만(고치는 건 설정 › 설정) */
export function PpaOpInline({ plantId }: { plantId: number }) {
  return <PpaOpBadge plantId={plantId} />;
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
