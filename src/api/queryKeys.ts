export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
};

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters?: object) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: number) => [...userKeys.details(), id] as const,
  stats: () => [...userKeys.all, 'stats'] as const,
};

export const companyKeys = {
  all: ['companies'] as const,
  lists: () => [...companyKeys.all, 'list'] as const,
  list: (filters?: object) => [...companyKeys.lists(), filters] as const,
  details: () => [...companyKeys.all, 'detail'] as const,
  detail: (id: number) => [...companyKeys.details(), id] as const,
  contacts: (companyId: number) => [...companyKeys.detail(companyId), 'contacts'] as const,
};

export const powerStationKeys = {
  all: ['power-stations'] as const,
  lists: () => [...powerStationKeys.all, 'list'] as const,
  list: (filters?: object) => [...powerStationKeys.lists(), filters] as const,
  details: () => [...powerStationKeys.all, 'detail'] as const,
  detail: (id: number) => [...powerStationKeys.details(), id] as const,
  equipment: (id: number) => [...powerStationKeys.detail(id), 'equipment'] as const,
  documents: (id: number) => [...powerStationKeys.detail(id), 'documents'] as const,
  byCompany: (companyId: number) => [...powerStationKeys.all, 'by-company', companyId] as const,
};

export const equipmentKeys = {
  all: ['equipment'] as const,
  lists: () => [...equipmentKeys.all, 'list'] as const,
  list: (filters?: object) => [...equipmentKeys.lists(), filters] as const,
  details: () => [...equipmentKeys.all, 'detail'] as const,
  detail: (id: number) => [...equipmentKeys.details(), id] as const,
  readings: (id: number) => [...equipmentKeys.detail(id), 'readings'] as const,
  maintenances: (id: number) => [...equipmentKeys.detail(id), 'maintenances'] as const,
  metrics: () => [...equipmentKeys.all, 'metrics'] as const,
};

export const readingKeys = {
  all: ['readings'] as const,
  lists: () => [...readingKeys.all, 'list'] as const,
  list: (filters?: object) => [...readingKeys.lists(), filters] as const,
  byEquipment: (equipmentId: number, filters?: object) =>
    [...readingKeys.all, 'equipment', equipmentId, filters] as const,
  daily: (powerStationId: number, filters?: object) =>
    [...readingKeys.all, 'daily', powerStationId, filters] as const,
};

export const anomalyKeys = {
  all: ['anomalies'] as const,
  lists: () => [...anomalyKeys.all, 'list'] as const,
  list: (filters?: object) => [...anomalyKeys.lists(), filters] as const,
  details: () => [...anomalyKeys.all, 'detail'] as const,
  detail: (id: number) => [...anomalyKeys.details(), id] as const,
  detections: (filters?: object) => [...anomalyKeys.all, 'detections', filters] as const,
  detectionsUnresolved: (filters?: object) =>
    [...anomalyKeys.all, 'detections-unresolved', filters] as const,
};

export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (filters?: object) => [...notificationKeys.lists(), filters] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

export const consultationKeys = {
  all: ['consultations'] as const,
  lists: () => [...consultationKeys.all, 'list'] as const,
  list: (filters?: object) => [...consultationKeys.lists(), filters] as const,
  details: () => [...consultationKeys.all, 'detail'] as const,
  detail: (id: number) => [...consultationKeys.details(), id] as const,
  byCompany: (companyId: number) => [...consultationKeys.all, 'company', companyId] as const,
  byConsultant: (consultantId: number) =>
    [...consultationKeys.all, 'consultant', consultantId] as const,
  milestones: (id: number) => [...consultationKeys.detail(id), 'milestones'] as const,
  review: (id: number) => [...consultationKeys.detail(id), 'review'] as const,
  proposals: (id: number) => [...consultationKeys.detail(id), 'proposals'] as const,
  reports: (id: number) => [...consultationKeys.detail(id), 'reports'] as const,
  reportComments: (reportId: number) =>
    [...consultationKeys.all, 'report-comments', reportId] as const,
  settlements: (id: number) => [...consultationKeys.detail(id), 'settlements'] as const,
  sites: (id: number) => [...consultationKeys.detail(id), 'sites'] as const,
  revisions: (id: number) => [...consultationKeys.detail(id), 'revisions'] as const,
  survey: (id: number) => [...consultationKeys.detail(id), 'survey'] as const,
  chat: (id: number) => [...consultationKeys.detail(id), 'chat'] as const,
  schedules: (id: number) => [...consultationKeys.detail(id), 'schedules'] as const,
  tradingRequests: (id: number) => [...consultationKeys.detail(id), 'trading-requests'] as const,
  recommendProfiles: (filters?: object) =>
    [...consultationKeys.all, 'recommend-profiles', filters] as const,
};

