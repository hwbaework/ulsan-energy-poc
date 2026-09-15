'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Badge } from '@/components/edm/ui/Badge';
import { Button } from '@/components/edm/ui/Button';
import { Breadcrumb } from '@/components/edm/layout/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/useAuthStore';
import { useGhgScope3, useUpsertScope3, SCOPE3_NAMES } from '@/hooks/edm/useGhgExt';

// Scope 3 — 설계 docs/기획/01 rev.2 §3 (가치사슬 15카테고리 + 공급사 데이터 수집 포털)
// /api/v1/ghg/scope3 배선 (미가동 시 폴백)
// 등록/갱신 배선: 설계 11 §2.4 (upsert 모달 + useUpsertScope3). (company_id,year,category) UNIQUE.

const YEAR = 2026;
const inputCls = 'mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-slate-200';
const labelCls = 'block text-xs text-slate-400';

interface Req {
  supplier: string;
  category: string;
  status: '요청' | '제출' | '검증완료';
}
const REQUESTS: Req[] = [
  { supplier: '롯데이네오스화학', category: '구매한 제품·서비스', status: '검증완료' },
  { supplier: '한화임팩트', category: '업스트림 운송·물류', status: '제출' },
  { supplier: 'SK어드밴스드', category: '구매한 제품·서비스', status: '요청' },
];

const reqBadge = (s: Req['status']) => (s === '검증완료' ? 'success' : s === '제출' ? 'info' : 'warning');

export default function Scope3Page() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const { data: CATEGORIES, isError } = useGhgScope3(companyId);
  const total = CATEGORIES.reduce((a, c) => a + (c.tco2 ?? 0), 0);

  const upsert = useUpsertScope3();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    category: number;
    tco2: string;
    method: 'PRIMARY' | 'SPEND';
    material: boolean;
    evidence: string;
  }>({
    category: 1,
    tco2: '',
    method: 'PRIMARY',
    material: false,
    evidence: '',
  });
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const guardReason =
    companyId == null
      ? '회사 정보가 없어 저장할 수 없습니다'
      : isError
        ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
        : '';
  const canOpen = !guardReason;

  const tco2Num = Number(form.tco2);
  const err = {
    tco2: form.tco2.trim() === '' || !Number.isFinite(tco2Num) || tco2Num < 0 ? '0 이상의 수를 입력하세요' : '',
  };
  const valid = !err.tco2;

  async function save() {
    if (!valid || companyId == null) return;
    setFeedback(null);
    try {
      await upsert.mutateAsync({
        companyId,
        year: YEAR,
        category: form.category,
        tco2: tco2Num,
        method: form.method,
        material: form.material,
        evidence: form.evidence.trim() || null,
      });
      setOpen(false);
      setForm({ category: 1, tco2: '', method: 'PRIMARY', material: false, evidence: '' });
      setFeedback({ kind: 'ok', msg: 'Scope 3 카테고리를 저장했습니다.' });
    } catch {
      setFeedback({ kind: 'err', msg: 'Scope 3 저장 중 오류가 발생했습니다.' });
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '온실가스 인벤토리', path: '/e-data/inventory' }, { label: 'Scope 3' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Scope 3 · 가치사슬 배출</h1>
        <span className="text-sm text-slate-400">
          합계 <b className="text-white tabular-nums">{total.toLocaleString()}</b> tCO₂eq
        </span>
      </div>
      {guardReason && <p className="text-xs text-amber-400">저장 불가: {guardReason}</p>}
      {feedback && (
        <p className={`text-xs ${feedback.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{feedback.msg}</p>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">Cat.</th>
              <th className="px-4 py-3">카테고리</th>
              <th className="px-4 py-3">중대성</th>
              <th className="px-4 py-3 text-right">배출량</th>
              <th className="px-4 py-3">산정법</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((c) => (
              <tr key={c.no} className="border-b border-white/[0.04] text-slate-300">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.no}</td>
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3">
                  {c.material ? <Badge variant="info">중대</Badge> : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {c.tco2 != null ? c.tco2.toLocaleString() : <span className="text-slate-600">미착수</span>}
                </td>
                <td className="px-4 py-3 text-slate-400">{c.method ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-semibold text-white">공급사 데이터 수집</h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setOpen(true)}
            disabled={!canOpen}
            title={guardReason || undefined}
          >
            <Send size={14} /> 데이터 요청
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">공급사</th>
              <th className="px-4 py-3">카테고리</th>
              <th className="px-4 py-3">상태</th>
            </tr>
          </thead>
          <tbody>
            {REQUESTS.map((r, i) => (
              <tr key={i} className="border-b border-white/[0.04] text-slate-300">
                <td className="px-4 py-3">{r.supplier}</td>
                <td className="px-4 py-3 text-slate-400">{r.category}</td>
                <td className="px-4 py-3">
                  <Badge variant={reqBadge(r.status)}>{r.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-slate-500">
        중대(material) 카테고리 우선 산정 후 확대. 1차 데이터(공급사 실측)를 우선하고 미확보 시 spend-based로 추정한다.
      </p>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Scope 3 카테고리 등록/갱신"
        footer={
          <>
            <Button variant="cancel" size="sm" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button variant="primary" size="sm" onClick={save} disabled={!valid} loading={upsert.isPending}>
              저장
            </Button>
          </>
        }
      >
        <p className="mb-4 text-xs text-slate-500">동일 카테고리 재저장 시 기존 값이 갱신됩니다 (연도 {YEAR}).</p>
        <div className="grid grid-cols-2 gap-4">
          <label className={`${labelCls} col-span-2`}>
            카테고리
            <select
              className={inputCls}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: Number(e.target.value) })}
            >
              {Array.from({ length: 15 }, (_, i) => i + 1).map((no) => (
                <option key={no} value={no}>
                  {no}. {SCOPE3_NAMES[no]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            배출량 (tCO₂eq)
            <input
              className={inputCls}
              type="number"
              min={0}
              step="0.001"
              value={form.tco2}
              onChange={(e) => setForm({ ...form, tco2: e.target.value })}
            />
            {err.tco2 && <span className="mt-1 block text-xs text-red-400">{err.tco2}</span>}
          </label>
          <label className={labelCls}>
            산정법
            <select
              className={inputCls}
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value as 'PRIMARY' | 'SPEND' })}
            >
              <option value="PRIMARY">1차 데이터</option>
              <option value="SPEND">spend-based</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={form.material}
              onChange={(e) => setForm({ ...form, material: e.target.checked })}
            />
            중대성 (material)
          </label>
          <label className={`${labelCls} col-span-2`}>
            증빙 (공급사 실측/spend 근거)
            <input
              className={inputCls}
              value={form.evidence}
              onChange={(e) => setForm({ ...form, evidence: e.target.value })}
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
