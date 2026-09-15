import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { Invitation, CreateInvitationRequest, PageResponse } from '@/types';

export async function getInvitations(params?: object): Promise<PageResponse<Invitation>> {
  return getApiClient().get(ENDPOINTS.invitations.list, params);
}

export async function createInvitation(
  data: CreateInvitationRequest,
  invitedById: number,
): Promise<Invitation> {
  return getApiClient().post(`${ENDPOINTS.invitations.create}?invitedById=${invitedById}`, data);
}

export async function getInvitationInfo(token: string): Promise<Invitation> {
  return getApiClient().get(`${ENDPOINTS.invitations.info}?token=${encodeURIComponent(token)}`);
}

export async function acceptInvitation(token: string): Promise<void> {
  return getApiClient().post(`${ENDPOINTS.invitations.accept}?token=${encodeURIComponent(token)}`);
}

export async function resendInvitation(id: number): Promise<Invitation> {
  return getApiClient().post(ENDPOINTS.invitations.resend(id));
}

export async function cancelInvitation(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.invitations.cancel(id));
}
