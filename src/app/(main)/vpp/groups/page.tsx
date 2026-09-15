'use client';

import { Breadcrumb } from '@/components/layout';
import { RouteTabs } from '@/components/ui/RouteTabs';
import { useAuthStore } from '@/stores/useAuthStore';
import { useVppGroups } from '@/hooks/der/useVpp';

// VPP 그룹(SPC) — 집합발전소=SPC 단위(재정립 §3.3). platform/spc 재사용. /vpp/groups (문서 21 검증).
export default function VppGroupsPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const q = useVppGroups(companyId);
  const rows = q.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: '분산에너지 효율화' }, { label: '자원 관리' }, { label: '그룹(SPC)' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">자원 관리</h1>
        <span className="text-xs text-slate-400">연료전지·태양광·ORC SPC 단위 자산</span>
      </div>
      <RouteTabs
        items={[
          { href: '/vpp/resources', label: '자원' },
          { href: '/vpp/groups', label: '그룹(SPC)' },
        ]}
      />

      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">자산명</th>
              <th className="px-4 py-3">유형</th>
              <th className="px-4 py-3 text-right">규모</th>
              <th className="px-4 py-3 text-right">월 수익</th>
              <th className="px-4 py-3 text-right">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.id} className="border-b border-white/[0.04] text-slate-300">
                <td className="px-4 py-3">{g.name}</td>
                <td className="px-4 py-3">
                  <span className="rounded bg-white/[0.05] px-2 py-0.5 text-xs text-slate-400">{g.assetType}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {g.scaleValue ?? '—'} {g.scaleUnit ?? ''}
                </td>
                <td className="px-4 py-3 text-right">
                  {g.monthlyRevenue != null ? `₩${g.monthlyRevenue.toLocaleString()}` : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${g.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.05] text-slate-400'}`}
                  >
                    {g.status}
                  </span>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-500">
                  {q.isLoading ? '불러오는 중…' : 'SPC 자산이 없습니다. SPC 등록 후 표시됩니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">
        애그리게이션 그룹 → SPC 단위로 재정의(재정립). 데이터 흐름: 발전설비 → VPP → SPC → 수요처.
      </p>
    </div>
  );
}
