'use client';

import { useEffect } from 'react';

/** 날짜 · 시각 칸 — 달력 · 시계 아이콘뿐 아니라 칸 아무 곳이나 눌러도 목록이 뜬다(2026-11-06 사용자). 앱 전체 한 곳에서 */
const PICKER_TYPES = new Set(['date', 'time', 'month', 'week', 'datetime-local']);

export function PickerOnClick() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = e.target;
      if (!(el instanceof HTMLInputElement) || !PICKER_TYPES.has(el.type) || el.disabled || el.readOnly) return;
      try {
        el.showPicker?.();
      } catch {
        /* 이미 열려 있거나 브라우저가 막으면 그대로 */
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
