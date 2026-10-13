'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Send } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { BackButton } from '@/components/layout/PageTitle';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { StatusPill, type StatusTone } from '@/components/ui/Design';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { useTradingPocStore } from '@/stores/useTradingPocStore';
import { PLAN_LABEL } from '@/lib/solar-sim';
import type { TradeRequest } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { KIND_OPTIONS, PARTY_LABEL, fmtDate, fmtDateTime, fmtKw, fmtNum, kindLabel } from './meta';
import {
  EventTimeline,
  Info,
  ModalFooter,
  PageHeader,
  TradeStepper,
  stepLabel,
  cell,
  cellMuted,
  cellNum,
  cellStrong,
  tradeStepOf,
  localToday,
  TEXT_MAX,
} from './Bits';
import { TermsInfo, type TermsEdit } from './TermsInfo';

const IN_TALK: TradeRequest['status'][] = ['SUBMITTED', 'REVIEW'];
const IN_APPROVALS: TradeRequest['status'][] = ['APPROVED', 'SIGNED'];

/** 거래 이력 상태 — 승인 전까지. 신청(미팅일 확정 전) → 미팅(미팅일 확정 ~ 조건 동의 전) + 반려 · 취소. 승인부터는 거래 승인에 */
const HISTORY_STATUS = ['신청', '미팅', '반려'] as const;
type HistoryStatus = (typeof HISTORY_STATUS)[number];
const HISTORY_TONE: Record<HistoryStatus, StatusTone> = { 신청: 'muted', 미팅: 'warning', 반려: 'danger' };
function historyStatusOf(r: TradeRequest): HistoryStatus {
  if (r.status === 'REJECTED' || r.status === 'CANCELLED') return '반려';
  if (r.status === 'SUBMITTED') return '신청';
  return '미팅';
}
const HistoryPill = ({ r }: { r: TradeRequest }) => {
  const label = historyStatusOf(r);
  const done = r.status === 'REJECTED' || r.status === 'CANCELLED';
  return <StatusPill tone={HISTORY_TONE[label]} label={done ? label : stepLabel(label, tradeStepOf(r))} />;
};

/** 신청한 쪽(기업·발전사업자)인지 — 관리자가 아니고 당사자 */
function isMineOf(role: ReturnType<typeof useTradingRole>, r: TradeRequest) {
  return !role.isAdmin && [r.applicantCompanyId, r.generatorCompanyId, r.consumerCompanyId].includes(role.companyId);
}

const arrow = {
  key: 'go',
  header: '',
  width: '40px',
  render: () => <ChevronRight size={15} className="text-slate-600" />,
};
const base = (admin: boolean) => (admin ? '/platform/trading/history' : '/generator/trading/history');

/**
 * 거래 이력 — 거래 신청 뒤 진행·대화(표). 행을 누르면 그 신청 화면에서 단계 · 조건 제안 · 소통 · 승인을 처리한다.
 * 관리자는 전체, 발전사업자 등은 자기 신청만. 성사(승인)되면 거래 승인(전자서명)으로, 끝난 거래도 대화 기록과 함께 남는다.
 * 돈(월 정산)은 수익·정산.
 */
