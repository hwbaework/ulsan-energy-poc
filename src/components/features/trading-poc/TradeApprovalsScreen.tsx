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
import { Select } from '@/components/ui/Select';
import { StatusPill } from '@/components/ui/Design';
import { useToastStore } from '@/stores/useToastStore';
import { CO, useTradingPocStore } from '@/stores/useTradingPocStore';
import type { TradeRequest } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { fmtDate, fmtKw, kindLabel } from './meta';
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

/** 거래 승인 상태 — 진행 5단계(신청 접수 · 관리자 검토 · 승인 · 전자서명 · 체결)의 뒤 3단계 */
const SIGN_STATUS = ['승인', '전자서명', '체결'] as const;
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

  /** 승인: 아직 서명 없음 / 전자서명: 한쪽 서명 / 체결: 양쪽 서명 */
  const signStatusOf = (r: TradeRequest): SignStatus => {
    if (r.status === 'SIGNED') return '체결';
    const c = contractOf(r.contractId);
    return c?.signedByGenerator || c?.signedByConsumer ? '전자서명' : '승인';
  };
  const count = (st: SignStatus) => approved.filter((r) => signStatusOf(r) === st).length;

  const columns: Column<TradeRequest>[] = [
    { key: 'no', header: '신청번호', width: '140px', render: (r) => cellStrong(r.no) },
    { key: 'contract', header: '계약번호', width: '130px', render: (r) => cellNum(contractOf(r.contractId)?.no ?? '') },
    { key: 'consumer', header: '기업명', render: (r) => cell(r.consumerCompanyName, 'text-white') },
    { key: 'kind', header: '계약 유형', width: '100px', render: (r) => cell(kindLabel(r.kind)) },
    { key: 'capacity', header: '용량', width: '100px', render: (r) => cellNum(fmtKw(r.capacityKw)) },
    { key: 'term', header: '계약 기간', width: '100px', render: (r) => cellNum(`${r.termYears}년`) },
    {
      key: 'start',
      header: '시작일',
      width: '110px',
      render: (r) => cellMuted(contractOf(r.contractId)?.startDate ?? ''),
    },
    {
      key: 'status',
      header: '상태',
      width: '150px',
      render: (r) => (
        <StatusPill
          tone={r.status === 'SIGNED' ? 'normal' : 'warning'}
          label={stepLabel(signStatusOf(r), TRADE_STEPS.indexOf(signStatusOf(r)))}
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
  const canConfirmConsumer = !!c && r?.status === 'APPROVED' && role.isAdmin && !c.signedByConsumer;

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

            {/* 계약 — 기간 · 시작일 · 서명 */}
            {c && (
              <SectionCard
                title="계약"
                actions={
                  <>
                    {canConfirmConsumer && (
                      <Button size="sm" variant="secondary" onClick={() => setConfirm('consumer')}>
                        기업 서명 확인
                      </Button>
                    )}
                    {canSign && (
                      <Button size="sm" onClick={() => setConfirm('sign')}>
                        {role.isAdmin ? 'SPC 전자서명' : '전자서명'}
                      </Button>
                    )}
                  </>
                }
              >
                <div className="grid grid-cols-3 gap-4">
                  <Info label="계약번호" value={c.no} />
                  <Info label="기업명" value={c.consumerCompanyName} />
                  <Info label="계약 유형" value={kindLabel(c.kind)} />
                  <Info label="설치 용량" value={fmtKw(c.capacityKw)} />
                  <Info label="계약 기간" value={`${c.termYears}년`} />
                  <Info label="시작일" value={c.startDate} />
                  <Info
                    label={spcSide ? 'SPC 서명' : `${c.generatorCompanyName} 서명`}
                    value={c.signedByGenerator ? '완료' : '전'}
                  />
                  <Info label="기업 서명" value={c.signedByConsumer ? '완료' : '전'} />
                  <Info label="체결일" value={c.signedAt ? fmtDate(c.signedAt) : undefined} />
                </div>
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

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (c && confirm === 'sign') {
            sign(c.id);
            addToast('success', `${c.no} 전자서명`);
          } else if (c && confirm === 'consumer') {
            confirmConsumer(c.id);
            addToast('success', `${c.no} 기업 서명 확인`);
          }
          setConfirm(null);
        }}
        title={confirm === 'sign' ? '전자서명' : '기업 서명 확인'}
        message={
          confirm === 'sign'
            ? `${c?.no} 계약서에 ${role.isAdmin ? CO.SPC.name : role.companyName} 명의로 서명합니다.`
            : `${c?.consumerCompanyName} 전자서명을 확인 처리합니다.`
        }
        confirmLabel={confirm === 'sign' ? '서명' : '확인'}
      />
    </div>
  );
}
