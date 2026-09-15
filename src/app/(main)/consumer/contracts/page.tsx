'use client';

import { useRouter } from 'next/navigation';
import { Handshake, Calendar, FileText, AlertTriangle, HelpCircle, ChevronRight } from 'lucide-react';
import { StatCard, StatsGrid, SectionCard } from '@/components/features';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/useAuthStore';
import { useConsumerContracts } from '@/hooks/consumer/useConsumer';

// 백엔드 status enum → 한국어 라벨 + 색상
const STATUS_BADGE: Record<string, { variant: 'success' | 'warning' | 'info' | 'default'; label: string }> = {
  ACTIVE: { variant: 'success', label: '진행' },
  EXPIRING: { variant: 'warning', label: '만료 임박' },
  PENDING: { variant: 'info', label: '체결 예정' },
  EXPIRED: { variant: 'default', label: '만료' },
};

// 백엔드 contractType → 한국어 라벨 + 설명
const TYPE_BADGE: Record<string, { variant: 'success' | 'warning' | 'info' | 'default'; label: string; desc: string }> =
  {
    PPA: { variant: 'info', label: 'PPA', desc: '전력구매계약(Power Purchase Agreement)' },
    SAVINGS_SHARE: { variant: 'default', label: '절감 셰어', desc: '무상 설치 + 절감액 셰어 (온사이트 PPA)' },
    FIXED_RENT: { variant: 'default', label: '정액제', desc: '월 정액 PPA 요금 (온사이트 PPA)' },
  };

