// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import {
  Folder,
  _FolderOpen,
  ChevronRight,
  ChevronDown,
  Search,
  Download,
  Mail,
  Share2,
  Eye,
  Star,
  Archive as ArchiveIcon,
  FileText,
  Receipt,
  Handshake,
  FileSignature,
  Award,
  CheckCircle2,
  Wrench,
  Grid3x3,
  List,
  Building2,
  Hash,
  HardDrive,
  Sun,
  _Wind,
  Battery,
  Calendar as CalendarIcon,
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

/* ───────────────────────── Types ───────────────────────── */

type DocType = 'contract' | 'settlement' | 'invoice' | 'rec' | 'verification' | 'maintenance' | 'notice';

interface ArchiveFile {
  id: string;
  filename: string;
  type: DocType;
  plantId?: string;
  plantLabel?: string;
  issuedAt: string;
  yearMonth: string;
  source: '계약 관리' | '수익 관리' | '자원 관리';
  size: string;
  status: 'issued' | 'pending';
}

const TYPE_META: Record<DocType, { label: string; icon: LucideIcon; tone: string; bg: string; ring: string }> = {
  contract: {
    label: 'SPC 계약서',
    icon: Handshake,
    tone: 'text-emerald-300',
    bg: 'bg-emerald-500/[0.08]',
    ring: 'ring-emerald-500/30',
  },
  settlement: {
    label: '정산서',
    icon: Receipt,
    tone: 'text-blue-300',
    bg: 'bg-blue-500/[0.08]',
    ring: 'ring-blue-500/30',
  },
  invoice: {
    label: '세금계산서',
    icon: FileText,
    tone: 'text-sky-300',
    bg: 'bg-sky-500/[0.08]',
    ring: 'ring-sky-500/30',
  },
  rec: {
    label: 'REC 증명서',
    icon: Award,
    tone: 'text-violet-300',
    bg: 'bg-violet-500/[0.08]',
    ring: 'ring-violet-500/30',
  },
  verification: {
    label: '설비확인서',
    icon: CheckCircle2,
    tone: 'text-amber-300',
    bg: 'bg-amber-500/[0.08]',
    ring: 'ring-amber-500/30',
  },
  maintenance: {
    label: '정비 보고서',
    icon: Wrench,
    tone: 'text-rose-300',
    bg: 'bg-rose-500/[0.08]',
    ring: 'ring-rose-500/30',
  },
  notice: {
    label: '거래소 신고서',
    icon: FileSignature,
    tone: 'text-slate-300',
    bg: 'bg-slate-500/[0.08]',
    ring: 'ring-slate-500/30',
  },
};

import { useMonitoringPlants } from '@/hooks/monitoring/useMonitoring';

const STATIC_PLANTS: { id: string; label: string; icon: any; color: string }[] = [];

const STATIC_FILES: ArchiveFile[] = [];

const TOTAL_SIZE_MB = 9;

/* ───────────────────────── Folder helpers ───────────────────────── */

function filterByFolder(files: ArchiveFile[], key: string): ArchiveFile[] {
  if (key === 'all') return files;
  if (key.startsWith('plant:')) {
    const id = key.slice('plant:'.length);
    return files.filter((f) => f.plantId === id);
  }
  if (key.startsWith('type:')) {
    const t = key.slice('type:'.length) as DocType;
    return files.filter((f) => f.type === t);
  }
  if (key.startsWith('date:')) {
    const d = key.slice('date:'.length);
    return files.filter((f) => f.yearMonth.startsWith(d));
  }
  return files;
}

function describeFolder(key: string): { breadcrumb: string[] } {
  if (key === 'all') return { breadcrumb: ['전체'] };
  if (key.startsWith('plant:')) {
    const id = key.slice('plant:'.length);
    const p = STATIC_PLANTS.find((x) => x.id === id);
    return { breadcrumb: ['발전소별', p?.label ?? id] };
  }
  if (key.startsWith('type:')) {
    const t = key.slice('type:'.length) as DocType;
    return { breadcrumb: ['종류별', TYPE_META[t]?.label ?? t] };
  }
  if (key.startsWith('date:')) {
    const d = key.slice('date:'.length);
    const parts = d.split('-');
    if (parts.length === 1) return { breadcrumb: ['연도·월별', `${parts[0]}년`] };
    return { breadcrumb: ['연도·월별', `${parts[0]}년`, `${parts[1]}월`] };
  }
  return { breadcrumb: [key] };
}

