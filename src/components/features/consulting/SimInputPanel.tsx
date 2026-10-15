'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TABLE, TABLE_HEAD_ROW, TABLE_TH, TABLE_ROW, TABLE_TD } from '@/components/features/DataList';
import { ChevronDown } from 'lucide-react';
import { ADDRESS_MAX, LIM, NAME_MAX, hiddenDefaultsOf, type SimInput } from '@/lib/solar-sim';

/**
 * 무료진단 입력 화면 — 울산미포산단 태양광 사업성 시뮬레이터 v1.1 입력값. 한 장의 페이지 안에서
 * 칸은 '이름 위 · 값 아래'. 방식 · [시뮬레이션] 버튼까지 한 장 안에(footer).
 * 기업명·기업 주소는 로그인(가입) 값으로 고정(입력 없음) — 관리자만 companyEdit 로 기존 기업 선택 또는 직접 입력.
 * 입력은 꼭 필요한 것만(2026-10-12): 지붕 면적 · 기존 설비 · 계약전력 · 요금제 · 피크감축 · PPA 구간은 받지 않고 기본값으로 계산한다.
 *  - 자가소비: 희망 태양광 설치용량 · 전기요금 상승률 (발전량은 전부 직접 쓴다고 본다) (설치단가 · 추가 시공비는 기본값 — 총사업비는 그걸로 계산)
 *  - PPA: 희망 태양광 설치용량 · 한전요금 상승률 · PPA 단가 상승률 · PPA 단가(20년 한 단가)
 */

const FIELD = 'h-9 w-full rounded-md bg-white/[0.04] ring-1 ring-white/[0.08] px-2.5 text-sm text-white tabular-nums focus:outline-none focus:ring-primary/60';

/** 천 단위 콤마 숫자 입력 — 입력 중에는 친 그대로, 벗어나면 정리. 단위는 칸 안 오른쪽.
 *  숫자와 점 하나만 받는다. 최대값을 넘으면 바로 최대값으로, 최소값 아래는 칸을 벗어날 때 최소값으로 */
