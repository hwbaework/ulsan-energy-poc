'use client';

// 토스페이먼츠 카드 등록 성공 — ?authKey=...&customerKey=... 로 돌아온다. 서버(목업)가 빌링키를 받아 저장하고 기업 정보로 돌아간다
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { issueBillingKey } from '@/lib/toss-billing';
import { useAuthStore } from '@/stores/useAuthStore';
import { localNow, useBillingStore, useHydrateBilling } from '@/stores/useBillingStore';
import { useToastStore } from '@/stores/useToastStore';

export default function Page() {
  useHydrateBilling();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const addCard = useBillingStore((s) => s.addCard);
  const addToast = useToastStore((s) => s.add);
  const [msg, setMsg] = useState('카드 등록 중');
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !user) return;
    done.current = true;
    const q = new URLSearchParams(window.location.search);
    const authKey = q.get('authKey');
    const customerKey = q.get('customerKey');
    if (!authKey || !customerKey) {
      setMsg('카드 등록 정보가 없습니다');
      return;
    }
    void issueBillingKey(authKey, customerKey)
      .then((r) => {
        addCard({
          companyId: user.companyId ?? 0,
          customerKey,
          billingKey: r.billingKey,
          cardCompany: r.cardCompany ?? '카드',
          last4: (r.card?.number ?? '').slice(-4), // 토스는 '43301234****123*' 처럼 가려서 준다 — 끝 4칸 그대로
          maskedNumber: r.card?.number,
          cardType: r.card?.cardType,
          ownerType: r.card?.ownerType,
          registeredAt: localNow(),
          registeredBy: user.name ?? '',
        });
        addToast('success', '카드 등록');
        router.replace('/org');
      })
      .catch((e: unknown) => setMsg(`카드 등록에 실패했습니다 — ${e instanceof Error ? e.message : ''}`));
  }, [user, addCard, addToast, router]);

  return <p className="py-20 text-center text-sm text-slate-400">{msg}</p>;
}
