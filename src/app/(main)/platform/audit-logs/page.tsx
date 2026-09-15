'use client';

import { useState } from 'react';
import { Search, Download, Clock, User, Shield, Database, Settings } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/features/DataList';
import { cn, exportCsv } from '@/lib/utils';
import { useAuditLogs } from '@/hooks/platform/useAuditLogs';

interface AuditLog {
  id: number;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: string;
  category: 'auth' | 'user' | 'company' | 'system' | 'data';
  target: string;
  ip: string;
  result: 'success' | 'failure';
  detail?: string;
}

const CATEGORY_CONFIG = {
  auth: { icon: Shield, label: '인증', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  user: { icon: User, label: '사용자', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  company: { icon: Database, label: '기업', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  system: { icon: Settings, label: '시스템', color: 'text-violet-400', bg: 'bg-violet-500/10' },
  data: { icon: Database, label: '데이터', color: 'text-sky-400', bg: 'bg-sky-500/10' },
};

const CATEGORY_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'auth', label: '인증' },
  { value: 'user', label: '사용자' },
  { value: 'company', label: '기업' },
  { value: 'system', label: '시스템' },
  { value: 'data', label: '데이터' },
];

const RESULT_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'success', label: '성공' },
  { value: 'failure', label: '실패' },
];

export default function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [result, setResult] = useState('all');

  const { data: apiData, isError } = useAuditLogs({ q: search || undefined });
  const logs: AuditLog[] =
    !isError && apiData?.content
      ? apiData.content.map((l) => ({
          id: l.id,
          timestamp: l.createdAt?.replace('T', ' ').slice(0, 16) ?? '',
          actor: l.userName,
          actorRole: '',
          action: l.action,
          category: (l.entityType?.toLowerCase() ?? 'system') as AuditLog['category'],
          target: l.entityType ? `${l.entityType}#${l.entityId ?? ''}` : '',
          ip: l.ipAddress ?? '',
          result: 'success' as const,
          detail: l.detail,
        }))
      : [];

  const filtered = logs.filter((log) => {
    if (category !== 'all' && log.category !== category) return false;
    if (result !== 'all' && log.result !== result) return false;
    if (search && !log.actor.includes(search) && !log.action.includes(search) && !log.target.includes(search))
      return false;
    return true;
  });

  const columns: Column<AuditLog>[] = [
    {
      key: 'timestamp',
      header: '시간',
      width: '160px',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Clock size={12} className="text-slate-500 shrink-0" />
          <span className="text-xs text-slate-400 tabular-nums">{row.timestamp}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: '분류',
      width: '90px',
      render: (row) => {
        const cfg = CATEGORY_CONFIG[row.category];
        return (
          <div className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px]', cfg.bg)}>
            <cfg.icon size={10} className={cfg.color} />
            <span className={cfg.color}>{cfg.label}</span>
          </div>
        );
      },
    },
    {
      key: 'actor',
      header: '수행자',
      width: '130px',
      render: (row) => (
        <div>
          <p className="text-sm text-white">{row.actor}</p>
          <p className="text-[10px] text-slate-500 font-mono">{row.actorRole}</p>
        </div>
      ),
    },
    {
      key: 'action',
      header: '작업',
      render: (row) => <span className="text-sm text-slate-300">{row.action}</span>,
    },
    {
      key: 'target',
      header: '대상',
      render: (row) => <span className="text-sm text-slate-400 truncate">{row.target}</span>,
    },
    {
      key: 'ip',
      header: 'IP',
      width: '120px',
      render: (row) => <span className="text-xs text-slate-500 tabular-nums font-mono">{row.ip}</span>,
    },
    {
      key: 'result',
      header: '결과',
      width: '70px',
      render: (row) => (
        <Badge variant={row.result === 'success' ? 'success' : 'danger'}>
          {row.result === 'success' ? '성공' : '실패'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '관리' }, { label: '감사 로그' }]} />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">시스템 로그</h1>
          <p className="mt-1 text-sm text-slate-400">시스템 활동 감사 로그를 조회합니다</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            exportCsv(
              `audit-logs-${new Date().toISOString().slice(0, 10)}`,
              ['시간', '사용자', '활동', '카테고리', '결과', 'IP'],
              logs.map((l) => [l.timestamp, l.actor, l.action, l.category, l.result, l.ip ?? '']),
            )
          }
        >
          <Download size={14} className="mr-1.5" /> CSV 내보내기
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg bg-[#0d1520] ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-2xl font-bold text-white tabular-nums">{logs.length}</p>
          <p className="text-xs text-slate-400 mt-1">전체 로그</p>
        </div>
        <div className="rounded-lg bg-[#0d1520] ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">
            {logs.filter((l) => l.result === 'success').length}
          </p>
          <p className="text-xs text-slate-400 mt-1">성공</p>
        </div>
        <div className="rounded-lg bg-[#0d1520] ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-2xl font-bold text-red-400 tabular-nums">
            {logs.filter((l) => l.result === 'failure').length}
          </p>
          <p className="text-xs text-slate-400 mt-1">실패</p>
        </div>
        <div className="rounded-lg bg-[#0d1520] ring-1 ring-white/[0.06] p-4 text-center">
          <p className="text-2xl font-bold text-amber-400 tabular-nums">
            {logs.filter((l) => l.category === 'auth' && l.result === 'failure').length}
          </p>
          <p className="text-xs text-slate-400 mt-1">인증 실패</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="수행자, 작업, 대상 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg bg-white/[0.04] pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 ring-1 ring-white/[0.08] focus:ring-primary/40 focus:outline-none"
          />
        </div>
        <div className="w-32">
          <Select options={CATEGORY_OPTIONS} value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div className="w-28">
          <Select options={RESULT_OPTIONS} value={result} onChange={(e) => setResult(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06]">
        <DataTable columns={columns} data={filtered} rowKey={(r) => r.id} />
        {filtered.length === 0 && <div className="py-12 text-center text-sm text-slate-500">검색 결과가 없습니다</div>}
      </div>
    </div>
  );
}
