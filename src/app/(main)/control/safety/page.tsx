'use client';

import { useMemo, useState } from 'react';
import { Shield, Flame, Cloud, ClipboardCheck, MapPin, FileText, Plus, Pencil, Trash2 } from 'lucide-react';
import { Breadcrumb } from '@/components/layout';
import { Modal, ConfirmDialog, Input, Select, Textarea, Button } from '@/components/ui';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import {
  useSafetyAlerts,
  useInspections,
  useSafetyMap,
  useSafetyRules,
  useCreateInspection,
  useUpdateInspection,
  useDeleteInspection,
  INSPECTION_STATUS_FLOW,
  INSPECTION_TYPES,
  type Inspection,
  type InspectionInput,
} from '@/hooks/control/useControl';

// 안전 — 설계 v2/docs/12 §4 + 05 §S10-1(점검 CRUD)·§S10-2(안전지수). 백엔드 배선(17).
const RISK_TONE: Record<string, string> = {
  낮음: 'text-emerald-400',
  보통: 'text-sky-400',
  주의: 'text-amber-400',
  위험: 'text-red-400',
};
const RISK_WEIGHT: Record<string, number> = { 낮음: 0, 보통: 8, 주의: 18, 위험: 30 };

const STATUS_TONE: Record<string, string> = {
  완료: 'bg-emerald-500/10 text-emerald-400',
  진행: 'bg-amber-500/10 text-amber-400',
  예정: 'bg-sky-500/10 text-sky-400',
};

const TYPE_OPTIONS = INSPECTION_TYPES.map((t) => ({ value: t, label: t }));
const STATUS_OPTIONS = INSPECTION_STATUS_FLOW.map((s) => ({ value: s, label: s }));

const EMPTY_FORM: InspectionInput = { target: '', type: '정기', scheduled: '', status: '예정', note: '' };

