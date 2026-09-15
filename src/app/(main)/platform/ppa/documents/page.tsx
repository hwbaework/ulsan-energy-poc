// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Folder,
  ChevronRight,
  ChevronDown,
  Search,
  Download,
  Mail,
  Share2,
  Eye,
  Star,
  Archive as ArchiveIcon,
  _FileText,
  Receipt,
  Handshake,
  _FileSignature,
  Award,
  _Wrench,
  IdCard,
  ShieldCheck,
  Building2,
  Factory,
  Grid3x3,
  List,
  Hash,
  HardDrive,
  Calendar as CalendarIcon,
  Shield,
  AlertTriangle,
  History,
  Droplets,
  Plus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SectionCard } from '@/components/features';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { Modal } from '@/components/ui/Modal';
import { cn, exportPdf } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { usePpaContracts } from '@/hooks/ppa/usePpa';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */
type DocCategory =
  | 'member' // 1. 회원·자격
  | 'contract' // 2. 계약
  | 'plant' // 3. 발전소
  | 'settlement' // 4. 정산·결제
  | 'certificate' // 5. 인증·보고
  | 'audit'; // 6. 감사·운영

interface ArchiveFile {
  id: string;
  filename: string;
  category: DocCategory;
  partyId?: string;
  partyLabel?: string;
  partyType?: 'generator' | 'consumer' | 'spc';
  issuedAt: string; // 'YYYY-MM-DD'
  yearMonth: string;
  size: string;
  expiresAt?: string; // 만료일 (계약 문서 등 자연스러운 만료가 있는 경우만)
  watermark: boolean;
  status: 'issued' | 'pending';
}

const CATEGORY_META: Record<DocCategory, { label: string; icon: LucideIcon; tone: string; bg: string; ring: string }> =
  {
    member: {
      label: '회원·자격',
      icon: IdCard,
      tone: 'text-blue-300',
      bg: 'bg-blue-500/[0.08]',
      ring: 'ring-blue-500/30',
    },
    contract: {
      label: '계약',
      icon: Handshake,
      tone: 'text-emerald-300',
      bg: 'bg-emerald-500/[0.08]',
      ring: 'ring-emerald-500/30',
    },
    plant: {
      label: '발전소',
      icon: Factory,
      tone: 'text-amber-300',
      bg: 'bg-amber-500/[0.08]',
      ring: 'ring-amber-500/30',
    },
    settlement: {
      label: '정산·결제',
      icon: Receipt,
      tone: 'text-violet-300',
      bg: 'bg-violet-500/[0.08]',
      ring: 'ring-violet-500/30',
    },
    certificate: {
      label: '인증·보고',
      icon: Award,
      tone: 'text-cyan-300',
      bg: 'bg-cyan-500/[0.08]',
      ring: 'ring-cyan-500/30',
    },
    audit: {
      label: '감사·운영',
      icon: ShieldCheck,
      tone: 'text-rose-300',
      bg: 'bg-rose-500/[0.08]',
      ring: 'ring-rose-500/30',
    },
  };

const PARTIES: { id: string; label: string; type: 'generator' | 'consumer' | 'spc' }[] = [
  { id: 'gen1', label: '용인금속', type: 'generator' },
  { id: 'gen2', label: '건호이엔씨', type: 'generator' },
  { id: 'gen3', label: '한길', type: 'generator' },
  { id: 'gen4', label: '(주)울산미포오알씨발전1호', type: 'generator' },
  { id: 'con2', label: '주식회사 알엠에스플랫폼', type: 'consumer' },
  { id: 'con3', label: '(주)카프로', type: 'consumer' },
  { id: 'spc1', label: '울산E-SPC(주)', type: 'spc' },
];

