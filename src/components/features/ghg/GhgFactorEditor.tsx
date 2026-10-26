'use client';

// 배출원 계수 관리 팝업 — 에너지 설정 · 배출계수 관리가 같이 연다(관리자). 저장하면 에너지 설정(GHG_FACTORS)에 들어가고
// 배출계수 관리 표가 이 값을 읽는다. 전력 배출계수(감축량) · TOE · 소나무는 에너지 설정 '탄소 배출계수' 카드에서 고친다.
import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { TABLE, TABLE_HEAD_ROW, TABLE_TH, TABLE_ROW, TABLE_TD } from '@/components/features/DataList';
import { useSaveEnergySettings } from '@/hooks/common/useSettings';
import { useToastStore } from '@/stores/useToastStore';
import { CATEGORY_SCOPE, GHG_FACTORS, type GhgCategory, type GhgFactor } from '@/lib/ghg-factors';
import { GHG_FACTORS_KEY, useGhgFactorList } from '@/lib/ghg-reduction';

const CATEGORIES = Object.keys(CATEGORY_SCOPE) as GhgCategory[];
const NUMS = ['ncv', 'co2', 'ch4', 'n2o'] as const;
type Draft = Omit<GhgFactor, (typeof NUMS)[number]> & Record<(typeof NUMS)[number], string>;
const toDraft = (f: GhgFactor): Draft => ({ ...f, ncv: String(f.ncv), co2: String(f.co2), ch4: String(f.ch4), n2o: String(f.n2o) });
const numOnly = (v: string) => {
  const [head = '', ...rest] = v.replace(/[^0-9.]/g, '').split('.');
  return rest.length ? `${head}.${rest.join('')}` : head;
};
/** 칸 단위 — 전기는 t·kg/MWh, 그 밖은 kg/TJ */
const unitOf = (c: GhgCategory, k: (typeof NUMS)[number]) =>
  k === 'ncv' ? 'MJ/단위' : c === '외부 전기' ? (k === 'co2' ? 't/MWh' : 'kg/MWh') : 'kg/TJ';

const FIELD =
  'h-8 w-full rounded-md bg-white/[0.04] px-2 text-sm text-white ring-1 ring-white/[0.08] focus:outline-none focus:ring-primary/60';

