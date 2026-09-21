'use client';

import Link from 'next/link';
import { Users, Info, ChevronRight } from 'lucide-react';
import { Breadcrumb } from '@/components/layout';
import { useAuthStore } from '@/stores/useAuthStore';
import { useConsumerSites } from '@/hooks/consumer/useConsumer';

// 수용가 모니터링 목록 — EMS 공급·수요관리의 수요 측(doc 04 §1 🟡 목록 신설). 상세는 기존 /monitoring/consumer/[id].
// 실 훅(useConsumerSites) 소비 → 목록 → [id] 상세 진입. 데이터 부재 시에만 정직성 안내(doc 00 §6).
export default function MonitoringConsumerListPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const q = useConsumerSites(companyId ? { companyId } : undefined);
  const sites = q.data?.content ?? [];

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: '통합관제', path: '/dashboard' }, { label: '수용가 모니터링' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">수용가 모니터링</h1>
        <span className="text-xs text-slate-400">공급(발전) ↔ 수요(수용가) 통합 관제의 수요 측</span>
      </div>

      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">수용가(사업장)</th>
              <th className="px-4 py-3">유형</th>
              <th className="px-4 py-3 text-right">계약전력</th>
              <th className="px-4 py-3 text-right">RE100</th>
              <th className="px-4 py-3 text-right">상태</th>
              <th className="px-4 py-3 text-right">상세</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id} className="border-b border-white/[0.04] text-slate-300 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <Link href={`/monitoring/consumer/${s.id}`} className="font-medium text-white hover:text-sky-400">
                    {s.name}
                  </Link>
                  {s.address && <div className="text-[11px] text-slate-500">{s.address}</div>}
                </td>
                <td className="px-4 py-3 text-slate-400">{s.siteType}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {s.contractPowerKw != null ? `${s.contractPowerKw.toLocaleString()} kW` : '—'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{s.rePercent != null ? `${s.rePercent}%` : '—'}</td>
                <td className="px-4 py-3 text-right">
                  <span className="rounded px-2 py-0.5 text-xs bg-white/[0.05] text-slate-400">{s.status ?? '—'}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/monitoring/consumer/${s.id}`}
                    className="inline-flex items-center gap-0.5 text-xs text-sky-400 hover:underline"
                  >
                    상세 <ChevronRight size={13} />
                  </Link>
                </td>
              </tr>
            ))}
            {!sites.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-500">
                  {q.isLoading
                    ? '불러오는 중…'
                    : '등록된 수용가가 없습니다. 수용가(사업장)가 등록되면 목록에 표시됩니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Users size={14} className="text-sky-400" /> 수용가 상세에서 제공되는 정보
        </div>
        <ul className="mt-3 space-y-2 text-sm text-slate-400">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" /> 수용가(사업장)별 실시간 사용량·계약전력
            대비 부하율
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" /> 공급(발전) 대비 수요 밸런스 — 수급 현황
            연계
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" /> RE100 달성률·공급원별 비중·계약 현황
          </li>
        </ul>
        <p className="mt-4 text-[11px] text-slate-500">
          발전소(공급 측) 관제는{' '}
          <Link href="/monitoring" className="text-sky-400 hover:underline">
            통합관제 지도
          </Link>
          에서 확인하세요.
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 flex items-start gap-3">
        <Info size={16} className="text-amber-400 mt-0.5 shrink-0" />
        <div className="text-sm text-slate-300">
          목록은 등록된 수용가(사업장) 기준으로 표시되며, 실시간 사용량·수급 밸런스 등 세부 계측 지표는 각 수용가{' '}
          <b className="text-amber-400">상세 화면</b>에서 제공됩니다.
        </div>
      </div>
    </div>
  );
}
