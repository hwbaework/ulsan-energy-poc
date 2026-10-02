'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Copy, Plus, RotateCw } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { BackButton } from '@/components/layout/PageTitle';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { StatusPill, type StatusTone } from '@/components/ui/Design';
import { RmsLineChart } from '@/components/ui/Chart';
import { getPersona } from '@/lib/persona';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import {
  DATASET_STATUS_LABEL,
  DATA_KINDS,
  DELIVERIES,
  PRICE_TYPE_LABEL,
  settlementsOfTrades,
  usageDays,
  usageOf,
  useDataMarketStore,
  useHydrateDataMarket,
  type DataKind,
  type DataSettlement,
  type DataTrade,
  type Dataset,
  type DatasetStatus,
  type Delivery,
  type PriceType,
} from '@/stores/useDataMarketStore';

/* ── 공통 ── */
const won = (n: number) => `₩${n.toLocaleString('ko-KR')}`;
const day = (iso?: string) => (iso ? iso.slice(0, 10) : '');
const priceText = (d: Pick<Dataset, 'priceType' | 'price' | 'proposedPrice'>) =>
  `${won(d.price ?? d.proposedPrice)} · ${PRICE_TYPE_LABEL[d.priceType]}`;
const periodText = (d: Pick<Dataset, 'periodFrom' | 'periodTo'>) => `${d.periodFrom} ~ ${d.periodTo ?? ''}`;
const STATUS_TONE: Record<DatasetStatus, StatusTone> = { PENDING: 'warning', APPROVED: 'normal', REJECTED: 'danger' };
const cell = (v: ReactNode, cls = 'text-slate-300') => <span className={`whitespace-nowrap text-sm ${cls}`}>{v}</span>;
const num = (v: ReactNode) => <span className="whitespace-nowrap text-sm tabular-nums text-slate-300">{v}</span>;
const arrow: Column<never> = {
  key: 'go',
  header: '',
  width: '40px',
  render: () => <ChevronRight size={15} className="text-slate-600" />,
};
const CATALOG = '/e-data/catalog';

/** 화면 제목 — E-데이터마켓 › 데이터 마켓플레이스 › 화면 */
function Header({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'E-데이터마켓', path: '/e-data/inventory' },
          { label: '데이터 마켓플레이스' },
          { label: title },
        ]}
      />
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

function Info({ label, value, className }: { label: string; value?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-1 text-sm text-slate-400">{label}</p>
      <p className="break-words text-base text-white">{value === undefined || value === '' ? ' ' : value}</p>
    </div>
  );
}

/** 역할 — 관리자(플랫폼)는 승인 · 전체 보기, 발전사업자 · 전기사용자는 등록 · 신청 · 자기 것 */
function useDataRole() {
  useHydrateDataMarket();
  const user = useAuthStore((s) => s.user);
  const persona = getPersona(user);
  const isAdmin = persona === 'admin' || persona === 'spc';
  const companyId = user?.companyId ?? 0;
  const companyName = user?.companyName ?? '';
  const datasetsAll = useDataMarketStore((s) => s.datasets);
  const tradesAll = useDataMarketStore((s) => s.trades);
  const datasets = useMemo(
    () =>
      isAdmin ? datasetsAll : datasetsAll.filter((d) => d.status === 'APPROVED' || d.ownerCompanyId === companyId),
    [isAdmin, datasetsAll, companyId],
  );
  const trades = useMemo(
    () =>
      isAdmin ? tradesAll : tradesAll.filter((t) => t.buyerCompanyId === companyId || t.sellerCompanyId === companyId),
    [isAdmin, tradesAll, companyId],
  );
  return { isAdmin, companyId, companyName, datasets, trades };
}

