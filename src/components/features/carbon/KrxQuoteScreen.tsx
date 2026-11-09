'use client';

// E-데이터마켓 › 카본 마켓플레이스 › 탄소배출권 KRX 거래 (3.2.2)
// KRX 배출권시장 정보플랫폼 › 시세조회 화면과 같은 구성(확인 2026-11-09):
//   조회 줄: 종목선택(전체 / 종목) · 조회기간 시작~종료 · 1일 · 1개월 · 6개월 · 1년 · 조회
//   현재가 표(조회 시각) → 경매 정보 → 일자별 정보
//   일자별 정보는 KRX 는 표만, 여기는 종목을 골랐을 때 하루 거래 범위(저가~고가) I 자 선 + 종가 표시 + 거래량 막대를 표 위에 둔다(거래 있는 날만)
// 값은 데모(연동 없음) — src/lib/krx-quotes.ts. 현재가는 그날 일자별 값 한 줄(KRX 가 체결 시각을 공개하지 않아 장중에도 움직이지 않음).

import { useMemo, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { LINKS } from '@/lib/carbon-docs';
import { CarbonHeader, SiteLinks } from '@/components/features/carbon/CarbonScreens';
import {
  AUCTIONS,
  KRX_ITEMS,
  MARKET,
  SERIES_START,
  addMonths,
  boardRow,
  dailySeries,
  fmtRate,
  fmtWon,
  marketNow,
  type Auction,
  type BoardRow,
  type DailyQuote,
  type MarketPhase,
} from '@/lib/krx-quotes';

/* ── 등락 색 — 오름 빨강 · 내림 파랑 · 보합 흰색(주식 시세판과 같음) ── */
const tone = (v: number) => (v > 0 ? 'text-semantic-red' : v < 0 ? 'text-semantic-blue' : 'text-white');
const num = (v: ReactNode, cls = 'text-white') => <span className={cn('text-sm tabular-nums', cls)}>{v}</span>;
const signed = (v: number) => (v > 0 ? `+${fmtWon(v)}` : fmtWon(v));

const PHASE_BADGE: Record<MarketPhase, BadgeVariant> = {
  장전: 'default',
  장중: 'success',
  '종가 단일가': 'warning',
  장마감: 'default',
  휴장: 'danger',
};

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

/* ── 조회기간 빠른 선택 — 하루 한 값이라 1일은 없음(캔들 하나뿐), 1개월부터(2026-11-09) ── */
const QUICK = [
  { key: '1m', label: '1개월' },
  { key: '6m', label: '6개월' },
  { key: '1y', label: '1년' },
] as const;
type QuickKey = (typeof QUICK)[number]['key'];
function quickFrom(key: QuickKey, to: string) {
  const f = addMonths(to, key === '1m' ? -1 : key === '6m' ? -6 : -12);
  return f < SERIES_START ? SERIES_START : f;
}

const ITEM_OPTIONS = [{ value: '', label: '전체' }, ...KRX_ITEMS.map((it) => ({ value: it.code, label: it.code }))];

/* ══ 화면 ══ */
export function KrxQuoteScreen() {
  // 조회 시각 — 화면 연 때 한 번. 값은 시각 따라 움직이지 않는다(KRX 는 하루 값만 공개)
  const [now] = useState(() => new Date());
  const m = useMemo(() => marketNow(now), [now]);
  const rows = useMemo(() => KRX_ITEMS.map((it) => boardRow(it, m.date)), [m.date]);

  // 조회 조건 — 입력 중인 값과 [조회]로 적용한 값을 따로. 종목 '' = 전체. 처음은 KAU26 · 1개월(그래프가 바로 보이게)
  const first = { code: KRX_ITEMS[0]!.code, from: quickFrom('1m', m.date), to: m.date };
  const [code, setCode] = useState(first.code);
  const [from, setFrom] = useState(first.from);
  const [to, setTo] = useState(first.to);
  const [applied, setApplied] = useState(first);
  const apply = (c = code, f = from, t = to) => setApplied({ code: c, from: f, to: t });

  const shown = applied.code ? rows.filter((r) => r.code === applied.code) : rows;

  return (
    <div className="space-y-6">
      <CarbonHeader
        title="탄소배출권 KRX 거래"
        actions={
          <>
            <Badge variant={PHASE_BADGE[m.phase]}>{m.phase}</Badge>
            <span className="text-sm text-white">
              거래일 {m.date} · 매매 {MARKET.open}~{MARKET.close}
            </span>
          </>
        }
      />

      {/* 조회 줄 — KRX 시세조회와 같은 순서 */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#0d1520] px-4 py-3 ring-1 ring-white/[0.06]">
        <span className="text-sm text-slate-400">종목선택</span>
        <div className="w-40">
          <Select options={ITEM_OPTIONS} value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <span className="ml-2 text-sm text-slate-400">조회기간</span>
        <div className="w-40">
          <Input type="date" value={from} min={SERIES_START} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </div>
        <span className="text-slate-500">~</span>
        <div className="w-40">
          <Input type="date" value={to} min={from} max={m.date} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </div>
        <div className="flex rounded-md bg-white/[0.04] p-0.5 ring-1 ring-white/[0.06]">
          {QUICK.map((q) => (
            <button
              key={q.key}
              type="button"
              onClick={() => {
                setTo(m.date);
                setFrom(quickFrom(q.key, m.date));
              }}
              className="px-3 py-1 text-xs rounded text-slate-300 hover:bg-white/[0.08] hover:text-white transition-colors"
            >
              {q.label}
            </button>
          ))}
        </div>
        <Button size="md" onClick={() => apply()}>
          <Search size={16} />
          조회
        </Button>
      </div>

      <SectionCard title="현재가" actions={<span className="text-sm text-white tabular-nums">{clock(now)}</span>}>
        <BoardTable
          rows={shown}
          onSelect={(c) => {
            setCode(c);
            apply(c, applied.from, applied.to);
          }}
        />
      </SectionCard>

      <AuctionCard code={applied.code} from={applied.from} to={applied.to} />

      <DailyCard code={applied.code} from={applied.from} to={applied.to} tradeDate={m.date} />

      <SiteLinks
        id="sites-krx"
        rows={[
          ['KRX 시세조회', LINKS.krxPrice],
          ['KRX 공지사항', LINKS.krxBoard],
          ['KRX 매매거래시간', LINKS.krxHours],
          ['KRX 회원자격요건', LINKS.krxMember],
        ]}
      />
    </div>
  );
}

/* ── 현재가 표 — KRX 와 같은 칸, 줄을 누르면 그 종목으로 조회 ── */
function BoardTable({ rows, onSelect }: { rows: BoardRow[]; onSelect: (code: string) => void }) {
  const cols: Column<BoardRow>[] = [
    { key: 'code', header: '종목명', render: (r) => num(r.code, 'font-semibold text-white') },
    { key: 'price', header: '현재가', align: 'right', render: (r) => num(fmtWon(r.price), cn('font-semibold', tone(r.change))) },
    { key: 'change', header: '대비', align: 'right', render: (r) => num(signed(r.change), tone(r.change)) },
    { key: 'rate', header: '등락률(%)', align: 'right', render: (r) => num(fmtRate(r.rate), tone(r.change)) },
    { key: 'open', header: '시가', align: 'right', render: (r) => num(fmtWon(r.open)) },
    { key: 'high', header: '고가', align: 'right', render: (r) => num(fmtWon(r.high)) },
    { key: 'low', header: '저가', align: 'right', render: (r) => num(fmtWon(r.low)) },
    { key: 'vol', header: '거래량(톤)', align: 'right', render: (r) => num(fmtWon(r.vol)) },
    { key: 'amount', header: '거래대금(원)', align: 'right', render: (r) => num(fmtWon(r.amount)) },
  ];
  return <DataTable data={rows} columns={cols} rowKey={(r) => r.code} onRowClick={(r) => onSelect(r.code)} />;
}

/* ── 경매 정보 — KRX 와 같은 칸, 종목 · 조회기간으로 거른다 ── */
function AuctionCard({ code, from, to }: { code: string; from: string; to: string }) {
  const data = AUCTIONS.filter((a) => (!code || a.code === code) && a.date >= from && a.date <= to);
  const cols: Column<Auction>[] = [
    { key: 'date', header: '경매일별', render: (r) => num(r.date, 'font-medium text-white') },
    { key: 'code', header: '종목별', render: (r) => num(r.code, 'font-semibold text-white') },
    { key: 'offered', header: '입찰수량', align: 'right', render: (r) => num(fmtWon(r.offered)) },
    { key: 'bid', header: '응찰수량', align: 'right', render: (r) => num(fmtWon(r.bid)) },
    { key: 'ratio', header: '응찰비율(%)', align: 'right', render: (r) => num(r.ratio.toFixed(2)) },
    { key: 'bidders', header: '응찰자수', align: 'right', render: (r) => num(fmtWon(r.bidders)) },
    { key: 'winners', header: '낙찰자수', align: 'right', render: (r) => num(fmtWon(r.winners)) },
    { key: 'maxBid', header: '최고응찰가격', align: 'right', render: (r) => num(fmtWon(r.maxBid)) },
    { key: 'minBid', header: '최저응찰가격', align: 'right', render: (r) => num(fmtWon(r.minBid)) },
    { key: 'awarded', header: '낙찰수량', align: 'right', render: (r) => num(fmtWon(r.awarded)) },
    { key: 'price', header: '낙찰가격', align: 'right', render: (r) => num(fmtWon(r.price), 'font-semibold text-white') },
  ];
  return (
    <SectionCard title={`경매 정보 (${data.length})`}>
      <DataTable data={data} columns={cols} rowKey={(r) => `${r.date}-${r.code}`} emptyMessage="조회기간에 경매 없음" />
    </SectionCard>
  );
}

/* ── 일자별 정보 — 종목을 골랐으면 캔들 + 거래량 그래프, 그 아래 KRX 와 같은 표(전체면 종목마다 줄) ── */
function DailyCard({ code, from, to, tradeDate }: { code: string; from: string; to: string; tradeDate: string }) {
  const data = useMemo(() => {
    const codes = code ? [code] : KRX_ITEMS.map((it) => it.code);
    const rows = codes.flatMap((c) => dailySeries(c, tradeDate).filter((q) => q.date >= from && q.date <= to));
    // 최근 일자부터, 같은 날은 종목 순서
    const order = new Map(KRX_ITEMS.map((it, i) => [it.code, i]));
    return rows.sort((a, b) => (a.date === b.date ? order.get(a.code)! - order.get(b.code)! : a.date < b.date ? 1 : -1));
  }, [code, from, to, tradeDate]);
  const diff = (r: DailyQuote) => r.close - r.prev;
  const cols: Column<DailyQuote>[] = [
    { key: 'date', header: '일자', render: (r) => num(r.date, 'font-medium text-white') },
    { key: 'code', header: '종목명', render: (r) => num(r.code, 'font-semibold text-white') },
    { key: 'close', header: '종가', align: 'right', render: (r) => num(fmtWon(r.close), cn('font-semibold', tone(diff(r)))) },
    { key: 'diff', header: '대비', align: 'right', render: (r) => num(signed(diff(r)), tone(diff(r))) },
    { key: 'rate', header: '등락률', align: 'right', render: (r) => num(fmtRate(r.prev ? (diff(r) / r.prev) * 100 : 0), tone(diff(r))) },
    { key: 'open', header: '시가', align: 'right', render: (r) => num(fmtWon(r.open)) },
    { key: 'high', header: '고가', align: 'right', render: (r) => num(fmtWon(r.high)) },
    { key: 'low', header: '저가', align: 'right', render: (r) => num(fmtWon(r.low)) },
    { key: 'vol', header: '거래량', align: 'right', render: (r) => num(fmtWon(r.vol)) },
    { key: 'amount', header: '거래대금', align: 'right', render: (r) => num(fmtWon(r.amount)) },
    { key: 'vwap', header: '가중평균', align: 'right', render: (r) => num(fmtWon(r.vwap)) },
  ];
  return (
    <SectionCard
      title={`일자별 정보 (${data.length})`}
      actions={
        <span className="text-sm text-white tabular-nums">
          {code || '전체'} · {from} ~ {to}
        </span>
      }
    >
      {/* 그래프는 거래가 있었던 날만 — 거래 없는 날을 점이나 평평한 캔들로 채우지 않는다(2026-11-09). 표는 KRX 와 같이 모든 거래일 */}
      {code && <RangeChart data={[...data].reverse().filter((d) => d.vol > 0)} />}
      <DataTable data={data} columns={cols} rowKey={(r) => `${r.date}-${r.code}`} emptyMessage="조회기간에 거래일 없음" />
    </SectionCard>
  );
}

/* ── 일자별 그래프 — 위는 하루 거래 범위(저가~고가) I 자 선 + 종가 표시, 아래는 거래량 막대. 거래 있는 날만, 색 하나(양봉 · 음봉 없음).
 *   KRX 가 공개하는 건 하루 종가 · 고가 · 저가 · 거래량뿐이라 주식 캔들(시가~종가 몸통)은 그리지 않는다(2026-11-09 사용자: "I 자형, 데이터 바탕으로") ── */
const axis = { fontSize: 13, fill: '#cbd5e1' };
const grid = { stroke: 'rgba(255,255,255,0.06)' };
const RANGE = '#7DD3FC';

interface RangeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: DailyQuote;
}
/** Bar 의 값이 [저가, 고가] — 그 픽셀 범위에 세로 선(저가~고가) + 위아래 짧은 가로 마감(I 자) + 종가 가로 표시 */
function RangeBar({ x = 0, y = 0, width = 0, height = 0, payload }: RangeProps) {
  if (!payload) return null;
  const cx = x + width / 2;
  const cap = Math.max(3, width * 0.3);
  if (payload.high === payload.low) {
    // 하루 한 값 — 가로 선 하나
    return <line x1={cx - cap} x2={cx + cap} y1={y} y2={y} stroke={RANGE} strokeWidth={2} />;
  }
  const scale = height / (payload.high - payload.low);
  const yOf = (v: number) => y + (payload.high - v) * scale;
  const yClose = yOf(payload.close);
  return (
    <g>
      <line x1={cx} x2={cx} y1={yOf(payload.high)} y2={yOf(payload.low)} stroke={RANGE} strokeWidth={1.5} />
      <line x1={cx - cap} x2={cx + cap} y1={yOf(payload.high)} y2={yOf(payload.high)} stroke={RANGE} strokeWidth={1.5} />
      <line x1={cx - cap} x2={cx + cap} y1={yOf(payload.low)} y2={yOf(payload.low)} stroke={RANGE} strokeWidth={1.5} />
      <rect x={cx - cap - 1} y={yClose - 1.5} width={(cap + 1) * 2} height={3} fill="#FFFFFF" />
    </g>
  );
}

function RangeTip({ active, payload }: { active?: boolean; payload?: { payload?: DailyQuote }[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const d = p.close - p.prev;
  return (
    <div className="rounded-lg bg-[#0d1520] ring-1 ring-white/10 px-3 py-2 shadow-xl text-xs">
      <p className="mb-1 font-medium text-slate-300">
        {p.date} · {p.code}
      </p>
      <p className={cn('font-semibold', tone(d))}>
        종가 {fmtWon(p.close)} ({signed(d)}, {fmtRate(p.prev ? (d / p.prev) * 100 : 0)})
      </p>
      <p className="text-white">
        고가 {fmtWon(p.high)} · 저가 {fmtWon(p.low)}
      </p>
      <p className="text-white">
        거래량 {fmtWon(p.vol)} 톤 · 가중평균 {fmtWon(p.vwap)}
      </p>
    </div>
  );
}

function RangeChart({ data }: { data: DailyQuote[] }) {
  if (data.length === 0) return <p className="mb-6 py-10 text-center text-sm text-slate-400">조회기간에 거래 있는 날 없음</p>;
  // 가격 축 — 저가~고가(거래 있는 날만 들어온다)
  const lows = data.map((d) => d.low);
  const highs = data.map((d) => d.high);
  const lo = lows.length ? Math.min(...lows) : 0;
  const hi = highs.length ? Math.max(...highs) : 1;
  const padY = Math.max(100, Math.round((hi - lo) * 0.08));
  const maxVol = Math.max(1, ...data.map((d) => d.vol));
  const tickDate = (d: string) => d.slice(5);
  // 범위 값 = [저가, 고가]
  const range = (d: DailyQuote): [number, number] => [d.low, d.high];
  return (
    <div className="mb-6">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" {...grid} />
          <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} height={4} />
          <YAxis domain={[lo - padY, hi + padY]} tick={axis} axisLine={false} tickLine={false} width={64} tickFormatter={(v: number) => fmtWon(v)} />
          <Tooltip content={<RangeTip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey={range} shape={(p: unknown) => <RangeBar {...(p as RangeProps)} />} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <ResponsiveContainer width="100%" height={110}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" {...grid} />
          <XAxis dataKey="date" tickFormatter={tickDate} tick={axis} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
          <YAxis domain={[0, maxVol * 1.1]} tick={axis} axisLine={false} tickLine={false} width={64} tickFormatter={(v: number) => (v >= 10000 ? `${Math.round(v / 10000)}만` : fmtWon(v))} />
          <Tooltip content={<RangeTip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="vol" fill={RANGE} fillOpacity={0.6} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
