'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Bell,
  LogOut,
  User,
  AlertTriangle,
  BarChart3,
  Building2,
  Handshake,
  Receipt,
  CreditCard,
  Leaf,
  Users,
  ShieldCheck,
  KeyRound,
  Send,
  ScrollText,
  Wallet,
  TrendingUp,
  Zap,
  FileText,
  ClipboardCheck,
  ClipboardList,
  Activity,
  ChevronDown,
  Link2,
  LayoutDashboard,
  MessageSquare,
  Monitor,
  ArrowRightLeft,
  Settings,
  Factory,
  History,
  Coins,
  Calculator,
  Target,
  Cpu,
  Database,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { ToastContainer } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/useAuthStore';
import { getPersona, usePersonaOverride, type Persona } from '@/lib/persona';
import { cn } from '@/lib/utils';
import { useMe, useMyMenus, useSignOut } from '@/hooks/auth/useAuth';
import { useUnreadCount, useNotifications, useMarkRead, useMarkAllRead } from '@/hooks/platform/useNotifications';
import { useWebSocketNotifications } from '@/hooks/platform/useWebSocketNotifications';
import { useConsultations } from '@/hooks/consulting/useConsultations';
import { usePpaContracts, useAllContractChanges } from '@/hooks/ppa/usePpa';
import { useVolumeContracts } from '@/hooks/lease/useLease';
import { useMyPlantIds } from '@/hooks/monitoring/useMyPlantFilter';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { useAssetStore } from '@/stores/useAssetStore';
import type { LucideIcon } from 'lucide-react';

/* ────────────────────────────────────────────────────────────────── */
/*  GNB menu data                                                    */
/* ────────────────────────────────────────────────────────────────── */

interface GnbChild {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
  subChildren?: GnbChild[];
  section?: string;
  badge?: number;
  menuCode?: string;
}

interface GnbItem {
  to: string;
  label: string;
  end?: boolean;
  icon?: LucideIcon;
  gnbIcon?: string;
  children?: GnbChild[];
  childrenByPersona?: Partial<Record<Persona, GnbChild[]>>;
  toByPersona?: Partial<Record<Persona, string>>;
  personas?: Persona[];
  external?: boolean;
  menuCode?: string;
}

/*
 * GNB·LNB 메뉴 — 근거: RMS_울산에자자 플랫폼 기능_사업계획서 3차년도 기준_v2.1_컨펌전 (3. WBS 시트)
 * 페르소나 3종: 전기사용자(consumer) · 발전사업자(generator) · 관리자(admin)
 * WBS 번호를 각 항목 주석에 표기. 라우트는 energy-v2-frontend 기존 화면에 매핑.
 */

// WBS 2.2 컨설팅 — 3개 페르소나 공통
const RE100_CONSULTING_CHILDREN: GnbChild[] = [
  { to: '/consulting', icon: Zap, label: '컨설팅 홈', section: '컨설팅', end: true }, // 2.2.1
  { to: '/consulting/status', icon: ClipboardList, label: '내 컨설팅', section: '컨설팅' }, // 2.2.2
  { to: '/consulting/diagnosis', icon: ClipboardCheck, label: '무료진단', section: '컨설팅', end: true }, // 2.2.3
  { to: '/ppa/documents/report', icon: FileText, label: '문서관리', section: '컨설팅' }, // 2.2.4 (컨설팅 완료 보고서)
  { to: '/re100/education', icon: MessageSquare, label: 'RE100 교육', section: '컨설팅' }, // 2.2.5
];

// WBS 3.x E-데이터마켓 — 3개 페르소나 공통
const EDATA_CHILDREN: GnbChild[] = [
  // 3.1 온실가스 인벤토리
  { to: '/e-data/inventory', icon: Factory, label: '배출시설 정보', section: '온실가스 인벤토리', end: true }, // 3.1.1
  { to: '/e-data/inventory/sources', icon: Database, label: '배출원 등록', section: '온실가스 인벤토리' }, // 3.1.2
  { to: '/e-data/inventory/factors', icon: Calculator, label: '배출계수 관리', section: '온실가스 인벤토리' }, // 3.1.3
  { to: '/e-data/inventory/calculation', icon: BarChart3, label: '배출량 산정', section: '온실가스 인벤토리' }, // 3.1.4
  { to: '/e-data/inventory/statement', icon: FileText, label: '명세서', section: '온실가스 인벤토리' }, // 3.1.5
  { to: '/e-data/inventory/disclosure', icon: ClipboardList, label: '보고서', section: '온실가스 인벤토리' }, // 3.1.6
  // 3.2 카본 마켓플레이스
  { to: '/carbon', icon: Leaf, label: '탄소배출권 정보', section: '카본 마켓플레이스', end: true }, // 3.2.1
  { to: '/carbon/krx', icon: TrendingUp, label: '탄소배출권 KRX 거래', section: '카본 마켓플레이스' }, // 3.2.2
  { to: '/carbon/otc', icon: ArrowRightLeft, label: '탄소배출권 장외거래', section: '카본 마켓플레이스' }, // 3.2.3
  { to: '/carbon/etrs', icon: Handshake, label: '탄소배출권 계약관리', section: '카본 마켓플레이스' }, // 3.2.4
  { to: '/carbon/offset', icon: Globe, label: '외부감축사업 정보', section: '카본 마켓플레이스' }, // 3.2.5
  { to: '/carbon/voluntary', icon: ClipboardCheck, label: '외부감축사업 보고서', section: '카본 마켓플레이스' }, // 3.2.6
  // 3.3 데이터 마켓플레이스
  { to: '/e-data/catalog', icon: Database, label: '데이터 등록/신청', section: '데이터 마켓플레이스' }, // 3.3.1
  { to: '/e-data/trading', icon: Receipt, label: '거래 현황', section: '데이터 마켓플레이스', end: true }, // 3.3.2
  { to: '/e-data/trading/settlement', icon: Wallet, label: '정산', section: '데이터 마켓플레이스' }, // 3.3.3
  { to: '/e-data/api-hub', icon: KeyRound, label: 'API 허브', section: '데이터 마켓플레이스' }, // 3.3.4
];

