'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Breadcrumb } from '@/components/layout';
import { Button } from '@/components/ui/Button';
import { RmsLineChart } from '@/components/ui/Chart';
import { useMonitoringConsumers } from '@/hooks/monitoring/useMonitoring';
import { useVppDemandForecast, useVppDemandForecastSummary } from '@/hooks/der/useVpp';

// VPP 포트폴리오(집합) 시드 대상 id — 설계문서 23 §2. 관리 수용가 부하 합산(COMPLEX).
const PORTFOLIO_TARGET_ID = 9001;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// 수요(부하) 예측 — 집합(포트폴리오)=주, 개별 수요기업=종. 피크→DR 발령 연계. 설계문서 23.
export default function VppDemandForecastPage() {
  const consumersQ = useMonitoringConsumers();
  const consumers = consumersQ.data ?? [];
  // 기본 = 전체(집합) 뷰 — 첫 진입 공백 제거 (VPP 밸런싱 관점의 주 화면)
  const [targetId, setTargetId] = useState<number>(PORTFOLIO_TARGET_ID);
  const [from, setFrom] = useState<string>(isoDaysAgo(7));
  const [to, setTo] = useState<string>(isoDaysAgo(-1));
  const [horizon, setHorizon] = useState<string>('DAILY');

  const q = useVppDemandForecast(targetId, from, to, horizon);
  const summaryQ = useVppDemandForecastSummary(targetId, from, to);
  const rows = q.data ?? [];
  const summary = summaryQ.data;

  const isAggregate = targetId === PORTFOLIO_TARGET_ID;
  const selectedConsumer = consumers.find((c) => c.companyId === targetId);
  // DR 발령 제안 감축량 — 피크 부하의 10%(대표치). 실제 감축률은 DR 화면에서 확정.
  const suggestedKw = summary?.peakLoadKw != null ? Math.round(Number(summary.peakLoadKw) * 0.1) : 0;
  const drHref =
    `/vpp/dr?targetType=CONSUMER&targetRefId=${targetId}` +
    `&label=${encodeURIComponent(selectedConsumer?.name ?? '')}&suggestedKw=${suggestedKw}`;

  const chartData = rows.map((f) => ({
    label: `${f.targetDate.slice(5)} ${f.targetHour ?? 0}시`,
    예측: f.predictedLoadKw ? Number(f.predictedLoadKw) : 0,
    // 실측 없는 미래/오늘 행은 0이 아니라 선 끊기(null) — "실측 급락" 오해 방지
    실측: (f.actualLoadKw != null ? Number(f.actualLoadKw) : null) as unknown as number,
  }));

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: '분산에너지 효율화' }, { label: '수요 예측' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">수요(부하) 예측</h1>
        <span className="text-xs text-slate-400">부하 예측·실측·오차율 — 예측 엔진 재사용(platform/forecast)</span>
      </div>

      {/* 대상·기간 선택 — 전체(집합) 기본 + 개별 관리 수요기업 드릴다운 */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <label className="text-xs text-slate-400">
          대상
          <select
            value={targetId}
            onChange={(e) => setTargetId(Number(e.target.value))}
            className="mt-1 block w-56 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-white"
          >
            <option value={PORTFOLIO_TARGET_ID}>전체(집합) — VPP 포트폴리오</option>
            {consumers.map((c) => (
              <option key={c.companyId} value={c.companyId}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          기간
          <select
            value={horizon}
            onChange={(e) => setHorizon(e.target.value)}
            className="mt-1 block rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-white"
          >
            <option value="DAILY">일간</option>
            <option value="WEEKLY">주간</option>
          </select>
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
        {/* DR 연계 — 개별 수요기업 선택 시에만 피크→발령 (집합은 발령 대상 아님) */}
        {!isAggregate && (
          <Link href={drHref} className="ml-auto">
            <Button size="sm" variant="primary">
              DR 발령 후보로
            </Button>
          </Link>
        )}
      </div>

      {/* 요약 카드 — 피크 부하·부하율·MAPE */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="피크 부하(kW)"
          value={summary?.peakLoadKw != null ? `${Math.round(Number(summary.peakLoadKw)).toLocaleString()}` : '—'}
        />
        <SummaryCard label="부하율(%)" value={summary?.loadFactorPct != null ? `${summary.loadFactorPct}%` : '—'} />
        <SummaryCard label="MAPE(%)" value={summary?.mape != null ? `${summary.mape}%` : '—'} />
      </div>

      {/* 예측 vs 실측 차트 */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        {chartData.length > 0 ? (
          <RmsLineChart
            data={chartData}
            xKey="label"
            height={280}
            title={
              isAggregate
                ? 'VPP 포트폴리오 수요 — 예측 vs 실측'
                : `${selectedConsumer?.name ?? '수요기업'} 수요 — 예측 vs 실측`
            }
            lines={[
              { key: '예측', name: '예측(kW)', color: '#38BDF8' },
              { key: '실측', name: '실측(kW)', color: '#34D399' },
            ]}
          />
        ) : (
          <p className="py-10 text-center text-xs text-slate-500">
            {q.isLoading ? '불러오는 중…' : '해당 조건의 수요 예측 데이터가 없습니다.'}
          </p>
        )}
      </div>

      {/* 예측 vs 실측 상세 표 */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">대상일</th>
              <th className="px-4 py-3 text-right">시간</th>
              <th className="px-4 py-3">기간</th>
              <th className="px-4 py-3 text-right">예측(kW)</th>
              <th className="px-4 py-3 text-right">실측(kW)</th>
              <th className="px-4 py-3 text-right">오차율</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id} className="border-b border-white/[0.04] text-slate-300">
                <td className="px-4 py-2.5 text-xs">{f.targetDate}</td>
                <td className="px-4 py-2.5 text-right text-xs">{f.targetHour ?? '—'}</td>
                <td className="px-4 py-2.5 text-xs text-slate-400">{f.horizon}</td>
                <td className="px-4 py-2.5 text-right">
                  {f.predictedLoadKw ? Number(f.predictedLoadKw).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {f.actualLoadKw ? Number(f.actualLoadKw).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {f.errorRatePct != null ? (
                    <span className={Number(f.errorRatePct) > 10 ? 'text-amber-400' : 'text-emerald-400'}>
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
                  {q.isLoading ? '불러오는 중…' : '해당 조건의 수요 예측 데이터가 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">
        집합(포트폴리오)이 발전·수요 밸런싱의 기준이며, 개별 수요기업은 DR 발령을 위한 드릴다운입니다. 예측은 발전량
        예측 엔진(platform/forecast) 재사용 산출값, 실측은 모니터링 재사용 — 중복 수집 없음.
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
