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
import { fmtKw, kindLabel } from './meta';
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
} from './Bits';
import { CONTRACT_PDF } from './DocumentsScreen';
import { TermsInfo } from './TermsInfo';
import { ContractSignature } from '@/components/features/ContractSignature';
import { fmtNum } from './meta';
import { fmtDateTime } from './meta';

/** 거래 승인 상태 — 4단계(신청 접수 · 미팅 · 전자서명 · 체결) 중 계약서가 만들어진 뒤: 서명 대기 · 전자서명(한쪽 서명) · 체결 */
const SIGN_STATUS = ['서명 대기', '전자서명', '승인'] as const;
type SignStatus = (typeof SIGN_STATUS)[number];

const arrow = {
  key: 'go',
  header: '',
  width: '40px',
  render: () => <ChevronRight size={15} className="text-slate-600" />,
};

/**
 * 거래 승인 — 거래 이력에서 승인된 거래만: 전자서명 → 체결. 행을 누르면 거래 한 건 화면(계약서 · 서명).
 *  - 관리자(SPC): 계약 상대가 SPC 면 SPC 전자서명, 기업 서명 확인
 *  - 발전사업자: 계약 상대가 자기 회사면 전자서명
 * 검토·조건 협의·승인은 거래 이력, 변경·해지 승인은 변경·해지 메뉴에서.
 */
