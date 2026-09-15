// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  AlertCircle,
  _CheckCircle2,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCcw,
  Search,
  _Eye,
  Plus,
  FileText,
  Upload,
  MessageSquare,
  Building2,
  Factory,
  _Sun,
  _Wind,
  _Battery,
  _Droplet,
  _Calendar,
  _ChevronDown,
  _Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useContractDeviations } from '@/hooks/ppa/usePpa';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */
type Tab = 'cases' | 'disputes' | 'recalc';
type CaseType = 'shortage' | 'excess';
type DisputeState = 'open' | 'reviewing' | 'resolved' | 'rejected';

const DISPUTE_META: Record<DisputeState, { label: string; tone: string; bg: string; ring: string }> = {
  open: { label: '접수', tone: 'text-amber-300', bg: 'bg-amber-500/[0.10]', ring: 'ring-amber-500/30' },
  reviewing: { label: '검토중', tone: 'text-blue-300', bg: 'bg-blue-500/[0.10]', ring: 'ring-blue-500/30' },
  resolved: { label: '조정 완료', tone: 'text-emerald-300', bg: 'bg-emerald-500/[0.10]', ring: 'ring-emerald-500/30' },
  rejected: { label: '기각', tone: 'text-rose-300', bg: 'bg-rose-500/[0.10]', ring: 'ring-rose-500/30' },
};

/* ─────────────────────────────────────────────
   부족/초과 케이스
   ───────────────────────────────────────────── */
type Case = {
  id: string;
  cycle: string;
  type: CaseType;
  plant: string;
  consumer: string;
  contractedKwh: number;
  actualKwh: number;
  deltaKwh: number;
  penaltyAmount: number;
  bearer: 'generator' | 'consumer' | 'spc' | 'shared';
  disputeId?: string;
};

const CASES: Case[] = [];

/* 분쟁 케이스 */
type Dispute = {
  id: string;
  caseId: string;
  cycle: string;
  consumer: string;
  plant: string;
  reason: string;
  filedAt: string;
  filedBy: string;
  state: DisputeState;
  attachments: number;
  comments: number;
};

const DISPUTES: Dispute[] = [];

/* 재정산 이력 */
type Recalc = {
  id: string;
  originalCycle: string;
  consumer: string;
  reason: string;
  originalAmount: number;
  recalcAmount: number;
  delta: number;
  recalcAt: string;
  taxAmendment: string;
};

const RECALCS: Recalc[] = [];

const BEARER_META = {
  generator: { label: '발전사업자', tone: 'text-amber-300' },
  consumer: { label: '수용가', tone: 'text-blue-300' },
  spc: { label: 'SPC', tone: 'text-violet-300' },
  shared: { label: '공동 분담', tone: 'text-slate-300' },
};

function fmtKrw(n: number) {
  if (Math.abs(n) >= 100_000_000) return `₩ ${(n / 100_000_000).toFixed(2)}억`;
  if (Math.abs(n) >= 10_000) return `₩ ${(n / 10_000).toFixed(0)}만`;
  return `₩ ${n.toLocaleString()}`;
}

function fmtEnergy(kwh: number) {
  if (Math.abs(kwh) >= 1_000) return `${(kwh / 1_000).toFixed(1)} MWh`;
  return `${kwh.toLocaleString()} kWh`;
}

/* ─────────────────────────────────────────────
   Page
   ───────────────────────────────────────────── */
