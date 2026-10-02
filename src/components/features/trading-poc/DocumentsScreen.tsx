'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileText, Upload } from 'lucide-react';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToastStore } from '@/stores/useToastStore';
import { DOC_CATEGORY_LABEL, useTradingPocStore } from '@/stores/useTradingPocStore';
import type { DocCategory, TradeDocument } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { ModalFooter, PageHeader, cell, cellMuted, cellNum } from './Bits';

const CATEGORIES = Object.keys(DOC_CATEGORY_LABEL) as DocCategory[];
/** 계약서 원문(양식) — 계약서·서명본은 이 PDF */
export const CONTRACT_PDF = '/docs/lease-contract-template.pdf';
export const isContractDoc = (d: TradeDocument) => d.category === 'CONTRACT' || d.category === 'SIGNED';

/**
 * 문서 관리 — 내 계약에서 나온 문서를 모아 조회(계약서 · 서명본 · 청구서 · 세금계산서 · 변경·해지 합의서 · 운영 보고서).
 * 행을 누르면 문서 페이지(view?id=), [다운]은 PDF. 관리자는 전체 문서와 문서 등록
 */
export function DocumentsScreen() {
  const router = useRouter();
  const role = useTradingRole();
  const addToast = useToastStore((s) => s.add);
  const addDocument = useTradingPocStore((s) => s.addDocument);

  const [category, setCategory] = useState('all');
  const [contractId, setContractId] = useState('all');
  const [q, setQ] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [up, setUp] = useState<{ title: string; category: DocCategory; contractId: string; fileName: string }>({ title: '', category: 'CONTRACT', contractId: '', fileName: '' });

  const base = role.isAdmin ? '/platform/ppa/documents' : '/generator/ppa/documents';
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return role.documents
      .filter((d) => category === 'all' || d.category === category)
      .filter((d) => contractId === 'all' || String(d.contractId) === contractId)
      .filter((d) => !s || [d.title, d.contractNo ?? '', d.plantName ?? ''].some((v) => v.toLowerCase().includes(s)));
  }, [role.documents, category, contractId, q]);

  const view = (d: TradeDocument, pdf = false) => router.push(`${base}/view?id=${d.id}${pdf ? '&pdf=1' : ''}`);

  const columns: Column<TradeDocument>[] = [
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
    { key: 'category', header: '분류', width: '140px', render: (d) => cell(DOC_CATEGORY_LABEL[d.category]) },
    { key: 'contract', header: '계약번호', width: '130px', render: (d) => cellNum(d.contractNo ?? '') },
    { key: 'plant', header: '발전소', width: '170px', render: (d) => cell(d.plantName ?? '') },
    { key: 'issuedAt', header: '발행일', width: '120px', sortable: true, sortValue: (d) => d.issuedAt, render: (d) => cellMuted(d.issuedAt) },
    {
      key: 'down',
      header: '다운',
      width: '70px',
      render: (d) =>
        isContractDoc(d) ? (
          <a
            href={CONTRACT_PDF}
            download={`${d.title}.pdf`}
            aria-label={`${d.title} 다운로드`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white"
          >
            <Download size={15} />
          </a>
        ) : (
          <button
            type="button"
            aria-label={`${d.title} 다운로드`}
            onClick={(e) => {
              e.stopPropagation();
              view(d, true);
            }}
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white"
          >
            <Download size={15} />
          </button>
        ),
    },
  ];

  const submitUpload = () => {
    const c = role.contracts.find((x) => String(x.id) === up.contractId);
    addDocument({
      category: up.category,
      title: up.title.trim(),
      fileName: up.fileName.trim() || `${up.title.trim()}.pdf`,
      contractId: c?.id,
      contractNo: c?.no,
      plantName: c?.plantName,
      partyCompanyIds: c ? [c.generatorCompanyId, c.consumerCompanyId] : [],
      fileType: up.fileName.toLowerCase().endsWith('.xlsx') ? 'XLSX' : 'PDF',
      sizeKb: 420 + Math.floor(Math.random() * 900),
      uploadedBy: role.companyName,
    });
    addToast('success', `${up.title.trim()} 등록`);
    setUploadOpen(false);
    setUp({ title: '', category: 'CONTRACT', contractId: '', fileName: '' });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="문서 관리"
        actions={
          role.isAdmin && (
            <Button onClick={() => setUploadOpen(true)}>
              <Upload size={16} className="mr-1" /> 문서 등록
            </Button>
          )
        }
      />

      <SectionCard
        title="문서"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              분류
              <Select options={[{ value: 'all', label: '전체' }, ...CATEGORIES.map((c) => ({ value: c, label: DOC_CATEGORY_LABEL[c] }))]} value={category} onChange={(e) => setCategory(e.target.value)} className="w-40" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              계약
              <Select
                options={[{ value: 'all', label: '전체' }, ...role.contracts.filter((c) => c.status !== 'PENDING_SIGN').map((c) => ({ value: String(c.id), label: `${c.no} · ${c.plantName}` }))]}
                value={contractId}
                onChange={(e) => setContractId(e.target.value)}
                className="w-56"
              />
            </label>
            <Input placeholder="문서명 · 계약번호 · 발전소 검색" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          </div>
        }
        noPadding
      >
        <DataTable columns={columns} data={rows} rowKey={(d) => d.id} emptyMessage="문서 없음" onRowClick={(d) => view(d)} />
      </SectionCard>

      {/* 문서 등록 (관리자) */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="문서 등록" size="md">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="문서명" value={up.title} onChange={(e) => setUp({ ...up, title: e.target.value })} required />
            </div>
            <Select label="분류" options={CATEGORIES.map((c) => ({ value: c, label: DOC_CATEGORY_LABEL[c] }))} value={up.category} onChange={(e) => setUp({ ...up, category: e.target.value as DocCategory })} />
            <Select
              label="계약"
              options={[{ value: '', label: '계약 없음' }, ...role.contracts.map((c) => ({ value: String(c.id), label: `${c.no} · ${c.plantName}` }))]}
              value={up.contractId}
              onChange={(e) => setUp({ ...up, contractId: e.target.value })}
            />
            <div className="col-span-2">
              <Input label="파일명" placeholder="운영보고서_2026-09.pdf" value={up.fileName} onChange={(e) => setUp({ ...up, fileName: e.target.value })} />
            </div>
          </div>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setUploadOpen(false)}>
              취소
            </Button>
            <Button disabled={!up.title.trim()} onClick={submitUpload}>
              등록
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}
