'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/edm/ui/Card';
import { Badge } from '@/components/edm/ui/Badge';
import { Button } from '@/components/edm/ui/Button';
import { Breadcrumb } from '@/components/edm/layout/Breadcrumb';
import { useAuthStore } from '@/stores/useAuthStore';
import { useGhgTarget, useUpsertTarget } from '@/hooks/edm/useGhgExt';

const inputCls = 'mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-slate-200';

// 감축목표·시나리오 — 설계 docs/기획/01 rev.2 §3 (기준·목표연도, pathway, 이행수단 기여: RE100·KOC·효율화)
// /api/v1/ghg/target 배선 (미가동 시 폴백)
// 목표 저장 배선: 설계 11 §2.5 (제어 컴포넌트 전환 + useUpsertTarget). currentTco2·progressPct는 서버 계산.

const MEASURES = [
  { name: 'RE100 (REC·PPA·자가소비)', tco2: 1600, variant: 'success' as const },
  { name: '탄소거래 KOC 상쇄', tco2: 900, variant: 'info' as const },
  { name: '분산에너지 효율화', tco2: 640, variant: 'warning' as const },
];

export default function TargetPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const { data: t, isError } = useGhgTarget(companyId);
  const BASE = { year: t.baseYear, tco2: t.baseTco2 };
  const TARGET = { year: t.targetYear, tco2: t.targetTco2 };
  const CURRENT = { year: 2026, tco2: t.currentTco2 };

  // 제어 컴포넌트 (설계 11 §2.5): 조회값으로 초기화, 조회 갱신 시 동기화.
  const upsert = useUpsertTarget();
  const [form, setForm] = useState({ baseYear: '', baseTco2: '', targetYear: '', targetTco2: '' });
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  useEffect(() => {
    setForm({
      baseYear: String(t.baseYear),
      baseTco2: String(t.baseTco2),
      targetYear: String(t.targetYear),
      targetTco2: String(t.targetTco2),
    });
  }, [t.baseYear, t.baseTco2, t.targetYear, t.targetTco2]);

  const nums = {
    baseYear: Number(form.baseYear),
    baseTco2: Number(form.baseTco2),
    targetYear: Number(form.targetYear),
    targetTco2: Number(form.targetTco2),
  };
  const guardReason =
    companyId == null
      ? '회사 정보가 없어 저장할 수 없습니다'
      : isError
        ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
        : '';
  const targetErr =
    !Number.isFinite(nums.baseYear) || !Number.isFinite(nums.targetYear) || nums.baseYear >= nums.targetYear
      ? '기준연도는 목표연도보다 앞서야 합니다'
      : !(nums.baseTco2 > 0)
        ? '기준 배출량은 0보다 커야 합니다'
        : !(nums.targetTco2 >= 0) || nums.targetTco2 >= nums.baseTco2
          ? '목표가 기준보다 커 감축이 아님'
          : '';
  const canSave = !guardReason && !targetErr;

  async function save() {
    if (!canSave || companyId == null) return;
    setFeedback(null);
    try {
      await upsert.mutateAsync({
        companyId,
        baseYear: nums.baseYear,
        baseTco2: nums.baseTco2,
        targetYear: nums.targetYear,
        targetTco2: nums.targetTco2,
      });
      setFeedback({ kind: 'ok', msg: '감축목표를 저장했습니다.' });
    } catch {
      setFeedback({ kind: 'err', msg: '감축목표 저장 중 오류가 발생했습니다.' });
    }
  }
  // BAU vs 목표 경로 (기준~목표 보간)
  const PATH = [0, 1, 2, 3].map((i) => {
    const year = BASE.year + Math.round(((TARGET.year - BASE.year) * i) / 3);
    const target = Math.round(BASE.tco2 - ((BASE.tco2 - TARGET.tco2) * i) / 3);
    const bau = Math.round(BASE.tco2 * (1 + 0.052 * i));
    return { year, bau, target };
  });
  const MAX = Math.max(...PATH.map((p) => p.bau));
  const reduced = BASE.tco2 - CURRENT.tco2;
  const progress = t.progressPct ?? Math.round((reduced / (BASE.tco2 - TARGET.tco2)) * 100);
  const expected = Math.round(((CURRENT.year - BASE.year) / (TARGET.year - BASE.year)) * 100);
  const onTrack = progress >= expected;
  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '온실가스 인벤토리', path: '/e-data/inventory' }, { label: '감축목표·시나리오' }]} />
      <h1 className="text-xl font-bold text-white">감축목표 · 시나리오</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-slate-400">기준연도 ({BASE.year})</p>
          <p className="mt-1 text-2xl font-bold text-white tabular-nums">{BASE.tco2.toLocaleString()}</p>
          <p className="text-xs text-slate-500">tCO₂eq</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-400">목표 ({TARGET.year}, -50%)</p>
          <p className="mt-1 text-2xl font-bold text-sky-300 tabular-nums">{TARGET.tco2.toLocaleString()}</p>
          <p className="text-xs text-slate-500">tCO₂eq</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">목표 진척</p>
            <Badge variant={onTrack ? 'success' : 'danger'}>{onTrack ? '정상' : '지연'}</Badge>
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-400 tabular-nums">{progress}%</p>
          <p className="text-xs text-slate-500">
            기대 진척 {expected}% · 현재 {CURRENT.tco2.toLocaleString()} tCO₂eq
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-white">목표 설정</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <label className="text-xs text-slate-400">
            기준연도
            <input
              type="number"
              value={form.baseYear}
              onChange={(e) => setForm({ ...form, baseYear: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="text-xs text-slate-400">
            기준 배출량 (tCO₂eq)
            <input
              type="number"
              min={0}
              step="0.001"
              value={form.baseTco2}
              onChange={(e) => setForm({ ...form, baseTco2: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="text-xs text-slate-400">
            목표연도
            <input
              type="number"
              value={form.targetYear}
              onChange={(e) => setForm({ ...form, targetYear: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="text-xs text-slate-400">
            목표 배출량 (tCO₂eq)
            <input
              type="number"
              min={0}
              step="0.001"
              value={form.targetTco2}
              onChange={(e) => setForm({ ...form, targetTco2: e.target.value })}
              className={inputCls}
            />
          </label>
        </div>
        {(guardReason || targetErr) && (
          <p className="mt-3 text-xs text-amber-400">저장 불가: {guardReason || targetErr}</p>
        )}
        {feedback && (
          <p className={`mt-3 text-xs ${feedback.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
            {feedback.msg}
          </p>
        )}
        <div className="mt-4">
          <Button variant="primary" size="sm" onClick={save} disabled={!canSave} loading={upsert.isPending}>
            목표 저장
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-white">감축 경로 (BAU vs 목표)</h2>
        <div className="flex items-end gap-6 h-40">
          {PATH.map((p) => (
            <div key={p.year} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full items-end justify-center gap-1" style={{ height: '100%' }}>
                <div
                  className="w-1/3 rounded-t bg-slate-600/60"
                  style={{ height: `${(p.bau / MAX) * 100}%` }}
                  title={`BAU ${p.bau}`}
                />
                <div
                  className="w-1/3 rounded-t bg-sky-500"
                  style={{ height: `${(p.target / MAX) * 100}%` }}
                  title={`목표 ${p.target}`}
                />
              </div>
              <span className="text-xs text-slate-500">{p.year}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-sm bg-slate-600/60" /> BAU
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-sm bg-sky-500" /> 감축목표 경로
          </span>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">이행수단별 감축 기여</h2>
        <div className="space-y-2">
          {MEASURES.map((m) => (
            <div key={m.name} className="flex items-center justify-between border-b border-white/[0.04] py-2 text-sm">
              <span className="text-slate-300">{m.name}</span>
              <Badge variant={m.variant}>-{m.tco2.toLocaleString()} tCO₂</Badge>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          감축수단은 RE100(REC)·탄소거래(KOC)·분산에너지 효율화와 연동된다. 목표 경로는 SBTi 기준(2018 대비 2030 -50%)을
          참고한다.
        </p>
      </Card>
    </div>
  );
}
