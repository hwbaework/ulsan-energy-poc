import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeId, onChange, className }: TabsProps) {
  return (
    <div role="tablist" className={cn('flex border-b border-accent/20', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={tab.id === activeId}
          tabIndex={tab.id === activeId ? 0 : -1}
          onClick={() => onChange(tab.id)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium transition-colors relative',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            'after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:h-0.5 after:bg-primary after:rounded-full after:transition-all after:duration-200',
            tab.id === activeId
              ? 'text-primary after:w-full after:scale-x-100'
              : 'text-accent hover:text-white after:w-full after:scale-x-0',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