/* ══ 3.3.1 데이터 등록/신청 — 목록 ══ */
export function DataCatalogScreen() {
  const router = useRouter();
  const role = useDataRole();
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const rows = useMemo(
    () =>
      role.datasets
        .filter((d) => (!status || d.status === status) && (!kind || d.kind === kind))
        .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt)),
    [role.datasets, status, kind],
  );
  const count = (s: DatasetStatus) => role.datasets.filter((d) => d.status === s).length;

  const columns: Column<Dataset>[] = [
    { key: 'name', header: '데이터명', render: (d) => cell(d.name, 'font-medium text-white') },
    { key: 'kind', header: '종류', width: '120px', render: (d) => cell(d.kind) },
    { key: 'owner', header: '제공 기업', width: '120px', render: (d) => cell(d.ownerCompanyName) },
    { key: 'delivery', header: '제공 방식', width: '90px', render: (d) => cell(d.delivery) },
    { key: 'period', header: '기간', width: '170px', render: (d) => num(periodText(d)) },
    { key: 'price', header: '가격', width: '190px', render: (d) => num(priceText(d)) },
    {
      key: 'registered',
      header: '등록일',
      width: '120px',
      sortable: true,
      sortValue: (d) => d.registeredAt,
      render: (d) => num(day(d.registeredAt)),
    },
    {
      key: 'status',
      header: '상태',
      width: '100px',
      render: (d) => <StatusPill tone={STATUS_TONE[d.status]} label={DATASET_STATUS_LABEL[d.status]} />,
    },
    arrow as Column<Dataset>,
  ];

  return (
    <div className="space-y-6">
      <Header
        title="데이터 등록/신청"
        actions={
          !role.isAdmin && (
            <Button onClick={() => router.push(`${CATALOG}/register`)}>
              <Plus size={16} className="mr-1" /> 데이터 등록
            </Button>
          )
        }
      />
      <StatsGrid columns={3}>
        <StatCard label="승인" value={`${count('APPROVED')}건`} />
        <StatCard label="승인 대기" value={`${count('PENDING')}건`} />
        <StatCard label="반려" value={`${count('REJECTED')}건`} />
      </StatsGrid>
      <SectionCard
        title="데이터"
        actions={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              종류
              <Select
                options={[{ value: '', label: '전체' }, ...DATA_KINDS.map((k) => ({ value: k, label: k }))]}
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="w-32"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              상태
              <Select
                options={[
                  { value: '', label: '전체' },
                  ...(Object.keys(DATASET_STATUS_LABEL) as DatasetStatus[]).map((s) => ({
                    value: s,
                    label: DATASET_STATUS_LABEL[s],
                  })),
                ]}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-32"
              />
            </label>
          </div>
        }
        noPadding
      >
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(d) => d.id}
          emptyMessage="데이터 없음"
          onRowClick={(d) => router.push(`${CATALOG}/view?id=${d.id}`)}
        />
      </SectionCard>
    </div>
  );
}

