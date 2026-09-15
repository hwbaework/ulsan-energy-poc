// @ts-nocheck
'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  ArrowUpRight,
  Star,
  Send,
  ChevronLeft,
  ChevronRight,
  FileText,
  Receipt,
  AlertCircle,
  Download,
  MapPin,
  Calendar,
  BarChart3,
  Clock,
  Upload,
  ArrowLeft,
  Loader2,
  Eye,
  Maximize2,
  X,
  File,
  Building2,
  Users,
  Zap,
  Leaf,
  ClipboardCheck,
  Plus,
  ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { cn } from '@/lib/utils';
import { getMaturityGrade } from '@/lib/maturity';
import { useToastStore } from '@/stores/useToastStore';
import {
  useConsultation,
  useMilestones,
  useStartMilestone,
  useCompleteMilestone,
  useCreateSite,
  useProposals,
  useSites,
  useChatMessages,
  useLiveChat,
  useSendChatMessage,
  useReports,
  useApproveReport,
  useRejectReport,
  useSurvey,
  useSchedules,
  useRevisions,
  useCreateSchedule,
  useRespondToSchedule,
  useCancelSchedule,
  useDiagnosesByCompany,
  useCreateSurvey,
} from '@/hooks/consulting/useConsultations';
import { useConsumerSites, useCreateConsumerSite } from '@/hooks/consumer/useConsumer';
import { useAuthStore } from '@/stores/useAuthStore';
import { getDownloadUrl, getViewUrl, uploadReportFile } from '@/api/common/files';
import { useQueryClient } from '@tanstack/react-query';

const TIME_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
const DOC_TYPE_LABELS: Record<string, string> = {
  DIRECTION: '방향 보고서',
  STRATEGY: '전략 보고서',
  FINAL: '최종안',
  REPORT: '보고서',
  SITE_REPORT: '현장 방문 보고서',
  PROPOSAL: '전략 제안서',
  CONTRACT: '계약서',
  CONTRACT_DRAFT: '계약서 초안',
  CONTRACT_FINAL: '최종 계약서',
  INSPECTION: '검수 보고서',
  ETC: '기타',
};

const DOC_STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '초안', color: 'bg-slate-500/10 text-slate-400 ring-slate-500/20' },
  REVIEW: { label: '검토중', color: 'bg-amber-500/10 text-amber-400 ring-amber-500/20' },
  SPC_REVIEW: { label: 'SPC 검수', color: 'bg-violet-500/10 text-violet-400 ring-violet-500/20' },
  APPROVED: { label: '승인', color: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' },
  REJECTED: { label: '반려', color: 'bg-red-500/10 text-red-400 ring-red-500/20' },
};

const REPORT_STAGES = [
  { value: 'DIRECTION', label: '방향 보고서', desc: '초안 · 방향 설정', order: 1 },
  { value: 'STRATEGY', label: '전략 보고서', desc: '중간 · 전략 수립', order: 2 },
  { value: 'FINAL', label: '최종 보고서', desc: '최종 산출물', order: 3 },
];

const ACTOR_META: Record<string, string> = {
  수용가: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
  컨설턴트: 'bg-blue-500/10 text-blue-300 ring-blue-500/30',
  양측: 'bg-violet-500/10 text-violet-300 ring-violet-500/30',
};

const DOMAIN_LABEL: Record<string, string> = {
  RE100: 'RE100',
  CARBON_REDUCTION: '탄소감축',
  DISTRIBUTED_ENERGY: '분산에너지',
  PPA: 'PPA',
  ESG: 'ESG',
};

