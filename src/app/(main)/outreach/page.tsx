'use client';

import { Fragment, useMemo, useState } from 'react';
import {
  Megaphone,
  PlusCircle,
  Info,
  Handshake,
  Network,
  FlaskConical,
  Target,
  Loader2,
  AlertTriangle,
  FileArchive,
  Paperclip,
} from 'lucide-react';
import { Breadcrumb } from '@/components/layout';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  useSupportActivities,
  useCreateSupportActivity,
  type SupportActivity,
  type SupportCategory,
} from '@/hooks/performance/useSupportActivities';
import { evidenceExportZipUrl } from '@/hooks/evidence/useEvidence';
import EvidencePanel from '../performance/EvidencePanel';

// 성과확산(지표9) — 09 §3.2.4. re100/support-activities 실소비 (성과 유일 write 화면).
// 등록 폼 실동작 → 목록·카운트 증분. status(draft/submitted/approved). 증빙 첨부·증빙없음 경고.
// 계획서 목표 31건은 캐논(불변) — 실적 count는 원장 approved.

const YEAR = 2026;
const TARGET_TOTAL = 31; // 계획서 상수(컨13·홍4·샌1·모1·네12) — 불변

const CATEGORIES: { key: SupportCategory; label: string; icon: React.ReactNode; tone: string; target: number }[] = [
  { key: 'consulting', label: '컨설팅', icon: <Handshake size={14} />, tone: 'text-sky-400', target: 13 },
  { key: 'promotion', label: '홍보', icon: <Megaphone size={14} />, tone: 'text-emerald-400', target: 4 },
  { key: 'sandbox', label: '규제 샌드박스', icon: <FlaskConical size={14} />, tone: 'text-amber-400', target: 1 },
  { key: 'model', label: '사업모델', icon: <Target size={14} />, tone: 'text-purple-400', target: 1 },
  { key: 'network', label: '네트워크(외)', icon: <Network size={14} />, tone: 'text-slate-300', target: 12 },
];
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

const TABS = [
  { key: 'status', label: '활동 현황', icon: <Megaphone size={14} /> },
  { key: 'register', label: '활동 등록', icon: <PlusCircle size={14} /> },
] as const;

function statusTone(s: string) {
  if (s === 'approved') return 'bg-emerald-500/10 text-emerald-400';
  if (s === 'submitted') return 'bg-sky-500/10 text-sky-400';
  return 'bg-slate-500/10 text-slate-400';
}
function statusLabel(s: string) {
  return s === 'approved' ? '승인' : s === 'submitted' ? '제출' : '작성중';
}

