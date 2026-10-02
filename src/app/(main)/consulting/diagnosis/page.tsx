'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, PencilLine } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { POC_USERS, useAuthStore } from '@/stores/useAuthStore';
import { useTradingPocStore } from '@/stores/useTradingPocStore';
import { kindLabel } from '@/components/features/trading-poc/meta';
import { useToastStore } from '@/stores/useToastStore';
import { useCreateDiagnosis, useDiagnosesByCompany } from '@/hooks/consulting/useConsultations';
import { useConsumerSites } from '@/hooks/consumer/useConsumer';
import { SimInputPanel } from '@/components/features/consulting/SimInputPanel';
import { recordOf } from '@/components/features/consulting/SimDiagnosisView';
import { SimReport, type ReviewRecord } from '@/components/features/consulting/SimReport';
import { ReviewHistoryList } from '@/components/features/consulting/ReviewHistoryList';
import { calc, defaultSimInput, type SimInput } from '@/lib/solar-sim';
import { cn } from '@/lib/utils';
import type { Diagnosis } from '@/types/consultation';

/**
 * 무료진단 — 울산미포산단 태양광 사업성 시뮬레이터 기반.
 *  ① 입력 화면(값 입력 + 옆에 지난 검토 기록) → [사업 검토] → ② 단계별 진행 → ③ 검토서(A4 문서)
 *  검토할 때마다 새 사업 검토서로 기록되고, 기록을 누르면 다시 계산하지 않고 그 검토서를 바로 연다.
 */
const REVIEW_STEPS = ['입력값 확인', '월별 발전량 산정 (울산관측소 일조시간)', '한전 요금 시간대 매칭', '20년 운영 시뮬레이션', '요금 시나리오 · 민감도 분석', '검토서 작성'];
const STEP_MS = 450;

type View = { kind: 'input' } | { kind: 'loading'; step: number } | { kind: 'result'; input: SimInput; record?: ReviewRecord };

