'use client';

import { AlertTriangle, Zap, FileText, DollarSign, Users, Building2, ChevronRight, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { StatCard, StatsGrid, SectionCard } from '@/components/features';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { RmsBarChart } from '@/components/ui/Chart';
import { useMonitoringDashboard } from '@/hooks/monitoring';
import { useAnomalies } from '@/hooks/monitoring/useAnomalies';
import { useQuery } from '@tanstack/react-query';
import { getMonthlySettlements } from '@/api/monitoring/dashboard';

export default function OperationsDashboardPage() {
  const router = useRouter();
  const dashboardQuery = useMonitoringDashboard();
  const dashboard = dashboardQuery.data;
  const anomalyQuery = useAnomalies({ size: 5 });
  const recentAnomalies = (anomalyQuery.data as any)?.content ?? [];

  const currentYear = new Date().getFullYear();
  const {
    data: settlements,
    isLoading: settlementsLoading,
    isError: settlementsError,
  } = useQuery({
    queryKey: ['dashboard', 'monthly-settlements', currentYear],
    queryFn: () => getMonthlySettlements(currentYear),
    staleTime: 5 * 60_000,
  });

  // 실데이터(monthly-settlements API)만 사용 — 시드/폴백 상수 없음. 데이터 없으면 빈 상태 표시.
  const chartData = (settlements ?? []).map((s) => ({
    month: `${parseInt(s.month.split('-')[1] ?? '0', 10)}월`,
    PPA정산: Math.round(s.ppaTotal / 10000),
    Lease정산: Math.round(s.leaseTotal / 10000),
    컨설팅: Math.round(s.consultingTotal / 10000),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">통합 운영 대시보드</h1>
        <p className="mt-1 text-sm text-slate-400">전체 도메인 KPI 한눈에 보기</p>
      </div>

      <StatsGrid columns={4}>
        <StatCard
          icon={<Zap size={18} className="text-amber-400" />}
          label="발전소"
          value={`${dashboard?.totalPlants ?? 0}개`}
          sub={`정상 ${dashboard?.normalPlants ?? 0} · 이상 ${dashboard?.anomalyPlants ?? 0} · 오프라인 ${dashboard?.offlinePlants ?? 0}`}
        />
        <StatCard
          icon={<AlertTriangle size={18} className="text-red-400" />}
          label="미해결 이상"
          value={`${dashboard?.unresolvedAnomalies ?? 0}건`}
        />
        <StatCard
          icon={<Building2 size={18} className="text-sky-400" />}
          label="수용가"
          value={`${dashboard?.totalConsumers ?? 0}개사`}
        />
        <StatCard
          icon={<FileText size={18} className="text-emerald-400" />}
          label="활성 계약"
          value={`${dashboard?.activeContracts ?? 0}건`}
        />
      </StatsGrid>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <StatsGrid columns={2} className="self-start">
          <StatCard
            icon={<TrendingUp size={18} className="text-amber-400" />}
            label="현재 총 출력"
            value={`${((dashboard?.totalCurrentOutputKw ?? 0) / 1000).toFixed(1)} MW`}
          />
          <StatCard
            icon={<Zap size={18} className="text-emerald-400" />}
            label="오늘 발전량"
            value={`${((dashboard?.todayGenerationKwh ?? 0) / 1000).toFixed(1)} MWh`}
          />
        </StatsGrid>

        <SectionCard title="월별 정산 현황" description={`${currentYear}년`}>
          <div>
            {chartData.length > 0 ? (
              <RmsBarChart
                data={chartData}
                xKey="month"
                bars={[
                  { key: 'PPA정산', name: 'PPA (만원)', color: '#3B82F6' },
                  { key: 'Lease정산', name: '온사이트 PPA (만원)', color: '#F59E0B' },
                  { key: '컨설팅', name: '컨설팅 (만원)', color: '#8B5CF6' },
                ]}
                height={220}
              />
            ) : (
              <div className="flex h-[220px] items-center justify-center text-sm text-slate-500">
                {settlementsError
                  ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
                  : settlementsLoading
                    ? '정산 데이터 불러오는 중…'
                    : `${currentYear}년 확정된 정산 내역이 없습니다`}
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="최근 이상 이벤트"
        actions={
          <Button size="sm" variant="ghost" onClick={() => router.push('/monitoring/anomalies')}>
            전체 보기 <ChevronRight size={14} />
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-400 border-b border-white/[0.06]">
              <tr>
                <th className="px-4 py-3 font-medium">발전소</th>
                <th className="px-4 py-3 font-medium">심각도</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">제목</th>
                <th className="px-4 py-3 font-medium">감지 시각</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {recentAnomalies.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    이상 이벤트 없음
                  </td>
                </tr>
              )}
              {recentAnomalies.map((a: any) => (
                <tr key={a.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-white">{a.plantName}</td>
                  <td className="px-4 py-3">
                    <Badge variant={a.severity === 'CRITICAL' ? 'danger' : a.severity === 'HIGH' ? 'warning' : 'info'}>
                      {a.severity}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={a.status === 'RESOLVED' ? 'success' : 'warning'}>{a.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-300 max-w-xs truncate">{a.title}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs tabular-nums">
                    {a.detectedAt ? new Date(a.detectedAt).toLocaleString('ko-KR') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button
          variant="ghost"
          className="h-auto py-4 flex flex-col gap-1"
          onClick={() => router.push('/platform/ppa/dashboard')}
        >
          <DollarSign size={20} className="text-sky-400" />
          <span className="text-sm font-medium">PPA 관리</span>
          <span className="text-xs text-slate-400">계약·정산·청구</span>
        </Button>
        <Button
          variant="ghost"
          className="h-auto py-4 flex flex-col gap-1"
          onClick={() => router.push('/platform/lease/contracts')}
        >
          <FileText size={20} className="text-amber-400" />
          <span className="text-sm font-medium">Lease 관리</span>
          <span className="text-xs text-slate-400">PPA·정산·청구</span>
        </Button>
        <Button
          variant="ghost"
          className="h-auto py-4 flex flex-col gap-1"
          onClick={() => router.push('/consulting/projects')}
        >
          <Users size={20} className="text-violet-400" />
          <span className="text-sm font-medium">컨설팅 관리</span>
          <span className="text-xs text-slate-400">프로젝트·진행현황</span>
        </Button>
      </div>
    </div>
  );
}
