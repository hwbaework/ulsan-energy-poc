/**
 * 관리(ADMIN) 축 목업 — 기업/회원/역할·권한/승인/감사로그.
 * POC 기준: 운영사 1 · 발전사업자 1 · 전기사용자(수용가) 다수.
 * 상태 변경(승인·정지 등)과 저장은 메모리에 반영되어 화면 흐름을 그대로 볼 수 있다.
 */
import { registerMock, pageOf } from './registry';

const NOW = '2026-09-18T09:00:00';
function daysAgo(days: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 19);
}

/* ── 기업 ─────────────────────────────────────────────── */
interface MockCompany {
  id: number;
  name: string;
  businessNumber: string;
  representativeName: string;
  address: string;
  phone: string;
  email: string;
  status: string;
  businessTypes: string[];
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
}
export const COMPANIES: MockCompany[] = [
  { id: 1, name: '울산 에너지 플랫폼', businessNumber: '610-88-00001', representativeName: '김운영', address: '울산 남구 처용로 1', phone: '052-100-1000', email: 'admin@test.com', status: 'ACTIVE', businessTypes: ['SPC', '운영사'], employeeCount: 24, createdAt: daysAgo(400), updatedAt: daysAgo(10) },
  { id: 2, name: '울산 발전(주)', businessNumber: '610-81-20002', representativeName: '박발전', address: '울산 남구 부곡동 273-6', phone: '052-200-2000', email: 'operator@test.com', status: 'ACTIVE', businessTypes: ['발전사업자'], employeeCount: 12, createdAt: daysAgo(320), updatedAt: daysAgo(6) },
  { id: 3, name: '울산 수용가(주)', businessNumber: '610-81-30003', representativeName: '이수용', address: '울산 남구 처용로 100', phone: '052-300-3000', email: 'consumer@test.com', status: 'ACTIVE', businessTypes: ['수용가'], employeeCount: 58, createdAt: daysAgo(300), updatedAt: daysAgo(4) },
  { id: 4, name: '한일튜브', businessNumber: '610-81-40004', representativeName: '최한일', address: '울산 남구 부곡동 273-6', phone: '052-400-4000', email: 'kim@hanil.co.kr', status: 'ACTIVE', businessTypes: ['수용가'], employeeCount: 140, createdAt: daysAgo(90), updatedAt: daysAgo(2) },
  { id: 5, name: '용인금속', businessNumber: '610-81-50005', representativeName: '정용인', address: '울산 남구 여천동 887-18', phone: '052-500-5000', email: 'park@yongin.co.kr', status: 'PENDING', businessTypes: ['수용가'], employeeCount: 72, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
];

/* ── 회원 ─────────────────────────────────────────────── */
interface MockUser {
  id: number;
  email: string;
  name: string;
  phone: string;
  status: string;
  companyId: number;
  companyName: string;
  roles: string[];
  isActive: boolean;
  department: string;
  position: string;
  /** 기업 관리자 = 기업의 첫 계정(가입 시 기업 정보 함께 등록) · 기업 회원 = 이미 있는 기업에 합류한 계정 */
  accountType: 'COMPANY_ADMIN' | 'COMPANY_MEMBER';
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export const USERS: MockUser[] = [
  { id: 1, email: 'admin@test.com', name: '김관리', phone: '010-1000-0001', status: 'ACTIVE', companyId: 1, companyName: '울산 에너지 플랫폼', roles: ['SYSTEM_ADMIN'], isActive: true, department: '운영팀', position: '팀장', accountType: 'COMPANY_ADMIN', lastLoginAt: daysAgo(0), createdAt: daysAgo(400), updatedAt: daysAgo(0) },
  { id: 2, email: 'operator@test.com', name: '박발전', phone: '010-2000-0002', status: 'ACTIVE', companyId: 2, companyName: '울산 발전(주)', roles: ['POWER_OPERATOR'], isActive: true, department: '발전운영팀', position: '과장', accountType: 'COMPANY_ADMIN', lastLoginAt: daysAgo(1), createdAt: daysAgo(320), updatedAt: daysAgo(1) },
  { id: 3, email: 'consumer@test.com', name: '이수용', phone: '010-3000-0003', status: 'ACTIVE', companyId: 3, companyName: '울산 수용가(주)', roles: ['CONSUMER_MANAGER'], isActive: true, department: '시설관리팀', position: '대리', accountType: 'COMPANY_ADMIN', lastLoginAt: daysAgo(2), createdAt: daysAgo(300), updatedAt: daysAgo(2) },
  { id: 4, email: 'kim@hanil.co.kr', name: '김한일', phone: '010-4000-0004', status: 'ACTIVE', companyId: 4, companyName: '한일튜브', roles: ['CONSUMER_MANAGER'], isActive: true, department: '설비팀', position: '차장', accountType: 'COMPANY_ADMIN', lastLoginAt: daysAgo(3), createdAt: daysAgo(90), updatedAt: daysAgo(3) },
  // 승인 대기 — 기업 관리자(용인금속 첫 가입) · 기업 회원(한일튜브 소속 추가 가입)
  { id: 5, email: 'park@yongin.co.kr', name: '박용인', phone: '010-5000-0005', status: 'PENDING', companyId: 5, companyName: '용인금속', roles: ['CONSUMER_MANAGER'], isActive: false, department: '관리부', position: '과장', accountType: 'COMPANY_ADMIN', lastLoginAt: null, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  { id: 6, email: 'lee@hanil.co.kr', name: '이설비', phone: '010-6000-0006', status: 'PENDING', companyId: 4, companyName: '한일튜브', roles: ['CONSUMER_MANAGER'], isActive: false, department: '설비팀', position: '사원', accountType: 'COMPANY_MEMBER', lastLoginAt: null, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
];

/* ── 역할 ─────────────────────────────────────────────── */
interface MockRole {
  id: number;
  name: string;
  code: string;
  description: string;
  defaultPath: string;
  system: boolean;
}
export const ROLES: MockRole[] = [
  { id: 1, name: '관리자', code: 'SYSTEM_ADMIN', description: '플랫폼 전체 관리', defaultPath: '/dashboard', system: true },
  { id: 2, name: '발전사업자', code: 'POWER_OPERATOR', description: '발전소 운영·거래', defaultPath: '/dashboard', system: true },
  { id: 3, name: '전기사용자', code: 'CONSUMER_MANAGER', description: '수용가 에너지·거래', defaultPath: '/dashboard', system: true },
  // 추가한 역할 예시 — 수정·삭제 가능
  { id: 4, name: '테스트 권한', code: 'TEST_ROLE', description: '테스트용 역할', defaultPath: '/dashboard', system: false },
];

/* ── 메뉴 (역할·권한 트리) ─────────────────────────────── */
// 메뉴 트리 — app/(main)/layout.tsx 의 GNB/LNB(관리자 페르소나)와 같은 구조. depth 0 = GNB, 1 = LNB, 2 = LNB 하위
interface MockMenu {
  id: number;
  parentId: number | null;
  menuCode: string;
  name: string;
  path: string | null;
  icon: null;
  depth: number;
  sortOrder: number;
  isVisible: boolean;
}
export const MENUS: MockMenu[] = [];
let menuSeq = 0;
function addMenu(name: string, menuCode: string, path: string | null, parentId: number | null, depth: number): number {
  const id = ++menuSeq;
  MENUS.push({ id, parentId, menuCode, name, path, icon: null, depth, sortOrder: id, isVisible: true });
  return id;
}
// 통합관제
const M_CONTROL = addMenu('통합관제', 'CONTROL', '/dashboard', null, 0);
addMenu('대시보드', 'CONTROL_DASHBOARD', '/dashboard', M_CONTROL, 1);
const M_MAP = addMenu('관제 홈(지도)', 'CONTROL_MAP', '/monitoring', M_CONTROL, 1);
addMenu('발전소 상세', 'CONTROL_PLANT', '/monitoring/plant', M_CONTROL, 1);
addMenu('이상감지 관리', 'CONTROL_ANOMALY', '/monitoring/anomalies', M_CONTROL, 1);
const M_DISOP = addMenu('DiSOP', 'CONTROL_DISOP', null, M_CONTROL, 1);
addMenu('예지보전', 'CONTROL_DISOP_PREDICTIVE', '/control/predictive', M_DISOP, 2);
addMenu('안전', 'CONTROL_DISOP_SAFETY', '/control/safety', M_DISOP, 2);
addMenu('디지털트윈', 'CONTROL_DT', 'https://terrawatt.pairworks.net/', M_CONTROL, 1);
addMenu('보고서', 'CONTROL_REPORT', '/monitoring/reports', M_CONTROL, 1);
// RE100
const M_RE100 = addMenu('RE100', 'RE100', '/platform/trading', null, 0);
addMenu('거래 신청', 'RE100_TRADING', '/platform/trading', M_RE100, 1);
addMenu('내 계약', 'RE100_CONTRACTS', '/platform/ppa/contracts', M_RE100, 1);
addMenu('변경·해지', 'RE100_CONTRACT_CHANGES', '/ppa/contract-changes', M_RE100, 1);
addMenu('거래 이력', 'RE100_HISTORY', '/trading/history', M_RE100, 1);
const M_BILLING = addMenu('수익·정산', 'RE100_BILLING', null, M_RE100, 1);
addMenu('정산', 'RE100_BILLING_SETTLEMENT', '/platform/ppa/billing/settlement', M_BILLING, 2);
addMenu('수금·지급', 'RE100_BILLING_PAYMENT', '/platform/ppa/billing/settlement/payment', M_BILLING, 2);
addMenu('이력·감사', 'RE100_BILLING_HISTORY', '/platform/ppa/billing/settlement/history', M_BILLING, 2);
addMenu('세금계산서', 'RE100_BILLING_TAX', '/platform/ppa/billing/tax-invoice', M_BILLING, 2);
addMenu('계약 현황', 'RE100_DASHBOARD', '/platform/ppa/dashboard', M_RE100, 1);
addMenu('거래 승인', 'RE100_APPROVALS', '/platform/trading/approvals', M_RE100, 1);
addMenu('문서 관리', 'RE100_DOCUMENTS', '/platform/ppa/documents', M_RE100, 1);
// E-데이터마켓
const M_EDATA = addMenu('E-데이터마켓', 'EDATA', '/e-data/inventory', null, 0);
const M_GHG = addMenu('온실가스 인벤토리', 'EDATA_GHG', null, M_EDATA, 1);
addMenu('배출시설 정보', 'EDATA_GHG_FACILITY', '/e-data/inventory', M_GHG, 2);
addMenu('배출원 등록', 'EDATA_GHG_SOURCES', '/e-data/inventory/sources', M_GHG, 2);
addMenu('배출계수 관리', 'EDATA_GHG_FACTORS', '/e-data/inventory/factors', M_GHG, 2);
addMenu('배출량 산정', 'EDATA_GHG_CALC', '/e-data/inventory/calculation', M_GHG, 2);
addMenu('명세서', 'EDATA_GHG_STATEMENT', '/e-data/inventory/statement', M_GHG, 2);
addMenu('보고서', 'EDATA_GHG_REPORT', '/e-data/inventory/disclosure', M_GHG, 2);
const M_CARBON = addMenu('카본 마켓플레이스', 'EDATA_CARBON', null, M_EDATA, 1);
addMenu('탄소배출권 정보', 'EDATA_CARBON_INFO', '/carbon', M_CARBON, 2);
addMenu('탄소배출권 KRX 거래', 'EDATA_CARBON_KRX', '/carbon/krx', M_CARBON, 2);
addMenu('탄소배출권 장외거래', 'EDATA_CARBON_OTC', '/carbon/otc', M_CARBON, 2);
addMenu('탄소배출권 계약관리', 'EDATA_CARBON_ETRS', '/carbon/etrs', M_CARBON, 2);
addMenu('외부감축사업 정보', 'EDATA_CARBON_OFFSET', '/carbon/offset', M_CARBON, 2);
addMenu('외부감축사업 보고서', 'EDATA_CARBON_VOLUNTARY', '/carbon/voluntary', M_CARBON, 2);
const M_DATA = addMenu('데이터 마켓플레이스', 'EDATA_MARKET', null, M_EDATA, 1);
addMenu('데이터 등록/신청', 'EDATA_MARKET_CATALOG', '/e-data/catalog', M_DATA, 2);
addMenu('거래 현황', 'EDATA_MARKET_TRADING', '/e-data/trading', M_DATA, 2);
addMenu('정산', 'EDATA_MARKET_SETTLEMENT', '/e-data/trading/settlement', M_DATA, 2);
addMenu('API 허브', 'EDATA_MARKET_API', '/e-data/api-hub', M_DATA, 2);
// 관리
const M_ADMIN = addMenu('관리', 'ADMIN', '/platform/companies', null, 0);
addMenu('기업 정보', 'ADMIN_ORG', '/org', M_ADMIN, 1);
addMenu('설정', 'ADMIN_ORG_SETTINGS', '/org/settings', M_ADMIN, 1);
addMenu('내 계정', 'ADMIN_PROFILE', '/org/profile', M_ADMIN, 1);
addMenu('기업 관리', 'ADMIN_COMPANIES', '/platform/companies', M_ADMIN, 1);
addMenu('회원 관리', 'ADMIN_USERS', '/platform/users', M_ADMIN, 1);
addMenu('역할·권한', 'ADMIN_ROLES', '/platform/roles', M_ADMIN, 1);
addMenu('승인 관리', 'ADMIN_APPROVALS', '/platform/approvals', M_ADMIN, 1);
addMenu('거래 승인', 'ADMIN_TRADING_APPROVALS', '/platform/trading/approvals', M_ADMIN, 1);
addMenu('알림 설정', 'ADMIN_NOTIFICATIONS', '/platform/notification-settings', M_ADMIN, 1);

function isUnder(menu: MockMenu, rootId: number): boolean {
  let cur: MockMenu | undefined = menu;
  while (cur) {
    if (cur.id === rootId) return true;
    cur = MENUS.find((m) => m.id === cur!.parentId);
  }
  return false;
}
// 역할별 메뉴 권한 — 관리자=전체 쓰기 · 발전사업자/전기사용자=관리 트리와 관제 홈(지도) 제외 조회. 화면에서 저장하면 여기에 반영된다
interface MenuPerm { canRead: boolean; canWrite: boolean }
const ROLE_MENU_PERMS: Record<number, Record<number, MenuPerm>> = { 1: {}, 2: {}, 3: {}, 4: {} };
for (const m of MENUS) {
  ROLE_MENU_PERMS[1]![m.id] = { canRead: true, canWrite: true };
  if (!isUnder(m, M_ADMIN) && m.id !== M_MAP) {
    ROLE_MENU_PERMS[2]![m.id] = { canRead: true, canWrite: false };
    ROLE_MENU_PERMS[3]![m.id] = { canRead: true, canWrite: false };
  }
  // 테스트 권한: 통합관제만 접근
  if (isUnder(m, M_CONTROL)) ROLE_MENU_PERMS[4]![m.id] = { canRead: true, canWrite: false };
}
function roleMenusOf(roleId: number) {
  return Object.entries(ROLE_MENU_PERMS[roleId] ?? {}).map(([menuIdStr, p]) => {
    const menuId = Number(menuIdStr);
    const m = MENUS.find((x) => x.id === menuId)!;
    return { id: roleId * 100 + menuId, roleId, menuId, menuName: m.name, canRead: p.canRead, canWrite: p.canWrite, canDelete: p.canWrite };
  });
}

/* ── 감사 로그 ─────────────────────────────────────────── */
export const AUDIT_LOGS = [
  { id: 1, userId: 1, userName: '김관리', action: 'LOGIN', entityType: 'AUTH', detail: '김관리 로그인', ipAddress: '10.0.0.12', createdAt: daysAgo(0) },
  { id: 2, userId: 1, userName: '김관리', action: 'APPROVE', entityType: 'COMPANY', entityId: 4, detail: '한일튜브 가입 승인', ipAddress: '10.0.0.12', createdAt: daysAgo(2) },
  { id: 3, userId: 2, userName: '박발전', action: 'CREATE', entityType: 'TRADE', entityId: 101, detail: '공급 신청 등록', ipAddress: '10.0.1.33', createdAt: daysAgo(2) },
  { id: 4, userId: 1, userName: '김관리', action: 'UPDATE', entityType: 'ROLE', entityId: 3, detail: '전기사용자 메뉴 권한 변경', ipAddress: '10.0.0.12', createdAt: daysAgo(5) },
  { id: 5, userId: 3, userName: '이수용', action: 'LOGIN', entityType: 'AUTH', detail: '이수용 로그인', ipAddress: '10.0.2.51', createdAt: daysAgo(6) },
];

/* ── helpers ───────────────────────────────────────────── */
function byStatus<T extends { status: string }>(rows: T[], status: string | null): T[] {
  return status ? rows.filter((r) => r.status === status) : rows;
}
function setCompanyStatus(id: number, status: string) {
  const c = COMPANIES.find((x) => x.id === id);
  if (c) { c.status = status; c.updatedAt = new Date().toISOString().slice(0, 19); }
  return {};
}
function setUserStatus(id: number, status: string) {
  const u = USERS.find((x) => x.id === id);
  if (u) { u.status = status; u.isActive = status === 'ACTIVE'; u.updatedAt = new Date().toISOString().slice(0, 19); }
  return {};
}
function updateCompanyFixture(id: number, body: unknown) {
  const c = COMPANIES.find((x) => x.id === id);
  if (c && body && typeof body === 'object') {
    const d = body as Record<string, unknown>;
    if (typeof d.name === 'string') c.name = d.name;
    if (typeof d.representativeName === 'string') c.representativeName = d.representativeName;
    if (typeof d.phone === 'string') c.phone = d.phone;
    if (typeof d.address === 'string') c.address = d.address;
    if (typeof d.businessNumber === 'string') c.businessNumber = d.businessNumber;
    c.updatedAt = new Date().toISOString().slice(0, 19);
  }
  return c ?? COMPANIES[0];
}

/* ── 라우트 등록 ───────────────────────────────────────── */
// 회원
registerMock(/^\/users$/, ({ query }) => {
  const status = query.get('status');
  const kw = query.get('keyword');
  let rows = byStatus(USERS, status);
  if (kw) rows = rows.filter((u) => u.name.includes(kw) || u.email.includes(kw) || u.companyName.includes(kw));
  return pageOf(rows, 100);
}, 'GET');
// 회원 등록 — 초기 비밀번호는 화면에서 a123456789 고정. 역할·연락처·부서는 등록 직후 별도 API 로 붙는다
registerMock(/^\/users$/, ({ body }) => {
  const b = (body ?? {}) as { email?: string; name?: string; companyId?: number; phone?: string; department?: string; accountType?: 'COMPANY_ADMIN' | 'COMPANY_MEMBER' };
  const company = COMPANIES.find((c) => c.id === Number(b.companyId));
  const now = new Date().toISOString().slice(0, 19);
  const u: MockUser = {
    id: Math.max(0, ...USERS.map((x) => x.id)) + 1,
    email: b.email ?? '',
    name: b.name ?? '',
    phone: b.phone ?? '',
    status: 'ACTIVE',
    companyId: company?.id ?? 0,
    companyName: company?.name ?? '',
    roles: [],
    isActive: true,
    department: b.department ?? '',
    position: '',
    accountType: b.accountType ?? 'COMPANY_MEMBER',
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  };
  USERS.unshift(u);
  return u;
}, 'POST');
registerMock(/^\/users\/(\d+)$/, ({ match }) => USERS.find((u) => u.id === Number(match[1])) ?? USERS[0]);
registerMock(/^\/users\/(\d+)\/activate$/, ({ match }) => setUserStatus(Number(match[1]), 'ACTIVE'), 'PATCH');
registerMock(/^\/users\/(\d+)\/suspend$/, ({ match }) => setUserStatus(Number(match[1]), 'SUSPENDED'), 'PATCH');
// 비밀번호 초기화 — 관리자가 초기화하면 a123456789 로 바뀐다(목업은 응답만)
registerMock(/^\/users\/(\d+)\/reset-password$/, () => ({}), 'PATCH');

// 기업
registerMock(/^\/companies$/, ({ query }) => {
  const q = query.get('q');
  let rows = COMPANIES.slice();
  if (q) rows = rows.filter((c) => c.name.includes(q) || c.businessNumber.includes(q));
  return pageOf(rows, 100);
});
registerMock(/^\/companies\/(\d+)$/, ({ match }) => COMPANIES.find((c) => c.id === Number(match[1])) ?? COMPANIES[0], 'GET');
registerMock(/^\/companies\/(\d+)$/, ({ match, body }) => updateCompanyFixture(Number(match[1]), body), 'PUT');
registerMock(/^\/companies\/(\d+)\/activate$/, ({ match }) => setCompanyStatus(Number(match[1]), 'ACTIVE'), 'PATCH');
registerMock(/^\/companies\/(\d+)\/suspend$/, ({ match }) => setCompanyStatus(Number(match[1]), 'SUSPENDED'), 'PATCH');
registerMock(/^\/companies\/(\d+)\/contacts$/, () => []);

// 역할·권한 — 역할 추가·수정·삭제, 메뉴 권한 부여·회수, 회원 역할 배정 전부 메모리에 반영
registerMock(/^\/roles$/, () => ROLES, 'GET');
registerMock(/^\/roles$/, ({ body }) => {
  const b = (body ?? {}) as { code?: string; name?: string; description?: string };
  const id = Math.max(0, ...ROLES.map((x) => x.id)) + 1;
  const r: MockRole = {
    id,
    name: b.name ?? '',
    // 코드는 자동 부여 — 화면에서 입력받지 않는다
    code: b.code ? b.code.toUpperCase() : `ROLE_${id}`,
    description: b.description ?? '',
    defaultPath: '/dashboard',
    system: false,
  };
  ROLES.push(r);
  ROLE_MENU_PERMS[r.id] = {};
  return r;
}, 'POST');
registerMock(/^\/roles\/(\d+)$/, ({ match, body }) => {
  const r = ROLES.find((x) => x.id === Number(match[1]));
  const b = (body ?? {}) as { name?: string; description?: string };
  if (r) {
    if (typeof b.name === 'string') r.name = b.name;
    if (typeof b.description === 'string') r.description = b.description;
  }
  return r ?? ROLES[0];
}, 'PUT');
registerMock(/^\/roles\/(\d+)$/, ({ match }) => {
  const idx = ROLES.findIndex((x) => x.id === Number(match[1]) && !x.system);
  if (idx >= 0) {
    delete ROLE_MENU_PERMS[ROLES[idx]!.id];
    ROLES.splice(idx, 1);
  }
  return {};
}, 'DELETE');
registerMock(/^\/roles\/assign-by-code$/, ({ body }) => {
  const b = (body ?? {}) as { userId?: number; roleCode?: string };
  const u = USERS.find((x) => x.id === Number(b.userId));
  if (u && b.roleCode) u.roles = [b.roleCode];
  return {};
}, 'POST');
registerMock(/^\/menus$/, () => MENUS);
registerMock(/^\/roles\/(\d+)\/menus$/, ({ match }) => roleMenusOf(Number(match[1])), 'GET');
registerMock(/^\/roles\/(\d+)\/menus$/, ({ match, body }) => {
  const roleId = Number(match[1]);
  const b = (body ?? {}) as { menuId?: number; canRead?: boolean; canWrite?: boolean };
  if (b.menuId) {
    ROLE_MENU_PERMS[roleId] = ROLE_MENU_PERMS[roleId] ?? {};
    ROLE_MENU_PERMS[roleId]![b.menuId] = { canRead: !!b.canRead, canWrite: !!b.canWrite };
  }
  return {};
}, 'POST');
registerMock(/^\/roles\/(\d+)\/menus\/(\d+)$/, ({ match }) => {
  const perms = ROLE_MENU_PERMS[Number(match[1])];
  if (perms) delete perms[Number(match[2])];
  return {};
}, 'DELETE');

// 감사 로그
registerMock(/^\/audit-logs$/, () => pageOf(AUDIT_LOGS, 20));