const GNB_ITEMS: GnbItem[] = [
  /* ══ ① 통합관제 CONTROL — WBS 1.x ══ */
  {
    to: '/dashboard',
    label: '통합관제',
    icon: Monitor,
    menuCode: 'CONTROL',
    personas: ['generator', 'consumer', 'admin'],
    toByPersona: { generator: '/dashboard', consumer: '/consumer', admin: '/monitoring' },
    childrenByPersona: {
      consumer: [
        { to: '/consumer', icon: LayoutDashboard, label: '대시보드', section: '실시간', end: true }, // 1.1.1
        { to: '/monitoring/plant', icon: Zap, label: '발전소 상세', section: '실시간' }, // 1.1.4
        { to: '/monitoring/anomalies', icon: AlertTriangle, label: '이상감지 관리', section: '실시간' }, // 1.1.5
        { to: '/control/disop', icon: ClipboardList, label: 'DiSOP', section: '안전·운영' }, // 1.2.1
        { to: '/dt', icon: Globe, label: '디지털트윈', section: 'DT' }, // 1.3.1
        { to: '/monitoring/reports', icon: BarChart3, label: '보고서', section: '보고' }, // 1.4.1
      ],
      generator: [
        { to: '/dashboard', icon: LayoutDashboard, label: '대시보드', section: '실시간', end: true }, // 1.1.1
        { to: '/monitoring/plant', icon: Zap, label: '발전소 상세', section: '실시간' }, // 1.1.4
        { to: '/monitoring/anomalies', icon: AlertTriangle, label: '이상감지 관리', section: '실시간' }, // 1.1.5
        { to: '/control/disop', icon: ClipboardList, label: 'DiSOP', section: '안전·운영' }, // 1.2.1
        { to: '/dt', icon: Globe, label: '디지털트윈', section: 'DT' }, // 1.3.1
        { to: '/monitoring/reports', icon: BarChart3, label: '보고서', section: '보고' }, // 1.4.1
      ],
      admin: [
        { to: '/platform', icon: LayoutDashboard, label: '대시보드', section: '실시간', end: true }, // 1.1.1
        { to: '/monitoring', icon: Monitor, label: '관제 홈(지도)', section: '실시간', end: true }, // 1.1.2
        { to: '/monitoring/plant', icon: Zap, label: '발전소 상세', section: '실시간' }, // 1.1.4
        { to: '/monitoring/anomalies', icon: AlertTriangle, label: '이상감지 관리', section: '실시간' }, // 1.1.5
        { to: '/control/disop', icon: ClipboardList, label: 'DiSOP', section: '안전·운영' }, // 1.2.1
        { to: '/dt', icon: Globe, label: '디지털트윈', section: 'DT' }, // 1.3.1
        { to: '/monitoring/reports', icon: BarChart3, label: '보고서', section: '보고' }, // 1.4.1
      ],
    },
  },
  /* ══ ② RE100 — WBS 2.x ══ */
  {
    to: '/re100',
    label: 'RE100',
    icon: Leaf,
    menuCode: 'RE100',
    personas: ['generator', 'consumer', 'admin'],
    toByPersona: { consumer: '/consulting', generator: '/generator/trading', admin: '/platform/trading' },
    childrenByPersona: {
      // 전기사용자: 2.2 컨설팅만
      consumer: RE100_CONSULTING_CHILDREN,
      generator: [
        // 2.1 전력거래
        { to: '/generator/trading', icon: ArrowRightLeft, label: '거래 신청', section: '전력거래' }, // 2.1.1
        { to: '/generator/ppa/contracts', icon: Handshake, label: '내 계약', section: '전력거래' }, // 2.1.2
        { to: '/ppa/contract-changes', icon: ClipboardList, label: '변경·해지', section: '전력거래' }, // 2.1.3
        { to: '/trading/history', icon: History, label: '거래 이력', section: '전력거래' }, // 2.1.4
        {
          to: '/generator/ppa/direct/revenue/analytics',
          icon: Receipt,
          label: '수익·정산',
          section: '전력거래',
          subChildren: [
            { to: '/generator/ppa/direct/revenue/analytics', icon: Receipt, label: '수익 분석', end: true },
            { to: '/generator/ppa/direct/revenue/tax-invoice', icon: FileText, label: '세금계산서' },
            { to: '/generator/ppa/direct/revenue/invoices', icon: CreditCard, label: '청구서' },
            { to: '/generator/ppa/revenue/deviation', icon: Activity, label: '발전량 편차' },
          ],
        }, // 2.1.5
        { to: '/generator/ppa/dashboard', icon: BarChart3, label: '계약 현황', section: '전력거래' }, // 2.1.6
        { to: '/platform/trading/approvals', icon: ShieldCheck, label: '거래 승인', section: '전력거래' }, // 2.1.7
        { to: '/generator/ppa/documents', icon: FileText, label: '문서 관리', section: '전력거래' }, // 2.1.8
        ...RE100_CONSULTING_CHILDREN,
      ],
      admin: [
        // 2.1 전력거래
        { to: '/platform/trading', icon: ArrowRightLeft, label: '거래 신청', section: '전력거래' }, // 2.1.1
        { to: '/platform/ppa/contracts', icon: Handshake, label: '내 계약', section: '전력거래' }, // 2.1.2
        { to: '/ppa/contract-changes', icon: ClipboardList, label: '변경·해지', section: '전력거래' }, // 2.1.3
        { to: '/trading/history', icon: History, label: '거래 이력', section: '전력거래' }, // 2.1.4
        {
          to: '/platform/ppa/billing/settlement',
          icon: Receipt,
          label: '수익·정산',
          section: '전력거래',
          subChildren: [
            { to: '/platform/ppa/billing/settlement', icon: Calculator, label: '정산', end: true },
            { to: '/platform/ppa/billing/settlement/payment', icon: CreditCard, label: '수금·지급' },
            { to: '/platform/ppa/billing/settlement/history', icon: History, label: '이력·감사' },
            { to: '/platform/ppa/billing/tax-invoice', icon: FileText, label: '세금계산서' },
          ],
        }, // 2.1.5
        { to: '/platform/ppa/dashboard', icon: BarChart3, label: '계약 현황', section: '전력거래' }, // 2.1.6
        { to: '/platform/trading/approvals', icon: ShieldCheck, label: '거래 승인', section: '전력거래' }, // 2.1.7
        { to: '/platform/ppa/documents', icon: FileText, label: '문서 관리', section: '전력거래' }, // 2.1.8
        ...RE100_CONSULTING_CHILDREN,
      ],
    },
  },
  /* ══ ③ E-데이터마켓 플랫폼 — WBS 3.x ══ */
  {
    to: '/e-data/inventory',
    label: 'E-데이터마켓',
    icon: Database,
    menuCode: 'EDATA',
    personas: ['generator', 'consumer', 'admin'],
    children: EDATA_CHILDREN,
  },
  /* ══ ⑤ 관리 ADMIN — WBS 4.x (설정은 공통, 회원·운영·시스템은 관리자) ══ */
  {
    to: '/org',
    label: '관리',
    icon: Settings,
    menuCode: 'ADMIN',
    personas: ['generator', 'consumer', 'admin'],
    toByPersona: { consumer: '/org', generator: '/org', admin: '/platform/companies' },
    childrenByPersona: {
      consumer: [{ to: '/org', icon: Settings, label: '설정', section: '설정' }], // 4.1.1
      generator: [{ to: '/org', icon: Settings, label: '설정', section: '설정' }], // 4.1.1
      admin: [
        { to: '/org', icon: Settings, label: '설정', section: '설정' }, // 4.1.1
        { to: '/platform/companies', icon: Building2, label: '기업 관리', section: '회원' }, // 4.2.1
        { to: '/platform/users', icon: Users, label: '회원 관리', section: '회원' }, // 4.2.2
        { to: '/platform/roles', icon: ShieldCheck, label: '역할·권한', section: '회원' }, // 4.2.3
        { to: '/platform/approvals', icon: ClipboardCheck, label: '승인 관리', section: '운영' }, // 4.3.1
        { to: '/platform/trading/approvals', icon: ShieldCheck, label: '거래 승인', section: '운영' }, // 4.3.2
        { to: '/platform/notification-settings', icon: Bell, label: '알림 설정', section: '시스템' }, // 4.4.1
      ],
    },
  },
];

