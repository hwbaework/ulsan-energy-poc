'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 발전소 행 — 모든 페이지에서 공통으로 쓰는 컴팩트 발전소 카드
 *
 * 레이아웃:
 *   [icon] [Name] [status badge]            [right slot]
 *          source · capacity kW · region
 */

export type PlantStatusKind = 'normal' | 'maintenance' | 'fault' | 'offline';

const STATUS_META: Record<PlantStatusKind, { label: string; tone: string; bg: string; ring: string; dot: string }> = {
  normal: {
    label: '정상',
    tone: 'text-emerald-300',
    bg: 'bg-emerald-500/[0.10]',
    ring: 'ring-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  maintenance: {
    label: '점검',
    tone: 'text-blue-300',
    bg: 'bg-blue-500/[0.10]',
    ring: 'ring-blue-500/30',
    dot: 'bg-blue-400',
  },
  fault: {
    label: '이상',
    tone: 'text-amber-300',
    bg: 'bg-amber-500/[0.10]',
    ring: 'ring-amber-500/30',
    dot: 'bg-amber-400',
  },
  offline: {
    label: '통신두절',
    tone: 'text-rose-300',
    bg: 'bg-rose-500/[0.10]',
    ring: 'ring-rose-500/30',
    dot: 'bg-rose-400',
  },
};

export interface PlantSummary {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string; // icon color (text-amber-400 등)
  source: string; // 태양광 / 풍력 / ESS / 수소
  capacityKw: number;
  region: string; // 전남 영암군 / 강원 평창군 등
}

interface PlantSummaryRowProps {
  plant: PlantSummary;
  status?: PlantStatusKind; // 정상/점검/이상/통신두절
  rightSlot?: ReactNode; // 우측 페이지별 컨텍스트 (REC 41 / scissors 등)
  onClick?: () => void;
  selected?: boolean;
  selectable?: boolean; // 라디오/체크 표시 영역 확보
  selectionType?: 'radio' | 'checkbox';
  className?: string;
}

export function PlantSummaryRow({
  plant,
  status,
  rightSlot,
  onClick,
  selected,
  selectable,
  selectionType,
  className,
}: PlantSummaryRowProps) {
  const meta = status ? STATUS_META[status] : null;
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3 text-left w-full transition-colors',
        selected ? 'border-primary/40 bg-primary/[0.06] ring-1 ring-primary/30' : 'border-white/[0.06] bg-white/[0.02]',
        onClick && 'cursor-pointer hover:border-white/[0.15]',
        className,
      )}
    >
      {/* 선택 표시 (옵션) */}
      {selectable && (
        <span
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center',
            selectionType === 'radio' ? 'rounded-full' : 'rounded',
            selected ? 'bg-primary border-2 border-primary' : 'border-2 border-white/20',
          )}
        >
          {selected && (
            <span
              className={cn('bg-white', selectionType === 'radio' ? 'h-1.5 w-1.5 rounded-full' : 'h-2 w-2 rounded-sm')}
            />
          )}
        </span>
      )}

      {/* 아이콘 */}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06]">
        <plant.icon size={16} className={plant.color} />
      </span>

      {/* 이름 + 상태 + 메타 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-white truncate">{plant.name}</p>
          {meta && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                meta.bg,
                meta.tone,
                meta.ring,
              )}
            >
              <span className={cn('h-1 w-1 rounded-full', meta.dot)} />
              {meta.label}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 truncate mt-0.5">
          <span>{plant.source}</span>
          <span className="mx-1 text-slate-700">·</span>
          <span className="tabular-nums">{plant.capacityKw.toLocaleString()} kW</span>
          <span className="mx-1 text-slate-700">·</span>
          <span>{plant.region}</span>
        </p>
      </div>

      {/* 우측 컨텍스트 */}
      {rightSlot && <div className="shrink-0 text-right">{rightSlot}</div>}
    </Wrapper>
  );
}
