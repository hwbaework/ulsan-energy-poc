'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Save, Loader2, Check, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Breadcrumb } from '@/components/layout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SectionCard } from '@/components/features/SectionCard';
import { StatusPill } from '@/components/ui/Design';
import { cn } from '@/lib/utils';
import {
  useRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useRoleMenus,
  useMenus,
  useAssignMenu,
  useRevokeMenu,
} from '@/hooks/platform/useRoles';
import { useMe } from '@/hooks/auth';
import { useToastStore } from '@/stores/useToastStore';

// 역할·권한 — 역할 목록 + 역할별 메뉴 접근 권한(트리). 메뉴를 볼 수 있는지만 관리한다(버튼 단위 권한 없음).
// 기본 역할(관리자·발전사업자·전기사용자)은 이름·설명 수정·삭제 불가, 추가한 역할만 가능.
// 본인이 보유한 역할의 접근 권한은 회수 불가(관리자 잠금 방지).

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
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  /* ── 역할 추가·수정·삭제 ── */
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<{ id: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [fName, setFName] = useState('');
  const [fDesc, setFDesc] = useState('');
  const openCreate = () => {
    setFName('');
    setFDesc('');
    setCreateOpen(true);
  };
  const openEdit = (r: { id: number; name: string; description?: string | null }) => {
    setFName(r.name);
    setFDesc(r.description ?? '');
    setEditRole({ id: r.id });
  };

  const isOwnRole = !!active?.code && myRoleCodes.includes(active.code);
  // 기본 역할(관리자·발전사업자·전기사용자)은 접근 권한도 고정 — 추가한 역할만 편집
  const locked = !!active?.system;

  /* ── 메뉴 트리 ── */
  const childrenOf = useMemo(() => {
    const map = new Map<number | null, typeof allMenus>();
    [...allMenus]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((m) => {
        const key = m.parentId ?? null;
        map.set(key, [...(map.get(key) ?? []), m]);
      });
    return map;
  }, [allMenus]);
  const descendantIds = (id: number): number[] => (childrenOf.get(id) ?? []).flatMap((c) => [c.id, ...descendantIds(c.id)]);

  // 기본은 전부 접힌 상태(대메뉴만 보임)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  useEffect(() => {
    setCollapsed(new Set(allMenus.filter((m) => allMenus.some((c) => c.parentId === m.id)).map((m) => m.id)));
  }, [allMenus]);
  const toggleCollapse = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const visibleRows = useMemo(() => {
    const rows: typeof allMenus = [];
    const walk = (parentId: number | null) => {
      (childrenOf.get(parentId) ?? []).forEach((m) => {
        rows.push(m);
        if (!collapsed.has(m.id)) walk(m.id);
      });
    };
    walk(null);
    return rows;
  }, [childrenOf, collapsed]);

  /* ── 접근 권한 편집 ── */
  // 원본: menuId → { canRead, canWrite }. canWrite 는 화면에서 다루지 않고 저장 시 원본 값을 그대로 넘긴다
  const original = useMemo(() => {
    const m = new Map<number, { canRead: boolean; canWrite: boolean }>();
    roleMenus.forEach((rm) => m.set(rm.menuId, { canRead: rm.canRead, canWrite: rm.canWrite }));
    return m;
  }, [roleMenus]);

  const [draft, setDraft] = useState<Map<number, boolean>>(new Map()); // menuId → 접근 가능
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const next = new Map<number, boolean>();
    allMenus.forEach((menu) => next.set(menu.id, original.get(menu.id)?.canRead ?? false));
    setDraft(next);
    setSaved(false);
  }, [allMenus, original]);

  // 상위 메뉴를 켜고 끄면 하위 메뉴도 같이 바뀐다
  const toggle = (menuId: number) => {
    setDraft((prev) => {
      const next = new Map(prev);
      const value = !(next.get(menuId) ?? false);
      for (const id of [menuId, ...descendantIds(menuId)]) next.set(id, value);
      return next;
    });
    setSaved(false);
  };

  const changes = useMemo(() => {
    const assigns: { menuId: number; canRead: boolean; canWrite: boolean }[] = [];
    const revokes: number[] = [];
    draft.forEach((on, menuId) => {
      const o = original.get(menuId);
      if (on && !o?.canRead) assigns.push({ menuId, canRead: true, canWrite: o?.canWrite ?? false });
      if (!on && o) revokes.push(menuId);
    });
    return { assigns, revokes };
  }, [draft, original]);
  const dirty = changes.assigns.length > 0 || changes.revokes.length > 0;
  const selfReduction = isOwnRole && changes.revokes.length > 0;

  const handleSave = async () => {
    if (!dirty || !activeId) return;
    if (selfReduction) {
      addToast('error', '본인이 보유한 역할의 접근 권한은 회수할 수 없습니다');
      return;
    }
    setSaving(true);
    try {
      for (const a of changes.assigns) await assignMenu.mutateAsync({ roleId: activeId, data: a });
      for (const menuId of changes.revokes) await revokeMenu.mutateAsync({ roleId: activeId, menuId });
      setSaved(true);
      addToast('success', `${active?.name ?? '역할'} 접근 권한을 저장했습니다`);
    } catch {
      addToast('error', '권한 저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  const selectRole = (id: number) => {
    if (dirty && !confirm('저장하지 않은 변경사항이 있습니다. 다른 역할로 이동할까요?')) return;
    setSelectedId(id);
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '관리' }, { label: '역할·권한' }]} />
      <h1 className="text-2xl font-bold text-white">역할·권한</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* 역할 목록 */}
        <SectionCard
          title="역할 목록"
          noPadding
          className="!h-auto"
          actions={
            <Button size="sm" onClick={openCreate}>
              <Plus size={14} className="mr-1" /> 역할 추가
            </Button>
          }
        >
          <ul>
            {roles.map((r) => {
              const mine = !!r.code && myRoleCodes.includes(r.code);
              const isActive = r.id === activeId;
              return (
                <li key={r.id} className="border-b border-white/[0.04] last:border-b-0">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => selectRole(r.id)}
                    onKeyDown={(e) => e.key === 'Enter' && selectRole(r.id)}
                    className={cn('flex items-start justify-between gap-2 px-4 py-3 cursor-pointer transition-colors', isActive ? 'bg-primary/10' : 'hover:bg-white/[0.03]')}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm', isActive ? 'font-semibold text-white' : 'text-slate-300')}>{r.name}</span>
                        {mine && <StatusPill tone="normal" label="내 역할" />}
                      </div>
                      {r.description && <p className="mt-0.5 text-xs text-slate-500 truncate">{r.description}</p>}
                    </div>
                    {/* 기본 역할(관리자·발전사업자·전기사용자)은 수정·삭제 없음 — 추가한 역할만 */}
                    {!r.system && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(r);
                          }}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-blue-400 transition-colors"
                          title="수정"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({ id: r.id, name: r.name });
                          }}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-red-400 transition-colors"
                          title="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
            {!roles.length && (
              <li className="px-4 py-10 text-center text-sm text-slate-500">{rolesQ.isLoading ? '불러오는 중…' : '역할이 없습니다'}</li>
            )}
          </ul>
        </SectionCard>

        {/* 선택 역할의 메뉴 접근 권한 */}
        <div className="lg:col-span-2">
          <SectionCard
            title={active ? `${active.name} · 메뉴 접근` : '메뉴 접근'}
            noPadding
            actions={
              locked ? (
                <span className="text-sm text-slate-400">기본 역할 · 접근 고정</span>
              ) : (
                <Button size="sm" onClick={handleSave} disabled={!dirty || saving || selfReduction}>
                  {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : saved && !dirty ? <Check size={14} className="mr-1" /> : <Save size={14} className="mr-1" />}
                  {saving ? '저장 중…' : saved && !dirty ? '저장됨' : dirty ? `저장 ${changes.assigns.length + changes.revokes.length}` : '저장'}
                </Button>
              )
            }
          >
            {!locked && isOwnRole && (
              <div className="flex items-center gap-2 px-5 py-3 border-b border-amber-500/20 bg-amber-500/[0.06]">
                <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                <p className="text-sm text-amber-300/90">현재 보유한 역할이라 접근 권한을 회수할 수 없습니다.</p>
              </div>
            )}

            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-400">메뉴</th>
                  <th className="px-5 py-3 text-center text-xs font-medium text-slate-400 w-24">접근</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((menu) => {
                  const on = draft.get(menu.id) ?? false;
                  const lock = locked || (isOwnRole && !!original.get(menu.id)?.canRead);
                  const hasChildren = (childrenOf.get(menu.id) ?? []).length > 0;
                  const depth = menu.depth ?? 0;
                  return (
                    <tr key={menu.id} className={cn('border-b border-white/[0.04]', depth === 0 && 'bg-white/[0.02]')}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5" style={{ paddingLeft: depth * 20 }}>
                          {hasChildren ? (
                            <button
                              type="button"
                              onClick={() => toggleCollapse(menu.id)}
                              className="rounded p-0.5 text-slate-500 hover:bg-white/[0.06] hover:text-white"
                              aria-label={collapsed.has(menu.id) ? '펼치기' : '접기'}
                            >
                              {collapsed.has(menu.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </button>
                          ) : (
                            <span className="w-[22px]" />
                          )}
                          <span className={cn('text-sm', depth === 0 ? 'font-semibold text-white' : depth === 1 ? 'text-white' : 'text-slate-300')}>{menu.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={locked || (lock && on)}
                          onChange={() => toggle(menu.id)}
                          className="h-4 w-4 accent-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label={`${menu.name} 접근`}
                        />
                      </td>
                    </tr>
                  );
                })}
                {!allMenus.length && (
                  <tr>
                    <td colSpan={2} className="px-5 py-10 text-center text-sm text-slate-500">{menusQ.isLoading ? '불러오는 중…' : '메뉴가 없습니다'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </SectionCard>
        </div>
      </div>

      {/* 역할 추가 */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="역할 추가" size="md">
        <div className="space-y-4">
          <Input label="역할 이름" value={fName} onChange={(e) => setFName(e.target.value)} placeholder="예: 운영 담당" />
          <Input label="설명" value={fDesc} onChange={(e) => setFDesc(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              취소
            </Button>
            <Button
              disabled={!fName.trim() || createRole.isPending}
              onClick={async () => {
                try {
                  // 코드는 서버(목업)가 자동 부여
                  const created = await createRole.mutateAsync({ name: fName.trim(), code: '', description: fDesc.trim() || undefined });
                  addToast('success', `${fName.trim()} 역할이 추가되었습니다`);
                  setCreateOpen(false);
                  setSelectedId(created.id);
                } catch {
                  addToast('error', '역할 추가에 실패했습니다');
                }
              }}
            >
              {createRole.isPending ? '추가 중...' : '추가'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 역할 수정 */}
      <Modal open={!!editRole} onClose={() => setEditRole(null)} title="역할 수정" size="md">
        {editRole && (
          <div className="space-y-4">
            <Input label="역할 이름" value={fName} onChange={(e) => setFName(e.target.value)} />
            <Input label="설명" value={fDesc} onChange={(e) => setFDesc(e.target.value)} />
            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <Button variant="secondary" onClick={() => setEditRole(null)}>
                취소
              </Button>
              <Button
                disabled={!fName.trim() || updateRole.isPending}
                onClick={async () => {
                  try {
                    await updateRole.mutateAsync({ id: editRole.id, data: { name: fName.trim(), description: fDesc.trim() || undefined } });
                    addToast('success', '역할이 수정되었습니다');
                    setEditRole(null);
                  } catch {
                    addToast('error', '역할 수정에 실패했습니다');
                  }
                }}
              >
                {updateRole.isPending ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 역할 삭제 */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="역할 삭제" size="sm">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              <span className="font-medium text-white">{deleteTarget.name}</span> 역할을 삭제하시겠습니까?
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
                취소
              </Button>
              <Button
                variant="danger"
                disabled={deleteRole.isPending}
                onClick={async () => {
                  try {
                    await deleteRole.mutateAsync(deleteTarget.id);
                    addToast('success', `${deleteTarget.name} 역할이 삭제되었습니다`);
                    if (selectedId === deleteTarget.id) setSelectedId(null);
                    setDeleteTarget(null);
                  } catch {
                    addToast('error', '역할 삭제에 실패했습니다');
                  }
                }}
              >
                {deleteRole.isPending ? '삭제 중...' : '삭제'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
