'use client';

// 관리 › 에너지 설정 — 계수(전력배출계수 · 환경 편익 · 한전 요금 가산 · 배출원 계수).
// 화면의 값은 보기만. 바꿀 때는 계수마다 [변경] 팝업에서 새 값을 넣고 그 자리에서 저장 → 그 계수 이력에 한 줄(출처 칸 없음).
// 이력 · 출처는 에너지 설정(ENERGY_HISTORY · `${key}_SOURCE` · 배출원 계수 basis)에 둔다.
// 전력배출계수만 적용년도별(CO2_FACTOR_BY_YEAR) — 연도마다 등록 · 등록 취소, 그 해 감축량에만 쓴다. 삭제 · 등록 취소도 이력에 남긴다.
import { useState } from 'react';
import { History, Pencil, Plus, Trash2 } from 'lucide-react';
import { SectionCard } from '@/components/features';
import { TABLE, TABLE_HEAD_ROW, TABLE_TH, TABLE_ROW, TABLE_TD } from '@/components/features/DataList';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { cn } from '@/lib/utils';
import { useEnergySettings, useSaveEnergySettings } from '@/hooks/common/useSettings';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { PINE_PER_TCO2, TOE_PER_MWH } from '@/lib/constants/env-benefit';
import { GHG_FACTORS, type GhgFactor } from '@/lib/ghg-factors';
import { GHG_FACTORS_KEY, YEARS, useGhgFactorList } from '@/lib/ghg-reduction';
import { CO2_BY_YEAR_KEY, parseFactorByYear, yearsOf, type FactorByYear } from '@/lib/constants/emission-factor';

/** 기준값 칸 — 카드 · 키 · 이름 · 단위 · 범위 · 소수 · 적용년도별(전력배출계수만) · 출처 칸(지금은 모두 없음 — 배출원 계수만 출처) */
const BASE_FIELDS = [
  { card: 'co2', key: 'CO2_EMISSION_FACTOR', label: '전력배출계수 (전력 1MWh당 tCO₂)', unit: 't/MWh', lim: [0, 2], def: undefined, minus: false, byYear: true, source: false },
  { card: 'co2', key: 'TOE_PER_MWH', label: '화석에너지 대체 (전력 1MWh당 TOE)', unit: 'TOE/MWh', lim: [0, 1], def: TOE_PER_MWH, minus: false, byYear: false, source: false },
  { card: 'co2', key: 'PINE_PER_TCO2', label: '소나무 식재 (tCO₂당 그루 · 20년생)', unit: '그루/t', lim: [0, 1000], def: PINE_PER_TCO2, minus: false, byYear: false, source: false },
  { card: 'adj', key: 'CLIMATE_CHG', label: '기후환경요금', unit: '원/kWh', lim: [0, 100], def: undefined, minus: false, byYear: false, source: false },
  { card: 'adj', key: 'FUEL_ADJ', label: '연료비조정요금', unit: '원/kWh', lim: [-100, 100], def: undefined, minus: true, byYear: false, source: false },
] as const;
type BaseField = (typeof BASE_FIELDS)[number];
const BASE_CARDS = [
  { card: 'co2', title: '전력배출계수' },
  { card: 'adj', title: '한전 요금 가산' },
] as const;
/** 값마다 출처 — 처음엔 지금 값의 근거 */
const SOURCE_DEFAULT: Record<string, string> = {
  CO2_EMISSION_FACTOR: '온실가스종합정보센터 국가 전력 배출계수 (2023년 소비단, 2025-12-17 공표)',
  CLIMATE_CHG: '한국전력공사 전기요금표 기후환경요금',
  FUEL_ADJ: '한국전력공사 연료비조정단가',
};
const srcKey = (key: string) => `${key}_SOURCE`;
/** 계수 출처 — 에너지 설정에 넣은 출처, 없으면 처음 근거 */
export const factorSource = (es: Record<string, string> | undefined, key: string) => es?.[srcKey(key)] || SOURCE_DEFAULT[key] || '';
const HISTORY_KEY = 'ENERGY_HISTORY';
interface HistoryRow {
  /** 계수 — 기준값은 키, 배출원 계수는 factor:id */
  key?: string;
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
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
};
const FIELD =
  'h-9 w-full rounded-md bg-white/[0.04] ring-1 ring-white/[0.08] px-2.5 text-sm text-white tabular-nums focus:outline-none focus:ring-primary/60';
