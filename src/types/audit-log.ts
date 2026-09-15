export interface AuditLog {
  id: number;
  userId: number;
  userName: string;
  action: string;
  entityType: string;
  entityId?: number;
  detail?: string;
  ipAddress?: string;
  createdAt: string;
}
