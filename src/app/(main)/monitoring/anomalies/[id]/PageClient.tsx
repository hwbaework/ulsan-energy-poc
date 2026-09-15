'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { ArrowLeft, Clock, User, CheckCircle, AlertTriangle, Eye, Wrench, CircleCheck, ShieldX } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useAnomaly,
  useAcknowledgeAnomaly,
  useStartWorkAnomaly,
  useResolveAnomaly,
  useMarkFalseAlarm,
} from '@/hooks/monitoring/useAnomalies';
import { useCreateAnomalyAction } from '@/hooks/monitoring/useOperator';
import { useToastStore } from '@/stores/useToastStore';
import { useQueryClient } from '@tanstack/react-query';
import { anomalyKeys } from '@/api/queryKeys';
import { useUsers } from '@/hooks/platform/useUsers';

interface AnomalyAction {
  id: number;
  type: string;
  content: string;
  assignee: string;
  status: string;
  expectedResolution?: string;
  createdAt: string;
  updatedAt: string;
}

interface AnomalyDetail {
  id: number;
  plantId: number;
  plantName: string;
  plantType?: string;
  severity: string;
  status: string;
  title: string;
  description?: string;
  detectedAt: string;
  resolvedAt?: string;
  affectedConsumers?: string[];
  actions: AnomalyAction[];
  createdAt?: string;
  updatedAt?: string;
}

const SEVERITY_VARIANT: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
  CRITICAL: 'danger',
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'info',
};

const STATUS_LABELS: Record<string, string> = {
  DETECTED: '감지됨',
  ACKNOWLEDGED: '확인됨',
  IN_PROGRESS: '조치중',
  RESOLVED: '완료',
  FALSE_ALARM: '오탐',
};

const STATUS_VARIANT: Record<string, 'danger' | 'warning' | 'info' | 'success' | 'default'> = {
  DETECTED: 'danger',
  ACKNOWLEDGED: 'warning',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
  FALSE_ALARM: 'default',
};

const TYPE_LABELS: Record<string, string> = {
  SOLAR: '태양광',
  ORC: 'ORC',
  FUEL_CELL: '연료전지',
};

const STATUS_STEPS = ['DETECTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED'] as const;

const STEP_META: Record<string, { label: string; icon: typeof AlertTriangle }> = {
  DETECTED: { label: '감지', icon: AlertTriangle },
  ACKNOWLEDGED: { label: '확인', icon: Eye },
  IN_PROGRESS: { label: '조치중', icon: Wrench },
  RESOLVED: { label: '완료', icon: CircleCheck },
};

