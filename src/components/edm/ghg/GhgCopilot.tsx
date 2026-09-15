'use client';

import { useState } from 'react';
import { Sparkles, X, AlertTriangle, Wand2, MessageCircleQuestion } from 'lucide-react';

// AI 보조 코파일럿 — 설계 docs/기획/01 rev.2 §3·화면설계서 §1.2 공통
// 이상치 탐지 · spend→계수 자동매핑 · 산정 가이드 챗봇 (온실가스 전 화면 우하단 고정)

const QUICK = [
  { icon: AlertTriangle, label: '이상치 탐지', hint: '전월 대비 활동자료 이상값 확인' },
  { icon: Wand2, label: '계수 자동매핑', hint: '구매·청구 데이터를 배출계수에 연결' },
  { icon: MessageCircleQuestion, label: '산정 가이드', hint: '표준·산정법 Q&A' },
];

export function GhgCopilot() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="mb-3 w-80 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f1622] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
              <Sparkles size={15} className="text-sky-400" /> GHG 코파일럿
            </span>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2 p-4">
            <p className="text-xs text-slate-400">무엇을 도와드릴까요? 배출량 산정·검증을 지원합니다.</p>
            {QUICK.map((q) => (
              <button
                key={q.label}
                className="flex w-full items-start gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-left transition-colors hover:border-sky-500/30 hover:bg-sky-500/[0.05]"
              >
                <q.icon size={15} className="mt-0.5 shrink-0 text-sky-400" />
                <span>
                  <span className="block text-sm text-slate-200">{q.label}</span>
                  <span className="block text-xs text-slate-500">{q.hint}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="border-t border-white/[0.06] p-3">
            <input
              placeholder="질문 입력…"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600"
            />
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="GHG 코파일럿"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg shadow-sky-500/30 transition-transform hover:scale-105"
      >
        {open ? <X size={20} /> : <Sparkles size={20} />}
      </button>
    </div>
  );
}