export const diagnosisKeys = {
  all: ['diagnoses'] as const,
  lists: () => [...diagnosisKeys.all, 'list'] as const,
  detail: (id: number) => [...diagnosisKeys.all, 'detail', id] as const,
  byCompany: (companyId: number) => [...diagnosisKeys.all, 'company', companyId] as const,
  recent: (companyId: number) => [...diagnosisKeys.all, 'recent', companyId] as const,
};

export const consultantKeys = {
  all: ['consultants'] as const,
  lists: () => [...consultantKeys.all, 'list'] as const,
  list: (filters?: object) => [...consultantKeys.lists(), filters] as const,
  details: () => [...consultantKeys.all, 'detail'] as const,
  detail: (id: number) => [...consultantKeys.details(), id] as const,
  byUser: (userId: number) => [...consultantKeys.all, 'by-user', userId] as const,
  certifications: (profileId: number) =>
    [...consultantKeys.detail(profileId), 'certifications'] as const,
  specializations: (profileId: number) =>
    [...consultantKeys.detail(profileId), 'specializations'] as const,
  referrals: (profileId: number) => [...consultantKeys.detail(profileId), 'referrals'] as const,
  settlementsByConsultant: (consultantId: number) =>
    [...consultantKeys.all, 'settlements', consultantId] as const,
};

export const milestoneKeys = {
  all: ['milestones'] as const,
  byConsultation: (id: number) => [...milestoneKeys.all, 'consultation', id] as const,
};

export const reportKeys = {
  all: ['reports'] as const,
  byConsultation: (id: number) => [...reportKeys.all, 'consultation', id] as const,
};

export const codeKeys = {
  all: ['codes'] as const,
  groups: () => [...codeKeys.all, 'groups'] as const,
  byGroup: (group: string) => [...codeKeys.all, 'group', group] as const,
};

export const auditLogKeys = {
  all: ['audit-logs'] as const,
  lists: () => [...auditLogKeys.all, 'list'] as const,
  list: (filters?: object) => [...auditLogKeys.lists(), filters] as const,
};

export const monitoringKeys = {
  all: ['monitoring'] as const,
  dashboard: () => [...monitoringKeys.all, 'dashboard'] as const,
  plants: (ownedOnly?: boolean) =>
    ownedOnly
      ? ([...monitoringKeys.all, 'plants', 'owned'] as const)
      : ([...monitoringKeys.all, 'plants'] as const),
  plant: (id: number) => [...monitoringKeys.plants(), id] as const,
  plantHistory: (id: number, from: string, to: string) =>
    [...monitoringKeys.all, 'plant-history', id, from, to] as const,
  plantDailySummary: (id: number, date: string) =>
    [...monitoringKeys.all, 'plant-daily-summary', id, date] as const,
  plantPerformance: (id: number, from: string, to: string) =>
    [...monitoringKeys.all, 'plant-performance', id, from, to] as const,
  plantsCompare: (from: string, to: string) =>
    [...monitoringKeys.all, 'plants-compare', from, to] as const,
  consumers: () => [...monitoringKeys.all, 'consumers'] as const,
  consumer: (id: number) => [...monitoringKeys.consumers(), id] as const,
  consumerSupplyImpact: (companyId: number) =>
    [...monitoringKeys.all, 'consumer-supply-impact', companyId] as const,
  consumerSupplyDemand: (companyId: number) =>
    [...monitoringKeys.all, 'consumer-supply-demand', companyId] as const,
  contracts: () => [...monitoringKeys.all, 'contracts'] as const,
  anomalies: (filters?: object) => [...monitoringKeys.all, 'anomalies', filters] as const,
  anomaly: (id: number) => [...monitoringKeys.all, 'anomaly', id] as const,
  anomalyImpact: (id: number) => [...monitoringKeys.all, 'anomaly-impact', id] as const,
};

