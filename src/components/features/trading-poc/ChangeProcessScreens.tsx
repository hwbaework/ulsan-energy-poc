'use client';

import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { SectionCard } from '@/components/features/SectionCard';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { BackButton } from '@/components/layout/PageTitle';
import { ContractSignature } from '@/components/features/ContractSignature';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { CO, useTradingPocStore } from '@/stores/useTradingPocStore';
import type { ChangeSign, Contract, ContractChange } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { changeTypeLabel, fmtDateTime, kindLabel } from './meta';
import { EventTimeline, Info, StepBar } from './Bits';
import { changeText } from './ChangeDetailModal';

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
      <span className="font-semibold text-white">{fromSpc ? 'SPC' : company}</span>
      <span className="text-slate-500">→</span>
      <span className="font-semibold text-white">{fromSpc ? company : 'SPC'}</span>
    </div>
  );
}

/* ══ 변경·해지 한 건 — 신청 → 승인(받는 쪽, 곧 합의) → 서명(양쪽) → 반영. 요청 내용 · 합의서 · 진행 이력, 옆에 채팅. 팝업 없음 ══ */
const STEPS = ['신청', '승인', '서명', '반영'] as const;
/** 지금 단계 — 1 승인 대기 · 2 서명 · 3 반영(끝) */
const stepOf = (ch: ContractChange) => (ch.status === 'APPROVED' ? 3 : ch.stage === 'SIGN' ? 2 : 1);

/** 단계 — 거래 이력과 같은 표시줄. 서명 단계는 몇 명 서명했는지 */
function Stepper({ ch }: { ch: ContractChange }) {
  const failed = ch.status === 'REJECTED' ? '반려' : ch.status === 'CANCELLED' ? '취소' : undefined;
  const signed = Number(!!ch.spcSign) + Number(!!ch.companySign);
  // 반영되면 모두 끝(마지막도 체크)
  const step = ch.status === 'APPROVED' ? STEPS.length : stepOf(ch);
  return (
    <StepBar
      steps={STEPS}
      step={step}
      failed={failed}
      labelOf={(label, i) => (i === 2 && ch.stage === 'SIGN' ? `서명 ${signed}/2` : label)}
    />
  );
}

