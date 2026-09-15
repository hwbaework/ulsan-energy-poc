'use client';

import { ExternalLink, Globe } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Badge } from '@/components/edm/ui/Badge';
import { Breadcrumb } from '@/components/edm/layout/Breadcrumb';
import { useCarbonVoluntary } from '@/hooks/edm/useCarbon';

// 자발적 탄소시장 — 설계 docs/기획/02 §2.11 (국내외 대표 마켓리스트 연계)
export default function VoluntaryPage() {
  const { data: VOLUNTARY_MARKETS } = useCarbonVoluntary();
  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '카본 마켓플레이스', path: '/carbon' }, { label: '자발적 시장' }]} />
      <h1 className="text-xl font-bold text-white">자발적 탄소시장</h1>
      <p className="text-xs text-slate-400">
        기업의 추가 감축 활동을 반영하는 국내외 대표 자발적 탄소시장(Voluntary Carbon Market) 리스트.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {VOLUNTARY_MARKETS.map((m) => (
          <Card key={m.name} className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-sky-400" />
                <h3 className="text-sm font-semibold text-white">{m.name}</h3>
              </div>
              <ExternalLink size={13} className="text-slate-500" />
            </div>
            <div className="mt-3 flex gap-2">
              <Badge variant="default">{m.region}</Badge>
              <Badge variant="info">{m.standard}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
