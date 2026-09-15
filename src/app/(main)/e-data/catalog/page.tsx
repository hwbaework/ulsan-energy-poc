'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  X,
  SlidersHorizontal,
  LayoutGrid,
  List,
  FileText,
  ShieldCheck,
  BadgeCheck,
  Send,
  Check,
} from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Button } from '@/components/edm/ui/Button';
import { Select } from '@/components/edm/ui/Select';
import { Badge } from '@/components/edm/ui/Badge';
import { Checkbox } from '@/components/edm/ui/Checkbox';
import { Modal } from '@/components/ui/Modal';
import { DatasetCard } from '@/components/edm/features/DatasetCard';
import { cn } from '@/lib/utils';
import type { CatalogFilters, DatasetFormat, PriceModelType } from '@/types/edm';
import { usePublishDataset, useDatasets } from '@/hooks/edm/useDm';

const SORT_OPTIONS = [
  { value: 'popular', label: '인기순' },
  { value: 'newest', label: '최신순' },
  { value: 'price_asc', label: '가격 낮은순' },
  { value: 'price_desc', label: '가격 높은순' },
  { value: 'rating', label: '평점순' },
];

const FORMAT_OPTIONS: { value: DatasetFormat; label: string }[] = [
  { value: 'FILE', label: '파일' },
  { value: 'API', label: 'API' },
  { value: 'STREAMING', label: '스트리밍' },
];

const PRICE_OPTIONS: { value: PriceModelType; label: string }[] = [
  { value: 'FREE', label: '무료' },
  { value: 'SUBSCRIPTION', label: '구독' },
  { value: 'ONETIME', label: '건별 구매' },
  { value: 'PAY_PER_USE', label: '사용량 기반' },
];

// 판매자 심사·품질판정 등록 워크플로 (계획서 p.144) — edm 도메인 연동 전이므로 흐름·상태는 예시.
const REVIEW_STEPS = [
  { key: 'apply', label: '신청', desc: '판매자 데이터셋 등록 신청', icon: Send },
  { key: 'review', label: '심사', desc: '판매자 자격·메타데이터 심사', icon: ShieldCheck },
  { key: 'quality', label: '품질판정', desc: '완전성·정확성·최신성 품질 판정', icon: BadgeCheck },
  { key: 'publish', label: '게시', desc: '카탈로그 게시·판매 개시', icon: FileText },
] as const;

// 심사 대기 큐 행 — REVIEW 상태 데이터셋 실조회분에서 매핑(설계 22: mock 큐 제거).
// stage는 status 기반 고정(REVIEW=1: '심사' 단계). 품질점수 미판정 시 '미판정'.
type ReviewRow = { id: string; datasetId: number; title: string; seller: string; stage: number; quality: string };

// 심사 판정 결과(로컬 반영) — 실 status 갱신 표기용.
type ReviewDecision = { status: 'PUBLISHED' | 'REJECTED'; note?: string };

