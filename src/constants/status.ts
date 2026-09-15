import type { BadgeVariant } from '@/components/ui/Badge';

export interface StatusConfig {
  label: string;
  variant: BadgeVariant;
}

export const PLANT_STATUS: Record<string, StatusConfig> = {
  normal: { label: '정상', variant: 'success' },
  maintenance: { label: '점검', variant: 'warning' },
  fault: { label: '이상', variant: 'danger' },
  offline: { label: '오프라인', variant: 'default' },
};

export const CONTRACT_STATUS: Record<string, StatusConfig> = {
  active: { label: '이행 중', variant: 'success' },
  pending: { label: '대기', variant: 'warning' },
  terminated: { label: '해지', variant: 'danger' },
  expired: { label: '만료', variant: 'default' },
  suspended: { label: '일시 중단', variant: 'warning' },
};

export const APPROVAL_STATUS: Record<string, StatusConfig> = {
  pending: { label: '대기', variant: 'warning' },
  approved: { label: '승인', variant: 'success' },
  rejected: { label: '반려', variant: 'danger' },
  cancelled: { label: '취소', variant: 'default' },
};

export const SETTLEMENT_STATUS: Record<string, StatusConfig> = {
  pending: { label: '정산 대기', variant: 'warning' },
  completed: { label: '정산 완료', variant: 'success' },
  overdue: { label: '미수금', variant: 'danger' },
  partial: { label: '부분 입금', variant: 'info' },
};

export const PROJECT_STATUS: Record<string, StatusConfig> = {
  draft: { label: '초안', variant: 'default' },
  in_progress: { label: '진행 중', variant: 'primary' },
  review: { label: '검토 중', variant: 'warning' },
  completed: { label: '완료', variant: 'success' },
  cancelled: { label: '취소', variant: 'danger' },
};

export const PROPOSAL_STATUS: Record<string, StatusConfig> = {
  PENDING: { label: '대기', variant: 'warning' },
  ACCEPTED: { label: '수락', variant: 'success' },
  REJECTED: { label: '거절', variant: 'danger' },
  EXPIRED: { label: '만료', variant: 'default' },
};

export const MAINTENANCE_STATUS: Record<string, StatusConfig> = {
  scheduled: { label: '예정', variant: 'info' },
  in_progress: { label: '진행 중', variant: 'warning' },
  completed: { label: '완료', variant: 'success' },
  cancelled: { label: '취소', variant: 'default' },
};

export const REC_STATUS: Record<string, StatusConfig> = {
  pending: { label: '심사 중', variant: 'warning' },
  approved: { label: '승인', variant: 'success' },
  rejected: { label: '반려', variant: 'danger' },
  issued: { label: '발급', variant: 'primary' },
};

export const INVOICE_STATUS: Record<string, StatusConfig> = {
  issued: { label: '발행', variant: 'info' },
  paid: { label: '입금 완료', variant: 'success' },
  overdue: { label: '미입금', variant: 'danger' },
  cancelled: { label: '취소', variant: 'default' },
};

export const ANOMALY_SEVERITY: Record<string, StatusConfig> = {
  critical: { label: '긴급', variant: 'danger' },
  warning: { label: '주의', variant: 'warning' },
  info: { label: '정보', variant: 'info' },
};

export function getStatusConfig(
  map: Record<string, StatusConfig>,
  key: string | undefined | null,
  fallback: StatusConfig = { label: '-', variant: 'default' },
): StatusConfig {
  if (!key) return fallback;
  return map[key] ?? fallback;
}