function StatusProgress({ status }: { status: string }) {
  if (status === 'FALSE_ALARM') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-surface-elevated/50 border border-accent/20 px-4 py-3">
        <ShieldX size={16} className="text-slate-400" />
        <span className="text-sm text-slate-400">오탐으로 처리됨</span>
      </div>
    );
  }

  const currentIdx = STATUS_STEPS.indexOf(status as (typeof STATUS_STEPS)[number]);

  return (
    <div className="flex items-center gap-1 rounded-lg bg-surface-elevated/50 border border-accent/20 px-4 py-3">
      {STATUS_STEPS.map((step, idx) => {
        const meta = STEP_META[step]!;
        const Icon = meta.icon;
        const isCompleted = idx <= currentIdx;
        const isCurrent = idx === currentIdx;

        return (
          <div key={step} className="flex items-center gap-1 flex-1">
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                  isCompleted
                    ? isCurrent
                      ? 'bg-primary text-white'
                      : 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-accent/10 text-slate-500',
                )}
              >
                {isCompleted && !isCurrent ? <CheckCircle size={14} /> : <Icon size={14} />}
              </div>
              <span
                className={cn(
                  'text-xs font-medium whitespace-nowrap',
                  isCurrent ? 'text-white' : isCompleted ? 'text-emerald-400' : 'text-slate-500',
                )}
              >
                {meta.label}
              </span>
            </div>
            {idx < STATUS_STEPS.length - 1 && (
              <div className={cn('flex-1 h-px mx-2', idx < currentIdx ? 'bg-emerald-500/40' : 'bg-accent/20')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AnomalyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const numId = Number(id);
  const { data: apiAnomaly, isError } = useAnomaly(numId);
  const acknowledgeMutation = useAcknowledgeAnomaly();
  const startWorkMutation = useStartWorkAnomaly();
  const resolveMutation = useResolveAnomaly();
  const falseAlarmMutation = useMarkFalseAlarm();
  const createActionMutation = useCreateAnomalyAction();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.add);

  const [actionType, setActionType] = useState('현장 점검');
  const [actionContent, setActionContent] = useState('');
  const [actionAssignee, setActionAssignee] = useState('');
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const assigneeRef = useRef<HTMLDivElement>(null);
  const [actionDate, setActionDate] = useState('');
  const { data: usersData } = useUsers({ page: 0, size: 200 });
  const userList = useMemo(() => {
    const raw = ((usersData as any)?.content ?? []) as any[];
    return raw.map((u: any) => ({ id: u.id, name: u.name ?? u.email, role: u.role ?? '' }));
  }, [usersData]);
  const filteredUsers = useMemo(() => {
    if (!assigneeSearch.trim()) return userList;
    const q = assigneeSearch.toLowerCase();
    return userList.filter((u: any) => u.name.toLowerCase().includes(q));
  }, [userList, assigneeSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target as Node)) {
        setShowAssigneeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: anomalyKeys.all });
  };

  const handleError = (label: string) => (err: unknown) => {
    const msg =
      (err as any)?.response?.data?.error?.message ||
      (err as any)?.response?.statusText ||
      (err as any)?.message ||
      '알 수 없는 오류';
    const status = (err as any)?.response?.status ?? '';
    console.error(`[Anomaly ${label}]`, status, msg, err);
    addToast('error', `${label} 실패 (${status}): ${msg}`);
  };

  const anomaly: AnomalyDetail | undefined =
    !isError && apiAnomaly
      ? {
          id: (apiAnomaly as any).id,
          plantId: (apiAnomaly as any).powerStationId ?? (apiAnomaly as any).plantId ?? 0,
          plantName: (apiAnomaly as any).powerStationName ?? (apiAnomaly as any).plantName ?? '',
          plantType: (apiAnomaly as any).detectionType ?? (apiAnomaly as any).plantType,
          severity: (apiAnomaly as any).severity ?? 'LOW',
          status: (apiAnomaly as any).status ?? 'DETECTED',
          title: (apiAnomaly as any).title ?? '',
          description: (apiAnomaly as any).description ?? '',
          detectedAt: (apiAnomaly as any).detectedAt ?? '',
          resolvedAt: (apiAnomaly as any).resolvedAt,
          affectedConsumers: (apiAnomaly as any).affectedConsumers ?? [],
          actions: (apiAnomaly as any).actions ?? [],
          createdAt: (apiAnomaly as any).createdAt ?? '',
          updatedAt: (apiAnomaly as any).updatedAt ?? '',
        }
      : undefined;

  if (!anomaly) return null;

  const isTerminal = anomaly.status === 'RESOLVED' || anomaly.status === 'FALSE_ALARM';

  const nextAction = (() => {
    switch (anomaly.status) {
      case 'DETECTED':
        return {
          label: '확인',
          description: '이상을 인지했음을 표시합니다',
          mutation: acknowledgeMutation,
          action: () =>
            acknowledgeMutation.mutate(numId, {
              onSuccess: () => {
                addToast('success', '이상 인지 처리되었습니다');
                invalidateAll();
              },
              onError: handleError('인지 처리'),
            }),
        };
      case 'ACKNOWLEDGED':
        return {
          label: '조치 시작',
          description: '해당 이상에 대한 조치를 시작합니다',
          mutation: startWorkMutation,
          action: () =>
            startWorkMutation.mutate(numId, {
              onSuccess: () => {
                addToast('success', '조치가 시작되었습니다');
                invalidateAll();
              },
              onError: handleError('조치 시작'),
            }),
        };
      case 'IN_PROGRESS':
        return {
          label: '해결 완료',
          description: '이상이 해결되었음을 표시합니다',
          mutation: resolveMutation,
          action: () =>
            resolveMutation.mutate(numId, {
              onSuccess: () => {
                addToast('success', '이상이 해결 처리되었습니다');
                invalidateAll();
              },
              onError: handleError('해결 처리'),
            }),
        };
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: '모니터링', path: '/monitoring' },
          { label: '이상감지', path: '/monitoring/anomalies' },
          { label: '상세' },
        ]}
      />

      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={() => router.push('/monitoring/anomalies')}>
          <ArrowLeft size={16} />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{anomaly.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={SEVERITY_VARIANT[anomaly.severity]}>{anomaly.severity}</Badge>
            <Badge variant={STATUS_VARIANT[anomaly.status]}>{STATUS_LABELS[anomaly.status]}</Badge>
          </div>
        </div>
      </div>

      <StatusProgress status={anomaly.status} />

      {!isTerminal && (
        <div className="flex items-center gap-3 rounded-lg bg-surface-elevated/50 border border-accent/20 p-4">
          {nextAction && (
            <div className="flex items-center gap-3 flex-1">
              <div>
                <p className="text-sm font-medium text-white">다음 단계: {nextAction.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{nextAction.description}</p>
              </div>
              <Button
                size="sm"
                variant="primary"
                className="ml-auto"
                disabled={nextAction.mutation.isPending}
                onClick={nextAction.action}
              >
                {nextAction.mutation.isPending ? '처리 중...' : nextAction.label}
              </Button>
            </div>
          )}
          <div className="border-l border-accent/20 pl-3">
            <Button
              size="sm"
              variant="ghost"
              disabled={falseAlarmMutation.isPending}
              onClick={() =>
                falseAlarmMutation.mutate(numId, {
                  onSuccess: () => {
                    addToast('info', '오탐으로 처리되었습니다');
                    invalidateAll();
                  },
                  onError: handleError('오탐 처리'),
                })
              }
            >
              {falseAlarmMutation.isPending ? '처리 중...' : '오탐 처리'}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="이상 정보">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-accent">발전소</p>
                <button
                  onClick={() => router.push(`/monitoring/plant/${anomaly.plantId}`)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {anomaly.plantName || '-'}
                </button>
              </div>
              <div>
                <p className="text-xs text-accent">에너지원</p>
                <p className="text-sm text-white">
                  {anomaly.plantType ? (TYPE_LABELS[anomaly.plantType] ?? anomaly.plantType) : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-accent">감지 시간</p>
                <p className="text-sm text-white tabular-nums">
                  {anomaly.detectedAt ? new Date(anomaly.detectedAt).toLocaleString('ko-KR') : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-accent">해결 시간</p>
                <p className="text-sm text-white tabular-nums">
                  {anomaly.resolvedAt ? new Date(anomaly.resolvedAt).toLocaleString('ko-KR') : '-'}
                </p>
              </div>
            </div>
            {anomaly.description && (
              <div>
                <p className="text-xs text-accent mb-1">상세 설명</p>
                <p className="text-sm text-slate-300 leading-relaxed">{anomaly.description}</p>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="영향 수용가">
          {(anomaly.affectedConsumers?.length ?? 0) > 0 ? (
            <div className="space-y-2">
              {anomaly.affectedConsumers!.map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-lg border border-accent/20 bg-surface-elevated/50 p-3"
                >
                  <span className="text-sm text-white">{name}</span>
                  <Badge variant={isTerminal ? 'success' : 'warning'}>{isTerminal ? '해결됨' : '영향중'}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">영향받는 수용가가 없습니다</p>
          )}
        </SectionCard>
      </div>

      <SectionCard title="조치 이력" description={`${anomaly.actions.length}건`}>
        {anomaly.actions.length > 0 ? (
          <div className="space-y-0">
            {anomaly.actions.map((action, idx) => (
              <div key={action.id ?? idx} className="relative flex gap-4 pb-6 last:pb-0">
                {idx < anomaly.actions.length - 1 && (
                  <div className="absolute left-[15px] top-8 bottom-0 w-px bg-accent/20" />
                )}
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    action.status === 'RESOLVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-primary/20 text-primary',
                  )}
                >
                  {action.status === 'RESOLVED' ? <CheckCircle size={14} /> : <Clock size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="default">{action.type}</Badge>
                    {action.assignee && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <User size={10} /> {action.assignee}
                      </span>
                    )}
                    <span className="text-xs text-slate-500 tabular-nums ml-auto">
                      {action.createdAt
                        ? new Date(action.createdAt).toLocaleString('ko-KR', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{action.content}</p>
                  {action.expectedResolution && (
                    <p className="text-xs text-primary mt-1">
                      예상 해결: {new Date(action.expectedResolution).toLocaleDateString('ko-KR')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-4">등록된 조치가 없습니다</p>
        )}
      </SectionCard>

      {!isTerminal && (
        <SectionCard title="조치 추가">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-accent mb-1 block">조치 유형</label>
                <Select
                  options={[
                    { value: '현장 점검', label: '현장 점검' },
                    { value: '원격 조치', label: '원격 조치' },
                    { value: '부품 교체', label: '부품 교체' },
                    { value: '확인', label: '확인' },
                    { value: '기타', label: '기타' },
                  ]}
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                />
              </div>
              <div ref={assigneeRef} className="relative">
                <label className="text-xs text-accent mb-1 block">담당자</label>
                <Input
                  value={actionAssignee || assigneeSearch}
                  onChange={(e) => {
                    setAssigneeSearch(e.target.value);
                    setActionAssignee('');
                    setShowAssigneeDropdown(true);
                  }}
                  onFocus={() => setShowAssigneeDropdown(true)}
                  placeholder="담당자 검색"
                />
                {showAssigneeDropdown && filteredUsers.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-[#0d1520] shadow-xl">
                    {filteredUsers.map((u: any) => (
                      <button
                        key={u.id}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/[0.06] transition-colors"
                        onClick={() => {
                          setActionAssignee(u.name);
                          setAssigneeSearch('');
                          setShowAssigneeDropdown(false);
                        }}
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-white text-xs">{u.name}</p>
                          {u.role && <p className="text-[10px] text-slate-500">{u.role}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs text-accent mb-1 block">조치 내용</label>
              <Textarea
                value={actionContent}
                onChange={(e) => setActionContent(e.target.value)}
                placeholder="조치 내용을 입력하세요"
                rows={3}
              />
            </div>
            <div className="w-48">
              <label className="text-xs text-accent mb-1 block">예상 해결일</label>
              <Input type="date" value={actionDate} onChange={(e) => setActionDate(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={createActionMutation.isPending || !actionContent.trim()}
                onClick={() => {
                  createActionMutation.mutate(
                    {
                      id: numId,
                      data: {
                        actionType,
                        content: actionContent,
                        assignee: actionAssignee || undefined,
                        expectedResolution: actionDate || undefined,
                      },
                    },
                    {
                      onSuccess: () => {
                        addToast('success', '조치가 등록되었습니다');
                        setActionContent('');
                        setActionAssignee('');
                        setAssigneeSearch('');
                        setActionDate('');
                        setActionType('현장 점검');
                        invalidateAll();
                      },
                      onError: handleError('조치 등록'),
                    },
                  );
                }}
              >
                {createActionMutation.isPending ? '등록 중...' : '조치 등록'}
              </Button>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