/* ══ 데이터 등록 — 발전사업자 · 전기사용자. 취소 · 등록은 제목 줄 오른쪽 ══ */
export function DataRegisterScreen() {
  const router = useRouter();
  const role = useDataRole();
  const register = useDataMarketStore((s) => s.register);
  const addToast = useToastStore((s) => s.add);
  const [v, setV] = useState({
    name: '',
    kind: '발전량' as DataKind,
    delivery: 'API' as Delivery,
    periodFrom: '',
    periodTo: '',
    description: '',
    priceType: 'MONTHLY' as PriceType,
    price: '',
  });
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV((p) => ({ ...p, [k]: x }));
  const valid = v.name.trim() && v.periodFrom && Number(v.price) > 0 && (!v.periodTo || v.periodTo >= v.periodFrom);

  const submit = () => {
    const d = register({
      name: v.name.trim(),
      kind: v.kind,
      delivery: v.delivery,
      periodFrom: v.periodFrom,
      periodTo: v.periodTo || undefined,
      description: v.description.trim() || undefined,
      ownerCompanyId: role.companyId,
      ownerCompanyName: role.companyName,
      priceType: v.priceType,
      proposedPrice: Number(v.price),
    });
    addToast('success', `${d.name} 등록 — 승인 대기`);
    router.push(`${CATALOG}/view?id=${d.id}`);
  };

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'E-데이터마켓', path: '/e-data/inventory' },
          { label: '데이터 등록/신청', path: CATALOG },
          { label: '데이터 등록' },
        ]}
      />
      <div className="sticky top-[100px] z-20 -mt-3 flex items-center justify-between gap-3 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <BackButton href={CATALOG} label="데이터 등록/신청으로" />
          <h1 className="text-2xl font-bold text-white">데이터 등록</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => router.push(CATALOG)}>
            취소
          </Button>
          <Button disabled={!valid} onClick={submit}>
            등록
          </Button>
        </div>
      </div>
      <SectionCard title="데이터">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <Input
              label="데이터명"
              value={v.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="예: 한길 전력 사용량 (15분)"
              required
            />
          </div>
          <Input label="제공 기업" value={role.companyName} disabled />
          <Select
            label="종류"
            options={DATA_KINDS.map((k) => ({ value: k, label: k }))}
            value={v.kind}
            onChange={(e) => set('kind', e.target.value as DataKind)}
          />
          <Select
            label="제공 방식"
            options={DELIVERIES.map((k) => ({ value: k, label: k }))}
            value={v.delivery}
            onChange={(e) => set('delivery', e.target.value as Delivery)}
          />
          <div />
          <Input
            label="기간 시작"
            type="month"
            value={v.periodFrom}
            onChange={(e) => set('periodFrom', e.target.value)}
            required
          />
          <Input
            label="기간 끝 (계속이면 비움)"
            type="month"
            value={v.periodTo}
            onChange={(e) => set('periodTo', e.target.value)}
          />
          <div />
          <div className="md:col-span-3">
            <Textarea
              label="내용"
              value={v.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>
      </SectionCard>
      <SectionCard title="가격">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Select
            label="가격 방식"
            options={(Object.keys(PRICE_TYPE_LABEL) as PriceType[]).map((k) => ({
              value: k,
              label: PRICE_TYPE_LABEL[k],
            }))}
            value={v.priceType}
            onChange={(e) => set('priceType', e.target.value as PriceType)}
          />
          <Input
            label="제시 가격 (원)"
            inputMode="numeric"
            value={v.price ? Number(v.price).toLocaleString('ko-KR') : ''}
            onChange={(e) => set('price', e.target.value.replace(/[^\d]/g, ''))}
            placeholder="000,000"
            required
          />
        </div>
      </SectionCard>
    </div>
  );
}

