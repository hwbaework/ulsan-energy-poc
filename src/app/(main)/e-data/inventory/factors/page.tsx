'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Badge } from '@/components/edm/ui/Badge';
import { Button } from '@/components/edm/ui/Button';
import { Breadcrumb } from '@/components/edm/layout/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { useGhgFactors, useCreateFactor, type FactorRow, type FactorReq } from '@/hooks/edm/useGhgExt';

// 배출계수 관리 — 설계 docs/기획/01 rev.2 §3·§4 (IPCC/국가고유/사업장고유, Tier 1→3, 버전·유효기간)
// 인벤토리 전력계수(0.4781, 2021 승인) ≠ 감축 계수(0.4594) 분리 관리. /api/v1/ghg/factors 배선.
// 계수 추가 배선: 설계 11 §2.3 (계수 추가 모달 + useCreateFactor). 기존 행 수정 금지·신규 version 추가.

type Tier = 1 | 2 | 3;

const inputCls = 'mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-slate-200';
const labelCls = 'block text-xs text-slate-400';

const sourceBadge = (s: FactorRow['source']) =>
  s === '사업장고유' ? 'success' : s === '국가고유' ? 'info' : 'default';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function FactorsPage() {
  const [tier, setTier] = useState<'ALL' | Tier>('ALL');
  const { data: factors, isError } = useGhgFactors();
  const rows = factors.filter((f) => tier === 'ALL' || f.tier === tier);

  const create = useCreateFactor();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FactorReq>({
    code: '',
    name: '',
    factor: 0,
    unit: '',
    tier: 1,
    source: 'IPCC',
    validFrom: '',
    version: '',
  });
  const [factorStr, setFactorStr] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const guardReason = isError ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요' : '';
  const canOpen = !guardReason;

  const factorNum = Number(factorStr);
  const err = {
    code: form.code.trim() === '' ? '코드를 입력하세요' : '',
    name: form.name.trim() === '' ? '명칭을 입력하세요' : '',
    factor: factorStr.trim() === '' || !Number.isFinite(factorNum) || factorNum <= 0 ? '0보다 큰 수를 입력하세요' : '',
    unit: form.unit.trim() === '' ? '단위를 입력하세요' : '',
    validFrom: !ISO_DATE.test(form.validFrom) ? 'yyyy-MM-dd 형식으로 입력하세요' : '',
    version: form.version.trim() === '' ? '버전을 입력하세요' : '',
  };
  const valid = Object.values(err).every((e) => e === '');

  async function save() {
    if (!valid) return;
    setFeedback(null);
    try {
      await create.mutateAsync({ ...form, code: form.code.trim().toUpperCase(), factor: factorNum });
      setOpen(false);
      setForm({ code: '', name: '', factor: 0, unit: '', tier: 1, source: 'IPCC', validFrom: '', version: '' });
      setFactorStr('');
      setFeedback({ kind: 'ok', msg: '배출계수를 등록했습니다.' });
    } catch (e) {
      const conflict = (e as { response?: { status?: number } })?.response?.status === 409;
      setFeedback({
        kind: 'err',
        msg: conflict ? '이미 존재하는 코드입니다.' : '배출계수 등록 중 오류가 발생했습니다.',
      });
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '온실가스 인벤토리', path: '/e-data/inventory' }, { label: '배출계수 관리' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">배출계수 관리</h1>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setOpen(true)}
          disabled={!canOpen}
          title={guardReason || undefined}
        >
          <Plus size={15} /> 계수 추가
        </Button>
      </div>
      {guardReason && <p className="text-xs text-amber-400">저장 불가: {guardReason}</p>}
      {feedback && (
        <p className={`text-xs ${feedback.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{feedback.msg}</p>
      )}

      <div className="flex gap-2">
        {(['ALL', 1, 2, 3] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTier(t)}
            className={`rounded-lg px-3 py-1.5 text-xs ${tier === t ? 'bg-sky-500/20 text-sky-300' : 'bg-white/[0.03] text-slate-400'}`}
          >
            {t === 'ALL' ? '전체' : `Tier ${t}`}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">코드</th>
              <th className="px-4 py-3">명칭</th>
              <th className="px-4 py-3 text-right">배출계수</th>
              <th className="px-4 py-3">단위</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">출처</th>
              <th className="px-4 py-3">유효기간</th>
              <th className="px-4 py-3">버전</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.code} className="border-b border-white/[0.04] text-slate-300">
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{f.code}</td>
                <td className="px-4 py-3">{f.name}</td>
                <td className="px-4 py-3 text-right tabular-nums">{f.factor}</td>
                <td className="px-4 py-3 text-slate-400">{f.unit}</td>
                <td className="px-4 py-3">
                  <Badge variant="default">Tier {f.tier}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={sourceBadge(f.source)}>{f.source}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {f.validFrom}~ {f.expiring && <Badge variant="warning">갱신 임박</Badge>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{f.version}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-slate-500">
        계수 정밀도: Tier 1(IPCC 기본) → Tier 2(국가고유) → Tier 3(사업장 실측). 인벤토리 전력계수 0.4781(2021 승인)은
        감축 산정 계수 0.4594와 분리 관리하며, 변경 시 버전 이력을 보존해 재산정을 추적한다.
      </p>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="배출계수 추가"
        footer={
          <>
            <Button variant="cancel" size="sm" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button variant="primary" size="sm" onClick={save} disabled={!valid} loading={create.isPending}>
              저장
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <label className={labelCls}>
            코드 (대문자·_)
            <input
              className={inputCls}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="FUEL_LPG"
            />
            {err.code && <span className="mt-1 block text-xs text-red-400">{err.code}</span>}
          </label>
          <label className={labelCls}>
            명칭
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            {err.name && <span className="mt-1 block text-xs text-red-400">{err.name}</span>}
          </label>
          <label className={labelCls}>
            배출계수
            <input
              className={inputCls}
              type="number"
              min={0}
              step="0.0001"
              value={factorStr}
              onChange={(e) => setFactorStr(e.target.value)}
            />
            {err.factor && <span className="mt-1 block text-xs text-red-400">{err.factor}</span>}
          </label>
          <label className={labelCls}>
            단위
            <input
              className={inputCls}
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="tCO₂/TJ"
            />
            {err.unit && <span className="mt-1 block text-xs text-red-400">{err.unit}</span>}
          </label>
          <label className={labelCls}>
            Tier
            <select
              className={inputCls}
              value={form.tier}
              onChange={(e) => setForm({ ...form, tier: Number(e.target.value) as Tier })}
            >
              <option value={1}>Tier 1</option>
              <option value={2}>Tier 2</option>
              <option value={3}>Tier 3</option>
            </select>
          </label>
          <label className={labelCls}>
            출처
            <select
              className={inputCls}
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value as FactorReq['source'] })}
            >
              <option value="IPCC">IPCC 기본</option>
              <option value="NATIONAL">국가고유</option>
              <option value="SITE">사업장고유</option>
            </select>
          </label>
          <label className={labelCls}>
            유효 시작일 (yyyy-MM-dd)
            <input
              className={inputCls}
              type="date"
              value={form.validFrom}
              onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
            />
            {err.validFrom && <span className="mt-1 block text-xs text-red-400">{err.validFrom}</span>}
          </label>
          <label className={labelCls}>
            버전
            <input
              className={inputCls}
              value={form.version}
              onChange={(e) => setForm({ ...form, version: e.target.value })}
              placeholder="v2019.0"
            />
            {err.version && <span className="mt-1 block text-xs text-red-400">{err.version}</span>}
          </label>
        </div>
      </Modal>
    </div>
  );
}
