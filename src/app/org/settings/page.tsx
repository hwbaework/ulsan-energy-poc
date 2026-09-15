'use client';

import { useState } from 'react';
import { Bell, Shield, Globe, Mail, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { SectionCard } from '@/components/features/SectionCard';
import { cn } from '@/lib/utils';
import { usePersonaOverride, getPersona, type Persona } from '@/lib/persona';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Seoul', label: 'Asia/Seoul (KST, UTC+9)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST, UTC+9)' },
  { value: 'UTC', label: 'UTC' },
];

const LANGUAGE_OPTIONS = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
];

interface SettingSection {
  id: string;
  icon: typeof Bell;
  label: string;
}

const SECTIONS: SettingSection[] = [
  { id: 'notification', icon: Bell, label: '알림 설정' },
  { id: 'security', icon: Shield, label: '보안 정책' },
  { id: 'general', icon: Globe, label: '일반 설정' },
  { id: 'email', icon: Mail, label: '이메일 설정' },
];

interface NotificationItem {
  title: string;
  description: string;
  defaultChecked?: boolean;
}

const NOTIFICATIONS_BY_PERSONA: Record<Persona, NotificationItem[]> = {
  generator: [
    { title: '설비 이상 알림', description: '설비 이상 감지 시 이메일 알림', defaultChecked: true },
    { title: '일일 리포트', description: '매일 발전량 요약 리포트', defaultChecked: true },
    { title: '멤버 활동', description: '신규 가입, 역할 변경 등' },
    { title: '컨설팅 진행 알림', description: '컨설팅 단계 변경 시 알림', defaultChecked: true },
  ],
  consumer: [
    { title: '사용량 초과 알림', description: '월간 목표 사용량 초과 시 알림', defaultChecked: true },
    { title: '요금 변동 알림', description: '전기요금 단가 변동 시 알림', defaultChecked: true },
    { title: 'RE100 리포트', description: 'RE100 이행 현황 정기 리포트', defaultChecked: true },
    { title: '멤버 활동', description: '신규 가입, 역할 변경 등' },
  ],
  consultant: [
    { title: '프로젝트 단계 변경', description: '담당 프로젝트 단계 변경 시 알림', defaultChecked: true },
    { title: '고객 피드백 알림', description: '고객사 피드백 수신 시 알림', defaultChecked: true },
    { title: '일간 업무 요약', description: '매일 업무 현황 요약 리포트', defaultChecked: true },
    { title: '멤버 활동', description: '신규 가입, 역할 변경 등' },
  ],
  spc: [
    { title: 'PPA 계약 만기 알림', description: 'PPA 계약 만기 30일 전 알림', defaultChecked: true },
    { title: '정산 마감 알림', description: '월간 정산 마감일 알림', defaultChecked: true },
    { title: '발전량 이상 알림', description: '발전량 급변 또는 이상 감지 시 알림', defaultChecked: true },
    { title: '멤버 활동', description: '신규 가입, 역할 변경 등' },
  ],
  admin: [
    { title: '시스템 장애 알림', description: '플랫폼 시스템 장애 발생 시 알림', defaultChecked: true },
    { title: '신규 가입 알림', description: '신규 기업/사용자 가입 시 알림', defaultChecked: true },
    { title: '보안 이벤트 알림', description: '비정상 접근 및 보안 이벤트 감지', defaultChecked: true },
    { title: '멤버 활동', description: '역할 변경 등' },
  ],
  operator: [
    { title: '이상 감지 알림', description: '담당 발전소 이상 발생 시 즉시 알림', defaultChecked: true },
    { title: '작업 배정 알림', description: '유지보수 작업 배정 시 알림', defaultChecked: true },
    { title: '에스컬레이션 알림', description: '미처리 이상 에스컬레이션 시 알림', defaultChecked: true },
  ],
  agency: [
    { title: '프로젝트 배정 알림', description: '신규 프로젝트 배정 시 알림', defaultChecked: true },
    { title: '컨설턴트 상태 변경', description: '소속 컨설턴트 상태 변경 시 알림', defaultChecked: true },
    { title: '용역비 정산 알림', description: '월간 용역비 정산 완료 시 알림', defaultChecked: true },
  ],
};

