'use client';

import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TrendLine {
  key: string;
  name: string;
  color: string;
}

interface GenerationTrendCardProps {
  title?: string;
  description: string;
  timeUnits: { value: string; label: string }[];
  activeUnit: string;
  onUnitChange: (unit: string) => void;
  yoyLabel?: ReactNode;
  dateLabel: string;
  onPrev: () => void;
  onNext: () => void;
  lines?: TrendLine[];
  hiddenLines?: Set<string>;
  onToggleLine?: (key: string) => void;
  summaryBar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function GenerationTrendCard({
  title = '발전량 추이',
  description,
  timeUnits,
  activeUnit,
  onUnitChange,
  yoyLabel,
  dateLabel,
  onPrev,
  onNext,
  lines,
  hiddenLines,
  onToggleLine,
  summaryBar,
  footer,
  children,
}: GenerationTrendCardProps) {
  return (
    <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] overflow-hidden">
      <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-md font-semibold text-white">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-400">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          {yoyLabel && <span className="text-[11px] text-slate-500">{yoyLabel}</span>}
          <div className="flex rounded-md bg-white/[0.04] p-0.5 ring-1 ring-white/[0.06]">
            {timeUnits.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onUnitChange(opt.value)}
                className={cn(
                  'px-3 py-1 text-xs rounded transition-colors',
                  activeUnit === opt.value ? 'bg-primary text-white' : 'text-slate-400 hover:text-white',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {summaryBar && (
        <div className="px-6 pt-4 pb-3 border-b border-white/[0.06] flex items-center justify-between gap-3 flex-wrap">
          {summaryBar}
        </div>
      )}

      <div className="px-5 py-4">
        <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
          {lines && onToggleLine ? (
            <div className="flex flex-wrap gap-1.5">
              {lines.length === 0 ? (
                <span className="text-xs text-slate-600">사업장을 선택해 주세요</span>
              ) : (
                lines.map((line) => {
                  const hidden = hiddenLines?.has(line.key) ?? false;
                  return (
                    <button
                      key={line.key}
                      type="button"
                      onClick={() => onToggleLine(line.key)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition-colors',
                        hidden
                          ? 'bg-transparent text-slate-600 ring-white/[0.06] hover:text-slate-400'
                          : 'bg-white/[0.06] text-white ring-white/[0.12] hover:bg-white/[0.10]',
                      )}
                      aria-pressed={!hidden}
                      title={hidden ? '클릭해서 다시 표시' : '클릭해서 숨김'}
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0 transition-opacity"
                        style={{ backgroundColor: line.color, opacity: hidden ? 0.3 : 1 }}
                      />
                      {line.name}
                      {hidden ? <Plus size={10} className="opacity-50" /> : <X size={10} className="opacity-70" />}
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onPrev}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06]"
              aria-label="이전"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-sm font-semibold text-white tabular-nums px-2 min-w-[100px] text-center">
              {dateLabel}
            </span>
            <button
              type="button"
              onClick={onNext}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] ring-1 ring-white/[0.06]"
              aria-label="다음"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {children}
      </div>

      {footer}
    </div>
  );
}
