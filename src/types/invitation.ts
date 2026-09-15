export interface Invitation {
  id: number;
  companyId: number;
  companyName: string;
  email: string;
  roleName: string;
  invitedByName: string;
  status: string;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
}

export interface CreateInvitationRequest {
  companyId: number;
  email: string;
  roleId: number;
}