export default function CatalogPage() {
  const [filters, setFilters] = useState<CatalogFilters>({ sort: 'popular' });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchInput, setSearchInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [view, setView] = useState<'catalog' | 'review'>('catalog');

  // 실 API 배선(설계 16 §3.2) — GET datamarket.datasets?status=PUBLISHED. 설계 22: mock 폴백 제거(빈/오류 정직).
  const { data: datasets } = useDatasets('PUBLISHED');

  // 카테고리 필터 — mock(MOCK_CATEGORIES) 제거. 실데이터셋의 category 필드에서 distinct 도출·건수 집계.
  const categories = useMemo(() => {
    const byslug = new Map<string, { slug: string; name: string; datasetCount: number }>();
    for (const d of datasets) {
      const slug = d.category?.slug;
      if (!slug) continue;
      const prev = byslug.get(slug);
      if (prev) prev.datasetCount += 1;
      else byslug.set(slug, { slug, name: d.category.name || slug, datasetCount: 1 });
    }
    return Array.from(byslug.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [datasets]);

  // 설계 22: 심사 대기 큐 = REVIEW 상태 데이터셋 실조회. mock(REVIEW_QUEUE) 제거.
  const { data: reviewDatasets, isError: reviewError } = useDatasets('REVIEW');
  const reviewQueue: ReviewRow[] = reviewDatasets.map((d) => ({
    id: `RV-${d.id}`,
    datasetId: d.id,
    title: d.title,
    seller: d.provider.name,
    quality: d.qualityScore > 0 ? `${d.qualityScore}점` : '미판정',
    stage: 1, // REVIEW 단계 고정('심사')
  }));

  // §2 심사 판정 — 승인(품질점수)·반려(사유). publish 배선 + 409 동의 게이트.
  const publishDataset = usePublishDataset();
  const [decisions, setDecisions] = useState<Record<string, ReviewDecision>>({});
  const [approveTarget, setApproveTarget] = useState<ReviewRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ReviewRow | null>(null);
  const [qualityScore, setQualityScore] = useState('90');
  const [rejectReason, setRejectReason] = useState('');
  const [consentBlocked, setConsentBlocked] = useState<string | null>(null);

  async function handleApprove() {
    if (!approveTarget) return;
    setConsentBlocked(null);
    const res = await publishDataset.mutateAsync({
      id: approveTarget.datasetId,
      approve: true,
      qualityScore: Number(qualityScore) || undefined,
    });
    if (res.consentRequired) {
      setConsentBlocked(approveTarget.id); // 동의 미서명 — 409 안내
      return;
    }
    setDecisions((d) => ({ ...d, [approveTarget.id]: { status: 'PUBLISHED', note: `${qualityScore}점` } }));
    setApproveTarget(null);
  }

  async function handleReject() {
    if (!rejectTarget || rejectReason.trim() === '') return;
    await publishDataset.mutateAsync({
      id: rejectTarget.datasetId,
      approve: false,
      rejectReason,
      qualityScore: Number(qualityScore) || undefined,
    });
    setDecisions((d) => ({ ...d, [rejectTarget.id]: { status: 'REJECTED', note: rejectReason } }));
    setRejectTarget(null);
    setRejectReason('');
  }

  const filtered = useMemo(() => {
    let results = [...datasets];

    if (filters.q) {
      const q = filters.q.toLowerCase();
      results = results.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.tags.some((t) => t.name.toLowerCase().includes(q)),
      );
    }
    if (filters.category) {
      results = results.filter(
        (d) => d.category.slug === filters.category || d.category.slug.startsWith(filters.category + '-'),
      );
    }
    if (filters.format) {
      results = results.filter((d) => d.format === filters.format);
    }
    if (filters.priceModel) {
      results = results.filter((d) => d.priceModel.type === filters.priceModel);
    }
    if (filters.qualityMin) {
      results = results.filter((d) => d.qualityScore >= filters.qualityMin!);
    }

    switch (filters.sort) {
      case 'newest':
        results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case 'price_asc':
        results.sort((a, b) => (a.priceModel.basePrice ?? 0) - (b.priceModel.basePrice ?? 0));
        break;
      case 'price_desc':
        results.sort((a, b) => (b.priceModel.basePrice ?? 0) - (a.priceModel.basePrice ?? 0));
        break;
      case 'rating':
        results.sort((a, b) => b.avgRating - a.avgRating);
        break;
      default:
        results.sort((a, b) => b.viewCount - a.viewCount);
        break;
    }

    return results;
  }, [filters, datasets]);

  function handleSearch() {
    setFilters((f) => ({ ...f, q: searchInput || undefined }));
  }

  function clearFilter(key: keyof CatalogFilters) {
    setFilters((f) => ({ ...f, [key]: undefined }));
  }

  const activeFilterCount = [filters.category, filters.format, filters.priceModel, filters.qualityMin].filter(
    Boolean,
  ).length;

  return (
    <div className="space-y-4">
      {/* 화면 탭: 카탈로그 ▸ 판매자 심사·품질판정 (doc04 §3, 계획서 p.144) */}
      <div className="flex items-center gap-1 border-b border-accent/20">
        <button
          onClick={() => setView('catalog')}
          className={cn(
            'px-4 py-2 text-sm -mb-px border-b-2 transition-colors',
            view === 'catalog'
              ? 'border-primary text-white font-semibold'
              : 'border-transparent text-accent hover:text-white',
          )}
        >
          카탈로그
        </button>
        <button
          onClick={() => setView('review')}
          className={cn(
            'px-4 py-2 text-sm -mb-px border-b-2 transition-colors',
            view === 'review'
              ? 'border-primary text-white font-semibold'
              : 'border-transparent text-accent hover:text-white',
          )}
        >
          판매자 심사·품질판정
        </button>
      </div>

      {view === 'catalog' && (
        <>
          {/* Search Bar */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-accent/40" />
              <input
                type="search"
                placeholder="데이터셋 검색 (제목, 태그, 키워드)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="h-10 w-full rounded-lg border border-accent/30 bg-surface-dark pl-9 pr-9 text-sm text-white placeholder:text-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              />
              {searchInput && (
                <button
                  onClick={() => {
                    setSearchInput('');
                    clearFilter('q');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-accent/40 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <Button onClick={handleSearch}>검색</Button>
            <Button variant="secondary" onClick={() => setSidebarOpen(!sidebarOpen)} className="relative">
              <SlidersHorizontal size={16} />
              필터
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[10px] flex items-center justify-center text-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {/* Active Filters Chips */}
          {(filters.q || filters.category || filters.format || filters.priceModel) && (
            <div className="flex flex-wrap gap-2">
              {filters.q && (
                <Badge variant="primary">
                  검색: {filters.q}
                  <button
                    onClick={() => {
                      clearFilter('q');
                      setSearchInput('');
                    }}
                    className="ml-1"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              )}
              {filters.category && (
                <Badge variant="info">
                  카테고리: {categories.find((c) => c.slug === filters.category)?.name ?? filters.category}
                  <button onClick={() => clearFilter('category')} className="ml-1">
                    <X size={12} />
                  </button>
                </Badge>
              )}
              {filters.format && (
                <Badge variant="info">
                  형식: {filters.format}
                  <button onClick={() => clearFilter('format')} className="ml-1">
                    <X size={12} />
                  </button>
                </Badge>
              )}
              {filters.priceModel && (
                <Badge variant="info">
                  가격: {PRICE_OPTIONS.find((p) => p.value === filters.priceModel)?.label}
                  <button onClick={() => clearFilter('priceModel')} className="ml-1">
                    <X size={12} />
                  </button>
                </Badge>
              )}
              <button
                onClick={() => {
                  setFilters({ sort: filters.sort });
                  setSearchInput('');
                }}
                className="text-xs text-accent hover:text-white"
              >
                전체 초기화
              </button>
            </div>
          )}

          <div className="flex gap-4">
            {/* Filter Sidebar */}
            {sidebarOpen && (
              <aside className="w-60 shrink-0 space-y-4">
                {/* Categories */}
                <Card className="p-4">
                  <h4 className="text-sm font-semibold text-white mb-3">카테고리</h4>
                  <div className="space-y-1">
                    {categories.length === 0 ? (
                      <p className="px-2 py-1.5 text-xs text-accent/50">게시된 데이터셋 카테고리가 없습니다.</p>
                    ) : (
                      categories.map((cat) => (
                        <button
                          key={cat.slug}
                          onClick={() =>
                            setFilters((f) => ({ ...f, category: f.category === cat.slug ? undefined : cat.slug }))
                          }
                          className={cn(
                            'w-full text-left px-2 py-1.5 rounded text-xs transition-colors',
                            filters.category === cat.slug
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-accent hover:text-white hover:bg-white/[0.04]',
                          )}
                        >
                          {cat.name} <span className="text-accent/50">({cat.datasetCount})</span>
                        </button>
                      ))
                    )}
                  </div>
                </Card>

                {/* Format */}
                <Card className="p-4">
                  <h4 className="text-sm font-semibold text-white mb-3">데이터 형식</h4>
                  <div className="space-y-2">
                    {FORMAT_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2 text-xs text-accent cursor-pointer hover:text-white"
                      >
                        <Checkbox
                          checked={filters.format === opt.value}
                          onChange={() =>
                            setFilters((f) => ({ ...f, format: f.format === opt.value ? undefined : opt.value }))
                          }
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </Card>

                {/* Price Model */}
                <Card className="p-4">
                  <h4 className="text-sm font-semibold text-white mb-3">가격 모델</h4>
                  <div className="space-y-2">
                    {PRICE_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2 text-xs text-accent cursor-pointer hover:text-white"
                      >
                        <Checkbox
                          checked={filters.priceModel === opt.value}
                          onChange={() =>
                            setFilters((f) => ({
                              ...f,
                              priceModel: f.priceModel === opt.value ? undefined : opt.value,
                            }))
                          }
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </Card>

                {/* Quality */}
                <Card className="p-4">
                  <h4 className="text-sm font-semibold text-white mb-3">최소 품질 점수</h4>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={10}
                    value={filters.qualityMin ?? 0}
                    onChange={(e) => setFilters((f) => ({ ...f, qualityMin: Number(e.target.value) || undefined }))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-accent/50 mt-1">
                    <span>0</span>
                    <span className="text-primary font-medium">{filters.qualityMin ?? 0}점 이상</span>
                    <span>100</span>
                  </div>
                </Card>
              </aside>
            )}

            {/* Main Content */}
            <div className="flex-1 space-y-3">
              {/* Toolbar */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-accent">
                  총 <span className="text-white font-medium">{filtered.length}</span>개 데이터셋
                </p>
                <div className="flex items-center gap-2">
                  <Select
                    options={SORT_OPTIONS}
                    value={filters.sort ?? 'popular'}
                    onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as CatalogFilters['sort'] }))}
                    className="w-32"
                  />
                  <div className="flex border border-accent/20 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={cn(
                        'p-2 transition-colors',
                        viewMode === 'grid' ? 'bg-primary/20 text-primary' : 'text-accent hover:text-white',
                      )}
                    >
                      <LayoutGrid size={14} />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={cn(
                        'p-2 transition-colors',
                        viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-accent hover:text-white',
                      )}
                    >
                      <List size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Dataset Grid/List */}
              {filtered.length === 0 ? (
                <Card className="p-12 flex flex-col items-center justify-center text-center">
                  <Search size={48} className="text-accent/30 mb-4" />
                  <p className="text-white font-medium mb-1">검색 결과가 없습니다</p>
                  <p className="text-sm text-accent mb-4">다른 키워드로 검색하거나 필터를 조정해 보세요</p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setFilters({ sort: 'popular' });
                      setSearchInput('');
                    }}
                  >
                    필터 초기화
                  </Button>
                </Card>
              ) : (
                <div
                  className={cn(
                    viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-3',
                  )}
                >
                  {filtered.map((dataset) => (
                    <DatasetCard key={dataset.id} dataset={dataset} className={viewMode === 'list' ? 'flex-row' : ''} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {view === 'review' && (
        <div className="space-y-4">
          {/* 등록 워크플로 단계 표시 (신청 → 심사 → 품질판정 → 게시) */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">등록 워크플로</h3>
                <p className="text-xs text-accent mt-0.5">판매자 데이터 등록 심사·품질판정 단계 (계획서 p.144)</p>
              </div>
              <Badge variant="info">예시</Badge>
            </div>
            <div className="flex items-center">
              {REVIEW_STEPS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex flex-1 items-center last:flex-none">
                    <div className="flex flex-col items-center text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
                        <Icon size={18} />
                      </div>
                      <p className="mt-1.5 text-xs font-medium text-white">
                        {i + 1}. {step.label}
                      </p>
                      <p className="mt-0.5 max-w-[120px] text-[10px] text-accent">{step.desc}</p>
                    </div>
                    {i < REVIEW_STEPS.length - 1 && <div className="mx-2 h-px flex-1 bg-accent/20" />}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* 심사 대기 큐 — 각 신청 건의 현재 단계 */}
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-accent/10">
              <h3 className="text-sm font-semibold text-white">심사 대기 목록</h3>
              <Badge variant="info">{reviewQueue.length}건</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-accent border-b border-accent/10">
                  <tr>
                    <th className="px-5 py-3 font-medium">신청번호</th>
                    <th className="px-5 py-3 font-medium">데이터셋</th>
                    <th className="px-5 py-3 font-medium">판매자</th>
                    <th className="px-5 py-3 font-medium">진행 단계</th>
                    <th className="px-5 py-3 font-medium">품질 판정</th>
                    <th className="px-5 py-3 font-medium text-right">판정 액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-accent/10">
                  {reviewError ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-accent">
                        데이터를 불러오지 못했습니다 — 다시 로그인하세요
                      </td>
                    </tr>
                  ) : reviewQueue.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-accent">
                        심사 대기 건이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    reviewQueue.map((r) => (
                      <tr key={r.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="px-5 py-3 text-accent tabular-nums">{r.id}</td>
                        <td className="px-5 py-3 text-white">{r.title}</td>
                        <td className="px-5 py-3 text-slate-300">{r.seller}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            {REVIEW_STEPS.map((step, i) => {
                              const done = i < r.stage;
                              const current = i === r.stage;
                              return (
                                <div key={step.key} className="flex items-center gap-1.5">
                                  <span
                                    className={cn(
                                      'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-medium',
                                      done
                                        ? 'bg-primary text-white'
                                        : current
                                          ? 'border border-primary text-primary'
                                          : 'border border-accent/30 text-accent/50',
                                    )}
                                    title={step.label}
                                  >
                                    {done ? <Check size={11} /> : i + 1}
                                  </span>
                                  {i < REVIEW_STEPS.length - 1 && (
                                    <span className={cn('h-px w-3', done ? 'bg-primary' : 'bg-accent/20')} />
                                  )}
                                </div>
                              );
                            })}
                            <span className="ml-1 text-[11px] text-accent">{REVIEW_STEPS[r.stage]?.label}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={r.quality.includes('점') ? 'success' : 'info'}>{r.quality}</Badge>
                        </td>
                        <td className="px-5 py-3">
                          {decisions[r.id] ? (
                            <div className="flex items-center justify-end gap-2">
                              <Badge variant={decisions[r.id]!.status === 'PUBLISHED' ? 'success' : 'danger'}>
                                {decisions[r.id]!.status === 'PUBLISHED' ? '게시됨' : '반려됨'}
                              </Badge>
                              {decisions[r.id]!.note && (
                                <span className="text-[11px] text-accent">{decisions[r.id]!.note}</span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              {consentBlocked === r.id && <span className="text-[11px] text-amber-300">동의 필요</span>}
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setQualityScore(r.quality.replace('점', '').trim() || '90');
                                  setConsentBlocked(null);
                                  setApproveTarget(r);
                                }}
                              >
                                승인
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setRejectReason('');
                                  setRejectTarget(r);
                                }}
                              >
                                반려
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* 승인 모달 — 품질점수 입력(필수) → 승인·게시. 동의 미서명 시 409 안내(§2.3·§2.5) */}
      <Modal open={!!approveTarget} onClose={() => setApproveTarget(null)} title="심사 승인 · 게시" size="sm">
        <div className="space-y-3">
          {approveTarget && <p className="text-sm text-white">{approveTarget.title}</p>}
          <label className="block text-xs text-slate-400">
            품질 점수 (완전성·정확성·최신성) *
            <input
              type="number"
              min={0}
              max={100}
              value={qualityScore}
              onChange={(e) => setQualityScore(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
            />
          </label>
          {consentBlocked && approveTarget && consentBlocked === approveTarget.id && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 px-3 py-2">
              <ShieldCheck size={14} className="text-amber-400 shrink-0" />
              <p className="text-xs text-amber-300">
                동의(GRANTED)가 없어 게시할 수 없습니다(409). 소유권·동의에서 서명 후 다시 승인하세요.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setApproveTarget(null)}>
              취소
            </Button>
            <Button
              size="sm"
              loading={publishDataset.isPending}
              disabled={!(Number(qualityScore) >= 0)}
              onClick={handleApprove}
            >
              승인·게시
            </Button>
          </div>
        </div>
      </Modal>

      {/* 반려 모달 — 반려 사유 입력(필수) → REJECTED (§2.3 BE확장) */}
      <Modal
        open={!!rejectTarget}
        onClose={() => {
          setRejectTarget(null);
          setRejectReason('');
        }}
        title="심사 반려"
        size="sm"
      >
        <div className="space-y-3">
          {rejectTarget && <p className="text-sm text-white">{rejectTarget.title}</p>}
          <label className="block text-xs text-slate-400">
            반려 사유 *
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="반려 사유를 입력하세요"
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason('');
              }}
            >
              취소
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={publishDataset.isPending}
              disabled={rejectReason.trim() === ''}
              onClick={handleReject}
            >
              반려
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
