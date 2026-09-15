'use client';

import { useState } from 'react';
import {
  Plus,
  Users,
  Star,
  Briefcase,
  UserCheck,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Download,
  AlertCircle,
  ArrowUpRight,
  MapPin,
  Mail,
  Phone,
  Award,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard } from '@/components/features/SectionCard';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import type { ConsultationDomain } from '@/types/consultation';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { useProfiles } from '@/hooks/consulting/useConsultations';
import { useQueries } from '@tanstack/react-query';
import { getSpecializations } from '@/api/consulting/consultations';

interface ConsultantRow {
  id: number;
  userId: number;
  name: string;
  email: string;
  phone?: string;
  profileImage?: string;
  specializations: ConsultationDomain[];
  rating: number;
  reviewCount?: number;
  experience?: number;
  activeProjects: number;
  completedProjects: number;
  bio: string;
  region: string;
  agencyId?: number;
  agencyName?: string;
  certifications: string[];
  maxConcurrent: number;
  isAvailable: boolean;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  appliedAt?: string; // 등록 신청일 (심사 대기)
  reviewSteps?: ReviewStep[]; // 심사 단계 — SPC가 하나씩 확인
}

// 심사 단계 — SPC가 각 단계를 눌러 확인하고 승인까지 진행
interface ReviewStep {
  title: string;
  desc: string;
  state: 'done' | 'action' | 'upcoming';
  actor: 'SPC' | '컨설턴트' | '양측';
  date: string;
  items: [string, string][]; // 검토 항목 (key, value)
  file?: string | null; // 첨부 서류
}

// 심사 단계 주체 색 (SPC 파랑 / 컨설턴트 주황 / 양측 보라)
const REVIEW_ACTOR: Record<string, string> = {
  SPC: 'bg-blue-500/[0.12] text-blue-300 ring-blue-500/30',
  컨설턴트: 'bg-amber-500/[0.12] text-amber-300 ring-amber-500/30',
  양측: 'bg-violet-500/[0.12] text-violet-300 ring-violet-500/30',
};

const DOMAIN_LABELS: Record<ConsultationDomain, string> = {
  RE100: 'RE100',
  CARBON_REDUCTION: '탄소감축',
  DISTRIBUTED_ENERGY: '분산에너지',
};

const DOMAIN_COLORS: Record<ConsultationDomain, string> = {
  RE100: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  CARBON_REDUCTION: 'bg-violet-500/10 text-violet-400 ring-violet-500/20',
  DISTRIBUTED_ENERGY: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
};

/* ─── 컨설턴트 상세 — 심사(승인) 검토 뷰 ───
   PENDING: 심사 단계(reviewSteps)를 SPC가 하나씩 눌러 확인 → 전부 확인 시 최종 승인.
   ACTIVE:  심사 이력 없음(이미 승인). 프로필만 표시. 항상 뒤로가기 제공. */
