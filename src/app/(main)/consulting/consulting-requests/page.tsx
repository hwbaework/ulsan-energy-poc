'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, MessageSquare, Zap, Leaf, Sun } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { useConsultations, useAssignConsultant, useCancelConsultation } from '@/hooks/consulting/useConsultations';
import { useAuthStore } from '@/stores/useAuthStore';
import type { ConsultationDomain, DiagnosisForm } from '@/types/consultation';

/* ─── 컨설팅 분야(도메인) 메타 ───
   의뢰 시점에 확정되는 건 "컨설팅 분야 + 무료 진단 제출물"뿐.
   PPA 종류(Lease · 직접 온/오프사이트)는 컨설팅(진단 → 전략)의 산출물이라 의뢰에서 미리 분류하지 않는다. */
const DOMAIN_META: Record<string, { label: string; icon: typeof Zap; tone: string; bg: string; ring: string }> = {
  RE100: { label: 'RE100 이행', icon: Zap, tone: 'text-blue-300', bg: 'bg-blue-500/[0.06]', ring: 'ring-blue-500/30' },
  CARBON_REDUCTION: {
    label: '탄소감축',
    icon: Leaf,
    tone: 'text-emerald-300',
    bg: 'bg-emerald-500/[0.06]',
    ring: 'ring-emerald-500/30',
  },
  DISTRIBUTED_ENERGY: {
    label: '분산에너지',
    icon: Sun,
    tone: 'text-amber-300',
    bg: 'bg-amber-500/[0.06]',
    ring: 'ring-amber-500/30',
  },
  PPA: { label: 'PPA', icon: Zap, tone: 'text-violet-300', bg: 'bg-violet-500/[0.06]', ring: 'ring-violet-500/30' },
};

const DEFAULT_DOMAIN_META = {
  label: '기타',
  icon: Zap,
  tone: 'text-slate-300',
  bg: 'bg-white/[0.04]',
  ring: 'ring-white/[0.10]',
};

/* ─── 진단 성숙도 등급 색상 (D 미흡 ~ A 우수) ─── */
const GRADE_TONE: Record<string, string> = {
  A: 'text-emerald-400',
  B: 'text-blue-400',
  C: 'text-amber-400',
  D: 'text-rose-400',
};

/* ─── 의뢰 상태 ─── */
type RequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

const STATUS_BADGE: Record<RequestStatus, { variant: 'warning' | 'success' | 'danger'; label: string }> = {
  PENDING: { variant: 'warning', label: '대기 중' },
  ACCEPTED: { variant: 'success', label: '수락됨' },
  DECLINED: { variant: 'danger', label: '거절됨' },
};

/* ─── 컨설턴트 신규 의뢰함 mock ───
   의뢰는 수용가의 "무료 진단(5단계) → 견적 요청" 흐름에서 생성된다.
   따라서 의뢰 1건 = 진단 제출물 전체(DiagnosisForm) + 진단 결과 등급.
   상세 모달은 진단 확인(5단계) 화면을 그대로 미러링 + 도메인별 상세까지 컨설턴트에게 노출.
   includePpaSupport 는 "PPA 도입 자문을 원하는가"의 yes/no 플래그일 뿐, 어떤 PPA 인지는 컨설팅 후 결정. */
interface ConsultingRequest {
  id: string;
  status: RequestStatus;
  appliedAt: string;
  maturityGrade: string; // 진단 결과 성숙도 등급 (입력값으로 산정)
  includePpaSupport: boolean; // PPA 도입 자문 포함 여부 (종류 미정)
  summary: string; // 신청 목적 한 줄 (테이블)
  diagnosis: DiagnosisForm; // 무료 진단 제출물 전체 (상세 모달)
}

