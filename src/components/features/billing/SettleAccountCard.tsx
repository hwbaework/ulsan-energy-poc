'use client';

import { useState, type ReactNode } from 'react';
import { SectionCard } from '@/components/features';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { localNow } from '@/stores/useBillingStore';
import { BANKS, useHydrateSettleAccount, useSettleAccountStore } from '@/stores/useSettleAccountStore';

/**
 * 기업 정보 › 정산 계좌 — E-데이터마켓에서 내 데이터를 쓴 금액이 매달 15일에 들어오는 계좌.
 * 기업관리자만 등록 · 수정, 소속 멤버는 보기만
 */
export function SettleAccountCard({ companyId, companyName, canEdit }: { companyId: number; companyName: string; canEdit: boolean }) {
  useHydrateSettleAccount();
  const addToast = useToastStore((s) => s.add);
  const user = useAuthStore((s) => s.user);
  const account = useSettleAccountStore((s) => s.accounts[companyId]);
  const save = useSettleAccountStore((s) => s.save);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ bank: '', number: '', holder: '' });

  const start = () => {
    setForm({ bank: account?.bank ?? BANKS[0]!, number: account?.number ?? '', holder: account?.holder ?? companyName });
    setEditing(true);
  };
  const ok = form.bank && /^[0-9-]{8,20}$/.test(form.number.trim()) && form.holder.trim();
  const submit = () => {
    if (!ok) return;
    save(companyId, {
      bank: form.bank,
      number: form.number.trim(),
      holder: form.holder.trim(),
      updatedAt: localNow(),
      updatedBy: user?.name ?? '',
    });
    setEditing(false);
    addToast('success', '정산 계좌 저장');
  };

  const row = (k: string, v: ReactNode) => (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3 py-2.5">
      <dt className="text-sm text-slate-400">{k}</dt>
      <dd className="text-sm tabular-nums text-white">{v || '-'}</dd>
    </div>
  );

  return (
    <SectionCard
      title="정산 계좌"
      actions={
        !canEdit ? undefined : editing ? (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
              취소
            </Button>
            <Button size="sm" onClick={submit} disabled={!ok}>
              저장
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={start}>
            {account ? '수정' : '계좌 등록'}
          </Button>
        )
      }
    >
      {editing ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="은행"
            options={BANKS.map((b) => ({ value: b, label: b }))}
            value={form.bank}
            onChange={(e) => setForm({ ...form, bank: e.target.value })}
          />
          <Input
            label="계좌번호"
            value={form.number}
            onChange={(e) => setForm({ ...form, number: e.target.value.replace(/[^0-9-]/g, '') })}
            placeholder="숫자 · - 만"
            inputMode="numeric"
          />
          <Input label="예금주" value={form.holder} onChange={(e) => setForm({ ...form, holder: e.target.value })} />
        </div>
      ) : (
        <dl className="divide-y divide-white/[0.06]">
          {row('은행', account?.bank)}
          {row('계좌번호', account?.number)}
          {row('예금주', account?.holder)}
          {row('받는 날', account ? '매달 15일' : '')}
        </dl>
      )}
    </SectionCard>
  );
}
