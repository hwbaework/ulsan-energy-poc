'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Send } from 'lucide-react';
import { SectionCard } from '@/components/features/SectionCard';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { BackButton } from '@/components/layout/PageTitle';
import { ContractSignature } from '@/components/features/ContractSignature';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { CO, changeSummary, changeTermsOf, useTradingPocStore } from '@/stores/useTradingPocStore';
import type { ChangeSign, ChangeTerms, Contract, ContractChange, TradeDocument } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { TERM_LIM, changeLabel, fmtDateTime, inLim, kindLabel, numIn, termRows } from './meta';
import { EventTimeline, Info, ModalFooter, StepBar, TEXT_MAX } from './Bits';
import { DocumentSheet, printSheet } from './DocumentSheet';
import { useLocationSearch } from '@/lib/use-location-search';

/** 지금(한국 시각) — toISOString 은 UTC 라 9시간 어긋난다 */
const localNow = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
};
const baseOf = (admin: boolean) => (admin ? '/platform/trading/changes' : '/generator/trading/changes');

/** 누가 → 누구에게 — SPC → 한일튜브 / 한일튜브 → SPC */
function Direction({ fromSpc, company }: { fromSpc: boolean; company: string }) {
  return (
    <div className="flex items-center gap-2 text-base">
      <span className="font-semibold text-white">{fromSpc ? '관리자' : company}</span>
      <span className="text-slate-500">→</span>
      <span className="font-semibold text-white">{fromSpc ? company : '관리자'}</span>
    </div>
  );
}

/* ══ 변경·해지 한 건 — 거래(신청 접수 → 미팅 → 전자서명 → 승인)와 같은 4칸: 신청 → 조건 입력 → 전자서명 → 승인.
 *    받는 쪽이 [변경 동의]를 누르면 바로 조건 입력(거래의 미팅 확정처럼). 미팅은 시스템 밖(통화 등).
 *    해지는 조건이 없어 두 번째 칸이 해지 동의, 동의하면 바로 전자서명 ══ */
const STEPS = ['신청', '전자서명', '승인'] as const; // 변경 3단계(2026-11-18). 승인은 마지막(양측 서명 끝)에만
/** 해지 — 조건이 없어 3칸. 신청(내용만 · 합의서 없음) → 받는 쪽 해지 동의 → 전자서명(합의서 + 서명) → 둘 다 서명하면 해지 승인 (2026-10-13 신청 단계에 서명 금지) */
const STEPS_TERMINATE = ['신청', '전자서명', '해지 승인'] as const;
const stepsOf = (ch: Pick<ContractChange, 'type'>) => (ch.type === 'TERMINATE' ? STEPS_TERMINATE : STEPS);
/** 동의 이름 — 거래의 '조건 동의'처럼 무엇에 동의하는지 */
/** 받는 쪽(관리자) 버튼 — 승인 · 반려 둘만(2026-10-13). 관리자는 신청하지 않는다 */
const agreeLabel = (ch: Pick<ContractChange, 'type'>) => (ch.type === 'TERMINATE' ? '해지 동의' : '변경 동의'); // 승인은 마지막에만 — 받는 쪽은 동의
/** 지금 단계 번호 — 0 신청(동의 전) · 1 조건 입력 · 조건 동의 · 2 전자서명 · 4 끝 */
const stepOf = (ch: ContractChange) =>
  ch.status === 'APPROVED'
    ? stepsOf(ch).length
    : ch.stage === 'SIGN'
      ? (stepsOf(ch) as readonly string[]).indexOf('전자서명')
      : 0;

/** 단계 — 거래 이력과 같은 표시줄. 서명 단계는 몇 명 서명했는지, 조건 단계는 입력 / 동의 대기 */
function Stepper({ ch }: { ch: ContractChange }) {
  const failed = ch.status === 'REJECTED' ? '반려' : ch.status === 'CANCELLED' ? '취소' : undefined;
  const signed = Number(!!ch.spcSign) + Number(!!ch.companySign);
  return (
    <StepBar
      steps={stepsOf(ch)}
      step={stepOf(ch)}
      failed={failed}
      labelOf={(label) => (label === '전자서명' && ch.stage === 'SIGN' ? `전자서명 ${signed}/2` : label)}
    />
  );
}

