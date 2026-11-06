'use client';

// 관리 › 에너지 설정 — 계수(전력배출계수 · 환경 편익 · 한전 요금 가산 · 배출원 계수). 변경 이력은 두지 않는다.
// 전력배출계수만 적용년도별(CO2_FACTOR_BY_YEAR) — [변경] 팝업에서 연도마다 값 · 출처 등록 · 등록 취소, 그 해 감축량에만 쓴다.
// 배출원 계수는 적용년도 없이 값 하나(GHG_FACTORS) + 적용년도 · 출처(필수, 표에는 숨김) · 연도별 기록(versions, 값이 바뀐 연도만). 화석에너지 대체 · 소나무 · 한전 요금 가산은 바로 입력.
import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { SectionCard } from '@/components/features';
import { TABLE, TABLE_HEAD_ROW, TABLE_TH, TABLE_ROW, TABLE_TD } from '@/components/features/DataList';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { cn } from '@/lib/utils';
import { useEnergySettings, useSaveEnergySettings } from '@/hooks/common/useSettings';
import { useToastStore } from '@/stores/useToastStore';
import { PINE_PER_TCO2, TOE_PER_MWH } from '@/lib/constants/env-benefit';
import { CLIMATE_CHG, FUEL_ADJ } from '@/lib/solar-sim';
import { CATEGORY_SCOPE, versionsOf, withVersions, type GhgCategory, type GhgFactor, type GhgValues } from '@/lib/ghg-factors';
import { GHG_FACTORS_KEY, GHG_SEEN_KEY, YEARS, ghgSeenValue, useGhgFactorList } from '@/lib/ghg-reduction';
import { CO2_BY_YEAR_KEY, parseFactorByYear, yearsOf, type FactorByYear } from '@/lib/constants/emission-factor';

/** 기준값 칸 — 카드 · 키 · 이름 · 단위 · 범위 · 소수 · 적용년도별(전력배출계수만) · 출처 칸(지금은 모두 없음 — 배출원 계수만 출처) */
const BASE_FIELDS = [
  { card: 'co2', key: 'CO2_EMISSION_FACTOR', label: '전력배출계수 (전력 1MWh당 tCO₂)', unit: 't/MWh', lim: [0, 2], def: undefined, minus: false, byYear: true, source: false },
  { card: 'co2', key: 'TOE_PER_MWH', label: '화석에너지 대체 (전력 1MWh당 TOE)', unit: 'TOE/MWh', lim: [0, 1], def: TOE_PER_MWH, minus: false, byYear: false, source: false },
  { card: 'co2', key: 'PINE_PER_TCO2', label: '소나무 식재 (tCO₂당 그루 · 20년생)', unit: '그루/t', lim: [0, 1000], def: PINE_PER_TCO2, minus: false, byYear: false, source: false },
  { card: 'adj', key: 'CLIMATE_CHG', label: '기후환경요금', unit: '원/kWh', lim: [0, 100], def: CLIMATE_CHG, minus: false, byYear: false, source: false },
  { card: 'adj', key: 'FUEL_ADJ', label: '연료비조정요금', unit: '원/kWh', lim: [-100, 100], def: FUEL_ADJ, minus: true, byYear: false, source: false },
] as const;
type BaseField = (typeof BASE_FIELDS)[number];
/** 바로 입력하는 계수 — 전력배출계수(연도별 팝업)를 뺀 나머지. 값은 페이지 상단 [저장]으로 저장한다 */
export const INLINE_FACTORS = BASE_FIELDS.filter((f) => !f.byYear);
/** 바로 입력 칸의 지금 값 — 에너지 설정 값, 없으면 기본값 */
export const inlineValuesOf = (energy: Record<string, string> | undefined): Record<string, string> =>
  Object.fromEntries(INLINE_FACTORS.map((f) => [f.key, energy?.[f.key] ?? (f.def != null ? String(f.def) : '')]));
