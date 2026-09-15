'use client';

import { useEffect, useState } from 'react';
import { Database, Wifi, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { StatCard, StatsGrid, SectionCard } from '@/components/features';
import { Badge } from '@/components/ui/Badge';
import { getApiClient } from '@/api/client';

interface HealthStatus {
  status: string;
  components?: Record<string, { status: string; details?: Record<string, any> }>;
}

function useHealth() {
  const [data, setData] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const resp = await fetch('/actuator/health');
        const json = await resp.json();
        setData(json);
      } catch {
        setData({ status: 'DOWN' });
      } finally {
        setLoading(false);
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading };
}

function useLaseeStatus() {
  const [data, setData] = useState<{ status: string; plantCount: number; lastUpdate: string | null }>({
    status: 'UNKNOWN',
    plantCount: 0,
    lastUpdate: null,
  });

  useEffect(() => {
    const check = async () => {
      try {
        const plants = await getApiClient().get('/monitoring/map/plants');
        const arr = plants as any[];
        setData({
          status: arr.length > 0 ? 'CONNECTED' : 'NO_DATA',
          plantCount: arr.length,
          lastUpdate: new Date().toISOString(),
        });
      } catch {
        setData({ status: 'DISCONNECTED', plantCount: 0, lastUpdate: null });
      }
    };
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, []);

  return data;
}

export default function SystemHealthPage() {
  const health = useHealth();
  const lasee = useLaseeStatus();
  const isUp = health.data?.status === 'UP';
  const dbStatus = health.data?.components?.db?.status ?? 'UNKNOWN';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">시스템 상태</h1>
        <p className="mt-1 text-sm text-slate-400">인프라 Health · LASEE 연동 · 배치 작업 현황</p>
      </div>

      <StatsGrid columns={4}>
        <StatCard
          icon={
            isUp ? (
              <CheckCircle size={18} className="text-emerald-400" />
            ) : (
              <AlertTriangle size={18} className="text-red-400" />
            )
          }
          label="애플리케이션"
          value={isUp ? 'Healthy' : 'Unhealthy'}
          sub={health.data?.status ?? 'LOADING'}
        />
        <StatCard
          icon={<Database size={18} className="text-sky-400" />}
          label="데이터베이스"
          value={dbStatus === 'UP' ? 'Connected' : dbStatus}
          sub={dbStatus}
        />
        <StatCard
          icon={<Wifi size={18} className={lasee.status === 'CONNECTED' ? 'text-emerald-400' : 'text-red-400'} />}
          label="LASEE API"
          value={lasee.status === 'CONNECTED' ? `${lasee.plantCount}개 발전소` : 'Disconnected'}
          sub={lasee.status}
        />
        <StatCard
          icon={<Clock size={18} className="text-violet-400" />}
          label="마지막 체크"
          value={lasee.lastUpdate ? new Date(lasee.lastUpdate).toLocaleTimeString('ko-KR') : '-'}
        />
      </StatsGrid>

      <SectionCard title="배치 작업 스케줄">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-400 border-b border-white/[0.06]">
              <tr>
                <th className="px-4 py-3 font-medium">작업</th>
                <th className="px-4 py-3 font-medium">주기</th>
                <th className="px-4 py-3 font-medium">설명</th>
                <th className="px-4 py-3 font-medium">데이터 보관</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              <tr className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-white">실시간 데이터 수집</td>
                <td className="px-4 py-3 text-sky-400">60초</td>
                <td className="px-4 py-3 text-slate-300">인버터 실시간 데이터 수집</td>
                <td className="px-4 py-3 text-slate-400">7일</td>
              </tr>
              <tr className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-white">5분 집계</td>
                <td className="px-4 py-3 text-sky-400">5분</td>
                <td className="px-4 py-3 text-slate-300">5분 단위 데이터 집계</td>
                <td className="px-4 py-3 text-slate-400">30일</td>
              </tr>
              <tr className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-white">시간별 집계</td>
                <td className="px-4 py-3 text-sky-400">매시 02분</td>
                <td className="px-4 py-3 text-slate-300">시간별 데이터 집계</td>
                <td className="px-4 py-3 text-slate-400">365일</td>
              </tr>
              <tr className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-white">일별 집계</td>
                <td className="px-4 py-3 text-sky-400">매일 00:10</td>
                <td className="px-4 py-3 text-slate-300">일별 집계 → 정산/예측/RE100 트리거</td>
                <td className="px-4 py-3 text-slate-400">영구</td>
              </tr>
              <tr className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-white">데이터 정리</td>
                <td className="px-4 py-3 text-sky-400">매일 01:30</td>
                <td className="px-4 py-3 text-slate-300">보관 기간 초과 데이터 자동 정리</td>
                <td className="px-4 py-3 text-slate-400">-</td>
              </tr>
              <tr className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-white">이상 감지 에스컬레이션</td>
                <td className="px-4 py-3 text-sky-400">10분</td>
                <td className="px-4 py-3 text-slate-300">미처리 이상 알림 에스컬레이션 체크</td>
                <td className="px-4 py-3 text-slate-400">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="서비스 컴포넌트 상태">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(health.data?.components ?? {}).map(([name, comp]) => (
            <div key={name} className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-1">
                {comp.status === 'UP' ? (
                  <CheckCircle size={14} className="text-emerald-400" />
                ) : (
                  <AlertTriangle size={14} className="text-red-400" />
                )}
                <span className="text-xs font-medium text-white">{name}</span>
              </div>
              <Badge variant={comp.status === 'UP' ? 'success' : 'danger'} className="text-[10px]">
                {comp.status}
              </Badge>
            </div>
          ))}
          {Object.keys(health.data?.components ?? {}).length === 0 && (
            <div className="col-span-4 text-center text-slate-500 text-sm py-4">
              {health.loading
                ? 'Health 정보 로딩 중...'
                : 'Actuator health 데이터 없음 (show-details: when-authorized)'}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
