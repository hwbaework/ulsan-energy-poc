'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileText } from 'lucide-react';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAuthStore } from '@/stores/useAuthStore';
import { getPersona, usePersonaOverride } from '@/lib/persona';
import { CONSULTING_DOCS, type ConsultingDoc } from '@/lib/consulting-docs';
import { cell, cellMuted, cellNum } from '@/components/features/trading-poc/Bits';

/**
 * 컨설팅 › 문서관리 — 컨설팅 결과보고서만. 전기사용자는 우리 회사, 관리자는 모든 회사(업체 셀렉트).
 * 보고서는 기업당 하나(onsite · 자가소비 계약을 함께) — 계약번호·발전소 칸에 둘 다. 행을 누르면 보고서 페이지(/consulting/documents/view?id=)에서 PDF 를 본다. [다운]은 PDF 파일 저장.
 */
export function ConsultingDocuments() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const override = usePersonaOverride((s) => s.override);
  const isAdmin = (override ?? getPersona(user)) === 'admin';
  const companyId = user?.companyId ?? 0;

  const [company, setCompany] = useState('all');
  const [q, setQ] = useState('');

  const docs = useMemo(() => (isAdmin ? CONSULTING_DOCS : CONSULTING_DOCS.filter((d) => d.companyId === companyId)), [isAdmin, companyId]);
  const companies = useMemo(() => [...new Set(docs.map((d) => d.companyName))], [docs]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return docs.filter((d) => (company === 'all' || d.companyName === company) && (!s || d.title.toLowerCase().includes(s)));
  }, [docs, company, q]);
  const view = (d: ConsultingDoc) => router.push(`/consulting/documents/view?id=${d.id}`);

  const columns: Column<ConsultingDoc>[] = [
    {
      key: 'title',
      header: '문서명',
      render: (d) => (
        <span className="flex items-center gap-2 text-sm text-white">
          <FileText size={15} className="shrink-0 text-slate-500" />
          {d.title}
        </span>
      ),
    },
    { key: 'category', header: '분류', width: '120px', render: (d) => cell(d.category) },
    ...(isAdmin ? [{ key: 'company', header: '업체', width: '150px', render: (d: ConsultingDoc) => cell(d.companyName) }] : []),
    { key: 'contract', header: '계약번호', width: '150px', render: (d) => <div className="space-y-0.5">{d.contracts.map((c) => <div key={c.no}>{cellNum(c.no)}</div>)}</div> },
    { key: 'plant', header: '발전소', width: '180px', render: (d) => <div className="space-y-0.5">{d.contracts.map((c) => <div key={c.no}>{cell(c.plant)}</div>)}</div> },
    { key: 'issuedAt', header: '발행일', width: '130px', sortable: true, sortValue: (d) => d.issuedAt, render: (d) => cellMuted(d.issuedAt) },
    {
      key: 'down',
      header: '다운',
      width: '70px',
      render: (d) => (
        <a
          href={d.pdf}
          download={`${d.title}.pdf`}
          aria-label={`${d.title} 다운로드`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white"
        >
          <Download size={15} />
        </a>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'RE100', path: '/re100' }, { label: '문서관리' }]} />
      <h1 className="text-2xl font-bold text-white">문서관리</h1>

      <SectionCard
        title="컨설팅 결과보고서"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && <Select options={[{ value: 'all', label: '업체 전체' }, ...companies.map((c) => ({ value: c, label: c }))]} value={company} onChange={(e) => setCompany(e.target.value)} className="w-44" />}
            <Input placeholder="문서명 검색" value={q} onChange={(e) => setQ(e.target.value)} className="w-52" />
          </div>
        }
        noPadding
      >
        <DataTable columns={columns} data={rows} rowKey={(d) => d.id} emptyMessage="결과보고서 없음 — 컨설팅이 끝나면 여기에 올라옵니다" onRowClick={(d) => view(d)} className="rounded-none border-0" />
      </SectionCard>
    </div>
  );
}
