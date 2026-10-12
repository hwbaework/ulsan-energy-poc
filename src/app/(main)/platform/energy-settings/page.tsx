'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Save } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { SectionCard } from '@/components/features';
import { Button } from '@/components/ui/Button';
import { useToastStore } from '@/stores/useToastStore';
import { useEnergySettings, useKepcoTariff, useSaveEnergySettings, useSaveKepcoTariff } from '@/hooks/common/useSettings';
import { PINE_PER_TCO2, TOE_PER_MWH } from '@/lib/constants/env-benefit';
import { PLAN_LABEL, TARIFF_LIM, shareOfHours, type Plan, type TariffTable } from '@/lib/solar-sim';

// 에너지 설정 — 정부 공표·고시·사업 배정에 따라 바뀌는 값을 한 곳에서 관리한다.
// · 탄소 배출계수 → 무료진단 기본값 · 대시보드 · RE100 · PPA 보고서
// · 환경 편익 환산(화석에너지 대체 TOE · 소나무 식재) → 무료진단 검토서 누적 효과
// · 한전 요금 가산(기후환경요금 · 연료비조정요금) · 한전 요금표 → 무료진단 태양광 대체단가 · 기본요금 절감
//   계산식은 원본 그대로, 값만 여기서 읽는다

/** 기준값 칸 — 카드 · 키 · 이름 · 단위 · 범위 · 소수 */
const BASE_FIELDS = [
  { card: 'co2', key: 'CO2_EMISSION_FACTOR', label: '탄소 배출계수 (전력 1MWh당 tCO₂)', unit: 't/MWh', lim: [0, 2], dec: true },
  { card: 'adj', key: 'CLIMATE_CHG', label: '기후환경요금', unit: '원/kWh', lim: [0, 100], dec: true },
  { card: 'adj', key: 'FUEL_ADJ', label: '연료비조정요금', unit: '원/kWh', lim: [-100, 100], dec: true, minus: true },
  { card: 'co2', key: 'TOE_PER_MWH', label: '화석에너지 대체 (전력 1MWh당 TOE)', unit: 'TOE/MWh', lim: [0, 1], dec: true, def: TOE_PER_MWH },
  { card: 'co2', key: 'PINE_PER_TCO2', label: '소나무 식재 (tCO₂당 그루 · 20년생)', unit: '그루/t', lim: [0, 1000], dec: true, def: PINE_PER_TCO2 },
] as const;
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
type TableDraft = { label: string; hLight: string[]; hPeak: string[] } & Record<Plan, { base: string; light: string[]; mid: string[]; peak: string[] }>;
const toDraft = (t: TariffTable): TableDraft => {
  const row = (pl: Plan) => ({ base: String(t[pl].base), light: t[pl].light.map(String), mid: t[pl].mid.map(String), peak: t[pl].peak.map(String) });
  const h = (v: number) => String(Math.round(v * 24 * 10) / 10);
  return { label: t.label, hLight: t.share.map((x) => h(x.light)), hPeak: t.share.map((x) => h(x.peak)), '1': row('1'), '2': row('2') };
};
const toTable = (d: TableDraft): TariffTable => {
  const row = (pl: Plan) => ({ base: Number(d[pl].base), light: d[pl].light.map(Number), mid: d[pl].mid.map(Number), peak: d[pl].peak.map(Number) });
  return {
    label: d.label.trim(),
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

export default function EnergySettingsPage() {
  const addToast = useToastStore((s) => s.add);
  // 산정 기준값
  const { data: energy, isLoading: energyLoading } = useEnergySettings();
  const saveEnergy = useSaveEnergySettings();
  const [base, setBase] = useState<Record<string, string>>({});
  const [baseDirty, setBaseDirty] = useState(false);

  useEffect(() => {
    if (energy && !baseDirty) setBase(Object.fromEntries(BASE_FIELDS.map((f) => [f.key, energy[f.key] ?? ('def' in f ? String(f.def) : '')])));
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
    try {
      if (baseDirty) await saveEnergy.mutateAsync(Object.fromEntries(BASE_FIELDS.map((f) => [f.key, (base[f.key] ?? '').trim()])));
      if (tableDirty && table) await saveKepco.mutateAsync(toTable(table));
      setBaseDirty(false);
      setTableDirty(false);
      addToast('success', '에너지 설정을 저장했습니다');
    } catch {
      addToast('error', '저장에 실패했습니다');
    }
  };

  const pending = saveEnergy.isPending || saveKepco.isPending;
  const anyDirty = baseDirty || tableDirty;
  const thT = 'px-5 py-3 text-left align-bottom text-sm font-semibold text-slate-200';

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '관리' }, { label: '에너지 설정' }]} />

      {/* 제목 · 오른쪽 저장 — 스크롤해도 상단(헤더 100px 아래)에 따라다닌다 */}
      <div className="sticky top-[100px] z-20 flex flex-wrap items-center justify-between gap-3 py-3 backdrop-blur">
        <h1 className="text-2xl font-bold text-white">에너지 설정</h1>
        <Button onClick={onSave} disabled={!anyDirty || pending || energyLoading || kepcoLoading}>
          {pending ? <Loader2 size={14} className="mr-1 animate-spin" /> : anyDirty ? <Save size={14} className="mr-1" /> : <Check size={14} className="mr-1" />}
          {pending ? '저장 중…' : anyDirty ? '저장' : '저장됨'}
        </Button>
      </div>

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

      {/* 한전 요금표 — 산업용(을) 고압A 하나. 경부하 · 중간부하 · 최대부하 */}
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
                  <td className="px-5 py-2.5 align-top text-sm font-medium text-white" rowSpan={1 + PARTS.length}>
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
              {/* 시간대 비중 — 하루 24시간 중 경부하 · 최대부하 시간을 넣고, 중간부하 = 나머지 */}
              {PARTS.map((part, k) => (
                <tr key={`hours-${part.k}`} className={k < PARTS.length - 1 ? 'border-b border-white/[0.04]' : undefined}>
                  {k === 0 && (
                    <td className="px-5 py-2.5 align-top text-sm font-medium text-white" rowSpan={PARTS.length}>
                      시간대 (하루 24시간)
                    </td>
                  )}
                  <td className="px-5 py-2.5 text-sm text-slate-200">{part.label} (시간)</td>
                  {[0, 1, 2].map((si) => {
                    if (part.k === 'mid') {
                      const rest = 24 - Number(table.hLight[si]) - Number(table.hPeak[si]);
                      return (
                        <td key={si} className="px-5 py-2.5 text-sm text-slate-200 tabular-nums">
                          {Number.isFinite(rest) ? Math.round(rest * 10) / 10 : ''}
                        </td>
                      );
                    }
                    const key = part.k === 'light' ? 'hLight' : 'hPeak';
                    return (
                      <td key={si} className="px-5 py-2.5">
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
