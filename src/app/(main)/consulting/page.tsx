'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Clock, Send, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionCard } from '@/components/features';
import { cn } from '@/lib/utils';
import { getPersona, usePersonaOverride } from '@/lib/persona';
import { useAuthStore } from '@/stores/useAuthStore';
import { getUpcomingRegulations, getDaysUntilDeadline, getRegulationUrgency } from '@/lib/regulations';
import {
  useConsultationsByCompany,
  useConsultationsByConsultant,
  useDiagnosesByCompany,
} from '@/hooks/consulting/useConsultations';
import { getMaturityGrade, MATURITY_GRADE_CONFIG } from '@/lib/maturity';
import type { Diagnosis } from '@/types/consultation';

// 현 단계 showcase = RE100 단일 도메인 (탄소감축·분산에너지는 추후)

// 컨설팅 표준 진행 단계 (수용가 관점) — 신청 → 정산. 홈·내 컨설팅 공통 기준, 한 단계도 빠지지 않게
const CONSULTING_PIPELINE = [
  '신청',
  '컨설턴트 선택',
  '설문조사',
  '현장 방문',
  '사업장 등록',
  '보고서 작성',
  '동의',
  '검수 대기',
  '최종 보고',
  '정산',
];
// 백엔드 ConsultationStatus → 파이프라인 인덱스 (enum에 없는 사업장 등록·동의는 인접 매핑)
const STATUS_TO_STEP: Record<string, number> = {
  APPLIED: 0,
  ASSIGNED: 1,
  SURVEYING: 2,
  VISITING: 3,
  DRAFTING: 5,
  REVIEWING: 7,
  COMPLETED: 9,
};

