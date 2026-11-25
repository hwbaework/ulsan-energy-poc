'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Search, Upload } from 'lucide-react';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column, LIST_PREVIEW_GRID } from '@/components/features/DataList';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToastStore } from '@/stores/useToastStore';
import { LIMIT } from '@/lib/field-limits';
import { fitPdf } from '@/lib/utils/fitPdf';
import { billingStatusOf, invoiceKey, isInvoiceOut, issueDateOf, useTradingPocStore } from '@/stores/useTradingPocStore';
import type { Contract, DocCategory, TradeDocument } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { kindLabel } from './meta';
import { PageHeader, cell, cellNum } from './Bits';
import { DocumentSheet, periodOf } from './DocumentSheet';
import { BillingPaper, UploadButton } from './BillingPaper';
import { useLocationSearch } from '@/lib/use-location-search';

/** 계약서 원문(양식) — 계약서는 이 PDF */
export const CONTRACT_PDF = '/docs/lease-contract-template.pdf';
export const isContractDoc = (d: TradeDocument) => d.category === 'CONTRACT' || d.category === 'SIGNED';
export const docsBase = (admin: boolean) => (admin ? '/platform/ppa/documents' : '/generator/ppa/documents');

/** 문서 관리에 두는 것 — 계약서 · 청구서 · 세금계산서 · 변경 합의서 · 해지 합의서(양측 서명본) */
const CATEGORIES = ['SIGNED', 'INVOICE', 'TAX', 'CHANGE', 'TERMINATE'] as const satisfies readonly DocCategory[];
type Category = (typeof CATEGORIES)[number];
const CATEGORY_META: Record<Category, { label: string }> = {
  SIGNED: { label: '계약서' },
  INVOICE: { label: '청구서' },
  TAX: { label: '세금계산서' },
  CHANGE: { label: '변경 합의서' },
  TERMINATE: { label: '해지 합의서' },
};
const isShown = (d: TradeDocument): d is TradeDocument & { category: Category } =>
  (CATEGORIES as readonly string[]).includes(d.category);

type Row = TradeDocument & {
  category: Category;
  company: string;
  companyId: number;
  contract?: Contract;
  name: string;
};

