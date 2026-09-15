'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Badge } from '@/components/edm/ui/Badge';
import { Button } from '@/components/edm/ui/Button';
import { Breadcrumb } from '@/components/edm/layout/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { QuickEmissionWizard } from '@/components/edm/ghg/QuickEmissionWizard';
import { useAuthStore } from '@/stores/useAuthStore';
import { useGhgSources, useUpdateSource, useDeleteSource, type SourceReq } from '@/hooks/edm/useGhg';
import { useConsumerSites } from '@/hooks/consumer/useConsumer';
import type { EmissionSource } from '@/mocks/edm/ghg';

// 배출원 관리 — 설계 docs/기획/22 §2.
// 역할 재정의: 신규 등록은 통합 위저드로 일원화(대시보드와 동일 UX). 이 화면은 등록된
//   배출원 마스터를 조회·정정·삭제하는 관리 화면(MRV 10스텝 1단계).
// 가드(설계 22): 회사 미귀속 / 호출 실패를 정확히 구분(mock 폴백 없음).

const inputCls = 'mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-slate-200';
const labelCls = 'block text-xs text-slate-400';

export default function SourcesPage() {
  const [scope, setScope] = useState<'ALL' | 1 | 2>('ALL');
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const { data: sources, isError } = useGhgSources(companyId);
  // 사업장 일원화 — 사업장 신청 화면에서 등록한 마스터(consumer_sites)를 선택지로 제공(직접 입력도 허용)
  const { data: siteMaster } = useConsumerSites(companyId != null ? { companyId } : undefined);
  // getConsumerSites 는 PageResponse({content:[...]}) 반환 — 배열/페이지 응답 모두 안전 처리(.map 크래시 방지).
  const siteArr = (
    Array.isArray(siteMaster)
      ? siteMaster
      : ((siteMaster as { content?: Array<{ name?: string }> } | undefined)?.content ?? [])
  ) as Array<{ name?: string }>;
  const siteNames = [...new Set(siteArr.map((x) => x.name).filter((v): v is string => !!v))];
  const rows = sources.filter((s) => scope === 'ALL' || s.scope === scope);

  const update = useUpdateSource();
  const del = useDeleteSource();

  // 신규 등록 = 통합 위저드(진입점 일원화)
  const [wizardOpen, setWizardOpen] = useState(false);
  // 마스터 정정 = 편집 모달
  const [editing, setEditing] = useState<EmissionSource | null>(null);
  const [editForm, setEditForm] = useState<{
    site: string;
    facility: string;
    scope: 1 | 2;
    tier: 1 | 2 | 3;
    fuelFactor: string;
  }>({
    site: '',
    facility: '',
    scope: 1,
    tier: 1,
    fuelFactor: '',
  });
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  // 정정/삭제 가능 게이트(설계 22): 회사 미귀속 / 호출 실패(인증만료·네트워크)를 정확히 구분.
  const guardReason =
    companyId == null
      ? '회사 정보가 없어 관리할 수 없습니다'
      : isError
        ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
        : '';
  const canManage = !guardReason;

  function openEdit(s: EmissionSource) {
    setFeedback(null);
    setEditing(s);
    setEditForm({
      site: s.site,
      facility: s.facility,
      scope: s.scope,
      tier: s.tier,
      fuelFactor: s.fuelFactor != null ? String(s.fuelFactor) : '',
    });
  }

  const fuelFactorNum = editForm.fuelFactor.trim() === '' ? null : Number(editForm.fuelFactor);
  const editErr = {
    site: editForm.site.trim() === '' ? '사업장명을 입력하세요' : '',
    facility: editForm.facility.trim() === '' ? '시설명을 입력하세요' : '',
    fuelFactor:
      fuelFactorNum != null && (!Number.isFinite(fuelFactorNum) || fuelFactorNum < 0) ? '0 이상의 수를 입력하세요' : '',
  };
  const editValid = !editErr.site && !editErr.facility && !editErr.fuelFactor;

  async function saveEdit() {
    if (!editing || !editValid || companyId == null) return;
    setFeedback(null);
    const req: SourceReq = {
      companyId,
      site: editForm.site.trim(),
      facility: editForm.facility.trim(),
      scope: editForm.scope,
      category: editing.category,
      tier: editForm.tier,
      fuelFactor: fuelFactorNum,
    };
    try {
      await update.mutateAsync({ id: Number(editing.id), req });
      setEditing(null);
      setFeedback({ kind: 'ok', msg: '배출원을 수정했습니다.' });
    } catch {
      setFeedback({ kind: 'err', msg: '배출원 수정 중 오류가 발생했습니다.' });
    }
  }

  async function remove(s: EmissionSource) {
    if (companyId == null) return;
    if (!window.confirm(`'${s.site} · ${s.facility}' 배출원을 삭제하시겠습니까?`)) return;
    setFeedback(null);
    try {
      await del.mutateAsync({ id: Number(s.id), companyId });
      setFeedback({ kind: 'ok', msg: '배출원을 삭제했습니다.' });
    } catch (e) {
      // BE GH001: 활동자료 존재 시 차단
      const msg =
        (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        '배출원 삭제 중 오류가 발생했습니다.';
      setFeedback({ kind: 'err', msg });
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '온실가스 인벤토리', path: '/e-data/inventory' }, { label: '배출원 관리' }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">배출원 관리</h1>
          <p className="mt-1 text-xs text-slate-500">
            등록된 배출원을 조회·정정·삭제합니다. 신규 등록은 통합 위저드로 진행됩니다.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setWizardOpen(true)}
          disabled={!canManage}
          title={guardReason || undefined}
        >
          <Plus size={15} /> 배출원 추가
        </Button>
      </div>
      {guardReason && <p className="text-xs text-amber-400">관리 불가: {guardReason}</p>}
      {feedback && (
        <p className={`text-xs ${feedback.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{feedback.msg}</p>
      )}

      {/* 신규 등록 — 대시보드와 동일한 통합 위저드(진입점 일원화) */}
      <QuickEmissionWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        companyId={companyId}
        canSave={canManage}
        guardReason={guardReason || undefined}
      />

      <div className="flex gap-2">
        {(['ALL', 1, 2] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`rounded-lg px-3 py-1.5 text-xs ${scope === s ? 'bg-sky-500/20 text-sky-300' : 'bg-white/[0.03] text-slate-400'}`}
          >
            {s === 'ALL' ? '전체' : `Scope ${s}`}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">사업장</th>
              <th className="px-4 py-3">시설</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">배출활동</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-500">
                  등록된 배출원이 없습니다. "배출원 추가"로 시작하세요.
                </td>
              </tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-white/[0.04] text-slate-300">
                <td className="px-4 py-3">{s.site}</td>
                <td className="px-4 py-3">{s.facility}</td>
                <td className="px-4 py-3">
                  <Badge variant={s.scope === 1 ? 'warning' : 'info'}>Scope {s.scope}</Badge>
                </td>
                <td className="px-4 py-3">{s.category}</td>
                <td className="px-4 py-3">
                  <Badge variant="default">Tier {s.tier}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEdit(s)}
                      disabled={!canManage}
                      title={canManage ? '수정' : guardReason}
                      className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => remove(s)}
                      disabled={!canManage || del.isPending}
                      title={canManage ? '삭제' : guardReason}
                      className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-slate-500">
        Scope 1 = 고정·이동연소·공정·탈루 / Scope 2 = 구매전력·스팀. 활동자료가 등록된 배출원은 삭제할 수 없습니다(산정
        데이터 보호).
      </p>

      {/* 마스터 정정 모달 — 배출활동(category)은 배출원 정체성이므로 변경 불가(정정 필요 시 삭제 후 재등록) */}
      <Modal
        open={editing != null}
        onClose={() => setEditing(null)}
        title="배출원 수정"
        footer={
          <>
            <Button variant="cancel" size="sm" onClick={() => setEditing(null)}>
              취소
            </Button>
            <Button variant="primary" size="sm" onClick={saveEdit} disabled={!editValid} loading={update.isPending}>
              저장
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <label className={labelCls}>
            사업장
            <input
              className={inputCls}
              list="site-master-options"
              value={editForm.site}
              onChange={(e) => setEditForm({ ...editForm, site: e.target.value })}
              placeholder="사업장 선택 또는 입력"
            />
            <datalist id="site-master-options">
              {siteNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            {editErr.site && <span className="mt-1 block text-xs text-red-400">{editErr.site}</span>}
          </label>
          <label className={labelCls}>
            시설
            <input
              className={inputCls}
              value={editForm.facility}
              onChange={(e) => setEditForm({ ...editForm, facility: e.target.value })}
            />
            {editErr.facility && <span className="mt-1 block text-xs text-red-400">{editErr.facility}</span>}
          </label>
          <div className={labelCls}>
            배출활동 (변경 불가)
            <div className="mt-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-slate-300">
              {editing?.category}
            </div>
          </div>
          <label className={labelCls}>
            Scope
            <select
              className={inputCls}
              value={editForm.scope}
              onChange={(e) => setEditForm({ ...editForm, scope: Number(e.target.value) as 1 | 2 })}
            >
              <option value={1}>Scope 1 (직접)</option>
              <option value={2}>Scope 2 (간접·전력)</option>
            </select>
          </label>
          <label className={labelCls}>
            Tier
            <select
              className={inputCls}
              value={editForm.tier}
              onChange={(e) => setEditForm({ ...editForm, tier: Number(e.target.value) as 1 | 2 | 3 })}
            >
              <option value={1}>Tier 1</option>
              <option value={2}>Tier 2</option>
              <option value={3}>Tier 3</option>
            </select>
          </label>
          <label className={`${labelCls} col-span-2`}>
            연료계수 (선택, 실측 override · Tier3)
            <input
              className={inputCls}
              type="number"
              min={0}
              step="0.0001"
              value={editForm.fuelFactor}
              onChange={(e) => setEditForm({ ...editForm, fuelFactor: e.target.value })}
              placeholder="사업장 실측계수"
            />
            {editErr.fuelFactor && <span className="mt-1 block text-xs text-red-400">{editErr.fuelFactor}</span>}
          </label>
        </div>
      </Modal>
    </div>
  );
}
