// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  FileSignature,
  Receipt,
  Award,
  ShieldCheck,
  Handshake,
  Send,
  Save,
  Eye,
  Plus,
  Sparkles,
  Droplets,
  ChevronLeft,
  Search,
  CheckCircle2,
  AlertCircle,
  Hash,
  Building2,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit3,
  GripVertical,
  FileEdit,
  _FilePlus,
  Type,
  Calendar as CalendarIcon,
  ListChecks,
  AlignLeft,
  Copy,
  _X,
  Table as TableIcon,
  Columns,
  _Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { usePpaSettlements } from '@/hooks/ppa/usePpa';
import { useMonitoringPlants } from '@/hooks/monitoring/useMonitoring';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */
type Category = 'contract' | 'settlement' | 'certificate' | 'audit' | 'notice';
type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea' | 'party' | 'table';
type CellType = 'text' | 'number' | 'date' | 'select';

interface TableColumn {
  key: string;
  label: string;
  type: CellType;
  options?: string[]; // select일 때
  width?: 'narrow' | 'auto' | 'wide';
}

interface Field {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  helper?: string;
  columns?: TableColumn[]; // type === 'table'일 때
  minRows?: number; // 표 최소 행 수
}

interface Template {
  id: string;
  category: Category;
  name: string;
  desc: string;
  defaultWatermark: boolean;
  hasExpiry?: boolean;
  fields: Field[];
  builtIn?: boolean; // 기본 제공 템플릿
  updatedAt?: string; // 마지막 수정일
}

const CATEGORY_META: Record<Category, { label: string; icon: any; tone: string; bg: string; ring: string }> = {
  contract: {
    label: '계약 문서',
    icon: Handshake,
    tone: 'text-emerald-300',
    bg: 'bg-emerald-500/[0.10]',
    ring: 'ring-emerald-500/30',
  },
  settlement: {
    label: '정산·결제',
    icon: Receipt,
    tone: 'text-violet-300',
    bg: 'bg-violet-500/[0.10]',
    ring: 'ring-violet-500/30',
  },
  certificate: {
    label: '인증·보고',
    icon: Award,
    tone: 'text-cyan-300',
    bg: 'bg-cyan-500/[0.10]',
    ring: 'ring-cyan-500/30',
  },
  audit: {
    label: '감사·운영',
    icon: ShieldCheck,
    tone: 'text-rose-300',
    bg: 'bg-rose-500/[0.10]',
    ring: 'ring-rose-500/30',
  },
  notice: {
    label: '고지·통지',
    icon: FileSignature,
    tone: 'text-amber-300',
    bg: 'bg-amber-500/[0.10]',
    ring: 'ring-amber-500/30',
  },
};

const FIELD_TYPE_META: Record<FieldType, { label: string; icon: any }> = {
  text: { label: '짧은 텍스트', icon: Type },
  textarea: { label: '긴 텍스트', icon: AlignLeft },
  number: { label: '숫자', icon: Hash },
  date: { label: '날짜', icon: CalendarIcon },
  select: { label: '선택', icon: ListChecks },
  party: { label: '회원사 선택', icon: Building2 },
  table: { label: '표', icon: TableIcon },
};

const CELL_TYPE_LABEL: Record<CellType, string> = {
  text: '텍스트',
  number: '숫자',
  date: '날짜',
  select: '선택',
};

const PARTIES: { id: string; label: string }[] = [
  { id: 'gen1', label: '(주)울산미포오알씨발전1호' },
  { id: 'gen2', label: '그린에너지솔라(주)' },
  { id: 'con2', label: '주식회사 알엠에스플랫폼' },
  { id: 'spc1', label: '울산E-SPC(주)' },
];

