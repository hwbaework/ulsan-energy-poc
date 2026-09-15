'use client';

import { useMemo, useState } from 'react';
import { Building2, TrendingUp, Leaf, Clock, Play, Plus, Trash2, FileDown } from 'lucide-react';
import { Breadcrumb } from '@/components/layout';
import { useToastStore } from '@/stores/useToastStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useDerDiagnoses, useDerConsultations } from '@/hooks/der/useDerConsulting';
import { useMixSimulation, type MixCandidate, type DerSource } from '@/hooks/der/useMixSimulation';
import { exportDerConsultingReport } from '@/lib/utils/exportDerConsultingReport';

// 에너지 효율화 컨설팅 — 설계문서 21 §2.1·§3.1·§3.2. 계획서 p.147-148.
// 진단·컨설팅은 기존 consultation API(domain=DISTRIBUTED_ENERGY) 재사용, Mix는 신규 /der/mix-simulation.
// Mix 후보 자원: 진단·BE에 후보 원천이 없어 하드코딩 대신 사용자 입력 폼으로 도출(가짜값 금지).
// 보고서 생성: 진단·컨설팅·Mix 시뮬 실데이터 기반 PDF(도입효과 보고서).
const won = (n: number) => `${Math.round(n).toLocaleString()}원`;

const SOURCE_OPTIONS: { value: DerSource; label: string }[] = [
  { value: 'PV', label: '태양광(PV)' },
  { value: 'FC', label: '연료전지(FC)' },
  { value: 'ORC', label: 'ORC 폐열' },
  { value: 'ESS', label: 'ESS 저장' },
  { value: 'V2G', label: 'V2G' },
];

// 사용자 입력 후보 행 — capacityKw·capexKrw는 폼 입력.
interface CandidateInput {
  key: string;
  source: DerSource;
  capacityKw: string;
  capexKrw: string;
}

let candidateSeq = 0;
const newCandidate = (source: DerSource = 'PV'): CandidateInput => ({
  key: `c${++candidateSeq}`,
  source,
  capacityKw: '',
  capexKrw: '',
});

