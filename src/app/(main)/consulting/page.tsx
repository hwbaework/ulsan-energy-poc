'use client';

import { useRouter } from 'next/navigation';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { ArrowRight, Clock, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionCard } from '@/components/features';
import { cn } from '@/lib/utils';
import { getPersona, usePersonaOverride } from '@/lib/persona';
import { useAuthStore } from '@/stores/useAuthStore';
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
const DOMAIN_LABEL: Record<string, string> = { RE100: 'RE100', CARBON_REDUCTION: '탄소감축', DISTRIBUTED_ENERGY: '분산에너지' };
const STATUS_TO_STEP: Record<string, number> = {
  APPLIED: 0,
  ASSIGNED: 0,
  SURVEYING: 1,
  VISITING: 2,
  DRAFTING: 4,
  REVIEWING: 6,
  COMPLETED: 8,
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
  // 내 컨설팅 — 취소 빼고 전부(진행 중이 먼저)
  const myConsultations = consultations
    .filter((c: any) => c.status !== 'CANCELLED')
    .sort((a: any, b: any) => (STATUS_TO_STEP[a.status] ?? 0) - (STATUS_TO_STEP[b.status] ?? 0));

  // 관리자도 같은 컨설팅 홈을 본다 — 전에는 프로젝트 목록으로 튕겨서 메뉴 "컨설팅 홈"과 화면이 어긋났다

  if (persona === 'consultant') {
    return <ConsultantWorkView router={router} />;
  }

  return (
    <div className="space-y-10">
      <div className="space-y-10">
        {/* 메뉴 이름과 같은 제목 — 다른 RE100 화면과 같은 꼴 */}
        <div className="space-y-6">
          <Breadcrumb items={[{ label: 'RE100', path: '/re100' }, { label: '컨설팅 홈' }]} />
          <h1 className="text-2xl font-bold text-white">컨설팅 홈</h1>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-[#0d1520] to-[#0d1520] ring-1 ring-white/[0.06] p-8 lg:p-12">
          <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-primary/5 blur-3xl" />
          <div className="relative max-w-2xl">
            <Badge variant="primary" className="mb-4 px-3 py-1 text-sm">
              에너지 컨설팅 플랫폼
            </Badge>
            <h2 className="text-2xl lg:text-3xl font-bold text-white leading-tight">
              RE100 달성을 위한
              <br />
              에너지 컨설팅 서비스
            </h2>
            <p className="mt-4 text-sm lg:text-base text-slate-400 leading-relaxed">
              AI 기반 진단으로 우리 기업에 맞는 RE100 이행 방안을 찾아드립니다. 무료진단부터 시작하세요.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => router.push('/consulting/diagnosis')}>
                무료 진단 시작하기
                <ArrowRight size={16} className="ml-1" />
              </Button>
            </div>
          </div>
        </div>

        {/* 내 컨설팅 — 메뉴 '내 컨설팅'의 요약. 없음 / 진행 중 / 완료 전부 여기서 보인다 */}
        <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">내 컨설팅</h2>
            <Button size="sm" variant="secondary" onClick={() => router.push('/consulting/status')}>
              전체 보기
              <ChevronRight size={13} className="ml-1" />
            </Button>
          </div>
          {myConsultations.length === 0 ? (
            <div className="px-6 py-6 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-sm text-slate-500">진행 중인 컨설팅 없음 — 무료진단 결과에서 컨설팅을 신청할 수 있습니다</p>
              <Button size="sm" onClick={() => router.push('/consulting/diagnosis')}>
                무료진단 시작하기
                <ArrowRight size={13} className="ml-1" />
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {myConsultations.map((c: any) => {
                const idx = STATUS_TO_STEP[c.status] ?? 0;
                const done = c.status === 'COMPLETED';
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => router.push(`/consulting/status/${c.id}`)}
                    className="w-full px-6 py-4 flex items-center gap-4 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <span className={cn('h-2 w-2 rounded-full shrink-0', done ? 'bg-emerald-400' : 'bg-primary')} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-white">{`${DOMAIN_LABEL[c.domain as string] ?? c.domain ?? 'RE100'} 컨설팅`}</p>
                        <span className="text-xs text-slate-500 tabular-nums">신청 {String(c.appliedAt ?? c.createdAt ?? '').slice(0, 10)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1">
                        {CONSULTING_PIPELINE.map((_, i) => (
                          <span key={i} className={cn('h-1 flex-1 rounded-full', i <= idx ? (done ? 'bg-emerald-400' : 'bg-primary') : 'bg-white/[0.08]')} />
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn('text-sm font-medium', done ? 'text-emerald-300' : 'text-primary')}>{done ? '완료' : CONSULTING_PIPELINE[idx]}</p>
                      <p className="text-xs text-slate-500 tabular-nums">{idx + 1}/{CONSULTING_PIPELINE.length} 단계</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-600 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
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
                  <p className="text-xs text-slate-500">성숙도 등급</p>
                  <p className={cn('mt-1 text-2xl font-bold', gc?.color ?? 'text-white')}>{grade}</p>
                  <p className="text-xs text-slate-600">{gc?.label ?? ''}</p>
                </div>
                <div className="px-4 py-4">
                  <p className="text-xs text-slate-500">현재 RE 비율</p>
                  <p className="mt-1 text-2xl font-bold text-white tabular-nums">
                    {rePercent}
                    <span className="text-sm font-normal text-slate-400">%</span>
                  </p>
                  <p className="text-xs text-slate-600">목표 100%까지 {100 - rePercent}%p</p>
                </div>
                <div className="px-4 py-4">
                  <p className="text-xs text-slate-500">연간 전력 사용</p>
                  <p className="mt-1 text-2xl font-bold text-white tabular-nums">
                    {(latestDiagnosis.annualEnergyUsage ?? 0).toLocaleString()}
                    <span className="text-sm font-normal text-slate-400"> MWh</span>
                  </p>
                  <p className="text-xs text-slate-600">진단 입력값</p>
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
                        <span className="text-xs text-slate-500">{d.createdAt?.split('T')[0]}</span>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">진행중인 컨설팅</h1>
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
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-500 px-1 text-xs font-bold text-white">
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
                      'text-xs flex-1 text-center',
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
              <span className="text-xs text-slate-500 shrink-0 ml-auto tabular-nums">{project.nextDate}</span>
              {project.pendingDocuments > 0 && (
                <Badge variant="warning" className="text-xs shrink-0">
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