const numOnly = (v: string, minus = false) => {
  const neg = minus && v.trim().startsWith('-');
  const [head = '', ...rest] = v.replace(/[^0-9.]/g, '').split('.');
  return (neg ? '-' : '') + (rest.length ? `${head}.${rest.join('')}` : head);
};

/** 저장 + 이력 한 줄 — 공통 */
function useFactorSave() {
  const { data: energy } = useEnergySettings();
  const save = useSaveEnergySettings();
  const userName = useAuthStore((s) => s.user?.name ?? '');
  const addToast = useToastStore((s) => s.add);
  const history = parseHistory(energy?.[HISTORY_KEY]);
  const commit = async (patch: Record<string, string>, row: Omit<HistoryRow, 'at' | 'by'>) => {
    try {
      await save.mutateAsync({
        ...patch,
        [HISTORY_KEY]: JSON.stringify([{ ...row, at: nowText(), by: userName }, ...history].slice(0, 300)),
      });
      // 삭제 · 등록 취소도 이력에 한 줄 남긴다
      addToast('success', `${row.item} ${row.after === '삭제' ? '삭제했습니다' : row.after.endsWith('등록 취소') ? '등록을 취소했습니다' : '저장했습니다'}`);
      return true;
    } catch {
      addToast('error', '저장에 실패했습니다');
      return false;
    }
  };
  return { energy, history, commit, pending: save.isPending };
}

/** 이력 — 그 계수의 기록, 맨 끝(가장 오래된)에 '최초' 한 줄(처음 넣은 값 · 출처) */
function rowsOf(history: HistoryRow[], key: string, first: Omit<HistoryRow, 'key' | 'at' | 'by' | 'before'>): HistoryRow[] {
  const own = history.filter((h) => h.key === key);
  const firstRow: HistoryRow = { key, at: FIRST_MONTH, by: '최초 등록', before: '', ...first };
  return [...own, firstRow];
}
/** 최초 등록 달 — 플랫폼에 계수를 처음 넣은 달(데이터 수집 시작 달) */
const FIRST_MONTH = '2025-03';

/** 계수 하나의 변경 이력 표 */
const PAGE = 5;
function HistoryTable({ rows, source = true, item = false }: { rows: HistoryRow[]; source?: boolean; item?: boolean }) {
  const [page, setPage] = useState(0);
  const total = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <div>
      <table className={cn(TABLE, 'tabular-nums')}>
        <thead>
          <tr className={TABLE_HEAD_ROW}>
            <th className={cn(TABLE_TH, 'whitespace-nowrap')}>월</th>
            {item && <th className={TABLE_TH}>계수</th>}
            <th className={TABLE_TH}>변경</th>
            {source && <th className={TABLE_TH}>출처</th>}
            <th className={cn(TABLE_TH, 'whitespace-nowrap')}>변경한 사람</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((h, i) => (
            <tr key={`${h.at}-${page}-${i}`} className={TABLE_ROW}>
              <td className={cn(TABLE_TD, 'whitespace-nowrap')}>{h.at.slice(0, 7)}</td>
              {item && <td className={TABLE_TD}>{h.item}</td>}
              <td className={cn(TABLE_TD, 'text-white')}>{h.after}</td>
              {source && <td className={TABLE_TD}>{h.source}</td>}
              <td className={cn(TABLE_TD, 'whitespace-nowrap')}>{h.by}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3 + (source ? 1 : 0) + (item ? 1 : 0)} className={cn(TABLE_TD, 'py-8 text-center text-slate-500')}>
                변경 이력 없음
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {rows.length > PAGE && <Pagination page={page} totalPages={total} totalElements={rows.length} onPageChange={setPage} className="mt-3" />}
    </div>
  );
}

