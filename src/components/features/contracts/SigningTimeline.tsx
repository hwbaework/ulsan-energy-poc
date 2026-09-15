'use client';

import { CheckCircle2, Clock, FileSignature } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useContractDocuments } from '@/hooks/ppa/usePpa';
import { useSignatureStatus } from '@/hooks/useContractSignature';

interface StepState {
  label: string;
  desc: string;
  done: boolean;
  at?: string;
}

/* 계약 체결 타임라인 — SPC 발행 → 발전사 서명 → 수용가 서명 → 계약 발효
 * useContractDocuments + useSignatureStatus 실데이터 기반. 3 페르소나 공용. */
export function SigningTimeline({ contractId, contractStatus }: { contractId: number; contractStatus?: string }) {
  const { data: documents } = useContractDocuments(contractId);
  const { data: sigStatus } = useSignatureStatus('PPA', contractId);

  const doc = (documents ?? [])[0] as any;
  const signatures: any[] = (sigStatus as any)?.signatures ?? [];
  const genSig = signatures.find((s) => s.signerRole === 'GENERATOR');
  const consSig = signatures.find((s) => s.signerRole === 'CONSUMER');
  const active = contractStatus === 'ACTIVE';

  const fmt = (v?: string) =>
    v ? new Date(v).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : undefined;

  const steps: StepState[] = [
    { label: 'SPC 계약서 발행', desc: '매칭 조건으로 계약서(PDF) 발행', done: !!doc, at: fmt(doc?.createdAt) },
    { label: '발전사 전자서명', desc: '발전사 계약 동의·서명', done: !!genSig, at: fmt(genSig?.signedAt) },
    { label: '수용가 전자서명', desc: '수용가 계약 동의·서명', done: !!consSig, at: fmt(consSig?.signedAt) },
    { label: '계약 발효', desc: '양측 서명 완료 — 효력 발생', done: active },
  ];
  const currentIdx = steps.findIndex((s) => !s.done);

  return (
    <div className="space-y-0">
      {steps.map((s, i) => {
        const state = s.done ? 'done' : i === currentIdx ? 'current' : 'upcoming';
        const isLast = i === steps.length - 1;
        return (
          <div key={s.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 text-[11px] font-bold',
                  state === 'done'
                    ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40'
                    : state === 'current'
                      ? 'bg-primary/15 text-primary ring-primary/40'
                      : 'bg-white/[0.03] text-slate-500 ring-white/[0.1]',
                )}
              >
                {state === 'done' ? (
                  <CheckCircle2 size={14} />
                ) : state === 'current' ? (
                  <FileSignature size={13} />
                ) : (
                  i + 1
                )}
              </span>
              {!isLast && <span className={cn('w-px flex-1 my-1', s.done ? 'bg-emerald-500/30' : 'bg-white/[0.08]')} />}
            </div>
            <div className={cn('pb-4', isLast && 'pb-0')}>
              <div className="flex items-center gap-2">
                <p className={cn('text-sm font-medium', state === 'upcoming' ? 'text-slate-500' : 'text-white')}>
                  {s.label}
                </p>
                {state === 'current' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary ring-1 ring-primary/30">
                    <Clock size={9} /> 진행 중
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{s.desc}</p>
              {s.at && <p className="text-[11px] text-slate-400 tabular-nums mt-0.5">{s.at}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
