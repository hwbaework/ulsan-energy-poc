'use client';

import { useState } from 'react';
import { Plus, Zap } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Badge } from '@/components/edm/ui/Badge';
import { Button } from '@/components/edm/ui/Button';
import { Breadcrumb } from '@/components/edm/layout/Breadcrumb';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { useCarbonOtc, useCreateOtc } from '@/hooks/edm/useCarbon';
import { useCarbonMatches, useRunMatching } from '@/hooks/edm/useCarbonExt';

// 장외거래 — 설계 docs/기획/02 §2.9 · 기획 10 §3 (호가 등록·서버 매칭·수수료·ETRS 연계)
const ETRS_LABEL: Record<string, { label: string; variant: 'success' | 'warning' | 'default' }> = {
  FILED: { label: 'ETRS 신고완료', variant: 'success' },
  PENDING: { label: 'ETRS 신고예정', variant: 'warning' },
  NONE: { label: '미신고', variant: 'default' },
};

const MIN_AMOUNT = 1000; // 협의매매 게시 관례(1,000톤↑) — doc 02 §2.9

export default function OtcPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const companyName = useAuthStore((s) => s.user?.companyName);
  const toast = useToastStore((s) => s.add);
  const { data: OTC_ORDERS, isError } = useCarbonOtc(companyId);
  const { data: MATCHES } = useCarbonMatches(companyId);
  // 설계 22: 회사 미귀속/호출 실패 시 등록·매칭 차단(빈 실데이터는 허용).
  const canManage = companyId != null && !isError;
  const createOtc = useCreateOtc();
  const runMatching = useRunMatching();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ side: 'SELL', type: 'KAU', amount: '', price: '', note: '' });

  const submitOtc = () => {
    const amount = Number(form.amount);
    const price = Number(form.price);
    if (!companyId) return;
    if (!(amount >= MIN_AMOUNT)) {
      toast('error', `협의매매는 ${MIN_AMOUNT.toLocaleString()}톤 이상만 게시할 수 있습니다.`);
      return;
    }
    if (!(price > 0)) {
      toast('error', '단가를 입력하세요.');
      return;
    }
    createOtc.mutate(
      { companyId, company: companyName ?? String(companyId), side: form.side, type: form.type, amount, price },
      {
        onSuccess: () => {
          toast('success', '호가를 등록했습니다.');
          setShowForm(false);
          setForm({ side: 'SELL', type: 'KAU', amount: '', price: '', note: '' });
        },
        onError: (e: unknown) => toast('error', `등록 실패: ${e instanceof Error ? e.message : '오류'}`),
      },
    );
  };

  const runMatch = () => {
    if (!companyId) return;
    runMatching.mutate(companyId, {
      onSuccess: (res) => {
        const n = Array.isArray(res) ? res.length : 0;
        toast(n > 0 ? 'success' : 'info', n > 0 ? `${n}건 체결되었습니다.` : '체결 가능한 호가가 없습니다.');
      },
      onError: (e: unknown) => toast('error', `매칭 실패: ${e instanceof Error ? e.message : '오류'}`),
    });
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '카본 마켓플레이스', path: '/carbon' }, { label: '장외거래' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">장외거래 (협의매매)</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={runMatching.isPending}
            disabled={!canManage}
            onClick={runMatch}
          >
            <Zap size={15} /> 매칭 실행
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus size={15} /> 호가 등록
          </Button>
        </div>
      </div>
      <p className="text-xs text-slate-400">
        울산미포산단 기업 중심 배출권 협의매매(1,000톤↑ 게시·협상). 호가 대사로 매칭하고, 체결분은 ETRS 신고로
        연계합니다.
      </p>

      {showForm && (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <label className="text-xs text-slate-400">
              구분
              <select
                value={form.side}
                onChange={(e) => setForm({ ...form, side: e.target.value })}
                className="mt-1 w-full rounded-lg bg-white/[0.04] px-2 py-1.5 text-sm text-white ring-1 ring-white/[0.08]"
              >
                <option value="SELL">매도</option>
                <option value="BUY">매수</option>
              </select>
            </label>
            <label className="text-xs text-slate-400">
              종류
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="mt-1 w-full rounded-lg bg-white/[0.04] px-2 py-1.5 text-sm text-white ring-1 ring-white/[0.08]"
              >
                <option value="KAU">KAU</option>
                <option value="KOC">KOC</option>
                <option value="KCU">KCU</option>
              </select>
            </label>
            <label className="text-xs text-slate-400">
              수량(tCO₂eq)
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="≥ 1000"
                className="mt-1 w-full rounded-lg bg-white/[0.04] px-2 py-1.5 text-sm text-white ring-1 ring-white/[0.08]"
              />
            </label>
            <label className="text-xs text-slate-400">
              단가(원)
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="mt-1 w-full rounded-lg bg-white/[0.04] px-2 py-1.5 text-sm text-white ring-1 ring-white/[0.08]"
              />
            </label>
            <label className="text-xs text-slate-400">
              메모
              <input
                type="text"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="mt-1 w-full rounded-lg bg-white/[0.04] px-2 py-1.5 text-sm text-white ring-1 ring-white/[0.08]"
              />
            </label>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="cancel" size="sm" onClick={() => setShowForm(false)}>
              취소
            </Button>
            <Button variant="primary" size="sm" loading={createOtc.isPending} disabled={!canManage} onClick={submitOtc}>
              등록
            </Button>
          </div>
          {companyId == null && (
            <p className="text-right text-xs text-amber-400">회사 정보가 없어 등록할 수 없습니다.</p>
          )}
          {companyId != null && isError && (
            <p className="text-right text-xs text-amber-400">데이터를 불러오지 못했습니다 — 다시 로그인하세요</p>
          )}
        </Card>
      )}

      {MATCHES.length > 0 && (
        <Card className="border-emerald-500/20 bg-emerald-500/[0.05] p-4 space-y-1.5">
          <p className="text-xs font-semibold text-emerald-300">⚡ 체결 결과 ({MATCHES.length}건)</p>
          {MATCHES.map((m) => (
            <p key={m.id} className="text-xs text-emerald-200/90">
              {m.sellCompany}(매도) ↔ {m.buyCompany}(매수) · {m.certType} {m.amount.toLocaleString()} tCO₂eq @{' '}
              {m.price.toLocaleString()}원 · 수수료 매수 {m.feeBuy.toLocaleString()}원 / 매도{' '}
              {m.feeSell.toLocaleString()}원
            </p>
          ))}
        </Card>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">기업</th>
              <th className="px-4 py-3">구분</th>
              <th className="px-4 py-3">종류</th>
              <th className="px-4 py-3 text-right">수량</th>
              <th className="px-4 py-3 text-right">단가</th>
              <th className="px-4 py-3">ETRS</th>
            </tr>
          </thead>
          <tbody>
            {OTC_ORDERS.map((o) => (
              <tr key={o.id} className="border-b border-white/[0.04] text-slate-300">
                <td className="px-4 py-3">{o.company}</td>
                <td className="px-4 py-3">
                  <Badge variant={o.side === 'SELL' ? 'danger' : 'info'}>{o.side === 'SELL' ? '매도' : '매수'}</Badge>
                </td>
                <td className="px-4 py-3">{o.type}</td>
                <td className="px-4 py-3 text-right">{o.amount.toLocaleString()} tCO₂eq</td>
                <td className="px-4 py-3 text-right">{o.price.toLocaleString()}원</td>
                <td className="px-4 py-3">
                  <Badge variant={ETRS_LABEL[o.etrs]!.variant}>{ETRS_LABEL[o.etrs]!.label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