export default function DiagnosisPage() {
  const user = useAuthStore((s) => s.user);
  const toast = useToastStore((s) => s.add);
  const createDiagnosis = useCreateDiagnosis();
  const companyId = user?.companyId ?? 0;
  const companyName = user?.companyName ?? '';

  // 사업장 — 가입 회사의 등록 사업장(대표 사업장). 입력받지 않는다
  const { data: siteData } = useConsumerSites({ companyId });
  const site = useMemo(() => {
    const raw = (Array.isArray(siteData) ? siteData : ((siteData as { content?: unknown[] } | undefined)?.content ?? [])) as { companyId?: number; name: string; address: string }[];
    // 등록 사업장이 없으면 가입 회사 주소(저장된 로그인 정보에 주소가 없으면 데모 계정 정보에서)
    const address = user?.companyAddress || Object.values(POC_USERS).find((u) => u.companyId === companyId)?.companyAddress || '';
    return raw.find((s) => s.companyId === companyId) ?? { name: '본사', address };
  }, [siteData, companyId, user?.companyAddress]);

  // 지난 검토 기록
  const { data: diagData } = useDiagnosesByCompany(companyId);
  const history = useMemo(() => ((diagData ?? []) as Diagnosis[]).filter((d) => d.sim), [diagData]);

  const [f, setF] = useState<SimInput>(() => defaultSimInput());
  const [view, setView] = useState<View>({ kind: 'input' });
  const [save, setSave] = useState(true); // 검토 기록에 저장할지 — 끄면 결과만 보고 기록은 남기지 않는다

  useEffect(() => {
    if (f.site !== site.name) setF((p) => ({ ...p, site: site.name, address: site.address }));
  }, [site, f.site]);

  // 기존 태양광 설비 — 전력거래에서 이 회사가 수용가로 맺은 체결 계약(설비 규모 합). 연간 발전량은 일평균 발전시간 기준 추정
  const contracts = useTradingPocStore((s) => s.contracts);
  const mine = useMemo(() => contracts.filter((c) => c.consumerCompanyId === companyId && c.status === 'ACTIVE'), [contracts, companyId]);
  const facilitySource = mine.length
    ? `전력거래 계약 데이터에서 불러옴 — ${mine.map((c) => `${c.plantName} ${c.no} (${kindLabel(c.kind)} ${c.capacityKw} kW)`).join(', ')} · 연간 발전량은 일평균 발전시간 기준 추정`
    : undefined;
  const filled = useRef(false);
  useEffect(() => {
    if (filled.current || !mine.length) return;
    filled.current = true;
    const kw = Math.round(mine.reduce((a, c) => a + c.capacityKw, 0) * 100) / 100;
    const gen = Math.round(kw * f.avgH * 365);
    setF((p) => (p.facilities.length ? p : { ...p, facilities: [{ source: '태양광', kw, genKwh: gen, useKwh: gen }] }));
  }, [mine, f.avgH]);

  // 검토서 화면 → 브라우저 뒤로가기로 입력 화면
  useEffect(() => {
    const onPop = () => setView({ kind: 'input' });
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const showResult = (input: SimInput, record?: ReviewRecord) => {
    if (view.kind !== 'result') window.history.pushState({ review: true }, '');
    setView({ kind: 'result', input, record });
    window.scrollTo({ top: 0 });
  };
  const backToInput = () => {
    if (window.history.state?.review) window.history.back();
    else setView({ kind: 'input' });
  };

  const review = async () => {
    const snap = structuredClone(f);
    setView({ kind: 'loading', step: 0 });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const steps = (async () => {
      for (let k = 1; k <= REVIEW_STEPS.length; k++) {
        await new Promise((r) => setTimeout(r, STEP_MS));
        setView({ kind: 'loading', step: k });
      }
    })();
    let record: ReviewRecord | undefined;
    if (save) try {
      const R = calc(snap);
      // 검토할 때마다 새 기록 (덮어쓰지 않는다)
      const d = (await createDiagnosis.mutateAsync({
        companyId,
        companyName,
        domain: 'RE100',
        annualEnergyUsage: Math.round(R.annualGen1 / 1000),
        contactName: user?.name,
        contactEmail: user?.email,
        contactPhone: user?.phone,
        sim: snap,
      })) as { id: number; createdAt: string };
      record = recordOf(d);
    } catch {
      toast('error', '검토서 저장에 실패했습니다');
    }
    await steps;
    showResult(snap, record);
    if (record) toast('success', `${record.no} 사업 검토서로 기록했습니다`);
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'RE100', path: '/re100' }, { label: '무료진단' }]} />

      {view.kind === 'result' ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-white">무료진단</h1>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={backToInput}>
                <ArrowLeft size={14} className="mr-1.5" /> 입력으로
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setF({ ...structuredClone(view.input), site: site.name, address: site.address });
                  backToInput();
                }}
              >
                <PencilLine size={14} className="mr-1.5" /> 이 값으로 다시 입력
              </Button>
            </div>
          </div>
          <SimReport key={view.record?.no ?? 'new'} input={view.input} companyName={companyName} record={view.record} />
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-white">무료진단</h1>
          {view.kind === 'loading' ? (
            <div className="flex min-h-[460px] flex-col items-center justify-center rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.06] p-10">
              <div className="w-full max-w-md">
                <p className="text-base font-semibold text-white">사업 검토 중</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${(view.step / REVIEW_STEPS.length) * 100}%` }} />
                </div>
                <ol className="mt-5 space-y-2.5">
                  {REVIEW_STEPS.map((t, k) => (
                    <li key={t} className={cn('flex items-center gap-3 text-sm', k < view.step ? 'text-slate-300' : k === view.step ? 'text-white' : 'text-slate-600')}>
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', k < view.step ? 'bg-emerald-400' : k === view.step ? 'animate-pulse bg-primary' : 'bg-white/[0.12]')} />
                      {t}
                      {k < view.step && <span className="ml-auto text-xs text-emerald-400">완료</span>}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_340px]">
              {/* 값 입력 */}
              <div>
                <SimInputPanel value={f} onChange={setF} companyName={companyName} facilitySource={facilitySource} />
                <div className="sticky bottom-0 z-10 mt-4 flex items-center justify-end gap-5 rounded-xl border-t border-white/[0.06] bg-[#0b1220]/95 px-1 py-4 backdrop-blur">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="h-4 w-4 accent-[#3b82f6]" />
                    검토 기록에 저장
                  </label>
                  <Button size="lg" onClick={review}>
                    사업 검토
                  </Button>
                </div>
              </div>

              {/* 지난 검토 기록 — 누르면 그 검토서를 바로 연다 */}
              <ReviewHistoryList history={history} onPick={(d) => showResult(d.sim!, recordOf(d))} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
