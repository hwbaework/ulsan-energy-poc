'use client';

import { KstNowChip } from '@/components/features/control/KstNowChip';
import { useParams } from 'next/navigation';
import { Breadcrumb } from '@/components/layout';
import { BackButton } from '@/components/layout/PageTitle';
import { SafetyCompanyCard } from '@/components/features/control/SafetyCompanyCard';
import { useMonitoringPlantDetail } from '@/hooks/monitoring/useMonitoring';
import { getPersona, usePersonaOverride } from '@/lib/persona';
import { useAuthStore } from '@/stores/useAuthStore';

// 안전 상세 — 회사(발전소) 한 곳. 목록에서 줄을 눌러 들어온다(발전사업자는 바로).
export default function SafetyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const override = usePersonaOverride((s) => s.override);
  const persona = override ?? getPersona(user);
  // 발전사업자는 목록을 거치지 않고 바로 상세로 오므로 목록 뒤로가기를 두지 않는다.
  const showBack = persona !== 'generator';
  const { data: plant, isLoading } = useMonitoringPlantDetail(Number(id));

  if (isLoading || !plant) {
    return (
      <div className="space-y-6">
        <Breadcrumb items={[{ label: '통합관제', path: '/dashboard' }, { label: '안전', path: '/control/safety' }]} />
        <p className="text-sm text-slate-400">{isLoading ? '불러오는 중…' : '표시할 발전소가 없습니다'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '통합관제', path: '/dashboard' }, { label: '안전', path: '/control/safety' }, { label: plant.name }]} />
      <div className="flex flex-wrap items-center gap-3">
        {showBack && <BackButton href="/control/safety" label="안전 목록으로" />}
        <h1 className="text-xl font-bold text-white">{plant.name}</h1>
        <KstNowChip />
      </div>
      {/* DX 센서는 태양광 발전소만(연료전지 · ORC 는 대상 아님) — 예지보전 상세와 같다 */}
      {plant.type === 'SOLAR' && <SafetyCompanyCard plant={plant} />}
    </div>
  );
}
