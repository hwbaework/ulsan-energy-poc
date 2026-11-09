'use client';

/**
 * 연료전지 · ORC 발전소 상세 — 태양광(인버터)과 계측 구조가 달라 따로 그린다.
 * 태그 · 데모 값 근거는 src/lib/heat-plants.ts
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SectionCard } from '@/components/features';
import { TABLE, TABLE_HEAD_ROW, TABLE_ROW, TABLE_TD, TABLE_TH } from '@/components/features/DataList';
import { RmsAreaChart, RmsLineChart } from '@/components/ui/Chart';
import { StatusPill } from '@/components/ui/Design';
import { cn } from '@/lib/utils';
import {
  FC_CAPACITY_KW,
  ORC_CAPACITY_KW,
  ORC_MODULE_KW,
  fuelCellAt,
  fuelCellToday,
  fuelCellTodayKwh,
  orcAt,
  orcToday,
  orcTodayKwh,
} from '@/lib/heat-plants';

/** 1분마다 다시 계산 — 실시간 수집 간격 */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const fmt = (v: number, digits = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-accent/20 bg-surface-card p-4">
      <p className="text-sm text-slate-300 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}

/** 작은 값 칸 — 이름 · 값(단위 포함, 흰색 굵게) */
function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] px-3 py-2.5">
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-white tabular-nums">{value}</p>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />;
}

/* ══ 연료전지 ═══════════════════════════════════════════════ */

