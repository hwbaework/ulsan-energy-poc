import { Badge, type BadgeVariant } from '@/components/edm/ui/Badge';
import type { OrderStatus } from '@/types/edm';

// BE DmOrder 4종 정본 + 정산 지급 완료(PAID). 설계 12 §7.2·§4.
const ORDER_STATUS_MAP: Record<OrderStatus, { label: string; variant: BadgeVariant }> = {
  PAYMENT_PENDING: { label: '결제대기', variant: 'warning' },
  ACTIVE: { label: '이용중', variant: 'success' },
  COMPLETED: { label: '완료', variant: 'info' },
  CANCELLED: { label: '취소됨', variant: 'default' },
  PAID: { label: '정산완료', variant: 'info' },
};

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config = ORDER_STATUS_MAP[status] ?? { label: status, variant: 'default' as const };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