export function TradeHistoryScreen() {
  const router = useRouter();
  const role = useTradingRole();
  const [filter, setFilter] = useState('');
  const [kind, setKind] = useState('');

  // 승인 · 체결은 거래 승인으로 넘어가므로 빼고
  const mine = useMemo(() => role.requests.filter((r) => !IN_APPROVALS.includes(r.status)), [role.requests]);
  const list = useMemo(
    () =>
      mine
        .filter((r) => !filter || historyStatusOf(r) === filter)
        .filter((r) => !kind || r.kind === kind)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [mine, filter, kind],
  );
  // 들어온 신청 — 아직 미팅일을 잡지 않은 신청 접수 건만. 유형별로 따로
  const received = mine.filter((r) => r.status === 'SUBMITTED');
  const stats = {
    all: received.length,
    self: received.filter((r) => r.kind === 'SELF_CONSUMPTION').length,
    onsite: received.filter((r) => r.kind === 'ONSITE').length,
  };

  const columns: Column<TradeRequest>[] = [
    { key: 'no', header: '신청번호', width: '160px', render: (r) => cellStrong(r.no) },
    { key: 'consumer', header: '기업명', render: (r) => cell(r.consumerCompanyName, 'text-white') },
    { key: 'kind', header: '계약 유형', width: '100px', render: (r) => cell(kindLabel(r.kind)) },
    { key: 'capacity', header: '용량', width: '130px', render: (r) => cellNum(fmtKw(r.capacityKw)) },
    {
      key: 'talk',
      header: '최근 소통',
      width: '120px',
      sortable: true,
      sortValue: (r) => r.updatedAt,
      render: (r) => cellMuted(fmtDate(r.messages?.length ? r.messages[r.messages.length - 1]!.at : r.updatedAt)),
    },
    { key: 'status', header: '상태', width: '150px', render: (r) => <HistoryPill r={r} /> },
    arrow,
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="거래 이력" />

      <StatsGrid columns={3}>
        <StatCard label="들어온 신청" value={`${stats.all}건`} />
        <StatCard label="자가소비" value={`${stats.self}건`} />
        <StatCard label="PPA" value={`${stats.onsite}건`} />
      </StatsGrid>

      <SectionCard
        title="신청"
        actions={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              계약 유형
              <Select
                options={[{ value: '', label: '전체' }, ...KIND_OPTIONS]}
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="w-32"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              상태
              <Select
                options={[{ value: '', label: '전체' }, ...HISTORY_STATUS.map((v) => ({ value: v, label: v }))]}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-32"
              />
            </label>
          </div>
        }
        noPadding
      >
        <DataTable
          columns={columns}
          data={list}
          rowKey={(r) => r.id}
          emptyMessage="신청 없음"
          onRowClick={(r) => router.push(`${base(role.isAdmin)}/view?id=${r.id}`)}
        />
      </SectionCard>
    </div>
  );
}

const approvalsBase = (admin: boolean) => (admin ? '/platform/trading/approvals' : '/generator/trading/approvals');

/** 거래 이력 › 신청 한 건 — ?id=신청 번호. 위: 단계 / 신청 내용(조건 협의 때 그 자리에서 고침) / 진행 이력, 옆: 협의 채팅 */
export function TradeHistoryDetailScreen() {
  const role = useTradingRole();
  const [id, setId] = useState<number | null>(null);
  useEffect(() => {
    setId(Number(new URLSearchParams(window.location.search).get('id')));
  }, []);
  const r = id == null ? undefined : role.requests.find((x) => x.id === id);
  const list = base(role.isAdmin);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: 'RE100', path: '/re100' }, { label: '거래 이력', path: list }, { label: r?.no ?? '신청' }]}
      />
      {id != null && !r ? (
        <div className="rounded-2xl bg-[#0d1520] p-10 text-center text-sm text-slate-400 ring-1 ring-white/[0.06]">
          신청을 찾을 수 없습니다
        </div>
      ) : r ? (
        <TradeWorkspace key={r.id} r={r} list={list} />
      ) : null}
    </div>
  );
}

/* ── 조건 — 미팅 뒤 신청 내용 칸에 그 자리에서 넣는다(관리자): 설치 용량 · 계약 기간 · 단가 ── */
type Draft = Record<'capacityKw' | 'termYears' | 'price' | 'installUnit' | 'extraCost' | 'omRatePct' | 'tariffPlan', string>;
/** 조건 칸 범위 — [최소, 최대, 소수 자리]. 추가 설치비용만 0 허용(선택) */
const TERM_LIM: Record<Exclude<keyof Draft, 'tariffPlan'>, readonly [number, number, number]> = {
  capacityKw: [1, 10_000, 2], // kW — 거래 신청 · 무료진단과 같은 최대
  termYears: [1, 25, 0], // 년
  price: [0.1, 1_000, 1], // ₩/kWh — 무료진단 구간 단가와 같은 최대
  installUnit: [1, 10_000_000, 0], // 원/kW — 무료진단 설치단가와 같은 최대
  extraCost: [0, 10_000_000_000, 0], // 원
  omRatePct: [0.1, 20, 1], // 설치비 대비 %
};
/** 숫자 칸 — 숫자와 점 하나, 정해진 소수 자리까지, 최대를 넘으면 최대 */
const numIn = (raw: string, [, hi, dec]: readonly [number, number, number]) => {
  let v = raw.replace(dec ? /[^0-9.]/g : /[^0-9]/g, '');
  const dot = v.indexOf('.');
  if (dot >= 0) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '').slice(0, dec);
  return Number(v) > hi ? String(hi) : v;
};
const inLim = (v: number, [lo, hi]: readonly [number, number, number]) => v >= lo && v <= hi;

