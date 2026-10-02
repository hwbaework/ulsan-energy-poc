'use client';

import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { BackButton } from '@/components/layout/PageTitle';
import { Button } from '@/components/ui/Button';
import { DOC_CATEGORY_LABEL, settlementsOf } from '@/stores/useTradingPocStore';
import type { Contract, ContractChange, TradeDocument } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { CHANGE_TYPE, amountLabel, fmtDateTime, fmtKrw, fmtKw, fmtKwh, fmtPrice, kindLabel, priceLabel } from './meta';
import { CONTRACT_PDF, isContractDoc } from './DocumentsScreen';
import { changeText } from './ChangeDetailModal';

/** 파일명에서 정산월(YYYY-MM) — INV-2026-08-… · TX-2026-08-… · RPT-2026-08-… */
const periodOf = (d: TradeDocument) => d.fileName.match(/^(?:INV|TX|RPT)-(\d{4}-\d{2})-/)?.[1];

/** 문서 관리 › 문서 보기 — ?id=문서번호(&pdf=1 이면 열리자마자 PDF 저장). 계약서는 원문 PDF, 나머지는 A4 문서 */
export function DocumentViewScreen() {
  const role = useTradingRole();
  const sheet = useRef<HTMLDivElement>(null);
  const [params, setParams] = useState<{ id: number; pdf: boolean } | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setParams({ id: Number(p.get('id')), pdf: p.get('pdf') === '1' });
  }, []);

  const base = role.isAdmin ? '/platform/ppa/documents' : '/generator/ppa/documents';
  const doc = params ? role.documents.find((d) => d.id === params.id) : undefined;
  const contract = doc ? role.contracts.find((c) => c.id === doc.contractId) : undefined;
  const change = doc?.category === 'CHANGE' ? role.changes.find((ch) => doc.fileName.startsWith(ch.no)) : undefined;

  // PDF — A4 문서만 새 창에 옮겨 인쇄(PDF 저장)
  const pdf = () => {
    const html = sheet.current?.outerHTML;
    if (!html || !doc) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((el) => el.outerHTML).join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${doc.title}</title>${styles}<style>@page{size:A4;margin:12mm}body{background:#fff}</style></head><body>${html}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  };
  useEffect(() => {
    if (!params?.pdf || !doc || isContractDoc(doc)) return;
    const t = setTimeout(pdf, 600);
    return () => clearTimeout(t);
  }, [params, doc]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'RE100', path: '/re100' }, { label: '문서 관리', path: base }, { label: doc?.title ?? '문서' }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <BackButton href={base} label="문서 목록으로" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white">{doc?.title ?? '문서'}</h1>
            {doc && (
              <p className="mt-1.5 text-sm text-slate-400 tabular-nums">
                {[DOC_CATEGORY_LABEL[doc.category], doc.contractNo, doc.plantName, `발행일 ${doc.issuedAt}`].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
        {doc &&
          (isContractDoc(doc) ? (
            <a href={CONTRACT_PDF} download={`${doc.title}.pdf`}>
              <Button>
                <Download size={14} className="mr-1.5" /> 다운로드
              </Button>
            </a>
          ) : (
            <Button onClick={pdf}>
              <Download size={14} className="mr-1.5" /> PDF 저장
            </Button>
          ))}
      </div>

      {params && !doc ? (
        <div className="rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.06] p-10 text-center text-sm text-slate-400">문서를 찾을 수 없습니다</div>
      ) : doc && isContractDoc(doc) ? (
        <iframe title={doc.title} src={`${CONTRACT_PDF}#view=FitH`} className="aspect-[210/297] w-full rounded-xl bg-white" />
      ) : doc ? (
        <div ref={sheet} className="mx-auto aspect-[210/297] w-full max-w-[900px] bg-white px-14 py-14 text-slate-900">
          <p className="text-xs tracking-widest text-slate-500">울산 에너지 자급자족 플랫폼</p>
          <h2 className="mt-3 text-2xl font-bold">{DOC_CATEGORY_LABEL[doc.category]}</h2>
          <p className="mt-1 text-sm text-slate-500 tabular-nums">
            {doc.contractNo} · 발행일 {doc.issuedAt}
          </p>
          <div className="mt-10">{contract && <SheetBody doc={doc} contract={contract} change={change} />}</div>
        </div>
      ) : null}
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

/** 문서 본문 — 분류별. 금액은 정산(계약 단가 × 발전·공급량)에서 */
function SheetBody({ doc, contract: c, change }: { doc: TradeDocument; contract: Contract; change?: ContractChange }) {
  const period = periodOf(doc);
  const s = period ? settlementsOf([c]).find((x) => x.period === period) : undefined;
  const parties: [string, string][] = [
    ['공급자 (발전사업자)', c.generatorCompanyName],
    ['공급받는자 (수용가)', c.consumerCompanyName],
    ['사업장', c.siteName],
    ['주소', c.address],
  ];

  if (doc.category === 'INVOICE' || doc.category === 'TAX') {
    return (
      <div className="space-y-10">
        <Rows rows={[...parties, ['계약 유형', kindLabel(c.kind)], ['발전소', c.plantName]]} />
        <Rows
          rows={[
            ['정산월', period],
            [c.kind === 'ONSITE' ? '공급량' : '발전량', s ? fmtKwh(s.generationKwh) : undefined],
            [priceLabel(c.kind), fmtPrice(c.unitPrice)],
            [doc.category === 'TAX' ? '공급가액' : amountLabel(c.kind), s ? fmtKrw(s.supplyAmount) : undefined],
            [doc.category === 'TAX' ? '세액' : '부가세', s ? fmtKrw(s.vat) : undefined],
            ['합계', s ? fmtKrw(s.total) : undefined],
          ]}
        />
        {doc.category === 'INVOICE' && <Rows rows={[['납부 기한', '매월 25일 고지 · 고지 후 영업일 내 납부']]} />}
      </div>
    );
  }
  if (doc.category === 'REPORT') {
    return (
      <div className="space-y-10">
        <Rows rows={[['발전소', c.plantName], ['설비 용량', fmtKw(c.capacityKw)], ['수용가', c.consumerCompanyName], ['운영 관리', c.generatorCompanyName]]} />
        <Rows rows={[['보고 기간', period], ['발전량', s ? fmtKwh(s.generationKwh) : undefined], ['kW당 발전량', s ? `${(s.generationKwh / c.capacityKw).toFixed(1)} kWh/kW` : undefined], [amountLabel(c.kind), s ? fmtKrw(s.supplyAmount) : undefined]]} />
      </div>
    );
  }
  // 변경·해지 합의서
  return (
    <div className="space-y-10">
      <Rows rows={[...parties, ['계약번호', c.no], ['계약 유형', kindLabel(c.kind)]]} />
      {change && (
        <Rows
          rows={[
            ['변경 유형', CHANGE_TYPE[change.type]],
            ['내용', changeText(change)],
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