/* ══ 데이터 한 건 — 관리자: 가격 확정 · 승인 / 반려, 다른 기업: 신청 ══ */
export function DataDetailScreen() {
  const router = useRouter();
  const role = useDataRole();
  const approve = useDataMarketStore((s) => s.approve);
  const reject = useDataMarketStore((s) => s.reject);
  const apply = useDataMarketStore((s) => s.apply);
  const addToast = useToastStore((s) => s.add);
  const [id, setId] = useState<number | null>(null);
  const [price, setPrice] = useState('');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState<'approve' | 'reject' | 'apply' | null>(null);
  useEffect(() => {
    setId(Number(new URLSearchParams(window.location.search).get('id')));
  }, []);
  const d = id == null ? undefined : role.datasets.find((x) => x.id === id);
  useEffect(() => {
    if (d) setPrice(String(d.price ?? d.proposedPrice));
  }, [d]);
  const mine = !!d && d.ownerCompanyId === role.companyId;
  const myTrade = d ? role.trades.find((t) => t.datasetId === d.id && t.buyerCompanyId === role.companyId) : undefined;
  const deciding = role.isAdmin && d?.status === 'PENDING';
  const canApply = !!d && !role.isAdmin && !mine && d.status === 'APPROVED' && !myTrade;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'E-데이터마켓', path: '/e-data/inventory' },
          { label: '데이터 등록/신청', path: CATALOG },
          { label: d?.name ?? '데이터' },
        ]}
      />
      <div className="flex items-center gap-3">
        <BackButton href={CATALOG} label="데이터 등록/신청으로" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">{d?.name ?? '데이터'}</h1>
          {d && (
            <p className="mt-1 text-sm text-slate-400">
              {[d.ownerCompanyName, d.kind, d.delivery, DATASET_STATUS_LABEL[d.status]].join(' · ')}
            </p>
          )}
        </div>
      </div>

      {id != null && !d ? (
        <div className="rounded-2xl bg-[#0d1520] p-10 text-center text-sm text-slate-400 ring-1 ring-white/[0.06]">
          데이터를 찾을 수 없습니다
        </div>
      ) : d ? (
        <SectionCard
          title="데이터"
          actions={
            <>
              {deciding && (
                <>
                  <Button size="sm" variant="danger" onClick={() => setConfirm('reject')}>
                    반려
                  </Button>
                  <Button size="sm" disabled={!(Number(price) > 0)} onClick={() => setConfirm('approve')}>
                    승인
                  </Button>
                </>
              )}
              {canApply && (
                <Button size="sm" onClick={() => setConfirm('apply')}>
                  신청
                </Button>
              )}
              {myTrade && (
                <Button size="sm" variant="secondary" onClick={() => router.push('/e-data/api-hub')}>
                  토큰 보기
                </Button>
              )}
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Info label="제공 기업" value={d.ownerCompanyName} />
            <Info label="종류" value={d.kind} />
            <Info label="제공 방식" value={d.delivery} />
            <Info label="기간" value={periodText(d)} />
            <Info label="가격 방식" value={PRICE_TYPE_LABEL[d.priceType]} />
            <Info label="제시 가격" value={won(d.proposedPrice)} />
            {deciding ? (
              <Input
                label="승인 가격 (원)"
                inputMode="numeric"
                value={price ? Number(price).toLocaleString('ko-KR') : ''}
                onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))}
              />
            ) : (
              <Info label="승인 가격" value={d.price != null ? won(d.price) : undefined} />
            )}
            <Info label="등록일" value={day(d.registeredAt)} />
            <Info label={d.status === 'REJECTED' ? '반려일' : '승인일'} value={day(d.decidedAt)} />
            {d.status === 'REJECTED' && <Info label="반려 사유" value={d.rejectReason} className="md:col-span-3" />}
            <Info label="내용" value={d.description} className="md:col-span-3" />
          </div>
          {confirm === 'reject' && (
            <div className="mt-4 space-y-3 rounded-lg bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
              <Textarea
                label="반려 사유"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => setConfirm(null)}>
                  취소
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={!reason.trim()}
                  onClick={() => {
                    reject(d.id, reason.trim());
                    addToast('success', `${d.name} 반려`);
                    setConfirm(null);
                  }}
                >
                  반려
                </Button>
              </div>
            </div>
          )}
        </SectionCard>
      ) : null}

      <ConfirmDialog
        open={confirm === 'approve' || confirm === 'apply'}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!d) return;
          if (confirm === 'approve') {
            approve(d.id, Number(price));
            addToast('success', `${d.name} 승인 — ${won(Number(price))}`);
          } else {
            const t = apply(d.id, { id: role.companyId, name: role.companyName });
            if (t) addToast('success', `${d.name} 신청 — 토큰 발급`);
          }
          setConfirm(null);
        }}
        title={confirm === 'approve' ? '승인' : '신청'}
        message={
          confirm === 'approve'
            ? `${d?.name} 를 ${won(Number(price))} (${d ? PRICE_TYPE_LABEL[d.priceType] : ''}) 으로 승인합니다.`
            : `${d?.name} 를 ${d ? priceText(d) : ''} 에 신청합니다. 신청하면 토큰이 발급됩니다.`
        }
        confirmLabel={confirm === 'approve' ? '승인' : '신청'}
      />
    </div>
  );
}

