// @ts-nocheck
'use client';

import { CheckCircle2, Circle, Clock, XCircle, UserPlus, Server, ShieldCheck, LayoutDashboard } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StepStatus = 'completed' | 'current' | 'pending' | 'rejected';

export interface OnboardingStep {
  label: string;
  description: string;
  status: StepStatus;
  icon: LucideIcon;
  rejectionReason?: string;
}

interface OnboardingStepperProps {
  steps: OnboardingStep[];
  className?: string;
}

const STATUS_STYLES: Record<StepStatus, { ring: string; bg: string; icon: string; line: string }> = {
  completed: {
    ring: 'ring-emerald-500/40',
    bg: 'bg-emerald-500/10',
    icon: 'text-emerald-400',
    line: 'bg-emerald-500/40',
  },
  current: {
    ring: 'ring-blue-500/50',
    bg: 'bg-blue-500/10',
    icon: 'text-blue-400',
    line: 'bg-slate-600/40',
  },
  pending: {
    ring: 'ring-slate-600/40',
    bg: 'bg-slate-700/30',
    icon: 'text-slate-500',
    line: 'bg-slate-600/40',
  },
  rejected: {
    ring: 'ring-red-500/40',
    bg: 'bg-red-500/10',
    icon: 'text-red-400',
    line: 'bg-slate-600/40',
  },
};

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === 'completed') return <CheckCircle2 size={16} />;
  if (status === 'current') return <Clock size={16} className="animate-pulse" />;
  if (status === 'rejected') return <XCircle size={16} />;
  return <Circle size={16} />;
}

export function OnboardingStepper({ steps, className }: OnboardingStepperProps) {
  return (
    <div className={cn('rounded-xl bg-[#0d1520] ring-1 ring-white/10 p-6', className)}>
      <h3 className="text-sm font-semibold text-white mb-5">온보딩 진행 현황</h3>
      <div className="flex items-start">
        {steps.map((step, idx) => {
          const style = STATUS_STYLES[step.status];
          const StepIcon = step.icon;
          const isLast = idx === steps.length - 1;

          return (
            <div key={idx} className={cn('flex items-start', !isLast && 'flex-1')}>
              {/* Step node */}
              <div className="flex flex-col items-center">
                <div
                  className={cn('flex h-10 w-10 items-center justify-center rounded-full ring-2', style.ring, style.bg)}
                >
                  <span className={style.icon}>
                    <StepIcon size={18} />
                  </span>
                </div>
                <div className="mt-2 text-center max-w-[120px]">
                  <p
                    className={cn(
                      'text-xs font-medium',
                      step.status === 'completed'
                        ? 'text-emerald-300'
                        : step.status === 'current'
                          ? 'text-blue-300'
                          : step.status === 'rejected'
                            ? 'text-red-300'
                            : 'text-slate-500',
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{step.description}</p>
                  {step.status === 'current' && (
                    <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-[10px] text-blue-300 ring-1 ring-blue-500/20">
                      <Clock size={10} /> 진행 중
                    </span>
                  )}
                  {step.status === 'rejected' && step.rejectionReason && (
                    <p className="text-[10px] text-red-400 mt-1 leading-tight">{step.rejectionReason}</p>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 flex items-center px-2 mt-5">
                  <div className={cn('h-0.5 w-full rounded-full', style.line)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const GENERATOR_ONBOARDING_STEPS = {
  icons: {
    signup: UserPlus,
    resource: Server,
    approval: ShieldCheck,
    dashboard: LayoutDashboard,
  },
};