function filterByPersona(items: GnbItem[], persona: Persona): GnbItem[] {
  return items.filter((item) => !item.personas || item.personas.includes(persona));
}

function filterByMenuPermission(items: GnbItem[], allowedCodes: Set<string> | null): GnbItem[] {
  if (!allowedCodes || allowedCodes.size === 0) return items;
  return items.filter((item) => !item.menuCode || allowedCodes.has(item.menuCode));
}

/* ────────────────────────────────────────────────────────────────── */
/*  Helpers                                                          */
/* ────────────────────────────────────────────────────────────────── */

const INDEPENDENT_ONLY_PATHS = [
  '/consultant/earnings',
  '/consultant/proposals',
  '/consultant/tax-invoices',
  '/consultant/referral',
];

function resolveChildren(
  item: GnbItem,
  persona: Persona,
  opts?: { isAgencyAffiliated?: boolean },
): GnbChild[] | undefined {
  const children = item.childrenByPersona?.[persona] ?? item.children;
  if (!children || !opts?.isAgencyAffiliated) return children;
  return children.filter((c) => !INDEPENDENT_ONLY_PATHS.includes(c.to));
}

function findActiveGnbItem(pathname: string, items: GnbItem[], persona: Persona): GnbItem | null {
  // Pass 0: exact toByPersona match (highest priority — resolves ambiguity
  // when multiple GNB items share children paths for the same persona)
  for (const item of items) {
    if (item.toByPersona?.[persona] && pathname === item.toByPersona[persona]) {
      return item;
    }
  }

  const sorted = [...items].sort((a, b) => b.to.length - a.to.length);

  // Pass 1a: 자식 정확 매치 — 동일 URL을 가진 자식 있으면 그 부모 GNB가 우선
  // (예: /consultant/proposals가 "컨설팅" 자식이면 "대시보드" 자식 /consultant보다 우선)
  for (const item of sorted) {
    const itemChildren = resolveChildren(item, persona);
    if (itemChildren?.some((c) => pathname === c.to || c.subChildren?.some((sc) => pathname === sc.to))) return item;
  }

  // Pass 1b: 자식 prefix 매치 — end:true 자식은 startsWith로 매치 안 함
  // (예: /consultant에 end:true → /consultant/proposals와는 매치 안 됨)
  for (const item of sorted) {
    const itemChildren = resolveChildren(item, persona);
    if (
      itemChildren?.some(
        (c) =>
          (!c.end && pathname.startsWith(c.to + '/')) ||
          c.subChildren?.some((sc) => !sc.end && pathname.startsWith(sc.to + '/')),
      )
    )
      return item;
  }

  // Pass 2: GNB 자체 to 매치 (자식에서 못 잡힌 경우 폴백)
  for (const item of sorted) {
    if (item.end && pathname === item.to) return item;
    if (!item.end && (pathname === item.to || pathname.startsWith(item.to + '/'))) return item;
  }

  return null;
}

/* ────────────────────────────────────────────────────────────────── */
/*  GNB Top Bar                                                      */
/* ────────────────────────────────────────────────────────────────── */

