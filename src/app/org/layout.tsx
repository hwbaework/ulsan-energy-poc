'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Building2,
  Users,
  Zap,
  Settings,
  ChevronLeft,
  ArrowLeft,
  Briefcase,
  UserCircle,
  Package,
  Server,
  CircleUser,
} from 'lucide-react';
import { ToastContainer } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { usePersonaOverride, getPersona, type Persona } from '@/lib/persona';
import { useAuthStore } from '@/stores/useAuthStore';

interface NavItem {
  to: string;
  icon: typeof Building2;
  label: string;
  end?: boolean;
}

const NAV_BY_PERSONA: Record<Persona, NavItem[]> = {
  generator: [
    { to: '/org', icon: Building2, label: '기업 정보', end: true },
    { to: '/org/members', icon: Users, label: '멤버 관리' },
    { to: '/org/stations', icon: Zap, label: '발전소 관리' },
    { to: '/org/settings', icon: Settings, label: '설정' },
    { to: '/org/profile', icon: CircleUser, label: '내 계정' },
  ],
  consumer: [
    { to: '/org', icon: Building2, label: '기업 정보', end: true },
    { to: '/org/members', icon: Users, label: '멤버 관리' },
    { to: '/org/stations', icon: Briefcase, label: '사업장 관리' },
    { to: '/org/settings', icon: Settings, label: '설정' },
    { to: '/org/profile', icon: CircleUser, label: '내 계정' },
  ],
  consultant: [
    { to: '/org', icon: Building2, label: '기업 정보', end: true },
    { to: '/org/members', icon: Users, label: '멤버 관리' },
    { to: '/org/stations', icon: UserCircle, label: '컨설턴트 프로필' },
    { to: '/org/settings', icon: Settings, label: '설정' },
    { to: '/org/profile', icon: CircleUser, label: '내 계정' },
  ],
  spc: [
    { to: '/org', icon: Building2, label: '기업 정보', end: true },
    { to: '/org/members', icon: Users, label: '멤버 관리' },
    { to: '/org/stations', icon: Package, label: '자산 관리' },
    { to: '/org/settings', icon: Settings, label: '설정' },
    { to: '/org/profile', icon: CircleUser, label: '내 계정' },
  ],
  admin: [
    { to: '/org', icon: Building2, label: '기업 정보', end: true },
    { to: '/org/members', icon: Users, label: '멤버 관리' },
    { to: '/org/stations', icon: Server, label: '시스템 설정' },
    { to: '/org/settings', icon: Settings, label: '설정' },
    { to: '/org/profile', icon: CircleUser, label: '내 계정' },
  ],
  operator: [
    { to: '/org', icon: Building2, label: '기업 정보', end: true },
    { to: '/org/settings', icon: Settings, label: '설정' },
    { to: '/org/profile', icon: CircleUser, label: '내 계정' },
  ],
  agency: [
    { to: '/org', icon: Building2, label: '기업 정보', end: true },
    { to: '/org/members', icon: Users, label: '멤버 관리' },
    { to: '/org/settings', icon: Settings, label: '설정' },
    { to: '/org/profile', icon: CircleUser, label: '내 계정' },
  ],
};

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const user = useAuthStore((s) => s.user);
  const overrideVal = usePersonaOverride((s) => s.override);
  const persona = overrideVal ?? getPersona(user);
  const NAV = NAV_BY_PERSONA[persona];

  return (
    <div className="flex min-h-screen bg-surface-dark bg-[url('/images/bg.jpg')] bg-cover bg-fixed bg-center">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/[0.06] bg-[#000C17]/90 backdrop-blur-md transition-all duration-200',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div className="flex h-16 items-center gap-3 px-4 border-b border-white/[0.06]">
          {!collapsed && <span className="text-sm font-bold text-white truncate">Settings</span>}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              'ml-auto rounded p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors',
              collapsed && 'mx-auto ml-0',
            )}
            aria-label="사이드바 토글"
          >
            <ChevronLeft size={16} className={cn('transition-transform', collapsed && 'rotate-180')} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV.map((item) => {
            const isActive = item.end
              ? pathname === item.to
              : pathname === item.to || pathname.startsWith(item.to + '/');
            return (
              <Link
                key={item.to}
                href={item.to}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.06]',
                  collapsed && 'justify-center px-0',
                )}
              >
                <item.icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/[0.06] p-2">
          <button
            onClick={() => router.push('/')}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors',
              collapsed && 'justify-center px-0',
            )}
          >
            <ArrowLeft size={18} className="shrink-0" />
            {!collapsed && <span>대시보드로</span>}
          </button>
        </div>
      </aside>

      <div className={cn('flex-1 transition-all duration-200', collapsed ? 'ml-16' : 'ml-60')}>
        <main className="p-6 max-w-6xl mx-auto">{children}</main>
      </div>

      <ToastContainer />
    </div>
  );
}
