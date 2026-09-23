import ReportsClient from '../ReportsClient';
import { LASEE_PLANTS } from '@/constants/plant-mapping';

/** POC 정적 export — 발전소 ID 별 보고서 경로 미리 생성 */
export const dynamicParams = false;
export function generateStaticParams() {
  return LASEE_PLANTS.map((p) => ({ plantId: String(p.laseeId) }));
}

export default function Page() {
  return <ReportsClient />;
}
