// @ts-nocheck
'use client';

import { Suspense, useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  FileText,
  ArrowRight,
  Clock,
  Calendar,
  MapPin,
  Plus,
  Loader2,
  ClipboardList,
  Eye,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ChatPanel } from '@/components/features/ChatPanel';
import { cn } from '@/lib/utils';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useToastStore } from '@/stores/useToastStore';
import {
  useConsultation,
  useMilestones,
  useSites,
  useReports,
  useCreateSite,
  useSchedules,
  useCreateSchedule,
  useRespondToSchedule,
  useSurvey,
  useCreateSurvey,
  useTransitionStatus,
  useApproveReport,
  useRejectReport,
  useDiagnosesByCompany,
  useCompleteMilestone,
  useStartMilestone,
  useSendChatMessage,
} from '@/hooks/consulting/useConsultations';
import { useAuthStore } from '@/stores/useAuthStore';
import { useConsumerSites, useCreateConsumerSite } from '@/hooks/consumer/useConsumer';

import type { ConsultationOrigin } from '@/types/consultation';

const STATUS_LABEL: Record<string, string> = {
  APPLIED: '신청',
  ASSIGNED: '배정완료',
  SURVEYING: '설문조사',
  VISITING: '현장방문',
  DRAFTING: '보고서 작성',
  REVIEWING: '검수 대기',
  COMPLETED: '완료',
  CANCELLED: '취소',
};

const MILESTONE_META: Record<string, { title: string; desc: string }> = {
  SURVEY: {
    title: '설문을 작성해주세요',
    desc: '사업장의 에너지 사용량, 온실가스 배출량 등을 입력하면 컨설턴트가 방문 전 사전 분석을 진행합니다.',
  },
  PROSPECT: { title: '사업장을 등록해주세요', desc: '방문 전 사업장을 등록하면 맞춤 분석이 가능합니다.' },
  SCHEDULE: {
    title: '방문 일정을 조율하세요',
    desc: '컨설턴트가 사업장을 직접 방문합니다. 희망 날짜와 시간을 선택하세요.',
  },
  NAVIGATE: {
    title: '현장 방문이 진행 중입니다',
    desc: '컨설턴트가 사업장을 방문하여 에너지 사용 현황을 확인하고 있습니다.',
  },
  DOCUMENTS: {
    title: '보고서가 작성 중입니다',
    desc: '컨설턴트가 현장 방문 결과를 바탕으로 보고서를 작성하고 있습니다. 완료 시 검토를 요청드립니다.',
  },
  CONTRACT: {
    title: '계약서를 확인해주세요',
    desc: '컨설턴트가 작성한 계약서를 검토하고 승인 또는 수정을 요청하세요.',
  },
  REVIEW: { title: '보고서를 검토해주세요', desc: '보고서가 제출되었습니다. 검토 후 승인하면 컨설팅이 완료됩니다.' },
};

const ACTOR_META: Record<string, string> = {
  수용가: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
  컨설턴트: 'bg-blue-500/10 text-blue-300 ring-blue-500/30',
  양측: 'bg-violet-500/10 text-violet-300 ring-violet-500/30',
};

function inferActionType(title: string): string {
  if (title.includes('설문') || title.includes('자료 수집')) return 'SURVEY';
  if (title.includes('사업장')) return 'PROSPECT';
  if (title.includes('일정')) return 'SCHEDULE';
  if (title.includes('방문') || title.includes('실사')) return 'NAVIGATE';
  if (title.includes('보고서') || title.includes('초안') || title.includes('최종 보고')) return 'DOCUMENTS';
  if (title.includes('검수') || title.includes('검토')) return 'REVIEW';
  if (title.includes('계약')) return 'CONTRACT';
  return '';
}

function milestoneToStep(m: any) {
  const stateMap: Record<string, string> = {
    COMPLETED: 'done',
    STARTED: 'action',
    IN_PROGRESS: 'action',
  };
  const actorMap: Record<string, string> = {
    SURVEY: '수용가',
    PROSPECT: '수용가',
    SCHEDULE: '양측',
    NAVIGATE: '컨설턴트',
    DOCUMENTS: '컨설턴트',
    REVIEW: '수용가',
    CONTRACT: '양측',
  };
  const at = (m.actionType || m.action_type || '').toUpperCase() || inferActionType(m.title || '');
  return {
    title: m.title,
    actionType: at,
    actor: actorMap[at] || '양측',
    state: stateMap[m.status] || 'upcoming',
    date: m.completedDate || m.dueDate || '',
    desc: m.description || m.title,
    milestoneId: m.id,
  };
}

const TIME_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

/* ── Schedule Booking Modal ───────────────────────────────── */

type BookingStep = 'select' | 'confirm' | 'done';

