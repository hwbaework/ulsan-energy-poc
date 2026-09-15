import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type {
  TradingRequest,
  TradingMatch,
  MarketPrice,
  RecTransaction,
  CreateTradingRequest,
  CreateTradingMatch,
  PageResponse,
} from '@/types';

export async function getTradingRequests(params?: object): Promise<PageResponse<TradingRequest>> {
  return getApiClient().get(ENDPOINTS.trading.requests, params);
}

export async function getTradingRequest(id: number): Promise<TradingRequest> {
  return getApiClient().get(ENDPOINTS.trading.requestDetail(id));
}

export async function createTradingRequest(data: CreateTradingRequest): Promise<TradingRequest> {
  return getApiClient().post(ENDPOINTS.trading.requests, data);
}

export async function updateTradingRequest(
  id: number,
  data: Partial<CreateTradingRequest>,
): Promise<TradingRequest> {
  return getApiClient().put(ENDPOINTS.trading.requestDetail(id), data);
}

export async function deleteTradingRequest(id: number): Promise<void> {
  return getApiClient().delete(ENDPOINTS.trading.requestDetail(id));
}

export async function updateRequestStatus(id: number, status: string): Promise<void> {
  return getApiClient().patch(`${ENDPOINTS.trading.updateRequestStatus(id)}?status=${status}`);
}

export async function getMatches(requestId: number): Promise<TradingMatch[]> {
  return getApiClient().get(ENDPOINTS.trading.matches(requestId));
}

export async function getAllMatches(params?: object): Promise<TradingMatch[]> {
  return getApiClient().get(ENDPOINTS.trading.allMatches, params);
}

export async function createMatch(data: CreateTradingMatch): Promise<TradingMatch> {
  return getApiClient().post(ENDPOINTS.trading.createMatch, data);
}

export async function generatorAcceptMatch(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.trading.generatorAcceptMatch(id));
}

export async function acceptMatch(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.trading.acceptMatch(id));
}

export async function counterMatch(id: number, proposedPriceKrw: number): Promise<void> {
  const qs = new URLSearchParams({ proposedPriceKrw: String(proposedPriceKrw) }).toString();
  return getApiClient().patch(`${ENDPOINTS.trading.counterMatch(id)}?${qs}`);
}

export interface TradingChatMessage {
  id: number;
  requestId: number;
  counterpartyCompanyId: number;
  senderId: number;
  senderName: string;
  content: string;
  messageType: string;
  createdAt: string;
}

export async function getTradingChat(
  requestId: number,
  counterpartyCompanyId: number,
): Promise<{ content: TradingChatMessage[] }> {
  return getApiClient().get(ENDPOINTS.trading.chat(requestId), {
    counterpartyCompanyId,
    size: 100,
  });
}

export async function sendTradingChat(
  requestId: number,
  data: { counterpartyCompanyId: number; content: string; messageType?: string },
): Promise<TradingChatMessage> {
  return getApiClient().post(ENDPOINTS.trading.chat(requestId), data);
}

export async function declineMatch(
  id: number,
  params?: { declinedBy?: string; declineReason?: string },
): Promise<void> {
  const qs = new URLSearchParams();
  if (params?.declinedBy) qs.set('declinedBy', params.declinedBy);
  if (params?.declineReason) qs.set('declineReason', params.declineReason);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return getApiClient().patch(`${ENDPOINTS.trading.declineMatch(id)}${suffix}`);
}

// ─── 직접 PPA 제안서 ───
export interface LeaseProposal {
  id: number;
  requestId: number;
  generatorCompanyId: number;
  generatorCompanyName?: string;
  installCapacityKw?: number;
  estSavingsPerMonth?: number;
  sharePct?: number;
  contractYears?: number;
  equipIds?: number[];
  status?: string;
  genAgreed?: boolean;
  consumerAgreed?: boolean;
  consumerCompanyName?: string;
  createdAt?: string;
}
export interface CreateLeaseProposal {
  generatorCompanyId: number;
  generatorCompanyName?: string;
  installCapacityKw?: number;
  estSavingsPerMonth?: number;
  sharePct?: number;
  contractYears?: number;
  equipIds?: number[];
}
export async function createLeaseProposal(
  requestId: number,
  data: CreateLeaseProposal,
): Promise<LeaseProposal> {
  return getApiClient().post(ENDPOINTS.trading.leaseProposal(requestId), data);
}
export async function getLeaseProposal(requestId: number): Promise<LeaseProposal | null> {
  return getApiClient().get(ENDPOINTS.trading.leaseProposal(requestId));
}
export async function agreeLeaseProposal(
  requestId: number,
  party: 'generator' | 'consumer',
): Promise<void> {
  return getApiClient().patch(`${ENDPOINTS.trading.agreeLeaseProposal(requestId)}?party=${party}`);
}
export async function getLeaseProposalsByGenerator(
  generatorCompanyId: number,
): Promise<LeaseProposal[]> {
  return getApiClient().get(ENDPOINTS.trading.leaseProposalsByGenerator, { generatorCompanyId });
}

export async function getMarketPrices(params: {
  from: string;
  to: string;
}): Promise<MarketPrice[]> {
  return getApiClient().get(ENDPOINTS.trading.marketPrices, params);
}

export async function getRecTransactions(params: {
  plantId: number;
  period: string;
}): Promise<RecTransaction[]> {
  return getApiClient().get(ENDPOINTS.trading.recTransactions, params);
}
