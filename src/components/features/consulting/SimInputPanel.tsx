'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { F, PLAN_LABEL, VER_LABEL, avgSaveUnit, segLabel, ppaSegs, type Plan, type SimInput, type TariffVer } from '@/lib/solar-sim';

/**
 * 무료진단 입력 화면 — 울산미포산단 태양광 사업성 시뮬레이터 v1.1 입력값. 한 장의 페이지 안에서
 * 짧은 항목은 두 개씩 나란히(1·2, 3·4), 칸은 '이름 위 · 값 아래' 로 빈 공간 없이.
 * 업체·사업장·주소는 가입 정보로 고정(입력 없음). 기존 태양광 설비는 전력거래 계약 데이터에서 불러와 채운다(고칠 수 있음).
 */

const FIELD = 'h-9 w-full rounded-md bg-white/[0.04] ring-1 ring-white/[0.08] px-2.5 text-sm text-white tabular-nums focus:outline-none focus:ring-primary/60';

/** 천 단위 콤마 숫자 입력 — 입력 중에는 친 그대로, 벗어나면 정리. 단위는 칸 안 오른쪽 */
function Num({ value, onChange, dec = 0, unit }: { value: number; onChange?: (v: number) => void; dec?: number; unit?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (dec ? value.toLocaleString('ko-KR', { maximumFractionDigits: dec }) : Math.round(value).toLocaleString('ko-KR'));
  return (
    <div className="relative">
      <input
        inputMode="decimal"
        value={shown}
        onFocus={() => setDraft(String(value))}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, '');
          setDraft(raw);
          onChange?.(raw === '' ? 0 : Number(raw));
        }}
        className={cn(FIELD, 'text-right', unit && 'pr-16')}
      />
      {unit && <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-slate-500">{unit}</span>}
    </div>
  );
}
/** 이름 위 · 값 아래 */
function Field({ label, sub, hl, span, children }: { label: string; sub?: string; hl?: boolean; span?: 2 | 3; children: ReactNode }) {
  return (
    <label className={cn('block', span === 2 && 'sm:col-span-2', span === 3 && 'sm:col-span-3')}>
      <span className={cn('mb-1.5 block text-sm', hl ? 'font-medium text-sky-300' : 'text-slate-300')}>
        {label}
        {sub && <span className="ml-1.5 text-xs text-slate-500">{sub}</span>}
      </span>
      {children}
    </label>
  );
}
const Fixed = ({ children }: { children: ReactNode }) => <div className="flex h-9 items-center rounded-md bg-white/[0.02] px-2.5 text-sm text-slate-200">{children || '-'}</div>;
function Sel<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={cn(FIELD, 'cursor-pointer')}>
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-[#0d1520]">
          {o.label}
        </option>
      ))}
    </select>
  );
}
function Sec({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="px-8 py-6">
      <h3 className="mb-4 text-base font-semibold text-white">
        <span className="mr-1.5 text-primary">{n}.</span>
        {title}
      </h3>
      {children}
    </section>
  );
}
/** 한 줄 — 섹션 하나(전체 폭) 또는 두 개(나란히) */
const Line = ({ children, pair }: { children: ReactNode; pair?: boolean }) => (
  <div className={cn('border-t border-white/[0.06] first:border-t-0', pair && 'grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-white/[0.06]')}>{children}</div>
);
const Hint = ({ children }: { children: ReactNode }) => <p className="mt-2 text-xs leading-relaxed text-slate-500">{children}</p>;
const PLANS = (['1', '2'] as Plan[]).map((v) => ({ value: v, label: PLAN_LABEL[v] }));
const VERS = (['old', 'new'] as TariffVer[]).map((v) => ({ value: v, label: VER_LABEL[v] }));
const SEG_COLOR = ['#64748b', '#3b82f6', '#06b6d4'];

