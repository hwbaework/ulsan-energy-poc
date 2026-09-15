'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTabStore } from '@/stores/useTabStore';
import { cn } from '@/lib/utils';

export function TabBar() {
  const { tabs, activeTabId, setActive, removeTab } = useTabStore();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  if (tabs.length === 0) return null;

  function scroll(direction: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: direction === 'left' ? -200 : 200, behavior: 'smooth' });
  }

  function handleClick(tabId: string, path: string) {
    setActive(tabId);
    router.push(path);
  }

  function handleClose(e: React.MouseEvent, tabId: string) {
    e.stopPropagation();
    const tab = tabs.find((t) => t.id === tabId);
    if (tab && !tab.closable) return;
    removeTab(tabId);
  }

  return (
    <div className="flex items-center border-b border-accent/20 bg-surface-card">
      <button onClick={() => scroll('left')} className="shrink-0 px-1 text-accent hover:text-white transition-colors">
        <ChevronLeft size={16} />
      </button>
      <div ref={scrollRef} className="flex flex-1 overflow-x-hidden">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleClick(tab.id, tab.path)}
            className={cn(
              'group flex items-center gap-1.5 whitespace-nowrap border-r border-accent/10 px-3 py-2 text-xs transition-colors',
              tab.id === activeTabId
                ? 'bg-surface-dark text-white border-b-2 border-b-primary'
                : 'text-accent hover:bg-accent/5 hover:text-white',
            )}
          >
            <span>{tab.label}</span>
            {tab.closable && (
              <span
                onClick={(e) => handleClose(e, tab.id)}
                className="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-accent/20 transition-opacity"
              >
                <X size={12} />
              </span>
            )}
          </button>
        ))}
      </div>
      <button onClick={() => scroll('right')} className="shrink-0 px-1 text-accent hover:text-white transition-colors">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
