'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface SidebarItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

interface SidebarProps {
  items: SidebarItem[];
  className?: string;
}

/**
 * Sub-menu sidebar that renders a list of navigation items.
 * Used by AppLayout when the active GNB item has children.
 */
export function Sidebar({ items, className }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'fixed top-14 left-0 bottom-0 z-40 w-52 border-r border-white/[0.06] bg-[#000C17]/90 backdrop-blur-md overflow-y-auto',
        className,
      )}
    >
      <nav className="py-3 px-2 space-y-0.5">
        {items.map((item) => {
          const isActive = pathname === item.to || pathname.startsWith(item.to + '/');
          return (
            <Link
              key={item.to}
              href={item.to}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]',
              )}
            >
              <item.icon size={16} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
