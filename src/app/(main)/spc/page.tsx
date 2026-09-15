'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  Zap,
  TrendingUp,
  ChevronRight,
  Activity,
  ArrowRightLeft,
  Handshake,
  Briefcase,
  Users,
  Target,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSpcFinance } from '@/hooks/spc/useSpc';
import { useOnboardingStore } from '@/stores';
import { StatCard, StatsGrid, SectionCard, AssetRegistrationBanner, OnboardingModal } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useDashboardSummary } from '@/hooks/monitoring/useDashboard';
import { usePowerStations } from '@/hooks/common/usePowerStations';
import { useSpcTradingMonthly, useSpcGenerationDaily, useSpcSuppliers } from '@/hooks/spc/useSpc';
import { RmsBarChart, RmsAreaChart, RmsPieChart } from '@/components/ui/Chart';

// 발전소 상태(BE status 문자열) → 화면 라벨/진행률 매핑.
// PowerStation.status만 실데이터이므로, "진행률"은 운영중=100 / 그 외=0으로만 표기(가짜 세부 진행률 금지).
const STATION_STATUS_LABEL: Record<string, string> = {
  ACTIVE: '운영중',
  ACTIVATED: '운영중',
  OPERATING: '운영중',
  INACTIVE: '대기중',
  PENDING: '대기중',
  SUSPENDED: '점검중',
};

const STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
  운영중: 'success',
  시공중: 'info',
  점검중: 'warning',
  대기중: 'default',
};

type SpcTabKey = 'overview' | 'suppliers' | 'finance';

const SPC_TABS: { key: SpcTabKey; label: string }[] = [
  { key: 'overview', label: 'SPC 현황' },
  { key: 'suppliers', label: '공급기업(22개사)' },
  { key: 'finance', label: '재무' },
];

