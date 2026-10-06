'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Copy, FileText, Plus, RotateCw, Search, Zap } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { BackButton } from '@/components/layout/PageTitle';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox/Checkbox';
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
  INTERVALS,
  PRICE_TYPE_LABEL,
  UNIT_OF,
  sampleRowsOf,
  settlementsOfTrades,
  usageDays,
  usageOf,
  useDataMarketStore,
  useHydrateDataMarket,
  type DataInterval,
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
const priceOf = (d: Pick<Dataset, 'price' | 'proposedPrice'>) => d.price ?? d.proposedPrice;
const priceText = (d: Pick<Dataset, 'priceType' | 'price' | 'proposedPrice'>) =>
  d.priceType === 'MONTHLY' ? `${won(priceOf(d))}/월` : won(priceOf(d));
const periodText = (d: Pick<Dataset, 'periodFrom' | 'periodTo'>) => `${d.periodFrom} ~ ${d.periodTo ?? ''}`;
const STATUS_TONE: Record<DatasetStatus, StatusTone> = { PENDING: 'warning', APPROVED: 'normal', REJECTED: 'danger' };
const cell = (v: ReactNode, cls = 'text-slate-300') => <span className={`whitespace-nowrap text-sm ${cls}`}>{v}</span>;
const num = (v: ReactNode) => <span className="whitespace-nowrap text-sm tabular-nums text-slate-300">{v}</span>;
const arrow = {
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
  return { isAdmin, companyId, companyName, datasets, trades, tradesAll };
}

/* ══ 3.3.1 데이터 등록/신청 — 검색 · 카드 ══ */

/** 데이터 카드 — 종류 · 제공 방식 · 이름 · 내용 · 제공 기업 · 수집 주기 · 가격 */
function DatasetCard({ d, buyers, onClick }: { d: Dataset; buyers: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col rounded-xl bg-[#0d1520] p-5 text-left ring-1 ring-white/[0.08] transition-all hover:-translate-y-0.5 hover:ring-primary/40"
    >
      <div className="mb-3 flex items-center justify-between">
        <Badge variant="primary">{d.kind}</Badge>
        <span className="inline-flex items-center gap-1 text-sm text-slate-400">
          {d.delivery === 'API' ? <Zap size={14} /> : <FileText size={14} />}
          {d.delivery}
        </span>
      </div>
      <h3 className="mb-1 line-clamp-1 text-base font-semibold text-white group-hover:text-primary">{d.name}</h3>
      <p className="mb-4 line-clamp-2 flex-1 text-sm text-slate-400">{d.description}</p>
      <p className="mb-4 text-sm text-slate-400">
        {d.ownerCompanyName} <span className="text-slate-600">·</span> {d.interval}
      </p>
      <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
        {d.status === 'APPROVED' ? (
          <span className="text-sm text-slate-400">구매 {buyers}건</span>
        ) : (
          <StatusPill tone={STATUS_TONE[d.status]} label={DATASET_STATUS_LABEL[d.status]} />
        )}
        <span className="text-base font-semibold tabular-nums text-primary">{priceText(d)}</span>
      </div>
    </button>
  );
}

function FilterBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-[#0d1520] p-5 ring-1 ring-white/[0.06]">
      <p className="mb-3 text-base font-semibold text-white">{title}</p>
      <div className="flex flex-col items-start gap-2.5">{children}</div>
    </div>
  );
}

