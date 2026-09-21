'use client';

/**
 * 디자인 정의(src/lib/design.ts)를 그대로 그리는 공통 조각들.
 * - SourceIcon / SourceBadge: 발전원 (지도 마커와 같은 SVG + 고유색)
 * - StatusDot / StatusBadge: 정상 / 이상감지
 * - MetricIcon: 지표 아이콘 (라벨이 같으면 아이콘·색도 같다)
 */
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { METRICS, sourceOf, statusOf, type MetricKey } from '@/lib/design';

export function SourceIcon({ type, size = 16, className }: { type: string; size?: number; className?: string }) {
  const s = sourceOf(type);
  const Icon = s.icon;
  return <Icon size={size} className={cn('inline-block shrink-0', className)} style={{ color: s.color }} aria-label={s.label} />;
}

/** 지도 마커와 같은 핀 그림 — 지도 관련 UI(범례 등)에서만 사용 */
export function SourceMarker({ type, size = 18, className }: { type: string; size?: number; className?: string }) {
  const s = sourceOf(type);
  return <Image src={s.markerUrl} width={size} height={size} alt={s.label} className={cn('inline-block shrink-0', className)} />;
}

export function SourceBadge({ type, withIcon = true, className }: { type: string; withIcon?: boolean; className?: string }) {
  const s = sourceOf(type);
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium', className)}
      style={{ color: s.color, backgroundColor: `${s.color}1F`, boxShadow: `inset 0 0 0 1px ${s.color}66` }}
    >
      {withIcon && <SourceIcon type={type} size={12} />}
      {s.label}
    </span>
  );
}

export function StatusDot({ status, pulse = false, className }: { status: string; pulse?: boolean; className?: string }) {
  const s = statusOf(status);
  return (
    <span className={cn('relative inline-flex h-2 w-2 shrink-0', className)}>
      {pulse && status === 'ANOMALY' && (
        <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', s.dotClass)} />
      )}
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', s.dotClass)} />
    </span>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = statusOf(status);
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 whitespace-nowrap', s.badgeClass, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dotClass)} />
      {s.label}
    </span>
  );
}

/**
 * 범용 상태 pill — 동그라미 + 라벨 (StatusBadge 와 같은 모양).
 * 정상/이상 외에 통신·전원 등 세부 상태를 색으로 구분해 표기할 때 쓴다.
 * 앱 전체 상태 표기는 이 pill 한 가지 모양으로 통일한다.
 */
export type StatusTone = 'normal' | 'danger' | 'warning' | 'muted';

const TONE_STYLE: Record<StatusTone, { badge: string; dot: string }> = {
  normal: { badge: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20', dot: 'bg-emerald-500' },
  danger: { badge: 'bg-red-500/10 text-red-400 ring-red-500/20', dot: 'bg-red-500' },
  warning: { badge: 'bg-amber-500/10 text-amber-400 ring-amber-500/20', dot: 'bg-amber-500' },
  muted: { badge: 'bg-slate-500/10 text-slate-400 ring-slate-500/20', dot: 'bg-slate-500' },
};

export function StatusPill({ tone, label, className }: { tone: StatusTone; label: string; className?: string }) {
  const s = TONE_STYLE[tone];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 whitespace-nowrap', s.badge, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {label}
    </span>
  );
}

export function MetricIcon({ k, size = 18, className }: { k: MetricKey; size?: number; className?: string }) {
  const m = METRICS[k];
  const Icon = m.icon;
  return <Icon size={size} className={cn(m.className, className)} />;
}
