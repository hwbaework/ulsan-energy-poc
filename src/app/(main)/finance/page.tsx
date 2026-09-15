'use client';

import { useState } from 'react';
import { Flame, Sun, Factory, Coins, Landmark, Info, Loader2, Paperclip } from 'lucide-react';
import { Breadcrumb } from '@/components/layout';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFinance } from '@/hooks/performance/usePerformance';
import EvidencePanel from '../performance/EvidencePanel';

// 사업 재무·수익 — 09 §3.2.3. 목표 상수 유지 + 수기 실적(정산 집계 있을 때) + 증빙(finance_settlement).
// 매출 목표(연료전지 384.2·태양광 5.7·ORC 6.9억)는 계획서 캐논(불변).
// 정산 API 연동 시 "정산확정", 미연동 항목은 정직성 "계획서 추정치" 유지.

const YEAR = 2026;

// 시설별 매출 목표(계획서 상수, 실값 — 불변)
const FACILITY_TARGET = [
  {
    key: 'FC',
    label: '연료전지',
    icon: <Flame size={15} />,
    revenue: 384.2,
    capacity: '39.6 MW',
    tone: 'text-amber-400',
  },
  { key: 'PVS', label: '태양광', icon: <Sun size={15} />, revenue: 5.7, capacity: '5.1 MW', tone: 'text-emerald-400' },
  { key: 'ORC', label: 'ORC', icon: <Factory size={15} />, revenue: 6.9, capacity: '1.8 MW', tone: 'text-sky-400' },
] as const;
const TOTAL_REVENUE = FACILITY_TARGET.reduce((s, f) => s + f.revenue, 0); // = 396.8억

const TABS = [
  { key: 'revenue', label: '시설별 매출', icon: <Coins size={14} /> },
  { key: 'spc', label: 'SPC 상환·배당', icon: <Landmark size={14} /> },
  { key: 'evidence', label: '증빙(정산서·배당결의서)', icon: <Paperclip size={14} /> },
] as const;

export default function FinancePage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('revenue');
  const uploadedBy = useAuthStore((s) => (s.user?.id != null ? String(s.user.id) : undefined));

  const financeQ = useFinance(YEAR);
  const data = financeQ.data;

  // 서버 매출 실적 조회(집계값). 없으면 null → 정직 표시.
  const actualByName = new Map<string, number | null>();
  (data?.facilities ?? []).forEach((f) => actualByName.set(f.name, f.revenue));
  // SPC 상환·배당은 정산 원장 집계값만 사용 — 더미/폴백 없음. 미연동 시 빈 상태 표시.
  const spcRows = data?.spc ?? [];

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: '관리' }, { label: '사업 재무·수익' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">사업 재무·수익</h1>
        <span className="text-xs text-slate-400">시설별 매출·SPC 상환·배당 (계획서 p.58·214)</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {FACILITY_TARGET.map((f) => (
          <div key={f.key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {f.icon} {f.label} <span className="text-slate-600">· {f.capacity}</span>
            </div>
            <div className={`mt-1 text-xl font-bold ${f.tone}`}>{f.revenue} 억</div>
            <div className="text-[11px] text-slate-500">사업계획서 매출(실값)</div>
          </div>
        ))}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Coins size={15} /> 합계
          </div>
          <div className="mt-1 text-xl font-bold text-white">{TOTAL_REVENUE.toFixed(1)} 억</div>
          <div className="text-[11px] text-slate-500">시설 매출 합</div>
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

      {financeQ.isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> 재무 집계 불러오는 중…
        </div>
      )}

      {tab === 'revenue' && !financeQ.isLoading && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02] flex items-center justify-between">
            <span>시설별 매출</span>
            {data ? (
              <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-400">정산확정</span>
            ) : (
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">계획서 추정치</span>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                <th className="px-4 py-3">시설</th>
                <th className="px-4 py-3">용량</th>
                <th className="px-4 py-3 text-right">매출 목표(억, 실값)</th>
                <th className="px-4 py-3 text-right">정산 실적(억)</th>
              </tr>
            </thead>
            <tbody>
              {FACILITY_TARGET.map((f) => {
                const actual = actualByName.get(f.label);
                return (
                  <tr key={f.key} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-4 py-3">{f.label}</td>
                    <td className="px-4 py-3 text-slate-400">{f.capacity}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${f.tone}`}>{f.revenue}</td>
                    <td className="px-4 py-3 text-right">
                      {actual == null ? <span className="text-slate-500 text-xs">미연동(추정치)</span> : actual}
                    </td>
                  </tr>
                );
              })}
              <tr className="text-slate-100 font-semibold bg-white/[0.02]">
                <td className="px-4 py-3">합계</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right">{TOTAL_REVENUE.toFixed(1)}</td>
                <td className="px-4 py-3 text-right text-slate-400 text-xs">{data ? '' : '정산 API 연동 후'}</td>
              </tr>
            </tbody>
          </table>
          <div className="px-4 py-3 text-[11px] text-slate-500">
            매출 목표는 계획서 상수(실값). 정산 실적은 정산 원장 집계값이며 미연동 시{' '}
            <span className="text-amber-400">계획서 추정치</span>로 정직 표시됩니다.
          </div>
        </div>
      )}

      {tab === 'spc' && !financeQ.isLoading && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02] flex items-center justify-between">
            <span>SPC 상환·배당</span>
            {data?.spc?.length ? (
              <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-400">정산확정</span>
            ) : (
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">계획서 추정치</span>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                <th className="px-4 py-3">SPC</th>
                <th className="px-4 py-3">상환 진행</th>
                <th className="px-4 py-3 text-center">배당(지표4 상생연금 교차)</th>
              </tr>
            </thead>
            <tbody>
              {spcRows.map((s) => (
                <tr key={s.name} className="border-b border-white/[0.04] text-slate-300">
                  <td className="px-4 py-3">{s.name}</td>
                  <td className="px-4 py-3">
                    {s.repaidPct == null ? (
                      <span className="text-slate-500 text-xs">미연동</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-white/[0.05] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-sky-400"
                            style={{ width: `${Math.max(0, Math.min(100, s.repaidPct))}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400">{s.repaidPct}%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-slate-400">{s.dividend ?? '—'}</td>
                </tr>
              ))}
              {spcRows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-xs text-slate-500">
                    SPC 상환·배당 정산 데이터가 아직 없습니다 (정산 원장 미연동).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'evidence' && (
        <EvidencePanel
          ownerType="finance_settlement"
          ownerId="finance"
          indicatorNo={4}
          year={YEAR}
          evidenceType="SETTLEMENT_STATEMENT"
          uploadedBy={uploadedBy}
          title="재무 증빙(정산서·배당결의서)"
        />
      )}

      <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-4 flex items-start gap-3">
        <Info size={16} className="text-sky-400 mt-0.5 shrink-0" />
        <div className="text-sm text-slate-300">
          <b className="text-sky-400">정직성 안내</b> — 시설별 매출 목표(연료전지 <b>384.2</b> · 태양광 <b>5.7</b> · ORC{' '}
          <b>6.9</b>억)는 계획서 상수(실값). 정산 실적·상환·배당은 정산 원장 집계값이며, 미연동 항목은{' '}
          <b>계획서 추정치</b>로 정직 표시됩니다.
        </div>
      </div>
    </div>
  );
}
