'use client';

import { getDaysUntilDeadline, getRegulationUrgency } from '@/lib/regulations';
import type { RegulationDeadline } from '@/lib/regulations';
import type { ConsultationDomain } from '@/types/consultation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface RegulationBannerProps {
  regulations: RegulationDeadline[];
  onStartConsulting: (domain: ConsultationDomain) => void;
}

const URGENCY_BADGE_VARIANT = {
  critical: 'danger',
  warning: 'warning',
  info: 'info',
} as const;

const URGENCY_TEXT_COLOR = {
  critical: 'text-semantic-red',
  warning: 'text-semantic-yellow',
  info: 'text-semantic-blue',
} as const;

export function RegulationBanner({ regulations, onStartConsulting }: RegulationBannerProps) {
  return (
    <div className="flex gap-3 overflow-x-auto overflow-y-hidden scrollbar-hide">
      {regulations.map((regulation) => {
        const daysLeft = getDaysUntilDeadline(regulation.deadline);
        const urgency = getRegulationUrgency(daysLeft);

        return (
          <div
            key={regulation.id}
            className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-4 min-w-[260px] shrink-0"
          >
            <div className="flex items-center gap-2">
              <Badge variant={URGENCY_BADGE_VARIANT[urgency]} className="text-[10px]">
                {regulation.code}
              </Badge>
            </div>

            <h3 className="mt-2 text-sm font-medium text-white">{regulation.name}</h3>

            <p className={`mt-1 text-2xl font-bold ${URGENCY_TEXT_COLOR[urgency]}`}>D-{daysLeft > 0 ? daysLeft : 0}</p>

            <p className="mt-1 text-xs text-slate-400 truncate">{regulation.description}</p>

            <Button
              size="sm"
              variant="secondary"
              className="mt-3 w-full"
              onClick={() => onStartConsulting(regulation.relatedDomain)}
            >
              대응 컨설팅 시작
            </Button>
          </div>
        );
      })}
    </div>
  );
}
