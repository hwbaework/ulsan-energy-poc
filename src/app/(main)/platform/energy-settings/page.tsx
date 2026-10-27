'use client';

import { useEffect, useState } from 'react';
import { Check, History, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { SectionCard } from '@/components/features';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/useAuthStore';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { TABLE, TABLE_HEAD_ROW, TABLE_TH, TABLE_ROW, TABLE_TD } from '@/components/features/DataList';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useToastStore } from '@/stores/useToastStore';
import { useEnergySettings, useHolidays, useKepcoTariff, useSaveEnergySettings, useSaveHolidays, useSaveKepcoTariff } from '@/hooks/common/useSettings';
import { PINE_PER_TCO2, TOE_PER_MWH } from '@/lib/constants/env-benefit';
import { GHG_FACTORS, type GhgFactor } from '@/lib/ghg-factors';
import { GHG_FACTORS_KEY, useGhgFactorList } from '@/lib/ghg-reduction';
import { holidayMap, opRuleOf, opYear, weekdayOf, type Holiday, type OpRule } from '@/lib/op-calendar';

const WEEK_KO = ['일', '월', '화', '수', '목', '금', '토'];
import { F1, PLAN_LABEL, TARIFF_LIM, TARIFF_YEAR_LIM, cagrOf, shareOfHours, tableAvg, type Plan, type TariffYearTable } from '@/lib/solar-sim';

// 에너지 설정 — 정부 공표·고시·사업 배정에 따라 바뀌는 값을 한 곳에서 관리한다.
// · 탄소 배출계수 → 무료진단 기본값 · 대시보드 · RE100 · PPA 보고서
// · 환경 편익 환산(화석에너지 대체 TOE · 소나무 식재) → 무료진단 검토서 누적 효과
// · 한전 요금 가산(기후환경요금 · 연료비조정요금) · 한전 요금표 → 무료진단 태양광 대체단가 · 기본요금 절감
// · 한전 요금표는 연도별(그 해 마지막 고시). 최근 해 = 무료진단 계산, 해마다 평균 전력량요금 → 전년 대비 · 실적 CAGR 자동
//   계산식은 원본 그대로, 값만 여기서 읽는다

/** 기준값 칸 — 카드 · 키 · 이름 · 단위 · 범위 · 소수 */
const BASE_FIELDS = [
  { card: 'co2', key: 'CO2_EMISSION_FACTOR', label: '탄소 배출계수 (전력 1MWh당 tCO₂)', unit: 't/MWh', lim: [0, 2], dec: true },
  { card: 'adj', key: 'CLIMATE_CHG', label: '기후환경요금', unit: '원/kWh', lim: [0, 100], dec: true },
  { card: 'adj', key: 'FUEL_ADJ', label: '연료비조정요금', unit: '원/kWh', lim: [-100, 100], dec: true, minus: true },
  { card: 'co2', key: 'TOE_PER_MWH', label: '화석에너지 대체 (전력 1MWh당 TOE)', unit: 'TOE/MWh', lim: [0, 1], dec: true, def: TOE_PER_MWH },
  { card: 'co2', key: 'PINE_PER_TCO2', label: '소나무 식재 (tCO₂당 그루 · 20년생)', unit: '그루/t', lim: [0, 1000], dec: true, def: PINE_PER_TCO2 },] as const;
/** 값마다 출처 — 에너지 설정에 `${key}_SOURCE` 로 저장. 처음엔 지금 값의 근거 */
const SOURCE_DEFAULT: Record<string, string> = {
  CO2_EMISSION_FACTOR: '온실가스종합정보센터 국가 전력 배출계수 (2023년 소비단, 2025-12-17 공표)',
  CLIMATE_CHG: '한국전력공사 전기요금표 기후환경요금',
  FUEL_ADJ: '한국전력공사 연료비조정단가',
  TOE_PER_MWH: '에너지법 시행규칙 에너지열량 환산기준 (전기 소비기준 9.6 MJ/kWh)',
  PINE_PER_TCO2: '국립산림과학원 소나무 1그루 연 6.6 kg CO₂ 흡수',
};
const srcKey = (key: string) => `${key}_SOURCE`;
/** 변경 이력 — 저장할 때 바뀐 값만 한 줄씩. 최신이 위 */
const HISTORY_KEY = 'ENERGY_HISTORY';
interface HistoryRow {
  at: string;
  item: string;
  before: string;
  after: string;
  source: string;
  by: string;
}
const parseHistory = (raw?: string): HistoryRow[] => {
  try {
    const v = JSON.parse(raw ?? '[]') as unknown;
    return Array.isArray(v) ? (v as HistoryRow[]) : [];
  } catch {
    return [];
  }
};
const nowText = () => {
  const d = new Date();
  const p2 = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

const BASE_CARDS = [
  { card: 'co2', title: '탄소 배출계수' },
  { card: 'adj', title: '한전 요금 가산' },
] as const;
const PLANS: Plan[] = ['1', '2'];
const PARTS = [
  { k: 'light', label: '경부하' },
  { k: 'mid', label: '중간부하' },
  { k: 'peak', label: '최대부하' },
] as const;
const SEASONS = ['여름', '봄·가을', '겨울'];
const SEASON_MONTHS = ['6~8월', '3~5월 · 9~10월', '11~2월']; // 무료진단은 월마다 이 계절 단가를 쓴다
/** 요금표 편집용 — 숫자는 글자로 들고 있다가 저장할 때 바꾼다. 시간대는 하루 24시간 중 경부하 · 최대부하 시간을 넣고 중간부하 = 나머지 */
type TableDraft = { year: string; hLight: string[]; hPeak: string[] } & Record<Plan, { base: string; light: string[]; mid: string[]; peak: string[] }>;
const toDraft = (t: TariffYearTable): TableDraft => {
  const row = (pl: Plan) => ({ base: String(t[pl].base), light: t[pl].light.map(String), mid: t[pl].mid.map(String), peak: t[pl].peak.map(String) });
  const h = (v: number) => String(Math.round(v * 24 * 10) / 10);
  return { year: String(t.year), hLight: t.share.map((x) => h(x.light)), hPeak: t.share.map((x) => h(x.peak)), '1': row('1'), '2': row('2') };
};
const toTable = (d: TableDraft): TariffYearTable => {
  const row = (pl: Plan) => ({ base: Number(d[pl].base), light: d[pl].light.map(Number), mid: d[pl].mid.map(Number), peak: d[pl].peak.map(Number) });
  return {
    year: Number(d.year),
    label: d.year,
    share: d.hLight.map((l, si) => shareOfHours(Number(l), Number(d.hPeak[si]))),
    '1': row('1'),
    '2': row('2'),
  };
};

const FIELD =
  'h-9 w-full rounded-md bg-white/[0.04] ring-1 ring-white/[0.08] px-2.5 text-right text-sm text-white tabular-nums focus:outline-none focus:ring-primary/60';

// 숫자와 점 하나만
const numOnly = (v: string, dot: boolean) => {
  const [head = '', ...rest] = v.replace(dot ? /[^0-9.]/g : /[^0-9]/g, '').split('.');
  return rest.length ? `${head}.${rest.join('')}` : head;
};

/** 배출원 계수(Scope 1 · 2) 편집용 — 숫자는 글자로 들고 있다가 저장할 때 바꾼다 */
/** Scope — 고도화로 늘면 여기만 늘린다 */
const GHG_SCOPES = [1, 2, 3];
const GHG_NUMS = ['ncv', 'co2', 'ch4', 'n2o'] as const;
type FactorDraft = Omit<GhgFactor, (typeof GHG_NUMS)[number]> & Record<(typeof GHG_NUMS)[number], string>;
const toFactorDraft = (f: GhgFactor): FactorDraft => ({ ...f, ncv: String(f.ncv), co2: String(f.co2), ch4: String(f.ch4), n2o: String(f.n2o) });
/** 칸 단위 — 전기는 t·kg/MWh, 그 밖은 kg/TJ */
const ghgUnitOf = (c: string, k: (typeof GHG_NUMS)[number]) =>
  k === 'ncv' ? 'MJ' : c === '외부 전기' ? (k === 'co2' ? 't/MWh' : 'kg/MWh') : 'kg/TJ';

export default function EnergySettingsPage() {
  const addToast = useToastStore((s) => s.add);
  // 산정 기준값
  const { data: energy, isLoading: energyLoading } = useEnergySettings();
  const saveEnergy = useSaveEnergySettings();
  const [base, setBase] = useState<Record<string, string>>({});
  const [baseDirty, setBaseDirty] = useState(false);

  useEffect(() => {
    if (energy && !baseDirty)
      setBase(
        Object.fromEntries(
          BASE_FIELDS.flatMap((f) => [
            [f.key, energy[f.key] ?? ('def' in f ? String(f.def) : '')],
            [srcKey(f.key), energy[srcKey(f.key)] ?? SOURCE_DEFAULT[f.key] ?? ''],
          ]),
        ),
      );
  }, [energy, baseDirty]);
  // 변경 이력 — 맨 위 [변경 이력] 팝업에서 본다
  const userName = useAuthStore((s) => s.user?.name ?? '');
  const history = parseHistory(energy?.[HISTORY_KEY]);
  const [historyOpen, setHistoryOpen] = useState(false);
  // 배출원 계수(Scope 1 · 2, 연료별) — 화면에서 바로 고치고 맨 위 [저장]으로 함께 저장
  const ghgFactors = useGhgFactorList();
  const [factors, setFactors] = useState<FactorDraft[]>([]);
  const [factorDirty, setFactorDirty] = useState(false);
  useEffect(() => {
    if (!factorDirty) setFactors(ghgFactors.map(toFactorDraft));
  }, [ghgFactors, factorDirty]);
  const editFactor = (i: number, patch: Partial<FactorDraft>) => {
    setFactors((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)));
    setFactorDirty(true);
  };
  // 무료진단 PPA 쉬는 날 — 이 규칙 · 금년 공휴일(특일 정보)로 가동일을 센다
  const [opRule, setOpRule] = useState<OpRule | null>(null);
  const [opDirty, setOpDirty] = useState(false);
  const [saveAsk, setSaveAsk] = useState(false); // 저장 전 확인 — 바로 반영하지 않는다
  useEffect(() => {
    if (energy && !opDirty) setOpRule(opRuleOf(energy));
  }, [energy, opDirty]);
  // 해 — 금년 · 내년(내년 공휴일은 월력요항이 나오는 6월쯤 API 에 들어온다). 고치는 중이면 저장 전까지 못 바꾼다
  const thisYear = new Date().getFullYear();
  const [opYearNo, setOpYearNo] = useState(thisYear);
  // 공휴일 — 특일 정보 API 목록을 받아 사람이 더하고 뺀다(임시공휴일 · 취소)
  const { data: holidays } = useHolidays(opYearNo);
  const saveHol = useSaveHolidays(opYearNo);
  const [hol, setHol] = useState<Holiday[]>([]);
  const [holDirty, setHolDirty] = useState(false);
  const [newHol, setNewHol] = useState({ date: '', name: '' });
  useEffect(() => {
    if (holidays && !holDirty) setHol(holidays);
  }, [holidays, holDirty]);
  const opYr = opRule ? opYear(opYearNo, holidayMap(hol), opRule) : null;
  const editBase = (key: string, v: string) => {
    setBase((prev) => ({ ...prev, [key]: v }));
    setBaseDirty(true);
  };
  // 연도별 한전 요금표 — 고른 해(sel) 하나를 펼쳐 고친다. 처음엔 가장 최근 해
  const { data: kepco, isLoading: kepcoLoading } = useKepcoTariff();
  const saveKepco = useSaveKepcoTariff();
  const [book, setBook] = useState<TableDraft[] | null>(null);
  const [sel, setSel] = useState(0);
  const [tableDirty, setTableDirty] = useState(false);
  useEffect(() => {
    if (kepco && !tableDirty) {
      const d = [...kepco].sort((a, b) => a.year - b.year).map(toDraft);
      setBook(d);
      setSel(d.length - 1);
    }
  }, [kepco, tableDirty]);
  const table = book?.[sel] ?? null;
  const editTable = (fn: (d: TableDraft) => void) => {
    setBook((prev) => {
      if (!prev?.[sel]) return prev;
      const next = structuredClone(prev);
      fn(next[sel]!);
      return next;
    });
    setTableDirty(true);
  };
  // 연도 추가 — 가장 최근 해 표를 복사해 내년으로
  const addYear = () => {
    if (!book?.length) return;
    const last = book.reduce((m, d) => (Number(d.year) > Number(m.year) ? d : m), book[0]!);
    setBook([...book, { ...structuredClone(last), year: String(Number(last.year) + 1) }]);
    setSel(book.length);
    setTableDirty(true);
  };
  const removeYear = () => {
    if (!book || book.length < 2) return;
    setBook(book.filter((_, k) => k !== sel));
    setSel(Math.max(0, sel - 1));
    setTableDirty(true);
  };
  // 해마다 평균 전력량요금(요금제별) — 전년 대비 · 연평균 상승률
  const avgRows = (book ?? [])
    .map((d, k) => ({ k, year: Number(d.year), t: toTable(d) }))
    .filter((r) => Number.isInteger(r.year) && r.year > 0)
    .sort((a, b) => a.year - b.year)
    .map((r) => ({ ...r, avg: { '1': tableAvg(r.t, '1'), '2': tableAvg(r.t, '2') } as Record<Plan, number> }));
  const cagrBy = (pl: Plan) => cagrOf(avgRows.map((r) => ({ year: r.year, price: r.avg[pl] })));

  const onSave = async () => {
    // 산정 기준값 검사
    for (const f of BASE_FIELDS) {
      const v = (base[f.key] ?? '').trim();
      const n = Number(v);
      if (v === '' || !Number.isFinite(n) || n < f.lim[0] || n > f.lim[1]) return addToast('error', `${f.label}은 ${f.lim[0]}~${f.lim[1].toLocaleString()} 사이로 입력하세요`);
    }    // 한전 요금표 검사
    if (book) {
      const years = book.map((d) => Number(d.year));
      if (years.some((y) => !Number.isInteger(y) || y < TARIFF_YEAR_LIM.year[0] || y > TARIFF_YEAR_LIM.year[1])) return addToast('error', `연도는 ${TARIFF_YEAR_LIM.year[0]}~${TARIFF_YEAR_LIM.year[1]} 사이로 입력하세요`);
      if (new Set(years).size !== years.length) return addToast('error', '같은 연도가 두 번 있습니다');
    }
    for (const table of book ?? []) {
      for (let si = 0; si < 3; si++) {
        const l = Number(table.hLight[si]);
        const p = Number(table.hPeak[si]);
        if (table.hLight[si] === '' || table.hPeak[si] === '' || !(l >= 0 && p >= 0 && l + p <= 24)) return addToast('error', '경부하 · 최대부하 시간은 합쳐 24시간 이하로 입력하세요');
      }
      for (const pl of PLANS) {
        const b = Number(table[pl].base);
        if (table[pl].base === '' || !(b >= TARIFF_LIM.base[0] && b <= TARIFF_LIM.base[1])) return addToast('error', `기본요금은 ${TARIFF_LIM.base[0]}~${TARIFF_LIM.base[1].toLocaleString()}원/kW 사이로 입력하세요`);
        for (const part of PARTS) if (table[pl][part.k].some((x) => x === '' || !(Number(x) >= TARIFF_LIM.unit[0] && Number(x) <= TARIFF_LIM.unit[1]))) return addToast('error', `전력량요금은 ${TARIFF_LIM.unit[0]}~${TARIFF_LIM.unit[1].toLocaleString()}원/kWh 사이로 입력하세요`);
      }
    }
    // 배출원 계수 검사
    if (factorDirty)
      for (const r of factors) {
        if (!r.category.trim() || !r.fuel.trim() || !r.unit.trim()) return addToast('error', '배출원 계수의 배출활동 · 연료 · 에너지 · 단위를 입력하세요');
        if (GHG_NUMS.some((k) => r[k].trim() === '' || !Number.isFinite(Number(r[k]))))
          return addToast('error', `${r.fuel} — 순발열량 · CO₂ · CH₄ · N₂O 를 숫자로 입력하세요`);
      }
    // 변경 이력 — 기준값(값 · 출처) · 배출원 계수에서 바뀐 것만
    const at = nowText();
    const logs: HistoryRow[] = [];
    if (baseDirty)
      for (const f of BASE_FIELDS) {
        const before = energy?.[f.key] ?? ('def' in f ? String(f.def) : '');
        const after = (base[f.key] ?? '').trim();
        const srcBefore = energy?.[srcKey(f.key)] ?? SOURCE_DEFAULT[f.key] ?? '';
        const srcAfter = (base[srcKey(f.key)] ?? '').trim();
        if (before !== after || srcBefore !== srcAfter)
          logs.push({ at, item: f.label, before: `${before} ${f.unit}`, after: `${after} ${f.unit}`, source: srcAfter, by: userName });
      }
    if (factorDirty) {
      const prev = new Map(ghgFactors.map((g) => [g.id, g]));
      const next = new Map(factors.map((r) => [r.id, r]));
      const name = (x: { scope: number; category: string; fuel: string }) => `배출원 계수 · Scope ${x.scope} ${x.category} ${x.fuel}`;
      for (const r of factors) {
        const g = prev.get(r.id);
        if (!g) {
          logs.push({ at, item: name(r), before: '', after: '추가', source: r.basis.trim(), by: userName });
          continue;
        }
        const diff = [
          g.scope !== r.scope ? `Scope ${g.scope} → ${r.scope}` : '',
          g.category !== r.category.trim() ? `배출활동 ${g.category} → ${r.category.trim()}` : '',
          g.fuel !== r.fuel.trim() ? `연료 ${g.fuel} → ${r.fuel.trim()}` : '',
          g.unit !== r.unit.trim() ? `단위 ${g.unit} → ${r.unit.trim()}` : '',
          ...GHG_NUMS.map((k) => (String(g[k]) !== r[k].trim() ? `${k.toUpperCase()} ${g[k]} → ${r[k].trim()}` : '')),
          g.basis !== r.basis.trim() ? '출처' : '',
        ].filter(Boolean);
        if (diff.length) logs.push({ at, item: name(r), before: diff.map((d) => d.split(' → ')[0]).join(', '), after: diff.map((d) => d.split(' → ')[1] ?? d).join(', '), source: r.basis.trim(), by: userName });
      }
      for (const g of ghgFactors) if (!next.has(g.id)) logs.push({ at, item: name(g), before: '', after: '삭제', source: g.basis, by: userName });
    }
    try {
      if (logs.length) await saveEnergy.mutateAsync({ [HISTORY_KEY]: JSON.stringify([...logs, ...history].slice(0, 300)) });
      if (factorDirty)
        await saveEnergy.mutateAsync({
          [GHG_FACTORS_KEY]: JSON.stringify(
            factors.map((r) => ({ ...r, category: r.category.trim(), fuel: r.fuel.trim(), unit: r.unit.trim(), basis: r.basis.trim(), ncv: Number(r.ncv), co2: Number(r.co2), ch4: Number(r.ch4), n2o: Number(r.n2o) })),
          ),
        });
      if (baseDirty)
        await saveEnergy.mutateAsync(
          Object.fromEntries(
            BASE_FIELDS.flatMap((f) => [
              [f.key, (base[f.key] ?? '').trim()],
              [srcKey(f.key), (base[srcKey(f.key)] ?? '').trim()],
            ]),
          ),
        );
      if (opDirty && opRule)
        await saveEnergy.mutateAsync({ PPA_WEEKEND_OFF: opRule.weekendOff ? '1' : '0', PPA_HOLIDAY_OFF: opRule.holidayOff ? '1' : '0', PPA_OFF_START: opRule.offStart ?? '', PPA_ON_TIME: opRule.onTime ?? '' });
      if (holDirty) await saveHol.mutateAsync(hol);
      setOpDirty(false);
      setHolDirty(false);
      if (tableDirty && book) await saveKepco.mutateAsync(book.map(toTable));
      setBaseDirty(false);
      setTableDirty(false);
      setFactorDirty(false);
      addToast('success', '에너지 설정을 저장했습니다');
    } catch {
      addToast('error', '저장에 실패했습니다');
    }
  };

  const pending = saveEnergy.isPending || saveKepco.isPending || saveHol.isPending;
  const anyDirty = baseDirty || tableDirty || opDirty || holDirty || factorDirty;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '관리' }, { label: '에너지 설정' }]} />
      <ConfirmDialog
        open={saveAsk}
        onClose={() => setSaveAsk(false)}
        onConfirm={() => {
          setSaveAsk(false);
          void onSave();
        }}
        title="에너지 설정 저장"
        message="바꾼 값을 저장합니다. 무료진단 · 가동일 · 대시보드가 이 값을 씁니다."
        confirmLabel="저장"
      />

      {/* 제목 · 오른쪽 저장 — 스크롤해도 상단(헤더 100px 아래)에 따라다닌다 */}
      <div className="sticky top-[100px] z-20 flex flex-wrap items-center justify-between gap-3 py-3 backdrop-blur">
        <h1 className="text-2xl font-bold text-white">에너지 설정</h1>
        <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => setHistoryOpen(true)}>
          <History size={14} className="mr-1" /> 변경 이력
        </Button>
        <Button onClick={() => setSaveAsk(true)} disabled={!anyDirty || pending || energyLoading || kepcoLoading}>
          {pending ? <Loader2 size={14} className="mr-1 animate-spin" /> : anyDirty ? <Save size={14} className="mr-1" /> : <Check size={14} className="mr-1" />}
          {pending ? '저장 중…' : anyDirty ? '저장' : '저장됨'}
        </Button>
        </div>
      </div>

      {/* 변경 이력 — 저장할 때 바뀐 값만 쌓인다. 보기만 */}
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="변경 이력" size="xl">
        <div className="max-h-[60vh] overflow-auto">
          <table className={cn(TABLE, 'tabular-nums')}>
            <thead>
              <tr className={TABLE_HEAD_ROW}>
                <th className={cn(TABLE_TH, 'whitespace-nowrap')}>일시</th>
                <th className={TABLE_TH}>항목</th>
                <th className={TABLE_TH}>이전</th>
                <th className={TABLE_TH}>변경</th>
                <th className={TABLE_TH}>출처</th>
                <th className={cn(TABLE_TH, 'whitespace-nowrap')}>변경한 사람</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={`${h.at}-${i}`} className={TABLE_ROW}>
                  <td className={cn(TABLE_TD, 'whitespace-nowrap')}>{h.at}</td>
                  <td className={cn(TABLE_TD, 'text-white')}>{h.item}</td>
                  <td className={TABLE_TD}>{h.before}</td>
                  <td className={cn(TABLE_TD, 'text-white')}>{h.after}</td>
                  <td className={TABLE_TD}>{h.source}</td>
                  <td className={cn(TABLE_TD, 'whitespace-nowrap')}>{h.by}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className={cn(TABLE_TD, 'py-10 text-center text-slate-500')}>
                    변경 이력 없음
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>

      {BASE_CARDS.map((c) => (
        <SectionCard key={c.card} title={c.title}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {BASE_FIELDS.filter((f) => f.card === c.card).map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1.5 block text-sm text-slate-300">{f.label}</span>
                {/* 단위는 값 옆 따로 — 단위가 길어도(TOE/MWh) 숫자와 겹치지 않게 */}
                <div className="flex h-9 items-center rounded-md bg-white/[0.04] px-2.5 ring-1 ring-white/[0.08] focus-within:ring-primary/60">
                  <input
                    aria-label={f.label}
                    inputMode="decimal"
                    maxLength={10}
                    value={base[f.key] ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const neg = 'minus' in f && f.minus && raw.trim().startsWith('-');
                      editBase(f.key, (neg ? '-' : '') + numOnly(raw, f.dec));
                    }}
                    className="h-full min-w-0 flex-1 bg-transparent text-right text-sm text-white tabular-nums focus:outline-none"
                  />
                  <span className="ml-2 shrink-0 text-xs text-slate-500">{f.unit}</span>
                </div>
                <input
                  aria-label={`${f.label} 출처`}
                  maxLength={120}
                  placeholder="출처"
                  value={base[srcKey(f.key)] ?? ''}
                  onChange={(e) => editBase(srcKey(f.key), e.target.value)}
                  className={`${FIELD} mt-1.5 text-left text-xs text-slate-300`}
                />
              </label>
            ))}
          </div>
        </SectionCard>
      ))}

      {/* 배출원 계수(Scope 1 · 2, 연료별) — 화면에서 바로 고친다. 온실가스 › 배출계수 관리 표가 이 값을 읽는다 */}
      <SectionCard
        title="배출원 계수"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setFactors(GHG_FACTORS.map(toFactorDraft));
                setFactorDirty(true);
              }}
            >
              <RotateCcw size={14} className="mr-1" /> 기본값으로
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setFactors((prev) => [...prev, { id: `u${Date.now()}`, scope: 1, category: '', fuel: '', unit: '', ncv: '', co2: '', ch4: '', n2o: '', basis: '' }]);
                setFactorDirty(true);
              }}
            >
              <Plus size={14} className="mr-1" /> 계수 추가
            </Button>
          </div>
        }
        noPadding
      >
        <div className="overflow-x-auto">
          <table className={cn(TABLE, 'min-w-[1240px] tabular-nums')}>
            <thead>
              <tr className={TABLE_HEAD_ROW}>
                <th className={cn(TABLE_TH, 'px-3')}>Scope</th>
                <th className={cn(TABLE_TH, 'px-3')}>배출활동</th>
                <th className={cn(TABLE_TH, 'px-3')}>연료 · 에너지</th>
                <th className={cn(TABLE_TH, 'px-3')}>단위</th>
                <th className={cn(TABLE_TH, 'px-3')}>순발열량</th>
                <th className={cn(TABLE_TH, 'px-3')}>CO₂</th>
                <th className={cn(TABLE_TH, 'px-3')}>CH₄</th>
                <th className={cn(TABLE_TH, 'px-3')}>N₂O</th>
                <th className={cn(TABLE_TH, 'px-3')}>출처</th>
                <th className={cn(TABLE_TH, 'px-3')} />
              </tr>
            </thead>
            <tbody>
              {factors.map((r, i) => (
                <tr key={r.id} className={TABLE_ROW}>
                  <td className={cn(TABLE_TD, 'w-[120px] px-3')}>
                    <select
                      aria-label="Scope"
                      value={r.scope}
                      onChange={(e) => editFactor(i, { scope: Number(e.target.value) })}
                      className={`${FIELD} text-left [color-scheme:dark]`}
                    >
                      {GHG_SCOPES.map((n) => (
                        <option key={n} value={n}>{`Scope ${n}`}</option>
                      ))}
                    </select>
                  </td>
                  <td className={cn(TABLE_TD, 'w-[150px] px-3')}>
                    <input aria-label="배출활동" maxLength={30} value={r.category} onChange={(e) => editFactor(i, { category: e.target.value })} className={`${FIELD} text-left`} />
                  </td>
                  <td className={cn(TABLE_TD, 'w-[170px] px-3')}>
                    <input aria-label="연료 · 에너지" maxLength={30} value={r.fuel} onChange={(e) => editFactor(i, { fuel: e.target.value })} className={`${FIELD} text-left`} />
                  </td>
                  <td className={cn(TABLE_TD, 'w-[90px] px-3')}>
                    <input aria-label="단위" maxLength={10} value={r.unit} onChange={(e) => editFactor(i, { unit: e.target.value })} className={`${FIELD} text-left`} />
                  </td>
                  {GHG_NUMS.map((k) => (
                    <td key={k} className={cn(TABLE_TD, 'w-[140px] px-3')}>
                      <div className="flex items-center gap-1.5">
                        <input
                          aria-label={k}
                          inputMode="decimal"
                          maxLength={12}
                          value={r[k]}
                          onChange={(e) => editFactor(i, { [k]: numOnly(e.target.value, true) })}
                          className={FIELD}
                        />
                        <span className="shrink-0 text-xs text-slate-500">{ghgUnitOf(r.category, k)}</span>
                      </div>
                    </td>
                  ))}
                  <td className={cn(TABLE_TD, 'w-[220px] px-3')}>
                    <input aria-label="출처" maxLength={120} value={r.basis} onChange={(e) => editFactor(i, { basis: e.target.value })} className={`${FIELD} text-left`} />
                  </td>
                  <td className={cn(TABLE_TD, 'w-[48px] px-3')}>
                    <button
                      type="button"
                      aria-label={`${r.fuel || '계수'} 삭제`}
                      onClick={() => {
                        setFactors((prev) => prev.filter((_, k) => k !== i));
                        setFactorDirty(true);
                      }}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* 가동일 — 쉬는 날 인버터 OFF 기준(무료진단 · 운전 일정 기본값). 공휴일은 특일 정보(한국천문연구원) + 사람이 더하고 뺌, 주말은 달력 */}
      {opRule && opYr && (
        <SectionCard
          title="가동일"
          actions={
            <div className="w-32">
              <Select
                options={[thisYear, thisYear + 1].map((y) => ({ value: String(y), label: `${y}년` }))}
                value={String(opYearNo)}
                disabled={holDirty}
                onChange={(e) => {
                  setOpYearNo(Number(e.target.value));
                  setNewHol({ date: '', name: '' });
                }}
              />
            </div>
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-5 text-sm text-slate-200">
              {(
                [
                  ['weekendOff', '주말 OFF'],
                  ['holidayOff', '공휴일 OFF'],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={opRule[k]}
                    onChange={(e) => {
                      setOpRule({ ...opRule, [k]: e.target.checked });
                      setOpDirty(true);
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-sm text-slate-300 tabular-nums">
              {opYearNo}년 가동일 <b className="text-lg text-white">{opYr.op}</b>일 / {opYr.days}일 · OFF 주말 {opYr.weekend} · 공휴일 {opYr.holiday}
            </p>
          </div>
          {/* 매일 고정 OFF · ON 시각 — 날짜가 아니라 시간으로 끈다 */}
          <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-slate-200">
            {(
              [
                ['onTime', '매일 ON 시각'],
                ['offStart', '매일 OFF 시각'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2">
                <span className="shrink-0 whitespace-nowrap">{label}</span>
                <input
                  type="time"
                  value={opRule[k] ?? ''}
                  onChange={(e) => {
                    setOpRule({ ...opRule, [k]: e.target.value });
                    setOpDirty(true);
                  }}
                  className={`${FIELD} w-[150px] text-left [color-scheme:dark]`}
                />
              </label>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className={cn(TABLE, 'min-w-[640px] tabular-nums')}>
              <thead>
                <tr className={TABLE_HEAD_ROW}>
                  <th className={cn(TABLE_TH, 'px-3')}>월</th>
                  {opYr.months.map((x) => (
                    <th key={x.m} className={cn(TABLE_TH, 'px-3 text-right')}>
                      {x.m}월
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className={TABLE_ROW}>
                  <td className={cn(TABLE_TD, 'px-3')}>가동일</td>
                  {opYr.months.map((x) => (
                    <td key={x.m} className={cn(TABLE_TD, 'px-3 text-right')}>
                      {x.op}
                    </td>
                  ))}
                </tr>
                <tr className={TABLE_ROW}>
                  <td className={cn(TABLE_TD, 'px-3')}>공휴일</td>
                  {opYr.months.map((x) => (
                    <td key={x.m} className={cn(TABLE_TD, 'px-3 text-right')}>
                      {x.holiday || ''}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {/* 공휴일 — 특일 정보 API 로 받아 오고, 임시공휴일 · 취소 등은 여기서 더하고 뺀다 */}
          <div className="mt-5">
            {/* 공휴일 수 — 목록 전체(주말과 겹친 날 포함)와 그중 평일(실제로 OFF 가 늘어나는 날) */}
            <p className="mb-2 text-sm font-semibold text-white">
              {`공휴일 ${hol.length}일`}
              <span className="ml-2 font-normal text-slate-400">{`평일 ${hol.filter((h) => weekdayOf(h.date) % 6 !== 0).length}일 · 주말과 겹침 ${hol.filter((h) => weekdayOf(h.date) % 6 === 0).length}일`}</span>
            </p>
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
              {hol.map((h) => (
                <div key={h.date} className="flex items-center justify-between border-b border-white/[0.04] py-1.5 text-sm">
                  <span className="text-slate-200 tabular-nums">
                    {h.date} <span className="ml-1 text-slate-400">{`(${WEEK_KO[weekdayOf(h.date)]})`}</span>
                    <span className="ml-2 text-slate-300">{h.name}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={`${h.date} 삭제`}
                    onClick={() => {
                      setHol(hol.filter((x) => x.date !== h.date));
                      setHolDirty(true);
                    }}
                    className="rounded-md p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input type="date" aria-label="추가할 날짜" value={newHol.date} min={`${opYearNo}-01-01`} max={`${opYearNo}-12-31`} onChange={(e) => setNewHol({ ...newHol, date: e.target.value })} className={`${FIELD} max-w-[170px] text-left`} />
              <input aria-label="공휴일 이름" maxLength={30} placeholder="이름" value={newHol.name} onChange={(e) => setNewHol({ ...newHol, name: e.target.value })} className={`${FIELD} max-w-[220px] text-left`} />
              <Button
                size="sm"
                variant="secondary"
                disabled={!newHol.date || !newHol.name.trim() || hol.some((x) => x.date === newHol.date)}
                onClick={() => {
                  setHol([...hol, { date: newHol.date, name: newHol.name.trim() }].sort((a, b) => a.date.localeCompare(b.date)));
                  setNewHol({ date: '', name: '' });
                  setHolDirty(true);
                }}
              >
                <Plus size={14} className="mr-1" /> 공휴일 추가
              </Button>
            </div>
          </div>
        </SectionCard>
      )}

      {/* 한전 요금표 — 산업용(을) 고압A 하나. 경부하 · 중간부하 · 최대부하 */}
      {table && (
        <SectionCard
          title="한전 요금표"
          noPadding
          actions={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={addYear}>
                <Plus size={14} className="mr-1" /> 연도 추가
              </Button>
              <Button size="sm" variant="secondary" onClick={removeYear} disabled={(book?.length ?? 0) < 2}>
                <Trash2 size={14} className="mr-1" /> {table.year} 삭제
              </Button>
            </div>
          }
        >
          {/* 연도별 평균 — 해가 늘어도 길어지지 않게 표 대신 요약 + 그래프. 그래프 점이나 셀렉트로 아래 표의 해를 고른다. 가장 최근 해가 무료진단 계산에 쓰인다 */}
          <div className="space-y-4 px-5 pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PLANS.map((pl) => {
                const c = cagrBy(pl);
                const last = avgRows[avgRows.length - 1];
                const prev = avgRows[avgRows.length - 2];
                const chg = last && prev && last.year - prev.year === 1 ? (last.avg[pl] / prev.avg[pl] - 1) * 100 : null;
                return (
                  <div key={pl} className="rounded-lg bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.06]">
                    <p className="text-xs text-slate-400">{PLAN_LABEL[pl]} · 연평균 상승률 (CAGR)</p>
                    <p className="mt-1 text-2xl font-bold text-white tabular-nums">
                      {c ? `${(c.rate * 100).toFixed(2)}%/yr` : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-300 tabular-nums">
                      {last ? `${last.year} 평균 ${F1(last.avg[pl])}원/kWh` : ''}
                      {chg === null ? '' : ` · 전년 대비 ${chg >= 0 ? '+' : ''}${chg.toFixed(1)}%`}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={avgRows.map((r) => ({ year: String(r.year), k: r.k, a: +r.avg['1'].toFixed(1), b: +r.avg['2'].toFixed(1) }))}
                  onClick={(e) => {
                    const r = avgRows.find((x) => String(x.year) === String(e?.activeLabel));
                    if (r) setSel(r.k);
                  }}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={40} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12 }} formatter={(v) => `${v}원/kWh`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line dataKey="a" name={`${PLAN_LABEL['1']} 평균`} stroke="#94a3b8" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  <Line dataKey="b" name={`${PLAN_LABEL['2']} 평균`} stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="w-40">
              <Select
                label="연도"
                options={avgRows.map((r) => ({ value: String(r.k), label: String(r.year) }))}
                value={String(sel)}
                onChange={(e) => setSel(Number(e.target.value))}
              />
            </div>
          </div>
          <table className={cn(TABLE, 'mt-4')}>
            <thead>
              {/* 요금표는 글자를 한 단계 크게 · 밝게 — 계절 아래 해당 월 */}
              <tr className={TABLE_HEAD_ROW}>
                <th className={TABLE_TH}>요금제</th>
                <th className={TABLE_TH}>구분</th>
                {SEASONS.map((sn, si) => (
                  <th key={sn} className={TABLE_TH}>
                    {sn}
                    <span className="mt-0.5 block text-xs font-normal text-slate-400">{SEASON_MONTHS[si]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLANS.flatMap((pl) => [
                <tr key={`${pl}-base`} className={TABLE_ROW}>
                  <td className={cn(TABLE_TD, 'align-top font-medium')} rowSpan={1 + PARTS.length}>
                    {PLAN_LABEL[pl]}
                  </td>
                  <td className={TABLE_TD}>기본요금 (원/kW)</td>
                  <td className={TABLE_TD} colSpan={3}>
                    <input
                      aria-label={`${PLAN_LABEL[pl]} 기본요금`}
                      inputMode="decimal"
                      maxLength={8}
                      value={table[pl].base}
                      onChange={(e) =>
                        editTable((d) => {
                          d[pl].base = numOnly(e.target.value, true);
                        })
                      }
                      className={`${FIELD} max-w-[160px]`}
                    />
                  </td>
                </tr>,
                ...PARTS.map((part) => (
                  <tr key={`${pl}-${part.k}`} className={TABLE_ROW}>
                    <td className={TABLE_TD}>{part.label} (원/kWh)</td>
                    {[0, 1, 2].map((si) => (
                      <td key={si} className={TABLE_TD}>
                        <input
                          aria-label={`${PLAN_LABEL[pl]} ${part.label} ${SEASONS[si]}`}
                          inputMode="decimal"
                          maxLength={7}
                          value={table[pl][part.k][si] ?? ''}
                          onChange={(e) =>
                            editTable((d) => {
                              d[pl][part.k][si] = numOnly(e.target.value, true);
                            })
                          }
                          className={`${FIELD} max-w-[140px]`}
                        />
                      </td>
                    ))}
                  </tr>
                )),
              ])}
              {/* 시간대 비중 — 하루 24시간 중 경부하 · 최대부하 시간을 넣고, 중간부하 = 나머지 */}
              {PARTS.map((part, k) => (
                <tr key={`hours-${part.k}`} className={k < PARTS.length - 1 ? TABLE_ROW : undefined}>
                  {k === 0 && (
                    <td className={cn(TABLE_TD, 'align-top font-medium')} rowSpan={PARTS.length}>
                      시간대 (하루 24시간)
                    </td>
                  )}
                  <td className={TABLE_TD}>{part.label} (시간)</td>
                  {[0, 1, 2].map((si) => {
                    if (part.k === 'mid') {
                      const rest = 24 - Number(table.hLight[si]) - Number(table.hPeak[si]);
                      return (
                        <td key={si} className={cn(TABLE_TD, 'tabular-nums')}>
                          {Number.isFinite(rest) ? Math.round(rest * 10) / 10 : ''}
                        </td>
                      );
                    }
                    const key = part.k === 'light' ? 'hLight' : 'hPeak';
                    return (
                      <td key={si} className={TABLE_TD}>
                        <input
                          aria-label={`${part.label} 시간 ${SEASONS[si]}`}
                          inputMode="decimal"
                          maxLength={4}
                          value={table[key][si] ?? ''}
                          onChange={(e) =>
                            editTable((d) => {
                              d[key][si] = numOnly(e.target.value, true);
                            })
                          }
                          className={`${FIELD} max-w-[140px]`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      )}
    </div>
  );
}
