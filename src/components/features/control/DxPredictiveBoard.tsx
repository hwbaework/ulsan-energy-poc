'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SectionCard } from '@/components/features';
import { DataTable, type Column } from '@/components/features/DataList';
import { Info } from 'lucide-react';
import { StatusPill } from '@/components/ui/Design';
import { Tooltip as Hint } from '@/components/ui/Tooltip';
import { useMonitoringPlantHistory } from '@/hooks/monitoring/useMonitoring';
import { useDxForecast, useDxLatest, useDxSafety, useDxSafetyHistory } from '@/hooks/control/useDx';
import {
  DX_LEVEL,
  DX_RISK_ITEMS,
  dxSensorsOf,
  hhmm,
  isSafetyLate,
  isStale,
  kst,
  stopLabel,
  topRisk,
  worstSafety,
  type DxLatest,
  type DxSafety,
} from '@/lib/dx';

/**
 * 예지보전 대시보드 — 아이티공간 연계 문서 v1.1 7장 구성 그대로(발전소 하나):
 *   요약 카드 4개(전기안전지수 · Health Index · 발전량 예측 · 아크 지수)
 *   → 설비별 상태 표 · 발전량 실측·예측 추이 → 선택 센서 항목별 위험점수 · 선택 센서 추이
 * 센서가 여러 대면 카드엔 가장 낮은(나쁜) 값, 표엔 센서별. 값이 없으면 0 이 아니라 '미산출'.
 */
const NONE = '미산출';
const fx = (v: number | null | undefined, d = 1) =>
  v == null ? null : v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });

