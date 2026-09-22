'use client';

import { Fragment, useState } from 'react';
import { Wifi, WifiOff, Power, Radio, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusPill } from '@/components/ui/Design';
import type { InverterStatus, PlantConnectionStatus } from '@/types/monitoring';

/** ISO 시각 → HH:MM (초 표시 안 함) */
export function fmtHm(iso: string): string {
  if (!iso) return '—';
  const m = iso.match(/T(\d{2}:\d{2})/);
  return m ? m[1]! : iso;
}

/* ── Connection Status Banner ── */

export function ConnectionBanner({ status }: { status: PlantConnectionStatus }) {
  const normalCount = status.inverterConnections.filter((c) => c.state === 'NORMAL').length;
  const totalCount = status.inverterConnections.length;
  const invAllNormal = normalCount === totalCount;
  const allNormal = status.rtuPower === 'ON' && status.rtuConnection === 'NORMAL' && invAllNormal;

  return (
    <div
      className={cn(
        'rounded-lg border p-3 flex items-center gap-4 flex-wrap',
        allNormal ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5',
      )}
    >
      <div className="flex items-center gap-2">
        <Power size={14} className={status.rtuPower === 'ON' ? 'text-emerald-400' : 'text-red-400'} />
        <span className="text-sm text-slate-300">RTU 전원</span>
        <StatusPill tone={status.rtuPower === 'ON' ? 'normal' : 'danger'} label={status.rtuPower === 'ON' ? '켜짐' : '꺼짐'} />
      </div>

      <div className="w-px h-4 bg-white/10" />

      <div className="flex items-center gap-2">
        {status.rtuConnection === 'NORMAL' ? (
          <Wifi size={14} className="text-emerald-400" />
        ) : (
          <WifiOff size={14} className="text-red-400" />
        )}
        <span className="text-sm text-slate-300">RTU 통신</span>
        <StatusPill tone={status.rtuConnection === 'NORMAL' ? 'normal' : 'danger'} label={status.rtuConnection === 'NORMAL' ? '정상' : '오류'} />
      </div>

      <div className="w-px h-4 bg-white/10" />

      <div className="flex items-center gap-2">
        <Radio size={14} className={invAllNormal ? 'text-emerald-400' : 'text-amber-400'} />
        <span className="text-sm text-slate-300">인버터 통신</span>
        <StatusPill tone={invAllNormal ? 'normal' : 'warning'} label={`${normalCount}/${totalCount} 정상`} />
      </div>
    </div>
  );
}

/* ── Inverter Detail Table ── */