/** 서명 칸 — 서명이 있으면 서명, 내 차례면 서명 패드, 아니면 대기 */
function SignBox({
  title,
  sign,
  mine,
  signerName,
  summary,
  onSign,
}: {
  title: string;
  sign?: ChangeSign;
  mine: boolean;
  signerName: string;
  summary: string[];
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
          <p className="text-sm text-emerald-400">
            서명 완료 <span className="tabular-nums text-slate-400">· {fmtDateTime(sign.at)}</span>
          </p>
        </div>
      ) : mine ? (
        <ContractSignature
          contractTitle="합의 내용"
          contractSummary={summary}
          signerName={signerName}
          onSign={(x) => onSign({ at: localNow(), name: signerName, image: x.image })}
        />
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
  const move = useTradingPocStore((s) => s.moveChangeStage);
  const signChange = useTradingPocStore((s) => s.signChange);
  const reject = useTradingPocStore((s) => s.rejectChange);
  const cancel = useTradingPocStore((s) => s.cancelChange);
  const [confirm, setConfirm] = useState<'cancel' | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const open = ch.status === 'REQUESTED';
  const step = stepOf(ch);
  const isCompany = !role.isAdmin && role.companyId === c.consumerCompanyId;
  const fromSpc = ch.requestedBy === 'spc';
  const mineRequest = role.isAdmin ? fromSpc : !fromSpc && isCompany;
  /** 받는 쪽 — 기업이 신청하면 SPC, SPC 가 신청하면 그 기업. 받는 쪽이 승인(곧 합의) · 반려 */
  const receiver = role.isAdmin ? !fromSpc : fromSpc && isCompany;
  const typeLabel = changeTypeLabel(ch.type, c.kind);

  const summary = [
    `${c.no} · ${c.consumerCompanyName} · ${kindLabel(c.kind)}`,
    `${typeLabel}: ${changeText(ch, c.kind)}`,
    ...(ch.effectiveDate ? [`${ch.type === 'TERMINATE' ? '해지일' : '적용일'}: ${ch.effectiveDate}`] : []),
    `사유: ${ch.reason}`,
  ];

  const actions = (
    <>
      {open && receiver && step === 1 && (
        <>
          <Button size="sm" onClick={() => move(ch.id, 'SIGN', undefined, role.party)}>
            승인
          </Button>
          <Button size="sm" variant="danger" onClick={() => setRejecting(true)}>
            반려
          </Button>
        </>
      )}
      {open && mineRequest && step === 1 && (
        <Button size="sm" variant="danger" onClick={() => setConfirm('cancel')}>
          신청 취소
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

        <SectionCard title={<Direction fromSpc={fromSpc} company={c.consumerCompanyName} />} actions={actions}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Info label="변경 유형" value={typeLabel} />
            <Info label="내용" value={changeText(ch, c.kind)} />
            <Info
              label={ch.type === 'TERMINATE' ? '희망 해지일' : '적용일'}
              value={ch.effectiveDate ?? (ch.type === 'TERM' ? ch.after : undefined)}
            />
            <Info label="사유" value={ch.reason} className="md:col-span-3" />
            {ch.status === 'REJECTED' && <Info label="반려 사유" value={ch.decisionNote} className="md:col-span-3" />}
          </div>
          {rejecting && (
            <div className="mt-4 space-y-3 rounded-lg bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
              <Textarea
                label="반려 사유"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => setRejecting(false)}>
                  취소
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={!reason.trim()}
                  onClick={() => {
                    reject(ch.id, reason.trim());
                    addToast('success', `${ch.no} 반려`);
                    setRejecting(false);
                  }}
                >
                  반려
                </Button>
              </div>
            </div>
          )}
        </SectionCard>

        {/* 합의서 — 서로 확인했다는 서명. 둘 다 서명하면 계약 반영 · 서명본이 문서 관리에 */}
        {(step >= 2 || ch.spcSign || ch.companySign) && (
          <SectionCard title={`${ch.type === 'TERMINATE' ? '계약 해지' : '계약 변경'} 합의서`}>
            <div className="space-y-4">
              <ul className="space-y-1 rounded-lg bg-white/[0.02] p-4 text-sm text-slate-300 ring-1 ring-white/[0.06]">
                {summary.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <div className="grid gap-4 md:grid-cols-2">
                <SignBox
                  title={`SPC · ${CO.SPC.name}`}
                  sign={ch.spcSign}
                  mine={role.isAdmin && open && step === 2}
                  signerName={CO.SPC.name}
                  summary={summary}
                  onSign={(s) => {
                    signChange(ch.id, 'spc', s);
                    addToast('success', `${ch.no} SPC 서명`);
                  }}
                />
                <SignBox
                  title={`기업 · ${c.consumerCompanyName}`}
                  sign={ch.companySign}
                  mine={isCompany && open && step === 2}
                  signerName={c.consumerCompanyName}
                  summary={summary}
                  onSign={(s) => {
                    signChange(ch.id, 'company', s);
                    addToast('success', `${ch.no} ${c.consumerCompanyName} 서명`);
                  }}
                />
              </div>
            </div>
          </SectionCard>
        )}

        <SectionCard title="진행 이력">
          <EventTimeline events={ch.events ?? []} />
        </SectionCard>
      </div>

      <ChangeChat ch={ch} canSend={open && (role.isAdmin || isCompany)} />

      <ConfirmDialog
        open={confirm === 'cancel'}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          cancel(ch.id);
          addToast('success', `${ch.no} 신청 취소`);
          setConfirm(null);
        }}
        title="신청 취소"
        message={`${ch.no} 요청을 취소합니다.`}
        confirmLabel="신청 취소"
        variant="danger"
      />
    </div>
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