function apiToRequest(c: any): ConsultingRequest {
  const parseList = (v: unknown): string[] => {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string' && v) return v.split(',').map((s: string) => s.trim());
    return [];
  };
  return {
    id: String(c.id),
    status: c.consultantId ? 'ACCEPTED' : 'PENDING',
    appliedAt: c.appliedAt ? new Date(c.appliedAt).toLocaleDateString('ko-KR') : '',
    maturityGrade: c.maturityGrade ?? '',
    includePpaSupport: c.includePpaSupport ?? false,
    summary: `${DOMAIN_META[c.domain as ConsultationDomain]?.label ?? c.domain} 컨설팅`,
    diagnosis: {
      domain: c.domain ?? 'RE100',
      companySize: c.companySize ?? '',
      industry: c.industry ?? '',
      employeeCount: c.employeeCount ?? 0,
      annualRevenue: c.annualRevenue ?? 0,
      annualEnergyUsage: c.annualEnergyUsage ?? 0,
      currentElecCost: c.currentElecCost ?? 0,
      annualGasUsage: c.annualGasUsage ?? 0,
      annualGhgEmission: c.annualGhgEmission ?? 0,
      siteCount: c.siteCount ?? 0,
      siteRegions: c.siteRegions ?? c.targetRegion ?? '',
      currentREPercent: c.currentRePercent ?? 0,
      currentREMethods: parseList(c.currentReMethods),
      targetTimeline: c.targetTimeline ?? '',
      consultingDrivers: parseList(c.consultingDrivers),
      exportCountries: c.exportCountries ?? '',
      cdpParticipant: c.cdpParticipant ?? false,
      sbtiCommitted: c.sbtiCommitted ?? false,
      etsParticipant: c.etsParticipant ?? false,
      budgetRange: c.budgetRange ?? '',
      contactName: c.contactName ?? '',
      companyName: c.clientCompanyName ?? '',
      contactEmail: c.contactEmail ?? '',
      contactPhone: c.contactPhone ?? '',
    },
  };
}

type StatusFilter = 'ALL' | RequestStatus;

/* ─── 상세 모달 — 진단 제출물 표시용 작은 부품 ─── */
function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] p-4 space-y-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{title}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-white mt-0.5 break-keep">{value}</p>
    </div>
  );
}

