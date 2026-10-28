'use client';

// 관리 › 에너지 설정 — 계수(탄소 배출계수 · 환경 편익 · 한전 요금 가산 · 배출원 계수).
// 화면의 값은 보기만. 바꿀 때는 계수마다 [변경] 팝업에서 새 값 + 출처(필수)를 같이 넣고 그 자리에서 저장 → 그 계수 이력에 한 줄.
// 이력 · 출처는 에너지 설정(ENERGY_HISTORY · `${key}_SOURCE` · 배출원 계수 basis)에 둔다. 계산은 지금 값 하나(연도별 계수 없음).
import { useState } from 'react';
import { Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { SectionCard } from '@/components/features';
import { TABLE, TABLE_HEAD_ROW, TABLE_TH, TABLE_ROW, TABLE_TD } from '@/components/features/DataList';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { cn } from '@/lib/utils';
import { useEnergySettings, useSaveEnergySettings } from '@/hooks/common/useSettings';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { PINE_PER_TCO2, TOE_PER_MWH } from '@/lib/constants/env-benefit';
import { GHG_FACTORS, type GhgFactor } from '@/lib/ghg-factors';
import { GHG_FACTORS_KEY, useGhgFactorList } from '@/lib/ghg-reduction';

/** 기준값 칸 — 카드 · 키 · 이름 · 단위 · 범위 · 소수 */
const BASE_FIELDS = [
  { card: 'co2', key: 'CO2_EMISSION_FACTOR', label: '탄소 배출계수 (전력 1MWh당 tCO₂)', unit: 't/MWh', lim: [0, 2], def: undefined, minus: false },
  { card: 'co2', key: 'TOE_PER_MWH', label: '화석에너지 대체 (전력 1MWh당 TOE)', unit: 'TOE/MWh', lim: [0, 1], def: TOE_PER_MWH, minus: false },
  { card: 'co2', key: 'PINE_PER_TCO2', label: '소나무 식재 (tCO₂당 그루 · 20년생)', unit: '그루/t', lim: [0, 1000], def: PINE_PER_TCO2, minus: false },
  { card: 'adj', key: 'CLIMATE_CHG', label: '기후환경요금', unit: '원/kWh', lim: [0, 100], def: undefined, minus: false },
  { card: 'adj', key: 'FUEL_ADJ', label: '연료비조정요금', unit: '원/kWh', lim: [-100, 100], def: undefined, minus: true },
] as const;
type BaseField = (typeof BASE_FIELDS)[number];
const BASE_CARDS = [
  { card: 'co2', title: '탄소 배출계수' },
  { card: 'adj', title: '한전 요금 가산' },
] as const;
/** 값마다 출처 — 처음엔 지금 값의 근거 */
const SOURCE_DEFAULT: Record<string, string> = {
  CO2_EMISSION_FACTOR: '온실가스종합정보센터 국가 전력 배출계수 (2023년 소비단, 2025-12-17 공표)',
  CLIMATE_CHG: '한국전력공사 전기요금표 기후환경요금',
  FUEL_ADJ: '한국전력공사 연료비조정단가',
  TOE_PER_MWH: '에너지법 시행규칙 에너지열량 환산기준 (전기 소비기준 9.6 MJ/kWh)',
  PINE_PER_TCO2: '국립산림과학원 소나무 1그루 연 6.6 kg CO₂ 흡수',
};
const srcKey = (key: string) => `${key}_SOURCE`;
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
      addToast('success', `${row.item} 저장했습니다`);
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
function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  const [page, setPage] = useState(0);
  const total = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <div>
      <table className={cn(TABLE, 'tabular-nums')}>
        <thead>
          <tr className={TABLE_HEAD_ROW}>
            <th className={cn(TABLE_TH, 'whitespace-nowrap')}>월</th>
            <th className={TABLE_TH}>이전</th>
            <th className={TABLE_TH}>변경</th>
            <th className={TABLE_TH}>출처</th>
            <th className={cn(TABLE_TH, 'whitespace-nowrap')}>변경한 사람</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((h, i) => (
            <tr key={`${h.at}-${page}-${i}`} className={TABLE_ROW}>
              <td className={cn(TABLE_TD, 'whitespace-nowrap')}>{h.at.slice(0, 7)}</td>
              <td className={TABLE_TD}>{h.before}</td>
              <td className={cn(TABLE_TD, 'text-white')}>{h.after}</td>
              <td className={TABLE_TD}>{h.source}</td>
              <td className={cn(TABLE_TD, 'whitespace-nowrap')}>{h.by}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className={cn(TABLE_TD, 'py-8 text-center text-slate-500')}>
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

/** 탄소 배출계수 · 한전 요금 가산 카드 — 값은 보기만, [변경]으로 새 값 + 출처 */
export function BaseFactorCards() {
  const { energy, history, commit, pending } = useFactorSave();
  const [edit, setEdit] = useState<BaseField | null>(null);
  const [val, setVal] = useState('');
  const [src, setSrc] = useState('');
  const valueOf = (f: BaseField) => energy?.[f.key] ?? (f.def != null ? String(f.def) : '');
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
    setEdit(f);
    setVal(valueOf(f));
    setSrc('');
  };
  const n = Number(val);
  const valid = edit != null && val.trim() !== '' && Number.isFinite(n) && n >= edit.lim[0] && n <= edit.lim[1];
  const changed = edit != null && val.trim() !== valueOf(edit);

  return (
    <>
      {BASE_CARDS.map((c) => (
        <SectionCard key={c.card} title={c.title}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {BASE_FIELDS.filter((f) => f.card === c.card).map((f) => (
              <div key={f.key}>
                <span className="mb-1.5 block text-sm text-slate-300">{f.label}</span>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 flex-1 items-center justify-end rounded-md bg-white/[0.02] px-2.5 ring-1 ring-white/[0.06]">
                    <span className="text-sm tabular-nums text-white">{valueOf(f)}</span>
                    <span className="ml-2 shrink-0 text-xs text-slate-500">{f.unit}</span>
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
                disabled={!valid || !changed || !src.trim() || pending}
                onClick={async () => {
                  const ok = await commit(
                    { [edit.key]: val.trim(), [srcKey(edit.key)]: src.trim() },
                    { key: edit.key, item: edit.label, before: `${valueOf(edit)} ${edit.unit}`, after: `${val.trim()} ${edit.unit}`, source: src.trim() },
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
            <p className="text-sm text-slate-300">
              지금 값 <b className="tabular-nums text-white">{`${valueOf(edit)} ${edit.unit}`}</b> · 지금 출처 {sourceOf(edit)}
            </p>
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">{`새 값 (${edit.lim[0]} ~ ${edit.lim[1].toLocaleString()} ${edit.unit})`}</span>
              <input aria-label="새 값" inputMode="decimal" maxLength={10} value={val} onChange={(e) => setVal(numOnly(e.target.value, edit.minus))} className={`${FIELD} text-right`} />
            </label>
            <SourceField value={src} onChange={setSrc} />
            <p className="pt-2 text-sm font-medium text-white">변경 이력</p>
            <HistoryTable rows={baseRows(edit)} />
          </div>
        </Modal>
      )}
    </>
  );
}

/** 배출원 계수(Scope 1 · 2, 연료별) — 표는 보기만, 줄마다 [변경] · [계수 추가] · [기본값으로] 모두 출처를 받고 그 자리에서 저장 */
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
  // 팝업 — edit: 줄 하나(없는 id 면 추가), reset: 기본값으로
  const [edit, setEdit] = useState<Draft | null>(null);
  const [reset, setReset] = useState(false);
  const [src, setSrc] = useState('');
  const isNew = edit != null && !factors.some((f) => f.id === edit.id);
  const set = (patch: Partial<Draft>) => setEdit((d) => (d ? { ...d, ...patch } : d));
  const valid =
    edit != null &&
    !!edit.category.trim() &&
    !!edit.fuel.trim() &&
    !!edit.unit.trim() &&
    GHG_NUMS.every((k) => edit[k].trim() !== '' && Number.isFinite(Number(edit[k]))) &&
    !!src.trim();
  const save = async (next: GhgFactor[], row: Omit<HistoryRow, 'at' | 'by'>) => {
    const ok = await commit({ [GHG_FACTORS_KEY]: JSON.stringify(next) }, row);
    if (ok) {
      setEdit(null);
      setReset(false);
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
          <Button size="sm" variant="secondary" onClick={() => (setSrc(''), setReset(true))}>
            <RotateCcw size={14} className="mr-1" /> 기본값으로
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
                    {f[k].toLocaleString()} <span className="text-xs text-slate-500">{unitOf(f.category, k)}</span>
                  </td>
                ))}
                <td className={cn(TABLE_TD, 'w-[96px] whitespace-nowrap px-3 text-right')}>
                  <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => (setSrc(''), setEdit(toDraft(f)))}>
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
                  disabled={!src.trim() || pending}
                  onClick={() =>
                    void save(
                      factors.filter((f) => f.id !== edit.id),
                      { key: `factor:${edit.id}`, item: nameOf(before ?? edit), before: summary(toDraft(before ?? fromDraft(edit))), after: '삭제', source: src.trim() },
                    )
                  }
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
                    source: src.trim(),
                  });
                }}
              >
                저장
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {before && <p className="text-sm text-slate-300">지금 출처 {before.basis}</p>}
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
            <SourceField value={src} onChange={setSrc} />
            {!isNew && (
              <>
                <p className="pt-2 text-sm font-medium text-white">변경 이력</p>
                <HistoryTable rows={factorRows(edit.id)} />
              </>
            )}
          </div>
        </Modal>
      )}

      {reset && (
        <Modal
          open
          onClose={() => setReset(false)}
          title="기본값으로"
          size="md"
          footer={
            <>
              <Button variant="cancel" size="sm" onClick={() => setReset(false)}>
                취소
              </Button>
              <Button
                size="sm"
                disabled={!src.trim() || pending}
                onClick={() =>
                  void save(GHG_FACTORS, { key: 'factor:*', item: '배출원 계수 전체', before: `${factors.length}종`, after: `기본값 ${GHG_FACTORS.length}종`, source: src.trim() })
                }
              >
                저장
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm tabular-nums text-slate-300">{`배출원 계수 ${factors.length}종 → 지침 기본값 ${GHG_FACTORS.length}종`}</p>
            <SourceField value={src} onChange={setSrc} />
          </div>
        </Modal>
      )}
    </SectionCard>
  );
}
