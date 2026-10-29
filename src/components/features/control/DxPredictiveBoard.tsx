'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SectionCard } from '@/components/features';
import { DataTable, type Column } from '@/components/features/DataList';
import { useMonitoringPlantHistory } from '@/hooks/monitoring/useMonitoring';
import { useDxFeatureHistory, useDxForecast, useDxLatest } from '@/hooks/control/useDx';
import { dxMetric, dxSensorsOf, firstNum, hhmm, isDxTarget, isStale, isThinWindow, kst, stopLabel, type DxLatest } from '@/lib/dx';

/**
 * 예지보전 — 센서가 잰 값(아이티공간 연계 v1.1 API-003 · 005)과 발전량 예측만.
 * 전기안전지수 · 등급 · 항목별 위험점수(API-006 · 007)는 0~100 점수라 안전 페이지에 있다(2026-10-29 사용자 확정).
 *   요약 카드(설비 상태 Health Index · 발전량 예측) → 설비별 측정값 표 → 발전량 실측·예측 추이 · 선택 센서 측정값 추이
 * 온도 · 고조파는 문서 항목이라 칸은 두되, 실제 응답이 null 이면 '미산출'(값을 지어 넣지 않는다).
 */
const NONE = '미산출';
const fx = (v: number | null | undefined, d = 1) =>
  v == null ? null : v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const rst = (v: number | number[] | null, d = 1) => (Array.isArray(v) ? v.map((x) => fx(x, d) ?? '-').join(' / ') : null);

