'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { SectionCard } from '@/components/features';
import { Button } from '@/components/ui/Button';
import { useToastStore } from '@/stores/useToastStore';
import { useEnergySettings, useIndustrialTariff, useKepcoTariff, useSaveEnergySettings, useSaveIndustrialTariff, useSaveKepcoTariff } from '@/hooks/common/useSettings';
import { F1, PLAN_LABEL, TARIFF_LIM, TARIFF_YEAR_LIM, cagrOf, type Plan, type TariffTable, type TariffYear } from '@/lib/solar-sim';

// 에너지 설정 — 정부 공표·고시·사업 배정에 따라 바뀌는 값을 한 곳에서 관리한다.
// · 산업용 평균판매단가 연도별 실적 → 무료진단 '실적 CAGR 반영' 시나리오(첫해 → 마지막 해). 새 연도 실적이 나오면 한 줄 추가
// · 탄소 배출계수 → 무료진단 기본값 · 대시보드 · RE100 · PPA 보고서
// · 한전 요금 가산(기후환경요금 · 연료비조정요금) · 한전 요금표 → 무료진단 태양광 대체단가 · 기본요금 절감
//   계산식은 원본 그대로, 값만 여기서 읽는다

/** 기준값 칸 — 카드 · 키 · 이름 · 단위 · 범위 · 소수 */
const BASE_FIELDS = [
  { card: 'co2', key: 'CO2_EMISSION_FACTOR', label: '탄소 배출계수 (전력 1MWh당 tCO₂)', unit: 't/MWh', lim: [0, 2], dec: true },
  { card: 'adj', key: 'CLIMATE_CHG', label: '기후환경요금', unit: '원/kWh', lim: [0, 100], dec: true },
  { card: 'adj', key: 'FUEL_ADJ', label: '연료비조정요금', unit: '원/kWh', lim: [-100, 100], dec: true, minus: true },
] as const;
const BASE_CARDS = [
  { card: 'co2', title: '탄소 배출계수' },
  { card: 'adj', title: '한전 요금 가산' },
] as const;
const PLANS: Plan[] = ['1', '2'];
const PARTS = [
  { k: 'mid', label: '중간부하' },
  { k: 'peak', label: '최대부하' },
] as const;
const SEASONS = ['여름', '봄·가을', '겨울'];
const SEASON_MONTHS = ['6~8월', '3~5월 · 9~10월', '11~2월']; // 무료진단은 월마다 이 계절 단가를 쓴다
/** 요금표 편집용 — 숫자는 글자로 들고 있다가 저장할 때 바꾼다. 태양광 시간대 비중은 한전 시간대 구분에서 정해지는 값이라 조회만(고치지 않음) */
type TableDraft = { label: string; shareMid: string[] } & Record<Plan, { base: string; mid: string[]; peak: string[] }>;
const toDraft = (t: TariffTable): TableDraft => {
  const row = (pl: Plan) => ({ base: String(t[pl].base), mid: t[pl].mid.map(String), peak: t[pl].peak.map(String) });
  return { label: t.label, shareMid: t.share.map((x) => String(Math.round(x.mid * 1000) / 10)), '1': row('1'), '2': row('2') };
};
const toTable = (d: TableDraft): TariffTable => {
  const row = (pl: Plan) => ({ base: Number(d[pl].base), mid: d[pl].mid.map(Number), peak: d[pl].peak.map(Number) });
  return {
    label: d.label.trim(),
    share: d.shareMid.map((m) => ({ mid: Number(m) / 100, peak: Math.round((100 - Number(m)) * 10) / 1000 })),
    '1': row('1'),
    '2': row('2'),
  };
};

const FIELD =
  'h-9 w-full rounded-md bg-white/[0.04] ring-1 ring-white/[0.08] px-2.5 text-right text-sm text-white tabular-nums focus:outline-none focus:ring-primary/60';

