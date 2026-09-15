import { useState, type FormEvent } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'select';
  placeholder?: string;
  options?: { value: string; label: string }[];
}

interface FilterBarProps {
  fields: FilterField[];
  onSearch: (values: Record<string, string>) => void;
  onReset?: () => void;
  className?: string;
}

export function FilterBar({ fields, onSearch, onReset, className }: FilterBarProps) {
  const initial = Object.fromEntries(fields.map((f) => [f.key, '']));
  const [values, setValues] = useState<Record<string, string>>(initial);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSearch(values);
  }

  function handleReset() {
    setValues(initial);
    onReset?.();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('flex flex-wrap items-end gap-3 rounded-lg border border-accent/20 bg-surface-card p-4', className)}
    >
      {fields.map((field) => (
        <div key={field.key} className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-medium text-accent">{field.label}</label>
          {field.type === 'select' ? (
            <Select
              options={field.options ?? []}
              placeholder={field.placeholder ?? '전체'}
              value={values[field.key]}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            />
          ) : (
            <Input
              placeholder={field.placeholder}
              value={values[field.key]}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            />
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="submit" size="md">
          <Search size={16} />
          검색
        </Button>
        <Button type="button" variant="cancel" size="md" onClick={handleReset}>
          <RotateCcw size={16} />
          초기화
        </Button>
      </div>
    </form>
  );
}
