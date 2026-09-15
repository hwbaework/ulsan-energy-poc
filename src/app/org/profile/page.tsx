'use client';

import { useState, useEffect } from 'react';
import { User, Lock, Save, Eye, EyeOff, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SectionCard } from '@/components/features/SectionCard';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { saveOnboardingMaster } from '@/api/common/onboarding';
import { useMe } from '@/hooks/auth/useAuth';

const SECTIONS = [
  { id: 'profile', icon: User, label: '기본 정보' },
  // 가입 온보딩 위저드 폐기(2026-09-04)에 따라 업종·규모 수집을 이 화면으로 이관 — companies onboarding-master API 재사용
  { id: 'company', icon: Building2, label: '기업 정보(업종·규모)' },
  { id: 'password', icon: Lock, label: '비밀번호 변경' },
];

export default function OrgProfilePage() {
  // /org/* 는 (main) 레이아웃 밖 — 직행 시 스토어가 비므로 서버 /me로 보강(온보딩 리다이렉트 동일 패턴)
  const storeUser = useAuthStore((s) => s.user);
  const { data: me } = useMe();
  const user = storeUser ?? me ?? null;
  const setUser = useAuthStore((s) => s.setUser);
  const toast = useToastStore((s) => s.add);

  const [activeSection, setActiveSection] = useState('profile');
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  // 기업 정보(업종·규모) — 구 온보딩 2단계 항목. 수집분만 저장(모든 필드 optional).
  const companyId = (user as any)?.companyId ?? null;
  const [ksicCode, setKsicCode] = useState('');
  const [industryCode, setIndustryCode] = useState('');
  const [employeeCount, setEmployeeCount] = useState('');
  const [annualRevenue, setAnnualRevenue] = useState('');
  const [allocationTarget, setAllocationTarget] = useState<boolean | null>(null);
  const [coSaving, setCoSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setPhone((user as any).phone ?? '');
      setEmail(user.email ?? '');
      // 회사 마스터 프리필 — /me 일원화 소스에서 기존 저장값 로드
      const u = user as any;
      setKsicCode(u.companyKsicCode ?? '');
      setIndustryCode(u.companyIndustryCode ?? '');
      setEmployeeCount(u.companyEmployeeCount != null ? String(u.companyEmployeeCount) : '');
      setAnnualRevenue(u.companyAnnualRevenue != null ? String(u.companyAnnualRevenue) : '');
      setAllocationTarget(u.companyAllocationTarget ?? null);
    }
  }, [user]);

  async function handleSaveProfile() {
    if (!name.trim()) {
      toast('error', '이름을 입력해주세요');
      return;
    }
    setSaving(true);
    try {
      const updated = await getApiClient().put<any>(ENDPOINTS.me.updateProfile, {
        name: name.trim(),
        phone: phone.trim() || null,
      });
      if (setUser && updated) setUser({ ...user, ...updated } as any);
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

  async function handleSaveCompany() {
    if (companyId == null) {
      toast('error', '소속 기업이 없어 저장할 수 없습니다');
      return;
    }
    const emp = employeeCount.trim() ? Number(employeeCount) : undefined;
    const rev = annualRevenue.trim() ? Number(annualRevenue) : undefined;
    if ((emp != null && (!Number.isFinite(emp) || emp < 0)) || (rev != null && (!Number.isFinite(rev) || rev < 0))) {
      toast('error', '직원수·매출은 0 이상의 숫자로 입력해주세요');
      return;
    }
    setCoSaving(true);
    try {
      await saveOnboardingMaster(companyId, {
        ksicCode: ksicCode.trim() || undefined,
        industryCode: industryCode.trim() || undefined,
        employeeCount: emp,
        annualRevenue: rev,
        allocationTarget: allocationTarget ?? undefined,
      });
      toast('success', '기업 정보가 저장되었습니다');
    } catch {
      toast('error', '저장에 실패했습니다');
    } finally {
      setCoSaving(false);
    }
  }

  return (
    <div className="space-y-6 animate-[fadeIn_300ms_ease-out]">
      <div>
        <h1 className="text-xl font-bold text-white">내 계정</h1>
        <p className="mt-1 text-sm text-slate-400">개인 계정 정보를 관리합니다</p>
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
          {activeSection === 'profile' && (
            <SectionCard title="기본 정보" description="이름, 이메일, 연락처를 관리합니다">
              <div className="space-y-4">
                {/* 아바타 */}
                <div className="flex items-center gap-4 pb-4 border-b border-white/[0.06]">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/30 text-2xl font-bold text-primary">
                    {name ? name[0] : '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{name || '—'}</p>
                    <p className="text-xs text-slate-400">{email}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{(user as any)?.roles?.join(', ') ?? ''}</p>
                  </div>
                </div>

                <Input
                  label="이름"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름을 입력하세요"
                />
                <div className="space-y-1">
                  <Input label="이메일" type="email" value={email} disabled placeholder="이메일" />
                  <p className="text-xs text-slate-500">이메일은 변경할 수 없습니다</p>
                </div>
                <Input
                  label="연락처"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                />
                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveProfile} loading={saving}>
                    <Save size={13} className="mr-1.5" /> 저장
                  </Button>
                </div>
              </div>
            </SectionCard>
          )}

          {activeSection === 'password' && (
            <SectionCard title="비밀번호 변경" description="정기적으로 비밀번호를 변경해 계정을 보호하세요">
              <div className="space-y-4">
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
                <div className="flex justify-end pt-2">
                  <Button onClick={handleChangePassword} loading={pwSaving}>
                    <Lock size={13} className="mr-1.5" /> 비밀번호 변경
                  </Button>
                </div>
              </div>
            </SectionCard>
          )}

          {activeSection === 'company' && (
            <SectionCard
              title="기업 정보(업종·규모)"
              description="온실가스 산정·할당대상 판정에 사용됩니다. 아는 항목만 입력해도 됩니다"
            >
              <div className="space-y-4">
                <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] p-3 text-sm text-slate-300">
                  <span className="text-slate-500 text-xs mr-2">소속 기업</span>
                  {(user as any)?.companyName ?? '—'}
                  {(user as any)?.businessNumber && (
                    <span className="ml-2 text-xs text-slate-500">{(user as any).businessNumber}</span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="표준산업분류(KSIC)"
                    value={ksicCode}
                    onChange={(e) => setKsicCode(e.target.value)}
                    placeholder="예: C29"
                  />
                  <Input
                    label="업종코드"
                    value={industryCode}
                    onChange={(e) => setIndustryCode(e.target.value)}
                    placeholder="예: 제조업"
                  />
                  <Input
                    label="직원수(명)"
                    type="number"
                    value={employeeCount}
                    onChange={(e) => setEmployeeCount(e.target.value)}
                    placeholder="예: 120"
                  />
                  <Input
                    label="연간 매출(백만원)"
                    type="number"
                    value={annualRevenue}
                    onChange={(e) => setAnnualRevenue(e.target.value)}
                    placeholder="예: 45000"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-300 mb-1.5">할당대상 여부 (목표관리제·배출권거래제)</p>
                  <div className="flex gap-2">
                    {[
                      { v: true, label: '할당대상' },
                      { v: false, label: '비대상' },
                    ].map((o) => (
                      <button
                        key={String(o.v)}
                        type="button"
                        onClick={() => setAllocationTarget(o.v)}
                        className={cn(
                          'rounded-lg px-4 py-2 text-sm ring-1 transition-colors',
                          allocationTarget === o.v
                            ? 'bg-primary/10 text-primary ring-primary/40 font-medium'
                            : 'text-slate-400 ring-white/[0.08] hover:text-white',
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveCompany} loading={coSaving}>
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
