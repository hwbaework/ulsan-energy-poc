'use client';

// 구매/구독 체크아웃 모달 — 07 §9.1.1 SPEC-P0-COMMERCE.
// FREE 즉시 ACTIVE / 유료 prepare→모의 결제 확인 UI→confirm→ACTIVE.
// 실 PG 미연동 → "모의 결제" 배지 정직 고지(isLive:false·mock:true).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertTriangle, CreditCard, Building2, ShieldAlert } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/edm/ui/Button';
import { Badge } from '@/components/edm/ui/Badge';
import { cn } from '@/lib/utils';
import type { DatasetListItem } from '@/types/edm';
import type { PaymentMethod } from '@/types/edm';
import { useCreateOrder, usePreparePayment, useConfirmPayment, type PriceModelKind } from '@/hooks/edm/usePayments';

type Phase = 'form' | 'paying' | 'done' | 'error';

const VAT_RATE = 0.1;

function priceKind(t: string): PriceModelKind {
  if (t === 'FREE' || t === 'ONETIME' || t === 'SUBSCRIPTION' || t === 'PAY_PER_USE') return t;
  return 'ONETIME';
}

export function CheckoutModal({
  open,
  onClose,
  dataset,
}: {
  open: boolean;
  onClose: () => void;
  dataset: DatasetListItem;
}) {
  const router = useRouter();
  const pm = dataset.priceModel;
  const kind = priceKind(pm.type);
  const isFree = kind === 'FREE';
  const orderType = kind === 'SUBSCRIPTION' ? 'SUBSCRIPTION' : 'ONETIME';

  const base = pm.basePrice ?? 0;
  const vat = Math.round(base * VAT_RATE);
  const total = base + vat;

  const [licensed, setLicensed] = useState(false);
  const [cycle, setCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [method, setMethod] = useState<PaymentMethod>('CARD');
  const [phase, setPhase] = useState<Phase>('form');
  const [errorMsg, setErrorMsg] = useState<string>('');
  // 모의 결제 게이트: prepare 후 실 PG 리다이렉트 대신 확인 UI를 노출한다.
  const [mockPaying, setMockPaying] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [paymentKey, setPaymentKey] = useState<string>('');

  const createOrder = useCreateOrder();
  const preparePayment = usePreparePayment();
  const confirmPayment = useConfirmPayment();

  const busy = createOrder.isPending || preparePayment.isPending || confirmPayment.isPending;

  function reset() {
    setPhase('form');
    setErrorMsg('');
    setMockPaying(false);
    setOrderId(null);
    setPaymentKey('');
  }

  function handleClose() {
    if (busy) return;
    reset();
    onClose();
  }

  // FREE: 즉시 ACTIVE / 유료: 주문 → prepare → (모의 결제 확인 UI)
  async function handleStart() {
    setErrorMsg('');
    try {
      const order = await createOrder.mutateAsync({
        datasetId: dataset.id,
        type: orderType,
        priceModel: kind,
        billingCycle: kind === 'SUBSCRIPTION' ? cycle : undefined,
        amount: total,
      });
      setOrderId(order.orderId);

      if (isFree || order.status === 'ACTIVE') {
        setPhase('done');
        return;
      }

      // 유료 → 결제 준비
      setPhase('paying');
      const prep = await preparePayment.mutateAsync({
        orderId: order.orderId,
        amount: total,
        method,
      });
      setPaymentKey(prep.paymentKey);

      if (prep.isLive && prep.redirectUrl && !prep.redirectUrl.startsWith('#')) {
        // 실 PG(향후) — 외부 리다이렉트
        window.location.href = prep.redirectUrl;
        return;
      }
      // 모의 PG — 인앱 확인 UI 노출
      setMockPaying(true);
    } catch {
      setErrorMsg('주문·결제 준비 중 오류가 발생했습니다. 다시 시도해 주세요.');
      setPhase('error');
    }
  }

  // 모의 PG 결제 확정
  async function handleConfirm() {
    if (orderId == null) return;
    setErrorMsg('');
    try {
      const res = await confirmPayment.mutateAsync({
        paymentKey,
        orderId,
        pgToken: `mock_pg_token_${orderId}`, // 스텁 토큰
      });
      if (res.status === 'ACTIVE') {
        setMockPaying(false);
        setPhase('done');
      } else {
        setErrorMsg('결제가 완료되지 않았습니다. 결제대기 상태로 유지됩니다.');
        setPhase('error');
      }
    } catch {
      setErrorMsg('결제 확정 중 오류가 발생했습니다. 주문 내역에서 재개할 수 있습니다.');
      setPhase('error');
    }
  }

  const title = isFree ? '무료 이용 신청' : orderType === 'SUBSCRIPTION' ? '구독 결제' : '구매 결제';

  return (
    <Modal open={open} onClose={handleClose} title={title} size="md">
      {/* 정직성 배지 — 실 PG 미연동 */}
      {!isFree && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 px-3 py-2">
          <ShieldAlert size={15} className="text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300">
            모의 결제 (실 PG 미연동) — 실제 청구·정산은 이뤄지지 않으며 주문 상태 전이만 시연됩니다.
          </p>
        </div>
      )}

      {/* 헤더 */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{dataset.title}</p>
          <p className="mt-0.5 text-xs text-slate-400">{dataset.provider.name}</p>
        </div>
        <Badge variant="success">품질 {dataset.qualityScore}점</Badge>
      </div>

      {phase === 'done' ? (
        <div className="py-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <CheckCircle2 size={24} className="text-emerald-400" />
          </div>
          <p className="text-sm font-semibold text-white">
            {isFree ? '이용 신청이 완료되었습니다' : '결제가 완료되었습니다'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            주문이 활성화(ACTIVE)되었습니다. 내 데이터에서 바로 이용할 수 있습니다.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleClose}>
              닫기
            </Button>
            <Button
              size="sm"
              onClick={() => {
                handleClose();
                router.push('/e-data/catalog/my-data');
              }}
            >
              내 데이터로 이동
            </Button>
          </div>
        </div>
      ) : mockPaying ? (
        <div className="py-2">
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-500/10 ring-1 ring-blue-500/20 px-3 py-2.5">
            <CreditCard size={16} className="text-blue-400 shrink-0" />
            <div>
              <p className="text-xs font-medium text-blue-300">모의 PG 결제 페이지</p>
              <p className="text-[11px] text-slate-400">결제키 {paymentKey} · 실 결제창 대신 시연 확인입니다.</p>
            </div>
          </div>
          <div className="rounded-lg bg-white/[0.03] px-4 py-3 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-slate-400">결제수단</span>
              <span className="text-white">{method === 'CARD' ? '카드' : '계좌이체'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">결제금액</span>
              <span className="font-semibold text-sky-300">₩{total.toLocaleString()}</span>
            </div>
          </div>
          {errorMsg && <p className="mt-3 text-xs text-red-400">{errorMsg}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={handleClose} disabled={confirmPayment.isPending}>
              취소 (결제대기 유지)
            </Button>
            <Button size="sm" onClick={handleConfirm} loading={confirmPayment.isPending}>
              모의 결제 확인
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 가격 요약 */}
          <div className="rounded-lg bg-white/[0.03] px-4 py-3 text-sm">
            {isFree ? (
              <div className="flex justify-between py-1">
                <span className="text-slate-400">이용료</span>
                <span className="font-semibold text-emerald-400">무료</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">단가</span>
                  <span className="text-white">
                    ₩{base.toLocaleString()}
                    {orderType === 'SUBSCRIPTION' ? ' / 월' : ''}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">부가세 (10%)</span>
                  <span className="text-white">₩{vat.toLocaleString()}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-white/[0.06] pt-2">
                  <span className="font-medium text-slate-300">합계</span>
                  <span className="text-base font-bold text-sky-300">₩{total.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>

          {/* 구독 옵션 */}
          {orderType === 'SUBSCRIPTION' && (
            <div>
              <p className="mb-2 text-xs font-medium text-slate-400">구독 주기</p>
              <div className="flex gap-2">
                {(['MONTHLY', 'YEARLY'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCycle(c)}
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-sm transition-colors',
                      cycle === c
                        ? 'border-blue-500/50 bg-blue-500/10 text-white'
                        : 'border-white/[0.08] text-slate-400 hover:text-white',
                    )}
                  >
                    {c === 'MONTHLY' ? '월간' : '연간'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 결제수단 */}
          {!isFree && (
            <div>
              <p className="mb-2 text-xs font-medium text-slate-400">결제수단</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMethod('CARD')}
                  className={cn(
                    'flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors',
                    method === 'CARD'
                      ? 'border-blue-500/50 bg-blue-500/10 text-white'
                      : 'border-white/[0.08] text-slate-400 hover:text-white',
                  )}
                >
                  <CreditCard size={14} /> 카드
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('BANK_TRANSFER')}
                  className={cn(
                    'flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors',
                    method === 'BANK_TRANSFER'
                      ? 'border-blue-500/50 bg-blue-500/10 text-white'
                      : 'border-white/[0.08] text-slate-400 hover:text-white',
                  )}
                >
                  <Building2 size={14} /> 계좌이체
                </button>
              </div>
            </div>
          )}

          {/* 라이선스 동의 */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={licensed}
              onChange={(e) => setLicensed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent"
            />
            <span className="text-xs text-slate-400">
              라이선스 약관(상업적 이용 가능·재배포 불가·출처 표기 필수)에 동의합니다.{' '}
              {!isFree && '결제 후 환불은 정책에 따릅니다.'}
            </span>
          </label>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2">
              <AlertTriangle size={14} className="text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{errorMsg}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={handleClose} disabled={busy}>
              취소
            </Button>
            <Button size="sm" onClick={handleStart} loading={busy} disabled={!licensed}>
              {isFree ? '즉시 이용' : '결제하기'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
