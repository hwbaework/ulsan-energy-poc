'use client';

import { useMemo, useState } from 'react';
import { Download, FileText, Search, Upload } from 'lucide-react';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column, LIST_PREVIEW_GRID } from '@/components/features/DataList';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useConsultingDocs } from '@/hooks/consulting/useConsultingDocs';
import { useConsultingDocStore } from '@/stores/useConsultingDocStore';
import { useToastStore } from '@/stores/useToastStore';
import { CONSUMERS } from '@/stores/useTradingPocStore';
import { UploadButton } from '@/components/features/trading-poc/BillingPaper';
import type { ConsultingDoc } from '@/lib/consulting-docs';
import { LIMIT } from '@/lib/field-limits';
import { fitPdf } from '@/lib/utils/fitPdf';
import { cellMuted } from '@/components/features/trading-poc/Bits';

/**
 * 컨설팅 › 문서 관리 — 컨설팅 결과보고서만. 내 기업 · 내 발전소 보고서, 관리자는 모든 기업(기업 셀렉트).
 * 틀은 보고서 · 전력거래 문서 관리와 같다(2026-11-25 사용자) — 조건 줄(오른쪽 끝 기업) → 문서 목록(검색) + 오른쪽 미리보기.
 * 줄을 누르면 미리보기가 그 문서로 바뀐다. 보기 화면(/consulting/documents/view?id=)은 다른 곳의 링크가 써서 남아 있다.
 */