function ConsultantDetail({ consultant, onBack }: { consultant: ConsultantRow; onBack: () => void }) {
  const toast = useToastStore((s) => s.add);
  const [steps, setSteps] = useState<ReviewStep[]>(consultant.reviewSteps ?? []);
  const [stepView, setStepView] = useState<ReviewStep | null>(null);
  const [decided, setDecided] = useState<'APPROVED' | 'REJECTED' | null>(null);

  const doneCount = steps.filter((s) => s.state === 'done').length;
  const allDone = steps.length > 0 && doneCount === steps.length;
  const isPending = consultant.status === 'PENDING';

  const confirmStep = (target: ReviewStep) => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.title === target.title);
      if (idx === -1) return prev;
      const next = prev.map((s, i) => (i === idx ? { ...s, state: 'done' as const, date: '2026-06-12 확인' } : s));
      const ni = next.findIndex((s) => s.state === 'upcoming');
      if (ni !== -1) next[ni] = { ...next[ni], state: 'action' as const } as ReviewStep;
      return next;
    });
    setStepView(null);
    toast('success', `'${target.title}' 단계를 확인했습니다`);
  };

  const approve = () => {
    setDecided('APPROVED');
    toast('success', `${consultant.name} 컨설턴트를 승인했습니다 — 마켓플레이스 활성화`);
  };
  const reject = () => {
    setDecided('REJECTED');
    toast('info', `${consultant.name} 컨설턴트 등록을 반려했습니다`);
  };

  return (
    <div className="space-y-6">
      {/* 뒤로가기 + breadcrumb */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} /> 목록으로
        </button>
        <span className="text-slate-600">/</span>
        <Breadcrumb
          items={[
            { label: '통합에너지 컨설팅', path: '/consulting' },
            { label: '독립 컨설턴트', path: '/consulting/consultants' },
            { label: consultant.name },
          ]}
        />
      </div>

      {/* 프로필 헤더 카드 */}
      <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.08] px-6 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06] text-lg font-bold text-white shrink-0">
              {consultant.name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-white">{consultant.name}</h1>
                <Badge
                  variant={
                    consultant.status === 'ACTIVE' ? 'success' : consultant.status === 'PENDING' ? 'warning' : 'danger'
                  }
                >
                  {consultant.status === 'ACTIVE' ? '활성' : consultant.status === 'PENDING' ? '심사 대기' : '정지'}
                </Badge>
                <span className="text-[11px] text-slate-500">
                  {consultant.agencyName ? `${consultant.agencyName} 소속` : '독립 컨설턴트'}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-400">{consultant.bio}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Mail size={12} className="text-slate-500" />
                  {consultant.email}
                </span>
                {consultant.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone size={12} className="text-slate-500" />
                    {consultant.phone}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} className="text-slate-500" />
                  {consultant.region}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {consultant.specializations.map((s) => (
                  <span
                    key={s}
                    className={cn(
                      'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] ring-1',
                      DOMAIN_COLORS[s],
                    )}
                  >
                    {DOMAIN_LABELS[s]}
                  </span>
                ))}
                {consultant.certifications.map((cert) => (
                  <span
                    key={cert}
                    className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-slate-300 ring-1 ring-white/[0.08]"
                  >
                    <Award size={10} className="text-slate-500" />
                    {cert}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="text-right">
            {isPending ? (
              <>
                <p className="text-[11px] text-slate-500">등록 신청일</p>
                <p className="text-sm text-white tabular-nums mt-0.5">{consultant.appliedAt ?? '-'}</p>
              </>
            ) : (
              <>
                <p className="text-[11px] text-slate-500">평점 · 완료</p>
                <p className="text-sm text-white mt-0.5">
                  <span className="inline-flex items-center gap-0.5 text-amber-300">
                    <Star size={11} className="fill-amber-300" />
                    {consultant.rating || '-'}
                  </span>
                  <span className="text-slate-600"> · </span>
                  {consultant.completedProjects}건
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 심사 진행 — 각 단계 클릭해 확인 → 전부 확인 시 최종 승인 */}
      {steps.length > 0 ? (
        <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.08] overflow-hidden">
          <div className="px-6 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <div>
              <h3 className="text-md font-semibold text-white">심사 진행</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">각 단계를 눌러 확인하고 승인까지 진행하세요</p>
            </div>
            <span className="text-sm font-bold text-primary tabular-nums">
              {doneCount}/{steps.length}
            </span>
          </div>
          <div className="px-6 py-4">
            {steps.map((s, i) => {
              const isLast = i === steps.length - 1;
              return (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => setStepView(s)}
                  className="w-full flex gap-3 text-left group"
                >
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full shrink-0',
                        s.state === 'done' && 'bg-emerald-500/20',
                        s.state === 'action' && 'bg-primary/20 ring-2 ring-primary/40',
                        s.state === 'upcoming' && 'bg-white/[0.05]',
                      )}
                    >
                      {s.state === 'done' ? (
                        <CheckCircle2 size={13} className="text-emerald-400" />
                      ) : s.state === 'action' ? (
                        <span className="text-[10px] font-bold text-primary tabular-nums">{i + 1}</span>
                      ) : (
                        <span className="text-[10px] text-slate-600 tabular-nums">{i + 1}</span>
                      )}
                    </span>
                    {!isLast && (
                      <div
                        className={cn(
                          'w-px flex-1 min-h-[28px]',
                          s.state === 'done' ? 'bg-emerald-500/30' : 'bg-white/[0.08]',
                        )}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pb-5">
                    <div className="rounded-lg -ml-2 px-2 py-1.5 ring-1 ring-transparent group-hover:bg-white/[0.03] group-hover:ring-white/[0.06] transition-colors">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={cn(
                            'text-sm font-medium',
                            s.state === 'done' && 'text-slate-200',
                            s.state === 'action' && 'text-primary',
                            s.state === 'upcoming' && 'text-slate-500',
                          )}
                        >
                          {s.title}
                        </p>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-medium ring-1',
                            REVIEW_ACTOR[s.actor],
                          )}
                        >
                          {s.actor}
                        </span>
                        <span className="text-[10px] text-slate-600 tabular-nums">{s.date}</span>
                        <ArrowUpRight
                          size={12}
                          className="ml-auto text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{s.desc}</p>
                      <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] ring-1 transition-colors bg-white/[0.04] ring-white/[0.08] text-slate-300 group-hover:bg-white/[0.08] group-hover:text-white">
                        <FileText size={11} className="text-blue-400" />
                        {s.state === 'action' ? '확인하기' : s.state === 'done' ? '검토 내역 보기' : '단계 내용 보기'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {/* 승인 / 반려 */}
          {isPending && !decided && (
            <div className="px-6 py-4 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[11px] text-slate-500 inline-flex items-center gap-1.5">
                <AlertCircle size={12} className="text-amber-300" />
                {allDone
                  ? '모든 단계 확인 완료 — 최종 승인할 수 있습니다'
                  : `남은 단계 ${steps.length - doneCount}건을 확인하면 승인할 수 있습니다`}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={reject}>
                  반려
                </Button>
                <Button size="sm" variant="primary" disabled={!allDone} onClick={approve}>
                  <CheckCircle2 size={13} className="mr-1.5" /> 최종 승인
                </Button>
              </div>
            </div>
          )}
          {decided && (
            <div
              className={cn(
                'px-6 py-3 border-t border-white/[0.06] text-sm font-medium',
                decided === 'APPROVED' ? 'text-emerald-300 bg-emerald-500/[0.06]' : 'text-rose-300 bg-rose-500/[0.06]',
              )}
            >
              {decided === 'APPROVED' ? '✓ 승인 완료 — 마켓플레이스 활성화됨' : '✕ 반려 처리됨'}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.08] px-6 py-5">
          <p className="text-sm text-slate-400">이미 승인된 활성 컨설턴트입니다. 심사 이력이 없습니다.</p>
        </div>
      )}

      {/* 단계 검토 팝업 — 항목·서류 확인 + (현재 단계) 확인 완료 */}
      {stepView && (
        <Modal
          open={!!stepView}
          onClose={() => setStepView(null)}
          title={stepView.title}
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setStepView(null)}>
                닫기
              </Button>
              {stepView.file && (
                <Button
                  variant="secondary"
                  onClick={() => toast('success', `${stepView.file} 다운로드를 요청했습니다`)}
                >
                  <Download size={14} className="mr-1.5" /> 서류 다운로드
                </Button>
              )}
              {stepView.state === 'action' && (
                <Button variant="primary" onClick={() => confirmStep(stepView)}>
                  <CheckCircle2 size={14} className="mr-1.5" /> 확인 완료
                </Button>
              )}
            </>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                  stepView.state === 'done' && 'bg-emerald-500/[0.12] text-emerald-300 ring-emerald-500/30',
                  stepView.state === 'action' && 'bg-primary/[0.12] text-primary ring-primary/30',
                  stepView.state === 'upcoming' && 'bg-white/[0.05] text-slate-400 ring-white/[0.1]',
                )}
              >
                {stepView.state === 'done' ? '확인 완료' : stepView.state === 'action' ? 'SPC 확인 차례' : '예정'}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                  REVIEW_ACTOR[stepView.actor],
                )}
              >
                {stepView.actor}
              </span>
              <span className="text-xs text-slate-500 tabular-nums">{stepView.date}</span>
            </div>
            <p className="text-sm text-slate-300">{stepView.desc}</p>
            <p className="text-[11px] uppercase tracking-wide text-slate-500 pt-1">검토 항목</p>
            <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
              {stepView.items.map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <span className="text-xs text-slate-500 shrink-0">{k}</span>
                  <span className="text-sm text-slate-200 text-right">{v}</span>
                </div>
              ))}
            </div>
            {stepView.file && (
              <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-2.5 flex items-center gap-2">
                <FileText size={14} className="text-blue-400 shrink-0" />
                <span className="text-xs text-slate-300 truncate">{stepView.file}</span>
              </div>
            )}
            {stepView.state === 'upcoming' && (
              <p className="text-[11px] text-slate-500">※ 이전 단계가 확인 완료되면 진행할 수 있습니다.</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function ConsultantsPage() {
  const [tabId, setTabId] = useState('all');
  const [search, setSearch] = useState('');
  const [specFilter, setSpecFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [viewingId, setViewingId] = useState<number | null>(null);

  const { data: apiData, isError } = useProfiles();
  const profileIds = (apiData?.content ?? []).map((p: any) => p.id as number);
  const specQueries = useQueries({
    queries: profileIds.map((id: number) => ({
      queryKey: ['consultant', 'specializations', id],
      queryFn: () => getSpecializations(id),
      staleTime: 60_000,
      enabled: !!id,
    })),
  });
  const specsMap = new Map<number, string[]>();
  profileIds.forEach((id: number, i: number) => {
    const d = specQueries[i]?.data;
    if (Array.isArray(d)) specsMap.set(id, d);
  });

  const consultants: ConsultantRow[] =
    !isError && apiData?.content
      ? apiData.content.map((p: any) => ({
          id: p.id,
          userId: p.userId ?? 0,
          name: p.userName ?? '',
          email: '',
          phone: '',
          profileImage: undefined,
          specializations: (specsMap.get(p.id) ?? []) as ConsultationDomain[],
          rating: p.rating ?? 0,
          reviewCount: p.reviewCount ?? 0,
          experience: p.experienceYears ?? 0,
          activeProjects: p.activeProjects ?? 0,
          completedProjects: p.completedProjects ?? 0,
          bio: p.bio ?? '',
          region: p.region ?? '',
          agencyId: undefined,
          agencyName: undefined,
          certifications: p.certifications ?? [],
          maxConcurrent: p.maxConcurrent ?? 3,
          isAvailable: p.available ?? true,
          status: p.status ?? 'ACTIVE',
        }))
      : [];

  // 상세(심사 검토) 뷰 — 행 선택 시 리스트 대신 상세 렌더. 뒤로가기로 복귀
  const viewing = consultants.find((c) => c.id === viewingId);
  if (viewing) {
    return <ConsultantDetail consultant={viewing} onBack={() => setViewingId(null)} />;
  }

  const activeCount = consultants.filter((c) => c.status === 'ACTIVE').length;
  const pendingCount = consultants.filter((c) => c.status === 'PENDING').length;
  const availableCount = consultants.filter((c) => c.isAvailable && c.status === 'ACTIVE').length;

  const filtered = consultants.filter((c) => {
    if (tabId === 'active' && c.status !== 'ACTIVE') return false;
    if (tabId === 'pending' && c.status !== 'PENDING') return false;
    if (specFilter && !c.specializations.includes(specFilter as ConsultationDomain)) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    if (search && !c.name.includes(search) && !c.email.includes(search)) return false;
    return true;
  });

  const columns: Column<ConsultantRow>[] = [
    {
      key: 'name',
      header: '컨설턴트',
      width: '220px',
      render: (row) => (
        <button
          type="button"
          onClick={() => setViewingId(row.id)}
          className="flex items-center gap-2.5 text-left group"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-xs font-medium text-slate-300">
            {row.name[0]}
          </div>
          <div>
            <p className="text-sm font-medium text-white group-hover:text-primary transition-colors">{row.name}</p>
            <p className="text-xs text-slate-500">{row.email}</p>
          </div>
        </button>
      ),
    },
    {
      key: 'specializations',
      header: '전문분야',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.specializations.map((s) => (
            <span
              key={s}
              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] ring-1 ${DOMAIN_COLORS[s]}`}
            >
              {DOMAIN_LABELS[s]}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'rating',
      header: '평점',
      width: '80px',
      align: 'center',
      render: (row) =>
        row.rating > 0 ? (
          <span className="flex items-center justify-center gap-1 text-sm text-amber-400">
            <Star size={12} className="fill-amber-400" /> {row.rating}
          </span>
        ) : (
          <span className="text-sm text-slate-500">-</span>
        ),
    },
    {
      key: 'completedProjects',
      header: '완료 프로젝트',
      width: '110px',
      align: 'center',
      render: (row) => <span className="text-sm text-slate-300 tabular-nums">{row.completedProjects}건</span>,
    },
    {
      key: 'status',
      header: '상태',
      width: '80px',
      render: (row) => (
        <Badge variant={row.status === 'ACTIVE' ? 'success' : row.status === 'PENDING' ? 'warning' : 'danger'}>
          {row.status === 'ACTIVE' ? '활성' : row.status === 'PENDING' ? '심사중' : '정지'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      align: 'right',
      render: (row) => (
        <Button size="sm" variant="ghost" onClick={() => setViewingId(row.id)}>
          {row.status === 'PENDING' ? '심사' : '상세'}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Breadcrumb items={[{ label: '통합에너지 컨설팅', path: '/consulting' }, { label: '독립 컨설턴트' }]} />
      </div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">독립 컨설턴트 관리</h1>
          <p className="mt-1 text-sm text-slate-400">마켓플레이스 독립 컨설턴트를 관리합니다</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} className="mr-1.5" /> 컨설턴트 등록
        </Button>
      </div>

      <StatsGrid columns={4}>
        <StatCard icon={<Users size={16} className="text-blue-400" />} label="전체" value={consultants.length} />
        <StatCard icon={<UserCheck size={16} className="text-emerald-400" />} label="활성" value={activeCount} />
        <StatCard icon={<Briefcase size={16} className="text-amber-400" />} label="상담 가능" value={availableCount} />
        <StatCard icon={<Star size={16} className="text-violet-400" />} label="심사 대기" value={pendingCount} />
      </StatsGrid>

      <Tabs
        tabs={[
          { id: 'all', label: `전체 (${consultants.length})` },
          { id: 'active', label: `활성 (${activeCount})` },
          { id: 'pending', label: `심사 대기 (${pendingCount})` },
        ]}
        activeId={tabId}
        onChange={setTabId}
      />

      <div className="flex items-center gap-3">
        <div className="w-72">
          <Input placeholder="이름, 이메일 또는 소속 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="w-48">
          <Select
            placeholder="전문분야 전체"
            value={specFilter}
            onChange={(e) => setSpecFilter(e.target.value)}
            options={[
              { value: '', label: '전문분야 전체' },
              { value: 'RE100', label: 'RE100' },
            ]}
          />
        </div>
        <div className="w-40">
          <Select
            placeholder="상태 전체"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: '', label: '상태 전체' },
              { value: 'ACTIVE', label: '활성' },
              { value: 'PENDING', label: '심사중' },
              { value: 'SUSPENDED', label: '정지' },
            ]}
          />
        </div>
      </div>

      <SectionCard title="">
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(row) => row.id}
          emptyMessage="등록된 컨설턴트가 없습니다"
        />
      </SectionCard>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="컨설턴트 등록" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="이름" placeholder="홍길동" required />
            <Input label="이메일" type="email" placeholder="name@company.com" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="연락처" placeholder="010-0000-0000" />
            <Input label="지역" placeholder="서울" />
          </div>
          <Select label="주요 전문분야" placeholder="선택" options={[{ value: 'RE100', label: 'RE100' }]} />
          <Input label="경력 (년)" type="number" placeholder="5" />
          <Input label="소개" placeholder="컨설턴트 소개를 입력하세요" />
          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              취소
            </Button>
            <Button onClick={() => setAddOpen(false)}>등록</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