/** 요약 카드 — 값 아래에 척도 · 센서 중 가장 낮은 값 · 갱신 주기를 한 줄씩 */
function Kpi({ label, value, unit, badge, lines }: { label: string; value: string | null; unit?: string; badge?: ReactNode; lines: ReactNode[] }) {
  return (
    <div className="rounded-xl bg-[#0d1520] p-5 ring-1 ring-white/[0.06]">
      <p className="text-sm text-slate-300">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className={`text-3xl font-bold tabular-nums ${value ? 'text-white' : 'text-slate-500'}`}>{value ?? NONE}</span>
        {value && unit && <span className="text-base text-slate-400">{unit}</span>}
        {badge}
      </div>
      <div className="mt-3 space-y-0.5 text-sm text-slate-400">
        {lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>
    </div>
  );
}

type Row = { mac: string; name: string; lt?: DxLatest };

/** 측정값 추이로 고를 수 있는 값 — API-005 5분 특징값(문서 5.3). 전류는 R/S/T 중 가장 큰 상 */
const TRENDS: { code: string; label: string; unit: string; d: number; pick: (v: number | number[] | null) => number | null }[] = [
  { code: 'current_rst', label: '전류', unit: 'A', d: 1, pick: (v) => (Array.isArray(v) ? (v.length ? Math.max(...v) : null) : v) },
  { code: 'voltage_mean', label: '전압', unit: 'V', d: 1, pick: firstNum },
  { code: 'ground_current', label: '누설전류', unit: 'A', d: 3, pick: firstNum },
  { code: 'power_factor', label: '역률', unit: '%', d: 1, pick: firstNum },
  { code: 'thdi', label: '고조파 THD', unit: '%', d: 1, pick: firstNum },
  { code: 'temperature', label: '온도', unit: '℃', d: 1, pick: firstNum },
];

/** 숫자 칸 — 값이 없으면 미산출, 수집이 멈춘 센서는 '-'(측정 시각 칸에 수집 중단) */
function Num({ v, stale, d = 1 }: { v: number | null; stale: boolean; d?: number }) {
  const t = stale ? '-' : fx(v, d);
  return <span className={`whitespace-nowrap tabular-nums ${t && t !== '-' ? 'text-slate-200' : 'text-slate-500'}`}>{t ?? NONE}</span>;
}

export function DxPredictiveBoard({ plantId }: { plantId: number }) {
  const sensors = dxSensorsOf(plantId);
  const latestQ = useDxLatest(plantId);
  const forecastQ = useDxForecast(plantId);
  const [picked, setPicked] = useState<string | null>(null);

  const rows: Row[] = sensors
    .map((s) => ({ mac: s.mac, name: s.deviceName, lt: latestQ.data?.find((x) => x.macAddress === s.mac) }))
    // 센서 번호 순(한일튜브1 → 4)(2026-10-29 사용자 확정)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
  const sel = rows.find((r) => r.mac === picked) ?? rows[0];

  const lowHealth = rows
    .filter((r) => !isStale(r.lt) && r.lt?.health?.healthIndex != null)
    .map((r) => r.lt!.health!)
    .sort((a, b) => (a.healthIndex as number) - (b.healthIndex as number))[0];
  const many = sensors.length > 1;

  /* 발전량 — 지난 24시간 실측(발전 이력) + 향후 36시간 예측 */
  const now = Date.now();
  const today = kst(now).slice(0, 10);
  const yesterday = kst(now - 86_400_000).slice(0, 10);
  // 끝 날짜를 하루 늘려 조회 — 금일 시간대까지 확실히 받도록(이력 API 의 날짜 경계 보정)
  const tomorrow = kst(now + 86_400_000).slice(0, 10);
  const histQ = useMonitoringPlantHistory(plantId, yesterday, tomorrow);
  const series = useMemo(() => {
    const nowKey = kst(now).slice(0, 13);
    const from = kst(now - 24 * 3600_000).slice(0, 13);
    const actual = (histQ.data ?? [])
      .map((p) => ({ key: p.time.replace('T', ' ').slice(0, 13), kwh: p.acPower }))
      .filter((p) => p.key >= from && p.key <= nowKey);
    // 예측은 다음 정시부터 36시간까지만(문서 6.3) — 지난 24시간 실측 + 향후 36시간
    const until = kst(now + 36 * 3600_000).slice(0, 13);
    const fc = (forecastQ.data ?? [])
      .map((f) => ({ key: f.start.slice(0, 13), p50: f.p50, band: [f.p10, f.p90] as [number, number] }))
      .filter((f) => f.key > nowKey && f.key <= until);
    const keys = [...new Set([...actual.map((a) => a.key), ...fc.map((f) => f.key)])].sort();
    return keys.map((k) => {
      const a = actual.find((x) => x.key === k);
      const f = fc.find((x) => x.key === k);
      // 가로축 — 어제 · 오늘 · 내일 · 모레 + 시(문서 6.3 표시안처럼)
      const rel = ['어제', '오늘', '내일', '모레'][Math.round((Date.parse(k.slice(0, 10)) - Date.parse(today)) / 86_400_000) + 1] ?? k.slice(5, 10);
      return { key: k, label: `${rel} ${Number(k.slice(11, 13))}시`, 실측: a?.kwh, 예측: f?.p50, band: f?.band };
    });
  }, [histQ.data, forecastQ.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const nextHour = forecastQ.data?.[0];
  const todayActual = (histQ.data ?? []).filter((p) => p.time.startsWith(today) && p.time.replace('T', ' ').slice(0, 13) <= kst(now).slice(0, 13)).reduce((a, p) => a + p.acPower, 0);
  const todayForecastRest = (forecastQ.data ?? []).filter((f) => f.start.startsWith(today)).reduce((a, f) => a + f.p50, 0);
  const nowLabel = series.find((s) => s.key === kst(now).slice(0, 13))?.label;
  // 눈금 — 처음(24시간 전) · 매일 0시 · 끝(36시간 뒤)만
  const ticks = series.filter((x, i) => i === 0 || i === series.length - 1 || x.key.endsWith(' 00')).map((x) => x.label);

  const m = (r: Row, code: string) => firstNum(dxMetric(r.lt, code));
  const cols: Column<Row>[] = [
    { key: 'name', header: '센서', render: (r) => <span className="whitespace-nowrap font-medium text-white">{r.name}</span> },
    { key: 'hi', header: 'Health', render: (r) => <Num v={r.lt?.health?.healthIndex ?? null} stale={isStale(r.lt)} /> },
    {
      key: 'cur',
      header: '전류 R/S/T (A)',
      render: (r) => <span className="whitespace-nowrap tabular-nums text-slate-200">{isStale(r.lt) ? '-' : (rst(dxMetric(r.lt, 'current_rst')) ?? NONE)}</span>,
    },
    {
      key: 'vol',
      header: '전압 R/S/T (V)',
      render: (r) => <span className="whitespace-nowrap tabular-nums text-slate-200">{isStale(r.lt) ? '-' : (rst(dxMetric(r.lt, 'voltage_rst')) ?? NONE)}</span>,
    },
    // 유효전력은 W 로 온다 — kW 로
    { key: 'kw', header: '유효전력 (kW)', render: (r) => <Num v={m(r, 'active_power') == null ? null : m(r, 'active_power')! / 1000} stale={isStale(r.lt)} /> },
    { key: 'pf', header: '역률 (%)', render: (r) => <Num v={m(r, 'power_factor')} stale={isStale(r.lt)} /> },
    { key: 'hz', header: '주파수 (Hz)', render: (r) => <Num v={m(r, 'frequency')} stale={isStale(r.lt)} d={2} /> },
    { key: 'gc', header: '누설전류 (A)', render: (r) => <Num v={m(r, 'ground_current')} stale={isStale(r.lt)} d={3} /> },
    { key: 'thd', header: '고조파 THD (%)', render: (r) => <Num v={m(r, 'thdi')} stale={isStale(r.lt)} /> },
    { key: 'tmp', header: '온도 (℃)', render: (r) => <Num v={m(r, 'temperature')} stale={isStale(r.lt)} /> },
    {
      key: 'at',
      header: '측정 시각',
      render: (r) =>
        isStale(r.lt) ? (
          <span className={`whitespace-nowrap ${isDxTarget(r.mac) && latestQ.isSuccess ? 'text-red-300' : 'text-slate-500'}`}>{stopLabel(r.mac, latestQ.isSuccess)}</span>
        ) : (
          <span className="tabular-nums text-slate-400">{r.lt ? r.lt.observedAt.slice(11, 19) : '-'}</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Kpi
          label="설비 상태 (Health Index)"
          value={fx(lowHealth?.healthIndex)}
          unit="/ 100"
          lines={['설비 상태 점수 0~100, 높을수록 양호', ...(many ? ['센서 중 가장 낮은 값'] : []), `1시간 갱신${lowHealth ? ` · ${hhmm(lowHealth.windowStartedAt)}~${hhmm(lowHealth.windowEndedAt)}` : ''}`]}
        />
        <Kpi
          label="발전량 예측"
          value={fx(nextHour?.p50)}
          unit="kWh · 다음 1시간"
          lines={[
            `금일 실측 누적 ${Math.round(todayActual).toLocaleString('ko-KR')} kWh`,
            `금일 예측 누적 ${Math.round(todayActual + todayForecastRest).toLocaleString('ko-KR')} kWh`,
            ...(nextHour ? [`발행 ${hhmm(nextHour.issuedAt)}`] : []),
          ]}
        />
      </div>

      {/* 센서마다 지금 잰 값(API-003, 1분) — 줄을 누르면 아래 추이가 그 센서로 */}
      <SectionCard title="설비별 상태" noPadding>
        <DataTable
          columns={cols}
          data={rows}
          rowKey={(r) => r.mac}
          onRowClick={(r) => setPicked(r.mac)}
          rowClassName={(r) => (r.mac === sel?.mac ? 'bg-white/[0.04]' : '')}
          emptyMessage="DX 센서 없음"
        />
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="발전량 실측 · 예측 추이">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" ticks={ticks} interval={0} tick={{ fontSize: 12, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#cbd5e1' }} axisLine={false} tickLine={false} width={48} unit="" />
                <Tooltip
                  contentStyle={{ background: '#0d1520', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 13 }}
                  formatter={(v: unknown, n?: unknown) => (Array.isArray(v) ? [`${v[0]} ~ ${v[1]} kWh`, '예상 범위'] : [`${v} kWh`, String(n ?? '')])}
                />
                <Area dataKey="band" stroke="none" fill="#3B82F6" fillOpacity={0.18} isAnimationActive={false} name="예상 범위" />
                <Line dataKey="실측" stroke="#e2e8f0" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
                <Line dataKey="예측" stroke="#3B82F6" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} name="예측값" />
                {nowLabel && <ReferenceLine x={nowLabel} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: `현재 ${hhmm(kst(now))}`, fill: '#cbd5e1', fontSize: 12, position: 'top' }} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-sm text-slate-400">— 실측 · ┅ 예측값 · ▒ 예상 범위{nextHour ? ` · 발행 ${hhmm(nextHour.issuedAt)}` : ''}</p>
        </SectionCard>

        <MeasureTrend row={sel} />
      </div>
    </div>
  );
}

/** 선택 센서 측정값 추이 — API-005 5분 특징값, 최근 24시간. 수집이 끊긴 구간(측정 건수 부족)은 뺀다 */
function MeasureTrend({ row }: { row?: Row }) {
  const q = useDxFeatureHistory(row && isDxTarget(row.mac) ? row.mac : undefined, 24);
  const [code, setCode] = useState(TRENDS[0]!.code);
  const t = TRENDS.find((x) => x.code === code)!;
  const data = (q.data ?? [])
    .filter((f) => !isThinWindow(f))
    .map((f) => ({ t: f.observedAt.slice(11, 16), v: t.pick(f.measurements.find((x) => x.metricCode === code)?.value ?? null) }))
    .filter((p): p is { t: string; v: number } => p.v != null);
  return (
    <SectionCard title={`선택 센서 추이${row ? ` · ${row.name}` : ''}`}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TRENDS.map((x) => (
          <button
            key={x.code}
            type="button"
            onClick={() => setCode(x.code)}
            className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${code === x.code ? 'bg-blue-600 text-white' : 'bg-white/[0.06] text-slate-300 hover:bg-white/10'}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="h-[230px]">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="t" tick={{ fontSize: 12, fill: '#cbd5e1' }} interval={47} axisLine={false} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12, fill: '#cbd5e1' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                contentStyle={{ background: '#0d1520', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 13 }}
                formatter={(v: unknown) => [`${fx(Number(v), t.d)} ${t.unit}`, t.label]}
              />
              <Line dataKey="v" name={t.label} stroke="#e2e8f0" strokeWidth={1.6} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">{q.isLoading ? '불러오는 중' : NONE}</div>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-400">
        — {t.label} ({t.unit}) · 5분 · 최근 24시간
      </p>
    </SectionCard>
  );
}