export function TradeApprovalsScreen() {
  const role = useTradingRole();
  const [filter, setFilter] = useState('');
  const router = useRouter();
  const contractOf = (id?: number) => role.contracts.find((c) => c.id === id);

  const approved = useMemo(
    () => role.requests.filter((r) => r.status === 'APPROVED' || r.status === 'SIGNED'),
    [role.requests],
  );
  const rows = useMemo(
    () =>
      approved
        .filter((r) => !filter || signStatusOf(r) === filter)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [approved, filter, role.contracts],
  );

  /** 서명 대기: 아직 서명 없음 / 전자서명: 한쪽 서명 / 체결: 양쪽 서명 */
  const signStatusOf = (r: TradeRequest): SignStatus => {
    if (r.status === 'SIGNED') return '승인';
    const c = contractOf(r.contractId);
    return c?.signedByGenerator || c?.signedByConsumer ? '전자서명' : '서명 대기';
  };
  const count = (st: SignStatus) => approved.filter((r) => signStatusOf(r) === st).length;

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
      render: (r) => (
        <StatusPill
          tone={r.status === 'SIGNED' ? 'normal' : 'warning'}
          label={stepLabel(signStatusOf(r), signStatusOf(r) === '승인' ? TRADE_STEPS.length - 1 : TRADE_STEPS.indexOf('전자서명'))}
        />
      ),
    },
    arrow,
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="거래 승인" />

      {/* 상태별 건수 */}
      <StatsGrid columns={3}>
        {SIGN_STATUS.map((st) => (
          <StatCard key={st} label={st} value={`${count(st)}건`} />
        ))}
      </StatsGrid>

      <SectionCard
        title="승인된 거래"
        actions={
          <label className="flex items-center gap-2 text-sm text-slate-400">
            상태
            <Select
              options={[{ value: '', label: '전체' }, ...SIGN_STATUS.map((v) => ({ value: v, label: v }))]}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
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

/** 거래 승인 › 한 건 — ?id=신청 번호. 단계 · 계약 · 서명 · 계약서 · 진행 이력 (팝업 아님) */
export function TradeApprovalDetailScreen() {
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
  const [confirm, setConfirm] = useState<'sign' | 'consumer' | null>(null);
  useEffect(() => {
    setId(Number(new URLSearchParams(window.location.search).get('id')));
  }, []);
  const r = id == null ? undefined : role.requests.find((x) => x.id === id);
  const c = r?.contractId ? role.contracts.find((x) => x.id === r.contractId) : undefined;
  const list = approvalsBase(role.isAdmin);
  const signedCount = c ? Number(c.signedByGenerator) + Number(c.signedByConsumer) : 0;
  const spcSide = c?.generatorCompanyId === CO.SPC.id;

  // 지금 할 수 있는 서명 — 관리자: SPC 서명 · 기업 서명 확인 / 그 외: 계약 상대가 자기 회사면 서명
  const canSign =
    !!c &&
    r?.status === 'APPROVED' &&
    !c.signedByGenerator &&
    (role.isAdmin ? spcSide : c.generatorCompanyId === role.companyId);
  // 기업 쪽 서명 — 그 기업 계정이 직접(관리자는 오프라인 서명을 확인해 줄 수도)
  const canSignConsumer = !!c && r?.status === 'APPROVED' && !role.isAdmin && c.consumerCompanyId === role.companyId && !c.signedByConsumer;
  const canConfirmConsumer = !!c && r?.status === 'APPROVED' && role.isAdmin && !c.signedByConsumer;
  // 조건 확정 뒤 신청한 쪽은 동의(서명)하거나 사유를 적고 반려할 수 있다
  const isMine = !!r && !role.isAdmin && [r.applicantCompanyId, r.generatorCompanyId, r.consumerCompanyId].includes(role.companyId);
  const canCancel = !!r && r.status === 'APPROVED' && isMine;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: 'RE100', path: '/re100' }, { label: '거래 승인', path: list }, { label: r?.no ?? '거래' }]}
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
                <BackButton href={list} label="거래 승인으로" />
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
                        who: spcSide ? '플랫폼 (SPC)' : c.generatorCompanyName,
                        done: c.signedByGenerator,
                        can: canSign,
                        pad: true,
                        signer: role.isAdmin ? CO.SPC.name : role.companyName,
                        onSign: () => {
                          sign(c.id);
                          addToast('success', `${c.no} 전자서명`);
                        },
                        label: 'SPC 전자서명',
                      },
                      {
                        who: `기업 (${c.consumerCompanyName})`,
                        done: c.signedByConsumer,
                        can: canSignConsumer || canConfirmConsumer,
                        pad: canSignConsumer,
                        signer: role.companyName,
                        onSign: () => {
                          if (canSignConsumer) {
                            confirmConsumer(c.id);
                            addToast('success', `${c.no} 전자서명`);
                          } else setConfirm('consumer');
                        },
                        label: '기업 서명 확인',
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
                      <p className={cn('mt-2 text-2xl font-bold', side.done ? 'text-emerald-300' : 'text-slate-500')}>
                        {side.done ? '서명 완료' : '서명 전'}
                      </p>
                      {side.done && c.signedAt && <p className="mt-1 text-xs text-slate-400 tabular-nums">{fmtDateTime(c.signedAt)}</p>}
                      {/* 서명판 — 자기 칸에서 그려서(또는 이름 입력) 서명. 관리자의 '기업 서명 확인'은 버튼 */}
                      {side.can &&
                        (side.pad ? (
                          <div className="mt-4">
                            <ContractSignature
                              contractTitle={`${c.no} 계약`}
                              contractSummary={[
                                `${c.consumerCompanyName} · ${kindLabel(c.kind)} · ${fmtKw(c.capacityKw)} · ${c.termYears}년`,
                                c.kind === 'ONSITE' ? `PPA 단가 ₩${fmtNum(c.unitPrice, 1)}/kWh` : `설치 단가 ₩${fmtNum(c.installUnit ?? 0)}/kW · 연간 O&M ${c.omRatePct ?? 0}%`,
                                `시작일 ${c.startDate} · 종료일 ${c.endDate}`,
                              ]}
                              signerName={side.signer}
                              onSign={side.onSign}
                            />
                          </div>
                        ) : (
                          <Button size="sm" className="mt-4" onClick={side.onSign}>
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
                    {[c.no, kindLabel(c.kind), fmtKw(c.capacityKw), `${c.termYears}년`, c.kind === 'ONSITE' ? `PPA ₩${fmtNum(c.unitPrice, 1)}/kWh` : `설치 ₩${fmtNum(c.installUnit ?? 0)}/kW · O&M ${c.omRatePct ?? 0}%`].join(' · ')}
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
          <Textarea label="반려 사유" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} className="resize-none" />
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
          } else if (c && confirm === 'consumer') {
            confirmConsumer(c.id);
            addToast('success', role.isAdmin ? `${c.no} 기업 서명 확인` : `${c.no} 전자서명`);
          }
          setConfirm(null);
        }}
        title={confirm === 'sign' || !role.isAdmin ? '전자서명' : '기업 서명 확인'}
        message={
          confirm === 'sign'
            ? `${c?.no} 계약서에 ${role.isAdmin ? CO.SPC.name : role.companyName} 명의로 서명합니다.`
            : role.isAdmin
              ? `${c?.consumerCompanyName} 전자서명을 확인 처리합니다.`
              : `${c?.no} 계약서에 ${role.companyName} 명의로 서명합니다.`
        }
        confirmLabel={confirm === 'sign' || !role.isAdmin ? '서명' : '확인'}
      />
    </div>
  );
}
