'use client';

import { useState } from 'react';
import { Zap, Flame, Upload, RefreshCw, ScanLine, Database, Plus, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Badge } from '@/components/edm/ui/Badge';
import { Button } from '@/components/edm/ui/Button';
import { Breadcrumb } from '@/components/edm/layout/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/useAuthStore';
import { useGhgActivities, useGhgSources, useCreateActivity } from '@/hooks/edm/useGhg';
import { type ActivityType, type ActivityRow } from '@/mocks/edm/ghg';

// 활동자료 입력 — 설계 docs/기획/01 rev.2 §5 (자동수집: EMS·i-Smart·청구서 OCR·ERP + AI 이상치)
// 수기 입력 배선: 설계 11 §2.2 (수기 입력 모달 + useCreateActivity).
const TABS: { id: ActivityType; label: string }[] = [
  { id: 'ELEC', label: '전력' },
  { id: 'FUEL', label: '연료' },
  { id: 'STEAM', label: '스팀' },
];

const YEAR = 2026;
const inputCls = 'mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-slate-200';
const labelCls = 'block text-xs text-slate-400';

// type↔단위 잠금 (설계 11 §2.2·§4.1): ELEC→MWh, FUEL→TJ, STEAM→GJ.
const UNIT_OF: Record<ActivityType, string> = { ELEC: 'MWh', FUEL: 'TJ', STEAM: 'GJ' };

// 간소화(기획 17 §5): 배출원 선택 시 유형·단위 자동 결정(중복 분류 제거).
// 배출원 category → ActivityType 매핑(sources 페이지 CATEGORY_META 와 정합).
const CATEGORY_TO_TYPE: Record<string, ActivityType> = {
  구매전력: 'ELEC',
  스팀: 'STEAM',
  고정연소: 'FUEL',
  이동연소: 'FUEL',
  공정: 'FUEL',
  탈루: 'FUEL',
};
const typeOfCategory = (category?: string): ActivityType => (category && CATEGORY_TO_TYPE[category]) || 'FUEL';

// 자동수집 소스 라벨 (is_auto 실현 — 어떤 인프라에서 왔는지 표시)
const autoSource = (a: ActivityRow): string =>
  a.type === 'ELEC' ? 'i-Smart API' : a.type === 'STEAM' ? '산단 EMS' : 'ERP 커넥터';