export default function PlatformPpaUsageDeviationPage() {
  const { data: _apiDeviations } = useContractDeviations(0);
  const _router = useRouter();
  const [tab, setTab] = useState<Tab>('cases');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | CaseType>('all');
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeDetail, setDisputeDetail] = useState<Dispute | null>(null);

  const visibleCases = useMemo(() => {
    return CASES.filter((c) => {
      if (filterType !== 'all' && c.type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        return c.plant.toLowerCase().includes(q) || c.consumer.toLowerCase().includes(q);
      }
      return true;
    });
  }, [search, filterType]);

  const stats = useMemo(() => {
    const shortage = CASES.filter((c) => c.type === 'shortage').length;
    const excess = CASES.filter((c) => c.type === 'excess').length;
    const totalPenalty = CASES.reduce((s, c) => s + c.penaltyAmount, 0);
    const openDisputes = DISPUTES.filter((d) => d.state === 'open' || d.state === 'reviewing').length;
    return { shortage, excess, totalPenalty, openDisputes };
  }, []);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: '전력거래', path: '/platform/trading' }, { label: '직접 PPA' }, { label: '발전량 초과/미달' }]}
      />

      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">발전량 초과/미달</h1>
          <p className="mt-1 text-sm text-slate-400">부족·초과 발생 케이스 · 분쟁 등록·증빙 첨부 · 재정산 이력</p>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="부족 발생" value={`${stats.shortage}건`} sub="페널티 대상" icon={ArrowDownRight} tone="rose" />
        <KpiCard label="초과 발생" value={`${stats.excess}건`} sub="잉여 SMP 판매" icon={ArrowUpRight} tone="amber" />
        <KpiCard label="누적 페널티" value={fmtKrw(stats.totalPenalty)} sub="이번달" icon={AlertTriangle} tone="rose" />
        <KpiCard
          label="진행 중 분쟁"
          value={`${stats.openDisputes}건`}
          sub="검토·접수 합계"
          icon={MessageSquare}
          tone="violet"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.06]">
        {[
          { v: 'cases' as Tab, l: '발생 케이스', icon: AlertTriangle, cnt: CASES.length },
          { v: 'disputes' as Tab, l: '분쟁 처리', icon: MessageSquare, cnt: DISPUTES.length },
          { v: 'recalc' as Tab, l: '재정산 이력', icon: RefreshCcw, cnt: RECALCS.length },
        ].map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 -mb-px text-sm border-b-2 transition-colors whitespace-nowrap',
              tab === t.v
                ? 'border-primary text-white font-semibold'
                : 'border-transparent text-slate-500 hover:text-white',
            )}
          >
            <t.icon size={14} />
            {t.l}
            <span className={cn('text-[10px] tabular-nums', tab === t.v ? 'text-primary' : 'text-slate-600')}>
              ({t.cnt})
            </span>
          </button>
        ))}
      </div>

      {/* ─────────────── 발생 케이스 ─────────────── */}
      {tab === 'cases' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/[0.06] text-xs">
              {[
                { v: 'all' as const, l: '전체' },
                { v: 'shortage' as const, l: '부족' },
                { v: 'excess' as const, l: '초과' },
              ].map((f) => (
                <button
                  key={f.v}
                  onClick={() => setFilterType(f.v)}
                  className={cn(
                    'rounded px-3.5',
                    filterType === f.v ? 'bg-primary text-white' : 'text-slate-400 hover:text-white',
                  )}
                >
                  {f.l}
                </button>
              ))}
            </div>
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                type="text"
                placeholder="발전소·수용가"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {visibleCases.length === 0 ? (
            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] flex flex-col items-center justify-center py-20 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] mb-4">
                <AlertTriangle size={22} className="text-slate-500" />
              </span>
              <p className="text-sm font-medium text-slate-300">발전량 초과/미달 케이스가 없습니다</p>
              <p className="mt-1.5 text-xs text-slate-500 max-w-sm">
                직접 PPA 계약 체결 후 발전량 편차 발생 시 표시됩니다
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left">
                    <tr className="text-[11px] text-slate-500 bg-white/[0.02] border-b border-white/[0.06]">
                      <th className="text-left font-medium px-4 py-3">사이클</th>
                      <th className="font-medium px-3 py-3">유형</th>
                      <th className="text-left font-medium px-3 py-3">발전소 → 수용가</th>
                      <th className="font-medium px-3 py-3">계약량</th>
                      <th className="font-medium px-3 py-3">실적</th>
                      <th className="font-medium px-3 py-3">차이</th>
                      <th className="font-medium px-3 py-3">페널티</th>
                      <th className="font-medium px-3 py-3">부담</th>
                      <th className="font-medium px-3 py-3">분쟁</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {visibleCases.map((c) => {
                      const bearer = BEARER_META[c.bearer];
                      return (
                        <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 text-white tabular-nums">{c.cycle}</td>
                          <td className="px-3 py-3">
                            {c.type === 'shortage' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/[0.10] ring-1 ring-rose-500/30 px-2 py-0.5 text-[10px] text-rose-300">
                                <ArrowDownRight size={10} />
                                부족
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/[0.10] ring-1 ring-amber-500/30 px-2 py-0.5 text-[10px] text-amber-300">
                                <ArrowUpRight size={10} />
                                초과
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5 text-xs">
                              <Factory size={11} className="text-amber-400" />
                              <span className="text-white">{c.plant}</span>
                              <span className="text-slate-700">→</span>
                              <Building2 size={11} className="text-blue-400" />
                              <span className="text-white">{c.consumer}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 tabular-nums text-slate-400">{fmtEnergy(c.contractedKwh)}</td>
                          <td className="px-3 py-3 tabular-nums text-white">{fmtEnergy(c.actualKwh)}</td>
                          <td className="px-3 py-3 tabular-nums">
                            <span className={c.deltaKwh < 0 ? 'text-rose-300' : 'text-amber-300'}>
                              {c.deltaKwh > 0 ? '+' : ''}
                              {fmtEnergy(c.deltaKwh)}
                            </span>
                          </td>
                          <td className="px-3 py-3 tabular-nums">
                            {c.penaltyAmount > 0 ? (
                              <span className="text-rose-300 font-semibold">{fmtKrw(c.penaltyAmount)}</span>
                            ) : (
                              <span className="text-slate-700">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className={cn('text-[11px]', bearer.tone)}>{bearer.label}</span>
                          </td>
                          <td className="px-3 py-3">
                            {c.disputeId ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/[0.10] ring-1 ring-rose-500/30 px-2 py-0.5 text-[10px] text-rose-300">
                                <MessageSquare size={9} />
                                이의신청
                              </span>
                            ) : (
                              <span className="text-slate-700 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {!c.disputeId && (
                                <Button size="sm" variant="ghost" onClick={() => setDisputeOpen(true)}>
                                  <Plus size={11} className="mr-1" />
                                  분쟁 등록
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─────────────── 분쟁 처리 ─────────────── */}
      {tab === 'disputes' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">증빙 첨부 · 조정 이력 추적 · 결과는 재정산으로 연결</p>
            <Button size="sm" variant="primary" onClick={() => setDisputeOpen(true)}>
              <Plus size={12} className="mr-1.5" />
              분쟁 등록
            </Button>
          </div>

          {DISPUTES.length === 0 ? (
            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] flex flex-col items-center justify-center py-20 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] mb-4">
                <MessageSquare size={22} className="text-slate-500" />
              </span>
              <p className="text-sm font-medium text-slate-300">등록된 분쟁이 없습니다</p>
              <p className="mt-1.5 text-xs text-slate-500 max-w-sm">
                발전량 초과/미달 발생 시 분쟁을 등록할 수 있습니다
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {DISPUTES.map((d) => {
                const state = DISPUTE_META[d.state];
                return (
                  <div
                    key={d.id}
                    className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-4 hover:border-white/[0.15] cursor-pointer transition-colors"
                    onClick={() => setDisputeDetail(d)}
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', state.bg)}>
                        <MessageSquare size={14} className={state.tone} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-white">{d.consumer}</p>
                          <span className="text-[11px] text-slate-500">·</span>
                          <span className="text-xs text-slate-400">{d.plant}</span>
                          <span className="text-[11px] text-slate-500">·</span>
                          <span className="text-[11px] text-slate-400 tabular-nums">{d.cycle}</span>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ring-1 ml-auto',
                              state.bg,
                              state.tone,
                              state.ring,
                            )}
                          >
                            {state.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{d.reason}</p>
                        <div className="mt-2 flex items-center gap-3 text-[11px]">
                          <span className="text-slate-500 tabular-nums">접수 {d.filedAt}</span>
                          <span className="text-slate-700">·</span>
                          <span className="text-slate-500">제기 {d.filedBy}</span>
                          <span className="text-slate-700">·</span>
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <FileText size={10} />
                            증빙 {d.attachments}건
                          </span>
                          <span className="text-slate-700">·</span>
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <MessageSquare size={10} />
                            조정 {d.comments}건
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────── 재정산 이력 ─────────────── */}
      {tab === 'recalc' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-violet-500/[0.20] bg-violet-500/[0.04] p-3 text-xs">
            <div className="flex items-start gap-2">
              <RefreshCcw size={13} className="text-violet-300 mt-0.5" />
              <div>
                <p className="text-violet-200 font-medium">재정산 결과 → 수정세금계산서 자동 발행</p>
                <p className="text-violet-300/70 mt-0.5">
                  잠정→확정 차이 / 분쟁 조정 / 단가 정정 시 동일 사이클에 대해 재정산이 실행됩니다.
                </p>
              </div>
            </div>
          </div>

          {RECALCS.length === 0 ? (
            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] flex flex-col items-center justify-center py-20 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] mb-4">
                <RefreshCcw size={22} className="text-slate-500" />
              </span>
              <p className="text-sm font-medium text-slate-300">재정산 이력이 없습니다</p>
              <p className="mt-1.5 text-xs text-slate-500 max-w-sm">
                분쟁 조정 또는 단가 정정 시 재정산 이력이 표시됩니다
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left">
                    <tr className="text-[11px] text-slate-500 bg-white/[0.02] border-b border-white/[0.06]">
                      <th className="text-left font-medium px-4 py-3">원 사이클</th>
                      <th className="text-left font-medium px-3 py-3">대상</th>
                      <th className="text-left font-medium px-3 py-3">사유</th>
                      <th className="font-medium px-3 py-3">원 금액</th>
                      <th className="font-medium px-3 py-3">재정산</th>
                      <th className="font-medium px-3 py-3">차이</th>
                      <th className="text-left font-medium px-3 py-3">수정 세금계산서</th>
                      <th className="font-medium px-3 py-3">처리일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {RECALCS.map((r) => (
                      <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-white tabular-nums">{r.originalCycle}</td>
                        <td className="px-3 py-3 text-slate-300">{r.consumer}</td>
                        <td className="px-3 py-3 text-xs text-slate-400">{r.reason}</td>
                        <td className="px-3 py-3 tabular-nums text-slate-400">{fmtKrw(r.originalAmount)}</td>
                        <td className="px-3 py-3 tabular-nums text-white font-semibold">{fmtKrw(r.recalcAmount)}</td>
                        <td className="px-3 py-3 tabular-nums">
                          <span className={r.delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                            {r.delta >= 0 ? '+' : ''}
                            {fmtKrw(r.delta)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-mono text-[11px] tabular-nums text-violet-300">{r.taxAmendment}</span>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-slate-500 tabular-nums">{r.recalcAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 분쟁 등록 모달 */}
      {disputeOpen && (
        <Modal
          open={disputeOpen}
          onClose={() => setDisputeOpen(false)}
          size="lg"
          title="분쟁 등록"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDisputeOpen(false)}>
                취소
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  useToastStore.getState().add('success', '분쟁이 등록되었습니다. 24시간 내 증빙을 첨부해주세요.');
                  setDisputeOpen(false);
                }}
              >
                <Upload size={12} className="mr-1.5" />
                증빙 첨부 후 등록
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              발전량 부족·초과 케이스에 대해 이의신청을 등록합니다. 증빙은 접수 후 24시간 내 첨부하세요.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="대상 사이클">
                <Input placeholder="2026-04" />
              </Field>
              <Field label="대상 케이스">
                <Input placeholder="cs1 / 솔라파크 2호기 → LG디스플레이" />
              </Field>
              <Field label="제기 주체">
                <select className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white">
                  <option>발전사업자</option>
                  <option>수용가</option>
                  <option>SPC</option>
                </select>
              </Field>
              <Field label="유형">
                <select className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white">
                  <option>천재지변·정비 사전통보</option>
                  <option>계량값 정확도 이의</option>
                  <option>단가·페널티 산식 이의</option>
                  <option>기타</option>
                </select>
              </Field>
            </div>
            <Field label="사유 (상세)">
              <textarea
                rows={4}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-slate-600"
                placeholder="이의신청 사유를 상세히 작성하세요..."
              />
            </Field>
            <div className="rounded-lg border border-amber-500/[0.20] bg-amber-500/[0.04] p-3 text-xs text-amber-200">
              <AlertCircle size={12} className="inline mr-1" />
              증빙 자료 (정비 통보서·계량 검증 자료 등)는 접수 후 24시간 내 첨부 필수
            </div>
          </div>
        </Modal>
      )}

      {/* 분쟁 상세 모달 */}
      {disputeDetail && (
        <Modal
          open={!!disputeDetail}
          onClose={() => setDisputeDetail(null)}
          size="xl"
          title={`분쟁 ${disputeDetail.id} · ${disputeDetail.consumer}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDisputeDetail(null)}>
                닫기
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  useToastStore
                    .getState()
                    .add(
                      'info',
                      `${disputeDetail.id} 조정 이력: ${disputeDetail.status === 'resolved' ? '해결 완료' : '진행 중'}`,
                    )
                }
              >
                <MessageSquare size={12} className="mr-1.5" />
                조정 이력
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (!window.confirm(`${disputeDetail.id} 건을 재정산 처리하시겠습니까?`)) return;
                  useToastStore.getState().add('success', `${disputeDetail.id} 재정산 처리가 요청되었습니다`);
                  setDisputeDetail(null);
                }}
              >
                <RefreshCcw size={12} className="mr-1.5" />
                재정산 처리
              </Button>
            </>
          }
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-white">{disputeDetail.consumer}</p>
                <span className="text-xs text-slate-500">·</span>
                <span className="text-xs text-slate-300">{disputeDetail.plant}</span>
                <span className="text-xs text-slate-500">·</span>
                <span className="text-xs text-slate-400 tabular-nums">{disputeDetail.cycle}</span>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ring-1 ml-auto',
                    DISPUTE_META[disputeDetail.state].bg,
                    DISPUTE_META[disputeDetail.state].tone,
                    DISPUTE_META[disputeDetail.state].ring,
                  )}
                >
                  {DISPUTE_META[disputeDetail.state].label}
                </span>
              </div>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{disputeDetail.reason}</p>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-2 border-t border-white/[0.06]">
                <span>접수 {disputeDetail.filedAt}</span>
                <span>·</span>
                <span>제기 {disputeDetail.filedBy}</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">첨부 증빙 ({disputeDetail.attachments}건)</p>
              <div className="space-y-1.5">
                {Array.from({ length: disputeDetail.attachments }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs"
                  >
                    <FileText size={12} className="text-slate-400" />
                    <span className="text-white">
                      증빙_{disputeDetail.id}_{i + 1}.pdf
                    </span>
                    <span className="ml-auto text-slate-500">{(Math.random() * 2 + 0.5).toFixed(1)} MB</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">조정 이력 ({disputeDetail.comments}건)</p>
              <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04] text-xs">
                <div className="px-3 py-2 flex items-baseline gap-2">
                  <span className="text-slate-500 tabular-nums w-24 shrink-0">2026-05-04 09:32</span>
                  <span className="text-violet-300 shrink-0">운영자 김</span>
                  <span className="text-slate-300">증빙 검토 시작 — 정비 사전통보 이력 확인 요청</span>
                </div>
                <div className="px-3 py-2 flex items-baseline gap-2">
                  <span className="text-slate-500 tabular-nums w-24 shrink-0">2026-05-03 14:18</span>
                  <span className="text-amber-300 shrink-0">발전사</span>
                  <span className="text-slate-300">정비 사전통보서 (4월 22일 발송) 첨부</span>
                </div>
                <div className="px-3 py-2 flex items-baseline gap-2">
                  <span className="text-slate-500 tabular-nums w-24 shrink-0">2026-05-03 11:00</span>
                  <span className="text-amber-300 shrink-0">발전사</span>
                  <span className="text-slate-300">분쟁 접수</span>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: any;
  tone: 'emerald' | 'amber' | 'rose' | 'blue' | 'violet' | 'slate';
}) {
  const map = {
    emerald: 'text-emerald-300 bg-emerald-500/[0.10]',
    amber: 'text-amber-300 bg-amber-500/[0.10]',
    rose: 'text-rose-300 bg-rose-500/[0.10]',
    blue: 'text-blue-300 bg-blue-500/[0.10]',
    violet: 'text-violet-300 bg-violet-500/[0.10]',
    slate: 'text-slate-300 bg-slate-500/[0.10]',
  };
  return (
    <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-4 flex items-center gap-3">
      <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', map[tone])}>
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold text-white tabular-nums truncate">{value}</p>
        {sub && <p className="text-[10px] text-slate-500 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