export function InverterDetailSection({ inverters }: { inverters: InverterStatus[] }) {
  const [expandedInv, setExpandedInv] = useState<number | null>(null);

  const totalDailyEnergy = inverters.reduce((s, inv) => s + inv.dailyEnergy, 0);
  const totalAcPower = inverters.reduce((s, inv) => s + inv.ac.power, 0);

  return (
    <div className="space-y-4">
      {/* Summary row */}
      {/* 요약 KPI: 라벨 + 수치 + 단위(값과 같은 색·크기) */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-sm text-slate-300 mb-1">인버터 수</p>
          <p className="text-2xl font-bold text-white tabular-nums">{inverters.length}대</p>
        </div>
        <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-sm text-slate-300 mb-1">총 AC 출력</p>
          <p className="text-2xl font-bold text-white tabular-nums">{totalAcPower.toFixed(1)} kW</p>
        </div>
        <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-sm text-slate-300 mb-1">금일 합산 발전</p>
          <p className="text-2xl font-bold text-white tabular-nums">{totalDailyEnergy.toFixed(1)} kWh</p>
        </div>
        <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-sm text-slate-300 mb-1">평균 역률</p>
          <p className="text-2xl font-bold text-slate-500 tabular-nums">-</p>
        </div>
      </div>

      {/* Inverter Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr className="border-b border-white/10">
              <th className="text-left text-slate-400 font-medium py-3 px-3">인버터</th>
              <th className="text-slate-400 font-medium py-3 px-3">DC전압</th>
              <th className="text-slate-400 font-medium py-3 px-3">DC전류</th>
              <th className="text-slate-400 font-medium py-3 px-3">DC전력</th>
              <th className="text-slate-400 font-medium py-3 px-3">AC전력</th>
              <th className="text-slate-400 font-medium py-3 px-3">역률</th>
              <th className="text-slate-400 font-medium py-3 px-3">주파수</th>
              <th className="text-slate-400 font-medium py-3 px-3">일발전</th>
              <th className="text-slate-400 font-medium py-3 px-3">통신</th>
              <th className="text-slate-400 font-medium py-3 px-3">상태</th>
              <th className="py-3 px-1 w-8" />
            </tr>
          </thead>
          <tbody>
            {inverters.map((inv) => (
              <Fragment key={inv.number}>
                <tr
                  className={cn(
                    'border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors',
                    expandedInv === inv.number && 'bg-white/[0.03]',
                  )}
                  onClick={() => setExpandedInv(expandedInv === inv.number ? null : inv.number)}
                >
                  <td className="py-3 px-3">
                    <span className="font-semibold text-white">INV-{String(inv.number).padStart(3, '0')}</span>
                  </td>
                  {/* DC전압: LASEE 미제공 — 백엔드 추가 시 inv.dc.voltage 사용 */}
                  <td className="py-3 px-3 text-slate-500">-</td>
                  {/* DC전류: LASEE 미제공 */}
                  <td className="py-3 px-3 text-slate-500">-</td>
                  <td className="py-3 px-3 text-white tabular-nums">{inv.dc.power.toFixed(1)} kW</td>
                  <td className="py-3 px-3 text-white tabular-nums">{inv.ac.power.toFixed(1)} kW</td>
                  <td className="py-3 px-3 text-slate-500">-</td>
                  <td className="py-3 px-3 text-slate-500">-</td>
                  <td className="py-3 px-3 text-white tabular-nums">{inv.dailyEnergy.toFixed(1)} kWh</td>
                  <td className="py-3 px-3">
                    <StatusPill
                      tone={inv.connectionState === 'NORMAL' ? 'normal' : 'danger'}
                      label={inv.connectionState === 'NORMAL' ? '정상' : '오류'}
                    />
                  </td>
                  <td className="py-3 px-3">
                    {inv.statusMessages.length > 0 ? (
                      <StatusPill tone="warning" label={inv.statusMessages[0]!} />
                    ) : (
                      <StatusPill tone="normal" label="정상" />
                    )}
                  </td>
                  <td className="py-3 px-1">
                    {expandedInv === inv.number ? (
                      <ChevronUp size={14} className="text-slate-500" />
                    ) : (
                      <ChevronDown size={14} className="text-slate-500" />
                    )}
                  </td>
                </tr>
                {/* AC 3-phase expanded row */}
                {expandedInv === inv.number && (
                  <tr className="bg-white/[0.02]">
                    <td colSpan={11} className="px-3 py-3">
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* AC Voltage 3-phase */}
                        <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3">
                          <p className="text-xs text-slate-400 mb-2">AC 전압 (3상)</p>
                          <div className="space-y-1.5">
                            {(['R', 'S', 'T'] as const).map((phase) => {
                              const key = `volt${phase}` as 'voltR' | 'voltS' | 'voltT';
                              return (
                                <div key={phase} className="flex items-center justify-between">
                                  <span
                                    className={cn(
                                      'text-xs font-medium w-4',
                                      phase === 'R'
                                        ? 'text-red-400'
                                        : phase === 'S'
                                          ? 'text-amber-400'
                                          : 'text-blue-400',
                                    )}
                                  >
                                    {phase}
                                  </span>
                                  <span className="text-sm text-white tabular-nums">{inv.ac[key].toFixed(1)} V</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {/* AC Current 3-phase */}
                        <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3">
                          <p className="text-xs text-slate-400 mb-2">AC 전류 (3상)</p>
                          <div className="space-y-1.5">
                            {(['R', 'S', 'T'] as const).map((phase) => {
                              const key = `current${phase}` as 'currentR' | 'currentS' | 'currentT';
                              return (
                                <div key={phase} className="flex items-center justify-between">
                                  <span
                                    className={cn(
                                      'text-xs font-medium w-4',
                                      phase === 'R'
                                        ? 'text-red-400'
                                        : phase === 'S'
                                          ? 'text-amber-400'
                                          : 'text-blue-400',
                                    )}
                                  >
                                    {phase}
                                  </span>
                                  <span className="text-sm text-white tabular-nums">{inv.ac[key].toFixed(1)} A</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {/* Additional info */}
                        <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3">
                          <p className="text-xs text-slate-400 mb-2">상세 정보</p>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-400">누적 발전</span>
                              <span className="text-sm text-white tabular-nums">
                                {inv.totalEnergy.toLocaleString()} kWh
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-400">마지막 수집</span>
                              <span className="text-xs text-slate-300">{fmtHm(inv.lastDataAt)}</span>
                            </div>
                            {inv.statusMessages.length > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400">상태 메시지</span>
                                <span className="text-xs text-amber-400">{inv.statusMessages.join(', ')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
