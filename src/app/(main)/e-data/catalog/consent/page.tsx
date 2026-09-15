'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Badge } from '@/components/edm/ui/Badge';
import { Button } from '@/components/edm/ui/Button';
import { Breadcrumb } from '@/components/edm/layout/Breadcrumb';
import { useAuthStore } from '@/stores/useAuthStore';
import { useDmConsents, useCreateConsent } from '@/hooks/edm/useDm';

// 데이터 소유권·동의 — 설계 docs/기획/03 rev.2 §5.1 + 설계 12 §5 (법적 게이트: 데이터 3법·비식별 5기법·수익배분)
// 동의 없는 데이터셋은 PUBLISHED 불가 (하드 게이트 — 서버 강제). POST /api/v1/datamarket/consents 서명 배선.

const inputCls =
  'mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';
const DEIDENT = ['가명처리', '총계처리', '값삭제', '범주화', '마스킹'];

export default function ConsentPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const { data: CONSENTS } = useDmConsents(companyId);
  const createConsent = useCreateConsent();

  // controlled 폼 (설계 12 §5.2) — defaultValue → useState
  const [datasetId, setDatasetId] = useState('');
  const [datasetLabel, setDatasetLabel] = useState('');
  const [scope, setScope] = useState<'AGGREGATED' | 'RAW_DESIGNATED'>('AGGREGATED');
  const [checked, setChecked] = useState<string[]>(DEIDENT.slice(0, 2));
  const [signer, setSigner] = useState('');
  const [signed, setSigned] = useState(false);
  const [msg, setMsg] = useState('');
  const toggle = (d: string) => setChecked((c) => (c.includes(d) ? c.filter((x) => x !== d) : [...c, d]));

  const canSign = signed && signer.trim() !== '' && Number(datasetId) > 0 && !createConsent.isPending;

  async function handleSign() {
    setMsg('');
    try {
      const res = await createConsent.mutateAsync({
        datasetId: Number(datasetId),
        companyId,
        scope,
        methods: checked.join(','),
      });
      setMsg(
        res.isLive
          ? '동의가 등록·서명되었습니다. 현황이 갱신됩니다.'
          : '동의 서명(로컬 낙관 — BE 미가동, isLive:false).',
      );
      setSigned(false);
    } catch {
      setMsg('동의 등록 중 오류가 발생했습니다. 다시 시도해 주세요.');
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '데이터 카탈로그', path: '/e-data/catalog' }, { label: '소유권·동의' }]} />
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-white">데이터 제공 동의</h1>
        <Badge variant="danger">법적 게이트</Badge>
      </div>
      <p className="text-xs text-slate-400">
        데이터 3법·데이터산업진흥법에 따라 제공 동의·비식별·수익배분을 확정합니다.{' '}
        <span className="text-amber-300">동의 없는 데이터셋은 게시(PUBLISHED)할 수 없습니다.</span>
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-white">
            <ShieldCheck size={15} /> 동의 등록
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-slate-400">
              데이터셋 ID *
              <input
                value={datasetId}
                onChange={(e) => setDatasetId(e.target.value)}
                placeholder="예: 5"
                className={inputCls}
              />
            </label>
            <label className="block text-xs text-slate-400">
              데이터셋명(표시용)
              <input
                value={datasetLabel}
                onChange={(e) => setDatasetLabel(e.target.value)}
                placeholder="연료전지 배열 운전 데이터"
                className={inputCls}
              />
            </label>
          </div>
          <label className="mt-3 block text-xs text-slate-400">
            제공 범위
            <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className={inputCls}>
              <option value="AGGREGATED">비식별 집계만 (권장)</option>
              <option value="RAW_DESIGNATED">원천 시계열 (기업 지정 구매자)</option>
            </select>
          </label>
          <div className="mt-3 text-xs text-slate-400">
            비식별 처리 (5기법)
            <div className="mt-2 flex flex-wrap gap-2">
              {DEIDENT.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggle(d)}
                  className={`rounded-lg px-2.5 py-1 text-xs ${checked.includes(d) ? 'bg-sky-500/20 text-sky-300' : 'bg-white/[0.03] text-slate-400'}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
            수익 배분 — <span className="text-white">판매자 85% / 플랫폼 15%</span> (고정)
          </div>
          <label className="mt-3 block text-xs text-slate-400">
            서명자 *
            <input
              value={signer}
              onChange={(e) => setSigner(e.target.value)}
              placeholder="담당자명"
              className={inputCls}
            />
          </label>
          <label className="mt-3 flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={signed}
              onChange={(e) => setSigned(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span className="text-xs text-slate-400">위 내용에 동의하며 전자서명합니다 (서명 시각 자동 기록).</span>
          </label>
          <Button
            variant="primary"
            size="sm"
            className="mt-4"
            disabled={!canSign}
            loading={createConsent.isPending}
            onClick={handleSign}
          >
            동의 등록 · 서명
          </Button>
          {msg && <p className="mt-2 text-xs text-sky-300">{msg}</p>}
        </Card>

        <Card className="overflow-hidden">
          <h2 className="px-4 py-3 text-sm font-semibold text-white">동의 현황</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-white/[0.06] text-left text-xs text-slate-500">
                <th className="px-4 py-3">데이터셋</th>
                <th className="px-4 py-3">범위</th>
                <th className="px-4 py-3">상태</th>
              </tr>
            </thead>
            <tbody>
              {CONSENTS.map((c, i) => (
                <tr key={i} className="border-b border-white/[0.04] text-slate-300">
                  <td className="px-4 py-3">{c.dataset}</td>
                  <td className="px-4 py-3 text-slate-400">{c.scope}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.status === '동의완료' ? 'success' : 'warning'}>{c.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <p className="text-xs text-slate-500">
        비식별 5기법: 가명처리·총계처리·값삭제·범주화·마스킹. 재식별 위험 검토 후 처리 수준을 정의한다.
      </p>
    </div>
  );
}
