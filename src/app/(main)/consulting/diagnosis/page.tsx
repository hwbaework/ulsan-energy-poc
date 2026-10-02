'use client';

import { BackButton } from '@/components/layout/PageTitle';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PencilLine, Save } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { POC_USERS, useAuthStore } from '@/stores/useAuthStore';
import { useQuery } from '@tanstack/react-query';
import { getPowerStationsByCompany } from '@/api/common/power-stations';
import { powerStationKeys } from '@/api/queryKeys';
import { useToastStore } from '@/stores/useToastStore';
import { useCreateDiagnosis, useDiagnoses, useDiagnosesByCompany } from '@/hooks/consulting/useConsultations';
import { SimInputPanel } from '@/components/features/consulting/SimInputPanel';
import { recordOf } from '@/components/features/consulting/SimDiagnosisView';
import { SimReport, type ReviewRecord } from '@/components/features/consulting/SimReport';
import { ReviewHistoryList } from '@/components/features/consulting/ReviewHistoryList';
import { calc, defaultSimInput, type SimInput } from '@/lib/solar-sim';
import { cn } from '@/lib/utils';
import type { Diagnosis } from '@/types/consultation';
import { getPersona } from '@/lib/persona';
import { CONSUMERS } from '@/stores/useTradingPocStore';

/**
 * 무료진단 — 울산미포산단 태양광 사업성 시뮬레이터 기반.
 *  ① 입력 화면(값 입력 + 옆에 지난 검토 기록) → [사업 검토] → ② 단계별 진행 → ③ 검토서(A4 문서)
 *  결과를 보고 [저장]하면 새 사업 검토서로 기록되고(덮어쓰지 않음), 오른쪽 기록을 누르면 다시 계산하지 않고 그 검토서를 바로 연다.
 */
const REVIEW_STEPS = ['입력값 확인', '월별 발전량 산정 (울산관측소 일조시간)', '한전 요금 시간대 매칭', '20년 운영 시뮬레이션', '요금 시나리오 · 민감도 분석', '검토서 작성'];
const STEP_MS = 450;

type View = { kind: 'input' } | { kind: 'loading'; step: number } | { kind: 'result'; input: SimInput; record?: ReviewRecord };