type Row = { key: number; year: string; price: string };
let seq = 0;
const toRow = (r: TariffYear): Row => ({ key: ++seq, year: String(r.year), price: String(r.price) });
// 숫자와 점 하나만
const numOnly = (v: string, dot: boolean) => {
  const [head = '', ...rest] = v.replace(dot ? /[^0-9.]/g : /[^0-9]/g, '').split('.');
  return rest.length ? `${head}.${rest.join('')}` : head;
};

export default function EnergySettingsPage() {
  const addToast = useToastStore((s) => s.add);
  const { data, isLoading } = useIndustrialTariff();
  const save = useSaveIndustrialTariff();
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);
  // 산정 기준값
  const { data: energy, isLoading: energyLoading } = useEnergySettings();
  const saveEnergy = useSaveEnergySettings();
  const [base, setBase] = useState<Record<string, string>>({});
  const [baseDirty, setBaseDirty] = useState(false);

  useEffect(() => {
    if (data && !dirty) setRows([...data].sort((a, b) => a.year - b.year).map(toRow));
  }, [data, dirty]);
  useEffect(() => {
    if (energy && !baseDirty) setBase(Object.fromEntries(BASE_FIELDS.map((f) => [f.key, energy[f.key] ?? ''])));
  }, [energy, baseDirty]);
  const editBase = (key: string, v: string) => {
    setBase((prev) => ({ ...prev, [key]: v }));
    setBaseDirty(true);
  };
  // 한전 요금표 — 하나만
  const { data: kepco, isLoading: kepcoLoading } = useKepcoTariff();
  const saveKepco = useSaveKepcoTariff();
  const [table, setTable] = useState<TableDraft | null>(null);
  const [tableDirty, setTableDirty] = useState(false);
  useEffect(() => {
    if (kepco && !tableDirty) setTable(toDraft(kepco));
  }, [kepco, tableDirty]);
  const editTable = (fn: (d: TableDraft) => void) => {
    setTable((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    setTableDirty(true);
  };

  const parsed: TariffYear[] = useMemo(() => rows.map((r) => ({ year: Number(r.year), price: Number(r.price) })), [rows]);
  const cg = cagrOf(parsed);

  const edit = (key: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const add = () => {
    const last = parsed.reduce((m, r) => (Number.isFinite(r.year) && r.year > m ? r.year : m), 0);
    setRows((prev) => [...prev, { key: ++seq, year: last ? String(last + 1) : '', price: '' }]);
    setDirty(true);
  };
  const remove = (key: number) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
    setDirty(true);
  };

  const onSave = async () => {
    // 산정 기준값 검사
    for (const f of BASE_FIELDS) {
      const v = (base[f.key] ?? '').trim();
      const n = Number(v);
      if (v === '' || !Number.isFinite(n) || n < f.lim[0] || n > f.lim[1]) return addToast('error', `${f.label}은 ${f.lim[0]}~${f.lim[1].toLocaleString()} 사이로 입력하세요`);
    }
    // 한전 요금표 검사
    if (table) {
      if (!table.label.trim()) return addToast('error', '요금표 이름을 입력하세요');
      for (const pl of PLANS) {
        const b = Number(table[pl].base);
        if (table[pl].base === '' || !(b >= TARIFF_LIM.base[0] && b <= TARIFF_LIM.base[1])) return addToast('error', `기본요금은 ${TARIFF_LIM.base[0]}~${TARIFF_LIM.base[1].toLocaleString()}원/kW 사이로 입력하세요`);
        for (const part of PARTS) if (table[pl][part.k].some((x) => x === '' || !(Number(x) >= TARIFF_LIM.unit[0] && Number(x) <= TARIFF_LIM.unit[1]))) return addToast('error', `전력량요금은 ${TARIFF_LIM.unit[0]}~${TARIFF_LIM.unit[1].toLocaleString()}원/kWh 사이로 입력하세요`);
      }
    }
    const [yLo, yHi] = TARIFF_YEAR_LIM.year;
    const [pLo, pHi] = TARIFF_YEAR_LIM.price;
    if (parsed.some((r) => !Number.isInteger(r.year) || r.year < yLo || r.year > yHi)) return addToast('error', `연도는 ${yLo}~${yHi} 사이로 입력하세요`);
    if (parsed.some((r) => !(r.price >= pLo && r.price <= pHi))) return addToast('error', `단가는 ${pLo}~${F1(pHi)}원/kWh 사이로 입력하세요`);
    if (new Set(parsed.map((r) => r.year)).size !== parsed.length) return addToast('error', '같은 연도가 두 번 있습니다');
    if (parsed.length < 2) return addToast('error', '연도를 두 개 이상 입력하세요');
    try {
      if (dirty) await save.mutateAsync([...parsed].sort((a, b) => a.year - b.year));
      if (baseDirty) await saveEnergy.mutateAsync(Object.fromEntries(BASE_FIELDS.map((f) => [f.key, (base[f.key] ?? '').trim()])));
      if (tableDirty && table) await saveKepco.mutateAsync(toTable(table));
      setDirty(false);
      setBaseDirty(false);
      setTableDirty(false);
      addToast('success', '에너지 설정을 저장했습니다');
    } catch {
      addToast('error', '저장에 실패했습니다');
    }
  };

  const pending = save.isPending || saveEnergy.isPending || saveKepco.isPending;
  const anyDirty = dirty || baseDirty || tableDirty;
  const th = 'px-5 py-3 text-left text-xs font-medium text-slate-400';
  const thT = 'px-5 py-3 text-left align-bottom text-sm font-semibold text-slate-200';
  const sorted = [...rows].sort((a, b) => Number(a.year) - Number(b.year));

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '관리' }, { label: '에너지 설정' }]} />

      {/* 제목 · 오른쪽 저장 — 스크롤해도 상단(헤더 100px 아래)에 따라다닌다 */}
      <div className="sticky top-[100px] z-20 flex flex-wrap items-center justify-between gap-3 py-3 backdrop-blur">
        <h1 className="text-2xl font-bold text-white">에너지 설정</h1>
        <Button onClick={onSave} disabled={!anyDirty || pending || isLoading || energyLoading || kepcoLoading}>
          {pending ? <Loader2 size={14} className="mr-1 animate-spin" /> : anyDirty ? <Save size={14} className="mr-1" /> : <Check size={14} className="mr-1" />}
          {pending ? '저장 중…' : anyDirty ? '저장' : '저장됨'}
        </Button>
      </div>

      <SectionCard title="실적 CAGR">
        <p className="text-2xl font-bold text-white tabular-nums">
          {cg ? `${(cg.rate * 100).toFixed(2)} %/yr` : ''}
        </p>
        <p className="mt-1 text-sm text-slate-400 tabular-nums">
          {cg ? `${cg.from.year}~${cg.to.year}` : ''}
        </p>
      </SectionCard>

      <SectionCard
        title="산업용 평균판매단가"
        noPadding
        actions={
          <Button size="sm" variant="secondary" onClick={add}>
            <Plus size={14} className="mr-1" /> 연도 추가
          </Button>
        }
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-slate-400" size={20} />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className={th}>연도</th>
                <th className={th}>산업용 평균판매단가 (원/kWh)</th>
                <th className={th}>전년 대비</th>
                <th className="w-14" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, k) => {
                const prev = sorted[k - 1];
                // 전년 대비 — 바로 앞 해가 있을 때만
                const chg = prev && Number(r.year) - Number(prev.year) === 1 && Number(prev.price) > 0 && Number(r.price) > 0 ? (Number(r.price) / Number(prev.price) - 1) * 100 : null;
                return (
                  <tr key={r.key} className="border-b border-white/[0.04]">
                    <td className="px-5 py-2.5">
                      <input aria-label="연도" inputMode="numeric" maxLength={4} value={r.year} onChange={(e) => edit(r.key, { year: numOnly(e.target.value, false) })} className={`${FIELD} max-w-[120px]`} />
                    </td>
                    <td className="px-5 py-2.5">
                      <input aria-label="산업용 평균판매단가" inputMode="decimal" maxLength={7} value={r.price} onChange={(e) => edit(r.key, { price: numOnly(e.target.value, true) })} className={`${FIELD} max-w-[200px]`} />
                    </td>
                    <td className="px-5 py-2.5 text-sm text-slate-300 tabular-nums">
                      {chg === null ? '' : `${chg >= 0 ? '+' : ''}${chg.toFixed(1)} %`}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        aria-label={`${r.year} 삭제`}
                        onClick={() => remove(r.key)}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </SectionCard>

      {BASE_CARDS.map((c) => (
        <SectionCard key={c.card} title={c.title}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {BASE_FIELDS.filter((f) => f.card === c.card).map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1.5 block text-sm text-slate-300">{f.label}</span>
                <div className="relative">
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
                    className={`${FIELD} pr-16`}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-slate-500">{f.unit}</span>
                </div>
              </label>
            ))}
          </div>
        </SectionCard>
      ))}

      {/* 한전 요금표 — 산업용(을) 고압A 하나. 경부하(밤)는 태양광 계산에 안 써서 두지 않는다 */}
      {table && (
        <SectionCard title="한전 요금표" noPadding>
          <div className="px-5 pt-4">
            <label className="block max-w-md">
              <span className="mb-1.5 block text-sm text-slate-300">요금표 이름</span>
              <input
                aria-label="요금표 이름"
                maxLength={40}
                value={table.label}
                onChange={(e) =>
                  editTable((d) => {
                    d.label = e.target.value;
                  })
                }
                className={`${FIELD} text-left`}
              />
            </label>
          </div>
          <table className="mt-4 w-full">
            <thead>
              {/* 요금표는 글자를 한 단계 크게 · 밝게 — 계절 아래 해당 월 */}
              <tr className="border-b border-white/[0.06]">
                <th className={thT}>요금제</th>
                <th className={thT}>구분</th>
                {SEASONS.map((sn, si) => (
                  <th key={sn} className={thT}>
                    {sn}
                    <span className="mt-0.5 block text-xs font-normal text-slate-400">{SEASON_MONTHS[si]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLANS.flatMap((pl) => [
                <tr key={`${pl}-base`} className="border-b border-white/[0.04]">
                  <td className="px-5 py-2.5 align-top text-sm font-medium text-white" rowSpan={3}>
                    {PLAN_LABEL[pl]}
                  </td>
                  <td className="px-5 py-2.5 text-sm text-slate-200">기본요금 (원/kW)</td>
                  <td className="px-5 py-2.5" colSpan={3}>
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
                  <tr key={`${pl}-${part.k}`} className="border-b border-white/[0.04]">
                    <td className="px-5 py-2.5 text-sm text-slate-200">{part.label} (원/kWh)</td>
                    {[0, 1, 2].map((si) => (
                      <td key={si} className="px-5 py-2.5">
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
              <tr className="border-b border-white/[0.04]">
                <td className="px-5 py-2.5 align-top text-sm font-medium text-white" rowSpan={2}>
                  태양광 시간대 비중
                </td>
                <td className="px-5 py-2.5 text-sm text-slate-200">중간부하 (%)</td>
                {table.shareMid.map((m, si) => (
                  <td key={si} className="px-5 py-2.5 text-sm text-slate-200 tabular-nums">
                    {m}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-5 py-2.5 text-sm text-slate-200">최대부하 (%)</td>
                {[0, 1, 2].map((si) => {
                  const m = Number(table.shareMid[si]);
                  return (
                    <td key={si} className="px-5 py-2.5 text-sm text-slate-200 tabular-nums">
                      {table.shareMid[si] === '' || !Number.isFinite(m) ? '' : `${Math.round((100 - m) * 10) / 10}`}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </SectionCard>
      )}
    </div>
  );
}
