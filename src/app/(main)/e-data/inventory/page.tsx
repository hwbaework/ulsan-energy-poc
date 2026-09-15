'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Factory, Flame, Zap, TrendingDown, FileText, Plus } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Badge } from '@/components/edm/ui/Badge';
import { Button } from '@/components/edm/ui/Button';
import { StatCard, StatsGrid } from '@/components/edm/features/StatCard';
import { RmsLineChart } from '@/components/edm/ui/Chart';
import { QuickEmissionWizard } from '@/components/edm/ghg/QuickEmissionWizard';
import { useAuthStore } from '@/stores/useAuthStore';
import { useGhgCalculation, useGhgStatements, useGhgSources } from '@/hooks/edm/useGhg';
import { useGhgReductionActuals } from '@/hooks/edm/useGhgExt';

// 온실가스 인벤토리 대시보드 — 설계 docs/기획/02 §2.1
// 간편 배출 입력 진입 CTA — 기획 17 §4 (활동 중심 통합 위저드)
export default function GhgDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? undefined;
  const { scope1, scope2, total } = useGhgCalculation(companyId, 2026);
  const { data: statements } = useGhgStatements(companyId);
  const { data: sources } = useGhgSources(companyId);
  const [wizardOpen, setWizardOpen] = useState(false);
  // 저장 가능 게이트: isLive(실데이터) + companyId 존재. 신규 회사도 위저드 입력 허용(빈 배열도 live).
  const wizardGuard = companyId == null ? '회사 정보가 없어 저장할 수 없습니다' : '';
  const canWizardSave = !wizardGuard;
  // 기획 14 §2 — 감축실적(KOC_MONITORING 자동 유입 + MANUAL 수기). carbon 미수정, ghg 측 수집.
  const { data: reductionActuals } = useGhgReductionActuals(companyId);
  const prev = statements.find((s) => s.year === 2025) ?? { total };
  const reduced = prev.total - total;
  const changePct = prev.total > 0 ? -Math.round((reduced / prev.total) * 100) : 0;

  // 설계 22: mock(YEARLY_TREND) 제거 — 연도별 추이는 실 명세서(statements)에서 파생. 없으면 빈 상태.
  const yearlyTrend = [...statements].map((s) => ({ year: s.year, total: s.total })).sort((a, b) => a.year - b.year);

  return (
    <div className="space-y-6">
      {/* 회사 마스터 미입력 유도 — /me 일원화 소스 기반, 비차단 안내(2026-09-04) */}
      {user != null && (user.companyKsicCode == null || user.companyAllocationTarget == null) && (
        <div className="rounded-lg border border-sky-500/20 bg-sky-500/[0.05] px-4 py-3 text-xs text-sky-300">
          업종(KSIC)·할당대상 정보가 미입력 상태입니다. 명세서·배출권 판정에 사용됩니다 —{' '}
          <a href="/org/profile" className="underline font-medium">
            조직 관리 &gt; 프로필에서 입력
          </a>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">온실가스 인벤토리</h1>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-slate-400 sm:inline">목표관리제 기준 · 전력계수 0.4781 tCO₂eq/MWh</span>
          <Button variant="primary" size="sm" onClick={() => setWizardOpen(true)}>
            <Plus size={15} /> 배출 입력 시작
          </Button>
        </div>
      </div>

      <QuickEmissionWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        companyId={companyId}
        canSave={canWizardSave}
        guardReason={wizardGuard || undefined}
      />

      <StatsGrid columns={4}>
        <StatCard
          icon={<Factory size={20} />}
          label="총 배출량 (2026)"
          value={`${total.toLocaleString()} tCO₂eq`}
          change={{ value: changePct, label: '전년 대비' }}
        />
        <StatCard icon={<Flame size={20} />} label="Scope 1 (직접)" value={`${scope1.toLocaleString()}`} sub="tCO₂eq" />
        <StatCard
          icon={<Zap size={20} />}
          label="Scope 2 (간접·전력)"
          value={`${scope2.toLocaleString()}`}
          sub="tCO₂eq"
        />
        <StatCard
          icon={<TrendingDown size={20} />}
          label="전년 대비 감축"
          value={`${reduced.toLocaleString()}`}
          sub="tCO₂eq"
        />
      </StatsGrid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {yearlyTrend.length > 0 ? (
            <RmsLineChart
              title="연도별 배출량 추이"
              description="tCO₂eq"
              data={yearlyTrend}
              xKey="year"
              lines={[{ key: 'total', name: '총 배출량', color: '#38bdf8' }]}
              height={280}
            />
          ) : (
            <Card className="flex h-full min-h-[280px] flex-col p-6">
              <h3 className="text-sm font-semibold text-white">연도별 배출량 추이</h3>
              <p className="mt-1 text-xs text-slate-500">tCO₂eq</p>
              <div className="flex flex-1 items-center justify-center">
                <p className="text-xs text-slate-500">명세서가 없어 추이를 표시할 수 없습니다.</p>
              </div>
            </Card>
          )}
        </div>
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-white mb-4">명세서 상태</h3>
          <div className="space-y-3">
            {statements.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2.5">
                <span className="text-sm text-slate-300">{s.year}년 명세서</span>
                <Badge variant={s.status === 'VERIFIED' ? 'success' : s.status === 'SUBMITTED' ? 'info' : 'default'}>
                  {s.status === 'VERIFIED' ? '검증완료' : s.status === 'SUBMITTED' ? '제출' : '작성중'}
                </Badge>
              </div>
            ))}
          </div>
          <Link
            href="/e-data/inventory/statement"
            className="mt-4 flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300"
          >
            <FileText size={13} /> 명세서 관리
          </Link>
        </Card>
      </div>

      <Card className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">감축실적 ({reductionActuals.length}건)</h3>
          <span className="text-xs text-slate-500">KOC 모니터링 자동 연계 + 수기 등록</span>
        </div>
        {reductionActuals.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500">
            감축실적이 없습니다. KOC 모니터링 보고서를 제출하면 자동 반영됩니다.
          </p>
        ) : (
          <div className="space-y-2">
            {reductionActuals.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Badge variant={a.sourceType === 'KOC_MONITORING' ? 'info' : 'default'}>
                    {a.sourceType === 'KOC_MONITORING' ? 'KOC 모니터링' : '수기'}
                  </Badge>
                  <span className="text-sm text-slate-300">{a.period}</span>
                  {a.note && <span className="text-xs text-slate-500">{a.note}</span>}
                </div>
                <span className="text-sm tabular-nums text-white">{a.reducedTco2.toLocaleString()} tCO₂eq</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-white mb-3">배출원 요약 ({sources.length}개)</h3>
        <div className="flex flex-wrap gap-2">
          {sources.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
              <Badge variant={s.scope === 1 ? 'warning' : 'info'}>Scope {s.scope}</Badge>
              <span className="text-xs text-slate-300">
                {s.site} · {s.facility}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
