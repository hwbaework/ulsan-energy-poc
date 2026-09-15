'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw } from 'lucide-react';
import { SectionCard } from '@/components/features';
import { Button } from '@/components/ui/Button';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';

interface SystemSetting {
  key: string;
  value: string;
  description?: string;
}

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedKeys, setEditedKeys] = useState<Set<string>>(new Set());

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await getApiClient().get<SystemSetting[]>(ENDPOINTS.systemSettings.list);
      setSettings(Array.isArray(data) ? data : []);
    } catch {
      setSettings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateValue = (key: string, value: string) => {
    setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, value } : s)));
    setEditedKeys((prev) => new Set(prev).add(key));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const key of editedKeys) {
        const setting = settings.find((s) => s.key === key);
        if (setting) {
          await getApiClient().put(ENDPOINTS.systemSettings.byKey(key), { value: setting.value });
        }
      }
      setEditedKeys(new Set());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">시스템 설정</h1>
          <p className="mt-1 text-sm text-slate-400">플랫폼 운영 환경 변수 관리</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={fetchSettings} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 새로고침
          </Button>
          <Button size="sm" onClick={saveAll} disabled={saving || editedKeys.size === 0}>
            <Save size={14} /> {saving ? '저장 중...' : `저장 (${editedKeys.size}건)`}
          </Button>
        </div>
      </div>

      <SectionCard title="설정 항목" description={`총 ${settings.length}개`}>
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm">로딩 중...</div>
        ) : settings.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">등록된 설정 없음</div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {settings.map((s) => (
              <div key={s.key} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Settings size={14} className="text-slate-500 flex-shrink-0" />
                    <span className="text-sm font-mono text-white truncate">{s.key}</span>
                    {editedKeys.has(s.key) && <span className="text-[10px] text-amber-400 font-medium">수정됨</span>}
                  </div>
                  {s.description && <p className="text-xs text-slate-500 mt-0.5 ml-6">{s.description}</p>}
                </div>
                <input
                  type="text"
                  value={s.value}
                  onChange={(e) => updateValue(s.key, e.target.value)}
                  className="w-64 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-sky-500/50"
                />
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
