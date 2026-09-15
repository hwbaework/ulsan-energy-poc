export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
};

export const dataTradingKeys = {
  all: ['data-trading'] as const,
  dashboard: () => [...dataTradingKeys.all, 'dashboard'] as const,
  catalog: (filters?: object) => [...dataTradingKeys.all, 'catalog', filters] as const,
  dataset: (id: number) => [...dataTradingKeys.all, 'dataset', id] as const,
  myData: (filters?: object) => [...dataTradingKeys.all, 'my-data', filters] as const,
  trading: (filters?: object) => [...dataTradingKeys.all, 'trading', filters] as const,
  tradingHistory: (filters?: object) =>
    [...dataTradingKeys.all, 'trading-history', filters] as const,
  analytics: (filters?: object) => [...dataTradingKeys.all, 'analytics', filters] as const,
};

export const carbonKeys = {
  all: ['carbon'] as const,
  quotes: () => [...carbonKeys.all, 'quotes'] as const,
  holding: (companyId?: number) => [...carbonKeys.all, 'holding', companyId] as const,
  otc: (companyId?: number) => [...carbonKeys.all, 'otc', companyId] as const,
  offsets: (companyId?: number) => [...carbonKeys.all, 'offsets', companyId] as const,
  etrs: (companyId?: number) => [...carbonKeys.all, 'etrs', companyId] as const,
  matches: (companyId?: number) => [...carbonKeys.all, 'matches', companyId] as const,
  conversions: (companyId?: number) => [...carbonKeys.all, 'conversions', companyId] as const,
  // 탄소 델타테이블 활성화 (기획 14 §4·§7)
  bulletins: (unitType?: string, side?: string, status?: string) =>
    [...carbonKeys.all, 'bulletins', unitType, side, status] as const,
  bulletinThreads: (bulletinId?: number) =>
    [...carbonKeys.all, 'bulletin-threads', bulletinId] as const,
  vcmCredits: (companyId?: number) => [...carbonKeys.all, 'vcm-credits', companyId] as const,
  methodologies: (approvedOnly?: boolean) =>
    [...carbonKeys.all, 'methodologies', approvedOnly] as const,
  etsParams: (period?: string) => [...carbonKeys.all, 'ets-params', period] as const,
  kcuLedger: (companyId?: number) => [...carbonKeys.all, 'kcu-ledger', companyId] as const,
};

export const ghgKeys = {
  all: ['ghg'] as const,
  sources: (companyId?: number) => [...ghgKeys.all, 'sources', companyId] as const,
  activities: (companyId?: number, year?: number) =>
    [...ghgKeys.all, 'activities', companyId, year] as const,
  calculation: (companyId?: number, year?: number) =>
    [...ghgKeys.all, 'calculation', companyId, year] as const,
  statements: (companyId?: number) => [...ghgKeys.all, 'statements', companyId] as const,
  factors: () => [...ghgKeys.all, 'factors'] as const,
  scope3: (companyId?: number, year?: number) =>
    [...ghgKeys.all, 'scope3', companyId, year] as const,
  target: (companyId?: number) => [...ghgKeys.all, 'target', companyId] as const,
  cbam: (companyId?: number) => [...ghgKeys.all, 'cbam', companyId] as const,
  disclosure: (companyId?: number, year?: number, framework?: string) =>
    [...ghgKeys.all, 'disclosure', companyId, year, framework] as const,
  disclosureNarrative: (companyId?: number, year?: number, framework?: string) =>
    [...ghgKeys.all, 'disclosure-narrative', companyId, year, framework] as const,
  verifications: (statementId?: number) => [...ghgKeys.all, 'verifications', statementId] as const,
  reductionActuals: (companyId?: number) =>
    [...ghgKeys.all, 'reduction-actuals', companyId] as const,
};

export const dmKeys = {
  all: ['datamarket'] as const,
  consents: (companyId?: number) => [...dmKeys.all, 'consents', companyId] as const,
  settlement: (companyId?: number) => [...dmKeys.all, 'settlement', companyId] as const,
  datasets: (status?: string, providerCompanyId?: number) =>
    [...dmKeys.all, 'datasets', status, providerCompanyId] as const,
  apiKeys: (companyId?: number) => [...dmKeys.all, 'api-keys', companyId] as const,
  preview: (id?: number) => [...dmKeys.all, 'preview', id] as const,
  sample: (id?: number) => [...dmKeys.all, 'sample', id] as const,
};

export const analyticsKeys = {
  all: ['analytics'] as const,
  overview: (companyId?: number) => [...analyticsKeys.all, 'overview', companyId] as const,
  usage: (companyId?: number) => [...analyticsKeys.all, 'usage', companyId] as const,
  apiUsage: (companyId?: number) => [...analyticsKeys.all, 'api-usage', companyId] as const,
};
