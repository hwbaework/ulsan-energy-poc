'use client';

import { useState } from 'react';
import { Gauge, Users, Info, Leaf, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Breadcrumb } from '@/components/layout';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTenantUsage, useAggregateIndicator } from '@/hooks/performance/usePerformance';
import EvidencePanel from '../performance/EvidencePanel';

// 수용가 이용현황(지표6) — 09 §3.2.2. tenant-usage 자동값 실소비.
// 산식·3차 목표 80%는 계획서 캐논(불변). 실적 null → "미연동"(정직). 미이용자 필터 유지.

const YEAR = 2026;
const TARGET_PCT = 80; // 3차 목표(계획서 상수, 실값 — 불변)

const TABS = [
  { key: 'util', label: '이용률', icon: <Gauge size={14} /> },
  { key: 'list', label: '수용가 목록', icon: <Users size={14} /> },
  { key: 'evidence', label: '증빙', icon: <CheckCircle2 size={14} /> },
] as const;

export default function TenantsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('util');
  const [inactiveOnly, setInactiveOnly] = useState(false);
  const uploadedBy = useAuthStore((s) => (s.user?.id != null ? String(s.user.id) : undefined));

  const usageQ = useTenantUsage(YEAR);
  const aggregateM = useAggregateIndicator();
  const data = usageQ.data;

  const utilPct = data?.utilPct ?? null;
  const gaugePct = utilPct == null ? 0 : Math.max(0, Math.min(100, utilPct));
  const tenants = data?.tenants ?? [];
  const shown = inactiveOnly ? tenants.filter((t) => !t.active) : tenants;

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: '관리' }, { label: '수용가 이용현황' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">수용가 이용현황</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">지표6 — 이용률(활성/모집)</span>
          <button
            onClick={() => aggregateM.mutate({ indicatorNo: 6, year: YEAR })}
            disabled={aggregateM.isPending}
            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/[0.04] disabled:opacity-50"
          >
            <RefreshCw size={12} className={aggregateM.isPending ? 'animate-spin' : ''} /> 재집계
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-white/[0.06]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${
              tab === t.key
                ? 'border-sky-400 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {usageQ.isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> 이용률 집계 불러오는 중…
        </div>
      )}
      {usageQ.isError && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4 text-sm text-rose-300">
          이용률 집계를 불러오지 못했습니다.
        </div>
      )}

      {tab === 'util' && !usageQ.isLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: '모집 수용가', v: data?.recruited },
              { label: '등록 수용가', v: data?.registered },
              { label: '1회 이상 이용(활성)', v: data?.active1plus },
              { label: '3차 목표 이용률', v: `${TARGET_PCT} %`, tone: 'text-emerald-400', isTarget: true },
            ].map((s, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="text-xs text-slate-400">{s.label}</div>
                <div className={`mt-1 text-xl font-bold ${s.tone ?? 'text-white'}`}>
                  {s.isTarget ? (
                    s.v
                  ) : s.v == null ? (
                    <span className="text-slate-500 text-base">미연동</span>
                  ) : (
                    `${s.v} 개사`
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">이용률 (목표 대비)</div>
              {utilPct == null ? (
                <span className="rounded bg-slate-500/10 px-2 py-0.5 text-[10px] text-slate-400">미연동</span>
              ) : (
                <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-400">
                  집계 {data?.lastAggregatedAt?.slice(0, 10) ?? ''}
                </span>
              )}
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-sky-400">{utilPct == null ? '—' : `${utilPct}%`}</span>
              <span className="text-xs text-slate-500">/ 목표 {TARGET_PCT}%</span>
            </div>
            <div className="mt-3 relative h-3 w-full rounded-full bg-white/[0.05] overflow-hidden">
              <div className="h-full rounded-full bg-sky-400" style={{ width: `${gaugePct}%` }} />
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-emerald-400"
                style={{ left: `${TARGET_PCT}%` }}
                title="목표 80%"
              />
            </div>
            <div className="mt-2 text-[11px] text-slate-500">녹색선 = 3차 목표 {TARGET_PCT}% (계획서 상수, 실값)</div>
            <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/20 p-3 text-xs text-slate-300">
              <span className="text-slate-500">산식 </span>
              이용률 = (등록 + 1회 이상 이용) ÷ 모집 수용가 × 100
              {utilPct == null && <span className="text-slate-500"> — 집계 도메인 미연동(정직 표시)</span>}
            </div>
          </div>
        </div>
      )}

      {tab === 'list' && !usageQ.isLoading && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02] flex items-center justify-between">
            <span>수용가 목록</span>
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              <input type="checkbox" checked={inactiveOnly} onChange={(e) => setInactiveOnly(e.target.checked)} />
              미이용자만(독려 대상)
            </label>
          </div>
          {shown.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              {tenants.length === 0 ? '수용가 명부가 아직 없습니다(미연동).' : '조건에 해당하는 수용가가 없습니다.'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                  <th className="px-4 py-3">수용가</th>
                  <th className="px-4 py-3">가입일</th>
                  <th className="px-4 py-3">최근 이용일</th>
                  <th className="px-4 py-3 text-right">이용 횟수</th>
                  <th className="px-4 py-3 text-center">활성</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((t, i) => (
                  <tr key={i} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-4 py-3">{t.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{t.registeredAt?.slice(0, 10) ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{t.lastUsedAt?.slice(0, 10) ?? '—'}</td>
                    <td className="px-4 py-3 text-right">{t.usageCount}</td>
                    <td className="px-4 py-3 text-center">
                      {t.active ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                          <Leaf size={12} /> 활성
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'evidence' && (
        <EvidencePanel
          ownerType="performance_actual"
          ownerId="6"
          indicatorNo={6}
          year={YEAR}
          evidenceType="BUILD_PROGRESS_REPORT"
          uploadedBy={uploadedBy}
          title="지표6 이용률 증빙(가입확인·이용로그)"
        />
      )}

      <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-4 flex items-start gap-3">
        <Info size={16} className="text-sky-400 mt-0.5 shrink-0" />
        <div className="text-sm text-slate-300">
          <b className="text-sky-400">정직성 안내</b> — 산식과 3차 목표 <b>80%</b>는 사업계획서 상수(실값).
          모집·등록·이용 수치는 이용률 집계 서비스 실소비이며, 미연동 시 <b>미연동</b>으로 정직 표시합니다.
        </div>
      </div>
    </div>
  );
}