const INITIAL_TEMPLATES: Template[] = [
  {
    id: 'tpl-1',
    name: 'PPA 계약서',
    category: 'contract',
    description: '직접 PPA 본 계약서 템플릿',
    fields: [
      { id: 'f1', label: '계약번호', type: 'text', required: true },
      { id: 'f2', label: '계약일', type: 'date', required: true },
      { id: 'f3', label: '계약용량(kW)', type: 'number', required: true },
      { id: 'f4', label: '단가(원/kWh)', type: 'number', required: true },
    ],
    updatedAt: '2026-01-10',
    usedCount: 3,
  },
  {
    id: 'tpl-2',
    name: '월간 정산서',
    category: 'settlement',
    description: '월별 발전량 기반 정산서',
    fields: [
      { id: 'f1', label: '정산기간', type: 'text', required: true },
      { id: 'f2', label: '발전량(kWh)', type: 'number', required: true },
      { id: 'f3', label: '정산금액(원)', type: 'number', required: true },
    ],
    updatedAt: '2026-04-15',
    usedCount: 8,
  },
];

/* ─────────────────────────────────────────────
   Page
   ───────────────────────────────────────────── */
export default function PlatformPpaDocumentGenerationPage() {
  const { data: _apiSettlements } = usePpaSettlements();
  const { data: _apiPlants } = useMonitoringPlants();
  const router = useRouter();

  // 템플릿 라이브러리 (운영자가 CRUD)
  const [templates, setTemplates] = useState<Template[]>(INITIAL_TEMPLATES);

  const [category, setCategory] = useState<Category | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>(INITIAL_TEMPLATES[0]?.id ?? '');

  const [editMode, setEditMode] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});
  const [archiveSettings, setArchiveSettings] = useState<{ watermark: boolean }>({ watermark: true });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [issuedOpen, setIssuedOpen] = useState(false);
  const [fieldEditor, setFieldEditor] = useState<{ field: Field; isNew: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const visibleTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (category !== 'all' && t.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        return t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q);
      }
      return true;
    });
  }, [templates, category, search]);

  const selected = templates.find((t) => t.id === selectedId) ?? templates[0] ?? null;
  const meta = selected ? CATEGORY_META[selected.category] : null;

  /* Template CRUD */
  const onSelectTemplate = (t: Template) => {
    setSelectedId(t.id);
    setArchiveSettings({ watermark: t.defaultWatermark });
    setValues({});
    setEditMode(false);
  };

  const createTemplate = () => {
    const id = `t_${Date.now()}`;
    const t: Template = {
      id,
      category: 'contract',
      name: '새 템플릿',
      desc: '설명을 입력하세요',
      defaultWatermark: false,
      fields: [],
      builtIn: false,
      updatedAt: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
    };
    setTemplates((p) => [t, ...p]);
    setSelectedId(id);
    setEditMode(true);
    setValues({});
  };

  const duplicateTemplate = (src: Template) => {
    const id = `t_${Date.now()}`;
    const dup: Template = {
      ...src,
      id,
      name: `${src.name} (복사)`,
      builtIn: false,
      updatedAt: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
      fields: src.fields.map((f) => ({ ...f, key: `${f.key}_${Date.now()}` })),
    };
    setTemplates((p) => [dup, ...p]);
    setSelectedId(id);
    setEditMode(true);
  };

  const deleteTemplate = (id: string) => {
    setTemplates((p) => p.filter((t) => t.id !== id));
    setConfirmDelete(false);
    if (selectedId === id) {
      const remaining = templates.filter((t) => t.id !== id);
      if (remaining.length > 0) onSelectTemplate(remaining[0]);
    }
  };

  const updateTemplateMeta = (patch: Partial<Template>) => {
    setTemplates((p) => p.map((t) => (t.id === selected.id ? { ...t, ...patch, updatedAt: today() } : t)));
  };

  /* Field CRUD */
  const addField = (field: Omit<Field, 'key'>) => {
    const key = `f_${Date.now()}`;
    setTemplates((p) =>
      p.map((t) => (t.id === selected.id ? { ...t, fields: [...t.fields, { ...field, key }], updatedAt: today() } : t)),
    );
  };

  const updateField = (key: string, patch: Partial<Field>) => {
    setTemplates((p) =>
      p.map((t) =>
        t.id === selected.id
          ? { ...t, fields: t.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)), updatedAt: today() }
          : t,
      ),
    );
  };

  const removeField = (key: string) => {
    setTemplates((p) =>
      p.map((t) =>
        t.id === selected.id ? { ...t, fields: t.fields.filter((f) => f.key !== key), updatedAt: today() } : t,
      ),
    );
    setValues((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });
  };

  const moveField = (key: string, dir: -1 | 1) => {
    setTemplates((p) =>
      p.map((t) => {
        if (t.id !== selected.id) return t;
        const idx = t.fields.findIndex((f) => f.key === key);
        if (idx < 0) return t;
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= t.fields.length) return t;
        const nextFields = [...t.fields];
        [nextFields[idx], nextFields[newIdx]] = [nextFields[newIdx], nextFields[idx]];
        return { ...t, fields: nextFields, updatedAt: today() };
      }),
    );
  };

  if (!selected || !meta) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">문서 생성</h1>
        <p className="text-sm text-slate-400">템플릿이 없습니다. 새 템플릿을 생성해주세요.</p>
      </div>
    );
  }

  const requiredFilled = selected.fields.filter((f) => f.required).every((f) => values[f.key]);
  const hasFields = selected.fields.length > 0;
  const canIssue = !editMode && requiredFilled && hasFields && selected.name.trim().length > 0;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: '전력거래', path: '/platform/trading' }, { label: '직접 PPA' }, { label: '문서 생성' }]}
      />

      {/* header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">문서 생성</h1>
          <p className="mt-1 text-sm text-slate-400">
            템플릿 라이브러리를 직접 관리하고, 항목을 자유롭게 추가·수정해 문서를 발행합니다
          </p>
        </div>
        <Button variant="ghost" onClick={() => router.push('/platform/ppa/documents')}>
          <ChevronLeft size={14} className="mr-1.5" />
          보관함으로 돌아가기
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* ─────────────── 좌: 템플릿 라이브러리 ─────────────── */}
        <div className="xl:col-span-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-md font-semibold text-white">템플릿 라이브러리</h3>
            <Button size="sm" variant="primary" onClick={createTemplate}>
              <Plus size={12} className="mr-1.5" />새 템플릿
            </Button>
          </div>

          {/* 카테고리 토글 */}
          <div className="flex flex-wrap gap-1 rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/[0.06] text-xs">
            {[
              { v: 'all' as const, l: '전체', cnt: templates.length },
              ...(Object.keys(CATEGORY_META) as Category[]).map((c) => ({
                v: c,
                l: CATEGORY_META[c].label,
                cnt: templates.filter((t) => t.category === c).length,
              })),
            ].map((c) => (
              <button
                key={c.v}
                onClick={() => setCategory(c.v as any)}
                className={cn(
                  'rounded px-2.5 py-1.5 transition-colors flex items-center gap-1',
                  category === c.v ? 'bg-primary text-white' : 'text-slate-400 hover:text-white',
                )}
              >
                {c.l}
                <span className={cn('text-[10px] tabular-nums', category === c.v ? 'text-white/80' : 'text-slate-600')}>
                  ({c.cnt})
                </span>
              </button>
            ))}
          </div>

          {/* 검색 */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              type="text"
              placeholder="템플릿 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* 템플릿 카드 리스트 */}
          <div className="space-y-1.5 max-h-[68vh] overflow-y-auto pr-1">
            {visibleTemplates.map((t) => {
              const tm = CATEGORY_META[t.category];
              const isSelected = selectedId === t.id;
              return (
                <div
                  key={t.id}
                  className={cn(
                    'group rounded-lg border p-3 transition-colors cursor-pointer',
                    isSelected
                      ? 'border-primary/40 bg-primary/[0.06] ring-1 ring-primary/30'
                      : 'border-white/[0.06] bg-[#0d1520] hover:border-white/[0.15]',
                  )}
                  onClick={() => onSelectTemplate(t)}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded ring-1', tm.bg, tm.ring)}
                    >
                      <tm.icon size={14} className={tm.tone} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-white truncate">{t.name}</p>
                        {!t.builtIn && (
                          <span className="rounded bg-amber-500/[0.10] ring-1 ring-amber-500/30 px-1 text-[9px] text-amber-300 shrink-0">
                            사용자
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{t.desc}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-500">
                        <span className="tabular-nums">{t.fields.length}항목</span>
                        {t.updatedAt && (
                          <>
                            <span>·</span>
                            <span className="tabular-nums">{t.updatedAt}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {/* hover actions */}
                    <div
                      className={cn('flex flex-col gap-1 shrink-0', !isSelected && 'opacity-0 group-hover:opacity-100')}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateTemplate(t);
                        }}
                        className="p-1 rounded text-slate-500 hover:text-white hover:bg-white/[0.06]"
                        title="복제"
                      >
                        <Copy size={11} />
                      </button>
                      {!t.builtIn && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(t.id);
                            setConfirmDelete(true);
                          }}
                          className="p-1 rounded text-slate-500 hover:text-rose-300 hover:bg-rose-500/[0.10]"
                          title="삭제"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {visibleTemplates.length === 0 && (
              <div className="rounded-lg border border-dashed border-white/[0.10] p-6 text-center text-xs text-slate-500">
                조건에 맞는 템플릿이 없습니다
              </div>
            )}
          </div>
        </div>

        {/* ─────────────── 우: 템플릿 상세 (편집 또는 사용) ─────────────── */}
        <div className="xl:col-span-8 space-y-4">
          {/* 헤더 카드 */}
          <div className={cn('rounded-xl border p-5', meta.bg.replace('/[0.10]', '/[0.04]'), meta.ring)}>
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ring-1',
                  meta.bg,
                  meta.ring,
                )}
              >
                <meta.icon size={20} className={meta.tone} />
              </span>
              <div className="flex-1">
                {editMode ? (
                  <div className="space-y-2">
                    <Input
                      type="text"
                      value={selected.name}
                      onChange={(e) => updateTemplateMeta({ name: e.target.value })}
                      placeholder="템플릿 이름"
                      className="!text-base !font-bold"
                    />
                    <Input
                      type="text"
                      value={selected.desc}
                      onChange={(e) => updateTemplateMeta({ desc: e.target.value })}
                      placeholder="설명"
                      className="!text-sm"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-slate-500">카테고리</span>
                      <select
                        value={selected.category}
                        onChange={(e) => updateTemplateMeta({ category: e.target.value as Category })}
                        className="rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white"
                      >
                        {(Object.keys(CATEGORY_META) as Category[]).map((c) => (
                          <option key={c} value={c}>
                            {CATEGORY_META[c].label}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!selected.hasExpiry}
                          onChange={(e) => updateTemplateMeta({ hasExpiry: e.target.checked })}
                          className="accent-primary cursor-pointer"
                        />
                        만료일 추적
                      </label>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white">{selected.name}</h2>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ring-1',
                          meta.bg,
                          meta.tone,
                          meta.ring,
                        )}
                      >
                        {meta.label}
                      </span>
                      {!selected.builtIn && (
                        <span className="rounded bg-amber-500/[0.10] ring-1 ring-amber-500/30 px-1.5 py-0.5 text-[10px] text-amber-300">
                          사용자 정의
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-300">{selected.desc}</p>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <FileText size={11} />
                        {selected.fields.length}개 항목
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Sparkles size={11} className="text-violet-400" />
                        회원·계약 자동 채움
                      </span>
                      {selected.updatedAt && (
                        <>
                          <span>·</span>
                          <span className="tabular-nums">최종 수정 {selected.updatedAt}</span>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
              <Button size="sm" variant={editMode ? 'primary' : 'secondary'} onClick={() => setEditMode((v) => !v)}>
                {editMode ? (
                  <>
                    <CheckCircle2 size={12} className="mr-1.5" />
                    편집 완료
                  </>
                ) : (
                  <>
                    <FileEdit size={12} className="mr-1.5" />
                    템플릿 편집
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* 항목 영역 (편집 모드 또는 입력 모드) */}
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-md font-semibold text-white">{editMode ? '항목 정의' : '메타데이터 입력'}</h3>
              <span className="text-[11px] text-slate-500">
                {hasFields ? (
                  editMode ? (
                    `${selected.fields.length}개 항목`
                  ) : (
                    <>
                      필수 {selected.fields.filter((f) => f.required).length}/{selected.fields.length} ·{' '}
                      <span className={requiredFilled ? 'text-emerald-300' : 'text-amber-300'}>
                        {requiredFilled ? '입력 완료' : '입력 진행 중'}
                      </span>
                    </>
                  )
                ) : (
                  '항목 없음'
                )}
              </span>
            </div>

            {/* 편집 모드: 필드 정의 행 */}
            {editMode && (
              <div className="space-y-2 mb-3">
                {selected.fields.map((f, i) => (
                  <div key={f.key} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="flex items-center gap-2 text-xs">
                      <GripVertical size={12} className="text-slate-600" />
                      <span className="text-white font-medium">{f.label}</span>
                      {f.required && <span className="text-rose-300">*</span>}
                      <span className="text-slate-700">·</span>
                      <span className="text-slate-500 inline-flex items-center gap-1">
                        {(() => {
                          const Icon = FIELD_TYPE_META[f.type].icon;
                          return <Icon size={10} />;
                        })()}
                        {FIELD_TYPE_META[f.type].label}
                      </span>
                      {f.options && (
                        <>
                          <span className="text-slate-700">·</span>
                          <span className="text-slate-500">{f.options.length}개 옵션</span>
                        </>
                      )}
                      {f.type === 'table' && f.columns && (
                        <>
                          <span className="text-slate-700">·</span>
                          <span className="text-slate-500 inline-flex items-center gap-1">
                            <Columns size={10} />
                            {f.columns.length}컬럼
                          </span>
                        </>
                      )}
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          onClick={() => moveField(f.key, -1)}
                          disabled={i === 0}
                          className="p-1 text-slate-500 hover:text-white disabled:opacity-30"
                          title="위로"
                        >
                          <ArrowUp size={11} />
                        </button>
                        <button
                          onClick={() => moveField(f.key, 1)}
                          disabled={i === selected.fields.length - 1}
                          className="p-1 text-slate-500 hover:text-white disabled:opacity-30"
                          title="아래로"
                        >
                          <ArrowDown size={11} />
                        </button>
                        <button
                          onClick={() => setFieldEditor({ field: f, isNew: false })}
                          className="p-1 text-slate-500 hover:text-white"
                          title="편집"
                        >
                          <Edit3 size={11} />
                        </button>
                        <button
                          onClick={() => removeField(f.key)}
                          className="p-1 text-slate-500 hover:text-rose-300"
                          title="삭제"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                    {f.helper && <p className="mt-1 text-[10px] text-slate-600 ml-5">{f.helper}</p>}
                    {f.type === 'table' && f.columns && (
                      <div className="mt-2 ml-5 flex flex-wrap gap-1">
                        {f.columns.map((c) => (
                          <span
                            key={c.key}
                            className="rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-300"
                          >
                            {c.label} <span className="text-slate-600">({CELL_TYPE_LABEL[c.type]})</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 사용 모드: 입력 폼 */}
            {!editMode && hasFields && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {selected.fields.map((f) => (
                  <FieldInput
                    key={f.key}
                    field={f}
                    value={values[f.key] ?? ''}
                    onChange={(v) => setValues((p) => ({ ...p, [f.key]: v }))}
                  />
                ))}
              </div>
            )}

            {/* 빈 상태 */}
            {!hasFields && (
              <div className="rounded-lg border border-dashed border-white/[0.10] py-8 text-center text-xs text-slate-500">
                항목이 없습니다.{' '}
                {editMode ? '아래 "항목 추가" 버튼으로 시작하세요.' : '편집 모드로 전환해 항목을 추가하세요.'}
              </div>
            )}

            {/* 항목 추가 버튼 (편집 모드일 때만) */}
            {editMode && (
              <button
                onClick={() =>
                  setFieldEditor({
                    field: { key: '', label: '', type: 'text', required: false },
                    isNew: true,
                  })
                }
                className="w-full rounded-lg border border-dashed border-white/[0.15] p-3 text-sm text-slate-400 hover:text-white hover:border-white/[0.30] hover:bg-white/[0.02] transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={14} />
                항목 추가
              </button>
            )}

            {!editMode && hasFields && (
              <div className="mt-3 rounded-lg border border-violet-500/[0.20] bg-violet-500/[0.04] p-3 text-[11px] text-violet-200">
                <Sparkles size={11} className="inline mr-1" />
                회원·계약 데이터 자동 채움 — 발전소·수용가 선택 시 사업자번호·주소·계좌·CFE 목표가 자동 입력됩니다.
              </div>
            )}
          </div>

          {/* 보관함 설정 (사용 모드에서만) */}
          {!editMode && (
            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5">
              <div className="mb-3">
                <h3 className="text-md font-semibold text-white">보관함 설정</h3>
                <p className="mt-0.5 text-xs text-slate-400">생성된 문서가 보관함에 적용될 메타데이터</p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1 flex items-center gap-1">
                    <Droplets size={10} />
                    워터마크 (외부 공유 시 자동 삽입)
                  </label>
                  <button
                    onClick={() => setArchiveSettings((p) => ({ ...p, watermark: !p.watermark }))}
                    className={cn(
                      'flex items-center justify-between w-full rounded-lg border px-3 py-2 transition-colors',
                      archiveSettings.watermark
                        ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                        : 'border-white/10 bg-white/[0.04]',
                    )}
                  >
                    <span
                      className={cn(
                        'text-xs font-medium',
                        archiveSettings.watermark ? 'text-emerald-300' : 'text-slate-400',
                      )}
                    >
                      {archiveSettings.watermark ? 'ON' : 'OFF'}
                    </span>
                    <span
                      className={cn(
                        'w-9 h-5 rounded-full p-0.5 transition-colors flex',
                        archiveSettings.watermark ? 'bg-emerald-500 justify-end' : 'bg-white/[0.06] justify-start',
                      )}
                    >
                      <span className="h-4 w-4 rounded-full bg-white" />
                    </span>
                  </button>
                </div>
              </div>
              {selected.hasExpiry && (
                <div className="mt-3 rounded-lg border border-amber-500/[0.20] bg-amber-500/[0.04] p-2.5 text-[11px] text-amber-200 flex items-start gap-2">
                  <AlertCircle size={11} className="mt-0.5 shrink-0" />
                  <span>이 템플릿은 만료일이 있는 문서입니다. 보관함에서 만료 임박 시 자동 알림됩니다.</span>
                </div>
              )}
            </div>
          )}

          {/* 액션 */}
          <div className="flex items-center justify-end gap-2 sticky bottom-3">
            {editMode ? (
              <>
                <Button variant="ghost" onClick={() => setEditMode(false)}>
                  <CheckCircle2 size={14} className="mr-1.5" />
                  편집 완료
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost">
                  <Save size={14} className="mr-1.5" />
                  초안 저장
                </Button>
                <Button variant="secondary" onClick={() => setPreviewOpen(true)} disabled={!canIssue}>
                  <Eye size={14} className="mr-1.5" />
                  미리보기
                </Button>
                <Button variant="primary" onClick={() => setIssuedOpen(true)} disabled={!canIssue}>
                  <Send size={14} className="mr-1.5" />
                  발행 (보관함 자동 등록)
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 필드 편집 모달 */}
      {fieldEditor && (
        <FieldEditorModal
          field={fieldEditor.field}
          isNew={fieldEditor.isNew}
          onClose={() => setFieldEditor(null)}
          onSave={(f) => {
            if (fieldEditor.isNew) addField(f);
            else updateField(fieldEditor.field.key, f);
            setFieldEditor(null);
          }}
        />
      )}

      {/* 삭제 확인 모달 */}
      {confirmDelete && (
        <Modal
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          size="sm"
          title="템플릿 삭제"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                취소
              </Button>
              <Button
                variant="primary"
                className="!bg-rose-500 hover:!bg-rose-600"
                onClick={() => deleteTemplate(selected.id)}
              >
                <Trash2 size={12} className="mr-1.5" />
                삭제
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-300">
            <span className="text-white font-semibold">{selected.name}</span> 템플릿을 삭제합니다. 이미 발행된 문서는
            영향받지 않습니다.
          </p>
        </Modal>
      )}

      {/* 미리보기 모달 */}
      {previewOpen && (
        <Modal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          size="lg"
          title={`미리보기 — ${selected.name}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPreviewOpen(false)}>
                닫기
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setPreviewOpen(false);
                  setIssuedOpen(true);
                }}
              >
                <Send size={12} className="mr-1.5" />
                발행 진행
              </Button>
            </>
          }
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div
              className={cn(
                'mx-auto w-full max-w-md aspect-[1/1.4] rounded-lg p-8 flex flex-col ring-1 shadow-lg relative',
                meta.bg.replace('/[0.10]', '/[0.04]'),
                meta.ring,
              )}
            >
              {archiveSettings.watermark && (
                <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-blue-500/[0.20] ring-1 ring-blue-500/30 px-2 py-0.5 text-[10px] text-blue-200">
                  <Droplets size={10} />
                  워터마크
                </span>
              )}
              <div className="text-center pb-4 border-b border-white/[0.08]">
                <meta.icon size={36} className={cn('mx-auto', meta.tone)} />
                <p className="mt-2 text-sm font-bold text-white">{selected.name}</p>
                <p className="text-[10px] text-slate-500 mt-1 tabular-nums">{today()} 발행</p>
              </div>
              <div className="flex-1 mt-5 space-y-2">
                {selected.fields.slice(0, 6).map((f) => (
                  <div key={f.key} className="flex justify-between text-[10px] py-0.5">
                    <span className="text-slate-500">{f.label}</span>
                    <span className="text-white tabular-nums truncate max-w-[60%]">{values[f.key] || '—'}</span>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-white/[0.06] text-[10px] text-slate-500 text-center">
                — 미리보기 —
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* 발행 완료 */}
      {issuedOpen && (
        <Modal
          open={issuedOpen}
          onClose={() => {
            setIssuedOpen(false);
            router.push('/platform/ppa/documents');
          }}
          size="md"
          title="발행 완료"
          footer={
            <>
              <Button variant="ghost" onClick={() => setIssuedOpen(false)}>
                닫기
              </Button>
              <Button variant="primary" onClick={() => router.push('/platform/ppa/documents')}>
                보관함에서 확인
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-center py-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/[0.15] ring-1 ring-emerald-500/30">
              <CheckCircle2 size={24} className="text-emerald-300" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">{selected.name} 발행 완료</p>
              <p className="mt-1 text-xs text-slate-400">문서가 보관함에 자동 분류되었습니다.</p>
            </div>
            <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] p-3 text-left text-xs space-y-1">
              <DetailLine label="카테고리" value={meta.label} />
              <DetailLine label="워터마크" value={archiveSettings.watermark ? '자동 삽입 ON' : 'OFF'} />
              {selected.hasExpiry && <DetailLine label="만료일 추적" value="ON · 임박 시 알림" />}
              <DetailLine label="감사 로그" value="자동 기록" />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Field input
   ───────────────────────────────────────────── */
function FieldInput({ field, value, onChange }: { field: Field; value: string; onChange: (v: string) => void }) {
  return (
    <div className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
      <label className="block text-[11px] text-slate-500 mb-1">
        {field.label}
        {field.required && <span className="ml-1 text-rose-300">*</span>}
      </label>
      {field.type === 'select' && (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
        >
          <option value="">선택</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}
      {field.type === 'party' && (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
        >
          <option value="">회원사 선택</option>
          {PARTIES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      )}
      {field.type === 'textarea' && (
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-slate-600"
        />
      )}
      {(field.type === 'text' || field.type === 'number' || field.type === 'date') && (
        <Input
          type={field.type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      )}
      {field.helper && <p className="text-[10px] text-slate-600 mt-1">{field.helper}</p>}
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Field Editor Modal
   ───────────────────────────────────────────── */
function FieldEditorModal({
  field,
  isNew,
  onClose,
  onSave,
}: {
  field: Field;
  isNew: boolean;
  onClose: () => void;
  onSave: (f: Omit<Field, 'key'>) => void;
}) {
  const [label, setLabel] = useState(field.label || '');
  const [type, setType] = useState<FieldType>(field.type || 'text');
  const [required, setRequired] = useState(!!field.required);
  const [placeholder, setPlaceholder] = useState(field.placeholder || '');
  const [helper, setHelper] = useState(field.helper || '');
  const [optionsText, setOptionsText] = useState((field.options || []).join('\n'));

  const handleSave = () => {
    if (!label.trim()) return;
    const out: any = { label: label.trim(), type, required };
    if (placeholder) out.placeholder = placeholder;
    if (helper) out.helper = helper;
    if (type === 'select') {
      const opts = optionsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      if (opts.length > 0) out.options = opts;
    }
    onSave(out);
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      size="md"
      title={isNew ? '항목 추가' : '항목 편집'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!label.trim()}>
            {isNew ? '추가' : '저장'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">
            항목 이름 <span className="text-rose-300">*</span>
          </label>
          <Input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="예: 검수자 / 추가 조건 / 특이사항"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-[11px] text-slate-500 mb-1.5">타입</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(FIELD_TYPE_META) as FieldType[]).map((t) => {
              const tm = FIELD_TYPE_META[t];
              return (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-2 py-2 text-xs transition-colors',
                    type === t
                      ? 'border-primary/40 bg-primary/[0.08] text-primary'
                      : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-white',
                  )}
                >
                  <tm.icon size={12} />
                  {tm.label}
                </button>
              );
            })}
          </div>
        </div>

        {type === 'select' && (
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">선택지 (한 줄에 하나씩)</label>
            <textarea
              rows={4}
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder={'옵션 1\n옵션 2\n옵션 3'}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-slate-600"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">플레이스홀더</label>
            <Input
              type="text"
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              placeholder="입력 예시"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">도움말</label>
            <Input type="text" value={helper} onChange={(e) => setHelper(e.target.value)} placeholder="설명" />
          </div>
        </div>

        <button
          onClick={() => setRequired((v) => !v)}
          className={cn(
            'flex items-center justify-between w-full rounded-lg border px-3 py-2 transition-colors',
            required ? 'border-rose-500/30 bg-rose-500/[0.06]' : 'border-white/10 bg-white/[0.04]',
          )}
        >
          <span className={cn('text-xs font-medium', required ? 'text-rose-300' : 'text-slate-400')}>
            필수 입력 {required ? 'ON' : 'OFF'}
          </span>
          <span
            className={cn(
              'w-9 h-5 rounded-full p-0.5 transition-colors flex',
              required ? 'bg-rose-500 justify-end' : 'bg-white/[0.06] justify-start',
            )}
          >
            <span className="h-4 w-4 rounded-full bg-white" />
          </span>
        </button>
      </div>
    </Modal>
  );
}

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
