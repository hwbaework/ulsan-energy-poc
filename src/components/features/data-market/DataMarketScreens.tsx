'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  RotateCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
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
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';
import { StatusPill } from '@/components/ui/Design';
import { RmsLineChart } from '@/components/ui/Chart';
import { getPersona } from '@/lib/persona';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import {
  DM_FEE_RATE,
  DM_SELLERS,
  DM_TODAY,
  THIS_MONTH,
  billedIn,
  csvOf,
  isActive,
  monthsUntilNow,
  payDateOf,
  productsOf,
  settleRows,
  sheetOf,
  daysBetween,
  usageDays,
  usageIn,
  usageOf,
  useDataMarketStore,
  useHydrateDataMarket,
  type DataSheet,
  type DataTrade,
  type Dataset,
  type SettleRow,
} from '@/stores/useDataMarketStore';

/* ── 공통 ── */
const won = (n: number) => `₩${n.toLocaleString('ko-KR')}`;
const day = (iso?: string) => (iso ? iso.slice(0, 10) : '');
const priceText = (d: Pick<Dataset, 'priceType' | 'price'>) =>
  d.priceType === 'MONTHLY' ? `${won(d.price)}/월` : won(d.price);
const periodText = (d: Pick<Dataset, 'periodFrom' | 'periodTo'>) => `${d.periodFrom} ~ ${d.periodTo}`;
const cell = (v: ReactNode, cls = 'text-slate-300') => <span className={`whitespace-nowrap text-sm ${cls}`}>{v}</span>;
const num = (v: ReactNode) => <span className="whitespace-nowrap text-sm tabular-nums text-slate-300">{v}</span>;
const strong = (v: ReactNode) => (
  <span className="whitespace-nowrap text-sm font-medium tabular-nums text-white">{v}</span>
);
const arrow = {
  key: 'go',
  header: '',
  width: '40px',
  render: () => <ChevronRight size={15} className="text-slate-600" />,
};
const CATALOG = '/e-data/catalog';
const CONSENT = `${CATALOG}/consent`;
const API_HUB = '/e-data/api-hub';
const TRADING = '/e-data/trading';
const endpointOf = (d: Pick<Dataset, 'ownerCompanyId'>) => `/api/v1/emissions/${d.ownerCompanyId}`;
/** 제공 방식 — 모든 데이터가 같다 */
const DELIVERY = 'API · CSV 다운로드';
const sumPrice = (xs: DataTrade[]) => xs.reduce((a, t) => a + t.price, 0);

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
      <p className="break-words text-base text-white">{value === undefined || value === '' ? ' ' : value}</p>
    </div>
  );
}

/** 데모 로그인 계정 → 실제 기업. 발전사업자 계정(companyId 3, 박발전)은 한일튜브 */
const DEMO_COMPANY: Record<number, { id: number; name: string }> = { 3: { id: 4, name: '한일튜브' } };

/** 역할 — 관리자(플랫폼)는 전체, 발전사업자 · 전기사용자는 자기 것 */
function useDataRole() {
  useHydrateDataMarket();
  const user = useAuthStore((s) => s.user);
  const persona = getPersona(user);
  const isAdmin = persona === 'admin' || persona === 'spc';
  // 발전사업자 데모 계정(박발전)은 한일튜브 — 로그인 정보의 '울산 발전(주)'는 실제로 없는 회사
  const demo = DEMO_COMPANY[user?.companyId ?? 0];
  const companyId = demo?.id ?? user?.companyId ?? 0;
  const companyName = demo?.name ?? user?.companyName ?? '';
  const consents = useDataMarketStore((s) => s.consents);
  const tradesAll = useDataMarketStore((s) => s.trades);
  /** 상품 전체(공개 안 된 것 포함) — 동의에서 만들어진다 */
  const products = useMemo(() => productsOf(consents), [consents]);
  /** 내 데이터를 산 거래(관리자는 전체) */
  const sold = useMemo(
    () => (isAdmin ? tradesAll : tradesAll.filter((t) => t.sellerCompanyId === companyId)),
    [isAdmin, tradesAll, companyId],
  );
  /** 내가 산 거래(관리자는 전체) */
  const bought = useMemo(
    () => (isAdmin ? tradesAll : tradesAll.filter((t) => t.buyerCompanyId === companyId)),
    [isAdmin, tradesAll, companyId],
  );
  /** 판매할 데이터가 있는 기업 */
  const isSeller = !isAdmin && DM_SELLERS.some((c) => c.id === companyId);
  return { isAdmin, isSeller, companyId, companyName, products, tradesAll, sold, bought };
}

/** 호출 기간 — 시작일 ~ 종료일을 직접 고른다. 처음엔 최근 30일 */
function useRange() {
  const [from, setFrom] = useState(() => usageDays()[0] ?? DM_TODAY);
  const [to, setTo] = useState(DM_TODAY);
  const days = useMemo(() => daysBetween(from, to), [from, to]);
  return { from, to, setFrom, setTo, days };
}
type Range = ReturnType<typeof useRange>;

function RangePicker({ r }: { r: Range }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-400">기간</span>
      <div className="w-40">
        <Input type="date" value={r.from} max={r.to} onChange={(e) => e.target.value && r.setFrom(e.target.value)} />
      </div>
      <span className="text-slate-500">~</span>
      <div className="w-40">
        <Input
          type="date"
          value={r.to}
          min={r.from}
          max={DM_TODAY}
          onChange={(e) => e.target.value && r.setTo(e.target.value)}
        />
      </div>
    </div>
  );
}

/** 사용량 카드 — API 허브 · API 상세 · 거래 현황 상세 같은 모양
 *  카드 오른쪽 위에 기간 · 고르기(전체 / 하나씩), 왼쪽에 호출 수(회), 오른쪽에 날마다 그래프 */