/* ───────────────────────── Folder Tree row ───────────────────────── */

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
      {typeof count === 'number' && (
        <span className={cn('text-[10px] tabular-nums', active ? 'text-primary' : 'text-slate-600')}>{count}</span>
      )}
    </div>
  );
}

/* ───────────────────────── Preview Modal ───────────────────────── */

function PreviewMetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="text-sm text-white text-right truncate">{value}</span>
    </div>
  );
}

function FilePreviewModal({
  file,
  onClose,
  onToggleStar,
  isStarred,
}: {
  file: ArchiveFile | null;
  onClose: () => void;
  onToggleStar?: (id: string) => void;
  isStarred?: boolean;
}) {
  if (!file) return null;
  const meta = TYPE_META[file.type];
  return (
    <Modal
      open={!!file}
      onClose={onClose}
      size="xl"
      title={file.filename}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            닫기
          </Button>
          {onToggleStar && (
            <Button
              variant="secondary"
              onClick={() => onToggleStar(file.id)}
              className={isStarred ? 'text-amber-400' : ''}
            >
              <Star size={14} className={cn('mr-1.5', isStarred && 'fill-amber-400')} />
              {isStarred ? '즐겨찾기 해제' : '즐겨찾기'}
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              if (!window.confirm(`"${file.filename}" 문서를 이메일로 발송하시겠습니까?`)) return;
              useToastStore.getState().add('success', '이메일 발송 요청 완료');
            }}
          >
            <Mail size={14} className="mr-1.5" />
            이메일
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/generator/ppa/documents?file=${file.id}`);
              useToastStore.getState().add('success', '공유 링크가 클립보드에 복사되었습니다');
            }}
          >
            <Share2 size={14} className="mr-1.5" />
            공유 링크
          </Button>
          <Button
            variant="primary"
            onClick={() => exportPdf(file.filename, file.filename, ['항목', '값'], [[file.type, file.issuedDate]])}
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
              'mx-auto w-full max-w-md aspect-[1/1.4] rounded-lg p-8 flex flex-col ring-1 shadow-lg',
              meta.bg.replace('/[0.08]', '/[0.04]'),
              meta.ring,
            )}
          >
            <div className="text-center pb-4 border-b border-white/[0.08]">
              <div className="flex justify-center">
                <meta.icon size={36} className={meta.tone} />
              </div>
              <p className="mt-2 text-sm font-bold text-white">{meta.label}</p>
              <p className="mt-0.5 text-xs text-slate-400 truncate">{file.filename}</p>
              <p className="text-[10px] text-slate-500 mt-1 tabular-nums">{file.issuedAt}</p>
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
              <div className="pt-6 flex items-end justify-end">
                <div
                  className={cn('h-12 w-12 rounded-full ring-2 flex items-center justify-center', meta.ring, meta.bg)}
                >
                  <meta.icon size={18} className={meta.tone} />
                </div>
              </div>
            </div>
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-slate-500">
              <span>1 / 1</span>
              <span>— 미리보기 —</span>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-slate-500">
            ※ 실제 환경에서는 PDF.js / react-pdf 등으로 PDF 페이지가 렌더링됩니다.
          </p>
        </div>
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-slate-300 mb-2">종류</p>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1',
                meta.bg,
                meta.tone,
                meta.ring,
              )}
            >
              <meta.icon size={11} />
              {meta.label}
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-300 mb-2">파일 정보</p>
            <div className="space-y-0.5">
              <PreviewMetaRow label="파일명" value={file.filename} />
              <PreviewMetaRow label="발급일" value={<span className="tabular-nums">{file.issuedAt}</span>} />
              <PreviewMetaRow label="크기" value={file.size} />
              <PreviewMetaRow label="출처" value={file.source} />
              <PreviewMetaRow
                label="상태"
                value={
                  <span className={file.status === 'issued' ? 'text-emerald-300' : 'text-amber-300'}>
                    {file.status === 'issued' ? '발급완료' : '대기'}
                  </span>
                }
              />
            </div>
          </div>
          {file.plantLabel && (
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">발전소 연결</p>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <p className="text-sm text-white">{file.plantLabel}</p>
                <p className="mt-0.5 text-xs text-slate-400">자원 관리 → 상세 보기 →</p>
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-slate-300 mb-2">버전 이력</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2 rounded-lg bg-primary/[0.08] ring-1 ring-primary/20 px-3 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-white font-medium">v1.0</span>
                <span className="text-slate-500 ml-auto tabular-nums">{file.issuedAt}</span>
              </div>
              <p className="text-[11px] text-slate-500 px-3">최초 발급</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Page ───────────────────────── */

export default function GeneratorPpaDocumentsPage() {
  const { data: monitoringData } = useMonitoringPlants(true);
  const PLANTS = useMemo(() => {
    const raw = (monitoringData ?? []) as any[];
    if (raw.length === 0) return STATIC_PLANTS;
    return raw.map((p: any) => ({
      id: String(p.plantId ?? p.id),
      label: p.name ?? '발전소',
      icon: p.type === 'SOLAR' ? Sun : p.type === 'ORC' ? Zap : Battery,
      color: p.type === 'SOLAR' ? 'text-amber-400' : p.type === 'ORC' ? 'text-violet-400' : 'text-rose-400',
    }));
  }, [monitoringData]);
  const FILES = STATIC_FILES;

  const [folderKey, setFolderKey] = useState<string>('all');
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(['group:plant', 'group:type', 'group:date', 'date:2026']),
  );
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [starred, setStarred] = useState<Set<string>>(new Set(['f-1', 'f-9']));
  const [previewFile, setPreviewFile] = useState<ArchiveFile | null>(null);

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
    const byPlant: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byYear: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    for (const f of FILES) {
      if (f.plantId) byPlant[f.plantId] = (byPlant[f.plantId] ?? 0) + 1;
      byType[f.type] = (byType[f.type] ?? 0) + 1;
      const year = f.yearMonth.split('-')[0];
      byYear[year] = (byYear[year] ?? 0) + 1;
      byMonth[f.yearMonth] = (byMonth[f.yearMonth] ?? 0) + 1;
    }
    return { byPlant, byType, byYear, byMonth };
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
          (f.plantLabel?.toLowerCase().includes(q) ?? false) ||
          TYPE_META[f.type].label.toLowerCase().includes(q),
      );
    }
    out = [...out].sort((a, b) => {
      if (sortBy === 'date') return b.issuedAt.localeCompare(a.issuedAt);
      if (sortBy === 'name') return a.filename.localeCompare(b.filename);
      if (sortBy === 'size') return parseFloat(b.size) - parseFloat(a.size);
      return 0;
    });
    return out;
  }, [folderKey, query, sortBy]);

  const folderInfo = describeFolder(folderKey);

  const toggleAll = () => {
    if (selectedIds.size === visible.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(visible.map((f) => f.id)));
  };

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: '전력거래', path: '/generator/trading' }, { label: '직접 PPA' }, { label: '보고서' }]}
      />

      <div>
        <h1 className="text-2xl font-bold text-white">문서 보관함</h1>
        <p className="mt-1 text-sm text-slate-400">발급된 모든 문서가 자동으로 분류·저장됩니다</p>
      </div>

      {/* Top Stats */}
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
        <div className="rounded-lg border border-white/[0.06] bg-surface-card p-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/[0.10]">
            <CalendarIcon size={18} className="text-emerald-400" />
          </span>
          <div>
            <p className="text-xs text-slate-500">최근 추가</p>
            <p className="text-xl font-bold text-white tabular-nums">2026-05-10</p>
          </div>
        </div>
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

      {/* Main: Folder tree + File list */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
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

              {/* 발전소별 */}
              <FolderRow
                label="발전소별"
                icon={Building2}
                expandable
                expanded={expanded.has('group:plant')}
                onToggle={() => toggleExpand('group:plant')}
                onClick={() => toggleExpand('group:plant')}
              />
              {expanded.has('group:plant') &&
                PLANTS.map((p) => (
                  <FolderRow
                    key={p.id}
                    label={p.label}
                    count={counts.byPlant[p.id] ?? 0}
                    depth={1}
                    icon={Folder}
                    active={folderKey === `plant:${p.id}`}
                    onClick={() => setFolderKey(`plant:${p.id}`)}
                  />
                ))}

              {/* 종류별 */}
              <FolderRow
                label="종류별"
                icon={Hash}
                expandable
                expanded={expanded.has('group:type')}
                onToggle={() => toggleExpand('group:type')}
                onClick={() => toggleExpand('group:type')}
              />
              {expanded.has('group:type') &&
                (Object.keys(TYPE_META) as DocType[]).map((t) => {
                  const meta = TYPE_META[t];
                  return (
                    <FolderRow
                      key={t}
                      label={meta.label}
                      count={counts.byType[t] ?? 0}
                      depth={1}
                      icon={meta.icon}
                      active={folderKey === `type:${t}`}
                      onClick={() => setFolderKey(`type:${t}`)}
                    />
                  );
                })}

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
                          count={counts.byMonth[`${y}-${m}`]}
                          depth={2}
                          icon={Folder}
                          active={folderKey === `date:${y}-${m}`}
                          onClick={() => setFolderKey(`date:${y}-${m}`)}
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
                    placeholder="파일명·종류·발전소 검색"
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
                      <span>{sortBy === 'date' ? '최신순' : sortBy === 'name' ? '이름순' : '크기순'}</span>
                      <ChevronDown size={14} className="text-slate-500" />
                    </button>
                  }
                >
                  <DropdownItem onClick={() => setSortBy('date')}>최신순</DropdownItem>
                  <DropdownItem onClick={() => setSortBy('name')}>이름순</DropdownItem>
                  <DropdownItem onClick={() => setSortBy('size')}>크기순</DropdownItem>
                </Dropdown>
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
                  <Star size={14} className="mr-1.5" />
                  즐겨찾기
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="ml-auto">
                  해제
                </Button>
              </div>
            )}

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
                  <span className="w-24">종류</span>
                  <span className="w-24">출처</span>
                  <span className="w-24">발급일</span>
                  <span className="w-16 text-right">크기</span>
                  <span className="w-32 text-right">작업</span>
                </div>

                {visible.map((f) => {
                  const meta = TYPE_META[f.type];
                  const isStarred = starred.has(f.id);
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
                        <p className="text-sm font-medium text-white truncate">{f.filename}</p>
                        {f.plantLabel && <p className="text-[11px] text-slate-500">{f.plantLabel}</p>}
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
                      <span className="w-24 shrink-0 text-xs text-slate-400">{f.source}</span>
                      <span className="w-24 shrink-0 text-xs text-slate-400 tabular-nums">{f.issuedAt}</span>
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
                          onClick={() => exportPdf(f.filename, f.filename, ['항목', '값'], [[f.type, f.issuedAt]])}
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
                              `${window.location.origin}/generator/ppa/documents?file=${f.id}`,
                            );
                            useToastStore.getState().add('success', '공유 링크가 클립보드에 복사되었습니다');
                          }}
                          className="rounded p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-white"
                          title="공유 링크"
                        >
                          <Share2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {viewMode === 'grid' && (
              <div className="px-6 py-4">
                {visible.length === 0 ? null : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {visible.map((f) => {
                      const meta = TYPE_META[f.type];
                      const isStarred = starred.has(f.id);
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
                              'mb-3 flex h-24 items-center justify-center rounded-md ring-1',
                              meta.bg,
                              meta.ring,
                            )}
                          >
                            <meta.icon size={32} className={meta.tone} />
                          </div>
                          <p className="text-xs font-medium text-white truncate" title={f.filename}>
                            {f.filename}
                          </p>
                          <div className="mt-1 flex items-center gap-1">
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
                          <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-end gap-0.5">
                            <button
                              onClick={() => setPreviewFile(f)}
                              className="rounded p-1 text-slate-500 hover:bg-white/[0.06] hover:text-white"
                              title="미리보기"
                            >
                              <Eye size={12} />
                            </button>
                            <button
                              onClick={() => exportPdf(f.filename, f.filename, ['항목', '값'], [[f.type, f.issuedAt]])}
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
                                  `${window.location.origin}/generator/ppa/documents?file=${f.id}`,
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

      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onToggleStar={toggleStar}
        isStarred={previewFile ? starred.has(previewFile.id) : false}
      />
    </div>
  );
}
