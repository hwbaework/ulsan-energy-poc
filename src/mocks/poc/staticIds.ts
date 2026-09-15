/**
 * 정적 export 시 미리 생성할 동적 라우트 ID 목록.
 * 목업 ID(1~20) + 픽스처 발전소 ID(LASEE) — 상세 페이지 링크가 404 가 되지 않도록 한다.
 */
import { LASEE_PLANTS } from '@/constants/plant-mapping';

export const POC_STATIC_IDS: string[] = [
  ...Array.from({ length: 20 }, (_, i) => String(i + 1)),
  ...LASEE_PLANTS.map((p) => String(p.laseeId)),
];