/** 서명 칸 — 서명이 있으면 서명, 내 차례면 서명 패드, 아니면 대기 */
function SignBox({
  title,
  company,
  sign,
  mine,
  signerName,
  onSign,
}: {
  title: string;
  /** 서명하는 쪽 회사 — 서명 아래 '이름 (회사)' */
  company: string;
  sign?: ChangeSign;
  mine: boolean;
  /** 서명하는 사람 이름(로그인 계정) — 이름 입력 기본값 */
  signerName: string;
  onSign: (s: ChangeSign) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
      <p className="text-sm font-semibold text-white">{title}</p>
      {sign ? (
        <div className="space-y-2">
          <div className="flex h-28 items-center justify-center rounded-lg bg-[#0d1520] ring-1 ring-white/[0.08]">
            {sign.image ? (
              <img src={sign.image} alt={`${sign.name} 서명`} className="h-full object-contain" />
            ) : (
              <span className="text-3xl text-white" style={{ fontFamily: "'Nanum Pen Script', 'Gaegu', cursive" }}>
                {sign.name}
              </span>
            )}
          </div>
          <p className="text-xs tabular-nums text-slate-400">
            {sign.name !== company ? `${sign.name} (${company})` : company} · {sign.image ? '직접 서명' : '이름 입력'} · {fmtDateTime(sign.at)}
          </p>
        </div>
      ) : mine ? (
        <ContractSignature signerName={signerName} onSign={(x) => onSign({ at: localNow(), name: x.typedName?.trim() || signerName, image: x.image })} />
      ) : (
        <div className="flex h-28 items-center justify-center rounded-lg ring-1 ring-dashed ring-white/[0.1]">
          <span className="text-sm text-slate-500">서명 대기</span>
        </div>
      )}
    </div>
  );
}

export function ChangeDetailScreen() {
  const role = useTradingRole();
  const [id, setId] = useState<number | null>(null);
  // 주소가 바뀌면(다른 알림을 눌러 같은 화면의 다른 건으로) 다시 읽는다
  const search = useLocationSearch();
  useEffect(() => {
    setId(Number(new URLSearchParams(search).get('id')));
  }, [search]);
  const changesAll = useTradingPocStore((s) => s.changes);
  const ch = id == null ? undefined : (role.isAdmin ? changesAll : role.changes).find((x) => x.id === id);
  const c = ch ? role.contracts.find((x) => x.id === ch.contractId) : undefined;
  const list = baseOf(role.isAdmin);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: 'RE100', path: '/re100' }, { label: '변경·해지', path: list }, { label: ch?.no ?? '신청' }]}
      />
      {id != null && (!ch || !c) ? (
        <div className="rounded-2xl bg-[#0d1520] p-10 text-center text-sm text-slate-400 ring-1 ring-white/[0.06]">
          신청을 찾을 수 없습니다
        </div>
      ) : ch && c ? (
        <ChangeWorkspace key={ch.id} ch={ch} c={c} list={list} />
      ) : null}
    </div>
  );
}