export function FuelCellDetail() {
  const now = useNow();
  const units = useMemo(() => fuelCellAt(now), [now]);
  const series = useMemo(() => fuelCellToday(now), [now]);
  const todayKwh = useMemo(() => fuelCellTodayKwh(now), [now]);
  const [open, setOpen] = useState<number | null>(null);

  const power = units.reduce((s, u) => s + u.powerKw, 0);
  const heat = units.reduce((s, u) => s + u.heatGcalH, 0);
  const running = units.reduce((s, u) => s + u.running, 0);
  const installed = units.reduce((s, u) => s + u.installed, 0);
  // 종합 효율 — 호기별 발전 출력 가중 평균
  const totalEff = units.reduce((s, u) => s + u.totalEff * u.powerKw, 0) / (power || 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi label="설비 용량" value={`${fmt(FC_CAPACITY_KW)} kW`} />
        <Kpi label="발전 출력" value={`${fmt(power)} kW`} />
        <Kpi label="운전 대수" value={`${running} / ${installed} 대`} />
        <Kpi label="열 생산" value={`${fmt(heat, 2)} Gcal/h`} />
        <Kpi label="종합 효율" value={`${fmt(totalEff, 1)} %`} />
        <Kpi label="금일 발전량" value={`${fmt(todayKwh)} kWh`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RmsAreaChart
          data={series}
          xKey="time"
          stacked
          areas={[
            { key: 'p1', name: '#1 (kW)', color: '#3B82F6' },
            { key: 'p2', name: '#2 (kW)', color: '#60A5FA' },
            { key: 'p3', name: '#3 (kW)', color: '#93C5FD' },
          ]}
          title="금일 발전 출력"
          height={240}
        />
        <RmsLineChart
          data={series}
          xKey="time"
          lines={[
            { key: 'h1', name: '#1 (Gcal/h)', color: '#F97316' },
            { key: 'h2', name: '#2 (Gcal/h)', color: '#FB923C' },
            { key: 'h3', name: '#3 (Gcal/h)', color: '#FDBA74' },
          ]}
          title="금일 열 생산"
          height={240}
        />
      </div>

      <SectionCard title="호기별 현황" noPadding>
        <div className="overflow-x-auto">
          <table className={TABLE}>
            <thead>
              <tr className={TABLE_HEAD_ROW}>
                <th className={TABLE_TH}>호기</th>
                <th className={TABLE_TH}>운전 대수</th>
                <th className={cn(TABLE_TH, 'text-right')}>발전 출력</th>
                <th className={cn(TABLE_TH, 'text-right')}>열 생산</th>
                <th className={cn(TABLE_TH, 'text-right')}>온수 유량</th>
                <th className={cn(TABLE_TH, 'text-right')}>공급 온도</th>
                <th className={cn(TABLE_TH, 'text-right')}>회수 온도</th>
                <th className={cn(TABLE_TH, 'text-right')}>발전 효율</th>
                <th className={cn(TABLE_TH, 'text-right')}>열 효율</th>
                <th className={cn(TABLE_TH, 'text-right')}>종합 효율</th>
                <th className={TABLE_TH}>상태</th>
                <th className={cn(TABLE_TH, 'w-8 px-1')} />
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <Fragment key={u.no}>
                  <tr
                    className={cn(TABLE_ROW, 'cursor-pointer hover:bg-white/[0.02]', open === u.no && 'bg-white/[0.03]')}
                    onClick={() => setOpen(open === u.no ? null : u.no)}
                  >
                    <td className={cn(TABLE_TD, 'font-semibold')}>#{u.no}</td>
                    <td className={cn(TABLE_TD, 'tabular-nums')}>{u.running} / {u.installed} 대</td>
                    <td className={cn(TABLE_TD, 'text-right tabular-nums')}>{fmt(u.powerKw)} kW</td>
                    <td className={cn(TABLE_TD, 'text-right tabular-nums')}>{fmt(u.heatGcalH, 2)} Gcal/h</td>
                    <td className={cn(TABLE_TD, 'text-right tabular-nums')}>{fmt(u.flowM3h, 1)} m³/h</td>
                    <td className={cn(TABLE_TD, 'text-right tabular-nums')}>{fmt(u.supplyTemp, 1)} ℃</td>
                    <td className={cn(TABLE_TD, 'text-right tabular-nums')}>{fmt(u.returnTemp, 1)} ℃</td>
                    <td className={cn(TABLE_TD, 'text-right tabular-nums')}>{fmt(u.elecEff, 1)} %</td>
                    <td className={cn(TABLE_TD, 'text-right tabular-nums')}>{fmt(u.heatEff, 1)} %</td>
                    <td className={cn(TABLE_TD, 'text-right tabular-nums')}>{fmt(u.totalEff, 1)} %</td>
                    <td className={TABLE_TD}>
                      <StatusPill tone="normal" label="정상" />
                    </td>
                    <td className={cn(TABLE_TD, 'px-1')}>
                      <Chevron open={open === u.no} />
                    </td>
                  </tr>
                  {open === u.no && (
                    <tr className="bg-white/[0.02]">
                      <td colSpan={12} className={TABLE_TD}>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                          <Cell label="누적 유량" value={`${fmt(u.flowTotalM3)} m³`} />
                          <Cell label="누적 열량" value={`${fmt(u.heatTotalGcal)} Gcal`} />
                          <Cell label="공급 · 회수 온도차" value={`${fmt(u.supplyTemp - u.returnTemp, 1)} ℃`} />
                          <Cell label="멈춘 대수" value={`${u.installed - u.running} 대`} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

/* ══ ORC ═════════════════════════════════════════════════════ */

export function OrcDetail() {
  const now = useNow();
  const s = useMemo(() => orcAt(now), [now]);
  const series = useMemo(() => orcToday(now), [now]);
  const today = useMemo(() => orcTodayKwh(now), [now]);
  const [open, setOpen] = useState<number | null>(null);

  const aux = s.grossKw - s.netKw;
  const g2Gross = s.grossKw - s.group1GrossKw;
  const g2Net = s.netKw - s.group1NetKw;
  // 1그룹 발전 효율 = 1그룹 발전 출력 ÷ 회수 열량(kW 환산 1 Gcal/h = 1,163 kW)
  const g1Eff = s.group1HeatGcalH > 0 ? (s.group1GrossKw / (s.group1HeatGcalH * 1163)) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi label="설비 용량" value={`${fmt(ORC_CAPACITY_KW)} kW`} />
        <Kpi label="발전 출력" value={`${fmt(s.grossKw, 1)} kW`} />
        <Kpi label="소내 소비" value={`${fmt(aux, 1)} kW`} />
        <Kpi label="공급 전력" value={`${fmt(s.supplyKw, 1)} kW`} />
        <Kpi label="금일 발전량" value={`${fmt(today.gross)} kWh`} />
        <Kpi label="금일 공급량" value={`${fmt(today.supply)} kWh`} />
      </div>

      <RmsLineChart
        data={series}
        xKey="time"
        lines={[
          { key: 'gross', name: '발전 출력 (kW)', color: '#8B5CF6' },
          { key: 'net', name: '순발전 (kW)', color: '#A78BFA' },
          { key: 'supply', name: '공급 전력 (kW)', color: '#10B981' },
        ]}
        title="금일 전력 추이"
        height={260}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { name: '1그룹', gross: s.group1GrossKw, net: s.group1NetKw, mods: s.modules.filter((m) => m.group === 1) },
          { name: '2그룹', gross: g2Gross, net: g2Net, mods: s.modules.filter((m) => m.group === 2) },
        ].map((g) => (
          <SectionCard key={g.name} title={g.name}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Cell label="모듈" value={`ORC#${g.mods[0]!.no} ~ #${g.mods[g.mods.length - 1]!.no}`} />
              <Cell label="발전 출력" value={`${fmt(g.gross, 1)} kW`} />
              <Cell label="순발전" value={`${fmt(g.net, 1)} kW`} />
              <Cell label="소내 소비" value={`${fmt(g.gross - g.net, 1)} kW`} />
            </div>
          </SectionCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="온수 계통 (1그룹)">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Cell label="공급 온도" value={`${fmt(s.loop.hotSupplyTemp, 1)} ℃`} />
            <Cell label="회수 유량" value={`${fmt(s.loop.hotReturnFlow, 1)} m³/h`} />
            <Cell label="누적 회수 유량" value={`${fmt(s.loop.hotReturnFlowTotal)} m³`} />
            <Cell label="회수 압력" value={`${fmt(s.loop.hotReturnPress, 2)} kg/cm²·g`} />
            <Cell label="펌프 출구 압력" value={`${fmt(s.loop.hotPumpPress, 2)} kg/cm²·g`} />
            <Cell label="펌프 전류" value={`${fmt(s.loop.hotPumpCurrent, 1)} A`} />
            <Cell label="회수 열량" value={`${fmt(s.group1HeatGcalH, 2)} Gcal/h`} />
            <Cell label="발전 효율" value={`${fmt(g1Eff, 1)} %`} />
          </div>
        </SectionCard>
        <SectionCard title="냉각 계통 (1그룹)">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Cell label="펌프 출구 압력" value={`${fmt(s.loop.coldPumpPress, 2)} kg/cm²·g`} />
              <Cell label="펌프 전류" value={`${fmt(s.loop.coldPumpCurrent, 1)} A`} />
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {s.loop.dryCoolers.map((pct, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm text-slate-300">드라이쿨러 #{i + 1}</span>
                  <div className="h-2 flex-1 rounded-full bg-white/[0.06]">
                    <div className="h-2 rounded-full bg-sky-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-12 text-right text-sm font-semibold text-white tabular-nums">{pct} %</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="모듈별 현황" noPadding>
        <div className="overflow-x-auto">
          <table className={TABLE}>
            <thead>
              <tr className={TABLE_HEAD_ROW}>
                <th className={TABLE_TH}>모듈</th>
                <th className={TABLE_TH}>그룹</th>
                <th className={cn(TABLE_TH, 'text-right')}>발전 출력</th>
                <th className={cn(TABLE_TH, 'text-right')}>온수 입구</th>
                <th className={cn(TABLE_TH, 'text-right')}>온수 출구</th>
                <th className={cn(TABLE_TH, 'text-right')}>냉각수 입구</th>
                <th className={cn(TABLE_TH, 'text-right')}>냉각수 출구</th>
                <th className={cn(TABLE_TH, 'text-right')}>회전수</th>
                <th className={cn(TABLE_TH, 'text-right')}>진동 A · B</th>
                <th className={TABLE_TH}>상태</th>
                <th className={cn(TABLE_TH, 'w-8 px-1')} />
              </tr>
            </thead>
            <tbody>
              {s.modules.map((m) => {
                const rpm = m.tags.find((t) => t.unit === 'RPM')?.value ?? 0;
                const vib = m.tags.filter((t) => t.unit === 'mm/s').map((t) => fmt(t.value, 2));
                return (
                  <Fragment key={m.no}>
                    <tr
                      className={cn(TABLE_ROW, 'cursor-pointer hover:bg-white/[0.02]', open === m.no && 'bg-white/[0.03]')}
                      onClick={() => setOpen(open === m.no ? null : m.no)}
                    >
                      <td className={cn(TABLE_TD, 'font-semibold')}>ORC#{m.no}</td>
                      <td className={TABLE_TD}>{m.group}그룹</td>
                      <td className={cn(TABLE_TD, 'text-right tabular-nums')}>
                        {fmt(m.powerKw, 1)} / {ORC_MODULE_KW} kW
                      </td>
                      <td className={cn(TABLE_TD, 'text-right tabular-nums')}>{fmt(m.hotIn, 1)} ℃</td>
                      <td className={cn(TABLE_TD, 'text-right tabular-nums')}>{fmt(m.hotOut, 1)} ℃</td>
                      <td className={cn(TABLE_TD, 'text-right tabular-nums')}>{fmt(m.coldIn, 1)} ℃</td>
                      <td className={cn(TABLE_TD, 'text-right tabular-nums')}>{fmt(m.coldOut, 1)} ℃</td>
                      <td className={cn(TABLE_TD, 'text-right tabular-nums')}>{fmt(rpm)} RPM</td>
                      <td className={cn(TABLE_TD, 'text-right tabular-nums')}>{vib.join(' · ')} mm/s</td>
                      <td className={TABLE_TD}>
                        <StatusPill tone="normal" label="정상" />
                      </td>
                      <td className={cn(TABLE_TD, 'px-1')}>
                        <Chevron open={open === m.no} />
                      </td>
                    </tr>
                    {open === m.no && (
                      <tr className="bg-white/[0.02]">
                        <td colSpan={11} className={TABLE_TD}>
                          {/* 이름(설명) 없이 받은 태그 — 태그 그대로 */}
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {m.tags.map((t, i) => (
                              <Cell key={`${t.tag}-${i}`} label={t.tag.replace(/^ENO-ORC\d+-/, '')} value={`${fmt(t.value, t.unit === 'RPM' ? 0 : t.unit === 'mm/s' ? 2 : 1)} ${t.unit}`} />
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