// 만료 임박 D-30 계산
function daysUntilExpiry(contractEnd?: string): number | null {
  if (!contractEnd) return null;
  const end = new Date(contractEnd);
  const today = new Date();
  return Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function ContractsPage() {
  const router = useRouter();

  // ─── 계약 목록 (백엔드 GET /consumer/contracts?companyId=X) ───
  // 응답: PageResponse<ConsumerContract> ({ content: [...] }) 형태로 추정.
  // 백엔드가 형식 변경할 수도 있어 방어적으로 raw 배열·페이지 둘 다 대응
  const companyId = useAuthStore((s) => s.user?.companyId ?? 0);
  const contractsQuery = useConsumerContracts(companyId);
  const rawContractsData: any = contractsQuery.data;
  const contracts: any[] = Array.isArray(rawContractsData)
    ? rawContractsData
    : Array.isArray(rawContractsData?.content)
      ? rawContractsData.content
      : [];

  // 카드용 계산
  const activeCount = contracts.filter((c) => c.status === 'ACTIVE').length;
  const totalCapacity = contracts.reduce((sum, c) => sum + (c.contractCapacityKw ?? 0), 0);
  // 가중평균 단가 = Σ(단가 × 용량) / Σ(용량)
  const weightedAvgPrice = (() => {
    const items = contracts.filter((c) => c.unitPriceKrw && c.contractCapacityKw);
    if (items.length === 0) return null;
    const totalWeight = items.reduce((s, c) => s + c.contractCapacityKw, 0);
    if (totalWeight === 0) return null;
    const weightedSum = items.reduce((s, c) => s + c.unitPriceKrw * c.contractCapacityKw, 0);
    return weightedSum / totalWeight;
  })();
  // 다음 갱신일 = 가장 가까운 contractEnd
  const nextRenewal =
    contracts
      .filter((c) => c.contractEnd && c.status === 'ACTIVE')
      .map((c) => c.contractEnd as string)
      .sort()[0] ?? null;
  const nextRenewalDays = nextRenewal ? daysUntilExpiry(nextRenewal) : null;
  // 만료 임박 = contractEnd 가 0~180일 이내
  const expiringCount = contracts.filter((c) => {
    const d = daysUntilExpiry(c.contractEnd);
    return d !== null && d >= 0 && d <= 180;
  }).length;

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Breadcrumb items={[{ label: '대시보드', path: '/consumer' }, { label: '에너지 계약' }]} />
      </div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">에너지 계약</h1>
          <p className="mt-1 text-sm text-slate-400">전력구매계약 / 절감 셰어 / 정액제 보유 현황</p>
        </div>
        <Button onClick={() => router.push('/ppa/contracts')}>신규 계약 요청</Button>
      </div>

      <StatsGrid columns={4}>
        <StatCard
          icon={<Handshake size={18} className="text-emerald-400" />}
          label="활성 계약"
          value={contractsQuery.isLoading ? '불러오는 중...' : `${activeCount}건`}
        />
        <StatCard
          icon={<FileText size={18} className="text-sky-400" />}
          label="총 계약 용량"
          value={contractsQuery.isLoading ? '불러오는 중...' : `${totalCapacity.toLocaleString()} kW`}
        />
        <StatCard
          icon={<Calendar size={18} className="text-amber-400" />}
          label="가중평균 단가"
          value={
            contractsQuery.isLoading
              ? '불러오는 중...'
              : weightedAvgPrice !== null
                ? `₩${weightedAvgPrice.toFixed(1)}/kWh`
                : '—'
          }
        />
        <StatCard
          icon={<AlertTriangle size={18} className="text-red-400" />}
          label="만료 예정 (6개월)"
          value={contractsQuery.isLoading ? '불러오는 중...' : `${expiringCount}건`}
          sub={
            nextRenewal
              ? `다음 갱신: ${nextRenewal}${nextRenewalDays !== null ? ` (D-${nextRenewalDays})` : ''}`
              : undefined
          }
        />
      </StatsGrid>

      <SectionCard title="계약 목록">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-400 border-b border-white/[0.06]">
              <tr>
                <th className="px-6 py-3 font-medium">계약번호</th>
                <th className="px-6 py-3 font-medium">발전소/공급원</th>
                <th className="px-6 py-3 font-medium">유형</th>
                <th className="px-6 py-3 font-medium">용량</th>
                <th className="px-6 py-3 font-medium">단가</th>
                <th className="px-6 py-3 font-medium">계약 기간</th>
                <th className="px-6 py-3 font-medium">상태</th>
                <th className="px-6 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {contracts.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-sm text-slate-500">
                    등록된 계약이 없습니다
                  </td>
                </tr>
              )}
              {contracts.map((c) => {
                const typeMeta = TYPE_BADGE[c.contractType];
                const statusMeta = STATUS_BADGE[c.status];
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-white/[0.03] transition-colors cursor-pointer"
                    onClick={() => router.push('/ppa/contracts')}
                  >
                    <td className="px-6 py-3 text-slate-300 tabular-nums">{c.contractNumber ?? c.id}</td>
                    <td className="px-6 py-3 text-white">{c.powerStationName}</td>
                    <td className="px-6 py-3">
                      {typeMeta ? (
                        <Tooltip content={typeMeta.desc} wide position="bottom">
                          <span className="inline-flex items-center gap-1 cursor-help">
                            <Badge variant={typeMeta.variant}>{typeMeta.label}</Badge>
                            <HelpCircle size={11} className="text-slate-500" />
                          </span>
                        </Tooltip>
                      ) : (
                        <Badge variant="default">{c.contractType}</Badge>
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-300 tabular-nums">
                      {c.contractCapacityKw ? `${c.contractCapacityKw.toLocaleString()} kW` : '—'}
                    </td>
                    <td className="px-6 py-3 text-slate-300 tabular-nums">
                      {c.unitPriceKrw ? `₩${Number(c.unitPriceKrw).toFixed(1)}/kWh` : '—'}
                    </td>
                    <td className="px-6 py-3 text-slate-400 tabular-nums">
                      {c.contractStart} ~ {c.contractEnd ?? '—'}
                    </td>
                    <td className="px-6 py-3">
                      {statusMeta ? (
                        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                      ) : (
                        <Badge variant="default">{c.status}</Badge>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push('/ppa/contracts');
                        }}
                      >
                        상세 <ChevronRight size={12} />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <button
          onClick={() => router.push('/ppa/contracts')}
          className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          상세 계약 관리 <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