function GnbBar({
  activeGnbTo,
  items,
  persona,
  isMapMode = false,
}: {
  activeGnbTo: string | null;
  items: GnbItem[];
  persona: Persona;
  isMapMode?: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const signOut = useSignOut();

  const [gnbVisible, setGnbVisible] = useState(!isMapMode);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isMapMode) {
      setGnbVisible(true);
      return;
    }
    setGnbVisible(true);
    const initialTimer = setTimeout(() => setGnbVisible(false), 4000);

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY <= 20) {
        clearHideTimer();
        setGnbVisible(true);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      clearTimeout(initialTimer);
      window.removeEventListener('mousemove', handleMouseMove);
      clearHideTimer();
    };
  }, [isMapMode, clearHideTimer]);

  const handleHeaderMouseLeave = useCallback(() => {
    if (!isMapMode) return;
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => setGnbVisible(false), 300);
  }, [isMapMode, clearHideTimer]);

  const handleHeaderMouseEnter = useCallback(() => {
    if (!isMapMode) return;
    clearHideTimer();
    setGnbVisible(true);
  }, [isMapMode, clearHideTimer]);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 flex h-[100px] bg-[#000C17] shadow-[0_3px_12px_0_rgba(0,93,189,0.5)] transition-transform duration-700 ease-in-out',
        isMapMode && !gnbVisible && '-translate-y-full',
      )}
      onMouseEnter={handleHeaderMouseEnter}
      onMouseLeave={handleHeaderMouseLeave}
    >
      {/* Logo */}
      <button onClick={() => router.push('/')} className="flex items-center justify-center shrink-0 px-5">
        <Image src="/images/logo.png" alt="에너지 플랫폼" width={100} height={100} priority />
      </button>

      {/* Center: Nav */}
      <nav className="flex h-full flex-1 items-stretch justify-center" aria-label="메인 메뉴">
        {items.map((item) => {
          const isActive = activeGnbTo === item.to;
          const href = item.toByPersona?.[persona] ?? item.to;
          return (
            <Link
              key={item.to}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-2 min-w-[90px] px-4 text-[11px] tracking-wide font-medium transition-all duration-150 border-b-2 active:scale-95',
                isActive
                  ? 'bg-[#005DBD]/80 text-white font-bold border-[#4DA3FF]'
                  : 'text-white/60 hover:bg-[#00458C]/60 hover:text-white border-transparent',
              )}
            >
              <span
                className={cn('transition-all duration-300', isActive && 'drop-shadow-[0_0_6px_rgba(77,163,255,0.6)]')}
              >
                {item.gnbIcon ? (
                  <Image src={item.gnbIcon} alt="" width={28} height={28} />
                ) : (
                  item.icon && <item.icon size={28} className={item.external ? 'opacity-60' : ''} />
                )}
              </span>
              <span className="flex items-center gap-1">
                {item.label}
                {item.external && <ExternalLink size={9} className="opacity-40" />}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Right: User controls */}
      <div className="flex items-center gap-3 px-5 shrink-0">
        <NotificationBell />

        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white">
            {user?.name?.charAt(0) ?? <User size={14} />}
          </div>
          <div className="hidden flex-col gap-0.5 lg:flex">
            <span className="text-white text-xs font-medium">{user?.name ?? '사용자'}</span>
            <span className="text-white/40 text-[10px]">{user?.companyName ?? ''}</span>
          </div>
        </div>

        <button
          onClick={() => {
            signOut.mutate(undefined, {
              onSettled: () => {
                window.location.href = '/login';
              },
            });
          }}
          className="rounded-lg p-2.5 text-white/50 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150 active:scale-90"
          aria-label="로그아웃"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Sub-menu Sidebar                                                 */
/* ────────────────────────────────────────────────────────────────── */

function SidebarLink({ item, indent = false }: { item: GnbChild; indent?: boolean }) {
  const pathname = usePathname();
  const isActive = item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + '/');
  return (
    <Link
      href={item.to}
      className={cn(
        'relative flex items-center gap-3 rounded-lg py-2.5 text-sm transition-all duration-150 active:scale-[0.98]',
        indent ? 'pl-9 pr-3' : 'px-3',
        isActive ? 'bg-primary/10 text-primary font-medium' : 'text-slate-400 hover:text-white hover:bg-white/[0.06]',
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary animate-slideUp" />
      )}
      <item.icon size={16} className="shrink-0" />
      <span className="truncate">{item.label}</span>
      {item.badge ? (
        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shrink-0">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function ExpandableSidebarLink({
  item,
  expanded,
  onToggle,
}: {
  item: GnbChild;
  expanded: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const isActive =
    pathname === item.to ||
    pathname.startsWith(item.to + '/') ||
    !!item.subChildren?.some((sc) => pathname === sc.to || pathname.startsWith(sc.to + '/'));
  return (
    <div
      className={cn(
        'relative flex items-center rounded-lg text-sm transition-all duration-150 group active:scale-[0.98]',
        isActive ? 'bg-primary/10 text-primary font-medium' : 'text-slate-400 hover:bg-white/[0.06]',
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary animate-slideUp" />
      )}
      <Link
        href={item.to}
        className={cn('flex-1 flex items-center gap-3 px-3 py-2.5 min-w-0', !isActive && 'group-hover:text-white')}
      >
        <item.icon size={16} className="shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onToggle();
        }}
        aria-label={expanded ? '접기' : '펼치기'}
        aria-expanded={expanded}
        className={cn(
          'flex h-9 w-7 shrink-0 items-center justify-center rounded-r-lg transition-colors',
          isActive ? 'text-primary' : 'text-slate-500 hover:text-white',
        )}
      >
        <ChevronDown size={14} className={cn('transition-transform duration-200', !expanded && '-rotate-90')} />
      </button>
    </div>
  );
}

function computeAutoExpanded(items: GnbChild[], pathname: string): Set<string> {
  const set = new Set<string>();
  for (const item of items) {
    if (item.subChildren?.length) {
      const matches =
        pathname === item.to ||
        pathname.startsWith(item.to + '/') ||
        item.subChildren.some((sc) => pathname === sc.to || pathname.startsWith(sc.to + '/'));
      if (matches) set.add(item.to);
    }
  }
  return set;
}

function SubSidebar({ children: items }: { children: GnbChild[] }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Set<string>>(() => computeAutoExpanded(items, pathname));

  useEffect(() => {
    const auto = computeAutoExpanded(items, pathname);
    setExpanded((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const k of auto) {
        if (!next.has(k)) {
          next.add(k);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pathname, items]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const hasSections = items.some((item) => item.section);

  return (
    <aside className="fixed top-[100px] left-0 bottom-0 z-40 w-52 border-r border-white/[0.06] bg-[#000C17]/90 backdrop-blur-md overflow-y-auto flex flex-col">
      <nav className="py-3 px-2 space-y-0.5 flex-1">
        {items.map((item, idx) => {
          const showSection = hasSections && item.section && (idx === 0 || items[idx - 1]?.section !== item.section);

          const node = item.subChildren?.length ? (
            <div className="space-y-0.5">
              <ExpandableSidebarLink item={item} expanded={expanded.has(item.to)} onToggle={() => toggle(item.to)} />
              {expanded.has(item.to) && item.subChildren.map((sub) => <SidebarLink key={sub.to} item={sub} indent />)}
            </div>
          ) : (
            <SidebarLink item={item} />
          );

          return (
            <div key={item.to}>
              {showSection && (
                <div
                  className={cn(
                    'px-3 pb-1 text-[10px] font-medium tracking-wider text-slate-500 uppercase select-none',
                    idx > 0 && 'pt-4',
                  )}
                >
                  {item.section}
                </div>
              )}
              {node}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  AppLayout                                                        */
/* ────────────────────────────────────────────────────────────────── */

// /monitoring은 사이드바 노출 대상으로 전환(통합기획 doc 04 §1) — 지도는 콘텐츠 영역 안에 fixed 오프셋으로 렌더
const FULLSCREEN_MAP_PATHS = ['/dt', '/dt/info'];
// EDATA 경로(/carbon·/e-data·/e-data/inventory)는 표준 사이드바 레이아웃 편입 — embed는 콘텐츠 영역 안에서 렌더
const IFRAME_PATHS: string[] = []; // vpp iframe 폐기(doc 19 완전 통합) — 네이티브 라우트 전환 완료

const LEASE_CONTRACT_TYPES = new Set(['LEASE', 'SAVINGS_SHARE', 'FIXED_RENT']);
// 온사이트(구 Lease) 계약 메뉴 경로 — 섹션명이 '직접 PPA'로 통합되어 경로로 판별
const ONSITE_PATH_RE = /^\/(platform\/)?lease\//;

function isOnsiteChild(c: GnbChild): boolean {
  return ONSITE_PATH_RE.test(c.to) || (c.to.startsWith('/generator/ppa/revenue/') && !c.to.includes('/direct/'));
}

// RE100 기둥 '자가발전·PPA' 섹션에서 계약유형별 노출 제어.
// 온사이트(구 Lease) 항목은 온사이트 계약 보유 시만, 직접 PPA 전용 항목은 직접 계약 보유 시만.
// 공통·컨설팅·수용가 항목은 항상 노출.
const DIRECT_ONLY_PATH_RE =
  /^\/(ppa\/(status|billing|documents)|platform\/ppa\/(status|billing|documents)|generator\/ppa\/direct)/;
function filterChildrenByContractType(children: GnbChild[], hasLease: boolean, hasDirect: boolean): GnbChild[] {
  return children.filter((c) => {
    if (isOnsiteChild(c)) return hasLease;
    if (DIRECT_ONLY_PATH_RE.test(c.to)) return hasDirect;
    return true;
  });
}

function PageTransition({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const [visible, setVisible] = useState(false);
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (prevPath.current !== pathname) {
      setVisible(false);
      prevPath.current = pathname;
    }
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return (
    <div className={cn('transition-opacity duration-300 ease-out', visible ? 'opacity-100' : 'opacity-0')}>
      {children}
    </div>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const overrideVal = usePersonaOverride((s) => s.override);
  const persona = overrideVal ?? getPersona(user);

  const { data: meData } = useMe();
  const markAuthenticated = useAuthStore((s) => s.markAuthenticated);
  useEffect(() => {
    if (meData) {
      markAuthenticated();
      if (!user || user.id !== meData.id) {
        setUser(meData);
      }
    }
  }, [meData, user, setUser, markAuthenticated]);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  // POC 인증 가드 — localStorage 복원 후 로그인 정보가 없으면 /login 으로 이동 (middleware 대체)
  const authHydrated = useAuthStore((s) => s.hydrated);
  const router = useRouter();
  useEffect(() => {
    if (authHydrated && !user) router.replace('/login');
  }, [authHydrated, user, router]);

  // Auto-complete onboarding & asset registration for all personas on login
  useEffect(() => {
    if (!user) return;
    const onboarding = useOnboardingStore.getState();
    const asset = useAssetStore.getState();
    onboarding.hydrate();
    asset.hydrate();
    const personas: Array<'generator' | 'consumer' | 'consultant' | 'admin' | 'spc'> = [
      'generator',
      'consumer',
      'consultant',
      'admin',
      'spc',
    ];
    for (const p of personas) {
      if (!onboarding.isCompleted(p)) onboarding.complete(p);
      if (!asset.isRegistered(p)) asset.register(p);
    }
  }, [user]);

  const { data: contractsData } = usePpaContracts();
  const { data: leaseData } = useVolumeContracts();
  const { hasLease, hasDirect } = useMemo(() => {
    const ppaContracts = (contractsData as any)?.content ?? [];
    const leaseContracts = (leaseData as any)?.content ?? (Array.isArray(leaseData) ? leaseData : []);
    const activeLeases = leaseContracts.filter((c: any) => c.status === 'ACTIVE');
    const activePpa = ppaContracts.filter((c: any) => c.status !== 'TERMINATED' && c.status !== 'CANCELLED');
    if (activePpa.length === 0 && activeLeases.length === 0) return { hasLease: true, hasDirect: true };
    let lease = activeLeases.length > 0;
    let direct = false;
    for (const c of activePpa) {
      if (LEASE_CONTRACT_TYPES.has(c.contractType)) lease = true;
      else direct = true;
    }
    return { hasLease: lease, hasDirect: direct };
  }, [contractsData, leaseData]);

  const { hasPlants: generatorHasPlants } = useMyPlantIds();
  const { data: myMenuCodes } = useMyMenus();
  const allowedMenus = useMemo(() => {
    if (!myMenuCodes || myMenuCodes.length === 0) return null;
    return new Set(myMenuCodes);
  }, [myMenuCodes]);
  const visibleItems = useMemo(() => {
    let items = filterByPersona(GNB_ITEMS, persona);
    items = filterByMenuPermission(items, allowedMenus);
    if (persona === 'generator' && !generatorHasPlants) {
      items = items.filter((item) => item.label !== '통합관제');
    }
    return items;
  }, [persona, generatorHasPlants, allowedMenus]);
  const activeGnb = useMemo(
    () => findActiveGnbItem(pathname, visibleItems, persona),
    [pathname, visibleItems, persona],
  );
  const isAgencyAffiliated = persona === 'consultant' && !!user?.agencyId;
  const rawResolvedChildren = activeGnb ? resolveChildren(activeGnb, persona, { isAgencyAffiliated }) : undefined;
  // 자식 레벨 권한 필터 — menuCode 있는 항목은 depth1 권한(role_menus) 보유 시에만 노출 (빈 권한 집합=전체 허용은 기둥 필터와 동일 규칙)
  const resolvedChildren = useMemo(
    () => rawResolvedChildren?.filter((c) => !c.menuCode || !allowedMenus || allowedMenus.has(c.menuCode)),
    [rawResolvedChildren, allowedMenus],
  );
  const { data: consultationsData } = useConsultations(undefined, {
    enabled: persona === 'consultant',
  });
  const pendingRequestCount = useMemo(() => {
    if (persona !== 'consultant') return 0;
    const list = (consultationsData as any)?.content ?? [];
    return list.filter((c: any) => c.status === 'APPLIED' && !c.consultantId).length;
  }, [consultationsData, persona]);
  // 변경·해지 신규(REQUESTED) 건수 — LNB 알림 뱃지 (회사 스코프 자동)
  const { data: changesData } = useAllContractChanges();
  const pendingChangeCount = useMemo(() => {
    const list = ((changesData as any) ?? []) as any[];
    return (Array.isArray(list) ? list : []).filter((c) => c.status === 'REQUESTED').length;
  }, [changesData]);
  const activeChildren = useMemo(() => {
    if (!resolvedChildren) return undefined;
    const isTradingGnb = activeGnb?.menuCode === 'RE100';
    let children = resolvedChildren;
    if (isTradingGnb && persona !== 'admin') {
      children = filterChildrenByContractType(children, hasLease, hasDirect);
    }
    if (persona === 'consultant' && pendingRequestCount > 0) {
      children = children.map((c) =>
        c.to === '/consulting/consulting-requests' ? { ...c, badge: pendingRequestCount } : c,
      );
    }
    if (pendingChangeCount > 0) {
      children = children.map((c) => (c.to === '/ppa/contract-changes' ? { ...c, badge: pendingChangeCount } : c));
    }
    return children;
  }, [resolvedChildren, activeGnb, hasLease, hasDirect, persona, pendingRequestCount, pendingChangeCount]);
  const hasSidebar = !!activeChildren && activeChildren.length > 0;
  const isFullscreenMap = FULLSCREEN_MAP_PATHS.includes(pathname);
  const isIframe = IFRAME_PATHS.includes(pathname);

  if (!hydrated || !authHydrated || !user) {
    return <div className="min-h-screen bg-surface-dark bg-[url('/images/bg.jpg')] bg-cover bg-fixed bg-center" />;
  }

  return (
    <div className="min-h-screen bg-surface-dark bg-[url('/images/bg.jpg')] bg-cover bg-fixed bg-center">
      <GnbBar activeGnbTo={activeGnb?.to ?? null} items={visibleItems} persona={persona} isMapMode={isFullscreenMap} />

      {hasSidebar && !isFullscreenMap && !isIframe && <SubSidebar>{activeChildren!}</SubSidebar>}

      <div
        className={cn(
          '',
          isFullscreenMap ? 'pt-0' : 'pt-[100px]',
          hasSidebar && !isFullscreenMap && !isIframe ? 'pl-52' : '',
        )}
      >
        <PageTransition pathname={pathname}>
          {isFullscreenMap ? (
            children
          ) : isIframe ? (
            <div className="p-6 max-w-7xl mx-auto">{children}</div>
          ) : (
            <main className="p-6 max-w-7xl mx-auto">{children}</main>
          )}
        </PageTransition>
      </div>

      <ToastContainer />
    </div>
  );
}

const NOTIF_ICON_MAP: Record<string, { icon: LucideIcon; color: string }> = {
  ANOMALY_DETECTED: { icon: AlertTriangle, color: 'text-red-400' },
  ANOMALY_ACKNOWLEDGED: { icon: AlertTriangle, color: 'text-amber-400' },
  ANOMALY_WORK_STARTED: { icon: Activity, color: 'text-amber-400' },
  ANOMALY_RESOLVED: { icon: ShieldCheck, color: 'text-emerald-400' },
  ANOMALY_FALSE_ALARM: { icon: ShieldCheck, color: 'text-slate-400' },
  ANOMALY_ESCALATED: { icon: AlertTriangle, color: 'text-red-500' },
  DETECTION_RESOLVED: { icon: Cpu, color: 'text-emerald-400' },
  OPERATOR_ACKNOWLEDGED: { icon: Monitor, color: 'text-sky-400' },
  OPERATOR_ACTION_REPORTED: { icon: ClipboardCheck, color: 'text-sky-400' },
  SUPPLY_DEMAND_ALERT: { icon: Zap, color: 'text-amber-400' },
  DAILY_REPORT_GENERATED: { icon: FileText, color: 'text-slate-400' },
  PPA_CONTRACT_CREATED: { icon: Handshake, color: 'text-sky-400' },
  PPA_CONTRACT_ACTIVATED: { icon: Handshake, color: 'text-emerald-400' },
  PPA_CONTRACT_TERMINATED: { icon: Handshake, color: 'text-red-400' },
  PPA_CONTRACT_ISSUED: { icon: FileText, color: 'text-sky-400' },
  TRADING_LEASE_PROPOSAL_CREATED: { icon: ScrollText, color: 'text-sky-400' },
  TRADING_LEASE_PROPOSAL_AGREED: { icon: Handshake, color: 'text-emerald-400' },
  PPA_CONTRACT_CHANGE_REQUESTED: { icon: Handshake, color: 'text-amber-400' },
  PPA_CONTRACT_CHANGE_APPROVED: { icon: Handshake, color: 'text-emerald-400' },
  PPA_CONTRACT_CHANGE_REJECTED: { icon: Handshake, color: 'text-red-400' },
  PPA_GENERATOR_APPROVAL_REQUESTED: { icon: Factory, color: 'text-amber-400' },
  PPA_GENERATOR_APPROVAL_COMPLETED: { icon: Factory, color: 'text-emerald-400' },
  PPA_GENERATOR_APPROVAL_REJECTED: { icon: Factory, color: 'text-red-400' },
  SETTLEMENT_CONFIRMED: { icon: Calculator, color: 'text-emerald-400' },
  SETTLEMENT_DISPUTED: { icon: Calculator, color: 'text-red-400' },
  SETTLEMENT_REVIEW_STARTED: { icon: Calculator, color: 'text-amber-400' },
  SETTLEMENT_ADJUSTED: { icon: Calculator, color: 'text-sky-400' },
  SETTLEMENT_RECONFIRMED: { icon: Calculator, color: 'text-emerald-400' },
  INVOICE_ISSUED: { icon: Receipt, color: 'text-sky-400' },
  INVOICE_PAID: { icon: CreditCard, color: 'text-emerald-400' },
  TRADING_REQUEST_CREATED: { icon: ArrowRightLeft, color: 'text-sky-400' },
  TRADING_REQUEST_UPDATED: { icon: ArrowRightLeft, color: 'text-amber-400' },
  TRADING_REQUEST_DELETED: { icon: ArrowRightLeft, color: 'text-red-400' },
  TRADING_REQUEST_STATUS_CHANGED: { icon: ArrowRightLeft, color: 'text-amber-400' },
  MATCH_CREATED: { icon: Link2, color: 'text-sky-400' },
  MATCH_GENERATOR_ACCEPTED: { icon: Link2, color: 'text-amber-400' },
  MATCH_ACCEPTED: { icon: Link2, color: 'text-emerald-400' },
  MATCH_DECLINED: { icon: Link2, color: 'text-red-400' },
  CONSULTATION_CREATED: { icon: MessageSquare, color: 'text-sky-400' },
  CONSULTANT_ASSIGNED: { icon: Users, color: 'text-sky-400' },
  CONSULTATION_COMPLETED: { icon: MessageSquare, color: 'text-emerald-400' },
  CONSULTATION_CANCELLED: { icon: MessageSquare, color: 'text-red-400' },
  PROPOSAL_CREATED: { icon: ScrollText, color: 'text-sky-400' },
  PROPOSAL_ACCEPTED: { icon: ScrollText, color: 'text-emerald-400' },
  PROPOSAL_DECLINED: { icon: ScrollText, color: 'text-red-400' },
  REPORT_SUBMITTED: { icon: FileText, color: 'text-sky-400' },
  REPORT_APPROVED: { icon: FileText, color: 'text-emerald-400' },
  REPORT_SPC_REVIEW_REQUESTED: { icon: FileText, color: 'text-amber-400' },
  REPORT_SPC_APPROVED: { icon: FileText, color: 'text-emerald-400' },
  REPORT_COMMENT_ADDED: { icon: MessageSquare, color: 'text-slate-300' },
  CONSULTING_SETTLEMENT_APPROVED: { icon: Wallet, color: 'text-emerald-400' },
  CONSULTING_SETTLEMENT_PAID: { icon: Wallet, color: 'text-emerald-400' },
  CONSULTING_INVOICE_ISSUED: { icon: Receipt, color: 'text-sky-400' },
  REVIEW_CREATED: { icon: ClipboardList, color: 'text-sky-400' },
  MILESTONE_CREATED: { icon: Target, color: 'text-sky-400' },
  MILESTONE_STARTED: { icon: Target, color: 'text-amber-400' },
  MILESTONE_COMPLETED: { icon: Target, color: 'text-emerald-400' },
  SCHEDULE_REQUESTED: { icon: History, color: 'text-sky-400' },
  SCHEDULE_CONFIRMED: { icon: History, color: 'text-emerald-400' },
  SCHEDULE_CANCELLED: { icon: History, color: 'text-red-400' },
  SCHEDULE_ACCEPTED: { icon: History, color: 'text-emerald-400' },
  SCHEDULE_REJECTED: { icon: History, color: 'text-red-400' },
  SCHEDULE_RESCHEDULE_REQUESTED: { icon: History, color: 'text-amber-400' },
  CHAT_MESSAGE_SENT: { icon: Send, color: 'text-sky-400' },
  SURVEY_SUBMITTED: { icon: ClipboardList, color: 'text-sky-400' },
  REFERRAL_CREATED: { icon: Users, color: 'text-sky-400' },
  CONTRACT_SIGNED: { icon: KeyRound, color: 'text-emerald-400' },
  LEASE_CONTRACT_CREATED: { icon: Coins, color: 'text-sky-400' },
  LEASE_TERMINATED: { icon: Coins, color: 'text-red-400' },
  LEASE_INVOICE_ISSUED: { icon: Receipt, color: 'text-sky-400' },
  LEASE_INVOICE_PAID: { icon: CreditCard, color: 'text-emerald-400' },
  LEASE_INVOICE_DISPUTED: { icon: Receipt, color: 'text-red-400' },
  LEASE_REQUEST_SUBMITTED: { icon: Coins, color: 'text-sky-400' },
  LEASE_REQUEST_ACCEPTED: { icon: Coins, color: 'text-emerald-400' },
  LEASE_EQUIPMENT_REGISTERED: { icon: Cpu, color: 'text-sky-400' },
  LEASE_RECOVERY_SCHEDULED: { icon: Coins, color: 'text-amber-400' },
  LEASE_RECOVERY_COMPLETED: { icon: Coins, color: 'text-emerald-400' },
  LEASE_WARRANTY_WARNING: { icon: AlertTriangle, color: 'text-amber-400' },
  LEASE_INSURANCE_EXPIRED: { icon: AlertTriangle, color: 'text-red-400' },
  ONBOARDING_STARTED: { icon: LayoutDashboard, color: 'text-sky-400' },
  ONBOARDING_STEP_SUBMITTED: { icon: LayoutDashboard, color: 'text-sky-400' },
  ONBOARDING_STEP_APPROVED: { icon: LayoutDashboard, color: 'text-emerald-400' },
  ONBOARDING_STEP_REJECTED: { icon: LayoutDashboard, color: 'text-red-400' },
  ONBOARDING_COMPLETED: { icon: LayoutDashboard, color: 'text-emerald-400' },
  KPX_FORECAST_SUBMITTED: { icon: TrendingUp, color: 'text-sky-400' },
  DAILY_AGGREGATION_COMPLETED: { icon: Database, color: 'text-slate-400' },
};

// 알림 클릭 목적지 — 페르소나별로 올바른 화면으로 라우팅한다.
// (백엔드 link 포맷 "/{linkType}/{linkId}" — trading-request/trading-match/ppa-contract/ppa-contract-change 등)
function getNotifLink(n: { type: string; link?: string }, persona: Persona): string | null {
  const isSpcLike = persona === 'spc' || persona === 'admin';
  const isGen = persona === 'generator';
  // 페르소나별 거래/계약 목적지
  const dealOrTrading = (id: string) => (isSpcLike ? '/platform/trading' : `/trading/deal/${id}`);
  const tradeList = isSpcLike ? '/platform/trading' : isGen ? '/generator/trading' : '/ppa/trading';
  const myContracts = isSpcLike ? '/platform/ppa/dashboard' : isGen ? '/generator/ppa/contracts' : '/ppa/contracts';
  const settlement = isSpcLike
    ? '/platform/ppa/billing/settlement'
    : isGen
      ? '/generator/ppa/revenue/analytics'
      : '/ppa/billing/settlement';

  if (n.link) {
    const m = n.link.match(/^\/([a-z-]+)\/(\d+)$/);
    const type = m?.[1];
    const id = m?.[2];
    if (type && id) {
      switch (type) {
        case 'trading-request':
          return dealOrTrading(id); // linkId=requestId → 당사자는 거래 상세
        case 'trading-match':
          return tradeList; // linkId=matchId(거래상세 키는 requestId) → 페르소나 거래 목록
        case 'ppa-contract':
          return myContracts;
        case 'ppa-contract-change':
          return '/ppa/contract-changes'; // 변경·해지 전용 화면 (전 페르소나 공통)
        case 'contract':
          return isSpcLike ? '/platform/ppa/status' : myContracts;
        case 'consultation':
        case 'consultation-report':
        case 'consultation-schedule':
          return '/consulting';
        case 'anomaly':
          return '/monitoring/anomalies';
        case 'lease-contract':
        case 'lease-request':
          return isSpcLike ? '/platform/lease/dashboard' : '/lease/dashboard';
        case 'diagnosis':
          return '/consulting/diagnosis';
        case 'onboarding':
        case 'onboarding-step':
          return '/platform/onboarding';
        case 'proposal':
          return '/consultant/proposals';
      }
    }
    return n.link;
  }
  // link 필드가 없는 알림 — 타입 prefix 폴백 (거래/계약은 페르소나 인지)
  const t = n.type;
  if (t.startsWith('ANOMALY') || t.startsWith('DETECTION') || t.startsWith('OPERATOR') || t === 'SUPPLY_DEMAND_ALERT')
    return '/monitoring/anomalies';
  if (t.startsWith('PPA_CONTRACT_CHANGE') || t.startsWith('PPA_GENERATOR_APPROVAL')) return '/ppa/contract-changes';
  if (t === 'CONTRACT_SIGNED' || t.startsWith('PPA_CONTRACT'))
    return isSpcLike ? '/platform/ppa/dashboard' : myContracts;
  if (t.startsWith('SETTLEMENT') || t === 'INVOICE_ISSUED' || t === 'INVOICE_PAID') return settlement;
  if (t.startsWith('TRADING') || t.startsWith('MATCH')) return tradeList;
  if (
    t.startsWith('CONSULTATION') ||
    t.startsWith('CONSULTANT') ||
    t.startsWith('PROPOSAL') ||
    t.startsWith('REPORT') ||
    t.startsWith('MILESTONE') ||
    t.startsWith('SCHEDULE') ||
    t.startsWith('CONSULTING') ||
    t === 'REVIEW_CREATED' ||
    t === 'CHAT_MESSAGE_SENT' ||
    t === 'SURVEY_SUBMITTED' ||
    t === 'REFERRAL_CREATED'
  )
    return '/consulting';
  if (t.startsWith('LEASE')) return isSpcLike ? '/platform/lease/dashboard' : '/lease/dashboard';
  if (t.startsWith('ONBOARDING')) return '/platform/onboarding';
  return null;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR');
}

function NotificationBell() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const overrideVal = usePersonaOverride((s) => s.override);
  const persona = overrideVal ?? getPersona(user);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unreadQuery = useUnreadCount();
  const unread = (unreadQuery.data as number) ?? 0;
  const listQuery = useNotifications({ size: 20 });
  // 확인(읽음)한 알림은 목록에서 제외 — 미확인 알림만 노출
  const items = ((listQuery.data as any)?.content ?? []).filter((n: any) => !n.isRead);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  useWebSocketNotifications();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClick = (n: any) => {
    if (!n.isRead) markRead.mutate(n.id);
    const link = getNotifLink(n, persona);
    if (link) {
      setOpen(false);
      router.push(link);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        className="relative rounded-lg p-2.5 text-white/50 hover:bg-white/[0.06] hover:text-white transition-all duration-150 active:scale-90"
        aria-label="알림"
        onClick={() => setOpen(!open)}
      >
        <Bell size={18} className={cn(unread > 0 && 'animate-wiggle')} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white animate-fadeIn">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 rounded-xl border border-white/[0.08] bg-[#0d1520] shadow-elevation-3 z-50 overflow-hidden animate-slideDown">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-semibold text-white">알림</span>
            {unread > 0 && (
              <button className="text-xs text-sky-400 hover:text-sky-300" onClick={() => markAllRead.mutate()}>
                모두 읽음
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-white/[0.04]">
            {items.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">알림이 없습니다</div>
            ) : (
              items.map((n: any) => {
                const iconConfig = NOTIF_ICON_MAP[n.type] ?? { icon: Bell, color: 'text-slate-400' };
                const Icon = iconConfig.icon;
                const link = getNotifLink(n, persona);
                return (
                  <button
                    key={n.id}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors',
                      !n.isRead && 'bg-sky-500/[0.04]',
                      link && 'cursor-pointer',
                    )}
                    onClick={() => handleClick(n)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('mt-0.5 shrink-0', iconConfig.color)}>
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-white truncate flex-1">{n.title}</p>
                          {!n.isRead && <span className="h-2 w-2 rounded-full bg-sky-400 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-slate-600 mt-1">
                          {n.createdAt ? formatTimeAgo(n.createdAt) : ''}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
