'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/Input/PasswordInput';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { useAuthStore, roleFromEmail, type PocRole } from '@/stores/useAuthStore';
import { PERSONA_HOME } from '@/lib/persona';
import { cn } from '@/lib/utils';
import { ACCOUNT_ICON, type AccountKind } from '@/lib/account-icon';

const loginSchema = z.object({
  email: z.string().optional(),
  password: z.string().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

/**
 * POC 계정 버튼 — 누르면 그 계정의 이메일이 이메일 칸에 들어간다. 들어가는 것은 [로그인]을 눌러야(2026-11-16 사용자). 이메일 글자는 버튼에 보이지 않는다
 * 3 × 2(2026-11-24 사용자) — 왼쪽 전기사용자 · 가운데 발전사업자 · 오른쪽 관리자, 윗줄 기업 관리자 · 최고 관리자, 아랫줄 기업 회원 · 관리자.
 * 아이콘은 들어간 뒤 오른쪽 위 내 계정에도 같은 것(lib/account-icon)
 */
const TEST_OPEN_KEY = 'login-test-accounts-open';
const EMERALD = 'hover:border-emerald-400/60 hover:bg-emerald-500/10 text-emerald-300';
const AMBER = 'hover:border-amber-400/60 hover:bg-amber-500/10 text-amber-300';
const SKY = 'hover:border-sky-400/60 hover:bg-sky-500/10 text-sky-300';
const ROLE_BUTTONS: { label: string; sub?: string; email: string; kind: AccountKind; tone: string }[] = [
  // 이름은 기업명 — '전기사용자 / 발전사업자'는 계정 종류가 아니다(기업은 그렇게 가입하지 않는다, 계약 유형은 계약에 붙는 값). 계정 종류는 최고 관리자 · 관리자 · 기업 관리자 · 기업 회원 넷(2026-11-24 사용자)
  { label: '한길', sub: '기업 관리자', email: 'consumer@test.com', kind: 'companyAdmin', tone: EMERALD },
  { label: '한일튜브', sub: '기업 관리자', email: 'operator@test.com', kind: 'companyAdmin', tone: AMBER },
  { label: '최고 관리자', email: 'admin@test.com', kind: 'superAdmin', tone: SKY },
  { label: '한길', sub: '기업 회원', email: 'choi@hangil.co.kr', kind: 'companyMember', tone: EMERALD },
  { label: '한일튜브', sub: '기업 회원', email: 'kim@hanil.co.kr', kind: 'companyMember', tone: AMBER },
  { label: '관리자', email: 'manager@test.com', kind: 'admin', tone: SKY },
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
  // 테스트 계정 구역 — Alt + 1 로 통째로 숨기고 보인다(나중에 뺄 구역, 2026-11-24 사용자). 숨기면 화면에 아무 흔적도 남지 않는다. 상태는 이 브라우저에 기억
  const [testOpen, setTestOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(TEST_OPEN_KEY) === '0') setTestOpen(false);
    } catch {
      /* 기억 못 해도 펼친 채로 */
    }
  }, []);
  const toggleTest = () =>
    setTestOpen((v) => {
      try {
        localStorage.setItem(TEST_OPEN_KEY, v ? '0' : '1');
      } catch {
        /* 무시 */
      }
      return !v;
    });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.code === 'Digit1' || e.code === 'Numpad1')) {
        e.preventDefault();
        toggleTest();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { register, handleSubmit, setValue, setFocus } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  function enter(role: PocRole, email?: string) {
    loginAs(role, email);
    const redirect = searchParams.get('redirect');
    router.replace(redirect || PERSONA_HOME[role]);
  }

  function onSubmit(data: LoginFormData) {
    enter(roleFromEmail(data.email ?? ''), data.email);
  }

  return (
    <div className="animate-[fadeIn_400ms_ease-out]">
      <div className="mb-10 text-center">
        <Image src="/images/logo.png" alt="ESG 에너지 플랫폼" width={160} height={40} className="mx-auto mb-3" priority />
        <h1 className="text-2xl font-bold text-white">ESG 에너지 플랫폼</h1>
      </div>

      <div className="rounded-2xl bg-[#0d1520]/80 ring-1 ring-white/[0.08] backdrop-blur-sm p-8 shadow-elevation-4">
        <h2 className="text-lg font-semibold text-white mb-1">로그인</h2>
        <p className="text-sm text-slate-400 mb-6">계정에 로그인하여 시작하세요</p>

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

        {/* 테스트 계정 — Alt + 1 로 숨기고 보인다. 숨기면 구분선까지 같이 사라진다 */}
        <div className={cn('mt-6 flex items-center gap-3', !testOpen && 'hidden')}>
          <div className="flex-1 border-t border-white/[0.06]" />
          <span className="text-sm font-medium text-white">테스트 계정</span>
          <div className="flex-1 border-t border-white/[0.06]" />
        </div>

        <div className={cn('mt-5 grid grid-cols-3 gap-2', !testOpen && 'hidden')}>
          {ROLE_BUTTONS.map(({ label, sub, email, kind, tone }) => {
            const Icon = ACCOUNT_ICON[kind];
            return (
              <button
                key={email}
                type="button"
                onClick={() => {
                  setValue('email', email, { shouldDirty: true });
                  setFocus('password');
                }}
                className={cn(
                  'flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-left transition-all duration-150 active:scale-95',
                  tone,
                )}
              >
                <Icon size={18} className="shrink-0" />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-xs font-semibold text-white">{label}</span>
                  {sub && <span className="truncate text-[11px] font-normal text-white/80">{sub}</span>}
                </span>
              </button>
            );
          })}
        </div>
        {/* 회원가입 — 흐린 회색 · 어두운 파랑이라 잘 안 보였다. 문장은 흰색, 링크는 밝은 파랑 굵게 + 밑줄(2026-11-24 사용자) */}
        <p className="mt-6 text-center text-sm text-white">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="font-semibold text-sky-300 underline underline-offset-4 hover:text-sky-200 transition-colors">
            회원가입
          </Link>
        </p>
      </div>

      <p className="mt-6 text-center text-xs text-slate-300">&copy; 2025 에너지 플랫폼. All rights reserved.</p>
    </div>
  );
}