export default function OrgSettingsPage() {
  const [activeSection, setActiveSection] = useState('notification');
  const user = useAuthStore((s) => s.user);
  const overrideVal = usePersonaOverride((s) => s.override);
  const persona = overrideVal ?? getPersona(user);
  const notifications = NOTIFICATIONS_BY_PERSONA[persona];

  return (
    <div className="space-y-6 animate-[fadeIn_300ms_ease-out]">
      <div>
        <h1 className="text-xl font-bold text-white">설정</h1>
        <p className="mt-1 text-sm text-slate-400">기업 설정을 관리합니다</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Section Nav */}
        <div className="xl:col-span-1">
          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-2 space-y-0.5">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  activeSection === section.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.06]',
                )}
              >
                <section.icon size={16} />
                <span>{section.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="xl:col-span-3 space-y-6">
          {activeSection === 'notification' && (
            <SectionCard title="알림 설정" description="알림 수신 방법을 설정합니다">
              <div className="space-y-5">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-slate-300 uppercase tracking-wider">이메일 알림</p>
                  {notifications.map((item) => (
                    <label key={item.title} className="flex items-center justify-between cursor-pointer group">
                      <div>
                        <p className="text-sm text-white">{item.title}</p>
                        <p className="text-xs text-slate-500">{item.description}</p>
                      </div>
                      <Checkbox defaultChecked={item.defaultChecked} />
                    </label>
                  ))}
                </div>

                <div className="border-t border-white/[0.06] pt-4 space-y-3">
                  <p className="text-xs font-medium text-slate-300 uppercase tracking-wider">알림 수신 시간</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="시작 시간" type="time" defaultValue="09:00" />
                    <Input label="종료 시간" type="time" defaultValue="18:00" />
                  </div>
                  <p className="text-xs text-slate-500">설정된 시간 외에는 긴급 알림만 발송됩니다</p>
                </div>

                <div className="flex justify-end pt-2">
                  <Button size="sm" onClick={() => useToastStore.getState().add('success', '설정이 저장되었습니다')}>
                    <Save size={13} className="mr-1.5" /> 저장
                  </Button>
                </div>
              </div>
            </SectionCard>
          )}

          {activeSection === 'security' && (
            <SectionCard title="보안 정책" description="기업 보안 정책을 설정합니다">
              <div className="space-y-5">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-slate-300 uppercase tracking-wider">비밀번호 정책</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="최소 비밀번호 길이" type="number" defaultValue="8" />
                    <Input label="비밀번호 만료 (일)" type="number" defaultValue="90" />
                  </div>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-sm text-white">특수문자 필수</p>
                      <p className="text-xs text-slate-500">비밀번호에 특수문자 1개 이상 포함</p>
                    </div>
                    <Checkbox defaultChecked />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-sm text-white">2단계 인증 필수</p>
                      <p className="text-xs text-slate-500">모든 멤버에게 2FA 적용</p>
                    </div>
                    <Checkbox />
                  </label>
                </div>

                <div className="border-t border-white/[0.06] pt-4 space-y-3">
                  <p className="text-xs font-medium text-slate-300 uppercase tracking-wider">접근 제어</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="로그인 실패 허용 횟수" type="number" defaultValue="5" />
                    <Input label="세션 타임아웃 (분)" type="number" defaultValue="30" />
                  </div>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-sm text-white">IP 화이트리스트</p>
                      <p className="text-xs text-slate-500">허용된 IP에서만 접근 가능</p>
                    </div>
                    <Checkbox />
                  </label>
                </div>

                <div className="flex justify-end pt-2">
                  <Button size="sm" onClick={() => useToastStore.getState().add('success', '설정이 저장되었습니다')}>
                    <Save size={13} className="mr-1.5" /> 저장
                  </Button>
                </div>
              </div>
            </SectionCard>
          )}

          {activeSection === 'general' && (
            <SectionCard title="일반 설정" description="기본 설정을 관리합니다">
              <div className="space-y-4">
                <Select label="시간대" options={TIMEZONE_OPTIONS} value="Asia/Seoul" />
                <Select label="언어" options={LANGUAGE_OPTIONS} value="ko" />
                <Input label="날짜 형식" defaultValue="YYYY-MM-DD" disabled />
                <div className="flex justify-end pt-2">
                  <Button size="sm" onClick={() => useToastStore.getState().add('success', '설정이 저장되었습니다')}>
                    <Save size={13} className="mr-1.5" /> 저장
                  </Button>
                </div>
              </div>
            </SectionCard>
          )}

          {activeSection === 'email' && (
            <SectionCard title="이메일 설정" description="발신 이메일을 설정합니다">
              <div className="space-y-4">
                <Input label="발신자 이름" defaultValue="에너지 플랫폼" />
                <Input label="발신 이메일" type="email" defaultValue="noreply@energy-platform.co.kr" />
                <Input label="회신 이메일" type="email" defaultValue="support@energy-platform.co.kr" />
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm text-white">이메일 하단 로고 표시</p>
                    <p className="text-xs text-slate-500">발신 이메일에 기업 로고 포함</p>
                  </div>
                  <Checkbox defaultChecked />
                </label>
                <div className="flex justify-end pt-2">
                  <Button size="sm" onClick={() => useToastStore.getState().add('success', '설정이 저장되었습니다')}>
                    <Save size={13} className="mr-1.5" /> 저장
                  </Button>
                </div>
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