/** 바로 입력 값 검사 — 범위 밖이면 알림 글자, 맞으면 null */
export const inlineError = (draft: Record<string, string>): string | null => {
  for (const f of INLINE_FACTORS) {
    const v = draft[f.key] ?? '';
    const n = Number(v);
    if (v.trim() === '' || !Number.isFinite(n) || n < f.lim[0] || n > f.lim[1]) return `${f.label}은(는) ${f.lim[0]} ~ ${f.lim[1].toLocaleString()} ${f.unit} 사이로 입력하세요`;
  }
  return null;
};
const BASE_CARDS = [
  { card: 'co2', title: '감축량 계수' },
  { card: 'adj', title: '한전 요금 가산' },
] as const;
/** 값마다 출처 — 처음엔 지금 값의 근거 */
const SOURCE_DEFAULT: Record<string, string> = {
  CO2_EMISSION_FACTOR: '온실가스종합정보센터 국가 전력 배출계수',
  CLIMATE_CHG: '한국전력공사 전기요금표 기후환경요금',
  FUEL_ADJ: '한국전력공사 연료비조정단가',
};
const srcKey = (key: string) => `${key}_SOURCE`;
/** 전력배출계수 출처 — 적용년도마다(JSON 연도 → 출처). 값이 바뀌면 출처도 바뀌니 연도별로 둔다 */
const CO2_SOURCE_BY_YEAR_KEY = 'CO2_FACTOR_SOURCE_BY_YEAR';
const parseSources = (raw: string | undefined, years: string[]): Record<string, string> => {
  try {
    const v = JSON.parse(raw ?? 'null') as unknown;
    // 예전 기본 출처(연도가 들어간 글)는 지금 기본 출처로 — 연도는 적용년도에
    if (v && typeof v === 'object' && !Array.isArray(v))
      return Object.fromEntries(Object.entries(v as Record<string, string>).map(([y, t]) => [y, t.includes('2025-12-17 공표') ? (SOURCE_DEFAULT.CO2_EMISSION_FACTOR ?? t) : t]));
  } catch {
    /* 아래 기본값 */
  }
  return Object.fromEntries(years.map((y) => [y, SOURCE_DEFAULT.CO2_EMISSION_FACTOR ?? '']));
};
/** 계수 출처 — 에너지 설정에 넣은 출처, 없으면 처음 근거 */
export const factorSource = (es: Record<string, string> | undefined, key: string) => es?.[srcKey(key)] || SOURCE_DEFAULT[key] || '';
/** 입력 글자 수 한도 — 출처 50자, 연료 · 에너지 20자, 단위 10자, 숫자 12자(너무 길게 못 쓰게) */
const MAX = { source: 50, fuel: 20, unit: 10, num: 12 } as const;
/** 출처 칸 — 한도까지만 입력, 오른쪽 위에 지금 글자 수 / 한도 */
function SourceInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <>
      <span className="mb-1.5 flex justify-between text-sm text-slate-300">
        <span>출처</span>
        <span className="font-semibold text-white">{`${value.length} / ${MAX.source}`}</span>
      </span>
      <input aria-label="출처" maxLength={MAX.source} value={value} onChange={(e) => onChange(e.target.value.slice(0, MAX.source))} className={FIELD} />
    </>
  );
}
/** 팝업 연도별 계수 목록 — 5줄씩 페이지 */
const LIST_PAGE = 5;
const FIELD =
  'h-9 w-full rounded-md bg-white/[0.04] ring-1 ring-white/[0.08] px-2.5 text-sm text-white tabular-nums focus:outline-none focus:ring-primary/60';
const numOnly = (v: string, minus = false) => {
  const neg = minus && v.trim().startsWith('-');
  const [head = '', ...rest] = v.replace(/[^0-9.]/g, '').split('.');
  return (neg ? '-' : '') + (rest.length ? `${head}.${rest.join('')}` : head);
};

/** 저장 — 공통(이력 없음) */
function useFactorSave() {
  const { data: energy } = useEnergySettings();
  const save = useSaveEnergySettings();
  const addToast = useToastStore((s) => s.add);
  const commit = async (patch: Record<string, string>, item: string, opts: { deleted?: boolean; canceled?: boolean } = {}) => {
    try {
      await save.mutateAsync(patch);
      addToast('success', `${item} ${opts.deleted ? '삭제했습니다' : opts.canceled ? '등록을 취소했습니다' : '저장했습니다'}`);
      return true;
    } catch {
      addToast('error', '저장에 실패했습니다');
      return false;
    }
  };
  return { energy, commit, pending: save.isPending };
}


