'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { getPersona } from '@/lib/persona';
import {
  CO,
  isPartyOf,
  useHydrateTradingPoc,
  useTradingPocStore,
} from '@/stores/useTradingPocStore';
import type { Contract, ContractChange, TradeDocument, TradeRequest } from '@/types/trading-poc';

/**
 * 전력거래 화면의 역할·범위. 관리자(SPC)는 전체, 발전사업자는 자기 회사가 당사자인 것만.
 * (전기사용자는 RE100 에서 컨설팅만 쓰므로 전력거래 화면에 오지 않는다 — 와도 자기 회사 범위로 본다)
 */
export function useTradingRole() {
  useHydrateTradingPoc();
  const user = useAuthStore((s) => s.user);
  const persona = getPersona(user);
  const isAdmin = persona === 'admin' || persona === 'spc';
  // 발전사업자 데모 계정(박발전, companyId 3)은 한일튜브 — '울산 발전(주)'는 실제로 없는 회사
  const demo = user?.companyId === CO.GENERATOR_LOGIN.id ? CO.HANIL : undefined;
  const companyId = isAdmin ? CO.SPC.id : (demo?.id ?? user?.companyId ?? 0);
  const companyName = isAdmin ? CO.SPC.name : (demo?.name ?? user?.companyName ?? '');
  const party = isAdmin
    ? ('spc' as const)
    : persona === 'consumer'
      ? ('consumer' as const)
      : ('generator' as const);

  const requestsAll = useTradingPocStore((s) => s.requests);
  const contractsAll = useTradingPocStore((s) => s.contracts);
  const changesAll = useTradingPocStore((s) => s.changes);
  const documentsAll = useTradingPocStore((s) => s.documents);

  const requests = useMemo<TradeRequest[]>(
    () =>
      isAdmin
        ? requestsAll
        : requestsAll.filter((r) => isPartyOf(companyId, r) || r.applicantCompanyId === companyId),
    [isAdmin, requestsAll, companyId],
  );
  const contracts = useMemo<Contract[]>(
    () => (isAdmin ? contractsAll : contractsAll.filter((c) => isPartyOf(companyId, c))),
    [isAdmin, contractsAll, companyId],
  );
  const changes = useMemo<ContractChange[]>(() => {
    const ids = new Set(contracts.map((c) => c.id));
    return isAdmin ? changesAll : changesAll.filter((ch) => ids.has(ch.contractId));
  }, [isAdmin, changesAll, contracts]);
  const documents = useMemo<TradeDocument[]>(
    () =>
      isAdmin ? documentsAll : documentsAll.filter((d) => d.partyCompanyIds.includes(companyId)),
    [isAdmin, documentsAll, companyId],
  );

  return {
    user,
    persona,
    isAdmin,
    party,
    companyId,
    companyName,
    requests,
    contracts,
    changes,
    documents,
  };
}
