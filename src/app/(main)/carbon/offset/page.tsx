'use client';

import { useState } from 'react';
import { FileText, AlertTriangle, CheckCircle2, ArrowRightLeft, Award } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Badge } from '@/components/edm/ui/Badge';
import { Button } from '@/components/edm/ui/Button';
import { Breadcrumb } from '@/components/edm/layout/Breadcrumb';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { useCarbonOffsets } from '@/hooks/edm/useCarbon';
import { useCreateMonitoring, useIssueKoc, useConvertKoc, useCarbonConversions } from '@/hooks/edm/useCarbonExt';
import { useSyncKocReductionActual } from '@/hooks/edm/useGhgExt';

// 상쇄배출권·KOC — 설계 docs/기획/02 §2.10 · 기획 10 §1·§4
// 외부사업 → 모니터링 보고서(제출) → KOC 발급(ISSUED) → KCU 전환(이중계상 게이트)
const STATUS: Record<string, { label: string; variant: 'default' | 'info' | 'warning' | 'success' }> = {
  PLAN: { label: '사업계획', variant: 'default' },
  APPROVED: { label: '사업승인', variant: 'info' },
  MONITORING: { label: '모니터링', variant: 'warning' },
  ISSUED: { label: 'KOC 발급', variant: 'success' },
};

