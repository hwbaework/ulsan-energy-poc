'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { LIMIT } from '@/lib/field-limits';

/**
 * 기업 주소 — [주소 검색]으로 도로명 주소를 고르고, 상세 주소(동 · 호 등)는 직접 쓴다(2026-11-24 사용자).
 * 검색은 카카오(다음) 우편번호 서비스 — 키 없이 쓰는 공개 주소 검색 창(https://postcode.map.daum.net/guide). 누르면 스크립트를 한 번 받아 창을 연다.
 * 값은 지금처럼 글자 하나('도로명 주소 상세 주소') — 저장 칸을 나누지 않는다. 이미 저장된 주소는 통째로 기본 주소에 들어간다.
 */
declare global {
  interface Window {
    daum?: { Postcode: new (opts: { oncomplete: (data: { roadAddress: string; jibunAddress: string; buildingName?: string }) => void }) => { open: () => void } };
  }
}

const SCRIPT = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
let loading: Promise<void> | null = null;
function loadPostcode(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.daum?.Postcode) return Promise.resolve();
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const el = document.createElement('script');
      el.src = SCRIPT;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => {
        loading = null;
        reject(new Error('load failed'));
      };
      document.head.appendChild(el);
    });
  }
  return loading;
}

const FIELD =
  'h-10 w-full rounded border bg-surface-dark px-3 text-sm text-white placeholder:text-accent/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

export function AddressInput({
  label = '기업 주소',
  required,
  value,
  onChange,
  error,
  onSearchFail,
}: {
  label?: string;
  required?: boolean;
  /** '도로명 주소 상세 주소' 한 글자 */
  value: string;
  onChange: (next: string) => void;
  error?: string;
  /** 주소 검색 창을 못 열었을 때(인터넷 끊김 등) — 화면이 알림을 띄운다 */
  onSearchFail?: () => void;
}) {
  // 기본 주소(검색으로만 채움) · 상세 주소(직접 입력). 처음 값은 통째로 기본 주소
  const [base, setBase] = useState(value);
  const [detail, setDetail] = useState('');
  // 바깥에서 값이 바뀌면(취소 · 다른 기업 열기) 다시 맞춘다
  const joined = [base, detail.trim()].filter(Boolean).join(' ');
  if (value !== joined && value !== base) {
    setBase(value);
    setDetail('');
  }
  const emit = (b: string, d: string) => onChange([b, d.trim()].filter(Boolean).join(' '));

  const search = async () => {
    try {
      await loadPostcode();
      new window.daum!.Postcode({
        oncomplete: (data) => {
          const road = data.roadAddress || data.jibunAddress;
          const b = data.buildingName ? `${road} (${data.buildingName})` : road;
          setBase(b);
          setDetail('');
          emit(b, '');
        },
      }).open();
    } catch {
      onSearchFail?.();
    }
  };

  const detailMax = Math.max(0, LIMIT.address - base.length - 1);
  return (
    <div className="space-y-1.5">
      {label && (
        <span className="block text-sm font-medium text-accent">
          {label}
          {required && <span className="ml-0.5 text-semantic-red">*</span>}
        </span>
      )}
      <div className="flex items-center gap-2">
        {/* 기본 주소는 직접 못 쓴다 — 칸을 눌러도 검색 창이 열린다 */}
        <input
          readOnly
          aria-label={label || '기업 주소'}
          aria-invalid={!!error || undefined}
          value={base}
          placeholder="주소 검색"
          onClick={search}
          className={cn(FIELD, 'min-w-0 flex-1 cursor-pointer', error ? 'border-semantic-red bg-semantic-red/10' : 'border-accent/30 hover:border-accent/50')}
        />
        {/* 검색 버튼 — 입력 칸과 같은 높이(h-10) · 같은 모서리, 눌러도 위아래로 움직이지 않게. 글자는 짧게 '검색'(2026-11-24 사용자: 높이를 칸에 맞게, 검색은 있어야) */}
        <Button
          type="button"
          variant="secondary"
          className="h-10 shrink-0 gap-1 whitespace-nowrap rounded px-3 text-sm hover:translate-y-0 active:translate-y-0 active:scale-100"
          onClick={search}
        >
          <Search size={14} /> 검색
        </Button>
      </div>
      <input
        aria-label="상세 주소"
        value={detail}
        maxLength={detailMax}
        disabled={!base}
        placeholder="상세 주소"
        onChange={(e) => {
          setDetail(e.target.value);
          emit(base, e.target.value);
        }}
        className={cn(FIELD, 'border-accent/30 hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-50')}
      />
      {error && <p className="text-xs text-semantic-red">{error}</p>}
    </div>
  );
}
