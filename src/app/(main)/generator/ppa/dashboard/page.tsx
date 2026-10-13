'use client';

// 계약 현황은 관리자만(2026-10-13) — 발전사업자는 내 계약으로
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/generator/ppa/contracts');
  }, [router]);
  return null;
}