export default function OffsetPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const toast = useToastStore((s) => s.add);
  const { data: OFFSET_PROJECTS, isError } = useCarbonOffsets(companyId);
  const { data: CONVERSIONS } = useCarbonConversions(companyId);
  // 설계 22: 회사 미귀속/호출 실패 시 액션 차단(빈 실데이터는 허용).
  const canManage = companyId != null && !isError;
  const createMonitoring = useCreateMonitoring();
  const issueKoc = useIssueKoc();
  const convert = useConvertKoc();
  // 기획 14 §2 — 모니터링 제출 후 ghg 감축실적 UPSERT 트리거(carbon BE 미수정, FE→ghg 엔드포인트).
  const syncReduction = useSyncKocReductionActual();

  const [convertFor, setConvertFor] = useState<string | null>(null);
  const [convertAmount, setConvertAmount] = useState('');

  const currentPeriod = `${new Date().getFullYear()}-H${new Date().getMonth() < 6 ? 1 : 2}`;

  const onMonitoring = (id: string, monitoredTco2: number) => {
    if (!canManage) return;
    createMonitoring.mutate(
      { id: Number(id), period: currentPeriod, monitoredTco2 },
      {
        onSuccess: (res) => {
          toast('success', '모니터링 보고서를 생성·제출했습니다.');
          // 제출 시점 트리거 — ghg 감축실적 원장에 UPSERT(멱등). carbon BE 미수정.
          const m = (res as { data?: { id?: number; period?: string; monitoredTco2?: number } })?.data;
          if (m?.id != null) {
            syncReduction
              .mutateAsync({
                companyId,
                period: m.period ?? currentPeriod,
                monitoringId: m.id,
                monitoredTco2: m.monitoredTco2 ?? monitoredTco2,
              })
              .then((r) => {
                if (r.reflected) toast('success', '인벤토리 감축실적에 반영됨');
              })
              .catch(() => {});
          }
        },
        onError: (e: unknown) => toast('error', `생성 실패: ${e instanceof Error ? e.message : '오류'}`),
      },
    );
  };

  const onIssue = (id: string) => {
    if (!canManage) return;
    issueKoc.mutate(Number(id), {
      onSuccess: () => toast('success', 'KOC를 발급했습니다.'),
      onError: (e: unknown) => toast('error', `발급 불가: ${e instanceof Error ? e.message : '오류'}`),
    });
  };

  const onConvert = (id: string, kocIssued: number) => {
    if (!companyId || !canManage) return;
    const amount = Number(convertAmount) || kocIssued;
    convert.mutate(
      { companyId, offsetProjectId: Number(id), amount },
      {
        onSuccess: (res) => {
          const c = (res as { data?: { status?: string; blockedReason?: string | null } })?.data;
          if (c?.status === 'CROSSCHECK_FAILED') toast('warning', `전환 차단: ${c.blockedReason ?? 'REC 중복'}`);
          else toast('success', 'KCU로 전환했습니다.');
          setConvertFor(null);
          setConvertAmount('');
        },
        onError: (e: unknown) => toast('error', `전환 불가: ${e instanceof Error ? e.message : '오류'}`),
      },
    );
  };

  // 사업별 차단 이력 (CROSSCHECK_FAILED)
  const blockedReasonOf = (projectId: string): string | undefined =>
    CONVERSIONS.find((c) => String(c.offsetProjectId) === projectId && c.status === 'CROSSCHECK_FAILED')
      ?.blockedReason ?? undefined;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '카본 마켓플레이스', path: '/carbon' }, { label: '상쇄배출권·KOC' }]} />
      <h1 className="text-xl font-bold text-white">상쇄배출권 · 외부사업(KOC)</h1>
      <p className="text-xs text-slate-400">
        환경부 승인 방법론 기준 외부사업 → 플랫폼 데이터 활용 <span className="text-sky-300">모니터링 보고서</span>
        (온실가스 인벤토리 연계) → 상쇄등록부 등록 → KOC 획득 → <span className="text-sky-300">KCU 전환</span>(이중계상
        대사)
      </p>

      <div className="space-y-3">
        {OFFSET_PROJECTS.map((p) => {
          const blocked = blockedReasonOf(p.id);
          return (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">{p.name}</h3>
                    <Badge variant={STATUS[p.status]!.variant}>{STATUS[p.status]!.label}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">방법론: {p.methodology}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">KOC 발급</div>
                  <div className="text-sm font-medium text-white">{p.kocIssued.toLocaleString()} tCO₂eq</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {p.recDuplicate || blocked ? (
                  <span className="flex items-center gap-1 text-xs text-amber-400">
                    <AlertTriangle size={12} /> {blocked ?? 'REC 중복성 검토 필요 (이중계상 방지)'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <CheckCircle2 size={12} /> 중복성 통과
                  </span>
                )}
                {p.status === 'MONITORING' && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={createMonitoring.isPending}
                      disabled={!canManage}
                      onClick={() => onMonitoring(p.id, p.kocIssued)}
                    >
                      <FileText size={13} /> 모니터링 보고서 생성
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={issueKoc.isPending}
                      disabled={!canManage}
                      onClick={() => onIssue(p.id)}
                    >
                      <Award size={13} /> KOC 발급
                    </Button>
                  </>
                )}
                {p.status === 'ISSUED' &&
                  (convertFor === p.id ? (
                    <span className="flex items-center gap-2">
                      <input
                        type="number"
                        value={convertAmount}
                        onChange={(e) => setConvertAmount(e.target.value)}
                        placeholder={String(p.kocIssued)}
                        className="w-28 rounded-lg bg-white/[0.04] px-2 py-1 text-sm text-white ring-1 ring-white/[0.08]"
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        loading={convert.isPending}
                        disabled={!canManage}
                        onClick={() => onConvert(p.id, p.kocIssued)}
                      >
                        확인
                      </Button>
                      <Button
                        variant="cancel"
                        size="sm"
                        onClick={() => {
                          setConvertFor(null);
                          setConvertAmount('');
                        }}
                      >
                        취소
                      </Button>
                    </span>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!canManage}
                      onClick={() => {
                        setConvertFor(p.id);
                        setConvertAmount(String(p.kocIssued));
                      }}
                    >
                      <ArrowRightLeft size={13} /> KCU로 전환
                    </Button>
                  ))}
              </div>
            </Card>
          );
        })}
      </div>
      <Card className="p-4 border-sky-500/20 bg-sky-500/[0.04]">
        <p className="text-xs text-sky-300">
          신규 방법론 사업계획서 작성이 필요하면 지원 도구를 통해 등록할 수 있습니다.
        </p>
      </Card>
    </div>
  );
}
