'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { SectionCard } from '@/components/features/SectionCard';
import { PageTitle } from '@/components/layout/PageTitle';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useToastStore } from '@/stores/useToastStore';
import { PpaScheduleCard } from '@/components/features/monitoring/PpaSchedule';

const LANGUAGE_OPTIONS = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
];

export default function OrgSettingsPage() {
  const [language, setLanguage] = useState('ko');
  const addToast = useToastStore((s) => s.add);

  return (
    <div className="space-y-6 animate-[fadeIn_300ms_ease-out]">
      <Breadcrumb items={[{ label: '설정' }]} />
      <PageTitle title="설정" />

      <SectionCard
        title="언어"
        actions={
          <Button size="sm" onClick={() => addToast('success', '설정이 저장되었습니다')}>
            <Save size={14} className="mr-1.5" /> 저장
          </Button>
        }
      >
        <div className="px-6 py-5">
          <Select
            label="언어"
            options={LANGUAGE_OPTIONS}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          />
        </div>
      </SectionCard>

      {/* PPA 운전 일정 — 발전사업자 자기 발전소만. 관리자 · 전기사용자는 안 보인다 */}
      <PpaScheduleCard />
    </div>
  );
}
