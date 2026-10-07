'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, Download, Search, Star, Upload } from 'lucide-react';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { useTradingPocStore } from '@/stores/useTradingPocStore';
import type { Contract, DocCategory, TradeDocument } from '@/types/trading-poc';
import { useTradingRole } from './useTradingRole';
import { kindLabel } from './meta';
import { ModalFooter, PageHeader, cell, cellMuted, cellNum } from './Bits';
import { periodOf } from './DocumentSheet';

/** 계약서 원문(양식) — 계약서는 이 PDF */
export const CONTRACT_PDF = '/docs/lease-contract-template.pdf';
export const isContractDoc = (d: TradeDocument) => d.category === 'CONTRACT' || d.category === 'SIGNED';
export const docsBase = (admin: boolean) => (admin ? '/platform/ppa/documents' : '/generator/ppa/documents');

/** 문서 관리에 두는 것 — 발행되고 받은 문서 3가지 */
const CATEGORIES = ['SIGNED', 'INVOICE', 'TAX'] as const satisfies readonly DocCategory[];
type Category = (typeof CATEGORIES)[number];
const CATEGORY_META: Record<Category, { label: string }> = {
  SIGNED: { label: '계약서' },
  INVOICE: { label: '청구서' },
  TAX: { label: '세금계산서' },
};
const isShown = (d: TradeDocument): d is TradeDocument & { category: Category } =>
  (CATEGORIES as readonly string[]).includes(d.category);

const FAV_KEY = 'trading-doc-favorites';
function readFavs(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]') as number[]);
  } catch {
    return new Set();
  }
}

type Row = TradeDocument & {
  category: Category;
  company: string;
  companyId: number;
  contract?: Contract;
  name: string;
};

function FolderRow({
  label,
  count,
  active,
  depth = 0,
  expanded,
  onClick,
}: {
  label: string;
  count?: number;
  active?: boolean;
  depth?: number;
  expanded?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
        active ? 'bg-primary/[0.10] text-primary' : 'text-slate-300 hover:bg-white/[0.04] hover:text-white',
      )}
      style={{ paddingLeft: `${0.5 + depth * 0.9}rem` }}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-500">
        {expanded === undefined ? null : expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && <span className="text-xs tabular-nums text-slate-500">{count}</span>}
    </button>
  );
}

const iconBtn = 'inline-flex rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white';

/**
 * 문서 관리 — 전력거래에서 발행되고 받은 문서(계약서 · 청구서 · 세금계산서).
 * 왼쪽 폴더(전체 · 카테고리 · 기업별), 오른쪽 문서 표(다른 화면과 같은 표 · 검색). 줄을 누르면 보기, 오른쪽 끝 PDF.
 * ?company=기업 번호 로 기업 폴더를 열 수 있다.
 */
