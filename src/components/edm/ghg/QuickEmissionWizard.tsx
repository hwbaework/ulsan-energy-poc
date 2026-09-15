'use client';

// 간편 배출 입력 위저드 — 활동 중심 통합 위저드 (기획 17 §2~5)
//
// 목표: 고객은 "무엇을(배출활동)·얼마나(사용량)"만 입력한다.
//   Scope·계수·표준단위·산정(tCO₂eq)은 EMISSION_ACTIVITIES 매핑 + useGhgFactors 로 자동.
//
// 흐름:
//   Step1 배출활동 카드 선택 → 선택 즉시 Scope N·계수 자동 배지 표시
//   Step2 사업장·시설(신규 or 기존 배출원) + 사용량(실단위) + 연도 → 표준단위 환산 병기
//   Step3 실시간 배출량 미리보기(환산사용량 × 계수 = tCO₂eq, 산식 노출) → 저장
//
// 저장 오케스트레이션(골든 패턴 CheckoutModal 참고 — 다단계 mutation):
//   신규 배출원: useCreateSource(scope·category·tier 자동) → sourceId → useCreateActivity
//   기존 배출원: 선택한 sourceId 로 useCreateActivity 만.
//
// isLive/미인증 가드: 데모 데이터·회사정보 없음이면 저장 불가(토스트/배너).

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Zap,
  Flame,
  Factory,
  Droplets,
  Wind,
  Fuel,
  Beaker,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/edm/ui/Button';
import { Badge } from '@/components/edm/ui/Badge';
import { cn } from '@/lib/utils';
import { useCreateSource, useCreateActivity, useGhgSources } from '@/hooks/edm/useGhg';
import { useGhgFactors } from '@/hooks/edm/useGhgExt';
import { useCompany } from '@/hooks/platform/useCompanies';
import {
  INDUSTRY_TABS,
  INDUSTRY_TEMPLATES,
  industryTabFromKsic,
  getActivity,
  type EmissionActivity,
  type IndustryKey,
} from './emissionActivities';

const inputCls = 'mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-slate-200';
const labelCls = 'block text-xs text-slate-400';

// 배출원 키별 아이콘. 신규 빌딩블록(중유·LPG·부생가스·공정가스) 포함.
const ICON_OF: Record<string, React.ReactNode> = {
  PURCHASED_ELEC: <Zap size={18} />,
  LNG: <Flame size={18} />,
  CITY_GAS: <Flame size={18} />,
  DIESEL: <Droplets size={18} />,
  HEAVY_OIL: <Fuel size={18} />,
  LPG: <Fuel size={18} />,
  BYPRODUCT: <Beaker size={18} />,
  STEAM: <Wind size={18} />,
  PROCESS: <Factory size={18} />,
  PROC_GAS: <Beaker size={18} />,
};

type Step = 1 | 2 | 3;
type Phase = 'form' | 'done';

const YEAR_DEFAULT = 2026;

