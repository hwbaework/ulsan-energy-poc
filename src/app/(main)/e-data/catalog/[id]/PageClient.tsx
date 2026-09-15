'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  Star,
  Eye,
  Download,
  Zap,
  FileText,
  Radio,
  Heart,
  MessageSquare,
  ChevronRight,
  Clock,
  Shield,
} from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Button } from '@/components/edm/ui/Button';
import { Badge } from '@/components/edm/ui/Badge';
import { Tabs } from '@/components/edm/ui/Tabs';
import { cn } from '@/lib/utils';
import type { DatasetListItem } from '@/types/edm';
import { CheckoutModal } from './CheckoutModal';
import { SamplePreviewModal } from './SamplePreviewModal';
import { useAuthStore } from '@/stores/useAuthStore';
import { useDatasetFiles, useDownloadDatasetFile } from '@/hooks/edm/useDmFile';
import { useDatasets, useDatasetPreview } from '@/hooks/edm/useDm';

const TABS = [
  { id: 'overview', label: '개요' },
  { id: 'schema', label: '스키마' },
  { id: 'preview', label: '미리보기' },
  { id: 'reviews', label: '리뷰' },
];

function formatPrice(dataset: DatasetListItem): string {
  const pm = dataset.priceModel;
  if (pm.type === 'FREE') return '무료';
  if (pm.type === 'ONETIME') return `₩${(pm.basePrice ?? 0).toLocaleString()}`;
  if (pm.type === 'SUBSCRIPTION') return `₩${(pm.basePrice ?? 0).toLocaleString()}/월`;
  if (pm.type === 'PAY_PER_USE') return `��${pm.perUsePrice}/건`;
  return '견적 문의';
}

const FREQUENCY_LABEL: Record<string, string> = {
  REALTIME: '실시간',
  HOURLY: '시간별',
  DAILY: '일별',
  WEEKLY: '주별',
  MONTHLY: '월별',
  ONCE: '1회',
};

