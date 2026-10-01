/**
 * 전력거래 목업 라우트 — 세금계산서·청구서 화면(기존)이 읽는 /ppa/settlements 와 LNB 가 읽는 /ppa/contracts 를
 * 전력거래 스토어(useTradingPocStore)의 계약에서 만든다. 화면에서 계약이 바뀌면(승인·해지) 정산도 따라간다.
 */
import { registerMock, pageOf } from './registry';
import { settlementsOf, useTradingPocStore } from '@/stores/useTradingPocStore';
import type { PpaContract } from '@/types/ppa';

/* /ppa/settlements?year=2026&size=100 — 월 정산 (status CONFIRMED · PENDING) */
registerMock(/^\/ppa\/settlements$/, ({ query }) => {
  const year = query.get('year');
  const list = settlementsOf(useTradingPocStore.getState().contracts).filter((s) => !year || s.period.startsWith(year));
  return pageOf(list, Number(query.get('size') ?? 200));
});
registerMock(/^\/ppa\/settlements\/(\d+)$/, ({ match }) => settlementsOf(useTradingPocStore.getState().contracts).find((s) => s.id === Number(match[1])) ?? null);

/* /ppa/contracts — 기존 PpaContract 모양 (contractType PPA · ppaSubType onsite|self) */
registerMock(/^\/ppa\/contracts$/, () => {
  const list: PpaContract[] = useTradingPocStore.getState().contracts.map((c) => ({
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
