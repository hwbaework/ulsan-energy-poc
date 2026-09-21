'use client';

import { useState, useEffect } from 'react';
import { Lock, Save, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SectionCard } from '@/components/features/SectionCard';
import { PageTitle } from '@/components/layout/PageTitle';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { useMe } from '@/hooks/auth/useAuth';

const ROLE_LABEL: Record<string, string> = {
  SYSTEM_ADMIN: '관리자',
  POWER_OPERATOR: '발전사업자',
  CONSUMER_MANAGER: '전기사용자',
  SPC_OPERATOR: '관리자 (SPC)',
};

export default function OrgProfilePage() {
  // /org/* 직행 시 스토어가 비므로 서버 /me로 보강
  const storeUser = useAuthStore((s) => s.user);
  const { data: me } = useMe();
  const user = storeUser ?? me ?? null;
  const setUser = useAuthStore((s) => s.setUser);
  const toast = useToastStore((s) => s.add);

  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setPhone((user as any).phone ?? '');
      setEmail(user.email ?? '');
      setDepartment((user as any).department ?? '');
    }
  }, [user]);

  async function handleSaveProfile() {
    if (!name.trim()) {
      toast('error', '이름을 입력해주세요');
      return;
    }
    setSaving(true);
    try {
      await getApiClient().put<any>(ENDPOINTS.me.updateProfile, {
        name: name.trim(),
        phone: phone.trim() || null,
        department: department.trim() || null,
      });
      // 저장값을 스토어에 반영해 화면·세션에 즉시 적용
      if (setUser)
        setUser({ ...(user as any), name: name.trim(), phone: phone.trim(), department: department.trim() } as any);
      toast('success', '기본 정보가 저장되었습니다');
    } catch {
      toast('error', '저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPw) {
      toast('error', '현재 비밀번호를 입력해주세요');
      return;
    }
    if (!newPw || newPw.length < 8) {
      toast('error', '새 비밀번호는 8자 이상이어야 합니다');
      return;
    }
    if (newPw !== confirmPw) {
      toast('error', '새 비밀번호가 일치하지 않습니다');
      return;
    }
    setPwSaving(true);
    try {
      await getApiClient().post(ENDPOINTS.auth.changePassword ?? `${ENDPOINTS.me.profile}/change-password`, {
        currentPassword: currentPw,
        newPassword: newPw,
      });
      toast('success', '비밀번호가 변경되었습니다');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch {
      toast('error', '비밀번호 변경에 실패했습니다. 현재 비밀번호를 확인해주세요');
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="space-y-6 animate-[fadeIn_300ms_ease-out]">
      <Breadcrumb items={[{ label: '설정' }, { label: '내 계정' }]} />
      <PageTitle title="내 계정" />

      <SectionCard
        title="기본 정보"
        actions={
          <Button size="sm" onClick={handleSaveProfile} loading={saving}>
            <Save size={14} className="mr-1.5" /> 저장
          </Button>
        }
      >
        <div className="space-y-4 px-6 py-5">
          {/* 변경 불가 항목은 입력칸이 아니라 텍스트로 표시(가이드 규칙) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="block text-sm font-medium text-accent mb-1.5">이메일 (아이디)</p>
              <p className="text-sm text-white">{email || '-'}</p>
            </div>
            <div>
              <p className="block text-sm font-medium text-accent mb-1.5">소속 기업</p>
              <p className="text-sm text-white">{(user as any)?.companyName || '-'}</p>
            </div>
            <div>
              <p className="block text-sm font-medium text-accent mb-1.5">역할</p>
              <p className="text-sm text-white">
                {((user as any)?.roles ?? []).map((r: string) => ROLE_LABEL[r] ?? r).join(', ') || '-'}
              </p>
            </div>
          </div>
          <Input label="이름" value={name} onChange={(e) => setName(e.target.value)} placeholder="이름을 입력하세요" />
          <Input
            label="부서"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="예: 운영팀"
          />
          <Input label="연락처" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" />
        </div>
      </SectionCard>

      <SectionCard
        title="비밀번호 변경"
        actions={
          <Button size="sm" onClick={handleChangePassword} loading={pwSaving}>
            <Lock size={14} className="mr-1.5" /> 비밀번호 변경
          </Button>
        }
      >
        <div className="space-y-4 px-6 py-5">
          <div className="relative">
            <Input
              label="현재 비밀번호"
              type={showCurrent ? 'text' : 'password'}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder="현재 비밀번호"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-3 top-9 text-slate-400 hover:text-white transition-colors"
            >
              {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <div className="relative">
            <Input
              label="새 비밀번호"
              type={showNew ? 'text' : 'password'}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="8자 이상"
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-9 text-slate-400 hover:text-white transition-colors"
            >
              {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <div className="relative">
            <Input
              label="새 비밀번호 확인"
              type={showConfirm ? 'text' : 'password'}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="새 비밀번호 재입력"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-9 text-slate-400 hover:text-white transition-colors"
            >
              {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {newPw && confirmPw && newPw !== confirmPw && (
            <p className="text-xs text-red-400">비밀번호가 일치하지 않습니다</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
