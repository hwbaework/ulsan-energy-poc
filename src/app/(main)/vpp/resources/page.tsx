'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Breadcrumb } from '@/components/layout';
import { RouteTabs } from '@/components/ui/RouteTabs';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { useVppResources, useEnrollVpp, useEnrollVppStation } from '@/hooks/der/useVpp';
import { usePowerStationsByCompany } from '@/hooks/common/usePowerStations';

// 자원 관리 — 사업계획서 자원 실증(p.153): 분산에너지 자원 등록·VPP 편입. doc 04 §4 (탭: 자원 ▸ 그룹)
// 설계문서 22 — 자산 단일 원천(power_stations) 선택식 편입. 기존 목록·enroll(id) 보존.
export default function VppResourcesPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const addToast = useToastStore((s) => s.add);
  const q = useVppResources(companyId);
  const enrollMut = useEnrollVpp();
  const rows = q.data ?? [];

  // 발전소 선택 편입 (설계문서 22 §5.1) — org/stations 등록 자산에서 선택 → POST /resources/enroll-station
  const stationsQ = usePowerStationsByCompany(companyId);
  // 발전유형 게이팅 — 태양광만 PPA·VPP 대상(설계25). 연료전지·ORC는 모니터링 전용.
  const stations = (stationsQ.data ?? []).filter((s) => s.generationType === 'SOLAR');
  const enrollStationMut = useEnrollVppStation();
  const [selectedStationId, setSelectedStationId] = useState('');
  const submitStationEnroll = () => {
    if (!selectedStationId || !companyId) return;
    const station = stations.find((s) => String(s.id) === selectedStationId);
    enrollStationMut.mutate(
      { companyId, powerStationId: Number(selectedStationId) },
      {
        onSuccess: () => {
          addToast('success', `${station?.name ?? '발전소'} VPP 편입 완료`);
          setSelectedStationId('');
        },
        onError: () => addToast('error', '편입 실패 — 잠시 후 다시 시도하세요.'),
      },
    );
  };

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: '분산에너지 효율화' }, { label: '자원 관리' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">자원 관리</h1>
        <span className="text-xs text-slate-400">분산에너지 자원 등록·그룹핑 — 자원 실증(계획서 p.153)</span>
      </div>
      <RouteTabs
        items={[
          { href: '/vpp/resources', label: '자원' },
          { href: '/vpp/groups', label: '그룹(SPC)' },
        ]}
      />

      {/* 발전소 선택 편입 (설계문서 22 §5.1) — 등록 원천(org/stations)에서 선택 → VPP 편입 */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-white">발전소 선택 편입</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            발전소 관리에 등록된 자산을 선택해 VPP에 편입합니다 — 용량·유형은 발전소 자산에서 자동 반영됩니다.
          </p>
        </div>
        {stationsQ.isLoading ? (
          <p className="text-xs text-slate-500">발전소 목록을 불러오는 중…</p>
        ) : stations.length === 0 ? (
          // 빈 상태 안내 (설계문서 §5.3) — 신규 자산 폼을 열지 않고 발전소 관리로 안내
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-400">
              등록된 발전소가 없습니다. 먼저 발전소 관리에서 자산을 등록하세요.
            </span>
            <Link href="/org/stations">
              <Button size="sm" variant="secondary">
                발전소 관리로 이동
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <Select
                options={stations.map((s) => ({
                  value: String(s.id),
                  label: `${s.name} (${s.capacityKw?.toLocaleString?.() ?? '—'} kW)`,
                }))}
                value={selectedStationId}
                placeholder="편입할 발전소 선택"
                onChange={(e) => setSelectedStationId(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              variant="primary"
              disabled={!selectedStationId || enrollStationMut.isPending}
              onClick={submitStationEnroll}
            >
              {enrollStationMut.isPending ? '편입 중…' : 'VPP 편입'}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: '전체 자원', v: `${rows.length}개` },
          { label: 'VPP 편입', v: `${rows.filter((r) => r.linked).length}개` },
          { label: '미편입', v: `${rows.filter((r) => !r.linked).length}개` },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="text-xs text-slate-400">{s.label}</div>
            <div className="mt-1 text-xl font-bold text-white">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">자원</th>
              <th className="px-4 py-3 text-right">용량</th>
              <th className="px-4 py-3 text-right">편입 상태</th>
              <th className="px-4 py-3 text-right">액션</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((res) => (
              <tr key={res.id} className="border-b border-white/[0.04] text-slate-300">
                <td className="px-4 py-3">{res.resource}</td>
                <td className="px-4 py-3 text-right">{res.capacity}</td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${res.linked ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.05] text-slate-400'}`}
                  >
                    {res.linked ? 'VPP 편입' : '미편입'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {!res.linked && (
                    <button
                      onClick={() =>
                        enrollMut.mutate(res.id, {
                          onSuccess: () => addToast('success', `${res.resource} VPP 편입 완료`),
                          onError: () => addToast('error', '편입 실패 — 잠시 후 다시 시도하세요.'),
                        })
                      }
                      disabled={enrollMut.isPending}
                      className="rounded-lg px-3 py-1 text-xs bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 disabled:opacity-50 transition-colors"
                    >
                      VPP 편입
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-xs text-slate-500">
                  {q.isLoading
                    ? '불러오는 중…'
                    : '등록된 자원이 없습니다. 사업자인증 온보딩에서 설비를 등록하면 여기에 표시됩니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">
        편입 자원은 발전량 예측·수요반응(DR) 등 발전 효율관리의 대상이 됩니다.
      </p>
    </div>
  );
}