function UsageCard({
  range,
  groups,
  allLabel,
  mine,
  value,
  onChange,
  totalLabel = '전체 호출',
}: {
  range: Range;
  groups: { key: string; label: string; trades: DataTrade[] }[];
  allLabel: string;
  /** 내 토큰 — 있으면 '내 호출'도 보인다 */
  mine?: DataTrade[];
  /** 위 표에서 줄을 눌러 고를 때 — 없으면 카드 안 셀렉트만 */
  value?: string;
  onChange?: (key: string) => void;
  /** 큰 숫자 이름 — 기본 '전체 호출', 사는 기업 허브는 '내 호출' */
  totalLabel?: string;
}) {
  const [own, setOwn] = useState('');
  const which = value ?? own;
  const setWhich = onChange ?? setOwn;
  const trades = groups.filter((g) => !which || g.key === which).flatMap((g) => g.trades);
  const my = mine ? trades.filter((t) => mine.some((m) => m.id === t.id)) : undefined;
  const chart = range.days.map((x) => ({
    day: x.slice(5),
    전체: trades.reduce((a, t) => a + usageOf(t, x), 0),
    ...(my ? { 내호출: my.reduce((a, t) => a + usageOf(t, x), 0) } : {}),
  }));
  const all = chart.reduce((a, x) => a + x.전체, 0);
  const mineCalls = my ? my.reduce((a, t) => a + usageIn(t, range.days), 0) : 0;
  const big = (n: number) => (
    <p className="mt-1 text-3xl font-bold tabular-nums text-white">
      {n.toLocaleString('ko-KR')}
      <span className="ml-1 text-2xl font-semibold text-slate-300">회</span>
    </p>
  );
  return (
    <SectionCard
      title={`사용량 · ${groups.find((g) => g.key === which)?.label ?? allLabel}`}
      actions={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <RangePicker r={range} />
          <div className="w-60">
            <Select
              options={[{ value: '', label: allLabel }, ...groups.map((g) => ({ value: g.key, label: g.label }))]}
              value={which}
              onChange={(e) => setWhich(e.target.value)}
            />
          </div>
        </div>
      }
    >
      <div className="grid items-center gap-6 lg:grid-cols-4">
        <div className="space-y-5">
          <div>
            <p className="text-sm text-slate-400">{totalLabel}</p>
            {big(all)}
          </div>
          {my && (
            <div>
              <p className="text-sm text-slate-400">내 호출</p>
              {big(mineCalls)}
            </div>
          )}
        </div>
        <div className="lg:col-span-3">
          <RmsLineChart
            data={chart}
            xKey="day"
            lines={[{ key: '전체', name: totalLabel }, ...(my ? [{ key: '내호출', name: '내 호출' }] : [])]}
            height={240}
          />
        </div>
      </div>
    </SectionCard>
  );
}

/** 데이터 표 — 월별 줄. 첫 칸(월) 말고는 숫자 */
function SheetTable({ sheet }: { sheet: DataSheet }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-slate-400">
            {sheet.columns.map((c, i) => (
              <th key={c.key} className={`whitespace-nowrap px-5 py-2.5 font-medium ${i ? 'text-right' : 'text-left'}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((r) => (
            <tr key={String(r.month)} className="border-b border-white/[0.04] last:border-0">
              {sheet.columns.map((c, i) => (
                <td
                  key={c.key}
                  className={`whitespace-nowrap px-5 py-2.5 tabular-nums ${i ? 'text-right' : 'text-left'} ${
                    c.strong ? 'font-semibold text-white' : 'text-slate-300'
                  }`}
                >
                  {r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ══ 3.3.1 데이터 등록/신청 — 목록 카드(SectionCard) 안에 기업별 배출량 카드. 검색 · 판매 동의는 카드 헤더 ══ */

/** 데이터 카드 — 종류 · 이름 · 내용 · 제공 기업 · 수집 주기 · 이용 기업 · 가격 */
function DatasetCard({
  d,
  users,
  mine,
  using,
  onClick,
}: {
  d: Dataset;
  users: number;
  /** 내가 판매 동의한 데이터 */
  mine: boolean;
  /** 내가 신청해서 쓰고 있는 데이터 */
  using: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col rounded-xl bg-white/[0.03] p-5 text-left ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.05] hover:ring-primary/40"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <Badge>{d.kind}</Badge>
        {mine ? (
          <Badge variant="primary">내 데이터</Badge>
        ) : using ? (
          <StatusPill tone="normal" label="이용 중" />
        ) : null}
      </div>
      <h3 className="mb-1 line-clamp-1 text-base font-semibold text-white group-hover:text-primary">{d.name}</h3>
      <p className="mb-4 line-clamp-2 flex-1 text-sm text-slate-400">{d.description}</p>
      <p className="mb-4 text-sm text-slate-400">
        {d.ownerCompanyName} <span className="text-slate-600">·</span> 월별
      </p>
      <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
        <span className="text-sm text-slate-400">이용 {users}곳</span>
        <span className="text-base font-semibold tabular-nums text-white">{priceText(d)}</span>
      </div>
    </button>
  );
}

export function DataCatalogScreen() {
  const router = useRouter();
  const role = useDataRole();
  const [q, setQ] = useState('');

  const onSale = useMemo(() => role.products.filter((d) => d.onSale), [role.products]);
  const usersOf = (id: number) => role.tradesAll.filter((t) => t.datasetId === id && isActive(t)).length;
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return onSale
      .filter((d) => !s || [d.name, d.description, d.ownerCompanyName].some((v) => v.toLowerCase().includes(s)))
      .sort((a, b) => (b.consentedAt ?? '').localeCompare(a.consentedAt ?? ''));
  }, [onSale, q]);

  return (
    <div className="space-y-6">
      <Header title="데이터 등록/신청" />

      <SectionCard
        title={`데이터 목록 (${list.length})`}
        actions={
          /* /guide 표기 규칙: 헤더 actions 순서는 필터 → 검색 → 등록(판매 동의) */
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="relative w-64">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="기업 검색" className="pl-8" />
            </div>
            {role.isSeller && (
              <Button onClick={() => router.push(CONSENT)}>
                <ShieldCheck size={14} className="mr-1" /> 판매 동의
              </Button>
            )}
          </div>
        }
      >
        {list.length === 0 ? (
          <p className="py-12 text-center text-base text-slate-400">데이터 없음</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((d) => (
              <DatasetCard
                key={d.id}
                d={d}
                users={usersOf(d.id)}
                mine={d.ownerCompanyId === role.companyId}
                using={!role.isAdmin && role.bought.some((t) => t.datasetId === d.id && isActive(t))}
                onClick={() => router.push(`${CATALOG}/view?id=${d.id}`)}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ══ 판매 동의 — 동의 = 등록. ① 데이터 확인 → ② 공개 조건 동의 → ③ 공개. 끄면 판매 중지 ══ */

const CONSENT_STEPS = ['데이터 확인', '공개 조건', '공개'] as const;

function Steps({ at }: { at: number }) {
  return (
    <ol className="mb-6 flex items-center gap-3">
      {CONSENT_STEPS.map((label, i) => {
        const done = i < at;
        const now = i === at;
        return (
          <li key={label} className="flex items-center gap-3">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                done
                  ? 'bg-primary text-white'
                  : now
                    ? 'bg-primary/20 text-primary ring-1 ring-primary'
                    : 'bg-white/[0.06] text-slate-500'
              }`}
            >
              {done ? <Check size={14} /> : i + 1}
            </span>
            <span className={`text-sm ${now ? 'font-semibold text-white' : 'text-slate-400'}`}>{label}</span>
            {i < CONSENT_STEPS.length - 1 && <span className="h-px w-8 bg-white/[0.12]" />}
          </li>
        );
      })}
    </ol>
  );
}

