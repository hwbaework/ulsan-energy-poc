'use client';

import { useMemo, useState } from 'react';
import { Download, Eye, FileText, Upload } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { DOC_CATEGORY_LABEL, useTradingPocStore } from '@/stores/useTradingPocStore';
import type { DocCategory, TradeDocument } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { fmtKw, fmtPrice, kindLabel } from './meta';
import { Info, ModalFooter, PageHeader, cell, cellMuted, cellNum } from './Bits';

const CATEGORIES = Object.keys(DOC_CATEGORY_LABEL) as DocCategory[];
const fmtSize = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);

/** 문서 관리 — 계약서·서명본·청구서·세금계산서·변경 합의서·운영 보고서. 관리자는 문서 등록도 한다. */
export function DocumentsScreen() {
  const role = useTradingRole();
  const addToast = useToastStore((s) => s.add);
  const addDocument = useTradingPocStore((s) => s.addDocument);

  const [category, setCategory] = useState<'all' | DocCategory>('all');
  const [contractId, setContractId] = useState('all');
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState<TradeDocument | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [up, setUp] = useState<{ title: string; category: DocCategory; contractId: string; fileName: string }>({ title: '', category: 'CONTRACT', contractId: '', fileName: '' });

  const month = new Date().toISOString().slice(0, 7);
  const counts = useMemo(() => {
    const by: Record<string, number> = { all: role.documents.length };
    for (const c of CATEGORIES) by[c] = role.documents.filter((d) => d.category === c).length;
    return by;
  }, [role.documents]);
  const stats = {
    total: role.documents.length,
    contracts: (counts.CONTRACT ?? 0) + (counts.SIGNED ?? 0),
    billing: (counts.INVOICE ?? 0) + (counts.TAX ?? 0),
    thisMonth: role.documents.filter((d) => d.issuedAt.startsWith(month)).length,
  };

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return role.documents
      .filter((d) => category === 'all' || d.category === category)
      .filter((d) => contractId === 'all' || String(d.contractId) === contractId)
      .filter((d) => !s || [d.title, d.fileName, d.contractNo ?? '', d.plantName ?? ''].some((v) => v.toLowerCase().includes(s)));
  }, [role.documents, category, contractId, q]);

  const download = (d: TradeDocument) => addToast('info', `${d.fileName} 다운로드를 시작합니다`);

  const columns: Column<TradeDocument>[] = [
    {
      key: 'title',
      header: '문서명',
      render: (d) => (
        <span className="flex items-center gap-2 text-sm text-white">
          <FileText size={15} className="text-slate-500 shrink-0" />
          {d.title}
        </span>
      ),
    },
    { key: 'category', header: '분류', width: '130px', render: (d) => cell(DOC_CATEGORY_LABEL[d.category]) },
    { key: 'contract', header: '계약번호', width: '130px', render: (d) => cellNum(d.contractNo ?? '-') },
    { key: 'plant', header: '발전소', width: '160px', render: (d) => cell(d.plantName ?? '-') },
    { key: 'issuedAt', header: '발행일', width: '110px', sortable: true, sortValue: (d) => d.issuedAt, render: (d) => cellMuted(d.issuedAt) },
    { key: 'type', header: '형식', width: '70px', render: (d) => cellMuted(d.fileType) },
    { key: 'size', header: '크기', width: '90px', render: (d) => cellMuted(fmtSize(d.sizeKb)) },
    {
      key: 'actions',
      header: '',
      width: '170px',
      render: (d) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="secondary" onClick={() => setPreview(d)}>
            <Eye size={14} className="mr-1" /> 미리보기
          </Button>
          <Button size="sm" variant="ghost" onClick={() => download(d)}>
            <Download size={14} />
          </Button>
        </div>
      ),
    },
  ];

  const previewContract = preview ? role.contracts.find((c) => c.id === preview.contractId) : undefined;

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
    addToast('success', `${up.title.trim()} 문서를 등록했습니다`);
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

      <StatsGrid columns={4}>
        <StatCard label="전체 문서" value={`${stats.total}건`} />
        <StatCard label="계약서" value={`${stats.contracts}건`} sub="초안 · 서명본" />
        <StatCard label="청구서 · 세금계산서" value={`${stats.billing}건`} />
        <StatCard label="이번 달 발행" value={`${stats.thisMonth}건`} />
      </StatsGrid>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        <SectionCard title="분류" noPadding>
          <ul className="py-2">
            {(['all', ...CATEGORIES] as const).map((c) => (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    'flex w-full items-center justify-between px-5 py-2 text-sm transition-colors',
                    category === c ? 'bg-primary/[0.10] text-primary' : 'text-slate-300 hover:bg-white/[0.04] hover:text-white',
                  )}
                >
                  <span>{c === 'all' ? '전체' : DOC_CATEGORY_LABEL[c]}</span>
                  <span className="text-xs tabular-nums text-slate-500">{counts[c] ?? 0}</span>
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title={category === 'all' ? '전체 문서' : DOC_CATEGORY_LABEL[category]}
          count={rows.length}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-400">
                계약
                <Select
                  options={[{ value: 'all', label: '전체' }, ...role.contracts.map((c) => ({ value: String(c.id), label: `${c.no} · ${c.plantName}` }))]}
                  value={contractId}
                  onChange={(e) => setContractId(e.target.value)}
                  className="w-56"
                />
              </label>
              <Input placeholder="문서명 · 파일명 검색" value={q} onChange={(e) => setQ(e.target.value)} className="w-52" />
            </div>
          }
          noPadding
        >
          <DataTable columns={columns} data={rows} rowKey={(d) => d.id} emptyMessage="문서 없음" onRowClick={(d) => setPreview(d)} />
        </SectionCard>
      </div>

      {/* 미리보기 — 문서 표지 */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title="문서 미리보기" size="lg">
        {preview && (
          <div className="space-y-5">
            <div className="rounded-lg bg-white text-slate-900 px-10 py-10 shadow-inner">
              <p className="text-xs tracking-widest text-slate-500">울산 에너지 자급자족 플랫폼</p>
              <h2 className="mt-3 text-2xl font-bold">{preview.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{DOC_CATEGORY_LABEL[preview.category]} · 발행일 {preview.issuedAt}</p>
              {previewContract && (
                <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  {[
                    ['계약번호', previewContract.no],
                    ['계약 유형', kindLabel(previewContract.kind)],
                    ['발전사업자', previewContract.generatorCompanyName],
                    ['수용가', previewContract.consumerCompanyName],
                    ['사업장', previewContract.siteName],
                    ['발전소', previewContract.plantName],
                    ['설비 용량', fmtKw(previewContract.capacityKw)],
                    ['단가', fmtPrice(previewContract.unitPrice)],
                    ['계약 기간', `${previewContract.startDate} ~ ${previewContract.endDate}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-slate-200 pb-1.5">
                      <dt className="text-slate-500">{k}</dt>
                      <dd className="font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="mt-10 text-xs text-slate-400">{preview.fileName} · {preview.fileType} · {fmtSize(preview.sizeKb)}</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Info label="분류" value={DOC_CATEGORY_LABEL[preview.category]} />
              <Info label="계약번호" value={preview.contractNo} />
              <Info label="등록" value={preview.uploadedBy ?? '시스템 자동 생성'} />
            </div>
            <ModalFooter>
              <Button variant="secondary" onClick={() => setPreview(null)}>
                닫기
              </Button>
              <Button onClick={() => download(preview)}>
                <Download size={14} className="mr-1" /> 다운로드
              </Button>
            </ModalFooter>
          </div>
        )}
      </Modal>

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
              <Input label="파일명" placeholder="예: 운영보고서_2026-09.pdf" value={up.fileName} onChange={(e) => setUp({ ...up, fileName: e.target.value })} />
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
