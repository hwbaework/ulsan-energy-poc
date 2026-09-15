import { type ReactNode } from 'react';
import { Bell, LogOut, Menu, User } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useMenuStore } from '@/stores/useMenuStore';
import { useSignOut } from '@/hooks/auth/useAuth';
import { cn } from '@/lib/utils';

interface SystemMenuItem {
  id: string;
  label: string;
}

interface HeaderProps {
  systemMenus?: SystemMenuItem[];
  activeSystemId?: string | null;
  onSystemMenuClick?: (id: string) => void;
  notificationCount?: number;
  onNotificationClick?: () => void;
  weatherWidget?: ReactNode;
}

export function Header({
  systemMenus = [],
  activeSystemId,
  onSystemMenuClick,
  notificationCount = 0,
  onNotificationClick,
  weatherWidget,
}: HeaderProps) {
  const user = useAuthStore((s) => s.user);
  const signOut = useSignOut();
  const toggleCollapse = useMenuStore((s) => s.toggleCollapse);

  return (
    <header className="fixed top-0 z-[999] flex h-16 w-full items-center justify-between bg-surface-dark px-4 shadow-md">
      {/* Left: Logo + GNB */}
      <div className="flex h-full items-center gap-6">
        <button
          onClick={toggleCollapse}
          className="rounded p-1.5 text-accent hover:bg-accent/10 hover:text-white transition-colors lg:hidden"
          aria-label="메뉴 토글"
        >
          <Menu size={20} />
        </button>
        <a href="/" className="flex items-center gap-2">
          <img
            src="/images/logo.png"
            alt="로고"
            className="h-8"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <span className="text-sm font-semibold text-white">에너지 플랫폼</span>
        </a>

        {/* GNB */}
        {systemMenus.length > 0 && (
          <nav className="hidden h-full items-center lg:flex" aria-label="시스템 메뉴">
            <ul className="flex h-full">
              {systemMenus.map((menu) => (
                <li key={menu.id}>
                  <button
                    onClick={() => onSystemMenuClick?.(menu.id)}
                    className={cn(
                      'flex h-full items-center px-5 text-sm font-medium text-white transition-colors',
                      activeSystemId === menu.id ? 'bg-primary font-bold' : 'hover:bg-primary/20',
                    )}
                    aria-current={activeSystemId === menu.id ? 'page' : undefined}
                  >
                    {menu.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>

      {/* Right: Weather + Notification + User */}
      <div className="flex items-center gap-3">
        {weatherWidget}

        <button
          onClick={onNotificationClick}
          className="relative rounded p-2 text-accent hover:bg-accent/10 hover:text-white transition-colors"
          aria-label={`알림 ${notificationCount}건`}
        >
          <Bell size={18} />
          {notificationCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-semantic-red px-1 text-[10px] font-bold text-white">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2 text-sm">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20">
            <User size={16} className="text-accent" />
          </div>
          <div className="hidden flex-col gap-0.5 lg:flex">
            <span className="text-white text-xs font-medium">{user?.name ?? '사용자'}</span>
            <span className="text-accent text-[10px]">{user?.companyName ?? ''}</span>
          </div>
        </div>

        <button
          onClick={() => {
            signOut.mutate(undefined, {
              onSettled: () => {
                window.location.href = '/login';
              },
            });
          }}
          className="rounded p-2 text-accent hover:bg-semantic-red/10 hover:text-semantic-red transition-colors"
          aria-label="로그아웃"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
