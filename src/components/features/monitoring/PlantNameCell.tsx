'use client';

import { SourceIcon } from '@/components/ui/Design';
import { sourceOf } from '@/lib/design';

/**
 * 발전소 이름 셀 — 표에서 발전소를 나타내는 공통 형태: [발전원 아이콘] 이름.
 * 발전원 글자는 이 칸에 쓰지 않는다 — 옆 '발전원' 칸(SourceLabelCell)에 글자만. 칸 하나에 값 하나, 색은 아이콘 한 곳에만(2026-11-25 사용자).
 * 발전소 상세 · 예지보전 · 안전 · 보고서 등 발전소를 행으로 가지는 표는 모두 이 두 칸을 쓴다.
 * (순번은 표의 별도 'No.' 컬럼으로 매긴다 — 여기서는 시스템 ID를 노출하지 않는다.)
 */
export function PlantNameCell({ type, name }: { type: string; name: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
        <SourceIcon type={type} size={20} />
      </div>
      <span className="truncate text-sm font-medium text-white">{name}</span>
    </div>
  );
}

/** 발전원 칸 — 글자만(태양광 / ORC / 연료전지), 계약 유형 칸과 같은 글자색 */
export function SourceLabelCell({ type }: { type: string }) {
  return <span className="text-sm text-slate-300">{sourceOf(type).label}</span>;
}