export default function OutreachPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('status');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const uploadedBy = useAuthStore((s) => (s.user?.id != null ? String(s.user.id) : undefined));

  const listQ = useSupportActivities(YEAR);
  const createM = useCreateSupportActivity();
  const activities = useMemo<SupportActivity[]>(() => listQ.data ?? [], [listQ.data]);

  // 카테고리별 실적 count(원장). approved만 실적 집계.
  const countByCat = useMemo(() => {
    const m = new Map<string, number>();
    activities.forEach((a) => {
      if (a.status === 'approved') m.set(String(a.category), (m.get(String(a.category)) ?? 0) + 1);
    });
    return m;
  }, [activities]);
  // 대기(미승인=작성중·제출) count — 등록 직후 활동이 집계에서 누락되지 않도록 승인/대기 분리 표시.
  const pendingByCat = useMemo(() => {
    const m = new Map<string, number>();
    activities.forEach((a) => {
      if (a.status !== 'approved') m.set(String(a.category), (m.get(String(a.category)) ?? 0) + 1);
    });
    return m;
  }, [activities]);
  const totalApproved = activities.filter((a) => a.status === 'approved').length;
  const totalPending = activities.filter((a) => a.status !== 'approved').length;

  // 등록 폼 상태
  const [form, setForm] = useState<{
    category: SupportCategory;
    activityDate: string;
    title: string;
    description: string;
    reporter: string;
  }>({
    category: 'consulting',
    activityDate: '',
    title: '',
    description: '',
    reporter: '',
  });

  const submit = () => {
    if (!form.title || !form.activityDate) return;
    createM.mutate(
      {
        category: form.category,
        title: form.title,
        activityDate: form.activityDate,
        description: form.description,
        reporter: form.reporter,
      },
      {
        onSuccess: () => {
          setForm({ category: 'consulting', activityDate: '', title: '', description: '', reporter: '' });
          setTab('status');
        },
      },
    );
  };

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: '관리' }, { label: '성과확산' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">성과확산</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            지표9 — 목표 {TARGET_TOTAL}건 / 승인 {totalApproved}건{totalPending > 0 ? ` · 대기 ${totalPending}건` : ''}
          </span>
          <a
            href={evidenceExportZipUrl(9, YEAR)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/[0.04]"
          >
            <FileArchive size={13} /> 결과물 zip
          </a>
        </div>
      </div>

      {/* 분류 카드 — 목표(계획서 상수) + 실적: 승인(원장 approved) / 대기(작성중·제출) 분리 집계 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {CATEGORIES.map((c) => {
          const pending = pendingByCat.get(c.key) ?? 0;
          return (
            <div key={c.key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {c.icon} {c.label}
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className={`text-xl font-bold ${c.tone}`}>{countByCat.get(c.key) ?? 0}</span>
                <span className="text-xs text-slate-500">건 승인</span>
                {pending > 0 && <span className="text-[11px] text-amber-400">+{pending} 대기</span>}
              </div>
              <div className="text-[11px] text-slate-500">목표 {c.target}건(계획서)</div>
            </div>
          );
        })}
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center justify-between">
        <span className="text-sm text-slate-300">실적(승인) / 목표(계획서 상수)</span>
        <span className="text-lg font-bold text-white">
          {totalApproved} / {TARGET_TOTAL} 건
          {totalPending > 0 && (
            <span className="ml-1.5 text-sm font-medium text-amber-400">(대기 {totalPending}건)</span>
          )}
          <span className="ml-1.5 text-xs text-slate-500">(컨13·홍4·샌1·모1·네12)</span>
        </span>
      </div>

      <div className="flex items-center gap-1 border-b border-white/[0.06]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${
              tab === t.key
                ? 'border-sky-400 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'status' && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02]">활동 목록</div>
          {listQ.isLoading ? (
            <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> 불러오는 중…
            </div>
          ) : listQ.isError ? (
            <div className="px-4 py-8 text-sm text-rose-300">활동 목록을 불러오지 못했습니다.</div>
          ) : activities.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              등록된 활동이 없습니다. [활동 등록]에서 첫 활동을 추가하세요.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                  <th className="px-4 py-3">분류</th>
                  <th className="px-4 py-3">활동</th>
                  <th className="px-4 py-3">일자</th>
                  <th className="px-4 py-3 text-center">상태</th>
                  <th className="px-4 py-3 text-center">증빙</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <Fragment key={a.id}>
                    <tr className="border-b border-white/[0.04] text-slate-300">
                      <td className="px-4 py-3 text-slate-400">{CATEGORY_LABEL[String(a.category)] ?? a.category}</td>
                      <td className="px-4 py-3">{a.title}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{a.activityDate?.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded px-2 py-0.5 text-xs ${statusTone(a.status)}`}>
                          {statusLabel(a.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {!a.evidenceIds || a.evidenceIds.length === 0 ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-400">
                            <AlertTriangle size={11} /> 증빙없음
                          </span>
                        ) : (
                          <span className="rounded bg-white/[0.05] px-2 py-0.5 text-[11px] text-slate-300">
                            {a.evidenceIds.length}건
                          </span>
                        )}
                        <button
                          onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                          className="ml-2 inline-flex items-center gap-1 rounded border border-white/[0.06] px-2 py-0.5 text-[11px] text-slate-400 hover:bg-white/[0.04]"
                        >
                          <Paperclip size={11} /> 첨부
                        </button>
                      </td>
                    </tr>
                    {expandedId === a.id && (
                      <tr>
                        <td colSpan={5} className="px-4 py-3 bg-black/20">
                          <EvidencePanel
                            ownerType="support_activity"
                            ownerId={String(a.id)}
                            indicatorNo={9}
                            year={YEAR}
                            evidenceType="RESULT_REPORT"
                            uploadedBy={uploadedBy}
                            title="결과물 첨부(보고서·홍보물·샌드박스 신청서)"
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'register' && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
          <div className="text-sm font-semibold text-white">활동 등록</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-xs text-slate-400 space-y-1">
              <span>분류</span>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as SupportCategory }))}
                className="w-full rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-sm text-slate-200"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400 space-y-1">
              <span>활동일</span>
              <input
                type="date"
                value={form.activityDate}
                onChange={(e) => setForm((f) => ({ ...f, activityDate: e.target.value }))}
                className="w-full rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-sm text-slate-200"
              />
            </label>
            <label className="text-xs text-slate-400 space-y-1 sm:col-span-2">
              <span>활동명</span>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="예: RE100 이행수단 컨설팅 — 수용가명"
                className="w-full rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
              />
            </label>
            <label className="text-xs text-slate-400 space-y-1 sm:col-span-2">
              <span>설명</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-sm text-slate-200"
              />
            </label>
            <label className="text-xs text-slate-400 space-y-1">
              <span>담당</span>
              <input
                value={form.reporter}
                onChange={(e) => setForm((f) => ({ ...f, reporter: e.target.value }))}
                className="w-full rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-sm text-slate-200"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={submit}
              disabled={createM.isPending || !form.title || !form.activityDate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60"
            >
              {createM.isPending ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
              활동 등록
            </button>
            {createM.isError && <span className="text-xs text-rose-400">등록 실패 — 다시 시도</span>}
            <span className="text-[11px] text-slate-500">등록 후 [활동 현황]에서 결과물(증빙)을 첨부하세요.</span>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-4 flex items-start gap-3">
        <Info size={16} className="text-sky-400 mt-0.5 shrink-0" />
        <div className="text-sm text-slate-300">
          <b className="text-sky-400">정직성 안내</b> — 목표 <b>{TARGET_TOTAL}건</b>(컨13·홍4·샌1·모1·네12)은 계획서
          상수(실값). 실적은 support_activity 원장에서 <b>승인(approved)</b>과 <b>대기(작성중·제출)</b>를 분리
          집계합니다 — 목표 달성률은 승인 건만, 대기 건은 별도 표기하여 등록 직후 활동이 누락되지 않습니다. 결과물
          증빙이 없는 활동은 "증빙없음" 경고로 환기합니다.
        </div>
      </div>
    </div>
  );
}