/** 글자 칸 — 숫자로 비교하지 않는다 */
const TEXT_KEYS: (keyof Draft)[] = ['tariffPlan'];
const draftOf = (r: TradeRequest): Draft => ({
  capacityKw: String(r.capacityKw || ''),
  termYears: String(r.termYears || ''),
  price: r.unitPrice > 0 ? String(r.unitPrice) : '',
  installUnit: String(r.installUnit ?? ''),
  extraCost: String(r.extraCost ?? ''),
  omRatePct: String(r.omRatePct ?? ''),
  tariffPlan: r.tariffPlan ?? '',
});
function termsOfDraft(d: Draft, r: TradeRequest) {
  const n = (k: keyof Draft) => Number(d[k]) || 0;
  const common = { capacityKw: n('capacityKw'), termYears: n('termYears') };
  // 두 유형 모두 설치 단가 · 추가 설치비용 · O&M. PPA 는 단가도
  const cost = { installUnit: n('installUnit'), extraCost: n('extraCost'), omRatePct: n('omRatePct'), tariffPlan: d.tariffPlan || undefined };
  return r.kind === 'SELF_CONSUMPTION' ? { ...common, ...cost } : { ...common, ...cost, unitPrice: n('price') };
}
/** 진행 이력에 남길 바뀐 내용 */
function changeNote(r: TradeRequest, t: ReturnType<typeof termsOfDraft>) {
  const out: string[] = [];
  if (t.capacityKw !== r.capacityKw) out.push(`설치 용량 ${fmtKw(r.capacityKw)} → ${fmtKw(t.capacityKw)}`);
  if (t.termYears !== r.termYears) out.push(`계약 기간 ${r.termYears}년 → ${t.termYears}년`);
  if ('unitPrice' in t && t.unitPrice !== r.unitPrice)
    out.push(`PPA 단가 ${r.unitPrice > 0 ? `₩${fmtNum(r.unitPrice, 1)}` : '-'} → ₩${fmtNum(t.unitPrice, 1)}/kWh`);
  if (t.installUnit !== (r.installUnit ?? 0)) out.push(`설치 단가 ₩${fmtNum(r.installUnit ?? 0)} → ₩${fmtNum(t.installUnit)}/kW`);
  if (t.extraCost !== (r.extraCost ?? 0)) out.push(`추가 설치비용 ₩${fmtNum(r.extraCost ?? 0)} → ₩${fmtNum(t.extraCost)}`);
  if (t.omRatePct !== (r.omRatePct ?? 0)) out.push(`연간 O&M ${r.omRatePct ?? 0}% → ${t.omRatePct}%`);
  if ((t.tariffPlan ?? '') !== (r.tariffPlan ?? '')) out.push(`요금제 ${r.tariffPlan ?? '-'} → ${t.tariffPlan ?? '-'}`);
  return out.join(' · ') || undefined;
}

/**
 * 신청 한 건 — 단계(위) · 신청 내용 · 진행 이력 · 협의 채팅(옆).
 * 미팅 단계: 관리자 · 신청한 쪽 둘 다 같은 칸에 조건을 넣고 저장(채팅으로 맞춘다) → 승인 / 반려는 관리자, 신청 취소는 신청한 쪽. 미팅 완료 버튼은 없다(2026-10-12)
 */
