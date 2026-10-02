'use client';

import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { StatusPill } from '@/components/ui/Design';

// 참여 현황(관리자) — 상태는 참여 · 미참여 두 가지. 쪽지시험을 하나라도 끝내면 참여, 아니면 미참여.

interface Participant {
  id: number;
  company: string;
  user: string;
  /** 전 문항을 맞혀 끝낸 쪽지시험 수 (기본 + 끝난 달) */
  done: number;
}

// POC 목업 — 실제 대상 기업 5곳. 쪽지시험은 기본 · 2026-07 · 2026-08 세 개. 백엔드 연동 시 응시 이력 API 로 교체
const PARTICIPANTS: Participant[] = [
  { id: 1, company: '한길', user: '김민수', done: 3 },
  { id: 2, company: '태성산업', user: '이서연', done: 1 },
  { id: 3, company: '건호이엔씨', user: '박지훈', done: 0 },
  { id: 4, company: '한일튜브', user: '최유진', done: 2 },
  { id: 5, company: '용인금속', user: '윤성민', done: 0 },
];

const cell = (v: string, cls = 'text-slate-300') => <span className={`text-sm ${cls} whitespace-nowrap`}>{v}</span>;

export default function EducationParticipantsPage() {
  const total = PARTICIPANTS.length;
  const joined = PARTICIPANTS.filter((p) => p.done > 0).length;
  const done = PARTICIPANTS.reduce((a, p) => a + p.done, 0);

  const columns: Column<Participant>[] = [
    { key: 'company', header: '기업', render: (p) => cell(p.company, 'font-medium text-white') },
    { key: 'user', header: '이름', width: '140px', render: (p) => cell(p.user) },
    {
      key: 'status',
      header: '상태',
      width: '140px',
      render: (p) => (p.done > 0 ? <StatusPill tone="normal" label="참여" /> : <StatusPill tone="muted" label="미참여" />),
    },
    {
      key: 'done',
      header: '완료',
      width: '120px',
      sortable: true,
      sortValue: (p) => p.done,
      render: (p) => cell(`${p.done}건`, 'tabular-nums'),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'RE100', path: '/re100' }, { label: 'RE100 교육', path: '/re100/education' }, { label: '참여 현황' }]} />
      <h1 className="text-2xl font-bold text-white">참여 현황</h1>

      <StatsGrid columns={2}>
        <StatCard label="참여 인원" value={`${joined} / ${total}명`} />
        <StatCard label="완료" value={`${done}건`} />
      </StatsGrid>

      <SectionCard title="참여자" noPadding>
        <DataTable columns={columns} data={PARTICIPANTS} rowKey={(p) => p.id} emptyMessage="참여자 없음" />
      </SectionCard>
    </div>
  );
}