/** 공개 조건 — 동의하는 내용 그대로 */
const consentTerms = (d: Dataset): [string, string][] => [
  ['공개', '기업명과 함께 데이터 목록에 공개'],
  ['데이터', `${d.name} · 월별 · ${periodText(d)}, 매달 갱신`],
  ['가격', priceText(d)],
  ['제공', DELIVERY],
  ['판매 중지', '언제든 판매 동의에서 끄기 · 이미 산 기업은 이용 취소 전까지 사용'],
];

function ConsentFlow({ d, onClose }: { d: Dataset; onClose: () => void }) {
  const router = useRouter();
  const setConsent = useDataMarketStore((s) => s.setConsent);
  const [step, setStep] = useState(0);
  const [agree, setAgree] = useState(false);
  const sheet = useMemo(() => sheetOf(d), [d]);
  const recent = { ...sheet, rows: sheet.rows.slice(-3) };

  const footer =
    step === 0 ? (
      <>
        <Button variant="cancel" onClick={onClose}>
          취소
        </Button>
        <Button onClick={() => setStep(1)}>다음</Button>
      </>
    ) : step === 1 ? (
      <>
        <Button variant="cancel" onClick={() => setStep(0)}>
          이전
        </Button>
        <Button
          disabled={!agree}
          onClick={() => {
            setConsent(d.ownerCompanyId, d.kind, true);
            setStep(2);
          }}
        >
          <ShieldCheck size={14} className="mr-1" /> 동의
        </Button>
      </>
    ) : (
      <>
        <Button variant="cancel" onClick={onClose}>
          닫기
        </Button>
        <Button onClick={() => router.push(CATALOG)}>데이터 목록</Button>
      </>
    );

  return (
    <Modal open onClose={onClose} title="판매 동의" size="xl" footer={footer}>
      <Steps at={step} />
      {step === 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Info label="데이터" value={d.name} className="md:col-span-2" />
            <Info label="수집 주기" value="월별" />
            <Info label="기간" value={periodText(d)} />
            <Info label="내용" value={d.description} className="md:col-span-4" />
          </div>
          <div className="rounded-xl ring-1 ring-white/[0.06]">
            <p className="border-b border-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white">최근 3개월</p>
            <SheetTable sheet={recent} />
          </div>
        </div>
      )}
      {step === 1 && (
        <div className="space-y-4">
          <dl className="divide-y divide-white/[0.06] rounded-xl ring-1 ring-white/[0.06]">
            {consentTerms(d).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[120px_1fr] gap-4 px-5 py-3">
                <dt className="text-sm text-slate-400">{k}</dt>
                <dd className="text-sm text-white">{v}</dd>
              </div>
            ))}
          </dl>
          <Checkbox label="위 조건으로 판매에 동의" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        </div>
      )}
      {step === 2 && (
        <div className="flex flex-col items-center gap-3 py-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Check size={24} />
          </span>
          <p className="text-lg font-semibold text-white">{d.name} 공개</p>
          <p className="text-sm text-slate-400">
            {day(new Date().toISOString())} · {priceText(d)} · {DELIVERY}
          </p>
        </div>
      )}
    </Modal>
  );
}

export function DataConsentScreen() {
  const router = useRouter();
  const role = useDataRole();
  const setConsent = useDataMarketStore((s) => s.setConsent);
  const addToast = useToastStore((s) => s.add);
  const [flow, setFlow] = useState<Dataset | null>(null);
  const [stop, setStop] = useState<Dataset | null>(null);
  const mine = role.products.filter((d) => d.ownerCompanyId === role.companyId);
  const usersOf = (id: number) => role.tradesAll.filter((t) => t.datasetId === id && isActive(t)).length;

  const columns: Column<Dataset>[] = [
    { key: 'name', header: '데이터', render: (d) => cell(d.name, 'font-medium text-white') },
    { key: 'interval', header: '수집 주기', width: '100px', render: () => cell('월별') },
    { key: 'period', header: '기간', width: '170px', render: (d) => num(periodText(d)) },
    { key: 'price', header: '가격', width: '110px', render: (d) => num(priceText(d)) },
    { key: 'users', header: '이용', width: '80px', render: (d) => num(`${usersOf(d.id)}곳`) },
    { key: 'at', header: '공개일', width: '120px', render: (d) => num(day(d.consentedAt)) },
    {
      key: 'sale',
      header: '판매',
      width: '80px',
      render: (d) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Toggle checked={d.onSale} onChange={(on) => (on ? setFlow(d) : setStop(d))} />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'E-데이터마켓', path: '/e-data/inventory' },
          { label: '데이터 등록/신청', path: CATALOG },
          { label: '판매 동의' },
        ]}
      />
      <div className="flex items-center gap-3">
        <BackButton href={CATALOG} label="데이터 등록/신청으로" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">판매 동의</h1>
          <p className="mt-1 text-base text-slate-400">{role.companyName}</p>
        </div>
      </div>
      <SectionCard title={`내 데이터 (${mine.length})`} noPadding>
        <DataTable
          columns={columns}
          data={mine}
          rowKey={(d) => d.id}
          emptyMessage="판매할 데이터 없음"
          onRowClick={(d) => router.push(`${CATALOG}/view?id=${d.id}`)}
        />
      </SectionCard>
      {flow && <ConsentFlow d={flow} onClose={() => setFlow(null)} />}
      <ConfirmDialog
        open={!!stop}
        onClose={() => setStop(null)}
        onConfirm={() => {
          if (stop) {
            setConsent(stop.ownerCompanyId, stop.kind, false);
            addToast('success', `${stop.name} 판매 중지`);
          }
          setStop(null);
        }}
        title="판매 중지"
        message={`${stop?.name ?? ''} 를 데이터 목록에서 내립니다. 이미 산 기업은 이용 취소 전까지 씁니다.`}
        confirmLabel="판매 중지"
        variant="danger"
      />
    </div>
  );
}

