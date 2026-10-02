'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  CAGR,
  EOK,
  F,
  F1,
  F2,
  MNAME,
  PLAN_LABEL,
  SCEN_COLOR,
  SELF_CAPEX_UNIT,
  SELF_EXTRA_COST,
  SELF_OM,
  SELF_REMAIN,
  VER_LABEL,
  calc,
  escInput,
  monthlyFor,
  ppaSegs,
  saveUnit,
  scenarios,
  segLabel,
  segOfYear,
  selfCost,
  type PpaResult,
  type SelfResult,
  type SimInput,
} from '@/lib/solar-sim';

/**
 * 태양광 사업성 검토서 — 울산미포산단 태양광 사업성 시뮬레이터 v1.1 오른쪽 화면을 그대로 옮긴다(실무진 검토 값).
 * 순서: 시나리오 → KPI → 월별 발전량 · 누적(자가소비 J-Curve / PPA 누적 절감) → (PPA만) 연도별 적용단가 → 20년 종합 요약
 *      → 민감도 → 20년간 운영 분석 · 누적 효과(마무리) → 산정 기준(접어 둠). 시나리오별 최종 결과 비교 표는 쓰지 않는다
 * 적용 전기요금 단가 · 월별 상세 · 연도별 20년 종합 분석 표는 쓰지 않는다(사용자 지시 — 20년 운영 분석으로 마무리)
 * 원본과 다른 점(사용자 지시): 머리 아래는 작성일만, 맨 위 검토 입력값 기록, KPI 2칸, 그래프 위아래, 이모지·색 줄 없음,
 * 3구간 없음, 산정 기준은 접어 둠, 날짜는 하이픈 양식, 그래프는 움직임 없이 바로 다 그린다.
 */

/** 사업 검토서 기록 — 번호·일시 (저장된 검토만) */
export interface ReviewRecord {
  no: string;
  at: string; // 2026-10-02 14:32
}

const SEG_COLOR = ['#64748b', '#2563eb', '#0891b2'];
const AXIS = { fontSize: 11, fill: '#64748b' };
const GRID = '#eef2f7';
const TIP = { contentStyle: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 } };
const NO_ANIM = { isAnimationActive: false } as const; // 그리다 만 선이 보이지 않게

