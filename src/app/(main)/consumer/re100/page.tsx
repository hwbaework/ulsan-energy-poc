// consumer/re100 → /re100 리다이렉트 (06 §13.7 이식·리다이렉트 · 19-09 §2).
// 신설 /re100이 roadmap·sourceMix·monthlyProgress 실데이터 + 갭 처방·최근정산·desk 위젯을 갖추므로
// 구 consumer/re100(예시홈 대비 실데이터 역전 문제)은 /re100으로 대체·리다이렉트한다.
// 자산 폐기 금지 — 실훅 로직은 /re100·useRe100(trading)에 이식됨. 파일은 삭제하지 않고 redirect로 대체.

import { redirect } from 'next/navigation';

export default function ConsumerRe100RedirectPage() {
  redirect('/re100');
}