/* ── ScheduleBooking (project에서 이식) ───────────────────── */
function ScheduleBooking({
  consultationId,
  onClose,
  onComplete,
}: {
  consultationId: number;
  onClose: () => void;
  onComplete: (date: string, time: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [memo, setMemo] = useState('');
  const createSchedule = useCreateSchedule();
  const today = new Date();
  const minDate = new Date(today.getTime() + 86400000).toISOString().split('T')[0];
  const VISIT_TIME_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  const handleSubmit = () => {
    if (!selectedDate || !selectedTime) return;
    createSchedule.mutate(
      { consultationId, data: { scheduledDate: selectedDate, scheduledTime: selectedTime, memo: memo || undefined } },
      {
        onSuccess: () => {
          onComplete(selectedDate, selectedTime);
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
            <X size={14} />
          </button>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              희망하시는 방문 날짜와 시간을 선택하세요. 컨설턴트가 확인 후 채팅에서 확정합니다.
            </p>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">방문 날짜</label>
              <input
                type="date"
                min={minDate}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded-lg bg-[#0d1520] ring-1 ring-white/[0.1] px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">방문 시간</label>
              <div className="grid grid-cols-3 gap-2">
                {VISIT_TIME_SLOTS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTime(t)}
                    className={cn(
                      'rounded-lg py-2.5 text-sm font-medium ring-1 transition-colors tabular-nums',
                      selectedTime === t
                        ? 'bg-[#0d1520] text-white ring-primary/60'
                        : 'bg-[#0d1520] text-slate-300 ring-white/[0.08] hover:ring-white/[0.2]',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              label="메모 (선택)"
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="예: 주차장 위치 안내 부탁드립니다"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-white/[0.06] px-6 py-4">
          <Button variant="secondary" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button
            size="sm"
            disabled={!selectedDate || !selectedTime || createSchedule.isPending}
            onClick={handleSubmit}
          >
            {createSchedule.isPending ? (
              <Loader2 size={12} className="animate-spin mr-1" />
            ) : (
              <Calendar size={14} className="mr-1.5" />
            )}
            이 일정으로 요청
          </Button>
        </div>
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  APPLIED: '신청됨',
  ASSIGNED: '배정됨',
  DRAFTING: '진행 중',
  IN_PROGRESS: '진행 중',
  REVIEW: '검수 중',
  COMPLETED: '완료',
  CANCELLED: '취소',
  PENDING: '대기',
  STARTED: '진행 중',
};

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
  const at = (m.actionType || m.action_type || '').toUpperCase();
  const title = m.title || '';
  const actorByTitle =
    title.includes('설문') || title.includes('사업장')
      ? '수용가'
      : title.includes('일정')
        ? '양측'
        : title.includes('방문') || title.includes('보고서')
          ? '컨설턴트'
          : '양측';
  return {
    title: m.title,
    actionType: at,
    actor: actorMap[at] || actorByTitle,
    state: stateMap[m.status] || 'upcoming',
    date: m.completedDate || m.dueDate || '',
    desc: m.description || m.title,
    milestoneId: m.id,
  };
}

function apiToDetail(consultation: any, milestones: any[], proposals: any[], sites: any[]) {
  const domain = DOMAIN_LABEL[consultation.domain] || consultation.domain || '';
  const acceptedProposal = proposals.find((p: any) => p.status === 'ACCEPTED');
  const isUnassigned = !consultation.consultantName || consultation.status === 'APPLIED';
  const hasMilestones = milestones.length > 0;
  const steps = hasMilestones
    ? milestones.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map(milestoneToStep)
    : [];

  const currentStep = steps.find((s) => s.state === 'action');
  const currentMilestone = milestones.find((m: any) => m.status === 'STARTED' || m.status === 'IN_PROGRESS');

  function resolveActionKind(): string {
    if (consultation.status === 'COMPLETED') return 'done';
    if (!currentMilestone) return 'wait';
    const at = (currentMilestone.actionType || currentMilestone.action_type || '').toUpperCase();
    if (at === 'SURVEY') return 'survey';
    if (at === 'PROSPECT') return 'site';
    if (at === 'SCHEDULE') return 'schedule';
    if (at === 'REVIEW') return 'review';
    if (at === 'NAVIGATE') return 'wait';
    if (at === 'DOCUMENTS') return 'documents';
    if (at === 'CONTRACT') return 'contract';
    const title = currentMilestone.title || '';
    if (title.includes('설문') || title.includes('자료 수집')) return 'survey';
    if (title.includes('사업장')) return 'site';
    if (title.includes('일정')) return 'schedule';
    if (title.includes('검수')) return 'review';
    if (title.includes('방문') || title.includes('실사')) return 'wait';
    if (title.includes('보고서') || title.includes('초안') || title.includes('최종 보고')) return 'wait';
    if (title.includes('계약')) return 'wait';
    return 'wait';
  }

  return {
    id: consultation.id,
    title: `${domain} 컨설팅`,
    domain,
    status: consultation.status,
    origin: consultation.origin || 'marketplace',
    isUnassigned,
    consultant: consultation.consultantName || '미배정',
    consultantInitial: consultation.consultantName ? consultation.consultantName[0] : '?',
    rating: 0,
    client: consultation.clientCompanyName || '',
    contractAmount: acceptedProposal?.estimatedCost ?? 0,
    duration: acceptedProposal?.estimatedDuration ?? '',
    startedAt: consultation.assignedAt ? new Date(consultation.assignedAt).toLocaleDateString('ko-KR') : '',
    expectedEnd: '',
    sites: sites.map((s: any) => ({ name: s.name || s.siteName || '', address: s.address || '' })),
    diagnosis: {
      grade: consultation.maturityGrade || getMaturityGrade(consultation.currentRePercent ?? 0),
      currentRE: consultation.currentRePercent ?? 0,
      targetRE: 0,
    },
    hasMilestones,
    steps,
    action: (() => {
      const kind = hasMilestones ? resolveActionKind() : 'no-milestones';
      if (!hasMilestones)
        return {
          headline: '컨설팅 프로세스 대기 중',
          desc: '컨설턴트가 프로세스를 시작하면 단계별 진행이 가능합니다',
          kind,
          branchNote: '',
        };
      if (kind === 'documents') {
        return {
          headline: '보고서 검토',
          desc: '컨설턴트가 제출한 보고서를 검토하고 승인 또는 반려하세요. 모든 핵심 보고서가 승인되면 다음 단계로 진행됩니다.',
          kind,
          branchNote: '',
        };
      }
      if (kind === 'contract') {
        return {
          headline: 'PPA 계약 검토',
          desc: '컨설턴트가 업로드한 계약서 초안을 검토하고 승인 또는 반려하세요.',
          kind,
          branchNote: '',
        };
      }
      if (kind === 'wait' && currentMilestone) {
        const t = currentMilestone.title || '';
        if (t.includes('방문') || t.includes('실사'))
          return {
            headline: '현장 방문·실사 진행 중',
            desc: '컨설턴트가 사업장을 방문하여 현황을 파악하고 있습니다.',
            kind,
            branchNote: '',
          };
        if (t.includes('계약'))
          return { headline: '계약 진행 중', desc: '컨설턴트가 계약서를 준비하고 있습니다.', kind, branchNote: '' };
      }
      return {
        headline: currentStep ? `${currentStep.title}` : '진행 상태를 확인하세요',
        desc: STATUS_LABEL[consultation.status] || consultation.status,
        kind,
        branchNote: '',
      };
    })(),
    firstProposal: acceptedProposal
      ? {
          source: '마켓플레이스',
          receivedAt: new Date(acceptedProposal.createdAt).toLocaleDateString('ko-KR'),
          acceptedAt: new Date(acceptedProposal.updatedAt).toLocaleDateString('ko-KR'),
          cost: acceptedProposal.estimatedCost ?? 0,
          duration: acceptedProposal.estimatedDuration ?? '',
          message: acceptedProposal.coverLetter ?? '',
          scope:
            typeof acceptedProposal.proposedScope === 'string'
              ? [acceptedProposal.proposedScope]
              : Array.isArray(acceptedProposal.proposedScope)
                ? acceptedProposal.proposedScope
                : [],
        }
      : null,
    chatSeed: [],
    _isApi: true,
  };
}

export default function ConsultingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToastStore((s) => s.add);

  const id = Number(params?.id);

  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? 0;
  const queryClient = useQueryClient();

  const { data: apiConsultation, isLoading: loadingConsultation, isError: errorConsultation } = useConsultation(id);
  const { data: apiMilestones = [] } = useMilestones(id);
  const { data: apiProposals = [] } = useProposals(id);
  const { data: apiSites = [] } = useSites(id);
  const { connected: chatConnected } = useLiveChat(id);
  const { data: apiChatMessages = [] } = useChatMessages(id, chatConnected);
  const { data: apiReports = [] } = useReports(id);
  const { data: apiSurvey } = useSurvey(id);
  const { data: apiSchedules = [] } = useSchedules(id);
  const { data: apiRevisions = [] } = useRevisions(id);
  const { data: companyDiagnosesData = [] } = useDiagnosesByCompany(companyId);
  const { data: consumerSitesData } = useConsumerSites({ companyId });
  const consumerSites = (consumerSitesData as any)?.content ?? [];
  const sendChatMutation = useSendChatMessage();
  const startMilestoneMut = useStartMilestone();
  const completeMilestoneMut = useCompleteMilestone();
  const createSiteMut = useCreateSite();
  const createConsumerSiteMut = useCreateConsumerSite();
  const approveReportMut = useApproveReport();
  const rejectReportMut = useRejectReport();
  const createSurveyMut = useCreateSurvey();
  const respondToScheduleMut = useRespondToSchedule();
  const cancelScheduleMut = useCancelSchedule();

  const milestonesSorted = useMemo(() => {
    const ms = Array.isArray(apiMilestones) ? apiMilestones : [];
    return [...ms].sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [apiMilestones]);

  const currentMilestone = useMemo(() => {
    return milestonesSorted.find((m: any) => m.status === 'STARTED' || m.status === 'IN_PROGRESS') ?? null;
  }, [milestonesSorted]);

  const isDocsStepDone = useMemo(() => {
    const dm = milestonesSorted.find((m: any) => (m.actionType || m.action_type || '').toUpperCase() === 'DOCUMENTS');
    return dm?.status === 'COMPLETED';
  }, [milestonesSorted]);
  const isContractStepDone = useMemo(() => {
    const cm = milestonesSorted.find((m: any) => (m.actionType || m.action_type || '').toUpperCase() === 'CONTRACT');
    return cm?.status === 'COMPLETED';
  }, [milestonesSorted]);

  const advanceMilestone = async () => {
    if (!currentMilestone) return;
    try {
      await completeMilestoneMut.mutateAsync(currentMilestone.id);
      const nextIdx = milestonesSorted.findIndex((m: any) => m.id === currentMilestone.id) + 1;
      const next = milestonesSorted[nextIdx];
      if (next) {
        await startMilestoneMut.mutateAsync(next.id);
      }
    } catch {
      /* handled by toast in caller */
    }
  };

  const c = useMemo(() => {
    if (!apiConsultation || typeof apiConsultation !== 'object' || !('id' in apiConsultation)) return null;
    return apiToDetail(
      apiConsultation,
      Array.isArray(apiMilestones) ? apiMilestones : [],
      Array.isArray(apiProposals) ? apiProposals : [],
      Array.isArray(apiSites) ? apiSites : [],
    );
  }, [apiConsultation, apiMilestones, apiProposals, apiSites]);

  // 방문 일정 잡기 — 수용가가 직접 날짜·시간 선택 (날짜 picker = < > 화살표 규칙)
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrowStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const [visitDate, setVisitDate] = useState(tomorrowStr);
  const [visitTime, setVisitTime] = useState<string | null>(null);
  const [visitMemo, setVisitMemo] = useState('');
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
  const VISIT_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  const TODAY = todayStr;
  const shiftVisitDate = (delta: number) => {
    const [y, m, d] = visitDate.split('-').map(Number);
    const nd = new Date(y, m - 1, d + delta);
    const next = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-${String(nd.getDate()).padStart(2, '0')}`;
    if (next < TODAY) return; // 과거 불가
    setVisitDate(next);
  };
  const visitWeekday = (() => {
    const [y, m, d] = visitDate.split('-').map(Number);
    return WEEKDAYS[new Date(y, m - 1, d).getDay()];
  })();

  // SCHEDULE — 실시간 일정 조율
  const [showBooking, setShowBooking] = useState(false);
  const [respondingSchedule, setRespondingSchedule] = useState<{ id: number; action: 'REJECT' | 'RESCHEDULE' } | null>(
    null,
  );
  const [respondForm, setRespondForm] = useState({ reason: '', proposedDate: '', proposedTime: '' });

  // 단계 검토 · 1차 제안 팝업
  const [stepView, setStepView] = useState<any>(null);
  const [selectedSite, setSelectedSite] = useState<any>(null);
  const [proposalView, setProposalView] = useState(false);

  // 단계별 액션 팝업 (설문 제출 · 사업장 등록 · 검수 · 반려)
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [surveyFiles, setSurveyFiles] = useState<File[]>([]);
  const [surveyUploading, setSurveyUploading] = useState(false);
  const surveyFileRef = useRef<HTMLInputElement>(null);
  const [siteOpen, setSiteOpen] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [siteType, setSiteType] = useState('FACTORY');
  const [siteContractPower, setSiteContractPower] = useState('');
  const [siteFloorArea, setSiteFloorArea] = useState('');
  const [siteBuildingType, setSiteBuildingType] = useState('');
  const [siteMemo, setSiteMemo] = useState('');
  const SITE_TYPES = [
    { value: 'FACTORY', label: '공장' },
    { value: 'OFFICE', label: '사무실/빌딩' },
    { value: 'RETAIL', label: '매점/상업시설' },
    { value: 'WAREHOUSE', label: '창고/물류' },
    { value: 'OTHER', label: '기타' },
  ];
  const [reviewOpen, setReviewOpen] = useState(false);
  const REVIEW_ITEMS = ['계약 범위 4항목 충족', '보고서 분량·품질 적정', '권고안 실행 가능성', '데이터·근거 출처 명시'];
  const [reviewChecks, setReviewChecks] = useState<boolean[]>([false, false, false, false]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [docPreview, setDocPreview] = useState<any>(null); // 문서 미리보기
  const [taxOpen, setTaxOpen] = useState(false); // 세금계산서 (정산과 별개)
  const [docsOpen, setDocsOpen] = useState(false);
  const [docsMode, setDocsMode] = useState<'reports' | 'contracts'>('reports');
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [reportRejectTarget, setReportRejectTarget] = useState<any>(null);
  const [reportRejectReason, setReportRejectReason] = useState('');
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfFullscreen, setPdfFullscreen] = useState(false);
  const pdfBlobRef = useRef<string | null>(null);

  const consultationDomain = (apiConsultation as any)?.domain ?? '';
  const companyDiagnoses = Array.isArray(companyDiagnosesData) ? companyDiagnosesData : [];
  const matchingDiagnoses = useMemo(() => {
    if (!consultationDomain || companyDiagnoses.length === 0) return [];
    const matched = companyDiagnoses.filter((d: any) => !d.domain || d.domain === consultationDomain);
    if (matched.length === 0) return [];
    // 가장 최근 진단 1건만 노출 (createdAt 우선, 없으면 id 기준)
    const latest = matched.reduce((a: any, b: any) => {
      const ta = new Date(a.createdAt ?? 0).getTime() || a.id || 0;
      const tb = new Date(b.createdAt ?? 0).getTime() || b.id || 0;
      return tb > ta ? b : a;
    });
    return [latest];
  }, [companyDiagnoses, consultationDomain]);
  const hasSurvey = !!(
    apiSurvey &&
    typeof apiSurvey === 'object' &&
    ('totalEnergyUsage' in (apiSurvey as any) || 'id' in (apiSurvey as any))
  );

  const prospectMilestone = useMemo(
    () => milestonesSorted.find((m: any) => (m.actionType || m.action_type || '').toUpperCase() === 'PROSPECT'),
    [milestonesSorted],
  );

  const reports = useMemo(
    () =>
      (apiReports as any[])
        .filter((r: any) => r.reportType !== 'CONTRACT_DRAFT' && r.reportType !== 'CONTRACT_FINAL')
        .map((r: any) => ({
          id: r.id,
          name: r.fileName || DOC_TYPE_LABELS[r.reportType] || r.reportType || '문서',
          type: r.reportType ?? 'ETC',
          fileId: r.fileId ?? null,
          fileSize: r.fileSize ?? null,
          authorName: r.authorName,
          uploadedAt: r.updatedAt ?? r.createdAt,
          status: r.status,
          version: r.version ?? 1,
        })),
    [apiReports],
  );

  const contractDocs = useMemo(
    () =>
      (apiReports as any[])
        .filter((r: any) => r.reportType === 'CONTRACT_DRAFT' || r.reportType === 'CONTRACT_FINAL')
        .map((r: any) => ({
          id: r.id,
          name: r.fileName || DOC_TYPE_LABELS[r.reportType] || r.reportType || '계약서',
          type: r.reportType ?? 'CONTRACT',
          fileId: r.fileId ?? null,
          fileSize: r.fileSize ?? null,
          authorName: r.authorName,
          uploadedAt: r.updatedAt ?? r.createdAt,
          status: r.status,
          version: r.version ?? 1,
        })),
    [apiReports],
  );

  useEffect(() => {
    pdfBlobRef.current = pdfBlobUrl;
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  function openReportsModal(doc?: any) {
    setDocsMode('reports');
    setDocsOpen(true);
    if (doc) handleSelectDoc(doc);
  }

  function openContractsModal(doc?: any) {
    setDocsMode('contracts');
    setDocsOpen(true);
    if (doc) handleSelectDoc(doc);
  }

  const handleSelectDoc = useCallback(
    async (doc: any) => {
      if (!doc.fileId) {
        toast('info', '파일이 아직 첨부되지 않은 문서입니다');
        return;
      }
      setSelectedDoc(doc);
      setPdfFullscreen(false);
      if (pdfBlobRef.current) {
        URL.revokeObjectURL(pdfBlobRef.current);
        setPdfBlobUrl(null);
      }
      setPdfLoading(true);
      try {
        const res = await fetch(getViewUrl(doc.fileId), { credentials: 'include' });
        if (!res.ok) throw new Error(`${res.status}`);
        const blob = await res.blob();
        setPdfBlobUrl(URL.createObjectURL(blob));
      } catch {
        toast('error', 'PDF를 불러올 수 없습니다');
        setPdfBlobUrl(null);
      } finally {
        setPdfLoading(false);
      }
    },
    [toast],
  );

  const messages = useMemo(() => {
    const raw = Array.isArray(apiChatMessages) ? apiChatMessages : ((apiChatMessages as any)?.content ?? []);
    if (raw.length === 0) return [];
    const sorted = [...raw].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return sorted.map((m: any, i: number) => ({
      id: m.id ?? i,
      from: m._optimistic || (user?.id != null && Number(m.senderId) === Number(user.id)) ? 'me' : 'other',
      senderName: m.senderName ?? '',
      text: m.content ?? m.message ?? '',
      time: m.createdAt
        ? new Date(m.createdAt).toLocaleString('ko-KR', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '',
    }));
  }, [apiChatMessages, user?.id]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendMessage = () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput('');
    sendChatMutation.mutate({ consultationId: id, content: text });
  };

  const confirmVisit = () => {
    if (!visitTime?.trim()) return;
    const memo = visitMemo.trim() ? ` (요청: ${visitMemo.trim()})` : '';
    const msg = `${visitDate} (${visitWeekday}) ${visitTime} 방문 가능합니다. 확정 부탁드립니다.${memo}`;
    sendChatMutation.mutate({ consultationId: id, content: msg });
    toast('success', '희망 방문 일정을 컨설턴트에게 전달했습니다 — 컨설턴트가 확정하면 다음 단계로 진행됩니다');
    setVisitModalOpen(false);
    setVisitTime(null);
    setVisitMemo('');
  };

  const confirmReject = () => {
    const reason = rejectReason.trim();
    if (!reason) return;
    const msg = `보고서를 반려합니다. 사유: ${reason} — 조율 후 재작성 부탁드립니다.`;
    sendChatMutation.mutate({ consultationId: id, content: msg });
    toast('info', '보고서를 반려했습니다 — 채팅으로 컨설턴트와 조율됩니다');
    setRejectOpen(false);
    setRejectReason('');
  };

  if (loadingConsultation) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (!c) {
    return (
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: '통합에너지 컨설팅', path: '/consulting' },
            { label: '내 컨설팅', path: '/consulting/status' },
            { label: '없음' },
          ]}
        />
        <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.08] px-6 py-10 text-center">
          <p className="text-sm text-slate-400">해당 컨설팅을 찾을 수 없습니다.</p>
          <Button size="sm" variant="secondary" className="mt-4" onClick={() => router.push('/consulting/status')}>
            <ChevronLeft size={14} className="mr-1" /> 내 컨설팅 목록
          </Button>
        </div>
      </div>
    );
  }

  const doneCount = c.steps.filter((s) => s.state === 'done').length;
  const currentIdx = c.steps.findIndex((s) => s.state === 'action');
  const current = c.steps[currentIdx];

  // ── 미배정 상태: 컨설턴트 배정 안내 ──
  if (c.isUnassigned) {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => router.push('/consulting/status')}
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft size={16} /> 목록으로
          </button>
          <span className="text-slate-600">/</span>
          <Breadcrumb
            items={[
              { label: '통합에너지 컨설팅', path: '/consulting' },
              { label: '내 컨설팅', path: '/consulting/status' },
              { label: c.title },
            ]}
          />
        </div>

        {/* 헤더 */}
        <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.08] px-6 py-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-lg font-bold text-white">{c.title}</h1>
              <p className="mt-0.5 text-xs text-slate-400">컨설턴트 미배정</p>
            </div>
            <Badge variant="info">신청 완료</Badge>
          </div>
          {c.sites.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs border-t border-white/[0.06] pt-3">
              <MapPin size={12} className="text-slate-500 shrink-0" />
              <span className="text-slate-500">사업장</span>
              <span className="text-white">
                {c.client} · {c.sites.map((s) => s.name).join(' · ')}
              </span>
            </div>
          )}
        </div>

        {/* 컨설턴트 배정 안내 */}
        <div className="rounded-xl bg-[#0d1520] ring-1 ring-amber-500/30 border-l-4 border-l-amber-500 px-6 py-5 space-y-4">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-300 shrink-0" />
            <p className="text-base font-bold text-white">컨설턴트 배정 대기 중</p>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            컨설팅 신청이 완료되었습니다. 아래 방법으로 컨설턴트를 배정받을 수 있습니다.
          </p>

          <div className="space-y-3">
            {/* 방법 1: 마켓플레이스 */}
            <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-3.5">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0 mt-0.5">
                  1
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">마켓플레이스에서 컨설턴트 선택</p>
                  <p className="text-xs text-slate-400 mt-1">
                    검증된 컨설턴트 프로필을 비교하고, 원하는 컨설턴트에게 직접 제안을 요청하세요.
                  </p>
                  <Button
                    size="sm"
                    variant="primary"
                    className="mt-3"
                    onClick={() => router.push('/consulting/marketplace')}
                  >
                    <ArrowUpRight size={13} className="mr-1" /> 마켓플레이스 둘러보기
                  </Button>
                </div>
              </div>
            </div>

            {/* 방법 2: 자동 매칭 대기 */}
            <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-3.5">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold shrink-0 mt-0.5">
                  2
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">플랫폼 자동 매칭 대기</p>
                  <p className="text-xs text-slate-400 mt-1">
                    신청 내용을 바탕으로 적합한 컨설턴트가 자동으로 배정됩니다. 배정 시 알림을 보내드립니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 방법 3: 무료 진단 */}
            <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-3.5">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold shrink-0 mt-0.5">
                  3
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">무료 진단으로 시작하기</p>
                  <p className="text-xs text-slate-400 mt-1">
                    아직 어떤 컨설팅이 필요한지 잘 모르겠다면, 무료 진단을 먼저 받아보세요. 진단 결과를 바탕으로 맞춤
                    컨설턴트를 추천해드립니다.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    onClick={() => router.push('/consulting/diagnosis')}
                  >
                    <BarChart3 size={13} className="mr-1" /> 무료 진단 받기
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 컨설팅 정보 */}
        <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.08] px-6 py-4">
          <p className="text-xs font-semibold text-slate-300 mb-3">컨설팅 정보</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <p className="text-[11px] text-slate-500">도메인</p>
              <p className="text-white mt-0.5">{c.domain}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">상태</p>
              <p className="text-amber-300 mt-0.5">{STATUS_LABEL[c.status] || c.status}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6 items-start">
      {/* ── 좌측: 진행 허브 ── */}
      <div className="flex-1 min-w-0 space-y-5">
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => router.push('/consulting/status')}
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft size={16} /> 목록으로
          </button>
          <span className="text-slate-600">/</span>
          <Breadcrumb
            items={[
              { label: '통합에너지 컨설팅', path: '/consulting' },
              { label: '내 컨설팅', path: '/consulting/status' },
              { label: c.title },
            ]}
          />
        </div>

        {/* 헤더 카드 — 제목·계약·사업장·진단을 한 곳에 */}
        <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.08] px-6 py-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-lg font-bold text-white">{c.title}</h1>
              <p className="mt-0.5 text-xs text-slate-400">
                {c.consultant} 컨설턴트
                <span className="inline-flex items-center gap-0.5 text-amber-300 ml-1">
                  <Star size={10} className="fill-amber-300" />
                  {c.rating}
                </span>
                <span className="text-slate-600"> · </span>
                계약 ₩{c.contractAmount.toLocaleString()} · {c.duration} · {c.startedAt} ~ {c.expectedEnd}
              </p>
            </div>
            <Badge variant="warning">{current?.title ?? '진행 중'}</Badge>
          </div>
          {/* 사업장 + 기준 진단 한 줄 */}
          <div className="flex items-center gap-x-5 gap-y-2 flex-wrap text-xs border-t border-white/[0.06] pt-3">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={12} className="text-slate-500 shrink-0" />
              <span className="text-slate-500">사업장</span>
              <span className="text-white">
                {c.client} · {c.sites.map((s) => s.name.replace('한일튜브 ', '')).join(' · ')}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BarChart3 size={12} className="text-slate-500 shrink-0" />
              <span className="text-slate-500">기준 진단</span>
              <span className="text-rose-400 font-bold">{c.diagnosis.grade}등급</span>
              <span className="text-white tabular-nums">
                RE {c.diagnosis.currentRE}% → {c.diagnosis.targetRE}%
              </span>
            </span>
          </div>
        </div>

        {/* 진행 단계 — 수평 스텝퍼 (직관적 프로세스 표시) */}
        <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.08] overflow-hidden">
          <div className="px-6 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <div>
              <h3 className="text-md font-semibold text-white">진행 단계</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {!c.hasMilestones
                  ? '컨설턴트가 프로세스를 시작하면 단계가 표시됩니다'
                  : doneCount === c.steps.length
                    ? '모든 단계가 완료되었습니다'
                    : `${doneCount}/${c.steps.length} 단계 완료`}
              </p>
            </div>
            {c.hasMilestones && (
              <span className="text-sm font-bold text-primary tabular-nums">
                {doneCount}/{c.steps.length}
              </span>
            )}
          </div>
          {/* 수평 스텝퍼 */}
          {!c.hasMilestones ? (
            <div className="px-6 py-8 text-center">
              <Clock size={32} className="mx-auto text-slate-500 mb-3" />
              <p className="text-sm text-slate-400">컨설턴트가 컨설팅 프로세스를 시작하면</p>
              <p className="text-sm text-slate-400">6단계 진행 현황이 여기에 표시됩니다.</p>
            </div>
          ) : (
            <div className="px-6 py-5">
              <div className="flex items-center w-full">
                {c.steps.map((s, i) => {
                  const isLast = i === c.steps.length - 1;
                  const isActive = s.state === 'action';
                  return (
                    <div key={s.title} className={cn('flex items-center', isLast ? '' : 'flex-1')}>
                      <button
                        type="button"
                        onClick={() => setStepView(s)}
                        className="flex flex-col items-center gap-1.5 group relative"
                      >
                        <span
                          className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-full shrink-0 transition-all',
                            s.state === 'done' && 'bg-emerald-500/20 ring-2 ring-emerald-500/30',
                            isActive && 'bg-primary/20 ring-2 ring-primary/50 shadow-[0_0_12px_rgba(59,130,246,0.3)]',
                            s.state === 'upcoming' && 'bg-white/[0.05] ring-1 ring-white/[0.1]',
                          )}
                        >
                          {s.state === 'done' ? (
                            <CheckCircle2 size={16} className="text-emerald-400" />
                          ) : isActive ? (
                            <span className="text-xs font-bold text-primary tabular-nums">{i + 1}</span>
                          ) : (
                            <span className="text-xs text-slate-600 tabular-nums">{i + 1}</span>
                          )}
                        </span>
                        <span
                          className={cn(
                            'text-[11px] font-medium text-center max-w-[80px] leading-tight',
                            s.state === 'done' && 'text-emerald-300',
                            isActive && 'text-primary',
                            s.state === 'upcoming' && 'text-slate-500',
                          )}
                        >
                          {s.title}
                        </span>
                        {s.date && <span className="text-[9px] text-slate-600 tabular-nums">{s.date}</span>}
                      </button>
                      {!isLast && (
                        <div className="flex-1 mx-2 mt-[-20px]">
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

        {/* 현재 단계 상세 + 액션 */}
        <div className="rounded-xl bg-[#0d1520] ring-1 ring-primary/30 border-l-4 border-l-primary px-6 py-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-primary">
              {current
                ? `STEP ${currentIdx + 1} / ${c.steps.length} — ${current.title}`
                : `완료 — 전체 ${c.steps.length}단계 마무리`}
            </p>
            {current && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                  ACTOR_META[current.actor],
                )}
              >
                {current.actor} 차례
              </span>
            )}
          </div>
          <p className="text-base font-bold text-white">{c.action.headline}</p>
          <p className="mt-1.5 text-sm text-slate-400">{c.action.desc}</p>
          <div className="mt-4 flex gap-2 flex-wrap items-center">
            {c.action.kind === 'report' && (
              <>
                <Button size="sm" variant="secondary" onClick={() => openReportsModal()}>
                  <FileText size={13} className="mr-1.5" /> 보고서 보기
                </Button>
                <Button size="sm" variant="primary" onClick={() => router.push('/consulting/settlement')}>
                  <Receipt size={13} className="mr-1.5" /> 동의·정산 확인
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRejectOpen(true)}>
                  <AlertCircle size={13} className="mr-1.5" /> 반려
                </Button>
              </>
            )}
            {c.action.kind === 'schedule' &&
              (() => {
                const schList = Array.isArray(apiSchedules) ? (apiSchedules as any[]) : [];
                // 턴제 일정 조율: active 1건 기준, 마지막 행동자(lastActor)가 아닌 쪽만 응답 가능
                const accepted = schList.find((s: any) => s.status === 'ACCEPTED' || s.status === 'CONFIRMED');
                const actives = schList.filter(
                  (s: any) => s.status === 'REQUESTED' || s.status === 'RESCHEDULE_REQUESTED',
                );
                const active = actives.length ? [...actives].sort((a: any, b: any) => b.id - a.id)[0] : null;
                const lastActor = active
                  ? active.status === 'RESCHEDULE_REQUESTED'
                    ? active.respondentId
                    : active.requesterId
                  : null;
                const myTurn = !!active && lastActor !== user?.id; // 상대가 제안 → 내가 응답할 차례
                const waiting = !!active && lastActor === user?.id; // 내가 제안 → 상대 응답 대기
                const activeDate = active
                  ? active.status === 'RESCHEDULE_REQUESTED'
                    ? (active.proposedDate ?? active.scheduledDate)
                    : active.scheduledDate
                  : '';
                const activeTime = active
                  ? active.status === 'RESCHEDULE_REQUESTED'
                    ? (active.proposedTime ?? active.scheduledTime)
                    : active.scheduledTime
                  : '';
                const SCH_STATUS: Record<string, { label: string; color: string }> = {
                  CONFIRMED: { label: '확정', color: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30' },
                  ACCEPTED: { label: '수락', color: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30' },
                  REQUESTED: { label: '대기', color: 'bg-amber-500/10 text-amber-300 ring-amber-500/30' },
                  RESCHEDULE_REQUESTED: { label: '재조율', color: 'bg-blue-500/10 text-blue-300 ring-blue-500/30' },
                };
                return (
                  <div className="w-full space-y-3">
                    {accepted ? (
                      <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 size={13} /> 방문 일정이 확정되었습니다. 컨설턴트의 현장 방문을 준비해주세요.
                      </p>
                    ) : myTurn ? (
                      <div className="rounded-lg bg-amber-500/5 ring-1 ring-amber-500/20 px-4 py-3 space-y-2">
                        <p className="text-xs font-medium text-amber-300">
                          {active.status === 'RESCHEDULE_REQUESTED'
                            ? '컨설턴트가 일정을 변경 제안했습니다'
                            : '컨설턴트가 일정을 제안했습니다'}
                        </p>
                        <p className="text-sm font-bold text-white">
                          {activeDate} {activeTime}
                        </p>
                        {active.rejectionReason && (
                          <p className="text-[11px] text-slate-400">사유: {active.rejectionReason}</p>
                        )}
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={respondToScheduleMut.isPending}
                            onClick={() =>
                              respondToScheduleMut.mutate(
                                { scheduleId: active.id, data: { action: 'ACCEPT' } },
                                {
                                  onSuccess: () => {
                                    sendChatMutation.mutate({
                                      consultationId: id,
                                      content: `[컨설팅] 방문 일정에 동의합니다.\n📅 ${activeDate} (${activeTime})`,
                                    });
                                  },
                                },
                              )
                            }
                          >
                            <CheckCircle2 size={13} className="mr-1.5" /> 이 일정에 동의
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setRespondingSchedule({ id: active.id, action: 'RESCHEDULE' });
                              setRespondForm({ reason: '', proposedDate: '', proposedTime: '' });
                            }}
                          >
                            <Calendar size={13} className="mr-1.5" /> 다른 일정 제안
                          </Button>
                        </div>
                      </div>
                    ) : waiting ? (
                      <div className="rounded-lg bg-[#0d1520] ring-1 ring-white/[0.08] px-4 py-3 space-y-2">
                        <p className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                          <Clock size={13} className="text-amber-400" /> 컨설턴트의 응답을 기다리고 있습니다
                        </p>
                        <p className="text-sm font-bold text-white">
                          {activeDate} {activeTime}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={cancelScheduleMut.isPending}
                          onClick={() => cancelScheduleMut.mutate(active.id)}
                        >
                          제안 취소
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-[#0d1520] ring-1 ring-white/[0.08] px-4 py-3">
                        <p className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                          <Clock size={13} className="text-slate-400" /> 컨설턴트의 방문 일정 제안을 기다리고 있습니다
                        </p>
                      </div>
                    )}
                    {respondingSchedule && (
                      <div className="rounded-lg bg-blue-500/5 ring-1 ring-blue-500/20 px-4 py-3 space-y-2">
                        <p className="text-xs font-medium text-blue-300">다른 일정 제안</p>
                        <input
                          type="date"
                          value={respondForm.proposedDate}
                          onChange={(e) => setRespondForm((f) => ({ ...f, proposedDate: e.target.value }))}
                          className="w-full h-9 rounded-lg border border-accent/30 bg-surface-dark px-3 text-sm text-white focus:outline-none"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {TIME_SLOTS.map((t) => (
                            <button
                              key={t}
                              onClick={() => setRespondForm((f) => ({ ...f, proposedTime: t }))}
                              className={cn(
                                'rounded px-3 py-1.5 text-xs ring-1 transition-all',
                                respondForm.proposedTime === t
                                  ? 'bg-primary/10 ring-primary/40 text-primary'
                                  : 'bg-white/[0.02] ring-white/[0.06] text-slate-300',
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          placeholder="사유 (선택)"
                          value={respondForm.reason}
                          onChange={(e) => setRespondForm((f) => ({ ...f, reason: e.target.value }))}
                          className="w-full h-9 rounded-lg border border-accent/30 bg-surface-dark px-3 text-xs text-white placeholder:text-accent/40 focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setRespondingSchedule(null)}>
                            취소
                          </Button>
                          <Button
                            size="sm"
                            disabled={
                              !respondForm.proposedDate || !respondForm.proposedTime || respondToScheduleMut.isPending
                            }
                            onClick={() =>
                              respondToScheduleMut.mutate(
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
                                    sendChatMutation.mutate({
                                      consultationId: id,
                                      content: `[컨설팅] 일정 변경을 요청합니다.\n📅 ${respondForm.proposedDate} (${respondForm.proposedTime})${respondForm.reason ? `\n사유: ${respondForm.reason}` : ''}`,
                                    });
                                  },
                                },
                              )
                            }
                          >
                            {respondToScheduleMut.isPending ? (
                              <Loader2 size={11} className="animate-spin mr-1" />
                            ) : null}
                            제안 보내기
                          </Button>
                        </div>
                      </div>
                    )}
                    {schList.length > 0 && (
                      <div className="space-y-1.5">
                        {schList.map((sch: any) => {
                          const st = SCH_STATUS[sch.status] ?? {
                            label: sch.status,
                            color: 'bg-white/[0.05] text-slate-400 ring-white/[0.1]',
                          };
                          return (
                            <div
                              key={sch.id}
                              className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] px-3 py-2 flex items-center justify-between"
                            >
                              <span className="text-xs text-white">
                                {sch.scheduledDate} {sch.scheduledTime}
                              </span>
                              <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full ring-1', st.color)}>
                                {st.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            {c.action.kind === 'survey' &&
              (() => {
                if (hasSurvey)
                  return (
                    <div className="w-full space-y-3">
                      <div className="rounded-lg ring-1 ring-amber-500/20 bg-amber-500/5 p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ClipboardList size={14} className="text-amber-400" />
                          <span className="text-xs font-medium text-amber-400">
                            설문 데이터가 있습니다 — 제출하여 다음 단계로 진행하세요
                          </span>
                        </div>
                        <Button
                          size="sm"
                          disabled={createSurveyMut.isPending}
                          onClick={() => {
                            createSurveyMut.mutate(
                              {
                                consultationId: id,
                                data: {
                                  totalEnergyUsage: (apiSurvey as any)?.totalEnergyUsage ?? 0,
                                  totalGhgEmission: (apiSurvey as any)?.totalGhgEmission ?? 0,
                                  exportCountries: (apiSurvey as any)?.exportCountries || null,
                                  regulations: (apiSurvey as any)?.regulations ?? [],
                                  sites: (apiSurvey as any)?.sites ?? [],
                                },
                              },
                              {
                                onSuccess: () => {
                                  advanceMilestone();
                                  toast('success', '설문이 제출되었습니다. 다음 단계로 진행합니다.');
                                },
                              },
                            );
                          }}
                        >
                          {createSurveyMut.isPending ? (
                            <Loader2 size={12} className="animate-spin mr-1" />
                          ) : (
                            <Send size={13} className="mr-1" />
                          )}
                          제출
                        </Button>
                      </div>
                      {matchingDiagnoses.length > 0 && (
                        <>
                          <p className="text-xs text-slate-400">또는 다른 진단을 선택할 수 있습니다.</p>
                          {matchingDiagnoses.map((diag: any) => (
                            <div
                              key={diag.id}
                              className="rounded-lg ring-1 ring-white/[0.08] bg-white/[0.03] p-3 flex items-center justify-between"
                            >
                              <div>
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
                                disabled={createSurveyMut.isPending}
                                onClick={() =>
                                  createSurveyMut.mutate(
                                    {
                                      consultationId: id,
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
                                      onSuccess: () =>
                                        toast('success', '설문이 연동되었습니다. 다음 단계로 진행합니다.'),
                                    },
                                  )
                                }
                              >
                                선택
                              </Button>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  );
                if (matchingDiagnoses.length > 0)
                  return (
                    <div className="w-full space-y-2">
                      <p className="text-xs text-slate-400">
                        기존 진단 정보입니다. 추가 정보를 입력해 전송·확정하세요.
                      </p>
                      {matchingDiagnoses.map((diag: any) => (
                        <div
                          key={diag.id}
                          className="rounded-lg ring-1 ring-white/[0.08] bg-white/[0.03] p-3 flex items-center justify-between"
                        >
                          <div>
                            <p className="text-xs font-medium text-white">
                              {diag.companyName} — {consultationDomain} 진단
                            </p>
                            <p className="text-[11px] text-slate-500">
                              에너지 {diag.annualEnergyUsage?.toLocaleString() ?? '-'} MWh
                            </p>
                          </div>
                        </div>
                      ))}
                      <Button size="sm" variant="primary" className="w-full" onClick={() => setSurveyOpen(true)}>
                        <Send size={13} className="mr-1" /> 추가정보 전송 및 확정
                      </Button>
                    </div>
                  );
                return (
                  <Button size="sm" variant="primary" onClick={() => setSurveyOpen(true)}>
                    <FileText size={13} className="mr-1.5" /> 설문·자료 제출
                  </Button>
                );
              })()}
            {c.action.kind === 'site' &&
              (() => {
                const linkedSites = Array.isArray(apiSites) ? (apiSites as any[]) : [];
                return (
                  <div className="w-full space-y-3">
                    {consumerSites.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] text-slate-400 font-medium">기존 등록 사업장</p>
                        {consumerSites.map((cs: any) => {
                          const isLinked = linkedSites.some((s: any) => s.name === cs.name && s.address === cs.address);
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
                                  <span className="text-xs text-white">{cs.name}</span>
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
                                  disabled={createSiteMut.isPending || linkedSites.length > 0}
                                  onClick={() =>
                                    createSiteMut.mutate(
                                      {
                                        consultationId: id,
                                        data: {
                                          name: cs.name,
                                          address: cs.address || '',
                                          siteType: cs.siteType || 'FACTORY',
                                          contractPowerKw: cs.contractPowerKw ?? null,
                                        },
                                      },
                                      { onSuccess: () => toast('success', '사업장이 연결되었습니다.') },
                                    )
                                  }
                                >
                                  <Plus size={10} className="mr-1" /> 연결
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {linkedSites.filter((s: any) => !consumerSites.some((cs: any) => cs.name === s.name)).length >
                      0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] text-slate-400 font-medium">컨설팅 등록 사업장</p>
                        {linkedSites
                          .filter((s: any) => !consumerSites.some((cs: any) => cs.name === s.name))
                          .map((s: any) => (
                            <div
                              key={s.id}
                              className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/[0.06]"
                            >
                              <div className="flex items-center gap-2">
                                <MapPin size={12} className="text-slate-400" />
                                <span className="text-xs text-white">{s.name}</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                    {linkedSites.length === 0 && consumerSites.length === 0 && (
                      <p className="text-xs text-slate-500">등록된 사업장이 없습니다</p>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => router.push('/consumer/sites')}>
                      <Plus size={12} className="mr-1" /> 새 사업장 등록
                    </Button>
                    {linkedSites.length > 0 && prospectMilestone && (
                      <div className="pt-2 border-t border-white/[0.06]">
                        <Button
                          disabled={completeMilestoneMut.isPending}
                          onClick={() => {
                            completeMilestoneMut.mutate(prospectMilestone.id, {
                              onSuccess: () => {
                                toast('success', '사업장 등록이 완료되었습니다. 다음 단계로 진행합니다.');
                                const idx = milestonesSorted.findIndex((m: any) => m.id === prospectMilestone.id);
                                const next: any = milestonesSorted[idx + 1];
                                if (next && next.status !== 'COMPLETED' && next.status !== 'STARTED')
                                  startMilestoneMut.mutate(next.id);
                              },
                              onError: () => toast('error', '단계 완료 처리에 실패했습니다.'),
                            });
                          }}
                          className="w-full"
                        >
                          {completeMilestoneMut.isPending ? (
                            <Loader2 size={12} className="animate-spin mr-1" />
                          ) : (
                            <CheckCircle2 size={14} className="mr-1" />
                          )}
                          사업장 등록 완료 ({linkedSites.length}개 등록됨)
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })()}
            {c.action.kind === 'review' && (
              <>
                <Button size="sm" variant="secondary" onClick={() => openReportsModal()}>
                  <FileText size={13} className="mr-1.5" /> 산출물 보기
                </Button>
                <Button size="sm" variant="primary" onClick={() => setReviewOpen(true)}>
                  <CheckCircle2 size={13} className="mr-1.5" /> 검수하기
                </Button>
              </>
            )}
            {c.action.kind === 'settlement' && (
              <>
                <Button size="sm" variant="primary" onClick={() => router.push('/consulting/settlement')}>
                  <Receipt size={13} className="mr-1.5" /> 정산 확인
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setTaxOpen(true)}>
                  <FileText size={13} className="mr-1.5" /> 세금계산서 확인
                </Button>
              </>
            )}
            {c.action.kind === 'done' && (
              <>
                <Button size="sm" onClick={() => router.push(`/consulting/project/${id}/review`)}>
                  <Star size={13} className="mr-1.5" /> 컨설턴트 평가하기
                </Button>
                <Button size="sm" variant="secondary" onClick={() => router.push('/consulting/settlement')}>
                  <Receipt size={13} className="mr-1.5" /> 정산 내역 확인
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setTaxOpen(true)}>
                  <FileText size={13} className="mr-1.5" /> 세금계산서 확인
                </Button>
              </>
            )}
            {c.action.kind === 'documents' &&
              (() => {
                const reviewCount = reports.filter((r) => r.status === 'REVIEW').length;
                const approvedCount = reports.filter((r) => r.status === 'APPROVED').length;
                const rejectedCount = reports.filter((r) => r.status === 'REJECTED').length;
                const draftCount = reports.filter((r) => r.status === 'DRAFT').length;
                if (reports.length === 0)
                  return (
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                      <Clock size={13} className="text-amber-300" /> 컨설턴트가 보고서를 업로드하면 검토할 수 있습니다
                    </span>
                  );
                return (
                  <div className="flex items-center gap-3 flex-wrap">
                    {reviewCount > 0 && (
                      <Button size="sm" variant="primary" onClick={() => openReportsModal()}>
                        <CheckCircle2 size={13} className="mr-1.5" /> 보고서 검토하기 ({reviewCount}건)
                      </Button>
                    )}
                    {reviewCount === 0 && (
                      <Button size="sm" variant="primary" onClick={() => openReportsModal()}>
                        <FileText size={13} className="mr-1.5" /> 보고서 보기
                      </Button>
                    )}
                    <div className="flex items-center gap-2 text-[11px]">
                      {approvedCount > 0 && <span className="text-emerald-400">승인 {approvedCount}</span>}
                      {reviewCount > 0 && <span className="text-amber-400">검토대기 {reviewCount}</span>}
                      {rejectedCount > 0 && <span className="text-red-400">반려 {rejectedCount}</span>}
                      {draftCount > 0 && <span className="text-slate-500">작성중 {draftCount}</span>}
                    </div>
                  </div>
                );
              })()}
            {c.action.kind === 'contract' &&
              (() => {
                const pendingContracts = contractDocs.filter((d) => d.status === 'REVIEW');
                const approvedContracts = contractDocs.filter((d) => d.status === 'APPROVED');
                const draftDoc = contractDocs.find((d) => d.type === 'CONTRACT_DRAFT');
                const finalDoc = contractDocs.find((d) => d.type === 'CONTRACT_FINAL');
                const draftApproved = draftDoc?.status === 'APPROVED';
                const finalApproved = finalDoc?.status === 'APPROVED';
                const allApproved = draftApproved && finalApproved;
                const onlyDraftApproved = draftApproved && !finalApproved;
                return (
                  <div className="flex items-center gap-2 flex-wrap">
                    {allApproved ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                        <CheckCircle2 size={13} /> 계약서가 모두 승인되었습니다
                      </span>
                    ) : onlyDraftApproved ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-xs text-amber-400">
                          <CheckCircle2 size={13} /> 계약서가 승인되었습니다 1/2
                        </span>
                        {pendingContracts.length > 0 && (
                          <Button size="sm" variant="primary" onClick={() => openContractsModal()}>
                            <Eye size={13} className="mr-1.5" /> 계약서 검토 ({contractDocs.length})
                          </Button>
                        )}
                      </>
                    ) : contractDocs.length === 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                        <Clock size={13} className="text-amber-300" /> 컨설턴트가 계약서를 업로드하면 검토할 수 있습니다
                      </span>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-xs text-amber-400">
                          <FileText size={13} /> 검토 대기 {pendingContracts.length}건 · 승인 {approvedContracts.length}
                          건
                        </span>
                        <Button size="sm" variant="primary" onClick={() => openContractsModal()}>
                          <Eye size={13} className="mr-1.5" /> 계약서 검토 ({contractDocs.length})
                        </Button>
                      </>
                    )}
                  </div>
                );
              })()}
            {c.action.kind === 'wait' && (
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const allApproved = reports.length > 0 && reports.every((r) => r.status === 'APPROVED');
                  if (allApproved)
                    return (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                        <CheckCircle2 size={13} /> 모든 보고서 검토가 완료되었습니다
                      </span>
                    );
                  return (
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                      <Clock size={13} className="text-amber-300" /> 컨설턴트 작업 완료를 기다리는 중입니다
                    </span>
                  );
                })()}
                {reports.length > 0 && !reports.every((r) => r.status === 'APPROVED') && (
                  <Button size="sm" variant="primary" onClick={() => openReportsModal()}>
                    <FileText size={13} className="mr-1.5" /> 문서 확인 ({reports.length})
                  </Button>
                )}
              </div>
            )}
            {c.action.kind === 'no-milestones' && (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                <Clock size={13} className="text-amber-300" /> 컨설턴트가 프로세스를 시작하면 진행할 수 있습니다
              </span>
            )}
          </div>
          {c.action.branchNote && (
            <p className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
              <AlertCircle size={11} className="text-amber-300" />
              {c.action.branchNote}
            </p>
          )}
        </div>

        {/* 컨설팅 정보 — 기본 정보 + 1차 제안 */}
        <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.08] px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-300">컨설팅 정보</p>
            {c.firstProposal && (
              <button
                type="button"
                onClick={() => setProposalView(true)}
                className="text-[11px] text-primary hover:text-primary/80 inline-flex items-center gap-0.5"
              >
                1차 제안 원문 <ArrowUpRight size={10} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 text-sm">
            <div>
              <p className="text-[11px] text-slate-500">도메인</p>
              <p className="text-white mt-0.5">{c.domain}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">계약 금액</p>
              <p className="text-white tabular-nums mt-0.5">₩{c.contractAmount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">계약 체결일</p>
              <p className="text-white tabular-nums mt-0.5">{c.startedAt}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">예상 완료</p>
              <p className="text-white tabular-nums mt-0.5">{c.expectedEnd}</p>
            </div>
          </div>
          {c.firstProposal && (
            <p className="mt-3 pt-3 border-t border-white/[0.06] text-[11px] text-slate-500">
              1차 제안 · {c.firstProposal.source} · {c.firstProposal.receivedAt} 수신 → {c.firstProposal.acceptedAt}{' '}
              수락
            </p>
          )}
        </div>
      </div>

      {/* ── 우측: 조율 채팅 패널 ── */}
      {/* 헤더(fixed 100px) 아래에 붙도록 top-[116px] */}
      <div className="hidden lg:flex flex-col w-[320px] shrink-0 sticky top-[116px] max-h-[calc(100vh-132px)] rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 text-xs font-bold">
              {c.consultantInitial}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{c.consultant} 컨설턴트</p>
              <p className="text-[10px] text-emerald-400">● 연결됨 — 조건·보고서 조율 채널</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-[280px]">
          {messages.map((m) => (
            <div key={m.id} className={cn('flex', m.from === 'me' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[85%]', m.from === 'me' ? 'text-right' : 'text-left')}>
                <div
                  className={cn(
                    'inline-block rounded-2xl px-3 py-2 text-[13px] leading-relaxed text-left',
                    m.from === 'me'
                      ? 'bg-primary/20 text-white rounded-br-sm'
                      : 'bg-white/[0.05] text-slate-200 rounded-bl-sm',
                  )}
                >
                  {m.text}
                </div>
                <p className="mt-1 text-[10px] text-slate-600 tabular-nums">{m.time}</p>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="px-3 py-3 border-t border-white/[0.06] flex items-center gap-2 shrink-0">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="메시지를 입력하세요..."
            className="flex-1 h-10 rounded-md bg-[#0d1520] ring-1 ring-white/[0.1] px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!chatInput.trim()}
            className="h-10 w-10 shrink-0 flex items-center justify-center rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="전송"
          >
            <Send size={15} />
          </button>
        </div>
      </div>

      {/* ── 단계 검토 팝업 — 모든 단계 클릭 가능. 산출물 있으면 항목·파일, 없으면 단계 안내 ── */}
      {stepView && (
        <Modal
          open={!!stepView}
          onClose={() => setStepView(null)}
          title={stepView.title}
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setStepView(null)}>
                닫기
              </Button>
              {stepView.artifact?.file && (
                <Button
                  variant="primary"
                  onClick={() => toast('success', `${stepView.artifact.file} 다운로드를 요청했습니다`)}
                >
                  <Download size={14} className="mr-1.5" />
                  다운로드
                </Button>
              )}
            </>
          }
        >
          <div className="space-y-3">
            {/* 상태 · 주체 · 일자 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                  stepView.state === 'done' && 'bg-emerald-500/[0.12] text-emerald-300 ring-emerald-500/30',
                  stepView.state === 'action' && 'bg-primary/[0.12] text-primary ring-primary/30',
                  stepView.state === 'upcoming' && 'bg-white/[0.05] text-slate-400 ring-white/[0.1]',
                )}
              >
                {stepView.state === 'done' ? '완료' : stepView.state === 'action' ? '진행 중' : '예정'}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                  ACTOR_META[stepView.actor],
                )}
              >
                {stepView.actor}
              </span>
              <span className="text-xs text-slate-500 tabular-nums">{stepView.date}</span>
            </div>
            <p className="text-sm text-slate-300">{stepView.desc}</p>

            {/* 단계별 상세 정보 */}
            {stepView.actionType === 'DOCUMENTS' ? (
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">보고서 현황</p>
                {reports.length === 0 ? (
                  <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-6 text-center">
                    <FileText size={20} className="mx-auto text-slate-600 mb-2" />
                    <p className="text-xs text-slate-400">아직 등록된 보고서가 없습니다</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2 mb-3">
                      {REPORT_STAGES.map((stage) => {
                        const r = reports.find((rr) => rr.type === stage.value);
                        const st = r?.status ? DOC_STATUS_META[r.status] : null;
                        return (
                          <div
                            key={stage.value}
                            className={cn(
                              'flex-1 rounded-lg ring-1 px-2.5 py-2 text-center',
                              r?.status === 'APPROVED'
                                ? 'bg-emerald-500/10 ring-emerald-500/30'
                                : r?.status === 'REJECTED'
                                  ? 'bg-red-500/10 ring-red-500/30'
                                  : r?.status === 'REVIEW'
                                    ? 'bg-amber-500/10 ring-amber-500/30'
                                    : r
                                      ? 'bg-blue-500/10 ring-blue-500/30'
                                      : 'bg-white/[0.02] ring-white/[0.06]',
                            )}
                          >
                            <p className="text-[10px] text-slate-400">{stage.label}</p>
                            {st ? (
                              <span
                                className={cn(
                                  'text-[9px] px-1.5 py-0.5 rounded-full ring-1 mt-1 inline-block',
                                  st.color,
                                )}
                              >
                                {st.label}
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-600 mt-1 block">미등록</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {reports.map((doc) => {
                      const st = doc.status ? DOC_STATUS_META[doc.status] : null;
                      return (
                        <div
                          key={doc.id}
                          className={cn(
                            'rounded-lg ring-1 px-4 py-3 flex items-center justify-between gap-3',
                            doc.status === 'REVIEW'
                              ? 'bg-amber-500/5 ring-amber-500/20'
                              : 'bg-white/[0.02] ring-white/[0.06]',
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-lg shrink-0',
                                doc.fileId ? 'bg-red-500/10' : 'bg-white/[0.04]',
                              )}
                            >
                              <File size={14} className={doc.fileId ? 'text-red-400' : 'text-slate-600'} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm text-white truncate">{doc.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-slate-500">
                                  {DOC_TYPE_LABELS[doc.type] || doc.type}
                                </span>
                                {st && (
                                  <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full ring-1', st.color)}>
                                    {st.label}
                                  </span>
                                )}
                                {doc.uploadedAt && (
                                  <span className="text-[10px] text-slate-600">
                                    {new Date(doc.uploadedAt).toLocaleDateString('ko-KR')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {doc.fileId && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setStepView(null);
                                  openReportsModal(doc);
                                }}
                              >
                                <Eye size={12} className="mr-1" /> 열람
                              </Button>
                            )}
                            {stepView.state !== 'done' && doc.status === 'REVIEW' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    approveReportMut.mutate(doc.id, {
                                      onSuccess: () =>
                                        toast('success', `${DOC_TYPE_LABELS[doc.type] || '보고서'}를 승인했습니다`),
                                      onError: () => toast('error', '승인 실패'),
                                    });
                                  }}
                                  disabled={approveReportMut.isPending}
                                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-primary/10 text-primary ring-1 ring-primary/20 hover:bg-primary/20 transition-colors"
                                >
                                  <CheckCircle2 size={11} className="inline mr-0.5" /> 승인
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStepView(null);
                                    setReportRejectTarget(doc);
                                    setReportRejectReason('');
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/20 transition-colors"
                                >
                                  <AlertCircle size={11} className="inline mr-0.5" /> 반려
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : stepView.actionType === 'SURVEY' ? (
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">무료진단 설문 결과</p>
                {(() => {
                  // 제출된 설문 원본(apiSurvey/surveys 테이블)을 우선 반영, 없으면 consultation 요약값 유지
                  const sv = {
                    ...(apiConsultation as any),
                    ...Object.fromEntries(Object.entries((apiSurvey as any) ?? {}).filter(([, v]) => v != null)),
                  };
                  if (!sv || (!sv.annualEnergyUsage && !sv.employeeCount && !sv.consultingDrivers))
                    return (
                      <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-6 text-center">
                        <ClipboardCheck size={20} className="mx-auto text-slate-600 mb-2" />
                        <p className="text-xs text-slate-400">설문 데이터가 없습니다</p>
                      </div>
                    );
                  const DOMAIN_LABELS: Record<string, string> = {
                    RE100: 'RE100 이행',
                    CARBON_REDUCTION: '탄소감축',
                    DISTRIBUTED_ENERGY: '분산에너지',
                  };
                  const rows: [string, string][] = [];
                  if (sv.domain) rows.push(['컨설팅 분야', DOMAIN_LABELS[sv.domain] || sv.domain]);
                  if (sv.industry) rows.push(['업종', sv.industry]);
                  if (sv.companySize) rows.push(['기업 규모', sv.companySize]);
                  if (sv.maturityGrade) rows.push(['성숙도 등급', sv.maturityGrade]);
                  if (sv.annualEnergyUsage)
                    rows.push(['연간 에너지 사용량', `${Number(sv.annualEnergyUsage).toLocaleString()} MWh`]);
                  if (sv.currentElecCost)
                    rows.push(['전기요금 단가', `₩${Number(sv.currentElecCost).toLocaleString()}`]);
                  if (sv.annualGhgEmission)
                    rows.push(['온실가스 배출량', `${Number(sv.annualGhgEmission).toLocaleString()} tCO₂eq`]);
                  if (sv.employeeCount) rows.push(['임직원 수', `${Number(sv.employeeCount).toLocaleString()}명`]);
                  if (sv.annualRevenue) rows.push(['연매출', `₩${Number(sv.annualRevenue).toLocaleString()}`]);
                  if (sv.siteCount) rows.push(['사업장 수', `${sv.siteCount}개`]);
                  if (sv.siteRegions) rows.push(['사업장 지역', sv.siteRegions]);
                  if (sv.currentRePercent != null) rows.push(['현재 RE 비율', `${sv.currentRePercent}%`]);
                  if (sv.targetTimeline) rows.push(['목표 달성 기간', sv.targetTimeline]);
                  if (sv.budgetRange) rows.push(['예산 범위', sv.budgetRange]);
                  if (sv.exportCountries) rows.push(['수출 대상국', sv.exportCountries]);
                  const driversRaw = sv.consultingDrivers;
                  const drivers = Array.isArray(driversRaw)
                    ? driversRaw
                    : typeof driversRaw === 'string' && driversRaw
                      ? driversRaw.split(',').map((s: string) => s.trim())
                      : [];
                  const reMethodsRaw = sv.currentReMethods;
                  const reMethods = Array.isArray(reMethodsRaw)
                    ? reMethodsRaw
                    : typeof reMethodsRaw === 'string' && reMethodsRaw
                      ? reMethodsRaw.split(',').map((s: string) => s.trim())
                      : [];
                  return (
                    <div className="space-y-3">
                      {rows.length > 0 && (
                        <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                          {rows.map(([k, v]) => (
                            <div key={k} className="flex justify-between px-4 py-2.5">
                              <span className="text-xs text-slate-500">{k}</span>
                              <span className="text-sm text-slate-200">{v}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {drivers.length > 0 && (
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1.5">컨설팅 요청 배경</p>
                          <div className="flex flex-wrap gap-1.5">
                            {drivers.map((d: string, i: number) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary ring-1 ring-primary/20"
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {reMethods.length > 0 && (
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1.5">현재 RE 조달 방식</p>
                          <div className="flex flex-wrap gap-1.5">
                            {reMethods.map((m: string, i: number) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {sv.diagnosisId && <p className="text-[10px] text-slate-600">무료진단 #{sv.diagnosisId} 기반</p>}
                    </div>
                  );
                })()}
              </div>
            ) : stepView.actionType === 'PROSPECT' ? (
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  등록된 사업장 ({(apiSites as any[])?.length || 0})
                </p>
                {!apiSites || (apiSites as any[]).length === 0 ? (
                  <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-6 text-center">
                    <Building2 size={20} className="mx-auto text-slate-600 mb-2" />
                    <p className="text-xs text-slate-400">등록된 사업장이 없습니다</p>
                  </div>
                ) : (
                  (apiSites as any[]).map((site: any) => {
                    const ST_LABELS: Record<string, string> = {
                      HEAD: '본사',
                      FACTORY: '공장',
                      OFFICE: '사무실/빌딩',
                      RETAIL: '매점/상업',
                      WAREHOUSE: '창고/물류',
                      BRANCH: '지사',
                      OTHER: '기타',
                    };
                    return (
                      <div
                        key={site.id}
                        onClick={() => setSelectedSite(site)}
                        className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] px-4 py-3 cursor-pointer hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 shrink-0">
                            <Building2 size={16} className="text-blue-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-white font-medium">{site.name}</p>
                              {site.siteType && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.05] ring-1 ring-white/[0.1] text-slate-400">
                                  {ST_LABELS[site.siteType] || site.siteType}
                                </span>
                              )}
                            </div>
                            {site.address && (
                              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                <MapPin size={10} /> {site.address}
                              </p>
                            )}
                          </div>
                          <ChevronRight size={14} className="text-slate-600 mt-1" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : stepView.actionType === 'SCHEDULE' ? (
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">일정 조율 이력</p>
                {(() => {
                  const schedules = Array.isArray(apiSchedules) ? (apiSchedules as any[]) : [];
                  if (schedules.length === 0)
                    return (
                      <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-6 text-center">
                        <Calendar size={20} className="mx-auto text-slate-600 mb-2" />
                        <p className="text-xs text-slate-400">일정 조율 기록이 없습니다</p>
                      </div>
                    );
                  const SCH_STATUS: Record<string, { label: string; color: string }> = {
                    CONFIRMED: { label: '확정', color: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30' },
                    PENDING: { label: '대기', color: 'bg-amber-500/10 text-amber-300 ring-amber-500/30' },
                    CANCELLED: { label: '취소', color: 'bg-red-500/10 text-red-300 ring-red-500/30' },
                    PROPOSED: { label: '제안', color: 'bg-blue-500/10 text-blue-300 ring-blue-500/30' },
                  };
                  return schedules.map((sch: any) => {
                    const st = SCH_STATUS[sch.status] ?? SCH_STATUS.PENDING;
                    const date = sch.scheduledDate || sch.scheduled_date;
                    const time = sch.scheduledTime || sch.scheduled_time;
                    return (
                      <div key={sch.id} className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] px-4 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Calendar size={13} className="text-blue-400" />
                            <span className="text-sm text-white">
                              {date} {time}
                            </span>
                          </div>
                          <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full ring-1', st.color)}>
                            {st.label}
                          </span>
                        </div>
                        {sch.memo && <p className="text-xs text-slate-400 mt-1">{sch.memo}</p>}
                        {(sch.proposedDate || sch.proposed_date) && (
                          <p className="text-[10px] text-slate-500 mt-1">
                            대안 제안: {sch.proposedDate || sch.proposed_date}{' '}
                            {sch.proposedTime || sch.proposed_time || ''}
                          </p>
                        )}
                        {(sch.rejectionReason || sch.rejection_reason) && (
                          <p className="text-[10px] text-red-400 mt-1">
                            거절 사유: {sch.rejectionReason || sch.rejection_reason}
                          </p>
                        )}
                        {(sch.confirmedAt || sch.confirmed_at) && (
                          <p className="text-[10px] text-emerald-400 mt-1">
                            확정일: {new Date(sch.confirmedAt || sch.confirmed_at).toLocaleDateString('ko-KR')}
                          </p>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            ) : stepView.actionType === 'NAVIGATE' ? (
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">방문 일정</p>
                {(() => {
                  const schedules = Array.isArray(apiSchedules) ? (apiSchedules as any[]) : [];
                  const sites = Array.isArray(apiSites) ? (apiSites as any[]) : [];
                  const SCH_ST: Record<string, { label: string; color: string }> = {
                    CONFIRMED: { label: '확정', color: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30' },
                    ACCEPTED: { label: '수락', color: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30' },
                    REQUESTED: { label: '요청', color: 'bg-amber-500/10 text-amber-300 ring-amber-500/30' },
                    PENDING: { label: '대기', color: 'bg-amber-500/10 text-amber-300 ring-amber-500/30' },
                    REJECTED: { label: '거절', color: 'bg-red-500/10 text-red-300 ring-red-500/30' },
                    CANCELLED: { label: '취소', color: 'bg-slate-500/10 text-slate-400 ring-slate-500/30' },
                    RESCHEDULE_REQUESTED: { label: '재조율', color: 'bg-blue-500/10 text-blue-300 ring-blue-500/30' },
                  };
                  return (
                    <div className="space-y-3">
                      {schedules.length > 0 ? (
                        schedules.map((sch: any) => {
                          const st = SCH_ST[sch.status] || {
                            label: sch.status,
                            color: 'bg-white/[0.05] text-slate-400 ring-white/[0.1]',
                          };
                          return (
                            <div key={sch.id} className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] px-4 py-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Calendar size={13} className="text-emerald-400" />
                                <span className="text-sm text-white">
                                  {sch.scheduledDate || sch.scheduled_date} {sch.scheduledTime || sch.scheduled_time}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ring-1 ${st.color}`}>
                                  {st.label}
                                </span>
                              </div>
                              {sch.memo && <p className="text-xs text-slate-400">{sch.memo}</p>}
                              {sch.visitNotes && (
                                <div className="mt-2 rounded bg-blue-500/5 ring-1 ring-blue-500/10 px-3 py-2">
                                  <p className="text-[10px] text-blue-400 mb-1">컨설턴트 방문 기록</p>
                                  <p className="text-xs text-slate-300 whitespace-pre-wrap">{sch.visitNotes}</p>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-4">
                          <p className="text-xs text-slate-400">등록된 방문 일정이 없습니다</p>
                        </div>
                      )}
                      {(() => {
                        const visitDocs = reports.filter((r: any) => r.type === 'SITE_REPORT');
                        if (visitDocs.length === 0) return null;
                        return (
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-500 mt-2 mb-2">실사 자료</p>
                            {visitDocs.map((doc: any) => (
                              <button
                                key={doc.id}
                                type="button"
                                onClick={() => openReportsModal(doc)}
                                className="w-full flex items-center justify-between rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] px-4 py-2.5 mb-1.5 hover:ring-white/[0.16] transition-colors"
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  <FileText size={12} className="text-blue-400 shrink-0" />
                                  <span className="text-xs text-white truncate">{doc.name}</span>
                                </span>
                                <span className="text-[10px] text-sky-400 shrink-0">보기</span>
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                      {sites.length > 0 && (
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-slate-500 mt-2 mb-2">
                            방문 대상 사업장
                          </p>
                          {sites.map((site: any) => (
                            <div
                              key={site.id}
                              className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] px-4 py-2.5 mb-1.5"
                            >
                              <div className="flex items-center gap-2">
                                <Building2 size={12} className="text-blue-400" />
                                <span className="text-xs text-white">{site.name || site.siteName}</span>
                                {site.address && <span className="text-[10px] text-slate-500">{site.address}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {stepView.state === 'done' && stepView.date && (
                        <p className="text-[10px] text-emerald-400 mt-2">실사 완료: {stepView.date}</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : stepView.actionType === 'CONTRACT' ? (
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">계약 정보</p>
                {(() => {
                  const proposals = Array.isArray(apiProposals) ? (apiProposals as any[]) : [];
                  const accepted = proposals.find((p: any) => p.status === 'ACCEPTED');
                  if (!accepted && !c.firstProposal)
                    return (
                      <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-6 text-center">
                        <Receipt size={20} className="mx-auto text-slate-600 mb-2" />
                        <p className="text-xs text-slate-400">계약 정보가 아직 없습니다</p>
                      </div>
                    );
                  const prop = accepted || c.firstProposal;
                  const scope = prop?.proposedScope ?? prop?.proposed_scope;
                  return (
                    <div className="space-y-3">
                      <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                        <div className="flex justify-between px-4 py-2.5">
                          <span className="text-xs text-slate-500">컨설팅 비용</span>
                          <span className="text-sm text-white font-medium">
                            {(prop?.estimatedCost ?? prop?.estimated_cost)
                              ? `₩${Number(prop.estimatedCost ?? prop.estimated_cost).toLocaleString()}`
                              : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between px-4 py-2.5">
                          <span className="text-xs text-slate-500">예상 기간</span>
                          <span className="text-sm text-slate-200">
                            {prop?.estimatedDuration ?? prop?.estimated_duration ?? c.duration ?? '-'}
                          </span>
                        </div>
                        {prop?.domain && (
                          <div className="flex justify-between px-4 py-2.5">
                            <span className="text-xs text-slate-500">컨설팅 분야</span>
                            <span className="text-sm text-slate-200">{prop.domain}</span>
                          </div>
                        )}
                        <div className="flex justify-between px-4 py-2.5">
                          <span className="text-xs text-slate-500">상태</span>
                          <span className="text-sm text-emerald-300">
                            {prop?.status === 'ACCEPTED' ? '수락됨' : prop?.status || '-'}
                          </span>
                        </div>
                        {(prop?.acceptedAt ?? prop?.updatedAt ?? prop?.updated_at) && (
                          <div className="flex justify-between px-4 py-2.5">
                            <span className="text-xs text-slate-500">수락일</span>
                            <span className="text-sm text-slate-200">
                              {c.firstProposal?.acceptedAt ||
                                new Date(prop.acceptedAt ?? prop.updatedAt ?? prop.updated_at).toLocaleDateString(
                                  'ko-KR',
                                )}
                            </span>
                          </div>
                        )}
                      </div>
                      {Array.isArray(scope) && scope.length > 0 && (
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1.5">제안 범위</p>
                          <div className="flex flex-wrap gap-1.5">
                            {scope.map((s: string, i: number) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary ring-1 ring-primary/20"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {(prop?.coverLetter ?? prop?.cover_letter) && (
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1.5">커버레터</p>
                          <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] px-4 py-3">
                            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                              {prop.coverLetter ?? prop.cover_letter}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {contractDocs.length > 0 && (
                  <>
                    <p className="text-[11px] uppercase tracking-wide text-slate-500 mt-4">계약서 문서</p>
                    <div className="space-y-2">
                      {contractDocs.map((doc) => {
                        const st = doc.status ? DOC_STATUS_META[doc.status] : null;
                        const isReview = doc.status === 'REVIEW';
                        return (
                          <div
                            key={doc.id}
                            className={cn(
                              'rounded-lg ring-1 px-4 py-3 flex items-center justify-between gap-3',
                              isReview ? 'bg-amber-500/5 ring-amber-500/20' : 'bg-white/[0.02] ring-white/[0.06]',
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={cn(
                                  'flex h-8 w-8 items-center justify-center rounded-lg shrink-0',
                                  doc.fileId ? 'bg-red-500/10' : 'bg-white/[0.04]',
                                )}
                              >
                                <File size={14} className={doc.fileId ? 'text-red-400' : 'text-slate-600'} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-white truncate">{DOC_TYPE_LABELS[doc.type] || doc.type}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {st && (
                                    <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full ring-1', st.color)}>
                                      {st.label}
                                    </span>
                                  )}
                                  {doc.uploadedAt && (
                                    <span className="text-[10px] text-slate-600">
                                      {new Date(doc.uploadedAt).toLocaleDateString('ko-KR')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {doc.fileId && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setStepView(null);
                                    openReportsModal(doc);
                                  }}
                                >
                                  <Eye size={12} className="mr-1" /> 열람
                                </Button>
                              )}
                              {stepView.state !== 'done' && isReview && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      approveReportMut.mutate(doc.id, {
                                        onSuccess: () =>
                                          toast('success', `${DOC_TYPE_LABELS[doc.type] || '계약서'}를 승인했습니다`),
                                        onError: () => toast('error', '승인 실패'),
                                      });
                                    }}
                                    disabled={approveReportMut.isPending}
                                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-primary/10 text-primary ring-1 ring-primary/20 hover:bg-primary/20 transition-colors"
                                  >
                                    <CheckCircle2 size={11} className="inline mr-0.5" /> 승인
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setStepView(null);
                                      setReportRejectTarget(doc);
                                      setReportRejectReason('');
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/20 transition-colors"
                                  >
                                    <AlertCircle size={11} className="inline mr-0.5" /> 반려
                                  </button>
                                </>
                              )}
                              {doc.status === 'APPROVED' && (
                                <span className="text-[11px] text-emerald-400 font-medium">
                                  <CheckCircle2 size={12} className="inline mr-0.5" /> 승인 완료
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ) : stepView.actionType === 'REVIEW' ? (
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">최종 검수</p>
                {(() => {
                  const allApproved = reports.length > 0 && reports.every((r) => r.status === 'APPROVED');
                  const revisions = Array.isArray(apiRevisions) ? (apiRevisions as any[]) : [];
                  const latestRev = revisions.length > 0 ? revisions[revisions.length - 1] : null;
                  return (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-slate-500">보고서 승인 현황</p>
                        {REPORT_STAGES.map((stage) => {
                          const r = reports.find((rr) => rr.type === stage.value);
                          const st = r?.status ? DOC_STATUS_META[r.status] : null;
                          return (
                            <div
                              key={stage.value}
                              className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06]"
                            >
                              <span className="text-xs text-slate-300">{stage.label}</span>
                              {st ? (
                                <div className="flex items-center gap-2">
                                  <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full ring-1', st.color)}>
                                    {st.label}
                                  </span>
                                  {r.fileId && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setStepView(null);
                                        openReportsModal(r);
                                      }}
                                      className="text-[10px] text-blue-400 hover:underline"
                                    >
                                      열람
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-600">미등록</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {allApproved ? (
                        <div className="rounded-lg bg-emerald-500/5 ring-1 ring-emerald-500/20 px-4 py-3 flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                          <div>
                            <p className="text-sm text-emerald-300">모든 보고서 승인 완료</p>
                            <p className="text-[10px] text-slate-400">검수가 완료되어 컨설팅이 마무리됩니다</p>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-amber-500/5 ring-1 ring-amber-500/20 px-4 py-3 flex items-center gap-2">
                          <Clock size={16} className="text-amber-400 shrink-0" />
                          <p className="text-xs text-slate-400">
                            보고서 검토가 완료되면 최종 검수를 진행할 수 있습니다
                          </p>
                        </div>
                      )}
                      {latestRev && (
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1.5">최종 보고서 요약</p>
                          <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                            {(latestRev.recommendationSummary ?? latestRev.recommendation_summary) && (
                              <div className="px-4 py-2.5">
                                <p className="text-[10px] text-slate-500 mb-1">권고사항</p>
                                <p className="text-xs text-slate-300">
                                  {latestRev.recommendationSummary ?? latestRev.recommendation_summary}
                                </p>
                              </div>
                            )}
                            {(latestRev.actionPlan ?? latestRev.action_plan) && (
                              <div className="px-4 py-2.5">
                                <p className="text-[10px] text-slate-500 mb-1">실행 계획</p>
                                <p className="text-xs text-slate-300">
                                  {latestRev.actionPlan ?? latestRev.action_plan}
                                </p>
                              </div>
                            )}
                            {(latestRev.estimatedCost ?? latestRev.estimated_cost) && (
                              <div className="flex justify-between px-4 py-2.5">
                                <span className="text-xs text-slate-500">예상 비용</span>
                                <span className="text-sm text-slate-200">
                                  ₩{Number(latestRev.estimatedCost ?? latestRev.estimated_cost).toLocaleString()}
                                </span>
                              </div>
                            )}
                            {(latestRev.estimatedSaving ?? latestRev.estimated_saving) && (
                              <div className="flex justify-between px-4 py-2.5">
                                <span className="text-xs text-slate-500">예상 절감</span>
                                <span className="text-sm text-emerald-300">
                                  ₩{Number(latestRev.estimatedSaving ?? latestRev.estimated_saving).toLocaleString()}
                                </span>
                              </div>
                            )}
                            {(latestRev.paybackYears ?? latestRev.payback_years) && (
                              <div className="flex justify-between px-4 py-2.5">
                                <span className="text-xs text-slate-500">투자 회수 기간</span>
                                <span className="text-sm text-slate-200">
                                  {latestRev.paybackYears ?? latestRev.payback_years}년
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-3">
                <p className="text-xs text-slate-400">
                  {stepView.state === 'done'
                    ? '이 단계가 완료되었습니다.'
                    : stepView.state === 'upcoming'
                      ? '아직 진행 전 단계입니다. 이전 단계가 완료되면 진행됩니다.'
                      : '진행 중인 단계입니다.'}
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── 1차 제안 원문 팝업 ── */}
      {proposalView && c.firstProposal && (
        <Modal
          open={proposalView}
          onClose={() => setProposalView(false)}
          title={`1차 제안 원문 — ${c.consultant} 컨설턴트`}
          size="md"
          footer={
            <Button variant="ghost" onClick={() => setProposalView(false)}>
              닫기
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-slate-500">출처</span>
                <span className="text-sm text-white">{c.firstProposal.source}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-slate-500">수신 → 수락</span>
                <span className="text-sm text-slate-300 tabular-nums">
                  {c.firstProposal.receivedAt} → {c.firstProposal.acceptedAt}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-slate-500">제안 조건</span>
                <span className="text-sm text-white tabular-nums">
                  ₩{c.firstProposal.cost?.toLocaleString()} / {c.firstProposal.duration}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1.5">제안 메시지</p>
              <p className="text-sm text-slate-300 leading-relaxed">{c.firstProposal.message}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(c.firstProposal.scope ?? []).map((s) => (
                <span key={s} className="text-[11px] bg-white/[0.05] text-slate-300 rounded-md px-2 py-1">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* ── ScheduleBooking 모달 ── */}
      {showBooking && (
        <ScheduleBooking
          consultationId={id}
          onClose={() => setShowBooking(false)}
          onComplete={(date, time) => {
            setShowBooking(false);
            sendChatMutation.mutate({
              consultationId: id,
              content: `[컨설팅] 방문 일정을 제안드립니다.\n📅 ${date} (${time})`,
            });
          }}
        />
      )}

      {/* ── 방문 일정 잡기 — 수용가가 날짜·시간 직접 선택 (화살표 네비 + 시간 슬롯) ── */}
      {visitModalOpen && (
        <Modal
          open={visitModalOpen}
          onClose={() => {
            setVisitModalOpen(false);
            setVisitTime(null);
            setVisitMemo('');
          }}
          title="현장 방문 일정 선택"
          size="md"
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setVisitModalOpen(false);
                  setVisitTime(null);
                  setVisitMemo('');
                }}
              >
                취소
              </Button>
              <Button variant="primary" disabled={!visitTime?.trim()} onClick={confirmVisit}>
                <Calendar size={14} className="mr-1.5" />이 일정으로 요청
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              희망하시는 방문 날짜와 시간을 선택하세요. 컨설턴트가 확인 후 채팅에서 확정합니다.
            </p>

            {/* 날짜 — < > 화살표 네비게이션 */}
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">방문 날짜</label>
              <div className="flex items-center justify-between rounded-lg bg-[#0d1520] ring-1 ring-white/[0.1] px-2 py-2">
                <button
                  type="button"
                  onClick={() => shiftVisitDate(-1)}
                  disabled={visitDate <= TODAY}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="이전 날짜"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-base font-semibold text-white tabular-nums">
                  {visitDate} <span className="text-sm text-slate-400">({visitWeekday})</span>
                </span>
                <button
                  type="button"
                  onClick={() => shiftVisitDate(1)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06]"
                  aria-label="다음 날짜"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* 시간 — 슬롯 빠른 선택 + 직접 입력 */}
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">방문 시간</label>
              <div className="grid grid-cols-3 gap-2">
                {VISIT_SLOTS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setVisitTime(t)}
                    className={cn(
                      'rounded-lg py-2.5 text-sm font-medium ring-1 transition-colors tabular-nums',
                      visitTime === t
                        ? 'bg-[#0d1520] text-white ring-primary/60'
                        : 'bg-[#0d1520] text-slate-300 ring-white/[0.08] hover:ring-white/[0.2]',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <Input
                  placeholder="또는 직접 입력 (예: 11:30, 오전 중 등)"
                  value={visitTime ?? ''}
                  onChange={(e) => setVisitTime(e.target.value)}
                />
              </div>
            </div>

            {/* 요청 사항 — 직접 작성 */}
            <Textarea
              label="요청 사항 (선택)"
              rows={2}
              placeholder="예: 오전 방문 선호 / 정문 주차 안내 필요 / 시설팀 동석 요청"
              value={visitMemo}
              onChange={(e) => setVisitMemo(e.target.value)}
            />

            {visitTime?.trim() && (
              <div className="rounded-lg bg-primary/[0.08] ring-1 ring-primary/30 px-4 py-3">
                <p className="text-xs text-slate-300">
                  선택:{' '}
                  <span className="text-white font-medium tabular-nums">
                    {visitDate} ({visitWeekday}) {visitTime}
                  </span>{' '}
                  — {c.consultant} 컨설턴트에게 방문 요청을 보냅니다.
                  {visitMemo.trim() && <span className="block mt-1 text-slate-400">요청: {visitMemo.trim()}</span>}
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── 설문·자료 제출 (설문조사 단계) ── */}
      {surveyOpen && (
        <Modal
          open={surveyOpen}
          onClose={() => setSurveyOpen(false)}
          title="설문·자료 제출"
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setSurveyOpen(false)}>
                취소
              </Button>
              <Button
                variant="primary"
                disabled={completeMilestoneMut.isPending || startMilestoneMut.isPending || surveyUploading}
                onClick={async () => {
                  setSurveyUploading(true);
                  try {
                    // 첨부 자료를 실제 업로드해 DB에 저장 — 수용가·컨설턴트 모두 문서 확인 가능
                    for (const f of surveyFiles) {
                      const fd = new FormData();
                      fd.append('file', f);
                      // report_type CHECK 제약 허용값 사용 (SURVEY_DOC은 미허용 → 500)
                      await uploadReportFile(id, fd, 'REPORT', user?.id ?? 1);
                    }
                    queryClient.invalidateQueries({ queryKey: ['consultations', 'detail', id, 'reports'] });
                    await advanceMilestone();
                    setSurveyOpen(false);
                    setSurveyFiles([]);
                    toast('success', '설문·자료를 제출했습니다 — 다음 단계로 진행됩니다');
                  } catch (e: any) {
                    toast('error', e?.message || '자료 업로드에 실패했습니다');
                  } finally {
                    setSurveyUploading(false);
                  }
                }}
              >
                <FileText size={14} className="mr-1.5" /> {surveyUploading ? '제출 중...' : '제출'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              무료 진단 자료가 자동 연계되었습니다. 추가 자료가 있으면 업로드해 제출하세요.
            </p>
            <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-3">
              <p className="text-xs font-medium text-white flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-400" /> 무료 진단 자료 (자동 연계)
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                현재 RE {c.diagnosis.currentRE}% · 성숙도 {c.diagnosis.grade}등급
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1.5">추가 자료 업로드</p>
              <input
                ref={surveyFileRef}
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) setSurveyFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                }}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => surveyFileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files) setSurveyFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
                }}
                className="rounded-lg border border-dashed border-white/[0.15] bg-white/[0.02] px-4 py-8 text-center cursor-pointer hover:bg-white/[0.04] transition-colors"
              >
                <Upload size={22} className="mx-auto text-slate-500" />
                <p className="text-xs text-slate-400 mt-2">한전 고지서 · 도면 등을 끌어다 놓거나 클릭해 업로드</p>
                <p className="text-[10px] text-slate-600 mt-1">PDF · XLSX · 이미지</p>
              </div>
              {surveyFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {surveyFiles.map((f, i) => (
                    <div
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between rounded-md bg-white/[0.03] ring-1 ring-white/[0.06] px-3 py-1.5"
                    >
                      <span className="text-xs text-slate-300 truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => setSurveyFiles((prev) => prev.filter((_, j) => j !== i))}
                        className="text-xs text-slate-500 hover:text-red-400 ml-2 shrink-0"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ── 사업장 등록 (수용가가 등록) ── */}
      {siteOpen && (
        <Modal
          open={siteOpen}
          onClose={() => setSiteOpen(false)}
          title="사업장 등록"
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setSiteOpen(false)}>
                취소
              </Button>
              <Button
                variant="primary"
                disabled={
                  !siteName.trim() || !siteAddress.trim() || createSiteMut.isPending || completeMilestoneMut.isPending
                }
                onClick={async () => {
                  try {
                    await createSiteMut.mutateAsync({
                      consultationId: id,
                      data: {
                        name: siteName.trim(),
                        address: siteAddress.trim(),
                        siteType,
                        contractPowerKw: siteContractPower ? Number(siteContractPower) : null,
                        floorArea: siteFloorArea ? Number(siteFloorArea) : null,
                        buildingType: siteBuildingType.trim() || null,
                        memo: siteMemo.trim() || null,
                      },
                    });
                    await advanceMilestone();
                    setSiteOpen(false);
                    setSiteName('');
                    setSiteAddress('');
                    setSiteType('FACTORY');
                    setSiteContractPower('');
                    setSiteFloorArea('');
                    setSiteBuildingType('');
                    setSiteMemo('');
                    toast('success', '사업장을 등록했습니다 — 다음 단계로 진행됩니다');
                  } catch {
                    toast('error', '사업장 등록에 실패했습니다');
                  }
                }}
              >
                <MapPin size={14} className="mr-1.5" />{' '}
                {createSiteMut.isPending || completeMilestoneMut.isPending ? '처리 중...' : '등록 및 다음 단계'}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              컨설팅 대상 사업장을 등록합니다. 사업장 등록은 수용가가 직접 진행합니다.
            </p>
            <Input
              label="사업장명 *"
              placeholder="예: 한일튜브 제2공장"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
            />
            <div>
              <label className="text-[11px] text-slate-400 mb-1.5 block">사업장 유형 *</label>
              <div className="grid grid-cols-3 gap-1.5">
                {SITE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setSiteType(t.value)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm transition-colors',
                      siteType === t.value
                        ? 'border-primary/40 bg-primary/[0.06] text-primary ring-1 ring-primary/30'
                        : 'border-white/[0.06] bg-white/[0.02] text-slate-300 hover:border-white/[0.15]',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <Input
              label="주소 *"
              placeholder="예: 울산광역시 울주군 범서읍 산업로 120"
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="계약전력 (kW)"
                type="number"
                placeholder="예: 500"
                value={siteContractPower}
                onChange={(e) => setSiteContractPower(e.target.value)}
              />
              <Input
                label="연면적 (㎡)"
                type="number"
                placeholder="예: 3200"
                value={siteFloorArea}
                onChange={(e) => setSiteFloorArea(e.target.value)}
              />
              <Input
                label="건물 용도"
                placeholder="예: 제조 공장"
                value={siteBuildingType}
                onChange={(e) => setSiteBuildingType(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 mb-1.5 block">메모 (선택)</label>
              <textarea
                value={siteMemo}
                onChange={(e) => setSiteMemo(e.target.value)}
                rows={2}
                placeholder="추가 참고사항"
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* ── 최종 산출물 검수 (검수 대기 단계) ── */}
      {reviewOpen && (
        <Modal
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          title="최종 산출물 검수"
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setReviewOpen(false)}>
                취소
              </Button>
              <Button
                variant="primary"
                disabled={!reviewChecks.every(Boolean) || completeMilestoneMut.isPending}
                onClick={async () => {
                  await advanceMilestone();
                  setReviewOpen(false);
                  toast('success', '검수를 완료했습니다 — 다음 단계로 진행됩니다');
                }}
              >
                <CheckCircle2 size={14} className="mr-1.5" />{' '}
                {completeMilestoneMut.isPending ? '처리 중...' : '검수 완료 및 다음 단계'}
              </Button>
            </>
          }
        >
          <div className="max-h-[68vh] overflow-y-auto -mr-2 pr-2 space-y-4">
            <p className="text-sm text-slate-300">
              컨설턴트가 제출한 문서를 미리보기·다운로드로 검토하고, 아래 항목을 확인하세요. 모두 확인해야 검수를 완료할
              수 있습니다.
            </p>

            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">제출 문서 {reports.length}건</p>
              {reports.length === 0 ? (
                <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-3">
                  <p className="text-xs text-slate-400">
                    제출된 산출물이 없습니다. 컨설턴트가 문서를 업로드하면 여기에 표시됩니다.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {reports.map((doc) => (
                    <div
                      key={doc.id}
                      className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText size={16} className="text-blue-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{doc.name}</p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {DOC_TYPE_LABELS[doc.type] || doc.type}
                            {doc.authorName ? ` · ${doc.authorName}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(() => {
                          const st = doc.status ? DOC_STATUS_META[doc.status] : null;
                          return st ? (
                            <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full ring-1', st.color)}>
                              {st.label}
                            </span>
                          ) : null;
                        })()}
                        {doc.fileId && (
                          <Button size="sm" variant="ghost" onClick={() => openReportsModal(doc)}>
                            <Eye size={12} className="mr-1" /> 보기
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 검수 항목 체크리스트 */}
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">검수 항목</p>
              <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                {REVIEW_ITEMS.map((item, i) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setReviewChecks((prev) => prev.map((v, idx) => (idx === i ? !v : v)))}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded shrink-0 ring-1',
                        reviewChecks[i] ? 'bg-primary text-white ring-primary' : 'bg-white/[0.04] ring-white/[0.1]',
                      )}
                    >
                      {reviewChecks[i] && <CheckCircle2 size={12} />}
                    </span>
                    <span className={cn('text-sm', reviewChecks[i] ? 'text-white' : 'text-slate-300')}>{item}</span>
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-slate-500">※ 검수는 성공보수 지급의 기준입니다.</p>
          </div>
        </Modal>
      )}

      {/* ── 보고서 반려 (동의 단계 — 이의 제기) ── */}
      {rejectOpen && (
        <Modal
          open={rejectOpen}
          onClose={() => {
            setRejectOpen(false);
            setRejectReason('');
          }}
          title="보고서 반려 — 이의 제기"
          size="md"
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setRejectOpen(false);
                  setRejectReason('');
                }}
              >
                취소
              </Button>
              <Button variant="primary" disabled={!rejectReason.trim()} onClick={confirmReject}>
                <AlertCircle size={14} className="mr-1.5" /> 반려 사유 전달
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              보고서에 이견이 있으면 반려할 수 있습니다. 반려 사유를 작성하면 컨설턴트에게 전달되고, 채팅 조율 후
              보고서가 재작성됩니다.
            </p>
            <Textarea
              label="반려 사유"
              rows={3}
              placeholder="예: 권고 용량 근거 보완 필요 / PPA 단가 재검토 요청 / 3개년 로드맵 가정 확인"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <AlertCircle size={11} className="text-amber-300" />
              반려 시 중간보수 지급은 보류되고, 재작성 후 다시 동의 요청이 도착합니다.
            </p>
          </div>
        </Modal>
      )}

      {/* ── 문서 미리보기 (다운로드 없이 내용 확인) ── */}
      {docPreview && (
        <Modal
          open={!!docPreview}
          onClose={() => setDocPreview(null)}
          title={`미리보기 — ${docPreview.title}`}
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDocPreview(null)}>
                닫기
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  toast('success', `${docPreview.file} 다운로드를 요청했습니다`);
                }}
              >
                <Download size={14} className="mr-1.5" /> 다운로드
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {/* 문서 느낌 미리보기 */}
            <div className="rounded-lg bg-white/[0.05] ring-1 ring-white/[0.1] px-5 py-4">
              <div className="flex items-center gap-2 pb-3 border-b border-white/[0.08]">
                <FileText size={16} className="text-blue-400" />
                <div>
                  <p className="text-sm font-bold text-white">{docPreview.title}</p>
                  <p className="text-[10px] text-slate-500">
                    {docPreview.file} · 작성: {docPreview.author}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-slate-400">{docPreview.desc}</p>
              <div className="mt-2 space-y-1.5">
                {docPreview.preview.map((line: string) => (
                  <div key={line} className="flex items-start gap-2 text-xs text-slate-300">
                    <span className="text-slate-600 mt-0.5">·</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[10px] text-slate-600">— 미리보기 (요약) · 전체 내용은 다운로드 —</p>
            </div>
          </div>
        </Modal>
      )}

      {/* ── 세금계산서 (정산과 별개 — 컨설턴트가 발행, 수용가 확인) ── */}
      {taxOpen && (
        <Modal
          open={taxOpen}
          onClose={() => setTaxOpen(false)}
          title="세금계산서"
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setTaxOpen(false)}>
                닫기
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  toast('success', '세금계산서를 다운로드합니다 (홈택스 연동 — showcase)');
                }}
              >
                <Download size={14} className="mr-1.5" /> 다운로드
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                  c.contractAmount > 0
                    ? 'bg-emerald-500/[0.12] text-emerald-300 ring-emerald-500/30'
                    : 'bg-amber-500/[0.12] text-amber-300 ring-amber-500/30',
                )}
              >
                {c.contractAmount > 0 ? '발행 완료' : '미발행'}
              </span>
              <span className="text-[11px] text-slate-500">정산(보수 지급)과 별개로 발행되는 세금계산서입니다</span>
            </div>
            {c.contractAmount === 0 && (
              <div className="rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 px-3 py-2">
                <p className="text-xs text-amber-300">
                  컨설턴트 제안이 수락되면 계약 금액이 확정되어 세금계산서가 발행됩니다.
                </p>
              </div>
            )}
            <div className="rounded-lg bg-white/[0.04] ring-1 ring-white/[0.1] divide-y divide-white/[0.06] text-sm">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-slate-500 text-xs">공급자</span>
                <span className="text-slate-200">{c.consultant} 컨설턴트</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-slate-500 text-xs">공급받는자</span>
                <span className="text-slate-200">{c.client}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-slate-500 text-xs">품목</span>
                <span className="text-slate-200">{c.domain} 컨설팅 보수</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-slate-500 text-xs">공급가액</span>
                <span className="text-white tabular-nums">
                  {c.contractAmount > 0 ? `₩${c.contractAmount.toLocaleString()}` : '미확정'}
                </span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-slate-500 text-xs">세액 (10%)</span>
                <span className="text-white tabular-nums">
                  {c.contractAmount > 0 ? `₩${(c.contractAmount * 0.1).toLocaleString()}` : '미확정'}
                </span>
              </div>
              <div className="flex justify-between px-4 py-2.5 bg-white/[0.02]">
                <span className="text-slate-400 text-xs font-medium">합계 금액</span>
                <span className="text-white font-bold tabular-nums">
                  {c.contractAmount > 0 ? `₩${(c.contractAmount * 1.1).toLocaleString()}` : '미확정'}
                </span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-slate-500 text-xs">작성일자</span>
                <span className="text-slate-300 tabular-nums">{c.expectedEnd || '미정'}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              ※ 전자세금계산서는 홈택스로 발행·전송됩니다. 정산(보수 지급 일정)은 정산 메뉴에서 별도 확인하세요.
            </p>
          </div>
        </Modal>
      )}
      {/* ── 보고서별 반려 사유 입력 모달 ── */}
      {reportRejectTarget && (
        <Modal
          open={!!reportRejectTarget}
          onClose={() => {
            setReportRejectTarget(null);
            setReportRejectReason('');
          }}
          title={`보고서 반려 — ${DOC_TYPE_LABELS[reportRejectTarget.type] || reportRejectTarget.type}`}
          size="sm"
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setReportRejectTarget(null);
                  setReportRejectReason('');
                }}
              >
                취소
              </Button>
              <Button
                variant="primary"
                disabled={!reportRejectReason.trim() || rejectReportMut.isPending}
                onClick={() => {
                  rejectReportMut.mutate(
                    { reportId: reportRejectTarget.id, reason: reportRejectReason.trim() },
                    {
                      onSuccess: () => {
                        toast('info', `${DOC_TYPE_LABELS[reportRejectTarget.type] || '보고서'}를 반려했습니다`);
                        setReportRejectTarget(null);
                        setReportRejectReason('');
                      },
                      onError: () => toast('error', '반려에 실패했습니다'),
                    },
                  );
                }}
              >
                <AlertCircle size={14} className="mr-1.5" /> {rejectReportMut.isPending ? '처리 중...' : '반려'}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              이 보고서에 대한 반려 사유를 입력하세요. 컨설턴트에게 전달되어 수정 후 재제출됩니다.
            </p>
            <Textarea
              label="반려 사유"
              rows={3}
              placeholder="예: 데이터 근거 보완 필요 / 권고 용량 재검토 요청"
              value={reportRejectReason}
              onChange={(e) => setReportRejectReason(e.target.value)}
            />
          </div>
        </Modal>
      )}

      {/* ── 문서 열람 모달 (보고서 목록 + PDF 미리보기) ── */}
      {docsOpen &&
        (pdfFullscreen && pdfBlobUrl && selectedDoc ? (
          <div className="fixed inset-0 z-[80] bg-black flex flex-col">
            <div className="flex items-center justify-between bg-[#111] px-4 py-2 shrink-0">
              <span className="text-sm text-white font-medium truncate">{selectedDoc.name}</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(getDownloadUrl(selectedDoc.fileId), '_blank')}
                >
                  <Download size={13} className="mr-1" /> 다운로드
                </Button>
                <button
                  onClick={() => setPdfFullscreen(false)}
                  className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <iframe src={pdfBlobUrl} className="flex-1 w-full bg-white" title={selectedDoc.name} />
          </div>
        ) : (
          <Modal
            open={docsOpen}
            onClose={() => {
              setDocsOpen(false);
              setSelectedDoc(null);
              setPdfBlobUrl(null);
              setPdfFullscreen(false);
            }}
            title={docsMode === 'contracts' ? '계약서 검토' : '보고서 검토'}
            size="lg"
            footer={
              <Button
                variant="ghost"
                onClick={() => {
                  setDocsOpen(false);
                  setSelectedDoc(null);
                  setPdfBlobUrl(null);
                }}
              >
                닫기
              </Button>
            }
          >
            {(() => {
              const docList = docsMode === 'contracts' ? contractDocs : reports;
              return (
                <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: '400px' }}>
                  {/* 문서 목록 */}
                  <div className="lg:w-64 shrink-0 space-y-1.5">
                    <p className="text-xs text-slate-500 font-medium px-1 mb-2">
                      {docsMode === 'contracts' ? '계약서' : '문서'} 목록 ({docList.length})
                    </p>
                    <div className="max-h-[50vh] overflow-y-auto space-y-1.5 pr-1">
                      {docList.length === 0 ? (
                        <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-6 text-center">
                          <FileText size={24} className="mx-auto text-slate-600 mb-2" />
                          <p className="text-xs text-slate-500">
                            {docsMode === 'contracts' ? '계약서가 없습니다' : '문서가 없습니다'}
                          </p>
                          <p className="text-[10px] text-slate-600 mt-1">컨설턴트가 업로드하면 표시됩니다</p>
                        </div>
                      ) : (
                        docList.map((doc) => (
                          <div
                            key={doc.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleSelectDoc(doc)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') handleSelectDoc(doc);
                            }}
                            className={cn(
                              'w-full rounded-lg px-3 py-2.5 text-left ring-1 transition-all group cursor-pointer',
                              selectedDoc?.id === doc.id
                                ? 'bg-primary/10 ring-primary/30'
                                : doc.status === 'REVIEW'
                                  ? 'bg-amber-500/5 ring-amber-500/20 hover:ring-amber-500/30'
                                  : doc.status === 'REJECTED'
                                    ? 'bg-red-500/5 ring-red-500/20'
                                    : doc.fileId
                                      ? 'bg-white/[0.02] ring-white/[0.06] hover:ring-white/[0.12]'
                                      : 'bg-white/[0.01] ring-white/[0.04] opacity-50',
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={cn(
                                  'flex h-7 w-7 items-center justify-center rounded-lg shrink-0',
                                  doc.fileId ? 'bg-red-500/10' : 'bg-white/[0.04]',
                                )}
                              >
                                <File size={12} className={doc.fileId ? 'text-red-400' : 'text-slate-600'} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white truncate">{doc.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-slate-500">
                                    {DOC_TYPE_LABELS[doc.type] || doc.type}
                                  </span>
                                  {(() => {
                                    const st = doc.status ? DOC_STATUS_META[doc.status] : null;
                                    return st ? (
                                      <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full ring-1', st.color)}>
                                        {st.label}
                                      </span>
                                    ) : null;
                                  })()}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {doc.authorName && (
                                    <span className="text-[10px] text-slate-600">{doc.authorName}</span>
                                  )}
                                  {doc.uploadedAt && (
                                    <span className="text-[10px] text-slate-600">
                                      {new Date(doc.uploadedAt).toLocaleDateString('ko-KR')}
                                    </span>
                                  )}
                                  {doc.version > 1 && (
                                    <span className="text-[10px] text-slate-600">v{doc.version}</span>
                                  )}
                                </div>
                                {!(docsMode === 'contracts' ? isContractStepDone : isDocsStepDone) &&
                                  doc.status === 'REVIEW' && (
                                    <div className="flex gap-1.5 mt-2">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          approveReportMut.mutate(doc.id, {
                                            onSuccess: () =>
                                              toast('success', `${DOC_TYPE_LABELS[doc.type] || '문서'}를 승인했습니다`),
                                            onError: () => toast('error', '승인에 실패했습니다'),
                                          });
                                        }}
                                        disabled={approveReportMut.isPending}
                                        className="px-2 py-1 rounded text-[10px] font-medium bg-primary/10 text-primary ring-1 ring-primary/20 hover:bg-primary/20 transition-colors"
                                      >
                                        <CheckCircle2 size={10} className="inline mr-0.5" /> 승인
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setReportRejectTarget(doc);
                                          setReportRejectReason('');
                                        }}
                                        className="px-2 py-1 rounded text-[10px] font-medium bg-red-500/10 text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/20 transition-colors"
                                      >
                                        <AlertCircle size={10} className="inline mr-0.5" /> 반려
                                      </button>
                                    </div>
                                  )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* PDF 미리보기 */}
                  <div className="flex-1 min-w-0">
                    {selectedDoc ? (
                      <div className="space-y-2 h-full flex flex-col">
                        <div className="space-y-2 shrink-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <h3 className="text-sm font-semibold text-white truncate">{selectedDoc.name}</h3>
                              {(() => {
                                const st = selectedDoc.status ? DOC_STATUS_META[selectedDoc.status] : null;
                                return st ? (
                                  <span
                                    className={cn('text-[10px] px-2 py-0.5 rounded-full ring-1 shrink-0', st.color)}
                                  >
                                    {st.label}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {pdfBlobUrl && (
                                <Button size="sm" variant="ghost" onClick={() => setPdfFullscreen(true)}>
                                  <Maximize2 size={13} className="mr-1" /> 전체화면
                                </Button>
                              )}
                              {selectedDoc.fileId && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => window.open(getDownloadUrl(selectedDoc.fileId), '_blank')}
                                >
                                  <Download size={13} className="mr-1" /> 다운로드
                                </Button>
                              )}
                            </div>
                          </div>
                          {!(docsMode === 'contracts' ? isContractStepDone : isDocsStepDone) &&
                            selectedDoc.status === 'REVIEW' && (
                              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 ring-1 ring-amber-500/20">
                                <span className="text-xs text-amber-300 flex-1">
                                  {docsMode === 'contracts'
                                    ? '계약서 초안 검토를 완료해주세요'
                                    : '이 보고서의 검토를 완료해주세요'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    approveReportMut.mutate(selectedDoc.id, {
                                      onSuccess: () =>
                                        toast(
                                          'success',
                                          `${DOC_TYPE_LABELS[selectedDoc.type] || '문서'}를 승인했습니다`,
                                        ),
                                      onError: () => toast('error', '승인에 실패했습니다'),
                                    });
                                  }}
                                  disabled={approveReportMut.isPending}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary ring-1 ring-primary/20 hover:bg-primary/20 transition-colors"
                                >
                                  <CheckCircle2 size={12} className="inline mr-1" /> 승인
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReportRejectTarget(selectedDoc);
                                    setReportRejectReason('');
                                  }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/20 transition-colors"
                                >
                                  <AlertCircle size={12} className="inline mr-1" /> 반려
                                </button>
                              </div>
                            )}
                          {selectedDoc.status === 'APPROVED' && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 ring-1 ring-emerald-500/20">
                              <CheckCircle2 size={13} className="text-emerald-400" />
                              <span className="text-xs text-emerald-300">승인 완료된 보고서입니다</span>
                            </div>
                          )}
                          {selectedDoc.status === 'REJECTED' && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/5 ring-1 ring-red-500/20">
                              <AlertCircle size={13} className="text-red-400" />
                              <span className="text-xs text-red-300">반려됨 — 컨설턴트의 수정을 기다리는 중입니다</span>
                            </div>
                          )}
                          {selectedDoc.status === 'DRAFT' && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/5 ring-1 ring-blue-500/20">
                              <Clock size={13} className="text-blue-400" />
                              <span className="text-xs text-blue-300">컨설턴트가 아직 검토 요청을 하지 않았습니다</span>
                            </div>
                          )}
                        </div>
                        <div className="rounded-xl bg-white overflow-hidden flex-1" style={{ minHeight: '350px' }}>
                          {pdfLoading ? (
                            <div
                              className="w-full h-full flex items-center justify-center bg-slate-100"
                              style={{ minHeight: '350px' }}
                            >
                              <Loader2 className="animate-spin text-slate-400" size={28} />
                            </div>
                          ) : pdfBlobUrl ? (
                            <iframe
                              src={pdfBlobUrl}
                              className="w-full h-full"
                              style={{ minHeight: '350px' }}
                              title={selectedDoc.name}
                            />
                          ) : (
                            <div
                              className="w-full h-full flex items-center justify-center bg-slate-50"
                              style={{ minHeight: '350px' }}
                            >
                              <p className="text-sm text-slate-400">PDF를 불러올 수 없습니다</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        className="rounded-xl bg-white/[0.02] ring-1 ring-white/[0.06] flex flex-col items-center justify-center"
                        style={{ minHeight: '350px' }}
                      >
                        <FileText size={28} className="text-slate-600 mb-3" />
                        <p className="text-sm text-slate-400">
                          {docList.length === 0
                            ? '컨설턴트가 업로드하면 여기에서 열람할 수 있습니다'
                            : '문서를 선택하면 미리보기가 표시됩니다'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </Modal>
        ))}

      {selectedSite && (
        <Modal open={!!selectedSite} onClose={() => setSelectedSite(null)} title="사업장 상세 정보">
          {(() => {
            const site = selectedSite;
            const ST_LABELS: Record<string, string> = {
              HEAD: '본사',
              FACTORY: '공장',
              OFFICE: '사무실/빌딩',
              RETAIL: '매점/상업',
              WAREHOUSE: '창고/물류',
              BRANCH: '지사',
              OTHER: '기타',
            };
            const fields = [
              { label: '사업장명', value: site.name || site.siteName },
              { label: '사업장 유형', value: ST_LABELS[site.siteType] || site.siteType },
              { label: '주소', value: site.address },
              {
                label: '계약전력',
                value: site.contractPowerKw ? `${Number(site.contractPowerKw).toLocaleString()} kW` : null,
              },
              { label: '연면적', value: site.floorArea ? `${Number(site.floorArea).toLocaleString()} m²` : null },
              { label: '건물 용도', value: site.buildingType },
              { label: '메모', value: site.memo },
            ];
            return (
              <div className="space-y-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <Building2 size={18} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">{site.name || site.siteName}</p>
                    {site.siteType && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.05] ring-1 ring-white/[0.1] text-slate-400">
                        {ST_LABELS[site.siteType] || site.siteType}
                      </span>
                    )}
                  </div>
                </div>
                <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] divide-y divide-white/[0.06]">
                  {fields
                    .filter((f) => f.value)
                    .map((f) => (
                      <div key={f.label} className="flex justify-between px-4 py-2.5">
                        <span className="text-xs text-slate-500">{f.label}</span>
                        <span className="text-sm text-slate-200 text-right max-w-[60%]">{f.value}</span>
                      </div>
                    ))}
                </div>
                <div className="flex justify-end pt-3">
                  <Button variant="ghost" onClick={() => setSelectedSite(null)}>
                    닫기
                  </Button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}
