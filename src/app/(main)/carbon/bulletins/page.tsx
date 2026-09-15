'use client';

import { useState } from 'react';
import { Plus, MessageSquare } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Badge } from '@/components/edm/ui/Badge';
import { Button } from '@/components/edm/ui/Button';
import { Breadcrumb } from '@/components/edm/layout/Breadcrumb';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import {
  useBulletins,
  useCreateBulletin,
  useUpdateBulletinStatus,
  useBulletinThreads,
  usePostThread,
  type Bulletin,
} from '@/hooks/edm/useCarbonDelta';

// 협의매매 호가판 — 기획 14 §4.1 (게시판형 호가 게시 + 협상 스레드). 주문형(carbon/otc)과 별도 개념.
const STATUS_LABEL: Record<Bulletin['status'], { label: string; variant: 'success' | 'warning' | 'default' }> = {
  OPEN: { label: '게시중', variant: 'success' },
  MATCHED: { label: '협상성립', variant: 'warning' },
  CLOSED: { label: '마감', variant: 'default' },
};

export default function BulletinsPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const companyName = useAuthStore((s) => s.user?.companyName);
  const toast = useToastStore((s) => s.add);
  const { data: BULLETINS } = useBulletins(undefined, undefined, 'OPEN');
  const createBulletin = useCreateBulletin();
  const updateStatus = useUpdateBulletinStatus();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ side: 'SELL', unitType: 'KAU', amount: '', price: '', note: '' });
  const [openThread, setOpenThread] = useState<number | null>(null);

  const submit = () => {
    const amount = Number(form.amount);
    const price = Number(form.price);
    if (!companyId) return;
    if (!(amount > 0)) {
      toast('error', '수량을 입력하세요.');
      return;
    }
    if (!(price > 0)) {
      toast('error', '단가를 입력하세요.');
      return;
    }
    createBulletin.mutate(
      {
        companyId,
        company: companyName ?? String(companyId),
        side: form.side,
        unitType: form.unitType,
        amount,
        price,
        note: form.note,
      },
      {
        onSuccess: () => {
          toast('success', '호가를 게시했습니다.');
          setShowForm(false);
          setForm({ side: 'SELL', unitType: 'KAU', amount: '', price: '', note: '' });
        },
        onError: (e: unknown) => toast('error', `게시 실패: ${e instanceof Error ? e.message : '오류'}`),
      },
    );
  };

  const transition = (id: number, status: string) => {
    updateStatus.mutate(
      { id, status },
      {
        onSuccess: () => toast('success', '상태를 변경했습니다.'),
        onError: (e: unknown) => toast('error', `변경 실패: ${e instanceof Error ? e.message : '오류'}`),
      },
    );
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '카본 마켓플레이스', path: '/carbon' }, { label: '협의매매 호가판' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">협의매매 호가판</h1>
        <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus size={15} /> 호가 게시
        </Button>
      </div>
      <p className="text-xs text-slate-400">
        게시판형 호가 게시 후 상대와 협상 스레드로 조율합니다(주문형 장외거래와 별개). 성립 시 상태를 성립→마감으로
        전이합니다.
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
                value={form.unitType}
                onChange={(e) => setForm({ ...form, unitType: e.target.value })}
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
            <Button variant="primary" size="sm" loading={createBulletin.isPending} onClick={submit}>
              게시
            </Button>
          </div>
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
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">협상/전이</th>
            </tr>
          </thead>
          <tbody>
            {BULLETINS.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-xs text-slate-500">
                  게시된 호가가 없습니다.
                </td>
              </tr>
            )}
            {BULLETINS.map((b) => (
              <tr key={b.id} className="border-b border-white/[0.04] text-slate-300 align-top">
                <td className="px-4 py-3">{b.company}</td>
                <td className="px-4 py-3">
                  <Badge variant={b.side === 'SELL' ? 'danger' : 'info'}>{b.side === 'SELL' ? '매도' : '매수'}</Badge>
                </td>
                <td className="px-4 py-3">{b.unitType}</td>
                <td className="px-4 py-3 text-right">{b.amount.toLocaleString()} tCO₂eq</td>
                <td className="px-4 py-3 text-right">{b.price.toLocaleString()}원</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_LABEL[b.status].variant}>{STATUS_LABEL[b.status].label}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => setOpenThread(openThread === b.id ? null : b.id)}>
                      <MessageSquare size={13} /> 협상
                    </Button>
                    {b.status === 'OPEN' && (
                      <Button variant="secondary" size="sm" onClick={() => transition(b.id, 'MATCHED')}>
                        성립
                      </Button>
                    )}
                    {b.status !== 'CLOSED' && (
                      <Button variant="cancel" size="sm" onClick={() => transition(b.id, 'CLOSED')}>
                        마감
                      </Button>
                    )}
                  </div>
                  {openThread === b.id && (
                    <ThreadPanel bulletinId={b.id} companyName={companyName ?? String(companyId)} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ThreadPanel({ bulletinId, companyName }: { bulletinId: number; companyName: string }) {
  const toast = useToastStore((s) => s.add);
  const { data: threads } = useBulletinThreads(bulletinId);
  const postThread = usePostThread();
  const [msg, setMsg] = useState('');

  const send = () => {
    if (!msg.trim()) return;
    postThread.mutate(
      { id: bulletinId, fromCompany: companyName, message: msg },
      {
        onSuccess: () => {
          setMsg('');
        },
        onError: (e: unknown) => toast('error', `전송 실패: ${e instanceof Error ? e.message : '오류'}`),
      },
    );
  };

  return (
    <div className="mt-2 w-80 max-w-full space-y-1.5 rounded-lg bg-white/[0.03] p-2">
      {threads.length === 0 && <p className="text-xs text-slate-500">협상 메시지가 없습니다.</p>}
      {threads.map((t) => (
        <p key={t.id} className="text-xs text-slate-300">
          <span className="font-semibold text-slate-200">{t.fromCompany}</span>: {t.message}
        </p>
      ))}
      <div className="flex items-center gap-1.5 pt-1">
        <input
          type="text"
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="메시지"
          className="flex-1 rounded-lg bg-white/[0.04] px-2 py-1 text-xs text-white ring-1 ring-white/[0.08]"
        />
        <Button variant="primary" size="sm" loading={postThread.isPending} onClick={send}>
          전송
        </Button>
      </div>
    </div>
  );
}
