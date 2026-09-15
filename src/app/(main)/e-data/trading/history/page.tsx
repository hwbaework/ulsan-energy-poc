'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Calendar, Download, FileText } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Button } from '@/components/edm/ui/Button';
import { Badge } from '@/components/edm/ui/Badge';
import { StatCard, StatsGrid } from '@/components/edm/features/StatCard';
import { OrderStatusBadge } from '@/components/edm/features/OrderStatusBadge';
import { useAuthStore } from '@/stores/useAuthStore';
import { useDatasetFiles, useDownloadDatasetFile } from '@/hooks/edm/useDmFile';
import { useOrders } from '@/hooks/edm/useOrders';
import { useDatasets } from '@/hooks/edm/useDm';

// FILE형 구매분 다운로드 셀 — 서버가 구매(결제 완료) 게이팅. 로컬 경로 비노출(서버 경유 스트리밍).
function DownloadCell({ datasetId }: { datasetId: number }) {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const { data: files } = useDatasetFiles(datasetId);
  const downloadFile = useDownloadDatasetFile();
  if (files.length === 0) return <span className="text-xs text-accent/40">—</span>;
  const first = files[0]!;
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={downloadFile.isPending}
      onClick={() => downloadFile.mutate({ fileId: first.id, fileName: first.originalName, companyId })}
    >
      <Download size={12} />
    </Button>
  );
}

export default function TradingHistoryPage() {
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState('2026-05-18');
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);

  // 설계 22: mock(MOCK_ORDERS·MOCK_DATASETS) 폴백 제거 — 실 주문/데이터셋 조회.
  const { data: orders, isLive, isLoading, isError } = useOrders(companyId);
  const { data: datasets } = useDatasets();
  const formatById = useMemo(() => new Map(datasets.map((d) => [d.id, d.format])), [datasets]);

  const totalCount = orders.length;
  const totalAmount = orders.reduce((sum, o) => sum + o.amount, 0);

  // 월별 거래 금액 — 실 주문에서 파생(연-월 집계). 데이터 없으면 빈 차트.
  const monthly = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    for (const o of orders) {
      if (!o.createdAt) continue;
      const month = o.createdAt.slice(0, 7); // YYYY-MM
      const cur = map.get(month) ?? { count: 0, amount: 0 };
      map.set(month, { count: cur.count + 1, amount: cur.amount + o.amount });
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, count: v.count, amount: v.amount }));
  }, [orders]);
  const maxAmount = Math.max(1, ...monthly.map((m) => m.amount));
  const avgAmount = monthly.length > 0 ? Math.round(totalAmount / monthly.length) : 0;

  const guardReason =
    companyId == null
      ? '회사 정보가 없어 거래 이력을 조회할 수 없습니다'
      : isError
        ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
        : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-white">거래 이력</h1>
          <Badge variant={isLive ? 'success' : isError ? 'warning' : 'default'}>
            {isLive ? '실시간' : isError ? '불러오기 실패' : '—'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm">
            <Download size={14} /> CSV
          </Button>
          <Button variant="secondary" size="sm">
            <FileText size={14} /> PDF
          </Button>
        </div>
      </div>
      {guardReason && <p className="text-xs text-amber-400">조회 불가: {guardReason}</p>}

      {/* Period Selector */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Calendar size={16} className="text-accent" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-lg border border-accent/30 bg-surface-dark px-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          />
          <span className="text-accent">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-lg border border-accent/30 bg-surface-dark px-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          />
          <Button size="sm">조회</Button>
        </div>
      </Card>

      {/* Summary */}
      <StatsGrid columns={3}>
        <StatCard label="총 거래 건수" value={totalCount} sub="건" />
        <StatCard label="총 거래 금액" value={`₩${totalAmount.toLocaleString()}`} />
        <StatCard label="월 평균 거래액" value={`₩${avgAmount.toLocaleString()}`} />
      </StatsGrid>

      {/* Monthly Chart */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-white mb-4">월별 거래 금액</h3>
        {monthly.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-xs text-accent">거래 데이터가 없습니다.</p>
          </div>
        ) : (
          <div className="flex items-end gap-2 h-40">
            {monthly.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-accent">₩{(m.amount / 10000).toFixed(0)}만</span>
                <div
                  className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary"
                  style={{ height: `${(m.amount / maxAmount) * 100}%`, minHeight: 4 }}
                />
                <span className="text-[10px] text-accent">{m.month.slice(5)}월</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* History Table */}
      <Card padding={false}>
        <div className="p-4 border-b border-accent/10">
          <h3 className="text-sm font-semibold text-white">상세 이력</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-accent/20 bg-white/[0.02]">
                <th className="text-left py-3 px-4 text-xs font-medium text-accent">날짜</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-accent">거래번호</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-accent">데이터셋</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-accent">유형</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-accent">금액</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-accent">상태</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-accent">영수증</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-accent">파일</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-accent">
                    불러오는 중…
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-accent">
                    거래 이력을 불러오지 못했습니다.
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-accent">
                    등록된 거래 이력이 없습니다.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-b border-accent/10 hover:bg-white/[0.02]">
                    <td className="py-3 px-4 text-xs text-accent">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString('ko-KR') : '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-accent">{order.orderNumber}</td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/e-data/catalog/${order.datasetId}`}
                        className="text-xs text-white hover:text-primary transition-colors"
                      >
                        {order.datasetTitle}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={order.type === 'SUBSCRIPTION' ? 'primary' : 'default'}>
                        {order.type === 'SUBSCRIPTION' ? '구독' : '건별'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-medium text-white">
                      {order.amount === 0 ? '무료' : `₩${order.amount.toLocaleString()}`}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      {order.amount > 0 ? (
                        <Button variant="ghost" size="sm">
                          <FileText size={12} />
                        </Button>
                      ) : (
                        <span className="text-xs text-accent/40">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {formatById.get(order.datasetId) === 'FILE' ? (
                        <DownloadCell datasetId={order.datasetId} />
                      ) : (
                        <span className="text-xs text-accent/40">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-accent/10 flex items-center justify-between">
          <p className="text-xs text-accent">
            총 거래: <span className="text-white font-medium">{totalCount}건</span> · 총 금액:{' '}
            <span className="text-white font-medium">₩{totalAmount.toLocaleString()}</span>
          </p>
        </div>
      </Card>
    </div>
  );
}
