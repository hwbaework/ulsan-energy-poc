'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Send } from 'lucide-react';
import { SectionCard } from '@/components/features/SectionCard';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { BackButton } from '@/components/layout/PageTitle';
import { ContractSignature } from '@/components/features/ContractSignature';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PLAN_LABEL } from '@/lib/solar-sim';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { CO, changeTermsOf, useTradingPocStore } from '@/stores/useTradingPocStore';
import type { ChangeSign, ChangeTerms, Contract, ContractChange, TradeDocument } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { TERM_LIM, changeTypeLabel, fmtDateTime, inLim, kindLabel, numIn, termRows, type TermLimKey } from './meta';
import { EventTimeline, Info, ModalFooter, StepBar, TEXT_MAX } from './Bits';
import { changeText } from './ChangeDetailModal';
import { DocumentSheet, printSheet } from './DocumentSheet';

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
const STEPS = ['신청', '조건 입력', '전자서명', '완료'] as const;
/** 해지 — 조건이 없어 3칸. 신청(내용만 · 합의서 없음) → 받는 쪽 해지 동의 → 전자서명(합의서 + 서명) → 둘 다 서명하면 해지 승인 (2026-10-13 신청 단계에 서명 금지) */
const STEPS_TERMINATE = ['신청', '전자서명', '해지 완료'] as const;
const stepsOf = (ch: Pick<ContractChange, 'type'>) => (ch.type === 'TERMINATE' ? STEPS_TERMINATE : STEPS);
/** 동의 이름 — 거래의 '조건 동의'처럼 무엇에 동의하는지 */
/** 받는 쪽(관리자) 버튼 — 승인 · 반려 둘만(2026-10-13). 관리자는 신청하지 않는다 */
const agreeLabel = (_ch: Pick<ContractChange, 'type'>) => '승인';
/** 지금 단계 번호 — 0 신청(동의 전) · 1 조건 입력 · 조건 동의 · 2 전자서명 · 4 끝 */
const stepOf = (ch: ContractChange) =>
  ch.status === 'APPROVED'
    ? stepsOf(ch).length
    : ch.stage === 'SIGN'
      ? (stepsOf(ch) as readonly string[]).indexOf('전자서명')
      : ch.stage === 'TERMS' || ch.stage === 'AGREE'
        ? 1
        : 0;
/** 두 번째 칸 이름 — 해지는 해지 동의, 변경은 조건 입력 → (확정 뒤) 조건 동의 */
const agreeStepLabel = (ch: ContractChange) => (ch.stage === 'AGREE' ? '조건 동의' : '조건 입력');