/* ── 조각 ── */
/** 원본 .card — 흰 카드 + 회색 소제목 */
function Card({ title, right, children, className }: { title: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 rounded-xl border border-slate-200 bg-white px-5 pb-4 pt-5', className)} style={{ breakInside: 'avoid' }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[13px] font-bold tracking-wide text-slate-500">{title}</p>
        {right}
      </div>
      {children}
    </div>
  );
}
const Note = ({ children }: { children: ReactNode }) => <p className="mt-2.5 text-xs leading-relaxed text-slate-500">{children}</p>;
/** 숫자 표 — 첫 열 가운데, 나머지 오른쪽 */
function T({ head, rows, total, cur }: { head: ReactNode[]; rows: ReactNode[][]; total?: ReactNode[][]; cur?: number }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="bg-slate-50 text-slate-500">
          {head.map((h, i) => (
            <th key={i} className={cn('whitespace-nowrap border-b border-slate-200 px-3 py-2 font-bold', i === 0 ? 'text-center' : 'text-right')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className={cn('border-b border-slate-100', ri === cur && 'bg-blue-50')}>
            {r.map((c, i) => (
              <td key={i} className={cn('whitespace-nowrap px-3 py-2 tabular-nums', i === 0 ? 'text-center font-bold text-slate-500' : 'text-right text-slate-700')}>
                {c}
              </td>
            ))}
          </tr>
        ))}
        {total?.map((r, ri) => (
          <tr key={`t${ri}`} className="border-t-2 border-slate-200 bg-slate-100 font-bold">
            {r.map((c, i) => (
              <td key={i} className={cn('whitespace-nowrap px-3 py-2 tabular-nums text-slate-900', i === 0 ? 'text-center' : 'text-right')}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function Kpi({ k, v, s }: { k: string; v: ReactNode; s: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4" style={{ breakInside: 'avoid' }}>
      <p className="text-xs font-bold tracking-wide text-slate-500">{k}</p>
      <div className="mt-1.5 text-[22px] font-extrabold text-slate-900 tabular-nums">{v}</div>
      <div className="mt-1 text-xs leading-relaxed text-slate-500">{s}</div>
    </div>
  );
}
function SumItem({ k, v, s, dim }: { k: string; v: ReactNode; s: ReactNode; dim?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-center">
      <p className="text-xs font-bold text-slate-500">{k}</p>
      <p className={cn('mt-1.5 text-base font-extrabold tabular-nums', dim ? 'text-slate-400' : 'text-slate-900')}>{v}</p>
      <p className="mt-0.5 text-xs leading-snug text-slate-500">{s}</p>
    </div>
  );
}
const Blue = ({ children }: { children: ReactNode }) => <span className="text-blue-700">{children}</span>;
const Dim = ({ on, children }: { on: boolean; children: ReactNode }) => <span className={on ? 'text-blue-700' : 'text-slate-400'}>{children}</span>;
const SegTag = ({ idx, children }: { idx: number; children: ReactNode }) => (
  <span className="inline-block rounded px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ background: SEG_COLOR[idx - 1] }}>
    {children}
  </span>
);
/** 연차 선택 — 원본처럼 ◀ 레인지 ▶ + 'n차년 (한전 +x%)'. 손잡이는 파란 원으로 잘 보이게 */
function YearSel({ value, onChange, esc }: { value: number; onChange: (v: number) => void; esc: number }) {
  const pct = ((value - 1) / 19) * 100;
  const step = (d: number) => onChange(Math.min(20, Math.max(1, value + d)));
  const btn = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700';
  return (
    <div data-noprint className="mb-3 flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="whitespace-nowrap text-xs font-bold text-slate-500">연차 선택</span>
      <button type="button" className={btn} onClick={() => step(-1)} aria-label="이전 연차">
        <ChevronLeft size={14} />
      </button>
      <input
        type="range"
        min={1}
        max={20}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="연차"
        style={{ background: `linear-gradient(to right, #2563eb ${pct}%, #cbd5e1 ${pct}%)` }}
        className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_#2563eb,0_2px_6px_rgba(37,99,235,.45)]"
      />
      <button type="button" className={btn} onClick={() => step(1)} aria-label="다음 연차">
        <ChevronRight size={14} />
      </button>
      <span className="w-[124px] whitespace-nowrap text-right text-xs font-bold text-blue-700 tabular-nums">
        {value}차년 (한전 +{((Math.pow(1 + esc, value - 1) - 1) * 100).toFixed(1)}%)
      </span>
    </div>
  );
}

export function SimReport({ input, companyName, record, autoPdf }: { input: SimInput; companyName: string; record?: ReviewRecord; autoPdf?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scen, setScen] = useState(1);
  const [mY, setMY] = useState(1);
  const [showBasis, setShowBasis] = useState(false); // 산정 기준 및 출처 — 참고용, 펼칠 때만
  const sc = useMemo(() => scenarios(input), [input]);
  const R = sc[scen]!.R;
  const self = R.mode === 'self';
  const ver = R.ver;
  const written = (record?.at ?? new Date().toISOString()).slice(0, 10);
  const rows = monthlyFor(R, mY);

  // PDF — 문서만 새 창에 옮겨 인쇄(PDF 저장)
  const pdf = () => {
    const html = ref.current?.outerHTML;
    if (!html) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((el) => el.outerHTML).join('');
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${record?.no ?? companyName} 태양광 사업성 검토</title>${styles}<style>@page{size:A4;margin:10mm}body{background:#fff}[data-noprint]{display:none!important}</style></head><body>${html}</body></html>`,
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

  const segNow = self ? null : segOfYear(R, mY);

  return (
    <div ref={ref} className="mx-auto w-full max-w-[1100px] space-y-5 rounded-sm bg-[#f4f7fb] px-6 py-8 text-slate-900 shadow-2xl sm:px-9">
      {/* 머리 — 제목 · 작성일, 오른쪽 PDF */}
      <div className="flex items-end justify-between gap-4 border-b-2 border-slate-900 pb-3.5">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">
            울산미포산단 태양광 사업성 검토
            <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 align-middle text-[11px] font-extrabold text-blue-700">{self ? '자가소비용' : 'OnSite PPA (리스형)'}</span>
          </h1>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">작성일 {written}</p>
        </div>
        <div data-noprint>
          <Button onClick={pdf}>
            <Download size={14} className="mr-1.5" /> PDF 저장
          </Button>
        </div>
      </div>

      <InputRecord input={input} companyName={companyName} />

      {/* 한전요금 시나리오 */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
        <span className="whitespace-nowrap text-[11px] font-bold tracking-wide text-slate-500">한전요금 시나리오</span>
        <div className="flex flex-1 gap-1.5 rounded-lg bg-slate-100 p-1">
          {sc.map((x, k) => {
            const r = x.R;
            const res = r.mode === 'self' ? `20년 절감 ${EOK(r.cumSave)}억 · 순현금 ${EOK(r.years[19]!.cum)}억` : `20년 절감 ${EOK(r.ets ? r.cumT : r.cumSaveD)}억 · kWh당 ${F1(r.avgKu - r.avgPu)}원`;
            const sub = k === 0 ? '0%/yr · 최소 기대치' : k === 1 ? `${(escInput(input) * 100).toFixed(1)}%/yr · 입력값` : `${(CAGR * 100).toFixed(1)}%/yr · 2019~2025 산업용 실적`;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setScen(k)}
                className={cn('flex flex-1 flex-col items-center gap-0.5 rounded-md px-2 py-2 text-[12.5px] font-bold transition-colors', scen === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-200')}
              >
                <span>{['한전요금 동결', '상승분 반영 (입력값)', '실적 CAGR 반영'][k]}</span>
                <small className={cn('text-[10.5px] font-semibold', scen === k ? 'text-blue-700' : 'text-slate-400')}>{sub}</small>
                <span className={cn('text-[11px] font-extrabold tabular-nums', scen === k ? 'text-blue-700' : 'text-slate-700')}>{res}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 배너 */}
      {self && R.cap > SELF_REMAIN && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-[12.5px] leading-relaxed text-amber-900">
          <p className="mb-1.5 text-[13px] font-extrabold">자가소비 배정 잔여용량 초과</p>
          울산 에너지자급자족 사업의 자가소비형 잔여 배정용량은 약 <b>{SELF_REMAIN}kW(0.32MW)</b>입니다. 입력 용량 {F(R.cap)}kW 중 초과분은 자가소비 배정에서 제외될 수 있어, 초과 용량은{' '}
          <b>OnSite PPA(리스형)</b> 검토를 권장합니다 — 초기투자 0원, 구간별 PPA 단가 적용(초기 구간 한전요금 연동 가능).
        </div>
      )}
      {!self && <Re100Card R={R} />}

      {/* KPI */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{self ? <SelfKpis R={R} /> : <PpaKpis R={R} />}</div>

      {/* 월별 발전량 */}
      <Card
        title={
          self
            ? `월별 예상 발전량 (${mY}차년)`
            : `월별 발전량 · 한전요금 대비 PPA 납입료 (${mY}차년 · ${segNow!.idx}구간${segNow!.linked ? ' 한전 연동' : ` 고정 ${F1(rows[0]!.pu)}원`})`
        }
      >
        <YearSel value={mY} onChange={setMY} esc={R.esc} />
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows.map((r, m) => ({ m: MNAME[m], gen: Math.round(r.g), kep: Math.round(r.kepco / 1e4), pay: Math.round(r.ppaCost / 1e4) }))}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="m" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis yAxisId="g" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v: number) => v.toLocaleString()} width={60} />
              {!self && <YAxis yAxisId="w" orientation="right" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v: number) => v.toLocaleString()} width={52} />}
              <Tooltip {...TIP} formatter={(v) => Number(v).toLocaleString()} />
              {!self && <Legend verticalAlign="top" wrapperStyle={{ fontSize: 10 }} />}
              <Bar yAxisId="g" dataKey="gen" name="발전량 (kWh)" fill="rgba(37,99,235,.55)" radius={[4, 4, 0, 0]} {...NO_ANIM} />
              {!self && <Line yAxisId="w" dataKey="kep" name="한전요금 기준액 (만원)" stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 2.5 }} {...NO_ANIM} />}
              {!self && <Line yAxisId="w" dataKey="pay" name="PPA 납입료 (만원)" stroke="#ea580c" strokeWidth={2.5} dot={{ r: 3 }} {...NO_ANIM} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {!self && (
          <Note>
            ※ 한전 기준액(회색 점선)은 계절별 단가 차등이 반영되어 발전량과 비례하지 않음 — {mY}차년 태양광 대체단가: 여름 {F1(saveUnit(0, R.plan, ver) * Math.pow(1 + R.esc, mY - 1))}원 / 봄가을{' '}
            {F1(saveUnit(1, R.plan, ver) * Math.pow(1 + R.esc, mY - 1))}원 / 겨울 {F1(saveUnit(2, R.plan, ver) * Math.pow(1 + R.esc, mY - 1))}원/kWh (상승률 {(R.esc * 100).toFixed(1)}%/yr 누적).{' '}
            {segNow!.linked
              ? `${mY}차년은 ${segNow!.idx}구간 한전 연동으로 PPA 납입료(주황)가 한전 기준액과 동일 — 전력량요금 절감 0, 기본요금 절감만 발생`
              : `PPA 납입료(주황)는 ${segNow!.idx}구간 고정단가 ${F1(rows[0]!.pu)}원/kWh로 발전량에 정비례`}{' '}
            · 연간 절감 {F((R as PpaResult).years[mY - 1]!.saveD / 1e4)}만원
          </Note>
        )}
      </Card>

      {/* 누적 — 자가소비: 투자 회수 곡선(J-Curve) / PPA: 수요자 20년 누적 절감액 */}
      <CumChart R={R} />

      {/* PPA 에만 있는 그래프 */}
      {!self && <UnitCard R={R} />}

      {/* 20년 종합 요약 */}
      <Card title="20년 종합 요약 (Summary)">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{self ? <SelfSummary R={R} /> : <PpaSummary R={R} />}</div>
      </Card>

      {/* 민감도 */}
      <Card title="민감도 분석 — 한전요금 상승률 시나리오별 20년 누적 (백만원)">
        <div className="h-[250px]">
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
              <XAxis dataKey="x" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v: number) => v.toLocaleString()} width={56} />
              <Tooltip {...TIP} formatter={(v) => Number(v).toLocaleString()} />
              <Legend verticalAlign="top" wrapperStyle={{ fontSize: 10 }} />
              <ReferenceLine y={0} stroke="#cbd5e1" />
              {sc.map((s, j) => (
                <Line key={j} dataKey={`s${j}`} name={s.name} stroke={SCEN_COLOR[j]} strokeWidth={j === scen ? 3 : 1.8} strokeDasharray={j === scen ? undefined : '5 4'} dot={false} {...NO_ANIM} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>


      {/* 20년간 운영 분석 · 20년 누적 효과 분석 */}
      {/* PDF 로 뽑으니 스크롤 없이 20년 전부 — 운영 분석 한 칸, 누적 효과는 따로 */}
      <Card title={self ? '20년간 운영 분석 (발전량 및 절감수익)' : '20년간 운영 분석 (발전량·납입료·절감액)'}>
        <div className="overflow-hidden rounded-lg border border-slate-100">
          <OpTable R={R} cur={mY - 1} />
        </div>
      </Card>
      <Card title="20년 누적 효과 분석">
        <EffPanel R={R} />
      </Card>

      {/* 산정 기준 및 출처 — 참고용, 접어 둔다 */}
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div data-noprint>
          <Button size="sm" onClick={() => setShowBasis((v) => !v)}>
            {showBasis ? '산정 기준 및 출처 접기' : '산정 기준 및 출처 보기'}
          </Button>
        </div>
        {showBasis && (
          <div className="mt-4">
            <p className="mb-3 text-[13px] font-bold tracking-wide text-slate-500">산정 기준 및 출처 (Logic Reference)</p>
            <Assumptions />
          </div>
        )}
        <Note>
          본 시뮬레이터는 초기 사업성 개략 검토(Pre-Feasibility)용으로 작성되었으며, 실제 사업 조건은 현장 실사·계통 검토·계약 협의에 따라 달라질 수 있습니다. — RMS Platform 분산에너지사업부
        </Note>
      </div>
    </div>
  );
}

/* ── 검토 입력값 (사용자 요청 — 어떤 값으로 계산했는지 기록) ── */
function InputRecord({ input: i, companyName }: { input: SimInput; companyName: string }) {
  const self = i.mode === 'self';
  const cost = selfCost(i);
  const items: [string, string][] = [
    ['업체', companyName || '-'],
    ['사업장', [i.site, i.address].filter(Boolean).join(' · ') || '-'],
    ['검토 방식', self ? '자가소비용' : 'OnSite PPA (리스형)'],
    ['지붕 가용면적', i.roof ? `${F(i.roof)} ㎡ (약 ${F(i.roof / (i.areaPerKw || 10))} kW)` : ''],
    ['일평균 발전시간', `${i.avgH} h/일`],
    ['모듈 효율감소율', `${i.deg} %/yr`],
    ['배출권 시세 (KAU)', `${F(i.kau)} 원/t · 상승률 ${i.kauEsc} %/yr`],
    ['전력 배출계수', `${i.co2f} t/MWh`],
    ['배출권 할당대상업체', i.ets ? '예' : '아니오'],
    ...(self
      ? ([
          ['태양광 설치용량', `${F(i.self.cap)} kW`],
          ['계약전력', i.self.ctr ? `${F(i.self.ctr)} kW` : ''],
          ['월평균 전기사용량', `${F(i.self.usage)} kWh`],
          ['요금제 · 요금 기준', `${PLAN_LABEL[i.self.plan]} · ${VER_LABEL[i.self.ver]}`],
          ['전기요금 상승률', `${i.self.esc} %/yr`],
          ['기본요금 피크감축 반영률', `${i.self.peakR} %`],
          ['설치단가', `${F(i.self.capexUnit ?? SELF_CAPEX_UNIT)} 원/kW`],
          ['추가 시공비 (변압기 등)', `${F(i.self.extraCost ?? SELF_EXTRA_COST)} 원`],
          ['소비자 부담 (설치비 + 추가 시공비)', `${F(cost.consumer)} 원`],
          ['연간 O&M (사업비 대비)', `${i.self.om ?? SELF_OM} %`],
        ] as [string, string][])
      : ([
          ['태양광 설치용량', `${F(i.ppa.cap)} kW`],
          ['비교 요금제 · 요금 기준', `${PLAN_LABEL[i.ppa.plan]} · ${VER_LABEL[i.ppa.ver]}`],
          ['한전요금 상승률', `${i.ppa.esc} %/yr`],
          ['기본요금 피크감축 반영률', `${i.ppa.peakR} %`],
          ...ppaSegs(i)
            .filter((sg) => sg.idx <= 2 && sg.end >= sg.start)
            .map((sg): [string, string] => [`${sg.idx}구간 (${segLabel(sg)})`, sg.linked ? '한전 대체단가 연동' : `${F1(sg.price)} 원/kWh 고정`]),
          ['PPA 단가 상승률', `${i.ppa.ppaEsc} %/yr`],
        ] as [string, string][])),
  ];
  const pairs: [string, string][][] = [];
  for (let k = 0; k < items.length; k += 2) pairs.push(items.slice(k, k + 2));
  const fac = i.facilities.filter((f) => f.kw || f.genKwh || f.useKwh);
  return (
    <Card title="검토 입력값">
      <table className="w-full border-collapse text-xs">
        <tbody>
          {pairs.map((p, k) => (
            <tr key={k}>
              <th className="w-[170px] border border-slate-200 bg-slate-50 px-3 py-1.5 text-left font-bold text-slate-500">{p[0]![0]}</th>
              <td className="border border-slate-200 px-3 py-1.5 tabular-nums text-slate-900">{p[0]![1]}</td>
              <th className="w-[170px] border border-slate-200 bg-slate-50 px-3 py-1.5 text-left font-bold text-slate-500">{p[1]?.[0]}</th>
              <td className="border border-slate-200 px-3 py-1.5 tabular-nums text-slate-900">{p[1]?.[1]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {fac.length > 0 && (
        <>
          <p className="mb-2 mt-4 text-xs font-bold text-slate-500">기존 태양광 설비</p>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                {['No.', '설비 규모(kW)', '연간 발전량 (kWh)', '연간 사용량 (kWh)'].map((h, k) => (
                  <th key={h} className={cn('border border-slate-200 px-3 py-1.5 font-bold', k === 0 ? 'text-center' : 'text-right')}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fac.map((f, k) => (
                <tr key={k}>
                  <td className="border border-slate-200 px-3 py-1.5 text-center text-slate-500">{k + 1}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right tabular-nums">{f.kw ? F2(f.kw) : ''}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right tabular-nums">{f.genKwh ? F(f.genKwh) : ''}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right tabular-nums">{f.useKwh ? F(f.useKwh) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
}

/* ── KPI ── */
function SelfKpis({ R }: { R: SelfResult }) {
  const sur = R.mrows.reduce((a, r) => a + r.surplus, 0);
  return (
    <>
      <Kpi
        k="연간 예상 발전량 (1차년)"
        v={`${F1(R.annualGen1 / 1000)} MWh`}
        s={
          <>
            일평균 발전시간 {F2(R.annualGen1 / R.cap / 365)}h · 자가소비율 {(R.selfRatio * 100).toFixed(1)}%
            {sur > 0 && <span className="ml-1 rounded bg-amber-100 px-1.5 font-bold text-amber-700">잉여 {F(sur / 1000)} MWh/년</span>}
          </>
        }
      />
      <Kpi k="연간 절감액 (1차년)" v={`${EOK(R.save1)} 억원`} s={`전력량 ${F(R.eSave1 / 1e4)}만원 + 기본요금 ${F(R.bSave1 / 1e4)}만원${R.ets ? ` + 배출권 ${F(R.carbon1 / 1e4)}만원` : ''}`} />
      <Kpi
        k="소비자 부담 / 회수기간"
        v={`${EOK(R.consumer)} 억원`}
        s={
          <>
            설치비 {EOK(R.install)}억 + 추가 시공비 {EOK(R.extra)}억
            <br />
            {R.payback ? (
              <>
                투자 회수 약 <b className="text-slate-900">{R.payback}년차</b>
              </>
            ) : (
              '20년 내 미회수'
            )}
          </>
        }
      />
      <Kpi k="20년 누적 효과" v={`${EOK(R.cumSave)} 억원`} s={`발전 ${F(R.cumGen / 1000)} MWh · CO₂ ${F(R.cumCo2)} tCO₂ 감축 · 배출권 ${EOK(R.cumCarbon)}억${R.ets ? ' 합산' : ' (참고)'}`} />
    </>
  );
}
function PpaKpis({ R }: { R: PpaResult }) {
  const ff = R.firstFixed;
  const y1 = R.years[0]!;
  return (
    <>
      <Kpi k="연간 예상 발전량 (1차년)" v={`${F1(R.annualGen1 / 1000)} MWh`} s={`일평균 발전시간 ${F2(R.annualGen1 / R.cap / 365)}h · 설치용량 ${F(R.cap)}kW`} />
      <Kpi
        k="PPA 단가 구조 (20년)"
        v={
          <span className="flex flex-wrap items-center gap-1.5 text-[15px] leading-relaxed">
            {R.segs
              .filter((s) => s.end >= s.start)
              .map((s, k) => (
                <span key={s.idx} className="flex items-center gap-1">
                  {k > 0 && <span className="text-slate-400">→</span>}
                  <SegTag idx={s.idx}>{s.idx}구간</SegTag> {segLabel(s)} · {s.linked ? '한전 연동' : `${F1(s.price)}원/kWh`}
                  {!s.linked && R.ppaEsc > 0 ? ` (+${(R.ppaEsc * 100).toFixed(1)}%/yr)` : ''}
                </span>
              ))}
          </span>
        }
        s={
          <>
            20년 가중평균 PPA {F1(R.avgPu)}원 vs 한전 {F1(R.avgKu)}원/kWh → kWh당 {F1(R.avgKu - R.avgPu)}원 절감{' '}
            <span className="rounded bg-emerald-100 px-1.5 font-bold text-emerald-700">초기투자·O&amp;M 0원</span>
          </>
        }
      />
      <Kpi
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
        k={`20년 누적 절감${R.ets ? ' (배출권 합산)' : ''}`}
        v={`${EOK(R.ets ? R.cumT : R.cumSaveD)} 억원`}
        s={`전기요금 ${EOK(R.cumSaveD)}억 ${R.ets ? `+ 배출권 ${EOK(R.cumCarbon)}억` : `· 배출권 참고가치 ${EOK(R.cumCarbon)}억`} · CO₂ ${F(R.cumCo2)} t`}
      />
    </>
  );
}
function Re100Card({ R }: { R: PpaResult }) {
  const y1 = R.years[0]!;
  return (
    <div className="rounded-xl border border-emerald-300 bg-gradient-to-r from-emerald-900 to-emerald-700 px-5 py-4 text-[12.5px] leading-relaxed text-emerald-50">
      <p className="mb-1.5 text-sm font-extrabold text-white">RE100 이행 수단 — OnSite PPA로 재생에너지 사용실적 확보</p>
      온사이트 PPA로 사용하는 전력은 <b className="text-emerald-300">K-RE100 이행수단으로 인정</b>되어, RE100 가입 기업은 물론 고객사·공급망으로부터 재생에너지 사용을 요구받는 기업의{' '}
      <b className="text-emerald-300">이행 실적으로 직접 활용</b>할 수 있습니다. 본 OnSite PPA 도입 시 <b className="text-emerald-300">연간 {F1(R.annualGen1 / 1000)} MWh</b>의 재생에너지 사용실적이 확보되어{' '}
      <b className="text-emerald-300">재생에너지 사용확인서</b> 발급 대상이 되며, Scope 2 배출량 <b className="text-emerald-300">연 {F((R.annualGen1 / 1000) * R.co2f)} tCO₂</b> 감축 —{' '}
      {R.ets
        ? `할당대상업체로서 간접배출량 감소분이 감축실적으로 인정되어 배출권 연 ${F(y1.carbon / 1e4)}만원(KAU ${F(R.kau)}원/t) 상당의 매각·구매회피 효과가 발생합니다.`
        : `배출권 할당대상업체라면 간접배출 감축실적 인정으로 연 ${F(y1.carbon / 1e4)}만원(KAU ${F(R.kau)}원/t) 상당의 배출권 가치가 추가됩니다(참고).`}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {['K-RE100 이행수단 인정', '재생에너지 사용확인서', 'Scope 2 감축', 'K-ETS 간접배출 감축실적', 'CDP·공급망 실사 대응'].map((p) => (
          <span key={p} className="rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-[11px] font-bold text-emerald-200">
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── 누적 그래프 — 자가소비: 투자 회수 곡선(J-Curve, 0년 투자 마이너스에서 시작), PPA: 수요자 20년 누적 절감액(투자 0원) ── */
function CumChart({ R }: { R: SelfResult | PpaResult }) {
  const self = R.mode === 'self';
  const data = self
    ? [{ x: '0년(투자)', a: Math.round(-R.consumer / 1e6) }, ...R.years.map((r) => ({ x: `${r.y}년`, a: Math.round(r.cum / 1e6) }))]
    : R.years.map((r) => ({ x: `${r.y}년`, a: Math.round(r.cumD / 1e6), b: Math.round(r.cumT / 1e6) }));
  const vals = data.map((d) => d.a);
  const max = Math.max(...vals, 0);
  const min = Math.min(...vals, 0);
  const zero = max === min ? 1 : max / (max - min); // 그라데이션에서 0 이 놓이는 위치 (위 초록 · 아래 빨강)
  return (
    <Card title={self ? '투자 회수 곡선 (J-Curve, 백만원)' : '수요자 20년 누적 절감액 (백만원)'}>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data as Record<string, number | string>[]}>
            <defs>
              <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset={0} stopColor="#059669" stopOpacity={0.1} />
                <stop offset={zero} stopColor="#059669" stopOpacity={0.1} />
                <stop offset={zero} stopColor="#dc2626" stopOpacity={0.1} />
                <stop offset={1} stopColor="#dc2626" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="x" tick={AXIS} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v: number) => v.toLocaleString()} width={56} />
            <Tooltip {...TIP} formatter={(v) => Number(v).toLocaleString()} />
            <Legend verticalAlign="top" wrapperStyle={{ fontSize: 10 }} />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <Area dataKey="a" stroke="none" fill="url(#cumFill)" legendType="none" tooltipType="none" baseValue={0} {...NO_ANIM} />
            <Line
              dataKey="a"
              name={self ? '누적 현금 (소비자 부담 차감)' : '누적 절감액 (전기요금)'}
              stroke="#2563eb"
              strokeWidth={2.5}
              {...NO_ANIM}
              dot={(p: { cx?: number; cy?: number; value?: number; index?: number }) => (
                <circle key={p.index} cx={p.cx} cy={p.cy} r={3} fill={(p.value ?? 0) >= 0 ? '#059669' : '#dc2626'} />
              )}
            />
            {!self && R.ets && <Line dataKey="b" name="누적 절감액 (배출권 합산)" stroke="#0891b2" strokeWidth={2} strokeDasharray="5 4" dot={false} {...NO_ANIM} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
/** (PPA 전용) 연도별 적용단가 비교 — 한전 태양광 대체단가 vs PPA 적용단가 */
function UnitCard({ R }: { R: PpaResult }) {
  return (
    <Card title="연도별 적용단가 비교 — 한전 태양광 대체단가 vs PPA 적용단가 (원/kWh)">
      <div className="h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={R.years.map((r) => ({ x: `${r.y}년`, ku: +r.ku.toFixed(1), pu: +r.pu.toFixed(1) }))}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="x" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} width={48} domain={['auto', 'auto']} />
            <Tooltip {...TIP} />
            <Legend verticalAlign="top" wrapperStyle={{ fontSize: 10 }} />
            <Line dataKey="ku" name="한전 태양광 대체단가 (가중, 상승률 반영)" stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 2 }} {...NO_ANIM} />
            <Line dataKey="pu" name="PPA 적용단가" stroke="#ea580c" strokeWidth={2.5} dot={{ r: 3 }} {...NO_ANIM} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Note>
        ※ 두 선 사이 = kWh당 절감폭.{' '}
        {R.segs
          .filter((s) => s.end >= s.start)
          .map((s) => `${s.idx}구간 ${segLabel(s)} ${s.linked ? '한전 연동(절감 0, 기본요금 절감만)' : `${F1(s.price)}원/kWh 고정`}`)
          .join(' · ')}
      </Note>
    </Card>
  );
}

/* ── 20년 종합 요약 ── */
function SelfSummary({ R }: { R: SelfResult }) {
  const last = R.years[19]!;
  return (
    <>
      <SumItem k="20년 총 발전량" v={`${F(R.cumGen / 1000)} MWh`} s={`1차년 ${F1(R.annualGen1 / 1000)} MWh`} />
      <SumItem k="20년 총 절감액" v={`${EOK(R.cumSave)} 억원`} s="전력량+기본요금" />
      <SumItem k="연평균 절감" v={`${EOK(R.cumSave / 20)} 억원`} s="O&M 차감 전" />
      <SumItem k="소비자 부담 / 회수" v={`${EOK(R.consumer)} 억원`} s={R.payback ? `${R.payback}년차 회수` : '20년 내 미회수'} />
      <SumItem k="20년 순현금 (소비자 부담 차감)" v={`${EOK(last.cum)} 억원`} s={`소비자 부담 대비 ${R.consumer ? (last.cum / R.consumer).toFixed(1) : '-'}배 회수`} />
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
      <SumItem k="CO₂ 총감축 (RE100)" v={`${F(R.cumCo2)} t`} s={`소나무 ${F(R.cumCo2 * 151.5)}그루`} />
    </>
  );
}

/* ── 20년간 운영 분석 ── */
function OpTable({ R, cur }: { R: SelfResult | PpaResult; cur: number }) {
  if (R.mode === 'self') {
    let run = 0;
    return (
      <T
        cur={cur}
        head={['년차', '발전량 (MWh)', '절감수익 (천원)', '누적수익 (천원)']}
        rows={R.years.map((r) => {
          run += r.save;
          return [`${r.y}년차`, F1(r.gen / 1000), F(r.save / 1e3), <b key="c" className="text-slate-900">{F(run / 1e3)}</b>];
        })}
      />
    );
  }
  return (
    <T
      cur={cur}
      head={['년차', '구간', '발전량 (MWh)', '월평균 납입료 (천원)', '전기요금 절감 (천원)', '배출권 (천원)', '누적절감 (천원)']}
      rows={R.years.map((r) => [
        `${r.y}년차`,
        <SegTag key="s" idx={r.seg}>{`${r.seg}구간`}</SegTag>,
        F1(r.gen / 1000),
        <Blue key="p">{F(r.ppaAmt / 12 / 1e3)}</Blue>,
        F(r.saveD / 1e3),
        <Dim key="d" on={R.ets}>{F(r.carbon / 1e3)}</Dim>,
        <b key="c" className="text-slate-900">{F(r.cumT / 1e3)}</b>,
      ])}
    />
  );
}

/* ── 20년 누적 효과 분석 ── */
function EffPanel({ R }: { R: SelfResult | PpaResult }) {
  const toe = (R.cumGen / 1000) * 0.229;
  const line = (k: ReactNode, v: ReactNode, opt: { hl?: boolean; dim?: boolean } = {}) => (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-slate-600">{k}</span>
      <b className={cn('tabular-nums', opt.hl ? 'text-[15px] text-orange-600' : opt.dim ? 'text-slate-400' : 'text-slate-900')}>{v}</b>
    </div>
  );
  return (
    <>
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[13px]">
        {line('20년 총 발전량', `${F1(R.cumGen / 1000)} MWh`)}
        {R.mode === 'self' ? (
          <>
            {line(`20년 총 절감액${R.ets ? ' (배출권 합산)' : ''}`, `${F(R.cumSave)} 원`)}
            {line(`배출권 가치 20년 (${F(R.kau)}원/t)${R.ets ? '' : ' — 참고'}`, `${F(R.cumCarbon)} 원`, { dim: !R.ets })}
            <div className="my-2 h-px bg-slate-200" />
            {line('소비자 부담 (설치비 + 추가 시공비)', `${F(R.consumer)} 원`)}
            {line(<b className="text-slate-900">20년 순수익 (소비자 부담·O&amp;M 차감)</b>, `${F(R.years[19]!.cum)} 원`, { hl: true })}
          </>
        ) : (
          <>
            {line('한전요금 기준 총액', `${F(R.sumKep)} 원`)}
            {line('PPA 요금 총액', `${F(R.sumPpa)} 원`)}
            {line(
              `월평균 PPA 납입료 (1차년${R.firstFixed && R.firstFixed.y > 1 ? ` / ${R.firstFixed.y}년차` : ''})`,
              `${F(R.years[0]!.ppaAmt / 12)}${R.firstFixed && R.firstFixed.y > 1 ? ` / ${F(R.firstFixed.ppaAmt / 12)}` : ''} 원`,
            )}
            <div className="my-2 h-px bg-slate-200" />
            {line('20년 전기요금 절감 (투자 0원)', `${F(R.cumSaveD)} 원`)}
            {line(`배출권 가치 20년 (${F(R.kau)}원/t${R.ets ? '' : ' · 참고'})`, `${F(R.cumCarbon)} 원`, { dim: !R.ets })}
            {line(<b className="text-slate-900">20년 총 절감액{R.ets ? ' (배출권 합산)' : ''}</b>, `${F(R.ets ? R.cumT : R.cumSaveD)} 원`, { hl: true })}
            {line('RE100 재생에너지 실적', `${F1(R.cumGen / 1000)} MWh`)}
          </>
        )}
      </div>
      {/* 환경 편익 — 잘리지 않게 한 줄씩 */}
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-[13px]">
        {[
          ['화석에너지 대체 (TOE)', F1(toe)],
          ['온실가스 저감 (tCO₂)', F1(R.cumCo2)],
          ['소나무 식재 (그루)', F(R.cumCo2 * 151.5)],
        ].map(([l, v]) => (
          <div key={l} className="flex items-center justify-between px-4 py-2">
            <span className="text-slate-600">{l}</span>
            <b className="text-[15px] text-blue-700 tabular-nums">{v}</b>
          </div>
        ))}
      </div>
      <Note>* 산출식: TOE = MWh × 0.229 / tCO₂ = MWh × {R.co2f} / 식재 = tCO₂ × 151.5</Note>
    </>
  );
}

/* ── 산정 기준 및 출처 (원본 그대로, 날짜는 하이픈 양식) ── */
function Assumptions() {
  const rows: [string, string][] = [
    ['발전량 산식', '설치용량(kW) × 일평균 발전시간(입력값, 기본 3.82h) × 365일 × 효율감소계수. 월별 배분은 기상청 울산관측소(지점 152) 기후평년값 1991~2020 월별 일조시간(연 2,249.5h) 비중 적용. 기본값 3.82h/일은 일조시간을 시스템 손실 반영 환산한 값으로 전국 태양광 평균 이용률 16.75%(일 4.02h) 대비 보수적 설정. 효율감소는 2차년도부터 매년 0.5%p 반영'],
    ['한전 요금단가', '기본값: 산업용(을) 고압A 선택Ⅰ·Ⅱ, 2025-04-01 시행 확정단가(확인 가능한 최종 고시). 2026-04-16 개편 후 고시표는 미공개 상태로, 개편 모드는 정부 발표 증감폭(최대부하 여름·겨울 -16.9원, 봄가을 -13.2원 / 경부하 +5.1원)을 적용한 참고용 계산값 — 고시 확인 후 갱신 필요. 기후환경요금 9.0원/kWh, 연료비조정 +5.0원/kWh(2026 3분기), 전력산업기반기금 3.7% 가산, 부가세(매입세액공제 대상) 제외'],
    ['전기요금 상승률', '산업용 평균판매단가 실적: 2019 106.6 → 2025 181.9원/kWh, 6년 연평균(CAGR) 9.3% (한국전력통계·한전 결산 기준). 기본값 2.5%는 최근 급등이 연료비 정상화에 따른 일시적 구간임을 감안한 보수적 설정이며, 민감도 분석에서 0% / 2.5% / 9.3%(실적 CAGR) 시나리오 제공'],
    ['O&M 요율', '국내 태양광 O&M 통상 MW당 연 1,000~1,500만원 수준 = 평균 CAPEX(158~164만원/kW, 에너지경제연구원 2025 실증) 대비 약 0.6~1.0%/년. 기본값 1.0%는 보수적 상단 적용'],
    ['모듈 열화율', '주요 제조사 선형 출력보증 기준 — 한화큐셀: 1년차 98%, 이후 연 최대 0.5% 열화, 25년차 86% 보증. 기본값 0.5%/yr는 보증 조건과 동일한 보수적 값'],
    ['절감단가 매칭', '태양광 발전전력의 시간대 분포를 요금 시간대에 매칭 — 개편 후: 중간부하(08~15시) 70% + 최대부하(15~21시) 30% / 개편 전: 여름·봄가을 최대 52%·중간 48%, 겨울 최대 45%·중간 55% (평일 기준 단순화)'],
    ['기본요금 절감', '한전 기본요금은 요금적용전력(당월 및 직전 12개월 동·하계 최대수요전력 중 최댓값, 15분 단위 계량) 기준 부과 (한전 기본공급약관 제8장). 태양광은 피크 발생 시점의 출력을 보장하지 못하므로 「기본요금 단가 × 설치용량 × 피크감축 반영률(기본 30%)」로 보수적 반영 — 흐린 날 피크 발생 시 절감 축소 가능'],
    ['자가소비 사업구조', '국비 지원 없음 — 소비자 부담 = 설치용량 × 설치단가(기본 135만원/kW) + 변압기 등 추가 시공비(기본 2천만원, 컨소시엄 EPC 회신 기준) 전액. O&M 은 사업비 대비 연 요율(기본 1.0%). 회수기간·누적현금은 소비자 부담 기준. 자가소비 배정 잔여용량 약 0.32MW'],
    ['OnSite PPA 구조', '사업자(컨소시엄)가 설비 투자·설치·운영·유지보수 전액 부담, 소비자는 부지(지붕)만 제공하고 발전전력 사용분을 PPA 단가로 지불. 잉여전력·계통 리스크는 사업자 귀속. 계약기간 20년 기준. 당해연도 PPA 배정 잔여용량 약 2.67MW'],
    ['구간별 PPA 단가', '20년 계약기간을 2구간으로 분할(전환연차 슬라이더). 지붕 보수·주차장형 구조물 등 설치비 과중 현장은 1구간(기본 1~5년차)을 한전 대체단가 연동으로 설정해 소비자 요금을 한전과 동일하게 두고, 2구간(기본 6~20년차)부터 고정 PPA 단가(기본 150원/kWh)를 적용. 연동 구간의 절감은 기본요금(피크감축)분만 발생하며, 고정단가 구간의 상승률은 구간 시작연차 기준으로 누적 적용'],
    ['자가소비 처리', '월 발전량이 월 사용량을 초과하는 잉여전력은 절감액 산정에서 제외(역송 정산 미반영, 보수적). 연속공정 사업장은 통상 전량 자가소비 가능'],
    ['환경 편익', '온실가스: 전력배출계수 기본 0.4173 tCO₂eq/MWh(입력 가능) — 2023년 기준 국가 전력배출계수, 기후에너지환경부 2025-12-17 확정·공표 최신값 (구 0.4594 대체) · 소나무 환산 tCO₂ × 151.5그루'],
    ['탄소배출권 가치', '배출권 가치 = 연간 발전량(MWh) × 전력 배출계수 × KAU 시세(입력, 기본 30,000원/t) × (1+상승률)^(연차-1). 시세 근거: 한국거래소 배출권시장 KAU26 2026-09-07 종가 29,950원/t, KAU25 최종 29,450원. 제도 근거: 2022-01-01부터 할당대상업체가 직접 PPA·자가발전 재생에너지 전력을 사용해 간접배출량이 감소하면 감축실적으로 인정. 할당대상업체(체크)일 때만 배출권 매각(또는 구매회피) 가치가 실제 현금흐름으로 절감액에 합산되며, 비할당업체는 참고(잠재가치)로만 표기. 4차 계획기간(2026~2030) 배출허용총량 축소·유상할당 확대로 가격 상승 압력 존재 — 상승률 입력으로 시나리오 검토'],
    ['RE100 관련', '온사이트 PPA·자가발전 전력은 K-RE100 이행수단으로 인정되어 재생에너지 사용확인서 발급 대상 (한국에너지공단 K-RE100 제도)'],
    ['지붕면적 환산', '설치 가능 용량 = 가용면적 ÷ kW당 소요면적(기본 10㎡/kW, 산업시설 평지붕·이격 반영 보수치. 경사·음영에 따라 6.6~13㎡/kW 변동)'],
    ['미반영 항목', '잉여전력 판매(상계·현물), REC·자발적 탄소시장(VCM) 수익, 금융조달 구조, 법인세 효과, 배출권 거래 수수료·세금 — 정밀 검토 단계에서 반영'],
  ];
  return (
    <table className="w-full border-collapse text-xs">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-slate-100">
            <td className="w-[170px] whitespace-nowrap py-2 pr-4 align-top font-bold text-slate-900">{k}</td>
            <td className="py-2 leading-relaxed text-slate-600">{v}</td>
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
