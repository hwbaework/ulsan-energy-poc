'use client';

import { useMemo, useState } from 'react';
import { Plus, Building2, Landmark, Wallet } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { useToastStore } from '@/stores/useToastStore';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  useSpcList,
  useCreateSpc,
  usePayoutAccounts,
  useCreatePayoutAccount,
  useDistribution,
  useAllocate,
  usePayDistribution,
  type DistributionRes,
} from '@/hooks/ppa/useDistribution';

/* PPA(태양광) 수익배분 — SPC 등록 · 발전사 수령 계좌 · 배분 실행/지급 (설계문서 25 §3)
 * 배분 대상 발전사는 백엔드가 발전소 owner 로 자동 해석한다. UX 는 등록·조회·실행만 담당. */

const ENERGY_DOMAIN_OPTIONS = [
  { value: 'SOLAR', label: '태양광 (SOLAR)' },
  { value: 'WIND', label: '풍력 (WIND)' },
  { value: 'ESS', label: 'ESS' },
  { value: 'FUEL_CELL', label: '연료전지 (FUEL_CELL)' },
] as const;

function won(v?: number): string {
  return typeof v === 'number' ? `₩${v.toLocaleString()}` : '—';
}

export default function PlatformPpaDistributionPage() {
  const companyId = useAuthStore((s) => s.user?.companyId) ?? 0;

  /* ─── 데이터 ─── */
  const spcQ = useSpcList();
  const createSpcMut = useCreateSpc();
  const payoutQ = usePayoutAccounts(companyId || undefined);
  const createPayoutMut = useCreatePayoutAccount();
  const distQ = useDistribution(companyId || undefined);
  const allocateMut = useAllocate();
  const payMut = usePayDistribution();

  const spcList = spcQ.data ?? [];
  const payoutAccounts = payoutQ.data ?? [];
  const distributions = distQ.data ?? [];

  /* ─── SPC 등록 폼 ─── */
  const [spcDomain, setSpcDomain] = useState<string>('SOLAR');
  const [spcCompanyId, setSpcCompanyId] = useState('');
  const [spcFeeRate, setSpcFeeRate] = useState('');
  const spcValid = !!spcCompanyId.trim();
  const submitSpc = async () => {
    if (!spcValid) return;
    try {
      await createSpcMut.mutateAsync({
        spcCompanyId: Number(spcCompanyId),
        energyDomain: spcDomain,
        feeRate: spcFeeRate.trim() ? Number(spcFeeRate) : undefined,
      });
      useToastStore.getState().add('success', 'SPC가 등록되었습니다');
      setSpcCompanyId('');
      setSpcFeeRate('');
    } catch {
      useToastStore.getState().add('error', 'SPC 등록에 실패했습니다');
    }
  };

  /* ─── 수령 계좌 등록 폼 ─── */
  const [acctCompanyId, setAcctCompanyId] = useState(companyId ? String(companyId) : '');
  const [acctBankCode, setAcctBankCode] = useState('');
  const [acctNo, setAcctNo] = useState('');
  const [acctHolder, setAcctHolder] = useState('');
  const acctValid = !!acctCompanyId.trim() && !!acctBankCode.trim() && !!acctNo.trim() && !!acctHolder.trim();
  const submitAccount = async () => {
    if (!acctValid) return;
    try {
      await createPayoutMut.mutateAsync({
        companyId: Number(acctCompanyId),
        bankCode: acctBankCode.trim(),
        accountNo: acctNo.trim(),
        holderName: acctHolder.trim(),
      });
      useToastStore.getState().add('success', '수령 계좌가 등록되었습니다');
      setAcctBankCode('');
      setAcctNo('');
      setAcctHolder('');
    } catch {
      useToastStore.getState().add('error', '수령 계좌 등록에 실패했습니다');
    }
  };

  /* ─── 배분 실행 (settlementId 지정 allocate) ─── */
  const [allocateId, setAllocateId] = useState('');
  const runAllocate = async () => {
    const id = Number(allocateId);
    if (!id) return;
    try {
      await allocateMut.mutateAsync(id);
      useToastStore.getState().add('success', `정산 #${id} 배분을 실행했습니다`);
      setAllocateId('');
    } catch {
      useToastStore.getState().add('error', '배분 실행에 실패했습니다');
    }
  };

  const payRow = async (row: DistributionRes) => {
    try {
      await payMut.mutateAsync({ settlementId: row.settlementId });
      useToastStore.getState().add('success', `정산 #${row.settlementId} 지급 처리했습니다`);
    } catch {
      useToastStore.getState().add('error', '지급 처리에 실패했습니다');
    }
  };

  const pendingCount = useMemo(() => distributions.filter((d) => d.payStatus === 'PENDING').length, [distributions]);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: '전력거래', path: '/platform/trading' }, { label: '직접 PPA' }, { label: '수익배분' }]}
      />

      <div>
        <h1 className="text-2xl font-bold text-white">PPA 수익배분</h1>
        <p className="mt-1 text-sm text-slate-400">
          SPC·발전사 수령 계좌 등록 후, 정산 건별로 플랫폼 수수료를 차감해 발전사에 배분·지급합니다.
        </p>
      </div>

      {/* ───────────────── SPC 등록/목록 ───────────────── */}
      <section className="rounded-lg border border-white/[0.06] bg-surface-card overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-amber-400" />
            <h3 className="text-md font-semibold text-white">SPC 등록</h3>
            <Badge variant="primary">{spcList.length}건</Badge>
          </div>
        </div>

        {/* 등록 폼 */}
        <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-4 border-b border-white/[0.06]">
          <div>
            <label className="block text-xs text-accent mb-1.5">에너지 도메인 *</label>
            <Select
              options={ENERGY_DOMAIN_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={spcDomain}
              onChange={(e) => setSpcDomain(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-accent mb-1.5">SPC 법인 회사 ID *</label>
            <Input
              type="number"
              min={1}
              placeholder="예: 12"
              value={spcCompanyId}
              onChange={(e) => setSpcCompanyId(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-accent mb-1.5">운영 수수료율 (0~1)</label>
            <Input
              type="number"
              min={0}
              max={1}
              step="0.01"
              placeholder="미지정 시 0.03"
              value={spcFeeRate}
              onChange={(e) => setSpcFeeRate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="primary"
              className="w-full"
              disabled={!spcValid}
              loading={createSpcMut.isPending}
              onClick={submitSpc}
            >
              <Plus size={14} className="mr-1" /> SPC 등록
            </Button>
          </div>
        </div>

        {/* 목록 */}
        {spcQ.isLoading ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">불러오는 중…</div>
        ) : spcList.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">등록된 SPC가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                  <th className="px-4 py-2 text-left font-medium">ID</th>
                  <th className="px-4 py-2 text-left font-medium">명칭</th>
                  <th className="px-4 py-2 text-left font-medium">도메인</th>
                  <th className="px-4 py-2 text-left font-medium">법인 회사 ID</th>
                  <th className="px-4 py-2 text-left font-medium">수수료율</th>
                  <th className="px-4 py-2 text-left font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {spcList.map((s) => (
                  <tr key={s.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-xs text-slate-400 tabular-nums">{s.id}</td>
                    <td className="px-4 py-3 text-sm text-white font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">{s.energyDomain}</td>
                    <td className="px-4 py-3 text-xs text-slate-300 tabular-nums">{s.spcCompanyId}</td>
                    <td className="px-4 py-3 text-xs text-slate-300 tabular-nums">
                      {typeof s.feeRate === 'number' ? `${(s.feeRate * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={s.status === 'ACTIVE' ? 'success' : 'default'}>{s.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ───────────────── 발전사 수령 계좌 등록/목록 ───────────────── */}
      <section className="rounded-lg border border-white/[0.06] bg-surface-card overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Landmark size={16} className="text-sky-400" />
            <h3 className="text-md font-semibold text-white">발전사 수령 계좌</h3>
            <Badge variant="primary">{payoutAccounts.length}건</Badge>
          </div>
        </div>

        {/* 등록 폼 */}
        <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-5 border-b border-white/[0.06]">
          <div>
            <label className="block text-xs text-accent mb-1.5">발전사 회사 ID *</label>
            <Input
              type="number"
              min={1}
              placeholder="예: 34"
              value={acctCompanyId}
              onChange={(e) => setAcctCompanyId(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-accent mb-1.5">은행 코드 *</label>
            <Input placeholder="예: 004" value={acctBankCode} onChange={(e) => setAcctBankCode(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-accent mb-1.5">계좌번호 *</label>
            <Input placeholder="예: 110-123-456789" value={acctNo} onChange={(e) => setAcctNo(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-accent mb-1.5">예금주 *</label>
            <Input placeholder="예: (주)한일튜브" value={acctHolder} onChange={(e) => setAcctHolder(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              variant="primary"
              className="w-full"
              disabled={!acctValid}
              loading={createPayoutMut.isPending}
              onClick={submitAccount}
            >
              <Plus size={14} className="mr-1" /> 계좌 등록
            </Button>
          </div>
        </div>

        {/* 목록 */}
        {payoutQ.isLoading ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">불러오는 중…</div>
        ) : payoutAccounts.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">등록된 수령 계좌가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                  <th className="px-4 py-2 text-left font-medium">ID</th>
                  <th className="px-4 py-2 text-left font-medium">회사 ID</th>
                  <th className="px-4 py-2 text-left font-medium">은행</th>
                  <th className="px-4 py-2 text-left font-medium">계좌번호 (마스킹)</th>
                  <th className="px-4 py-2 text-left font-medium">예금주</th>
                  <th className="px-4 py-2 text-left font-medium">대표</th>
                </tr>
              </thead>
              <tbody>
                {payoutAccounts.map((a) => (
                  <tr key={a.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-xs text-slate-400 tabular-nums">{a.id}</td>
                    <td className="px-4 py-3 text-xs text-slate-300 tabular-nums">{a.companyId}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">{a.bankCode}</td>
                    <td className="px-4 py-3 text-sm text-white tabular-nums">{a.accountNo}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">{a.holderName}</td>
                    <td className="px-4 py-3">
                      {a.isPrimary ? (
                        <Badge variant="success">대표</Badge>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ───────────────── 배분 내역 ───────────────── */}
      <section className="rounded-lg border border-white/[0.06] bg-surface-card overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-emerald-400" />
            <h3 className="text-md font-semibold text-white">배분 내역</h3>
            <Badge variant="primary">{distributions.length}건</Badge>
            {pendingCount > 0 && <Badge variant="warning">미지급 {pendingCount}</Badge>}
          </div>
          {/* 정산 건 배분 실행 (allocate) */}
          <div className="flex items-end gap-2">
            <Input
              type="number"
              min={1}
              placeholder="정산 ID"
              className="w-28"
              value={allocateId}
              onChange={(e) => setAllocateId(e.target.value)}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={!allocateId.trim()}
              loading={allocateMut.isPending}
              onClick={runAllocate}
            >
              배분 실행
            </Button>
          </div>
        </div>

        {distQ.isLoading ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">불러오는 중…</div>
        ) : distributions.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-slate-400">배분 내역이 없습니다.</p>
            <p className="mt-1 text-xs text-slate-500">
              상단에 정산 ID를 입력하고 &apos;배분 실행&apos;을 눌러 배분을 생성하세요.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                  <th className="px-4 py-2 text-left font-medium">정산 ID</th>
                  <th className="px-4 py-2 text-left font-medium">기간</th>
                  <th className="px-4 py-2 text-left font-medium">수령 발전사</th>
                  <th className="px-4 py-2 text-left font-medium">수령 계좌</th>
                  <th className="px-4 py-2 text-right font-medium">플랫폼 수수료</th>
                  <th className="px-4 py-2 text-right font-medium">발전사 배분</th>
                  <th className="px-4 py-2 text-left font-medium">지급 상태</th>
                  <th className="px-4 py-2 text-left font-medium">처리</th>
                </tr>
              </thead>
              <tbody>
                {distributions.map((d) => (
                  <tr key={d.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-xs text-slate-300 tabular-nums">{d.settlementId}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{d.period ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-white">
                      {d.recipientCompanyName ?? (d.recipientCompanyId ? `#${d.recipientCompanyId}` : '—')}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300 tabular-nums">{d.payoutAccountNo ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-300 tabular-nums text-right">{won(d.platformFee)}</td>
                    <td className="px-4 py-3 text-sm text-emerald-300 tabular-nums text-right font-medium">
                      {won(d.generatorPayout)}
                    </td>
                    <td className="px-4 py-3">
                      {d.payStatus === 'PAID' ? (
                        <Badge variant="success">지급 완료</Badge>
                      ) : (
                        <Badge variant="warning">미지급</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={allocateMut.isPending}
                          onClick={async () => {
                            try {
                              await allocateMut.mutateAsync(d.settlementId);
                              useToastStore.getState().add('success', `정산 #${d.settlementId} 재배분했습니다`);
                            } catch {
                              useToastStore.getState().add('error', '배분 실행에 실패했습니다');
                            }
                          }}
                        >
                          배분 실행
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={d.payStatus === 'PAID' || payMut.isPending}
                          onClick={() => payRow(d)}
                        >
                          지급
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
