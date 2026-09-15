// @ts-nocheck
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronRight, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { useConsultationsByCompany, useDeleteConsultation } from '@/hooks/consulting/useConsultations';

const DOMAIN_LABEL: Record<string, string> = {
  RE100: 'RE100',
  CARBON_REDUCTION: '탄소감축',
  DISTRIBUTED_ENERGY: '분산에너지',
  PPA: 'PPA',
  ESG: 'ESG',
};

const STATUS_LABEL: Record<string, string> = {
  APPLIED: '신청됨',
  ASSIGNED: '배정됨',
  SURVEYING: '진행 중',
  VISITING: '진행 중',
  DRAFTING: '진행 중',
  IN_PROGRESS: '진행 중',
  REVIEW: '검수 중',
  REVIEWING: '검토 중',
  COMPLETED: '완료',
  CANCELLED: '취소',
};

const STATUS_VARIANT: Record<string, string> = {
  APPLIED: 'info',
  ASSIGNED: 'info',
  SURVEYING: 'warning',
  VISITING: 'warning',
  DRAFTING: 'warning',
  IN_PROGRESS: 'warning',
  REVIEW: 'warning',
  REVIEWING: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'default',
};

const DOMAIN_BADGE: Record<string, string> = {
  RE100: 'bg-blue-500/[0.10] text-blue-300 ring-blue-500/30',
  CARBON_REDUCTION: 'bg-emerald-500/[0.10] text-emerald-300 ring-emerald-500/30',
  DISTRIBUTED_ENERGY: 'bg-amber-500/[0.10] text-amber-300 ring-amber-500/30',
  PPA: 'bg-violet-500/[0.10] text-violet-300 ring-violet-500/30',
  ESG: 'bg-cyan-500/[0.10] text-cyan-300 ring-cyan-500/30',
};

export default function ConsultingStatusListPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? 0;
  const { data: rawData, isLoading } = useConsultationsByCompany(companyId);
  const deleteMutation = useDeleteConsultation();

  const items = useMemo(() => {
    if (!Array.isArray(rawData)) return [];
    // 취소(거절)건은 soft 삭제 — DB 레코드는 보존하되 목록에서 숨김 (재제안 시 중복 가비지 방지)
    return (rawData as any[])
      .filter((c) => c.status !== 'CANCELLED')
      .map((c) => {
        const domain = DOMAIN_LABEL[c.domain] || c.domain || '';
        return {
          id: c.id,
          title: `${domain} 컨설팅`,
          domain: c.domain,
          domainLabel: domain,
          consultant: c.consultantName || '미배정',
          consultantInitial: c.consultantName ? c.consultantName[0] : '?',
          client: c.clientCompanyName || '',
          status: c.status,
          statusLabel: STATUS_LABEL[c.status] || c.status,
          startedAt: c.assignedAt ? new Date(c.assignedAt).toLocaleDateString('ko-KR') : '',
          appliedAt: c.appliedAt ? new Date(c.appliedAt).toLocaleDateString('ko-KR') : '',
        };
      });
  }, [rawData]);

  const filtered = useMemo(() => {
    if (!keyword) return items;
    const q = keyword.toLowerCase();
    return items.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.consultant.toLowerCase().includes(q) ||
        c.domainLabel.toLowerCase().includes(q) ||
        c.client.toLowerCase().includes(q),
    );
  }, [items, keyword]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '통합에너지 컨설팅', path: '/consulting' }, { label: '내 컨설팅' }]} />

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">내 컨설팅</h1>
          <p className="mt-1 text-sm text-slate-400">총 {items.length}건 — 행을 눌러 진행 상황을 확인하세요</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => router.push('/consulting/diagnosis')}>
          새 컨설팅 시작 — 무료 진단
          <ArrowRight size={14} className="ml-1" />
        </Button>
      </div>

      <SectionCard
        title={`컨설팅 ${filtered.length}건`}
        actions={
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="컨설팅명 / 컨설턴트 / 분야 검색"
            className="rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-blue-500/50 w-56"
          />
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-400 border-b border-white/[0.06]">
              <tr>
                <th className="px-4 py-3 font-medium">컨설팅</th>
                <th className="px-4 py-3 font-medium">컨설턴트</th>
                <th className="px-4 py-3 font-medium">분야</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">신청일</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8">
                    <p className="text-sm text-slate-500 text-center">
                      {keyword ? `'${keyword}' 검색 결과가 없습니다` : '진행 중인 컨설팅이 없습니다'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/consulting/status/${c.id}`)}
                    className="hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{c.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{c.client}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold shrink-0">
                          {c.consultantInitial}
                        </span>
                        <p className="text-slate-200">{c.consultant}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1',
                          DOMAIN_BADGE[c.domain] ?? 'bg-white/[0.05] text-slate-300 ring-white/[0.1]',
                        )}
                      >
                        {c.domainLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant={STATUS_VARIANT[c.status] || 'default'}>{c.statusLabel}</Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400 tabular-nums">
                      {c.appliedAt || c.startedAt || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`'${c.title}'을(를) 삭제하시겠습니까?`)) {
                              deleteMutation.mutate(c.id);
                            }
                          }}
                          className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                        <ChevronRight size={16} className="text-slate-600" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
