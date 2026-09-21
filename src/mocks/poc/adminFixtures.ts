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
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export const USERS: MockUser[] = [
  { id: 1, email: 'admin@test.com', name: '김관리', phone: '010-1000-0001', status: 'ACTIVE', companyId: 1, companyName: '울산 에너지 플랫폼', roles: ['SYSTEM_ADMIN'], isActive: true, department: '운영팀', position: '팀장', lastLoginAt: daysAgo(0), createdAt: daysAgo(400), updatedAt: daysAgo(0) },
  { id: 2, email: 'operator@test.com', name: '박발전', phone: '010-2000-0002', status: 'ACTIVE', companyId: 2, companyName: '울산 발전(주)', roles: ['POWER_OPERATOR'], isActive: true, department: '발전운영팀', position: '과장', lastLoginAt: daysAgo(1), createdAt: daysAgo(320), updatedAt: daysAgo(1) },
  { id: 3, email: 'consumer@test.com', name: '이수용', phone: '010-3000-0003', status: 'ACTIVE', companyId: 3, companyName: '울산 수용가(주)', roles: ['CONSUMER_MANAGER'], isActive: true, department: '시설관리팀', position: '대리', lastLoginAt: daysAgo(2), createdAt: daysAgo(300), updatedAt: daysAgo(2) },
  { id: 4, email: 'kim@hanil.co.kr', name: '김한일', phone: '010-4000-0004', status: 'ACTIVE', companyId: 4, companyName: '한일튜브', roles: ['CONSUMER_MANAGER'], isActive: true, department: '설비팀', position: '차장', lastLoginAt: daysAgo(3), createdAt: daysAgo(90), updatedAt: daysAgo(3) },
  { id: 5, email: 'park@yongin.co.kr', name: '박용인', phone: '010-5000-0005', status: 'PENDING', companyId: 5, companyName: '용인금속', roles: ['CONSUMER_MANAGER'], isActive: false, department: '관리부', position: '사원', lastLoginAt: null, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
];

/* ── 역할 ─────────────────────────────────────────────── */
export const ROLES = [
  { id: 1, name: '관리자', code: 'SYSTEM_ADMIN', description: '플랫폼 전체 관리', defaultPath: '/dashboard', system: true },
  { id: 2, name: '발전사업자', code: 'POWER_OPERATOR', description: '발전소 운영·거래', defaultPath: '/dashboard', system: true },
  { id: 3, name: '전기사용자', code: 'CONSUMER_MANAGER', description: '수용가 에너지·거래', defaultPath: '/dashboard', system: true },
];

/* ── 메뉴 (역할·권한 트리) ─────────────────────────────── */
export const MENUS = [
  { id: 1, parentId: null, menuCode: 'CONTROL', name: '통합관제', path: '/dashboard', icon: null, depth: 0, sortOrder: 1, isVisible: true },
  { id: 2, parentId: null, menuCode: 'RE100', name: 'RE100', path: '/re100', icon: null, depth: 0, sortOrder: 2, isVisible: true },
  { id: 3, parentId: null, menuCode: 'EDATA', name: 'E-데이터마켓', path: '/e-data/inventory', icon: null, depth: 0, sortOrder: 3, isVisible: true },
  { id: 4, parentId: null, menuCode: 'ADMIN', name: '관리', path: '/platform/companies', icon: null, depth: 0, sortOrder: 4, isVisible: true },
];
// 역할별 보유 메뉴 (관리자=전체, 발전사업자·전기사용자=관리 제외)
const ROLE_MENUS: Record<number, number[]> = {
  1: [1, 2, 3, 4],
  2: [1, 2, 3],
  3: [1, 2, 3],
};
function roleMenusOf(roleId: number) {
  return (ROLE_MENUS[roleId] ?? []).map((menuId) => {
    const m = MENUS.find((x) => x.id === menuId)!;
    return { id: roleId * 100 + menuId, roleId, menuId, menuName: m.name, canRead: true, canWrite: roleId === 1, canDelete: roleId === 1 };
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
});
registerMock(/^\/users\/(\d+)$/, ({ match }) => USERS.find((u) => u.id === Number(match[1])) ?? USERS[0]);
registerMock(/^\/users\/(\d+)\/activate$/, ({ match }) => setUserStatus(Number(match[1]), 'ACTIVE'), 'PATCH');
registerMock(/^\/users\/(\d+)\/suspend$/, ({ match }) => setUserStatus(Number(match[1]), 'SUSPENDED'), 'PATCH');

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

// 역할·권한
registerMock(/^\/roles$/, () => ROLES);
registerMock(/^\/menus$/, () => MENUS);
registerMock(/^\/roles\/(\d+)\/menus$/, ({ match }) => roleMenusOf(Number(match[1])));

// 감사 로그
registerMock(/^\/audit-logs$/, () => pageOf(AUDIT_LOGS, 20));
