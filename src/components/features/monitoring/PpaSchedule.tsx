'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Power } from 'lucide-react';
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
import { dayStatus, holidayMap, inOffWindow, inWindow, monthStatus, opRuleOf, opYear, timeOffOf, weekdayOf, type DayOverride, type DayStatus } from '@/lib/op-calendar';

/**
 * PPA 운전 일정 — 쉬는 날(주말 · 공휴일)은 인버터 자동 OFF, 다음 가동일 자동 ON.
 * 쉬는 날 만든 전기는 PPA 로 팔 곳이 없어(돈이 안 됨) 끈다. 자가소비는 365일 그대로.
 * 끄고 켜는 건 발전사업자만(자기 발전소). 관리자는 전체 기준(관리 › 에너지 설정 가동일 · 공휴일)만 정하고 운전은 안 한다. 전기사용자도 없음.
 * 고치는 곳은 설정 › 설정. 대시보드는 상태만 보고, 팝업으로 그 일정만 고친다. 발전소 상세(PPA)는 원격 ON / OFF(발전사업자) · 운전 안내(모두)
 */

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n: number) => String(n).padStart(2, '0');
// 오늘 — 브라우저 현지 날짜(UTC 로 하면 오전 9시 전엔 어제가 된다)
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

/** 날짜 하나의 상태 글자 — 색이 아닌 글자로 구분 */
const reasonText = (d: DayStatus) =>
  d.reason === '가동'
    ? '가동'
    : d.reason === '수동 ON'
      ? '가동 (수동)'
      : d.reason === '수동 OFF'
        ? 'OFF (수동)'
        : d.reason === '시간 OFF' && d.offWindow
          ? `가동 · ${d.offWindow.from}~${d.offWindow.to} OFF`
          : `OFF (${d.reason})`;
/** 지금 시각 HH:MM */
const nowHHMM = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** 지금 켜져 있는지 — 그날 가동이어도 시간 OFF 시간대 안이면 OFF */
const onNow = (d: DayStatus) => d.on && !(d.offWindow && inWindow(d.offWindow, nowHHMM()));

type DayMode = 'auto' | 'ON' | 'OFF' | 'TIME';

