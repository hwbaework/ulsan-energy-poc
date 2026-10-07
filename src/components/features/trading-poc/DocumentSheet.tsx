'use client';

import type { Ref } from 'react';
import {
  CO,
  DOC_CATEGORY_LABEL,
  billingStatusOf,
  dueDateOf,
  issueDateOf,
  settlementsOf,
  writtenDateOf,
} from '@/stores/useTradingPocStore';
import type { Contract, ContractChange, TradeDocument } from '@/types/trading-poc';
import { changeTypeLabel, fmtDateTime, fmtKw, fmtKwh, fmtNum, kindLabel } from './meta';
import { changeText } from './ChangeDetailModal';

const won = (n: number) => `₩${fmtNum(Math.round(n))}`;
/** 파일명에서 정산월(YYYY-MM) — INV-2026-08-… · TX-2026-08-… */
export const periodOf = (d: Pick<TradeDocument, 'fileName'>) => d.fileName.match(/^(?:INV|TX)-(\d{4}-\d{2})-/)?.[1];
export const BILLING_LABEL = { PAID: '납부 완료', BILLED: '납부 대기' } as const;

/** 정산월 문서(청구서·세금계산서)를 화면에서 바로 만든다 — 달이 끝나고 발행된 달만 */
export function billingDoc(category: 'INVOICE' | 'TAX', c: Contract, period: string): TradeDocument {
  return {
    id: -1,
    category,
    title: `${period} ${DOC_CATEGORY_LABEL[category]} — ${c.consumerCompanyName}`,
    fileName: `${category === 'INVOICE' ? 'INV' : 'TX'}-${period}-${c.no}.pdf`,
    contractId: c.id,
    contractNo: c.no,
    plantName: c.plantName,
    partyCompanyIds: [c.generatorCompanyId, c.consumerCompanyId],
    issuedAt: issueDateOf(period),
    fileType: 'PDF',
    sizeKb: 0,
  };
}

/** 문서만 새 창에 옮겨 인쇄(PDF 저장) */
export function printSheet(el: HTMLElement | null, title: string) {
  if (!el) return;
  const w = window.open('', '_blank');
  if (!w) return;
  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((x) => x.outerHTML).join('');
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${styles}<style>@page{size:A4;margin:12mm}body{background:#fff}</style></head><body>${el.outerHTML}</body></html>`,
  );
  w.document.close();
  setTimeout(() => w.print(), 600);
}

/**
 * A4 문서 — 청구서 · 세금계산서(onsite) · 변경·해지 합의서. 문서 관리 · 세금계산서 · 청구서 화면이 같은 모양을 쓴다.
 * 공급자 = 플랫폼(SPC), 품목 = 전력 사용(사용량 × 그 구간 단가)
 */
export function DocumentSheet({
  doc,
  contract: c,
  change,
  sheetRef,
}: {
  doc: TradeDocument;
  contract: Contract;
  change?: ContractChange;
  sheetRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={sheetRef} className="mx-auto aspect-[210/297] w-full max-w-[900px] bg-white px-14 py-14 text-slate-900">
      <p className="text-xs tracking-widest text-slate-500">울산 에너지 자급자족 플랫폼</p>
      <h2 className="mt-3 text-2xl font-bold">{DOC_CATEGORY_LABEL[doc.category]}</h2>
      <p className="mt-1 text-sm text-slate-500 tabular-nums">발행일 {doc.issuedAt}</p>
      <div className="mt-10">
        <SheetBody doc={doc} contract={c} change={change} />
      </div>
    </div>
  );
}

function Rows({ rows }: { rows: [string, string | undefined][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-10 gap-y-3 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 border-b border-slate-200 pb-2">
          <dt className="text-slate-500">{k}</dt>
          <dd className="text-right font-medium tabular-nums">{v ?? ''}</dd>
        </div>
      ))}
    </dl>
  );
}

function SheetBody({ doc, contract: c, change }: { doc: TradeDocument; contract: Contract; change?: ContractChange }) {
  const parties: [string, string][] = [
    ['공급자', CO.SPC.name],
    ['공급받는자', c.consumerCompanyName],
    ['기업 주소', c.address],
  ];

  if (doc.category === 'INVOICE' || doc.category === 'TAX') {
    const period = periodOf(doc);
    const s = period ? settlementsOf([c]).find((x) => x.period === period) : undefined;
    return (
      <div className="space-y-10">
        <Rows
          rows={[
            ['공급자', CO.SPC.name],
            ['공급받는자', c.consumerCompanyName],
            ['기업 주소', c.address],
            ['발전소', c.plantName],
          ]}
        />
        <Rows
          rows={[
            ['기간', period],
            ['품목', '전력 사용'],
            ['공급량', s ? fmtKwh(s.generationKwh) : undefined],
            ['단가', s ? `₩${fmtNum(s.smpUnitPrice, 1)}/kWh` : undefined],
            ['공급가액', s ? won(s.supplyAmount) : undefined],
            [doc.category === 'TAX' ? '세액 (10%)' : '부가세 (10%)', s ? won(s.vat) : undefined],
            ['합계', s ? won(s.total) : undefined],
          ]}
        />
        {period && (
          <Rows
            rows={[
              ['작성일', writtenDateOf(period)],
              ['발행일', issueDateOf(period)],
              ...(doc.category === 'INVOICE'
                ? ([
                    ['납부 기한', dueDateOf(period)],
                    ['상태', BILLING_LABEL[billingStatusOf(period)]],
                  ] as [string, string][])
                : []),
            ]}
          />
        )}
      </div>
    );
  }
  // 변경·해지 합의서
  return (
    <div className="space-y-10">
      <Rows rows={[...parties, ['계약 유형', kindLabel(c.kind)], ['설치 용량', fmtKw(c.capacityKw)]]} />
      {change && (
        <Rows
          rows={[
            ['변경 유형', changeTypeLabel(change.type, c.kind)],
            ['내용', changeText(change, c.kind)],
            ['요청', `${change.requestedByName} · ${fmtDateTime(change.requestedAt)}`],
            ['승인', fmtDateTime(change.decidedAt)],
            ['사유', change.reason],
            ['처리 의견', change.decisionNote],
          ]}
        />
      )}
    </div>
  );
}
