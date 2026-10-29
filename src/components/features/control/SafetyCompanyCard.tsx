'use client';

import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SectionCard } from '@/components/features';
import { StatusPill } from '@/components/ui/Design';
import { Modal } from '@/components/ui/Modal';
import { useDxSafety, useDxSafetyHistory } from '@/hooks/control/useDx';
import { DX_LEVEL, DX_RISK_ITEMS, dxSensorsOf, hasDx, hhmm, isDxTarget, isSafetyLate, topRisk, worstSafety, type DxSafety } from '@/lib/dx';
import { TABLE, TABLE_HEAD_ROW, TABLE_ROW, TABLE_TD, TABLE_TH } from '@/components/features/DataList';
import type { MonitoringPlant } from '@/types/monitoring';

// 안전 상세 — 발전소 하나의 전기안전지수(아이티공간 UMEI 연계 v1.1 API-006 · 007, 5분).
// 측정값(℃ · A · %)이 아니라 0~100 점수만: 전기안전지수(높을수록 양호) · 등급 · 항목별 위험점수(높을수록 위험).
// 가장 높은 위험점수 = 지수를 낮춘 항목이라 주황색으로 강조한다(문서 6.2). 계산식은 화면에 쓰지 않는다(2026-10-29 사용자).
// 위험점수는 정수로 온다(2026-10-29 사용자) — 소수점 없이.
// 센서가 잰 값은 예지보전에 있다(2026-10-29 사용자 확정).
const NONE = '미산출';
/** 등급 색 — StatusPill 과 같은 색(위험 · 경고 빨강, 주의 amber, 관찰 회색, 정상 초록) */
const TONE_HEX = { danger: '#ef4444', warning: '#f59e0b', muted: '#64748b', normal: '#10b981' } as const;
// 등급 ~ 산출 시각은 가운데 정렬(2026-10-29 사용자)
const TH_C = TABLE_TH.replace('text-left', 'text-center');
const TD_C = `${TABLE_TD} text-center`;
const fx = (v: number | null | undefined, d = 1) =>
  v == null ? null : v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });

