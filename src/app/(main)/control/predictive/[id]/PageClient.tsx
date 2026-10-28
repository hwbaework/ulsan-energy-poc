'use client';

import { BackButton } from '@/components/layout/PageTitle';
import { useParams } from 'next/navigation';
import { Breadcrumb } from '@/components/layout';
import { useMonitoringPlantDetail } from '@/hooks/monitoring/useMonitoring';
import { DxPredictiveBoard } from '@/components/features/control/DxPredictiveBoard';
import { getPersona, usePersonaOverride } from '@/lib/persona';
import { useAuthStore } from '@/stores/useAuthStore';

// 예지보전 상세 — 발전소 1곳의 DX 스마트센서 대시보드(요약 카드 · 설비별 상태 · 발전량 추이 · 센서 상세).

export default function PredictiveDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const override = usePersonaOverride((s) => s.override);
  const persona = override ?? getPersona(user);
  // 발전사업자는 목록을 거치지 않고 바로 상세로 오므로 목록 뒤로가기를 두지 않는다.
  const showBack = persona !== 'generator';
  const numId = Number(id);
  const { data: plant, isLoading } = useMonitoringPlantDetail(numId);

  if (isLoading || !plant) {
    return (
      <div className="space-y-6">
        <Breadcrumb items={[{ label: '통합관제', path: '/dashboard' }, { label: '예지보전', path: '/control/predictive' }]} />
        <p className="text-sm text-slate-400">불러오는 중…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: '통합관제', path: '/dashboard' },
          { label: '예지보전', path: '/control/predictive' },
          { label: plant.name },
        ]}
      />
      <div className="flex items-center gap-3">
        {showBack && (
          <BackButton href="/control/predictive" label="예지보전 목록으로" />
        )}
        <h1 className="text-xl font-bold text-white">{plant.name}</h1>
      </div>

      {/* DX 스마트센서 대시보드(아이티공간 연계 v1.1 7장) — 값이 없으면 미수신 · 미산출 */}
      {plant.type === 'SOLAR' && <DxPredictiveBoard plantId={plant.plantId} />}
    </div>
  );
}
