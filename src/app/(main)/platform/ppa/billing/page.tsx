'use client';

import { Breadcrumb } from '@/components/layout/Breadcrumb';

export default function PlatformPpaBillingPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'PPA 관리', path: '/platform/ppa/dashboard' }, { label: '결제 관리' }]} />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-white">결제 관리</h1>
        <p className="text-sm text-slate-400">정산 · 세금 계산서 · 발전량 초과/미달 통합 관리 (KPX·한전 연동)</p>
      </header>

      <section className="rounded border border-white/10 bg-surface-card p-6">
        <p className="text-sm text-white/60">좌측 메뉴에서 세부 항목을 선택하세요.</p>
      </section>
    </div>
  );
}
