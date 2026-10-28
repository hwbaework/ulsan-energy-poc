'use client';

import { Info } from 'lucide-react';
import { StatusPill } from '@/components/ui/Design';
import { Tooltip as Hint } from '@/components/ui/Tooltip';
import { useDxLatest, useDxSafety } from '@/hooks/control/useDx';
import {
  DX_LEVEL,
  dxMetric,
  dxSensorsOf,
  firstNum,
  hasDx,
  hhmm,
  isSafetyLate,
  isStale,
  topRisk,
  worstSafety,
} from '@/lib/dx';
import { TABLE, TABLE_HEAD_ROW, TABLE_ROW, TABLE_TD, TABLE_TH } from '@/components/features/DataList';
import type { MonitoringPlant } from '@/types/monitoring';

// 안전 상세 — 회사(발전소) 하나의 DX 스마트센서 실시간 값(아이티공간 UMEI 연계 v1.1).
// 전기안전지수(API-006, 5분)와 과열·전기 징후(API-003, 1분). 센서가 여러 대면 가장 나쁜 값.
// 값이 없으면 미수신 · 수집 중단 · 갱신 지연(한길 · 건호이엔씨는 연계 문서 v1.1 센서 목록에 아직 없어 미수신).
const fx = (v: number | null | undefined, d = 1) =>
  v == null ? null : v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });

