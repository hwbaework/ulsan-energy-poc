import { Badge } from '@/components/edm/ui/Badge';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface StatusConfig {
  label: string;
  variant: BadgeVariant;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  ACTIVE: { label: '활성', variant: 'success' },
  INACTIVE: { label: '비활성', variant: 'default' },
  SUSPENDED: { label: '정지', variant: 'danger' },
  WITHDRAWN: { label: '탈퇴', variant: 'default' },
  PENDING: { label: '대기', variant: 'warning' },
  APPROVED: { label: '승인', variant: 'success' },
  REJECTED: { label: '반려', variant: 'danger' },
  IN_PROGRESS: { label: '진행중', variant: 'info' },
  COMPLETED: { label: '완료', variant: 'success' },
  CANCELLED: { label: '취소', variant: 'default' },
  NORMAL: { label: '정상', variant: 'success' },
  WARNING: { label: '경고', variant: 'warning' },
  CRITICAL: { label: '위험', variant: 'danger' },
  MAINTENANCE: { label: '점검', variant: 'info' },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? { label: status, variant: 'default' as const };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
