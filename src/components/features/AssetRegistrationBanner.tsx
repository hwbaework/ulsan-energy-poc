'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAssetStore } from '@/stores/useAssetStore';
import type { Persona } from '@/lib/persona';

interface AssetRegistrationBannerProps {
  persona: Persona;
}

const BANNER_CONFIG: Record<
  string,
  {
    title: string;
    description: string;
    ctaLabel: string;
    ctaPath: string;
    features: string[];
  }
> = {
  generator: {
    title: '발전소를 등록하세요',
    description: '발전소를 등록하면 모니터링, PPA 거래, REC 관리 기능을 사용할 수 있습니다.',
    ctaLabel: '발전소 등록하기',
    ctaPath: '/org/stations',
    features: ['실시간 발전량 모니터링', 'PPA 계약 매칭', 'REC 발급 신청'],
  },
  consumer: {
    title: '사업장을 등록하세요',
    description: '사업장을 등록하면 에너지 사용량 분석, 전력거래, RE100 추적 기능을 사용할 수 있습니다.',
    ctaLabel: '사업장 등록하기',
    ctaPath: '/org/stations',
    features: ['시간대별 사용량 분석', '전력거래 신청', 'RE100 달성률 추적'],
  },
  consultant: {
    title: '컨설턴트 프로필을 완성하세요',
    description: '프로필과 자격증을 등록하면 마켓플레이스에 노출되어 고객을 확보할 수 있습니다.',
    ctaLabel: '프로필 설정하기',
    ctaPath: '/org/stations',
    features: ['마켓플레이스 노출', '자동 매칭 활성화', '고객 제안 수신'],
  },
  spc: {
    title: '자산을 등록하세요',
    description: '보유 자산(PPA 계약, 발전/수요 자원)을 등록하면 포트폴리오 관리 기능을 사용할 수 있습니다.',
    ctaLabel: '자산 등록하기',
    ctaPath: '/org/stations',
    features: ['포트폴리오 분석', '수익 추적', '리스크 관리'],
  },
  admin: {
    title: '',
    description: '',
    ctaLabel: '',
    ctaPath: '',
    features: [],
  },
};

export function AssetRegistrationBanner({ persona }: AssetRegistrationBannerProps) {
  const router = useRouter();
  const { isRegistered, isDismissed, dismiss, hydrate } = useAssetStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (persona === 'admin') return null;
  if (isRegistered(persona) || isDismissed(persona)) return null;

  const config = BANNER_CONFIG[persona];
  if (!config) return null;

  return (
    <div className="relative rounded-xl bg-gradient-to-r from-primary/[0.08] to-blue-500/[0.06] ring-1 ring-primary/20 p-5 animate-[fadeIn_300ms_ease-out]">
      <button
        onClick={() => dismiss(persona)}
        className="absolute top-3 right-3 rounded-lg p-1 text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors"
        aria-label="닫기"
      >
        <X size={16} />
      </button>

      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <AlertCircle size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-md font-semibold text-white">{config.title}</h3>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">{config.description}</p>

          <div className="flex flex-wrap gap-3 mt-3">
            {config.features.map((feature) => (
              <span key={feature} className="inline-flex items-center gap-1 text-xs text-slate-400">
                <span className="h-1 w-1 rounded-full bg-primary/60" />
                {feature}
              </span>
            ))}
          </div>

          <Button size="sm" className="mt-4" onClick={() => router.push(config.ctaPath)}>
            {config.ctaLabel}
            <ArrowRight size={14} className="ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
