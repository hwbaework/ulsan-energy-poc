import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as consultationApi from '@/api/consulting/consultations';
import { consultationKeys, consultantKeys, diagnosisKeys } from '@/api/queryKeys';
import { useChat } from './useChat';

export const useConsultations = (params?: object, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: consultationKeys.list(params ?? {}),
    queryFn: () => consultationApi.getConsultations(params),
    staleTime: 30_000,
    enabled: options?.enabled,
  });
};

export const useConsultation = (id: number) => {
  return useQuery({
    queryKey: consultationKeys.detail(id),
    queryFn: () => consultationApi.getConsultation(id),
    enabled: !!id,
  });
};

export const useConsultationsByCompany = (companyId: number) => {
  return useQuery({
    queryKey: consultationKeys.byCompany(companyId),
    queryFn: () => consultationApi.getConsultationsByCompany(companyId),
    enabled: !!companyId,
  });
};

export const useConsultationsByConsultant = (consultantId: number) => {
  return useQuery({
    queryKey: consultationKeys.byConsultant(consultantId),
    queryFn: () => consultationApi.getConsultationsByConsultant(consultantId),
    enabled: !!consultantId,
  });
};

// ── Diagnosis hooks ──

export const useCreateDiagnosis = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: object) => consultationApi.createDiagnosis(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: diagnosisKeys.all });
    },
  });
};

export const useDiagnosis = (id: number) => {
  return useQuery({
    queryKey: diagnosisKeys.detail(id),
    queryFn: () => consultationApi.getDiagnosis(id),
    enabled: !!id,
  });
};

export const useDeleteDiagnosis = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => consultationApi.deleteDiagnosis(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: diagnosisKeys.all });
    },
  });
};

export const useDiagnosesByCompany = (companyId: number) => {
  return useQuery({
    queryKey: diagnosisKeys.byCompany(companyId),
    queryFn: () => consultationApi.getDiagnosesByCompany(companyId),
    enabled: !!companyId,
  });
};

export const useRecentDiagnoses = (companyId: number) => {
  return useQuery({
    queryKey: diagnosisKeys.recent(companyId),
    queryFn: () => consultationApi.getRecentDiagnoses(companyId),
    enabled: !!companyId,
  });
};

export const useRecentEnergyData = (companyId: number) => {
  return useQuery({
    queryKey: [...diagnosisKeys.recent(companyId), 'energy-data'],
    queryFn: () => consultationApi.getRecentEnergyData(companyId),
    enabled: !!companyId,
  });
};

export const useCreateConsultation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: object) => consultationApi.createConsultation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.lists() });
    },
  });
};

export const useAssignConsultant = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, consultantId }: { id: number; consultantId: number }) =>
      consultationApi.assignConsultant(id, consultantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
    },
  });
};

export const useCompleteConsultation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => consultationApi.completeConsultation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
    },
  });
};

export const useCancelConsultation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => consultationApi.cancelConsultation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
    },
  });
};

export const useDeleteConsultation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => consultationApi.deleteConsultation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
    },
  });
};

export const useMilestones = (consultationId: number) => {
  return useQuery({
    queryKey: consultationKeys.milestones(consultationId),
    queryFn: () => consultationApi.getMilestones(consultationId),
    enabled: !!consultationId,
    refetchInterval: 10_000,
  });
};

export const useStartMilestone = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (milestoneId: number) => consultationApi.startMilestone(milestoneId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
    },
  });
};

export const useCompleteMilestone = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (milestoneId: number) => consultationApi.completeMilestone(milestoneId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
    },
  });
};

export const useReview = (consultationId: number) => {
  return useQuery({
    queryKey: consultationKeys.review(consultationId),
    queryFn: () => consultationApi.getReview(consultationId),
    enabled: !!consultationId,
  });
};

export const useProfiles = (params?: object) => {
  return useQuery({
    queryKey: consultantKeys.list(params ?? {}),
    queryFn: () => consultationApi.getProfiles(params),
    staleTime: 30_000,
  });
};

