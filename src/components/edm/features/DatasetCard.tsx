'use client';

import Link from 'next/link';
import { Star, Eye, Download, Zap, FileText, Radio } from 'lucide-react';
import { Badge } from '@/components/edm/ui/Badge';
import { cn } from '@/lib/utils';
import type { DatasetListItem } from '@/types/edm';

function formatPrice(priceModel: DatasetListItem['priceModel']): string {
  if (priceModel.type === 'FREE') return '무료';
  if (priceModel.type === 'ONETIME') return `₩${(priceModel.basePrice ?? 0).toLocaleString()}`;
  if (priceModel.type === 'SUBSCRIPTION') return `₩${(priceModel.basePrice ?? 0).toLocaleString()}/월`;
  if (priceModel.type === 'PAY_PER_USE') return `₩${priceModel.perUsePrice}/건`;
  return '견적 문의';
}

function FormatIcon({ format }: { format: DatasetListItem['format'] }) {
  switch (format) {
    case 'API':
      return <Zap size={12} />;
    case 'STREAMING':
      return <Radio size={12} />;
    default:
      return <FileText size={12} />;
  }
}

const FREQUENCY_LABEL: Record<string, string> = {
  REALTIME: '실시간',
  HOURLY: '시간별',
  DAILY: '일별',
  WEEKLY: '주별',
  MONTHLY: '월별',
  ONCE: '1회',
};

interface DatasetCardProps {
  dataset: DatasetListItem;
  className?: string;
}

export function DatasetCard({ dataset, className }: DatasetCardProps) {
  return (
    <Link
      href={`/e-data/catalog/${dataset.id}`}
      className={cn(
        'group flex flex-col rounded-lg border border-accent/20 bg-surface-card p-4 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5',
        className,
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Badge variant="primary">{dataset.category.name}</Badge>
          {/* 수집예정 배지(설계 16 §3.2) — RE100 실습 등 미수집분(status=DRAFT). */}
          {dataset.collectingSoon && <Badge variant="warning">수집 예정</Badge>}
        </div>
        <div className="flex items-center gap-1 text-xs text-accent">
          <FormatIcon format={dataset.format} />
          <span>{dataset.format}</span>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-white group-hover:text-primary transition-colors line-clamp-1 mb-1">
        {dataset.title}
      </h3>
      <p className="text-xs text-accent line-clamp-2 mb-3 flex-1">{dataset.description}</p>

      <div className="flex items-center gap-2 text-xs text-accent mb-3">
        <span>{dataset.provider.name}</span>
        <span className="text-accent/30">·</span>
        <span>{FREQUENCY_LABEL[dataset.updateFrequency] ?? dataset.updateFrequency}</span>
      </div>

      <div className="flex items-center justify-between border-t border-accent/10 pt-3">
        <div className="flex items-center gap-3 text-xs text-accent">
          <span className="flex items-center gap-1">
            <Star size={12} className="text-yellow-400 fill-yellow-400" />
            {dataset.avgRating.toFixed(1)}
            <span className="text-accent/50">({dataset.reviewCount})</span>
          </span>
          <span className="flex items-center gap-1">
            <Eye size={12} />
            {dataset.viewCount.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <Download size={12} />
            {dataset.downloadCount}
          </span>
        </div>
        <span
          className={cn(
            'text-xs font-semibold',
            dataset.priceModel.type === 'FREE' ? 'text-semantic-green' : 'text-primary',
          )}
        >
          {formatPrice(dataset.priceModel)}
        </span>
      </div>

      {dataset.qualityScore >= 90 && (
        <div
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-semantic-green/20 flex items-center justify-center"
          title={`품질 ${dataset.qualityScore}점`}
        >
          <span className="text-[10px] font-bold text-semantic-green">{dataset.qualityScore}</span>
        </div>
      )}
    </Link>
  );
}