/** 운전 일정 카드 — 달력(누르면 그날 가동 / OFF 바꿈) + 해 요약 + 달마다 가동일 */
export function PpaScheduleCard({ companyId: fixed }: { companyId?: number }) {
  useHydrateOpSchedule();
  // 바로 반영하지 않는다 — 규칙 · 날짜 · 오늘 수동 전부 확인창을 거친다
  const [pendingChange, setPendingChange] = useState<{ title: string; text: string; run: () => void } | null>(null);
  // 날짜 지정 — 자동 · 하루 가동 · 하루 OFF · 시간 OFF(시작 ~ 끝)
  const [dayEdit, setDayEdit] = useState<{ date: string; auto: DayStatus; mode: DayMode; from: string; to: string } | null>(null);
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
  const days = monthStatus(ym.y, ym.m, holidays, sch, sch.overrides);
  const yr = opYear(ym.y, holidays, sch, sch.overrides);
  const lead = weekdayOf(days[0]!.date);
  const move = (d: number) => setYm(({ y, m }) => (m + d < 1 ? { y: y - 1, m: 12 } : m + d > 12 ? { y: y + 1, m: 1 } : { y, m: m + d }));
  const manual = yr.months.reduce((a, x) => a + x.manualOff + x.manualOn + x.manualTime, 0); // 수동으로 바꾼 날(OFF · ON · 시간 OFF)
  const openDay = (d: DayStatus) => {
    const ov = sch.overrides[d.date];
    const tw = timeOffOf(ov);
    setDayEdit({
      date: d.date,
      auto: dayStatus(d.date, holidays, sch),
      mode: tw ? 'TIME' : ov === 'ON' ? 'ON' : ov === 'OFF' ? 'OFF' : 'auto',
      from: tw?.from ?? '13:00',
      to: tw?.to ?? '18:00',
    });
  };
  const dayValid = !!dayEdit && (dayEdit.mode !== 'TIME' || (!!dayEdit.from && !!dayEdit.to && dayEdit.from !== dayEdit.to));

  return (
    <SectionCard
      title="PPA 운전 일정"
      actions={
        !fixed && companies.length > 1 ? (
          <div className="w-48">
            <Select options={companies.map((c) => ({ value: String(c.id), label: c.plant }))} value={String(companyId)} onChange={(e) => setPick(Number(e.target.value))} />
          </div>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {/* 규칙 + 해 요약 */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-5 text-sm text-slate-200">
            {(
              [
                ['weekendOff', '주말 OFF'],
                ['holidayOff', '공휴일 OFF'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={sch[k]}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setPendingChange({ title: `${label} ${v ? '켜기' : '끄기'}`, text: `${label}을 ${v ? '적용' : '해제'}합니다. 가동일이 바뀝니다.`, run: () => store.setRule(companyId, { [k]: v }, by(), base) });
                  }}
                />
                {label}
              </label>
            ))}
          </div>
          <p className="text-sm text-slate-300 tabular-nums">
            {ym.y}년 가동일 <b className="text-lg text-white">{yr.op}</b>일 / {yr.days}일 · OFF 주말 {yr.weekend} · 공휴일 {yr.holiday}
            {` · 수동 ${manual}`}
          </p>
        </div>

        {/* 달마다 가동일 */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs tabular-nums">
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

        {/* 달력 */}
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
            {WEEK.map((w) => (
              <div key={w} className="py-1 text-center text-slate-400">
                {w}
              </div>
            ))}
            {Array.from({ length: lead }, (_, k) => (
              <div key={`b${k}`} />
            ))}
            {days.map((d) => {
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => openDay(d)}
                  className={cn(
                    'min-h-[58px] rounded-md px-1.5 py-1 text-left ring-1 transition-colors',
                    d.on ? 'bg-white/[0.04] ring-white/[0.08] hover:bg-white/[0.08]' : 'bg-black/30 ring-white/[0.04] hover:bg-white/[0.06]',
                    d.date === now && 'ring-primary/70',
                  )}
                >
                  <span className={cn('block tabular-nums', d.on ? 'text-white' : 'text-slate-500')}>{Number(d.date.slice(8))}</span>
                  <span className={cn('block text-[11px]', d.on ? 'text-slate-200' : 'text-slate-500')}>{reasonText(d)}</span>
                  {d.holiday && <span className="block truncate text-[10px] text-slate-500">{d.holiday}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
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
      {/* 날짜 지정 — 하루 통째로 또는 그날 시간만 OFF. 적용을 눌러야 반영 */}
      <Modal
        open={dayEdit !== null}
        onClose={() => setDayEdit(null)}
        title={dayEdit ? `${dayEdit.date} (${WEEK[weekdayOf(dayEdit.date)]}) 운전` : ''}
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
                const v: DayOverride | null =
                  dayEdit.mode === 'auto' ? null : dayEdit.mode === 'TIME' ? `${dayEdit.from}~${dayEdit.to}` : dayEdit.mode;
                store.setDay(companyId, dayEdit.date, v, dayEdit.auto.on, by(), base);
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
                ['auto', `설정대로 (${reasonText(dayEdit.auto)})`],
                ['ON', '하루 가동'],
                ['OFF', '하루 OFF'],
                ['TIME', '시간 지정 OFF'],
              ] as const
            ).map(([m, label]) => (
              <label key={m} className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="day-mode" className="h-4 w-4 accent-primary" checked={dayEdit.mode === m} onChange={() => setDayEdit({ ...dayEdit, mode: m })} />
                {label}
              </label>
            ))}
            {dayEdit.mode === 'TIME' && (
              <div className="flex items-center gap-2 pl-6">
                <input
                  type="time"
                  aria-label="OFF 시작"
                  value={dayEdit.from}
                  onChange={(e) => setDayEdit({ ...dayEdit, from: e.target.value })}
                  className="h-9 rounded-md bg-white/[0.04] px-2 text-sm text-white ring-1 ring-white/[0.08] [color-scheme:dark] focus:outline-none focus:ring-primary/60"
                />
                <span className="text-slate-400">~</span>
                <input
                  type="time"
                  aria-label="OFF 끝"
                  value={dayEdit.to}
                  onChange={(e) => setDayEdit({ ...dayEdit, to: e.target.value })}
                  className="h-9 rounded-md bg-white/[0.04] px-2 text-sm text-white ring-1 ring-white/[0.08] [color-scheme:dark] focus:outline-none focus:ring-primary/60"
                />
                <span className="text-xs text-slate-400">OFF</span>
              </div>
            )}
          </div>
        )}
      </Modal>
    </SectionCard>
  );
}

/** 발전소 상세(PPA) — 금일 일정 · 지금 상태 · 원격 ON / OFF · 이력 */
export function RemoteControlCard({ companyId }: { companyId: number }) {
  useHydrateOpSchedule();
  const now = today();
  const { data: hol } = useHolidays(Number(now.slice(0, 4)));
  const holidays = useMemo(() => holidayMap(hol), [hol]);
  const store = useOpScheduleStore();
  const { data: es } = useEnergySettings();
  const companies = usePpaCompanies();
  if (!companies.some((c) => c.id === companyId)) return null; // 관리자 · 전기사용자 · 다른 발전사업자는 없음
  const sch = scheduleOf(store, companyId, opRuleOf(es));
  const plan = dayStatus(now, holidays, sch, sch.overrides);
  const on = onNow(plan); // 원격 ON / OFF 도 그날 일정으로 들어가 있다. 시간 OFF 시간대 안이면 OFF
  const autoOn = dayStatus(now, holidays, sch).on;
  const logs = store.logs.filter((l) => l.companyId === companyId).slice(0, 5);
  return (
    <SectionCard
      title="인버터 원격 운전"
      actions={
        <Button size="sm" variant={on ? 'secondary' : 'primary'} onClick={() => store.setRemote(companyId, now, !on, autoOn, by(), opRuleOf(es))}>
          <Power size={14} className="mr-1" /> {on ? '원격 OFF' : '원격 ON'}
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-400">지금 상태</p>
          <p className="mt-1 text-xl font-bold text-white">{on ? '가동' : 'OFF'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">금일 일정</p>
          <p className="mt-1 text-sm text-slate-200">
            {reasonText(plan)}
            {plan.holiday ? ` · ${plan.holiday}` : ''}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">자동 운전</p>
          <p className="mt-1 text-sm text-slate-200">
            {[sch.weekendOff && '주말', sch.holidayOff && '공휴일'].filter(Boolean).join(' · ') || '없음'} OFF · 다음 가동일 ON
          </p>
        </div>
      </div>
      {logs.length > 0 && (
        <table className="mt-4 w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06] text-slate-400">
              <th className="py-1.5 text-left font-medium">일시</th>
              <th className="py-1.5 text-left font-medium">구분</th>
              <th className="py-1.5 text-left font-medium">내용</th>
              <th className="py-1.5 text-left font-medium">처리자</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-white/[0.04] text-slate-300">
                <td className="py-1.5 tabular-nums">{`${l.at.slice(0, 10)} ${l.at.slice(11, 16)}`}</td>
                <td className="py-1.5">{l.how}</td>
                <td className="py-1.5">{`${l.action}${l.note ? ` · ${l.note}` : ''}`}</td>
                <td className="py-1.5">{l.by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}

/** 대시보드(PPA) — 보기만(관리자 · 발전사업자). 이번 주(월~일) 언제 OFF 로 잡혀 있는지 + 지금 상태. 끄고 켜기 · 일정은 설정 › 설정(발전사업자) */
export function PpaScheduleSummary() {
  useHydrateOpSchedule();
  const companies = usePpaCompanies('view'); // 관리자는 전체 조회, 발전사업자는 자기 발전소
  const now = today();
  const { data: hol } = useHolidays(Number(now.slice(0, 4)));
  const holidays = useMemo(() => holidayMap(hol), [hol]);
  const store = useOpScheduleStore();
  const { data: es } = useEnergySettings();
  if (!companies.length) return null;
  const base = opRuleOf(es);
  // 이번 주 월요일 ~ 일요일
  const t = new Date(`${now}T00:00:00Z`);
  const mon = new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * 86_400_000);
  const week = Array.from({ length: 7 }, (_, k) => new Date(mon.getTime() + k * 86_400_000).toISOString().slice(0, 10));
  return (
    <SectionCard title={`PPA 운전 (${companies.length})`}>
      <div className="space-y-5">
        {companies.map((c) => {
          const sch = scheduleOf(store, c.id, base);
          const plan = dayStatus(now, holidays, sch, sch.overrides);
          const offDays = week.filter((d) => !dayStatus(d, holidays, sch, sch.overrides).on);
          return (
            <div key={c.id} className="space-y-2">
              <p className="text-sm text-slate-300">
                <span className="font-semibold text-white">{c.plant}</span>
                <span className="ml-3">지금</span> <b className="text-white">{onNow(plan) ? '가동' : 'OFF'}</b>
                <span className="ml-3">이번 주 OFF</span>{' '}
                <b className="text-white tabular-nums">{offDays.length ? offDays.map((d) => `${WEEK[weekdayOf(d)]} ${Number(d.slice(8))}일`).join(' · ') : '없음'}</b>
              </p>
              {/* 이번 주 — 날마다 가동 / OFF(사유) */}
              <div className="grid grid-cols-7 gap-1 text-xs">
                {week.map((d) => {
                  const st = dayStatus(d, holidays, sch, sch.overrides);
                  return (
                    <div
                      key={d}
                      className={cn(
                        'rounded-md px-2 py-1.5 ring-1',
                        st.on ? 'bg-white/[0.04] ring-white/[0.08]' : 'bg-black/30 ring-white/[0.04]',
                        d === now && 'ring-primary/70',
                      )}
                    >
                      <span className={cn('block tabular-nums', st.on ? 'text-white' : 'text-slate-500')}>
                        {`${WEEK[weekdayOf(d)]} ${Number(d.slice(5, 7))}/${Number(d.slice(8))}`}
                      </span>
                      <span className={cn('block', st.on ? 'text-slate-200' : 'text-slate-500')}>{reasonText(st)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

/** 발전소 상세(PPA) — 누구나 보는 운전 안내. 주말 · 공휴일 OFF 규칙과 금일 일정만, 조작 없음 */
export function PpaOpInfo({ companyId }: { companyId: number }) {
  useHydrateOpSchedule();
  const now = today();
  const { data: hol } = useHolidays(Number(now.slice(0, 4)));
  const holidays = useMemo(() => holidayMap(hol), [hol]);
  const store = useOpScheduleStore();
  const { data: es } = useEnergySettings();
  const companies = usePpaCompanies();
  if (companies.some((c) => c.id === companyId)) return null; // 발전사업자는 원격 운전 카드로
  const sch = scheduleOf(store, companyId, opRuleOf(es));
  const plan = dayStatus(now, holidays, sch, sch.overrides);
  const rule = [sch.weekendOff && '주말', sch.holidayOff && '공휴일', sch.offStart && sch.onTime && `매일 ${sch.offStart}~${sch.onTime}`].filter(Boolean).join(' · ');
  return (
    <SectionCard title="운전">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-slate-400">금일</p>
          <p className="mt-1 text-xl font-bold text-white">{onNow(plan) ? '가동' : 'OFF'}</p>
          <p className="mt-0.5 text-sm text-slate-300">
            {reasonText(plan)}
            {plan.holiday ? ` · ${plan.holiday}` : ''}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">운전 규칙</p>
          <p className="mt-1 text-sm text-slate-200">{rule ? `${rule}에는 인버터 OFF` : '쉬는 날 없이 가동'}</p>
        </div>
      </div>
    </SectionCard>
  );
}

/** 발전소 발전·공급 안(관리자 · 발전사업자) — PPA 운전 한 줄, 조회만(끄고 켜는 건 설정 › 설정). 토글(글자 없음) + 현재 ON / OFF, 그 옆에 그래프 단위를 따라
 *  시간 = 이번 주 요일 칸 · 일 = 그 달 날짜 칸 · 월 = 없음(달 단위로 끄고 켤 수는 없으니 현재만).
 *  칸은 ON 초록 · OFF 어둡게 · 오늘 테두리. 발전사업자가 칸을 누르면 "바꿀까요?" 확인창 → 그날 ON/OFF(수동 지정, 설정 › 설정 달력과 같은 값). 관리자는 조회만. 토글은 오늘 */
export function PpaOpInline({ plantId, tu, month }: { plantId: number; tu: 'hour' | 'day' | 'month'; month: string }) {
  useHydrateOpSchedule();
  useHydrateTradingPoc();
  // 관리자 · 발전사업자만 — 전기사용자는 운전을 안 본다
  const user = useAuthStore((s) => s.user);
  const override = usePersonaOverride((s) => s.override);
  const persona = override ?? getPersona(user);
  const companyId = useTradingPocStore((s) => s.contracts.find((c) => c.kind === 'ONSITE' && c.status === 'ACTIVE' && c.plantId === plantId)?.consumerCompanyId);
  const now = today();
  const viewYear = tu === 'day' ? Number(month.slice(0, 4)) : Number(now.slice(0, 4));
  const { data: hol } = useHolidays(viewYear);
  const { data: holNow } = useHolidays(Number(now.slice(0, 4)));
  const holidays = useMemo(() => holidayMap(hol), [hol]);
  const holidaysNow = useMemo(() => holidayMap(holNow), [holNow]);
  const store = useOpScheduleStore();
  const { data: es } = useEnergySettings();
  const [ask, setAsk] = useState<{ date: string; on: boolean; hs: Map<string, string> } | null>(null);
  if (companyId === undefined || (persona !== 'admin' && persona !== 'generator')) return null;
  const base = opRuleOf(es);
  const sch = scheduleOf(store, companyId, base);
  const plan = dayStatus(now, holidaysNow, sch, sch.overrides);
  // 지금 상태 — 수동으로 껐는지, 설정(쉬는 날 · 고정 시간)으로 꺼졌는지
  const hhmm = (() => {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();
  const manualToday = sch.overrides[now];
  const dayFixed = manualToday === 'ON' || manualToday === 'OFF'; // 하루 통째로 수동
  const byDayTime = !!plan.offWindow && inWindow(plan.offWindow, hhmm); // 그날 시간 OFF
  const offByTime = !manualToday && inOffWindow(base, hhmm);
  const isOn = dayFixed ? manualToday === 'ON' : plan.on && !byDayTime && !offByTime;
  const why = dayFixed
    ? '수동'
    : byDayTime
      ? `수동 · ${plan.offWindow!.from}~${plan.offWindow!.to}`
      : !plan.on
        ? `설정 · ${plan.reason}`
        : offByTime
          ? `설정 · ${base.offStart}~${base.onTime}`
          : '';
  const cell = 'inline-flex h-7 min-w-[30px] items-center justify-center gap-1 rounded-md px-1.5 text-xs tabular-nums ring-1 transition-colors';
  const onCls = 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30 enabled:hover:bg-emerald-500/25';
  const offCls = 'bg-black/30 text-slate-500 ring-white/[0.06] enabled:hover:bg-white/[0.08]';
  // 날짜 칸 — 대시보드는 조회만(끄고 켜는 건 설정 › 설정)
  const canEdit = false;
  const dayCell = (d: string, hs: Map<string, string>, label?: string) => {
    const st = dayStatus(d, hs, sch, sch.overrides);
    return (
      <button
        key={d}
        type="button"
        disabled={!canEdit}
        title={`${d} (${WEEK[weekdayOf(d)]}) ${reasonText(st)}${canEdit ? ` — 누르면 ${st.on ? 'OFF' : 'ON'} 로` : ''}`}
        onClick={() => setAsk({ date: d, on: st.on, hs })}
        className={cn(cell, label && 'min-w-[50px]', st.on ? onCls : offCls, d === now && 'ring-2 ring-primary/70', !canEdit && 'cursor-default')}
      >
        {label && <span className={st.on ? 'text-emerald-300/80' : 'text-slate-500'}>{label}</span>}
        {Number(d.slice(8))}
      </button>
    );
  };
  const t = new Date(`${now}T00:00:00Z`);
  const mon = new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * 86_400_000);
  const week = Array.from({ length: 7 }, (_, k) => new Date(mon.getTime() + k * 86_400_000).toISOString().slice(0, 10));
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-300">
      <div className="flex items-center gap-2.5">
        {/* 조회만 — 끄고 켜는 건 설정 › 설정에서(확인창 거쳐) */}
        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', isOn ? 'bg-emerald-400' : 'bg-red-400')} />
        <span>
          현재 <b className={isOn ? 'text-emerald-300' : 'text-red-300'}>{isOn ? 'ON' : 'OFF'}</b>
          {why && <span className="ml-1.5 text-xs text-slate-400">{why}</span>}
        </span>
      </div>
      {tu === 'hour' && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-slate-400">이번 주</span>
          {week.map((d) => dayCell(d, holidaysNow, WEEK[weekdayOf(d)]))}
        </div>
      )}
      {tu === 'day' && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-slate-400">{`${Number(month.slice(5, 7))}월`}</span>
          {monthStatus(Number(month.slice(0, 4)), Number(month.slice(5, 7)), holidays, sch, sch.overrides).map((d) => dayCell(d.date, holidays))}
        </div>
      )}
      {/* 바꿀까요? — 그날만 수동 지정 */}
      <Modal
        open={ask !== null}
        onClose={() => setAsk(null)}
        title="운전 변경"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="cancel" onClick={() => setAsk(null)}>
              취소
            </Button>
            <Button
              onClick={() => {
                if (ask) store.toggleDay(companyId, ask.date, dayStatus(ask.date, ask.hs, sch).on, by(), base);
                setAsk(null);
              }}
            >
              {ask?.on ? 'OFF 로 바꾸기' : 'ON 으로 바꾸기'}
            </Button>
          </div>
        }
      >
        {ask && (
          <p className="text-sm text-slate-200">
            {`${ask.date} (${WEEK[weekdayOf(ask.date)]}) 인버터를 ${ask.on ? 'ON' : 'OFF'} 에서 `}
            <b className="text-white">{ask.on ? 'OFF' : 'ON'}</b>
            {' 로 바꿉니다.'}
          </p>
        )}
      </Modal>
    </div>
  );
}