/* ══ 데이터 한 건 — 정보 · 월별 데이터. 다른 기업: 신청, 이용 중 · 판매 기업 · 관리자: CSV 다운로드 ══ */
export function DataDetailScreen() {
  const router = useRouter();
  const role = useDataRole();
  const apply = useDataMarketStore((s) => s.apply);
  const addToast = useToastStore((s) => s.add);
  const [id, setId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    setId(Number(new URLSearchParams(window.location.search).get('id')));
  }, []);
  const d = id == null ? undefined : role.products.find((x) => x.id === id);
  const mine = !!d && d.ownerCompanyId === role.companyId;
  const myTrade = d ? role.bought.find((t) => t.datasetId === d.id && isActive(t) && !role.isAdmin) : undefined;
  const canApply = !!d && !role.isAdmin && !mine && d.onSale && !myTrade;
  // 이용 중 · 판매 기업 · 관리자는 전체, 나머지는 최근 3개월만
  const full = role.isAdmin || mine || !!myTrade;
  const sheet = useMemo(() => (d ? sheetOf(d) : undefined), [d]);
  const shown = sheet && (full ? sheet : { ...sheet, rows: sheet.rows.slice(-3) });

  const download = () => {
    if (!d || !sheet) return;
    // 엑셀이 한글을 읽도록 BOM 을 붙인다
    const blob = new Blob(['﻿' + csvOf(sheet)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${d.name} ${periodText(d)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

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
          {d && <p className="mt-1 text-base text-slate-400">{[d.ownerCompanyName, d.kind, '월별'].join(' · ')}</p>}
        </div>
      </div>

      {id != null && !d ? (
        <div className="rounded-2xl bg-[#0d1520] p-10 text-center text-sm text-slate-400 ring-1 ring-white/[0.06]">
          데이터를 찾을 수 없습니다
        </div>
      ) : d && shown ? (
        <>
          <SectionCard
            title="데이터"
            actions={
              <>
                {canApply && (
                  <Button size="sm" onClick={() => setConfirm(true)}>
                    신청
                  </Button>
                )}
                {full && (
                  <Button size="sm" variant="secondary" onClick={download}>
                    <Download size={14} className="mr-1" /> CSV 다운로드
                  </Button>
                )}
                {myTrade && (
                  <Button size="sm" variant="secondary" onClick={() => router.push(API_HUB)}>
                    토큰 보기
                  </Button>
                )}
              </>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Info label="제공 기업" value={d.ownerCompanyName} />
              <Info label="종류" value={d.kind} />
              <Info label="제공 방식" value={DELIVERY} />
              <Info label="수집 주기" value="월별" />
              <Info label="기간" value={periodText(d)} />
              <Info label="가격" value={priceText(d)} />
              <Info
                label="이용"
                value={`${role.tradesAll.filter((t) => t.datasetId === d.id && isActive(t)).length}곳`}
              />
              <Info label="공개일" value={day(d.consentedAt)} />
              <Info label="내용" value={d.description} className="md:col-span-4" />
            </div>
          </SectionCard>

          <SectionCard title={full ? `월별 데이터 (${shown.rows.length})` : '샘플 (최근 3개월)'} noPadding>
            <SheetTable sheet={shown} />
          </SectionCard>
        </>
      ) : null}

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          if (!d) return;
          const t = apply(d, { id: role.companyId, name: role.companyName });
          if (t) addToast('success', `${d.name} 신청 — 토큰 발급`);
          setConfirm(false);
        }}
        title="신청"
        message={`${d?.name ?? ''} 를 ${d ? priceText(d) : ''} 에 신청합니다. 신청하면 토큰이 발급되고 CSV 로도 받을 수 있습니다.`}
        confirmLabel="신청"
      />
    </div>
  );
}

/* ══ 3.3.2 거래 현황 — 기업: 내 데이터 상세(이용 내역 · 사용량)를 바로. 관리자: 데이터별 목록 → 상세
 *    누가 얼마 내는지는 정산에서 본다 ══ */
export function DataTradesScreen() {
  const role = useDataRole();
  // 기업 계정은 내 데이터 하나만 — 목록 없이 바로 이용 내역 · 사용량
  const mine = role.isAdmin ? undefined : role.products.find((d) => d.ownerCompanyId === role.companyId);
  if (role.isAdmin) return <DataTradesAdmin />;
  if (mine && (mine.onSale || role.tradesAll.some((t) => t.datasetId === mine.id)))
    return <DataTradeDetailScreen fixedId={mine.id} />;
  return <DataTradesEmpty />;
}

/** 판매 중인 내 데이터가 없을 때 — 판매 동의로 */
function DataTradesEmpty() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <Header title="거래 현황" />
      <SectionCard
        title="내 데이터 (0)"
        actions={
          <Button onClick={() => router.push(CONSENT)}>
            <ShieldCheck size={14} className="mr-1" /> 판매 동의
          </Button>
        }
      >
        <p className="py-10 text-center text-base text-slate-400">판매 중인 데이터 없음</p>
      </SectionCard>
    </div>
  );
}

