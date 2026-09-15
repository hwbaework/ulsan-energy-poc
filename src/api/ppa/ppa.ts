import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type {
  PpaContract,
  PpaSettlement,
  PpaInvoice,
  PpaContractChange,
  PpaUsageDeviation,
  PageResponse,
} from '@/types';

export async function getPpaContracts(params?: object): Promise<PageResponse<PpaContract>> {
  return getApiClient().get(ENDPOINTS.ppa.contracts, params);
}

export async function getPpaContract(id: number): Promise<PpaContract> {
  return getApiClient().get(ENDPOINTS.ppa.contractDetail(id));
}

export async function createPpaContract(data: object): Promise<PpaContract> {
  return getApiClient().post(ENDPOINTS.ppa.contracts, data);
}

export async function activatePpaContract(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.ppa.activateContract(id));
}

export async function terminatePpaContract(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.ppa.terminateContract(id));
}

export async function getContractChanges(contractId: number): Promise<PpaContractChange[]> {
  return getApiClient().get(ENDPOINTS.ppa.contractChanges(contractId));
}

export async function searchContractChanges(params?: {
  status?: string;
}): Promise<PpaContractChange[]> {
  return getApiClient().get(ENDPOINTS.ppa.changesSearch, params ?? {});
}

export interface ContractDocument {
  id: number;
  contractId: number;
  fileId: number;
  documentType: string;
  fileName?: string;
  contentType?: string;
  createdAt: string;
}

export async function getContractDocuments(contractId: number): Promise<ContractDocument[]> {
  return getApiClient().get(ENDPOINTS.ppa.contractDocuments(contractId));
}

export async function addContractDocument(
  contractId: number,
  fileId: number,
  documentType = 'PPA_CONTRACT',
): Promise<ContractDocument> {
  const params = new URLSearchParams({ fileId: String(fileId), documentType });
  return getApiClient().post(`${ENDPOINTS.ppa.contractDocuments(contractId)}?${params.toString()}`);
}

export interface ContractChangeInput {
  changeType: string;
  description?: string;
  changeItem?: string;
  newUnitPriceKrw?: number;
  newCapacityKw?: number;
  newEndDate?: string; // yyyy-MM-dd
}

export async function requestContractChange(
  contractId: number,
  input: ContractChangeInput,
): Promise<PpaContractChange> {
  const params = new URLSearchParams({ changeType: input.changeType });
  if (input.description) params.set('description', input.description);
  if (input.changeItem) params.set('changeItem', input.changeItem);
  if (input.newUnitPriceKrw != null) params.set('newUnitPriceKrw', String(input.newUnitPriceKrw));
  if (input.newCapacityKw != null) params.set('newCapacityKw', String(input.newCapacityKw));
  if (input.newEndDate) params.set('newEndDate', input.newEndDate);
  return getApiClient().post(`${ENDPOINTS.ppa.contractChanges(contractId)}?${params.toString()}`);
}

export async function getContractChange(changeId: number): Promise<PpaContractChange> {
  return getApiClient().get(ENDPOINTS.ppa.changeDetail(changeId));
}

export async function approveContractChange(changeId: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.ppa.approveChange(changeId));
}

export async function rejectContractChange(changeId: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.ppa.rejectChange(changeId));
}

export async function cancelContractChange(changeId: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.ppa.cancelChange(changeId));
}

export async function requestGeneratorApproval(changeId: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.ppa.requestGeneratorApproval(changeId));
}

export async function generatorApproveChange(changeId: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.ppa.generatorApproveChange(changeId));
}

export async function generatorRejectChange(changeId: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.ppa.generatorRejectChange(changeId));
}

export async function getContractDeviations(contractId: number): Promise<PpaUsageDeviation[]> {
  return getApiClient().get(ENDPOINTS.ppa.contractDeviations(contractId));
}

export async function getPpaSettlements(params?: object): Promise<PageResponse<PpaSettlement>> {
  return getApiClient().get(ENDPOINTS.ppa.settlements, params);
}

export async function getPpaSettlement(id: number): Promise<PpaSettlement> {
  return getApiClient().get(ENDPOINTS.ppa.settlementDetail(id));
}

export async function confirmSettlement(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.ppa.confirmSettlement(id));
}

export async function disputeSettlement(id: number, reason?: string): Promise<void> {
  const url = reason
    ? `${ENDPOINTS.ppa.disputeSettlement(id)}?reason=${encodeURIComponent(reason)}`
    : ENDPOINTS.ppa.disputeSettlement(id);
  return getApiClient().patch(url);
}

export async function startReviewSettlement(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.ppa.startReviewSettlement(id));
}

export async function adjustSettlement(
  id: number,
  adjustedAmount: number,
  note?: string,
): Promise<void> {
  const params = new URLSearchParams({ adjustedAmount: String(adjustedAmount) });
  if (note) params.set('note', note);
  return getApiClient().patch(`${ENDPOINTS.ppa.adjustSettlement(id)}?${params.toString()}`);
}

export async function reconfirmSettlement(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.ppa.reconfirmSettlement(id));
}

export async function getSettlementInvoices(settlementId: number): Promise<PpaInvoice[]> {
  return getApiClient().get(ENDPOINTS.ppa.invoices(settlementId));
}

export async function issuePpaInvoice(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.ppa.issueInvoice(id));
}

export async function payPpaInvoice(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.ppa.payInvoice(id));
}
