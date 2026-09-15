'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Briefcase, User, CheckCircle } from 'lucide-react';
import { useToastStore } from '@/stores/useToastStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormSection } from '@/components/features/FormSection';
import { cn } from '@/lib/utils';
import { MILESTONE_TEMPLATES } from '@/types/consultation';
import type { MilestoneTemplate } from '@/types/consultation';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useCreateConsultation, useCreateMilestone } from '@/hooks/consulting/useConsultations';

const PROJECT_TYPES = [
  { value: 'PPA', label: 'PPA 계약' },
  { value: 'RE100', label: 'RE100 이행' },
  { value: 'CBAM', label: 'CBAM 대응' },
];

const AGENCIES: {
  value: string;
  label: string;
  summary: { name: string; completedProjects: number; avgRating: number; specialties: string[]; region: string };
}[] = [];

const CONSUMER_OPTIONS = [{ value: '', label: '담당자가 발굴 예정' }];

const REGIONS = [
  { value: 'seoul', label: '서울/수도권' },
  { value: 'chungcheong', label: '충청권' },
  { value: 'gyeongsang', label: '경상권' },
  { value: 'jeolla', label: '전라권' },
  { value: 'gangwon', label: '강원권' },
  { value: 'jeju', label: '제주권' },
];

const INDUSTRIES = [
  { value: 'manufacturing', label: '제조업' },
  { value: 'it', label: 'IT/소프트웨어' },
  { value: 'logistics', label: '유통/물류' },
  { value: 'construction', label: '건설' },
  { value: 'service', label: '서비스업' },
  { value: 'energy', label: '에너지' },
];

interface MockAssignee {
  id: string;
  name: string;
  title: string;
  specialties: string[];
  completedProjects: number;
  currentProjects: number;
}

const AGENCY_ASSIGNEES: Record<string, MockAssignee[]> = {};

/* ───────────────── Form State ───────────────── */

interface ProjectForm {
  name: string;
  type: string;
  scope: string;
  estimatedAmount: string;
  startDate: string;
  endDate: string;
  agencyId: string;
  consumerId: string;
  targetRegion: string;
  targetIndustry: string;
  assigneeId: string;
  milestones: (MilestoneTemplate & { duration: string })[];
}

const INITIAL_FORM: ProjectForm = {
  name: '',
  type: '',
  scope: '',
  estimatedAmount: '',
  startDate: '',
  endDate: '',
  agencyId: '',
  consumerId: '',
  targetRegion: '',
  targetIndustry: '',
  assigneeId: '',
  milestones: [],
};

/* ───────────────── Component ───────────────── */