/** 관리자 — 데이터별 전체, 줄을 누르면 그 데이터 상세 */
function DataTradesAdmin() {
  const router = useRouter();
  const role = useDataRole();
  const [q, setQ] = useState('');
  const mineSold = role.sold;
  const active = mineSold.filter(isActive);
  const cancelled = mineSold.filter((t) => !isActive(t));
  const thisMonth = sumPrice(mineSold.filter((t) => billedIn(t, THIS_MONTH)));

  /** 데이터별 — 판매 중인 것 전부(관리자는 동의 안 한 것까지) */
  const perData = role.products
    .filter((d) => d.onSale || role.isAdmin)
    .map((d) => {
      const ts = role.tradesAll.filter((t) => t.datasetId === d.id);
      return {
        d,
        active: ts.filter(isActive).length,
        cancelled: ts.filter((t) => !isActive(t)).length,
        amount: sumPrice(ts.filter((t) => billedIn(t, THIS_MONTH))),
      };
    })
    // 기업 검색 — 제공 기업 · 데이터 이름
    .filter((r) => !q.trim() || [r.d.ownerCompanyName, r.d.name].some((v) => v.includes(q.trim())))
    .sort((a, b) => Number(b.d.onSale) - Number(a.d.onSale));
  type Row = (typeof perData)[number];
  const dataCols: Column<Row>[] = [
    {
      key: 'name',
      header: '데이터',
      render: (r) =>
        cell(r.d.name, r.d.ownerCompanyId === role.companyId ? 'font-semibold text-primary' : 'font-medium text-white'),
    },
    { key: 'owner', header: '제공 기업', width: '130px', render: (r) => cell(r.d.ownerCompanyName) },
    ...(role.isAdmin
      ? [
          {
            key: 'sale',
            header: '판매',
            width: '120px',
            render: (r: Row) => (
              <StatusPill tone={r.d.onSale ? 'normal' : 'muted'} label={r.d.onSale ? '판매 중' : '동의 안 함'} />
            ),
          },
        ]
      : []),
    { key: 'active', header: '이용 중', width: '100px', render: (r) => strong(`${r.active}곳`) },
    { key: 'cancelled', header: '취소', width: '90px', render: (r) => num(`${r.cancelled}곳`) },
    ...(role.isAdmin
      ? [
          {
            key: 'amount',
            header: '이용 금액',
            width: '140px',
            render: (r: Row) => strong(won(r.amount)),
          },
        ]
      : []),
    arrow,
  ];

  return (
    <div className="space-y-6">
      <Header title="거래 현황" />
      {(role.isAdmin || role.isSeller) && (
        <StatsGrid columns={3}>
          <StatCard label={role.isAdmin ? '이용 중' : '내 데이터 이용 중'} value={`${active.length}곳`} />
          <StatCard label={role.isAdmin ? '취소' : '내 데이터 취소'} value={`${cancelled.length}곳`} />
          <StatCard label="이번 달 이용 금액" value={won(thisMonth)} />
        </StatsGrid>
      )}
      <SectionCard
        title={`데이터별 (${perData.length})`}
        actions={
          <div className="relative w-64">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="기업 검색" className="pl-8" />
          </div>
        }
        noPadding
      >
        <DataTable
          columns={dataCols}
          data={perData}
          rowKey={(r) => r.d.id}
          emptyMessage="판매 중인 데이터 없음"
          onRowClick={(r) => router.push(`${TRADING}/view?id=${r.d.id}`)}
        />
      </SectionCard>
    </div>
  );
}

/* ══ 3.3.3 정산 — 위에 연도 · 월 고르기, 아래 KPI(금액 · 정산일) + 표 하나
 *    플랫폼(관리자)이 이용 기업에게 받아 수수료(DM_FEE_RATE, 지금 0%)를 떼고 판매 기업에게 넘긴다. 쓰면 받는 돈 — 상태 없음
 *    그 달 이용분은 다음 달 15일 정산
 *    관리자: 기업별 표(이용 건수 · 낼 금액 · 판매 건수 · 받을 금액 · 정산 금액) + 검색, 줄을 누르면 그 기업 정산 내역(← 로 돌아감)
 *    기업 계정: 내 정산 내역(받을 금액 · 낼 금액). 표 제목은 '이름 (개수)'까지만 ══ */
