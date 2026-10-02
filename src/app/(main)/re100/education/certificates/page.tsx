'use client';

import { useMemo, useState } from 'react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatMonthKo } from '@/types/education';

// 수료증 관리(관리자) — 누가 수료증을 몇 개 갖고 있는지만 보는 표. 수료증 발급·다운로드는 각 사용자의 RE100 교육 화면에서 한다.

interface Holder {
  id: number;
  company: string;
  user: string;
  role: '발전사업자' | '전기사용자';
  /** 이수한 과정 — 'basic' 또는 YYYY-MM */
  courses: string[];
  lastIssuedAt: string;
}

// POC 목업 — 백엔드 연동 시 수료증 발급 이력 API 로 교체
const HOLDERS: Holder[] = [
  { id: 1, company: '울산 발전(주)', user: '박발전', role: '발전사업자', courses: ['basic', '2026-07'], lastIssuedAt: '2026-08-04' },
  { id: 2, company: '울산 수용가(주)', user: '이수용', role: '전기사용자', courses: ['basic'], lastIssuedAt: '2026-07-22' },
  { id: 3, company: '한일튜브(주)', user: '김한일', role: '전기사용자', courses: ['basic', '2026-07'], lastIssuedAt: '2026-08-11' },
  { id: 4, company: '에스에너지', user: '정에스', role: '발전사업자', courses: ['basic'], lastIssuedAt: '2026-06-30' },
  { id: 5, company: '용인금속', user: '박용인', role: '전기사용자', courses: [], lastIssuedAt: '' },
];

const ROLE_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: '발전사업자', label: '발전사업자' },
  { value: '전기사용자', label: '전기사용자' },
];

const cell = (v: string, cls = 'text-slate-300') => <span className={`text-sm ${cls} whitespace-nowrap`}>{v}</span>;

export default function EducationCertificatesPage() {
  const [role, setRole] = useState('all');
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return HOLDERS.filter((h) => role === 'all' || h.role === role).filter(
      (h) => !s || [h.company, h.user].some((v) => v.toLowerCase().includes(s)),
    );
  }, [role, q]);

  const month = new Date().toISOString().slice(0, 7);
  const stats = {
    holders: HOLDERS.filter((h) => h.courses.length > 0).length,
    total: HOLDERS.reduce((a, h) => a + h.courses.length, 0),
    thisMonth: HOLDERS.filter((h) => h.lastIssuedAt.startsWith(month)).length,
  };

  const columns: Column<Holder>[] = [
    { key: 'company', header: '회사', render: (h) => cell(h.company, 'font-medium text-white') },
    { key: 'user', header: '이름', width: '120px', render: (h) => cell(h.user) },
    { key: 'role', header: '구분', width: '120px', render: (h) => cell(h.role) },
    {
      key: 'count',
      header: '수료증',
      width: '100px',
      sortable: true,
      sortValue: (h) => h.courses.length,
      render: (h) => cell(`${h.courses.length}건`, 'text-slate-300 tabular-nums'),
    },
    { key: 'courses', header: '이수 과정', render: (h) => cell(h.courses.length ? h.courses.map(formatMonthKo).join(' · ') : '-') },
    {
      key: 'last',
      header: '최근 발급일',
      width: '130px',
      sortable: true,
      sortValue: (h) => h.lastIssuedAt,
      render: (h) => cell(h.lastIssuedAt || '-', 'text-slate-400 tabular-nums'),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'RE100', path: '/re100' }, { label: 'RE100 교육', path: '/re100/education' }, { label: '수료증 관리' }]} />
      <h1 className="text-2xl font-bold text-white">수료증 관리</h1>

      <StatsGrid columns={3}>
        <StatCard label="수료자" value={`${stats.holders}명`} />
        <StatCard label="발급 수료증" value={`${stats.total}건`} />
        <StatCard label="이번 달 발급" value={`${stats.thisMonth}건`} />
      </StatsGrid>

      <SectionCard
        title="수료 현황"
        count={rows.length}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              구분
              <Select options={ROLE_OPTIONS} value={role} onChange={(e) => setRole(e.target.value)} className="w-32" />
            </label>
            <Input placeholder="회사 · 이름 검색" value={q} onChange={(e) => setQ(e.target.value)} className="w-52" />
          </div>
        }
        noPadding
      >
        <DataTable columns={columns} data={rows} rowKey={(h) => h.id} emptyMessage="수료 현황 없음" />
      </SectionCard>
    </div>
  );
}