function ChangeWorkspace({ ch, c, list }: { ch: ContractChange; c: Contract; list: string }) {
  const role = useTradingRole();
  const addToast = useToastStore((s) => s.add);
  const agree = useTradingPocStore((s) => s.agreeChange);
  const signChange = useTradingPocStore((s) => s.signChange);
  const reject = useTradingPocStore((s) => s.rejectChange);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  // 합의서 문서 — 양측 서명 뒤는 문서 관리의 서명본, 그 전은 같은 양식의 초안
  const sheet = useRef<HTMLDivElement>(null);
  const signedDoc = useTradingPocStore((s) =>
    s.documents.find((d) => (d.category === 'CHANGE' || d.category === 'TERMINATE') && d.fileName.startsWith(`${ch.no}_`)),
  );
  const agreementDoc: TradeDocument = signedDoc ?? {
    id: -1,
    category: ch.type === 'TERMINATE' ? 'TERMINATE' : 'CHANGE',
    title: `${ch.type === 'TERMINATE' ? '계약 해지 합의서' : '계약 변경 합의서'} (초안) — ${c.plantName}`,
    fileName: `${ch.no}_합의서.pdf`,
    contractId: c.id,
    contractNo: c.no,
    plantName: c.plantName,
    partyCompanyIds: [c.generatorCompanyId, c.consumerCompanyId],
    issuedAt: localNow().slice(0, 10),
    fileType: 'PDF',
    sizeKb: 0,
  };

  const open = ch.status === 'REQUESTED';
  const step = stepOf(ch);
  const signing = ch.stage === 'SIGN';
  const showSign = signing || ch.status === 'APPROVED' || !!ch.spcSign || !!ch.companySign;
  const isCompany = !role.isAdmin && role.companyId === c.consumerCompanyId;
  const fromSpc = ch.requestedBy === 'spc';
  const mineRequest = role.isAdmin ? fromSpc : !fromSpc && isCompany;
  /** 받는 쪽 — 기업이 신청하면 SPC, SPC 가 신청하면 그 기업. 받는 쪽이 승인(곧 합의) · 반려 */
  const receiver = role.isAdmin ? !fromSpc : fromSpc && isCompany;
  const typeLabel = changeLabel(ch, c.kind);


  /** 반려 — 누구든 한 번만. 받는 쪽은 신청 단계에서, 신청한 쪽은 서명 전까지(2026-10-13 반려 두 개 · 신청 취소 삭제) */
  // 반려 — 신청 단계는 받는 쪽 · 신청한 쪽 모두, 전자서명은 신청한 쪽만(관리자는 이미 동의 · 조건 확정한 쪽, 거래 전자서명과 같게)
  const canReject = open && ((step === 0 && (receiver || mineRequest)) || (signing && mineRequest));
  const rejectButton = (
    <Button
      size="sm"
      variant="danger"
      onClick={() => {
        setReason('');
        setRejecting(true);
      }}
    >
      반려
    </Button>
  );
  // 버튼은 지금 처리하는 칸 위에 — 신청은 요청 내용, 전자서명은 합의서(거래 전자서명과 같게). 요청 내용은 전자서명 때 내용만
  const actions = (
    <>
      {open && receiver && step === 0 && ch.type === 'TERMINATE' && (
        <Button
          size="sm"
          onClick={() => {
            agree(ch.id, role.party);
            addToast('success', `${ch.no} ${agreeLabel(ch)} — ${ch.type === 'TERMINATE' ? '전자서명 대기' : '조건 입력 대기'}`);
          }}
        >
          {agreeLabel(ch)}
        </Button>
      )}
      {canReject && !signing && ch.type === 'TERMINATE' && rejectButton}
    </>
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* 제목 · 단계 */}
        <div className="rounded-xl bg-[#0d1520] p-5 ring-1 ring-white/[0.06]">
          <div className="flex items-start gap-3">
            <BackButton href={list} label="변경·해지로" />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-white">
                {c.consumerCompanyName} · {typeLabel}
              </h1>
              <p className="mt-1 text-sm tabular-nums text-slate-400">
                {ch.no} · {c.no} · {kindLabel(c.kind)} · 신청 {fmtDateTime(ch.requestedAt)}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <Stepper ch={ch} />
          </div>
        </div>

        {/* 합의서 — 전자서명 단계부터 맨 위. 내용은 아래 요청 칸에 있어 요약을 다시 두지 않는다. 둘 다 서명하면 승인 · 서명본이 문서 관리에 */}
        {showSign && (
          <SectionCard
            title={`${ch.type === 'TERMINATE' ? '계약 해지' : '계약 변경'} 합의서`}
            actions={canReject && signing ? rejectButton : undefined}
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <SignBox
                  title={`관리자 · ${CO.SPC.name}`}
                  company={CO.SPC.name}
                  sign={ch.spcSign}
                  mine={role.isAdmin && open && signing}
                  signerName={role.user?.name || CO.SPC.name}
                  onSign={(s) => {
                    signChange(ch.id, 'spc', s);
                    addToast('success', `${ch.no} 관리자 서명`);
                  }}
                />
                <SignBox
                  title={`기업 · ${c.consumerCompanyName}`}
                  company={c.consumerCompanyName}
                  sign={ch.companySign}
                  mine={isCompany && open && signing}
                  signerName={role.user?.name || c.consumerCompanyName}
                  onSign={(s) => {
                    signChange(ch.id, 'company', s);
                    addToast('success', `${ch.no} ${c.consumerCompanyName} 서명`);
                  }}
                />
              </div>
            </div>
          </SectionCard>
        )}

        {/* 변경 조건 — 변경 동의 뒤 관리자가 다시 넣는다(지금 계약 값으로 시작). 해지는 없음 */}
        {ch.type !== 'TERMINATE' && (ch.terms || ch.status === 'APPROVED') && (
          <ChangeTermsCard
            key={`${ch.id}-${ch.stage ?? ''}-${ch.editingBy ?? ''}`}
            ch={ch}
            c={c}
            onReject={() => {
              setReason('');
              setRejecting(true);
            }}
          />
        )}

        {/* 해지 — 신청 카드(계약 종료일 · 사유). 구분은 제목에, 변경은 사유까지 변경 조건 카드 안에 있어 이 카드가 없다(2026-11-18 사용자) */}
        {ch.type === 'TERMINATE' && (
          <SectionCard title={<Direction fromSpc={fromSpc} company={c.consumerCompanyName} />} actions={actions}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Info label="계약 종료일" value={c.endDate} />
              <Info label="사유" value={ch.reason} className="md:col-span-3" />
              {ch.status === 'REJECTED' && <Info label="반려 사유" value={ch.decisionNote} className="md:col-span-3" />}
            </div>
          </SectionCard>
        )}

        {/* 합의서 문서 — 계약서처럼. 전자서명 단계부터 초안, 양측 서명 뒤 서명본(문서 관리에도 남는다) */}
        {showSign && (
          <SectionCard
            title={signedDoc ? '합의서 (서명본)' : '합의서 (초안)'}
            actions={
              <Button size="sm" variant="secondary" onClick={() => printSheet(sheet.current, agreementDoc.fileName.replace(/\.pdf$/, ''))}>
                <Download size={14} className="mr-1.5" /> 다운로드
              </Button>
            }
          >
            <DocumentSheet doc={agreementDoc} contract={c} change={ch} sheetRef={sheet} />
          </SectionCard>
        )}

        {/* 진행 이력 — 전자서명 전에는 아래 */}
        {!showSign && (
          <SectionCard title="진행 이력">
            <EventTimeline events={ch.events ?? []} companyName={c.consumerCompanyName} signs={{ spc: ch.spcSign, company: ch.companySign }} />
          </SectionCard>
        )}
      </div>

      {/* 오른쪽 — 거래와 같게: 신청 · 조건 단계는 협의 채팅, 전자서명부터는 채팅 없이 진행 이력(2026-10-14) */}
      {showSign ? (
        <SectionCard title="진행 이력" className="lg:sticky lg:top-6">
          <EventTimeline events={ch.events ?? []} companyName={c.consumerCompanyName} signs={{ spc: ch.spcSign, company: ch.companySign }} />
        </SectionCard>
      ) : (
        <ChangeChat ch={ch} canSend={open && (role.isAdmin || isCompany)} />
      )}

      {/* 반려 — 거래와 같은 팝업. 사유 필수 */}
      <Modal open={rejecting} onClose={() => setRejecting(false)} title="신청 반려" size="sm">
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
            <Button variant="secondary" onClick={() => setRejecting(false)}>
              취소
            </Button>
            <Button
              variant="danger"
              disabled={!reason.trim()}
              onClick={() => {
                reject(ch.id, reason.trim(), role.party);
                addToast('success', `${ch.no} 반려`);
                setRejecting(false);
              }}
            >
              반려
            </Button>
          </ModalFooter>
        </div>
      </Modal>

    </div>
  );
}


