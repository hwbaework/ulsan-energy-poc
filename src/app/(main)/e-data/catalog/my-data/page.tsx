'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Database, Download, Key, ExternalLink, Send, FileText } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Button } from '@/components/edm/ui/Button';
import { Badge } from '@/components/edm/ui/Badge';
import { Tabs } from '@/components/edm/ui/Tabs';
import { OrderStatusBadge } from '@/components/edm/features/OrderStatusBadge';
import { useAuthStore } from '@/stores/useAuthStore';
import { useOrders } from '@/hooks/edm/useOrders';
import { useReviewDataset, useGenerateSample, useDatasets } from '@/hooks/edm/useDm';

const MY_DATA_TABS = [
  { id: 'purchased', label: '구매한 데이터' },
  { id: 'registered', label: '등록한 데이터' },
];

const STATUS_LABEL: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'danger' | 'default' }> =
  {
    PUBLISHED: { label: '게시중', variant: 'success' },
    REVIEW: { label: '심사중', variant: 'info' },
    DRAFT: { label: '작성완료', variant: 'warning' },
    REJECTED: { label: '반려됨', variant: 'danger' },
  };

export default function MyDataPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') === 'registered' ? 'registered' : 'purchased');
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  // 설계 22: mock(MOCK_ORDERS) 폴백 제거 — 실 주문 조회.
  const { data: orders, isError: ordersError } = useOrders(companyId);
  // 설계 22: mock(REGISTERED_DATASETS) 폴백 제거 — 판매자 소유 데이터셋 실조회(전 상태).
  const { data: registered, isError: registeredError } = useDatasets(undefined, companyId);
  const reviewDataset = useReviewDataset();
  const generateSample = useGenerateSample();
  const [reviewed, setReviewed] = useState<Record<number, boolean>>({});
  // 기획 14 §5 — 판매자 전용 샘플 생성(최신 파일에서 비식별 표본 파생·저장)
  const [sampleState, setSampleState] = useState<Record<number, 'done' | 'demo'>>({});

  async function handleSubmitReview(id: number) {
    await reviewDataset.mutateAsync(id);
    setReviewed((r) => ({ ...r, [id]: true }));
  }

  async function handleGenerateSample(id: number) {
    const res = await generateSample.mutateAsync(id);
    setSampleState((s) => ({ ...s, [id]: res.isLive ? 'done' : 'demo' }));
  }

  const activeSubscriptions = orders.filter((o) => o.status === 'ACTIVE');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">내 데이터</h1>
        <Button size="sm" onClick={() => (window.location.href = '/e-data/catalog/register')}>
          <Database size={14} /> 데이터 등록
        </Button>
      </div>

      <Tabs tabs={MY_DATA_TABS} activeId={tab} onChange={setTab} />

      {tab === 'purchased' && (
        <div className="space-y-4">
          <p className="text-sm text-accent">
            활성 구독 <span className="text-white font-medium">{activeSubscriptions.length}</span>건
          </p>
          {companyId == null ? (
            <Card className="p-12 flex flex-col items-center justify-center text-center">
              <Database size={48} className="text-accent/30 mb-4" />
              <p className="text-white font-medium mb-1">회사 정보가 없어 구매 데이터를 조회할 수 없습니다</p>
              <p className="text-sm text-accent">다시 로그인해 주세요</p>
            </Card>
          ) : ordersError ? (
            <Card className="p-12 flex flex-col items-center justify-center text-center">
              <Database size={48} className="text-accent/30 mb-4" />
              <p className="text-white font-medium mb-1">데이터를 불러오지 못했습니다 — 다시 로그인하세요</p>
            </Card>
          ) : activeSubscriptions.length === 0 ? (
            <Card className="p-12 flex flex-col items-center justify-center text-center">
              <Database size={48} className="text-accent/30 mb-4" />
              <p className="text-white font-medium mb-1">구매한 데이터가 없습니다</p>
              <p className="text-sm text-accent mb-4">카탈로그에서 데이터를 검색해 보세요</p>
              <Link href="/e-data/catalog">
                <Button>카탈로그 둘러보기</Button>
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {activeSubscriptions.map((order) => (
                <Card key={order.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/e-data/catalog/${order.datasetId}`}
                          className="text-sm font-medium text-white hover:text-primary transition-colors truncate"
                        >
                          {order.datasetTitle}
                        </Link>
                        <OrderStatusBadge status={order.status} />
                        <Badge variant={order.type === 'SUBSCRIPTION' ? 'primary' : 'default'}>
                          {order.type === 'SUBSCRIPTION' ? '구독' : '건별'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-accent">
                        <span>{order.providerName}</span>
                        {order.startDate && <span>시작: {new Date(order.startDate).toLocaleDateString('ko-KR')}</span>}
                        {order.endDate && <span>만료: {new Date(order.endDate).toLocaleDateString('ko-KR')}</span>}
                        {order.amount > 0 && <span>₩{order.amount.toLocaleString()}/월</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <Button variant="secondary" size="sm">
                        <Download size={12} /> 다운로드
                      </Button>
                      <Button variant="secondary" size="sm">
                        <Key size={12} /> API 키
                      </Button>
                      <Link href={`/e-data/catalog/${order.datasetId}`}>
                        <Button variant="ghost" size="sm">
                          <ExternalLink size={12} />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'registered' && (
        <div className="space-y-4">
          {companyId == null ? (
            <Card className="p-12 flex flex-col items-center justify-center text-center">
              <Database size={48} className="text-accent/30 mb-4" />
              <p className="text-white font-medium mb-1">회사 정보가 없어 조회할 수 없습니다</p>
              <p className="text-sm text-accent">다시 로그인해 주세요</p>
            </Card>
          ) : registeredError ? (
            <Card className="p-12 flex flex-col items-center justify-center text-center">
              <Database size={48} className="text-accent/30 mb-4" />
              <p className="text-white font-medium mb-1">데이터를 불러오지 못했습니다 — 다시 로그인하세요</p>
            </Card>
          ) : registered.length === 0 ? (
            <Card className="p-12 flex flex-col items-center justify-center text-center">
              <Database size={48} className="text-accent/30 mb-4" />
              <p className="text-white font-medium mb-1">등록한 데이터가 없습니다</p>
              <p className="text-sm text-accent mb-4">데이터를 등록해 판매를 시작하세요</p>
              <Link href="/e-data/catalog/register">
                <Button>데이터 등록</Button>
              </Link>
            </Card>
          ) : (
            <>
              <p className="text-sm text-accent">
                등록 데이터 <span className="text-white font-medium">{registered.length}</span>건
              </p>
              <Card padding={false}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-accent/20 bg-white/[0.02]">
                        <th className="text-left py-3 px-4 text-xs font-medium text-accent">데이터셋</th>
                        <th className="text-center py-3 px-4 text-xs font-medium text-accent">상태</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-accent">품질</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-accent">기본가</th>
                        <th className="text-center py-3 px-4 text-xs font-medium text-accent">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registered.map((ds) => {
                        const effStatus = reviewed[ds.id] ? 'REVIEW' : (ds.status ?? 'DRAFT');
                        const st = STATUS_LABEL[effStatus] ?? STATUS_LABEL.DRAFT!;
                        const canRequest = effStatus === 'DRAFT';
                        const base = ds.priceModel.type === 'FREE' ? 0 : (ds.priceModel.basePrice ?? 0);
                        return (
                          <tr key={ds.id} className="border-b border-accent/10 hover:bg-white/[0.02]">
                            <td className="py-3 px-4 text-xs font-medium text-white">{ds.title}</td>
                            <td className="py-3 px-4 text-center">
                              <Badge variant={st.variant}>{st.label}</Badge>
                            </td>
                            <td className="py-3 px-4 text-right text-xs text-accent">
                              {ds.qualityScore > 0 ? `${ds.qualityScore}점` : '미판정'}
                            </td>
                            <td className="py-3 px-4 text-right text-xs font-medium text-white">
                              {base > 0 ? `₩${base.toLocaleString()}` : '무료'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {canRequest && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    loading={reviewDataset.isPending}
                                    onClick={() => handleSubmitReview(ds.id)}
                                  >
                                    <Send size={12} /> 심사 요청
                                  </Button>
                                )}
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  loading={generateSample.isPending}
                                  onClick={() => handleGenerateSample(ds.id)}
                                >
                                  <FileText size={12} />{' '}
                                  {sampleState[ds.id] === 'done'
                                    ? '샘플 생성됨'
                                    : sampleState[ds.id] === 'demo'
                                      ? '샘플(미생성)'
                                      : '샘플 생성'}
                                </Button>
                                <Button variant="ghost" size="sm">
                                  수정
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
