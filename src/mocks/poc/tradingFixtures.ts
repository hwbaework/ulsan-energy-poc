/**
 * 전력거래 목업 라우트 — 세금계산서·청구서 화면(기존)이 읽는 /ppa/settlements 와 LNB 가 읽는 /ppa/contracts 를
 * 전력거래 스토어(useTradingPocStore)의 계약에서 만든다. 화면에서 계약이 바뀌면(승인·해지) 정산도 따라간다.
 */
import { registerMock, pageOf } from './registry';
import { settlementsOf, useTradingPocStore } from '@/stores/useTradingPocStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { getPersona } from '@/lib/persona';
import type { PpaContract } from '@/types/ppa';
import type { Contract } from '@/types/trading-poc';

/** 로그인 회사 범위 — 관리자(SPC)는 전체, 발전사업자·전기사용자는 자기 회사가 당사자인 계약만 (화면 훅 useTradingRole 과 같은 규칙) */
function scopedContracts(): Contract[] {
  const user = useAuthStore.getState().user;
  const persona = getPersona(user);
  const all = useTradingPocStore.getState().contracts;
  if (persona === 'admin' || persona === 'spc') return all;
  const id = user?.companyId ?? 0;
  return all.filter((c) => c.generatorCompanyId === id || c.consumerCompanyId === id);
}

/* /ppa/settlements?year=2026&size=100 — 월 정산 (status CONFIRMED · PENDING) */
registerMock(/^\/ppa\/settlements$/, ({ query }) => {
  const year = query.get('year');
  const list = settlementsOf(scopedContracts()).filter((s) => !year || s.period.startsWith(year));
  return pageOf(list, Number(query.get('size') ?? 200));
});
registerMock(/^\/ppa\/settlements\/(\d+)$/, ({ match }) => settlementsOf(scopedContracts()).find((s) => s.id === Number(match[1])) ?? null);

/* /ppa/contracts — 기존 PpaContract 모양 (contractType PPA · ppaSubType onsite|self) */
registerMock(/^\/ppa\/contracts$/, () => {
  const list: PpaContract[] = scopedContracts().map((c) => ({
    id: c.id,
    contractNumber: c.no,
    contractType: 'PPA',
    ppaSubType: c.kind === 'ONSITE' ? 'onsite' : 'self',
    status: c.status === 'PENDING_SIGN' ? 'NEW' : c.status,
    generatorCompanyId: c.generatorCompanyId,
    generatorCompanyName: c.generatorCompanyName,
    consumerCompanyId: c.consumerCompanyId,
    consumerCompanyName: c.consumerCompanyName,
    consumerSiteName: c.siteName,
    totalCapacityKw: c.capacityKw,
    unitPriceKrw: c.unitPrice,
    startDate: c.startDate,
    endDate: c.endDate,
    createdAt: c.createdAt,
  }));
  return pageOf(list, 200);
});
