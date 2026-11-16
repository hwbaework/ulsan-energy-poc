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
import { AccountLookupError, lookupAccountHolder, sameHolder } from '@/lib/account-verify';

import { LIMIT } from '@/lib/field-limits';
/**
 * 기업 정보 › 정산 계좌 — E-데이터마켓에서 내 데이터를 쓴 금액이 매달 15일에 들어오는 계좌. 관리자(SPC)가 이 계좌로 송금한다.
 * 기업관리자만 등록 · 수정, 소속 멤버는 보기만.
 * 예금주는 기업명으로 고정(기업이 받는 돈이라 개인 계좌는 안 된다). 저장하면 예금주 조회 → 기업명과 같으면 바로 저장, 다르면 알림만.
 * 저장 버튼은 늘 누를 수 있고 무엇이 빠졌는지 알림으로 알려 준다(기업 정보 수정과 같은 방식). 확인창은 두지 않는다(2026-11-16 사용자: 맞으면 볼 것이 없다)
 */
export function SettleAccountCard({
  companyId,
  companyName,
  businessNumber,
  canEdit,
}: {
  companyId: number;
  companyName: string;
  /** 사업자등록번호 — 예금주 조회 때 은행이 계좌 주인을 확인하는 값 */
  businessNumber: string;
  canEdit: boolean;
}) {
  useHydrateSettleAccount();
  const addToast = useToastStore((s) => s.add);
  const user = useAuthStore((s) => s.user);
  const account = useSettleAccountStore((s) => s.accounts[companyId]);
  const save = useSettleAccountStore((s) => s.save);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ bank: '', number: '' });
  const [busy, setBusy] = useState(false); // 예금주 조회 중

  const start = () => {
    setForm({ bank: account?.bank ?? BANKS[0]!, number: account?.number ?? '' });
    setEditing(true);
  };
  // 저장 — 빠진 값은 알림으로 → 예금주 조회 → 기업명과 다르면 저장하지 않음 → 같으면 바로 저장
  const submit = async () => {
    if (busy) return;
    const number = form.number.trim();
    const missing = [!form.bank && '은행', !number && '계좌번호'].filter(Boolean);
    if (missing.length) {
      addToast('error', `${missing.join(', ')}을(를) 입력해 주세요`);
      return;
    }
    if (!/^[0-9-]{8,20}$/.test(number)) {
      addToast('error', '계좌번호는 8~20자로 입력해 주세요');
      return;
    }
    setBusy(true);
    try {
      const holder = await lookupAccountHolder(form.bank, number, businessNumber, companyName);
      if (!sameHolder(holder, companyName)) {
        addToast('error', `예금주가 기업명과 다릅니다 — 조회 예금주 ${holder}`);
        return;
      }
      save(companyId, { bank: form.bank, number, holder, updatedAt: localNow(), updatedBy: user?.name ?? '' });
      setEditing(false);
      addToast('success', '정산 계좌 저장');
    } catch (e) {
      addToast('error', e instanceof AccountLookupError ? e.message : '예금주를 조회하지 못했습니다');
    } finally {
      setBusy(false);
    }
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
            {/* 취소 — 되돌리기 버튼이라 아이콘 없이, 기업 정보 · PPA 운전 일정과 같은 cancel */}
            <Button size="sm" variant="cancel" onClick={() => setEditing(false)} disabled={busy}>
              취소
            </Button>
            <Button size="sm" onClick={() => void submit()} loading={busy}>
              {busy ? '예금주 조회 중' : '저장'}
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
          <Input maxLength={LIMIT.account}
            label="계좌번호"
            value={form.number}
            onChange={(e) => setForm({ ...form, number: e.target.value.replace(/[^0-9-]/g, '') })}
            placeholder="숫자 · - 만"
            inputMode="numeric"
          />
          {/* 예금주 — 기업명 고정. 고칠 수 없는 칸은 비활성 입력칸 대신 글자(기업 정보 수정과 같은 규칙) */}
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-accent">예금주</span>
            <p className="flex h-10 items-center text-sm text-white">{companyName}</p>
          </div>
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
