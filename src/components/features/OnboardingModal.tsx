'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface OnboardingFeature {
  icon: LucideIcon;
  label: string;
  desc: string;
}

interface OnboardingStep {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  features?: OnboardingFeature[];
}

interface OnboardingModalProps {
  open: boolean;
  onComplete: () => void;
  persona: string;
  welcomeTitle: string;
  welcomeDescription: string;
  welcomeIcon: LucideIcon;
  welcomeIconColor: string;
  welcomeIconBg: string;
  steps: OnboardingStep[];
  ctaLabel: string;
  ctaIcon: LucideIcon;
  onCtaClick: () => void;
}

function OnboardingModal({
  open,
  onComplete,
  welcomeTitle,
  welcomeDescription,
  welcomeIcon: WelcomeIcon,
  welcomeIconColor,
  welcomeIconBg,
  steps,
  ctaLabel,
  ctaIcon: CtaIcon,
  onCtaClick,
}: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  // step 0 = welcome, 1..N = feature steps, N+1 = completion
  const totalSteps = steps.length + 2;
  const progress = (currentStep / (totalSteps - 1)) * 100;

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const renderDots = () => (
    <div className="flex items-center justify-center gap-1.5 mt-6">
      {Array.from({ length: totalSteps }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            i === currentStep ? 'w-6 bg-blue-500' : 'w-1.5 bg-white/10',
          )}
        />
      ))}
    </div>
  );

  const renderWelcome = () => (
    <div className="flex flex-col items-center text-center py-8 px-4">
      <div
        className={cn(
          'flex h-20 w-20 items-center justify-center rounded-full ring-1',
          welcomeIconBg,
          welcomeIconColor === 'text-amber-400' && 'ring-amber-500/30',
          welcomeIconColor === 'text-blue-400' && 'ring-blue-500/30',
          welcomeIconColor === 'text-emerald-400' && 'ring-emerald-500/30',
          welcomeIconColor === 'text-violet-400' && 'ring-violet-500/30',
          welcomeIconColor === 'text-sky-400' && 'ring-sky-500/30',
        )}
      >
        <WelcomeIcon size={36} className={welcomeIconColor} />
      </div>
      <h2 className="mt-6 text-xl font-bold text-white">{welcomeTitle}</h2>
      <p className="mt-3 text-sm text-slate-400 leading-relaxed max-w-md">{welcomeDescription}</p>
      <Button variant="primary" size="lg" onClick={handleNext} className="mt-8">
        시작하기 <ChevronRight size={16} />
      </Button>
      <button onClick={onComplete} className="mt-4 text-sm text-slate-500 hover:text-slate-300 transition-colors">
        건너뛰기
      </button>
      {renderDots()}
    </div>
  );

  const renderFeatureStep = (stepIndex: number) => {
    const step = steps[stepIndex]!;
    const StepIcon = step.icon;

    return (
      <div className="flex flex-col items-center text-center py-8 px-4">
        <div className={cn('flex h-16 w-16 items-center justify-center rounded-full', step.iconBg)}>
          <StepIcon size={28} className={step.iconColor} />
        </div>
        <h2 className="mt-5 text-lg font-bold text-white">{step.title}</h2>
        <p className="mt-2 text-sm text-slate-400 leading-relaxed max-w-md">{step.description}</p>

        {step.features && step.features.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 w-full max-w-md">
            {step.features.map((feature) => {
              const FeatureIcon = feature.icon;
              return (
                <div
                  key={feature.label}
                  className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06] text-left"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                    <FeatureIcon size={16} className="text-slate-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{feature.label}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{feature.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-3 mt-8">
          <Button variant="secondary" size="md" onClick={handlePrev}>
            <ChevronLeft size={16} /> 이전
          </Button>
          <Button variant="primary" size="md" onClick={handleNext}>
            다음 <ChevronRight size={16} />
          </Button>
        </div>
        <button onClick={onComplete} className="mt-4 text-sm text-slate-500 hover:text-slate-300 transition-colors">
          건너뛰기
        </button>
        {renderDots()}
      </div>
    );
  };

  const renderCompletion = () => (
    <div className="flex flex-col items-center text-center py-8 px-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/[0.10] ring-1 ring-emerald-500/30">
        <Check size={36} className="text-emerald-400" />
      </div>
      <h2 className="mt-6 text-xl font-bold text-white">준비 완료!</h2>
      <p className="mt-3 text-sm text-slate-400 leading-relaxed max-w-md">지금 바로 시작하세요</p>
      <Button variant="primary" size="lg" onClick={onCtaClick} className="mt-8">
        <CtaIcon size={16} className="mr-1.5" /> {ctaLabel}
      </Button>
      <button onClick={onComplete} className="mt-4 text-sm text-slate-500 hover:text-slate-300 transition-colors">
        대시보드에서 시작
      </button>
      {renderDots()}
    </div>
  );

  const renderCurrentStep = () => {
    if (currentStep === 0) return renderWelcome();
    if (currentStep <= steps.length) return renderFeatureStep(currentStep - 1);
    return renderCompletion();
  };

  return (
    <Modal open={open} onClose={() => {}} size="lg">
      <div className="relative">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>
        <div className="pt-2">{renderCurrentStep()}</div>
      </div>
    </Modal>
  );
}

export { OnboardingModal, type OnboardingStep };