/** 발전소 하나의 안전 — 요약(가장 나쁜 센서) · 센서별 점수 표 · 선택 센서 추이 */
export function SafetyCompanyCard({ plant }: { plant: MonitoringPlant }) {
  const dx = hasDx(plant.plantId);
  const safetyQ = useDxSafety(dx ? plant.plantId : undefined);
  // 센서 번호 순(한일튜브1 → 4)
  const sensors = [...dxSensorsOf(plant.plantId)].sort((a, b) => a.deviceName.localeCompare(b.deviceName, 'ko', { numeric: true }));
  const [picked, setPicked] = useState<string | null>(null);
  const [levelsOpen, setLevelsOpen] = useState(false);
  const sel = sensors.find((s) => s.mac === picked) ?? sensors.find((s) => isDxTarget(s.mac));

  const all = safetyQ.data ?? [];
  const worst = worstSafety(all);
  // 센서 결과가 모두 15분 넘게 멈췄으면 '미산출'이 아니라 '갱신 지연'(연계 문서 6.2)
  const allLate = !worst && all.length > 0 && all.every((x) => isSafetyLate(x));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-[#0d1520] p-5 ring-1 ring-white/[0.06]">
          <div className="flex items-center gap-2">
            <p className="text-sm text-slate-300">전기안전지수</p>
            {/* 누르면 등급 5가지 · 색(riskLevel 코드, 문서 5.4) */}
            <button
              type="button"
              onClick={() => setLevelsOpen(true)}
              className="rounded-md bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-slate-200 ring-1 ring-white/[0.15] hover:bg-white/[0.12]"
            >
              등급
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`text-3xl font-bold tabular-nums ${worst ? 'text-white' : 'text-slate-500'}`}>{fx(worst?.safetyIndex) ?? (allLate ? '-' : NONE)}</span>
            {worst && <StatusPill tone={DX_LEVEL[worst.riskLevel].tone} label={DX_LEVEL[worst.riskLevel].label} />}
            {allLate && <StatusPill tone="muted" label="갱신 지연" />}
          </div>
          <div className="mt-3 space-y-0.5 text-sm text-slate-400">
            <p>0~100, 높을수록 양호</p>
            <p>5분 갱신{worst ? ` · 산출 ${hhmm(worst.diagnosedAt)}` : ''}</p>
          </div>
        </div>
        <div className="rounded-xl bg-[#0d1520] p-5 ring-1 ring-white/[0.06]">
          <p className="text-sm text-slate-300">아크 지수</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-3xl font-bold text-slate-500">{NONE}</span>
            <StatusPill tone="muted" label="판정 보류" />
          </div>
          <div className="mt-3 space-y-0.5 text-sm text-slate-400">
            <p>시범 산출 중</p>
          </div>
        </div>
      </div>

      {/* 센서별 — 전기안전지수 · 등급 · 항목별 위험점수(0~100). 줄을 누르면 아래 추이가 그 센서로 */}
      <SectionCard title="센서별 전기안전지수" noPadding>
        <div className="overflow-x-auto">
          <table className={TABLE}>
            <thead>
              <tr className={TABLE_HEAD_ROW}>
                <th className={TABLE_TH} rowSpan={2}>
                  센서
                </th>
                <th className={TABLE_TH} rowSpan={2}>
                  전기안전지수
                </th>
                <th className={TH_C} rowSpan={2}>
                  등급
                </th>
                <th className={TH_C} colSpan={DX_RISK_ITEMS.length}>
                  항목별 위험점수 (0~100, 높을수록 위험)
                </th>
                <th className={TH_C} rowSpan={2}>
                  산출 시각
                </th>
              </tr>
              <tr className={TABLE_HEAD_ROW}>
                {DX_RISK_ITEMS.map((it) => (
                  <th key={it.key} className={TH_C}>
                    {it.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sensors.map((sn) => {
                const sf = all.find((x) => x.macAddress === sn.mac);
                const late = isSafetyLate(sf);
                const top = topRisk(sf);
                return (
                  <tr
                    key={sn.mac}
                    onClick={() => isDxTarget(sn.mac) && setPicked(sn.mac)}
                    className={`${TABLE_ROW} ${isDxTarget(sn.mac) ? 'cursor-pointer' : ''} ${sel?.mac === sn.mac ? 'bg-white/[0.04]' : ''}`}
                  >
                    <td className={`${TABLE_TD} whitespace-nowrap font-medium text-white`}>{sn.deviceName}</td>
                    <td className={`${TABLE_TD} tabular-nums ${sf && !late ? 'font-semibold text-white' : 'text-slate-500'}`}>
                      {fx(sf?.safetyIndex) ?? (isDxTarget(sn.mac) ? NONE : '미수신')}
                    </td>
                    <td className={`${TD_C} whitespace-nowrap`}>
                      {!sf ? (
                        <span className="text-slate-500">-</span>
                      ) : late ? (
                        <StatusPill tone="muted" label="갱신 지연" />
                      ) : (
                        <StatusPill tone={DX_LEVEL[sf.riskLevel].tone} label={DX_LEVEL[sf.riskLevel].label} />
                      )}
                    </td>
                    {DX_RISK_ITEMS.map((it) => {
                      const v = sf?.risks[it.key];
                      const isTop = !late && top?.label === it.label;
                      return (
                        <td
                          key={it.key}
                          className={`${TD_C} whitespace-nowrap tabular-nums ${typeof v !== 'number' ? 'text-slate-500' : isTop ? 'font-semibold text-amber-400' : late ? 'text-slate-500' : 'text-slate-200'}`}
                        >
                          {typeof v === 'number' ? fx(v, 0) : sf ? NONE : '-'}
                        </td>
                      );
                    })}
                    <td className={`${TD_C} whitespace-nowrap tabular-nums ${late ? 'text-slate-500' : 'text-slate-400'}`}>{sf ? hhmm(sf.diagnosedAt) : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SafetyTrend mac={sel?.mac} name={sel?.deviceName} />

      <Modal open={levelsOpen} onClose={() => setLevelsOpen(false)} title="전기안전지수 등급" size="sm">
        <table className={TABLE}>
          <thead>
            <tr className={TABLE_HEAD_ROW}>
              <th className={TABLE_TH}>등급</th>
              <th className={TABLE_TH}>riskLevel</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(DX_LEVEL) as (keyof typeof DX_LEVEL)[])
              .sort((a, b) => DX_LEVEL[a].order - DX_LEVEL[b].order)
              .map((k) => (
                <tr key={k} className={TABLE_ROW}>
                  <td className={TABLE_TD}>
                    <StatusPill tone={DX_LEVEL[k].tone} label={DX_LEVEL[k].label} />
                  </td>
                  <td className={`${TABLE_TD} font-mono text-sm text-slate-300`}>{k}</td>
                </tr>
              ))}
            {/* 등급 코드가 아니라 화면이 붙이는 상태 */}
            <tr className={TABLE_ROW}>
              <td className={TABLE_TD}>
                <StatusPill tone="muted" label="갱신 지연" />
              </td>
              <td className={`${TABLE_TD} text-sm text-slate-400`}>15분 넘게 산출 없음</td>
            </tr>
          </tbody>
        </table>
      </Modal>
    </div>
  );
}

/** 선택 센서 추이 — 전기안전지수(API-007, 5분, 최근 24시간). 등급이 바뀐 시각은 점 */
function SafetyTrend({ mac, name }: { mac?: string; name?: string }) {
  const q = useDxSafetyHistory(mac, 24);
  const data = (q.data ?? [])
    .filter((x: DxSafety) => x.safetyIndex != null)
    .map((x) => ({ t: x.windowStartedAt.slice(11, 16), v: Math.round((x.safetyIndex as number) * 10) / 10, l: x.riskLevel }));
  const changes = data.filter((d, i) => i > 0 && d.l !== data[i - 1]!.l);
  const lo = data.length ? Math.max(0, Math.floor((Math.min(...data.map((d) => d.v)) - 5) / 5) * 5) : 70;
  return (
    <SectionCard title={`선택 센서 추이${name ? ` · ${name}` : ''}`}>
      <div className="h-[230px]">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="t" tick={{ fontSize: 12, fill: '#cbd5e1' }} interval={47} axisLine={false} tickLine={false} />
              <YAxis domain={[lo, 100]} tick={{ fontSize: 12, fill: '#cbd5e1' }} axisLine={false} tickLine={false} width={40} />
              {/* 올리면 시각 · 지수 · 등급 */}
              {/* 올리면 시각 · 지수 · 등급(그 등급 색) */}
              <Tooltip
                content={({ active, payload }) => {
                  const p = active ? (payload?.[0]?.payload as { t: string; v: number; l: keyof typeof DX_LEVEL } | undefined) : undefined;
                  if (!p) return null;
                  return (
                    <div className="rounded-lg bg-[#0d1520] px-3 py-2 text-[13px] ring-1 ring-white/10">
                      <p className="text-slate-400">{p.t}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-semibold tabular-nums text-white">{fx(p.v)}</span>
                        <StatusPill tone={DX_LEVEL[p.l].tone} label={DX_LEVEL[p.l].label} />
                      </div>
                    </div>
                  );
                }}
              />
              <Line dataKey="v" name="전기안전지수" stroke="#e2e8f0" strokeWidth={1.6} dot={false} isAnimationActive={false} />
              {changes.map((c, i) => (
                // 등급이 바뀐 시각만 그 등급 색 점 — 글자는 없이(올리면 보인다)
                <ReferenceDot key={i} x={c.t} y={c.v} r={5} fill={TONE_HEX[DX_LEVEL[c.l].tone]} stroke="#0d1520" strokeWidth={1.5} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">{q.isLoading ? '불러오는 중' : NONE}</div>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-400">— 전기안전지수(5분) · 최근 24시간 · 점 = 등급이 바뀐 시각(그 등급 색)</p>
    </SectionCard>
  );
}
