import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { Consultation, Diagnosis, PageResponse } from '@/types';

export interface ChatMessage {
  id: number;
  consultationId: number;
  senderId: number;
  senderName: string;
  content: string;
  messageType: string;
  createdAt: string;
}

export interface ChatMessagePage {
  content: ChatMessage[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export async function getConsultations(params?: object): Promise<PageResponse<Consultation>> {
  return getApiClient().get(ENDPOINTS.consultations.list, params);
}

export async function getConsultation(id: number): Promise<Consultation> {
  return getApiClient().get(ENDPOINTS.consultations.detail(id));
}

export async function getConsultationsByCompany(companyId: number): Promise<Consultation[]> {
  return getApiClient().get(ENDPOINTS.consultations.byCompany(companyId));
}

export async function getConsultationsByConsultant(consultantId: number): Promise<Consultation[]> {
  return getApiClient().get(ENDPOINTS.consultations.byConsultant(consultantId));
}

export async function createConsultation(data: object): Promise<Consultation> {
  return getApiClient().post(ENDPOINTS.consultations.list, data);
}

// ── Diagnosis ──

export async function createDiagnosis(data: object): Promise<Diagnosis> {
  return getApiClient().post(ENDPOINTS.consultations.diagnoses, data);
}

export async function getDiagnosis(id: number): Promise<Diagnosis> {
  return getApiClient().get(ENDPOINTS.consultations.diagnosisDetail(id));
}

export async function deleteDiagnosis(id: number): Promise<void> {
  return getApiClient().delete(ENDPOINTS.consultations.diagnosisDetail(id));
}

export async function getDiagnosesByCompany(companyId: number): Promise<Diagnosis[]> {
  return getApiClient().get(ENDPOINTS.consultations.diagnosesByCompany(companyId));
}

export async function getRecentDiagnoses(companyId: number): Promise<Diagnosis[]> {
  return getApiClient().get(ENDPOINTS.consultations.recentDiagnoses(companyId));
}

export async function getRecentEnergyData(companyId: number): Promise<RecentEnergyData> {
  return getApiClient().get(ENDPOINTS.consultations.recentEnergyData(companyId));
}

export interface SurveyItem {
  surveyId: number;
  consultationId: number;
  domain: string;
  companyName: string;
  industry: string;
  companySize: string;
  annualEnergyUsage: number | null;
  annualGhgEmission: number | null;
  currentElecCost: number | null;
  budgetRange: string | null;
  currentREMethods: string | null;
  consultingDrivers: string | null;
  exportCountries: string | null;
  siteCount: number | null;
  siteRegions: string | null;
  annualRevenue: number | null;
  employeeCount: number | null;
  scope1Emission: number | null;
  scope2Emission: number | null;
  scope3Emission: number | null;
  carbonTargetPercent: number | null;
  carbonMethods: string | null;
  etsParticipant: boolean | null;
  cdpParticipant: boolean | null;
  sbtiCommitted: boolean | null;
  rooftopArea: number | null;
  peakDemand: number | null;
  monthlyPeakCost: number | null;
  existingDER: string | null;
  gridType: string | null;
  essInterest: boolean | null;
  evChargerInterest: boolean | null;
  createdAt: string;
}

export interface RecentEnergyData {
  diagnoses: Diagnosis[];
  surveys: SurveyItem[];
}

export async function assignConsultant(id: number, consultantId: number): Promise<void> {
  return getApiClient().patch(`${ENDPOINTS.consultations.assign(id)}?consultantId=${consultantId}`);
}

export async function completeConsultation(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.consultations.complete(id));
}

export async function cancelConsultation(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.consultations.cancel(id));
}

export async function deleteConsultation(id: number): Promise<void> {
  return getApiClient().delete(ENDPOINTS.consultations.detail(id));
}

export async function getMilestones(consultationId: number): Promise<unknown[]> {
  return getApiClient().get(ENDPOINTS.consultations.milestones(consultationId));
}

export async function startMilestone(milestoneId: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.consultations.startMilestone(milestoneId));
}

export async function completeMilestone(milestoneId: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.consultations.completeMilestone(milestoneId));
}

export async function getReview(consultationId: number): Promise<unknown> {
  return getApiClient().get(ENDPOINTS.consultations.review(consultationId));
}

export async function createReview(
  consultationId: number,
  params: {
    reviewerId: number;
    expertise: number;
    communication: number;
    timeliness: number;
    quality: number;
    recommendation: number;
    comment?: string;
  },
): Promise<unknown> {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return getApiClient().post(`${ENDPOINTS.consultations.review(consultationId)}?${qs}`);
}

export async function getProfiles(params?: object): Promise<PageResponse<unknown>> {
  return getApiClient().get(ENDPOINTS.consultations.profiles, params);
}

export async function getProfile(id: number): Promise<unknown> {
  return getApiClient().get(ENDPOINTS.consultations.profileDetail(id));
}

