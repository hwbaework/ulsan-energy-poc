'use client';

import { useMemo, useState } from 'react';
import { Flame, Sun, Factory, BatteryCharging, Wind, Droplets, Leaf, Zap, Info } from 'lucide-react';
import { Breadcrumb } from '@/components/layout';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePowerStationsByCompany } from '@/hooks/common/usePowerStations';

// 발전자산 — 로그인 회사(owner_company_id) 소유 발전소만 집계·표기. 회사 스코프(전체 자산 노출 금지).
// 카드/탭은 실제 등록 발전소의 generation_type 분포로 동적 생성(하드코딩 상수 제거).
const TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  FUEL_CELL: { label: '연료전지', icon: <Flame size={15} /> },
  SOLAR: { label: '태양광', icon: <Sun size={15} /> },
  ORC: { label: 'ORC', icon: <Factory size={15} /> },
  ESS: { label: 'ESS', icon: <BatteryCharging size={15} /> },
  WIND: { label: '풍력', icon: <Wind size={15} /> },
  HYDRO: { label: '수력', icon: <Droplets size={15} /> },
  BIO: { label: '바이오', icon: <Leaf size={15} /> },
  GEOTHERMAL: { label: '지열', icon: <Zap size={15} /> },
};
const typeLabel = (t: string) => TYPE_META[t]?.label ?? t;
const typeIcon = (t: string) => TYPE_META[t]?.icon ?? <Zap size={15} />;

interface StationRow {
  id: number;
  name: string;
  generationType: string;
  capacityKw: number;
  status: string;
}

export default function ControlAssetsPage() {
  const companyId = useAuthStore((s) => s.user?.companyId) ?? undefined;
  const { data, isLoading } = usePowerStationsByCompany(companyId);
  const stations = (data ?? []) as StationRow[];

  // 타입별 집계(용량 합계·기수)
  const byType = useMemo(() => {
    const m = new Map<string, { count: number; kw: number }>();
    stations.forEach((s) => {
      const cur = m.get(s.generationType) ?? { count: 0, kw: 0 };
      cur.count += 1;
      cur.kw += s.capacityKw ?? 0;
      m.set(s.generationType, cur);
    });
    return [...m.entries()].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.kw - a.kw);
  }, [stations]);

  const [tab, setTab] = useState<string>('all');
  const tabs = useMemo(() => ['all', ...byType.map((t) => t.type)], [byType]);

  const totalKw = byType.reduce((s, t) => s + t.kw, 0);
  const visibleStations = tab === 'all' ? stations : stations.filter((s) => s.generationType === tab);

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: '통합관제' }, { label: '발전자산' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">발전자산</h1>
        <span className="text-xs text-slate-400">
          {stations.length}개소 · 발전용량 합계 {(totalKw / 1000).toFixed(2)} MW · 소속 회사 자산
        </span>
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-xs text-slate-500">발전자산을 불러오는 중…</p>
      ) : stations.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
          <p className="text-sm text-slate-300">등록된 발전자산이 없습니다.</p>
          <p className="mt-1 text-xs text-slate-500">발전소 관리에서 자원을 등록하면 이 회사의 자산으로 집계됩니다.</p>
        </div>
      ) : (
        <>
          {/* 타입 탭 — 실제 보유 타입만 */}
          <div className="flex items-center gap-1 border-b border-white/[0.06]">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${
                  tab === t
                    ? 'border-sky-400 text-white font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {t === 'all' ? '전체' : typeLabel(t)}
              </button>
            ))}
          </div>

          {/* 타입별 용량 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {byType
              .filter((t) => tab === 'all' || tab === t.type)
              .map((t) => (
                <div key={t.type} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      {typeIcon(t.type)} {typeLabel(t.type)}
                    </div>
                    <span className="rounded px-1.5 py-0.5 text-[10px] bg-white/[0.05] text-slate-400">
                      {t.count}기
                    </span>
                  </div>
                  <div className="mt-1 text-xl font-bold text-white">{(t.kw / 1000).toFixed(2)} MW</div>
                  <div className="text-[11px] text-slate-500">{Math.round(t.kw).toLocaleString()} kW</div>
                </div>
              ))}
          </div>

          {/* 발전소 목록 — 탭 필터 */}
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                  <th className="px-4 py-3">발전소</th>
                  <th className="px-4 py-3">발전유형</th>
                  <th className="px-4 py-3 text-right">용량(kW)</th>
                  <th className="px-4 py-3">상태</th>
                </tr>
              </thead>
              <tbody>
                {visibleStations.map((s) => (
                  <tr key={s.id} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-4 py-2.5">{s.name}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{typeLabel(s.generationType)}</td>
                    <td className="px-4 py-2.5 text-right">{(s.capacityKw ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs ${s.status === 'ACTIVE' ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {s.status === 'ACTIVE' ? '가동' : s.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {visibleStations.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-500">
                      해당 유형의 발전소가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 flex items-start gap-3">
        <Info size={16} className="text-amber-400 mt-0.5 shrink-0" />
        <div className="text-sm text-slate-300">
          <b className="text-amber-400">준비 중</b> — 설비별 실계측 상세(설치 진행률·실시간 출력·가동 이력)는 백엔드
          자산 계측 도메인 연동 후 제공됩니다. 현재는 회사 소유 발전소의 등록 용량 기준 집계입니다.
        </div>
      </div>
    </div>
  );
}