export function ConsultingDocuments() {
  const { docs, isAdmin } = useConsultingDocs();

  // 기업 — '전체' 없이 항상 하나(처음엔 첫 기업, 2026-11-25 사용자)
  const [companyPick, setCompany] = useState('');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState<number | null>(null);
  // 업로드 팝업(관리자) — 기업 · PDF 파일. 문서 이름은 따로 쓰지 않고 파일 이름을 쓴다(전력거래 문서 관리와 같은 팝업, 2026-11-25 사용자)
  const addDoc = useConsultingDocStore((s) => s.add);
  const addToast = useToastStore((s) => s.add);
  const [upOpen, setUpOpen] = useState(false);
  const [upCompany, setUpCompany] = useState('');
  const [upFile, setUpFile] = useState<File | null>(null);

  // 관리자는 문서가 없는 기업도 고를 수 있어야 한다 — 가입한 기업 전부(문서가 있는 기업이 앞). 기업 계정은 자기 문서의 기업만(2026-11-25 사용자)
  const companies = useMemo(() => [...new Set([...docs.map((d) => d.companyName), ...(isAdmin ? CONSUMERS.map((c) => c.name) : [])])], [docs, isAdmin]);
  const company = companies.includes(companyPick) ? companyPick : (companies[0] ?? '');
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return docs.filter((d) => (!company || d.companyName === company) && (!s || d.title.toLowerCase().includes(s)));
  }, [docs, company, q]);
  // 처음부터 맨 위 문서가 열려 있다
  const sel = rows.find((d) => d.id === selId) ?? rows[0] ?? null;

  const openUpload = () => {
    setUpCompany(String(CONSUMERS.find((c) => c.name === company)?.id ?? ''));
    setUpFile(null);
    setUpOpen(true);
  };
  // 빠진 값은 버튼을 막지 않고 알림으로 알려 준다
  const submitUpload = () => {
    const c = CONSUMERS.find((x) => String(x.id) === upCompany);
    const missing = [!c && '기업', !upFile && '파일'].filter(Boolean) as string[];
    if (missing.length || !c || !upFile) return addToast('error', `${missing.join(', ')}을(를) 선택해 주세요`);
    const f = upFile;
    const title = f.name.replace(/\.pdf$/i, '');
    const r = new FileReader();
    r.onload = () => {
      addDoc({
        companyId: c.id,
        companyName: c.name,
        title,
        category: '결과보고서',
        contractNo: '',
        plantName: c.name,
        issuedAt: new Date().toLocaleString('sv-SE').slice(0, 10),
        plantIds: [],
        pages: 0,
        pdf: String(r.result),
      });
      addToast('success', `${f.name}을(를) 업로드했습니다`);
      setCompany(c.name);
      setSelId(null);
      setUpOpen(false);
    };
    r.readAsDataURL(f);
  };

  const columns: Column<ConsultingDoc>[] = [
    {
      key: 'title',
      header: '문서',
      render: (d) => (
        <span className="flex items-center gap-2 text-sm text-white">
          <FileText size={15} className="shrink-0 text-slate-500" />
          {d.title}
        </span>
      ),
    },
    // 분류 · 계약번호 · 발전소 칸은 뺐다 — 기업 하나만 보므로 줄마다 같은 값이고, 옆에 미리보기가 있어 표가 좁다(2026-11-25 사용자). 문서 안에 다 적혀 있다
    // 문서 관리의 날짜 칸은 '등록일'(전력거래 문서 관리와 같은 이름)
    { key: 'issuedAt', header: '등록일', width: '110px', sortable: true, sortValue: (d) => d.issuedAt, render: (d) => cellMuted(d.issuedAt) },
    // PDF 칸은 없다 — 받기는 오른쪽 미리보기 위 [PDF] 하나(명세서와 같다, 2026-11-25 사용자)
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'RE100', path: '/re100' }, { label: '문서 관리' }]} />
      {/* 기업을 고르면 제목 앞에 그 기업 이름(보고서 화면과 같은 꼴) */}
      <h1 className="text-2xl font-bold text-white">{company ? `${company} 문서 관리` : '문서 관리'}</h1>

      {/* 조건 줄 — 오른쪽 끝 기업(관리자) */}
      {isAdmin && companies.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#0d1520] px-5 py-3 ring-1 ring-white/[0.06]">
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-slate-400">기업</span>
            <div className="w-52">
              <Select options={companies.map((c) => ({ value: c, label: c }))} value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* 목록 왼쪽 · 미리보기 오른쪽 */}
      <div className={LIST_PREVIEW_GRID}>
        <SectionCard
          title={`문서 목록 (${rows.length})`}
          actions={
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input placeholder="문서 검색" value={q} onChange={(e) => setQ(e.target.value)} maxLength={LIMIT.companyName} className="pl-8" />
              </div>
              {/* 업로드 — 관리자만. 검색 오른쪽(필터 → 검색 → 등록 순서) */}
              {isAdmin && (
                <Button variant="secondary" size="sm" onClick={openUpload}>
                  <Upload size={14} className="mr-1" /> 업로드
                </Button>
              )}
            </div>
          }
          noPadding
          className="min-w-0 !h-auto"
        >
          <DataTable
            columns={columns}
            data={rows}
            rowKey={(d) => d.id}
            emptyMessage="문서 없음"
            onRowClick={(d) => setSelId(d.id)}
            rowClassName={(d) => (d.id === sel?.id ? '!bg-primary/10' : '')}
          />
        </SectionCard>

        {sel && (
          <div className="min-w-0 overflow-hidden rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] md:sticky md:top-4">
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-400">미리보기</p>
                <p className="truncate text-sm font-semibold text-white">{sel.title}</p>
              </div>
              <a href={sel.pdf} download={`${sel.title}.pdf`} className="shrink-0">
                <Button size="sm" variant="secondary">
                  <Download size={14} className="mr-1" /> PDF
                </Button>
              </a>
            </div>
            <iframe title={sel.title} src={fitPdf(sel.pdf)} className="w-full bg-white" style={{ height: '72vh', minHeight: 560, border: 'none' }} />
          </div>
        )}
      </div>

      {/* 문서 업로드(관리자) */}
      <Modal
        open={upOpen}
        onClose={() => setUpOpen(false)}
        title="문서 업로드"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="cancel" onClick={() => setUpOpen(false)}>
              취소
            </Button>
            <Button onClick={submitUpload}>업로드</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select label="기업" required options={[{ value: '', label: '선택' }, ...CONSUMERS.map((c) => ({ value: String(c.id), label: c.name }))]} value={upCompany} onChange={(e) => setUpCompany(e.target.value)} />
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-accent">
              파일<span className="ml-0.5 text-semantic-red">*</span>
            </span>
            <div className="flex items-center gap-3">
              <UploadButton
                label="파일 선택"
                onFile={(f) => {
                  if (!f) return;
                  if (f.type !== 'application/pdf') return addToast('error', 'PDF 파일만 업로드할 수 있습니다');
                  if (f.size > 3 * 1024 * 1024) return addToast('error', '3MB 이하 파일만 업로드할 수 있습니다');
                  setUpFile(f);
                }}
              />
              <span className="min-w-0 truncate text-sm text-white">{upFile ? upFile.name : 'PDF, 3MB 이하'}</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