export async function getProfileByUser(userId: number): Promise<unknown> {
  return getApiClient().get(ENDPOINTS.consultations.profileByUser(userId));
}

export async function getProposals(consultationId: number): Promise<unknown[]> {
  return getApiClient().get(ENDPOINTS.consultations.proposals(consultationId));
}

export async function acceptProposal(proposalId: number): Promise<unknown> {
  return getApiClient().patch(ENDPOINTS.consultations.acceptProposal(proposalId));
}

export async function getReports(consultationId: number): Promise<unknown[]> {
  return getApiClient().get(ENDPOINTS.consultations.reports(consultationId));
}

export async function createReport(
  consultationId: number,
  reportType: string,
  authorId: number,
): Promise<unknown> {
  return getApiClient().post(
    `${ENDPOINTS.consultations.reports(consultationId)}?reportType=${reportType}&authorId=${authorId}`,
  );
}

export async function approveReport(reportId: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.consultations.approveReport(reportId));
}

export async function requestReviewReport(reportId: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.consultations.requestReviewReport(reportId));
}

export async function rejectReport(reportId: number, reason: string): Promise<void> {
  return getApiClient().patch(
    `${ENDPOINTS.consultations.rejectReport(reportId)}?reason=${encodeURIComponent(reason)}`,
  );
}

export async function getReportComments(reportId: number): Promise<unknown[]> {
  return getApiClient().get(ENDPOINTS.consultations.reportComments(reportId));
}

export async function addReportComment(
  reportId: number,
  params: {
    authorId: number;
    authorRole: string;
    content: string;
  },
): Promise<unknown> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  return getApiClient().post(`${ENDPOINTS.consultations.reportComments(reportId)}?${qs}`);
}

export async function getSettlements(consultationId: number): Promise<unknown[]> {
  return getApiClient().get(ENDPOINTS.consultations.settlements(consultationId));
}

export async function approveSettlement(settlementId: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.consultations.approveSettlement(settlementId));
}

export async function paySettlement(settlementId: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.consultations.paySettlement(settlementId));
}

export async function issueInvoice(settlementId: number): Promise<unknown> {
  return getApiClient().post(ENDPOINTS.consultations.issueInvoice(settlementId));
}

export async function getCertifications(profileId: number): Promise<unknown[]> {
  return getApiClient().get(ENDPOINTS.consultations.certifications(profileId));
}

export async function getSpecializations(profileId: number): Promise<string[]> {
  return getApiClient().get(ENDPOINTS.consultations.specializations(profileId));
}

export async function getSites(consultationId: number): Promise<unknown[]> {
  return getApiClient().get(ENDPOINTS.consultations.sites(consultationId));
}

export async function createSite(consultationId: number, data: object): Promise<unknown> {
  return getApiClient().post(ENDPOINTS.consultations.sites(consultationId), data);
}

export async function deleteSite(siteId: number): Promise<void> {
  return getApiClient().delete(ENDPOINTS.consultations.deleteSite(siteId));
}

export async function getRevisions(consultationId: number): Promise<unknown[]> {
  return getApiClient().get(ENDPOINTS.consultations.revisions(consultationId));
}

export async function getSurvey(consultationId: number): Promise<unknown> {
  return getApiClient().get(ENDPOINTS.consultations.survey(consultationId));
}

export async function createSurvey(consultationId: number, data: object): Promise<unknown> {
  return getApiClient().post(ENDPOINTS.consultations.createSurvey(consultationId), data);
}

export async function transitionStatus(consultationId: number, status: string): Promise<void> {
  return getApiClient().patch(
    `${ENDPOINTS.consultations.transitionStatus(consultationId)}?status=${status}`,
  );
}

export async function createMilestone(consultationId: number, data: object): Promise<unknown> {
  return getApiClient().post(ENDPOINTS.consultations.createMilestone(consultationId), data);
}

export async function createProposal(data: object): Promise<unknown> {
  return getApiClient().post(ENDPOINTS.consultations.createProposal, data);
}

export async function getProposalsByProfile(profileId: number): Promise<unknown[]> {
  return getApiClient().get(ENDPOINTS.consultations.proposalsByProfile(profileId));
}

export async function getProposalsByCompany(companyId: number): Promise<unknown[]> {
  return getApiClient().get(ENDPOINTS.consultations.proposalsByCompany(companyId));
}

export async function updateProposal(proposalId: number, data: object): Promise<unknown> {
  return getApiClient().patch(ENDPOINTS.consultations.updateProposal(proposalId), data);
}

export async function getDiagnoses(): Promise<Diagnosis[]> {
  return getApiClient().get(ENDPOINTS.consultations.diagnoses);
}

export async function declineProposal(proposalId: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.consultations.declineProposal(proposalId));
}