function Val({ label, value, unit }: { label: string; value: string | null; unit: string }) {
  return (
    <div>
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${value ? 'text-white' : 'text-slate-500'}`}>
        {value ?? '미산출'}
        {value && <span className="ml-1 text-sm font-normal text-slate-400">{unit}</span>}
      </p>
    </div>
  );
}

/** 회사 하나의 안전 — 전기안전지수 · 과열 · 전기 징후 · 센서별 표 */
export function SafetyCompanyCard({ plant }: { plant: MonitoringPlant }) {
  const dx = hasDx(plant.plantId);
  const latestQ = useDxLatest(dx ? plant.plantId : undefined);
  const safetyQ = useDxSafety(dx ? plant.plantId : undefined);
  const sensors = dxSensorsOf(plant.plantId);

  const live = (latestQ.data ?? []).filter((x) => !isStale(x));
  const worst = worstSafety(safetyQ.data ?? []);
  // 센서 결과가 모두 15분 넘게 멈췄으면 '미산출'이 아니라 '갱신 지연'(연계 문서 6.2)
  const allLate = !worst && (safetyQ.data ?? []).length > 0 && (safetyQ.data ?? []).every((x) => isSafetyLate(x));
  const max = (code: string) => {
    const v = live.map((x) => firstNum(dxMetric(x, code))).filter((n): n is number => n != null);
    return v.length ? Math.max(...v) : null;
  };
  const lastAt = live
    .map((x) => x.receivedAt)
    .sort()
    .at(-1);
  const receiving = live.length;

  return (
    <div className="rounded-xl bg-[#0d1520] p-5 ring-1 ring-white/[0.06]">
      <div className="flex flex-wrap items-center gap-2">
        {/* 수신 상태 — 센서 몇 대가 지금 값을 보내는지(회사 이름은 페이지 제목) */}
        <span className="flex items-center gap-1.5 text-sm text-slate-300">
          <span
            className={`h-2 w-2 rounded-full ${sensors.length === 0 ? 'bg-slate-500' : receiving === sensors.length ? 'animate-pulse bg-emerald-400' : receiving > 0 ? 'bg-amber-400' : 'bg-red-400'}`}
          />
          {sensors.length === 0 ? '미수신' : `수신 ${receiving}/${sensors.length}`}
          {lastAt && <span className="tabular-nums text-slate-400">· {lastAt.slice(11, 19)}</span>}
        </span>
      </div>

      {/* 제목 줄 · 숫자 줄을 나누고, 등급은 숫자 바로 옆 · 산출 시각은 제목 줄 오른쪽 */}
      <div className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <p className="text-sm text-slate-400">전기안전지수</p>
            <Hint content="0~100, 높을수록 양호합니다. 센서가 여러 대면 가장 낮은 값입니다. 당사 운영 기준의 상태 지표이며 법정 · 표준 판정이 아닙니다. 보호계전기 동작을 대신하지 않습니다." wide position="bottom">
              <span tabIndex={0} role="img" aria-label="전기안전지수 설명" className="inline-flex">
                <Info size={14} className="cursor-help text-slate-400 hover:text-white" />
              </span>
            </Hint>
          </div>
          {worst && <span className="text-sm tabular-nums text-slate-400">산출 {hhmm(worst.diagnosedAt)}</span>}
        </div>
        <div className="mt-1 flex items-center gap-2.5">
          <span className={`text-3xl font-bold tabular-nums ${worst ? 'text-white' : 'text-slate-500'}`}>
            {fx(worst?.safetyIndex) ?? (allLate ? '-' : '미산출')}
          </span>
          {worst && <StatusPill tone={DX_LEVEL[worst.riskLevel].tone} label={DX_LEVEL[worst.riskLevel].label} />}
          {allLate && <StatusPill tone="muted" label="갱신 지연" />}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/[0.06] pt-4 sm:grid-cols-4">
        <Val label="설비 온도" value={fx(max('temperature'))} unit="℃" />
        <Val label="누설전류" value={fx(max('ground_current'), 3)} unit="A" />
        <Val label="고조파 THD" value={fx(max('thdi'))} unit="%" />
        <Val label="전류 불평형" value={fx(max('current_unbalance'))} unit="%" />
      </div>

      {/* 센서별 — 위 값은 센서 중 가장 나쁜 값, 여기서 센서마다 */}
      {sensors.length > 0 && (
        <div className="mt-4 overflow-x-auto border-t border-white/[0.06] pt-3">
          <table className={TABLE}>
            <thead>
              <tr className={TABLE_HEAD_ROW}>
                <th className={TABLE_TH}>센서</th>
                <th className={`${TABLE_TH}`}>안전지수</th>
                <th className={TABLE_TH}>등급</th>
                <th className={TABLE_TH}>위험 항목</th>
                <th className={`${TABLE_TH}`}>온도 ℃</th>
                <th className={`${TABLE_TH}`}>누설 A</th>
                <th className={`${TABLE_TH}`}>THD %</th>
                <th className={`${TABLE_TH}`}>불평형 %</th>
                <th className={TABLE_TH}>수신</th>
              </tr>
            </thead>
            <tbody>
              {sensors.map((sn) => {
                const lt = latestQ.data?.find((x) => x.macAddress === sn.mac);
                const sf = safetyQ.data?.find((x) => x.macAddress === sn.mac);
                const stale = isStale(lt);
                const late = isSafetyLate(sf);
                const t = topRisk(sf);
                const v = (code: string, d = 1) => (stale ? null : fx(firstNum(dxMetric(lt, code)), d));
                const cellNum = (x: string | null) => (
                  <td
                    className={`${TABLE_TD} whitespace-nowrap tabular-nums ${x ? 'text-slate-200' : 'text-slate-500'}`}
                  >
                    {x ?? '-'}
                  </td>
                );
                return (
                  <tr key={sn.mac} className={TABLE_ROW}>
                    <td className={`${TABLE_TD} whitespace-nowrap font-medium text-white`}>{sn.deviceName}</td>
                    <td
                      className={`${TABLE_TD} tabular-nums ${sf && !late ? 'text-white' : 'text-slate-500'}`}
                    >
                      {fx(sf?.safetyIndex) ?? '미산출'}
                    </td>
                    <td className={`${TABLE_TD} whitespace-nowrap`}>
                      {!sf ? (
                        '-'
                      ) : late ? (
                        <StatusPill tone="muted" label="갱신 지연" />
                      ) : (
                        <StatusPill tone={DX_LEVEL[sf.riskLevel].tone} label={DX_LEVEL[sf.riskLevel].label} />
                      )}
                    </td>
                    <td className={`${TABLE_TD} whitespace-nowrap text-slate-300`}>
                      {t ? `${t.label} ${Math.round(t.score)}` : '-'}
                    </td>
                    {cellNum(v('temperature'))}
                    {cellNum(v('ground_current', 3))}
                    {cellNum(v('thdi'))}
                    {cellNum(v('current_unbalance'))}
                    <td
                      className={`${TABLE_TD} whitespace-nowrap tabular-nums ${stale ? 'text-red-300' : 'text-slate-400'}`}
                    >
                      {stale ? (lt ? '수집 중단' : '미수신') : (lt?.receivedAt.slice(11, 19) ?? '-')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