export default function DerConsultingPage() {
  const addToast = useToastStore((s) => s.add);
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);

  const diagnosesQ = useDerDiagnoses(companyId);
  const consultationsQ = useDerConsultations(companyId);
  const mixMut = useMixSimulation();

  const latestDiagnosis = diagnosesQ.data?.[0];
  const consultations = consultationsQ.data ?? [];
  const result = mixMut.data;

  const [ran, setRan] = useState(false);
  const [reportingId, setReportingId] = useState<number | null>(null);
  // Mix 후보 자원 — 사용자 입력(하드코딩 DEFAULT_CANDIDATES 제거).
  const [candidates, setCandidates] = useState<CandidateInput[]>([newCandidate('PV'), newCandidate('ORC')]);

  const validCandidates: MixCandidate[] = candidates
    .map((c) => ({
      source: c.source,
      capacityKw: Number(c.capacityKw) || 0,
      capexKrw: c.capexKrw ? Number(c.capexKrw) : undefined,
    }))
    .filter((c) => c.capacityKw > 0);

  const updateCandidate = (key: string, patch: Partial<CandidateInput>) =>
    setCandidates((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const removeCandidate = (key: string) => setCandidates((cs) => cs.filter((c) => c.key !== key));
  const addCandidate = () => setCandidates((cs) => [...cs, newCandidate('PV')]);

  const runSimulation = () => {
    if (!companyId) {
      addToast('error', '회사 정보를 확인할 수 없습니다');
      return;
    }
    if (!latestDiagnosis) {
      addToast('error', '분산에너지 효율화 진단이 선행되어야 시뮬레이션을 실행할 수 있습니다');
      return;
    }
    if (validCandidates.length === 0) {
      addToast('error', '도입 후보 자원을 1건 이상 입력하세요 (용량 kW 필수)');
      return;
    }
    setRan(true);
    mixMut.mutate(
      {
        companyId,
        annualEnergyUsageKwh: (latestDiagnosis.annualEnergyUsage ?? 0) * 1000, // MWh → kWh
        // currentElecCostKrw 필드로 전송하지만 값은 전기요금 "단가(₩/kWh)"다(백엔드가 단가로 해석).
        currentElecCostKrw: latestDiagnosis.currentElecCost ?? 0,
        annualGhgTon: latestDiagnosis.annualGhgEmission ?? 0,
        candidates: validCandidates,
      },
      {
        onSuccess: () => addToast('success', 'Mix 시뮬레이션을 완료했습니다'),
        onError: () => addToast('error', 'Mix 시뮬레이션에 실패했습니다 (진단 선행 필요)'),
      },
    );
  };

  // 보고서 생성 — 진단·컨설팅·Mix 시뮬 실데이터 기반 PDF 다운로드.
  const generateReport = async (row: {
    id: number;
    clientCompanyName: string;
    status: string;
    maturityGrade?: string;
  }) => {
    setReportingId(row.id);
    try {
      const scenarios = (result?.scenarios ?? []).map((s) => ({
        name: s.name,
        costSavingKrw: s.costSavingKrw,
        ghgReductionTon: s.ghgReductionTon,
        selfSufficiencyPct: s.selfSufficiencyPct,
        paybackYears: s.paybackYears,
        recommended: result?.recommended === s.name,
      }));
      await exportDerConsultingReport({
        companyName: row.clientCompanyName,
        status: row.status,
        maturityGrade: row.maturityGrade ?? latestDiagnosis?.maturityGrade,
        annualEnergyUsageMwh: latestDiagnosis?.annualEnergyUsage,
        currentElecCostKrw: latestDiagnosis?.currentElecCost,
        annualGhgTon: latestDiagnosis?.annualGhgEmission,
        scenarios,
      });
      addToast('success', `${row.clientCompanyName} 도입효과 보고서를 생성했습니다`);
    } catch (e) {
      console.error('보고서 생성 실패:', e);
      addToast('error', '보고서 생성에 실패했습니다');
    } finally {
      setReportingId(null);
    }
  };

  const recommended = result?.scenarios.find((s) => s.name === result.recommended) ?? result?.scenarios[0];
  const kpis = useMemo(
    () => [
      { icon: <Building2 size={15} />, label: '진단 기업', v: diagnosesQ.data?.length ?? 0, tone: 'text-white' },
      {
        icon: <TrendingUp size={15} />,
        label: '예상 절감액(Mix)',
        v: recommended ? won(recommended.costSavingKrw) : '-',
        tone: 'text-emerald-400',
      },
      {
        icon: <Leaf size={15} />,
        label: '예상 탄소감축(Mix)',
        v: recommended ? `-${recommended.ghgReductionTon.toFixed(1)}t` : '-',
        tone: 'text-emerald-400',
      },
      {
        icon: <Clock size={15} />,
        label: '예상 투자회수(Mix)',
        v: recommended
          ? recommended.paybackYears != null
            ? `${recommended.paybackYears.toFixed(1)}년`
            : '회수 불가'
          : '-',
        tone: 'text-white',
      },
    ],
    [diagnosesQ.data, recommended],
  );

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: '분산에너지 효율화' }, { label: '에너지 효율화 컨설팅' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">에너지 효율화 컨설팅</h1>
        <span className="text-xs text-slate-400">최적 에너지 Mix 도출 · 시뮬레이션 연계</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map((s, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {s.icon} {s.label}
            </div>
            <div className={`mt-1 text-xl font-bold ${s.tone}`}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 현재 에너지 사용 진단 (Diagnosis 재사용) */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">에너지 사용 진단</h3>
          {diagnosesQ.isLoading ? (
            <p className="text-xs text-slate-500">불러오는 중…</p>
          ) : latestDiagnosis ? (
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">연간 에너지 사용량</span>
                <span className="text-slate-200">{(latestDiagnosis.annualEnergyUsage ?? 0).toLocaleString()} MWh</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">연간 전력비용</span>
                <span className="text-slate-200">{won(latestDiagnosis.currentElecCost ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">연간 온실가스</span>
                <span className="text-slate-200">{(latestDiagnosis.annualGhgEmission ?? 0).toLocaleString()} tCO₂</span>
              </div>
              {latestDiagnosis.maturityGrade && (
                <div className="flex justify-between">
                  <span className="text-slate-400">성숙도 등급</span>
                  <span className="text-slate-200">{latestDiagnosis.maturityGrade}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">분산에너지 효율화 진단 데이터가 없습니다. 진단을 먼저 진행하세요.</p>
          )}
        </div>

        {/* 에너지원 Mix 시뮬레이션 (신규 API) */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">에너지원 Mix 시뮬레이션</h3>
            <button
              onClick={runSimulation}
              disabled={mixMut.isPending || !latestDiagnosis}
              className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20 disabled:opacity-40"
            >
              <Play size={12} /> {mixMut.isPending ? '실행중…' : '시뮬레이션 실행'}
            </button>
          </div>

          {/* 도입 후보 자원 입력 폼 (하드코딩 후보 제거) */}
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">도입 후보 자원</span>
              <button
                onClick={addCandidate}
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80"
              >
                <Plus size={11} /> 후보 추가
              </button>
            </div>
            {candidates.length === 0 ? (
              <p className="text-[11px] text-slate-500">후보 자원을 추가하세요.</p>
            ) : (
              candidates.map((c) => (
                <div key={c.key} className="flex items-center gap-2">
                  <select
                    value={c.source}
                    onChange={(e) => updateCandidate(c.key, { source: e.target.value as DerSource })}
                    className="w-28 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-xs text-slate-200"
                  >
                    {SOURCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={c.capacityKw}
                    onChange={(e) => updateCandidate(c.key, { capacityKw: e.target.value })}
                    placeholder="용량 kW"
                    className="w-24 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-xs text-slate-200"
                  />
                  <input
                    type="number"
                    value={c.capexKrw}
                    onChange={(e) => updateCandidate(c.key, { capexKrw: e.target.value })}
                    placeholder="투자비 원(선택)"
                    className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-xs text-slate-200"
                  />
                  <button onClick={() => removeCandidate(c.key)} className="text-slate-500 hover:text-red-400">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>

          {result ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-white/[0.06]">
                  <th className="py-2">시나리오</th>
                  <th className="py-2 text-right">비용절감</th>
                  <th className="py-2 text-right">탄소감축</th>
                  <th className="py-2 text-right">자립률</th>
                  <th className="py-2 text-right">회수</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/[0.04] text-slate-300">
                  <td className="py-2.5">현재(기준)</td>
                  <td className="py-2.5 text-right">-</td>
                  <td className="py-2.5 text-right">-</td>
                  <td className="py-2.5 text-right">0%</td>
                  <td className="py-2.5 text-right">-</td>
                </tr>
                {result.scenarios.map((s) => (
                  <tr key={s.name} className="border-b border-white/[0.04] text-slate-300">
                    <td className="py-2.5">
                      {s.name}
                      {result.recommended === s.name && <span className="ml-1 text-[10px] text-emerald-400">추천</span>}
                    </td>
                    <td className="py-2.5 text-right text-emerald-400">{won(s.costSavingKrw)}</td>
                    <td className="py-2.5 text-right text-sky-400">-{s.ghgReductionTon.toFixed(1)}t</td>
                    <td className="py-2.5 text-right">{s.selfSufficiencyPct.toFixed(1)}%</td>
                    <td className="py-2.5 text-right">
                      {s.paybackYears != null ? `${s.paybackYears.toFixed(1)}년` : '회수 불가'}
                    </td>
                  </tr>
                ))}
                {result.scenarios.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-xs text-slate-500">
                      도입 후보 자원이 없어 현재 Mix만 표출됩니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-slate-500">
              {ran
                ? '결과가 없습니다.'
                : '진단 데이터와 도입 후보 자원을 기반으로 시뮬레이션을 실행하세요. 비용·탄소·자립률·회수기간을 산출합니다.'}
            </p>
          )}
        </div>
      </div>

      {/* 컨설팅 진행/리포트 (Consultation 재사용) */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02]">컨설팅 진행 · 도입효과</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">기업</th>
              <th className="px-4 py-3">단계</th>
              <th className="px-4 py-3">성숙도</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {consultationsQ.isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-xs text-slate-500">
                  불러오는 중…
                </td>
              </tr>
            ) : consultations.length ? (
              consultations.map((c) => (
                <tr key={c.id} className="border-b border-white/[0.04] text-slate-300">
                  <td className="px-4 py-3">{c.clientCompanyName}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-sky-500/10 px-2 py-0.5 text-xs text-sky-400">{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{c.maturityGrade ?? '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() =>
                        generateReport({
                          id: c.id,
                          clientCompanyName: c.clientCompanyName,
                          status: c.status,
                          maturityGrade: c.maturityGrade,
                        })
                      }
                      disabled={reportingId === c.id}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 disabled:opacity-40"
                    >
                      <FileDown size={12} /> {reportingId === c.id ? '생성중…' : '보고서 생성'}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-xs text-slate-500">
                  진행 중인 분산에너지 효율화 컨설팅이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