export async function createSettlement(consultationId: number, data: object): Promise<unknown> {
  return getApiClient().post(ENDPOINTS.consultations.createSettlement(consultationId), data);
}

export async function updateProfile(profileId: number, data: object): Promise<unknown> {
  return getApiClient().patch(ENDPOINTS.consultations.updateProfile(profileId), data);
}

export async function getReferralsByProfile(profileId: number): Promise<unknown[]> {
  return getApiClient().get(ENDPOINTS.consultations.referralsByProfile(profileId));
}

export async function createReferral(data: {
  profileId: number;
  domain: string;
  inviteeEmail?: string;
  message?: string;
}): Promise<unknown> {
  const code = 'REF-' + crypto.randomUUID().slice(0, 8).toUpperCase();
  const params = new URLSearchParams({
    profileId: String(data.profileId),
    domain: data.domain,
    referralCode: code,
  });
  if (data.inviteeEmail) params.set('inviteeEmail', data.inviteeEmail);
  if (data.message) params.set('message', data.message);
  return getApiClient().post(`${ENDPOINTS.consultations.createReferral}?${params.toString()}`);
}

export async function acceptReferral(
  referralId: number,
  clientCompanyId: number,
): Promise<unknown> {
  return getApiClient().patch(
    `${ENDPOINTS.consultations.acceptReferral(referralId)}?clientCompanyId=${clientCompanyId}`,
  );
}

export async function getSettlementsByConsultant(consultantId: number): Promise<unknown[]> {
  return getApiClient().get(ENDPOINTS.consultations.settlementsByConsultant(consultantId));
}

export async function getChatMessages(
  consultationId: number,
  page = 0,
  size = 50,
): Promise<ChatMessagePage> {
  return getApiClient().get(ENDPOINTS.consultations.chat(consultationId), { page, size });
}

export async function sendChatMessage(
  consultationId: number,
  content: string,
  messageType = 'TEXT',
): Promise<ChatMessage> {
  return getApiClient().post(ENDPOINTS.consultations.chat(consultationId), {
    content,
    messageType,
  });
}

export interface ConsultationSchedule {
  id: number;
  consultationId: number;
  requesterId: number;
  requesterName: string;
  scheduledDate: string;
  scheduledTime: string;
  memo: string | null;
  status:
    | 'REQUESTED'
    | 'CONFIRMED'
    | 'CANCELLED'
    | 'ACCEPTED'
    | 'REJECTED'
    | 'RESCHEDULE_REQUESTED';
  confirmedAt: string | null;
  cancelledAt: string | null;
  rejectionReason: string | null;
  proposedDate: string | null;
  proposedTime: string | null;
  respondentId: number | null;
  respondentName: string | null;
  respondedAt: string | null;
  createdAt: string;
}

export async function getSchedules(consultationId: number): Promise<ConsultationSchedule[]> {
  return getApiClient().get(ENDPOINTS.consultations.schedules(consultationId));
}

export async function createSchedule(
  consultationId: number,
  data: {
    scheduledDate: string;
    scheduledTime: string;
    memo?: string;
  },
): Promise<ConsultationSchedule> {
  return getApiClient().post(ENDPOINTS.consultations.schedules(consultationId), data);
}

export async function confirmSchedule(scheduleId: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.consultations.confirmSchedule(scheduleId));
}

export async function cancelSchedule(scheduleId: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.consultations.cancelSchedule(scheduleId));
}

export async function respondToSchedule(
  scheduleId: number,
  data: {
    action: 'ACCEPT' | 'REJECT' | 'RESCHEDULE';
    reason?: string;
    proposedDate?: string;
    proposedTime?: string;
  },
): Promise<ConsultationSchedule> {
  return getApiClient().patch(ENDPOINTS.consultations.respondSchedule(scheduleId), data);
}

export async function getPendingSchedules(companyId: number): Promise<ConsultationSchedule[]> {
  return getApiClient().get(ENDPOINTS.consultations.pendingSchedules(companyId));
}

export async function getSchedulesByConsultant(
  consultantId: number,
): Promise<ConsultationSchedule[]> {
  return getApiClient().get(ENDPOINTS.consultations.schedulesByConsultant(consultantId));
}

export async function getReferralAnalytics(): Promise<unknown> {
  return getApiClient().get(ENDPOINTS.consultations.referralAnalytics);
}

export async function spcReviewReport(reportId: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.consultations.spcReviewReport(reportId));
}

export async function spcApproveReport(reportId: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.consultations.spcApproveReport(reportId));
}

export async function getRecommendedProfiles(params?: {
  domain?: string;
  region?: string;
  maxResults?: number;
}): Promise<unknown[]> {
  return getApiClient().get(ENDPOINTS.consultations.recommendProfiles, params);
}

export async function getTradingRequests(consultationId: number): Promise<unknown[]> {
  return getApiClient().get(ENDPOINTS.consultations.tradingRequests(consultationId));
}