/**
 * 변경 조건 — 항목 · 현재 · 변경. 거래 미팅과 같은 흐름(2026-11-18 사용자):
 *  - 받은 쪽: 동의(→ 전자서명) / 조건 변경 / 반려. 보낸 쪽: 조건 변경 / 반려
 *  - 조건 변경 → 확인창 → 누른 쪽 화면의 변경 칸이 입력으로 바뀜 → 취소 / 조건 확정 → 상대 차례
 *  - 받은 쪽 화면에만 바뀐 칸 '기존 → 새 값'(새 값 노란색), 고친 쪽 화면엔 없음
 */
type TermKey = 'termYears' | 'unitPrice' | 'omAnnual';
const TERM_LIM_OF: Record<TermKey, readonly [number, number, number]> = { termYears: TERM_LIM.termYears, unitPrice: TERM_LIM.price, omAnnual: TERM_LIM.omAnnual };
const INPUT_LABEL: Record<TermKey, string> = { termYears: '계약 기간 (년)', unitPrice: 'PPA 단가 (₩/kWh)', omAnnual: '연간 O&M (원/년)' };
const draftOfTerms =(t: ChangeTerms): Record<TermKey, string> => ({ termYears: String(t.termYears), unitPrice: String(t.unitPrice), omAnnual: String(t.omAnnual ?? '') });

