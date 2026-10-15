'use client';

// 토스페이먼츠 카드 등록 실패 · 취소 — ?code=...&message=... 로 돌아온다. 토스 문구 대신 짧은 이유만
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { SectionCard } from '@/components/features';

/** 토스 오류 코드 → 짧은 이유 */
const REASON: Record<string, string> = {
  INVALID_CARD_NUMBER: '없는 카드 번호입니다',
  INVALID_CARD_EXPIRATION: '유효기간이 맞지 않습니다',
  INVALID_CARD_IDENTITY: '주민번호(사업자번호)가 카드와 맞지 않습니다',
  INVALID_CARD_PASSWORD: '카드 비밀번호가 맞지 않습니다',
  NOT_SUPPORTED_CARD_TYPE: '등록할 수 없는 카드입니다',
  INVALID_STOPPED_CARD: '정지된 카드입니다',
  EXCEED_MAX_AUTH_COUNT: '인증 횟수를 넘었습니다. 잠시 뒤 다시 해 주세요',
  PAY_PROCESS_CANCELED: '카드 등록을 취소했습니다',
  USER_CANCEL: '카드 등록을 취소했습니다',
  PAY_PROCESS_ABORTED: '카드 등록이 중단됐습니다',
};

export default function Page() {
  const router = useRouter();
  const [reason, setReason] = useState('');
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const code = q.get('code') ?? '';
    // 모르는 코드면 토스 문구에서 영어 괄호만 뺀다
    setReason(REASON[code] ?? (q.get('message') ?? '카드 등록을 하지 못했습니다').replace(/\s*\([^)]*\)\s*$/, ''));
  }, []);
  return (
    <div className="mx-auto max-w-md py-16">
      <SectionCard title="카드 등록 실패">
        <p className="text-base text-white">{reason}</p>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => router.replace('/org')}>기업 정보로</Button>
        </div>
      </SectionCard>
    </div>
  );
}