const FILES: ArchiveFile[] = [
  {
    id: 'f1',
    filename: 'PPA계약서_PPA-2026-RMS-001_울산미포→알엠에스.pdf',
    category: 'contract',
    partyId: 'con2',
    partyLabel: '주식회사 알엠에스플랫폼',
    partyType: 'consumer',
    issuedAt: '2026-01-15',
    yearMonth: '2026-01',
    size: '2.4 MB',
    watermark: false,
    status: 'issued',
  },
  {
    id: 'f2',
    filename: 'PPA계약서_PPA-2026-UME-001_울산미포→용인금속.pdf',
    category: 'contract',
    partyId: 'gen1',
    partyLabel: '용인금속',
    partyType: 'generator',
    issuedAt: '2026-01-15',
    yearMonth: '2026-01',
    size: '2.2 MB',
    watermark: false,
    status: 'issued',
  },
  {
    id: 'f3',
    filename: 'PPA계약서_PPA-2026-KPR-001_카프로→한길.pdf',
    category: 'contract',
    partyId: 'gen3',
    partyLabel: '한길',
    partyType: 'generator',
    issuedAt: '2026-03-01',
    yearMonth: '2026-03',
    size: '2.1 MB',
    watermark: false,
    status: 'issued',
  },
  {
    id: 'f4',
    filename: '거래소신고서_2026-01.pdf',
    category: 'certificate',
    partyId: 'spc1',
    partyLabel: '울산E-SPC(주)',
    partyType: 'spc',
    issuedAt: '2026-01-20',
    yearMonth: '2026-01',
    size: '1.2 MB',
    watermark: true,
    status: 'issued',
  },
  {
    id: 'f5',
    filename: '정산서_2026-05_용인금속.pdf',
    category: 'settlement',
    partyId: 'gen1',
    partyLabel: '용인금속',
    partyType: 'generator',
    issuedAt: '2026-06-02',
    yearMonth: '2026-06',
    size: '680 KB',
    watermark: false,
    status: 'issued',
  },
  {
    id: 'f6',
    filename: '정산서_2026-05_한길.pdf',
    category: 'settlement',
    partyId: 'gen3',
    partyLabel: '한길',
    partyType: 'generator',
    issuedAt: '2026-06-02',
    yearMonth: '2026-06',
    size: '640 KB',
    watermark: false,
    status: 'issued',
  },
  {
    id: 'f7',
    filename: '운영감사보고서_2026Q1.pdf',
    category: 'audit',
    partyId: 'spc1',
    partyLabel: '울산E-SPC(주)',
    partyType: 'spc',
    issuedAt: '2026-04-30',
    yearMonth: '2026-04',
    size: '3.2 MB',
    watermark: false,
    status: 'pending',
  },
];

const TOTAL_SIZE_MB = 9;

const AUDIT_LOG: { id: string; datetime: string; actor: string; action: string; fileId: string }[] = [
  { id: 'a1', datetime: '2026-05-28 14:30', actor: '오승환 (SPC)', action: '정산서 업로드', fileId: 'f4' },
  { id: 'a2', datetime: '2026-05-15 10:00', actor: '시스템', action: '정산서 자동 생성', fileId: 'f4' },
  { id: 'a3', datetime: '2026-04-30 16:20', actor: '오승환 (SPC)', action: '감사보고서 초안 등록', fileId: 'f6' },
];

/* ─────────────────────────────────────────────
   Folder helpers
   ───────────────────────────────────────────── */
function filterByFolder(files: ArchiveFile[], key: string): ArchiveFile[] {
  if (key === 'all') return files;
  if (key === 'expiring') return files.filter((f) => f.expiresAt && daysUntil(f.expiresAt) <= 365);
  if (key.startsWith('cat:')) {
    const c = key.slice('cat:'.length) as DocCategory;
    return files.filter((f) => f.category === c);
  }
  if (key.startsWith('party:')) {
    const id = key.slice('party:'.length);
    return files.filter((f) => f.partyId === id);
  }
  if (key.startsWith('date:')) {
    const d = key.slice('date:'.length);
    return files.filter((f) => f.yearMonth.startsWith(d));
  }
  return files;
}

function describeFolder(key: string): { breadcrumb: string[] } {
  if (key === 'all') return { breadcrumb: ['전체'] };
  if (key === 'expiring') return { breadcrumb: ['만료 임박'] };
  if (key.startsWith('cat:')) {
    const c = key.slice('cat:'.length) as DocCategory;
    return { breadcrumb: ['카테고리', CATEGORY_META[c]?.label ?? c] };
  }
  if (key.startsWith('party:')) {
    const id = key.slice('party:'.length);
    const p = PARTIES.find((x) => x.id === id);
    return { breadcrumb: ['회원사별', p?.label ?? id] };
  }
  if (key.startsWith('date:')) {
    const d = key.slice('date:'.length);
    const parts = d.split('-');
    if (parts.length === 1) return { breadcrumb: ['연도·월별', `${parts[0]}년`] };
    return { breadcrumb: ['연도·월별', `${parts[0]}년`, `${parts[1]}월`] };
  }
  return { breadcrumb: [key] };
}

/* ─────────────────────────────────────────────
   Folder Row
   ───────────────────────────────────────────── */
