'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { QuizRunner } from '../QuizRunner';

// 쪽지시험 단독 페이지 — 정적 export 라 ?month= 로 받는다 (교육 자료 화면 안에서도 같은 QuizRunner 를 쓴다)
function Inner() {
  const month = useSearchParams().get('month') ?? '';
  return <QuizRunner month={month} />;
}

export default function EducationQuizPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