/** 요약 카드 — 값 아래엔 값(시각 · 누적)만, 지표 설명은 (i) 에 올리면 보인다 */
function Kpi({ label, value, unit, badge, info, lines }: { label: string; value: string | null; unit?: string; badge?: ReactNode; info?: string; lines: ReactNode[] }) {
  return (
    <div className="rounded-xl bg-[#0d1520] p-5 ring-1 ring-white/[0.06]">
      <div className="flex items-center gap-1.5">
        <p className="text-sm text-slate-300">{label}</p>
        {info && (
          <Hint content={info} wide position="bottom">
            <span tabIndex={0} role="img" aria-label={`${label} 설명`} className="inline-flex">
              <Info size={14} className="cursor-help text-slate-400 hover:text-white" />
            </span>
          </Hint>
        )}
      </div>
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

type Row = { mac: string; name: string; sf?: DxSafety; lt?: DxLatest };

export function DxPredictiveBoard({ plantId }: { plantId: number }) {
  const sensors = dxSensorsOf(plantId);
  const latestQ = useDxLatest(plantId);
  const safetyQ = useDxSafety(plantId);
  const forecastQ = useDxForecast(plantId);
  const [picked, setPicked] = useState<string | null>(null);

  const rows: Row[] = sensors
    .map((s) => ({
      mac: s.mac,
      name: s.deviceName,
      sf: safetyQ.data?.find((x) => x.macAddress === s.mac),
      lt: latestQ.data?.find((x) => x.macAddress === s.mac),
    }))
    .sort((a, b) => {
      const oa = a.sf && !isSafetyLate(a.sf) ? DX_LEVEL[a.sf.riskLevel].order : 9;
      const ob = b.sf && !isSafetyLate(b.sf) ? DX_LEVEL[b.sf.riskLevel].order : 9;
      return oa - ob || (a.sf?.safetyIndex ?? 101) - (b.sf?.safetyIndex ?? 101);
    });
  const sel = rows.find((r) => r.mac === picked) ?? rows[0];

  const worst = worstSafety(safetyQ.data ?? []);
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

  const cols: Column<Row>[] = [
    { key: 'name', header: '센서', render: (r) => <span className="whitespace-nowrap font-medium text-white">{r.name}</span> },
    {
      key: 'si',
      header: '전기안전지수',
      width: '112px',
      render: (r) => <span className={`tabular-nums ${r.sf && !isSafetyLate(r.sf) ? 'text-white' : 'text-slate-500'}`}>{fx(r.sf?.safetyIndex) ?? NONE}</span>,
    },
    {
      key: 'lv',
      header: '등급',
      width: '100px',
      render: (r) =>
        !r.sf ? (
          <span className="text-slate-500">{NONE}</span>
        ) : isSafetyLate(r.sf) ? (
          <StatusPill tone="muted" label="갱신 지연" />
        ) : (
          <StatusPill tone={DX_LEVEL[r.sf.riskLevel].tone} label={DX_LEVEL[r.sf.riskLevel].label} />
        ),
    },
    {
      key: 'hi',
      header: 'Health',
      width: '84px',
      render: (r) =>
        isStale(r.lt) ? <span className="text-slate-500">{stopLabel(r.mac, latestQ.isSuccess)}</span> : <span className="tabular-nums text-slate-200">{fx(r.lt?.health?.healthIndex) ?? NONE}</span>,
    },
    { key: 'top', header: '가장 높은 위험 항목', width: '140px', render: (r) => <span className="text-slate-300">{topRisk(r.sf)?.label ?? '-'}</span> },
  ];

  return (
    <div className="space-y-6">
      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="전기안전지수"
          value={fx(worst?.safetyIndex)}
          badge={worst && <StatusPill tone={DX_LEVEL[worst.riskLevel].tone} label={DX_LEVEL[worst.riskLevel].label} />}
          info={`0~100, 높을수록 양호합니다.${many ? ' 센서 중 가장 낮은 값입니다.' : ''} 5분마다 갱신됩니다. 당사 운영 기준의 상태 지표이며 법정 · 표준 판정이 아닙니다. 보호계전기 동작을 대신하지 않습니다.`}
          lines={worst ? [`산출 ${hhmm(worst.diagnosedAt)}`] : []}
        />
        <Kpi
          label="설비 상태 (Health Index)"
          value={fx(lowHealth?.healthIndex)}
          unit="/ 100"
          info={`설비 상태 점수 0~100, 높을수록 양호합니다.${many ? ' 센서 중 가장 낮은 값입니다.' : ''} 1시간마다 갱신됩니다. 경보 · 등급 판단은 전기안전지수로 합니다.`}
          lines={lowHealth ? [`${hhmm(lowHealth.windowStartedAt)}~${hhmm(lowHealth.windowEndedAt)}`] : []}
        />
        <Kpi
          label="발전량 예측"
          value={fx(nextHour?.p50)}
          unit="kWh · 다음 1시간"
          info="예측값은 다음 1시간의 대표 예측값이고, 예상 범위는 적게 · 많게 나올 때의 폭입니다. 확률 구간이 아닌 참고 범위이며, 흐리거나 비가 오면 폭이 커집니다."
          lines={[
            `금일 실측 누적 ${Math.round(todayActual).toLocaleString('ko-KR')} kWh`,
            `금일 예측 누적 ${Math.round(todayActual + todayForecastRest).toLocaleString('ko-KR')} kWh`,
            ...(nextHour ? [`발행 ${hhmm(nextHour.issuedAt)}`] : []),
          ]}
        />
        <Kpi
          label="아크 지수"
          value={null}
          badge={<StatusPill tone="muted" label="판정 보류" />}
          info="시범 산출 중이라 아직 값이 없습니다. 아크 발생 확률이나 화재 가능성 판정이 아니며, 아크 차단기를 대신하지 않습니다."
          lines={[]}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title={`설비별 상태 (${rows.length})`} noPadding>
          <DataTable columns={cols} data={rows} rowKey={(r) => r.mac} onRowClick={(r) => setPicked(r.mac)} emptyMessage="DX 센서 없음" />
        </SectionCard>

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
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title={`선택 센서 상세${sel ? ` · ${sel.name}` : ''}`}>
          <p className="mb-3 text-sm text-slate-300">항목별 위험점수</p>
          <div className="space-y-2.5">
            {DX_RISK_ITEMS.map((it) => {
              const v = sel?.sf?.risks[it.key];
              const isTop = topRisk(sel?.sf)?.label === it.label;
              return (
                <div key={it.key} className="flex items-center gap-3 text-sm">
                  <span className={`w-16 shrink-0 ${isTop ? 'font-semibold text-white' : 'text-slate-300'}`}>{it.label}</span>
                  {typeof v === 'number' ? (
                    <>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className={`h-full rounded-full ${isTop ? 'bg-amber-500' : 'bg-slate-500'}`} style={{ width: `${Math.min(100, Math.max(0, v))}%` }} />
                      </div>
                      <span className="w-10 shrink-0 text-right tabular-nums text-slate-200">{fx(v, 0)}</span>
                    </>
                  ) : (
                    <span className="text-slate-500">{NONE}</span>
                  )}
                </div>
              );
            })}
          </div>
          {sel?.sf && <p className="mt-3 text-sm text-slate-400">산출 {hhmm(sel.sf.diagnosedAt)}</p>}
        </SectionCard>

        <SafetyTrend row={sel} />
      </div>
    </div>
  );
}

/** 선택 센서 추이 — 전기안전지수(5분, 최근 24시간). 등급이 바뀐 시각은 점. Health Index 는 이력 API 가 없어 최신값 선 */
function SafetyTrend({ row }: { row?: Row }) {
  const q = useDxSafetyHistory(row?.mac, 24);
  const data = (q.data ?? []).filter((x) => x.safetyIndex != null).map((x) => ({ t: x.windowStartedAt.slice(11, 16), v: Math.round((x.safetyIndex as number) * 10) / 10, l: x.riskLevel }));
  const changes = data.filter((d, i) => i > 0 && d.l !== data[i - 1]!.l);
  const health = isStale(row?.lt) ? null : (row?.lt?.health?.healthIndex ?? null);
  const lo = data.length ? Math.max(0, Math.floor((Math.min(...data.map((d) => d.v), health ?? 100) - 5) / 5) * 5) : 70;
  return (
    <SectionCard title={`선택 센서 추이${row ? ` · ${row.name}` : ''}`}>
      <div className="h-[230px]">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="t" tick={{ fontSize: 12, fill: '#cbd5e1' }} interval={47} axisLine={false} tickLine={false} />
              <YAxis domain={[lo, 100]} tick={{ fontSize: 12, fill: '#cbd5e1' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={{ background: '#0d1520', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 13 }} />
              <Line dataKey="v" name="전기안전지수" stroke="#e2e8f0" strokeWidth={1.6} dot={false} isAnimationActive={false} />
              {health != null && (
                <ReferenceLine y={health} stroke="#3B82F6" strokeDasharray="0" label={{ value: `Health ${fx(health)}`, fill: '#93c5fd', fontSize: 12, position: 'insideTopRight' }} />
              )}
              {changes.map((c, i) => (
                <ReferenceDot key={i} x={c.t} y={c.v} r={4} fill="#3B82F6" stroke="none" label={{ value: `${DX_LEVEL[c.l].label} 진입`, fill: '#93c5fd', fontSize: 12, position: 'bottom' }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">{q.isLoading ? '불러오는 중' : NONE}</div>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-400">— 전기안전지수(5분) · <span className="text-blue-300">— Health Index</span></p>
    </SectionCard>
  );
}
