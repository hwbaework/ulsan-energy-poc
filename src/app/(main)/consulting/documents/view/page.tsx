'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { useConsultingDocs } from '@/hooks/consulting/useConsultingDocs';

/** 컨설팅 › 문서관리 › 결과보고서 보기 — ?id=문서번호. 실제 보고서 PDF 를 페이지 안에서 그대로 */
export default function ConsultingDocumentViewPage() {
  const router = useRouter();
  const { docs, isLoading } = useConsultingDocs();
  const [id, setId] = useState<number | null>(null);

  useEffect(() => {
    setId(Number(new URLSearchParams(window.location.search).get('id')));
  }, []);

  const doc = id !== null ? docs.find((d) => d.id === id) : undefined;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'RE100', path: '/re100' }, { label: '문서관리', path: '/consulting/documents' }, { label: doc?.title ?? '문서' }]} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{doc?.title ?? '문서'}</h1>
          {doc && (
            <p className="mt-1.5 text-sm text-slate-400 tabular-nums">
              {doc.companyName} · {doc.contracts.map((c) => `${c.no} ${c.plant}`).join(' / ')} · 발행일 {doc.issuedAt} · {doc.pages}쪽
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => router.push('/consulting/documents')}>
            <ArrowLeft size={14} className="mr-1.5" /> 목록
          </Button>
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
        <iframe title={doc.title} src={doc.pdf} className="h-[calc(100vh-240px)] min-h-[600px] w-full rounded-xl bg-white" />
      ) : null}
    </div>
  );
}