export default function DiagnosisPage() {
  const user = useAuthStore((s) => s.user);
  const toast = useToastStore((s) => s.add);
  const createDiagnosis = useCreateDiagnosis();
  // 관리자만 — 전화로 들어온 신규 기업도 진단: 기존 기업을 고르거나 기업명·기업 주소를 직접 입력. 그 외는 로그인(가입) 값 고정
  const isAdmin = ['admin', 'spc'].includes(getPersona(user));
  const [target, setTarget] = useState({ pick: '', name: '', address: '' });
  const companyId = isAdmin ? Number(target.pick) || 0 : (user?.companyId ?? 0);
  const companyName = isAdmin ? target.name.trim() : (user?.companyName ?? '');

  // 기업 — 관리자는 고르거나 입력한 값, 그 외는 로그인(가입) 값. 기업 주소가 저장본에 없으면 데모 계정 정보에서
  const site = useMemo(() => {
    if (isAdmin) return { name: target.name.trim(), address: target.address.trim() };
    const address = user?.companyAddress || Object.values(POC_USERS).find((u) => u.companyId === companyId)?.companyAddress || '';
    return { name: companyName, address };
  }, [isAdmin, target.name, target.address, user?.companyAddress, companyId, companyName]);

  // 지난 검토 기록
  const { data: myDiag } = useDiagnosesByCompany(isAdmin ? 0 : companyId);
  const { data: allDiag } = useDiagnoses(); // 관리자 — 전체에서 업체로 찾는다
  const diagData = isAdmin ? allDiag : myDiag;
  // 관리자가 넣은 신규 기업(번호 없음)은 기업명으로 찾는다
  const history = useMemo(
    () => ((diagData ?? []) as Diagnosis[]).filter((d) => d.sim && (!isAdmin || (companyId > 0 ? d.companyId === companyId : !!companyName && d.companyName === companyName))),
    [diagData, isAdmin, companyId, companyName],
  );

  const [f, setF] = useState<SimInput>(() => defaultSimInput());
  const [view, setView] = useState<View>({ kind: 'input' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (f.site !== site.name || f.address !== site.address) setF((p) => ({ ...p, site: site.name, address: site.address }));
  }, [site, f.site, f.address]);

  // 기존 태양광 설비 — 이 회사에 연결된 발전소(대시보드와 같은 power-stations/by-company). 설비 규모만 채우고
  // 연간 발전량·사용량은 아직 모르니 비워 둔다. 관리자처럼 연결된 발전소가 없으면 직접 입력
  const { data: stationData } = useQuery({
    queryKey: powerStationKeys.list({ ownerCompanyId: companyId }),
    queryFn: () => getPowerStationsByCompany(companyId),
    enabled: companyId > 0,
    staleTime: 60_000,
  });
  const stations = useMemo(() => (Array.isArray(stationData) ? stationData : []), [stationData]);
  const facilitySource = stations.length
    ? `발전소 데이터에서 불러옴 — ${stations.map((s) => `${s.name} ${s.capacityKw} kW${s.address ? ` (${s.address})` : ''}`).join(', ')}`
    : '연결된 발전소 없음 — 필요하면 직접 입력';
  const filled = useRef(false);
  useEffect(() => {
    filled.current = false;
    if (isAdmin) setF((p) => ({ ...p, facilities: [] }));
  }, [companyId, isAdmin]);
  useEffect(() => {
    if (filled.current || !stations.length) return;
    filled.current = true;
    const kw = Math.round(stations.reduce((acc, s) => acc + s.capacityKw, 0) * 100) / 100;
    setF((p) => (p.facilities.length ? p : { ...p, facilities: [{ source: '태양광', kw, genKwh: 0, useKwh: 0 }] }));
  }, [stations]);

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
    await steps;
    showResult(snap); // 저장은 결과를 보고 [저장]으로
  };

  // 결과를 보고 저장 — 저장하면 검토 기록(내 컨설팅)에 새 검토서로 남는다(덮어쓰지 않음)
  const saveResult = async () => {
    if (view.kind !== 'result' || view.record) return;
    setSaving(true);
    try {
      const R = calc(view.input);
      const d = (await createDiagnosis.mutateAsync({
        companyId,
        companyName,
        domain: 'RE100',
        annualEnergyUsage: Math.round(R.annualGen1 / 1000),
        // 관리자가 대신 진단하면 담당자는 비워 둔다(거래 신청에서 입력)
        contactName: isAdmin ? undefined : user?.name,
        contactEmail: isAdmin ? undefined : user?.email,
        contactPhone: isAdmin ? undefined : user?.phone,
        sim: view.input,
      })) as { id: number; createdAt: string };
      const record = recordOf(d);
      setView({ kind: 'result', input: view.input, record });
      toast('success', `${record.no} 사업 검토서로 저장했습니다`);
    } catch {
      toast('error', '검토서 저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'RE100', path: '/re100' }, { label: '무료진단' }]} />

      {view.kind === 'result' ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BackButton onClick={backToInput} label="입력 화면으로" />
              <h1 className="text-2xl font-bold text-white">무료진단</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  setF({ ...structuredClone(view.input), site: site.name, address: site.address });
                  backToInput();
                }}
              >
                <PencilLine size={14} className="mr-1.5" /> 이 값으로 다시 입력
              </Button>
              <Button onClick={saveResult} disabled={!!view.record || saving}>
                <Save size={14} className="mr-1.5" /> {view.record ? `저장됨 · ${view.record.no}` : saving ? '저장 중...' : '저장'}
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
                <SimInputPanel
                  value={f}
                  onChange={setF}
                  companyName={companyName}
                  facilitySource={facilitySource}
                  companyEdit={
                    isAdmin
                      ? {
                          options: CONSUMERS.map((c) => ({ value: String(c.id), label: c.name })),
                          pick: target.pick,
                          onPick: (v) => {
                            const c = CONSUMERS.find((x) => String(x.id) === v);
                            setTarget(c ? { pick: v, name: c.name, address: c.address } : { pick: '', name: '', address: '' });
                          },
                          name: target.name,
                          onName: (v) => setTarget((t) => ({ ...t, name: v, pick: '' })),
                          address: target.address,
                          onAddress: (v) => setTarget((t) => ({ ...t, address: v })),
                        }
                      : undefined
                  }
                  footer={
                    <Button size="lg" onClick={review} disabled={isAdmin && (!target.name.trim() || !target.address.trim())}>
                      사업 검토
                    </Button>
                  }
                />
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
