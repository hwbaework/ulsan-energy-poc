'use client';

import { useEffect, useState } from 'react';
import { Bell, Mail, Check, Loader2 } from 'lucide-react';
import { SectionCard } from '@/components/features';
import { Button } from '@/components/ui/Button';
import {
  getNotificationSettings,
  saveNotificationSettings,
  getNotificationEventCatalog,
} from '@/api/platform/notifications';

interface EventConfig {
  key: string;
  label: string;
  domain: string;
  inApp: boolean;
  email: boolean;
}

// 이벤트 카탈로그(키·라벨·도메인)는 백엔드가 SoR — GET /notifications/event-catalog 로 조회.
// 사용자 채널 설정(inApp/email)은 GET /notifications/settings 로 병합한다.

export default function NotificationSettingsPage() {
  const [events, setEvents] = useState<EventConfig[]>([]);
  const [domainOrder, setDomainOrder] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [catalog, serverSettings] = await Promise.all([
          getNotificationEventCatalog(),
          getNotificationSettings().catch(() => []),
        ]);
        const settingMap = new Map(serverSettings.map((s) => [s.eventKey, s]));
        setEvents(
          catalog.map((evt) => {
            const s = settingMap.get(evt.eventKey);
            return {
              key: evt.eventKey,
              label: evt.label,
              domain: evt.domain,
              inApp: s?.inAppEnabled ?? true,
              email: s?.emailEnabled ?? false,
            };
          }),
        );
        setDomainOrder([...new Set(catalog.map((e) => e.domain))]);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (key: string, channel: 'inApp' | 'email') => {
    setEvents((prev) => prev.map((e) => (e.key === key ? { ...e, [channel]: !e[channel] } : e)));
    setSaved(false);
  };

  const toggleDomain = (domain: string, channel: 'inApp' | 'email', value: boolean) => {
    setEvents((prev) => prev.map((e) => (e.domain === domain ? { ...e, [channel]: value } : e)));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveNotificationSettings(
        events.map((e) => ({
          eventKey: e.key,
          inAppEnabled: e.inApp,
          emailEnabled: e.email,
        })),
      );
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const domains = domainOrder;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-sky-400" size={24} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">알림 설정</h1>
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-6 text-sm text-rose-300">
          이벤트 카탈로그를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">알림 설정</h1>
          <p className="mt-1 text-sm text-slate-400">이벤트별 알림 채널을 설정합니다 ({events.length}개 이벤트)</p>
        </div>
        <Button onClick={handleSave} disabled={saving || saved}>
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" /> 저장 중...
            </>
          ) : saved ? (
            <>
              <Check size={14} /> 저장됨
            </>
          ) : (
            '설정 저장'
          )}
        </Button>
      </div>

      {domains.map((domain) => {
        const domainEvents = events.filter((e) => e.domain === domain);
        const allInApp = domainEvents.every((e) => e.inApp);
        const allEmail = domainEvents.every((e) => e.email);
        return (
          <SectionCard key={domain} title={`${domain} (${domainEvents.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-400 border-b border-white/[0.06]">
                  <tr>
                    <th className="px-4 py-3 font-medium">이벤트</th>
                    <th className="px-4 py-3 font-medium text-center">
                      <button
                        className="inline-flex items-center gap-1 hover:text-sky-400 transition-colors"
                        onClick={() => toggleDomain(domain, 'inApp', !allInApp)}
                      >
                        <Bell size={12} /> 인앱
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium text-center">
                      <button
                        className="inline-flex items-center gap-1 hover:text-sky-400 transition-colors"
                        onClick={() => toggleDomain(domain, 'email', !allEmail)}
                      >
                        <Mail size={12} /> 이메일
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {domainEvents.map((evt) => (
                    <tr key={evt.key} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-white">{evt.label}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggle(evt.key, 'inApp')}
                          className={`w-8 h-5 rounded-full transition-colors ${
                            evt.inApp ? 'bg-emerald-500' : 'bg-white/10'
                          }`}
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded-full bg-white transition-transform mx-0.5 ${
                              evt.inApp ? 'translate-x-3' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggle(evt.key, 'email')}
                          className={`w-8 h-5 rounded-full transition-colors ${
                            evt.email ? 'bg-emerald-500' : 'bg-white/10'
                          }`}
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded-full bg-white transition-transform mx-0.5 ${
                              evt.email ? 'translate-x-3' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
}