const STEP_TITLES = ['기본 정보', '담당자 배정', '마일스톤 설정'];

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProjectForm>(INITIAL_FORM);

  const selectedAgency = AGENCIES.find((a) => a.value === form.agencyId);
  const assignees = AGENCY_ASSIGNEES[form.agencyId] ?? [];

  // When project type changes, load milestone templates
  const handleTypeChange = (type: string) => {
    const templates = MILESTONE_TEMPLATES.outsource;
    setForm({
      ...form,
      type,
      milestones: templates.map((t) => ({ ...t, duration: '' })),
    });
  };

  const totalDuration = form.milestones.reduce((sum, m) => sum + (parseInt(m.duration) || 0), 0);

  const canNext =
    (step === 0 && form.name && form.type && form.agencyId) ||
    (step === 1 && form.assigneeId) ||
    (step === 2 && form.milestones.length > 0);

  const toast = useToastStore((s) => s.add);
  const createConsultation = useCreateConsultation();
  const createMilestone = useCreateMilestone();

  const DOMAIN_MAP: Record<string, string> = {
    PPA: 'RE100',
    RE100: 'RE100',
    CARBON: 'CARBON_REDUCTION',
    DISTRIBUTED: 'DISTRIBUTED_ENERGY',
    CBAM: 'CARBON_REDUCTION',
  };

  const handleSubmit = async () => {
    try {
      const domain = DOMAIN_MAP[form.type] ?? 'RE100';
      const result = await createConsultation.mutateAsync({
        clientCompanyId: 562,
        origin: 'OUTSOURCE',
        domain,
      });
      const newId = (result as any)?.id;
      if (newId && form.milestones.length > 0) {
        for (let i = 0; i < form.milestones.length; i++) {
          const m = form.milestones[i]!;
          await createMilestone.mutateAsync({
            consultationId: newId,
            data: {
              title: m.title,
              description: m.description,
              sortOrder: i + 1,
              weight: m.weight,
              actionType: m.actionType?.toUpperCase() ?? null,
            },
          });
        }
      }
      toast('success', '프로젝트가 생성되었습니다');
      if (newId) {
        router.push(`/consulting/project/${newId}?origin=outsource`);
      } else {
        router.push('/consulting/projects');
      }
    } catch {
      toast('error', '프로젝트 생성에 실패했습니다');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Dim overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal wizard */}
      <div className="relative z-10 w-full max-w-2xl mx-4 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-2xl overflow-hidden">
        {/* Breadcrumb */}
        <div className="px-8 pt-5">
          <Breadcrumb
            items={[
              { label: '통합에너지 컨설팅', path: '/consulting' },
              { label: '프로젝트', path: '/consulting/projects' },
              { label: '새 프로젝트' },
            ]}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-8 py-5">
          <div>
            <h1 className="text-lg font-bold text-white">프로젝트 생성</h1>
            <p className="mt-0.5 text-xs text-slate-400">3단계로 용역 프로젝트를 생성합니다</p>
          </div>
          <button
            onClick={() => router.push('/consulting/projects')}
            className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="닫기"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 border-b border-white/[0.06]">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors border-b-2',
                i === step && 'border-primary text-primary bg-primary/[0.04]',
                i < step && 'border-emerald-500/50 text-emerald-400',
                i > step && 'border-transparent text-slate-500',
              )}
            >
              <div
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold',
                  i === step && 'bg-primary/20 text-primary',
                  i < step && 'bg-emerald-500/20 text-emerald-400',
                  i > step && 'bg-white/[0.04] text-slate-500',
                )}
              >
                {i < step ? '✓' : i + 1}
              </div>
              {STEP_TITLES[i]}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="px-8 py-6 max-h-[60vh] overflow-y-auto">
          {/* ─── Step 1: 기본 정보 ─── */}
          {step === 0 && (
            <div className="space-y-6">
              <FormSection title="프로젝트 정보" description="프로젝트의 기본 정보를 입력하세요">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="프로젝트명"
                    required
                    placeholder="예: 2026 PPA 계약 프로젝트"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                  <Select
                    label="프로젝트 유형"
                    required
                    placeholder="유형 선택"
                    options={PROJECT_TYPES}
                    value={form.type}
                    onChange={(e) => handleTypeChange(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-accent mb-1.5">용역 범위</label>
                  <textarea
                    placeholder="프로젝트의 용역 범위를 상세히 기술하세요"
                    value={form.scope}
                    onChange={(e) => setForm({ ...form, scope: e.target.value })}
                    rows={3}
                    className="w-full rounded border border-accent/30 bg-surface-dark px-3 py-2.5 text-sm text-white placeholder:text-accent/40 transition-colors hover:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    label="예상 계약 금액"
                    placeholder="50,000,000"
                    value={form.estimatedAmount}
                    onChange={(e) => setForm({ ...form, estimatedAmount: e.target.value })}
                  />
                  <Input
                    label="시작일"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                  <Input
                    label="마감일"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
              </FormSection>

              <FormSection title="용역사 선택" description="프로젝트를 수행할 용역사를 선택하세요">
                <Select
                  label="용역사"
                  required
                  placeholder="용역사를 선택하세요"
                  options={AGENCIES.map((a) => ({ value: a.value, label: a.label }))}
                  value={form.agencyId}
                  onChange={(e) => setForm({ ...form, agencyId: e.target.value, assigneeId: '' })}
                />
                {/* 용역사 요약 카드 */}
                {selectedAgency && (
                  <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Briefcase size={16} className="text-primary" />
                      <span className="text-sm font-semibold text-white">{selectedAgency.summary.name}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] text-slate-500">완료 프로젝트</p>
                        <p className="text-sm font-bold text-white">{selectedAgency.summary.completedProjects}건</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500">평균 평점</p>
                        <p className="text-sm font-bold text-white">{selectedAgency.summary.avgRating}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500">활동 지역</p>
                        <p className="text-sm font-bold text-white">{selectedAgency.summary.region}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedAgency.summary.specialties.map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </FormSection>

              <FormSection title="대상 정보" description="용역 대상 정보를 입력하세요 (선택)">
                <Select
                  label="대상 수용가"
                  placeholder="담당자가 발굴 예정"
                  options={CONSUMER_OPTIONS}
                  value={form.consumerId}
                  onChange={(e) => setForm({ ...form, consumerId: e.target.value })}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="목표 지역"
                    placeholder="지역 선택"
                    options={REGIONS}
                    value={form.targetRegion}
                    onChange={(e) => setForm({ ...form, targetRegion: e.target.value })}
                  />
                  <Select
                    label="목표 업종"
                    placeholder="업종 선택"
                    options={INDUSTRIES}
                    value={form.targetIndustry}
                    onChange={(e) => setForm({ ...form, targetIndustry: e.target.value })}
                  />
                </div>
              </FormSection>
            </div>
          )}

          {/* ─── Step 2: 담당자 배정 ─── */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-white">담당자를 선택하세요</h2>
              <p className="text-xs text-slate-400">
                {selectedAgency?.label ?? '선택된 용역사'}의 담당 컨설턴트를 배정합니다
              </p>

              {assignees.length === 0 ? (
                <div className="rounded-xl bg-white/[0.02] ring-1 ring-white/[0.06] p-8 text-center">
                  <p className="text-sm text-slate-500">용역사를 먼저 선택해주세요</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assignees.map((person) => (
                    <button
                      key={person.id}
                      onClick={() => setForm({ ...form, assigneeId: person.id })}
                      className={cn(
                        'w-full rounded-xl p-4 text-left ring-1 transition-all',
                        form.assigneeId === person.id
                          ? 'bg-primary/10 ring-primary/30'
                          : 'bg-white/[0.02] ring-white/[0.06] hover:ring-white/[0.12]',
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold',
                              form.assigneeId === person.id
                                ? 'bg-primary/20 text-primary'
                                : 'bg-white/[0.06] text-slate-400',
                            )}
                          >
                            <User size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{person.name}</p>
                            <p className="text-xs text-slate-400">{person.title}</p>
                          </div>
                        </div>
                        {form.assigneeId === person.id && <CheckCircle size={18} className="text-primary mt-1" />}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {person.specialties.map((s) => (
                          <span
                            key={s}
                            className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-medium text-slate-300"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-6">
                        <div>
                          <span className="text-[10px] text-slate-500">완료 프로젝트</span>
                          <p className="text-xs font-bold text-white">{person.completedProjects}건</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500">현재 프로젝트</span>
                          <p className="text-xs font-bold text-white">{person.currentProjects}건</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Step 3: 마일스톤 설정 ─── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">마일스톤 설정</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    프로젝트 유형에 따른 기본 마일스톤이 설정되어 있습니다
                  </p>
                </div>
                {totalDuration > 0 && (
                  <div className="rounded-lg bg-primary/10 px-3 py-1.5">
                    <span className="text-xs font-medium text-primary">총 예상 기간: {totalDuration}일</span>
                  </div>
                )}
              </div>

              {form.milestones.length === 0 ? (
                <div className="rounded-xl bg-white/[0.02] ring-1 ring-white/[0.06] p-8 text-center">
                  <p className="text-sm text-slate-500">프로젝트 유형을 선택하면 마일스톤이 자동으로 설정됩니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {form.milestones.map((milestone, idx) => (
                    <div key={idx} className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {idx + 1}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-white">{milestone.title}</p>
                            <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-400">
                              비중 {milestone.weight}%
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">{milestone.description}</p>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] text-slate-500">기간 (일)</label>
                              <input
                                type="number"
                                min={1}
                                placeholder="0"
                                value={milestone.duration}
                                onChange={(e) => {
                                  const updated = form.milestones.map((m, i) =>
                                    i === idx ? { ...m, duration: e.target.value } : m,
                                  );
                                  setForm({ ...form, milestones: updated });
                                }}
                                className="h-7 w-20 rounded border border-accent/30 bg-surface-dark px-2 text-xs text-white placeholder:text-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                              />
                            </div>
                            {milestone.actionLabel && (
                              <span className="text-[10px] text-slate-500">산출물: {milestone.actionLabel}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.06] px-8 py-4">
          <Button
            variant="secondary"
            onClick={() => (step === 0 ? router.push('/consulting/projects') : setStep(step - 1))}
          >
            <ArrowLeft size={14} className="mr-1" />
            {step === 0 ? '취소' : '이전'}
          </Button>
          {step < 2 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
              다음단계
              <ArrowRight size={14} className="ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canNext}>
              프로젝트 생성
              <ArrowRight size={14} className="ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
