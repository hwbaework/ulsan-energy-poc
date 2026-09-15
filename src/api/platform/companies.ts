import { getApiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { Company, PageResponse, ListQueryParams } from '@/types';

export interface CompanyContact {
  id: number;
  companyId: number;
  name: string;
  position?: string;
  phone?: string;
  email?: string;
  isPrimary: boolean;
}

export async function getCompanies(params?: ListQueryParams): Promise<PageResponse<Company>> {
  return getApiClient().get(ENDPOINTS.companies.list, params);
}

export async function getCompany(id: number): Promise<Company> {
  return getApiClient().get(ENDPOINTS.companies.detail(id));
}

export async function createCompany(data: object): Promise<Company> {
  return getApiClient().post(ENDPOINTS.companies.list, data);
}

export async function updateCompany(id: number, data: object): Promise<Company> {
  return getApiClient().put(ENDPOINTS.companies.detail(id), data);
}

export async function deleteCompany(id: number): Promise<void> {
  return getApiClient().delete(ENDPOINTS.companies.detail(id));
}

export async function activateCompany(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.companies.activate(id));
}

export async function suspendCompany(id: number): Promise<void> {
  return getApiClient().patch(ENDPOINTS.companies.suspend(id));
}

export async function getContacts(companyId: number): Promise<CompanyContact[]> {
  return getApiClient().get(ENDPOINTS.companies.contacts(companyId));
}

export async function createContact(companyId: number, data: object): Promise<CompanyContact> {
  return getApiClient().post(ENDPOINTS.companies.contacts(companyId), data);
}

export async function deleteContact(contactId: number): Promise<void> {
  return getApiClient().delete(ENDPOINTS.companies.deleteContact(contactId));
}

export async function importCompaniesExcel(formData: FormData): Promise<number> {
  return getApiClient().post(ENDPOINTS.companies.import, formData);
}