function ScheduleBooking({
  consultationId,
  onClose,
  onComplete,
}: {
  consultationId: number;
  onClose: () => void;
  onComplete: (date: string, time: string) => void;
}) {
  const [step, setStep] = useState<BookingStep>('select');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [memo, setMemo] = useState('');
  const createSchedule = useCreateSchedule();

  const today = new Date();
  const minDate = new Date(today.getTime() + 86400000).toISOString().split('T')[0];

  const handleSubmit = () => {
    if (!selectedDate || !selectedTime) return;
    createSchedule.mutate(
      { consultationId, data: { scheduledDate: selectedDate, scheduledTime: selectedTime, memo: memo || undefined } },
      {
        onSuccess: () => {
          onComplete(selectedDate, selectedTime);
          setStep('done');
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center animate-[fadeIn_200ms_ease-out]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-4 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <MapPin size={14} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">현장 방문 일정 잡기</h2>
              <p className="text-[10px] text-slate-400">방문 희망 날짜와 시간을 선택하세요</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {step === 'select' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">날짜 선택</label>
                <input
                  type="date"
                  min={minDate}
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedTime(null);
                  }}
                  className="w-full h-10 rounded-lg border border-accent/30 bg-surface-dark px-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                />
              </div>
              {selectedDate && (
                <>
                  <p className="text-xs text-slate-400">시간을 선택하세요</p>
                  <div className="flex flex-wrap gap-2">
                    {TIME_SLOTS.map((time) => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={cn(
                          'rounded-lg px-4 py-2.5 text-xs ring-1 transition-all flex items-center gap-2',
                          selectedTime === time
                            ? 'bg-primary/10 ring-primary/40 text-primary'
                            : 'bg-white/[0.02] ring-white/[0.06] text-slate-300 hover:ring-white/[0.12]',
                        )}
                      >
                        <Clock size={12} />
                        {time}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {selectedDate && selectedTime && (
                <div className="pt-2">
                  <label className="block text-xs text-slate-400 mb-1.5">메모 (선택)</label>
                  <input
                    type="text"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="방문 시 참고사항이 있으면 입력하세요"
                    className="w-full h-9 rounded-lg border border-accent/30 bg-surface-dark px-3 text-xs text-white placeholder:text-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  />
                </div>
              )}
            </div>
          )}

          {step === 'confirm' && selectedDate && selectedTime && (
            <div className="space-y-5">
              <div className="rounded-xl bg-primary/5 ring-1 ring-primary/20 p-5 text-center">
                <Calendar size={24} className="text-primary mx-auto mb-3" />
                <p className="text-base font-bold text-white">{selectedDate}</p>
                <p className="text-xl font-bold text-primary mt-1">{selectedTime}</p>
                {memo && <p className="text-xs text-slate-400 mt-2">메모: {memo}</p>}
              </div>
              <p className="text-[10px] text-slate-500 text-center">
                요청 후 컨설턴트가 확정하면 양쪽 모두에게 알림이 발송됩니다
              </p>
            </div>
          )}

          {step === 'done' && (
            <div className="py-6 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
                <CheckCircle2 size={28} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-base font-bold text-white">일정 요청이 전송되었습니다</p>
                <p className="text-xs text-slate-400 mt-1">
                  {selectedDate} {selectedTime}
                </p>
              </div>
              <p className="text-xs text-slate-500">컨설턴트 확정 후 알림으로 안내드립니다</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/[0.06] px-6 py-4">
          {step === 'select' && (
            <>
              <Button variant="secondary" size="sm" onClick={onClose}>
                취소
              </Button>
              <Button size="sm" disabled={!selectedDate || !selectedTime} onClick={() => setStep('confirm')}>
                일정 확인
              </Button>
            </>
          )}
          {step === 'confirm' && (
            <>
              <Button variant="secondary" size="sm" onClick={() => setStep('select')}>
                다시 선택
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={createSchedule.isPending}>
                {createSchedule.isPending ? (
                  <Loader2 size={12} className="animate-spin mr-1" />
                ) : (
                  <Send size={12} className="mr-1" />
                )}
                일정 요청하기
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button size="sm" onClick={onClose}>
              확인
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────── */

export default function ProjectHubPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">로딩 중...</div>}>
      <ProjectHubContent />
    </Suspense>
  );
}

function ProjectHubContent() {
  const { id } = useParams<{ id: string }>();
  const consultationId = Number(id);
  const router = useRouter();
  const searchParams = useSearchParams();
  const origin = (searchParams.get('origin') as ConsultationOrigin) || 'marketplace';

  const [showBooking, setShowBooking] = useState(false);
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [siteForm, setSiteForm] = useState({ name: '', siteType: 'FACTORY', address: '', contractPowerKw: '' });
  const [selectedConsumerSiteIds, setSelectedConsumerSiteIds] = useState<Set<number>>(new Set());
  const [respondingSchedule, setRespondingSchedule] = useState<{ id: number; action: 'REJECT' | 'RESCHEDULE' } | null>(
    null,
  );
  const [respondForm, setRespondForm] = useState({ reason: '', proposedDate: '', proposedTime: '' });

  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? 0;

  const isConsumer = user?.roles?.some((r: string) => r.toUpperCase() === 'CONSUMER_MANAGER');
  useEffect(() => {
    if (isConsumer) router.replace(`/consulting/status/${id}`);
  }, [isConsumer, id, router]);

  const { data: consultation, isLoading } = useConsultation(consultationId);
  const { data: apiMilestones = [] } = useMilestones(consultationId);
  const { data: sites = [] } = useSites(consultationId);
  const { data: consumerSitesData } = useConsumerSites({ companyId });
  const consumerSites = consumerSitesData?.content ?? [];
  const { data: reports = [] } = useReports(consultationId);
  const { data: schedules = [] } = useSchedules(consultationId);
  const { data: survey, isError: surveyError } = useSurvey(consultationId);
  const { data: companyDiagnoses = [] } = useDiagnosesByCompany(companyId);
  const respondToSchedule = useRespondToSchedule();
  const sendChatMessage = useSendChatMessage();
  const createSite = useCreateSite();
  const createConsumerSite = useCreateConsumerSite();
  const completeMilestone = useCompleteMilestone();
  const startMilestone = useStartMilestone();
  const createSurvey = useCreateSurvey();
  const transitionStatus = useTransitionStatus();
  const approveReport = useApproveReport();
  const rejectReport = useRejectReport();
  const toast = useToastStore((s) => s.add);
  const [rejectingContractId, setRejectingContractId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const milestonesSorted = useMemo(() => {
    const ms = Array.isArray(apiMilestones) ? apiMilestones : [];
    return [...ms].sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [apiMilestones]);

  const steps = useMemo(() => milestonesSorted.map(milestoneToStep), [milestonesSorted]);
  const hasMilestones = steps.length > 0;
  const isContractStepDone = useMemo(() => {
    const cm: any = milestonesSorted.find(
      (m: any) => (m.actionType || m.action_type || '').toUpperCase() === 'CONTRACT',
    );
    return cm?.status === 'COMPLETED';
  }, [milestonesSorted]);
  const prospectMilestone: any = useMemo(() => {
    return milestonesSorted.find((m: any) => (m.actionType || m.action_type || '').toUpperCase() === 'PROSPECT');
  }, [milestonesSorted]);
  const msDoneCount = steps.filter((s: any) => s.state === 'done').length;
  const msCurrentStepRaw = steps.find((s: any) => s.state === 'action');
  const msCurrentIdxRaw = steps.findIndex((s: any) => s.state === 'action');
  const firstUpcomingIdx = steps.findIndex((s: any) => s.state === 'upcoming');
  const msCurrentStep = msCurrentStepRaw ?? (firstUpcomingIdx >= 0 ? steps[firstUpcomingIdx] : undefined);
  const msCurrentIdx = msCurrentIdxRaw >= 0 ? msCurrentIdxRaw : firstUpcomingIdx;

  const consultationObj = (consultation ?? {}) as any;
  const consultationDomain = consultationObj.domain ?? '';
  const matchingDiagnoses = useMemo(() => {
    if (!Array.isArray(companyDiagnoses) || !consultationDomain) return [];
    return (companyDiagnoses as any[]).filter((d: any) => d.domain === consultationDomain);
  }, [companyDiagnoses, consultationDomain]);

  const DOC_TYPE_LABELS: Record<string, string> = {
    DIRECTION: '방향 보고서',
    STRATEGY: '전략 보고서',
    FINAL: '최종 보고서',
    REPORT: '보고서',
    SITE_REPORT: '현장 방문 보고서',
    PROPOSAL: '전략 제안서',
    CONTRACT: '계약서',
    CONTRACT_DRAFT: '계약서 초안',
    CONTRACT_FINAL: '최종 계약서',
    INSPECTION: '검수 보고서',
    ETC: '기타',
  };
  const contractDocs = (reports as any[]).filter(
    (r: any) => r.reportType === 'CONTRACT_DRAFT' || r.reportType === 'CONTRACT_FINAL',
  );
  const reportDocs = (reports as any[]).filter(
    (r: any) => r.reportType !== 'CONTRACT_DRAFT' && r.reportType !== 'CONTRACT_FINAL',
  );

  const handleAddSite = () => {
    createConsumerSite.mutate(
      {
        companyId,
        name: siteForm.name,
        siteType: siteForm.siteType,
        address: siteForm.address,
        contractPowerKw: parseFloat(siteForm.contractPowerKw) || undefined,
      },
      {
        onSuccess: (newSite: any) => {
          const consultSiteType =
            siteForm.siteType === 'HEAD' || siteForm.siteType === 'BRANCH' ? siteForm.siteType : 'HEAD';
          createSite.mutate({
            consultationId,
            data: { siteType: consultSiteType, name: siteForm.name, address: siteForm.address },
          });
          setShowSiteForm(false);
          setSiteForm({ name: '', siteType: 'FACTORY', address: '', contractPowerKw: '' });
          toast('success', '사업장이 등록되었습니다');
        },
      },
    );
  };

  const handleLinkExistingSite = (site: any) => {
    const alreadyLinked = (sites as any[]).some((s: any) => s.name === site.name && s.address === site.address);
    if (alreadyLinked) {
      toast('info', '이미 연결된 사업장입니다');
      return;
    }
    const consultSiteType = site.siteType === 'HEAD' || site.siteType === 'BRANCH' ? site.siteType : 'HEAD';
    createSite.mutate(
      { consultationId, data: { siteType: consultSiteType, name: site.name, address: site.address || '' } },
      {
        onSuccess: () => {
          setSelectedConsumerSiteIds((prev) => new Set(prev).add(site.id));
          toast('success', `${site.name} 사업장이 연결되었습니다`);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const c = (consultation ?? {}) as any;
  const status = c.status ?? 'APPLIED';
  const hasSurvey = !!survey && !surveyError;
  const isCompleted = status === 'COMPLETED';
  const isCancelled = status === 'CANCELLED';
  const currentActionType = msCurrentStep?.actionType as string | undefined;
  const msMeta = MILESTONE_META[currentActionType || ''];

  // 방문 일정이 양측 수락(확정)되면 해당 SCHEDULE 마일스톤을 완료 처리해 다음 단계로 진행
  const scheduleMilestone = useMemo(
    () =>
      (milestonesSorted as any[]).find((m: any) => (m.actionType || m.action_type || '').toUpperCase() === 'SCHEDULE'),
    [milestonesSorted],
  );
  const scheduleAccepted = (schedules as any[]).some((s: any) => s.status === 'ACCEPTED' || s.status === 'CONFIRMED');
  const scheduleCompleteTriggered = useRef<number | null>(null);
  useEffect(() => {
    if (
      currentActionType === 'SCHEDULE' &&
      scheduleAccepted &&
      scheduleMilestone &&
      scheduleMilestone.status !== 'COMPLETED' &&
      scheduleCompleteTriggered.current !== scheduleMilestone.id
    ) {
      scheduleCompleteTriggered.current = scheduleMilestone.id;
      completeMilestone.mutate(scheduleMilestone.id);
    }
  }, [currentActionType, scheduleAccepted, scheduleMilestone, completeMilestone]);

  return (
    <div className="flex gap-6 items-start">
      {/* ── 좌측: 진행 허브 ── */}
      <div className="flex-1 min-w-0 space-y-5">
        <Breadcrumb
          items={[
            { label: '통합에너지 컨설팅', path: '/consulting' },
            { label: '프로젝트', path: '/consulting/projects' },
            { label: c.clientCompanyName ? `${c.clientCompanyName} 컨설팅` : '프로젝트 상세' },
          ]}
        />

        {/* 헤더 카드 */}
        <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.08] px-6 py-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-lg font-bold text-white">
                {c.clientCompanyName ? `${c.clientCompanyName} — ${c.domain ?? 'RE100'} 컨설팅` : '컨설팅 프로젝트'}
              </h1>
              <p className="mt-0.5 text-xs text-slate-400">
                {c.consultantName ? `${c.consultantName} 컨설턴트` : '컨설턴트 미배정'}
              </p>
            </div>
            <Badge variant={isCompleted ? 'success' : isCancelled ? 'danger' : 'primary'}>
              {STATUS_LABEL[status] ?? '진행중'}
            </Badge>
          </div>
        </div>

        {/* 진행 단계 — milestone 기반 수평 스텝퍼 */}
        {!isCancelled && (
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">진행 단계</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {!hasMilestones
                    ? '컨설턴트가 프로세스를 시작하면 단계가 표시됩니다'
                    : msDoneCount === steps.length
                      ? '모든 단계가 완료되었습니다'
                      : `${msDoneCount}/${steps.length} 단계 완료`}
                </p>
              </div>
              {hasMilestones && (
                <span className="text-sm font-bold text-primary tabular-nums">
                  {msDoneCount}/{steps.length}
                </span>
              )}
            </div>
            {!hasMilestones ? (
              <div className="px-5 py-8 text-center">
                <Clock size={28} className="mx-auto text-slate-500 mb-2" />
                <p className="text-xs text-slate-400">컨설턴트가 프로세스를 시작하면 단계별 진행이 표시됩니다</p>
              </div>
            ) : (
              <div className="px-5 py-4">
                <div className="flex items-center w-full">
                  {steps.map((s: any, i: number) => {
                    const isLast = i === steps.length - 1;
                    const isActive = s.state === 'action';
                    return (
                      <div key={s.milestoneId} className={cn('flex items-center', isLast ? '' : 'flex-1')}>
                        <div className="flex flex-col items-center gap-1.5 group relative">
                          <span
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-full shrink-0 transition-all',
                              s.state === 'done' && 'bg-emerald-500/20 ring-2 ring-emerald-500/30',
                              isActive && 'bg-primary/20 ring-2 ring-primary/50 shadow-[0_0_12px_rgba(59,130,246,0.3)]',
                              s.state === 'upcoming' && 'bg-white/[0.05] ring-1 ring-white/[0.1]',
                            )}
                          >
                            {s.state === 'done' ? (
                              <CheckCircle2 size={14} className="text-emerald-400" />
                            ) : isActive ? (
                              <span className="text-xs font-bold text-primary tabular-nums">{i + 1}</span>
                            ) : (
                              <span className="text-xs text-slate-600 tabular-nums">{i + 1}</span>
                            )}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] font-medium text-center max-w-[72px] leading-tight',
                              s.state === 'done' && 'text-emerald-300',
                              isActive && 'text-primary',
                              s.state === 'upcoming' && 'text-slate-500',
                            )}
                          >
                            {s.title}
                          </span>
                        </div>
                        {!isLast && (
                          <div className="flex-1 mx-1.5 mt-[-18px]">
                            <div
                              className={cn(
                                'h-0.5 w-full rounded-full',
                                s.state === 'done' ? 'bg-emerald-500/40' : 'bg-white/[0.08]',
                              )}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 현재 단계 상세 — milestone actionType 기반 */}
        {!isCancelled && hasMilestones && msCurrentStep && msMeta && (
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-primary/30 border-l-4 border-l-primary px-5 py-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-primary">
                  STEP {msCurrentIdx + 1} / {steps.length} — {msCurrentStep.title}
                </p>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                    ACTOR_META[msCurrentStep.actor],
                  )}
                >
                  {msCurrentStep.actor} 차례
                </span>
              </div>
              <p className="text-base font-bold text-white">{msMeta.title}</p>
              <p className="mt-1 text-sm text-slate-400">{msMeta.desc}</p>
            </div>

            {/* SURVEY — 설문 작성 / 기존 진단 연동 */}
            {currentActionType === 'SURVEY' && (
              <div className="space-y-3">
                {hasSurvey ? (
                  <div className="space-y-3">
                    <div className="rounded-lg ring-1 ring-amber-500/20 bg-amber-500/5 p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ClipboardList size={14} className="text-amber-400" />
                        <span className="text-xs font-medium text-amber-400">
                          설문 데이터가 있습니다 — 제출하여 다음 단계로 진행하세요
                        </span>
                      </div>
                      <Button
                        size="sm"
                        disabled={createSurvey.isPending}
                        onClick={() => {
                          createSurvey.mutate(
                            {
                              consultationId: Number(id),
                              data: {
                                totalEnergyUsage: (survey as any)?.totalEnergyUsage ?? 0,
                                totalGhgEmission: (survey as any)?.totalGhgEmission ?? 0,
                                exportCountries: (survey as any)?.exportCountries || null,
                                regulations: (survey as any)?.regulations ?? [],
                                sites: (survey as any)?.sites ?? [],
                              },
                            },
                            {
                              onSuccess: () => {
                                useToastStore.getState().addToast({
                                  title: '설문이 제출되었습니다. 다음 단계로 진행합니다.',
                                  variant: 'success',
                                });
                              },
                            },
                          );
                        }}
                      >
                        {createSurvey.isPending ? (
                          <Loader2 size={12} className="animate-spin mr-1" />
                        ) : (
                          <Send size={13} className="mr-1" />
                        )}
                        제출
                      </Button>
                    </div>
                    {matchingDiagnoses.length > 0 && (
                      <>
                        <p className="text-xs text-slate-500">
                          또는 다른 {consultationDomain} 진단을 선택할 수 있습니다.
                        </p>
                        {matchingDiagnoses.map((diag: any) => (
                          <div
                            key={diag.id}
                            className="rounded-lg ring-1 ring-white/[0.08] bg-white/[0.03] p-3 flex items-center justify-between hover:bg-white/[0.06] transition-colors"
                          >
                            <div className="space-y-0.5">
                              <p className="text-xs font-medium text-white">
                                {diag.companyName} — {consultationDomain} 진단
                              </p>
                              <p className="text-[11px] text-slate-500">
                                에너지 {diag.annualEnergyUsage?.toLocaleString() ?? '-'} MWh · 배출{' '}
                                {diag.annualGhgEmission?.toLocaleString() ?? '-'} tCO₂eq
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={createSurvey.isPending}
                              onClick={() => {
                                createSurvey.mutate(
                                  {
                                    consultationId: Number(id),
                                    data: {
                                      totalEnergyUsage: diag.annualEnergyUsage ?? 0,
                                      totalGhgEmission: diag.annualGhgEmission ?? 0,
                                      exportCountries: diag.exportCountries || null,
                                      regulations: [],
                                      sites: [],
                                      diagnosisId: diag.id,
                                    },
                                  },
                                  {
                                    onSuccess: () => {
                                      useToastStore.getState().addToast({
                                        title: '설문이 연동되었습니다. 다음 단계로 진행합니다.',
                                        variant: 'success',
                                      });
                                    },
                                  },
                                );
                              }}
                            >
                              선택
                            </Button>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                ) : matchingDiagnoses.length > 0 ? (
                  <>
                    <p className="text-xs text-slate-400">
                      기존 {consultationDomain} 진단이 있습니다. 선택하거나 새로 작성하세요.
                    </p>
                    <div className="space-y-2">
                      {matchingDiagnoses.map((diag: any) => (
                        <div
                          key={diag.id}
                          className="rounded-lg ring-1 ring-white/[0.08] bg-white/[0.03] p-3 flex items-center justify-between hover:bg-white/[0.06] transition-colors"
                        >
                          <div className="space-y-0.5">
                            <p className="text-xs font-medium text-white">
                              {diag.companyName} — {consultationDomain} 진단
                            </p>
                            <p className="text-[11px] text-slate-500">
                              에너지 {diag.annualEnergyUsage?.toLocaleString() ?? '-'} MWh · 배출{' '}
                              {diag.annualGhgEmission?.toLocaleString() ?? '-'} tCO₂eq
                              {diag.createdAt ? ` · ${new Date(diag.createdAt).toLocaleDateString('ko-KR')}` : ''}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            disabled={createSurvey.isPending}
                            onClick={() => {
                              createSurvey.mutate(
                                {
                                  consultationId: Number(id),
                                  data: {
                                    totalEnergyUsage: diag.annualEnergyUsage ?? 0,
                                    totalGhgEmission: diag.annualGhgEmission ?? 0,
                                    exportCountries: diag.exportCountries || null,
                                    regulations: [],
                                    sites: [],
                                    diagnosisId: diag.id,
                                  },
                                },
                                {
                                  onSuccess: () => {
                                    useToastStore.getState().addToast({
                                      title: '설문이 연동되었습니다. 다음 단계로 진행합니다.',
                                      variant: 'success',
                                    });
                                  },
                                },
                              );
                            }}
                          >
                            {createSurvey.isPending ? (
                              <Loader2 size={12} className="animate-spin mr-1" />
                            ) : (
                              <CheckCircle2 size={13} className="mr-1" />
                            )}
                            선택
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full text-slate-400 hover:text-white"
                      onClick={() => router.push(`/consulting/project/${id}/survey?origin=${origin}`)}
                    >
                      <Plus size={13} className="mr-1" /> 새 설문 작성
                    </Button>
                  </>
                ) : (
                  <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.03] p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList size={14} className="text-slate-500" />
                      <span className="text-xs font-medium text-slate-400">설문 조사</span>
                    </div>
                    <Button size="sm" onClick={() => router.push(`/consulting/project/${id}/survey?origin=${origin}`)}>
                      <ClipboardList size={13} className="mr-1" /> 설문 작성
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* PROSPECT — 사업장 등록 (통합) */}
            {currentActionType === 'PROSPECT' && (
              <div className="space-y-3">
                {/* 기존 수용가 사업장이 있으면 선택 UI */}
                {consumerSites.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-400 font-medium">기존 등록 사업장</p>
                    {consumerSites.map((cs: any) => {
                      const isLinked = (sites as any[]).some(
                        (s: any) => s.name === cs.name && s.address === cs.address,
                      );
                      return (
                        <div
                          key={cs.id}
                          className={cn(
                            'flex items-center justify-between rounded-lg px-3 py-2 ring-1 transition-all',
                            isLinked
                              ? 'bg-emerald-500/[0.06] ring-emerald-500/20'
                              : 'bg-white/[0.03] ring-white/[0.06]',
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <MapPin size={12} className={isLinked ? 'text-emerald-400' : 'text-slate-400'} />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-white">{cs.name}</span>
                                {cs.contractPowerKw && (
                                  <span className="text-[9px] text-slate-500">
                                    {Number(cs.contractPowerKw).toLocaleString()} kW
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500">{cs.address || '주소 미등록'}</p>
                            </div>
                          </div>
                          {isLinked ? (
                            <Badge variant="success" className="text-[9px]">
                              연결됨
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleLinkExistingSite(cs)}
                              disabled={createSite.isPending || (sites as any[]).length > 0}
                            >
                              <Plus size={10} className="mr-1" /> 연결
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 연결된 사업장 (수용가에 없는 컨설팅 전용) */}
                {(sites as any[]).filter(
                  (s: any) => !consumerSites.some((cs: any) => cs.name === s.name && cs.address === s.address),
                ).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-400 font-medium">컨설팅 등록 사업장</p>
                    {(sites as any[])
                      .filter(
                        (s: any) => !consumerSites.some((cs: any) => cs.name === s.name && cs.address === s.address),
                      )
                      .map((s: any) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/[0.06]"
                        >
                          <div className="flex items-center gap-2">
                            <MapPin size={12} className="text-slate-400" />
                            <div>
                              <span className="text-xs text-white">{s.name}</span>
                              <p className="text-[10px] text-slate-500">{s.address}</p>
                            </div>
                          </div>
                          <Badge variant="default" className="text-[9px]">
                            {s.siteType === 'HEAD' ? '본사' : s.siteType === 'BRANCH' ? '지사' : s.siteType}
                          </Badge>
                        </div>
                      ))}
                  </div>
                )}

                {/* 새 사업장 등록 폼 */}
                {showSiteForm && (
                  <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3 space-y-2">
                    <p className="text-[11px] text-slate-400 font-medium mb-1">새 사업장 등록</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="사업장명"
                        value={siteForm.name}
                        onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
                        className="h-8 rounded border border-accent/30 bg-surface-dark px-2 text-xs text-white placeholder:text-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      />
                      <select
                        value={siteForm.siteType}
                        onChange={(e) => setSiteForm({ ...siteForm, siteType: e.target.value })}
                        className="h-8 rounded border border-accent/30 bg-surface-dark px-2 text-xs text-white focus:outline-none"
                      >
                        <option value="FACTORY">공장</option>
                        <option value="OFFICE">사무실/빌딩</option>
                        <option value="WAREHOUSE">창고/물류</option>
                        <option value="RETAIL">매장/상업시설</option>
                        <option value="OTHER">기타</option>
                      </select>
                    </div>
                    <input
                      placeholder="주소"
                      value={siteForm.address}
                      onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })}
                      className="w-full h-8 rounded border border-accent/30 bg-surface-dark px-2 text-xs text-white placeholder:text-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    />
                    <input
                      placeholder="계약전력 (kW)"
                      type="number"
                      value={siteForm.contractPowerKw}
                      onChange={(e) => setSiteForm({ ...siteForm, contractPowerKw: e.target.value })}
                      className="w-full h-8 rounded border border-accent/30 bg-surface-dark px-2 text-xs text-white placeholder:text-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleAddSite}
                        disabled={!siteForm.name || createConsumerSite.isPending}
                      >
                        {createConsumerSite.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
                        등록
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowSiteForm(false)}>
                        취소
                      </Button>
                    </div>
                  </div>
                )}

                {/* 사업장이 하나도 없을 때 */}
                {(sites as any[]).length === 0 && consumerSites.length === 0 && !showSiteForm && (
                  <div className="text-center py-3">
                    <p className="text-xs text-slate-500 mb-2">등록된 사업장이 없습니다</p>
                  </div>
                )}

                {!showSiteForm && (
                  <Button size="sm" variant="ghost" onClick={() => setShowSiteForm(true)}>
                    <Plus size={12} className="mr-1" /> 새 사업장 등록
                  </Button>
                )}

                {/* 사업장이 1개 이상 연결되면 완료 버튼 */}
                {(sites as any[]).length > 0 && prospectMilestone && (
                  <div className="pt-2 border-t border-white/[0.06]">
                    <Button
                      onClick={() => {
                        completeMilestone.mutate(prospectMilestone.id, {
                          onSuccess: () => {
                            toast('success', '사업장 등록이 완료되었습니다. 다음 단계로 진행합니다.');
                            const prospectIdx = milestonesSorted.findIndex((m: any) => m.id === prospectMilestone.id);
                            const nextMs: any = milestonesSorted[prospectIdx + 1];
                            if (nextMs && nextMs.status !== 'COMPLETED' && nextMs.status !== 'STARTED') {
                              startMilestone.mutate(nextMs.id);
                            }
                          },
                          onError: () => toast('error', '단계 완료 처리에 실패했습니다.'),
                        });
                      }}
                      disabled={completeMilestone.isPending}
                      className="w-full"
                    >
                      {completeMilestone.isPending ? (
                        <Loader2 size={12} className="animate-spin mr-1" />
                      ) : (
                        <CheckCircle2 size={14} className="mr-1" />
                      )}
                      사업장 등록 완료 ({(sites as any[]).length}개 등록됨)
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* SCHEDULE — 방문 일정 (컨설턴트 UI 패턴과 동일) */}
            {currentActionType === 'SCHEDULE' &&
              (() => {
                const schList = schedules as any[];
                const hasAccepted = schList.some((s: any) => s.status === 'ACCEPTED' || s.status === 'CONFIRMED');
                const pendingFromConsultant = schList.find(
                  (s: any) =>
                    (s.status === 'REQUESTED' && s.requesterId !== user?.id) ||
                    (s.status === 'RESCHEDULE_REQUESTED' && s.respondentId !== user?.id),
                );
                const scheduleMilestone: any = milestonesSorted.find(
                  (m: any) => (m.actionType || m.action_type || '').toUpperCase() === 'SCHEDULE',
                );
                const SCH_STATUS: Record<string, { label: string; color: string }> = {
                  CONFIRMED: { label: '확정', color: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30' },
                  ACCEPTED: { label: '수락', color: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30' },
                  REQUESTED: { label: '대기', color: 'bg-amber-500/10 text-amber-300 ring-amber-500/30' },
                  CANCELLED: { label: '취소', color: 'bg-red-500/10 text-red-300 ring-red-500/30' },
                  REJECTED: { label: '거절', color: 'bg-red-500/10 text-red-300 ring-red-500/30' },
                  RESCHEDULE_REQUESTED: { label: '재조율', color: 'bg-blue-500/10 text-blue-300 ring-blue-500/30' },
                };
                return (
                  <div className="space-y-4">
                    {/* 상단 액션 버튼 — 컨설턴트 패턴과 동일 */}
                    <div className="flex gap-2 flex-wrap items-center">
                      {!hasAccepted && (
                        <Button size="sm" variant="secondary" onClick={() => setShowBooking(true)}>
                          <Calendar size={13} className="mr-1.5" /> 희망 일정 제안
                        </Button>
                      )}
                      {pendingFromConsultant &&
                        (() => {
                          const isReschedule = pendingFromConsultant.status === 'RESCHEDULE_REQUESTED';
                          const displayDate = isReschedule
                            ? (pendingFromConsultant.proposedDate ?? pendingFromConsultant.scheduledDate)
                            : pendingFromConsultant.scheduledDate;
                          const displayTime = isReschedule
                            ? (pendingFromConsultant.proposedTime ?? pendingFromConsultant.scheduledTime)
                            : pendingFromConsultant.scheduledTime;
                          return (
                            <div className="w-full space-y-3">
                              <div className="rounded-lg bg-primary/5 ring-1 ring-primary/20 px-4 py-3">
                                <p className="text-[11px] text-primary font-medium mb-1.5">
                                  {isReschedule
                                    ? '컨설턴트가 일정을 변경 제안했습니다'
                                    : '컨설턴트가 일정을 제안했습니다'}
                                </p>
                                <div className="flex items-center gap-2">
                                  <Calendar size={14} className="text-primary" />
                                  <span className="text-sm font-bold text-white">
                                    {displayDate} {displayTime}
                                  </span>
                                </div>
                                {isReschedule && pendingFromConsultant.rejectionReason && (
                                  <p className="text-[10px] text-slate-400 mt-1.5">
                                    사유: {pendingFromConsultant.rejectionReason}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() =>
                                    respondToSchedule.mutate(
                                      { scheduleId: pendingFromConsultant.id, data: { action: 'ACCEPT' } },
                                      {
                                        onSuccess: () => {
                                          sendChatMessage.mutate({
                                            consultationId,
                                            content: `[컨설팅] 방문 일정에 동의합니다.\n📅 ${displayDate} (${displayTime})`,
                                          });
                                        },
                                      },
                                    )
                                  }
                                  disabled={respondToSchedule.isPending}
                                >
                                  <CheckCircle2 size={13} className="mr-1.5" /> 이 일정에 동의
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    setRespondingSchedule({ id: pendingFromConsultant.id, action: 'RESCHEDULE' });
                                    setRespondForm({ reason: '', proposedDate: '', proposedTime: '' });
                                  }}
                                >
                                  <Calendar size={13} className="mr-1.5" /> 다른 일정 제안
                                </Button>
                              </div>
                            </div>
                          );
                        })()}
                      {hasAccepted && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-400" />
                          <p className="text-xs text-emerald-400">
                            방문 일정이 확정되었습니다. 컨설턴트의 현장 방문을 준비해주세요.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 일정 변경 요청 폼 */}
                    {respondingSchedule && (
                      <div className="p-3 rounded-lg bg-slate-900/50 ring-1 ring-white/[0.08]">
                        <p className="text-xs font-medium text-white mb-2">다른 일정 제안</p>
                        <textarea
                          className="w-full rounded-md bg-white/[0.04] px-2 py-1.5 text-xs text-white ring-1 ring-white/[0.1] placeholder-slate-500 focus:ring-blue-500/40 resize-none"
                          rows={2}
                          placeholder="사유를 입력하세요 (선택)"
                          value={respondForm.reason}
                          onChange={(e) => setRespondForm((f) => ({ ...f, reason: e.target.value }))}
                        />
                        <div className="flex gap-2 mt-2">
                          <input
                            type="date"
                            className="flex-1 rounded-md bg-white/[0.04] px-2 py-1.5 text-xs text-white ring-1 ring-white/[0.1]"
                            value={respondForm.proposedDate}
                            onChange={(e) => setRespondForm((f) => ({ ...f, proposedDate: e.target.value }))}
                          />
                          <input
                            type="time"
                            className="w-28 rounded-md bg-white/[0.04] px-2 py-1.5 text-xs text-white ring-1 ring-white/[0.1]"
                            value={respondForm.proposedTime}
                            onChange={(e) => setRespondForm((f) => ({ ...f, proposedTime: e.target.value }))}
                          />
                        </div>
                        <div className="flex justify-end gap-1.5 mt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[10px] h-6 px-2"
                            onClick={() => setRespondingSchedule(null)}
                          >
                            취소
                          </Button>
                          <Button
                            size="sm"
                            className="text-[10px] h-6 px-2"
                            disabled={
                              respondToSchedule.isPending || !respondForm.proposedDate || !respondForm.proposedTime
                            }
                            onClick={() => {
                              respondToSchedule.mutate(
                                {
                                  scheduleId: respondingSchedule.id,
                                  data: {
                                    action: 'RESCHEDULE',
                                    reason: respondForm.reason || undefined,
                                    proposedDate: respondForm.proposedDate,
                                    proposedTime: respondForm.proposedTime,
                                  },
                                },
                                {
                                  onSuccess: () => {
                                    setRespondingSchedule(null);
                                    sendChatMessage.mutate({
                                      consultationId,
                                      content: `[컨설팅] 일정 변경을 요청합니다.\n📅 ${respondForm.proposedDate} (${respondForm.proposedTime})${respondForm.reason ? `\n사유: ${respondForm.reason}` : ''}`,
                                    });
                                  },
                                },
                              );
                            }}
                          >
                            {respondToSchedule.isPending && <Loader2 size={10} className="animate-spin mr-0.5" />}
                            일정 변경 요청
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* 하단 일정 조율 이력 — 컨설턴트 패턴과 동일 */}
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">일정 조율 이력</p>
                      {schList.length === 0 ? (
                        <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-6 text-center">
                          <Calendar size={20} className="mx-auto text-slate-600 mb-2" />
                          <p className="text-xs text-slate-400">일정 조율 기록이 없습니다</p>
                          <p className="text-[10px] text-slate-500 mt-1">
                            채팅으로 조율하거나 위 버튼으로 희망 일정을 제안하세요
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {schList.map((sch: any) => {
                            const st = SCH_STATUS[sch.status] ?? {
                              label: sch.status,
                              color: 'bg-white/[0.05] text-slate-400 ring-white/[0.1]',
                            };
                            const isFromMe = sch.requesterId === user?.id;
                            return (
                              <div
                                key={sch.id}
                                className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] px-4 py-3"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <Calendar size={13} className="text-blue-400" />
                                    <span className="text-sm text-white">
                                      {sch.scheduledDate} {sch.scheduledTime}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] text-slate-500">
                                      {isFromMe ? '내가 제안' : '컨설턴트 제안'}
                                    </span>
                                    <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full ring-1', st.color)}>
                                      {st.label}
                                    </span>
                                  </div>
                                </div>
                                {sch.memo && <p className="text-xs text-slate-400">{sch.memo}</p>}
                                {sch.rejectionReason && (
                                  <p className="text-[10px] text-slate-400 mt-1">사유: {sch.rejectionReason}</p>
                                )}
                                {sch.proposedDate && (
                                  <p className="text-[10px] text-blue-400 mt-1">
                                    대안 일정: {sch.proposedDate} {sch.proposedTime}
                                  </p>
                                )}
                                {sch.confirmedAt && (
                                  <p className="text-[10px] text-emerald-400 mt-1">
                                    확정: {new Date(sch.confirmedAt).toLocaleDateString('ko-KR')}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

            {/* NAVIGATE — 현장 방문 진행 중 */}
            {currentActionType === 'NAVIGATE' && (
              <div className="rounded-lg bg-blue-500/5 ring-1 ring-blue-500/20 px-4 py-3 flex items-center gap-2">
                <MapPin size={16} className="text-blue-400 shrink-0" />
                <p className="text-xs text-slate-400">
                  컨설턴트가 현장을 방문하고 있습니다. 완료 후 보고서 작성이 시작됩니다.
                </p>
              </div>
            )}

            {/* CONTRACT — 계약서 */}
            {currentActionType === 'CONTRACT' && (
              <div className="space-y-2">
                {contractDocs.length === 0 ? (
                  <p className="text-xs text-slate-500">아직 계약서가 작성되지 않았습니다</p>
                ) : (
                  contractDocs.map((r: any) => {
                    const isReview = r.status === 'REVIEW';
                    return (
                      <div
                        key={r.id}
                        className={cn(
                          'rounded-lg px-3 py-2.5 ring-1',
                          isReview ? 'bg-amber-500/5 ring-amber-500/20' : 'bg-white/[0.03] ring-white/[0.06]',
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText size={12} className="text-slate-400" />
                            <span className="text-xs text-white">{DOC_TYPE_LABELS[r.reportType] || r.reportType}</span>
                          </div>
                          <Badge
                            variant={
                              r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'warning'
                            }
                            className="text-[9px]"
                          >
                            {r.status === 'APPROVED'
                              ? '승인'
                              : r.status === 'REVIEW'
                                ? '검토중'
                                : r.status === 'REJECTED'
                                  ? '반려'
                                  : '초안'}
                          </Badge>
                        </div>
                        {isReview && (
                          <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => router.push(`/consulting/project/${id}/documents?origin=${origin}`)}
                            >
                              <Eye size={11} className="mr-1" /> 열람
                            </Button>
                            {!isContractStepDone && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 ring-1 ring-emerald-500/30"
                                  onClick={() => {
                                    approveReport.mutate(r.id, {
                                      onSuccess: () =>
                                        toast('success', `${DOC_TYPE_LABELS[r.reportType] || '계약서'}를 승인했습니다`),
                                      onError: () => toast('error', '승인에 실패했습니다'),
                                    });
                                  }}
                                  disabled={approveReport.isPending}
                                >
                                  <CheckCircle2 size={11} className="mr-1" /> 승인
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-400 hover:text-red-300"
                                  onClick={() => setRejectingContractId(r.id)}
                                >
                                  수정 요청
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                        {rejectingContractId === r.id && (
                          <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-2">
                            <input
                              type="text"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="수정 요청 사유를 입력하세요"
                              className="w-full rounded-md bg-[#0d1520] ring-1 ring-white/[0.1] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setRejectingContractId(null);
                                  setRejectReason('');
                                }}
                              >
                                취소
                              </Button>
                              <Button
                                size="sm"
                                className="bg-red-500/10 text-red-300 hover:bg-red-500/20 ring-1 ring-red-500/30"
                                disabled={!rejectReason.trim() || rejectReport.isPending}
                                onClick={() => {
                                  rejectReport.mutate(
                                    { reportId: r.id, reason: rejectReason.trim() },
                                    {
                                      onSuccess: () => {
                                        toast('success', '수정 요청을 보냈습니다');
                                        setRejectingContractId(null);
                                        setRejectReason('');
                                      },
                                      onError: () => toast('error', '수정 요청에 실패했습니다'),
                                    },
                                  );
                                }}
                              >
                                {rejectReport.isPending ? <Loader2 size={11} className="animate-spin mr-1" /> : null}
                                수정 요청 보내기
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* DOCUMENTS — 보고서 단계 */}
            {currentActionType === 'DOCUMENTS' &&
              (() => {
                const REPORT_STAGES = [
                  { type: 'DIRECTION', label: '방향 보고서', desc: '초안 · 현황 정리' },
                  { type: 'STRATEGY', label: '전략 보고서', desc: '분석 · 전략 수립' },
                  { type: 'FINAL', label: '최종 보고서', desc: '최종 산출물' },
                ];
                const reviewCount = reportDocs.filter((r: any) => r.status === 'REVIEW').length;
                const approvedCount = reportDocs.filter((r: any) => r.status === 'APPROVED').length;
                return (
                  <div className="space-y-4">
                    {/* 단계별 현황 카드 */}
                    <div className="flex gap-3">
                      {REPORT_STAGES.map((stage) => {
                        const doc = reportDocs.find((r: any) => r.reportType === stage.type);
                        const status = doc?.status;
                        return (
                          <div
                            key={stage.type}
                            className={cn(
                              'flex-1 rounded-lg ring-1 px-3 py-2.5 text-center transition-all',
                              status === 'APPROVED'
                                ? 'bg-emerald-500/10 ring-emerald-500/30'
                                : status === 'REJECTED'
                                  ? 'bg-red-500/10 ring-red-500/30'
                                  : status === 'REVIEW'
                                    ? 'bg-amber-500/10 ring-amber-500/30'
                                    : status === 'DRAFT'
                                      ? 'bg-blue-500/10 ring-blue-500/30'
                                      : 'bg-white/[0.02] ring-white/[0.06]',
                            )}
                          >
                            <p
                              className={cn(
                                'text-xs font-medium',
                                status === 'APPROVED'
                                  ? 'text-emerald-300'
                                  : status === 'REJECTED'
                                    ? 'text-red-300'
                                    : status === 'REVIEW'
                                      ? 'text-amber-300'
                                      : status === 'DRAFT'
                                        ? 'text-blue-300'
                                        : 'text-slate-400',
                              )}
                            >
                              {stage.label}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{stage.desc}</p>
                            <span
                              className={cn(
                                'text-[10px] mt-1 inline-block',
                                status === 'APPROVED'
                                  ? 'text-emerald-400'
                                  : status === 'REVIEW'
                                    ? 'text-amber-400'
                                    : status === 'REJECTED'
                                      ? 'text-red-400'
                                      : status === 'DRAFT'
                                        ? 'text-blue-400'
                                        : 'text-slate-600',
                              )}
                            >
                              {status === 'APPROVED'
                                ? '승인 완료'
                                : status === 'REVIEW'
                                  ? '검토 요청'
                                  : status === 'REJECTED'
                                    ? '수정 요청'
                                    : status === 'DRAFT'
                                      ? '작성 중'
                                      : '미등록'}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* 검토 요청 배너 + 액션 */}
                    {reviewCount > 0 ? (
                      <div className="rounded-lg bg-amber-500/10 ring-1 ring-amber-500/30 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
                              <FileText size={14} className="text-amber-400" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-amber-300">검토 요청 {reviewCount}건</p>
                              <p className="text-[10px] text-slate-400">컨설턴트가 보고서 검토를 요청했습니다</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => router.push(`/consulting/project/${id}/documents?origin=${origin}`)}
                          >
                            <Eye size={13} className="mr-1.5" /> 보고서 검토하기
                          </Button>
                        </div>
                      </div>
                    ) : reportDocs.length === 0 ? (
                      <div className="rounded-lg bg-blue-500/5 ring-1 ring-blue-500/20 px-4 py-3 flex items-center gap-2">
                        <Clock size={16} className="text-blue-400 shrink-0" />
                        <p className="text-xs text-slate-400">컨설턴트가 보고서를 작성 중입니다</p>
                      </div>
                    ) : approvedCount === reportDocs.length && reportDocs.length > 0 ? (
                      <div className="rounded-lg bg-emerald-500/5 ring-1 ring-emerald-500/20 px-4 py-3 flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                        <p className="text-xs text-emerald-400">모든 보고서가 승인되었습니다</p>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => router.push(`/consulting/project/${id}/documents?origin=${origin}`)}
                      >
                        <Eye size={13} className="mr-1.5" /> 문서 작업실 열기
                      </Button>
                    )}
                  </div>
                );
              })()}

            {/* REVIEW — 보고서 검토 */}
            {currentActionType === 'REVIEW' && (
              <div className="space-y-3">
                {reportDocs.length === 0 ? (
                  <p className="text-xs text-slate-500">아직 제출된 보고서가 없습니다</p>
                ) : (
                  <>
                    {reportDocs.map((r: any) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/[0.06]"
                      >
                        <div className="flex items-center gap-2">
                          <FileText size={12} className="text-slate-400" />
                          <span className="text-xs text-white">{DOC_TYPE_LABELS[r.reportType] || r.reportType}</span>
                        </div>
                        <Badge
                          variant={r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'warning'}
                          className="text-[9px]"
                        >
                          {r.status === 'APPROVED'
                            ? '승인'
                            : r.status === 'REVIEW'
                              ? '검토중'
                              : r.status === 'REJECTED'
                                ? '반려'
                                : '초안'}
                        </Badge>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      onClick={() => router.push(`/consulting/project/${id}/documents?origin=${origin}`)}
                    >
                      <Eye size={13} className="mr-1" /> 보고서 검토하기
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* 모든 단계 완료 */}
        {!isCancelled && hasMilestones && !msCurrentStep && (
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-emerald-500/30 border-l-4 border-l-emerald-500 px-5 py-4">
            <p className="text-xs font-semibold text-emerald-400 mb-2">완료 — 전체 {steps.length}단계 마무리</p>
            <p className="text-base font-bold text-white">모든 단계가 완료되었습니다</p>
            <p className="mt-1 text-sm text-slate-400">컨설팅 프로세스가 완료되었습니다</p>
            <div className="flex items-center gap-3 mt-3">
              <Button size="sm" onClick={() => router.push(`/consulting/project/${id}/review`)}>
                컨설턴트 평가하기 <ArrowRight size={12} className="ml-1" />
              </Button>
              <Button size="sm" onClick={() => router.push('/ppa/trading')}>
                전력거래 시작하기 <ArrowRight size={12} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* milestone 없을 때 대기 상태 */}
        {!isCancelled && !hasMilestones && (
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-primary/30 border-l-4 border-l-primary px-5 py-4">
            <p className="text-xs font-semibold text-primary mb-2">대기 중</p>
            <h2 className="text-base font-bold text-white">컨설턴트 배정을 기다리고 있습니다</h2>
            <p className="text-sm text-slate-400 mt-1">컨설턴트가 배정되면 프로세스가 시작됩니다.</p>
          </div>
        )}

        {/* 컨설팅 정보 */}
        {c.clientCompanyName && (
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5">
            <p className="text-xs text-slate-500 mb-3">컨설팅 정보</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] text-slate-500">고객사</p>
                <p className="text-sm font-medium text-white">{c.clientCompanyName}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">도메인</p>
                <p className="text-sm font-medium text-white">{c.domain}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">신청일</p>
                <p className="text-sm font-medium text-white">
                  {c.appliedAt ? new Date(c.appliedAt).toLocaleDateString('ko-KR') : '-'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">배정일</p>
                <p className="text-sm font-medium text-white">
                  {c.assignedAt ? new Date(c.assignedAt).toLocaleDateString('ko-KR') : '-'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 우측: 조율 채팅 패널 ── */}
      <div className="hidden lg:flex flex-col w-[320px] shrink-0 sticky top-[116px] max-h-[calc(100vh-132px)] rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
        <ChatPanel consultationId={consultationId} className="flex-1" />
      </div>

      {showBooking && (
        <ScheduleBooking
          consultationId={consultationId}
          onClose={() => setShowBooking(false)}
          onComplete={(date, time) => {
            setShowBooking(false);
            sendChatMessage.mutate({
              consultationId,
              content: `[컨설팅] 방문 희망 일정을 제안합니다.\n📅 ${date} (${time})\n부합 확인해주세요.`,
            });
          }}
        />
      )}
    </div>
  );
}
