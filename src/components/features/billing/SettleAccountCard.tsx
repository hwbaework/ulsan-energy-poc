'use client';

import { useState, type ReactNode } from 'react';
import { SectionCard } from '@/components/features';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { localNow } from '@/stores/useBillingStore';
import { BANKS, useHydrateSettleAccount, useSettleAccountStore } from '@/stores/useSettleAccountStore';
import { lookupAccountHolder, sameHolder } from '@/lib/account-verify';

/**
 * 기업 정보 › 정산 계좌 — E-데이터마켓에서 내 데이터를 쓴 금액이 매달 15일에 들어오는 계좌. 관리자(SPC)가 이 계좌로 송금한다.
 * 기업관리자만 등록 · 수정, 소속 멤버는 보기만.
 * 예금주는 기업명으로 고정(기업이 받는 돈이라 개인 계좌는 안 된다). 저장하면 예금주 조회 → 기업명과 같을 때만 확인창 → 저장(2026-11-09)
 */
export function SettleAccountCard({ companyId, companyName, canEdit }: { companyId: number; companyName: string; canEdit: boolean }) {
  useHydrateSettleAccount();
  const addToast = useToastStore((s) => s.add);
  const user = useAuthStore((s) => s.user);
  const account = useSettleAccountStore((s) => s.accounts[companyId]);
  const save = useSettleAccountStore((s) => s.save);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ bank: '', number: '' });
  const [busy, setBusy] = useState(false); // 예금주 조회 중
  const [verified, setVerified] = useState<string | null>(null); // 조회된 예금주 — 확인창

  const start = () => {
    setForm({ bank: account?.bank ?? BANKS[0]!, number: account?.number ?? '' });
    setEditing(true);
  };
  const ok = !!form.bank && /^[0-9-]{8,20}$/.test(form.number.trim());
  // 저장 — 예금주 조회 → 기업명과 다르면 저장하지 않음 → 같으면 확인창
  const submit = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      const holder = await lookupAccountHolder(form.bank, form.number.trim(), companyName);
      if (!sameHolder(holder, companyName)) {
        addToast('error', `예금주가 기업명과 다릅니다 — 조회 예금주 ${holder}`);
        return;
      }
      setVerified(holder);
    } catch {
      addToast('error', '예금주를 조회하지 못했습니다');
    } finally {
      setBusy(false);
    }
  };
  const confirmSave = () => {
    if (!verified) return;
    save(companyId, {
      bank: form.bank,
      number: form.number.trim(),
      holder: verified,
      updatedAt: localNow(),
      updatedBy: user?.name ?? '',
    });
    setVerified(null);
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
            {/* 취소 — 되돌리기 버튼이라 아이콘 없이, 기업 정보 · PPA 운전 일정과 같은 cancel */}
            <Button size="sm" variant="cancel" onClick={() => setEditing(false)} disabled={busy}>
              취소
            </Button>
            <Button size="sm" onClick={() => void submit()} disabled={!ok} loading={busy}>
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
          <Input
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

      {/* 예금주 확인 — 조회된 예금주가 기업명과 같을 때만 뜬다 */}
      <ConfirmDialog
        open={verified !== null}
        onClose={() => setVerified(null)}
        onConfirm={confirmSave}
        title="예금주 확인"
        message={`${form.bank} ${form.number.trim()} 예금주 ${verified ?? ''}. 기업명과 같아 저장합니다.`}
        confirmLabel="저장"
      />
    </SectionCard>
  );
}