export function QuickEmissionWizard({
  open,
  onClose,
  companyId,
  canSave,
  guardReason,
}: {
  open: boolean;
  onClose: () => void;
  companyId?: number;
  /** 저장 가능 여부(부모의 isLive·companyId 게이트 결과) */
  canSave: boolean;
  /** 저장 불가 사유(있으면 배너 노출) */
  guardReason?: string;
}) {
  const { data: sources } = useGhgSources(companyId);
  const { data: factors } = useGhgFactors();
  const { data: company } = useCompany(companyId ?? 0);
  const createSource = useCreateSource();
  const createActivity = useCreateActivity();
  const busy = createSource.isPending || createActivity.isPending;

  // 온보딩 업종(회사 industryCode/KSIC) → 기본 업종 탭. 없으면 일반제조(GENERAL).
  const defaultIndustry = useMemo<IndustryKey>(
    () => industryTabFromKsic(company?.industryCode),
    [company?.industryCode],
  );
  const [industry, setIndustry] = useState<IndustryKey>(defaultIndustry);
  // 회사 정보가 뒤늦게 로드되면 기본 탭을 회사 업종으로 동기화(사용자가 아직 전환 전일 때만).
  const [industryTouched, setIndustryTouched] = useState(false);
  useEffect(() => {
    if (!industryTouched) setIndustry(defaultIndustry);
  }, [defaultIndustry, industryTouched]);
  const activities = INDUSTRY_TEMPLATES[industry];

  // 할당대상(배출권 명세서 정합) — 회사 마스터에 명시 필드가 있으면 배너 노출.
  // Company 타입에 표준 필드가 없으므로 존재 시에만 안전 조회(스키마 변경 없이 태깅 재사용).
  const allocationTarget = (company as { allocationTarget?: boolean } | undefined)?.allocationTarget === true;

  const [step, setStep] = useState<Step>(1);
  const [phase, setPhase] = useState<Phase>('form');
  const [activityKey, setActivityKey] = useState<string>('');
  // 배출원: 신규 등록 or 기존 선택
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [site, setSite] = useState('');
  const [facility, setFacility] = useState('');
  const [existingSourceId, setExistingSourceId] = useState('');
  const [amount, setAmount] = useState('');
  const [year, setYear] = useState(YEAR_DEFAULT);
  const [factorOverride, setFactorOverride] = useState(''); // Tier3 직접 입력
  const [errorMsg, setErrorMsg] = useState('');

  const activity = activityKey ? getActivity(activityKey) : undefined;

  // 자동 계수매칭: factorCode 로 조회, 미존재 시 표준 폴백 (기획 17 §3)
  const matchedFactor = useMemo(() => {
    if (!activity) return null;
    return factors.find((f) => f.code === activity.factorCode) ?? null;
  }, [activity, factors]);

  const overrideNum = factorOverride.trim() === '' ? null : Number(factorOverride);
  const usingOverride =
    !!activity?.allowFactorOverride && overrideNum != null && Number.isFinite(overrideNum) && overrideNum > 0;
  // Tier3 직접입력 전용(공정·부생가스·공정가스): 기본계수 미노출, 직접입력만 허용.
  const directInputOnly = !!activity?.directInputOnly;
  // 실효 계수: override > (직접입력 전용이면 조회/폴백 미사용) > 조회 계수 > 폴백
  const effectiveFactor = usingOverride
    ? (overrideNum as number)
    : directInputOnly
      ? 0 // 직접입력 전까지 계수 미확정(placeholder 값 노출 금지)
      : (matchedFactor?.factor ?? activity?.fallbackFactor ?? 0);
  const factorUnit = matchedFactor?.unit ?? activity?.fallbackFactorUnit ?? '';
  const factorSource = usingOverride
    ? '직접입력(Tier3)'
    : directInputOnly
      ? '직접입력 필요'
      : matchedFactor
        ? matchedFactor.source
        : '표준 폴백';

  // 표준단위 환산 + 배출량 산정
  const amountNum = Number(amount);
  const amountValid = amount.trim() !== '' && Number.isFinite(amountNum) && amountNum >= 0;
  const stdAmount = activity && amountValid ? amountNum * activity.toStd : 0;
  const tco2eq = activity ? stdAmount * effectiveFactor : 0;

  // ── 검증 ──
  const sourceValid = mode === 'new' ? site.trim() !== '' && facility.trim() !== '' : existingSourceId !== '';
  const yearValid = year >= 2000 && year <= new Date().getFullYear() + 1;
  // 직접입력 전용(Tier3)은 실측 계수 입력이 필수(계수 없으면 산정 불가).
  const factorValid = !directInputOnly || usingOverride;
  const step2Valid = sourceValid && amountValid && yearValid && factorValid;

  function resetAll() {
    setStep(1);
    setPhase('form');
    setActivityKey('');
    setIndustry(defaultIndustry);
    setIndustryTouched(false);
    setMode('new');
    setSite('');
    setFacility('');
    setExistingSourceId('');
    setAmount('');
    setYear(YEAR_DEFAULT);
    setFactorOverride('');
    setErrorMsg('');
  }

  function handleClose() {
    if (busy) return;
    resetAll();
    onClose();
  }

  function pickActivity(a: EmissionActivity) {
    setActivityKey(a.key);
    setFactorOverride('');
  }

  // 저장 오케스트레이션 (기획 17 §1)
  async function handleSave() {
    if (!activity || !step2Valid || companyId == null || !canSave) return;
    setErrorMsg('');
    try {
      // 1) sourceId 확보 — 기존 선택이면 재사용, 신규면 useCreateSource
      let sourceId: number;
      if (mode === 'existing') {
        sourceId = Number(existingSourceId);
      } else {
        const created = await createSource.mutateAsync({
          companyId,
          site: site.trim(),
          facility: facility.trim(),
          scope: activity.scope, // 자동
          category: activity.category, // 자동
          tier: activity.defaultTier, // 자동(대부분 1)
          // Tier3 사업장 실측(공정) override 시 실효 계수를 연료계수로 저장(Scope1 한정)
          fuelFactor: activity.scope === 1 && usingOverride ? effectiveFactor : null,
        });
        sourceId = created.id;
      }

      // 2) 활동자료 — 표준단위 amount·type·year (자동)
      await createActivity.mutateAsync({
        sourceId,
        companyId,
        year,
        type: activity.type,
        amount: stdAmount, // 표준단위 환산값
        unit: activity.stdUnit,
        isAuto: false,
        evidence: null,
      });

      setPhase('done');
    } catch {
      setErrorMsg('저장 중 오류가 발생했습니다. 다시 시도해 주세요.');
    }
  }

  // ── 렌더 ──
  const footer =
    phase === 'done' ? (
      <>
        <Button variant="secondary" size="sm" onClick={handleClose}>
          닫기
        </Button>
        <Button
          size="sm"
          onClick={() => {
            resetAll();
          }}
        >
          계속 입력
        </Button>
      </>
    ) : step === 1 ? (
      <>
        <Button variant="cancel" size="sm" onClick={handleClose}>
          취소
        </Button>
        <Button size="sm" onClick={() => setStep(2)} disabled={!activity}>
          다음 <ArrowRight size={14} />
        </Button>
      </>
    ) : step === 2 ? (
      <>
        <Button variant="secondary" size="sm" onClick={() => setStep(1)}>
          <ArrowLeft size={14} /> 이전
        </Button>
        <Button size="sm" onClick={() => setStep(3)} disabled={!step2Valid}>
          미리보기 <ArrowRight size={14} />
        </Button>
      </>
    ) : (
      <>
        <Button variant="secondary" size="sm" onClick={() => setStep(2)} disabled={busy}>
          <ArrowLeft size={14} /> 이전
        </Button>
        <Button size="sm" onClick={handleSave} loading={busy} disabled={!canSave || !step2Valid}>
          저장
        </Button>
      </>
    );

  return (
    <Modal open={open} onClose={handleClose} title="간편 배출 입력" size="lg" footer={footer}>
      {/* 저장 불가 배너(미인증·데모) */}
      {guardReason && phase !== 'done' && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 px-3 py-2">
          <AlertTriangle size={15} className="text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300">저장 불가: {guardReason}</p>
        </div>
      )}

      {/* 스텝 인디케이터 */}
      {phase !== 'done' && (
        <div className="mb-5 flex items-center gap-2">
          {([1, 2, 3] as const).map((s) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  step >= s ? 'bg-blue-500 text-white' : 'bg-white/[0.06] text-slate-500',
                )}
              >
                {s}
              </span>
              <span className={cn('text-xs', step >= s ? 'text-slate-200' : 'text-slate-500')}>
                {s === 1 ? '배출활동' : s === 2 ? '사업장·사용량' : '미리보기·저장'}
              </span>
              {s < 3 && <span className="h-px flex-1 bg-white/[0.06]" />}
            </div>
          ))}
        </div>
      )}

      {phase === 'done' ? (
        <div className="py-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <CheckCircle2 size={24} className="text-emerald-400" />
          </div>
          <p className="text-sm font-semibold text-white">배출 입력이 저장되었습니다</p>
          <p className="mt-1 text-xs text-slate-400">
            {activity?.label} · {stdAmount.toLocaleString()} {activity?.stdUnit} →{' '}
            <b className="text-sky-300">{tco2eq.toFixed(2)} tCO₂eq</b> (Scope {activity?.scope})
          </p>
          <p className="mt-1 text-[11px] text-slate-500">배출원·활동자료가 생성되어 인벤토리에 반영됩니다.</p>
        </div>
      ) : step === 1 ? (
        <Step1
          industry={industry}
          onIndustryChange={(k) => {
            setIndustry(k);
            setIndustryTouched(true);
            setActivityKey('');
          }}
          activities={activities}
          activityKey={activityKey}
          onPick={pickActivity}
          allocationTarget={allocationTarget}
          matchedFactorFor={(a) => factors.find((f) => f.code === a.factorCode) ?? null}
        />
      ) : step === 2 ? (
        <div className="space-y-4">
          {/* 선택 요약(자동 Scope·계수 유지 노출) */}
          {activity && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
              <span className="text-slate-400">{ICON_OF[activity.key]}</span>
              <span className="text-sm font-medium text-white">{activity.label}</span>
              <Badge variant={activity.scope === 1 ? 'warning' : 'info'}>Scope {activity.scope}</Badge>
              {directInputOnly && !usingOverride ? (
                <Badge variant="warning">직접입력(Tier3) 필요</Badge>
              ) : (
                <Badge variant="default">
                  계수 {effectiveFactor} {factorUnit}
                </Badge>
              )}
              <span className="text-[11px] text-slate-500">({factorSource})</span>
              {activity.factorNeedsVerification && <Badge variant="warning">표준·검증필요</Badge>}
            </div>
          )}

          {/* 배출원: 신규 or 기존 */}
          <div>
            <p className="mb-2 text-xs font-medium text-slate-400">사업장·시설</p>
            <div className="mb-3 flex gap-2">
              {(['new', 'existing'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  disabled={m === 'existing' && sources.length === 0}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                    mode === m
                      ? 'border-blue-500/50 bg-blue-500/10 text-white'
                      : 'border-white/[0.08] text-slate-400 hover:text-white',
                  )}
                >
                  {m === 'new' ? '신규 배출원' : `기존 배출원 (${sources.length})`}
                </button>
              ))}
            </div>

            {mode === 'new' ? (
              <div className="grid grid-cols-2 gap-4">
                <label className={labelCls}>
                  사업장명
                  <input
                    className={inputCls}
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    placeholder="예: 울산1공장"
                  />
                </label>
                <label className={labelCls}>
                  시설명
                  <input
                    className={inputCls}
                    value={facility}
                    onChange={(e) => setFacility(e.target.value)}
                    placeholder="예: 보일러 #1"
                  />
                </label>
              </div>
            ) : (
              <label className={labelCls}>
                기존 배출원 선택
                <select
                  className={inputCls}
                  value={existingSourceId}
                  onChange={(e) => setExistingSourceId(e.target.value)}
                >
                  <option value="">선택하세요</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.site} · {s.facility}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {/* 사용량(실단위) + 연도 */}
          <div className="grid grid-cols-2 gap-4">
            <label className={labelCls}>
              사용량 ({activity?.inputUnit})
              <input
                className={inputCls}
                type="number"
                min={0}
                step="0.001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`${activity?.inputUnit} 단위로 입력`}
              />
              {activity && amountValid && (
                <span className="mt-1 block text-[11px] text-sky-300">
                  = {stdAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {activity.stdUnit} (표준단위
                  환산)
                </span>
              )}
            </label>
            <label className={labelCls}>
              연도
              <input
                className={inputCls}
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
              {!yearValid && <span className="mt-1 block text-xs text-red-400">유효한 연도를 입력하세요</span>}
            </label>
          </div>

          {/* 불확실 환산 경고(도시가스 NCV) */}
          {activity?.uncertainConversion && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 px-3 py-2">
              <AlertTriangle size={14} className="mt-0.5 text-amber-400 shrink-0" />
              <p className="text-[11px] text-amber-300">표준 발열량(확정 필요) 기준으로 환산합니다. {activity.note}</p>
            </div>
          )}

          {/* 신규 표준계수 검증필요 경고(중유·LPG) */}
          {activity?.factorNeedsVerification && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 px-3 py-2">
              <AlertTriangle size={14} className="mt-0.5 text-amber-400 shrink-0" />
              <p className="text-[11px] text-amber-300">
                표준·검증필요 계수({activity.fallbackFactor} {activity.fallbackFactorUnit})로 산정합니다.{' '}
                {activity.note}
              </p>
            </div>
          )}

          {/* Tier3(실측) — 계수 직접입력 override */}
          {activity?.allowFactorOverride &&
            (directInputOnly ? (
              <label className={labelCls}>
                계수 직접입력 (Tier3 실측 — 필수, 사업장 고유값)
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  step="0.0001"
                  value={factorOverride}
                  onChange={(e) => setFactorOverride(e.target.value)}
                  placeholder={`${activity.fallbackFactorUnit} 단위 실측 계수`}
                />
                {!usingOverride && (
                  <span className="mt-1 block text-[11px] text-amber-300">
                    {activity.label}은 사업장 고유값이라 표준계수가 없습니다. 실측 계수를 직접 입력해야 저장할 수
                    있습니다.
                  </span>
                )}
              </label>
            ) : (
              <label className={labelCls}>
                계수 직접입력 (Tier3 실측, 선택 — 비우면 표준 {activity.fallbackFactor})
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  step="0.0001"
                  value={factorOverride}
                  onChange={(e) => setFactorOverride(e.target.value)}
                  placeholder={`${activity.fallbackFactorUnit} 단위 실측 계수`}
                />
              </label>
            ))}
        </div>
      ) : (
        // Step3 미리보기·저장
        <div className="space-y-4">
          {activity && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-400">{ICON_OF[activity.key]}</span>
                <span className="text-sm font-semibold text-white">{activity.label}</span>
                <Badge variant={activity.scope === 1 ? 'warning' : 'info'}>Scope {activity.scope}</Badge>
                <Badge variant="default">Tier {activity.defaultTier}</Badge>
              </div>

              <div className="rounded-lg bg-white/[0.03] px-4 py-3 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">사업장·시설</span>
                  <span className="text-white">
                    {mode === 'new'
                      ? `${site} · ${facility}`
                      : sources.find((s) => s.id === existingSourceId)?.site +
                        ' · ' +
                        sources.find((s) => s.id === existingSourceId)?.facility}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">입력 사용량</span>
                  <span className="text-white">
                    {amountNum.toLocaleString()} {activity.inputUnit}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">표준단위 환산</span>
                  <span className="text-white">
                    {stdAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {activity.stdUnit}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">배출계수</span>
                  <span className="text-white">
                    {effectiveFactor} {factorUnit} <span className="text-[11px] text-slate-500">({factorSource})</span>
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">연도</span>
                  <span className="text-white">{year}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-white/[0.06] pt-2">
                  <span className="font-medium text-slate-300">배출량</span>
                  <span className="text-base font-bold text-sky-300">{tco2eq.toFixed(3)} tCO₂eq</span>
                </div>
              </div>

              {/* 산식 노출 */}
              <div className="rounded-lg bg-blue-500/[0.06] px-4 py-2.5">
                <p className="text-[11px] text-blue-300">
                  산식: 표준사용량({stdAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })}{' '}
                  {activity.stdUnit}) × 계수({effectiveFactor} {factorUnit}) = <b>{tco2eq.toFixed(3)} tCO₂eq</b> · Scope{' '}
                  {activity.scope}
                </p>
                {activity.uncertainConversion && (
                  <p className="mt-1 text-[11px] text-amber-300">
                    ※ 표준 발열량(NCV)은 확정 필요 값이며, 확정 시 배출량이 재산정됩니다.
                  </p>
                )}
              </div>
            </>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2">
              <AlertTriangle size={14} className="text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{errorMsg}</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── Step1: 업종 탭 + 배출활동 카드 선택 (기획 21 §2·§3) ──
function Step1({
  industry,
  onIndustryChange,
  activities,
  activityKey,
  onPick,
  allocationTarget,
  matchedFactorFor,
}: {
  industry: IndustryKey;
  onIndustryChange: (k: IndustryKey) => void;
  activities: EmissionActivity[];
  activityKey: string;
  onPick: (a: EmissionActivity) => void;
  allocationTarget: boolean;
  matchedFactorFor: (a: EmissionActivity) => { factor: number; unit: string } | null;
}) {
  return (
    <div>
      {/* 업종 탭 바 — 온보딩 업종으로 기본 선택. 탭 전환 시 배출원 세트 변경. */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {INDUSTRY_TABS.map((t) => {
          const active = t.key === industry;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onIndustryChange(t.key)}
              title={t.target}
              className={cn(
                'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'border-blue-500/50 bg-blue-500/10 text-white'
                  : 'border-white/[0.08] bg-white/[0.02] text-slate-400 hover:text-white hover:border-white/20',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 할당대상 배너(선택) — 배출권 명세서 정합 안내 */}
      {allocationTarget && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-blue-500/[0.08] ring-1 ring-blue-500/20 px-3 py-2">
          <ShieldCheck size={14} className="mt-0.5 text-blue-300 shrink-0" />
          <p className="text-[11px] text-blue-200">
            배출권 할당대상 사업장입니다 — 배출권 명세서 정합을 위해 전 배출원·Tier 를 필수로 등록하세요.
          </p>
        </div>
      )}

      <p className="mb-3 text-xs text-slate-400">
        업종 탭의 배출활동을 선택하면 Scope·배출계수가 자동으로 결정됩니다. (공정·부생가스·공정가스는 사업장 실측
        직접입력)
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 auto-rows-min content-start h-[336px] overflow-y-auto pr-1">
        {activities.map((a) => {
          const selected = a.key === activityKey;
          const f = matchedFactorFor(a);
          const factor = f?.factor ?? a.fallbackFactor;
          const unit = f?.unit ?? a.fallbackFactorUnit;
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => onPick(a)}
              className={cn(
                'flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors',
                selected
                  ? 'border-blue-500/50 bg-blue-500/10'
                  : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20',
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn(selected ? 'text-blue-300' : 'text-slate-400')}>{ICON_OF[a.key]}</span>
                <span className="text-sm font-semibold text-white">{a.label}</span>
                {selected && <CheckCircle2 size={15} className="ml-auto text-blue-400" />}
              </div>
              <p className="text-[11px] text-slate-400">{a.desc}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={a.scope === 1 ? 'warning' : 'info'}>Scope {a.scope}</Badge>
                {a.directInputOnly ? (
                  // Tier3 직접입력 — 기본계수 미표시(placeholder 값 노출 금지)
                  <Badge variant="warning">직접입력(Tier3)</Badge>
                ) : (
                  <Badge variant="default">
                    {factor} {unit}
                  </Badge>
                )}
                {a.uncertainConversion && <Badge variant="warning">NCV 확정 필요</Badge>}
                {a.factorNeedsVerification && <Badge variant="warning">표준·검증필요</Badge>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