export default function ActivityPage() {
  const [tab, setTab] = useState<ActivityType>('ELEC');
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const { data: activities, isError } = useGhgActivities(companyId);
  const { data: sources } = useGhgSources(companyId);
  const rows = activities.filter((a) => a.type === tab);
  const facility = (id: string) => sources.find((s) => s.id === id)?.facility ?? id;
  const autoRate = activities.length
    ? Math.round((activities.filter((a) => a.isAuto).length / activities.length) * 100)
    : 0;

  const create = useCreateActivity();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ sourceId: string; year: number; amount: string; evidence: string }>({
    sourceId: '',
    year: YEAR,
    amount: '',
    evidence: '',
  });
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const guardReason =
    companyId == null
      ? '회사 정보가 없어 저장할 수 없습니다'
      : isError
        ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
        : '';
  const canOpen = !guardReason;

  // 유형·단위 자동: 선택한 배출원의 category 로 파생(중복 분류 제거, 기획 17 §5)
  const selectedSource = form.sourceId ? sources.find((s) => s.id === form.sourceId) : undefined;
  const autoType = typeOfCategory(selectedSource?.category);
  const autoUnit = UNIT_OF[autoType];

  const amountNum = Number(form.amount);
  const sourceIdNum = form.sourceId ? Number(form.sourceId) : NaN;
  const err = {
    sourceId: !form.sourceId ? '배출원을 선택하세요' : '',
    amount: form.amount.trim() === '' || !Number.isFinite(amountNum) || amountNum < 0 ? '0 이상의 수를 입력하세요' : '',
    year: form.year < 2000 || form.year > new Date().getFullYear() + 1 ? '유효한 연도를 입력하세요' : '',
  };
  const valid = !err.sourceId && !err.amount && !err.year && Number.isFinite(sourceIdNum);

  async function save() {
    if (!valid || companyId == null) return;
    setFeedback(null);
    try {
      await create.mutateAsync({
        sourceId: sourceIdNum,
        companyId,
        year: form.year,
        type: autoType,
        amount: amountNum,
        unit: autoUnit,
        isAuto: false,
        evidence: form.evidence.trim() || null,
      });
      setOpen(false);
      setForm({ sourceId: '', year: YEAR, amount: '', evidence: '' });
      setTab(autoType);
      setFeedback({ kind: 'ok', msg: '활동자료를 입력했습니다.' });
    } catch {
      setFeedback({ kind: 'err', msg: '활동자료 입력 중 오류가 발생했습니다.' });
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '온실가스 인벤토리', path: '/e-data/inventory' }, { label: '활동자료' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">활동자료 입력</h1>
        <span className="text-xs text-slate-400">
          자동화율 <b className="text-emerald-400 tabular-nums">{autoRate}%</b>
        </span>
      </div>
      {guardReason && <p className="text-xs text-amber-400">저장 불가: {guardReason}</p>}
      {feedback && (
        <p className={`text-xs ${feedback.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{feedback.msg}</p>
      )}

      {/* 자동수집 툴바 */}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm">
          <RefreshCw size={14} /> i-Smart 동기화
        </Button>
        <Button variant="secondary" size="sm">
          <ScanLine size={14} /> 청구서 OCR
        </Button>
        <Button variant="secondary" size="sm">
          <Database size={14} /> ERP 커넥터
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          disabled={!canOpen}
          title={guardReason || undefined}
        >
          <Plus size={14} /> 수기 입력
        </Button>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs ${tab === t.id ? 'bg-sky-500/20 text-sky-300' : 'bg-white/[0.03] text-slate-400'}`}
          >
            {t.id === 'ELEC' ? <Zap size={13} /> : <Flame size={13} />}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ELEC' && (
        <Card className="border-sky-500/20 bg-sky-500/[0.04] p-4">
          <p className="text-xs text-sky-300">
            ⚡ 전력 사용량은 수집 인프라(한전 i-Smart·산단 EMS·계량)에서 자동 연동됩니다. 수기 입력 불필요.
          </p>
        </Card>
      )}

      {/* AI 이상치 경고 */}
      {tab === 'FUEL' && (
        <Card className="flex items-center gap-2 border-amber-500/20 bg-amber-500/[0.04] p-4">
          <AlertTriangle size={15} className="text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300">
            <b>AI 이상치 감지</b> — &lsquo;보일러 #1&rsquo; 사용량이 전월 대비 +38%. 계량 오류 여부 확인 권장.
          </p>
        </Card>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">시설</th>
              <th className="px-4 py-3">연도</th>
              <th className="px-4 py-3">사용량</th>
              <th className="px-4 py-3">단위</th>
              <th className="px-4 py-3">수집방식·소스</th>
              <th className="px-4 py-3">증빙</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  해당 유형의 활동자료가 없습니다
                </td>
              </tr>
            )}
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-white/[0.04] text-slate-300">
                <td className="px-4 py-3">{facility(a.sourceId)}</td>
                <td className="px-4 py-3">{a.year}</td>
                <td className="px-4 py-3">{a.amount.toLocaleString()}</td>
                <td className="px-4 py-3">{a.unit}</td>
                <td className="px-4 py-3">
                  {a.isAuto ? (
                    <span className="flex items-center gap-1.5">
                      <Badge variant="success">자동</Badge>
                      <span className="text-xs text-slate-500">{autoSource(a)}</span>
                    </span>
                  ) : (
                    <Badge variant="default">수기</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  {a.evidence ? (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Upload size={12} />
                      {a.evidence}
                    </span>
                  ) : a.isAuto ? (
                    '—'
                  ) : (
                    <span className="text-xs text-amber-400">미첨부</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-slate-500">
        자동화율(is_auto 비율)이 명세서 신뢰성·연차평가 증빙의 핵심 지표다. 수집 소스별로 근거를 원본까지 추적한다.
      </p>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="활동자료 수기 입력"
        footer={
          <>
            <Button variant="cancel" size="sm" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button variant="primary" size="sm" onClick={save} disabled={!valid} loading={create.isPending}>
              저장
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <label className={`${labelCls} col-span-2`}>
            배출원
            <select
              className={inputCls}
              value={form.sourceId}
              onChange={(e) => setForm({ ...form, sourceId: e.target.value })}
            >
              <option value="">선택하세요</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.site} · {s.facility} ({s.category})
                </option>
              ))}
            </select>
            {err.sourceId && <span className="mt-1 block text-xs text-red-400">{err.sourceId}</span>}
          </label>
          {/* 유형·단위는 선택한 배출원에서 자동(중복 분류 제거) */}
          <div className={labelCls}>
            유형·단위 (배출원 자동)
            <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
              {selectedSource ? (
                <>
                  <Badge variant="default">{autoType}</Badge>
                  <span className="text-xs text-slate-300">{autoUnit}</span>
                </>
              ) : (
                <span className="text-xs text-slate-500">배출원을 먼저 선택하세요</span>
              )}
            </div>
          </div>
          <label className={labelCls}>
            연도
            <input
              className={inputCls}
              type="number"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
            />
            {err.year && <span className="mt-1 block text-xs text-red-400">{err.year}</span>}
          </label>
          <label className={`${labelCls} col-span-2`}>
            사용량 ({autoUnit})
            <input
              className={inputCls}
              type="number"
              min={0}
              step="0.001"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            {err.amount && <span className="mt-1 block text-xs text-red-400">{err.amount}</span>}
          </label>
          <label className={`${labelCls} col-span-2`}>
            증빙 (계량기 번호·요금서 파일명)
            <input
              className={inputCls}
              value={form.evidence}
              onChange={(e) => setForm({ ...form, evidence: e.target.value })}
              placeholder="예: 2026-01 도시가스요금서"
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
