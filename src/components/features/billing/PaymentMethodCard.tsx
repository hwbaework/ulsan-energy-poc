'use client';

import { useMemo, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { SectionCard } from '@/components/features';
import { DataTable, type Column } from '@/components/features/DataList';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { cardText, cardsOf, useBillingStore, useHydrateBilling, type CompanyCard } from '@/stores/useBillingStore';
import { DM_TODAY, isActive, useDataMarketStore, useHydrateDataMarket } from '@/stores/useDataMarketStore';
import { customerKeyOf, openCardRegistration, tossReady } from '@/lib/toss-billing';

const won = (v: number) => `₩${v.toLocaleString('ko-KR')}`;
const day = (iso: string) => iso.slice(0, 10);
/** 다음 자동결제일 — 다음 달 1일 */
const nextPayDate = () => {
  let [y = 2026, m = 1] = DM_TODAY.split('-').map(Number);
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}-01`;
};

/**
 * 기업 정보 › 결제 수단 — 기업 카드 여러 장, 기본 카드가 매달 자동결제. 기업관리자만 등록 · 기본 지정 · 삭제, 소속 멤버는 보기만.
 * 카드 등록 = 토스페이먼츠 결제창(우리 화면엔 카드 입력 칸이 없다). 아래는 '결제하는 것' — 이용 중인 서비스 · 월 금액 · 다음 결제일
 */
export function PaymentMethodCard({ companyId, canEdit }: { companyId: number; canEdit: boolean }) {
  useHydrateBilling();
  useHydrateDataMarket();
  const addToast = useToastStore((s) => s.add);
  const all = useBillingStore((s) => s.cards);
  const cards = useMemo(() => cardsOf(all, companyId), [all, companyId]);
  const setDefault = useBillingStore((s) => s.setDefault);
  const removeCard = useBillingStore((s) => s.removeCard);
  const trades = useDataMarketStore((s) => s.trades);
  const user = useAuthStore((s) => s.user);
  const saltOf = useBillingStore((s) => s.saltOf);
  const [busy, setBusy] = useState(false);
  const [askRemove, setAskRemove] = useState<CompanyCard | null>(null);
  // 카드 등록 — 토스페이먼츠 결제창. 카드 번호 · 카드사 인증은 토스 창에서, 끝나면 /org/billing/success 가 빌링키를 받아 저장
  const register = async () => {
    if (!tossReady()) {
      addToast('error', '토스페이먼츠 클라이언트 키(NEXT_PUBLIC_TOSS_CLIENT_KEY)가 없습니다');
      return;
    }
    try {
      setBusy(true);
      await openCardRegistration({
        customerKey: cards[0]?.customerKey ?? customerKeyOf(companyId, saltOf(companyId)),
        email: user?.email,
        name: user?.name,
      });
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : '토스페이먼츠 창을 열지 못했습니다');
      setBusy(false);
    }
  };

  // 결제하는 것 — 이 기업이 이용 중인 데이터. 매달 1일 기본 카드로 자동결제
  const uses = useMemo(
    () =>
      trades
        .filter((t) => t.buyerCompanyId === companyId && isActive(t))
        .map((t) => ({ t }))
        .sort((a, b) => b.t.startedAt.localeCompare(a.t.startedAt)),
    [trades, companyId],
  );
  const monthly = uses.reduce((a, x) => a + x.t.price, 0);

  const cardCols: Column<CompanyCard>[] = [
    {
      key: 'card',
      header: '카드',
      render: (c) => (
        <span className="whitespace-nowrap font-medium text-white tabular-nums">
          {cardText(c)}
          {c.isDefault && (
            <Badge variant="primary" className="ml-2">
              기본
            </Badge>
          )}
        </span>
      ),
    },
    { key: 'at', header: '등록일', width: '140px', render: (c) => <span className="tabular-nums text-slate-300">{day(c.registeredAt)}</span> },
    ...(canEdit
      ? [
          {
            key: 'act',
            header: '관리',
            width: '200px',
            align: 'right' as const,
            render: (c: CompanyCard) => (
              <div className="inline-flex justify-end gap-2">
                {!c.isDefault && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setDefault(c.id);
                      addToast('success', `${cardText(c)} 기본 카드`);
                    }}
                  >
                    기본으로
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => setAskRemove(c)}>
                  삭제
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];
  type Use = (typeof uses)[number];
  const useCols: Column<Use>[] = [
    { key: 'svc', header: '서비스', width: '130px', render: () => <span className="text-slate-300">E-데이터마켓</span> },
    { key: 'name', header: '내용', render: (u) => <span className="text-white">{u.t.datasetName}</span> },
    { key: 'amt', header: '월 금액', width: '110px', align: 'right', render: (u) => <span className="tabular-nums text-white">{won(u.t.price)}</span> },
    { key: 'start', header: '시작일', width: '130px', render: (u) => <span className="tabular-nums text-slate-300">{day(u.t.startedAt)}</span> },
    { key: 'next', header: '다음 결제일', width: '130px', render: () => <span className="tabular-nums text-white">{nextPayDate()}</span> },
  ];

  return (
    <SectionCard
      title={`결제 수단 (${cards.length})`}
      actions={
        canEdit ? (
          <Button size="sm" onClick={() => void register()} disabled={busy}>
            <CreditCard size={14} className="mr-1.5" /> 카드 등록
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {/* 기업 카드 — 여러 장, 기본 카드 하나가 매달 자동결제 */}
        <DataTable
          columns={cardCols}
          data={cards}
          rowKey={(c) => c.id}
          emptyMessage={canEdit ? '등록된 카드 없음' : '등록된 카드 없음 · 기업관리자가 등록합니다'}
        />

        {/* 결제하는 것 — 서비스마다 다음 결제일 */}
        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 px-1">
            <h4 className="text-base font-semibold text-white">{`결제하는 것 (${uses.length})`}</h4>
            <p className="text-sm text-slate-300 tabular-nums">
              매달 <b className="text-white">{won(monthly)}</b>
            </p>
          </div>
          <DataTable columns={useCols} data={uses} rowKey={(u) => u.t.id} emptyMessage="이용 중인 유료 서비스 없음" />
        </div>
      </div>

      <ConfirmDialog
        open={!!askRemove}
        onClose={() => setAskRemove(null)}
        onConfirm={() => {
          if (askRemove) {
            removeCard(askRemove.id);
            addToast('success', `${cardText(askRemove)} 삭제`);
          }
          setAskRemove(null);
        }}
        title="카드 삭제"
        message={
          askRemove?.isDefault && cards.length > 1
            ? `${askRemove ? cardText(askRemove) : ''} 를 지웁니다. 기본 카드는 남은 카드 중 먼저 등록한 카드로 바뀝니다.`
            : askRemove?.isDefault
              ? `${askRemove ? cardText(askRemove) : ''} 를 지웁니다. 남은 카드가 없어 다음 자동결제가 되지 않습니다.`
              : `${askRemove ? cardText(askRemove) : ''} 를 지웁니다.`
        }
        confirmLabel="삭제"
        variant="danger"
      />
    </SectionCard>
  );
}