export default function DatasetDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const [activeTab, setActiveTab] = useState('overview');
  const [wishlisted, setWishlisted] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState('');

  // 설계 22: mock(MOCK_DATASETS) 폴백 제거 — 실 게시 데이터셋 목록에서 조회.
  const { data: datasets, isError: datasetsError, isLoading: datasetsLoading } = useDatasets('PUBLISHED');
  const dataset = datasets.find((d) => d.id === Number(id));

  // 파일형(FILE) 데이터셋: 서버에서 파일 목록 조회 → 구매 게이팅 다운로드. 로컬 경로 비노출(서버 경유 스트리밍).
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const isFileFormat = dataset?.format === 'FILE';
  const { data: datasetFiles } = useDatasetFiles(Number(id), isFileFormat);
  const downloadFile = useDownloadDatasetFile();
  // 스키마·미리보기 — 서버 preview(부분 스키마·대표행·비식별). mock 스키마/프리뷰 제거.
  const preview = useDatasetPreview(Number(id));
  const schemaColumns = preview.data?.columns ?? [];
  const previewRows = preview.data?.rows ?? [];

  async function handleDownload(fileId: number, fileName: string) {
    setDownloadMsg('');
    const res = await downloadFile.mutateAsync({ fileId, fileName, companyId });
    if (!res.ok) {
      setDownloadMsg(
        res.forbidden
          ? '구매(결제 완료) 후 다운로드할 수 있습니다.'
          : '다운로드에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      );
    }
  }

  if (!dataset) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-accent">
          {datasetsLoading
            ? '불러오는 중…'
            : datasetsError
              ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
              : '데이터셋을 찾을 수 없습니다.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-accent">
        <Link href="/e-data/catalog" className="hover:text-white transition-colors">
          카탈로그
        </Link>
        <ChevronRight size={12} />
        <span className="text-white">{dataset.title}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="primary">{dataset.category.name}</Badge>
            <Badge variant={dataset.format === 'API' ? 'info' : dataset.format === 'STREAMING' ? 'warning' : 'default'}>
              {dataset.format === 'API' && <Zap size={10} className="mr-1" />}
              {dataset.format === 'STREAMING' && <Radio size={10} className="mr-1" />}
              {dataset.format === 'FILE' && <FileText size={10} className="mr-1" />}
              {dataset.format}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold text-white">{dataset.title}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-accent">
            <span>{dataset.provider.name}</span>
            <span className="flex items-center gap-1">
              <Clock size={12} /> {FREQUENCY_LABEL[dataset.updateFrequency]}
            </span>
            <span className="flex items-center gap-1">
              <Star size={12} className="text-yellow-400 fill-yellow-400" />
              {dataset.avgRating.toFixed(1)} ({dataset.reviewCount})
            </span>
            <span className="flex items-center gap-1">
              <Eye size={12} /> {dataset.viewCount.toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Download size={12} /> {dataset.downloadCount}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs bg-semantic-green/10 text-semantic-green px-3 py-1.5 rounded-full">
          <Shield size={12} /> 품질 {dataset.qualityScore}점
        </div>
      </div>

      <div className="flex gap-6">
        {/* Left: Tabs Content */}
        <div className="flex-1 min-w-0">
          <Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab} />

          <div className="mt-4">
            {activeTab === 'overview' && (
              <Card className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">설명</h3>
                  <p className="text-sm text-accent leading-relaxed">{dataset.description}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">메타데이터</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex justify-between py-2 border-b border-accent/10">
                      <span className="text-xs text-accent">공급자</span>
                      <span className="text-xs text-white">
                        {dataset.provider.name}
                        {dataset.provider.organization ? ` (${dataset.provider.organization})` : ''}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-accent/10">
                      <span className="text-xs text-accent">데이터 형식</span>
                      <span className="text-xs text-white">{dataset.format}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-accent/10">
                      <span className="text-xs text-accent">갱신 주기</span>
                      <span className="text-xs text-white">{FREQUENCY_LABEL[dataset.updateFrequency]}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-accent/10">
                      <span className="text-xs text-accent">등록일</span>
                      <span className="text-xs text-white">{dataset.createdAt}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">태그</h3>
                  <div className="flex flex-wrap gap-2">
                    {dataset.tags.map((tag) => (
                      <Link key={tag.id} href={`/e-data/catalog?q=${tag.name}`}>
                        <Badge variant="default" className="hover:bg-accent/30 transition-colors cursor-pointer">
                          #{tag.name}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'schema' && (
              <Card className="p-6">
                <h3 className="text-sm font-semibold text-white mb-4">데이터 스키마 ({schemaColumns.length}개 컬럼)</h3>
                {preview.isLoading ? (
                  <p className="py-8 text-center text-xs text-accent">스키마를 불러오는 중…</p>
                ) : preview.isError ? (
                  <p className="py-8 text-center text-xs text-accent">스키마를 불러오지 못했습니다.</p>
                ) : schemaColumns.length === 0 ? (
                  <p className="py-8 text-center text-xs text-accent">공개된 스키마가 없습니다.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-accent/20">
                          <th className="text-left py-2 px-3 text-xs font-medium text-accent">컬럼명</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-accent">타입</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-accent">설명</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-accent">마스킹</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schemaColumns.map((col) => (
                          <tr key={col.name} className="border-b border-accent/10 hover:bg-white/[0.02]">
                            <td className="py-2.5 px-3 font-mono text-xs text-primary">{col.name}</td>
                            <td className="py-2.5 px-3">
                              <Badge variant="default" className="text-[10px]">
                                {col.type}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-xs text-white">{col.description}</td>
                            <td className="py-2.5 px-3 text-center text-xs text-accent">{col.masked ? 'Y' : 'N'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {activeTab === 'preview' && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">데이터 미리보기 (상위 {previewRows.length}행)</h3>
                  {preview.data && preview.data.rowCountTotal > 0 && (
                    <Badge variant="info">
                      {previewRows.length} / 총 {preview.data.rowCountTotal.toLocaleString()}행
                    </Badge>
                  )}
                </div>
                {preview.isLoading ? (
                  <p className="py-8 text-center text-xs text-accent">미리보기를 불러오는 중…</p>
                ) : preview.isError ? (
                  <p className="py-8 text-center text-xs text-accent">미리보기를 불러오지 못했습니다.</p>
                ) : schemaColumns.length === 0 || previewRows.length === 0 ? (
                  <p className="py-8 text-center text-xs text-accent">공개된 미리보기가 없습니다.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-accent/10">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-white/[0.02]">
                          {schemaColumns.map((col) => (
                            <th
                              key={col.name}
                              className="text-left py-2 px-3 font-medium text-accent whitespace-nowrap"
                            >
                              {col.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={i} className="border-t border-accent/10 hover:bg-white/[0.02]">
                            {schemaColumns.map((col) => {
                              const val = row[col.name];
                              return (
                                <td key={col.name} className="py-2 px-3 text-white whitespace-nowrap font-mono">
                                  {typeof val === 'number' ? val.toFixed(1) : String(val ?? '—')}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-4">
                <Card className="p-6">
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-white">{dataset.avgRating.toFixed(1)}</p>
                      <div className="flex gap-0.5 mt-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={14}
                            className={cn(
                              s <= Math.round(dataset.avgRating) ? 'text-yellow-400 fill-yellow-400' : 'text-accent/30',
                            )}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-accent mt-1">{dataset.reviewCount}개 리뷰</p>
                    </div>
                    <div className="flex-1 space-y-1">
                      {[5, 4, 3, 2, 1].map((star) => (
                        <div key={star} className="flex items-center gap-2">
                          <span className="text-xs text-accent w-4">{star}</span>
                          <div className="flex-1 h-2 bg-accent/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-yellow-400 rounded-full"
                              style={{ width: `${star === 5 ? 65 : star === 4 ? 25 : star === 3 ? 8 : 2}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
                <Card className="p-8">
                  <p className="text-center text-xs text-accent">등록된 리뷰가 없습니다.</p>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* Right: Price Card (sticky) */}
        <aside className="w-72 shrink-0">
          <div className="sticky top-[124px] space-y-4">
            <Card className="p-5">
              <p className="text-2xl font-bold text-white mb-1">{formatPrice(dataset)}</p>
              {dataset.priceModel.type === 'SUBSCRIPTION' && (
                <p className="text-xs text-accent mb-4">월간 구독 · 언제든 해지 가능</p>
              )}
              {dataset.priceModel.type === 'FREE' && (
                <p className="text-xs text-semantic-green mb-4">무료로 이용할 수 있습니다</p>
              )}
              {dataset.priceModel.type === 'ONETIME' && (
                <p className="text-xs text-accent mb-4">1회 구매 · 영구 이용</p>
              )}

              <div className="space-y-2">
                {dataset.priceModel.type === 'PAY_PER_USE' ? (
                  <Button className="w-full" size="lg" variant="secondary">
                    <MessageSquare size={14} /> 견적 문의
                  </Button>
                ) : (
                  <Button className="w-full" size="lg" onClick={() => setCheckoutOpen(true)}>
                    {dataset.priceModel.type === 'FREE'
                      ? '무료 이용하기'
                      : dataset.priceModel.type === 'SUBSCRIPTION'
                        ? '구독하기'
                        : '구매하기'}
                  </Button>
                )}
                {dataset.priceModel.trialDays && (
                  <Button variant="secondary" className="w-full" size="md">
                    무료 체험 ({dataset.priceModel.trialDays}일)
                  </Button>
                )}
                <Button variant="ghost" className="w-full" size="md" onClick={() => setSampleOpen(true)}>
                  <Download size={14} /> 샘플 확인
                </Button>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t border-accent/10">
                <Button
                  variant={wishlisted ? 'primary' : 'ghost'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setWishlisted(!wishlisted)}
                >
                  <Heart size={14} className={wishlisted ? 'fill-current' : ''} />
                  {wishlisted ? '찜 완료' : '찜하기'}
                </Button>
                <Button variant="ghost" size="sm" className="flex-1">
                  <MessageSquare size={14} /> 문의
                </Button>
              </div>
            </Card>

            {/* 파일형(FILE) 다운로드 — 구매(결제 완료) 후 서버 경유 스트리밍. 경로 비노출. */}
            {isFileFormat && (
              <Card className="p-4">
                <h4 className="text-xs font-semibold text-white mb-2">데이터 파일</h4>
                {datasetFiles.length === 0 ? (
                  <p className="text-xs text-accent">등록된 파일이 없습니다.</p>
                ) : (
                  <ul className="space-y-2">
                    {datasetFiles.map((f) => (
                      <li key={f.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs text-white">{f.originalName}</p>
                          <p className="text-[10px] text-accent">
                            {(f.sizeBytes / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={downloadFile.isPending}
                          onClick={() => handleDownload(f.id, f.originalName)}
                        >
                          <Download size={12} /> 다운로드
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {downloadMsg && <p className="mt-2 text-xs text-semantic-yellow">{downloadMsg}</p>}
                <p className="mt-2 text-[10px] text-accent/60">
                  구매(결제 완료) 후 다운로드됩니다. 서버가 권한을 확인합니다.
                </p>
              </Card>
            )}

            {/* License Info */}
            <Card className="p-4">
              <h4 className="text-xs font-semibold text-white mb-2">라이선스</h4>
              <ul className="space-y-1.5 text-xs text-accent">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-semantic-green" />
                  상업적 이용 가능
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-semantic-green" />
                  가공 및 분석 허용
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-semantic-red" />
                  재배포 불가
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-semantic-yellow" />
                  출처 표기 필수
                </li>
              </ul>
            </Card>
          </div>
        </aside>
      </div>

      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} dataset={dataset} />
      <SamplePreviewModal
        open={sampleOpen}
        onClose={() => setSampleOpen(false)}
        datasetId={dataset.id}
        datasetTitle={dataset.title}
        onBuy={() => {
          setSampleOpen(false);
          setCheckoutOpen(true);
        }}
      />
    </div>
  );
}