function Num({ value, onChange, dec = 0, unit, blankZero, lim }: { value: number; onChange?: (v: number) => void; dec?: number; unit?: string; blankZero?: boolean; lim: readonly [number, number] }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [lo, hi] = lim;
  const shown = draft ?? (blankZero && !value ? '' : dec ? value.toLocaleString('ko-KR', { maximumFractionDigits: dec }) : Math.round(value).toLocaleString('ko-KR'));
  return (
    <div className="relative">
      <input
        inputMode="decimal"
        value={shown}
        onFocus={() => setDraft(String(value))}
        onBlur={() => {
          setDraft(null);
          if (value < lo && !(blankZero && !value)) onChange?.(lo);
        }}
        onChange={(e) => {
          const [head = '', ...rest] = e.target.value.replace(/[^0-9.]/g, '').split('.');
          let raw = rest.length ? `${head}.${rest.join('')}` : head;
          let n = raw === '' || raw === '.' ? 0 : Number(raw);
          if (n > hi) {
            n = hi;
            raw = String(hi);
          }
          setDraft(raw);
          onChange?.(n);
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
const Fixed = ({ children }: { children: ReactNode }) => <div className="flex min-h-9 items-center break-words rounded-md bg-white/[0.02] px-2.5 py-1.5 text-sm text-slate-200">{children || '-'}</div>;
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

export function SimInputPanel({
  value: f,
  onChange,
  companyName,
  footer,
  companyEdit,
}: {
  value: SimInput;
  onChange: (next: SimInput) => void;
  companyName: string;
  facilitySource?: string;
  footer?: ReactNode; // 한 장 맨 아래(여백 안) — [시뮬레이션]
  /** 관리자만 — 기존 기업을 고르면 기업명·기업 주소 고정, 신규 기업 등록이면 직접 입력. 없으면 로그인(가입) 값 고정 */
  companyEdit?: {
    options: { value: string; label: string }[];
    pick: string;
    onPick: (v: string) => void;
    name: string;
    onName: (v: string) => void;
    address: string;
    onAddress: (v: string) => void;
  };
}) {
  const set = (patch: Partial<SimInput>) => onChange({ ...f, ...patch });
  const setSelf = (patch: Partial<SimInput['self']>) => onChange({ ...f, self: { ...f.self, ...patch } });
  const setPpa = (patch: Partial<SimInput['ppa']>) => onChange({ ...f, ppa: { ...f.ppa, ...patch } });
  // PPA 단가 — 구간 없이 20년 한 단가(1구간 = 1~20년차, 고정단가)
  const ppaPrice = f.ppa.segs[0].price;
  const setPpaPrice = (v: number) =>
    setPpa({ b1: 20, b2: 20, segs: [{ linked: false, price: v }, f.ppa.segs[1], f.ppa.segs[2]] });
  let n = 0;
  // 입력 화면에 없는 기본값 — 눌러서 펼쳐 본다
  const [showDefaults, setShowDefaults] = useState(false);

  return (
    <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06]">
      {/* 검토 방식 */}
      <div className="px-8 pt-6">
      <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1.5 ring-1 ring-white/[0.06]">
        {(
          [
            ['self', '자가소비용', '내 지붕 태양광 전기를 직접 사용'],
            ['ppa', 'PPA', '사업자가 설치 · 사용분을 PPA 단가로 지불'],
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
      </div>

      <div>
        {/* 1 — 기업: 한 줄 전체(기업 주소가 길어도 잘리지 않게). 관리자만 고르거나 입력 */}
        <Line>
          <Sec n={++n} title={companyEdit ? '기업' : '기업 (가입 정보)'}>
            {companyEdit ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="기존 기업 선택">
                  <Sel value={companyEdit.pick} options={[{ value: '', label: '신규 기업 등록' }, ...companyEdit.options]} onChange={companyEdit.onPick} />
                </Field>
                <Field label="기업명">
                  {companyEdit.pick ? <Fixed>{companyEdit.name}</Fixed> : <input maxLength={NAME_MAX} value={companyEdit.name} onChange={(e) => companyEdit.onName(e.target.value)} className={FIELD} />}
                </Field>
                <div className="sm:col-span-2">
                  <Field label="기업 주소">
                    {companyEdit.pick ? <Fixed>{companyEdit.address}</Fixed> : <input maxLength={ADDRESS_MAX} value={companyEdit.address} onChange={(e) => companyEdit.onAddress(e.target.value)} className={FIELD} />}
                  </Field>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                <Field label="기업명">
                  <Fixed>{companyName}</Fixed>
                </Field>
                <div>
                  <Field label="기업 주소">
                    <Fixed>{f.address}</Fixed>
                  </Field>
                </div>
              </div>
            )}
          </Sec>
        </Line>

        {/* 2 · 3 */}
        <Line pair>
          <Sec n={++n} title="기상 조건 (울산미포)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="일평균 발전시간" hl>
                <Num lim={LIM.avgH} value={f.avgH} dec={2} onChange={(v) => set({ avgH: v })} unit="h/일" />
              </Field>
              <Field label="모듈 효율감소율">
                <Num lim={LIM.deg} value={f.deg} dec={2} onChange={(v) => set({ deg: v })} unit="%/yr" />
              </Field>
            </div>
          </Sec>
          <Sec n={++n} title="탄소배출권 (K-ETS)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="배출권 시세 (KAU)">
                <Num lim={LIM.kau} value={f.kau} onChange={(v) => set({ kau: v })} unit="원/t" />
              </Field>
              <Field label="가격 상승률">
                <Num lim={LIM.kauEsc} value={f.kauEsc} dec={1} onChange={(v) => set({ kauEsc: v })} unit="%/yr" />
              </Field>
              <Field label="전력 배출계수">
                <Num lim={LIM.co2f} value={f.co2f} dec={4} onChange={(v) => set({ co2f: v })} unit="t/MWh" />
              </Field>
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={f.ets} onChange={(e) => set({ ets: e.target.checked })} className="h-4 w-4 accent-[#3b82f6]" />
              배출권 할당대상업체 <span className="text-xs text-slate-500">체크 시 배출권 매각가치를 절감액에 합산</span>
            </label>
          </Sec>
        </Line>

        {/* 4 — 방식별: 꼭 필요한 값만 */}
        {f.mode === 'self' ? (
          <Line>
            <Sec n={++n} title="자가소비 · 설비">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Field label="희망 태양광 설치용량" hl>
                  <Num lim={LIM.cap} value={f.self.cap} onChange={(v) => setSelf({ cap: v })} unit="kW" />
                </Field>
                <Field label="전기요금 상승률">
                  <Num lim={LIM.esc} value={f.self.esc} dec={1} onChange={(v) => setSelf({ esc: v })} unit="%/yr" />
                </Field>
              </div>
            </Sec>
          </Line>
        ) : (
          <Line pair>
            <Sec n={++n} title="PPA · 설비">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="희망 태양광 설치용량" hl>
                  <Num lim={LIM.cap} value={f.ppa.cap} onChange={(v) => setPpa({ cap: v })} unit="kW" />
                </Field>
                <Field label="한전요금 상승률">
                  <Num lim={LIM.esc} value={f.ppa.esc} dec={1} onChange={(v) => setPpa({ esc: v })} unit="%/yr" />
                </Field>
                <Field label="PPA 단가 상승률">
                  <Num lim={LIM.esc} value={f.ppa.ppaEsc} dec={1} onChange={(v) => setPpa({ ppaEsc: v })} unit="%/yr" />
                </Field>
              </div>
            </Sec>
            <Sec n={++n} title="PPA · 단가">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="PPA 단가 (20년)" hl>
                  <Num lim={LIM.segPrice} value={ppaPrice} dec={1} onChange={setPpaPrice} unit="원/kWh" />
                </Field>
              </div>
            </Sec>
          </Line>
        )}
        {/* 기본값 — 입력 칸은 없지만 계산에 같이 쓰는 값 */}
        <Line>
          <section className="px-8 py-5">
            <button
              type="button"
              onClick={() => setShowDefaults((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white"
              aria-expanded={showDefaults}
            >
              <ChevronDown size={16} className={cn('transition-transform', showDefaults && 'rotate-180')} />
              기본값 보기 <span className="text-xs text-slate-500">입력 칸 없이 계산에 쓰는 값</span>
            </button>
            {showDefaults && (
              <table className={cn(TABLE, 'mt-3')}>
                <thead>
                  <tr className={TABLE_HEAD_ROW}>
                    <th className={TABLE_TH}>항목</th>
                    <th className={TABLE_TH}>값</th>
                    <th className={TABLE_TH}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {hiddenDefaultsOf(f).map(([k, v, w]) => (
                    <tr key={k} className={cn(TABLE_ROW, 'last:border-0')}>
                      <td className={TABLE_TD}>{k}</td>
                      <td className={cn(TABLE_TD, 'tabular-nums')}>{v}</td>
                      <td className={TABLE_TD}>{w}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </Line>
      </div>
      {footer && <div className="flex items-center justify-end gap-4 border-t border-white/[0.06] px-8 py-5">{footer}</div>}
    </div>
  );
}
