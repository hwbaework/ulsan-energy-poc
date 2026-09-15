'use client';

// 컨설팅 데스크 `/re100/desk` — doc04 §2-5 「컨설팅 데스크 | c·ct | 내 문의 ▸ 문의하기」.
// 06 §13.11 확정 스펙: 내 문의 목록 실훅(GET /desk)·문의하기(POST /desk)·티켓 상세 모달. MY_TICKETS 하드코딩 제거.
// 상태머신(19-02 §7): OPEN→ANSWERED→CLOSED. ?tab 딥링크(홈 quick-form 수신부).

import { useEffect, useState } from 'react';
import { MessageSquare, Send, HelpCircle, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Breadcrumb } from '@/components/layout';
import { useAuthStore } from '@/stores/useAuthStore';
import { useDeskTickets, useCreateDeskTicket, type DeskStatus, type DeskTicket } from '@/hooks/re100/useAchievements';

const CATEGORIES = ['제도', '이행수단', '거래', '인증', '기타'] as const;

const STATUS_META: Record<DeskStatus, { tone: string; label: string }> = {
  OPEN: { tone: 'bg-amber-500/10 text-amber-300', label: '미답변' },
  ANSWERED: { tone: 'bg-emerald-500/10 text-emerald-400', label: '답변완료' },
  CLOSED: { tone: 'bg-white/[0.05] text-slate-400', label: '종료' },
};

export default function Re100DeskPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [tab, setTab] = useState<'MY' | 'ASK'>(tabParam === 'new' ? 'ASK' : 'MY');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('제도');
  const [question, setQuestion] = useState('');
  const [detail, setDetail] = useState<DeskTicket | null>(null);

  useEffect(() => {
    if (tabParam === 'new') setTab('ASK');
    else if (tabParam === 'my') setTab('MY');
  }, [tabParam]);

  const ticketsQ = useDeskTickets(companyId);
  const createDesk = useCreateDeskTicket();
  const tickets = ticketsQ.data ?? [];

  const submit = () => {
    if (!companyId || !question.trim()) return;
    createDesk.mutate(
      { companyId, category, question: question.trim() },
      {
        onSuccess: () => {
          setQuestion('');
          setTab('MY');
        },
      },
    );
  };

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: 'RE100' }, { label: '컨설팅 데스크' }]} />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">컨설팅 데스크</h1>
          <p className="mt-1 text-sm text-slate-400">RE100 Q&A · 실무지원 (계획서 p.166 · 19-02 §7)</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(
          [
            ['MY', '내 문의'],
            ['ASK', '문의하기'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-lg px-3 py-1.5 text-xs ${tab === k ? 'bg-primary/20 text-primary' : 'bg-white/[0.03] text-slate-400 hover:text-slate-200'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === 'MY' ? (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02] flex items-center gap-2">
            <MessageSquare size={15} /> 내 문의 목록
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                <th className="px-4 py-3">카테고리</th>
                <th className="px-4 py-3">문의 내용</th>
                <th className="px-4 py-3">등록일</th>
                <th className="px-4 py-3">상태</th>
              </tr>
            </thead>
            <tbody>
              {ticketsQ.isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-500">
                    불러오는 중…
                  </td>
                </tr>
              ) : ticketsQ.isError ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-xs text-red-300">
                    문의 목록을 불러오지 못했습니다.
                  </td>
                </tr>
              ) : tickets.length ? (
                tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setDetail(t)}
                    className="cursor-pointer border-b border-white/[0.04] text-slate-300 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3 text-xs">
                      <span className="rounded bg-white/[0.05] px-2 py-0.5">{t.category}</span>
                    </td>
                    <td className="px-4 py-3">{t.question}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{t.createdAt}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-[11px] ${STATUS_META[t.status].tone}`}>
                        {STATUS_META[t.status].label}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-500">
                    등록된 문의가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 max-w-2xl space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <HelpCircle size={15} /> 새 문의 등록
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">카테고리</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">문의 내용</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={5}
              placeholder="RE100 제도·이행수단·거래·인증 관련 문의를 남겨주세요."
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500">문의 등록 시 컨설턴트 데스크 큐로 접수됩니다.</span>
            <button
              onClick={submit}
              disabled={!question.trim() || !companyId || createDesk.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-primary/20 px-3 py-2 text-xs text-primary disabled:opacity-40"
            >
              <Send size={13} /> 문의 등록
            </button>
          </div>
          {createDesk.isError && <div className="text-[11px] text-red-300">문의 등록에 실패했습니다.</div>}
        </div>
      )}

      {/* 티켓 상세 모달 (06 §13.11.1-3): question + answer + status 타임라인 */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-white/[0.08] bg-surface-card p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded bg-white/[0.05] px-2 py-0.5 text-[11px] text-slate-300">
                  {detail.category}
                </span>
                <span className={`rounded px-2 py-0.5 text-[11px] ${STATUS_META[detail.status].tone}`}>
                  {STATUS_META[detail.status].label}
                </span>
              </div>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div>
              <div className="text-xs text-slate-500">문의</div>
              <div className="mt-1 text-sm text-white">{detail.question}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">답변</div>
              <div className="mt-1 text-sm text-slate-300">{detail.answer ?? '아직 답변이 등록되지 않았습니다.'}</div>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span>등록 {detail.createdAt}</span>
              {detail.answeredAt && <span>· 답변 {detail.answeredAt}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