export function SimInputPanel({ value: f, onChange, companyName, facilitySource }: { value: SimInput; onChange: (next: SimInput) => void; companyName: string; facilitySource?: string }) {
  const set = (patch: Partial<SimInput>) => onChange({ ...f, ...patch });
  const setSelf = (patch: Partial<SimInput['self']>) => onChange({ ...f, self: { ...f.self, ...patch } });
  const setPpa = (patch: Partial<SimInput['ppa']>) => onChange({ ...f, ppa: { ...f.ppa, ...patch } });
  const setSeg = (k: number, patch: Partial<SimInput['ppa']['segs'][number]>) =>
    setPpa({ segs: f.ppa.segs.map((s, j) => (j === k ? { ...s, ...patch } : s)) as SimInput['ppa']['segs'] });
  // 기존 태양광 설비 — 한 줄. 값이 다 비면 설비 없음
  const fac = f.facilities[0] ?? { source: '태양광', kw: 0, genKwh: 0, useKwh: 0 };
  const setFac = (patch: Partial<typeof fac>) => {
    const next = { ...fac, ...patch, source: '태양광' };
    set({ facilities: next.kw || next.genKwh || next.useKwh ? [next] : [] });
  };
  const segs = ppaSegs(f).filter((sg) => sg.idx <= 2); // 3구간은 쓰지 않는다
  const w = [f.ppa.b1, 20 - f.ppa.b1]; // 1구간 · 2구간
  const kepcoUnit = Math.round(avgSaveUnit(f.ppa.plan, f.ppa.ver) * 10) / 10;
  let n = 0;

  return (
    <div className="space-y-4">
      {/* 검토 방식 */}
      <div className="flex gap-1 rounded-xl bg-[#0d1520] p-1.5 ring-1 ring-white/[0.06]">
        {(
          [
            ['self', '자가소비용', '내 지붕 태양광 전기를 직접 사용'],
            ['ppa', 'OnSite PPA', '사업자가 설치 · 사용분을 PPA 단가로 지불'],
          ] as const
        ).map(([m, label, desc]) => (
          <button
            key={m}
            type="button"
            onClick={() => set({ mode: m })}
            className={cn('flex-1 rounded-lg py-2.5 text-center transition-colors', f.mode === m ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white')}
          >
            <span className="block text-sm font-semibold">{label}</span>
            <span className={cn('block text-xs', f.mode === m ? 'text-white/80' : 'text-slate-500')}>{desc}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06]">
        {/* 1 · 2 */}
        <Line pair>
          <Sec n={++n} title="사업장 (가입 정보)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="업체명">
                <Fixed>{companyName}</Fixed>
              </Field>
              <Field label="사업장">
                <Fixed>{f.site}</Fixed>
              </Field>
              <Field label="주소" span={2}>
                <Fixed>{f.address}</Fixed>
              </Field>
            </div>
          </Sec>
          <Sec n={++n} title="지붕 면적 (선택)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="지붕 가용면적">
                <Num value={f.roof} onChange={(v) => set({ roof: v })} unit="㎡" />
              </Field>
              <Field label="kW당 소요면적">
                <Num value={f.areaPerKw} dec={1} onChange={(v) => set({ areaPerKw: v })} unit="㎡/kW" />
              </Field>
            </div>
            <Hint>{f.roof > 0 ? `입력 면적 기준 설치 가능 용량 약 ${F(f.roof / (f.areaPerKw || 10))} kW` : '면적을 넣으면 설치 가능 용량을 알려 드립니다'}</Hint>
          </Sec>
        </Line>

        {/* 3 · 4 */}
        <Line pair>
          <Sec n={++n} title="기상 조건 (울산미포)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="일평균 발전시간" sub="손실 반영" hl>
                <Num value={f.avgH} dec={2} onChange={(v) => set({ avgH: v })} unit="h/일" />
              </Field>
              <Field label="모듈 효율감소율" sub="2년차부터">
                <Num value={f.deg} dec={2} onChange={(v) => set({ deg: v })} unit="%/yr" />
              </Field>
            </div>
          </Sec>
          <Sec n={++n} title="탄소배출권 (K-ETS)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="배출권 시세 (KAU)">
                <Num value={f.kau} onChange={(v) => set({ kau: v })} unit="원/t" />
              </Field>
              <Field label="가격 상승률">
                <Num value={f.kauEsc} dec={1} onChange={(v) => set({ kauEsc: v })} unit="%/yr" />
              </Field>
              <Field label="전력 배출계수">
                <Num value={f.co2f} dec={4} onChange={(v) => set({ co2f: v })} unit="t/MWh" />
              </Field>
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={f.ets} onChange={(e) => set({ ets: e.target.checked })} className="h-4 w-4 accent-[#3b82f6]" />
              배출권 할당대상업체 <span className="text-xs text-slate-500">체크 시 배출권 매각가치를 절감액에 합산</span>
            </label>
          </Sec>
        </Line>

        {/* 5 — 기존 설비 */}
        <Line>
          <Sec n={++n} title="기존 태양광 설비">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="설비 규모">
                <Num value={fac.kw} dec={2} onChange={(v) => setFac({ kw: v })} unit="kW" />
              </Field>
              <Field label="연간 발전량">
                <Num value={fac.genKwh} onChange={(v) => setFac({ genKwh: v })} unit="kWh" />
              </Field>
              <Field label="연간 사용량">
                <Num value={fac.useKwh} onChange={(v) => setFac({ useKwh: v })} unit="kWh" />
              </Field>
            </div>
            <Hint>{facilitySource ?? '계약된 태양광 설비 없음'}</Hint>
          </Sec>
        </Line>

        {/* 6 — 방식별 */}
        {f.mode === 'self' ? (
          <Line>
            <Sec n={++n} title="자가소비 · 설비 / 수용가">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Field label="태양광 설치용량" hl>
                  <Num value={f.self.cap} onChange={(v) => setSelf({ cap: v })} unit="kW" />
                </Field>
                <Field label="계약전력" sub="선택">
                  <Num value={f.self.ctr} onChange={(v) => setSelf({ ctr: v })} unit="kW" />
                </Field>
                <Field label="월평균 전기사용량">
                  <Num value={f.self.usage} onChange={(v) => setSelf({ usage: v })} unit="kWh" />
                </Field>
                <Field label="기본요금 피크감축 반영률">
                  <Num value={f.self.peakR} dec={1} onChange={(v) => setSelf({ peakR: v })} unit="%" />
                </Field>
                <Field label="요금제">
                  <Sel value={f.self.plan} options={PLANS} onChange={(v) => setSelf({ plan: v })} />
                </Field>
                <Field label="요금 기준">
                  <Sel value={f.self.ver} options={VERS} onChange={(v) => setSelf({ ver: v })} />
                </Field>
                <Field label="전기요금 상승률">
                  <Num value={f.self.esc} dec={1} onChange={(v) => setSelf({ esc: v })} unit="%/yr" />
                </Field>
              </div>
            </Sec>
          </Line>
        ) : (
          <Line pair>
            <Sec n={++n} title="OnSite PPA · 설비 / 비교 기준">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="태양광 설치용량" hl>
                  <Num value={f.ppa.cap} onChange={(v) => setPpa({ cap: v })} unit="kW" />
                </Field>
                <Field label="한전요금 상승률">
                  <Num value={f.ppa.esc} dec={1} onChange={(v) => setPpa({ esc: v })} unit="%/yr" />
                </Field>
                <Field label="비교 요금제">
                  <Sel value={f.ppa.plan} options={PLANS} onChange={(v) => setPpa({ plan: v })} />
                </Field>
                <Field label="요금 기준">
                  <Sel value={f.ppa.ver} options={VERS} onChange={(v) => setPpa({ ver: v })} />
                </Field>
                <Field label="기본요금 피크감축 반영률">
                  <Num value={f.ppa.peakR} dec={1} onChange={(v) => setPpa({ peakR: v })} unit="%" />
                </Field>
                <Field label="PPA 단가 상승률" sub="고정단가 구간">
                  <Num value={f.ppa.ppaEsc} dec={1} onChange={(v) => setPpa({ ppaEsc: v })} unit="%/yr" />
                </Field>
              </div>
            </Sec>
            <Sec n={++n} title="OnSite PPA · 구간별 계약단가 (20년)">
              <div className="mb-3 flex h-7 overflow-hidden rounded-md ring-1 ring-white/[0.08]">
                {w.map((x, k) => (
                  <div
                    key={k}
                    className="flex items-center justify-center overflow-hidden whitespace-nowrap text-xs font-semibold text-white"
                    style={{ width: `${(x / 20) * 100}%`, background: SEG_COLOR[k] }}
                  >
                    {x > 0 ? `${k + 1}구간 ${x}년` : ''}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 py-1">
                <span className="w-[72px] shrink-0 text-sm text-slate-300">1구간 끝</span>
                <input type="range" min={0} max={20} value={f.ppa.b1} onChange={(e) => setPpa({ b1: Number(e.target.value), b2: 20 })} className="min-w-0 flex-1 accent-[#38bdf8]" />
                <span className="w-14 text-right text-sm font-semibold text-sky-300 tabular-nums">{f.ppa.b1}년차</span>
              </div>
              <Hint>1구간이 끝나는 연차를 고릅니다. 그다음 해부터 20년차까지 2구간입니다. 0으로 두면 처음부터 2구간 단가입니다.</Hint>
              <div className="mt-3 space-y-2">
                {segs.map((sg, k) => (
                  <div key={sg.idx} className={cn('grid grid-cols-[1fr_150px] items-center gap-3 rounded-lg ring-1 ring-white/[0.08] px-3 py-2', sg.end < sg.start && 'opacity-35')}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded px-1.5 py-0.5 text-xs font-semibold text-white" style={{ background: SEG_COLOR[k] }}>
                          {sg.idx}구간
                        </span>
                        <span className="text-sm font-semibold text-sky-300">{segLabel(sg)}</span>
                      </div>
                      <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
                        <input type="checkbox" checked={sg.linked} onChange={(e) => setSeg(k, { linked: e.target.checked })} className="h-3.5 w-3.5 accent-[#3b82f6]" />
                        한전 대체단가 연동 {sg.linked && <span className="text-slate-500">— 값을 넣으면 고정단가</span>}
                      </label>
                    </div>
                    {/* 값을 넣으면 그 구간은 고정단가로 바뀐다 */}
                    <Num value={sg.linked ? kepcoUnit : sg.price} dec={1} onChange={(v) => setSeg(k, { price: v, linked: false })} unit="원/kWh" />
                  </div>
                ))}
              </div>
            </Sec>
          </Line>
        )}
      </div>
    </div>
  );
}