/* ══ 3.3.2 거래 현황 — 구매(위) · 판매(아래). 관리자는 전체 거래 ══ */
export function DataTradesScreen() {
  const router = useRouter();
  const role = useDataRole();
  const bought = role.trades.filter((t) => t.buyerCompanyId === role.companyId);
  const sold = role.trades.filter((t) => t.sellerCompanyId === role.companyId);
  const go = (t: DataTrade) => router.push(`${CATALOG}/view?id=${t.datasetId}`);
  const base: Column<DataTrade>[] = [
    { key: 'name', header: '데이터명', render: (t) => cell(t.datasetName, 'font-medium text-white') },
    {
      key: 'price',
      header: '가격',
      width: '190px',
      render: (t) => num(`${won(t.price)} · ${PRICE_TYPE_LABEL[t.priceType]}`),
    },
    {
      key: 'start',
      header: '거래일',
      width: '120px',
      sortable: true,
      sortValue: (t) => t.startedAt,
      render: (t) => num(day(t.startedAt)),
    },
  ];
  const seller: Column<DataTrade> = {
    key: 'seller',
    header: '판매 기업',
    width: '130px',
    render: (t) => cell(t.sellerCompanyName),
  };
  const buyer: Column<DataTrade> = {
    key: 'buyer',
    header: '구매 기업',
    width: '130px',
    render: (t) => cell(t.buyerCompanyName),
  };
  const token: Column<DataTrade> = {
    key: 'token',
    header: '토큰',
    width: '200px',
    render: (t) => <span className="font-mono text-xs text-slate-400">{t.token.slice(0, 14)}…</span>,
  };
  const sorted = (xs: DataTrade[]) => [...xs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  return (
    <div className="space-y-6">
      <Header title="거래 현황" />
      <StatsGrid columns={3}>
        {role.isAdmin ? (
          <StatCard label="거래" value={`${role.trades.length}건`} />
        ) : (
          <StatCard label="구매" value={`${bought.length}건`} />
        )}
        {role.isAdmin ? (
          <StatCard
            label="월 이용료 합계"
            value={won(role.trades.filter((t) => t.priceType === 'MONTHLY').reduce((a, t) => a + t.price, 0))}
          />
        ) : (
          <StatCard label="판매" value={`${sold.length}건`} />
        )}
        <StatCard label="발급 토큰" value={`${role.isAdmin ? role.trades.length : bought.length}개`} />
      </StatsGrid>
      {role.isAdmin ? (
        <SectionCard title="거래" noPadding>
          <DataTable
            columns={[...base.slice(0, 1), seller, buyer, ...base.slice(1), arrow as Column<DataTrade>]}
            data={sorted(role.trades)}
            rowKey={(t) => t.id}
            emptyMessage="거래 없음"
            onRowClick={go}
          />
        </SectionCard>
      ) : (
        <>
          <SectionCard title="구매" noPadding>
            <DataTable
              columns={[...base.slice(0, 1), seller, ...base.slice(1), token, arrow as Column<DataTrade>]}
              data={sorted(bought)}
              rowKey={(t) => t.id}
              emptyMessage="구매 없음"
              onRowClick={go}
            />
          </SectionCard>
          <SectionCard title="판매" noPadding>
            <DataTable
              columns={[...base.slice(0, 1), buyer, ...base.slice(1), arrow as Column<DataTrade>]}
              data={sorted(sold)}
              rowKey={(t) => t.id}
              emptyMessage="판매 없음"
              onRowClick={go}
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}

/* ══ 3.3.3 정산 — 달마다 무엇을 팔고 샀는지, 금액. 월 이용료는 매달, 1회 구매는 산 달 ══ */
export function DataSettlementScreen() {
  const role = useDataRole();
  const rows = useMemo(() => settlementsOfTrades(role.trades), [role.trades]);
  const [period, setPeriod] = useState('');
  const periods = [...new Set(rows.map((r) => r.period))];
  const inPeriod = rows.filter((r) => !period || r.period === period);
  const sold = inPeriod.filter((r) => role.isAdmin || r.trade.sellerCompanyId === role.companyId);
  const bought = inPeriod.filter((r) => !role.isAdmin && r.trade.buyerCompanyId === role.companyId);
  const total = (xs: DataSettlement[]) => won(xs.reduce((a, r) => a + r.amount, 0));
  const year = rows.filter((r) => r.period.startsWith('2026'));

  const columns = (who: 'buyer' | 'seller' | 'both'): Column<DataSettlement>[] => [
    {
      key: 'period',
      header: '기간',
      width: '100px',
      sortable: true,
      sortValue: (r) => r.period,
      render: (r) => cell(r.period, 'font-medium text-white tabular-nums'),
    },
    { key: 'name', header: '데이터명', render: (r) => cell(r.trade.datasetName, 'text-white') },
    ...(who !== 'buyer'
      ? [
          {
            key: 'buyer',
            header: '구매 기업',
            width: '130px',
            render: (r: DataSettlement) => cell(r.trade.buyerCompanyName),
          },
        ]
      : []),
    ...(who !== 'seller'
      ? [
          {
            key: 'seller',
            header: '판매 기업',
            width: '130px',
            render: (r: DataSettlement) => cell(r.trade.sellerCompanyName),
          },
        ]
      : []),
    { key: 'type', header: '가격 방식', width: '120px', render: (r) => cell(PRICE_TYPE_LABEL[r.trade.priceType]) },
    {
      key: 'amount',
      header: '금액',
      width: '130px',
      render: (r) => (
        <span className="whitespace-nowrap text-sm font-medium tabular-nums text-white">{won(r.amount)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Header
        title="정산"
        actions={
          <label className="flex items-center gap-2 text-sm text-slate-400">
            기간
            <Select
              options={[{ value: '', label: '전체' }, ...periods.map((p) => ({ value: p, label: p }))]}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-32"
            />
          </label>
        }
      />
      <StatsGrid columns={3}>
        <StatCard
          label={role.isAdmin ? '2026 거래 금액' : '2026 판매'}
          value={total(year.filter((r) => role.isAdmin || r.trade.sellerCompanyId === role.companyId))}
        />
        <StatCard
          label={role.isAdmin ? '2026-09 거래 금액' : '2026 구매'}
          value={
            role.isAdmin
              ? total(rows.filter((r) => r.period === '2026-09'))
              : total(year.filter((r) => r.trade.buyerCompanyId === role.companyId))
          }
        />
        <StatCard
          label="정산 건"
          value={`${(role.isAdmin ? rows : rows.filter((r) => r.trade.sellerCompanyId === role.companyId || r.trade.buyerCompanyId === role.companyId)).length}건`}
        />
      </StatsGrid>
      <SectionCard title={role.isAdmin ? '거래' : '판매'} noPadding>
        <DataTable
          columns={columns(role.isAdmin ? 'both' : 'seller')}
          data={sold}
          rowKey={(r) => r.key}
          emptyMessage="정산 없음"
        />
      </SectionCard>
      {!role.isAdmin && (
        <SectionCard title="구매" noPadding>
          <DataTable columns={columns('buyer')} data={bought} rowKey={(r) => r.key} emptyMessage="정산 없음" />
        </SectionCard>
      )}
    </div>
  );
}

/* ══ 3.3.4 API 허브 — 토큰(신청하면 발급) · 사용량(최근 30일) ══ */
export function DataApiHubScreen() {
  const role = useDataRole();
  const refresh = useDataMarketStore((s) => s.refreshToken);
  const addToast = useToastStore((s) => s.add);
  const tokens = useMemo(
    () => (role.isAdmin ? role.trades : role.trades.filter((t) => t.buyerCompanyId === role.companyId)),
    [role.trades, role.isAdmin, role.companyId],
  );
  const [which, setWhich] = useState('');
  const [again, setAgain] = useState<DataTrade | null>(null);
  const days = usageDays();
  const picked = tokens.filter((t) => !which || String(t.id) === which);
  const chart = days.map((d) => ({ day: d.slice(5), 호출: picked.reduce((a, t) => a + usageOf(t, d), 0) }));
  const totalCalls = chart.reduce((a, x) => a + x.호출, 0);

  const copy = (t: DataTrade) => {
    void navigator.clipboard?.writeText(t.token);
    addToast('success', '토큰 복사');
  };

  const columns: Column<DataTrade>[] = [
    { key: 'name', header: '데이터명', render: (t) => cell(t.datasetName, 'font-medium text-white') },
    ...(role.isAdmin
      ? [{ key: 'buyer', header: '구매 기업', width: '120px', render: (t: DataTrade) => cell(t.buyerCompanyName) }]
      : []),
    {
      key: 'token',
      header: '토큰',
      width: '420px',
      render: (t) => (
        <span className="inline-flex items-center gap-2">
          <code className="rounded-md bg-white/[0.04] px-2 py-1 font-mono text-xs text-slate-300 ring-1 ring-white/[0.08]">
            {role.isAdmin ? `${t.token.slice(0, 10)}…` : t.token}
          </code>
          {!role.isAdmin && (
            <button
              type="button"
              aria-label="토큰 복사"
              onClick={(e) => {
                e.stopPropagation();
                copy(t);
              }}
              className="rounded-md bg-primary p-1.5 text-white hover:bg-primary/80"
            >
              <Copy size={13} />
            </button>
          )}
        </span>
      ),
    },
    { key: 'updated', header: '최근 수정', width: '120px', render: (t) => num(day(t.tokenUpdatedAt)) },
    ...(role.isAdmin
      ? []
      : [
          {
            key: 'refresh',
            header: '',
            width: '90px',
            render: (t: DataTrade) => (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setAgain(t);
                }}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <RotateCw size={13} /> 재발급
              </button>
            ),
          },
        ]),
  ];

  return (
    <div className="space-y-6">
      <Header title="API 허브" />
      <SectionCard title="토큰" noPadding>
        <DataTable columns={columns} data={tokens} rowKey={(t) => t.id} emptyMessage="토큰 없음" />
      </SectionCard>
      <SectionCard
        title={`사용량 ${days[0]} ~ ${days[days.length - 1]}`}
        actions={
          <Select
            options={[
              { value: '', label: '모든 토큰' },
              ...tokens.map((t) => ({ value: String(t.id), label: t.datasetName })),
            ]}
            value={which}
            onChange={(e) => setWhich(e.target.value)}
            className="w-64"
          />
        }
      >
        <div className="grid items-center gap-6 lg:grid-cols-4">
          <div>
            <p className="text-sm text-slate-400">API 호출</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-white">{totalCalls.toLocaleString('ko-KR')}</p>
            <p className="text-sm text-slate-500">회</p>
          </div>
          <div className="lg:col-span-3">
            <RmsLineChart data={chart} xKey="day" lines={[{ key: '호출', name: 'API 호출' }]} height={220} />
          </div>
        </div>
      </SectionCard>
      <ConfirmDialog
        open={!!again}
        onClose={() => setAgain(null)}
        onConfirm={() => {
          if (again) {
            refresh(again.id);
            addToast('success', `${again.datasetName} 토큰 재발급`);
          }
          setAgain(null);
        }}
        title="토큰 재발급"
        message={`${again?.datasetName ?? ''} 토큰을 새로 발급합니다. 지금 토큰은 더 쓸 수 없습니다.`}
        confirmLabel="재발급"
      />
    </div>
  );
}