/** 종이(A4, 900px 기준)를 칸 폭에 맞춰 줄여 그린다 — 옆 미리보기 칸이 좁아도 글자 배치가 깨지지 않게 */
function FitWidth({ width = 900, children }: { width?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setZoom(Math.min(1, e.contentRect.width / width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className="w-full overflow-hidden">
      <div style={{ width, zoom }}>{children}</div>
    </div>
  );
}


/**
 * 문서 관리 — 전력거래에서 생긴 문서만 모아 본다(계약서 · 청구서 · 세금계산서 · 변경 합의서 · 해지 합의서).
 * 문서는 전자서명 · 청구서 발행 · 세금계산서 업로드에서 자동으로 들어오고, 관리자는 여기서 PDF 를 직접 업로드할 수도 있다(2026-11-25 사용자).
 * 틀은 보고서 화면과 같다(2026-11-25 사용자) — 조건 줄(카테고리 · 오른쪽 끝 기업) → 문서 목록(검색) + 오른쪽 미리보기. 줄을 누르면 미리보기가 그 문서로 바뀐다.
 * 폴더 트리 · 보기 화면으로 넘어가기는 없앴다(보기 화면은 알림 등 다른 곳의 링크가 써서 남아 있다). 계약서는 여러 쪽이라 받아서 본다.
 * ?company=기업 번호 로 그 기업을 고른 채 열 수 있다.
 */
export function DocumentsScreen({ initialCompany }: { initialCompany?: number }) {
  const router = useRouter();
  const role = useTradingRole();
  const invoices = useTradingPocStore((s) => s.invoices);
  const addDocument = useTradingPocStore((s) => s.addDocument);
  const addToast = useToastStore((s) => s.add);
  // 업로드 팝업(관리자) — 카테고리 · 기업(계약) · PDF 파일
  const [upOpen, setUpOpen] = useState(false);
  const [upCat, setUpCat] = useState<'' | Category>('');
  const [upContract, setUpContract] = useState('');
  const [upFile, setUpFile] = useState<File | null>(null);
  const base = docsBase(role.isAdmin);

  const [category, setCategory] = useState<'all' | Category>('all');
  // 기업 셀렉트 없이 모든 문서를 한 표에 — 기업 · 계약 유형 칸과 검색으로 본다(수익·정산과 같게, 2026-11-25 사용자).
  // ?company=기업 번호 로 들어오면 그 기업 이름으로 검색해 둔 채 연다
  const [query, setQuery] = useState('');
  const [selId, setSelId] = useState<number | null>(null);
  const [entryCompany, setEntryCompany] = useState<number | null>(null);
  useEffect(() => {
    const id = initialCompany ?? Number(new URLSearchParams(window.location.search).get('company'));
    if (id) setEntryCompany(id);
  }, [initialCompany]);

  const docs = useMemo<Row[]>(
    () =>
      // 세금계산서는 플랫폼이 만들지 않는다 — 관리자가 홈택스 원본을 올린 달만 문서, 날짜는 올린 날(등록일)
      role.documents.filter(isShown).flatMap((d) => {
        if (d.category === 'TAX' && !d.original) return [];
        // 청구서는 발행된 것만 문서 — 발행 전은 관리자에게도 문서가 아니다(청구서 화면의 발행할 청구서에서 작성, 2026-11-20 사용자)
        if (d.category === 'INVOICE' && d.contractId && !d.uploadedBy) {
          const p = periodOf(d) ?? '';
          const rec = invoices[invoiceKey(d.contractId, p)];
          // 청구일이 되어 나간 것만(발행을 눌렀어도 청구일 전이면 아직 문서 아님)
          if (!isInvoiceOut({ billStatus: rec?.status ?? billingStatusOf(p), issueDate: rec?.issueDate ?? issueDateOf(p) })) return [];
        }
        const c = role.contracts.find((x) => x.id === d.contractId);
        if (!c) return [];
        const p = periodOf(d);
        const label = CATEGORY_META[d.category].label;
        const name = d.uploadedBy
          ? d.fileName
          : d.category === 'SIGNED' || d.category === 'CHANGE' || d.category === 'TERMINATE'
            ? `${label}_${c.no}_${c.consumerCompanyName}.pdf`
            : `${label}_${p}_${c.consumerCompanyName}.pdf`;
        const issuedAt = d.category === 'TAX' && d.original ? d.original.at.slice(0, 10) : d.issuedAt;
        return [{ ...d, issuedAt, company: c.consumerCompanyName, companyId: c.consumerCompanyId, contract: c, name }];
      }),
    [role.documents, role.contracts, role.isAdmin, invoices],
  );
  // 기업 선택지 — 계약 하나가 선택지 하나. 자가소비와 PPA 계약이 모두 있는 기업은 {기업}(자가소비) · {기업}(PPA)로 따로
  // (대시보드 · 보고서의 기업 셀렉트와 같은 꼴, 2026-11-25 사용자). id 는 '기업 번호:계약 유형'
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs
      .filter((d) => category === 'all' || d.category === category)
      .filter((d) => entryCompany == null || q || d.companyId === entryCompany)
      .filter(
        (d) => !q || [d.name, d.company, CATEGORY_META[d.category].label].some((v) => v.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.id - a.id);
  }, [docs, category, query, entryCompany]);
  // 처음부터 맨 위 문서가 열려 있고, 다른 줄을 누르면 오른쪽이 그 문서로 바뀐다(보고서 화면과 같다)
  const sel = visible.find((d) => d.id === selId) ?? visible[0] ?? null;

  const view = (d: TradeDocument, pdf = false) => router.push(`${base}/view?id=${d.id}${pdf ? '&pdf=1' : ''}`);
  const columns: Column<Row>[] = [
    // 즐겨찾기 별 칸은 뺐다(2026-11-25 사용자)
    {
      key: 'name',
      header: '파일',
      sortable: true,
      sortValue: (d) => d.name,
      render: (d) => (
        <p className="whitespace-nowrap text-sm text-white">{d.name}</p>
      ),
    },
    // 계약 유형 — 파일 이름 아래 둘째 줄이 아니라 칸 하나(칸 하나에 값 하나, 2026-11-19 사용자)
    // 계약 유형 칸은 없다 — 기업 셀렉트가 계약 하나를 고르므로 줄마다 같은 값(제목 · 셀렉트에 보인다)
    { key: 'company', header: '기업', width: '110px', render: (d) => cell(d.company) },
    { key: 'kind', header: '계약 유형', width: '90px', render: (d) => cell(d.contract ? kindLabel(d.contract.kind) : '') },
    { key: 'cat', header: '카테고리', width: '100px', render: (d) => cell(CATEGORY_META[d.category].label) },
    // 기업 칸은 없다 — 항상 기업 하나만 보므로 전부 같은 값(어느 기업인지는 제목 · 오른쪽 셀렉트)
    {
      // 등록일 — 문서 관리에 들어온 날. 세금계산서는 홈택스 발행이라 '발행일'이 아니고 관리자가 업로드한 날(2026-11-19 사용자)
      key: 'issued',
      header: '등록일',
      width: '130px',
      sortable: true,
      sortValue: (d) => d.issuedAt,
      render: (d) => cellNum(d.issuedAt),
    },
    // PDF 칸은 없다 — 받기는 오른쪽 미리보기 위 [PDF] 하나(명세서와 같다, 2026-11-25 사용자)
  ];

  // 업로드 — 빠진 값은 버튼을 막지 않고 알림으로 알려 준다
  // 기업 선택지 — 지금 유효한 계약만. 이름만 쓰고, 한 기업에 계약이 둘이면 그때만 (자가소비) · (PPA)로 나눈다. 계약번호는 쓰지 않는다(2026-11-25 사용자)
  const liveContracts = role.contracts.filter((c) => c.status === 'ACTIVE');
  const contractChoices = liveContracts
    .filter((c, i, a) => a.findIndex((x) => x.consumerCompanyId === c.consumerCompanyId && x.kind === c.kind) === i)
    .map((c) => ({
      value: String(c.id),
      label: liveContracts.some((x) => x.consumerCompanyId === c.consumerCompanyId && x.kind !== c.kind) ? `${c.consumerCompanyName}(${kindLabel(c.kind)})` : c.consumerCompanyName,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ko'));
  const openUpload = () => {
    setUpCat(category === 'all' ? '' : category);
    setUpContract('');
    setUpFile(null);
    setUpOpen(true);
  };
  const submitUpload = () => {
    const c = role.contracts.find((x) => String(x.id) === upContract);
    const missing = [!upCat && '카테고리', !c && '기업', !upFile && '파일'].filter(Boolean) as string[];
    if (missing.length || !c || !upFile || !upCat) return addToast('error', `${missing.join(', ')}을(를) 선택해 주세요`);
    const f = upFile;
    const r = new FileReader();
    r.onload = () => {
      const at = new Date().toLocaleString('sv-SE').slice(0, 16);
      addDocument({
        category: upCat,
        title: f.name.replace(/\.pdf$/i, ''),
        fileName: f.name,
        contractId: c.id,
        contractNo: c.no,
        plantName: c.plantName,
        partyCompanyIds: [c.generatorCompanyId, c.consumerCompanyId],
        fileType: 'PDF',
        sizeKb: Math.round(f.size / 1024),
        uploadedBy: role.companyName,
        original: { name: f.name, url: String(r.result), sizeKb: Math.round(f.size / 1024), by: role.companyName, at },
      });
      addToast('success', `${f.name}을(를) 업로드했습니다`);
      setEntryCompany(null);
      setQuery('');
      setCategory('all');
      setSelId(null);
      setUpOpen(false);
    };
    r.readAsDataURL(f);
  };

  // 받기 — 계약서 · 원본이 있는 문서는 그 파일, 그 밖은 보기 화면에서 PDF 저장(목록의 PDF 칸과 같은 동작)
  const downloadOf = (d: Row): { href: string; name: string } | null =>
    d.original ? { href: d.original.url, name: d.original.name } : isContractDoc(d) ? { href: CONTRACT_PDF, name: d.name } : null;
  const selDown = sel ? downloadOf(sel) : null;
  const selPeriod = sel && (sel.category === 'TAX' || sel.category === 'INVOICE') ? periodOf(sel) : undefined;
  const selChange = sel && (sel.category === 'CHANGE' || sel.category === 'TERMINATE') ? role.changes.find((ch) => sel.fileName.startsWith(ch.no)) : undefined;

  return (
    <div className="space-y-6">
      {/* 제목은 메뉴 이름 · 지금 보는 기업 이름(보고서 화면과 같은 꼴). 경로 표시는 메뉴 이름 그대로 */}
      <PageHeader title="문서 관리" />

      {/* 조건 줄 — 카테고리, 오른쪽 끝 기업(관리자) */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#0d1520] px-5 py-3 ring-1 ring-white/[0.06]">
        <span className="text-sm text-slate-400">카테고리</span>
        <div className="w-40">
          <Select
            options={[{ value: 'all', label: '전체' }, ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_META[c].label }))]}
            value={category}
            onChange={(e) => setCategory(e.target.value as 'all' | Category)}
          />
        </div>
      </div>

      {/* 목록 왼쪽 · 미리보기 오른쪽 */}
      <div className={LIST_PREVIEW_GRID}>
        <SectionCard
          title={`문서 목록 (${visible.length})`}
          actions={
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input value={query} onChange={(e) => { setQuery(e.target.value); setEntryCompany(null); }} placeholder="기업 · 문서 검색" maxLength={LIMIT.companyName} className="pl-8" />
              </div>
              {/* 업로드 — 관리자만. 검색 오른쪽(필터 → 검색 → 등록 순서) */}
              {role.isAdmin && (
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
            data={visible}
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
                <p className="truncate text-sm font-semibold text-white">{sel.name}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                {selDown ? (
                  <a href={selDown.href} download={selDown.name}>
                    <Button size="sm" variant="secondary">
                      <Download size={14} className="mr-1" /> PDF
                    </Button>
                  </a>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => view(sel, true)}>
                    <Download size={14} className="mr-1" /> PDF
                  </Button>
                )}
              </div>
            </div>
            {sel.uploadedBy && sel.original ? (
              <iframe title={sel.name} src={fitPdf(sel.original.url)} className="w-full bg-white" style={{ height: '72vh', minHeight: 560, border: 'none' }} />
            ) : isContractDoc(sel) ? (
              <iframe title={sel.title} src={fitPdf(CONTRACT_PDF)} className="w-full bg-white" style={{ height: '72vh', minHeight: 560, border: 'none' }} />
            ) : sel.contract && selPeriod ? (
              <div className="p-3">
                <BillingPaper kind={sel.category === 'TAX' ? 'TAX' : 'INVOICE'} contract={sel.contract} period={selPeriod} admin={role.isAdmin} />
              </div>
            ) : sel.contract ? (
              <FitWidth>
                <DocumentSheet doc={sel} contract={sel.contract} change={selChange} />
              </FitWidth>
            ) : null}
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
          <Select
            label="카테고리"
            required
            options={[{ value: '', label: '선택' }, ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_META[c].label }))]}
            value={upCat}
            onChange={(e) => setUpCat(e.target.value as '' | Category)}
          />
          <Select label="기업" required options={[{ value: '', label: '선택' }, ...contractChoices]} value={upContract} onChange={(e) => setUpContract(e.target.value)} />
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

/** 예전 주소(/company?id=기업 번호) — 그 기업 폴더를 연 문서 관리 */
export function DocumentsCompanyScreen() {
  const [id, setId] = useState<number | undefined>(undefined);
  const search = useLocationSearch();
  useEffect(() => {
    setId(Number(new URLSearchParams(search).get('id')) || undefined);
  }, [search]);
  return <DocumentsScreen initialCompany={id} />;
}
