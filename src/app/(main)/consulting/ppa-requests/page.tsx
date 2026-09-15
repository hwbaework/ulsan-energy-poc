'use client';

import { useState, useMemo } from 'react';
import { Mail, MessageSquare, ChevronRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { useTradingRequests } from '@/hooks/trading/useTrading';
import { useCreateProposal } from '@/hooks/consulting/useConsultations';
import { DEAL_TYPE_META } from '@/lib/constants/deal-type';
import type { TradingRequest } from '@/types/trading';

export default function ConsultantPpaRequestsPage() {
  const showToast = useToastStore((s) => s.add);
  const createProposalMut = useCreateProposal();

  // 실 API — 거래 신청 목록 (취소 제외, SUBMITTED 단계만)
  const requestsQuery = useTradingRequests();
  const requests = (requestsQuery.data?.content ?? [])
    .filter((r) => r.status !== 'CANCELLED')
    .filter((r) => r.currentStep === 1);

  // 모달 상태
  const [viewingRequest, setViewingRequest] = useState<TradingRequest | null>(null);
  const [proposingRequest, setProposingRequest] = useState<TradingRequest | null>(null);

  // 제안 작성 폼 (annex form — admin과 동일 구조)
  const [annexForm, setAnnexForm] = useState({
    assignedGenerator: '',
    capacityKw: '',
    warrantyHours: '3.6',
    degradationPct: '0.5',
    yearlyRates: Array(20).fill('110') as string[],
    year1DamageKrw: '60000000',
    annualDamageDecrease: '2000000',
    contractYears: '20',
    tradeFeeSupplyKwh: '1.0',
  });
  const resetAnnexForm = () =>
    setAnnexForm({
      assignedGenerator: '',
      capacityKw: '',
      warrantyHours: '3.6',
      degradationPct: '0.5',
      yearlyRates: Array(20).fill('110'),
      year1DamageKrw: '60000000',
      annualDamageDecrease: '2000000',
      contractYears: '20',
      tradeFeeSupplyKwh: '1.0',
    });

  const [yearlyRatesExpanded, setYearlyRatesExpanded] = useState(false);
  const fillYearlyRatesEqual = () => {
    setAnnexForm((f) => ({ ...f, yearlyRates: f.yearlyRates.map(() => f.yearlyRates[0] || '110') }));
  };
  const updateYearlyRate = (idx: number, value: string) => {
    setAnnexForm((f) => {
      const next = [...f.yearlyRates];
      next[idx] = value;
      return { ...f, yearlyRates: next };
    });
  };
  const setContractYears = (val: string) => {
    setAnnexForm((f) => {
      const n = Math.max(1, Math.min(40, Number(val) || 0));
      const cur = f.yearlyRates;
      let next = cur;
      if (n > cur.length) next = [...cur, ...Array(n - cur.length).fill(cur[cur.length - 1] || '110')];
      else if (n < cur.length) next = cur.slice(0, n);
      return { ...f, contractYears: val, yearlyRates: next };
    });
  };

  // 자동 계산 미리보기
  const annexPreview = useMemo(() => {
    const cap = Number(annexForm.capacityKw) || 0;
    const hours = Number(annexForm.warrantyHours) || 0;
    const deg = Number(annexForm.degradationPct) || 0;
    const year1Damage = Number(annexForm.year1DamageKrw) || 0;
    const damageDec = Number(annexForm.annualDamageDecrease) || 0;
    const totalYears = Number(annexForm.contractYears) || 20;
    const year1Rate = Number(annexForm.yearlyRates[0]) || 0;
    const year1MonthlyKwh = Math.round((cap * hours * 365) / 12);
    const year1MonthlyRent = Math.round(year1MonthlyKwh * year1Rate);
    const yearly: { year: number; kwhPerMonth: number; rate: number; rent: number; damage: number }[] = [];
    for (let y = 1; y <= Math.min(40, totalYears); y++) {
      const degFactor = Math.pow(1 - deg / 100, y - 1);
      const kwh = Math.round(((cap * hours * 365) / 12) * degFactor);
      const rate = Number(annexForm.yearlyRates[y - 1]) || year1Rate;
      const rent = Math.round(kwh * rate);
      const damage = Math.max(0, year1Damage - damageDec * (y - 1));
      yearly.push({ year: y, kwhPerMonth: kwh, rate, rent, damage });
    }
    return { year1MonthlyKwh, year1MonthlyRent, yearly };
  }, [annexForm]);

  const annexValid =
    !!annexForm.assignedGenerator &&
    Number(annexForm.capacityKw) > 0 &&
    Number(annexForm.yearlyRates[0]) > 0 &&
    Number(annexForm.year1DamageKrw) > 0;

  // 제안 작성 모달 열기
  const openProposal = (req: TradingRequest) => {
    setProposingRequest(req);
    resetAnnexForm();
    // 신청 정보로 일부 채우기
    setAnnexForm((f) => ({ ...f, capacityKw: String(req.capacityKw) }));
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '통합에너지 컨설팅', path: '/consulting' }, { label: 'PPA 신규 의뢰' }]} />

      <div>
        <h1 className="text-2xl font-bold text-white">PPA 신규 의뢰</h1>
        <p className="mt-1 text-sm text-slate-400">
          컨설팅 없이 바로 PPA 신청한 수용가 목록입니다. 제안을 작성해서 보내보세요.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <p className="text-sm font-semibold text-white">
          대기 중인 의뢰 <span className="text-primary tabular-nums">{requests.length}</span>건
        </p>
      </div>

      {requests.length > 0 ? (
        <div className="space-y-3">
          {requests.map((req) => {
            const meta = (DEAL_TYPE_META[req.dealType] ?? DEAL_TYPE_META.PPA)!;
            const Icon = meta.icon;
            return (
              <div key={req.id} className="rounded-xl border border-white/[0.06] bg-surface-card p-5">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1',
                      meta.bg,
                      meta.tone,
                      meta.ring,
                    )}
                  >
                    <Icon size={12} className="mr-1" />
                    {meta.label}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    접수 {(req.submittedAt ?? req.createdAt).slice(0, 10)}
                  </span>
                </div>

                <h3 className="text-base font-semibold text-white">{req.companyName}</h3>
                <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                  용량 {req.capacityKw.toLocaleString()} kW · 계약기간 {req.durationYears}년
                  {req.desiredUnitPrice ? ` · 희망단가 ₩${req.desiredUnitPrice}/kWh` : ''}
                  {req.region ? ` · 지역 ${req.region}` : ''}
                </p>

                <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setViewingRequest(req)}>
                    <MessageSquare size={14} className="mr-1" />
                    상세 보기
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => openProposal(req)}>
                    <Mail size={14} className="mr-1" />
                    제안 작성
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] bg-surface-card p-10">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.04] ring-1 ring-white/10 mb-3">
              <Zap size={22} className="text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-white">대기 중인 의뢰가 없습니다</h3>
            <p className="mt-1.5 text-xs text-slate-400">수용가이 직접 PPA 신청하면 이곳에 표시됩니다.</p>
          </div>
        </div>
      )}

      {/* ───────── 상세 보기 모달 ───────── */}
      <Modal
        open={!!viewingRequest}
        onClose={() => setViewingRequest(null)}
        title="의뢰 상세"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setViewingRequest(null)}>
              닫기
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!viewingRequest) return;
                const req = viewingRequest;
                setViewingRequest(null);
                openProposal(req);
              }}
            >
              <Mail size={14} className="mr-1" />
              제안 작성
            </Button>
          </>
        }
      >
        {viewingRequest &&
          (() => {
            const meta = (DEAL_TYPE_META[viewingRequest.dealType] ?? DEAL_TYPE_META.PPA)!;
            return (
              <div className="space-y-4">
                <div className={cn('rounded-lg ring-1 px-4 py-3', meta.bg, meta.ring)}>
                  <p className={cn('text-sm font-semibold', meta.tone)}>{meta.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    접수 {(viewingRequest.submittedAt ?? viewingRequest.createdAt).slice(0, 10)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">수용가</p>
                  <p className="text-base font-semibold text-white">{viewingRequest.companyName}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-3 py-2">
                    <p className="text-[10px] text-slate-500 uppercase">용량</p>
                    <p className="text-sm font-semibold text-white mt-0.5 tabular-nums">
                      {viewingRequest.capacityKw.toLocaleString()}{' '}
                      <span className="text-xs font-normal text-slate-400">kW</span>
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-3 py-2">
                    <p className="text-[10px] text-slate-500 uppercase">계약 기간</p>
                    <p className="text-sm font-semibold text-white mt-0.5 tabular-nums">
                      {viewingRequest.durationYears}
                      <span className="text-xs font-normal text-slate-400">년</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
      </Modal>

      {/* ───────── 제안 작성 모달 (admin과 동일 구조) ───────── */}
      {proposingRequest && (
        <Modal
          open={!!proposingRequest}
          onClose={() => {
            setProposingRequest(null);
            resetAnnexForm();
          }}
          title={`직접 PPA — 제안 작성 · ${proposingRequest.companyName}`}
          size="xl"
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setProposingRequest(null);
                  resetAnnexForm();
                }}
              >
                닫기
              </Button>
              <Button
                variant="primary"
                disabled={!annexValid || createProposalMut.isPending}
                onClick={async () => {
                  try {
                    await createProposalMut.mutateAsync({
                      tradingRequestId: proposingRequest.id,
                      clientCompanyName: proposingRequest.companyName,
                      capacityKw: Number(annexForm.capacityKw),
                      assignedGenerator: annexForm.assignedGenerator,
                      contractYears: Number(annexForm.contractYears),
                      yearlyRates: annexForm.yearlyRates,
                    } as any);
                    showToast('success', `${proposingRequest.companyName} 제안이 작성되었습니다`);
                    setProposingRequest(null);
                    resetAnnexForm();
                  } catch {
                    showToast('error', '제안 작성에 실패했습니다');
                  }
                }}
              >
                작성 완료
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            {/* 신청 정보 한 줄 */}
            <div className="text-xs text-slate-400 px-1">
              <span className="text-slate-500">신청: </span>
              <span className="text-white">{proposingRequest.companyName}</span>
              <span className="text-slate-500"> · </span>
              <span className="text-slate-300 tabular-nums">설치희망 {proposingRequest.capacityKw} kW</span>
            </div>

            {/* ① 발전사 배정 + 설비 사양 */}
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">① 발전사 배정 + 설비 사양</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400">배정 발전사 *</label>
                  <input
                    placeholder="예: 에스에너지"
                    value={annexForm.assignedGenerator}
                    onChange={(e) => setAnnexForm({ ...annexForm, assignedGenerator: e.target.value })}
                    className="mt-1 w-full h-9 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">설비 용량 (kW) *</label>
                  <input
                    type="number"
                    value={annexForm.capacityKw}
                    onChange={(e) => setAnnexForm({ ...annexForm, capacityKw: e.target.value })}
                    className="mt-1 w-full h-9 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 text-sm text-white focus:outline-none focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">일 발전보증시간 (h/day)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={annexForm.warrantyHours}
                    onChange={(e) => setAnnexForm({ ...annexForm, warrantyHours: e.target.value })}
                    className="mt-1 w-full h-9 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 text-sm text-white tabular-nums focus:outline-none focus:ring-primary"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">표준 3.6 h/day (조정 가능)</p>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">효율 감소율 (%/년)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={annexForm.degradationPct}
                    onChange={(e) => setAnnexForm({ ...annexForm, degradationPct: e.target.value })}
                    className="mt-1 w-full h-9 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 text-sm text-white focus:outline-none focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-amber-300">
                    거래수수료 (전력공급거래) <span className="text-slate-500">₩/kWh</span> *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={annexForm.tradeFeeSupplyKwh}
                    onChange={(e) => setAnnexForm({ ...annexForm, tradeFeeSupplyKwh: e.target.value })}
                    className="mt-1 w-full h-9 rounded-md bg-amber-500/[0.06] ring-1 ring-amber-500/30 px-3 text-sm text-amber-200 tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">SPC가 발전사업자로부터 수취</p>
                </div>
              </div>
            </div>

            {/* ② 손해금액 (보증보험) */}
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">
                ② 손해금액 (보증보험)
                <span className="text-[10px] text-slate-500 ml-1.5 font-normal">별첨1</span>
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400">1년차 손해액 (₩) *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="예: 60,000,000"
                    value={annexForm.year1DamageKrw ? Number(annexForm.year1DamageKrw).toLocaleString() : ''}
                    onChange={(e) =>
                      setAnnexForm({ ...annexForm, year1DamageKrw: e.target.value.replace(/[^0-9]/g, '') })
                    }
                    className="mt-1 w-full h-9 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 text-sm text-white tabular-nums focus:outline-none focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">연 감소액 (₩)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="예: 2,000,000"
                    value={
                      annexForm.annualDamageDecrease ? Number(annexForm.annualDamageDecrease).toLocaleString() : ''
                    }
                    onChange={(e) =>
                      setAnnexForm({ ...annexForm, annualDamageDecrease: e.target.value.replace(/[^0-9]/g, '') })
                    }
                    className="mt-1 w-full h-9 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 text-sm text-white tabular-nums focus:outline-none focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">계약 기간 (년)</label>
                  <select
                    value={annexForm.contractYears}
                    onChange={(e) => setContractYears(e.target.value)}
                    className="mt-1 w-full h-9 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 text-sm text-white focus:outline-none focus:ring-primary"
                  >
                    {[5, 10, 15, 20].map((y) => (
                      <option key={y} value={y} className="bg-[#0d1520]">
                        {y}년
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* ③ 연도별 단가 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setYearlyRatesExpanded((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  <ChevronRight size={12} className={cn('transition-transform', yearlyRatesExpanded && 'rotate-90')} />③
                  연도별 단가 (₩/kWh) *
                  <span className="text-[10px] text-slate-500 ml-1 font-normal">
                    {(() => {
                      const rates = annexForm.yearlyRates
                        .slice(0, Number(annexForm.contractYears) || 20)
                        .map((r) => Number(r) || 0);
                      const min = Math.min(...rates);
                      const max = Math.max(...rates);
                      return min === max ? `전 기간 ${min} ₩/kWh` : `${min} ~ ${max} ₩/kWh (연차별)`;
                    })()}
                  </span>
                </button>
                {yearlyRatesExpanded && (
                  <button
                    type="button"
                    onClick={fillYearlyRatesEqual}
                    className="text-[10px] px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/[0.08] text-slate-300"
                  >
                    1년차로 모두 동일
                  </button>
                )}
              </div>
              {yearlyRatesExpanded && (
                <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] p-3">
                  <div className="grid grid-cols-5 gap-2">
                    {annexForm.yearlyRates.slice(0, Number(annexForm.contractYears) || 20).map((rate, i) => (
                      <div key={i}>
                        <label className="text-[10px] text-slate-500">{i + 1}년차</label>
                        <input
                          type="number"
                          value={rate}
                          onChange={(e) => updateYearlyRate(i, e.target.value)}
                          className="mt-0.5 w-full h-8 rounded bg-white/[0.04] ring-1 ring-white/[0.06] px-2 text-xs text-white tabular-nums focus:outline-none focus:ring-primary"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 산식 */}
            <div className="rounded-md ring-1 ring-blue-500/30 bg-blue-500/[0.06] px-3 py-2 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold text-blue-300 shrink-0">산식</span>
              <span className="text-[11px] text-slate-300">
                <span className="text-rose-300 font-semibold">월 PPA 요금</span>
                <span className="text-slate-500"> = </span>
                <span className="rounded bg-white/[0.06] ring-1 ring-white/[0.10] px-1 py-0.5 text-white">용량</span>
                <span className="text-slate-500"> × </span>
                <span className="rounded bg-white/[0.06] ring-1 ring-white/[0.10] px-1 py-0.5 text-white">
                  발전보증시간
                </span>
                <span className="text-slate-500"> × </span>
                <span className="rounded bg-white/[0.06] ring-1 ring-white/[0.10] px-1 py-0.5 text-white tabular-nums">
                  365
                </span>
                <span className="text-slate-500"> ÷ </span>
                <span className="rounded bg-white/[0.06] ring-1 ring-white/[0.10] px-1 py-0.5 text-white tabular-nums">
                  12
                </span>
                <span className="text-slate-500"> × </span>
                <span className="rounded bg-white/[0.06] ring-1 ring-white/[0.10] px-1 py-0.5 text-white">단가</span>
              </span>
            </div>

            {/* 자동 계산 미리보기 */}
            <div className="rounded-lg ring-1 ring-emerald-500/30 bg-emerald-500/[0.05] px-4 py-3">
              <p className="text-xs font-semibold text-emerald-200 mb-2">자동 계산 — 1년차 기준</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-slate-500">월 발전량</p>
                  <p className="text-base font-bold text-emerald-300 tabular-nums">
                    {annexPreview.year1MonthlyKwh.toLocaleString()} kWh
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">1년차 단가</p>
                  <p className="text-base font-bold text-white tabular-nums">₩{annexForm.yearlyRates[0]}/kWh</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">약정 월 PPA 요금</p>
                  <p className="text-base font-bold text-rose-300 tabular-nums">
                    ₩{annexPreview.year1MonthlyRent.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* 연차별 미리보기 표 */}
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">④ 운영 연차별 자동 산정 미리보기</p>
              <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] overflow-hidden">
                <div className="overflow-x-auto max-h-[280px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[#0d1520] z-10">
                      <tr className="border-b border-white/[0.06] text-[10px] text-slate-500">
                        <th className="px-3 py-2 text-left font-medium">연차</th>
                        <th className="px-3 py-2 text-right font-medium">월 발전량 (kWh)</th>
                        <th className="px-3 py-2 text-right font-medium">단가 (₩/kWh)</th>
                        <th className="px-3 py-2 text-right font-medium">월 PPA 요금</th>
                        <th className="px-3 py-2 text-right font-medium">손해금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {annexPreview.yearly.map((y) => (
                        <tr key={y.year} className="border-b border-white/[0.04]">
                          <td className="px-3 py-2 text-slate-300 tabular-nums">{y.year}년차</td>
                          <td className="px-3 py-2 text-right text-emerald-300 tabular-nums">
                            {y.kwhPerMonth.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-300 tabular-nums">₩{y.rate}</td>
                          <td className="px-3 py-2 text-right text-rose-300 font-semibold tabular-nums">
                            ₩{y.rent.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-400 tabular-nums">
                            ₩{y.damage.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
