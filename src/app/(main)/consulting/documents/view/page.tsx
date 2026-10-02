'use client';

import { BackButton } from '@/components/layout/PageTitle';
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { useConsultingDocs } from '@/hooks/consulting/useConsultingDocs';

/** 컨설팅 › 문서관리 › 결과보고서 보기 — ?id=문서번호. 실제 보고서 PDF 를 페이지 안에서 그대로 */
export default function ConsultingDocumentViewPage() {
  const { docs, isLoading } = useConsultingDocs();
  const [id, setId] = useState<number | null>(null);

  useEffect(() => {
    setId(Number(new URLSearchParams(window.location.search).get('id')));
  }, []);

  const doc = id !== null ? docs.find((d) => d.id === id) : undefined;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'RE100', path: '/re100' }, { label: '문서관리', path: '/consulting/documents' }, { label: doc?.title ?? '문서' }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <BackButton href="/consulting/documents" label="문서 목록으로" />
          <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">{doc?.title ?? '문서'}</h1>
          {doc && (
            <p className="mt-1.5 text-sm text-slate-400 tabular-nums">
              {[doc.companyName, doc.plantName, doc.contractNo, `발행일 ${doc.issuedAt}`, `${doc.pages}쪽`].filter(Boolean).join(' · ')}
            </p>
          )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {doc && (
            <a href={doc.pdf} download={`${doc.title}.pdf`}>
              <Button>
                <Download size={14} className="mr-1.5" /> 다운로드
              </Button>
            </a>
          )}
        </div>
      </div>
      {id !== null && !isLoading && !doc ? (
        <div className="rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.06] p-10 text-center text-sm text-slate-400">문서를 찾을 수 없습니다</div>
      ) : doc ? (
        <iframe title={doc.title} src={`${doc.pdf}#view=FitH`} className="aspect-[210/297] w-full rounded-xl bg-white" />
      ) : null}
    </div>
  );
}
