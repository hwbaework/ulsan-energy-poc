'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ShoppingCart, Eye, CreditCard } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Select } from '@/components/edm/ui/Select';
import { Button } from '@/components/edm/ui/Button';
import { Badge } from '@/components/edm/ui/Badge';
import { Tabs } from '@/components/edm/ui/Tabs';
import { OrderStatusBadge } from '@/components/edm/features/OrderStatusBadge';
import { SearchInput } from '@/components/edm/features/SearchInput';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { useOrders } from '@/hooks/edm/useOrders';
import { usePreparePayment, useConfirmPayment } from '@/hooks/edm/usePayments';
import type { Order } from '@/types/edm';

// BE DmOrder 4종 정본 + 정산 지급 완료(PAID). 설계 12 §7.2 (가짜 상태 미표시).
const STATUS_OPTIONS = [
  { value: '', label: '전체 상태' },
  { value: 'ACTIVE', label: '이용중' },
  { value: 'PAYMENT_PENDING', label: '결제대기' },
  { value: 'COMPLETED', label: '완료' },
  { value: 'CANCELLED', label: '취소됨' },
];

const TRADING_TABS = [
  { id: 'purchase', label: '구매 내역' },
  { id: 'sale', label: '판매 내역' },
];

export default function TradingPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const { data: orders, isLive, isLoading, isError } = useOrders(companyId);

  const [tab, setTab] = useState('purchase');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // 결제 재개(기존 orderId 재사용 — 중복 주문 미생성)
  const [resumeOrder, setResumeOrder] = useState<Order | null>(null);
  const [resumeKey, setResumeKey] = useState('');
  const [resumeErr, setResumeErr] = useState('');
  const [resumeDone, setResumeDone] = useState(false);
  const preparePayment = usePreparePayment();
  const confirmPayment = useConfirmPayment();

  const filtered = useMemo(() => {
    let results = [...orders];
    if (statusFilter) {
      results = results.filter((o) => o.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        (o) => o.datasetTitle.toLowerCase().includes(q) || o.providerName.toLowerCase().includes(q),
      );
    }
    return results;
  }, [orders, statusFilter, search]);

  async function openResume(order: Order) {
    setResumeOrder(order);
    setResumeErr('');
    setResumeDone(false);
    setResumeKey('');
    try {
      const prep = await preparePayment.mutateAsync({
        orderId: order.id, // 기존 orderId 재사용
        amount: order.amount,
        method: 'CARD',
      });
      setResumeKey(prep.paymentKey);
    } catch {
      setResumeErr('결제 준비 중 오류가 발생했습니다. 다시 시도해 주세요.');
    }
  }

  async function confirmResume() {
    if (!resumeOrder) return;
    setResumeErr('');
    try {
      const res = await confirmPayment.mutateAsync({
        paymentKey: resumeKey || `mock_${resumeOrder.id}`,
        orderId: resumeOrder.id,
        pgToken: `mock_pg_token_${resumeOrder.id}`,
      });
      if (res.status === 'ACTIVE') setResumeDone(true);
      else setResumeErr('결제가 완료되지 않았습니다. 결제대기 상태로 유지됩니다.');
    } catch {
      setResumeErr('결제 확정 중 오류가 발생했습니다.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-white">거래 현황</h1>
        <Badge variant={isLive ? 'success' : isError ? 'warning' : 'default'}>
          {isLive ? '실시간' : isError ? '불러오기 실패' : '—'}
        </Badge>
      </div>

      <Tabs tabs={TRADING_TABS} activeId={tab} onChange={setTab} />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder="전체 상태"
          className="w-36"
        />
        <SearchInput
          placeholder="데이터셋명, 거래처 검색"
          className="w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={setSearch}
        />
        <div className="flex-1" />
        <p className="text-sm text-accent">
          총 <span className="text-white font-medium">{filtered.length}</span>건
        </p>
      </div>

      {/* Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-accent/20 bg-white/[0.02]">
                <th className="text-left py-3 px-4 text-xs font-medium text-accent">거래번호</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-accent">데이터셋</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-accent">
                  {tab === 'purchase' ? '공급자' : '수요자'}
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-accent">유형</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-accent">금액</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-accent">상태</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-accent">일시</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-accent">액션</th>
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
                    거래 내역을 불러오지 못했습니다.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <ShoppingCart size={40} className="mx-auto text-accent/30 mb-3" />
                    <p className="text-accent">거래 내역이 없습니다</p>
                  </td>
                </tr>
              ) : (
                filtered.map((order) => (
                  <tr key={order.id} className="border-b border-accent/10 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs text-accent">{order.orderNumber}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/e-data/catalog/${order.datasetId}`}
                        className="text-white hover:text-primary transition-colors font-medium text-xs"
                      >
                        {order.datasetTitle}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-xs text-accent">{order.providerName}</td>
                    <td className="py-3 px-4">
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded',
                          order.type === 'SUBSCRIPTION' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent',
                        )}
                      >
                        {order.type === 'SUBSCRIPTION' ? '구독' : '건별'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-xs font-medium text-white">
                        {order.amount === 0 ? '무료' : `₩${order.amount.toLocaleString()}`}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="py-3 px-4 text-xs text-accent">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString('ko-KR') : '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {order.status === 'PAYMENT_PENDING' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => openResume(order)}
                            loading={preparePayment.isPending && resumeOrder?.id === order.id}
                          >
                            <CreditCard size={13} /> 결제하기
                          </Button>
                        )}
                        <Link href={`/e-data/trading/${order.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye size={14} />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 결제 재개 모달 (기존 orderId 재사용) */}
      <Modal
        open={!!resumeOrder}
        onClose={() => {
          if (!confirmPayment.isPending) setResumeOrder(null);
        }}
        title="결제 재개"
        size="sm"
      >
        {resumeOrder &&
          (resumeDone ? (
            <div className="py-4 text-center">
              <p className="text-sm font-semibold text-white">결제가 완료되었습니다</p>
              <p className="mt-1 text-xs text-slate-400">주문이 활성화(ACTIVE)되었습니다.</p>
              <div className="mt-4 flex justify-center">
                <Button size="sm" onClick={() => setResumeOrder(null)}>
                  닫기
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 px-3 py-2">
                <CreditCard size={15} className="text-amber-400 shrink-0" />
                <p className="text-xs text-amber-300">
                  모의 결제 (실 PG 미연동) — 기존 주문을 재사용하며 새 주문을 만들지 않습니다.
                </p>
              </div>
              <div className="rounded-lg bg-white/[0.03] px-4 py-3 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">데이터셋</span>
                  <span className="text-white text-xs">{resumeOrder.datasetTitle}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">거래번호</span>
                  <span className="font-mono text-xs text-accent">{resumeOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">결제금액</span>
                  <span className="font-semibold text-sky-300">₩{resumeOrder.amount.toLocaleString()}</span>
                </div>
              </div>
              {resumeErr && <p className="text-xs text-red-400">{resumeErr}</p>}
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setResumeOrder(null)}
                  disabled={confirmPayment.isPending}
                >
                  취소
                </Button>
                <Button
                  size="sm"
                  onClick={confirmResume}
                  loading={confirmPayment.isPending}
                  disabled={preparePayment.isPending}
                >
                  모의 결제 확인
                </Button>
              </div>
            </div>
          ))}
      </Modal>
    </div>
  );
}