// 추천 컨설턴트(매칭) — /consulting/match 목록에서 사용
export const useRecommendedConsultants = (params?: {
  domain?: string;
  region?: string;
  maxResults?: number;
}) => {
  return useQuery({
    queryKey: [...consultantKeys.list(params ?? {}), 'recommend'],
    queryFn: () => consultationApi.getRecommendedProfiles(params),
    staleTime: 30_000,
  });
};

export const useProfile = (id: number) => {
  return useQuery({
    queryKey: consultantKeys.detail(id),
    queryFn: () => consultationApi.getProfile(id),
    enabled: !!id,
  });
};

export const useProfileByUser = (userId: number) => {
  return useQuery({
    queryKey: consultantKeys.byUser(userId),
    queryFn: () => consultationApi.getProfileByUser(userId),
    enabled: !!userId,
  });
};

export const useProposals = (consultationId: number) => {
  return useQuery({
    queryKey: consultationKeys.proposals(consultationId),
    queryFn: () => consultationApi.getProposals(consultationId),
    enabled: !!consultationId,
  });
};

export const useAcceptProposal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: number) => consultationApi.acceptProposal(proposalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
      queryClient.invalidateQueries({ queryKey: consultantKeys.all });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
};

export const useReports = (consultationId: number) => {
  return useQuery({
    queryKey: consultationKeys.reports(consultationId),
    queryFn: () => consultationApi.getReports(consultationId),
    enabled: !!consultationId,
  });
};

export const useApproveReport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reportId: number) => consultationApi.approveReport(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
    },
  });
};

export const useRequestReviewReport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reportId: number) => consultationApi.requestReviewReport(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
    },
  });
};

export const useRejectReport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, reason }: { reportId: number; reason: string }) =>
      consultationApi.rejectReport(reportId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
    },
  });
};

export const useSettlements = (consultationId: number) => {
  return useQuery({
    queryKey: consultationKeys.settlements(consultationId),
    queryFn: () => consultationApi.getSettlements(consultationId),
    enabled: !!consultationId,
  });
};

export const useSites = (consultationId: number) => {
  return useQuery({
    queryKey: consultationKeys.sites(consultationId),
    queryFn: () => consultationApi.getSites(consultationId),
    enabled: !!consultationId,
  });
};

export const useCreateSite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ consultationId, data }: { consultationId: number; data: object }) =>
      consultationApi.createSite(consultationId, data),
    onSuccess: (_, { consultationId }) => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.sites(consultationId) });
    },
  });
};

export const useRevisions = (consultationId: number) => {
  return useQuery({
    queryKey: consultationKeys.revisions(consultationId),
    queryFn: () => consultationApi.getRevisions(consultationId),
    enabled: !!consultationId,
  });
};

export const useSurvey = (consultationId: number) => {
  return useQuery({
    queryKey: consultationKeys.survey(consultationId),
    queryFn: () => consultationApi.getSurvey(consultationId),
    enabled: !!consultationId,
  });
};

export const useCreateSurvey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ consultationId, data }: { consultationId: number; data: object }) =>
      consultationApi.createSurvey(consultationId, data),
    onSuccess: (_, { consultationId }) => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.survey(consultationId) });
      queryClient.invalidateQueries({ queryKey: consultationKeys.milestones(consultationId) });
      queryClient.invalidateQueries({ queryKey: consultationKeys.detail(consultationId) });
    },
  });
};

export const useTransitionStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ consultationId, status }: { consultationId: number; status: string }) =>
      consultationApi.transitionStatus(consultationId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
    },
  });
};

export const useCreateMilestone = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ consultationId, data }: { consultationId: number; data: object }) =>
      consultationApi.createMilestone(consultationId, data),
    onSuccess: (_, { consultationId }) => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.milestones(consultationId) });
    },
  });
};

export const useDiagnoses = () => {
  return useQuery({
    queryKey: diagnosisKeys.lists(),
    queryFn: () => consultationApi.getDiagnoses(),
  });
};