export default function SpcDashboardPage() {
  const { data: apiDashboard, isError: dashboardError } = useDashboardSummary();
  const { data: stationsData, isError: stationsError } = usePowerStations({ size: 200 } as any);

  // 신규 실 집계(BE) — 월별거래·일별발전·공급기업. 소스 비면 빈 배열 → 빈상태 표시.
  const { data: tradingMonthlyData, isError: tradingError } = useSpcTradingMonthly();
  const { data: generationDailyData, isError: generationError } = useSpcGenerationDaily(30);
  const { data: suppliersData, isError: suppliersError } = useSpcSuppliers();

  const tradingMonthly = (tradingMonthlyData ?? []).map((m) => ({
    month: m.month,
    건수: m.count,
    '용량(kW)': Number(m.totalCapacityKw ?? 0),
  }));
  const generationDaily = (generationDailyData ?? []).map((d) => ({
    date: String(d.date).slice(5),
    kWh: Number(d.totalKwh ?? 0),
  }));
  const supplierGroups = (suppliersData ?? []).map((s) => ({
    name: s.businessType,
    value: Number(s.companyCount ?? 0),
  }));

  // V106: SPC 재무 실적 — 입력 대기(비면 []). 가짜 수치 금지.
  const { data: financeData, isError: financeError } = useSpcFinance();
  const financeRows = financeData ?? [];

  const router = useRouter();
  const { isCompleted, complete, hydrate } = useOnboardingStore();
  const onboarded = isCompleted('spc');
  const [tab, setTab] = useState<SpcTabKey>('overview');

  // 프로젝트 현황 = 실 발전소 목록(power-stations). status만 실데이터, 진행률은 운영중 여부로만 표기.
  const activeProjects: {
    id: number;
    name: string;
    status: string;
    capacity: string;
    progress: number;
  }[] = ((stationsData as any)?.content ?? []).map((st: any) => {
    const label = STATION_STATUS_LABEL[st.status] ?? '대기중';
    return {
      id: st.id,
      name: st.name ?? st.ownerCompanyName ?? '-',
      status: label,
      capacity: st.capacityKw != null ? `${st.capacityKw.toLocaleString()} kW` : '—',
      progress: label === '운영중' ? 100 : 0,
    };
  });

  // 요약 지표 = useDashboardSummary 실값(ppa/asset/lease/trading 카운트)
  const totalPowerStations = apiDashboard?.totalPowerStations ?? 0;
  const activePpaContracts = apiDashboard?.activePpaContracts ?? 0;
  const activeLeaseContracts = apiDashboard?.activeLeaseContracts ?? 0;
  const pendingTradingRequests = apiDashboard?.pendingTradingRequests ?? 0;
  const totalCompanies = apiDashboard?.totalCompanies ?? 0;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const completeOnboarding = () => complete('spc');

  return (
    <div className="space-y-6">
      <OnboardingModal
        open={!onboarded}
        onComplete={completeOnboarding}
        persona="spc"
        welcomeIcon={Building2}
        welcomeIconColor="text-emerald-400"
        welcomeIconBg="bg-emerald-500/[0.10]"
        welcomeTitle="SPC 컨소시엄 포털에 오신 것을 환영합니다"
        welcomeDescription="분산에너지 프로젝트와 참여 기업을 통합 관리하세요."
        steps={[
          {
            icon: Briefcase,
            iconColor: 'text-sky-400',
            iconBg: 'bg-sky-500/[0.10]',
            title: '프로젝트 관리',
            description: '분산에너지 프로젝트를 등록하고 진행 현황을 관리합니다.',
            features: [
              { icon: Briefcase, label: '프로젝트 등록', desc: '신규 프로젝트 생성' },
              { icon: Activity, label: '진행률 추적', desc: '단계별 현황 모니터링' },
            ],
          },
          {
            icon: Users,
            iconColor: 'text-emerald-400',
            iconBg: 'bg-emerald-500/[0.10]',
            title: '참여 기업 관리',
            description: '컨소시엄 참여 기업과 역할을 관리합니다.',
            features: [
              { icon: Building2, label: '기업 등록', desc: '참여사 정보 관리' },
              { icon: Handshake, label: '계약 관리', desc: '기업 간 계약 현황' },
            ],
          },
          {
            icon: Target,
            iconColor: 'text-violet-400',
            iconBg: 'bg-violet-500/[0.10]',
            title: '거래 및 수익',
            description: 'PPA 거래, 발전량 추이, 수익 현황을 한눈에 확인합니다.',
            features: [
              { icon: ArrowRightLeft, label: '전력 거래', desc: 'PPA 거래 관리' },
              { icon: TrendingUp, label: '수익 분석', desc: '월별 수익 추이' },
            ],
          },
        ]}
        ctaLabel="프로젝트 현황 보기"
        ctaIcon={Briefcase}
        onCtaClick={() => {
          completeOnboarding();
          router.push('/consulting/projects');
        }}
      />
      {/* Asset Registration Banner */}
      <AssetRegistrationBanner persona="spc" />

      <Breadcrumb items={[{ label: '컨소시엄 대시보드' }]} />

      <div>
        <h1 className="text-2xl font-bold text-white">컨소시엄 대시보드</h1>
        <p className="mt-1 text-sm text-slate-400">SPC 운영 현황 및 주요 지표</p>
      </div>

      {/* 탭: SPC 현황 ▸ 공급기업(22개사) ▸ 재무 (doc04 §1, 지표2) */}
      <div className="flex items-center gap-1 border-b border-white/[0.06]">
        {SPC_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${
              tab === t.key
                ? 'border-sky-400 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <StatsGrid columns={4}>
            <StatCard
              icon={<Building2 size={18} className="text-sky-400" />}
              label="참여 기업"
              value={dashboardError ? '—' : `${totalCompanies}개사`}
              sub="전체 등록 기업 수"
            />
            <StatCard
              icon={<Zap size={18} className="text-amber-400" />}
              label="등록 발전소"
              value={dashboardError ? '—' : `${totalPowerStations}개소`}
              sub="전체 등록 발전소 수"
            />
            <StatCard
              icon={<Activity size={18} className="text-violet-400" />}
              label="PPA 계약"
              value={dashboardError ? '—' : `${activePpaContracts}건`}
              sub="활성 PPA 계약"
            />
            <StatCard
              icon={<TrendingUp size={18} className="text-emerald-400" />}
              label="온사이트 PPA · 거래요청"
              value={dashboardError ? '—' : `${activeLeaseContracts} · ${pendingTradingRequests}`}
              sub="활성 온사이트 PPA · 대기 거래요청"
            />
          </StatsGrid>

          <SectionCard
            title="프로젝트 현황"
            actions={
              <Button size="sm" variant="ghost" onClick={() => router.push('/consulting/projects')}>
                전체 <ChevronRight size={14} />
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-400 border-b border-white/[0.06]">
                  <tr>
                    <th className="px-6 py-3 font-medium">프로젝트명</th>
                    <th className="px-6 py-3 font-medium">상태</th>
                    <th className="px-6 py-3 font-medium">설비 용량</th>
                    <th className="px-6 py-3 font-medium">진행률</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {stationsError ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                        데이터를 불러오지 못했습니다 — 다시 로그인하세요
                      </td>
                    </tr>
                  ) : activeProjects.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                        등록된 발전소가 없습니다
                      </td>
                    </tr>
                  ) : (
                    activeProjects.map((p) => (
                      <tr key={p.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="px-6 py-3 text-white">{p.name}</td>
                        <td className="px-6 py-3">
                          <Badge variant={STATUS_VARIANT[p.status] ?? 'info'}>{p.status}</Badge>
                        </td>
                        <td className="px-6 py-3 text-slate-300 tabular-nums">{p.capacity}</td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 rounded-full bg-white/10">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${p.progress}%` }} />
                            </div>
                            <span className="text-xs text-slate-400 tabular-nums">{p.progress}%</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SectionCard title="월별 거래 추이" description="trading_requests 기준 월별 건수·용량 집계 (최근 12개월)">
              {tradingError ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">
                  데이터를 불러오지 못했습니다 — 다시 로그인하세요
                </div>
              ) : tradingMonthly.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">
                  월별 거래 집계 데이터가 없습니다
                </div>
              ) : (
                <RmsBarChart
                  data={tradingMonthly}
                  xKey="month"
                  bars={[
                    { key: '건수', name: '거래요청 건수' },
                    { key: '용량(kW)', name: '합산 용량(kW)' },
                  ]}
                  height={280}
                />
              )}
            </SectionCard>

            <SectionCard title="일일 발전량 추이" description="daily_generation_summary 전 발전소 합산 (최근 30일)">
              {generationError ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">
                  데이터를 불러오지 못했습니다 — 다시 로그인하세요
                </div>
              ) : generationDaily.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">
                  일일 발전량 집계 데이터가 없습니다
                </div>
              ) : (
                <RmsAreaChart
                  data={generationDaily}
                  xKey="date"
                  areas={[{ key: 'kWh', name: '발전량(kWh)' }]}
                  height={280}
                />
              )}
            </SectionCard>
          </div>
        </>
      )}

      {tab === 'suppliers' && (
        <SectionCard title="공급기업 구성" description="company_business_types 사업 유형별 기업 수 집계">
          {suppliersError ? (
            <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">
              데이터를 불러오지 못했습니다 — 다시 로그인하세요
            </div>
          ) : supplierGroups.length === 0 ? (
            <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">
              공급기업 구성 데이터가 없습니다
            </div>
          ) : (
            <RmsPieChart data={supplierGroups} donut height={280} />
          )}
        </SectionCard>
      )}

      {tab === 'finance' && (
        <SectionCard title="SPC 재무 구조" description="지분율·배당·상환 (spc_finance · 입력 대기)">
          {financeError ? (
            <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">
              데이터를 불러오지 못했습니다 — 다시 로그인하세요
            </div>
          ) : financeRows.length === 0 ? (
            <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">
              재무 데이터가 없습니다 (입력 대기)
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-400 border-b border-white/[0.06]">
                  <tr>
                    <th className="px-6 py-3 font-medium">SPC 법인</th>
                    <th className="px-6 py-3 font-medium">기간</th>
                    <th className="px-6 py-3 font-medium text-right">지분율(%)</th>
                    <th className="px-6 py-3 font-medium text-right">배당금</th>
                    <th className="px-6 py-3 font-medium text-right">상환금</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {financeRows.map((f) => (
                    <tr key={f.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-6 py-3 text-white">{f.spcEntity}</td>
                      <td className="px-6 py-3 text-slate-400">{f.period ?? '-'}</td>
                      <td className="px-6 py-3 text-slate-300 text-right tabular-nums">{f.equityPct ?? '-'}</td>
                      <td className="px-6 py-3 text-slate-300 text-right tabular-nums">
                        {f.dividend != null ? Number(f.dividend).toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-3 text-slate-300 text-right tabular-nums">
                        {f.repayment != null ? Number(f.repayment).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
