'use client';

import { SourceIcon } from '@/components/ui/Design';
import { sourceOf } from '@/lib/design';

/**
 * 발전소 이름 셀 — 표에서 발전소를 나타내는 공통 형태.
 * [발전원 아이콘] 이름 / 발전원 라벨(색상)
 * 발전소 목록·예지보전 등 발전소를 행으로 가지는 표는 모두 이 컴포넌트를 쓴다.
 * (순번은 표의 별도 'No.' 컬럼으로 매긴다 — 여기서는 시스템 ID를 노출하지 않는다.)
 */
export function PlantNameCell({ type, name }: { type: string; name: string }) {
  const t = sourceOf(type);
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
        <SourceIcon type={type} size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-white truncate">{name}</p>
        <p className="text-xs" style={{ color: t.color }}>
          {t.label}
        </p>
      </div>
    </div>
  );
}
