'use client';

import { useRouter } from 'next/navigation';
import { simHeadline } from '@/components/features/consulting/SimReport';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { ArrowRight, Clock, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionCard } from '@/components/features';
import { cn } from '@/lib/utils';
import { getPersona, usePersonaOverride } from '@/lib/persona';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  useConsultationsByConsultant,
  useDiagnosesByCompany,
} from '@/hooks/consulting/useConsultations';
import { EOK, F1 } from '@/lib/solar-sim';
import type { Diagnosis } from '@/types/consultation';

// 현 단계 showcase = RE100 단일 도메인 (탄소감축·분산에너지는 추후)

export default function ConsultingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const override = usePersonaOverride((s) => s.override);
  const persona = override ?? getPersona(user);
  const companyId = user?.companyId ?? 0;
  const { data: diagnoses } = useDiagnosesByCompany(companyId);
  const diagnosisList = (diagnoses ?? []) as Diagnosis[];
  // 진단 결과 — 행을 누르면 내 컨설팅에서 그 검토서를 연다
  const openReview = (id: number) => router.push(`/consulting/status?review=${id}`);

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

        {/* 진단 결과 — 무료진단으로 남긴 검토서 목록. 행을 누르면 내 컨설팅에서 그 검토서를 연다 */}
        <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">진단 결과</h2>
            <Badge variant="primary">{diagnosisList.length}건</Badge>
          </div>
          {diagnosisList.length === 0 ? (
            <p className="px-6 py-6 text-sm text-slate-500">진단 결과 없음 — 무료진단을 받으면 여기에 쌓입니다</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-slate-400">
                  <th className="px-6 py-3 font-medium">진단일</th>
                  <th className="px-4 py-3 font-medium">사업장</th>
                  <th className="px-4 py-3 font-medium">방식</th>
                  <th className="px-4 py-3 font-medium">설치용량</th>
                  <th className="px-4 py-3 font-medium">연간 발전량 (1차년)</th>
                  <th className="px-4 py-3 font-medium">20년 누적 절감</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {diagnosisList.map((d) => {
                  const h = d.sim ? simHeadline(d.sim) : null;
                  return (
                    <tr
                      key={d.id}
                      onClick={() => openReview(d.id)}
                      className="cursor-pointer transition-colors hover:bg-white/[0.03]"
                    >
                      <td className="px-6 py-3.5 text-slate-300 tabular-nums">{d.createdAt?.slice(0, 10)}</td>
                      <td className="px-4 py-3.5 font-medium text-white">{d.sim?.site ?? ''}</td>
                      <td className="px-4 py-3.5 text-slate-200">{h?.mode ?? ''}</td>
                      <td className="px-4 py-3.5 text-slate-200 tabular-nums">{h ? `${h.cap.toLocaleString()} kW` : ''}</td>
                      <td className="px-4 py-3.5 text-slate-200 tabular-nums">{h ? `${F1(h.gen1 / 1000)} MWh` : ''}</td>
                      <td className="px-4 py-3.5 text-lg font-bold text-white tabular-nums">{h ? `${EOK(h.save20)} 억원` : ''}</td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="inline-flex items-center gap-0.5 text-sm text-slate-500">내 컨설팅에서 보기 <ChevronRight size={13} /></span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
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