function FolderRow({
  label,
  count,
  active,
  onClick,
  icon: Icon,
  depth = 0,
  expandable,
  expanded,
  onToggle,
  dangerCount,
}: {
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
  icon?: LucideIcon;
  depth?: number;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  dangerCount?: number;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1.5 cursor-pointer transition-colors text-sm',
        active ? 'bg-primary/[0.10] text-primary' : 'text-slate-300 hover:bg-white/[0.04] hover:text-white',
      )}
      style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
    >
      {expandable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
          className="flex h-4 w-4 items-center justify-center text-slate-500 hover:text-white shrink-0"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      )}
      {!expandable && <span className="w-4 shrink-0" />}
      {Icon && <Icon size={14} className="shrink-0" />}
      <span className="flex-1 truncate">{label}</span>
      {dangerCount && dangerCount > 0 ? (
        <span className="text-[10px] tabular-nums text-rose-300">{dangerCount}</span>
      ) : typeof count === 'number' ? (
        <span className={cn('text-[10px] tabular-nums', active ? 'text-primary' : 'text-slate-600')}>{count}</span>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */
function daysUntil(dateStr: string): number {
  const today = new Date('2026-05-05');
  const d = new Date(dateStr.replace(/\./g, '-'));
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/* ─────────────────────────────────────────────
   Page
   ───────────────────────────────────────────── */
export default function PlatformPpaDocumentsPage() {
  const { data: _apiContracts } = usePpaContracts();
  const router = useRouter();
  const [folderKey, setFolderKey] = useState<string>('all');
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(['group:cat', 'group:party', 'group:date', 'date:2026']),
  );
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size' | 'expiry'>('date');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [starred, setStarred] = useState<Set<string>>(new Set(['f5', 'f14']));
  const [previewFile, setPreviewFile] = useState<ArchiveFile | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);

  const toggleExpand = (key: string) =>
    setExpanded((p) => {
      const n = new Set(p);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const toggleSelect = (id: string) =>
    setSelectedIds((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleStar = (id: string) =>
    setStarred((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const counts = useMemo(() => {
    const byCat: Record<string, number> = {};
    const byParty: Record<string, number> = {};
    const byYear: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    let expiringCount = 0;
    for (const f of FILES) {
      byCat[f.category] = (byCat[f.category] ?? 0) + 1;
      if (f.partyId) byParty[f.partyId] = (byParty[f.partyId] ?? 0) + 1;
      const year = f.yearMonth.split('-')[0];
      byYear[year] = (byYear[year] ?? 0) + 1;
      byMonth[f.yearMonth] = (byMonth[f.yearMonth] ?? 0) + 1;
      if (f.expiresAt && daysUntil(f.expiresAt) <= 365) expiringCount++;
    }
    return { byCat, byParty, byYear, byMonth, expiringCount };
  }, []);

  const yearList = useMemo(
    () => Array.from(new Set(FILES.map((f) => f.yearMonth.split('-')[0]))).sort((a, b) => b.localeCompare(a)),
    [],
  );
  const monthsByYear = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const f of FILES) {
      const [y, m] = f.yearMonth.split('-');
      if (!map[y]) map[y] = [];
      if (!map[y].includes(m)) map[y].push(m);
    }
    Object.keys(map).forEach((y) => map[y].sort((a, b) => Number(b) - Number(a)));
    return map;
  }, []);

  const visible = useMemo(() => {
    let out = filterByFolder(FILES, folderKey);
    if (query) {
      const q = query.toLowerCase();
      out = out.filter(
        (f) =>
          f.filename.toLowerCase().includes(q) ||
          (f.partyLabel?.toLowerCase().includes(q) ?? false) ||
          CATEGORY_META[f.category].label.toLowerCase().includes(q),
      );
    }
    out = [...out].sort((a, b) => {
      if (sortBy === 'date') return b.issuedAt.localeCompare(a.issuedAt);
      if (sortBy === 'name') return a.filename.localeCompare(b.filename);
      if (sortBy === 'size') return parseFloat(b.size) - parseFloat(a.size);
      if (sortBy === 'expiry') {
        const aD = a.expiresAt ? daysUntil(a.expiresAt) : Number.MAX_SAFE_INTEGER;
        const bD = b.expiresAt ? daysUntil(b.expiresAt) : Number.MAX_SAFE_INTEGER;
        return aD - bD;
      }
      return 0;
    });
    return out;
  }, [folderKey, query, sortBy]);

  const folderInfo = describeFolder(folderKey);
  const toggleAll = () => {
    if (selectedIds.size === visible.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(visible.map((f) => f.id)));
  };

  const generators = PARTIES.filter((p) => p.type === 'generator');
  const consumers = PARTIES.filter((p) => p.type === 'consumer');
  const spcParties = PARTIES.filter((p) => p.type === 'spc');

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: '전력거래', path: '/platform/trading' }, { label: '직접 PPA' }, { label: '문서 보관함' }]}
      />

      {/* header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">문서 보관함</h1>
          <p className="mt-1 text-sm text-slate-400">
            회원·자격 / 계약 / 발전소 / 정산·결제 / 인증·보고 / 감사·운영 문서가 자동 분류·저장됩니다
          </p>
        </div>
        <Button variant="primary" onClick={() => router.push('/platform/ppa/documents/generation')}>
          <Plus size={14} className="mr-1.5" />
          문서 생성
        </Button>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-white/[0.06] bg-surface-card p-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/[0.10]">
            <ArchiveIcon size={18} className="text-blue-400" />
          </span>
          <div>
            <p className="text-xs text-slate-500">총 파일</p>
            <p className="text-xl font-bold text-white tabular-nums">{FILES.length} 개</p>
          </div>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-surface-card p-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/[0.10]">
            <Star size={18} className="text-amber-400" />
          </span>
          <div>
            <p className="text-xs text-slate-500">즐겨찾기</p>
            <p className="text-xl font-bold text-white tabular-nums">{starred.size} 개</p>
          </div>
        </div>
        <button
          onClick={() => setFolderKey('expiring')}
          className="rounded-lg border border-rose-500/[0.20] bg-rose-500/[0.04] p-4 flex items-center gap-3 hover:bg-rose-500/[0.08] transition-colors text-left"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/[0.12]">
            <AlertTriangle size={18} className="text-rose-300" />
          </span>
          <div>
            <p className="text-xs text-rose-200">만료 임박 (1년 이내)</p>
            <p className="text-xl font-bold text-rose-200 tabular-nums">{counts.expiringCount} 개</p>
          </div>
        </button>
        <div className="rounded-lg border border-white/[0.06] bg-surface-card p-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/[0.10]">
            <HardDrive size={18} className="text-violet-400" />
          </span>
          <div>
            <p className="text-xs text-slate-500">총 용량</p>
            <p className="text-xl font-bold text-white tabular-nums">{TOTAL_SIZE_MB} MB</p>
          </div>
        </div>
      </div>

      {/* Main: folder tree + file list */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Folder Tree */}
        <div className="xl:col-span-3">
          <SectionCard title="폴더">
            <div className="space-y-1 text-sm">
              <FolderRow
                label="전체"
                count={FILES.length}
                icon={ArchiveIcon}
                active={folderKey === 'all'}
                onClick={() => setFolderKey('all')}
              />
              <FolderRow
                label="만료 임박"
                dangerCount={counts.expiringCount}
                icon={AlertTriangle}
                active={folderKey === 'expiring'}
                onClick={() => setFolderKey('expiring')}
              />

              {/* 카테고리별 */}
              <FolderRow
                label="카테고리"
                icon={Hash}
                expandable
                expanded={expanded.has('group:cat')}
                onToggle={() => toggleExpand('group:cat')}
                onClick={() => toggleExpand('group:cat')}
              />
              {expanded.has('group:cat') &&
                (Object.keys(CATEGORY_META) as DocCategory[]).map((c) => {
                  const meta = CATEGORY_META[c];
                  return (
                    <FolderRow
                      key={c}
                      label={meta.label}
                      count={counts.byCat[c] ?? 0}
                      depth={1}
                      icon={meta.icon}
                      active={folderKey === `cat:${c}`}
                      onClick={() => setFolderKey(`cat:${c}`)}
                    />
                  );
                })}

              {/* 회원사별 */}
              <FolderRow
                label="회원사별"
                icon={Building2}
                expandable
                expanded={expanded.has('group:party')}
                onToggle={() => toggleExpand('group:party')}
                onClick={() => toggleExpand('group:party')}
              />
              {expanded.has('group:party') && (
                <>
                  <FolderRow
                    label="발전사 (4)"
                    depth={1}
                    icon={Factory}
                    expandable
                    expanded={expanded.has('party:gen')}
                    onToggle={() => toggleExpand('party:gen')}
                    onClick={() => toggleExpand('party:gen')}
                  />
                  {expanded.has('party:gen') &&
                    generators.map((p) => (
                      <FolderRow
                        key={p.id}
                        label={p.label}
                        count={counts.byParty[p.id] ?? 0}
                        depth={2}
                        icon={Folder}
                        active={folderKey === `party:${p.id}`}
                        onClick={() => setFolderKey(`party:${p.id}`)}
                      />
                    ))}
                  <FolderRow
                    label="수용가 (4)"
                    depth={1}
                    icon={Building2}
                    expandable
                    expanded={expanded.has('party:con')}
                    onToggle={() => toggleExpand('party:con')}
                    onClick={() => toggleExpand('party:con')}
                  />
                  {expanded.has('party:con') &&
                    consumers.map((p) => (
                      <FolderRow
                        key={p.id}
                        label={p.label}
                        count={counts.byParty[p.id] ?? 0}
                        depth={2}
                        icon={Folder}
                        active={folderKey === `party:${p.id}`}
                        onClick={() => setFolderKey(`party:${p.id}`)}
                      />
                    ))}
                  {spcParties.map((p) => (
                    <FolderRow
                      key={p.id}
                      label={p.label}
                      count={counts.byParty[p.id] ?? 0}
                      depth={1}
                      icon={Shield}
                      active={folderKey === `party:${p.id}`}
                      onClick={() => setFolderKey(`party:${p.id}`)}
                    />
                  ))}
                </>
              )}

              {/* 연도·월별 */}
              <FolderRow
                label="연도·월별"
                icon={CalendarIcon}
                expandable
                expanded={expanded.has('group:date')}
                onToggle={() => toggleExpand('group:date')}
                onClick={() => toggleExpand('group:date')}
              />
              {expanded.has('group:date') &&
                yearList.map((y) => (
                  <div key={y}>
                    <FolderRow
                      label={`${y}년`}
                      count={counts.byYear[y]}
                      depth={1}
                      icon={Folder}
                      expandable
                      expanded={expanded.has(`date:${y}`)}
                      onToggle={() => toggleExpand(`date:${y}`)}
                      active={folderKey === `date:${y}`}
                      onClick={() => setFolderKey(`date:${y}`)}
                    />
                    {expanded.has(`date:${y}`) &&
                      monthsByYear[y].map((m) => (
                        <FolderRow
                          key={`${y}.${m}`}
                          label={`${m}월`}
                          count={counts.byMonth[`${y}.${m}`]}
                          depth={2}
                          icon={Folder}
                          active={folderKey === `date:${y}.${m}`}
                          onClick={() => setFolderKey(`date:${y}.${m}`)}
                        />
                      ))}
                  </div>
                ))}
            </div>
          </SectionCard>
        </div>

        {/* File list */}
        <div className="xl:col-span-9">
          <div className="rounded-lg border border-white/[0.06] bg-surface-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-white/[0.06]">
              <span className="flex items-center gap-1.5 text-sm">
                {folderInfo.breadcrumb.map((seg, i, arr) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span className={cn(i === arr.length - 1 ? 'text-white font-semibold' : 'text-slate-500')}>
                      {seg}
                    </span>
                    {i < arr.length - 1 && <ChevronRight size={12} className="text-slate-700" />}
                  </span>
                ))}
                <span className="ml-2 text-xs text-slate-500 tabular-nums">({visible.length}건)</span>
              </span>
              <div className="flex items-center gap-2">
                <div className="relative w-56">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input
                    type="text"
                    placeholder="파일명·카테고리·회원사 검색"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Dropdown
                  align="right"
                  trigger={
                    <button className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white hover:bg-white/[0.08]">
                      <span className="text-xs text-slate-500">정렬</span>
                      <span>
                        {sortBy === 'date'
                          ? '최신순'
                          : sortBy === 'name'
                            ? '이름순'
                            : sortBy === 'size'
                              ? '크기순'
                              : '만료 임박순'}
                      </span>
                      <ChevronDown size={14} className="text-slate-500" />
                    </button>
                  }
                >
                  <DropdownItem onClick={() => setSortBy('date')}>최신순</DropdownItem>
                  <DropdownItem onClick={() => setSortBy('name')}>이름순</DropdownItem>
                  <DropdownItem onClick={() => setSortBy('size')}>크기순</DropdownItem>
                  <DropdownItem onClick={() => setSortBy('expiry')}>만료 임박순</DropdownItem>
                </Dropdown>
                <Button size="sm" variant="ghost" onClick={() => setAuditOpen(true)}>
                  <History size={12} className="mr-1.5" />
                  감사 로그
                </Button>
                <div className="flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/[0.06]">
                  <button
                    onClick={() => setViewMode('list')}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded transition-colors',
                      viewMode === 'list' ? 'bg-primary text-white' : 'text-slate-500 hover:text-white',
                    )}
                  >
                    <List size={14} />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded transition-colors',
                      viewMode === 'grid' ? 'bg-primary text-white' : 'text-slate-500 hover:text-white',
                    )}
                  >
                    <Grid3x3 size={14} />
                  </button>
                </div>
              </div>
            </div>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 px-6 py-2 bg-primary/[0.06] border-b border-white/[0.06]">
                <span className="text-xs text-slate-300 font-medium">{selectedIds.size}건 선택</span>
                <Button size="sm" variant="primary">
                  <ArchiveIcon size={14} className="mr-1.5" />
                  ZIP 다운
                </Button>
                <Button size="sm" variant="secondary">
                  <Mail size={14} className="mr-1.5" />
                  일괄 이메일
                </Button>
                <Button size="sm" variant="secondary">
                  <Droplets size={14} className="mr-1.5" />
                  워터마크 ON
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="ml-auto">
                  해제
                </Button>
              </div>
            )}

            {/* List view */}
            {viewMode === 'list' && (
              <div className="divide-y divide-white/[0.04]">
                <div className="flex items-center gap-3 px-6 py-2 text-[11px] text-slate-500 bg-white/[0.02]">
                  <input
                    type="checkbox"
                    checked={visible.length > 0 && selectedIds.size === visible.length}
                    onChange={toggleAll}
                    className="cursor-pointer accent-primary"
                  />
                  <span className="w-6" />
                  <span className="flex-1">파일</span>
                  <span className="w-24">카테고리</span>
                  <span className="w-24">회원사</span>
                  <span className="w-28 text-right">만료일</span>
                  <span className="w-16 text-right">크기</span>
                  <span className="w-32 text-right">작업</span>
                </div>

                {visible.map((f) => {
                  const meta = CATEGORY_META[f.category];
                  const isStarred = starred.has(f.id);
                  const dDay = f.expiresAt ? daysUntil(f.expiresAt) : null;
                  const isExpiring = dDay !== null && dDay <= 365;
                  return (
                    <div
                      key={f.id}
                      className={cn(
                        'flex items-center gap-3 px-6 py-3 hover:bg-white/[0.02] transition-colors',
                        selectedIds.has(f.id) && 'bg-primary/[0.04]',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(f.id)}
                        onChange={() => toggleSelect(f.id)}
                        className="cursor-pointer accent-primary"
                      />
                      <button
                        onClick={() => toggleStar(f.id)}
                        className={cn('shrink-0', isStarred ? 'text-amber-400' : 'text-slate-700 hover:text-amber-400')}
                      >
                        <Star size={14} className={isStarred ? 'fill-amber-400' : ''} />
                      </button>
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-md ring-1',
                          meta.bg,
                          meta.ring,
                        )}
                      >
                        <meta.icon size={14} className={meta.tone} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-white truncate">{f.filename}</p>
                          {f.watermark && <Droplets size={10} className="text-blue-400 shrink-0" title="워터마크" />}
                        </div>
                        {f.partyLabel && <p className="text-[11px] text-slate-500">{f.partyLabel}</p>}
                      </div>
                      <span
                        className={cn(
                          'w-24 shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
                          meta.bg,
                          meta.tone,
                          meta.ring,
                        )}
                      >
                        <meta.icon size={10} />
                        {meta.label}
                      </span>
                      <span className="w-24 shrink-0 text-xs text-slate-400 truncate">{f.partyLabel}</span>
                      <span className="w-28 shrink-0 text-right">
                        {f.expiresAt && dDay !== null ? (
                          <>
                            <p
                              className={cn(
                                'text-xs tabular-nums',
                                isExpiring ? 'text-rose-300 font-semibold' : 'text-slate-400',
                              )}
                            >
                              {f.expiresAt}
                            </p>
                            <p
                              className={cn(
                                'text-[10px] tabular-nums',
                                dDay <= 90 ? 'text-rose-400' : dDay <= 365 ? 'text-amber-400' : 'text-slate-600',
                              )}
                            >
                              D{dDay >= 0 ? '-' : '+'}
                              {Math.abs(dDay)}
                            </p>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-700">—</span>
                        )}
                      </span>
                      <span className="w-16 shrink-0 text-right text-xs text-slate-500 tabular-nums">{f.size}</span>
                      <div className="w-32 shrink-0 flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPreviewFile(f)}
                          className="rounded p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-white"
                          title="미리보기"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => exportPdf(f.filename, f.filename, ['항목', '값'], [[f.category, f.issuedAt]])}
                          className="rounded p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-white"
                          title="다운로드"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`"${f.filename}" 파일을 담당자에게 이메일 발송하시겠습니까?`))
                              useToastStore.getState().add('success', '이메일 발송 요청 완료');
                          }}
                          className="rounded p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-white"
                          title="이메일"
                        >
                          <Mail size={14} />
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `${window.location.origin}/platform/ppa/documents?file=${f.id}`,
                            );
                            useToastStore.getState().add('success', '워터마크 공유 링크가 클립보드에 복사되었습니다');
                          }}
                          className="rounded p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-white"
                          title="공유 (워터마크 자동)"
                        >
                          <Share2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {visible.length === 0 && (
                  <div className="px-6 py-16 text-center text-sm text-slate-500">조건에 맞는 문서가 없습니다</div>
                )}
              </div>
            )}

            {/* Grid view */}
            {viewMode === 'grid' && (
              <div className="px-6 py-4">
                {visible.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-500">조건에 맞는 문서가 없습니다</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {visible.map((f) => {
                      const meta = CATEGORY_META[f.category];
                      const isStarred = starred.has(f.id);
                      const dDay = f.expiresAt ? daysUntil(f.expiresAt) : null;
                      const isExpiring = dDay !== null && dDay <= 365;
                      return (
                        <div
                          key={f.id}
                          className={cn(
                            'rounded-lg border p-3 transition-colors',
                            selectedIds.has(f.id)
                              ? 'border-primary/40 bg-primary/[0.04]'
                              : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.15]',
                          )}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(f.id)}
                              onChange={() => toggleSelect(f.id)}
                              className="cursor-pointer accent-primary"
                            />
                            <button
                              onClick={() => toggleStar(f.id)}
                              className={cn(isStarred ? 'text-amber-400' : 'text-slate-700 hover:text-amber-400')}
                            >
                              <Star size={14} className={isStarred ? 'fill-amber-400' : ''} />
                            </button>
                          </div>
                          <div
                            className={cn(
                              'mb-3 flex h-24 items-center justify-center rounded-md ring-1 relative',
                              meta.bg,
                              meta.ring,
                            )}
                          >
                            <meta.icon size={32} className={meta.tone} />
                            {f.watermark && (
                              <span className="absolute top-1 right-1 rounded bg-blue-500/[0.20] ring-1 ring-blue-500/30 p-0.5">
                                <Droplets size={9} className="text-blue-300" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-white truncate" title={f.filename}>
                            {f.filename}
                          </p>
                          <div className="mt-1 flex items-center gap-1 flex-wrap">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                                meta.bg,
                                meta.tone,
                              )}
                            >
                              {meta.label}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                            {f.issuedAt} · {f.size}
                          </p>
                          {isExpiring && dDay !== null && (
                            <p
                              className={cn(
                                'mt-0.5 text-[10px] tabular-nums',
                                dDay <= 90 ? 'text-rose-400' : 'text-amber-400',
                              )}
                            >
                              ⚠ 만료 D-{Math.abs(dDay)}
                            </p>
                          )}
                          <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-end gap-0.5">
                            <button
                              onClick={() => setPreviewFile(f)}
                              className="rounded p-1 text-slate-500 hover:bg-white/[0.06] hover:text-white"
                              title="미리보기"
                            >
                              <Eye size={12} />
                            </button>
                            <button
                              onClick={() =>
                                exportPdf(f.filename, f.filename, ['항목', '값'], [[f.category, f.issuedAt]])
                              }
                              className="rounded p-1 text-slate-500 hover:bg-white/[0.06] hover:text-white"
                              title="다운로드"
                            >
                              <Download size={12} />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`"${f.filename}" 파일을 이메일 발송하시겠습니까?`))
                                  useToastStore.getState().add('success', '이메일 발송 요청 완료');
                              }}
                              className="rounded p-1 text-slate-500 hover:bg-white/[0.06] hover:text-white"
                              title="이메일"
                            >
                              <Mail size={12} />
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  `${window.location.origin}/platform/ppa/documents?file=${f.id}`,
                                );
                                useToastStore.getState().add('success', '공유 링크가 복사되었습니다');
                              }}
                              className="rounded p-1 text-slate-500 hover:bg-white/[0.06] hover:text-white"
                              title="공유"
                            >
                              <Share2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 미리보기 모달 */}
      {previewFile && (
        <Modal
          open={!!previewFile}
          onClose={() => setPreviewFile(null)}
          size="xl"
          title={previewFile.filename}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPreviewFile(null)}>
                닫기
              </Button>
              <Button variant="secondary" onClick={() => setAuditOpen(true)}>
                <History size={12} className="mr-1.5" />
                열람 이력
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (!window.confirm(`"${previewFile.filename}" 문서를 이메일로 발송하시겠습니까?`)) return;
                  useToastStore.getState().add('success', '이메일 발송 요청 완료');
                }}
              >
                <Mail size={14} className="mr-1.5" />
                이메일
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/platform/ppa/documents?file=${previewFile.id}`,
                  );
                  useToastStore.getState().add('success', '워터마크 공유 링크가 클립보드에 복사되었습니다');
                }}
              >
                <Share2 size={14} className="mr-1.5" />
                공유 (워터마크)
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  exportPdf(
                    previewFile.filename,
                    previewFile.filename,
                    ['항목', '값'],
                    [[previewFile.category, previewFile.issuedDate]],
                  )
                }
              >
                <Download size={14} className="mr-1.5" />
                다운로드
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 max-h-[70vh] overflow-y-auto">
            <div className="lg:col-span-2">
              <div
                className={cn(
                  'mx-auto w-full max-w-md aspect-[1/1.4] rounded-lg p-8 flex flex-col ring-1 shadow-lg relative',
                  CATEGORY_META[previewFile.category].bg.replace('/[0.08]', '/[0.04]'),
                  CATEGORY_META[previewFile.category].ring,
                )}
              >
                {previewFile.watermark && (
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-blue-500/[0.20] ring-1 ring-blue-500/30 px-2 py-0.5 text-[10px] text-blue-200">
                    <Droplets size={10} />
                    워터마크
                  </span>
                )}
                <div className="text-center pb-4 border-b border-white/[0.08]">
                  <div className="flex justify-center">
                    {(() => {
                      const Icon = CATEGORY_META[previewFile.category].icon;
                      return <Icon size={36} className={CATEGORY_META[previewFile.category].tone} />;
                    })()}
                  </div>
                  <p className="mt-2 text-sm font-bold text-white">{CATEGORY_META[previewFile.category].label}</p>
                  <p className="mt-0.5 text-xs text-slate-400 truncate">{previewFile.filename}</p>
                  <p className="text-[10px] text-slate-500 mt-1 tabular-nums">{previewFile.issuedAt}</p>
                </div>
                <div className="flex-1 mt-5 space-y-2.5 overflow-hidden">
                  <div className="h-1.5 rounded-full bg-white/[0.10] w-full" />
                  <div className="h-1.5 rounded-full bg-white/[0.10] w-5/6" />
                  <div className="h-1.5 rounded-full bg-white/[0.10] w-full" />
                  <div className="h-1.5 rounded-full bg-white/[0.10] w-3/4" />
                  <div className="pt-4">
                    <div className="h-2 rounded bg-white/[0.14] w-1/2 mb-2" />
                    <div className="h-1.5 rounded-full bg-white/[0.10] w-full" />
                    <div className="h-1.5 rounded-full bg-white/[0.10] w-full mt-1.5" />
                    <div className="h-1.5 rounded-full bg-white/[0.10] w-4/5 mt-1.5" />
                  </div>
                </div>
                <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-slate-500">
                  <span>1 / 1</span>
                  <span>— 미리보기 —</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-300 mb-2">분류</p>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1',
                    CATEGORY_META[previewFile.category].bg,
                    CATEGORY_META[previewFile.category].tone,
                    CATEGORY_META[previewFile.category].ring,
                  )}
                >
                  {CATEGORY_META[previewFile.category].label}
                </span>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-300 mb-2">파일 정보</p>
                <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                  <DetailRow label="파일명" value={previewFile.filename} />
                  <DetailRow label="발급일" value={previewFile.issuedAt} mono />
                  <DetailRow label="크기" value={previewFile.size} />
                  <DetailRow label="회원사" value={previewFile.partyLabel ?? '—'} />
                </div>
              </div>

              {previewFile.expiresAt && (
                <div>
                  <p className="text-xs font-semibold text-slate-300 mb-2">만료일</p>
                  {(() => {
                    const dDay = daysUntil(previewFile.expiresAt);
                    const isClose = dDay <= 365;
                    return (
                      <div
                        className={cn(
                          'rounded-lg ring-1 p-3',
                          isClose ? 'ring-amber-500/[0.20] bg-amber-500/[0.04]' : 'ring-white/[0.06] bg-white/[0.02]',
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn('text-xs', isClose ? 'text-amber-300' : 'text-slate-400')}>만료</span>
                          <span
                            className={cn('text-sm font-bold tabular-nums', isClose ? 'text-amber-200' : 'text-white')}
                          >
                            {previewFile.expiresAt}
                          </span>
                        </div>
                        <p
                          className={cn(
                            'mt-1 text-[11px] tabular-nums text-right',
                            dDay <= 90
                              ? 'text-rose-300 font-semibold'
                              : dDay <= 365
                                ? 'text-amber-300'
                                : 'text-slate-500',
                          )}
                        >
                          D{dDay >= 0 ? '-' : '+'}
                          {Math.abs(dDay)}
                          {isClose ? ' · 만료 임박' : ''}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-slate-300 mb-2">공유 정책</p>
                <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Droplets size={12} className={previewFile.watermark ? 'text-blue-400' : 'text-slate-700'} />
                    <span className={previewFile.watermark ? 'text-blue-300' : 'text-slate-500'}>
                      워터마크 {previewFile.watermark ? '자동 삽입 (외부 공유 시)' : '미적용'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* 감사 로그 모달 */}
      {auditOpen && (
        <Modal
          open={auditOpen}
          onClose={() => setAuditOpen(false)}
          size="lg"
          title="감사 로그 — 다운로드·열람 이력"
          footer={
            <Button variant="ghost" onClick={() => setAuditOpen(false)}>
              닫기
            </Button>
          }
        >
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {AUDIT_LOG.map((log) => {
              const file = FILES.find((f) => f.id === log.fileId);
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs"
                >
                  <span className="text-slate-500 tabular-nums w-32 shrink-0 pt-0.5">{log.datetime}</span>
                  <span className="text-violet-300 shrink-0">{log.actor}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">{log.action}</p>
                    {file && <p className="text-[11px] text-slate-500 truncate">{file.filename}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className={cn('text-sm text-white text-right truncate', mono && 'tabular-nums')}>{value}</span>
    </div>
  );
}
