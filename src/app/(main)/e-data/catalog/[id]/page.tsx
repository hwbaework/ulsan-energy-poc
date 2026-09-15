import PageClient from './PageClient';
import { POC_STATIC_IDS } from '@/mocks/poc/staticIds';

/** POC 정적 export — 미리 생성할 경로 파라미터 (목업 ID + 픽스처 발전소 ID) */
export const dynamicParams = false;
export function generateStaticParams() {
  return POC_STATIC_IDS.map((id) => ({ id }));
}

export default function Page(props: { params: Promise<{ id: string }> }) {
  return <PageClient params={props.params} />;
}
