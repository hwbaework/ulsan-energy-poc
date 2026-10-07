import { redirect } from 'next/navigation';

// 데이터 등록은 판매 동의로 바뀌었다(동의 = 등록)
export default function Page() {
  redirect('/e-data/catalog/consent');
}
