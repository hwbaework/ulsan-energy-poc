'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { SectionCard } from '@/components/features';
import { Button } from '@/components/ui/Button';
import { useToastStore } from '@/stores/useToastStore';
import { useIndustrialTariff, useSaveIndustrialTariff } from '@/hooks/common/useSettings';
import { F1, TARIFF_YEAR_LIM, cagrOf, type TariffYear } from '@/lib/solar-sim';

// 에너지 설정 — 산업용 평균판매단가 연도별 실적. 무료진단 검토서의 '실적 CAGR 반영' 시나리오가 이 표(첫해 → 마지막 해)로 계산된다.
// 새 연도 실적이 나오면 관리자가 한 줄 추가. 기간을 줄이려면 오래된 해를 지운다

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

  useEffect(() => {
    if (data && !dirty) setRows([...data].sort((a, b) => a.year - b.year).map(toRow));
  }, [data, dirty]);

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
    const [yLo, yHi] = TARIFF_YEAR_LIM.year;
    const [pLo, pHi] = TARIFF_YEAR_LIM.price;
    if (parsed.some((r) => !Number.isInteger(r.year) || r.year < yLo || r.year > yHi)) return addToast('error', `연도는 ${yLo}~${yHi} 사이로 입력하세요`);
    if (parsed.some((r) => !(r.price >= pLo && r.price <= pHi))) return addToast('error', `단가는 ${pLo}~${F1(pHi)}원/kWh 사이로 입력하세요`);
    if (new Set(parsed.map((r) => r.year)).size !== parsed.length) return addToast('error', '같은 연도가 두 번 있습니다');
    if (parsed.length < 2) return addToast('error', '연도를 두 개 이상 입력하세요');
    try {
      await save.mutateAsync([...parsed].sort((a, b) => a.year - b.year));
      setDirty(false);
      addToast('success', '산업용 평균판매단가를 저장했습니다');
    } catch {
      addToast('error', '저장에 실패했습니다');
    }
  };

  const th = 'px-5 py-3 text-left text-xs font-medium text-slate-400';
  const sorted = [...rows].sort((a, b) => Number(a.year) - Number(b.year));

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '관리' }, { label: '에너지 설정' }]} />

      {/* 제목 · 오른쪽 저장 — 스크롤해도 상단(헤더 100px 아래)에 따라다닌다 */}
      <div className="sticky top-[100px] z-20 flex flex-wrap items-center justify-between gap-3 py-3 backdrop-blur">
        <h1 className="text-2xl font-bold text-white">에너지 설정</h1>
        <Button onClick={onSave} disabled={!dirty || save.isPending || isLoading}>
          {save.isPending ? <Loader2 size={14} className="mr-1 animate-spin" /> : dirty ? <Save size={14} className="mr-1" /> : <Check size={14} className="mr-1" />}
          {save.isPending ? '저장 중…' : dirty ? '저장' : '저장됨'}
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
    </div>
  );
}
