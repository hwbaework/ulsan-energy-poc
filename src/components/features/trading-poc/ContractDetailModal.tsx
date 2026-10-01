'use client';

import Link from 'next/link';
import { CheckCircle2, Circle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { DOC_CATEGORY_LABEL, settlementsOf } from '@/stores/useTradingPocStore';
import type { Contract, ContractChange, TradeDocument } from '@/types/trading-poc';
import { CHANGE_TYPE, amountLabel, daysLeft, fmtDate, fmtDateTime, fmtKrw, fmtKw, fmtKwh, fmtPrice, kindLabel, priceLabel } from './meta';
import { ChangeStatusPill, ContractStatusPill, Info, ModalFooter } from './Bits';

interface Props {
  contract: Contract | null;
  onClose: () => void;
  changes: ContractChange[];
  documents: TradeDocument[];
  /** 발전사업자(운영 중 계약)에게만 변경·해지 버튼 */
  canRequestChange: boolean;
  onRequestChange?: (contract: Contract, type?: 'TERMINATE') => void;
}

/** 계약 상세 — 계약 정보 · 서명 현황 · 최근 정산 · 변경·해지 이력 · 문서 */
export function ContractDetailModal({ contract: c, onClose, changes, documents, canRequestChange, onRequestChange }: Props) {
  const recent = c ? settlementsOf([c]).filter((s) => s.status === 'CONFIRMED').slice(-3).reverse() : [];
  const myChanges = c ? changes.filter((ch) => ch.contractId === c.id) : [];
  const myDocs = c ? documents.filter((d) => d.contractId === c.id).slice(0, 6) : [];
  const left = c ? daysLeft(c.endDate) : 0;

  return (
    <Modal open={!!c} onClose={onClose} title="계약 상세" size="lg">
      {c && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-white">
                {c.no} · {c.plantName}
              </p>
              <p className="text-sm text-slate-400">
                {kindLabel(c.kind)} · {c.generatorCompanyName} → {c.consumerCompanyName}
              </p>
            </div>
            <ContractStatusPill status={c.status} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Info label="계약 유형" value={kindLabel(c.kind)} />
            <Info label="발전사업자" value={c.generatorCompanyName} />
            <Info label="수용가" value={c.consumerCompanyName} />
            <Info label="사업장" value={c.siteName} />
            <Info label="주소" value={c.address} className="col-span-2" />
            <Info label="설비 용량" value={fmtKw(c.capacityKw)} />
            <Info label={priceLabel(c.kind)} value={fmtPrice(c.unitPrice)} />
            <Info label="계약 기간" value={`${c.termYears}년`} />
            <Info label="시작일" value={c.startDate} />
            <Info label="종료일" value={c.status === 'TERMINATED' ? `${c.terminatedAt} (해지)` : `${c.endDate} (${left > 0 ? `${left.toLocaleString()}일 남음` : '만료'})`} />
            <Info label="체결일" value={fmtDateTime(c.signedAt)} />
          </div>

          {/* 서명 현황 */}
          <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-3">
            <p className="text-sm text-slate-400 mb-2">전자서명</p>
            <div className="flex flex-wrap gap-6">
              {[
                { label: `발전사업자 · ${c.generatorCompanyName}`, done: c.signedByGenerator },
                { label: `수용가 · ${c.consumerCompanyName}`, done: c.signedByConsumer },
              ].map((s) => (
                <span key={s.label} className={`inline-flex items-center gap-1.5 text-sm ${s.done ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {s.done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                  {s.label} {s.done ? '서명 완료' : '서명 대기'}
                </span>
              ))}
            </div>
          </div>

          {/* 최근 정산 3개월 */}
          <div>
            <p className="text-sm text-slate-400 mb-2">최근 정산</p>
            {recent.length === 0 ? (
              <p className="text-sm text-slate-500">정산 없음</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 border-b border-white/[0.06]">
                    <th className="py-1.5 text-left font-medium">월</th>
                    <th className="py-1.5 text-left font-medium">{c.kind === 'ONSITE' ? '공급량' : '발전량'}</th>
                    <th className="py-1.5 text-left font-medium">{amountLabel(c.kind)}</th>
                    <th className="py-1.5 text-left font-medium">부가세</th>
                    <th className="py-1.5 text-left font-medium">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((s) => (
                    <tr key={s.id} className="border-b border-white/[0.04] text-slate-300 tabular-nums">
                      <td className="py-1.5">{s.period}</td>
                      <td className="py-1.5">{fmtKwh(s.generationKwh)}</td>
                      <td className="py-1.5">{fmtKrw(s.supplyAmount)}</td>
                      <td className="py-1.5">{fmtKrw(s.vat)}</td>
                      <td className="py-1.5 text-white">{fmtKrw(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 변경·해지 이력 */}
          <div>
            <p className="text-sm text-slate-400 mb-2">변경·해지</p>
            {myChanges.length === 0 ? (
              <p className="text-sm text-slate-500">신청 없음</p>
            ) : (
              <ul className="space-y-1.5">
                {myChanges.map((ch) => (
                  <li key={ch.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-300">
                      {ch.no} · {CHANGE_TYPE[ch.type]}
                      {ch.before && ch.after ? ` · ${ch.before} → ${ch.after}` : ch.effectiveDate ? ` · ${ch.effectiveDate}` : ''}
                      <span className="text-slate-500"> · {fmtDate(ch.requestedAt)}</span>
                    </span>
                    <ChangeStatusPill status={ch.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 문서 */}
          <div>
            <p className="text-sm text-slate-400 mb-2">문서</p>
            {myDocs.length === 0 ? (
              <p className="text-sm text-slate-500">문서 없음</p>
            ) : (
              <ul className="space-y-1.5">
                {myDocs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-300 truncate">
                      {d.title} <span className="text-slate-500">· {DOC_CATEGORY_LABEL[d.category]}</span>
                    </span>
                    <span className="text-slate-500 tabular-nums shrink-0">{d.issuedAt}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ModalFooter>
            {c.requestId && (
              <Link href={`/trading/deal/${c.requestId}`} className="mr-auto">
                <Button variant="ghost">거래 진행 보기</Button>
              </Link>
            )}
            <Button variant="secondary" onClick={onClose}>
              닫기
            </Button>
            {canRequestChange && c.status === 'ACTIVE' && (
              <>
                <Button variant="danger" onClick={() => onRequestChange?.(c, 'TERMINATE')}>
                  해지 신청
                </Button>
                <Button onClick={() => onRequestChange?.(c)}>변경 신청</Button>
              </>
            )}
          </ModalFooter>
        </div>
      )}
    </Modal>
  );
}