export const operatorKeys = {
  all: ['operator'] as const,
  anomalies: (filters?: object) => [...operatorKeys.all, 'anomalies', filters] as const,
};

export const etmKeys = {
  all: ['etm'] as const,
  availablePlants: () => [...etmKeys.all, 'available-plants'] as const,
  contracts: (filters?: object) => [...etmKeys.all, 'contracts', filters] as const,
  contract: (id: number) => [...etmKeys.all, 'contract', id] as const,
  marketPrice: () => [...etmKeys.all, 'market-price'] as const,
  settlements: (filters?: object) => [...etmKeys.all, 'settlements', filters] as const,
  invoices: (filters?: object) => [...etmKeys.all, 'invoices', filters] as const,
  invoice: (id: number) => [...etmKeys.all, 'invoice', id] as const,
  rec: () => [...etmKeys.all, 'rec'] as const,
  recTransactions: (filters?: object) => [...etmKeys.all, 'rec-transactions', filters] as const,
  transactions: (filters?: object) => [...etmKeys.all, 'transactions', filters] as const,
};

export const ppaKeys = {
  all: ['ppa'] as const,
  contracts: (filters?: object) => [...ppaKeys.all, 'contracts', filters] as const,
  contract: (id: number) => [...ppaKeys.all, 'contract', id] as const,
  contractChanges: (contractId: number) =>
    [...ppaKeys.all, 'contract', contractId, 'changes'] as const,
  contractChange: (changeId: number) => [...ppaKeys.all, 'change', changeId] as const,
  contractDocuments: (contractId: number) =>
    [...ppaKeys.all, 'contract', contractId, 'documents'] as const,
  contractDeviations: (contractId: number) =>
    [...ppaKeys.all, 'contract', contractId, 'deviations'] as const,
  settlements: (filters?: object) => [...ppaKeys.all, 'settlements', filters] as const,
  settlement: (id: number) => [...ppaKeys.all, 'settlement', id] as const,
  invoices: (settlementId: number) => [...ppaKeys.all, 'invoices', settlementId] as const,
};

export const leaseKeys = {
  all: ['lease'] as const,
  volume: (filters?: object) => [...leaseKeys.all, 'volume', filters] as const,
  volumeDetail: (id: number) => [...leaseKeys.all, 'volume', id] as const,
  savings: (filters?: object) => [...leaseKeys.all, 'savings', filters] as const,
  savingsDetail: (id: number) => [...leaseKeys.all, 'savings', id] as const,
  monthlyRecords: (filters?: object) => [...leaseKeys.all, 'monthly-records', filters] as const,
  allMonthlyRecords: (filters?: object) =>
    [...leaseKeys.all, 'all-monthly-records', filters] as const,
  invoices: (filters?: object) => [...leaseKeys.all, 'invoices', filters] as const,
  allInvoices: (filters?: object) => [...leaseKeys.all, 'all-invoices', filters] as const,
  requests: (filters?: object) => [...leaseKeys.all, 'requests', filters] as const,
  equipments: () => [...leaseKeys.all, 'equipments'] as const,
  myEquipments: (companyId: number) => [...leaseKeys.all, 'my-equipments', companyId] as const,
  recoveries: (filters?: object) => [...leaseKeys.all, 'recoveries', filters] as const,
  calculateSavings: (params: object) => [...leaseKeys.all, 'calculate-savings', params] as const,
  activities: (filters?: object) => [...leaseKeys.all, 'activities', filters] as const,
};

export const re100Keys = {
  all: ['re100'] as const,
  roadmap: (companyId: number) => [...re100Keys.all, 'roadmap', companyId] as const,
  sourceMix: (companyId: number, period: string) =>
    [...re100Keys.all, 'source-mix', companyId, period] as const,
};

export const tradingKeys = {
  all: ['trading'] as const,
  requests: (filters?: object) => [...tradingKeys.all, 'requests', filters] as const,
  request: (id: number) => [...tradingKeys.all, 'request', id] as const,
  matches: (requestId: number) => [...tradingKeys.all, 'matches', requestId] as const,
  leaseProposal: (id: number) => [...tradingKeys.all, 'lease-proposal', id] as const,
  allMatches: (filters?: object) => [...tradingKeys.all, 'all-matches', filters] as const,
  marketPrices: (filters?: object) => [...tradingKeys.all, 'market-prices', filters] as const,
  recTransactions: (filters?: object) => [...tradingKeys.all, 'rec-transactions', filters] as const,
};

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
};

