// client(axios) baseURL 이 이미 '/api/v1' 를 붙이므로 여기서는 빈 접두(endpoints.ts 와 동일).
// (과거 '/api/v1' 이면 '/api/v1/api/v1/...' 이중 접두 → 404 → 전 EDATA/GHG 호출 실패)
const V1 = '';

export const ENDPOINTS = {
  auth: {
    login: `${V1}/auth/login`,
    refresh: `${V1}/auth/refresh`,
    logout: `${V1}/auth/logout`,
    signup: `${V1}/auth/signup`,
    forgotPassword: `${V1}/auth/forgot-password`,
  },
  me: {
    profile: `${V1}/me`,
    notifications: `${V1}/me/notifications`,
    apiKeys: `${V1}/me/api-keys`,
  },
  catalog: {
    list: `${V1}/catalog`,
    detail: (id: number) => `${V1}/catalog/${id}`,
    schema: (id: number) => `${V1}/catalog/${id}/schema`,
    preview: (id: number) => `${V1}/catalog/${id}/preview`,
    reviews: (id: number) => `${V1}/catalog/${id}/reviews`,
    categories: `${V1}/catalog/categories`,
    trending: `${V1}/catalog/trending`,
  },
  provider: {
    datasets: `${V1}/provider/datasets`,
    dataset: (id: number) => `${V1}/provider/datasets/${id}`,
    dashboard: `${V1}/provider/dashboard`,
    settlements: `${V1}/provider/settlements`,
  },
  // trading.* 유령 계약 제거 (설계 12 §7.1): 정의만·소비 0·BE 부재.
  // 데이터 주문 정본은 datamarket.orders 단일 소스. (에너지 거래/PPA는 별도 @/api/endpoints.trading)
  payments: {
    prepare: `${V1}/payments/prepare`,
    confirm: `${V1}/payments/confirm`,
    receipt: (id: number) => `${V1}/payments/${id}/receipt`,
  },
  analytics: {
    overview: `${V1}/analytics/overview`,
    usage: `${V1}/analytics/usage`,
    apiUsage: `${V1}/analytics/api-usage`,
  },
  // digitalTwin.* 유령 계약 제거 (설계 12 §7.3): FE 라우트·BE 컨트롤러·소비 모두 없음.
  // 설비 트윈 조회 수요는 CONTROL 도메인 /dt 링크로 처리(EDATA 내 신규 화면 신설 금지).
  // 카본 마켓플레이스 (energy-backend CarbonMarketController). 설계문서 17.
  carbon: {
    quotes: `${V1}/carbon/quotes`,
    holding: `${V1}/carbon/holding`,
    otc: `${V1}/carbon/otc`,
    fileEtrs: (id: number) => `${V1}/carbon/otc/${id}/file`,
    offsetProjects: `${V1}/carbon/offset-projects`,
    voluntaryMarkets: `${V1}/carbon/voluntary-markets`,
    etrs: `${V1}/carbon/etrs`,
    fileEtrsTransfer: (id: number) => `${V1}/carbon/etrs/${id}/file`,
    matches: `${V1}/carbon/matches`,
    runMatching: `${V1}/carbon/matches/run`,
    convert: `${V1}/carbon/convert`,
    conversions: `${V1}/carbon/conversions`,
    monitoring: (id: number) => `${V1}/carbon/offset-projects/${id}/monitoring`,
    issueKoc: (id: number) => `${V1}/carbon/offset-projects/${id}/issue`,
    // 탄소 델타테이블 활성화 (energy-backend CarbonDeltaController). 기획 14 §4·§7.
    bulletins: `${V1}/carbon/bulletins`,
    bulletinStatus: (id: number) => `${V1}/carbon/bulletins/${id}/status`,
    bulletinThreads: (id: number) => `${V1}/carbon/bulletins/${id}/threads`,
    vcmCredits: `${V1}/carbon/vcm-credits`,
    retireVcm: (id: number) => `${V1}/carbon/vcm-credits/${id}/retire`,
    sellVcm: (id: number) => `${V1}/carbon/vcm-credits/${id}/sell`,
    kocMethodologies: `${V1}/carbon/koc-methodologies`,
    etsParams: `${V1}/carbon/ets-params`,
    kcuLedger: `${V1}/carbon/kcu-ledger`,
  },
  // 온실가스 인벤토리 MRV (energy-backend GhgController). 설계문서 15.
  ghg: {
    sources: `${V1}/ghg/sources`,
    sourceById: (id: number) => `${V1}/ghg/sources/${id}`,
    activities: `${V1}/ghg/activities`,
    calculation: `${V1}/ghg/calculation`,
    statements: `${V1}/ghg/statements`,
    generateStatement: `${V1}/ghg/statements/generate`,
    submitStatement: (id: number) => `${V1}/ghg/statements/${id}/submit`,
    verifyStatement: (id: number) => `${V1}/ghg/statements/${id}/verify`,
    factors: `${V1}/ghg/factors`,
    scope3: `${V1}/ghg/scope3`,
    target: `${V1}/ghg/target`,
    verifications: `${V1}/ghg/verifications`,
    decideVerification: (id: number) => `${V1}/ghg/verifications/${id}`,
    cbam: `${V1}/ghg/cbam`,
    cbamEstimate: `${V1}/ghg/cbam/estimate`,
    disclosure: `${V1}/ghg/disclosure`,
    disclosureNarrative: `${V1}/ghg/disclosure/narrative`, // 공시 서술(거버넌스/전략/위험관리) V109
    // 감축실적 원장 (기획 14 §2) — KOC 모니터링 자동 연계 + 수기
    reductionActuals: `${V1}/ghg/reduction-actuals`,
    reductionActualSyncKoc: `${V1}/ghg/reduction-actuals/sync-koc`,
  },
  // 데이터마켓 (energy-backend DmController). 기획 03 rev.2 + 설계 12(판매자 여정·정산·샘플).
  datamarket: {
    categories: `${V1}/datamarket/categories`,
    datasets: `${V1}/datamarket/datasets`,
    submitReview: (id: number) => `${V1}/datamarket/datasets/${id}/submit-review`,
    publishDataset: (id: number) => `${V1}/datamarket/datasets/${id}/publish`,
    preview: (id: number) => `${V1}/datamarket/datasets/${id}/preview`,
    // 데이터셋 파일 (format='FILE') — 업로드(판매자 소유)·다운로드(구매 게이팅, 서버 경유 스트리밍).
    // MinIO 전환 시 BE 내부만 교체(getObject/서명URL) — 아래 FE 계약은 불변.
    datasetFiles: (datasetId: number) => `${V1}/datamarket/datasets/${datasetId}/files`,
    downloadFile: (fileId: number) => `${V1}/datamarket/files/${fileId}/download`,
    orders: `${V1}/datamarket/orders`,
    settlement: `${V1}/datamarket/settlement`,
    payout: `${V1}/datamarket/settlement/payout`,
    consents: `${V1}/datamarket/consents`,
    apiKeys: `${V1}/datamarket/api-keys`,
    apiKey: (id: number) => `${V1}/datamarket/api-keys/${id}`,
    rfqs: `${V1}/datamarket/rfqs`,
    // 데이터셋 전용 샘플 (기획 14 §5) — 서버 생성 비식별 표본. preview 와 구분.
    sample: (id: number) => `${V1}/datamarket/datasets/${id}/sample`,
    generateSample: (id: number) => `${V1}/datamarket/datasets/${id}/sample/generate`,
  },
} as const;
