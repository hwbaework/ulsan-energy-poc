'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Download } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { BackButton } from '@/components/layout/PageTitle';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { StatusPill } from '@/components/ui/Design';
import { useToastStore } from '@/stores/useToastStore';
import { CO, useTradingPocStore } from '@/stores/useTradingPocStore';
import type { TradeRequest } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { cn } from '@/lib/utils';
import { KIND_OPTIONS, fmtKw, kindLabel } from './meta';
import {
  EventTimeline,
  Info,
  PageHeader,
  TRADE_STEPS,
  TradeStepper,
  stepLabel,
  cell,
  cellMuted,
  cellNum,
  cellStrong,
  TEXT_MAX,
} from './Bits';
import { CONTRACT_PDF } from './DocumentsScreen';
import { TermsInfo } from './TermsInfo';
import { ContractSignature } from '@/components/features/ContractSignature';
import type { SignMark } from '@/types/trading-poc';

type SignData = { method: 'draw' | 'type'; image?: string; typedName?: string };

/** 서명한 칸 — 직접 서명은 그 그림, 이름 입력은 그 이름(손글씨체)과 일시 */
function SignMarkView({ mark, fallbackAt, company }: { mark?: SignMark; fallbackAt?: string; company: string }) {
  const at = mark?.at ?? fallbackAt;
  // 서명한 사람 — 이름 (회사). 사람 이름이 없으면 회사만
  const name = mark?.person ?? mark?.typedName ?? company;
  const who = name !== company ? `${name} (${company})` : company;
  return (
    <div className="mt-3">
      <div className="flex h-24 items-center justify-center rounded-lg bg-[#0d1520] ring-1 ring-white/[0.08]">
        {mark?.method === 'draw' && mark.image ? (
          <img src={mark.image} alt="서명" className="max-h-20 max-w-full" />
        ) : mark?.typedName ? (
          <span className="text-3xl text-white" style={{ fontFamily: "'Nanum Pen Script', 'Gaegu', cursive" }}>
            {mark.typedName}
          </span>
        ) : (
          <span className="text-sm text-slate-400">서명 기록 없음</span>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400 tabular-nums">
        {who}
        {mark ? ` · ${mark.method === 'draw' ? '직접 서명' : '이름 입력'}` : ''}
        {at ? ` · ${fmtDateTime(at)}` : ''}
      </p>
    </div>
  );
}
import { fmtNum } from './meta';
import { fmtDateTime } from './meta';


const arrow = {
  key: 'go',
  header: '',
  width: '40px',
  render: () => <ChevronRight size={15} className="text-slate-600" />,
};

/**
 * 거래 승인 — 거래 이력에서 승인된 거래만: 전자서명 → 체결. 행을 누르면 거래 한 건 화면(계약서 · 서명).
 *  - 관리자(SPC): 계약 상대가 SPC 면 SPC 전자서명만. 기업 서명은 그 기업 계정이 직접
 *  - 발전사업자: 계약 상대가 자기 회사면 전자서명
 * 검토·조건 협의·승인은 거래 이력, 변경·해지 승인은 변경·해지 메뉴에서.
 */
export function TradeApprovalsScreen() {
  const role = useTradingRole();
  const [kind, setKind] = useState('');
  const router = useRouter();
  const contractOf = (id?: number) => role.contracts.find((c) => c.id === id);

  // 승인 — 양측 서명이 끝난 거래만. 서명 대기 · 전자서명은 거래 이력에서
  const approved = useMemo(() => role.requests.filter((r) => r.status === 'SIGNED'), [role.requests]);
  const rows = useMemo(
    () => approved.filter((r) => !kind || r.kind === kind).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [approved, kind],
  );
  const stats = {
    all: approved.length,
    self: approved.filter((r) => r.kind === 'SELF_CONSUMPTION').length,
    onsite: approved.filter((r) => r.kind === 'ONSITE').length,
  };

  const columns: Column<TradeRequest>[] = [
    { key: 'no', header: '신청번호', width: '160px', render: (r) => cellStrong(r.no) },
    { key: 'contract', header: '계약번호', width: '160px', render: (r) => cellNum(contractOf(r.contractId)?.no ?? '') },
    { key: 'consumer', header: '기업명', render: (r) => cell(r.consumerCompanyName, 'text-white') },
    { key: 'kind', header: '계약 유형', width: '100px', render: (r) => cell(kindLabel(r.kind)) },
    { key: 'capacity', header: '용량', width: '100px', render: (r) => cellNum(fmtKw(r.capacityKw)) },
    { key: 'term', header: '계약 기간', width: '100px', render: (r) => cellNum(`${r.termYears}년`) },
    {
      key: 'start',
      header: '시작일',
      width: '130px',
      render: (r) => cellMuted(contractOf(r.contractId)?.startDate ?? ''),
    },
    {
      key: 'status',
      header: '상태',
      width: '150px',
      render: () => <StatusPill tone="normal" label={stepLabel('승인', TRADE_STEPS.length - 1)} />,
    },
    arrow,
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="거래 승인" />

      {/* 승인 건수 — 유형별로 따로 */}
      <StatsGrid columns={3}>
        <StatCard label="승인" value={`${stats.all}건`} />
        <StatCard label="자가소비" value={`${stats.self}건`} />
        <StatCard label="PPA" value={`${stats.onsite}건`} />
      </StatsGrid>

      <SectionCard
        title="승인된 거래"
        actions={
          <label className="flex items-center gap-2 text-sm text-slate-400">
            계약 유형
            <Select
              options={[{ value: '', label: '전체' }, ...KIND_OPTIONS]}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="w-32"
            />
          </label>
        }
        noPadding
      >
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(r) => r.id}
          emptyMessage="승인된 거래 없음"
          onRowClick={(r) => router.push(`${approvalsBase(role.isAdmin)}/view?id=${r.id}`)}
        />
      </SectionCard>
    </div>
  );
}

const approvalsBase = (admin: boolean) => (admin ? '/platform/trading/approvals' : '/generator/trading/approvals');
const historyBase = (admin: boolean) => (admin ? '/platform/trading/history' : '/generator/trading/history');

/** 거래 승인 › 한 건 — ?id=신청 번호. 단계 · 계약 · 서명 · 계약서 · 진행 이력 (팝업 아님). section="history" 면 거래 이력 › 신청 한 건(전자서명 단계) */
export function TradeApprovalDetailScreen({ section = 'approvals' }: { section?: 'approvals' | 'history' } = {}) {
  const role = useTradingRole();
  const addToast = useToastStore((x) => x.add);
  const sign = useTradingPocStore((x) => x.signAsGenerator);
  const confirmConsumer = useTradingPocStore((x) => x.confirmConsumerSign);
  const router = useRouter();
  const rejectRequest = useTradingPocStore((x) => x.rejectRequest);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false); // 계약 내용 — 접어 둔다
  const [cancelReason, setCancelReason] = useState('');
  const [id, setId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<'sign' | null>(null);
  useEffect(() => {
    setId(Number(new URLSearchParams(window.location.search).get('id')));
  }, []);
  const r = id == null ? undefined : role.requests.find((x) => x.id === id);
  const c = r?.contractId ? role.contracts.find((x) => x.id === r.contractId) : undefined;
  const inHistory = section === 'history';
  const list = inHistory ? historyBase(role.isAdmin) : approvalsBase(role.isAdmin);
  const signedCount = c ? Number(c.signedByGenerator) + Number(c.signedByConsumer) : 0;
  const spcSide = c?.generatorCompanyId === CO.SPC.id;

  // 지금 할 수 있는 서명 — 관리자: SPC 서명 / 그 외: 계약 상대가 자기 회사면 서명
  const canSign =
    !!c &&
    r?.status === 'APPROVED' &&
    !c.signedByGenerator &&
    (role.isAdmin ? spcSide : c.generatorCompanyId === role.companyId);
  // 기업 쪽 서명 — 그 기업 계정이 직접만. 관리자는 기업 대신 서명 · 확인하지 않는다
  const canSignConsumer = !!c && r?.status === 'APPROVED' && !role.isAdmin && c.consumerCompanyId === role.companyId && !c.signedByConsumer;
  // 조건 확정 뒤 신청한 쪽은 동의(서명)하거나 사유를 적고 반려할 수 있다
  const isMine = !!r && !role.isAdmin && [r.applicantCompanyId, r.generatorCompanyId, r.consumerCompanyId].includes(role.companyId);
  const canCancel = !!r && r.status === 'APPROVED' && isMine;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: 'RE100', path: '/re100' }, { label: inHistory ? '거래 이력' : '거래 승인', path: list }, { label: r?.no ?? '거래' }]}
      />
      {id != null && !r ? (
        <div className="rounded-2xl bg-[#0d1520] p-10 text-center text-sm text-slate-400 ring-1 ring-white/[0.06]">
          거래를 찾을 수 없습니다
        </div>
      ) : r ? (
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* 제목 · 단계 */}
            <div className="rounded-xl bg-[#0d1520] p-5 ring-1 ring-white/[0.06]">
              <div className="flex items-start gap-3">
                <BackButton href={list} label={inHistory ? '거래 이력으로' : '거래 승인으로'} />
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-white">
                    {r.consumerCompanyName} · {kindLabel(r.kind)}
                  </h1>
                  <p className="mt-1 text-sm text-slate-400 tabular-nums">
                    {[r.no, c?.no, fmtKw(r.capacityKw), `${r.termYears}년`].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <TradeStepper r={r} signedCount={signedCount} className="mt-5" />
            </div>

            {/* 전자서명 — 맨 위. 왼쪽 플랫폼 · 오른쪽 기업. 누구든 먼저 서명할 수 있고, 둘 다 하면 승인 */}
            {c && (
              <SectionCard
                title="전자서명"
                actions={
                  canCancel ? (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setCancelReason('');
                        setCancelOpen(true);
                      }}
                    >
                      반려
                    </Button>
                  ) : undefined
                }
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {(
                    [
                      {
                        who: spcSide ? '관리자' : c.generatorCompanyName,
                        done: c.signedByGenerator,
                        mark: c.signMarkGenerator,
                        can: canSign,
                        pad: true,
                        company: spcSide ? CO.SPC.name : c.generatorCompanyName,
                        signer: role.user?.name || (role.isAdmin ? CO.SPC.name : role.companyName),
                        onSign: (d?: SignData) => {
                          const person = d?.typedName?.trim() || role.user?.name || undefined;
                          sign(c.id, d && { method: d.method, image: d.image, typedName: d.typedName, person });
                          addToast('success', `${c.no} 전자서명`);
                        },
                        label: '관리자 전자서명',
                      },
                      {
                        who: `기업 (${c.consumerCompanyName})`,
                        done: c.signedByConsumer,
                        mark: c.signMarkConsumer,
                        can: canSignConsumer,
                        pad: true,
                        company: c.consumerCompanyName,
                        signer: role.user?.name || role.companyName,
                        onSign: (d?: SignData) => {
                          const person = d?.typedName?.trim() || role.user?.name || undefined;
                          confirmConsumer(c.id, d && { method: d.method, image: d.image, typedName: d.typedName, person });
                          addToast('success', `${c.no} 전자서명`);
                        },
                        label: '기업 전자서명',
                      },
                    ] as const
                  ).map((side) => (
                    <div
                      key={side.who}
                      className={cn(
                        'rounded-xl p-5 ring-1',
                        side.done ? 'bg-emerald-500/[0.06] ring-emerald-500/30' : 'bg-white/[0.03] ring-white/[0.08]',
                      )}
                    >
                      <p className="text-sm text-slate-300">{side.who}</p>
                      {/* 서명했으면 실제 서명(그림 · 입력한 이름)을 그대로 */}
                      {side.done ? (
                        <SignMarkView mark={side.mark} fallbackAt={c.signedAt} company={side.company} />
                      ) : (
                        <p className="mt-2 text-2xl font-bold text-slate-500">서명 전</p>
                      )}
                      {/* 서명판 — 자기 칸에서 그려서(또는 이름 입력) 서명. SPC 는 관리자, 기업은 그 기업 계정만 */}
                      {side.can &&
                        (side.pad ? (
                          <div className="mt-4">
                            <ContractSignature
                              signerName={side.signer}
                              onSign={side.onSign}
                            />
                          </div>
                        ) : (
                          <Button size="sm" className="mt-4" onClick={() => side.onSign()}>
                            {side.label}
                          </Button>
                        ))}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* 계약 내용 — 접어 두고 펼쳐 본다(거래 이력과 같은 칸) */}
            {c && (
              <SectionCard
                title="계약 내용"
                actions={
                  <Button size="sm" variant="secondary" onClick={() => setTermsOpen((v) => !v)}>
                    {termsOpen ? '접기' : '펼치기'}
                  </Button>
                }
              >
                {termsOpen ? (
                  <div className="grid grid-cols-3 gap-4">
                    <Info label="계약번호" value={c.no} />
                    <Info label="시작일" value={c.startDate} />
                    <Info label="종료일" value={c.endDate} />
                    <TermsInfo x={c} />
                  </div>
                ) : (
                  <p className="text-sm text-slate-300 tabular-nums">
                    {[c.no, kindLabel(c.kind), fmtKw(c.capacityKw), `${c.termYears}년`, c.kind === 'ONSITE' ? `PPA ₩${fmtNum(c.unitPrice, 1)}/kWh` : `설치 ₩${fmtNum(c.installUnit ?? 0)}/kW · O&M ₩${fmtNum(c.omAnnual ?? 0)}/년`].join(' · ')}
                  </p>
                )}
              </SectionCard>
            )}

            {/* 계약서 — 체결 전은 초안, 체결 뒤는 서명본 */}
            {c && (
              <SectionCard
                title={r.status === 'SIGNED' ? '계약서 (서명본)' : '계약서 (초안)'}
                actions={
                  <a href={CONTRACT_PDF} download={`${c.no}_계약서.pdf`}>
                    <Button size="sm" variant="secondary">
                      <Download size={14} className="mr-1.5" /> 다운로드
                    </Button>
                  </a>
                }
              >
                <iframe
                  title={`${c.no} 계약서`}
                  src={`${CONTRACT_PDF}#view=FitH`}
                  className="aspect-[210/297] w-full rounded-lg bg-white"
                />
              </SectionCard>
            )}
          </div>

          <SectionCard title="진행 이력" className="lg:sticky lg:top-6">
            <EventTimeline events={r.events} />
          </SectionCard>
        </div>
      ) : null}

      {/* 반려 — 조건 확정 뒤 신청한 쪽이 사유를 적고. 서명 대기 계약 초안은 지운다 */}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="반려" size="sm">
        <div className="space-y-4">
          <Textarea label="반려 사유" maxLength={TEXT_MAX} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} className="resize-none" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              닫기
            </Button>
            <Button
              variant="danger"
              disabled={!cancelReason.trim() || !r}
              onClick={() => {
                if (!r) return;
                rejectRequest(r.id, cancelReason.trim(), role.party);
                addToast('success', `${r.no} 반려`);
                setCancelOpen(false);
                router.push(list);
              }}
            >
              반려
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (c && confirm === 'sign') {
            sign(c.id);
            addToast('success', `${c.no} 전자서명`);
          }
          setConfirm(null);
        }}
        title="전자서명"
        message={`${c?.no} 계약서에 ${role.isAdmin ? CO.SPC.name : role.companyName} 명의로 서명합니다.`}
        confirmLabel="서명"
      />
    </div>
  );
}
