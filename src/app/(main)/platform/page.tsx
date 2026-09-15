'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/stores';
import { Users, Building2, ShieldCheck, Activity, ChevronRight, UserCheck } from 'lucide-react';
import { StatCard, StatsGrid, SectionCard, OnboardingModal } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { RmsBarChart, RmsPieChart } from '@/components/ui/Chart';
import { useAuditLogs } from '@/hooks/platform/useAuditLogs';
import { useDashboardSummary } from '@/hooks/monitoring/useDashboard';
import { useCompanies } from '@/hooks/platform/useCompanies';
import { useUsers } from '@/hooks/platform/useUsers';
import { usePpaContracts } from '@/hooks/ppa/usePpa';

const ROLE_LABEL: Record<string, string> = {
  SYSTEM_ADMIN: '시스템 관리자',
  COMPANY_ADMIN: '기업 관리자',
  POWER_OPERATOR: '발전소 운영자',
  PPA_MANAGER: 'PPA 관리자',
  VPP_TRADER: 'VPP 거래자',
  CONSULTANT: '컨설턴트',
  CONSUMER_MANAGER: '수용가 관리자',
  SPC_OPERATOR: 'SPC 운영자',
  VIEWER: '조회자',
};

const AUDIT_STYLE = {
  success: 'text-emerald-400',
  info: 'text-blue-400',
  warning: 'text-amber-400',
};