/** 단계 — 거래 이력과 같은 표시줄. 서명 단계는 몇 명 서명했는지, 조건 단계는 입력 / 동의 대기 */
function Stepper({ ch }: { ch: ContractChange }) {
  const failed = ch.status === 'REJECTED' ? '반려' : ch.status === 'CANCELLED' ? '취소' : undefined;
  const signed = Number(!!ch.spcSign) + Number(!!ch.companySign);
  return (
    <StepBar
      steps={stepsOf(ch)}
      step={stepOf(ch)}
      failed={failed}
      labelOf={(label) => (label === '조건 입력' ? agreeStepLabel(ch) : label === '전자서명' && ch.stage === 'SIGN' ? `전자서명 ${signed}/2` : label)}
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
  useEffect(() => {
    setId(Number(new URLSearchParams(window.location.search).get('id')));
  }, []);
  const changesAll = useTradingPocStore((s) => s.changes);
  const ch = id == null ? undefined : (role.isAdmin ? changesAll : role.changes).find((x) => x.id === id);
  const c = ch ? role.contracts.find((x) => x.id === ch.contractId) : undefined;
  const list = baseOf(role.isAdmin);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: 'RE100', path: '/re100' }, { label: '변경·해지', path: list }, { label: ch?.no ?? '요청' }]}
      />
      {id != null && (!ch || !c) ? (
        <div className="rounded-2xl bg-[#0d1520] p-10 text-center text-sm text-slate-400 ring-1 ring-white/[0.06]">
          요청을 찾을 수 없습니다
        </div>
      ) : ch && c ? (
        <ChangeWorkspace ch={ch} c={c} list={list} />
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
  const typeLabel = changeTypeLabel(ch.type, c.kind);


  /** 반려 — 누구든 한 번만. 받는 쪽은 신청 단계에서, 신청한 쪽은 서명 전까지(2026-10-13 반려 두 개 · 신청 취소 삭제) */
  const canReject = open && (receiver || mineRequest) && (step === 0 || signing);
  const actions = (
    <>
      {open && receiver && step === 0 && (
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
      {canReject && (
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
      )}
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
                {ch.no} · {c.no} · {kindLabel(c.kind)} · 요청 {fmtDateTime(ch.requestedAt)}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <Stepper ch={ch} />
          </div>
        </div>

        {/* 합의서 — 전자서명 단계부터 맨 위. 내용은 아래 요청 칸에 있어 요약을 다시 두지 않는다. 둘 다 서명하면 승인 · 서명본이 문서 관리에 */}
        {showSign && (
          <SectionCard title={`${ch.type === 'TERMINATE' ? '계약 해지' : '계약 변경'} 합의서`}>
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
        {ch.type !== 'TERMINATE' && (ch.stage || ch.status === 'APPROVED') && (
          <ChangeTermsCard
            key={`${ch.id}-${ch.stage ?? ''}`}
            ch={ch}
            c={c}
            onReject={() => {
              setReason('');
              setRejecting(true);
            }}
          />
        )}

        <SectionCard title={<Direction fromSpc={fromSpc} company={c.consumerCompanyName} />} actions={actions}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Info label="변경 유형" value={typeLabel} />
            <Info label="내용" value={changeText(ch, c.kind)} />
            <Info
              label={ch.type === 'TERMINATE' ? '희망 해지일' : '적용일'}
              value={ch.effectiveDate ?? (ch.type === 'TERM' ? ch.after : undefined)}
            />
            {ch.type === 'TERMINATE' && <Info label="계약 종료일" value={c.endDate} />}
            <Info label="사유" value={ch.reason} className="md:col-span-3" />
            {ch.status === 'REJECTED' && <Info label="반려 사유" value={ch.decisionNote} className="md:col-span-3" />}
          </div>
        </SectionCard>

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

        {/* 진행 이력 — 항상 아래 */}
        <SectionCard title="진행 이력">
          <EventTimeline events={ch.events ?? []} />
        </SectionCard>
      </div>

      {/* 협의 채팅 — 항상 오른쪽(서명 중에도 대화는 된다, 2026-10-13) */}
      <ChangeChat ch={ch} canSend={open && (role.isAdmin || isCompany)} />

      {/* 반려 — 거래와 같은 팝업. 사유 필수 */}
      <Modal open={rejecting} onClose={() => setRejecting(false)} title="요청 반려" size="sm">
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

type TermDraft = Record<'capacityKw' | 'termYears' | 'price' | 'installUnit' | 'extraCost' | 'omAnnual' | 'tariffPlan', string>;
const TERM_KEY: Record<string, keyof TermDraft> = {
  '설치 용량': 'capacityKw',
  '계약 기간': 'termYears',
  'PPA 단가': 'price',
  '설치 단가': 'installUnit',
  '추가 설치비용': 'extraCost',
  '연간 O&M': 'omAnnual',
  요금제: 'tariffPlan',
};
const LIM_KEY: Partial<Record<keyof TermDraft, TermLimKey>> = {
  capacityKw: 'capacityKw',
  termYears: 'termYears',
  price: 'price',
  installUnit: 'installUnit',
  extraCost: 'extraCost',
  omAnnual: 'omAnnual',
};
const MONEY_KEYS: (keyof TermDraft)[] = ['installUnit', 'extraCost', 'omAnnual'];
const toDraft = (t: ChangeTerms): TermDraft => ({
  capacityKw: String(t.capacityKw),
  termYears: String(t.termYears),
  price: t.unitPrice ? String(t.unitPrice) : '',
  installUnit: t.installUnit != null ? String(t.installUnit) : '',
  extraCost: String(t.extraCost ?? 0),
  omAnnual: t.omAnnual != null ? String(t.omAnnual) : '',
  tariffPlan: t.tariffPlan ?? '',
});
const totalOf = (t: ChangeTerms) => t.capacityKw * (t.installUnit ?? 0) + (t.extraCost ?? 0);

/**
 * 변경 조건 — 항목 · 현재 · 변경. 관리자는 조건 입력 단계에서 '변경' 칸을 고친다(지금 계약 값 + 요청 값으로 시작, 그대로 둘 칸은 그대로).
 * 저장 → 조건 확정 → 상대(기업) 조건 동의 → 전자서명. 확정 뒤엔 못 고치고 확정 취소로 다시 연다
 */
function ChangeTermsCard({ ch, c, onReject }: { ch: ContractChange; c: Contract; onReject: () => void }) {
  const role = useTradingRole();
  const addToast = useToastStore((s) => s.add);
  const save = useTradingPocStore((s) => s.saveChangeTerms);
  const confirmTerms = useTradingPocStore((s) => s.confirmChangeTerms);
  const unconfirmTerms = useTradingPocStore((s) => s.unconfirmChangeTerms);
  const agreeTerms = useTradingPocStore((s) => s.agreeChangeTerms);
  const ppa = c.kind === 'ONSITE';
  const open = ch.status === 'REQUESTED';
  const before = ch.termsBefore ?? changeTermsOf(c);
  const saved = ch.terms ?? changeTermsOf(c);
  const editing = role.isAdmin && open && ch.stage === 'TERMS';
  const isCompany = !role.isAdmin && role.companyId === c.consumerCompanyId;
  const [d, setD] = useState<TermDraft>(() => toDraft(saved));
  const n = (k: keyof TermDraft) => Number(d[k]) || 0;
  const draft: ChangeTerms = {
    capacityKw: n('capacityKw'),
    termYears: n('termYears'),
    unitPrice: ppa ? n('price') : 0,
    installUnit: n('installUnit'),
    extraCost: n('extraCost'),
    omAnnual: n('omAnnual'),
    tariffPlan: d.tariffPlan || undefined,
  };
  const dirty = JSON.stringify(toDraft(saved)) !== JSON.stringify(d);
  const lim = (k: keyof TermDraft) => TERM_LIM[LIM_KEY[k]!];
  const valid =
    inLim(n('capacityKw'), lim('capacityKw')) &&
    inLim(n('termYears'), lim('termYears')) &&
    inLim(n('installUnit'), lim('installUnit')) &&
    inLim(n('extraCost'), lim('extraCost')) &&
    inLim(n('omAnnual'), lim('omAnnual')) &&
    !!d.tariffPlan &&
    (!ppa || inLim(n('price'), lim('price')));
  const shown = editing ? draft : saved;
  const rows = termRows(c.kind, before, shown);
  const won = (v: number) => `₩${Math.round(v).toLocaleString('ko-KR')}`;
  const totalRow = { label: '설치비 (O&M 포함)', before: won(totalOf(before)), after: won(totalOf(shown)) };
  const changes = rows.filter((r) => r.changed);
  const note = changes.map((r) => `${r.label} ${r.before} → ${r.after}`).join(' · ') || '바뀐 조건 없음';

  const inputOf = (k: keyof TermDraft) =>
    k === 'tariffPlan' ? (
      <Select
        options={[{ value: '', label: '선택' }, ...Object.values(PLAN_LABEL).map((l) => ({ value: l, label: l }))]}
        value={d.tariffPlan}
        onChange={(e) => setD((p) => ({ ...p, tariffPlan: e.target.value }))}
      />
    ) : (
      <Input
        aria-label={k}
        inputMode={lim(k)[2] ? 'decimal' : 'numeric'}
        value={MONEY_KEYS.includes(k) && d[k] ? Number(d[k]).toLocaleString('ko-KR') : d[k]}
        error={d[k] !== '' && n(k) < lim(k)[0] ? `${lim(k)[0].toLocaleString('ko-KR')} 이상` : undefined}
        onChange={(e) => setD((p) => ({ ...p, [k]: numIn(e.target.value, lim(k)) }))}
      />
    );

  const state =
    ch.status === 'APPROVED'
      ? '승인 완료 · 계약에 반영'
      : ch.stage === 'TERMS'
        ? '조건 입력 중'
        : ch.stage === 'AGREE'
          ? '조건 확정 · 상대 조건 동의 대기'
          : '조건 동의 완료 · 전자서명';

  const actions = (
    <>
      {editing && (
        <>
          <Button size="sm" variant="secondary" disabled={!dirty} onClick={() => setD(toDraft(saved))}>
            취소
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!dirty || !valid}
            onClick={() => {
              save(ch.id, draft, note);
              addToast('success', `${ch.no} 조건 저장`);
            }}
          >
            저장
          </Button>
          <Button
            size="sm"
            disabled={dirty || !valid}
            onClick={() => {
              confirmTerms(ch.id);
              addToast('success', `${ch.no} 조건 확정 — 조건 동의 대기`);
            }}
          >
            조건 확정
          </Button>
        </>
      )}
      {role.isAdmin && open && ch.stage === 'AGREE' && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            unconfirmTerms(ch.id);
            addToast('success', `${ch.no} 확정 취소 — 조건 다시 입력`);
          }}
        >
          확정 취소
        </Button>
      )}
      {isCompany && open && ch.stage === 'AGREE' && (
        <>
          <Button
            size="sm"
            onClick={() => {
              agreeTerms(ch.id, role.party);
              addToast('success', `${ch.no} 조건 동의 — 전자서명 대기`);
            }}
          >
            조건 동의
          </Button>
          <Button size="sm" variant="danger" onClick={onReject}>
            반려
          </Button>
        </>
      )}
    </>
  );

  return (
    <SectionCard title="변경 조건" actions={actions}>
      <p className="mb-3 text-sm text-slate-300">
        진행 <span className="font-semibold text-white">{state}</span>
        <span className="ml-3 text-slate-400">바뀐 조건 {changes.length}개</span>
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-left text-slate-400">
            <th className="py-2 pr-3 font-medium">항목</th>
            <th className="py-2 pr-3 font-medium">현재</th>
            <th className="py-2 font-medium">변경</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={cn('border-b border-white/[0.04]', r.changed && 'bg-amber-500/[0.06]')}>
              <td className="py-2 pr-3 text-slate-400">
                {r.label}
                {editing && r.label !== '추가 설치비용' && <span className="ml-0.5 text-semantic-red">*</span>}
              </td>
              <td className="py-2 pr-3 tabular-nums text-slate-300">{r.before}</td>
              <td className={cn('py-2 tabular-nums', r.changed ? 'font-semibold text-amber-300' : 'text-slate-200')}>
                {editing ? (
                  <div className="flex items-center gap-2">
                    <div className={cn('w-full max-w-[240px] rounded', r.changed && 'ring-1 ring-amber-400/70')}>{inputOf(TERM_KEY[r.label]!)}</div>
                    {r.changed && <span className="shrink-0 text-xs font-semibold text-amber-300">변경</span>}
                  </div>
                ) : (
                  <>
                    {r.after}
                    {r.changed && <span className="ml-2 text-xs font-semibold text-amber-300">변경</span>}
                  </>
                )}
              </td>
            </tr>
          ))}
          <tr className={cn(totalRow.before !== totalRow.after && 'bg-amber-500/[0.06]')}>
            <td className="py-2 pr-3 text-slate-400">{totalRow.label}</td>
            <td className="py-2 pr-3 tabular-nums text-slate-300">{totalRow.before}</td>
            <td className={cn('py-2 tabular-nums', totalRow.before !== totalRow.after ? 'font-semibold text-amber-300' : 'text-slate-200')}>
              {totalRow.after}
            </td>
          </tr>
        </tbody>
      </table>
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