export function DataSettlementScreen() {
  const role = useDataRole();
  const all = useMemo(() => settleRows(role.tradesAll), [role.tradesAll]);
  // 트리의 달 — 관리자는 전체, 기업은 자기 정산이 있는 달만
  const periods = useMemo(
    () =>
      [
        ...new Set(
          all
            .filter(
              (r) =>
                role.isAdmin || r.trade.buyerCompanyId === role.companyId || r.trade.sellerCompanyId === role.companyId,
            )
            .map((r) => r.period),
        ),
      ]
        .sort()
        .reverse(),
    [all, role.isAdmin, role.companyId],
  );
  const years = [...new Set(periods.map((p) => p.slice(0, 4)))];
  // 처음엔 이번 정산(이번 달 15일 = 지난달 이용분)
  const last = periods.find((p) => payDateOf(p) === `${THIS_MONTH}-15`);
  const initial = last ?? periods[0] ?? THIS_MONTH;
  const [period, setPeriod] = useState(initial);
  const [company, setCompany] = useState<number | null>(null);
  const [q, setQ] = useState('');

  const fee = (n: number) => Math.round(n * DM_FEE_RATE);
  const feePct = `${Math.round(DM_FEE_RATE * 1000) / 10}%`;
  const total = (xs: SettleRow[]) => xs.reduce((a, r) => a + r.amount, 0);
  const sign = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${won(Math.abs(n))}`;
  const payDate = payDateOf(period);
  const inMonth = all.filter((r) => r.period === period);
  /** 기업 쪽에서 본 그 달 — 받을 금액(내 데이터를 남이 씀) · 낼 금액(내가 남의 데이터를 씀) */
  const of = (id: number) => {
    const get = inMonth.filter((r) => r.trade.sellerCompanyId === id);
    const pay = inMonth.filter((r) => r.trade.buyerCompanyId === id);
    const getAmt = total(get) - fee(total(get));
    return { get, pay, getAmt, payAmt: total(pay), net: getAmt - total(pay) };
  };
  const companiesIn = (rows: SettleRow[]) =>
    [
      ...new Map(
        rows.flatMap((r) => [
          [r.trade.buyerCompanyId, r.trade.buyerCompanyName] as const,
          [r.trade.sellerCompanyId, r.trade.sellerCompanyName] as const,
        ]),
      ),
    ]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const monthCompanies = companiesIn(inMonth);
  const me = role.isAdmin ? company : role.companyId;

  /* KPI — 관리자 월 전체 / 기업 하나 */
  const kpi =
    me == null
      ? [
          { label: '받을 금액 (이용 기업)', value: won(total(inMonth)) },
          { label: `수수료 (${feePct})`, value: won(fee(total(inMonth))) },
          { label: '넘길 금액 (판매 기업)', value: won(total(inMonth) - fee(total(inMonth))) },
          { label: '정산일', value: payDate },
        ]
      : (() => {
          const x = of(me);
          return [
            { label: '받을 금액', value: won(x.getAmt) },
            { label: '낼 금액', value: won(x.payAmt) },
            { label: '정산 금액', value: sign(x.net) },
            { label: '정산일', value: payDate },
          ];
        })();

  /* 표 1 — 관리자 월 전체: 기업별 */
  const s = q.trim();
  const coRows = monthCompanies
    .map((c) => {
      const x = of(c.id);
      return { ...c, payN: x.pay.length, payAmt: x.payAmt, getN: x.get.length, getAmt: x.getAmt, net: x.net };
    })
    .filter((c) => !s || c.name.includes(s));
  type Co = (typeof coRows)[number];
  const coCols: Column<Co>[] = [
    { key: 'name', header: '기업', render: (c) => cell(c.name, 'font-medium text-white') },
    { key: 'payN', header: '이용 건수', width: '100px', render: (c) => num(`${c.payN}건`) },
    {
      key: 'payAmt',
      header: '낼 금액',
      width: '120px',
      sortable: true,
      sortValue: (c) => c.payAmt,
      render: (c) => cell(won(c.payAmt), 'tabular-nums text-amber-400'),
    },
    { key: 'getN', header: '판매 건수', width: '100px', render: (c) => num(`${c.getN}건`) },
    {
      key: 'getAmt',
      header: '받을 금액',
      width: '120px',
      sortable: true,
      sortValue: (c) => c.getAmt,
      render: (c) => cell(won(c.getAmt), 'tabular-nums text-emerald-400'),
    },
    {
      key: 'net',
      header: '정산 금액',
      width: '120px',
      sortable: true,
      sortValue: (c) => c.net,
      render: (c) => strong(sign(c.net)),
    },
    arrow,
  ];

  /* 표 2 — 기업 하나: 정산 내역(받을 금액은 이용 기업마다, 낼 금액은 데이터마다) */
  const lines =
    me == null
      ? []
      : [...of(me).get, ...of(me).pay].filter((r) => {
          if (!s) return true;
          const other = r.trade.sellerCompanyId === me ? r.trade.buyerCompanyName : r.trade.sellerCompanyName;
          return [other, r.trade.datasetName].some((v) => v.includes(s));
        });
  const lineCols: Column<SettleRow>[] = [
    {
      key: 'side',
      header: '구분',
      width: '100px',
      render: (r) =>
        r.trade.sellerCompanyId === me
          ? cell('받을 금액', 'font-medium text-emerald-400')
          : cell('낼 금액', 'font-medium text-amber-400'),
    },
    {
      key: 'other',
      header: '상대 기업',
      width: '140px',
      render: (r) =>
        cell(r.trade.sellerCompanyId === me ? r.trade.buyerCompanyName : r.trade.sellerCompanyName, 'text-white'),
    },
    { key: 'name', header: '데이터', render: (r) => cell(r.trade.datasetName) },
    { key: 'start', header: '이용 시작일', width: '120px', render: (r) => num(day(r.trade.startedAt)) },
    {
      key: 'use',
      header: '이용',
      width: '100px',
      render: (r) =>
        r.trade.cancelledAt && r.trade.cancelledAt.slice(0, 7) === r.period ? (
          <StatusPill tone="muted" label="취소" />
        ) : (
          <StatusPill tone="normal" label="이용 중" />
        ),
    },
  ];

  const pick = (p: string, c: number | null) => {
    setPeriod(p);
    setCompany(c);
    setQ('');
  };

  const year = period.slice(0, 4);
  const monthsOfYear = periods.filter((p) => p.startsWith(year));
  const shiftYear = (by: number) => {
    const y = String(Number(year) + by);
    const ps = periods.filter((p) => p.startsWith(y));
    if (ps.length) pick(ps[0]!, company);
  };
  const arrowBtn =
    'flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 ring-1 ring-white/[0.06] hover:bg-white/[0.08] hover:text-white disabled:opacity-30';
  const search = (placeholder: string) => (
    <div className="relative w-64">
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="pl-8" />
    </div>
  );

  return (
    <div className="space-y-6">
      <Header title="정산" />

      {/* 위 — 연도 · 월 · (관리자) 기업 */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#0d1520] px-4 py-3 ring-1 ring-white/[0.06]">
        <span className="text-sm text-slate-400">연도</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="지난해"
            onClick={() => shiftYear(-1)}
            disabled={!years.includes(String(Number(year) - 1))}
            className={arrowBtn}
          >
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[72px] text-center text-base font-semibold tabular-nums text-white">{year}년</span>
          <button
            type="button"
            aria-label="다음 해"
            onClick={() => shiftYear(1)}
            disabled={!years.includes(String(Number(year) + 1))}
            className={arrowBtn}
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <span className="ml-2 text-sm text-slate-400">월</span>
        <div className="w-28">
          <Select
            options={monthsOfYear.map((p) => ({ value: p, label: `${p.slice(5)}월` }))}
            value={period}
            onChange={(e) => pick(e.target.value, company)}
          />
        </div>
      </div>

      <StatsGrid columns={4}>
        {kpi.map((k) => (
          <StatCard key={k.label} label={k.label} value={k.value} />
        ))}
      </StatsGrid>

      {me == null ? (
        <SectionCard title={`기업별 (${coRows.length})`} actions={search('기업 검색')} noPadding>
          <DataTable
            columns={coCols}
            data={coRows}
            rowKey={(c) => c.id}
            emptyMessage="정산 없음"
            onRowClick={(c) => pick(period, c.id)}
          />
        </SectionCard>
      ) : (
        <SectionCard
          title={
            role.isAdmin ? (
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="기업별로"
                  onClick={() => pick(period, null)}
                  className="rounded-md p-1 text-slate-400 hover:bg-white/[0.06] hover:text-white"
                >
                  <ArrowLeft size={16} />
                </button>
                {monthCompanies.find((c) => c.id === me)?.name} 정산 내역 ({lines.length}건)
              </span>
            ) : (
              `정산 내역 (${lines.length}건)`
            )
          }
          actions={search('기업 · 데이터 검색')}
          noPadding
        >
          <DataTable columns={lineCols} data={lines} rowKey={(r) => r.key} emptyMessage="정산 없음" />
        </SectionCard>
      )}
    </div>
  );
}

/* ══ 3.3.4 API 허브 — 기업: 신청(결제)한 API만. 토큰 · 복사 · 재발급 · 이용 취소 + 사용량. 신청은 데이터 등록/신청에서
 *    관리자: 판매 중인 API 전체(이용 기업 · 공개일 · 호출) + 사용량. 토큰은 보지 않는다
 *    줄을 누르면 아래 사용량 카드가 그 API로 바뀐다 ══ */
export function DataApiHubScreen() {
  const role = useDataRole();
  const refresh = useDataMarketStore((s) => s.refreshToken);
  const cancel = useDataMarketStore((s) => s.cancel);
  const addToast = useToastStore((s) => s.add);
  const [again, setAgain] = useState<DataTrade | null>(null);
  const [drop, setDrop] = useState<DataTrade | null>(null);
  const [which, setWhich] = useState('');
  const range = useRange();
  const days = range.days;
  const pick = (key: string) => setWhich(key === which ? '' : key);

  const tokensOf = (id: number) => role.tradesAll.filter((t) => t.datasetId === id && isActive(t));
  /** 관리자 — 판매 중인 API 전체 */
  const apis = role.products.filter((d) => d.onSale || tokensOf(d.id).length > 0);
  /** 기업 — 내가 신청(결제)한 API */
  const myApis = role.bought.filter(isActive);

  const copy = (t: DataTrade) => {
    void navigator.clipboard?.writeText(t.token);
    addToast('success', '토큰 복사');
  };
  const apiName = (name: string, ownerCompanyId: number, key: string) => (
    <span className="flex flex-col">
      <span className={`text-sm font-medium ${key === which ? 'text-primary' : 'text-white'}`}>{name}</span>
      <span className="font-mono text-xs text-slate-500">{endpointOf({ ownerCompanyId })}</span>
    </span>
  );

  /* 관리자 표 */
  const adminCols: Column<Dataset>[] = [
    { key: 'name', header: 'API', render: (d) => apiName(d.name, d.ownerCompanyId, String(d.id)) },
    { key: 'owner', header: '제공 기업', width: '120px', render: (d) => cell(d.ownerCompanyName) },
    { key: 'at', header: '공개일', width: '120px', render: (d) => num(day(d.consentedAt)) },
    { key: 'users', header: '이용 기업', width: '100px', render: (d) => strong(`${tokensOf(d.id).length}곳`) },
    {
      key: 'calls',
      header: '호출',
      width: '120px',
      render: (d) =>
        strong(
          `${tokensOf(d.id)
            .reduce((a, t) => a + usageIn(t, days), 0)
            .toLocaleString('ko-KR')}회`,
        ),
    },
  ];

  /* 기업 표 — Mapbox Access tokens 처럼 */
  const myCols: Column<DataTrade>[] = [
    { key: 'name', header: 'API', render: (t) => apiName(t.datasetName, t.sellerCompanyId, String(t.id)) },
    { key: 'owner', header: '제공 기업', width: '110px', render: (t) => cell(t.sellerCompanyName) },
    {
      key: 'token',
      header: '토큰',
      width: '470px',
      render: (t) => (
        <span className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <code className="truncate rounded-md bg-white/[0.04] px-2.5 py-1.5 font-mono text-xs text-slate-300 ring-1 ring-white/[0.08]">
            {t.token}
          </code>
          <button
            type="button"
            aria-label="토큰 복사"
            onClick={() => copy(t)}
            className="shrink-0 rounded-md bg-primary p-1.5 text-white hover:bg-primary/80"
          >
            <Copy size={13} />
          </button>
        </span>
      ),
    },
    { key: 'updated', header: '최근 수정', width: '110px', render: (t) => num(day(t.tokenUpdatedAt)) },
    // 허용 URL — 이 주소에서 부를 때만 받는 제한(Mapbox URLs). 아직 정한 곳이 없어 제한 없음
    { key: 'urls', header: '허용 URL', width: '110px', render: () => cell('제한 없음', 'text-slate-500') },
    {
      key: 'calls',
      header: '호출',
      width: '100px',
      render: (t) => strong(`${usageIn(t, days).toLocaleString('ko-KR')}회`),
    },
    {
      key: 'act',
      header: '',
      width: '190px',
      render: (t) => (
        <span className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="secondary" onClick={() => setAgain(t)}>
            <RotateCw size={14} className="mr-1" /> 재발급
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDrop(t)}>
            이용 취소
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Header title="API 허브" />
      {role.isAdmin ? (
        <SectionCard title={`API (${apis.length})`} noPadding>
          <DataTable
            columns={adminCols}
            data={apis}
            rowKey={(d) => d.id}
            emptyMessage="API 없음"
            onRowClick={(d) => pick(String(d.id))}
          />
        </SectionCard>
      ) : (
        <SectionCard title={`내 API (${myApis.length})`} noPadding>
          <DataTable
            columns={myCols}
            data={myApis}
            rowKey={(t) => t.id}
            emptyMessage="신청한 API 없음"
            onRowClick={(t) => pick(String(t.id))}
          />
        </SectionCard>
      )}
      <UsageCard
        range={range}
        groups={
          role.isAdmin
            ? apis.map((d) => ({ key: String(d.id), label: d.name, trades: tokensOf(d.id) }))
            : myApis.map((t) => ({ key: String(t.id), label: t.sellerCompanyName, trades: [t] }))
        }
        allLabel={role.isAdmin ? '모든 API' : '전체'}
        totalLabel={role.isAdmin ? '전체 호출' : '내 호출'}
        value={which}
        onChange={setWhich}
      />
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
      <ConfirmDialog
        open={!!drop}
        onClose={() => setDrop(null)}
        onConfirm={() => {
          if (drop) {
            cancel(drop.id);
            addToast('success', `${drop.datasetName} 이용 취소`);
          }
          setDrop(null);
        }}
        title="이용 취소"
        message={`${drop?.datasetName ?? ''} 토큰을 더 쓸 수 없게 됩니다. 이번 달까지 금액이 정산됩니다.`}
        confirmLabel="이용 취소"
        variant="danger"
      />
    </div>
  );
}

/* ══ 거래 현황 › 데이터 한 건 — 이 데이터를 어디서 쓰는지 · 언제부터 · 얼마나 불러 쓰는지 · 취소했는지
 *    기업마다 얼마나 호출하는지 이름과 함께 보인다 ══ */
export function DataTradeDetailScreen({ fixedId }: { fixedId?: number } = {}) {
  const role = useDataRole();
  const [id, setId] = useState<number | null>(fixedId ?? null);
  useEffect(() => {
    if (fixedId == null) setId(Number(new URLSearchParams(window.location.search).get('id')));
  }, [fixedId]);
  const d = id == null ? undefined : role.products.find((x) => x.id === id);
  const trades = d
    ? role.tradesAll
        .filter((t) => t.datasetId === d.id)
        .sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || a.startedAt.localeCompare(b.startedAt))
    : [];
  const on = trades.filter(isActive);
  const label = (t: DataTrade) => t.buyerCompanyName;
  const paidMonths = (t: DataTrade) => monthsUntilNow([t]).filter((m) => billedIn(t, m)).length;
  const range = useRange();
  // 이용 내역에서 줄을 누르면 아래 사용량이 그 기업으로
  const [which, setWhich] = useState('');
  const days = range.days;

  const cols: Column<DataTrade>[] = [
    {
      key: 'who',
      header: '이용 기업',
      render: (t) => cell(label(t), String(t.id) === which ? 'font-semibold text-primary' : 'font-medium text-white'),
    },
    {
      key: 'state',
      header: '상태',
      width: '110px',
      render: (t) => <StatusPill tone={isActive(t) ? 'normal' : 'muted'} label={isActive(t) ? '이용 중' : '취소'} />,
    },
    { key: 'start', header: '시작일', width: '120px', render: (t) => num(day(t.startedAt)) },
    { key: 'cancel', header: '취소일', width: '120px', render: (t) => num(day(t.cancelledAt)) },
    {
      key: 'calls',
      header: '호출',
      width: '120px',
      sortable: true,
      sortValue: (t) => usageIn(t, days),
      render: (t) => strong(`${usageIn(t, days).toLocaleString('ko-KR')}회`),
    },
    {
      key: 'today',
      header: '오늘 호출',
      width: '110px',
      render: (t) => num(`${usageOf(t, DM_TODAY).toLocaleString('ko-KR')}회`),
    },
    { key: 'months', header: '이용한 달', width: '100px', render: (t) => num(`${paidMonths(t)}개월`) },
    { key: 'paid', header: '누적 금액', width: '120px', render: (t) => strong(won(paidMonths(t) * t.price)) },
  ];

  return (
    <div className="space-y-6">
      {fixedId != null ? (
        <>
          <Header title="거래 현황" />
          {d && <p className="-mt-3 text-base text-slate-400">{d.name}</p>}
        </>
      ) : (
        <>
          <Breadcrumb
            items={[
              { label: 'E-데이터마켓', path: '/e-data/inventory' },
              { label: '거래 현황', path: TRADING },
              { label: d?.name ?? '데이터' },
            ]}
          />
          <div className="flex items-center gap-3">
            <BackButton href={TRADING} label="거래 현황으로" />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-white">{d?.name ?? '데이터'}</h1>
              {d && <p className="mt-1 text-base text-slate-400">{d.ownerCompanyName}</p>}
            </div>
          </div>
        </>
      )}
      {id != null && !d ? (
        <div className="rounded-2xl bg-[#0d1520] p-10 text-center text-sm text-slate-400 ring-1 ring-white/[0.06]">
          데이터를 찾을 수 없습니다
        </div>
      ) : d ? (
        <>
          <StatsGrid columns={3}>
            <StatCard label="이용 중" value={`${on.length}곳`} />
            <StatCard label="취소" value={`${trades.length - on.length}곳`} />
            <StatCard label="이번 달 이용 금액" value={won(sumPrice(trades.filter((t) => billedIn(t, THIS_MONTH))))} />
          </StatsGrid>
          <SectionCard title={`이용 내역 (${trades.length})`} noPadding>
            <DataTable
              columns={cols}
              data={trades}
              rowKey={(t) => t.id}
              emptyMessage="이용 없음"
              onRowClick={(t) => isActive(t) && setWhich(String(t.id) === which ? '' : String(t.id))}
            />
          </SectionCard>
          <UsageCard
            range={range}
            groups={on.map((t) => ({ key: String(t.id), label: t.buyerCompanyName, trades: [t] }))}
            allLabel="전체 기업"
            value={which}
            onChange={setWhich}
          />
        </>
      ) : null}
    </div>
  );
}
