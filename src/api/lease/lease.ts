import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type {
  VolumeLeaseContract,
  SavingsShareContract,
  LeaseMonthlyRecord,
  LeaseInvoice,
  LeaseRequest,
  LeaseEquipment,
  EquipmentRecovery,
  SavingsCalculation,
  PageResponse,
} from '@/types';

// --- 볼륨 리스 ---

export async function getVolumeContracts(
  params?: object,
): Promise<PageResponse<VolumeLeaseContract>> {
  return getApiClient().get(ENDPOINTS.lease.volume, params);
}

export async function getVolumeContract(id: number): Promise<VolumeLeaseContract> {
  return getApiClient().get(ENDPOINTS.lease.volumeDetail(id));
}

export async function terminateVolumeContract(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.lease.terminateVolume(id));
}

export async function requestTerminationVolume(id: number, reason?: string): Promise<void> {
  const url = reason
    ? `${ENDPOINTS.lease.requestTerminationVolume(id)}?reason=${encodeURIComponent(reason)}`
    : ENDPOINTS.lease.requestTerminationVolume(id);
  return getApiClient().patch(url);
}

// --- 절감 공유 ---

export async function getSavingsContracts(
  params?: object,
): Promise<PageResponse<SavingsShareContract>> {
  return getApiClient().get(ENDPOINTS.lease.savings, params);
}

export async function getSavingsContract(id: number): Promise<SavingsShareContract> {
  return getApiClient().get(ENDPOINTS.lease.savingsDetail(id));
}

export async function terminateSavingsContract(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.lease.terminateSavings(id));
}

export async function requestTerminationSavings(id: number, reason?: string): Promise<void> {
  const url = reason
    ? `${ENDPOINTS.lease.requestTerminationSavings(id)}?reason=${encodeURIComponent(reason)}`
    : ENDPOINTS.lease.requestTerminationSavings(id);
  return getApiClient().patch(url);
}

// --- 월별 실적 / 세금계산서 ---

export async function getMonthlyRecords(params: {
  leaseType: string;
  contractId: number;
}): Promise<LeaseMonthlyRecord[]> {
  return getApiClient().get(ENDPOINTS.lease.monthlyRecords, params);
}

export async function getAllMonthlyRecords(params?: {
  year?: number;
}): Promise<LeaseMonthlyRecord[]> {
  return getApiClient().get(ENDPOINTS.lease.allMonthlyRecords, params);
}

export async function getLeaseInvoices(params: {
  leaseType: string;
  contractId: number;
}): Promise<LeaseInvoice[]> {
  return getApiClient().get(ENDPOINTS.lease.invoices, params);
}

export async function getAllLeaseInvoices(params?: { year?: number }): Promise<LeaseInvoice[]> {
  return getApiClient().get(ENDPOINTS.lease.allInvoices, params);
}

export async function issueLeaseInvoice(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.lease.issueInvoice(id));
}

export async function payLeaseInvoice(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.lease.payInvoice(id));
}

export async function disputeLeaseInvoice(id: number, reason?: string): Promise<void> {
  const url = reason
    ? `${ENDPOINTS.lease.disputeInvoice(id)}?reason=${encodeURIComponent(reason)}`
    : ENDPOINTS.lease.disputeInvoice(id);
  return getApiClient().patch(url);
}

// --- 절감액 산출 ---

export async function calculateSavings(params: {
  usageKwh: number;
  sharePct: number;
  voltageLevel?: string;
}): Promise<SavingsCalculation> {
  return getApiClient().get(ENDPOINTS.lease.calculateSavings, params);
}

// --- 수용가 온사이트 PPA 신청 ---

export async function createLeaseRequest(params: {
  consumerCompanyId: number;
  leaseType: string;
  siteName: string;
  desiredCapacityKw: number;
  desiredYears?: number;
  notes?: string;
}): Promise<LeaseRequest> {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return getApiClient().post(`${ENDPOINTS.lease.requests}?${qs}`);
}

export async function getLeaseRequests(status?: string): Promise<LeaseRequest[]> {
  return getApiClient().get(ENDPOINTS.lease.requests, { status: status ?? 'SUBMITTED' });
}

export async function acceptLeaseRequest(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.lease.acceptRequest(id));
}

// --- 발전사 설비 등록 ---

export async function registerEquipment(params: {
  generatorCompanyId: number;
  equipmentName: string;
  equipmentType: string;
  capacityKw: number;
  location?: string;
  notes?: string;
}): Promise<LeaseEquipment> {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return getApiClient().post(`${ENDPOINTS.lease.equipments}?${qs}`);
}

export async function getAvailableEquipments(): Promise<LeaseEquipment[]> {
  return getApiClient().get(ENDPOINTS.lease.equipments);
}

export async function getMyEquipments(generatorCompanyId: number): Promise<LeaseEquipment[]> {
  return getApiClient().get(ENDPOINTS.lease.myEquipments, { generatorCompanyId });
}

// --- 설비 회수 ---

export async function getRecoveries(status?: string): Promise<EquipmentRecovery[]> {
  return getApiClient().get(ENDPOINTS.lease.recoveries, status ? { status } : undefined);
}

export async function scheduleRecovery(id: number, scheduledDate: string): Promise<void> {
  return getApiClient().patch(
    `${ENDPOINTS.lease.scheduleRecovery(id)}?scheduledDate=${scheduledDate}`,
  );
}

export async function completeRecovery(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.lease.completeRecovery(id));
}

export async function getLeaseActivities(params?: object): Promise<any> {
  return getApiClient().get(ENDPOINTS.lease.activities, params);
}
