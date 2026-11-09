'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Save } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { SectionCard } from '@/components/features';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { TABLE, TABLE_HEAD_ROW, TABLE_TH, TABLE_ROW, TABLE_TD } from '@/components/features/DataList';
import { getNotificationSettings, saveNotificationSettings, getNotificationEventCatalog } from '@/api/platform/notifications';
import { useToastStore } from '@/stores/useToastStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { getPersona, usePersonaOverride } from '@/lib/persona';

// 알림 설정 — 지금 로그인한 계정의 설정. 알림 항목표(src/lib/notification-catalog.ts)의 항목마다 종(웹 알림)과 이메일을 켜고 끈다.
// 긴급 같은 구분 없이 전부 끌 수 있다. 받는 사람은 항목표의 기획 정보라 화면에 안 보인다(2026-11-09 사용자).
// 항목 목록과 저장값은 목업(/notifications/event-catalog · /notifications/settings)

interface EventRow {
  key: string;
  label: string;
  domain: string;
  inApp: boolean;
  email: boolean;
}

/** 트리 마디 — 항목 이름(메뉴 › 구역 › 항목)을 › 로 쪼개 만든다. 잎이 알림 항목 */
interface TreeNode {
  id: string;
  name: string;
  depth: number;
  children: TreeNode[];
  /** 이 마디 아래 알림 항목 키 전부 */
  keys: string[];
}
function buildTree(rows: EventRow[]): TreeNode[] {
  const roots: TreeNode[] = [];
  for (const r of rows) {
    const parts = [r.domain, ...r.label.split(' › ')];
    let level = roots;
    let path = '';
    parts.forEach((name, i) => {
      path = path ? `${path} › ${name}` : name;
      let node = level.find((n) => n.name === name);
      if (!node) {
        node = { id: path, name, depth: i, children: [], keys: [] };
        level.push(node);
      }
      node.keys.push(r.key);
      level = node.children;
    });
  }
  return roots;
}
function flatten(nodes: TreeNode[], collapsed: Set<string>, out: TreeNode[] = []): TreeNode[] {
  for (const n of nodes) {
    out.push(n);
    if (!collapsed.has(n.id)) flatten(n.children, collapsed, out);
  }
  return out;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={cn('relative h-5 w-9 rounded-full transition-colors', on ? 'bg-emerald-500' : 'bg-white/10')}
    >
      <span className={cn('absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform', on ? 'translate-x-4' : 'translate-x-0')} />
    </button>
  );
}

export default function NotificationSettingsPage() {
  const addToast = useToastStore((s) => s.add);
  // 계정 역할 — 관리자는 전부, 기업 계정(발전사업자 · 전기사용자)은 관리자만 받는 항목을 뺀다
  const user = useAuthStore((s) => s.user);
  const overrideVal = usePersonaOverride((s) => s.override);
  const isAdmin = (overrideVal ?? getPersona(user)) === 'admin';
  const [rows, setRows] = useState<EventRow[]>([]);
  const [saved, setSavedRows] = useState<EventRow[]>([]); // 마지막 저장값 — 취소하면 여기로
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const tree = useMemo(() => buildTree(rows), [rows]);
  const visible = useMemo(() => flatten(tree, collapsed), [tree, collapsed]);

  useEffect(() => {
    (async () => {
      try {
        const [catalog, settings] = await Promise.all([getNotificationEventCatalog(), getNotificationSettings().catch(() => [])]);
        const map = new Map(settings.map((s) => [s.eventKey, s]));
        const loaded = catalog.filter((e) => isAdmin || !e.adminOnly).map((e) => ({
            key: e.eventKey,
            label: e.label,
            domain: e.domain,
            inApp: map.get(e.eventKey)?.inAppEnabled ?? true,
            email: map.get(e.eventKey)?.emailEnabled ?? false,
        }));
        setRows(loaded);
        setSavedRows(loaded);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // 상위 마디의 토글은 그 아래 항목 전부를 켜고 끈다(역할 · 권한 메뉴 접근과 같은 방식)
  const toggleNode = (node: TreeNode, ch: 'inApp' | 'email') => {
    const set = new Set(node.keys);
    const allOn = rows.filter((r) => set.has(r.key)).every((r) => r[ch]);
    setRows((prev) => prev.map((r) => (set.has(r.key) ? { ...r, [ch]: !allOn } : r)));
    setDirty(true);
  };
  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      await saveNotificationSettings(rows.map((r) => ({ eventKey: r.key, inAppEnabled: r.inApp, emailEnabled: r.email })));
      setSavedRows(rows);
      setDirty(false);
      addToast('success', '알림 설정을 저장했습니다');
    } catch {
      addToast('error', '저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: isAdmin ? '관리' : '설정' }, { label: '알림 설정' }]} />
      <h1 className="text-2xl font-bold text-white">알림 설정</h1>

      <SectionCard
        title="알림 항목"
        noPadding
        actions={
          /* 취소 · 저장 — 항상 보이고 바꾼 값 없으면 둘 다 비활성(에너지 설정과 같은 규칙). 취소는 마지막 저장값으로 */
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="cancel"
              disabled={!dirty || saving || loading}
              onClick={() => {
                setRows(saved);
                setDirty(false);
              }}
            >
              취소
            </Button>
            <Button size="sm" onClick={save} disabled={!dirty || saving || loading}>
              <Save size={14} className="mr-1" /> 저장
            </Button>
          </div>
        }
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-slate-400" size={20} />
          </div>
        ) : (
          <table className={TABLE}>
            <thead>
              <tr className={TABLE_HEAD_ROW}>
                <th className={TABLE_TH}>항목</th>
                <th className={cn(TABLE_TH, 'w-28')}>웹 알림</th>
                <th className={cn(TABLE_TH, 'w-28')}>이메일</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((node) => {
                const set = new Set(node.keys);
                const mine = rows.filter((r) => set.has(r.key));
                const inApp = mine.every((r) => r.inApp);
                const email = mine.every((r) => r.email);
                const hasChildren = node.children.length > 0;
                return (
                  <tr key={node.id} className={cn(TABLE_ROW, node.depth === 0 && 'bg-white/[0.02]')}>
                    <td className={TABLE_TD}>
                      <div className="flex items-center gap-1.5" style={{ paddingLeft: node.depth * 20 }}>
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={() => toggleCollapse(node.id)}
                            className="rounded p-0.5 text-slate-500 hover:bg-white/[0.06] hover:text-white"
                            aria-label={collapsed.has(node.id) ? '펼치기' : '접기'}
                          >
                            {collapsed.has(node.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          </button>
                        ) : (
                          <span className="w-[22px]" />
                        )}
                        <span className={cn('text-sm', node.depth === 0 ? 'font-semibold text-white' : node.depth === 1 ? 'text-white' : 'text-slate-300')}>{node.name}</span>
                      </div>
                    </td>
                    <td className={TABLE_TD}><Toggle on={inApp} onChange={() => toggleNode(node, 'inApp')} label={`${node.id} 웹 알림`} /></td>
                    <td className={TABLE_TD}><Toggle on={email} onChange={() => toggleNode(node, 'email')} label={`${node.id} 이메일`} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
