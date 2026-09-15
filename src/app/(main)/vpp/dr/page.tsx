'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueries } from '@tanstack/react-query';
import { Activity, Info, Zap, Send, Scale, Users, PlusCircle, Gauge, CheckCircle2 } from 'lucide-react';
import { Breadcrumb } from '@/components/layout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { RmsLineChart } from '@/components/ui/Chart';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { useMonitoringConsumers } from '@/hooks/monitoring/useMonitoring';
import { usePowerStationsByCompany } from '@/hooks/common/usePowerStations';
import {
  useVppResources,
  useVppDemandForecast,
  useDrEvents,
  useDrDispatch,
  useDrVerify,
  useDrResources,
  useRegisterDrResource,
  type VppForecast,
  type DrResource,
  type DrEvent,
} from '@/hooks/der/useVpp';

// DR(수요반응) — 거래 없는 VPP=발전 효율관리. 발전 예측(공급)↔수요 예측(부하)→시간대별 수급 갭→갭 큰 시간에 DR 발령(수요 감축).
// 설계문서 25(VPP=효율관리, 거래·정산 없음) · 23(수요예측 피크→DR 폐루프).
const DR_STEPS = [
  {
    t: '자원 등록',
    d: '감축 가능 수용가를 DR 자원으로 등록 — 감축용량·기준부하(baseline) 확보로 이행 검증 기준선 마련',
  },
  { t: 'DR 발령', d: '수급 갭이 큰 시간대(야간·저녁)에 대상 수용가 부하 감축 발령 — 공급부족 완화' },
  { t: '이행 검증', d: 'DR 감축 이행 실적을 입력·계측(actualReductionKw)해 이행률(fulfillmentPct) 자동 산출' },
  { t: '이행 성과', d: '검증완료 이력을 집계해 누적 피크 감축(효율 성과) 확인 — 재무 정산 아님' },
];

// VPP 포트폴리오(집합) 시드 대상 id — 관리 수용가 부하 합산(COMPLEX). 설계문서 23 §2.
const PORTFOLIO_TARGET_ID = 9001;

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

interface BalanceRow {
  key: string;
  label: string; // 날짜+시 (x축)
  supplyKw: number; // 태양광 공급 예측 합산(kWh/h를 평균 kW로 간주)
  demandKw: number; // 수용가 부하 예측(kW)
  gapKw: number; // 수요 − 공급 (양수=공급부족)
  hasSupply: boolean; // 이 (date,hour)에 공급 예측이 존재하는가 (갭 산출 대상 한정용)
}

