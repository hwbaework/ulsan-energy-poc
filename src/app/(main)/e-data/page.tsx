import { redirect } from 'next/navigation';

// E-데이터마켓 루트 — 사이드바 첫 진입은 데이터 카탈로그 (기획 docs/기획/08 §0)
export default function EDataIndex() {
  redirect('/e-data/catalog');
}
