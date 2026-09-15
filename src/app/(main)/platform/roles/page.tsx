'use client';

import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, KeyRound, Save, Loader2, Check, AlertTriangle } from 'lucide-react';
import { Breadcrumb } from '@/components/layout';
import { useRoles, useRoleMenus, useMenus, useAssignMenu, useRevokeMenu } from '@/hooks/platform/useRoles';
import { useMe } from '@/hooks/auth';
import { useToastStore } from '@/stores/useToastStore';

// 역할·권한 — V63 ADMIN_ROLE(/platform/roles) 대응 화면(doc 04 §5).
// 역할 목록 + 역할별 메뉴 권한(role_menus) 조회·편집. 편집 액션은 백엔드 audit_logs에 기록(ROLE_MENU_ASSIGN/REVOKE).
// 자기 자신이 보유한 역할의 권한은 회수(축소) 불가 — 관리자 self-lockout 방지.

interface DraftPerm {
  canRead: boolean;
  canWrite: boolean;
}

export default function PlatformRolesPage() {
  const addToast = useToastStore((s) => s.add);
  const meQ = useMe();
  const myRoleCodes = useMemo<string[]>(() => meQ.data?.roles ?? [], [meQ.data]);

  const rolesQ = useRoles();
  const roles = rolesQ.data ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const activeId = selectedId ?? roles[0]?.id ?? 0;
  const active = roles.find((r) => r.id === activeId);

  const menusQ = useMenus();
  const allMenus = menusQ.data ?? [];
  const roleMenusQ = useRoleMenus(activeId);
  const roleMenus = useMemo(() => roleMenusQ.data ?? [], [roleMenusQ.data]);

  const assignMenu = useAssignMenu();
  const revokeMenu = useRevokeMenu();

  // 편집 대상 역할이 현재 사용자가 보유한 역할인지(→ 축소 차단)
  const isOwnRole = !!active?.code && myRoleCodes.includes(active.code);

  // 원본 권한 맵(menuId → {canRead, canWrite}) — 저장 시 diff 비교 기준
  const original = useMemo(() => {
    const m = new Map<number, DraftPerm>();
    roleMenus.forEach((rm) => m.set(rm.menuId, { canRead: rm.canRead, canWrite: rm.canWrite }));
    return m;
  }, [roleMenus]);

  // 편집 상태(draft) — 역할/원본 변경 시 초기화
  const [draft, setDraft] = useState<Map<number, DraftPerm>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const next = new Map<number, DraftPerm>();
    allMenus.forEach((menu) => {
      const o = original.get(menu.id);
      next.set(menu.id, { canRead: o?.canRead ?? false, canWrite: o?.canWrite ?? false });
    });
    setDraft(next);
    setSaved(false);
  }, [allMenus, original]);

  const toggle = (menuId: number, field: keyof DraftPerm) => {
    setDraft((prev) => {
      const next = new Map(prev);
      const cur = next.get(menuId) ?? { canRead: false, canWrite: false };
      const updated: DraftPerm = { ...cur, [field]: !cur[field] };
      // 쓰기 권한은 조회 권한을 전제 — 쓰기 켜면 조회 자동 활성
      if (field === 'canWrite' && updated.canWrite) updated.canRead = true;
      // 조회 끄면 쓰기도 해제
      if (field === 'canRead' && !updated.canRead) updated.canWrite = false;
      next.set(menuId, updated);
      return next;
    });
    setSaved(false);
  };

  // 변경분 계산: assign(신규/변경), revoke(전부 해제)
  const changes = useMemo(() => {
    const assigns: { menuId: number; canRead: boolean; canWrite: boolean }[] = [];
    const revokes: number[] = [];
    draft.forEach((d, menuId) => {
      const o = original.get(menuId);
      const hadPerm = !!o;
      const hasPerm = d.canRead || d.canWrite;
      if (!hasPerm && hadPerm) {
        revokes.push(menuId);
      } else if (hasPerm && (!o || o.canRead !== d.canRead || o.canWrite !== d.canWrite)) {
        assigns.push({ menuId, canRead: d.canRead, canWrite: d.canWrite });
      }
    });
    return { assigns, revokes };
  }, [draft, original]);

  const dirty = changes.assigns.length > 0 || changes.revokes.length > 0;

  // 자기 역할이면 권한 축소(회수/쓰기 해제) 여부 검사 → self-lockout 차단
  const selfReduction = useMemo(() => {
    if (!isOwnRole) return false;
    const revokesGranted = changes.revokes.length > 0;
    const downgraded = changes.assigns.some((a) => {
      const o = original.get(a.menuId);
      return o && ((o.canRead && !a.canRead) || (o.canWrite && !a.canWrite));
    });
    return revokesGranted || downgraded;
  }, [isOwnRole, changes, original]);

  const handleSave = async () => {
    if (!dirty || !activeId) return;
    if (selfReduction) {
      addToast('error', '본인이 보유한 역할의 권한은 회수·축소할 수 없습니다 (관리자 잠금 방지).');
      return;
    }
    setSaving(true);
    try {
      for (const a of changes.assigns) {
        await assignMenu.mutateAsync({ roleId: activeId, data: a });
      }
      for (const menuId of changes.revokes) {
        await revokeMenu.mutateAsync({ roleId: activeId, menuId });
      }
      setSaved(true);
      addToast('success', `${active?.name ?? '역할'} 메뉴 권한을 저장했습니다`);
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? '저장 실패';
      addToast('error', `권한 저장 실패: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: '관리' }, { label: '역할·권한' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">역할·권한</h1>
        <span className="text-xs text-slate-400">역할별 메뉴 접근 권한 (role_menus) 편집</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 역할 목록 */}
        <div className="rounded-xl border border-white/[0.06] overflow-hidden self-start">
          <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02] flex items-center gap-2">
            <ShieldCheck size={14} className="text-sky-400" /> 역할 목록
          </div>
          <ul>
            {roles.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => {
                    if (dirty && !confirm('저장하지 않은 변경사항이 있습니다. 다른 역할로 이동할까요?')) return;
                    setSelectedId(r.id);
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-white/[0.04] transition-colors ${
                    r.id === activeId ? 'bg-sky-500/10' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${r.id === activeId ? 'text-white font-semibold' : 'text-slate-300'}`}>
                      {r.name}
                    </span>
                    <div className="flex items-center gap-1">
                      {!!r.code && myRoleCodes.includes(r.code) && (
                        <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-400">내 역할</span>
                      )}
                      {r.system && (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400">시스템</span>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {r.code} {r.description ? `· ${r.description}` : ''}
                  </div>
                </button>
              </li>
            ))}
            {!roles.length && (
              <li className="px-4 py-8 text-center text-xs text-slate-500">
                {rolesQ.isLoading ? '불러오는 중…' : '역할 데이터가 없습니다.'}
              </li>
            )}
          </ul>
        </div>

        {/* 선택 역할의 메뉴 권한 편집 */}
        <div className="lg:col-span-2 rounded-xl border border-white/[0.06] overflow-hidden self-start">
          <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02] flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <KeyRound size={14} className="text-emerald-400" /> {active ? `${active.name} — 메뉴 권한` : '메뉴 권한'}
            </span>
            <button
              onClick={handleSave}
              disabled={!dirty || saving || selfReduction}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 size={13} className="animate-spin" />
              ) : saved && !dirty ? (
                <Check size={13} />
              ) : (
                <Save size={13} />
              )}
              {saving
                ? '저장 중…'
                : saved && !dirty
                  ? '저장됨'
                  : `저장${dirty ? ` (${changes.assigns.length + changes.revokes.length})` : ''}`}
            </button>
          </div>

          {isOwnRole && (
            <div className="flex items-start gap-2 px-4 py-2.5 bg-amber-500/[0.06] border-b border-amber-500/20">
              <AlertTriangle size={13} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-300/90">
                현재 보유한 역할입니다. 권한 추가는 가능하지만 기존 권한의 <b>회수·축소는 차단</b>됩니다 (관리자 잠금
                방지).
              </p>
            </div>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                <th className="px-4 py-3">메뉴</th>
                <th className="px-4 py-3 text-center">조회</th>
                <th className="px-4 py-3 text-center">쓰기</th>
              </tr>
            </thead>
            <tbody>
              {allMenus.map((menu) => {
                const d = draft.get(menu.id) ?? { canRead: false, canWrite: false };
                const o = original.get(menu.id);
                const lockRead = isOwnRole && !!o?.canRead; // 자기 역할의 기존 조회권한은 해제 불가
                const lockWrite = isOwnRole && !!o?.canWrite;
                return (
                  <tr key={menu.id} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-4 py-2.5">
                      {menu.name}
                      <span className="ml-1.5 text-[10px] text-slate-600">{menu.menuCode}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={d.canRead}
                        disabled={lockRead && d.canRead}
                        onChange={() => toggle(menu.id, 'canRead')}
                        className="h-4 w-4 accent-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={`${menu.name} 조회 권한`}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={d.canWrite}
                        disabled={lockWrite && d.canWrite}
                        onChange={() => toggle(menu.id, 'canWrite')}
                        className="h-4 w-4 accent-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={`${menu.name} 쓰기 권한`}
                      />
                    </td>
                  </tr>
                );
              })}
              {!allMenus.length && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-xs text-slate-500">
                    {menusQ.isLoading ? '불러오는 중…' : '메뉴 데이터가 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        권한 부여·회수는 즉시 백엔드 감사 로그(audit_logs: ROLE_MENU_ASSIGN / ROLE_MENU_REVOKE)에 기록됩니다. 쓰기
        권한은 조회 권한을 전제하며, 본인 역할의 기존 권한은 축소할 수 없습니다.
      </p>
    </div>
  );
}
