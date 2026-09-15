import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { EtmAvailablePlant, EtmContract, EtmSettlement, EtmInvoice } from '@/types/etm';
import type { MarketPrice, RecTransaction, PageResponse } from '@/types';

export async function getAvailablePlants(): Promise<EtmAvailablePlant[]> {
  return getApiClient().get(ENDPOINTS.etm.availablePlants);
}

export async function getContracts(params?: object): Promise<PageResponse<EtmContract>> {
  return getApiClient().get(ENDPOINTS.etm.contracts, params);
}

export async function getContract(id: number): Promise<EtmContract> {
  return getApiClient().get(ENDPOINTS.etm.contractDetail(id));
}

export async function getMarketPrice(): Promise<MarketPrice[]> {
  return getApiClient().get(ENDPOINTS.etm.marketPrice);
}

export async function getSettlements(params?: object): Promise<PageResponse<EtmSettlement>> {
  return getApiClient().get(ENDPOINTS.etm.settlements, params);
}

export async function getInvoices(params?: object): Promise<PageResponse<EtmInvoice>> {
  return getApiClient().get(ENDPOINTS.etm.invoices, params);
}

export async function getInvoice(id: number): Promise<EtmInvoice> {
  return getApiClient().get(ENDPOINTS.etm.invoiceDetail(id));
}

export async function getRecSummary(): Promise<RecTransaction[]> {
  return getApiClient().get(ENDPOINTS.etm.rec);
}

export async function getRecTransactions(): Promise<RecTransaction[]> {
  return getApiClient().get(ENDPOINTS.etm.recTransactions);
}

export async function getTransactions(params?: object): Promise<PageResponse<EtmContract>> {
  return getApiClient().get(ENDPOINTS.etm.transactions, params);
}
