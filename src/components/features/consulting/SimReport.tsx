'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  CAGR,
  DAYS,
  EOK,
  F,
  F1,
  F2,
  MNAME,
  PLAN_LABEL,
  SCEN_COLOR,
  SEASON_NAME,
  SELF_REMAIN,
  TARIFF,
  VER_LABEL,
  calc,
  escInput,
  monthlyFor,
  ppaSegs,
  saveUnit,
  scenarios,
  segLabel,
  segOfYear,
  type PpaResult,
  type SelfResult,
  type SimInput,
} from '@/lib/solar-sim';

/**
 * 태양광 사업성 검토서 — A4 문서(흰 종이) 꼴. 울산미포산단 태양광 사업성 시뮬레이터 v1.1 결과 이식.
 * 1 검토 입력값 → 2 결과 요약 → 3 발전량·절감 추이 → 4 20년 종합 → 5 시나리오·민감도 → 6 요금단가 → 7 월별 → 8 연도별 → 9 산정 기준
 * 머리는 제목 · 작성일 · [PDF 저장]만. 시나리오(한전요금 상승률)·월별 연차는 화면에서 바꿀 수 있다(인쇄에는 고른 값만).
 */

/** 사업 검토서 기록 — 번호·일시 (저장된 검토만) */
export interface ReviewRecord {
  no: string;
  at: string; // 2026-10-02 14:32
}

const SEG_COLOR = ['#64748b', '#2563eb', '#0891b2'];
const AXIS = { fontSize: 11, fill: '#64748b' };
const GRID = '#e5e7eb';
const TIP = { contentStyle: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 } };