export default function PlatformPage() {
  const router = useRouter();
  const { isCompleted, complete, hydrate } = useOnboardingStore();
  const onboarded = isCompleted('admin');
  useDashboardSummary();

  const { data: allUsers } = useUsers({ size: 100 });
  const { data: pendingUsers } = useUsers({ status: 'PENDING' as const, size: 20 });
  const { data: activeUsers } = useUsers({ status: 'ACTIVE' as const, size: 1 });
  const { data: companiesData } = useCompanies({ size: 1 });
  const { data: auditData } = useAuditLogs({ size: 5 });
  const { data: ppaContractsData } = usePpaContracts();

  const totalUserCount = allUsers?.totalElements ?? 0;
  const activeUserCount = activeUsers?.totalElements ?? 0;
  const ppaContracts = (ppaContractsData?.content ?? []) as any[];
  const activePpaCount = ppaContracts.filter((c: any) => c.status === 'ACTIVE').length;
  const totalPpaCount = ppaContracts.length;
  const pendingList = useMemo(
    () =>
      (pendingUsers?.content ?? []).map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        company: u.companyName ?? '-',
        role: (u.roles?.[0] ? ROLE_LABEL[u.roles[0]] : undefined) ?? u.roles?.[0] ?? '-',
        requestDate: u.createdAt?.slice(5, 10).replace('-', '/') ?? '-',
      })),
    [pendingUsers],
  );
  const companyCount = companiesData?.totalElements ?? 0;

  const roleDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    (allUsers?.content ?? []).forEach((u) => {
      const role = u.roles?.[0];
      if (role) {
        const label = ROLE_LABEL[role] ?? role;
        counts[label] = (counts[label] ?? 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([role, count]) => ({ role, 인원: count }))
      .sort((a, b) => b.인원 - a.인원);
  }, [allUsers]);

  const statusDistribution = useMemo(() => {
    const counts = { 활성: 0, 대기: 0, 정지: 0 };
    (allUsers?.content ?? []).forEach((u) => {
      if (u.status === 'ACTIVE') counts.활성++;
      else if (u.status === 'PENDING') counts.대기++;
      else if (u.status === 'SUSPENDED') counts.정지++;
    });
    return Object.entries(counts).map(([status, count]) => ({ status, 인원: count }));
  }, [allUsers]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const completeOnboarding = () => complete('admin');

  return (
    <div className="space-y-6">
      <OnboardingModal
        open={!onboarded}
        onComplete={completeOnboarding}
        persona="admin"
        welcomeIcon={ShieldCheck}
        welcomeIconColor="text-emerald-400"
        welcomeIconBg="bg-emerald-500/[0.10]"
        welcomeTitle="플랫폼 관리자 포털에 오신 것을 환영합니다"
        welcomeDescription="사용자, 기업, 거래를 한 곳에서 관리하세요."
        steps={[
          {
            icon: UserCheck,
            iconColor: 'text-sky-400',
            iconBg: 'bg-sky-500/[0.10]',
            title: '사용자 승인 관리',
            description: '가입 요청을 검토하고 역할을 배정합니다.',
            features: [
              { icon: UserCheck, label: '가입 승인', desc: '신규 가입 검토' },
              { icon: Users, label: '역할 관리', desc: '권한 설정' },
            ],
          },
          {
            icon: Building2,
            iconColor: 'text-emerald-400',
            iconBg: 'bg-emerald-500/[0.10]',
            title: '기업 관리',
            description: '등록 기업 정보를 관리하고 계약 현황을 파악합니다.',
            features: [
              { icon: Building2, label: '기업 등록', desc: '기업 정보 관리' },
              { icon: Activity, label: '계약 현황', desc: '전체 계약 모니터링' },
            ],
          },
          {
            icon: Activity,
            iconColor: 'text-violet-400',
            iconBg: 'bg-violet-500/[0.10]',
            title: '운영 모니터링',
            description: '플랫폼 사용량, DAU, 감사 로그를 확인합니다.',
            features: [
              { icon: Activity, label: 'DAU 추이', desc: '일별 활성 사용자' },
              { icon: ShieldCheck, label: '감사 로그', desc: '운영 이력 추적' },
            ],
          },
        ]}
        ctaLabel="승인 대기 확인하기"
        ctaIcon={ShieldCheck}
        onCtaClick={() => {
          completeOnboarding();
          router.push('/platform/approvals');
        }}
      />
      <Breadcrumb items={[{ label: '플랫폼 관리' }]} />

      <div>
        <h1 className="text-2xl font-bold text-white">플랫폼 관리</h1>
        <p className="mt-1 text-sm text-slate-400">플랫폼 전체 현황과 운영 지표</p>
      </div>

      <StatsGrid columns={4}>
        <StatCard
          icon={<Users size={18} className="text-sky-400" />}
          label="전체 사용자"
          value={`${totalUserCount}명`}
          sub={`활성 ${activeUserCount}명`}
        />
        <StatCard
          icon={<Building2 size={18} className="text-emerald-400" />}
          label="등록 기업"
          value={`${companyCount}개사`}
          sub="발전사 6 · 수용가 4 · SPC 1"
        />
        <StatCard
          icon={<ShieldCheck size={18} className="text-amber-400" />}
          label="승인 대기"
          value={`${pendingList.length}건`}
        />
        <StatCard
          icon={<Activity size={18} className="text-violet-400" />}
          label="PPA 계약"
          value={`${totalPpaCount}건`}
          sub={`ACTIVE ${activePpaCount} · 발전소 9개소`}
        />
      </StatsGrid>

      <SectionCard
        title="승인 대기"
        description={`${pendingList.length}건의 가입 승인 요청`}
        actions={
          <Button size="sm" variant="ghost" onClick={() => router.push('/platform/approvals')}>
            전체 <ChevronRight size={14} />
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-400 border-b border-white/[0.06]">
              <tr>
                <th className="px-6 py-3 font-medium">이름</th>
                <th className="px-6 py-3 font-medium">이메일</th>
                <th className="px-6 py-3 font-medium">소속</th>
                <th className="px-6 py-3 font-medium">요청 역할</th>
                <th className="px-6 py-3 font-medium">신청일</th>
                <th className="px-6 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {pendingList.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-sm text-slate-500">
                    승인 대기 중인 사용자가 없습니다
                  </td>
                </tr>
              )}
              {pendingList.map((a) => (
                <tr key={a.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-6 py-3 text-white">{a.name}</td>
                  <td className="px-6 py-3 text-slate-400">{a.email}</td>
                  <td className="px-6 py-3 text-slate-300">{a.company}</td>
                  <td className="px-6 py-3">
                    <Badge variant="info">{a.role}</Badge>
                  </td>
                  <td className="px-6 py-3 text-slate-400 tabular-nums">{a.requestDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <SectionCard title="역할별 사용자 분포" description="현재 등록 사용자">
            <div>
              {roleDistribution.length > 0 ? (
                <RmsBarChart
                  data={roleDistribution}
                  xKey="role"
                  bars={[{ key: '인원', name: '인원', color: '#8B5CF6' }]}
                  height={300}
                />
              ) : (
                <div className="flex items-center justify-center h-[300px] text-sm text-slate-500">
                  사용자 데이터를 불러오는 중...
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="상태별 사용자" description="현재 기준">
          <div>
            {statusDistribution.some((d) => d.인원 > 0) ? (
              <RmsPieChart
                data={statusDistribution.map((d) => ({
                  name: d.status,
                  value: d.인원,
                  color: d.status === '활성' ? '#10B981' : d.status === '대기' ? '#3B82F6' : '#EF4444',
                }))}
                donut
                height={300}
              />
            ) : (
              <div className="flex items-center justify-center h-[300px] text-sm text-slate-500">
                사용자 데이터를 불러오는 중...
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* PPA 계약 현황 */}
      {ppaContracts.length > 0 && (
        <SectionCard
          title="PPA 계약 현황"
          description={`전체 ${totalPpaCount}건`}
          actions={
            <Button size="sm" variant="ghost" onClick={() => router.push('/platform/ppa/dashboard')}>
              상세 <ChevronRight size={14} />
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-400 border-b border-white/[0.06]">
                <tr>
                  <th className="px-6 py-3 font-medium">계약번호</th>
                  <th className="px-6 py-3 font-medium">유형</th>
                  <th className="px-6 py-3 font-medium">발전사</th>
                  <th className="px-6 py-3 font-medium">수용가</th>
                  <th className="px-6 py-3 font-medium">용량</th>
                  <th className="px-6 py-3 font-medium">단가</th>
                  <th className="px-6 py-3 font-medium">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {ppaContracts.map((c: any) => (
                  <tr key={c.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-6 py-3 text-white tabular-nums">{c.contractNumber}</td>
                    <td className="px-6 py-3 text-slate-300">
                      {c.contractType === 'FIXED' ? '고정가' : c.contractType === 'VARIABLE' ? '변동가' : '혼합'}
                    </td>
                    <td className="px-6 py-3 text-slate-300">{c.generatorCompanyName}</td>
                    <td className="px-6 py-3 text-slate-300">{c.consumerCompanyName}</td>
                    <td className="px-6 py-3 text-white tabular-nums">{c.totalCapacityKw?.toLocaleString()} kW</td>
                    <td className="px-6 py-3 text-slate-300 tabular-nums">₩{c.unitPriceKrw}</td>
                    <td className="px-6 py-3">
                      <Badge variant={c.status === 'ACTIVE' ? 'success' : c.status === 'NEW' ? 'warning' : 'danger'}>
                        {c.status === 'ACTIVE' ? '활성' : c.status === 'NEW' ? '신규' : '해지'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <SectionCard title="최근 감사 로그" actions={<Badge variant="info">{auditData?.content?.length ?? 0}</Badge>}>
        <div className="divide-y divide-white/[0.06]">
          {(!auditData?.content || auditData.content.length === 0) && (
            <div className="px-6 py-8 text-center text-sm text-slate-500">감사 로그가 없습니다</div>
          )}
          {(auditData?.content ?? []).map(
            (log: { id: number; createdAt: string; action: string; targetName?: string }) => (
              <div key={log.id} className="flex items-start gap-3 px-6 py-2.5">
                <span className="text-[11px] text-slate-600 tabular-nums w-10 shrink-0 pt-0.5">
                  {log.createdAt?.slice(11, 16) ?? ''}
                </span>
                <div className="min-w-0">
                  <span className={`text-sm ${AUDIT_STYLE['info']}`}>{log.action}</span>
                  <p className="mt-0.5 text-xs text-slate-400 truncate">{log.targetName ?? ''}</p>
                </div>
              </div>
            ),
          )}
        </div>
      </SectionCard>
    </div>
  );
}
