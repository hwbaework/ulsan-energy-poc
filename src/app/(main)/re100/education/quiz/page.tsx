'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { QuizRunner } from '../QuizRunner';

// 쪽지시험 단독 페이지 — 정적 export 라 ?round= 로 받는다(차수 키 · 기본 정보는 basic) (교육 자료 화면 안에서도 같은 QuizRunner 를 쓴다)
function Inner() {
  const round = useSearchParams().get('round') ?? '';
  return <QuizRunner round={round} />;
}

export default function EducationQuizPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