export function DataCatalogScreen() {
  const router = useRouter();
  const role = useDataRole();
  const [q, setQ] = useState('');
  const [kinds, setKinds] = useState<Set<string>>(new Set());
  const [deliveries, setDeliveries] = useState<Set<string>>(new Set());
  const [prices, setPrices] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<'new' | 'low' | 'high'>('new');

  const toggle = (set: Set<string>, put: (s: Set<string>) => void, v: string) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    put(next);
  };
  const buyersOf = (id: number) => role.tradesAll.filter((t) => t.datasetId === id).length;
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return role.datasets
      .filter(
        (d) => !s || [d.name, d.description ?? '', d.ownerCompanyName, d.kind].some((v) => v.toLowerCase().includes(s)),
      )
      .filter((d) => !kinds.size || kinds.has(d.kind))
      .filter((d) => !deliveries.size || deliveries.has(d.delivery))
      .filter((d) => !prices.size || prices.has(d.priceType))
      .filter((d) => !statuses.size || statuses.has(d.status))
      .sort((a, b) =>
        sort === 'new'
          ? b.registeredAt.localeCompare(a.registeredAt)
          : sort === 'low'
            ? priceOf(a) - priceOf(b)
            : priceOf(b) - priceOf(a),
      );
  }, [role.datasets, q, kinds, deliveries, prices, statuses, sort]);
  // 승인 대기 · 반려는 관리자와 등록한 기업에만 보인다
  const showStatus = role.isAdmin || role.datasets.some((d) => d.status !== 'APPROVED');

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

      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="데이터 검색 (데이터명 · 기업 · 종류)"
          className="h-12 w-full rounded-xl bg-[#0d1520] pl-11 pr-4 text-base text-white ring-1 ring-white/[0.08] placeholder:text-slate-500 focus:outline-none focus:ring-primary/60"
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[260px_1fr]">
        <div className="space-y-4">
          <FilterBox title="종류">
            {DATA_KINDS.map((k) => {
              const n = role.datasets.filter((d) => d.kind === k).length;
              return (
                <Checkbox
                  key={k}
                  label={`${k} (${n})`}
                  checked={kinds.has(k)}
                  onChange={() => toggle(kinds, setKinds, k)}
                />
              );
            })}
          </FilterBox>
          <FilterBox title="제공 방식">
            {DELIVERIES.map((k) => (
              <Checkbox
                key={k}
                label={k}
                checked={deliveries.has(k)}
                onChange={() => toggle(deliveries, setDeliveries, k)}
              />
            ))}
          </FilterBox>
          <FilterBox title="가격 방식">
            {(Object.keys(PRICE_TYPE_LABEL) as PriceType[]).map((k) => (
              <Checkbox
                key={k}
                label={PRICE_TYPE_LABEL[k]}
                checked={prices.has(k)}
                onChange={() => toggle(prices, setPrices, k)}
              />
            ))}
          </FilterBox>
          {showStatus && (
            <FilterBox title="상태">
              {(Object.keys(DATASET_STATUS_LABEL) as DatasetStatus[]).map((k) => (
                <Checkbox
                  key={k}
                  label={DATASET_STATUS_LABEL[k]}
                  checked={statuses.has(k)}
                  onChange={() => toggle(statuses, setStatuses, k)}
                />
              ))}
            </FilterBox>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-base text-slate-300">
              총 <span className="font-semibold text-white">{list.length}</span>개 데이터
            </p>
            <Select
              options={[
                { value: 'new', label: '최신순' },
                { value: 'low', label: '가격 낮은순' },
                { value: 'high', label: '가격 높은순' },
              ]}
              value={sort}
              onChange={(e) => setSort(e.target.value as 'new' | 'low' | 'high')}
              className="w-36"
            />
          </div>
          {list.length === 0 ? (
            <div className="rounded-xl bg-[#0d1520] p-12 text-center text-base text-slate-400 ring-1 ring-white/[0.06]">
              데이터 없음
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.map((d) => (
                <DatasetCard
                  key={d.id}
                  d={d}
                  buyers={buyersOf(d.id)}
                  onClick={() => router.push(`${CATALOG}/view?id=${d.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
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
    interval: '시간별' as DataInterval,
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
      interval: v.interval,
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
              placeholder="예: 한길 전력 사용량"
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
          <Select
            label="수집 주기"
            options={INTERVALS.map((k) => ({ value: k, label: k }))}
            value={v.interval}
            onChange={(e) => set('interval', e.target.value as DataInterval)}
          />
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

/* ══ 데이터 한 건 — 정보 · 샘플. 관리자: 가격 확정 · 승인 / 반려, 다른 기업: 신청 ══ */
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
    if (d) setPrice(String(priceOf(d)));
  }, [d]);
  const mine = !!d && d.ownerCompanyId === role.companyId;
  const myTrade = d ? role.trades.find((t) => t.datasetId === d.id && t.buyerCompanyId === role.companyId) : undefined;
  const deciding = role.isAdmin && d?.status === 'PENDING';
  const canApply = !!d && !role.isAdmin && !mine && d.status === 'APPROVED' && !myTrade;
  const samples = d ? sampleRowsOf(d) : [];

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
            <p className="mt-1 text-base text-slate-400">
              {[d.ownerCompanyName, d.kind, d.delivery, d.interval, DATASET_STATUS_LABEL[d.status]].join(' · ')}
            </p>
          )}
        </div>
      </div>

      {id != null && !d ? (
        <div className="rounded-2xl bg-[#0d1520] p-10 text-center text-sm text-slate-400 ring-1 ring-white/[0.06]">
          데이터를 찾을 수 없습니다
        </div>
      ) : d ? (
        <div className="grid items-start gap-6 xl:grid-cols-3">
          <SectionCard
            title="데이터"
            className="xl:col-span-2"
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
              <Info label="수집 주기" value={d.interval} />
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
              <Info label="구매" value={`${role.tradesAll.filter((t) => t.datasetId === d.id).length}건`} />
              <Info label="등록일" value={day(d.registeredAt)} />
              <Info label={d.status === 'REJECTED' ? '반려일' : '승인일'} value={day(d.decidedAt)} />
              <div />
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

          {/* 샘플 — 앞부분 몇 줄 */}
          <SectionCard title={`샘플 (${d.interval})`} noPadding>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-slate-400">
                  <th className="px-5 py-2.5 text-left font-medium">시각</th>
                  <th className="px-5 py-2.5 text-right font-medium">값 ({UNIT_OF[d.kind]})</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((r) => (
                  <tr key={r.at} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-5 py-2.5 tabular-nums text-slate-300">{r.at}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-white">
                      {r.value.toLocaleString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </div>
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

/* ══ 3.3.2 거래 현황 — 구매(위) · 판매(아래). 누가 무엇을 샀는지 ══ */
export function DataTradesScreen() {
  const router = useRouter();
  const role = useDataRole();
  // 관리자는 전체 거래를 구매 기업 기준 · 판매 기업 기준으로 본다
  const bought = role.isAdmin ? role.trades : role.trades.filter((t) => t.buyerCompanyId === role.companyId);
  const sold = role.isAdmin ? role.trades : role.trades.filter((t) => t.sellerCompanyId === role.companyId);
  const go = (t: DataTrade) => router.push(`${CATALOG}/view?id=${t.datasetId}`);
  const col = {
    day: {
      key: 'day',
      header: '거래일',
      width: '120px',
      sortable: true,
      sortValue: (t: DataTrade) => t.startedAt,
      render: (t: DataTrade) => num(day(t.startedAt)),
    },
    name: { key: 'name', header: '데이터', render: (t: DataTrade) => cell(t.datasetName, 'font-medium text-white') },
    buyer: { key: 'buyer', header: '구매 기업', width: '130px', render: (t: DataTrade) => cell(t.buyerCompanyName) },
    seller: { key: 'seller', header: '판매 기업', width: '130px', render: (t: DataTrade) => cell(t.sellerCompanyName) },
    price: {
      key: 'price',
      header: '가격',
      width: '150px',
      render: (t: DataTrade) => num(t.priceType === 'MONTHLY' ? `${won(t.price)}/월` : won(t.price)),
    },
    token: {
      key: 'token',
      header: '토큰',
      width: '180px',
      render: (t: DataTrade) => <span className="font-mono text-xs text-slate-400">{t.token.slice(0, 14)}…</span>,
    },
  } satisfies Record<string, Column<DataTrade>>;
  const sorted = (xs: DataTrade[], by: (t: DataTrade) => string) =>
    [...xs].sort((a, b) => by(a).localeCompare(by(b), 'ko') || b.startedAt.localeCompare(a.startedAt));

  return (
    <div className="space-y-6">
      <Header title="거래 현황" />
      <StatsGrid columns={3}>
        <StatCard label={role.isAdmin ? '거래' : '구매'} value={`${bought.length}건`} />
        <StatCard
          label={role.isAdmin ? '판매 기업' : '판매'}
          value={role.isAdmin ? `${new Set(sold.map((t) => t.sellerCompanyId)).size}곳` : `${sold.length}건`}
        />
        <StatCard label="발급 토큰" value={`${bought.length}개`} />
      </StatsGrid>
      <SectionCard title="구매" noPadding>
        <DataTable
          columns={
            role.isAdmin
              ? [col.buyer, col.name, col.seller, col.price, col.day, arrow]
              : [col.name, col.seller, col.price, col.day, col.token, arrow]
          }
          data={role.isAdmin ? sorted(bought, (t) => t.buyerCompanyName) : sorted(bought, () => '')}
          rowKey={(t) => t.id}
          emptyMessage="구매 없음"
          onRowClick={go}
        />
      </SectionCard>
      <SectionCard title="판매" noPadding>
        <DataTable
          columns={
            role.isAdmin
              ? [col.seller, col.name, col.buyer, col.price, col.day, arrow]
              : [col.name, col.buyer, col.price, col.day, arrow]
          }
          data={role.isAdmin ? sorted(sold, (t) => t.sellerCompanyName) : sorted(sold, () => '')}
          rowKey={(t) => t.id}
          emptyMessage="판매 없음"
          onRowClick={go}
        />
      </SectionCard>
    </div>
  );
}

/* ══ 3.3.3 정산 — 판매 · 구매 각각, 달마다 금액. 월 이용료는 매달, 1회 구매는 산 달 ══ */
export function DataSettlementScreen() {
  const role = useDataRole();
  const rows = useMemo(() => settlementsOfTrades(role.trades), [role.trades]);
  const [period, setPeriod] = useState('');
  const periods = [...new Set(rows.map((r) => r.period))];
  const inPeriod = rows.filter((r) => !period || r.period === period);
  const soldRows = inPeriod.filter((r) => role.isAdmin || r.trade.sellerCompanyId === role.companyId);
  const boughtRows = inPeriod.filter((r) => role.isAdmin || r.trade.buyerCompanyId === role.companyId);
  const total = (xs: DataSettlement[]) => won(xs.reduce((a, r) => a + r.amount, 0));

  const col = {
    period: {
      key: 'period',
      header: '기간',
      width: '100px',
      sortable: true,
      sortValue: (r: DataSettlement) => r.period,
      render: (r: DataSettlement) => cell(r.period, 'font-medium tabular-nums text-white'),
    },
    name: { key: 'name', header: '데이터', render: (r: DataSettlement) => cell(r.trade.datasetName, 'text-white') },
    buyer: {
      key: 'buyer',
      header: '구매 기업',
      width: '130px',
      render: (r: DataSettlement) => cell(r.trade.buyerCompanyName),
    },
    seller: {
      key: 'seller',
      header: '판매 기업',
      width: '130px',
      render: (r: DataSettlement) => cell(r.trade.sellerCompanyName),
    },
    type: {
      key: 'type',
      header: '가격 방식',
      width: '110px',
      render: (r: DataSettlement) => cell(PRICE_TYPE_LABEL[r.trade.priceType]),
    },
    amount: {
      key: 'amount',
      header: '금액',
      width: '130px',
      render: (r: DataSettlement) => (
        <span className="whitespace-nowrap text-sm font-medium tabular-nums text-white">{won(r.amount)}</span>
      ),
    },
  } satisfies Record<string, Column<DataSettlement>>;

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
        <StatCard label={role.isAdmin ? '거래 금액' : '판매 금액'} value={total(soldRows)} />
        <StatCard
          label={role.isAdmin ? '판매 기업' : '구매 금액'}
          value={role.isAdmin ? `${new Set(soldRows.map((r) => r.trade.sellerCompanyId)).size}곳` : total(boughtRows)}
        />
        <StatCard label="정산 건" value={`${role.isAdmin ? soldRows.length : soldRows.length + boughtRows.length}건`} />
      </StatsGrid>
      <SectionCard title="판매" noPadding>
        <DataTable
          columns={
            role.isAdmin
              ? [col.period, col.seller, col.name, col.buyer, col.type, col.amount]
              : [col.period, col.name, col.buyer, col.type, col.amount]
          }
          data={soldRows}
          rowKey={(r) => r.key}
          emptyMessage="정산 없음"
        />
      </SectionCard>
      <SectionCard title="구매" noPadding>
        <DataTable
          columns={
            role.isAdmin
              ? [col.period, col.buyer, col.name, col.seller, col.type, col.amount]
              : [col.period, col.name, col.seller, col.type, col.amount]
          }
          data={boughtRows}
          rowKey={(r) => r.key}
          emptyMessage="정산 없음"
        />
      </SectionCard>
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
    { key: 'name', header: '데이터', render: (t) => cell(t.datasetName, 'font-medium text-white') },
    ...(role.isAdmin
      ? [{ key: 'buyer', header: '구매 기업', width: '120px', render: (t: DataTrade) => cell(t.buyerCompanyName) }]
      : []),
    {
      key: 'token',
      header: '토큰',
      width: '440px',
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