export default function VppDrPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const addToast = useToastStore((s) => s.add);

  // ── 수요예측에서 넘어온 딥링크 프리필 (없으면 빈 폼 — 사이드이펙트 0) ──
  const params = useSearchParams();
  const [targetType, setTargetType] = useState<string>(params.get('targetType') ?? 'CONSUMER');
  const [targetRefId, setTargetRefId] = useState<string>(params.get('targetRefId') ?? '');
  const [label, setLabel] = useState<string>(params.get('label') ?? '');
  const [roundLabel, setRoundLabel] = useState<string>(`DR-${today()}`);
  const [reductionKw, setReductionKw] = useState<string>(params.get('suggestedKw') ?? '');
  const [reason, setReason] = useState<string>(
    params.get('label') ? `수요예측 피크 대응 — ${params.get('label')}` : '',
  );

  const eventsQ = useDrEvents(companyId);
  const events = (eventsQ.data as { content?: unknown[] } | undefined)?.content ?? [];
  const dispatchMut = useDrDispatch();

  const canDispatch = !!companyId && !!targetRefId && !!roundLabel && Number(reductionKw) > 0;
  const submitDispatch = () => {
    if (!canDispatch || !companyId) return;
    dispatchMut.mutate(
      {
        companyId,
        roundLabel,
        targetType,
        targetRefId: Number(targetRefId),
        targetReductionKw: Number(reductionKw),
        reason: reason || undefined,
      },
      {
        onSuccess: () => {
          addToast('success', `${label || '대상'} DR 발령 완료 (${reductionKw} kW)`);
          setReductionKw('');
        },
        onError: () => addToast('error', 'DR 발령에 실패했습니다.'),
      },
    );
  };

  // 수용가 후보 행 클릭 → DR 발령 폼 프리필 (딥링크와 동일 동작)
  const prefillFromConsumer = (c: { companyId: number; name: string; suggestedKw: number }) => {
    setTargetType('CONSUMER');
    setTargetRefId(String(c.companyId));
    setLabel(c.name);
    if (c.suggestedKw > 0) setReductionKw(String(c.suggestedKw));
    setReason(`수급 갭 대응 — ${c.name}`);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── 수급 밸런스 기간 (근거) — 시드는 과거일에 데이터. 기본 최근 2일(어제-1 ~ 오늘) ──
  const [from, setFrom] = useState<string>(isoDaysAgo(2));
  const [to, setTo] = useState<string>(isoDaysAgo(0));

  // 공급(발전) — 로그인 회사 태양광 발전소 예측 합산. 설계25: 태양광만 VPP 대상.
  const stationsQ = usePowerStationsByCompany(companyId);
  const solarStations = useMemo(
    () => (stationsQ.data ?? []).filter((s) => s.generationType === 'SOLAR'),
    [stationsQ.data],
  );
  const supplyResults = useQueries({
    queries: solarStations.map((s) => ({
      queryKey: ['vpp', 'forecast', 'dr-balance', s.id, from, to],
      queryFn: () => getApiClient().get<VppForecast[]>(ENDPOINTS.vpp.forecast, { plantId: s.id, from, to }),
      enabled: !!from && !!to && solarStations.length > 0,
      retry: false as const,
    })),
  });
  const supplyLoading = supplyResults.some((r) => r.isLoading);

  // 수요(부하) — COMPLEX 포트폴리오(9001). predictedLoadKw.
  const demandQ = useVppDemandForecast(PORTFOLIO_TARGET_ID, from, to, 'DAILY');

  // 같은 (date,hour) 키로 병합. 갭 = 수요(kW) − 공급(kWh/h를 평균 kW로 간주).
  // today 아티팩트 방지: 공급 예측이 존재하는 (date,hour)에서만 갭을 산출한다.
  const balanceRows: BalanceRow[] = useMemo(() => {
    const map = new Map<string, BalanceRow>();
    const ensure = (date: string, hour: number | null): BalanceRow => {
      const h = hour ?? 0;
      const key = `${date}|${h}`;
      let cur = map.get(key);
      if (!cur) {
        cur = { key, label: `${date.slice(5)} ${h}시`, supplyKw: 0, demandKw: 0, gapKw: 0, hasSupply: false };
        map.set(key, cur);
      }
      return cur;
    };
    for (const r of supplyResults) {
      for (const f of r.data ?? []) {
        const row = ensure(f.targetDate, f.targetHour);
        row.supplyKw += f.predictedKwh ? Number(f.predictedKwh) : 0;
        row.hasSupply = true; // 공급 예측이 붙은 (date,hour)만 표기
      }
    }
    for (const f of demandQ.data ?? []) {
      const row = ensure(f.targetDate, f.targetHour);
      row.demandKw += f.predictedLoadKw ? Number(f.predictedLoadKw) : 0;
    }
    const rows = Array.from(map.values());
    // 갭은 공급이 존재하는 시간대만 (공급 0인 날의 허위 주간 갭 방지)
    for (const r of rows) r.gapKw = r.hasSupply ? r.demandKw - r.supplyKw : 0;
    rows.sort((a, b) => a.key.localeCompare(b.key));
    return rows;
  }, [supplyResults, demandQ.data]);

  const balanceLoading = supplyLoading || demandQ.isLoading;

  // 최대 공급부족(갭 최대) 시간대 요약 — 공급 존재 시간대만 대상.
  const worstGap = useMemo(() => {
    let worst: BalanceRow | null = null;
    for (const r of balanceRows) {
      if (r.hasSupply && r.gapKw > 0 && (!worst || r.gapKw > worst.gapKw)) worst = r;
    }
    return worst;
  }, [balanceRows]);

  const chartData = balanceRows.map((r) => ({
    label: r.label,
    '공급(태양광)': Math.round(r.supplyKw),
    '수요(부하)': Math.round(r.demandKw),
  }));

  // ── DR 대상 후보 = 수용가(수요기업). 개념 교정: DR은 부하 감축이 본질. ──
  const consumersQ = useMonitoringConsumers();
  const consumers = consumersQ.data ?? [];

  // ── DR 자원(감축 가능 자원 baseline) — 이행 검증의 기준선·감축용량 확보. ──
  const drResourcesQ = useDrResources(companyId);
  const drResources = drResourcesQ.data ?? [];
  // resourceId(=수용가 companyId) → 등록된 감축용량(kW) 매핑. 제안 감축량 우선 사용.
  const drCapByConsumer = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of drResources) {
      const cap = r.reductionCapacityKw != null ? Number(r.reductionCapacityKw) : 0;
      if (r.resourceId != null && cap > 0) m.set(r.resourceId, cap);
    }
    return m;
  }, [drResources]);

  // 제안 감축량 — 등록된 dr_resource.reductionCapacityKw가 있으면 우선. 없으면 월수요 proxy(kWh/730h*10%).
  const consumerRows = consumers.map((c) => {
    const registered = drCapByConsumer.get(c.companyId);
    let suggestedKw: number;
    let source: 'registered' | 'proxy' | 'none';
    if (registered != null && registered > 0) {
      suggestedKw = Math.round(registered);
      source = 'registered';
    } else {
      const avgLoadKw = c.monthlyDemandKwh ? c.monthlyDemandKwh / 730 : 0;
      suggestedKw = avgLoadKw > 0 ? Math.round(avgLoadKw * 0.1) : 0;
      source = suggestedKw > 0 ? 'proxy' : 'none';
    }
    return { companyId: c.companyId, name: c.name, suggestedKw, source };
  });

  // ── DR 자원 등록 폼 ──
  const registerMut = useRegisterDrResource();
  const [drTargetConsumer, setDrTargetConsumer] = useState<string>('');
  const [drReductionCapacityKw, setDrReductionCapacityKw] = useState<string>('');
  const [drBaselineKwh, setDrBaselineKwh] = useState<string>('');
  const consumerOptions = consumers.map((c) => ({ value: String(c.companyId), label: c.name }));
  const canRegisterDr = !!companyId && !!drTargetConsumer && Number(drReductionCapacityKw) > 0;
  const submitRegisterDr = () => {
    if (!canRegisterDr || !companyId) return;
    const picked = consumers.find((c) => String(c.companyId) === drTargetConsumer);
    registerMut.mutate(
      {
        resourceId: Number(drTargetConsumer),
        companyId,
        reductionCapacityKw: Number(drReductionCapacityKw),
        ...(Number(drBaselineKwh) > 0 ? { baselineKwh: Number(drBaselineKwh) } : {}),
      },
      {
        onSuccess: () => {
          addToast('success', `${picked?.name ?? '수용가'} DR 자원 등록 완료 (${drReductionCapacityKw} kW)`);
          setDrTargetConsumer('');
          setDrReductionCapacityKw('');
          setDrBaselineKwh('');
        },
        onError: () => addToast('error', 'DR 자원 등록에 실패했습니다.'),
      },
    );
  };

  // ── 이행 검증 (verify) — DISPATCHED 이력에 실적 입력 ──
  const verifyMut = useDrVerify();
  const [verifyEvent, setVerifyEvent] = useState<DrEvent | null>(null);
  const [verifyKw, setVerifyKw] = useState<string>('');
  const openVerify = (ev: DrEvent) => {
    setVerifyEvent(ev);
    setVerifyKw(ev.targetReductionKw != null ? String(ev.targetReductionKw) : '');
  };
  const closeVerify = () => {
    setVerifyEvent(null);
    setVerifyKw('');
  };
  const canVerify = !!verifyEvent && Number(verifyKw) > 0;
  const submitVerify = () => {
    if (!canVerify || !verifyEvent) return;
    verifyMut.mutate(
      { id: verifyEvent.id, actualReductionKw: Number(verifyKw) },
      {
        onSuccess: () => {
          addToast('success', `${verifyEvent.roundLabel} 이행 실적 반영 완료 (${verifyKw} kW)`);
          closeVerify();
        },
        onError: () => addToast('error', '이행 실적 입력에 실패했습니다.'),
      },
    );
  };

  // ── DR 이행 성과(효율) — 재무 정산 아님. 검증완료(actualReductionKw 존재) 이력 집계. ──
  const performance = useMemo(() => {
    let totalActualKw = 0;
    let pctSum = 0;
    let verifiedCount = 0;
    for (const e of events) {
      const ev = e as DrEvent;
      if (ev.actualReductionKw != null && ev.actualReductionKw !== '') {
        verifiedCount += 1;
        totalActualKw += Number(ev.actualReductionKw) || 0;
        if (ev.fulfillmentPct != null && ev.fulfillmentPct !== '') pctSum += Number(ev.fulfillmentPct) || 0;
      }
    }
    return {
      totalActualKw,
      avgFulfillmentPct: verifiedCount > 0 ? pctSum / verifiedCount : 0,
      verifiedCount,
      totalEvents: events.length,
    };
  }, [events]);

  // ── (참고) 관리 발전 자원 — 발령 대상 아님. 기존 편입 자원 표를 강등. ──
  const resourcesQ = useVppResources(companyId);
  const resources = resourcesQ.data ?? [];
  const enrolled = resources.filter((r) => r.linked);

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: '분산에너지 효율화' }, { label: 'DR(수요반응)' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">DR (수요반응)</h1>
        <span className="text-xs text-slate-400">발전 효율관리 → 수급 갭 → 수요 감축 발령</span>
      </div>

      {/* DR 프로그램 절차 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {DR_STEPS.map((s, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Activity size={14} className="text-sky-400" /> {s.t}
            </div>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">{s.d}</p>
          </div>
        ))}
      </div>

      {/* 수급 밸런스 (발전 공급 vs 수요 부하) — DR 발령 근거. 설계문서 25 */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Scale size={14} className="text-sky-400" /> 수급 밸런스 (공급 vs 수요)
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" className="w-[140px]" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-xs text-slate-500">~</span>
            <Input type="date" className="w-[140px]" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          공급=회사 태양광 발전소 예측 합산(kW) · 수요=관리 수용가 부하 예측(kW, COMPLEX 포트폴리오). 갭 = 수요 −
          공급(양수=공급부족).
          <span className="ml-1 text-amber-400/80">
            공급 kWh/h ≈ 평균 kW로 간주해 kW로 통일. 공급 예측이 있는 시간대만 갭 산출.
          </span>
        </p>

        {/* 요약 카드 */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="text-[11px] text-slate-500">최대 공급부족 시간대</div>
            <div className="mt-1 text-lg font-semibold text-white">{worstGap ? worstGap.label : '—'}</div>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="text-[11px] text-slate-500">그 시간대 부족량(갭)</div>
            <div className="mt-1 text-lg font-semibold text-rose-300">
              {worstGap ? `${Math.round(worstGap.gapKw).toLocaleString()} kW` : '—'}
            </div>
          </div>
          <div className="rounded-lg border border-sky-500/20 bg-sky-500/[0.04] p-3">
            <div className="text-[11px] text-slate-500">권장 조치</div>
            <div className="mt-1 text-sm font-medium text-sky-300">
              {worstGap ? '이 시간대 DR 발령 권장 (수요 감축)' : '공급부족 시간대 없음'}
            </div>
          </div>
        </div>

        {/* 차트 */}
        <div className="mt-4">
          {balanceLoading ? (
            <div className="flex h-[280px] items-center justify-center text-xs text-slate-500">불러오는 중…</div>
          ) : chartData.length ? (
            <RmsLineChart
              data={chartData}
              xKey="label"
              lines={[
                { key: '공급(태양광)', name: '공급(태양광 예측)', color: '#38bdf8' },
                { key: '수요(부하)', name: '수요(부하 예측)', color: '#f43f5e' },
              ]}
              height={300}
            />
          ) : (
            <div className="flex h-[280px] items-center justify-center text-xs text-slate-500">
              선택 기간에 수급 예측 데이터가 없습니다. 기간을 과거일(시드 범위)로 조정하세요.
            </div>
          )}
        </div>
      </div>

      {/* DR 자원 등록 (감축 가능 자원) — 이행검증 기준선(baseline)·감축용량 확보 */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <PlusCircle size={14} className="text-sky-400" /> DR 자원 등록 (감축 가능 자원)
          </div>
          <span className="text-xs text-slate-400">등록 {drResources.length}건</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          수용가별 감축용량(kW)과 기준부하(baseline)를 등록하면 이행 검증의 기준선이 되고, 아래 대상 후보의 &apos;제안
          감축량&apos;에 우선 반영됩니다. (부하측 DR — 발전소 연계 없음)
        </p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <label className="text-xs text-slate-400">
            대상 수용가
            <Select
              className="mt-1"
              placeholder="수용가 선택"
              options={consumerOptions}
              value={drTargetConsumer}
              onChange={(e) => setDrTargetConsumer(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-400">
            감축용량(kW)
            <Input
              className="mt-1"
              type="number"
              min={0}
              value={drReductionCapacityKw}
              onChange={(e) => setDrReductionCapacityKw(e.target.value)}
              placeholder="예: 150"
            />
          </label>
          <label className="text-xs text-slate-400">
            기준부하 baseline(kWh)
            <Input
              className="mt-1"
              type="number"
              min={0}
              value={drBaselineKwh}
              onChange={(e) => setDrBaselineKwh(e.target.value)}
              placeholder="선택"
            />
          </label>
          <div className="flex items-end">
            <Button
              size="sm"
              variant="primary"
              className="w-full"
              disabled={!canRegisterDr || registerMut.isPending}
              onClick={submitRegisterDr}
            >
              {registerMut.isPending ? '등록 중…' : 'DR 자원 등록'}
            </Button>
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                <th className="px-4 py-2.5">대상(수용가 ID)</th>
                <th className="px-4 py-2.5 text-right">감축용량</th>
                <th className="px-4 py-2.5 text-right">기준부하 baseline</th>
                <th className="px-4 py-2.5 text-right">계측 연계</th>
              </tr>
            </thead>
            <tbody>
              {drResources.map((r: DrResource) => {
                const named = consumers.find((c) => c.companyId === r.resourceId);
                return (
                  <tr key={r.id} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-4 py-2.5">{named ? named.name : `#${r.resourceId}`}</td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      {r.reductionCapacityKw != null ? `${Number(r.reductionCapacityKw).toLocaleString()} kW` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-slate-400">
                      {r.baselineKwh != null ? `${Number(r.baselineKwh).toLocaleString()} kWh` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${r.measurementLinked ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.05] text-slate-400'}`}
                      >
                        {r.measurementLinked ? '연계' : '미연계'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!drResources.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-500">
                    {drResourcesQ.isLoading
                      ? '불러오는 중…'
                      : '등록된 DR 자원이 없습니다. 위에서 수용가를 선택해 등록하세요.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DR 발령 — 수급 갭 근거 + 수요예측 피크 딥링크 프리필 (설계문서 23 §5) */}
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.03] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Send size={14} className="text-sky-400" /> DR 발령
          {label && <span className="ml-2 rounded bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300">대상: {label}</span>}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          위 수급 밸런스의 공급부족 시간대 또는 아래 수용가 표에서 선택하면 대상·감축량이 자동 입력됩니다.
        </p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <label className="text-xs text-slate-400">
            라운드
            <Input className="mt-1" value={roundLabel} onChange={(e) => setRoundLabel(e.target.value)} />
          </label>
          <label className="text-xs text-slate-400">
            대상 ID ({targetType})
            <Input
              className="mt-1"
              type="number"
              value={targetRefId}
              onChange={(e) => setTargetRefId(e.target.value)}
              placeholder="수용가 ID"
            />
          </label>
          <label className="text-xs text-slate-400">
            감축량(kW)
            <Input
              className="mt-1"
              type="number"
              min={0}
              value={reductionKw}
              onChange={(e) => setReductionKw(e.target.value)}
              placeholder="예: 120"
            />
          </label>
          <label className="text-xs text-slate-400">
            사유
            <Input
              className="mt-1"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="발령 사유"
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="primary" disabled={!canDispatch || dispatchMut.isPending} onClick={submitDispatch}>
            {dispatchMut.isPending ? '발령 중…' : 'DR 발령'}
          </Button>
        </div>
      </div>

      {/* DR 대상 후보 — 수용가(수요기업). 클릭 시 폼 프리필. 개념 교정: DR=부하 감축. */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Users size={14} className="text-sky-400" /> DR 대상 후보 (수용가·수요기업)
          </div>
          <span className="text-xs text-slate-400">{consumerRows.length}개 수용가</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          DR은 수용가 부하 감축이 본질입니다. 행을 &apos;DR 발령&apos; 하면 대상·제안 감축량이 폼에 채워집니다.
        </p>
        <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                <th className="px-4 py-2.5">수용가</th>
                <th className="px-4 py-2.5 text-right">제안 감축량</th>
                <th className="px-4 py-2.5 text-right">액션</th>
              </tr>
            </thead>
            <tbody>
              {consumerRows.map((c) => (
                <tr key={c.companyId} className="border-b border-white/[0.04] text-slate-300">
                  <td className="px-4 py-2.5">{c.name}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-slate-400">
                    {c.suggestedKw > 0 ? (
                      <span className="inline-flex items-center gap-1.5">
                        {`${c.suggestedKw.toLocaleString()} kW`}
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] ${c.source === 'registered' ? 'bg-sky-500/10 text-sky-300' : 'bg-white/[0.05] text-slate-500'}`}
                        >
                          {c.source === 'registered' ? '등록 자원' : 'proxy'}
                        </span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="secondary" onClick={() => prefillFromConsumer(c)}>
                      DR 발령
                    </Button>
                  </td>
                </tr>
              ))}
              {!consumerRows.length && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-xs text-slate-500">
                    {consumersQ.isLoading ? '불러오는 중…' : '관리 수용가가 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DR 발령 이력 */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Zap size={14} className="text-sky-400" /> DR 발령 이력
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                <th className="px-4 py-2.5">라운드</th>
                <th className="px-4 py-2.5">대상</th>
                <th className="px-4 py-2.5 text-right">목표 감축</th>
                <th className="px-4 py-2.5 text-right">실적</th>
                <th className="px-4 py-2.5 text-right">이행률</th>
                <th className="px-4 py-2.5 text-right">상태</th>
                <th className="px-4 py-2.5 text-right">이행 검증</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const ev = e as DrEvent;
                const isVerified = ev.actualReductionKw != null && ev.actualReductionKw !== '';
                return (
                  <tr key={ev.id} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-4 py-2.5 text-xs">{ev.roundLabel}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">
                      {ev.targetType} #{ev.targetRefId}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      {ev.targetReductionKw != null ? `${Number(ev.targetReductionKw).toLocaleString()} kW` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      {isVerified ? `${Number(ev.actualReductionKw).toLocaleString()} kW` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      {ev.fulfillmentPct != null && ev.fulfillmentPct !== '' ? `${ev.fulfillmentPct}%` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Badge
                        variant={ev.status === 'VERIFIED' ? 'success' : ev.status === 'DISPATCHED' ? 'warning' : 'info'}
                      >
                        {ev.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isVerified ? (
                        <span className="text-[11px] text-emerald-400/80">검증완료</span>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => openVerify(ev)}>
                          이행 실적 입력
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!events.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-500">
                    {eventsQ.isLoading
                      ? '불러오는 중…'
                      : '발령 이력이 없습니다. 위에서 DR을 발령하면 여기에 표시됩니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DR 이행 성과(효율) — 재무 정산 아님. 검증완료 이력 집계 = 누적 피크 감축 효율 성과. */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Gauge size={14} className="text-emerald-400" /> DR 이행 성과 (효율)
          </div>
          <span className="text-xs text-slate-400">
            검증완료 {performance.verifiedCount} / 발령 {performance.totalEvents}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          검증완료(실적 입력) 이력을 집계한 <b className="text-emerald-400/80">누적 피크 감축 = 효율 성과</b>입니다.
          VPP는 거래·정산이 없으므로 재무 정산이 아닌 효율 성과로 표출합니다(설계문서 25).
        </p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <CheckCircle2 size={12} className="text-emerald-400" /> 누적 실적 감축량
            </div>
            <div className="mt-1 text-lg font-semibold text-emerald-300">
              {Math.round(performance.totalActualKw).toLocaleString()} kW
            </div>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="text-[11px] text-slate-500">평균 이행률</div>
            <div className="mt-1 text-lg font-semibold text-white">
              {performance.verifiedCount > 0 ? `${performance.avgFulfillmentPct.toFixed(1)}%` : '—'}
            </div>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="text-[11px] text-slate-500">발령 건수</div>
            <div className="mt-1 text-lg font-semibold text-white">{performance.totalEvents.toLocaleString()} 건</div>
          </div>
        </div>
        {performance.verifiedCount === 0 && (
          <p className="mt-3 text-[11px] text-slate-500">
            아직 검증완료된 이력이 없습니다. 위 &apos;DR 발령 이력&apos;에서 &apos;이행 실적 입력&apos;으로 실적을
            반영하면 여기에 효율 성과가 집계됩니다.
          </p>
        )}
      </div>

      {/* (참고) 관리 발전 자원 — 발령 대상 아님. 공급측 자원 참고용. */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Zap size={14} className="text-slate-400" /> (참고) 관리 발전 자원
          </div>
          <span className="text-xs text-slate-400">
            편입 {enrolled.length} / 전체 {resources.length}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          발전 자원은 공급측 참고 정보입니다. DR 발령 대상이 아닙니다(발령 대상=수용가 부하).
        </p>
        <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                <th className="px-4 py-2.5">자원</th>
                <th className="px-4 py-2.5 text-right">용량</th>
                <th className="px-4 py-2.5 text-right">VPP 편입</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.04] text-slate-300">
                  <td className="px-4 py-2.5">{r.resource}</td>
                  <td className="px-4 py-2.5 text-right">{r.capacity}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${r.linked ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.05] text-slate-400'}`}
                    >
                      {r.linked ? '편입' : '미편입'}
                    </span>
                  </td>
                </tr>
              ))}
              {!resources.length && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-xs text-slate-500">
                    {resourcesQ.isLoading ? '불러오는 중…' : '관리 발전 자원이 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 flex items-start gap-3">
        <Info size={16} className="text-amber-400 mt-0.5 shrink-0" />
        <div className="text-sm text-slate-300">
          <b className="text-amber-400">참고</b> — 발령·이력은 DR 도메인(V91)으로 동작합니다. 감축 이행
          검증(actualReductionKw)은 계측 소스 연동 후 자동 채워집니다.
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        근거: 사업계획서 분산에너지 활성화(수요반응) · 설계문서 23(수요예측 피크→DR 발령 폐루프) · 설계문서 25(VPP=발전
        효율관리, 거래·정산 제외).
      </p>

      {/* 이행 실적 입력 모달 — actualReductionKw 입력 → verify. fulfillmentPct는 백엔드 자동 산출. */}
      <Modal open={!!verifyEvent} onClose={closeVerify} title="이행 실적 입력">
        {verifyEvent && (
          <div className="space-y-4">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-slate-400">
              <div>
                라운드: <span className="text-slate-200">{verifyEvent.roundLabel}</span>
              </div>
              <div className="mt-1">
                대상:{' '}
                <span className="text-slate-200">
                  {verifyEvent.targetType} #{verifyEvent.targetRefId}
                </span>
              </div>
              <div className="mt-1">
                목표 감축:{' '}
                <span className="text-slate-200">
                  {verifyEvent.targetReductionKw != null
                    ? `${Number(verifyEvent.targetReductionKw).toLocaleString()} kW`
                    : '—'}
                </span>
              </div>
            </div>
            <label className="block text-xs text-slate-400">
              실적 감축량 actualReductionKw (kW)
              <Input
                className="mt-1"
                type="number"
                min={0}
                value={verifyKw}
                onChange={(e) => setVerifyKw(e.target.value)}
                placeholder="예: 110"
                autoFocus
              />
            </label>
            <p className="text-[11px] text-slate-500">
              실적을 입력하면 이행률(fulfillmentPct)은 백엔드에서 자동 산출되어 이력·이행 성과에 반영됩니다.
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={closeVerify} disabled={verifyMut.isPending}>
                취소
              </Button>
              <Button size="sm" variant="primary" onClick={submitVerify} disabled={!canVerify || verifyMut.isPending}>
                {verifyMut.isPending ? '반영 중…' : '실적 반영'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
