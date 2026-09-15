'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePersonaOverride, PERSONA_HOME, getPersona } from '@/lib/persona';

export default function RoleRedirectPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const override = usePersonaOverride((s) => s.override);
  const persona = override ?? getPersona(user);

  useEffect(() => {
    router.replace(PERSONA_HOME[persona]);
  }, [persona, router]);

  return null;
}