export function GhgFactorEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const list = useGhgFactorList();
  const save = useSaveEnergySettings();
  const addToast = useToastStore((s) => s.add);
  const [rows, setRows] = useState<Draft[]>([]);
  // 열 때마다 저장된 값으로 다시 시작
  useEffect(() => {
    if (open) setRows(list.map(toDraft));
  }, [open, list]);

  const edit = (i: number, patch: Partial<Draft>) => setRows((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const add = () =>
    setRows((prev) => [
      ...prev,
      { id: `u${Date.now()}`, category: '고정연소', fuel: '', unit: '', ncv: '', co2: '', ch4: '', n2o: '', basis: '' },
    ]);

  const onSave = async () => {
    for (const r of rows) {
      if (!r.fuel.trim() || !r.unit.trim()) return addToast('error', '연료 · 에너지와 단위를 입력하세요');
      if (NUMS.some((k) => r[k].trim() === '' || !Number.isFinite(Number(r[k]))))
        return addToast('error', `${r.fuel} — 순발열량 · CO₂ · CH₄ · N₂O 를 숫자로 입력하세요`);
    }
    const out: GhgFactor[] = rows.map((r) => ({
      ...r,
      fuel: r.fuel.trim(),
      unit: r.unit.trim(),
      basis: r.basis.trim(),
      ncv: Number(r.ncv),
      co2: Number(r.co2),
      ch4: Number(r.ch4),
      n2o: Number(r.n2o),
    }));
    try {
      await save.mutateAsync({ [GHG_FACTORS_KEY]: JSON.stringify(out) });
      addToast('success', '배출원 계수를 저장했습니다');
      onClose();
    } catch {
      addToast('error', '저장에 실패했습니다');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`배출원 계수 관리 (${rows.length})`}
      size="xl"
      footer={
        <>
          <Button variant="secondary" size="sm" className="mr-auto" onClick={() => setRows(GHG_FACTORS.map(toDraft))}>
            기본값으로
          </Button>
          <Button variant="secondary" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button size="sm" onClick={() => void onSave()} disabled={save.isPending}>
            {save.isPending && <Loader2 size={14} className="mr-1 animate-spin" />}
            저장
          </Button>
        </>
      }
    >
      <div className="max-h-[60vh] overflow-auto">
        <table className={cn(TABLE, 'min-w-[1100px]')}>
          <thead>
            <tr className={TABLE_HEAD_ROW}>
              <th className={cn(TABLE_TH, 'whitespace-nowrap px-2')}>배출활동</th>
              <th className={cn(TABLE_TH, 'whitespace-nowrap px-2')}>연료 · 에너지</th>
              <th className={cn(TABLE_TH, 'whitespace-nowrap px-2')}>단위</th>
              <th className={cn(TABLE_TH, 'whitespace-nowrap px-2')}>순발열량</th>
              <th className={cn(TABLE_TH, 'whitespace-nowrap px-2')}>CO₂</th>
              <th className={cn(TABLE_TH, 'whitespace-nowrap px-2')}>CH₄</th>
              <th className={cn(TABLE_TH, 'whitespace-nowrap px-2')}>N₂O</th>
              <th className={cn(TABLE_TH, 'whitespace-nowrap px-2')}>근거</th>
              <th className={cn(TABLE_TH, 'px-2')} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={TABLE_ROW}>
                <td className={cn(TABLE_TD, 'w-[150px] px-2')}>
                  <select
                    aria-label="배출활동"
                    value={r.category}
                    onChange={(e) => edit(i, { category: e.target.value as GhgCategory })}
                    className={cn(FIELD, '[color-scheme:dark]')}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{`Scope ${CATEGORY_SCOPE[c]} · ${c}`}</option>
                    ))}
                  </select>
                </td>
                <td className={cn(TABLE_TD, 'w-[160px] px-2')}>
                  <input aria-label="연료 · 에너지" maxLength={30} value={r.fuel} onChange={(e) => edit(i, { fuel: e.target.value })} className={FIELD} />
                </td>
                <td className={cn(TABLE_TD, 'w-[80px] px-2')}>
                  <input aria-label="단위" maxLength={10} value={r.unit} onChange={(e) => edit(i, { unit: e.target.value })} className={FIELD} />
                </td>
                {NUMS.map((k) => (
                  <td key={k} className={cn(TABLE_TD, 'w-[120px] px-2')}>
                    <div className="flex items-center gap-1">
                      <input
                        aria-label={k}
                        inputMode="decimal"
                        maxLength={12}
                        value={r[k]}
                        onChange={(e) => edit(i, { [k]: numOnly(e.target.value) })}
                        className={cn(FIELD, 'text-right tabular-nums')}
                      />
                      <span className="shrink-0 text-[11px] text-slate-500">{unitOf(r.category, k)}</span>
                    </div>
                  </td>
                ))}
                <td className={cn(TABLE_TD, 'px-2')}>
                  <input aria-label="근거" maxLength={120} value={r.basis} onChange={(e) => edit(i, { basis: e.target.value })} className={FIELD} />
                </td>
                <td className={cn(TABLE_TD, 'w-[40px] px-2')}>
                  <button
                    type="button"
                    aria-label={`${r.fuel || '계수'} 삭제`}
                    onClick={() => setRows((prev) => prev.filter((_, k) => k !== i))}
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
      <Button variant="secondary" size="sm" className="mt-3" onClick={add}>
        <Plus size={14} className="mr-1" /> 계수 추가
      </Button>
    </Modal>
  );
}
