'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Save } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { SectionCard } from '@/components/features';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { getNotificationSettings, saveNotificationSettings, getNotificationEventCatalog } from '@/api/platform/notifications';
import { useToastStore } from '@/stores/useToastStore';

// 알림 설정 — 오른쪽 상단 종(웹 알림)과 이메일로 어떤 항목을 보낼지 정한다. 관리자가 받는 플랫폼 전체 설정.
// 항목 목록과 저장값은 목업(/notifications/event-catalog · /notifications/settings)

interface EventRow {
  key: string;
  label: string;
  domain: string;
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
  const [rows, setRows] = useState<EventRow[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [catalog, settings] = await Promise.all([getNotificationEventCatalog(), getNotificationSettings().catch(() => [])]);
        const map = new Map(settings.map((s) => [s.eventKey, s]));
        setRows(
          catalog.map((e) => ({
            key: e.eventKey,
            label: e.label,
            domain: e.domain,
            inApp: map.get(e.eventKey)?.inAppEnabled ?? true,
            email: map.get(e.eventKey)?.emailEnabled ?? false,
          })),
        );
        setDomains([...new Set(catalog.map((e) => e.domain))]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (key: string, ch: 'inApp' | 'email') => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [ch]: !r[ch] } : r)));
    setDirty(true);
  };
  // 구분 행의 토글은 그 구분 전체를 켜고 끈다
  const toggleDomain = (domain: string, ch: 'inApp' | 'email') => {
    const allOn = rows.filter((r) => r.domain === domain).every((r) => r[ch]);
    setRows((prev) => prev.map((r) => (r.domain === domain ? { ...r, [ch]: !allOn } : r)));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveNotificationSettings(rows.map((r) => ({ eventKey: r.key, inAppEnabled: r.inApp, emailEnabled: r.email })));
      setDirty(false);
      addToast('success', '알림 설정을 저장했습니다');
    } catch {
      addToast('error', '저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  const th = 'px-5 py-3 text-left text-xs font-medium text-slate-400';

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '관리' }, { label: '알림 설정' }]} />
      <h1 className="text-2xl font-bold text-white">알림 설정</h1>

      <SectionCard
        title="알림 항목"
        noPadding
        actions={
          <Button size="sm" onClick={save} disabled={!dirty || saving || loading}>
            {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : dirty ? <Save size={14} className="mr-1" /> : <Check size={14} className="mr-1" />}
            {saving ? '저장 중…' : dirty ? '저장' : '저장됨'}
          </Button>
        }
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-slate-400" size={20} />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className={th}>항목</th>
                <th className={cn(th, 'w-32')}>웹 알림</th>
                <th className={cn(th, 'w-32')}>이메일</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => {
                const items = rows.filter((r) => r.domain === domain);
                const allInApp = items.every((r) => r.inApp);
                const allEmail = items.every((r) => r.email);
                return [
                  <tr key={`${domain}-head`} className="border-b border-white/[0.04] bg-white/[0.02]">
                    <td className="px-5 py-3 text-sm font-semibold text-white">{domain}</td>
                    <td className="px-5 py-3"><Toggle on={allInApp} onChange={() => toggleDomain(domain, 'inApp')} label={`${domain} 웹 알림 전체`} /></td>
                    <td className="px-5 py-3"><Toggle on={allEmail} onChange={() => toggleDomain(domain, 'email')} label={`${domain} 이메일 전체`} /></td>
                  </tr>,
                  ...items.map((r) => (
                    <tr key={r.key} className="border-b border-white/[0.04]">
                      <td className="px-5 py-3 pl-11 text-sm text-slate-300">{r.label}</td>
                      <td className="px-5 py-3"><Toggle on={r.inApp} onChange={() => toggle(r.key, 'inApp')} label={`${r.label} 웹 알림`} /></td>
                      <td className="px-5 py-3"><Toggle on={r.email} onChange={() => toggle(r.key, 'email')} label={`${r.label} 이메일`} /></td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
