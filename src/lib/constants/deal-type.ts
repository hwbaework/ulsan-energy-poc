import { Zap, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface DealTypeMeta {
  label: string;
  icon: LucideIcon;
  tone: string;
  bg: string;
  ring: string;
  tagBg: string;
  steps: string[];
}

export const DEAL_TYPE_META: Record<string, DealTypeMeta> = {
  PPA: {
    label: '직접 PPA',
    icon: Zap,
    tone: 'text-blue-300',
    bg: 'bg-blue-500/[0.06]',
    ring: 'ring-blue-500/30',
    tagBg: 'bg-blue-500/[0.15]',
    steps: ['신청 접수', 'SPC 매칭', '승인 대기', '계약 체결'],
  },
  SAVINGS_SHARE: {
    label: '직접 PPA',
    icon: Sun,
    tone: 'text-violet-300',
    bg: 'bg-violet-500/[0.06]',
    ring: 'ring-violet-500/30',
    tagBg: 'bg-violet-500/[0.15]',
    steps: ['신청 접수', 'SPC 매칭', '승인 대기', '계약 체결'],
  },
  LEASE: {
    label: '직접 PPA',
    icon: Sun,
    tone: 'text-violet-300',
    bg: 'bg-violet-500/[0.06]',
    ring: 'ring-violet-500/30',
    tagBg: 'bg-violet-500/[0.15]',
    steps: ['신청 접수', 'SPC 매칭', '승인 대기', '계약 체결'],
  },
};