export const useProposalsByProfile = (profileId: number) => {
  return useQuery({
    queryKey: [...consultantKeys.detail(profileId), 'proposals'] as const,
    queryFn: () => consultationApi.getProposalsByProfile(profileId),
    enabled: !!profileId,
  });
};

export const useProposalsByCompany = (companyId: number) => {
  return useQuery({
    queryKey: ['proposals', 'by-company', companyId] as const,
    queryFn: () => consultationApi.getProposalsByCompany(companyId),
    enabled: companyId > 0,
  });
};

export const useCreateProposal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: object) => consultationApi.createProposal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
      queryClient.invalidateQueries({ queryKey: consultantKeys.all });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
};

export const useUpdateProposal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ proposalId, data }: { proposalId: number; data: object }) =>
      consultationApi.updateProposal(proposalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
      queryClient.invalidateQueries({ queryKey: consultantKeys.all });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
};

export const useDeclineProposal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: number) => consultationApi.declineProposal(proposalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
      queryClient.invalidateQueries({ queryKey: consultantKeys.all });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
};

export const useCreateSettlement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ consultationId, data }: { consultationId: number; data: object }) =>
      consultationApi.createSettlement(consultationId, data),
    onSuccess: (_, { consultationId }) => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.settlements(consultationId) });
    },
  });
};

export const useCreateReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      consultationId,
      params,
    }: {
      consultationId: number;
      params: Parameters<typeof consultationApi.createReview>[1];
    }) => consultationApi.createReview(consultationId, params),
    onSuccess: (_, { consultationId }) => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.review(consultationId) });
    },
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, data }: { profileId: number; data: object }) =>
      consultationApi.updateProfile(profileId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultantKeys.all });
    },
  });
};

export const useCreateReport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      consultationId,
      reportType,
      authorId,
    }: {
      consultationId: number;
      reportType: string;
      authorId: number;
    }) => consultationApi.createReport(consultationId, reportType, authorId),
    onSuccess: (_, { consultationId }) => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.reports(consultationId) });
    },
  });
};

export const useAddReportComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      reportId,
      params,
    }: {
      reportId: number;
      params: Parameters<typeof consultationApi.addReportComment>[1];
    }) => consultationApi.addReportComment(reportId, params),
    onSuccess: (_, { reportId }) => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.reportComments(reportId) });
    },
  });
};

export const useApproveSettlement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settlementId: number) => consultationApi.approveSettlement(settlementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
    },
  });
};

export const usePaySettlement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settlementId: number) => consultationApi.paySettlement(settlementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
    },
  });
};

export const useIssueInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settlementId: number) => consultationApi.issueInvoice(settlementId),
    onSuccess: () => {
      // 세금계산서 목록은 settlementsByConsultant(consultantKeys) 원천이므로 양쪽 무효화.
      queryClient.invalidateQueries({ queryKey: consultantKeys.all });
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
    },
  });
};

export const useDeleteSite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (siteId: number) => consultationApi.deleteSite(siteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
    },
  });
};

export const useReportComments = (reportId: number) => {
  return useQuery({
    queryKey: consultationKeys.reportComments(reportId),
    queryFn: () => consultationApi.getReportComments(reportId),
    enabled: !!reportId,
  });
};

export const useReferralsByProfile = (profileId: number) => {
  return useQuery({
    queryKey: consultantKeys.referrals(profileId),
    queryFn: () => consultationApi.getReferralsByProfile(profileId),
    enabled: !!profileId,
  });
};

export const useCreateReferral = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof consultationApi.createReferral>[0]) =>
      consultationApi.createReferral(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultantKeys.all });
    },
  });
};

export const useAcceptReferral = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      referralId,
      clientCompanyId,
    }: {
      referralId: number;
      clientCompanyId: number;
    }) => consultationApi.acceptReferral(referralId, clientCompanyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultantKeys.all });
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
    },
  });
};