function ChangeTermsCard({ ch, c, onReject }: { ch: ContractChange; c: Contract; onReject: () => void }) {
  const role = useTradingRole();
  const addToast = useToastStore((s) => s.add);
  const agreeChange = useTradingPocStore((s) => s.agreeChange);
  const unconfirm = useTradingPocStore((s) => s.unconfirmChangeTerms);
  const confirmTerms = useTradingPocStore((s) => s.counterChange);
  const saveTerms = useTradingPocStore((s) => s.saveChangeTerms);
  const [askChange, setAskChange] = useState(false);
  const open = ch.status === 'REQUESTED';
  const before = ch.termsBefore ?? changeTermsOf(c);
  const shown = ch.terms ?? changeTermsOf(c);
  const isCompany = !role.isAdmin && role.companyId === c.consumerCompanyId;
  // 나는 관리자 쪽인지 기업 쪽인지(당사자가 아니면 없음)
  const side = (p?: string) => (p === 'spc' ? 'admin' : 'company');
  const mySide = role.isAdmin ? 'admin' : isCompany ? 'company' : null;
  const sender = side(ch.proposedBy ?? ch.requestedBy);
  const nameOf = (x: 'admin' | 'company') => (x === 'admin' ? '관리자' : c.consumerCompanyName);
  // 조건 변경 중 — 누른 쪽만 고친다
  const editingSide = ch.stage === 'TERMS' && ch.editingBy ? side(ch.editingBy) : null;
  const editing = open && !!mySide && editingSide === mySide;
  const waiting = open && ch.stage === 'AGREE' && !!mySide;
  // 상대가 보낸 값 — 내가 동의 / 조건 변경 / 반려
  const toAgree = waiting && sender !== mySide;

  const [d, setD] = useState<Record<TermKey, string>>(() => draftOfTerms(shown));
  useEffect(() => setD(draftOfTerms(shown)), [ch.terms]); // eslint-disable-line react-hooks/exhaustive-deps
  const saved = draftOfTerms(shown);
  const keys: TermKey[] = c.kind === 'ONSITE' ? ['termYears', 'unitPrice', 'omAnnual'] : ['termYears', 'omAnnual'];
  const dirty = keys.some((k) => (Number(d[k]) || 0) !== (Number(saved[k]) || 0));
  const valid = keys.every((k) => inLim(Number(d[k]) || 0, TERM_LIM_OF[k]));
  const draftTerms: ChangeTerms = { ...shown, termYears: Number(d.termYears) || 0, unitPrice: Number(d.unitPrice) || 0, omAnnual: Number(d.omAnnual) || 0 };
  const rows = termRows(c.kind, before, editing ? draftTerms : shown);

  const state =
    ch.status === 'APPROVED'
      ? '승인 완료 · 계약에 반영'
      : ch.stage === 'TERMS'
        ? `${nameOf(editingSide ?? 'admin')} 조건 변경 중`
        : ch.stage === 'AGREE'
          ? `${nameOf(sender)} ${(ch.proposedBy ?? ch.requestedBy) === ch.requestedBy && !ch.termsPrev ? '신청' : '조건 확정'} · ${toAgree ? '확인' : '동의 대기'}`
          : '동의 완료 · 전자서명';

  const actions =
    open && mySide && (waiting || editing) ? (
      <>
        {toAgree && (
          <Button
            size="sm"
            onClick={() => {
              agreeChange(ch.id, role.party);
              addToast('success', `${ch.no} 변경 동의 — 전자서명 대기`);
            }}
          >
            동의
          </Button>
        )}
        {waiting && (
          <Button size="sm" variant="secondary" onClick={() => setAskChange(true)}>
            조건 변경
          </Button>
        )}
        {editing && (
          <>
            <Button size="sm" variant="secondary" disabled={!dirty} onClick={() => setD(saved)}>
              취소
            </Button>
            {/* 거래 미팅과 같은 셋 — 취소 · 저장 · 조건 확정(저장한 값을 보낸다, 저장 안 한 값이 있으면 확정 못 함) */}
            <Button
              size="sm"
              variant="secondary"
              disabled={!dirty || !valid}
              onClick={() => {
                saveTerms(ch.id, draftTerms, changeSummary(before, draftTerms, c.kind), role.party);
                addToast('success', `${ch.no} 조건 저장`);
              }}
            >
              저장
            </Button>
            <Button
              size="sm"
              disabled={dirty}
              onClick={() => {
                confirmTerms(ch.id, shown, role.party, role.isAdmin ? CO.SPC.name : role.companyName);
                addToast('success', `${ch.no} 조건 확정 — 동의 대기`);
              }}
            >
              조건 확정
            </Button>
          </>
        )}
        <Button size="sm" variant="danger" onClick={onReject}>
          반려
        </Button>
      </>
    ) : undefined;

  const input = (k: TermKey) => (
    <Input
      inputMode={k === 'termYears' ? 'numeric' : 'decimal'}
      label={INPUT_LABEL[k]}
      required
      value={k === 'omAnnual' && d[k] ? Number(d[k]).toLocaleString('ko-KR') : d[k]}
      onChange={(e) => setD((x) => ({ ...x, [k]: numIn(e.target.value, TERM_LIM_OF[k]) }))}
    />
  );
  const keyOfLabel: Record<string, TermKey> = { '계약 기간': 'termYears', 'PPA 단가': 'unitPrice', '연간 O&M': 'omAnnual' };

  return (
    <SectionCard title="변경 조건" actions={actions}>
      {/* 거래 '신청 내용'과 같은 네모 칸(이름 위 · 값 아래). 연간 O&M 처럼 '현재 → 새 값'이 긴 금액이 잘리지 않게 두 칸씩, 값은 한 줄 */}
      <div className="grid grid-cols-2 gap-4">
        <Info label="진행" value={state} className="col-span-2" />
        {rows.map((r) => {
          const k = keyOfLabel[r.label]!;
          if (editing) return <div key={r.label}>{input(k)}</div>;
          // 지금 계약과 달라지는 칸은 모두 노란색 — 고쳐 보낸 것도 아직 동의 전(다시 보낸 기록은 진행 이력 · 협의 채팅)
          const hot = r.changed;
          return (
            <Info
              key={r.label}
              label={r.label}
              value={
                r.changed ? (
                  <span className="whitespace-nowrap tabular-nums">
                    {r.before} → <span className={cn(hot ? 'font-bold text-amber-300' : 'font-semibold')}>{r.after}</span>
                  </span>
                ) : (
                  <span className="whitespace-nowrap tabular-nums">{r.after}</span>
                )
              }
            />
          );
        })}
        <Info label="사유" value={ch.reason} className="col-span-2" />
        {ch.status === 'REJECTED' && <Info label="반려 사유" value={ch.decisionNote} className="col-span-2" />}
      </div>
      {/* 조건 변경 — 관리자 · 기업 같은 확인창(거래 미팅과 같음). 이유는 협의 채팅으로 */}
      <ConfirmDialog
        open={askChange}
        onClose={() => setAskChange(false)}
        onConfirm={() => {
          unconfirm(ch.id, role.party);
          addToast('success', `${ch.no} 조건 변경`);
          setAskChange(false);
        }}
        title="조건 변경"
        message="확정된 조건을 변경합니다."
        confirmLabel="조건 변경"
      />
    </SectionCard>
  );
}

/** 협의 채팅 — 오른쪽 */
function ChangeChat({ ch, canSend }: { ch: ContractChange; canSend: boolean }) {
  const role = useTradingRole();
  const add = useTradingPocStore((s) => s.addChangeMessage);
  const [text, setText] = useState('');
  const send = () => {
    const t = text.trim();
    if (!t) return;
    add(ch.id, role.party, role.companyName, t);
    setText('');
  };
  const messages = ch.messages ?? [];
  return (
    <div className="flex h-[640px] flex-col rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] lg:sticky lg:top-6">
      <div className="border-b border-white/[0.06] px-5 py-3">
        <h3 className="text-md font-semibold text-white">협의 채팅</h3>
      </div>
      <ul className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && <li className="pt-8 text-center text-sm text-slate-500">메시지 없음</li>}
        {messages.map((m, i) => {
          const me = m.byName === role.companyName;
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
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) send();
            }}
            maxLength={TEXT_MAX}
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