/** 전력배출계수 · 한전 요금 가산 카드 — 전력배출계수만 [변경](적용년도별 팝업), 나머지는 칸에 바로 입력하고 페이지 상단 [저장]으로 저장 */
export function BaseFactorCards({ draft, onChange }: { draft: Record<string, string>; onChange: (key: string, value: string) => void }) {
  const { energy, commit, pending } = useFactorSave();
  const [co2Open, setCo2Open] = useState(false);
  const co2ByYear = parseFactorByYear(energy?.[CO2_BY_YEAR_KEY], YEARS, energy?.CO2_EMISSION_FACTOR ? Number(energy.CO2_EMISSION_FACTOR) : undefined);
  const latestYear = yearsOf(co2ByYear)[0];
  const co2Sources = parseSources(energy?.[CO2_SOURCE_BY_YEAR_KEY], yearsOf(co2ByYear));
  const co2Field = BASE_FIELDS.find((f) => f.byYear)!;

  return (
    <>
      {BASE_CARDS.map((c) => (
        <SectionCard key={c.card} title={c.title}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {BASE_FIELDS.filter((f) => f.card === c.card).map((f) => (
              <div key={f.key}>
                <span className="mb-1.5 block text-sm text-slate-300">{f.label}</span>
                {f.byYear ? (
                  <>
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 flex-1 items-center justify-end rounded-md bg-white/[0.02] px-2.5 ring-1 ring-white/[0.06]">
                      <span className="text-sm tabular-nums text-white">{latestYear ? String(co2ByYear[latestYear]) : ''}</span>
                      <span className="ml-2 shrink-0 text-sm font-semibold text-white">{f.unit}</span>
                    </div>
                    <Button size="sm" variant="secondary" className="shrink-0 whitespace-nowrap" onClick={() => setCo2Open(true)}>
                      <Pencil size={13} className="mr-1" /> 변경
                    </Button>
                  </div>
                  </>
                ) : (
                  // 바로 입력 — 페이지 상단 [저장]으로 저장, [취소]로 되돌림
                  <div className="relative">
                    <input
                      aria-label={f.label}
                      inputMode="decimal"
                      maxLength={10}
                      value={draft[f.key] ?? ''}
                      onChange={(e) => onChange(f.key, numOnly(e.target.value, f.minus))}
                      className={`${FIELD} pr-20 text-right`}
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-white">{f.unit}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      ))}

      {co2Open && (
        <Co2YearModal
          field={co2Field}
          byYear={co2ByYear}
          sources={co2Sources}
          commit={commit}
          pending={pending}
          onClose={() => setCo2Open(false)}
        />
      )}
    </>
  );
}

/** 전력배출계수 — 적용년도별. 한 줄에 [적용년도 | 값 | 출처(필수) | 등록], 아래 연도별 목록(값 · 출처, 줄마다 등록 취소) · 변경 이력(출처 칸) */
function Co2YearModal({
  field,
  byYear,
  sources,
  commit,
  pending,
  onClose,
}: {
  field: BaseField;
  byYear: FactorByYear;
  sources: Record<string, string>;
  commit: ReturnType<typeof useFactorSave>['commit'];
  pending: boolean;
  onClose: () => void;
}) {
  // 적용년도는 직접 입력 — 네 자리 연도면 몇 년이든(위아래 한도 없음). 처음엔 최근 등록 연도
  const firstYear = yearsOf(byYear)[0] ?? YEARS[0] ?? '';
  const [year, setYear] = useState(firstYear);
  const [val, setVal] = useState(byYear[firstYear] != null ? String(byYear[firstYear]) : '');
  const [src, setSrc] = useState(sources[firstYear] ?? '');
  const [cancelYear, setCancelYear] = useState<string | null>(null);
  const registered = yearsOf(byYear);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(registered.length / LIST_PAGE));
  const pageNow = Math.min(page, pages - 1);
  const n = Number(val);
  const yearOk = /^\d{4}$/.test(year);
  // 출처는 반드시 — 값이나 출처 둘 중 하나라도 바뀌면 등록
  const valid =
    yearOk &&
    val.trim() !== '' &&
    src.trim() !== '' &&
    Number.isFinite(n) &&
    n >= field.lim[0] &&
    n <= field.lim[1] &&
    (byYear[year] !== n || (sources[year] ?? '') !== src.trim());
  // 저장 — 연도별 값 + 연도 구분 없는 화면용 최근 연도 값(CO2_EMISSION_FACTOR)
  const patchOf = (next: FactorByYear, nextSources: Record<string, string>) => {
    const latest = yearsOf(next)[0];
    return {
      [CO2_BY_YEAR_KEY]: JSON.stringify(next),
      [CO2_SOURCE_BY_YEAR_KEY]: JSON.stringify(nextSources),
      ...(latest ? { [field.key]: String(next[latest]), [srcKey(field.key)]: nextSources[latest] ?? '' } : {}),
    };
  };
  const pick = (y: string) => {
    setYear(y);
    if (y.length === 4 && byYear[y] != null) {
      setVal(String(byYear[y]));
      setSrc(sources[y] ?? '');
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="전력배출계수 변경"
      size="lg"
      footer={
        <Button variant="cancel" size="sm" onClick={onClose}>
          닫기
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">적용년도 (년)</span>
            <input
              aria-label="적용년도"
              inputMode="numeric"
              maxLength={4}
              value={year}
              onChange={(e) => pick(e.target.value.replace(/[^0-9]/g, ''))}
              className={FIELD}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">{`값 (${field.unit})`}</span>
            <input aria-label="값" inputMode="decimal" maxLength={10} value={val} onChange={(e) => setVal(numOnly(e.target.value))} className={FIELD} />
          </label>
          <label className="col-span-2 block">
            <SourceInput value={src} onChange={setSrc} />
          </label>
        </div>
        {/* [등록] — 입력 줄 아래 따로(레이아웃 안 깨지게) */}
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!valid || pending}
            onClick={() =>
              void commit(patchOf({ ...byYear, [year]: n }, { ...sources, [year]: src.trim() }), field.label)
            }
          >
            등록
          </Button>
        </div>

        <p className="pt-2 text-sm font-medium text-white">연도별 계수</p>
        <table className={cn(TABLE, 'tabular-nums')}>
          <thead>
            <tr className={TABLE_HEAD_ROW}>
              <th className={TABLE_TH}>적용년도 (년)</th>
              <th className={TABLE_TH}>{`값 (${field.unit})`}</th>
              <th className={TABLE_TH}>출처</th>
              <th className={TABLE_TH} />
            </tr>
          </thead>
          <tbody>
            {registered.slice(pageNow * LIST_PAGE, pageNow * LIST_PAGE + LIST_PAGE).map((y) => (
              <tr key={y} className={TABLE_ROW}>
                <td className={cn(TABLE_TD, 'font-semibold text-white')}>{y}</td>
                <td className={cn(TABLE_TD, 'text-white')}>{byYear[y]}</td>
                <td className={cn(TABLE_TD, 'max-w-[320px] truncate')} title={sources[y]}>
                  {sources[y] || '-'}
                </td>
                <td className={cn(TABLE_TD, 'w-[120px] text-right')}>
                  {/* 마지막 한 해는 남긴다 — 계산할 계수가 없어진다 */}
                  <Button
                    size="sm"
                    variant="secondary"
                    className="whitespace-nowrap"
                    disabled={pending || registered.length <= 1}
                    onClick={() => setCancelYear(y)}
                  >
                    <Trash2 size={13} className="mr-1" /> 등록 취소
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {registered.length > LIST_PAGE && (
          <Pagination page={pageNow} totalPages={pages} totalElements={registered.length} onPageChange={setPage} className="mt-3" />
        )}

      </div>

      <ConfirmDialog
        open={cancelYear != null}
        onClose={() => setCancelYear(null)}
        onConfirm={() => {
          const y = cancelYear!;
          setCancelYear(null);
          const next = { ...byYear };
          delete next[y];
          const nextSources = { ...sources };
          delete nextSources[y];
          void commit(patchOf(next, nextSources), field.label, { canceled: true });
        }}
        title="등록 취소"
        message={`${cancelYear}년 전력배출계수 등록을 취소합니다.`}
        confirmLabel="등록 취소"
        variant="danger"
      />
    </Modal>
  );
}

/** 배출원 계수 — 표는 지금 값 하나(적용년도 없음), 단위는 머리글에(칸은 숫자만, 값 없으면 '-').
 *  표 두 개: ① 배출원 계수(열량 TJ 당 — 고정연소 · 이동연소 · 외부 열(스팀)) ② 전기(전력량 MWh 당 — 소비기준 · 발전기준), 둘 다 [계수 추가].
 *  줄마다 [변경] 팝업: 배출활동 · 연료 · 에너지 · 단위 + 순발열량 · CO₂ · CH₄ · N₂O 고쳐 [저장], 아래 변경 이력(바뀐 값만), 왼쪽 아래 [삭제]. 출처 칸 없음 */
/** 숫자 칸 — 배출량 계산에 쓰는 순발열량(지침 별표 12 비고 2) + 배출계수 셋. 총발열량은 에너지사용량 집계용이라 두지 않는다 */
const GHG_NUMS = ['ncv', 'cef', 'co2', 'ch4', 'n2o'] as const;
type GhgNum = (typeof GHG_NUMS)[number];
const NUM_LABEL: Record<GhgNum, string> = { ncv: '순발열량', cef: '배출계수', co2: 'CO₂', ch4: 'CH₄', n2o: 'N₂O' };
type NumDraft = Record<GhgNum, string>;
const EMPTY_NUMS: NumDraft = { ncv: '', cef: '', co2: '', ch4: '', n2o: '' };
const isHeat = (k: GhgNum) => k === 'ncv';
const isElec = (c: string) => c === '외부 전기';
/** 화면에 보이는 배출활동 — 세 가지(고정연소 · 이동연소 · 외부 전기 · 열). 저장값은 단위 · 계산이 달라 외부 전기 / 외부 열(스팀)로 나눠 둔다 */
const labelOf = (c: string) => (c === '외부 전기' || c === '외부 열(스팀)' ? '외부 전기 · 열' : c);
/** 머리글 — 단위는 머리글에만(칸은 숫자만). 연료 · 열 표는 kg/TJ, 전기 표는 MWh 당 */
const FUEL_HEAD: Record<GhgNum, string> = { ncv: '순발열량 (MJ)', cef: '배출계수 (tC/TJ)', co2: '이산화탄소 (kg/TJ)', ch4: '메탄 (kg/TJ)', n2o: '아산화질소 (kg/TJ)' };
const ELEC_NUMS = ['ncv', 'cef', 'co2', 'ch4', 'n2o'] as const;
const ELEC_HEAD: Record<(typeof ELEC_NUMS)[number], string> = { ncv: '순발열량 (MJ)', cef: '배출계수 (tC/TJ)', co2: '이산화탄소 (t/MWh)', ch4: '메탄 (kg/MWh)', n2o: '아산화질소 (kg/MWh)' };
/** 발열량이 없는 줄 — 스팀(열을 사서 씀, 1000 은 GJ→MJ 계산에만). 전기는 지침 별표 12 의 순발열량(소비 9.6 · 발전 8.9)을 보여 준다 */
const noHeat = (c: string) => c === '외부 열(스팀)';
/** 배출계수(tC/TJ)는 고정연소만. CO₂ 는 모든 줄 직접 입력(계산식 없음) */
const hasCef = (c: string) => c === '고정연소';
/** 그 계수에서 보이는 칸 */
const numsFor = (c: string) => GHG_NUMS.filter((k) => !(noHeat(c) && isHeat(k)) && (k !== 'cef' || hasCef(c)));
const unitOf = (c: string, k: GhgNum) =>
  isHeat(k) ? 'MJ' : k === 'cef' ? 'tC/TJ' : isElec(c) ? (k === 'co2' ? 't/MWh' : 'kg/MWh') : 'kg/TJ';
/** 팝업 머리글 · 입력 칸 이름 — 그 계수의 단위까지 */
const headOf = (c: string, k: GhgNum) => `${NUM_LABEL[k]} (${unitOf(c, k)})`;
const nameOf = (x: { category: string; fuel: string }) => `${labelOf(x.category)} ${x.fuel}`;
const numsOk = (d: NumDraft, c: string) => numsFor(c).every((k) => d[k].trim() !== '' && Number.isFinite(Number(d[k])));
const toValues = (d: NumDraft, c: string): GhgValues => ({
  ncv: noHeat(c) ? Number(d.ncv) || 1000 : Number(d.ncv),
  ...(hasCef(c) ? { cef: Number(d.cef) } : {}),
  co2: Number(d.co2),
  ch4: Number(d.ch4),
  n2o: Number(d.n2o),
});
const toNums = (v: GhgValues): NumDraft => ({ ncv: String(v.ncv), cef: v.cef != null ? String(v.cef) : '', co2: String(v.co2), ch4: String(v.ch4), n2o: String(v.n2o) });
/** 값 — 공표값 소수 그대로(전기 0.4149 · 0.0075 처럼 넷째 자리까지, 기본 toLocaleString 은 셋째 자리에서 잘림). 없으면 '-'(빈칸 두지 않고 표 모양 고정) */
const shown = (v: number | undefined) => (v != null ? v.toLocaleString('ko-KR', { maximumFractionDigits: 4 }) : '-');

/** 숫자 칸 — 순발열량 · (고정연소) 탄소 배출계수 · CO₂ · CH₄ · N₂O. 고정연소 CO₂ 는 탄소 배출계수에서 계산한 값을 보기만 */
function NumFields({ category, value, onChange }: { category: string; value: NumDraft; onChange: (v: NumDraft) => void }) {
  return (
    <>
      {GHG_NUMS.map((k) =>
        // 이 줄에 없는 값(전기 · 스팀의 배출계수 등)은 칸은 두고 '-' — 위 4칸 · 아래 4칸 모양 고정
        !numsFor(category).includes(k) ? (
          <div key={k} className="block min-w-0 flex-1">
            <span className="mb-1.5 block whitespace-nowrap text-sm text-slate-300">{headOf(category, k)}</span>
            <div className={cn(FIELD, 'flex items-center font-semibold')}>-</div>
          </div>
        ) : (
        <label key={k} className="block min-w-0 flex-1">
          <span className="mb-1.5 block whitespace-nowrap text-sm text-slate-300">{headOf(category, k)}</span>
          <input
            aria-label={NUM_LABEL[k]}
            inputMode="decimal"
            maxLength={MAX.num}
            value={value[k]}
            onChange={(e) => onChange({ ...value, [k]: numOnly(e.target.value) })}
            className={FIELD}
          />
        </label>
        ),
      )}
    </>
  );
}

/** 계수 정보 — 배출활동 · 연료 · 에너지 · 단위 (Scope 는 배출활동에서) */
type GhgInfo = Pick<GhgFactor, 'scope' | 'category' | 'fuel' | 'unit'>;
const infoOf = (f: GhgInfo): GhgInfo => ({ scope: f.scope, category: f.category, fuel: f.fuel, unit: f.unit });
const trimInfo = (f: GhgInfo): GhgInfo => ({ scope: f.scope, category: f.category.trim(), fuel: f.fuel.trim(), unit: f.unit.trim() });
const INFO_LABEL: Record<'category' | 'fuel' | 'unit', string> = { category: '배출활동', fuel: '연료 · 에너지', unit: '단위' };
/** 바뀐 정보만 한 줄 — "배출활동 고정연소 → 이동연소" (없으면 빈 글자) */
const infoChange = (a: GhgInfo, b: GhgInfo) => {
  const t = trimInfo(b);
  return (Object.keys(INFO_LABEL) as (keyof typeof INFO_LABEL)[])
    .filter((k) => a[k] !== t[k])
    .map((k) => (k === 'category' ? `${INFO_LABEL[k]} ${labelOf(a[k])} → ${labelOf(t[k])}` : `${INFO_LABEL[k]} ${a[k]} → ${t[k]}`))
    .join(', ');
};
/** 배출활동 선택지 — 연료 표의 계수 추가 · 연료 줄은 고정연소 / 이동연소, 스팀 · 전기 줄은 자기 배출활동 하나(표가 바뀌지 않게) */
const FUEL_CATS = ['고정연소', '이동연소']; // 지침 별표 3 의 1 · 2 — 이동연소는 배출계수(tC/TJ) 없음(-)
const optionsFor = (category: string) =>
  FUEL_CATS.includes(category) ? FUEL_CATS : category === '외부 열(스팀)' || isElec(category) ? [category] : [category, ...FUEL_CATS];
function InfoFields({ value, options, onChange }: { value: GhgInfo; options: string[]; onChange: (v: GhgInfo) => void }) {
  return (
    <>
      <label className="block">
        <span className="mb-1.5 block text-sm text-slate-300">배출활동</span>
        <select
          aria-label="배출활동"
          value={value.category}
          onChange={(e) => onChange({ ...value, category: e.target.value, scope: CATEGORY_SCOPE[e.target.value as GhgCategory] ?? value.scope })}
          className={`${FIELD} [color-scheme:dark]`}
        >
          {options.map((c) => (
            <option key={c} value={c}>
              {labelOf(c)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-slate-300">연료 · 에너지</span>
        <input aria-label="연료 · 에너지" maxLength={MAX.fuel} value={value.fuel} onChange={(e) => onChange({ ...value, fuel: e.target.value })} className={FIELD} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-slate-300">단위</span>
        <input aria-label="단위" maxLength={MAX.unit} value={value.unit} onChange={(e) => onChange({ ...value, unit: e.target.value })} className={FIELD} />
      </label>
    </>
  );
}

/** 적용년도 · 출처 입력 — 적용년도는 언제 공표된 값인지(숫자만, 필수), 출처는 어디 값인지(내용만, 필수). 예: 2022 · TIPS 연료연소 부문 배출계수 */
const asOfOk = (v: string) => /^\d{4}$/.test(v);
const asOfInput = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 4);
function BasisField({ asOf, onAsOf, value, onChange }: { asOf: string; onAsOf: (v: string) => void; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <label className="block">
        <span className="mb-1.5 block text-sm text-slate-300">적용년도 (년)</span>
        <input aria-label="적용년도" inputMode="numeric" maxLength={4} value={asOf} onChange={(e) => onAsOf(asOfInput(e.target.value))} className={FIELD} />
      </label>
      <label className="col-span-1 block sm:col-span-3">
        <SourceInput value={value} onChange={onChange} />
      </label>
    </div>
  );
}

/** 머리글 두 줄 — 이름 / (단위). 단위 길이(kg/TJ · kg/MWh)가 달라도 두 표의 머리글 높이 · 칸 자리가 같게 */
function HeadText({ text }: { text: string }) {
  const i = text.indexOf(' (');
  if (i < 0) return <>{text}</>;
  return (
    <>
      <span className="block">{text.slice(0, i)}</span>
      <span className="block">{text.slice(i + 1)}</span>
    </>
  );
}
/** 두 표 칸 너비 — 위 · 아래 표가 같은 자리에 오도록 똑같이(배출활동 | 연료 · 에너지 | 단위 | 순발열량 | 배출계수 | CO₂ | CH₄ | N₂O | 변경) */
const COL_WIDTHS = ['11%', '15%', '7%', '10%', '11%', '12%', '10%', '12%', '12%'];
/** 보기만(배출계수 관리)일 때는 [변경] 칸을 빼고 나머지 칸을 그 비율대로 */
function FactorCols({ readOnly }: { readOnly?: boolean }) {
  return (
    <colgroup>
      {(readOnly ? COL_WIDTHS.slice(0, -1) : COL_WIDTHS).map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  );
}

/** 배출원 계수 두 표 — 관리 › 에너지 설정(고침)과 온실가스 › 배출계수 관리(readOnly, 보기만)가 같은 표를 쓴다 */
export function GhgFactorSettings({ readOnly = false }: { readOnly?: boolean } = {}) {
  const factors = useGhgFactorList();
  const { commit, pending } = useFactorSave();
  const [editId, setEditId] = useState<string | null>(null);
  // 등록 · 등록 취소 뒤 팝업 칸을 저장된 최근 값으로 다시 채우려고 저장할 때마다 올린다(팝업 key)
  const [saveNo, setSaveNo] = useState(0);
  // 계수 추가 — 연료 · 열 표면 고정연소 / 이동연소, 전기 표면 외부 전기
  const [adding, setAdding] = useState<string[] | null>(null);
  const editing = factors.find((f) => f.id === editId);
  /** 표 한 벌 저장 — 배출원 계수는 이력 없이 출처만(공표가 바뀌면 값과 출처를 같이 고친다) */
  const saveList = (next: GhgFactor[], f: GhgFactor, deleted = false) =>
    commit({ [GHG_FACTORS_KEY]: JSON.stringify(next, (k, v: unknown) => (k === 'years' ? undefined : v)), [GHG_SEEN_KEY]: ghgSeenValue() }, `배출원 계수 · ${nameOf(f)}`, { deleted });
  const changeBtn = (f: GhgFactor) =>
    readOnly ? null : (
    <td className={cn(TABLE_TD, 'w-[96px] whitespace-nowrap px-3 text-right')}>
      <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => setEditId(f.id)}>
        <Pencil size={13} className="mr-1" /> 변경
      </Button>
    </td>
  );
  const numCell = (f: GhgFactor, k: GhgNum) => (
    <td key={k} className={cn(TABLE_TD, 'px-3 text-right')}>
      {numsFor(f.category).includes(k) ? shown(f[k]) : '-'}
    </td>
  );

  return (
    <>
      {/* ① 연료 · 열 — 열량(TJ)당. 고정연소 · 이동연소 · 외부 열(스팀), 단위는 머리글에(kg/TJ), 칸은 숫자만. 추가는 여기만 */}
      <SectionCard
        title="배출원 계수"
        actions={
          !readOnly && (
            <Button size="sm" variant="secondary" onClick={() => setAdding(FUEL_CATS)}>
              <Plus size={14} className="mr-1" /> 계수 추가
            </Button>
          )
        }
        noPadding
      >
        <div className="overflow-x-auto">
          <table className={cn(TABLE, 'min-w-[880px] table-fixed tabular-nums')}>
            <FactorCols readOnly={readOnly} />
            <thead>
              <tr className={TABLE_HEAD_ROW}>
                <th className={cn(TABLE_TH, 'px-3 align-bottom')}>배출활동</th>
                <th className={cn(TABLE_TH, 'px-3 align-bottom')}>연료 · 에너지</th>
                <th className={cn(TABLE_TH, 'px-3 align-bottom')}>단위</th>
                {GHG_NUMS.map((k) => (
                  <th key={k} className={cn(TABLE_TH, 'px-3 text-right align-bottom')}>
                    <HeadText text={FUEL_HEAD[k]} />
                  </th>
                ))}
                {!readOnly && <th className={cn(TABLE_TH, 'px-3 align-bottom')} />}
              </tr>
            </thead>
            <tbody>
              {factors
                .filter((f) => !isElec(f.category))
                .map((f) => (
                  <tr key={f.id} className={TABLE_ROW}>
                    <td className={cn(TABLE_TD, 'px-3')}>{labelOf(f.category)}</td>
                    <td className={cn(TABLE_TD, 'px-3 text-white')}>{f.fuel}</td>
                    <td className={cn(TABLE_TD, 'px-3')}>{f.unit}</td>
                    {GHG_NUMS.map((k) => numCell(f, k))}
                    {changeBtn(f)}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ② 전기 — 전력량(MWh)당. 소비기준 · 발전기준, 단위는 머리글에(t/MWh · kg/MWh), 추가 없이 [변경]만 */}
      <SectionCard
        title="전기 배출계수"
        actions={
          !readOnly && (
            <Button size="sm" variant="secondary" onClick={() => setAdding(['외부 전기'])}>
              <Plus size={14} className="mr-1" /> 계수 추가
            </Button>
          )
        }
        noPadding
      >
        <div className="overflow-x-auto">
          <table className={cn(TABLE, 'min-w-[880px] table-fixed tabular-nums')}>
            <FactorCols readOnly={readOnly} />
            <thead>
              <tr className={TABLE_HEAD_ROW}>
                <th className={cn(TABLE_TH, 'px-3 align-bottom')}>배출활동</th>
                <th className={cn(TABLE_TH, 'px-3 align-bottom')}>연료 · 에너지</th>
                <th className={cn(TABLE_TH, 'px-3 align-bottom')}>단위</th>
                {ELEC_NUMS.map((k) => (
                  <th key={k} className={cn(TABLE_TH, 'px-3 text-right align-bottom')}>
                    <HeadText text={ELEC_HEAD[k]} />
                  </th>
                ))}
                {!readOnly && <th className={cn(TABLE_TH, 'px-3 align-bottom')} />}
              </tr>
            </thead>
            <tbody>
              {factors
                .filter((f) => isElec(f.category))
                .map((f) => (
                  <tr key={f.id} className={TABLE_ROW}>
                    <td className={cn(TABLE_TD, 'px-3')}>{labelOf(f.category)}</td>
                    <td className={cn(TABLE_TD, 'px-3 text-white')}>{f.fuel}</td>
                    <td className={cn(TABLE_TD, 'px-3')}>{f.unit}</td>
                    {ELEC_NUMS.map((k) => numCell(f, k))}
                    {changeBtn(f)}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {editing && (
        <GhgFactorModal
          key={`${editing.id}:${saveNo}`}
          factor={editing}
          pending={pending}
          onSave={async (next, keepOpen) => {
            const ok = await saveList(factors.map((f) => (f.id === editing.id ? next : f)), next);
            // 저장(새 값 다시 읽기)이 끝난 뒤 팝업 칸을 저장된 최근 값으로
            if (ok) setSaveNo((n) => n + 1);
            if (ok && !keepOpen) setEditId(null);
          }}
          onDelete={async () => {
            if (await saveList(factors.filter((f) => f.id !== editing.id), editing, true)) setEditId(null);
          }}
          onClose={() => setEditId(null)}
        />
      )}

      {adding && (
        <GhgAddModal
          options={adding}
          pending={pending}
          onSave={async (f) => {
            if (await saveList([...factors, f], f)) setAdding(null);
          }}
          onClose={() => setAdding(null)}
        />
      )}
    </>
  );
}

/** [변경] — 계수 하나. 전력배출계수 [변경] 팝업과 기능을 똑같이: 입력 + [등록] → 아래 기준별 계수(줄마다 등록 취소, 마지막 하나 유지), 아래 [닫기].
 *  [등록] = 배출활동 · 연료 · 에너지 · 단위 + 값 + 기준(연도) · 출처를 그 기준 연도로 기록(같은 연도면 고침, 새 연도면 추가). 계수 자체는 왼쪽 아래 [삭제] */
function GhgFactorModal({
  factor,
  pending,
  onSave,
  onDelete,
  onClose,
}: {
  factor: GhgFactor;
  pending: boolean;
  onSave: (next: GhgFactor, keepOpen?: boolean) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const versions = versionsOf(factor);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(versions.length / LIST_PAGE));
  const pageNow = Math.min(page, pages - 1);
  const [info, setInfo] = useState<GhgInfo>(infoOf(factor));
  const [nums, setNums] = useState<NumDraft>(toNums(factor));
  const [basis, setBasis] = useState(factor.basis);
  const [asOf, setAsOf] = useState(factor.asOf ?? '');
  const [delAsk, setDelAsk] = useState(false);
  const [cancelAsOf, setCancelAsOf] = useState<string | null>(null);
  const category = info.category.trim() || factor.category;
  const fields = numsFor(category);
  const values = toValues(nums, category);
  const same = versions.find((v) => v.asOf === asOf);
  // [등록] — 정보 · 값 · 기준 · 출처(새 기준이거나 바뀐 게 있을 때만)
  const changed = infoChange(infoOf(factor), info) !== '' || !same || fields.some((k) => same[k] !== values[k]) || basis.trim() !== same.basis;
  const canRegister =
    !!info.category.trim() && !!info.fuel.trim() && !!info.unit.trim() && !!basis.trim() && asOfOk(asOf) && numsOk(nums, category) && changed;
  // 기준 연도를 넣으면 그 기준 값으로 채운다
  const pickAsOf = (y: string) => {
    setAsOf(y);
    const v = versions.find((x) => x.asOf === y);
    if (v) {
      setNums(toNums(v));
      setBasis(v.basis);
      // 그 연도 기록의 배출활동 · 연료 · 에너지 · 단위로도 채운다
      setInfo((i) => ({ ...i, category: v.category ?? factor.category, fuel: v.fuel ?? factor.fuel, unit: v.unit ?? factor.unit }));
    }
  };
  // 목록도 칸은 다 두고 없는 값은 '-'
  const verFields = GHG_NUMS;

  return (
    <Modal
      open
      onClose={onClose}
      title={isElec(factor.category) ? '전기 배출계수 변경' : '배출원 계수 변경'}
      size="2xl"
      footer={
        <>
          <Button variant="danger" size="sm" className="mr-auto" disabled={pending} onClick={() => setDelAsk(true)}>
            <Trash2 size={14} className="mr-1" /> 삭제
          </Button>
          <Button variant="cancel" size="sm" onClick={onClose}>
            닫기
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* 위 4칸(배출활동 · 연료 · 에너지 · 단위 · 순발열량) · 아래 4칸(배출계수 · CO₂ · CH₄ · N₂O) */}
        <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
          <InfoFields value={info} options={optionsFor(factor.category)} onChange={setInfo} />
          <NumFields category={category} value={nums} onChange={setNums} />
        </div>
        <BasisField asOf={asOf} onAsOf={pickAsOf} value={basis} onChange={setBasis} />
        {/* [등록] — 입력 줄 아래 따로(레이아웃 안 깨지게) */}
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!canRegister || pending}
            onClick={() =>
              onSave(
                withVersions({ ...factor, ...trimInfo(info) }, [
                  ...versions.filter((v) => v.asOf !== asOf),
                  { ...trimInfo(info), ...values, asOf, basis: basis.trim() },
                ]),
                true,
              )
            }
          >
            등록
          </Button>
        </div>

        <p className="pt-2 text-sm font-medium text-white">연도별 계수</p>
        <div className="overflow-x-auto">
          <table className={cn(TABLE, 'min-w-[1100px] tabular-nums [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap')}>
            <thead>
              <tr className={TABLE_HEAD_ROW}>
                <th className={cn(TABLE_TH, 'px-3')}>적용년도 (년)</th>
                <th className={cn(TABLE_TH, 'px-3')}>배출활동</th>
                <th className={cn(TABLE_TH, 'px-3')}>연료 · 에너지</th>
                <th className={cn(TABLE_TH, 'px-3')}>단위</th>
                {verFields.map((k) => (
                  <th key={k} className={cn(TABLE_TH, 'px-3')}>
                    {headOf(factor.category, k)}
                  </th>
                ))}
                <th className={cn(TABLE_TH, 'px-3')}>출처</th>
                <th className={cn(TABLE_TH, 'px-3')} />
              </tr>
            </thead>
            <tbody>
              {versions.slice(pageNow * LIST_PAGE, pageNow * LIST_PAGE + LIST_PAGE).map((v) => (
                <tr key={v.asOf} className={TABLE_ROW}>
                  <td className={cn(TABLE_TD, 'px-3 font-semibold text-white')}>{v.asOf || '-'}</td>
                  <td className={cn(TABLE_TD, 'px-3')}>{labelOf(v.category ?? factor.category)}</td>
                  <td className={cn(TABLE_TD, 'px-3 text-white')}>{v.fuel ?? factor.fuel}</td>
                  <td className={cn(TABLE_TD, 'px-3')}>{v.unit ?? factor.unit}</td>
                  {verFields.map((k) => (
                    <td key={k} className={cn(TABLE_TD, 'px-3 text-white')}>
                      {numsFor(v.category ?? factor.category).includes(k) ? shown(v[k]) : '-'}
                    </td>
                  ))}
                  <td className={cn(TABLE_TD, 'max-w-[280px] truncate px-3')} title={v.basis}>
                    {v.basis || '-'}
                  </td>
                  <td className={cn(TABLE_TD, 'w-[120px] px-3 text-right')}>
                    {/* 마지막 하나는 남긴다 — 표에 보일 값이 없어진다 */}
                    <Button size="sm" variant="secondary" className="whitespace-nowrap" disabled={pending || versions.length <= 1} onClick={() => setCancelAsOf(v.asOf)}>
                      <Trash2 size={13} className="mr-1" /> 등록 취소
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {versions.length > LIST_PAGE && (
          <Pagination page={pageNow} totalPages={pages} totalElements={versions.length} onPageChange={setPage} className="mt-3" />
        )}
      </div>

      <ConfirmDialog
        open={cancelAsOf != null}
        onClose={() => setCancelAsOf(null)}
        onConfirm={() => {
          const y = cancelAsOf!;
          setCancelAsOf(null);
          onSave(withVersions(factor, versions.filter((v) => v.asOf !== y)), true);
        }}
        title="등록 취소"
        message={`${cancelAsOf}년 ${nameOf(factor)} 등록을 취소합니다.`}
        confirmLabel="등록 취소"
        variant="danger"
      />
      <ConfirmDialog
        open={delAsk}
        onClose={() => setDelAsk(false)}
        onConfirm={() => {
          setDelAsk(false);
          onDelete();
        }}
        title={isElec(factor.category) ? '전기 배출계수 삭제' : '배출원 계수 삭제'}
        message={`${nameOf(factor)}을(를) 삭제합니다.`}
        confirmLabel="삭제"
        variant="danger"
      />
    </Modal>
  );
}

/** [계수 추가] — 배출활동 · 연료 · 에너지 · 단위 + 값 */
function GhgAddModal({ options, pending, onSave, onClose }: { options: string[]; pending: boolean; onSave: (f: GhgFactor) => void; onClose: () => void }) {
  const first = options[0] ?? '고정연소';
  const [info, setInfo] = useState<GhgInfo>({ scope: CATEGORY_SCOPE[first as GhgCategory] ?? 1, category: first, fuel: '', unit: isElec(first) ? 'kWh' : '' });
  const [nums, setNums] = useState<NumDraft>(EMPTY_NUMS);
  const [basis, setBasis] = useState('');
  const [asOf, setAsOf] = useState('');
  const valid = !!info.category.trim() && !!info.fuel.trim() && !!info.unit.trim() && !!basis.trim() && asOfOk(asOf) && numsOk(nums, info.category);

  return (
    <Modal
      open
      onClose={onClose}
      title={isElec(first) ? '전기 배출계수 추가' : '배출원 계수 추가'}
      size="2xl"
      footer={
        <>
          <Button variant="cancel" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button size="sm" disabled={!valid || pending} onClick={() => onSave({ id: `u${Date.now()}`, ...trimInfo(info), basis: basis.trim(), asOf, ...toValues(nums, info.category), versions: [{ ...toValues(nums, info.category), asOf, basis: basis.trim() }] })}>
            저장
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
          <InfoFields value={info} options={options} onChange={setInfo} />
          <NumFields category={info.category} value={nums} onChange={setNums} />
        </div>
        <BasisField asOf={asOf} onAsOf={setAsOf} value={basis} onChange={setBasis} />
      </div>
    </Modal>
  );
}