export const useSettlementsByConsultant = (consultantId: number) => {
  return useQuery({
    queryKey: consultantKeys.settlementsByConsultant(consultantId),
    queryFn: () => consultationApi.getSettlementsByConsultant(consultantId),
    enabled: !!consultantId,
  });
};

export const useChatMessages = (consultationId: number, wsConnected = false) => {
  return useQuery({
    queryKey: consultationKeys.chat(consultationId),
    queryFn: () => consultationApi.getChatMessages(consultationId),
    enabled: !!consultationId,
    refetchInterval: wsConnected ? false : 3_000,
  });
};

export const useLiveChat = (consultationId: number) => {
  const queryClient = useQueryClient();
  return useChat({
    consultationId,
    enabled: !!consultationId,
    onMessage: (msg) => {
      queryClient.setQueryData(consultationKeys.chat(consultationId), (old: any) => {
        const list = Array.isArray(old) ? old : (old?.content ?? []);
        if (list.some((m: any) => m.id === msg.id)) return list;
        return [...list.filter((m: any) => !m._optimistic), msg];
      });
    },
  });
};

export const useSendChatMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      consultationId,
      content,
      messageType,
    }: {
      consultationId: number;
      content: string;
      messageType?: string;
    }) => consultationApi.sendChatMessage(consultationId, content, messageType),
    onMutate: async ({ consultationId, content }) => {
      await queryClient.cancelQueries({ queryKey: consultationKeys.chat(consultationId) });
      const prev = queryClient.getQueryData(consultationKeys.chat(consultationId));
      queryClient.setQueryData(consultationKeys.chat(consultationId), (old: any) => {
        const list = Array.isArray(old) ? old : (old?.content ?? []);
        const optimistic = {
          id: Date.now(),
          senderId: -1,
          senderName: '',
          content,
          messageType: 'TEXT',
          createdAt: new Date().toISOString(),
          _optimistic: true,
        };
        return [...list, optimistic];
      });
      return { prev };
    },
    onError: (_err, { consultationId }, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(consultationKeys.chat(consultationId), ctx.prev);
    },
    onSettled: (_, __, { consultationId }) => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.chat(consultationId) });
    },
  });
};

export const useSchedules = (consultationId: number) => {
  return useQuery({
    queryKey: consultationKeys.schedules(consultationId),
    queryFn: () => consultationApi.getSchedules(consultationId),
    enabled: !!consultationId,
    refetchInterval: 20_000,
  });
};

export const useCreateSchedule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      consultationId,
      data,
    }: {
      consultationId: number;
      data: { scheduledDate: string; scheduledTime: string; memo?: string };
    }) => consultationApi.createSchedule(consultationId, data),
    onSuccess: (_, { consultationId }) => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.schedules(consultationId) });
    },
  });
};

export const useConfirmSchedule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scheduleId: number) => consultationApi.confirmSchedule(scheduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
    },
  });
};

export const useCancelSchedule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scheduleId: number) => consultationApi.cancelSchedule(scheduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
    },
  });
};

export const useRespondToSchedule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scheduleId,
      data,
    }: {
      scheduleId: number;
      data: {
        action: 'ACCEPT' | 'REJECT' | 'RESCHEDULE';
        reason?: string;
        proposedDate?: string;
        proposedTime?: string;
      };
    }) => consultationApi.respondToSchedule(scheduleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKeys.all });
    },
  });
};

export const usePendingSchedules = (companyId: number) => {
  return useQuery({
    queryKey: [...consultationKeys.all, 'pending-schedules', companyId],
    queryFn: () => consultationApi.getPendingSchedules(companyId),
    enabled: !!companyId,
    refetchInterval: 30_000,
  });
};

export const useSchedulesByConsultant = (consultantId: number) => {
  return useQuery({
    queryKey: [...consultationKeys.all, 'schedules-by-consultant', consultantId],
    queryFn: () => consultationApi.getSchedulesByConsultant(consultantId),
    enabled: !!consultantId,
    refetchInterval: 30_000,
  });
};
