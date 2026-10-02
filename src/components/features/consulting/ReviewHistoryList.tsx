'use client';

import { ChevronRight, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EOK } from '@/lib/solar-sim';
import type { Diagnosis } from '@/types/consultation';
import { recordOf } from './SimDiagnosisView';
import { simHeadline } from './SimReport';

/** 검토 기록 — 무료진단으로 남긴 사업 검토서 목록(최신순). 무료진단·내 컨설팅 오른쪽 공용. onDelete 를 주면 삭제 버튼(수정은 없다) */
export function ReviewHistoryList({ history, selectedId, onPick, onDelete }: { history: Diagnosis[]; selectedId?: number; onPick: (d: Diagnosis) => void; onDelete?: (d: Diagnosis) => void }) {
  return (
    <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] lg:sticky lg:top-[116px]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <p className="text-base font-semibold text-white">검토 기록</p>
        <span className="text-sm text-slate-500 tabular-nums">{history.length}건</span>
      </div>
      {history.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">아직 검토 기록 없음</p>
      ) : (
        <ul className="max-h-[calc(100vh-200px)] divide-y divide-white/[0.04] overflow-y-auto">
          {history.map((d) => {
            const h = simHeadline(d.sim!);
            const rec = recordOf(d);
            const on = d.id === selectedId;
            return (
              <li key={d.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onPick(d)}
                  className={cn('flex w-full items-center gap-3 px-5 py-3 text-left transition-colors', on ? 'bg-primary/[0.10]' : 'hover:bg-white/[0.03]')}
                >
                  <span className={cn('h-8 w-0.5 shrink-0 rounded-full', on ? 'bg-primary' : 'bg-transparent')} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('text-sm font-semibold tabular-nums', on ? 'text-primary' : 'text-white')}>{rec.no}</span>
                      <span className="text-xs text-slate-500 tabular-nums">{rec.at.slice(0, 10)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-400">
                      {d.sim!.site} · {h.mode} · {h.cap.toLocaleString()} kW · 20년 {EOK(h.save20)}억원
                    </p>
                  </div>
                  <ChevronRight size={14} className={cn('shrink-0 text-slate-600', onDelete && 'invisible')} />
                </button>
                {onDelete && (
                  <button
                    type="button"
                    aria-label={`${rec.no} 삭제`}
                    onClick={() => onDelete(d)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
