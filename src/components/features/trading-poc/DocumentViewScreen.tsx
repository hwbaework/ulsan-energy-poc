'use client';

import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { BackButton } from '@/components/layout/PageTitle';
import { Button } from '@/components/ui/Button';
import { DOC_CATEGORY_LABEL } from '@/stores/useTradingPocStore';
import { useTradingRole } from './useTradingRole';
import { CONTRACT_PDF, docsBase, isContractDoc } from './DocumentsScreen';
import { DocumentSheet, periodOf, printSheet } from './DocumentSheet';
import { BillingPaper } from './BillingPaper';

/** 문서 관리 › 문서 보기 — ?id=문서번호(&pdf=1 이면 열리자마자 PDF 저장). 계약서는 원문 PDF, 청구서·세금계산서·합의서는 A4 문서 */
export function DocumentViewScreen() {
  const role = useTradingRole();
  const sheet = useRef<HTMLDivElement>(null);
  const [params, setParams] = useState<{ id: number; pdf: boolean } | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setParams({ id: Number(p.get('id')), pdf: p.get('pdf') === '1' });
  }, []);

  const base = docsBase(role.isAdmin);
  const doc = params ? role.documents.find((d) => d.id === params.id) : undefined;
  const contract = doc ? role.contracts.find((c) => c.id === doc.contractId) : undefined;
  // 뒤로 — 그 기업 문서 목록
  const companyHref = contract ? `${base}?company=${contract.consumerCompanyId}` : base;
  // 청구서 · 세금계산서 — 양식 문서(미리보기 + PDF)
  const billing = doc && (doc.category === 'TAX' || doc.category === 'INVOICE') ? periodOf(doc) : undefined;
  const change = doc?.category === 'CHANGE' ? role.changes.find((ch) => doc.fileName.startsWith(ch.no)) : undefined;

  useEffect(() => {
    if (!params?.pdf || !doc || isContractDoc(doc) || billing) return;
    const t = setTimeout(() => printSheet(sheet.current, doc.title), 600);
    return () => clearTimeout(t);
  }, [params, doc, billing]);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'RE100', path: '/re100' },
          { label: '문서 관리', path: base },
          ...(contract ? [{ label: contract.consumerCompanyName, path: companyHref }] : []),
          { label: doc?.title ?? '문서' },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <BackButton href={companyHref} label="문서 목록으로" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white">{doc?.title ?? '문서'}</h1>
            {doc && (
              <p className="mt-1.5 text-sm text-slate-400 tabular-nums">
                {[
                  DOC_CATEGORY_LABEL[doc.category],
                  doc.contractNo,
                  contract?.consumerCompanyName,
                  `발행일 ${doc.issuedAt}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
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
          ) : billing ? null : (
            <Button onClick={() => printSheet(sheet.current, doc.title)}>
              <Download size={14} className="mr-1.5" /> PDF 저장
            </Button>
          ))}
      </div>

      {params && !doc ? (
        <div className="rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.06] p-10 text-center text-sm text-slate-400">
          문서를 찾을 수 없습니다
        </div>
      ) : doc && isContractDoc(doc) ? (
        <iframe
          title={doc.title}
          src={`${CONTRACT_PDF}#view=FitH`}
          className="aspect-[210/297] w-full rounded-xl bg-white"
        />
      ) : doc && contract && billing ? (
        <BillingPaper
          kind={doc.category === 'TAX' ? 'TAX' : 'INVOICE'}
          contract={contract}
          period={billing}
          admin={role.isAdmin}
          autoPdf={params?.pdf}
        />
      ) : doc && contract ? (
        <DocumentSheet doc={doc} contract={contract} change={change} sheetRef={sheet} />
      ) : null}
    </div>
  );
}
