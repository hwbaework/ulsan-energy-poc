'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQueries } from '@tanstack/react-query';
import { Breadcrumb } from '@/components/layout';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { RmsLineChart } from '@/components/ui/Chart';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { VppForecast } from '@/hooks/der/useVpp';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePowerStationsByCompany } from '@/hooks/common/usePowerStations';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

interface MergedRow {
  key: string;
  targetDate: string;
  targetHour: number | null;
  modelName: string;
  predictedKwh: number;
  actualKwh: number | null;
  errorRatePct: number | null;
}

// 발전량 예측 — 발전소 단위(주) + 전체 합산. platform/forecast 재사용(SSOT). 설계문서 23.
export default function VppForecastPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const stationsQ = usePowerStationsByCompany(companyId);
  // 발전유형 게이팅 — 태양광만 PPA·VPP 대상(설계25). 연료전지·ORC는 모니터링 전용.
  const stations = (stationsQ.data ?? []).filter((s) => s.generationType === 'SOLAR');
  const [plantSel, setPlantSel] = useState<string>('all'); // 'all' | 발전소 id
  const [from, setFrom] = useState<string>(isoDaysAgo(7));
  const [to, setTo] = useState<string>(isoDaysAgo(0));

  // 선택 대상 발전소 집합 — 'all'=전체 합산, 개별=해당 1기
  const targetStations = useMemo(
    () => (plantSel === 'all' ? stations : stations.filter((s) => String(s.id) === plantSel)),
    [plantSel, stations],
  );
  // ESS는 저장자원(dispatch)이라 발전량 예측 대상이 아님 — 빈 데이터가 정상. 설계문서 24 §1.
  const selectedStation = plantSel !== 'all' ? stations.find((s) => String(s.id) === plantSel) : undefined;
  const isEss = (selectedStation as { generationType?: string } | undefined)?.generationType === 'ESS';

  // 발전소별 예측 조회 → 시간대별 합산(백엔드 무변경, 클라이언트 집계)
  const results = useQueries({
    queries: targetStations.map((s) => ({
      queryKey: ['vpp', 'forecast', s.id, from, to],
      queryFn: () => getApiClient().get<VppForecast[]>(ENDPOINTS.vpp.forecast, { plantId: s.id, from, to }),
      enabled: !!from && !!to && targetStations.length > 0,
      retry: false as const,
    })),
  });
  const isLoading = results.some((r) => r.isLoading);

  const rows: MergedRow[] = useMemo(() => {
    const map = new Map<string, MergedRow>();
    for (const r of results) {
      for (const f of r.data ?? []) {
        const key = `${f.targetDate}|${f.targetHour ?? '-'}`;
        const cur = map.get(key) ?? {
          key,
          targetDate: f.targetDate,
          targetHour: f.targetHour,
          modelName: plantSel === 'all' ? '합산' : (f.modelName ?? '—'),
          predictedKwh: 0,
          actualKwh: null,
          errorRatePct: null,
        };
        cur.predictedKwh += f.predictedKwh ? Number(f.predictedKwh) : 0;
        if (f.actualKwh != null) cur.actualKwh = (cur.actualKwh ?? 0) + Number(f.actualKwh);
        map.set(key, cur);
      }
    }
    const arr = [...map.values()].map((row) => ({
      ...row,
      errorRatePct:
        row.actualKwh != null && row.predictedKwh > 0
          ? Math.round((Math.abs(row.actualKwh - row.predictedKwh) / row.predictedKwh) * 100 * 1000) / 1000
          : null,
    }));
    arr.sort((a, b) =>
      a.targetDate === b.targetDate ? (a.targetHour ?? 0) - (b.targetHour ?? 0) : a.targetDate < b.targetDate ? -1 : 1,
    );
    return arr;
  }, [results, plantSel]);

  // 요약(클라이언트 계산) — 총 예측·총 실측·MAPE
  const summary = useMemo(() => {
    const totalPredicted = rows.reduce((s, r) => s + r.predictedKwh, 0);
    const withActual = rows.filter((r) => r.actualKwh != null);
    const totalActual = withActual.reduce((s, r) => s + (r.actualKwh ?? 0), 0);
    const mape = withActual.length
      ? withActual.reduce((s, r) => s + (r.errorRatePct ?? 0), 0) / withActual.length
      : null;
    return { totalPredicted, totalActual, mape };
  }, [rows]);

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        label: `${r.targetDate.slice(5)} ${r.targetHour ?? 0}시`,
        예측: r.predictedKwh,
        // 실측 없는 미래/오늘 행은 0이 아니라 선 끊기(null) — "실측 급락" 오해 방지
        실측: (r.actualKwh ?? null) as unknown as number,
      })),
    [rows],
  );

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: '분산에너지 효율화' }, { label: '발전량 예측' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">발전량 예측</h1>
        <span className="text-xs text-slate-400">예측·실측·오차율 — VPP 예측 엔진(SSOT)</span>
      </div>

      {/* 대상·기간 선택 — 발전소 드롭다운(전체 합산 포함) */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <label className="text-xs text-slate-400">
          발전소
          <div className="mt-1 w-56">
            <Select
              options={[
                { value: 'all', label: '전체 합산' },
                ...stations.map((s) => ({
                  value: String(s.id),
                  label: `${s.name} (${s.capacityKw?.toLocaleString?.() ?? '—'} kW)`,
                })),
              ]}
              value={plantSel}
              onChange={(e) => setPlantSel(e.target.value)}
            />
          </div>
        </label>
        <label className="text-xs text-slate-400">
          시작일
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          종료일
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-white"
          />
        </label>
      </div>

      {stations.length === 0 && !stationsQ.isLoading ? (
        // 빈 상태 — 등록 원천(org/stations)으로 안내 (설계문서 22 패턴)
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <span className="text-xs text-slate-400">
            등록된 발전소가 없습니다. 먼저 발전소 관리에서 자산을 등록하세요.
          </span>
          <Link href="/org/stations">
            <Button size="sm" variant="secondary">
              발전소 관리로 이동
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard label="총 예측(kWh)" value={Math.round(summary.totalPredicted).toLocaleString()} />
            <SummaryCard
              label="총 실측(kWh)"
              value={summary.totalActual > 0 ? Math.round(summary.totalActual).toLocaleString() : '—'}
            />
            <SummaryCard label="MAPE(%)" value={summary.mape != null ? `${summary.mape.toFixed(2)}%` : '—'} />
          </div>

          {/* 예측 vs 실측 차트 */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            {chartData.length > 0 ? (
              <RmsLineChart
                data={chartData}
                xKey="label"
                height={280}
                title="예측 vs 실측 발전량"
                lines={[
                  { key: '예측', name: '예측(kWh)', color: '#38BDF8' },
                  { key: '실측', name: '실측(kWh)', color: '#34D399' },
                ]}
              />
            ) : (
              <p className="py-10 text-center text-xs text-slate-500">
                {isLoading
                  ? '불러오는 중…'
                  : isEss
                    ? 'ESS는 저장자원(dispatch)이라 발전량 예측 대상이 아닙니다 — 충·방전 스케줄링으로 관리됩니다.'
                    : '해당 조건의 예측 데이터가 없습니다.'}
              </p>
            )}
          </div>

          {/* 상세 표 */}
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                  <th className="px-4 py-3">대상일</th>
                  <th className="px-4 py-3 text-right">시간</th>
                  <th className="px-4 py-3">모델</th>
                  <th className="px-4 py-3 text-right">예측(kWh)</th>
                  <th className="px-4 py-3 text-right">실측(kWh)</th>
                  <th className="px-4 py-3 text-right">오차율</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.key} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-4 py-2.5 text-xs">{f.targetDate}</td>
                    <td className="px-4 py-2.5 text-right text-xs">{f.targetHour ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{f.modelName}</td>
                    <td className="px-4 py-2.5 text-right">{Math.round(f.predictedKwh).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      {f.actualKwh != null ? Math.round(f.actualKwh).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {f.errorRatePct != null ? (
                        <span className={f.errorRatePct > 10 ? 'text-amber-400' : 'text-emerald-400'}>
                          {f.errorRatePct}%
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-500">
                      {isLoading
                        ? '불러오는 중…'
                        : isEss
                          ? 'ESS는 저장자원(dispatch)이라 발전량 예측 대상이 아닙니다.'
                          : '해당 조건의 예측 데이터가 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="text-[11px] text-slate-500">
        기존 발전량 예측 도메인(KPX 제출·페널티 포함)을 재사용 — 계산 재구현 없음(재정립 원칙). 전체 합산은 발전소별
        예측의 시간대 합계입니다.
      </p>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}
