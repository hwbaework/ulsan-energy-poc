'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPersona, usePersonaOverride } from '@/lib/persona';
import { useAuthStore } from '@/stores/useAuthStore';

const TRADING_HOME: Record<string, string> = {
  consumer: '/ppa/trading',
  consultant: '/ppa/trading',
  generator: '/generator/trading',
  spc: '/platform/trading',
  admin: '/platform/trading',
};

export default function TradingRedirectPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const override = usePersonaOverride((s) => s.override);
  const persona = override ?? getPersona(user);

  useEffect(() => {
    router.replace(TRADING_HOME[persona] ?? '/ppa/trading');
  }, [persona, router]);

  return null;
}
