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
import { notifGroupOf } from '@/lib/notification-catalog';

// 알림 설정 — 지금 로그인한 계정의 설정. 알림 항목표(src/lib/notification-catalog.ts)의 항목마다 종(웹 알림)과 이메일을 켜고 끈다.
// 묶음(통합관제 · RE100 · E-데이터마켓 · 관리)만 접고 펼치는 2단계. 항목은 짧은 이름이고 전체 위치 · 발생 조건은 툴팁(2026-11-11 사용자).
// 긴급 같은 구분 없이 전부 끌 수 있다. 받는 사람은 항목표의 기획 정보라 화면에 안 보인다(2026-11-09 사용자).
// 항목 목록과 저장값은 목업(/notifications/event-catalog · /notifications/settings)

interface EventRow {
  key: string;
  /** 화면에 보이는 짧은 이름 */
  name: string;
  /** 전체 위치 — 툴팁 */
  label: string;
  /** 발생 조건 — 툴팁 */
  condition: string;
  domain: string;
  /** 설정 묶음(통합관제: 통신 · 전원 / 재난 경보 / 안전 / 예지보전, RE100: 자가소비 · PPA · 변경 · 해지) — 같은 묶음은 한 줄로 보이고 같이 켜고 끈다 */
  group: string | null;
  inApp: boolean;
  email: boolean;
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
  // 계정 역할 — 관리자는 기업만 받는 항목(세금계산서 등록 등)을, 기업 계정(발전사업자 · 전기사용자)은 관리자만 받는 항목을 뺀다
  const user = useAuthStore((s) => s.user);
  const overrideVal = usePersonaOverride((s) => s.override);
  const isAdmin = (overrideVal ?? getPersona(user)) === 'admin';
  const [rows, setRows] = useState<EventRow[]>([]);
  const [saved, setSavedRows] = useState<EventRow[]>([]); // 마지막 저장값 — 취소하면 여기로
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // 묶음 순서는 항목표 순서 그대로
  const domains = useMemo(() => [...new Set(rows.map((r) => r.domain))], [rows]);

  useEffect(() => {
    (async () => {
      try {
        const [catalog, settings] = await Promise.all([getNotificationEventCatalog(), getNotificationSettings().catch(() => [])]);
        const map = new Map(settings.map((s) => [s.eventKey, s]));
        const loaded = catalog.filter((e) => (isAdmin ? !e.companyOnly : !e.adminOnly)).map((e) => ({
            key: e.eventKey,
            name: e.name ?? e.label,
            label: e.label,
            condition: e.condition ?? '',
            domain: e.domain,
            group: notifGroupOf(e.eventKey),
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

  // 묶음 줄의 토글은 그 묶음 항목 전부를 켜고 끈다
  const toggleDomain = (domain: string, ch: 'inApp' | 'email') => {
    const allOn = rows.filter((r) => r.domain === domain).every((r) => r[ch]);
    setRows((prev) => prev.map((r) => (r.domain === domain ? { ...r, [ch]: !allOn } : r)));
    setDirty(true);
  };
  // 묶음 줄(자가소비 등)의 토글 — 그 묶음의 상태 알림 전부
  const toggleGroup = (group: string, ch: 'inApp' | 'email') => {
    const allOn = rows.filter((r) => r.group === group).every((r) => r[ch]);
    setRows((prev) => prev.map((r) => (r.group === group ? { ...r, [ch]: !allOn } : r)));
    setDirty(true);
  };
  const toggleItem = (key: string, ch: 'inApp' | 'email') => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [ch]: !r[ch] } : r)));
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
              {domains.map((domain) => {
                const items = rows.filter((r) => r.domain === domain);
                // 화면에 보이는 줄 — 묶음은 첫 항목 자리에 한 줄
                const lines = items.filter((r, i) => !r.group || items.findIndex((x) => x.group === r.group) === i);
                const allInApp = items.every((r) => r.inApp);
                const allEmail = items.every((r) => r.email);
                const open = !collapsed.has(domain);
                return [
                  <tr key={domain} className={cn(TABLE_ROW, 'bg-white/[0.02]')}>
                    <td className={TABLE_TD}>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleCollapse(domain)}
                          className="rounded p-0.5 text-slate-500 hover:bg-white/[0.06] hover:text-white"
                          aria-label={open ? '접기' : '펼치기'}
                        >
                          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <span className="text-sm font-semibold text-white">{domain}</span>
                      </div>
                    </td>
                    <td className={TABLE_TD}><Toggle on={allInApp} onChange={() => toggleDomain(domain, 'inApp')} label={`${domain} 웹 알림 전체`} /></td>
                    <td className={TABLE_TD}><Toggle on={allEmail} onChange={() => toggleDomain(domain, 'email')} label={`${domain} 이메일 전체`} /></td>
                  </tr>,
                  ...(open
                    ? lines.map((r) => {
                        const members = r.group ? items.filter((x) => x.group === r.group) : [r];
                        const name = r.group ?? r.name;
                        // 묶음 줄의 툴팁은 안에 든 상태 알림 이름, 낱개 줄은 전체 위치 · 발생 조건
                        const tip = r.group ? members.map((m) => m.name).join(', ') : `${r.label}\n${r.condition}`;
                        const onOf = (ch: 'inApp' | 'email') => members.every((m) => m[ch]);
                        const flip = (ch: 'inApp' | 'email') => (r.group ? toggleGroup(r.group, ch) : toggleItem(r.key, ch));
                        return (
                          <tr key={r.group ?? r.key} className={TABLE_ROW}>
                            <td className={TABLE_TD}>
                              <span className="pl-[26px] text-sm text-white" title={tip}>
                                {name}
                              </span>
                            </td>
                            <td className={TABLE_TD}><Toggle on={onOf('inApp')} onChange={() => flip('inApp')} label={`${name} 웹 알림`} /></td>
                            <td className={TABLE_TD}><Toggle on={onOf('email')} onChange={() => flip('email')} label={`${name} 이메일`} /></td>
                          </tr>
                        );
                      })
                    : []),
                ];
              })}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