export function DocumentsScreen({ initialCompany }: { initialCompany?: number }) {
  const router = useRouter();
  const role = useTradingRole();
  const addToast = useToastStore((s) => s.add);
  const addDocument = useTradingPocStore((s) => s.addDocument);
  const base = docsBase(role.isAdmin);

  const [folder, setFolder] = useState<string>('all');
  const [open, setOpen] = useState<Set<string>>(new Set(['cat', 'company']));
  const [query, setQuery] = useState('');
  const [favs, setFavs] = useState<Set<number>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [up, setUp] = useState<{ title: string; category: Category; contractId: string; fileName: string }>({
    title: '',
    category: 'SIGNED',
    contractId: '',
    fileName: '',
  });

  useEffect(() => {
    setFavs(readFavs());
    const id = initialCompany ?? Number(new URLSearchParams(window.location.search).get('company'));
    if (id) setFolder(`company:${id}`);
  }, [initialCompany]);

  const docs = useMemo<Row[]>(
    () =>
      role.documents.filter(isShown).flatMap((d) => {
        const c = role.contracts.find((x) => x.id === d.contractId);
        if (!c) return [];
        const p = periodOf(d);
        const label = CATEGORY_META[d.category].label;
        const name = d.uploadedBy
          ? d.fileName
          : d.category === 'SIGNED'
            ? `${label}_${c.no}_${c.consumerCompanyName}.pdf`
            : `${label}_${p}_${c.consumerCompanyName}.pdf`;
        return [{ ...d, company: c.consumerCompanyName, companyId: c.consumerCompanyId, contract: c, name }];
      }),
    [role.documents, role.contracts],
  );
  const companies = useMemo(() => {
    const m = new Map<number, string>();
    for (const d of docs) m.set(d.companyId, d.company);
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [docs]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs
      .filter(
        (d) =>
          folder === 'all' ||
          (folder.startsWith('cat:') ? d.category === folder.slice(4) : d.companyId === Number(folder.slice(8))),
      )
      .filter(
        (d) => !q || [d.name, d.company, CATEGORY_META[d.category].label].some((v) => v.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.id - a.id);
  }, [docs, folder, query]);

  const toggle = (k: string) =>
    setOpen((s) => (s.has(k) ? new Set([...s].filter((x) => x !== k)) : new Set([...s, k])));
  const toggleFav = (id: number) =>
    setFavs((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify([...next]));
      } catch {
        /* 저장 못 해도 화면은 그대로 */
      }
      return next;
    });
  const view = (d: TradeDocument, pdf = false) => router.push(`${base}/view?id=${d.id}${pdf ? '&pdf=1' : ''}`);
  const folderName =
    folder === 'all'
      ? '전체'
      : folder.startsWith('cat:')
        ? CATEGORY_META[folder.slice(4) as Category].label
        : (companies.find((c) => c.id === Number(folder.slice(8)))?.name ?? '');

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
  };

  const columns: Column<Row>[] = [
    {
      key: 'fav',
      header: '',
      width: '44px',
      align: 'center',
      render: (d) => {
        const fav = favs.has(d.id);
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFav(d.id);
            }}
            aria-label="즐겨찾기"
            className={cn('inline-flex', fav ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400')}
          >
            <Star size={14} className={fav ? 'fill-amber-400' : ''} />
          </button>
        );
      },
    },
    {
      key: 'name',
      header: '파일',
      sortable: true,
      sortValue: (d) => d.name,
      render: (d) => cell(d.name, 'text-white'),
    },
    { key: 'cat', header: '카테고리', width: '120px', render: (d) => cell(CATEGORY_META[d.category].label) },
    ...(role.isAdmin ? [{ key: 'company', header: '기업', width: '140px', render: (d: Row) => cell(d.company) }] : []),
    {
      key: 'kind',
      header: '계약 유형',
      width: '110px',
      render: (d) => cellMuted(d.contract ? kindLabel(d.contract.kind) : '-'),
    },
    {
      key: 'issued',
      header: '발행일',
      width: '120px',
      sortable: true,
      sortValue: (d) => d.issuedAt,
      render: (d) => cellNum(d.issuedAt),
    },
    {
      key: 'size',
      header: '크기',
      width: '90px',
      align: 'right',
      render: (d) => cellMuted(d.sizeKb >= 1024 ? `${(d.sizeKb / 1024).toFixed(1)} MB` : `${d.sizeKb} KB`),
    },
    {
      key: 'pdf',
      header: 'PDF',
      width: '70px',
      align: 'center',
      render: (d) =>
        isContractDoc(d) ? (
          <a
            href={CONTRACT_PDF}
            download={d.name}
            onClick={(e) => e.stopPropagation()}
            aria-label="다운로드"
            title="다운로드"
            className={iconBtn}
          >
            <Download size={15} />
          </a>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              view(d, true);
            }}
            aria-label="다운로드"
            title="다운로드"
            className={iconBtn}
          >
            <Download size={15} />
          </button>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="문서 관리"
        actions={
          role.isAdmin && (
            <Button
              onClick={() => {
                setUp({
                  title: '',
                  category: 'SIGNED',
                  contractId: String(role.contracts.find((c) => c.status === 'ACTIVE')?.id ?? ''),
                  fileName: '',
                });
                setUploadOpen(true);
              }}
            >
              <Upload size={16} className="mr-1" /> 문서 등록
            </Button>
          )
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-12">
        {/* 폴더 */}
        <div className="xl:col-span-3">
          <SectionCard title="폴더">
            <div className="space-y-1">
              <FolderRow label="전체" count={docs.length} active={folder === 'all'} onClick={() => setFolder('all')} />
              <FolderRow label="카테고리" expanded={open.has('cat')} onClick={() => toggle('cat')} />
              {open.has('cat') &&
                CATEGORIES.map((c) => (
                  <FolderRow
                    key={c}
                    label={CATEGORY_META[c].label}
                    count={docs.filter((d) => d.category === c).length}
                    depth={1}
                    active={folder === `cat:${c}`}
                    onClick={() => setFolder(`cat:${c}`)}
                  />
                ))}
              <FolderRow label="기업별" expanded={open.has('company')} onClick={() => toggle('company')} />
              {open.has('company') &&
                companies.map((c) => (
                  <FolderRow
                    key={c.id}
                    label={c.name}
                    count={docs.filter((d) => d.companyId === c.id).length}
                    depth={1}
                    active={folder === `company:${c.id}`}
                    onClick={() => setFolder(`company:${c.id}`)}
                  />
                ))}
            </div>
          </SectionCard>
        </div>

        {/* 문서 */}
        <div className="min-w-0 xl:col-span-9">
          <SectionCard
            title={`${folderName} (${visible.length})`}
            actions={
              <div className="relative w-64">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="파일 · 카테고리 · 기업 검색"
                  className="pl-8"
                />
              </div>
            }
            noPadding
          >
            <DataTable
              columns={columns}
              data={visible}
              rowKey={(d) => d.id}
              emptyMessage="문서 없음"
              onRowClick={(d) => view(d)}
            />
          </SectionCard>
        </div>
      </div>

      {/* 문서 등록 (관리자) */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="문서 등록" size="md">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input
                label="문서명"
                value={up.title}
                onChange={(e) => setUp({ ...up, title: e.target.value })}
                required
              />
            </div>
            <Select
              label="카테고리"
              options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_META[c].label }))}
              value={up.category}
              onChange={(e) => setUp({ ...up, category: e.target.value as Category })}
            />
            <Select
              label="계약"
              options={role.contracts
                .filter((c) => c.status === 'ACTIVE')
                .map((c) => ({ value: String(c.id), label: `${c.consumerCompanyName} · ${kindLabel(c.kind)}` }))}
              value={up.contractId}
              onChange={(e) => setUp({ ...up, contractId: e.target.value })}
            />
            <div className="col-span-2">
              <Input
                label="파일명"
                placeholder="계약서.pdf"
                value={up.fileName}
                onChange={(e) => setUp({ ...up, fileName: e.target.value })}
              />
            </div>
          </div>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setUploadOpen(false)}>
              취소
            </Button>
            <Button disabled={!up.title.trim() || !up.contractId} onClick={submitUpload}>
              등록
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}

/** 예전 주소(/company?id=기업 번호) — 그 기업 폴더를 연 문서 관리 */
export function DocumentsCompanyScreen() {
  const [id, setId] = useState<number | undefined>(undefined);
  useEffect(() => {
    setId(Number(new URLSearchParams(window.location.search).get('id')) || undefined);
  }, []);
  return <DocumentsScreen initialCompany={id} />;
}