/* ── 문서 조각 ── */
function H1({ n, children }: { n: number; children: ReactNode }) {
  return (
    <h2 className="mb-4 mt-12 border-b-2 border-slate-900 pb-2 text-lg font-bold text-slate-900 first:mt-0" style={{ breakAfter: 'avoid' }}>
      {n}. {children}
    </h2>
  );
}
function H2({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-end justify-between gap-3">
      <h3 className="text-[15px] font-semibold text-slate-800">{children}</h3>
      {right && <div className="text-xs text-slate-500">{right}</div>}
    </div>
  );
}
const Note = ({ children }: { children: ReactNode }) => <p className="mt-2 text-xs leading-relaxed text-slate-500">{children}</p>;
/** 숫자 표 — 첫 열 가운데, 나머지 오른쪽 */
function T({ head, rows, total, cur, small }: { head: ReactNode[]; rows: ReactNode[][]; total?: ReactNode[][]; cur?: number; small?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse', small ? 'text-xs' : 'text-[13px]')}>
        <thead>
          <tr className="bg-slate-100 text-slate-600">
            {head.map((h, i) => (
              <th key={i} className={cn('whitespace-nowrap border border-slate-300 px-2.5 py-2 font-semibold', i === 0 ? 'text-center' : 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className={cn(ri === cur && 'bg-blue-50')}>
              {r.map((c, i) => (
                <td key={i} className={cn('whitespace-nowrap border border-slate-200 px-2.5 py-1.5 tabular-nums', i === 0 ? 'text-center text-slate-600' : 'text-right text-slate-800')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
          {total?.map((r, ri) => (
            <tr key={`t${ri}`} className="bg-slate-50 font-semibold">
              {r.map((c, i) => (
                <td key={i} className={cn('whitespace-nowrap border border-slate-300 px-2.5 py-1.5 tabular-nums text-slate-900', i === 0 ? 'text-center' : 'text-right')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Kpi({ k, v, s, tone = 'primary' }: { k: string; v: ReactNode; s: ReactNode; tone?: 'primary' | 'good' | 'accent' }) {
  return (
    <div className="relative overflow-hidden rounded-md border border-slate-200 px-4 py-3.5" style={{ breakInside: 'avoid' }}>
      <span className={cn('absolute inset-y-0 left-0 w-1', tone === 'good' ? 'bg-emerald-600' : tone === 'accent' ? 'bg-sky-500' : 'bg-blue-600')} />
      <p className="text-xs font-semibold text-slate-500">{k}</p>
      <p className="mt-1 text-xl font-bold text-slate-900 tabular-nums">{v}</p>
      <div className="mt-1 text-xs leading-relaxed text-slate-500">{s}</div>
    </div>
  );
}
function SumItem({ k, v, s, dim }: { k: string; v: ReactNode; s: ReactNode; dim?: boolean }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-center">
      <p className="text-xs font-semibold text-slate-500">{k}</p>
      <p className={cn('mt-1 text-base font-bold tabular-nums', dim ? 'text-slate-400' : 'text-slate-900')}>{v}</p>
      <p className="mt-0.5 text-xs text-slate-500">{s}</p>
    </div>
  );
}
const Pos = ({ v, children }: { v: number; children: ReactNode }) => <span className={v >= 0 ? 'font-semibold text-emerald-700' : 'text-red-600'}>{children}</span>;
const Blue = ({ children }: { children: ReactNode }) => <span className="text-blue-700">{children}</span>;
const Dim = ({ on, children }: { on: boolean; children: ReactNode }) => <span className={on ? 'text-blue-700' : 'text-slate-400'}>{children}</span>;
const SegTag = ({ idx, children }: { idx: number; children: ReactNode }) => (
  <span className="inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: SEG_COLOR[idx - 1] }}>
    {children}
  </span>
);

export function SimReport({ input, companyName, record, autoPdf }: { input: SimInput; companyName: string; record?: ReviewRecord; autoPdf?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scen, setScen] = useState(1);
  const [mY, setMY] = useState(1);
  const sc = useMemo(() => scenarios(input), [input]);
  const R = sc[scen]!.R;
  const self = R.mode === 'self';
  const ver = R.ver;
  const written = (record?.at ?? new Date().toISOString()).slice(0, 10);

  // PDF — 문서(종이)만 새 창에 옮겨 인쇄(PDF 저장)
  const pdf = () => {
    const html = ref.current?.outerHTML;
    if (!html) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((el) => el.outerHTML).join('');
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${record?.no ?? companyName} 태양광 사업성 검토서</title>${styles}<style>@page{size:A4;margin:12mm}body{background:#fff}[data-noprint]{display:none!important}</style></head><body>${html}</body></html>`,
    );
    w.document.close();
    setTimeout(() => w.print(), 600);
  };
  // 열리자마자 PDF 저장 — 문서 목록의 다운로드 버튼용
  useEffect(() => {
    if (!autoPdf) return;
    const t = setTimeout(pdf, 600);
    return () => clearTimeout(t);
  }, [autoPdf]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = monthlyFor(R, mY);
  const mGen = rows.reduce((a, r) => a + r.g, 0);
  const toe = (R.cumGen / 1000) * 0.229;
  let n = 0;

  return (
    <div ref={ref} className="mx-auto w-full max-w-[1040px] rounded-sm bg-white px-8 py-10 text-slate-800 shadow-2xl sm:px-14 sm:py-12">
      {/* 머리 — 제목 · 작성일, 오른쪽 PDF 저장 */}
      <div className="flex items-end justify-between gap-4 border-b-[3px] border-slate-900 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            태양광 사업성 검토서
            <span className="ml-3 rounded bg-blue-50 px-2 py-0.5 align-middle text-sm font-semibold text-blue-700">{self ? '자가소비용' : 'OnSite PPA (리스형)'}</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500 tabular-nums">작성일 {written}</p>
        </div>
        <div data-noprint>
          <Button onClick={pdf}>
            <Download size={14} className="mr-1.5" /> PDF 저장
          </Button>
        </div>
      </div>

      {/* 1. 검토 입력값 */}
      <H1 n={++n}>검토 입력값</H1>
      <InputRecord input={input} companyName={companyName} />

      {/* 2. 검토 결과 요약 */}
      <H1 n={++n}>검토 결과 요약</H1>
      <div data-noprint className="mb-4 flex gap-1.5 rounded-lg bg-slate-100 p-1">
        {sc.map((x, k) => {
          const r = x.R;
          const res = r.mode === 'self' ? `20년 절감 ${EOK(r.cumSave)}억` : `20년 절감 ${EOK(r.ets ? r.cumT : r.cumSaveD)}억 · kWh당 ${F1(r.avgKu - r.avgPu)}원`;
          const sub = k === 0 ? '0%/yr · 최소 기대치' : k === 1 ? `${(escInput(input) * 100).toFixed(1)}%/yr · 입력값` : `${(CAGR * 100).toFixed(1)}%/yr · 2019~2025 실적`;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setScen(k)}
              className={cn('flex flex-1 flex-col items-center gap-0.5 rounded-md border-t-[3px] px-2 py-2 text-sm transition-colors', scen === k ? 'bg-white shadow-sm' : 'border-transparent text-slate-500 hover:bg-white/60')}
              style={scen === k ? { borderTopColor: SCEN_COLOR[k] } : undefined}
            >
              <span className="font-semibold text-slate-800">{['한전요금 동결', '상승분 반영 (입력값)', '실적 CAGR 반영'][k]}</span>
              <span className={cn('text-xs', scen === k ? 'text-blue-700' : 'text-slate-500')}>{sub}</span>
              <span className="text-xs font-semibold tabular-nums text-slate-700">{res}</span>
            </button>
          );
        })}
      </div>
      <p className="mb-3 text-sm text-slate-600">
        적용 시나리오: <b className="text-slate-900">{sc[scen]!.name}</b>
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{self ? <SelfKpis R={R} /> : <PpaKpis R={R} />}</div>
      {self && R.cap > SELF_REMAIN && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
          <b>자가소비 배정 잔여용량 초과</b> — 자가소비형 잔여 배정용량은 약 {SELF_REMAIN}kW(0.32MW)입니다. 입력 용량 {F(R.cap)}kW 중 초과분은 자가소비 배정에서 제외될 수 있어 초과 용량은 OnSite PPA(리스형) 검토를 권장합니다.
        </div>
      )}
      {!self && <Re100Note R={R} />}

      {/* 3. 발전량 및 절감 추이 */}
      <H1 n={++n}>발전량 및 절감 추이</H1>
      <div style={{ breakInside: 'avoid' }}>
        <H2
          right={
            <span data-noprint className="flex items-center gap-2">
              <input type="range" min={1} max={20} value={mY} onChange={(e) => setMY(Number(e.target.value))} className="w-44 accent-[#2563eb]" aria-label="연차" />
              <span className="w-[150px] text-right font-semibold text-blue-700 tabular-nums">
                {mY}차년{mY > 1 ? ` (한전 +${((Math.pow(1 + R.esc, mY - 1) - 1) * 100).toFixed(1)}%)` : ''}
              </span>
            </span>
          }
        >
          {self ? `월별 예상 발전량 (${mY}차년)` : `월별 발전량 · 한전요금 대비 PPA 납입료 (${mY}차년)`}
        </H2>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows.map((r, m) => ({ m: MNAME[m], gen: Math.round(r.g), kep: Math.round(r.kepco / 1e4), pay: Math.round(r.ppaCost / 1e4) }))}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="m" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis yAxisId="g" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v: number) => v.toLocaleString()} width={60} />
              {!self && <YAxis yAxisId="w" orientation="right" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v: number) => v.toLocaleString()} width={44} />}
              <Tooltip {...TIP} formatter={(v) => Number(v).toLocaleString()} />
              {!self && <Legend wrapperStyle={{ fontSize: 11 }} />}
              <Bar yAxisId="g" dataKey="gen" name="발전량 (kWh)" fill="#60a5fa" radius={[3, 3, 0, 0]} />
              {!self && <Line yAxisId="w" dataKey="kep" name="한전요금 기준액 (만원)" stroke="#94a3b8" strokeDasharray="6 4" dot={{ r: 2 }} />}
              {!self && <Line yAxisId="w" dataKey="pay" name="PPA 납입료 (만원)" stroke="#ea580c" strokeWidth={2.5} dot={{ r: 3 }} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      {!self && (
        <Note>
          {mY}차년 태양광 대체단가: 여름 {F1(saveUnit(0, R.plan, ver) * Math.pow(1 + R.esc, mY - 1))}원 / 봄가을 {F1(saveUnit(1, R.plan, ver) * Math.pow(1 + R.esc, mY - 1))}원 / 겨울{' '}
          {F1(saveUnit(2, R.plan, ver) * Math.pow(1 + R.esc, mY - 1))}원/kWh.{' '}
          {segOfYear(R, mY).linked
            ? `${mY}차년은 ${segOfYear(R, mY).idx}구간 한전 연동 — PPA 납입료가 한전 기준액과 같고 기본요금 절감만 발생.`
            : `PPA 납입료는 ${segOfYear(R, mY).idx}구간 고정단가 ${F1(rows[0]!.pu)}원/kWh 로 발전량에 정비례.`}{' '}
          연간 절감 {F(R.years[mY - 1]!.saveD / 1e4)}만원
        </Note>
      )}
      <CumChart R={R} />
      {!self && <UnitChart R={R} />}

      {/* 4. 20년 종합 */}
      <H1 n={++n}>20년 종합 요약</H1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{self ? <SelfSummary R={R} /> : <PpaSummary R={R} />}</div>
      <H2>20년 누적 효과</H2>
      <EffPanel R={R} toe={toe} />

      {/* 5. 시나리오 · 민감도 */}
      <H1 n={++n}>한전요금 시나리오 · 민감도 분석</H1>
      <H2>시나리오별 20년 누적 (백만원)</H2>
      <div className="h-[240px]" style={{ breakInside: 'avoid' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={Array.from({ length: 20 }, (_, k) => {
              const o: Record<string, number | string> = { x: `${k + 1}년` };
              sc.forEach((s, j) => {
                const r = s.R;
                o[`s${j}`] = Math.round((r.mode === 'self' ? r.years[k]!.cum : r.ets ? r.years[k]!.cumT : r.years[k]!.cumD) / 1e6);
              });
              return o;
            })}
          >
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="x" tick={AXIS} axisLine={false} tickLine={false} interval={1} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v: number) => v.toLocaleString()} width={52} />
            <Tooltip {...TIP} formatter={(v) => Number(v).toLocaleString()} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {sc.map((s, j) => (
              <Line key={j} dataKey={`s${j}`} name={s.name} stroke={SCEN_COLOR[j]} strokeWidth={j === scen ? 3 : 1.8} strokeDasharray={j === scen ? undefined : '5 4'} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <H2 right="금액 억원">시나리오별 20년 최종 결과 비교</H2>
      <ScenTable sc={sc} scen={scen} self={self} ets={R.ets} />

      {/* 6. 요금단가 */}
      <H1 n={++n}>적용 전기요금 단가</H1>
      <H2 right="원/kWh · 기본요금 원/kW">
        산업용(을) {PLAN_LABEL[R.plan]} · {VER_LABEL[ver]}
      </H2>
      <T
        head={['구분', '기본요금', '계절', '경부하', '중간부하', '최대부하', '태양광 대체단가*']}
        rows={[0, 1, 2].map((s) => [
          s === 0 ? PLAN_LABEL[R.plan] : '',
          s === 0 ? F(TARIFF[ver][R.plan].base) : '',
          SEASON_NAME[s],
          F1(TARIFF[ver][R.plan].light[s]!),
          F1(TARIFF[ver][R.plan].mid[s]!),
          F1(TARIFF[ver][R.plan].peak[s]!),
          <b key="u" className="text-blue-700">
            {F1(saveUnit(s, R.plan, ver))}
          </b>,
        ])}
      />
      <Note>* 태양광 대체단가 = 발전시간대 가중 전력량요금 + 기후환경요금 9.0 + 연료비조정 5.0, 전력기금 3.7% 가산 — 자가소비(또는 PPA 대체) 1kWh당 회피되는 한전요금</Note>

      {/* 7. 월별 */}
      <H1 n={++n}>월별 상세 ({mY}차년)</H1>
      {self ? (
        <T
          head={['월', '발전시간 (h/일)', '발전량 (kWh)', '자가소비 (kWh)', '대체단가 (원/kWh)', '전력량 절감 (원)', '기본요금 절감 (원)', '절감 합계 (원)']}
          rows={rows.map((r, m) => [MNAME[m], F2(r.g / R.cap / DAYS[m]!), F(r.g), F(r.self), F1(r.su), F(r.eSave), F(r.bSave), <Pos key="s" v={r.save}>{F(r.save)}</Pos>])}
          total={[['합계', F2(mGen / R.cap / 365), F(mGen), F(rows.reduce((a, r) => a + r.self, 0)), '—', F(rows.reduce((a, r) => a + r.eSave, 0)), F(rows.reduce((a, r) => a + r.bSave, 0)), F(rows.reduce((a, r) => a + r.save, 0))]]}
        />
      ) : (
        <T
          head={['월', '발전시간 (h/일)', '발전량 (kWh)', '한전 대체단가', 'PPA 적용단가', '한전 기준액 (원)', 'PPA 요금 (원)', '기본요금 절감 (원)', '절감액 (원)']}
          rows={rows.map((r, m) => [MNAME[m], F2(r.g / R.cap / DAYS[m]!), F(r.g), F1(r.su), <Blue key="p">{F1(r.pu)}</Blue>, F(r.kepco), <Blue key="c">{F(r.ppaCost)}</Blue>, F(r.bSave), <Pos key="s" v={r.save}>{F(r.save)}</Pos>])}
          total={(() => {
            const kep = rows.reduce((a, r) => a + r.kepco, 0);
            const ppa = rows.reduce((a, r) => a + r.ppaCost, 0);
            const b = rows.reduce((a, r) => a + r.bSave, 0);
            const s = rows.reduce((a, r) => a + r.save, 0);
            return [
              ['월평균', F2(mGen / R.cap / 365), F(mGen / 12), F1(kep / mGen), F1(ppa / mGen), F(kep / 12), F(ppa / 12), F(b / 12), F(s / 12)],
              ['합계', '—', F(mGen), '—', '—', F(kep), F(ppa), F(b), F(s)],
            ];
          })()}
        />
      )}

      {/* 8. 연도별 */}
      <H1 n={++n}>연도별 20년 종합 분석</H1>
      <H2 right="발전량 MWh · 금액 백만원 · CO₂ tCO₂">{self ? '자가소비 절감' : 'PPA 구간별 단가 · 절감'}</H2>
      {self ? <SelfYears R={R} cur={mY - 1} /> : <PpaYears R={R} cur={mY - 1} />}

      {/* 9. 산정 기준 */}
      <H1 n={++n}>산정 기준 및 출처</H1>
      <Assumptions />
      <p className="mt-10 border-t border-slate-300 pt-3 text-center text-xs text-slate-500">
        초기 사업성 개략 검토(Pre-Feasibility)용 — 실제 사업 조건은 현장 실사·계통 검토·계약 협의에 따라 달라질 수 있음 · RMS Platform 분산에너지사업부
      </p>
    </div>
  );
}

/* ── 1. 입력값 ── */
function InputRecord({ input: i, companyName }: { input: SimInput; companyName: string }) {
  const self = i.mode === 'self';
  const items: [string, string][] = [
    ['업체', companyName || '-'],
    ['사업장', [i.site, i.address].filter(Boolean).join(' · ') || '-'],
    ['검토 방식', self ? '자가소비용' : 'OnSite PPA (리스형)'],
    ['지붕 가용면적', i.roof ? `${F(i.roof)} ㎡ (약 ${F(i.roof / (i.areaPerKw || 10))} kW)` : '-'],
    ['kW당 소요면적', `${i.areaPerKw} ㎡/kW`],
    ['일평균 발전시간', `${i.avgH} h/일`],
    ['모듈 효율감소율', `${i.deg} %/yr`],
    ['배출권 시세 (KAU)', `${F(i.kau)} 원/t · 상승률 ${i.kauEsc} %/yr`],
    ['전력 배출계수', `${i.co2f} t/MWh`],
    ['배출권 할당대상업체', i.ets ? '예' : '아니오'],
    ...(self
      ? ([
          ['태양광 설치용량', `${F(i.self.cap)} kW`],
          ['계약전력', i.self.ctr ? `${F(i.self.ctr)} kW` : '-'],
          ['월평균 전기사용량', `${F(i.self.usage)} kWh`],
          ['요금제', `${PLAN_LABEL[i.self.plan]} · ${VER_LABEL[i.self.ver]}`],
          ['전기요금 상승률', `${i.self.esc} %/yr`],
          ['기본요금 피크감축 반영률', `${i.self.peakR} %`],
        ] as [string, string][])
      : ([
          ['태양광 설치용량', `${F(i.ppa.cap)} kW`],
          ['비교 요금제', `${PLAN_LABEL[i.ppa.plan]} · ${VER_LABEL[i.ppa.ver]}`],
          ['한전요금 상승률', `${i.ppa.esc} %/yr`],
          ['기본요금 피크감축 반영률', `${i.ppa.peakR} %`],
          ...ppaSegs(i)
            .filter((sg) => sg.end >= sg.start)
            .map((sg): [string, string] => [`PPA ${sg.idx}구간 (${segLabel(sg)})`, sg.linked ? '한전 대체단가 연동' : `${F1(sg.price)} 원/kWh 고정`]),
          ['PPA 단가 상승률', `${i.ppa.ppaEsc} %/yr`],
        ] as [string, string][])),
  ];
  // 2열 표 (항목·값 | 항목·값)
  const pairs: [string, string][][] = [];
  for (let k = 0; k < items.length; k += 2) pairs.push(items.slice(k, k + 2));
  return (
    <>
      <table className="w-full border-collapse text-[13px]">
        <tbody>
          {pairs.map((p, k) => (
            <tr key={k}>
              <th className="w-[170px] border border-slate-300 bg-slate-100 px-3 py-1.5 text-left font-semibold text-slate-600">{p[0]![0]}</th>
              <td className="border border-slate-300 px-3 py-1.5 tabular-nums text-slate-900">{p[0]![1]}</td>
              <th className="w-[170px] border border-slate-300 bg-slate-100 px-3 py-1.5 text-left font-semibold text-slate-600">{p[1]?.[0]}</th>
              <td className="border border-slate-300 px-3 py-1.5 tabular-nums text-slate-900">{p[1]?.[1]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* 설치한 설비가 있을 때만 */}
      {i.facilities.some((f) => f.kw || f.genKwh || f.useKwh) && (
        <>
          <H2>기존 태양광 설비</H2>
          <T
            head={['No.', '설비 규모(kW)', '연간 발전량 (kWh)', '연간 사용량 (kWh)']}
            rows={i.facilities
              .filter((f) => f.kw || f.genKwh || f.useKwh)
              .map((f, k) => [k + 1, f.kw ? F2(f.kw) : '', f.genKwh ? F(f.genKwh) : '', f.useKwh ? F(f.useKwh) : ''])}
          />
        </>
      )}
    </>
  );
}

/* ── 2. 요약 ── */
function SelfKpis({ R }: { R: SelfResult }) {
  const sur = R.mrows.reduce((a, r) => a + r.surplus, 0);
  return (
    <>
      <Kpi
        tone="accent"
        k="연간 예상 발전량 (1차년)"
        v={`${F1(R.annualGen1 / 1000)} MWh`}
        s={
          <>
            일평균 발전시간 {F2(R.annualGen1 / R.cap / 365)}h · 자가소비율 {(R.selfRatio * 100).toFixed(1)}%
            {sur > 0 && <span className="ml-1 rounded bg-amber-100 px-1.5 text-amber-800">잉여 {F(sur / 1000)} MWh/년</span>}
          </>
        }
      />
      <Kpi tone="good" k="연간 절감액 (1차년)" v={`${EOK(R.save1)} 억원`} s={`전력량 ${F(R.eSave1 / 1e4)}만원 + 기본요금 ${F(R.bSave1 / 1e4)}만원${R.ets ? ` + 배출권 ${F(R.carbon1 / 1e4)}만원` : ''}`} />
      <Kpi tone="good" k="20년 누적 절감" v={`${EOK(R.cumSave)} 억원`} s={`연평균 ${EOK(R.cumSave / 20)}억 · 20년차 ${EOK(R.years[19]!.save)}억${R.ets ? ' · 배출권 합산' : ''}`} />
      <Kpi tone="accent" k="20년 온실가스 감축" v={`${F(R.cumCo2)} tCO₂`} s={`발전 ${F(R.cumGen / 1000)} MWh · 배출권 ${EOK(R.cumCarbon)}억${R.ets ? ' 합산' : ' (참고)'}`} />
    </>
  );
}
function PpaKpis({ R }: { R: PpaResult }) {
  const ff = R.firstFixed;
  const y1 = R.years[0]!;
  return (
    <>
      <Kpi tone="accent" k="연간 예상 발전량 (1차년)" v={`${F1(R.annualGen1 / 1000)} MWh`} s={`일평균 발전시간 ${F2(R.annualGen1 / R.cap / 365)}h · 설치용량 ${F(R.cap)}kW`} />
      <Kpi
        k="PPA 단가 구조 (20년)"
        v={
          <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
            {R.segs
              .filter((s) => s.end >= s.start)
              .map((s) => (
                <span key={s.idx} className="flex items-center gap-1">
                  <SegTag idx={s.idx}>{s.idx}구간</SegTag>
                  {segLabel(s)} · {s.linked ? '한전 연동' : `${F1(s.price)}원`}
                </span>
              ))}
          </span>
        }
        s={`20년 가중평균 PPA ${F1(R.avgPu)}원 vs 한전 ${F1(R.avgKu)}원/kWh → kWh당 ${F1(R.avgKu - R.avgPu)}원 절감 · 초기투자 0원`}
      />
      <Kpi
        tone="good"
        k="연간 절감액 (전기요금)"
        v={`${EOK(ff ? ff.saveD : y1.saveD)} 억원`}
        s={
          ff
            ? ff.y > 1
              ? `${ff.y}년차(고정단가 첫해) 기준 · 1차년 ${EOK(y1.saveD)}억(기본요금 절감분)`
              : `1차년 기준 · 한전 ${F1(y1.ku)}원 vs PPA ${F1(y1.pu)}원/kWh`
            : '전 구간 한전 연동 — 기본요금 절감분만 발생'
        }
      />
      <Kpi
        tone="good"
        k={`20년 누적 절감${R.ets ? ' (배출권 합산)' : ''}`}
        v={`${EOK(R.ets ? R.cumT : R.cumSaveD)} 억원`}
        s={`전기요금 ${EOK(R.cumSaveD)}억 ${R.ets ? `+ 배출권 ${EOK(R.cumCarbon)}억` : `· 배출권 참고가치 ${EOK(R.cumCarbon)}억`} · CO₂ ${F(R.cumCo2)} t`}
      />
    </>
  );
}
function Re100Note({ R }: { R: PpaResult }) {
  const y1 = R.years[0]!;
  return (
    <div className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-950">
      <b>RE100 이행 수단</b> — 온사이트 PPA로 사용하는 전력은 K-RE100 이행수단으로 인정되어 재생에너지 사용확인서 발급 대상입니다. 도입 시 연간 <b>{F1(R.annualGen1 / 1000)} MWh</b>의 재생에너지
      사용실적이 확보되고 Scope 2 배출량 연 <b>{F((R.annualGen1 / 1000) * R.co2f)} tCO₂</b> 감축 —{' '}
      {R.ets
        ? `할당대상업체로서 배출권 연 ${F(y1.carbon / 1e4)}만원(KAU ${F(R.kau)}원/t) 상당의 매각·구매회피 효과가 발생합니다.`
        : `배출권 할당대상업체라면 연 ${F(y1.carbon / 1e4)}만원(KAU ${F(R.kau)}원/t) 상당의 배출권 가치가 추가됩니다(참고).`}
    </div>
  );
}

/* ── 3. 추이 ── */
/** 누적 곡선 — 자가소비는 자부담에서 시작하는 J-curve(0 아래 빨강, 위 초록), PPA 는 누적 절감액 */
function CumChart({ R }: { R: SelfResult | PpaResult }) {
  const self = R.mode === 'self';
  const data = self
    ? [{ x: '0년(투자)', a: Math.round(-R.burden / 1e6), f: Math.round(-R.install / 1e6) }, ...R.years.map((r) => ({ x: `${r.y}년`, a: Math.round(r.cash / 1e6), f: Math.round(r.cashFull / 1e6) }))]
    : R.years.map((r) => ({ x: `${r.y}년`, a: Math.round(r.cumD / 1e6), b: Math.round(r.cumT / 1e6) }));
  const vals = data.map((d) => d.a);
  const max = Math.max(...vals, 0);
  const min = Math.min(...vals, 0);
  const zero = max === min ? 1 : max / (max - min); // 그라데이션에서 0 이 놓이는 위치
  const payback = self ? R.years.find((r) => r.cash >= 0)?.y : undefined;
  const paybackFull = self ? R.years.find((r) => r.cashFull >= 0)?.y : undefined;
  return (
    <div style={{ breakInside: 'avoid' }}>
      <H2>{self ? '투자 회수 곡선 (J-curve, 백만원)' : '20년 누적 절감액 (백만원)'}</H2>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data as Record<string, number | string>[]}>
            <defs>
              <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset={0} stopColor="#059669" stopOpacity={0.14} />
                <stop offset={zero} stopColor="#059669" stopOpacity={0.14} />
                <stop offset={zero} stopColor="#dc2626" stopOpacity={0.14} />
                <stop offset={1} stopColor="#dc2626" stopOpacity={0.14} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="x" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v: number) => v.toLocaleString()} width={56} />
            <Tooltip {...TIP} formatter={(v) => Number(v).toLocaleString()} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <Area dataKey="a" stroke="none" fill="url(#cumFill)" legendType="none" tooltipType="none" baseValue={0} />
            <Line
              dataKey="a"
              name={self ? '자부담 기준 (국비 70%)' : '누적 절감액 (전기요금)'}
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={(p: { cx?: number; cy?: number; value?: number; index?: number }) => (
                <circle key={p.index} cx={p.cx} cy={p.cy} r={3.5} fill={(p.value ?? 0) >= 0 ? '#2563eb' : '#dc2626'} />
              )}
            />
            {self && <Line dataKey="f" name="총사업비 기준 (국비 미반영)" stroke="#7c3aed" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 2.5 }} />}
            {!self && R.ets && <Line dataKey="b" name="누적 절감액 (배출권 합산)" stroke="#0891b2" strokeDasharray="5 4" dot={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {self && (
        <Note>
          설치단가 135만원/kW 기준 총사업비 {F(R.install / 1e6)}백만원, 국비 70% 사업이면 자부담 {F(R.burden / 1e6)}백만원. 0년(투자)에 그만큼 마이너스로 시작해 매년 절감액에서 O&amp;M(설치비의 1%)을 뺀 순절감을 쌓음 — 자부담 기준{' '}
          {payback ? `${payback}년차` : '20년 내 없음'}, 총사업비 기준 {paybackFull ? `${paybackFull}년차` : '20년 내 없음'}에 플러스 전환
        </Note>
      )}
    </div>
  );
}
function UnitChart({ R }: { R: PpaResult }) {
  return (
    <div style={{ breakInside: 'avoid' }}>
      <H2>연도별 적용단가 비교 — 한전 태양광 대체단가 vs PPA 적용단가 (원/kWh)</H2>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={R.years.map((r) => ({ x: `${r.y}년`, ku: +r.ku.toFixed(1), pu: +r.pu.toFixed(1) }))}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="x" tick={AXIS} axisLine={false} tickLine={false} interval={1} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} width={44} domain={['auto', 'auto']} />
            <Tooltip {...TIP} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line dataKey="ku" name="한전 태양광 대체단가 (가중, 상승률 반영)" stroke="#94a3b8" strokeDasharray="6 4" dot={{ r: 2 }} />
            <Line dataKey="pu" name="PPA 적용단가" stroke="#ea580c" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Note>
        두 선 사이 = kWh당 절감폭.{' '}
        {R.segs
          .filter((s) => s.end >= s.start)
          .map((s) => `${s.idx}구간 ${segLabel(s)} ${s.linked ? '한전 연동(기본요금 절감만)' : `${F1(s.price)}원/kWh 고정`}`)
          .join(' · ')}
      </Note>
    </div>
  );
}

/* ── 4. 20년 종합 ── */
function SelfSummary({ R }: { R: SelfResult }) {
  const last = R.years[19]!;
  return (
    <>
      <SumItem k="20년 총 발전량" v={`${F(R.cumGen / 1000)} MWh`} s={`1차년 ${F1(R.annualGen1 / 1000)} MWh`} />
      <SumItem k="20년 총 절감액" v={`${EOK(R.cumSave)} 억원`} s="전력량+기본요금" />
      <SumItem k="연평균 절감" v={`${EOK(R.cumSave / 20)} 억원`} s="20년 평균" />
      <SumItem k="1차년 절감" v={`${EOK(R.save1)} 억원`} s={`전력량 ${F(R.eSave1 / 1e4)}만원 + 기본요금 ${F(R.bSave1 / 1e4)}만원`} />
      <SumItem k="20년차 절감" v={`${EOK(last.save)} 억원`} s={`한전요금 ${(R.esc * 100).toFixed(1)}%/yr 상승 반영`} />
      <SumItem k="CO₂ 총감축" v={`${F(R.cumCo2)} t`} s={`소나무 ${F(R.cumCo2 * 151.5)}그루`} />
    </>
  );
}
function PpaSummary({ R }: { R: PpaResult }) {
  const tot = R.ets ? R.cumT : R.cumSaveD;
  return (
    <>
      <SumItem k="20년 총 발전량" v={`${F(R.cumGen / 1000)} MWh`} s={`1차년 ${F1(R.annualGen1 / 1000)} MWh`} />
      <SumItem k="20년 전기요금 절감" v={`${EOK(R.cumSaveD)} 억원`} s="한전요금 대비 (전력량+기본요금)" />
      <SumItem k="배출권 가치 20년" v={`${EOK(R.cumCarbon)} 억원`} s={`${R.ets ? '절감액 합산 (할당업체)' : '참고 — 비할당업체'} · ${F(R.kau)}원/t`} dim={!R.ets} />
      <SumItem k={`20년 총 절감${R.ets ? ' (합산)' : ''}`} v={`${EOK(tot)} 억원`} s={`연평균 ${EOK(tot / 20)}억 · 투자 0원`} />
      <SumItem k="한전 총액 vs PPA 총액" v={`${EOK(R.sumKep)} vs ${EOK(R.sumPpa)}`} s="억원 (20년)" />
      <SumItem k="kWh당 평균 절감 (20년)" v={`${F1(R.avgKu - R.avgPu)} 원`} s={`한전 ${F1(R.avgKu)} vs PPA ${F1(R.avgPu)}`} />
    </>
  );
}
function EffPanel({ R, toe }: { R: SelfResult | PpaResult; toe: number }) {
  const lines: [ReactNode, string, boolean?, boolean?][] =
    R.mode === 'self'
      ? [
          ['20년 총 발전량', `${F1(R.cumGen / 1000)} MWh`],
          ['20년 한전요금 절감 (전력량+기본)', `${F(R.years.reduce((a, q) => a + q.eSave + q.bSave, 0))} 원`],
          [`배출권 가치 20년 (${F(R.kau)}원/t)${R.ets ? '' : ' — 참고'}`, `${F(R.cumCarbon)} 원`, false, !R.ets],
          [`20년 총 절감액${R.ets ? ' (배출권 합산)' : ''}`, `${F(R.cumSave)} 원`, true],
          ['RE100 재생에너지 실적', `${F1(R.cumGen / 1000)} MWh`],
        ]
      : [
          ['20년 총 발전량', `${F1(R.cumGen / 1000)} MWh`],
          ['한전요금 기준 총액', `${F(R.sumKep)} 원`],
          ['PPA 요금 총액', `${F(R.sumPpa)} 원`],
          [
            `월평균 PPA 납입료 (1차년${R.firstFixed && R.firstFixed.y > 1 ? ` / ${R.firstFixed.y}년차` : ''})`,
            `${F(R.years[0]!.ppaAmt / 12)}${R.firstFixed && R.firstFixed.y > 1 ? ` / ${F(R.firstFixed.ppaAmt / 12)}` : ''} 원`,
          ],
          ['20년 전기요금 절감 (투자 0원)', `${F(R.cumSaveD)} 원`],
          [`배출권 가치 20년 (${F(R.kau)}원/t${R.ets ? '' : ' · 참고'})`, `${F(R.cumCarbon)} 원`, false, !R.ets],
          [`20년 총 절감액${R.ets ? ' (배출권 합산)' : ''}`, `${F(R.ets ? R.cumT : R.cumSaveD)} 원`, true],
          ['RE100 재생에너지 실적', `${F1(R.cumGen / 1000)} MWh`],
        ];
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
      <table className="w-full border-collapse text-[13px]">
        <tbody>
          {lines.map(([k, v, hl, dim], idx) => (
            <tr key={idx}>
              <th className="border border-slate-300 bg-slate-100 px-3 py-1.5 text-left font-semibold text-slate-600">{k}</th>
              <td className={cn('border border-slate-300 px-3 py-1.5 text-right tabular-nums', hl ? 'font-bold text-orange-600' : dim ? 'text-slate-400' : 'text-slate-900')}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            [F1(toe), '화석에너지 대체 (TOE)'],
            [F1(R.cumCo2), '온실가스 저감 (tCO₂)'],
            [F(R.cumCo2 * 151.5), '소나무 식재 (그루)'],
          ].map(([v, l]) => (
            <div key={l} className="rounded-md border border-slate-200 px-2 py-3">
              <p className="text-lg font-bold text-blue-700 tabular-nums">{v}</p>
              <p className="mt-1 text-xs text-slate-500">{l}</p>
            </div>
          ))}
        </div>
        <Note>산출식: TOE = MWh × 0.229 / tCO₂ = MWh × {R.co2f} / 식재 = tCO₂ × 151.5</Note>
      </div>
    </div>
  );
}

/* ── 5. 시나리오 ── */
function ScenTable({ sc, scen, self, ets }: { sc: ReturnType<typeof scenarios>; scen: number; self: boolean; ets: boolean }) {
  const tag = (k: number) => (
    <span className="rounded px-2 py-0.5 text-xs font-semibold text-white" style={{ background: SCEN_COLOR[k] }}>
      {sc[k]!.name}
    </span>
  );
  if (self) {
    return (
      <>
        <T
          small
          cur={scen}
          head={['시나리오', '20년 한전요금 절감 (전력량+기본)', `배출권 가치${ets ? ' (합산)' : ' (참고)'}`, '20년 총 절감', '연평균 절감', '1차년 절감', '20년차 절감']}
          rows={sc.map((x, k) => {
            const r = x.R as SelfResult;
            const eb = r.years.reduce((a, q) => a + q.eSave + q.bSave, 0);
            return [tag(k), EOK(eb), <Dim key="d" on={ets}>{EOK(r.cumCarbon)}</Dim>, <b key="b">{EOK(r.cumSave)}</b>, EOK(r.cumSave / 20), EOK(r.years[0]!.save), EOK(r.years[19]!.save)];
          })}
        />
        <Note>강조 행 = 이 문서에 적용한 시나리오. 동결(0%)은 한전요금이 20년간 현 수준 유지 시의 최소 기대치.</Note>
      </>
    );
  }
  return (
    <>
      <T
        small
        cur={scen}
        head={['시나리오', '한전 총액', 'PPA 총액', '전기요금 절감', `배출권${ets ? ' (합산)' : ' (참고)'}`, '20년 총 절감', '연평균', '한전 평균단가', 'kWh당 절감', '1차년 절감', '고정단가 첫해', '20년차 절감']}
        rows={sc.map((x, k) => {
          const r = x.R as PpaResult;
          const tot = r.ets ? r.cumT : r.cumSaveD;
          const ff = r.firstFixed;
          return [tag(k), EOK(r.sumKep), <Blue key="p">{EOK(r.sumPpa)}</Blue>, EOK(r.cumSaveD), <Dim key="d" on={ets}>{EOK(r.cumCarbon)}</Dim>, <b key="t">{EOK(tot)}</b>, EOK(tot / 20), F1(r.avgKu), <Pos key="k" v={1}>{F1(r.avgKu - r.avgPu)}</Pos>, EOK(r.years[0]!.saveD), ff ? `${EOK(ff.saveD)} (${ff.y}년차)` : '—', EOK(r.years[19]!.saveD)];
        })}
      />
      <Note>강조 행 = 이 문서에 적용한 시나리오. 한전 연동 구간은 어느 시나리오에서도 절감이 기본요금분에 한정되고, 고정단가 구간의 절감폭은 한전 상승률에 비례해 확대.</Note>
    </>
  );
}

/* ── 8. 연도별 ── */
function SelfYears({ R, cur }: { R: SelfResult; cur: number }) {
  const sum = (f: (r: SelfResult['years'][number]) => number) => R.years.reduce((a, r) => a + f(r), 0);
  return (
    <T
      small
      cur={cur}
      head={['연차', '발전량 (MWh)', '전력량 절감', '기본요금 절감', `배출권 가치${R.ets ? '' : ' (참고)'}`, `연간 절감${R.ets ? ' (합산)' : ''}`, '누적 절감', 'CO₂ 감축 (t)', '누적 CO₂ (t)']}
      rows={R.years.map((r) => [`${r.y}년차`, F1(r.gen / 1000), <Blue key="e">{F(r.eSave / 1e6)}</Blue>, <Blue key="b">{F(r.bSave / 1e6)}</Blue>, <Dim key="c" on={R.ets}>{F1(r.carbon / 1e6)}</Dim>, <Pos key="s" v={r.save}>{F(r.save / 1e6)}</Pos>, <b key="p">{F(r.cum / 1e6)}</b>, F(r.co2), F(r.cumCo2)])}
      total={[['20년 합계', F1(R.cumGen / 1000), F(sum((r) => r.eSave) / 1e6), F(sum((r) => r.bSave) / 1e6), F1(R.cumCarbon / 1e6), F(R.cumSave / 1e6), F(R.cumSave / 1e6), F(R.cumCo2), '']]}
    />
  );
}
function PpaYears({ R, cur }: { R: PpaResult; cur: number }) {
  return (
    <T
      small
      cur={cur}
      head={['연차', '구간', '발전량', '한전 단가', 'PPA 단가', '한전 기준액', 'PPA 요금', '월평균 납입료 (만원)', '기본요금 절감', '전기요금 절감', `배출권${R.ets ? '' : ' (참고)'}`, `연간 절감${R.ets ? ' (합산)' : ''}`, '누적 절감', 'CO₂ (t)']}
      rows={R.years.map((r) => [`${r.y}년차`, <SegTag key="s" idx={r.seg}>{`${r.seg}${r.linked ? '·연동' : ''}`}</SegTag>, F1(r.gen / 1000), F1(r.ku), <Blue key="p">{F1(r.pu)}</Blue>, F(r.kep / 1e6), <Blue key="a">{F(r.ppaAmt / 1e6)}</Blue>, <Blue key="m">{F(r.ppaAmt / 12 / 1e4)}</Blue>, <Blue key="b">{F(r.bSave / 1e6)}</Blue>, <Pos key="d" v={r.saveD}>{F(r.saveD / 1e6)}</Pos>, <Dim key="c" on={R.ets}>{F1(r.carbon / 1e6)}</Dim>, <Pos key="t" v={r.saveT}>{F(r.saveT / 1e6)}</Pos>, <b key="u">{F(r.cumT / 1e6)}</b>, F(r.co2)])}
      total={[['20년 합계', '', F1(R.cumGen / 1000), F1(R.avgKu), F1(R.avgPu), F(R.sumKep / 1e6), F(R.sumPpa / 1e6), '—', F(R.years.reduce((a, r) => a + r.bSave, 0) / 1e6), F(R.cumSaveD / 1e6), F1(R.cumCarbon / 1e6), F(R.cumT / 1e6), F(R.cumT / 1e6), F(R.cumCo2)]]}
    />
  );
}

/* ── 9. 산정 기준 ── */
function Assumptions() {
  const rows: [string, string][] = [
    ['발전량 산식', '설치용량(kW) × 일평균 발전시간(기본 3.82h) × 365일 × 효율감소계수. 월별 배분은 기상청 울산관측소(지점 152) 기후평년값 1991~2020 월별 일조시간(연 2,249.5h) 비중 적용. 3.82h/일은 시스템 손실 반영 환산치로 전국 태양광 평균 이용률 16.75%(일 4.02h) 대비 보수적 설정. 효율감소는 2차년도부터 매년 0.5%p'],
    ['한전 요금단가', '산업용(을) 고압A 선택Ⅰ·Ⅱ, 2025-04-01 시행 확정단가. 2026-04-16 개편 모드는 정부 발표 증감폭(최대부하 여름·겨울 -16.9원, 봄가을 -13.2원 / 경부하 +5.1원)을 적용한 참고용 계산값. 기후환경요금 9.0원/kWh, 연료비조정 +5.0원/kWh, 전력산업기반기금 3.7% 가산, 부가세 제외'],
    ['전기요금 상승률', '산업용 평균판매단가 실적 2019 106.6 → 2025 181.9원/kWh, 6년 연평균(CAGR) 9.3%. 기본값 2.5%는 최근 급등이 연료비 정상화에 따른 일시적 구간임을 감안한 보수적 설정 — 0% / 2.5% / 9.3% 시나리오 제공'],
    ['모듈 열화율', '주요 제조사 선형 출력보증 기준 — 1년차 98%, 이후 연 최대 0.5% 열화, 25년차 86% 보증'],
    ['절감단가 매칭', '발전 시간대 분포를 요금 시간대에 매칭 — 개편 후: 중간부하 70% + 최대부하 30% / 개편 전: 여름·봄가을 최대 52%·중간 48%, 겨울 최대 45%·중간 55%'],
    ['기본요금 절감', '기본요금 단가 × 설치용량 × 피크감축 반영률(기본 30%)로 보수적 반영 — 태양광은 피크 시점 출력을 보장하지 못함'],
    ['OnSite PPA 구조', '사업자가 설비 투자·설치·운영·유지보수 전액 부담, 소비자는 부지(지붕)만 제공하고 사용분을 PPA 단가로 지불. 계약기간 20년. PPA 배정 잔여용량 약 2.67MW'],
    ['구간별 PPA 단가', '20년을 2구간으로 분할. 설치비 과중 현장은 1구간을 한전 대체단가 연동(절감은 기본요금분만), 2구간부터 고정 PPA 단가 적용. 고정단가 상승률은 구간 시작연차 기준 누적'],
    ['자가소비 처리', '월 발전량이 월 사용량을 초과하는 잉여전력은 절감액 산정에서 제외(역송 정산 미반영, 보수적)'],
    ['환경 편익', '전력배출계수 기본 0.4173 tCO₂eq/MWh(2023 국가 전력배출계수) · 소나무 환산 tCO₂ × 151.5그루'],
    ['탄소배출권 가치', '연간 발전량(MWh) × 배출계수 × KAU 시세(기본 30,000원/t) × (1+상승률)^(연차-1). 할당대상업체(체크)일 때만 절감액에 합산, 비할당업체는 참고(잠재가치)'],
    ['RE100 관련', '온사이트 PPA·자가발전 전력은 K-RE100 이행수단으로 인정되어 재생에너지 사용확인서 발급 대상'],
    ['미반영 항목', '잉여전력 판매(상계·현물), REC·자발적 탄소시장 수익, 금융조달 구조, 법인세 효과, 배출권 거래 수수료·세금 — 정밀 검토 단계에서 반영'],
  ];
  return (
    <table className="w-full border-collapse text-[13px]">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th className="w-[150px] border border-slate-300 bg-slate-100 px-3 py-2 text-left align-top font-semibold text-slate-700">{k}</th>
            <td className="border border-slate-300 px-3 py-2 leading-relaxed text-slate-700">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 목록 표시에 쓰는 한 줄 요약 */
export function simHeadline(input: SimInput) {
  const R = calc(input);
  return {
    mode: R.mode === 'self' ? '자가소비' : 'onsite',
    cap: R.cap,
    gen1: R.annualGen1,
    save20: R.mode === 'self' ? R.cumSave : R.ets ? R.cumT : R.cumSaveD,
  };
}