export default function ConsultingRequestsPage() {
  const router = useRouter();
  const showToast = useToastStore((s) => s.add);
  const user = useAuthStore((s) => s.user);

  const { data: apiData } = useConsultations();
  const assignConsultant = useAssignConsultant();
  const cancelConsultation = useCancelConsultation();

  const requests: ConsultingRequest[] = (apiData?.content ?? [])
    .filter((c: any) => !c.status || c.status === 'APPLIED')
    .map(apiToRequest);

  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [viewing, setViewing] = useState<ConsultingRequest | null>(null);

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const acceptedCount = requests.filter((r) => r.status === 'ACCEPTED').length;

  // 검색 + 분야 + 상태 필터
  const filtered = requests.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (keyword) {
      const q = keyword.toLowerCase();
      const d = r.diagnosis;
      const matched =
        (d.companyName ?? '').toLowerCase().includes(q) ||
        (d.industry ?? '').toLowerCase().includes(q) ||
        (d.siteRegions ?? '').toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q);
      if (!matched) return false;
    }
    return true;
  });

  const handleAccept = (req: ConsultingRequest) => {
    if (!user?.id) return;
    assignConsultant.mutate(
      { id: Number(req.id), consultantId: user.id },
      {
        onSuccess: () => {
          setViewing(null);
          showToast('success', `${req.diagnosis.companyName} 의뢰 수락 — 내 컨설팅에 추가됩니다`);
          router.push('/consultant/consultings');
        },
        onError: () => showToast('error', '수락 처리 중 오류가 발생했습니다'),
      },
    );
  };

  const handleDecline = (req: ConsultingRequest) => {
    cancelConsultation.mutate(Number(req.id), {
      onSuccess: () => {
        setViewing(null);
        showToast('info', `${req.diagnosis.companyName} 의뢰를 거절했습니다`);
      },
      onError: () => showToast('error', '거절 처리 중 오류가 발생했습니다'),
    });
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '통합에너지 컨설팅', path: '/consulting' }, { label: '신규 의뢰' }]} />

      <div>
        <h1 className="text-xl font-bold text-white">신규 의뢰</h1>
        <p className="mt-1 text-sm text-slate-400">
          수용가이 무료 진단을 통해 신청한 RE100 이행 컨설팅 의뢰입니다. 상세에서 진단 입력 전체를 확인할 수 있습니다.
          어떤 PPA를 도입할지는 진단·전략 수립 이후 결정됩니다.
        </p>
      </div>

      {/* SectionCard + 검색 + 분야·상태 탭 */}
      <SectionCard
        title={`신규 의뢰 ${filtered.length}건`}
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="기업명 / 업종 / 지역 검색"
              className="rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-blue-500/50 w-48"
            />
            {/* 상태 필터 */}
            <div className="flex rounded-md bg-white/[0.04] p-0.5 ring-1 ring-white/[0.06]">
              {[
                { key: 'ALL' as const, label: '전체 상태' },
                { key: 'PENDING' as const, label: `대기 (${pendingCount})` },
                { key: 'ACCEPTED' as const, label: `수락 (${acceptedCount})` },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setStatusFilter(opt.key)}
                  className={cn(
                    'px-3 py-1 text-xs rounded transition-colors',
                    statusFilter === opt.key ? 'bg-primary text-white font-medium' : 'text-slate-400 hover:text-white',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-400 border-b border-white/[0.06]">
              <tr>
                <th className="px-4 py-3 font-medium">컨설팅 분야</th>
                <th className="px-4 py-3 font-medium">수용가</th>
                <th className="px-4 py-3 font-medium">지역</th>
                <th className="px-4 py-3 font-medium">진단 결과</th>
                <th className="px-4 py-3 font-medium">신청 내용</th>
                <th className="px-4 py-3 font-medium">신청일</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8">
                    <p className="text-sm text-slate-500">
                      {keyword
                        ? `'${keyword}' 검색 결과가 없습니다`
                        : statusFilter === 'PENDING'
                          ? '대기 중인 의뢰가 없습니다'
                          : statusFilter === 'ACCEPTED'
                            ? '수락된 의뢰가 없습니다'
                            : '컨설팅 의뢰가 없습니다'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const d = r.diagnosis;
                  const meta = DOMAIN_META[d.domain ?? 'RE100'] ?? DEFAULT_DOMAIN_META;
                  const Icon = meta.icon;
                  const statusMeta = STATUS_BADGE[r.status];
                  return (
                    <tr key={r.id} className="hover:bg-white/[0.03] transition-colors">
                      {/* 컨설팅 분야 — PPA 종류가 아니라 도메인 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1',
                            meta.bg,
                            meta.tone,
                            meta.ring,
                          )}
                        >
                          <Icon size={10} className="mr-1" />
                          {meta.label}
                        </span>
                      </td>
                      {/* 수용가 + 업종 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-white font-medium">{d.companyName}</p>
                        <p className="text-[11px] text-slate-500">{d.industry}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{d.siteRegions ?? '-'}</td>
                      {/* 진단 결과 — 의뢰의 출발점인 진단 등급·RE% */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn('font-bold', GRADE_TONE[r.maturityGrade] ?? 'text-slate-300')}>
                          {r.maturityGrade}등급
                        </span>
                        <span className="text-slate-500 text-xs"> · RE {d.currentREPercent}%</span>
                      </td>
                      {/* 신청 내용 + PPA 자문 포함 칩 (종류는 미정) */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 max-w-[260px]">
                          <span className="text-slate-300 text-xs truncate" title={r.summary}>
                            {r.summary}
                          </span>
                          {r.includePpaSupport && (
                            <span className="shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-white/[0.05] text-slate-400 ring-1 ring-white/[0.08]">
                              PPA 자문
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 tabular-nums text-xs whitespace-nowrap">{r.appliedAt}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setViewing(r)}>
                            <MessageSquare size={12} className="mr-1" />
                            상세
                          </Button>
                          {r.status === 'PENDING' && (
                            <>
                              <Button variant="secondary" size="sm" onClick={() => handleDecline(r)}>
                                거절
                              </Button>
                              <Button variant="primary" size="sm" onClick={() => handleAccept(r)}>
                                <CheckCircle2 size={12} className="mr-1" />
                                수락
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* 상세 보기 모달 — 무료 진단 제출물 전체(진단 확인 화면) + 도메인별 상세 */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="의뢰 상세 — 무료 진단 제출 내용"
        size="lg"
        footer={
          viewing?.status === 'PENDING' ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  if (viewing) handleDecline(viewing);
                }}
              >
                거절
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (viewing) handleAccept(viewing);
                }}
              >
                <CheckCircle2 size={14} className="mr-1" />
                수락하고 진행
              </Button>
            </>
          ) : null
        }
      >
        {viewing &&
          (() => {
            const d = viewing.diagnosis;
            const meta = DOMAIN_META[d.domain ?? 'RE100'] ?? DEFAULT_DOMAIN_META;
            const Icon = meta.icon;
            const statusMeta = STATUS_BADGE[viewing.status];
            const initiatives =
              [d.etsParticipant && '배출권거래제', d.cdpParticipant && 'CDP', d.sbtiCommitted && 'SBTi']
                .filter(Boolean)
                .join(', ') || '없음';
            return (
              <div className="max-h-[68vh] overflow-y-auto -mr-3 pr-3 space-y-4">
                {/* 헤더 — 분야 + 진단 등급 + 상태 */}
                <div
                  className={cn(
                    'rounded-lg ring-1 px-4 py-3 flex items-center justify-between flex-wrap gap-2',
                    meta.bg,
                    meta.ring,
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={15} className={meta.tone} />
                    <p className={cn('text-sm font-semibold', meta.tone)}>{meta.label} 컨설팅</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">진단 등급</span>
                    <span className={cn('text-sm font-bold', GRADE_TONE[viewing.maturityGrade] ?? 'text-white')}>
                      {viewing.maturityGrade}등급
                    </span>
                    <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                  </div>
                </div>

                {/* 수용가 헤드라인 */}
                <div className="flex items-end justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">수용가</p>
                    <p className="text-base font-semibold text-white">{d.companyName}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {d.industry} · {d.companySize}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-500 tabular-nums">신청일 {viewing.appliedAt}</p>
                </div>

                {/* 신청 목적 */}
                <div>
                  <p className="text-xs text-slate-400 mb-1">신청 내용</p>
                  <p className="text-sm text-slate-200">{viewing.summary}</p>
                </div>

                {/* 기업 현황 */}
                <DetailSection title="기업 현황">
                  <Field label="기업 규모" value={d.companySize || '-'} />
                  <Field label="업종" value={d.industry || '-'} />
                  <Field label="직원 수" value={d.employeeCount ? `${d.employeeCount.toLocaleString()}명` : '-'} />
                  <Field label="연매출" value={d.annualRevenue ? `${d.annualRevenue.toLocaleString()} 억원` : '-'} />
                  <Field
                    label="연간 전력 사용량"
                    value={d.annualEnergyUsage ? `${d.annualEnergyUsage.toLocaleString()} MWh` : '-'}
                  />
                  <Field
                    label="전기요금 단가"
                    value={d.currentElecCost ? `${d.currentElecCost} 원/kWh` : '산업용 평균 적용'}
                  />
                  <Field label="연간 가스 사용량" value={d.annualGasUsage ? `${d.annualGasUsage} TJ` : '-'} />
                  <Field
                    label="온실가스 배출량"
                    value={d.annualGhgEmission ? `${d.annualGhgEmission.toLocaleString()} tCO2eq` : '자동 추정'}
                  />
                  <Field
                    label="사업장"
                    value={`${d.siteCount ? `${d.siteCount}개` : '-'}${d.siteRegions ? ` (${d.siteRegions})` : ''}`}
                  />
                </DetailSection>

                {/* RE 현황 및 목표 */}
                <DetailSection title="RE 현황 및 목표">
                  <Field label="현재 RE 비율" value={`${d.currentREPercent}%`} />
                  <Field label="목표 기간" value={d.targetTimeline || '-'} />
                  <Field
                    label="현재 RE 조달"
                    value={d.currentREMethods?.filter((m) => m !== '해당 없음').join(', ') || '없음'}
                  />
                  <Field label="요청 배경" value={d.consultingDrivers?.join(', ') || '-'} />
                  <Field label="예산 범위" value={d.budgetRange || '-'} />
                </DetailSection>

                {/* 도메인별 상세 — RE100 */}
                {d.domain === 'RE100' && (
                  <DetailSection title="RE100 추가 정보">
                    <Field label="수출 대상국" value={d.exportCountries || '-'} />
                    <Field label="참여 이니셔티브" value={initiatives} />
                  </DetailSection>
                )}

                {/* 도메인별 상세 — 탄소감축 */}
                {d.domain === 'CARBON_REDUCTION' && (
                  <DetailSection title="탄소 배출 상세">
                    <Field
                      label="Scope 1 (직접)"
                      value={d.scope1Emission ? `${d.scope1Emission.toLocaleString()} tCO2eq` : '-'}
                    />
                    <Field
                      label="Scope 2 (간접)"
                      value={d.scope2Emission ? `${d.scope2Emission.toLocaleString()} tCO2eq` : '-'}
                    />
                    <Field
                      label="Scope 3 (기타)"
                      value={d.scope3Emission ? `${d.scope3Emission.toLocaleString()} tCO2eq` : '-'}
                    />
                    <Field
                      label="감축 목표"
                      value={d.carbonTargetPercent != null ? `${d.carbonTargetPercent}%` : '-'}
                    />
                    <Field label="현재 감축 수단" value={d.carbonMethods?.join(', ') || '-'} />
                    <Field label="참여 이니셔티브" value={initiatives} />
                    <Field label="수출 대상국" value={d.exportCountries || '-'} />
                  </DetailSection>
                )}

                {/* 도메인별 상세 — 분산에너지 */}
                {d.domain === 'DISTRIBUTED_ENERGY' && (
                  <DetailSection title="분산에너지 설비 현황">
                    <Field
                      label="옥상/부지 가용면적"
                      value={d.rooftopArea ? `${d.rooftopArea.toLocaleString()} m²` : '-'}
                    />
                    <Field label="최대 수요" value={d.peakDemand ? `${d.peakDemand.toLocaleString()} kW` : '-'} />
                    <Field
                      label="월 피크요금"
                      value={d.monthlyPeakCost ? `₩${d.monthlyPeakCost.toLocaleString()}` : '-'}
                    />
                    <Field label="수전 형태" value={d.gridType || '-'} />
                    <Field
                      label="기존 분산자원"
                      value={d.existingDER?.filter((x) => x !== '해당 없음').join(', ') || '없음'}
                    />
                    <Field
                      label="관심 설비"
                      value={
                        [d.essInterest && 'ESS', d.evChargerInterest && 'EV 충전'].filter(Boolean).join(', ') || '-'
                      }
                    />
                  </DetailSection>
                )}

                {/* 연락처 */}
                <DetailSection title="연락처">
                  <Field label="담당자" value={d.contactName || '-'} />
                  <Field label="회사명" value={d.companyName || '-'} />
                  <Field label="이메일" value={d.contactEmail || '-'} />
                  <Field label="연락처" value={d.contactPhone || '-'} />
                </DetailSection>

                {/* PPA 자문 포함 안내 — 어떤 PPA 인지는 진단 후 결정 */}
                <div
                  className={cn(
                    'rounded-lg px-4 py-3 ring-1',
                    viewing.includePpaSupport
                      ? 'bg-primary/[0.06] ring-primary/25'
                      : 'bg-white/[0.03] ring-white/[0.08]',
                  )}
                >
                  <p className="text-xs font-medium text-white">
                    {viewing.includePpaSupport ? 'PPA 도입 자문 포함 요청' : 'PPA 자문 미포함'}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {viewing.includePpaSupport
                      ? '직접 PPA(온사이트·오프사이트) 등 구체적 조달 방식은 진단·전략 수립 후 권고안에서 결정됩니다.'
                      : '필요 시 컨설팅 진행 중 PPA 자문을 추가할 수 있습니다.'}
                  </p>
                </div>
              </div>
            );
          })()}
      </Modal>
    </div>
  );
}