const SourceField = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <label className="block">
    <span className="mb-1.5 block text-sm text-slate-300">출처 (필수)</span>
    <input aria-label="출처" maxLength={120} value={value} onChange={(e) => onChange(e.target.value)} className={`${FIELD} text-left`} />
  </label>
);

/** 전력배출계수 · 한전 요금 가산 카드 — 값은 보기만, [변경]으로 새 값 + 출처. 전력배출계수는 적용년도별 팝업 */
export function BaseFactorCards() {
  const { energy, history, commit, pending } = useFactorSave();
  const [edit, setEdit] = useState<BaseField | null>(null);
  const [val, setVal] = useState('');
  const [src, setSrc] = useState('');
  const [co2Open, setCo2Open] = useState(false);
  const co2ByYear = parseFactorByYear(energy?.[CO2_BY_YEAR_KEY], YEARS, energy?.CO2_EMISSION_FACTOR ? Number(energy.CO2_EMISSION_FACTOR) : undefined);
  const latestYear = yearsOf(co2ByYear)[0];
  const valueOf = (f: BaseField) =>
    f.byYear && latestYear ? String(co2ByYear[latestYear]) : (energy?.[f.key] ?? (f.def != null ? String(f.def) : ''));
  const baseRows = (f: BaseField) => {
    const own = history.filter((h) => h.key === f.key);
    const oldest = own[own.length - 1];
    return rowsOf(history, f.key, {
      item: f.label,
      after: oldest ? oldest.before : `${valueOf(f)} ${f.unit}`,
      source: oldest ? SOURCE_DEFAULT[f.key] ?? '' : (energy?.[srcKey(f.key)] ?? SOURCE_DEFAULT[f.key] ?? ''),
    });
  };
  const sourceOf = (f: BaseField) => energy?.[srcKey(f.key)] ?? SOURCE_DEFAULT[f.key] ?? '';
  const open = (f: BaseField) => {
    if (f.byYear) return setCo2Open(true);
    setEdit(f);
    setVal(valueOf(f));
    setSrc(sourceOf(f));
  };
  const n = Number(val);
  const valid = edit != null && val.trim() !== '' && Number.isFinite(n) && n >= edit.lim[0] && n <= edit.lim[1];
  const changed = edit != null && val.trim() !== valueOf(edit);
  const co2Field = BASE_FIELDS.find((f) => f.byYear)!;

  return (
    <>
      {BASE_CARDS.map((c) => (
        <SectionCard key={c.card} title={c.title}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {BASE_FIELDS.filter((f) => f.card === c.card).map((f) => (
              <div key={f.key}>
                <span className="mb-1.5 block text-sm text-slate-300">{f.label}</span>
                <div className="flex items-center gap-2">
                  {/* 전력배출계수 — 적용년도(최근)는 값 칸 밖 왼쪽에 글자로 */}
                  {f.byYear && latestYear && <span className="shrink-0 text-sm font-semibold text-white">{latestYear}년</span>}
                  <div className="flex h-9 flex-1 items-center justify-end rounded-md bg-white/[0.02] px-2.5 ring-1 ring-white/[0.06]">
                    <span className="text-sm tabular-nums text-white">{valueOf(f)}</span>
                    <span className="ml-2 shrink-0 text-sm font-semibold text-white">{f.unit}</span>
                  </div>
                  <Button size="sm" variant="secondary" className="shrink-0 whitespace-nowrap" onClick={() => open(f)}>
                    <Pencil size={13} className="mr-1" /> 변경
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ))}

      {edit && (
        <Modal
          open
          onClose={() => setEdit(null)}
          title={`변경 · ${edit.label}`}
          size="lg"
          footer={
            <>
              <Button variant="cancel" size="sm" onClick={() => setEdit(null)}>
                취소
              </Button>
              <Button
                size="sm"
                disabled={!valid || !changed || (edit.source && !src.trim()) || pending}
                onClick={async () => {
                  const ok = await commit(
                    { [edit.key]: val.trim(), ...(edit.source ? { [srcKey(edit.key)]: src.trim() } : {}) },
                    { key: edit.key, item: edit.label, before: `${valueOf(edit)} ${edit.unit}`, after: `${val.trim()} ${edit.unit}`, source: edit.source ? src.trim() : '' },
                  );
                  if (ok) setEdit(null);
                }}
              >
                저장
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">{`새 값 (${edit.lim[0]} ~ ${edit.lim[1].toLocaleString()} ${edit.unit})`}</span>
              <input aria-label="새 값" inputMode="decimal" maxLength={10} value={val} onChange={(e) => setVal(numOnly(e.target.value, edit.minus))} className={`${FIELD} text-right`} />
            </label>
            {edit.source && <SourceField value={src} onChange={setSrc} />}
            <p className="pt-2 text-sm font-medium text-white">변경 이력</p>
            <HistoryTable rows={baseRows(edit)} source={edit.source} />
          </div>
        </Modal>
      )}

      {co2Open && (
        <Co2YearModal
          field={co2Field}
          byYear={co2ByYear}
          history={history.filter((h) => h.key === co2Field.key)}
          commit={commit}
          pending={pending}
          onClose={() => setCo2Open(false)}
        />
      )}
    </>
  );
}

/** 전력배출계수 — 적용년도별. 한 줄에 [적용년도 | 값 | 등록], 아래 연도별 목록(줄마다 등록 취소) · 변경 이력. 출처 칸 없음 */
function Co2YearModal({
  field,
  byYear,
  history,
  commit,
  pending,
  onClose,
}: {
  field: BaseField;
  byYear: FactorByYear;
  history: HistoryRow[];
  commit: ReturnType<typeof useFactorSave>['commit'];
  pending: boolean;
  onClose: () => void;
}) {
  // 적용년도는 직접 입력 — 네 자리 연도면 몇 년이든(위아래 한도 없음). 처음엔 최근 등록 연도
  const firstYear = yearsOf(byYear)[0] ?? YEARS[0] ?? '';
  const [year, setYear] = useState(firstYear);
  const [val, setVal] = useState(byYear[firstYear] != null ? String(byYear[firstYear]) : '');
  const [cancelYear, setCancelYear] = useState<string | null>(null);
  const registered = yearsOf(byYear);
  const n = Number(val);
  const yearOk = /^\d{4}$/.test(year);
  const valid = yearOk && val.trim() !== '' && Number.isFinite(n) && n >= field.lim[0] && n <= field.lim[1] && byYear[year] !== n;
  const text = (y: string, v: number | string) => `${y}년 ${v} ${field.unit}`;
  // 저장 — 연도별 값 + 연도 구분 없는 화면용 최근 연도 값(CO2_EMISSION_FACTOR)
  const patchOf = (next: FactorByYear) => {
    const latest = yearsOf(next)[0];
    return { [CO2_BY_YEAR_KEY]: JSON.stringify(next), ...(latest ? { [field.key]: String(next[latest]) } : {}) };
  };
  const pick = (y: string) => {
    setYear(y);
    if (y.length === 4 && byYear[y] != null) setVal(String(byYear[y]));
  };
  // 이력 맨 끝 — 처음 등록된 연도별 값
  const first = Object.entries(parseFactorByYear(undefined, YEARS))
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([y, v]) => text(y, v))
    .join(', ');
  const rows: HistoryRow[] = [...history, { key: field.key, at: FIRST_MONTH, by: '최초 등록', before: '', item: field.label, after: first, source: '' }];

  return (
    <Modal
      open
      onClose={onClose}
      title={`변경 · ${field.label}`}
      size="lg"
      footer={
        <Button variant="cancel" size="sm" onClick={onClose}>
          닫기
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-end gap-2">
          <label className="block w-40 shrink-0">
            <span className="mb-1.5 block text-sm text-slate-300">적용년도</span>
            <div className="relative">
              <input
                aria-label="적용년도"
                inputMode="numeric"
                maxLength={4}
                value={year}
                onChange={(e) => pick(e.target.value.replace(/[^0-9]/g, ''))}
                className={`${FIELD} pr-7 text-right`}
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-white">년</span>
            </div>
          </label>
          <label className="block flex-1">
            <span className="mb-1.5 block text-sm text-slate-300">{`값 (${field.lim[0]} ~ ${field.lim[1]} ${field.unit})`}</span>
            <input aria-label="값" inputMode="decimal" maxLength={10} value={val} onChange={(e) => setVal(numOnly(e.target.value))} className={`${FIELD} text-right`} />
          </label>
          <Button
            size="sm"
            className="h-9 shrink-0"
            disabled={!valid || pending}
            onClick={() =>
              void commit(patchOf({ ...byYear, [year]: n }), {
                key: field.key,
                item: field.label,
                before: byYear[year] != null ? text(year, byYear[year]!) : '',
                after: text(year, val.trim()),
                source: '',
              })
            }
          >
            등록
          </Button>
        </div>

        <p className="pt-2 text-sm font-medium text-white">연도별 계수</p>
        <table className={cn(TABLE, 'tabular-nums')}>
          <thead>
            <tr className={TABLE_HEAD_ROW}>
              <th className={TABLE_TH}>적용년도</th>
              <th className={cn(TABLE_TH, 'text-right')}>값</th>
              <th className={TABLE_TH} />
            </tr>
          </thead>
          <tbody>
            {registered.map((y) => (
              <tr key={y} className={TABLE_ROW}>
                <td className={cn(TABLE_TD, 'font-semibold text-white')}>{`${y}년`}</td>
                <td className={cn(TABLE_TD, 'text-right text-white')}>
                  {byYear[y]} <span className="text-sm font-semibold text-white">{field.unit}</span>
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

        <p className="pt-2 text-sm font-medium text-white">변경 이력</p>
        <HistoryTable rows={rows} source={false} />
      </div>

      <ConfirmDialog
        open={cancelYear != null}
        onClose={() => setCancelYear(null)}
        onConfirm={() => {
          const y = cancelYear!;
          setCancelYear(null);
          const next = { ...byYear };
          delete next[y];
          void commit(patchOf(next), { key: field.key, item: field.label, before: text(y, byYear[y]!), after: `${y}년 등록 취소`, source: '' });
        }}
        title="등록 취소"
        message={`${cancelYear}년 전력배출계수 등록을 취소합니다. 변경 이력은 남습니다.`}
        confirmLabel="등록 취소"
        variant="danger"
      />
    </Modal>
  );
}

/** 배출원 계수(Scope 1 · 2, 연료별) — 표는 보기만, 줄마다 [변경] · [계수 추가] 그 자리에서 저장(출처 칸 없음). 표에 있는 줄이 전부(기본값을 따로 두지 않는다), 삭제는 확인 알림 */
const GHG_SCOPES = [1, 2, 3];
const GHG_NUMS = ['ncv', 'co2', 'ch4', 'n2o'] as const;
const NUM_LABEL: Record<(typeof GHG_NUMS)[number], string> = { ncv: '순발열량', co2: 'CO₂', ch4: 'CH₄', n2o: 'N₂O' };
type Draft = Omit<GhgFactor, (typeof GHG_NUMS)[number]> & Record<(typeof GHG_NUMS)[number], string>;
const toDraft = (f: GhgFactor): Draft => ({ ...f, ncv: String(f.ncv), co2: String(f.co2), ch4: String(f.ch4), n2o: String(f.n2o) });
const unitOf = (c: string, k: (typeof GHG_NUMS)[number]) => (k === 'ncv' ? 'MJ' : c === '외부 전기' ? (k === 'co2' ? 't/MWh' : 'kg/MWh') : 'kg/TJ');
const nameOf = (x: { scope: number; category: string; fuel: string }) => `배출원 계수 · Scope ${x.scope} ${x.category} ${x.fuel}`;
const summary = (x: Pick<Draft, (typeof GHG_NUMS)[number]>) => GHG_NUMS.map((k) => `${NUM_LABEL[k]} ${x[k]}`).join(', ');

export function GhgFactorSettings() {
  const factors = useGhgFactorList();
  const { history, commit, pending } = useFactorSave();
  // 팝업 — edit: 줄 하나(없는 id 면 추가)
  const [edit, setEdit] = useState<Draft | null>(null);
  // 삭제 확인
  const [delAsk, setDelAsk] = useState(false);
  // 배출원 계수 전체 변경 이력 — 삭제한 계수도 여기서 본다
  const [histOpen, setHistOpen] = useState(false);
  // 근거(basis) — 출처 칸은 없앴고, 지침 기본값 줄의 근거만 그대로 들고 간다(추가한 줄은 빈 값)
  const [src, setSrc] = useState('');
  const isNew = edit != null && !factors.some((f) => f.id === edit.id);
  const set = (patch: Partial<Draft>) => setEdit((d) => (d ? { ...d, ...patch } : d));
  const valid =
    edit != null &&
    !!edit.category.trim() &&
    !!edit.fuel.trim() &&
    !!edit.unit.trim() &&
    GHG_NUMS.every((k) => edit[k].trim() !== '' && Number.isFinite(Number(edit[k])));
  const save = async (next: GhgFactor[], row: Omit<HistoryRow, 'at' | 'by'>) => {
    const ok = await commit({ [GHG_FACTORS_KEY]: JSON.stringify(next) }, row);
    if (ok) {
      setEdit(null);
    }
  };
  const fromDraft = (d: Draft): GhgFactor => ({
    ...d,
    category: d.category.trim(),
    fuel: d.fuel.trim(),
    unit: d.unit.trim(),
    basis: src.trim(),
    ncv: Number(d.ncv),
    co2: Number(d.co2),
    ch4: Number(d.ch4),
    n2o: Number(d.n2o),
  });
  const before = edit && !isNew ? factors.find((f) => f.id === edit.id) : undefined;
  const factorRows = (id: string) => {
    const base0 = GHG_FACTORS.find((g) => g.id === id);
    const own = history.filter((h) => h.key === `factor:${id}`);
    // 지침 기본값 줄은 최초 = 기본값 · 근거. 직접 추가한 줄은 '추가' 기록이 최초라 따로 붙이지 않는다
    if (!base0) return own;
    return rowsOf(history, `factor:${id}`, { item: nameOf(base0), after: summary(toDraft(base0)), source: base0.basis });
  };

  return (
    <SectionCard
      title="배출원 계수"
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setHistOpen(true)}>
            <History size={14} className="mr-1" /> 변경 이력
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setSrc('');
              setEdit({ id: `u${Date.now()}`, scope: 1, category: '', fuel: '', unit: '', ncv: '', co2: '', ch4: '', n2o: '', basis: '' });
            }}
          >
            <Plus size={14} className="mr-1" /> 계수 추가
          </Button>
        </div>
      }
      noPadding
    >
      <div className="overflow-x-auto">
        <table className={cn(TABLE, 'min-w-[960px] tabular-nums')}>
          <thead>
            <tr className={TABLE_HEAD_ROW}>
              <th className={cn(TABLE_TH, 'px-3')}>Scope</th>
              <th className={cn(TABLE_TH, 'px-3')}>배출활동</th>
              <th className={cn(TABLE_TH, 'px-3')}>연료 · 에너지</th>
              <th className={cn(TABLE_TH, 'px-3')}>단위</th>
              {GHG_NUMS.map((k) => (
                <th key={k} className={cn(TABLE_TH, 'px-3 text-right')}>
                  {NUM_LABEL[k]}
                </th>
              ))}
              <th className={cn(TABLE_TH, 'px-3')} />
            </tr>
          </thead>
          <tbody>
            {factors.map((f) => (
              <tr key={f.id} className={TABLE_ROW}>
                <td className={cn(TABLE_TD, 'px-3')}>{`Scope ${f.scope}`}</td>
                <td className={cn(TABLE_TD, 'px-3')}>{f.category}</td>
                <td className={cn(TABLE_TD, 'px-3 text-white')}>{f.fuel}</td>
                <td className={cn(TABLE_TD, 'px-3')}>{f.unit}</td>
                {GHG_NUMS.map((k) => (
                  <td key={k} className={cn(TABLE_TD, 'px-3 text-right')}>
                    {f[k].toLocaleString()} <span className="text-sm font-semibold text-white">{unitOf(f.category, k)}</span>
                  </td>
                ))}
                <td className={cn(TABLE_TD, 'w-[96px] whitespace-nowrap px-3 text-right')}>
                  <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => (setSrc(f.basis), setEdit(toDraft(f)))}>
                    <Pencil size={13} className="mr-1" /> 변경
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <Modal
          open
          onClose={() => setEdit(null)}
          title={isNew ? '계수 추가' : `변경 · ${nameOf(before ?? edit)}`}
          size="xl"
          footer={
            <>
              {!isNew && (
                <Button
                  variant="danger"
                  size="sm"
                  className="mr-auto"
                  disabled={pending}
                  onClick={() => setDelAsk(true)}
                >
                  <Trash2 size={14} className="mr-1" /> 삭제
                </Button>
              )}
              <Button variant="cancel" size="sm" onClick={() => setEdit(null)}>
                취소
              </Button>
              <Button
                size="sm"
                disabled={!valid || pending}
                onClick={() => {
                  const next = fromDraft(edit);
                  void save(isNew ? [...factors, next] : factors.map((f) => (f.id === edit.id ? next : f)), {
                    key: `factor:${edit.id}`,
                    item: nameOf(next),
                    before: before ? summary(toDraft(before)) : '',
                    after: isNew ? `추가 · ${summary(edit)}` : summary(edit),
                    source: '',
                  });
                }}
              >
                저장
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-300">Scope</span>
                <select aria-label="Scope" value={edit.scope} onChange={(e) => set({ scope: Number(e.target.value) })} className={`${FIELD} [color-scheme:dark]`}>
                  {GHG_SCOPES.map((n) => (
                    <option key={n} value={n}>{`Scope ${n}`}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-300">배출활동</span>
                <input aria-label="배출활동" maxLength={30} value={edit.category} onChange={(e) => set({ category: e.target.value })} className={FIELD} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-300">연료 · 에너지</span>
                <input aria-label="연료 · 에너지" maxLength={30} value={edit.fuel} onChange={(e) => set({ fuel: e.target.value })} className={FIELD} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-300">단위</span>
                <input aria-label="단위" maxLength={10} value={edit.unit} onChange={(e) => set({ unit: e.target.value })} className={FIELD} />
              </label>
              {GHG_NUMS.map((k) => (
                <label key={k} className="block">
                  <span className="mb-1.5 block text-sm text-slate-300">{`${NUM_LABEL[k]} (${unitOf(edit.category, k)})`}</span>
                  <input aria-label={NUM_LABEL[k]} inputMode="decimal" maxLength={12} value={edit[k]} onChange={(e) => set({ [k]: numOnly(e.target.value) })} className={`${FIELD} text-right`} />
                </label>
              ))}
            </div>
            {!isNew && (
              <>
                <p className="pt-2 text-sm font-medium text-white">변경 이력</p>
                <HistoryTable rows={factorRows(edit.id)} source={false} />
              </>
            )}
          </div>
        </Modal>
      )}

      {histOpen && (
        <Modal
          open
          onClose={() => setHistOpen(false)}
          title="배출원 계수 변경 이력"
          size="xl"
          footer={
            <Button variant="cancel" size="sm" onClick={() => setHistOpen(false)}>
              닫기
            </Button>
          }
        >
          <HistoryTable rows={history.filter((h) => h.key?.startsWith('factor:'))} item source={false} />
        </Modal>
      )}

      {edit && !isNew && (
        <ConfirmDialog
          open={delAsk}
          onClose={() => setDelAsk(false)}
          onConfirm={() => {
            setDelAsk(false);
            void save(
              factors.filter((f) => f.id !== edit.id),
              { key: `factor:${edit.id}`, item: nameOf(before ?? edit), before: summary(toDraft(before ?? fromDraft(edit))), after: '삭제', source: '' },
            );
          }}
          title="계수 삭제"
          message={`${nameOf(before ?? edit)} — 변경 이력은 남습니다`}
          confirmLabel="삭제"
          variant="danger"
        />
      )}

    </SectionCard>
  );
}