export const forecastKeys = {
  all: ['forecasts'] as const,
  byPlant: (plantId: number, filters?: object) =>
    [...forecastKeys.all, 'plant', plantId, filters] as const,
  penalties: (plantId: number) => [...forecastKeys.all, 'penalties', plantId] as const,
};

export const consumerKeys = {
  all: ['consumer'] as const,
  sites: (filters?: object) => [...consumerKeys.all, 'sites', filters] as const,
  site: (id: number) => [...consumerKeys.all, 'site', id] as const,
  siteUsage: (siteId: number) => [...consumerKeys.all, 'site', siteId, 'usage'] as const,
  billing: (companyId: number) => [...consumerKeys.all, 'billing', companyId] as const,
  contracts: (companyId: number) => [...consumerKeys.all, 'contracts', companyId] as const,
  contractsByStation: (powerStationId: number) =>
    [...consumerKeys.all, 'contracts-by-station', powerStationId] as const,
};

export const agencyKeys = {
  all: ['agencies'] as const,
  lists: () => [...agencyKeys.all, 'list'] as const,
  list: (filters?: object) => [...agencyKeys.lists(), filters] as const,
  details: () => [...agencyKeys.all, 'detail'] as const,
  detail: (id: number) => [...agencyKeys.details(), id] as const,
  byCompany: (companyId: number) => [...agencyKeys.all, 'by-company', companyId] as const,
};

export const spcKeys = {
  all: ['spc'] as const,
  assets: (filters?: object) => [...spcKeys.all, 'assets', filters] as const,
  asset: (id: number) => [...spcKeys.all, 'asset', id] as const,
  tradingMonthly: (year?: number) => [...spcKeys.all, 'trading-monthly', year ?? null] as const,
  generationDaily: (days?: number) => [...spcKeys.all, 'generation-daily', days ?? 30] as const,
  suppliers: () => [...spcKeys.all, 'suppliers'] as const,
  finance: (companyId?: number) => [...spcKeys.all, 'finance', companyId ?? null] as const,
};

export const invitationKeys = {
  all: ['invitations'] as const,
  lists: () => [...invitationKeys.all, 'list'] as const,
  list: (filters?: object) => [...invitationKeys.lists(), filters] as const,
};

export const noticeKeys = {
  all: ['notices'] as const,
  lists: () => [...noticeKeys.all, 'list'] as const,
  list: (filters?: object) => [...noticeKeys.lists(), filters] as const,
  details: () => [...noticeKeys.all, 'detail'] as const,
  detail: (id: number) => [...noticeKeys.details(), id] as const,
};

export const termsKeys = {
  all: ['terms'] as const,
  lists: () => [...termsKeys.all, 'list'] as const,
  list: (filters?: object) => [...termsKeys.lists(), filters] as const,
  accepted: (userId: number) => [...termsKeys.all, 'accepted', userId] as const,
};

export const onboardingKeys = {
  all: ['onboarding'] as const,
  byCompany: (companyId: number) => [...onboardingKeys.all, 'company', companyId] as const,
  detail: (id: number) => [...onboardingKeys.all, 'detail', id] as const,
};

export const roleKeys = {
  all: ['roles'] as const,
  lists: () => [...roleKeys.all, 'list'] as const,
  menus: (roleId: number) => [...roleKeys.all, 'menus', roleId] as const,
};

export const menuKeys = {
  all: ['menus'] as const,
  lists: () => [...menuKeys.all, 'list'] as const,
};

export const settingsKeys = {
  all: ['settings'] as const,
  lists: () => [...settingsKeys.all, 'list'] as const,
  byKey: (key: string) => [...settingsKeys.all, 'key', key] as const,
  energy: () => [...settingsKeys.all, 'energy'] as const,
};

export const fileKeys = {
  all: ['files'] as const,
  detail: (id: number) => [...fileKeys.all, 'detail', id] as const,
};