export default function ConsultingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const override = usePersonaOverride((s) => s.override);
  const persona = override ?? getPersona(user);
  const companyId = user?.companyId ?? 0;
  const { data: apiConsultations } = useConsultationsByCompany(companyId);
  const consultations = (apiConsultations ?? []) as any[];
  const { data: diagnoses } = useDiagnosesByCompany(companyId);
  const diagnosisList = (diagnoses ?? []) as Diagnosis[];
  const activeProject = consultations.find((c: any) => !['COMPLETED', 'CANCELLED'].includes(c.status));
  const pendingProposals = consultations.filter((c: any) => c.status === 'APPLIED').length;
  // 해야 할 일 — 이미 해당 도메인으로 컨설팅이 진행 중이면 to-do에서 제외
  const activeDomains = new Set(
    consultations.filter((c: any) => !['CANCELLED'].includes(c.status)).map((c: any) => c.domain),
  );
  const todos = getUpcomingRegulations()
    .filter((r) => r.relatedDomain === 'RE100')
    .filter((r) => !activeDomains.has(r.relatedDomain));

  useEffect(() => {
    if (persona === 'spc' || persona === 'admin') {
      router.replace('/consulting/projects');
    }
  }, [persona, router]);

  if (persona === 'spc' || persona === 'admin') return null;

  if (persona === 'consultant') {
    return <ConsultantWorkView router={router} />;
  }

  return (
    <div className="flex gap-6">
      {/* Left: Main content — 메인이라 breadcrumb 없음 */}
      <div className="flex-1 min-w-0 space-y-10">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-[#0d1520] to-[#0d1520] ring-1 ring-white/[0.06] p-8 lg:p-12">
          <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-primary/5 blur-3xl" />
          <div className="relative max-w-2xl">
            <Badge variant="primary" className="mb-4">
              에너지 컨설팅 플랫폼
            </Badge>
            <h1 className="text-2xl lg:text-3xl font-bold text-white leading-tight">
              RE100 달성을 위한
              <br />
              컨설턴트 매칭 서비스
            </h1>
            <p className="mt-4 text-sm lg:text-base text-slate-400 leading-relaxed max-w-lg">
              AI 기반 진단으로 우리 기업에 꼭 맞는 에너지 컨설턴트를 찾아드립니다. 무료 진단부터 시작해보세요.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => router.push('/consulting/diagnosis')}>
                무료 진단 시작하기
                <ArrowRight size={16} className="ml-1" />
              </Button>
              <Button size="lg" variant="secondary" onClick={() => router.push('/consulting/marketplace')}>
                컨설턴트 둘러보기
              </Button>
            </div>
          </div>
        </div>

        {/* 최근 진단 결과 — Diagnosis API 기반 */}
        {(() => {
          const latestDiagnosis = diagnosisList[0];
          if (!latestDiagnosis) return null;
          const rePercent = latestDiagnosis.currentRePercent ?? 0;
          const grade = latestDiagnosis.maturityGrade || getMaturityGrade(rePercent);
          const gc = MATURITY_GRADE_CONFIG[grade as keyof typeof MATURITY_GRADE_CONFIG];
          return (
            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">최근 진단 결과</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {latestDiagnosis.createdAt?.split('T')[0]} 진행 ·{' '}
                    {latestDiagnosis.domain === 'RE100'
                      ? 'RE100 이행 전략'
                      : latestDiagnosis.domain === 'CARBON_REDUCTION'
                        ? '탄소감축 전략'
                        : '분산에너지 전환'}{' '}
                    진단
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => router.push(`/consulting/diagnosis/report?id=${latestDiagnosis.id}`)}
                >
                  리포트 다시 보기
                  <ArrowRight size={14} className="ml-1" />
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 divide-x divide-white/[0.04] text-center">
                <div className="px-4 py-4">
                  <p className="text-[11px] text-slate-500">성숙도 등급</p>
                  <p className={cn('mt-1 text-2xl font-bold', gc?.color ?? 'text-white')}>{grade}</p>
                  <p className="text-[10px] text-slate-600">{gc?.label ?? ''}</p>
                </div>
                <div className="px-4 py-4">
                  <p className="text-[11px] text-slate-500">현재 RE 비율</p>
                  <p className="mt-1 text-2xl font-bold text-white tabular-nums">
                    {rePercent}
                    <span className="text-sm font-normal text-slate-400">%</span>
                  </p>
                  <p className="text-[10px] text-slate-600">목표 100%까지 {100 - rePercent}%p</p>
                </div>
                <div className="px-4 py-4">
                  <p className="text-[11px] text-slate-500">연간 전력 사용</p>
                  <p className="mt-1 text-2xl font-bold text-white tabular-nums">
                    {(latestDiagnosis.annualEnergyUsage ?? 0).toLocaleString()}
                    <span className="text-sm font-normal text-slate-400"> MWh</span>
                  </p>
                  <p className="text-[10px] text-slate-600">진단 입력값</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 진단 이력 목록 */}
        {diagnosisList.length > 1 && (
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">진단 이력</h2>
                <p className="text-xs text-slate-500 mt-0.5">총 {diagnosisList.length}건의 진단을 수행했습니다</p>
              </div>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {diagnosisList.slice(1).map((d) => {
                const grade = d.maturityGrade || getMaturityGrade(d.currentRePercent ?? 0);
                const gc = MATURITY_GRADE_CONFIG[grade as keyof typeof MATURITY_GRADE_CONFIG];
                return (
                  <button
                    key={d.id}
                    onClick={() => router.push(`/consulting/diagnosis/report?id=${d.id}`)}
                    className="w-full px-6 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors text-left"
                  >
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold shrink-0',
                        gc?.color ?? 'text-white',
                      )}
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                    >
                      {grade}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">
                          {d.domain === 'RE100' ? 'RE100' : d.domain === 'CARBON_REDUCTION' ? '탄소감축' : '분산에너지'}
                        </span>
                        <span className="text-[10px] text-slate-500">{d.createdAt?.split('T')[0]}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {d.industry ?? '업종 미입력'} · {d.annualEnergyUsage?.toLocaleString() ?? '-'} MWh · RE{' '}
                        {d.currentRePercent ?? 0}%
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-slate-600 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 해야 할 일 — RE100 이행을 위해 챙겨야 할 액션(규제 마감 등). 받은 제안은 알림+LNB 뱃지로 분리 */}
        <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">해야 할 일</h2>
              <p className="text-xs text-slate-500 mt-0.5">RE100 이행을 위해 기한 내 처리할 항목</p>
            </div>
            <span className="text-sm font-bold text-amber-300 tabular-nums">{todos.length}건</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {todos.length === 0 && <p className="px-6 py-6 text-sm text-slate-500">지금 처리할 마감 항목이 없습니다</p>}
            {todos.map((t) => {
              const daysLeft = getDaysUntilDeadline(t.deadline);
              const urgency = getRegulationUrgency(daysLeft);
              const dot =
                urgency === 'critical' ? 'bg-rose-400' : urgency === 'warning' ? 'bg-amber-400' : 'bg-blue-400';
              const dColor =
                urgency === 'critical' ? 'text-rose-400' : urgency === 'warning' ? 'text-amber-300' : 'text-blue-300';
              return (
                <div key={t.id} className="px-6 py-4 flex items-center gap-4">
                  <span className={cn('h-2 w-2 rounded-full shrink-0', dot)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white">{t.name}</p>
                      <span className={cn('text-[11px] font-bold tabular-nums', dColor)}>
                        D-{daysLeft > 0 ? daysLeft : 0}
                      </span>
                      <span className="text-[10px] text-slate-500 tabular-nums">마감 {t.deadline}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => router.push('/consulting/diagnosis?domain=RE100')}
                  >
                    대응 컨설팅
                    <ArrowRight size={13} className="ml-1" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* end left */}

      {/* Right: Project timeline */}
      <div className="hidden lg:block w-[300px] shrink-0">
        {activeProject ? (
          <ActiveProjectSidebar project={activeProject} router={router} />
        ) : (
          <div className="sticky top-0 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5">
            <p className="text-sm font-semibold text-white mb-2">진행 중인 컨설팅</p>
            <p className="text-xs text-slate-500">아직 진행 중인 컨설팅이 없습니다</p>
            <Button size="sm" className="mt-3 w-full" onClick={() => router.push('/consulting/diagnosis')}>
              무료 진단 시작하기
            </Button>
          </div>
        )}

        {pendingProposals > 0 && (
          <button
            onClick={() => router.push('/consulting/proposals')}
            className="mt-4 w-full text-left rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20 p-4 hover:ring-blue-500/40 transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <Send size={14} className="text-blue-400" />
              <p className="text-sm font-medium text-blue-400">{pendingProposals}건 견적 요청 중</p>
              <ChevronRight size={14} className="text-blue-400/60 ml-auto" />
            </div>
            <p className="text-xs text-slate-400">제안서가 도착하면 알림으로 안내드립니다</p>
          </button>
        )}
      </div>
    </div>
  );
}

function ActiveProjectSidebar({ project, router }: { project: any; router: ReturnType<typeof useRouter> }) {
  // 표준 파이프라인(신청 → 정산) 전체를 표시 — 백엔드 status 로 현재 단계만 산출
  const currentIdx = STATUS_TO_STEP[project.status] ?? 0;
  const doneCount = CONSULTING_PIPELINE.filter((_, i) => i < currentIdx).length;

  return (
    <div className="sticky top-0 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">진행 중인 컨설팅</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{project.domain} 컨설팅</p>
        </div>
        <span className="text-xs font-bold text-primary tabular-nums">
          {doneCount}/{CONSULTING_PIPELINE.length}
        </span>
      </div>

      {project.consultantName && (
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
            {project.consultantName.charAt(0)}
          </div>
          <div>
            <p className="text-xs font-medium text-white">{project.consultantName}</p>
            <p className="text-[10px] text-slate-500">
              {project.origin === 'outsource' ? `${project.agencyName ?? '용역사'} 배정` : '독립 컨설턴트'}
            </p>
          </div>
        </div>
      )}

      {/* 컴팩트 — 현재 단계 + 진행률 바만. 전체 10단계 타임라인은 내 컨설팅(/status)에 */}
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">현재 단계</span>
          <Badge variant="primary" className="text-[10px]">
            {CONSULTING_PIPELINE[currentIdx] ?? '진행 중'}
          </Badge>
        </div>
        <div className="flex gap-0.5">
          {CONSULTING_PIPELINE.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full',
                i < currentIdx ? 'bg-emerald-500' : i === currentIdx ? 'bg-primary' : 'bg-white/[0.06]',
              )}
            />
          ))}
        </div>
      </div>

      <div className="px-5 py-4 border-t border-white/[0.06] bg-primary/[0.03]">
        <Button size="sm" className="w-full h-8 text-xs" onClick={() => router.push('/consulting/status')}>
          내 컨설팅에서 보기 <ArrowRight size={12} className="ml-1" />
        </Button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Consultant work view                                             */
/* ────────────────────────────────────────────────────────────────── */

type ProjectPhase = 'DIAGNOSING' | 'VISITING' | 'DRAFTING' | 'REVIEWING' | 'COMPLETED';

interface ActiveProject {
  id: number;
  companyName: string;
  domain: string;
  phase: ProjectPhase;
  nextAction: string;
  nextDate: string;
  milestones: { title: string; done: boolean; current?: boolean }[];
  unreadMessages: number;
  pendingDocuments: number;
  origin: 'marketplace' | 'outsource' | 'referral';
}

const PHASE_LABEL: Record<ProjectPhase, string> = {
  DIAGNOSING: '진단 진행',
  VISITING: '현장 방문',
  DRAFTING: '보고서 작성',
  REVIEWING: '검토 중',
  COMPLETED: '완료',
};

const PHASE_VARIANT: Record<ProjectPhase, 'info' | 'warning' | 'primary' | 'success' | 'default'> = {
  DIAGNOSING: 'info',
  VISITING: 'warning',
  DRAFTING: 'primary',
  REVIEWING: 'info',
  COMPLETED: 'success',
};

function ConsultantWorkView({ router }: { router: ReturnType<typeof useRouter> }) {
  const user = useAuthStore((s) => s.user);
  const consultantId = user?.id ?? 0;
  const { data: apiConsultations } = useConsultationsByConsultant(consultantId);
  const rawConsultations = (apiConsultations ?? []) as any[];

  const ACTIVE_PROJECTS: ActiveProject[] = rawConsultations
    .filter((c: any) => !['COMPLETED', 'CANCELLED'].includes(c.status))
    .map((c: any) => ({
      id: c.id,
      companyName: c.clientCompanyName ?? '고객사',
      domain: c.domain ?? 'RE100',
      phase: (c.status === 'SURVEYING' ? 'DIAGNOSING' : c.status) as ProjectPhase,
      nextAction: c.status === 'COMPLETED' ? '완료됨' : '다음 단계를 진행하세요',
      nextDate: c.assignedAt?.split('T')[0] ?? '',
      milestones: [],
      unreadMessages: 0,
      pendingDocuments: 0,
      origin: (c.origin ?? 'marketplace') as 'marketplace' | 'outsource' | 'referral',
    }));

  const actionRequired = ACTIVE_PROJECTS.filter(
    (p) => p.unreadMessages > 0 || p.pendingDocuments > 0 || p.phase !== 'COMPLETED',
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">진행중인 컨설팅</h1>
        <p className="mt-1 text-sm text-slate-400">
          {ACTIVE_PROJECTS.length}건 진행중 · {actionRequired.length}건 액션 필요
        </p>
      </div>

      {/* 프로젝트 카드 목록 */}
      <div className="space-y-4">
        {ACTIVE_PROJECTS.map((project) => (
          <button
            key={project.id}
            onClick={() => router.push(`/consulting/status/${project.id}`)}
            className="w-full text-left rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] hover:ring-white/[0.12] transition-all"
          >
            {/* 카드 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-sm font-bold text-white shrink-0">
                  {project.companyName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{project.companyName}</span>
                    <Badge variant="default">{project.domain}</Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={PHASE_VARIANT[project.phase]}>{PHASE_LABEL[project.phase]}</Badge>
                {project.unreadMessages > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-bold text-white">
                    {project.unreadMessages}
                  </span>
                )}
                <ChevronRight size={14} className="text-slate-600" />
              </div>
            </div>

            {/* 마일스톤 진행바 */}
            <div className="px-5 py-3">
              <div className="flex items-center gap-1">
                {project.milestones.map((m, i) => (
                  <div key={i} className="flex items-center gap-1 flex-1">
                    <div
                      className={cn(
                        'h-1.5 flex-1 rounded-full',
                        m.done ? 'bg-emerald-500' : m.current ? 'bg-primary' : 'bg-white/[0.06]',
                      )}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1.5">
                {project.milestones.map((m, i) => (
                  <span
                    key={i}
                    className={cn(
                      'text-[10px] flex-1 text-center',
                      m.done ? 'text-emerald-400' : m.current ? 'text-primary' : 'text-slate-600',
                    )}
                  >
                    {m.title}
                  </span>
                ))}
              </div>
            </div>

            {/* 다음 액션 */}
            <div className="flex items-center gap-2 px-5 py-3 border-t border-white/[0.06] bg-white/[0.01]">
              <Clock size={12} className="text-amber-400 shrink-0" />
              <span className="text-xs text-slate-300 truncate">{project.nextAction}</span>
              <span className="text-[10px] text-slate-500 shrink-0 ml-auto tabular-nums">{project.nextDate}</span>
              {project.pendingDocuments > 0 && (
                <Badge variant="warning" className="text-[10px] shrink-0">
                  문서 {project.pendingDocuments}
                </Badge>
              )}
            </div>
          </button>
        ))}
      </div>

      {ACTIVE_PROJECTS.length === 0 && (
        <SectionCard title="다가오는 일정">
          <p className="text-sm text-slate-500 py-8 text-center">아직 진행 중인 프로젝트가 없습니다</p>
        </SectionCard>
      )}
    </div>
  );
}
