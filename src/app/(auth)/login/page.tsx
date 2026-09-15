'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Factory, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/Input/PasswordInput';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { useAuthStore, roleFromEmail, type PocRole } from '@/stores/useAuthStore';
import { PERSONA_HOME } from '@/lib/persona';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  email: z.string().optional(),
  password: z.string().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

/** POC 역할 진입 버튼 — 실제 인증 없이 역할만 선택해서 들어간다 */
const ROLE_BUTTONS: { role: PocRole; label: string; desc: string; icon: typeof Building2; tone: string }[] = [
  {
    role: 'consumer',
    label: '전기사용자',
    desc: 'consumer@test.com',
    icon: Building2,
    tone: 'hover:border-emerald-400/60 hover:bg-emerald-500/10 text-emerald-300',
  },
  {
    role: 'generator',
    label: '발전사업자',
    desc: 'operator@test.com',
    icon: Factory,
    tone: 'hover:border-amber-400/60 hover:bg-amber-500/10 text-amber-300',
  },
  {
    role: 'admin',
    label: '관리자',
    desc: 'admin@test.com',
    icon: ShieldCheck,
    tone: 'hover:border-sky-400/60 hover:bg-sky-500/10 text-sky-300',
  },
];

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const loginAs = useAuthStore((s) => s.loginAs);
  const [remember, setRemember] = useState(true);

  const { register, handleSubmit } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  function enter(role: PocRole) {
    loginAs(role);
    const redirect = searchParams.get('redirect');
    router.replace(redirect || PERSONA_HOME[role]);
  }

  function onSubmit(data: LoginFormData) {
    enter(roleFromEmail(data.email ?? ''));
  }

  return (
    <div className="animate-[fadeIn_400ms_ease-out]">
      <div className="mb-10 text-center">
        <Image src="/images/logo.png" alt="에너지 플랫폼" width={160} height={40} className="mx-auto mb-3" priority />
        <h1 className="text-2xl font-bold text-white">울산 에너지 자급자족 플랫폼</h1>
        <p className="mt-1 text-sm text-slate-400">통합 에너지 관리 시스템 · POC</p>
      </div>

      <div className="rounded-2xl bg-[#0d1520]/80 ring-1 ring-white/[0.08] backdrop-blur-sm p-8 shadow-elevation-4">
        <h2 className="text-lg font-semibold text-white mb-1">로그인</h2>
        <p className="text-sm text-slate-400 mb-6">POC 데모 — 아래 역할 버튼으로 바로 진입할 수 있습니다</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="이메일" type="text" placeholder="name@company.com" autoComplete="email" {...register('email')} />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-accent">비밀번호</label>
            <PasswordInput placeholder="비밀번호를 입력하세요" autoComplete="current-password" {...register('password')} />
          </div>

          <div className="flex items-center justify-between">
            <Checkbox label="로그인 상태 유지" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          </div>

          <Button type="submit" className="w-full" size="lg">
            로그인
          </Button>
        </form>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex-1 border-t border-white/[0.06]" />
          <span className="text-xs text-slate-500">역할 선택 진입</span>
          <div className="flex-1 border-t border-white/[0.06]" />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {ROLE_BUTTONS.map(({ role, label, desc, icon: Icon, tone }) => (
            <button
              key={role}
              type="button"
              onClick={() => enter(role)}
              className={cn(
                'group flex flex-col items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2 py-4 transition-all duration-150 active:scale-95',
                tone,
              )}
            >
              <Icon size={22} />
              <span className="text-sm font-semibold text-white">{label}</span>
              <span className="text-[10px] text-slate-500 group-hover:text-slate-400">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-[11px] text-slate-600">&copy; 2026 울산 에너지 자급자족 플랫폼 POC. All rights reserved.</p>
    </div>
  );
}