function TradeWorkspace({ r, list }: { r: TradeRequest; list: string }) {
  const router = useRouter();
  const role = useTradingRole();
  const addToast = useToastStore((s) => s.add);
  const updateTerms = useTradingPocStore((s) => s.updateTerms);
  const approve = useTradingPocStore((s) => s.approveRequest);
  const reject = useTradingPocStore((s) => s.rejectRequest);

  const active = IN_TALK.includes(r.status);
  const isMine = isMineOf(role, r);
  const admin = role.isAdmin && active;
  // 접수(SUBMITTED): 조건 칸 없음 — 신청한 쪽은 신청 취소, 관리자는 미팅 확정 / 반려
  // 미팅(REVIEW): 관리자가 오프라인에서 정한 조건(금액)을 넣고 저장 → [조건 확정] → 전자서명. 신청한 쪽은 같은 화면에서 값을 보고, 서명 때 확인한다. 신청 취소(사유)는 서명 전까지
  const received = r.status === 'SUBMITTED';
  const editing = r.status === 'REVIEW' && role.isAdmin && !r.termsConfirmedAt; // 확정하면 못 고친다 — 확정 취소로 다시 연다
  const confirmMeeting = useTradingPocStore((s) => s.confirmMeeting);
  const [meetDate, setMeetDate] = useState(r.surveyDate ?? '');

  const [draft, setDraft] = useState<Draft>(() => draftOf(r));
  const saved = draftOf(r);
  const dirty = (Object.keys(saved) as (keyof Draft)[]).some((k) =>
    TEXT_KEYS.includes(k) ? draft[k] !== saved[k] : (Number(draft[k]) || 0) !== (Number(saved[k]) || 0),
  );
  const n = (k: keyof Draft) => Number(draft[k]) || 0;
  const self = r.kind === 'SELF_CONSUMPTION';
  // 필수 — 설치 용량 · 계약 기간 · 설치 단가 · 연간 O&M · 요금제 (PPA 는 PPA 단가도). 추가 설치비용만 선택
  const low = (k: Exclude<keyof Draft, 'tariffPlan'>) => (draft[k] !== '' && n(k) < TERM_LIM[k][0] ? `${TERM_LIM[k][0].toLocaleString('ko-KR')} 이상` : undefined);
  const valid =
    inLim(n('capacityKw'), TERM_LIM.capacityKw) &&
    inLim(n('termYears'), TERM_LIM.termYears) &&
    inLim(n('installUnit'), TERM_LIM.installUnit) &&
    inLim(n('omRatePct'), TERM_LIM.omRatePct) &&
    !!draft.tariffPlan &&
    (self || inLim(n('price'), TERM_LIM.price));
  // 승인 — 조건이 저장돼 있어야(미팅 완료 같은 버튼은 없다. 미팅은 채팅으로, 값은 여기에)
  const termsSaved = r.capacityKw > 0 && r.termYears > 0 && !!r.installUnit && !!r.omRatePct && !!r.tariffPlan && (self || r.unitPrice > 0);
  const confirmTerms = useTradingPocStore((s) => s.confirmTerms);
  const unconfirmTerms = useTradingPocStore((s) => s.unconfirmTerms);
  const canConfirm = !dirty && termsSaved && !r.termsConfirmedAt; // 관리자 조건 확정 → 신청한 쪽 동의
  const agreeOpen = r.status === 'REVIEW' && !!r.termsConfirmedAt; // 동의 대기

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState<'approve' | null>(null);

  const set = (k: Exclude<keyof Draft, 'tariffPlan'>) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [k]: numIn(e.target.value, TERM_LIM[k]) }));
  const money = (k: 'installUnit' | 'extraCost', label: string, required?: boolean) => (
    <Input
      label={label}
      inputMode="numeric"
      required={required}
      error={low(k)}
      value={draft[k] ? Number(draft[k]).toLocaleString('ko-KR') : ''}
      onChange={(e) => setDraft((d) => ({ ...d, [k]: numIn(e.target.value, TERM_LIM[k]) }))}
    />
  );
  const edit: TermsEdit | undefined = editing
    ? {
        meetDate: (
          <Input
            label="미팅일"
            type="date"
            min={localToday()}
            value={meetDate}
            onChange={(e) => {
              setMeetDate(e.target.value);
              // 지난 날은 저장하지 않는다 — 오늘부터
              if (e.target.value && e.target.value >= localToday()) confirmMeeting(r.id, e.target.value);
            }}
          />
        ),
        capacity: (
          <Input label="설치 용량 (kW)" inputMode="decimal" required error={low('capacityKw')} value={draft.capacityKw} onChange={set('capacityKw')} />
        ),
        term: <Input label="계약 기간 (년)" inputMode="numeric" required error={low('termYears')} value={draft.termYears} onChange={set('termYears')} />,
        price: <Input label="PPA 단가 (₩/kWh)" inputMode="decimal" required error={low('price')} value={draft.price} onChange={set('price')} />,
        installUnit: money('installUnit', '설치 단가 (원/kW)', true),
        extraCost: money('extraCost', '추가 설치비용 (원)'),
        omRatePct: (
          <Input label="연간 O&M (설치비 대비, %)" inputMode="decimal" required error={low('omRatePct')} value={draft.omRatePct} onChange={set('omRatePct')} />
        ),
        tariffPlan: (
          <Select
            label="요금제"
            required
            options={[{ value: '', label: '선택' }, ...Object.values(PLAN_LABEL).map((l) => ({ value: l, label: l }))]}
            value={draft.tariffPlan}
            onChange={(e) => setDraft((d) => ({ ...d, tariffPlan: e.target.value }))}
          />
        ),
      }
    : undefined;

  const save = () => {
    const t = termsOfDraft(draft, r);
    updateTerms(r.id, t, changeNote(r, t), role.party);
    addToast('success', `${r.no} 조건 저장`);
  };

  // 단계별 처리 — 신청 내용 위에 고정
  // 지금 상태 — 신청 내용 안 첫 줄에(제목 · 버튼 자리가 아니라)
  const stageLabel = received
    ? '미팅 확정 대기'
    : r.status === 'REVIEW'
      ? agreeOpen
        ? '동의 대기'
        : termsSaved
          ? '조건 확정 대기'
          : '조건 입력 중'
      : r.status === 'APPROVED'
        ? '전자서명 대기'
        : undefined;
  const actions = (
    <>
      {!role.isAdmin && isMine && agreeOpen && (
        <Button size="sm" onClick={() => setConfirm('approve')}>
          동의
        </Button>
      )}
      {admin && agreeOpen && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            unconfirmTerms(r.id);
            addToast('success', `${r.no} 확정 취소 — 조건 다시 입력`);
          }}
        >
          확정 취소
        </Button>
      )}
      {admin && received && (
        <>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            미팅일
            <input
              type="date"
              min={localToday()}
              value={meetDate}
              onChange={(e) => setMeetDate(e.target.value)}
              className="h-8 rounded-md bg-white/[0.04] px-2 text-sm text-white ring-1 ring-white/[0.08] [color-scheme:dark] focus:outline-none focus:ring-primary/60"
            />
          </label>
          <Button
            size="sm"
            disabled={!meetDate || meetDate < localToday()}
            onClick={() => {
              confirmMeeting(r.id, meetDate);
              addToast('success', `${r.no} 미팅 확정 ${meetDate}`);
            }}
          >
            미팅 확정
          </Button>
        </>
      )}
      {editing && (
        <>
          <Button size="sm" variant="secondary" disabled={!dirty} onClick={() => setDraft(saved)}>
            취소
          </Button>
          <Button size="sm" variant="secondary" disabled={!dirty || !valid} onClick={save}>
            저장
          </Button>
          {role.isAdmin && (
            <Button
              size="sm"
              disabled={!canConfirm}
              onClick={() => {
                confirmTerms(r.id);
                addToast('success', `${r.no} 조건 확정 — 동의 대기`);
              }}
            >
              조건 확정
            </Button>
          )}
        </>
      )}
      {admin && (
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            setReason('');
            setRejectOpen(true);
          }}
        >
          반려
        </Button>
      )}
      {!role.isAdmin && isMine && (active || r.status === 'APPROVED') && (
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            setReason('');
            setRejectOpen(true);
          }}
        >
          반려
        </Button>
      )}
    </>
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* 제목 · 단계 */}
        <div className="rounded-xl bg-[#0d1520] p-5 ring-1 ring-white/[0.06]">
          <div className="flex items-start gap-3">
            <BackButton href={list} label="거래 이력으로" />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-white">
                {r.consumerCompanyName} · {kindLabel(r.kind)}
              </h1>
              <p className="mt-1 text-sm text-slate-400 tabular-nums">
                {r.no} · {fmtKw(r.capacityKw)}{r.termYears > 0 ? ` · ${r.termYears}년` : ''} · 접수 {fmtDate(r.submittedAt)} · 신청{' '}
                {r.applicantCompanyName} ({PARTY_LABEL[r.applicant]})
              </p>
            </div>
          </div>
          <TradeStepper r={r} className="mt-5" />
        </div>

        <SectionCard title="신청 내용" actions={actions}>
          <div className="grid grid-cols-3 gap-4">
            {agreeOpen ? (
              <Info label="진행" value={`조건 확정 ${fmtDateTime(r.termsConfirmedAt!)} · 동의 대기`} className="col-span-3" />
            ) : (
              stageLabel && <Info label="진행" value={stageLabel} className="col-span-3" />
            )}
            <TermsInfo x={editing ? { ...r, ...termsOfDraft(draft, r) } : r} edit={edit} />
            {r.status === 'REJECTED' && <Info label="반려 사유" value={r.rejectReason} className="col-span-3" />}
            {r.note && <Info label="비고" value={r.note} className="col-span-3" />}
          </div>
        </SectionCard>

        <SectionCard title="진행 이력">
          <EventTimeline events={r.events} />
        </SectionCard>
      </div>

      <ChatPanel r={r} canSend={active && (role.isAdmin || isMine)} />

      {/* 반려 — 관리자 · 신청한 쪽 누구든 사유를 적고. 말은 '반려' 하나로 */}
      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="신청 반려" size="sm">
        <div className="space-y-4">
          <Textarea
            label="반려 사유"
            maxLength={TEXT_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <ModalFooter>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              취소
            </Button>
            <Button
              variant="danger"
              disabled={!reason.trim()}
              onClick={() => {
                reject(r.id, reason.trim(), role.party);
                addToast('success', `${r.no} 반려`);
                setRejectOpen(false);
              }}
            >
              반려
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          approve(r.id);
          addToast('success', `${r.no} 동의 — 전자서명 대기`);
          router.push(`${approvalsBase(role.isAdmin)}/view?id=${r.id}`);
          setConfirm(null);
        }}
        title="동의"
        message={`${r.no} 조건에 동의합니다. 전자서명으로 넘어갑니다.`}
        confirmLabel="동의"
        variant="primary"
      />
    </div>
  );
}