/** 안전지수(S10-2) FE 계산 — 100 기준, 위험도·미해결 감지 감점. 하드코딩 92 제거. */
function computeSafetyIndex(maps: { risk: string }[], overheat: number, smoke: number): number {
  let score = 100;
  for (const m of maps) score -= RISK_WEIGHT[m.risk] ?? 0;
  score -= overheat * 4;
  score -= smoke * 6;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export default function SafetyPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const addToast = useToastStore((s) => s.add);
  const alertsQ = useSafetyAlerts(companyId);
  const inspQ = useInspections(companyId);
  const mapQ = useSafetyMap(companyId);
  const rulesQ = useSafetyRules(companyId);

  const createM = useCreateInspection();
  const updateM = useUpdateInspection();
  const deleteM = useDeleteInspection();

  // 프로덕션 mock 폴백 제거(캐논 useGhg 패턴): 실데이터/빈/오류 상태만 노출.
  const DETECT_ALERTS = alertsQ.data;
  const INSPECTIONS: Inspection[] = inspQ.data;
  const SAFETY_MAP = mapQ.data;
  const SAFETY_RULES = rulesQ.data;
  const overheat = SAFETY_MAP.reduce((s, m) => s + m.overheat, 0);
  const smoke = SAFETY_MAP.reduce((s, m) => s + m.smoke, 0);

  // 회사 미귀속 / 호출 실패를 정확히 구분(mock 폴백 없음).
  const guardReason =
    companyId == null
      ? '회사 정보가 없어 안전 데이터를 불러올 수 없습니다'
      : alertsQ.isError || inspQ.isError || mapQ.isError || rulesQ.isError
        ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
        : '';
  // CRUD 활성 판정: 훅 성공(실데이터 채널) 기반 — 빈 배열도 정상 활성(길이 무관).
  const isLiveInspections = inspQ.isLive;
  const safetyIndex = useMemo(() => computeSafetyIndex(SAFETY_MAP, overheat, smoke), [SAFETY_MAP, overheat, smoke]);

  // ── 모달 상태 ──
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Inspection | null>(null);
  const [form, setForm] = useState<InspectionInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<{ target?: boolean; scheduled?: boolean }>({});
  const [deleteTarget, setDeleteTarget] = useState<Inspection | null>(null);

  // 상태 전이 제약: 편집 시 현재 상태 이전 단계로의 역행 옵션 비활성(역행 400 선제 차단).
  const statusOptionsForEdit = useMemo(() => {
    if (!editing) return STATUS_OPTIONS;
    const currentIdx = INSPECTION_STATUS_FLOW.indexOf(editing.status as (typeof INSPECTION_STATUS_FLOW)[number]);
    if (currentIdx < 0) return STATUS_OPTIONS;
    return INSPECTION_STATUS_FLOW.filter((_, idx) => idx >= currentIdx).map((s) => ({ value: s, label: s }));
  }, [editing]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (row: Inspection) => {
    setEditing(row);
    setForm({ target: row.target, type: row.type, scheduled: row.scheduled, status: row.status, note: '' });
    setErrors({});
    setFormOpen(true);
  };

  const closeForm = () => {
    if (createM.isPending || updateM.isPending) return;
    setFormOpen(false);
  };

  const submit = () => {
    const nextErrors = { target: !form.target.trim(), scheduled: !form.scheduled.trim() };
    setErrors(nextErrors);
    if (nextErrors.target || nextErrors.scheduled) return;

    const body: InspectionInput = {
      target: form.target.trim(),
      type: form.type,
      scheduled: form.scheduled,
      status: form.status,
      note: form.note?.trim() || undefined,
    };

    if (editing) {
      updateM.mutate(
        { id: editing.id, body },
        {
          onSuccess: () => {
            addToast('success', '점검 수정 완료');
            setFormOpen(false);
          },
          onError: (e) => addToast('error', `점검 수정 실패: ${(e as Error).message}`),
        },
      );
    } else {
      createM.mutate(body, {
        onSuccess: () => {
          addToast('success', '점검 등록 완료');
          setFormOpen(false);
        },
        onError: (e) => addToast('error', `점검 등록 실패: ${(e as Error).message}`),
      });
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteM.mutate(deleteTarget.id, {
      onSuccess: () => {
        addToast('success', '점검 삭제 완료');
        setDeleteTarget(null);
      },
      onError: (e) => addToast('error', `점검 삭제 실패: ${(e as Error).message}`),
    });
  };

  const saving = createM.isPending || updateM.isPending;

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: '통합관제' }, { label: '안전' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">산업 안전 관제</h1>
        <span className="text-xs text-slate-400">AI 기반 과열·화재 감지 · 산업안전지도 · 점검·진단</span>
      </div>
      {guardReason && <p className="text-xs text-amber-400">{guardReason}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: <Shield size={15} />, label: '안전 지수', v: safetyIndex, tone: 'text-emerald-400' },
          { icon: <Flame size={15} />, label: '과열 감지', v: overheat, tone: 'text-orange-400' },
          { icon: <Cloud size={15} />, label: '연기 감지', v: smoke, tone: 'text-red-400' },
          {
            icon: <ClipboardCheck size={15} />,
            label: '예정 점검',
            v: INSPECTIONS.filter((i) => i.status === '예정').length,
            tone: 'text-sky-400',
          },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {s.icon} {s.label}
            </div>
            <div className={`mt-1 text-xl font-bold ${s.tone}`}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* 산업안전지도 */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02] flex items-center gap-1.5">
          <MapPin size={15} /> 산업안전지도 — 사업장·설비·위험성 평가
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">사업장</th>
              <th className="px-4 py-3 text-right">보유설비</th>
              <th className="px-4 py-3">위험성</th>
              <th className="px-4 py-3 text-right">과열</th>
              <th className="px-4 py-3 text-right">연기</th>
            </tr>
          </thead>
          <tbody>
            {SAFETY_MAP.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-500">
                  {guardReason ? '안전지도 데이터를 불러올 수 없습니다.' : '등록된 사업장 안전지도가 없습니다.'}
                </td>
              </tr>
            ) : (
              SAFETY_MAP.map((m) => (
                <tr key={m.id} className="border-b border-white/[0.04] text-slate-300">
                  <td className="px-4 py-3">{m.site}</td>
                  <td className="px-4 py-3 text-right">{m.facilities}</td>
                  <td className={`px-4 py-3 ${RISK_TONE[m.risk]}`}>{m.risk}</td>
                  <td className="px-4 py-3 text-right">
                    {m.overheat > 0 ? <span className="text-orange-400">{m.overheat}</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.smoke > 0 ? <span className="text-red-400">{m.smoke}</span> : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 과열·화재 감지 */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white mb-3">전기 과열 · 화재 연기 감지</h3>
          {DETECT_ALERTS.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/[0.08] px-3 py-8 text-center text-xs text-slate-500">
              {guardReason ? '감지 데이터를 불러올 수 없습니다.' : '감지된 과열·연기 알림이 없습니다.'}
            </div>
          ) : (
            <div className="space-y-2.5">
              {DETECT_ALERTS.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5">
                  {d.type === 'OVERHEAT' ? (
                    <Flame size={16} className="text-orange-400" />
                  ) : (
                    <Cloud size={16} className="text-red-400" />
                  )}
                  <div className="flex-1">
                    <div className="text-sm text-slate-300">{d.facility}</div>
                    <div className="text-[11px] text-slate-500">
                      {d.type === 'OVERHEAT' ? '과열 감지' : '연기 감지'} · {d.at}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${d.level === '경고' ? 'bg-orange-500/15 text-orange-400' : 'bg-amber-500/10 text-amber-400'}`}
                  >
                    {d.level}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11px] text-slate-500">알고리즘 분석 기반 화재/폭발 위험성 감지 — 사전 차단</p>
        </div>

        {/* 점검·진단 관리 (S10-1 CRUD) */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">점검 일정 · 안전 진단</h3>
            <Button variant="primary" size="sm" onClick={openCreate}>
              <Plus size={14} /> 점검 등록
            </Button>
          </div>

          {inspQ.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-white/[0.03] animate-pulse" />
              ))}
            </div>
          ) : INSPECTIONS.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/[0.08] px-3 py-8 text-center text-xs text-slate-500">
              등록된 점검이 없습니다. 「점검 등록」으로 첫 점검을 추가하세요.
            </div>
          ) : (
            <div className="space-y-2">
              {INSPECTIONS.map((i) => (
                <div key={i.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2.5">
                  <div>
                    <div className="text-sm text-slate-300">{i.target}</div>
                    <div className="text-[11px] text-slate-500">
                      {i.type} · {i.scheduled}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_TONE[i.status] ?? 'bg-slate-500/10 text-slate-400'}`}
                    >
                      {i.status}
                    </span>
                    {isLiveInspections && (
                      <>
                        <button
                          onClick={() => openEdit(i)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors"
                          aria-label="수정"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(i)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/[0.08] transition-colors"
                          aria-label="삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!isLiveInspections && !inspQ.isLoading && (
            <p className="mt-3 text-[11px] text-amber-400">점검 목록을 불러오지 못해 수정·삭제가 비활성화되었습니다.</p>
          )}
        </div>
      </div>

      {/* 안전보건관리규정 */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
          <FileText size={15} /> 안전보건관리규정
        </h3>
        {SAFETY_RULES.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/[0.08] px-3 py-8 text-center text-xs text-slate-500">
            {guardReason ? '규정 데이터를 불러올 수 없습니다.' : '등록된 안전보건관리규정이 없습니다.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SAFETY_RULES.map((r) => (
              <div key={r.id} className="rounded-lg bg-white/[0.03] px-3 py-2.5">
                <div className="text-sm text-slate-300">{r.name}</div>
                <div className="text-[11px] text-slate-500">
                  {r.version} · {r.updatedAt}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 등록/수정 모달 */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? '점검 수정' : '점검 등록'}
        footer={
          <>
            <Button variant="ghost" onClick={closeForm} disabled={saving}>
              취소
            </Button>
            <Button variant="primary" onClick={submit} loading={saving}>
              저장
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="점검대상"
            required
            placeholder="예: 1호기 인버터반"
            value={form.target}
            error={errors.target}
            errorMessage={errors.target ? '점검대상을 입력하세요' : undefined}
            onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
          />
          <Select
            label="점검유형"
            options={TYPE_OPTIONS}
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          />
          <Input
            label="예정일"
            type="date"
            required
            value={form.scheduled}
            error={errors.scheduled}
            errorMessage={errors.scheduled ? '예정일을 선택하세요' : undefined}
            onChange={(e) => setForm((f) => ({ ...f, scheduled: e.target.value }))}
          />
          <Select
            label="상태"
            options={editing ? statusOptionsForEdit : STATUS_OPTIONS}
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          />
          {editing && (
            <p className="text-[11px] text-slate-500">
              상태는 예정 → 진행 → 완료 순으로만 전이할 수 있습니다(역행 불가).
            </p>
          )}
          <Textarea
            label="비고"
            rows={3}
            placeholder="선택 입력"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </div>
      </Modal>

      {/* 삭제 확인 */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => {
          if (!deleteM.isPending) setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
        title="점검 삭제"
        message={`「${deleteTarget?.target ?? ''}」 점검을 삭제하시겠습니까?`}
        variant="danger"
        confirmLabel="삭제"
        loading={deleteM.isPending}
      />
    </div>
  );
}
