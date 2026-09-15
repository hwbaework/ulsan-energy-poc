'use client';

import type { LucideIcon } from 'lucide-react';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlantRow {
  id: string;
  name: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  status: { label: string; tone: string; bg: string; ring: string; icon: LucideIcon };
  resource: string;
  capacityKw: number;
  dailyGenKwh: number | null;
  genHours: number | null;
  monthlyKwh: number | null;
  inverter?: { normal: number; total: number };
  alarm?: { title: string; detail?: string; severity: 'warning' | 'error' };
  onDetail?: () => void;
}

export function PlantStatusTable({ plants }: { plants: PlantRow[] }) {
  return (
    <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
      <div className="px-5 py-3 border-b border-white/[0.06]">
        <h3 className="text-md font-semibold text-white">발전소 상태 보드</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
              <th className="px-4 py-2 text-left font-medium">발전소</th>
              <th className="px-4 py-2 text-left font-medium">상태</th>
              <th className="px-4 py-2 text-left font-medium">자원</th>
              <th className="px-4 py-2 font-medium">용량</th>
              <th className="px-4 py-2 font-medium">발전량 (오늘)</th>
              <th className="px-4 py-2 font-medium">발전시간</th>
              <th className="px-4 py-2 font-medium">이번 달 누적</th>
              <th className="px-4 py-2 font-medium">인버터</th>
              <th className="px-4 py-2 text-left font-medium">알람</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {plants.map((p) => {
              const sm = p.status;
              const inv = p.inverter;
              const invAllNormal = inv && inv.total > 0 && inv.normal === inv.total;
              return (
                <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={cn('flex h-7 w-7 items-center justify-center rounded-md', p.iconBg)}>
                        <p.icon size={13} className={p.iconColor} />
                      </span>
                      <p className="text-sm font-semibold text-white">{p.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium ring-1',
                        sm.bg,
                        sm.tone,
                        sm.ring,
                      )}
                    >
                      <sm.icon size={10} />
                      {sm.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">{p.resource}</td>
                  <td className="px-4 py-3 tabular-nums text-sm text-white">{p.capacityKw.toLocaleString()} kW</td>
                  <td className="px-4 py-3 tabular-nums text-sm text-violet-300">
                    {p.dailyGenKwh != null ? `${p.dailyGenKwh.toLocaleString()} kWh` : '—'}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-sm text-amber-300">
                    {p.genHours != null ? `${p.genHours.toFixed(2)} h` : '—'}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-sm text-slate-300">
                    {p.monthlyKwh != null ? `${p.monthlyKwh.toLocaleString()} kWh` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {inv && inv.total > 0 ? (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
                          invAllNormal
                            ? 'bg-emerald-500/[0.10] text-emerald-300 ring-emerald-500/30'
                            : 'bg-amber-500/[0.10] text-amber-300 ring-amber-500/30',
                        )}
                      >
                        {inv.normal}/{inv.total} 정상
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.alarm ? (
                      <div className="flex items-start gap-1.5">
                        <AlertCircle
                          size={11}
                          className={cn(
                            'mt-0.5 shrink-0',
                            p.alarm.severity === 'error' ? 'text-rose-300' : 'text-amber-300',
                          )}
                        />
                        <div>
                          <p
                            className={cn(
                              'text-[11px] font-medium',
                              p.alarm.severity === 'error' ? 'text-rose-200' : 'text-amber-200',
                            )}
                          >
                            {p.alarm.title}
                          </p>
                          {p.alarm.detail && <p className="text-[10px] text-slate-500">{p.alarm.detail}</p>}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.onDetail && (
                      <button
                        type="button"
                        onClick={p.onDetail}
                        className="text-[11px] text-slate-400 hover:text-white"
                      >
                        상세 <ArrowRight size={9} className="inline ml-0.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