/** 협의 채팅 — 오른쪽 */
function ChatPanel({ r, canSend }: { r: TradeRequest; canSend: boolean }) {
  const role = useTradingRole();
  const addMessage = useTradingPocStore((s) => s.addMessage);
  const [text, setText] = useState('');
  const send = () => {
    const t = text.trim();
    if (!t) return;
    addMessage(r.id, role.party, role.companyName, t);
    setText('');
  };
  const messages = r.messages ?? [];
  return (
    <div className="flex h-[640px] flex-col rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] lg:sticky lg:top-6">
      <div className="border-b border-white/[0.06] px-5 py-3">
        <h3 className="text-md font-semibold text-white">협의 채팅</h3>
      </div>
      <ul className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && <li className="pt-8 text-center text-sm text-slate-500">메시지 없음</li>}
        {messages.map((m, i) => {
          const me = m.by === role.party && m.byName === role.companyName;
          return (
            <li key={i} className={cn('flex', me ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                  me ? 'bg-primary/20 text-white' : 'bg-white/[0.06] text-slate-200',
                )}
              >
                <p className="text-xs text-slate-400">
                  {m.byName} · {fmtDateTime(m.at)}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap">{m.text}</p>
              </div>
            </li>
          );
        })}
      </ul>
      {canSend && (
        <div className="flex gap-2 border-t border-white/[0.06] p-3">
          <input
            value={text}
            maxLength={TEXT_MAX}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) send();
            }}
            placeholder="메시지 입력"
            className="h-9 flex-1 rounded-md bg-white/[0.04] px-3 text-sm text-white ring-1 ring-white/[0.08] focus:outline-none focus:ring-primary/60"
          />
          <Button size="sm" onClick={send} disabled={!text.trim()} aria-label="보내기">
            <Send size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}
