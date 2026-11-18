/**
 * RE100 웹 알림 목업 — 거래 이력 · 거래 승인 · 변경·해지의 데모 건마다 그 상태가 될 때 왔을 알림을 하나씩 만든다(2026-11-18 사용자: 모든 경우를 알림에서 눌러 확인).
 * 목록의 줄과 종의 알림이 1:1로 맞는다. 데모 데이터(useTradingPocStore)에서 바로 만들어서, 화면에서 상태를 바꾸면 알림도 따라간다.
 *
 * 내용 = 보낸 쪽 → 받는 쪽 : (계약 유형) 할 일. 꼬리 ', 확인'은 받은 쪽이 할 차례인 알림에만 — 보는 사람이 보낸 쪽이면 fixtures 가 '대기'로 바꾼다.
 * 변경 · 해지는 알림 이름에 자가소비 / PPA 가 없어 내용에 붙인다(한일튜브처럼 계약이 둘인 기업 구분).
 */
import { useTradingPocStore } from '@/stores/useTradingPocStore';
import { changeStateOf, changeTypeLabel } from '@/components/features/trading-poc/meta';
import type { Contract, ContractChange, TradeRequest } from '@/types/trading-poc';

export interface GenNotif {
  id: number;
  type: string;
  message: string;
  /** 목록 주소 뒤에 붙일 그 건 */
  link: string;
  createdAt: string;
  /** 이 알림에 걸린 기업 — 발전사업자 계정(한일튜브)은 자기 기업 건만 */
  companyId: number;
}

const kindOf = (k: string) => (k === 'ONSITE' ? 'PPA' : '자가소비');
const kw = (n: number) => `${n} kW`;
const lastAt = (events?: { at: string }[], fallback = '') => (events?.length ? events[events.length - 1]!.at : fallback);
const SIGNED_NEW_DAYS = 7;

/** 거래 — 신청 · 조건 확정 / 조건 변경 · 전자서명 · 승인(신규만) · 반려 */
function fromRequest(r: TradeRequest, contracts: Contract[]): Omit<GenNotif, 'id'>[] {
  const pre = r.kind === 'ONSITE' ? 'TRADING_PPA_' : 'TRADING_SELF_';
  const co = r.consumerCompanyName;
  const at = lastAt(r.events, r.updatedAt);
  const link = `/view?id=${r.id}`;
  const base = { link, createdAt: at, companyId: r.consumerCompanyId };
  if (r.status === 'SUBMITTED') {
    if (r.applicant === 'spc') return []; // 관리자가 대신 신청한 건은 관리자에게 알리지 않는다
    return [{ ...base, type: `${pre}RECEIVED`, message: `${co} → 관리자 : ${kw(r.capacityKw)} 신청` }];
  }
  if (r.status === 'REVIEW' && r.termsConfirmedAt) {
    const byAdmin = (r.termsConfirmedBy ?? 'spc') === 'spc';
    const [from, to] = byAdmin ? ['관리자', co] : [co, '관리자'];
    const changed = !!r.termsBeforeCancel;
    return [{ ...base, createdAt: r.termsConfirmedAt, type: `${pre}${changed ? 'UNCONFIRMED' : 'TERMS'}`, message: `${from} → ${to} : ${kw(r.capacityKw)} ${changed ? '조건 변경' : '조건 확정'}, 확인` }];
  }
  if (r.status === 'APPROVED') {
    const c = contracts.find((x) => x.id === r.contractId);
    if (!c || c.signedByGenerator === c.signedByConsumer) return []; // 한쪽만 서명했을 때 — 서명 안 한 쪽에 서명 요청
    const [from, to] = c.signedByGenerator ? ['관리자', co] : [co, '관리자'];
    return [{ ...base, type: `${pre}SIGN`, message: `${from} → ${to} : ${kw(r.capacityKw)} 전자서명, 확인` }];
  }
  if (r.status === 'SIGNED') {
    const c = contracts.find((x) => x.id === r.contractId);
    const signedAt = c?.signedAt ?? r.updatedAt;
    if (Date.now() - new Date(signedAt).getTime() > SIGNED_NEW_DAYS * 86_400_000) return []; // 승인 알림은 신규(7일 안)만
    return [{ ...base, link: `/view?id=${r.id}`, createdAt: signedAt, type: `${pre}APPROVED`, message: `관리자 → ${co} : ${kw(r.capacityKw)} 승인` }];
  }
  if (r.status === 'REJECTED' || r.status === 'CANCELLED') {
    const e = [...r.events].reverse().find((x) => x.label === '반려');
    const byAdmin = !e || e.by === 'spc';
    const [from, to] = byAdmin ? ['관리자', co] : [co, '관리자'];
    return [{ ...base, type: `${pre}REJECTED`, message: `${from} → ${to} : ${kw(r.capacityKw)} 반려` }];
  }
  return [];
}

/** 변경 · 해지 — 신청 · 변경 동의 / 해지 동의 · 변경 조건 확정 · 전자서명 · 승인 / 해지 승인 · 반려 */
function fromChange(ch: ContractChange, contracts: Contract[]): Omit<GenNotif, 'id'>[] {
  const c = contracts.find((x) => x.id === ch.contractId);
  if (!c) return [];
  const term = ch.type === 'TERMINATE';
  const pre = term ? 'PPA_CONTRACT_TERMINATION_' : 'PPA_CONTRACT_CHANGE_';
  const co = c.consumerCompanyName;
  const what = term ? `${kindOf(c.kind)} 해지` : `${kindOf(c.kind)} ${changeTypeLabel(ch.type, c.kind)}`;
  const reqAdmin = ch.requestedBy === 'spc';
  const [req, recv] = reqAdmin ? ['관리자', co] : [co, '관리자'];
  const base = { link: `/view?id=${ch.id}`, createdAt: lastAt(ch.events, ch.requestedAt), companyId: c.consumerCompanyId };
  const st = changeStateOf(ch);
  const out: Omit<GenNotif, 'id'>[] = [];
  if (st === '신청') out.push({ ...base, createdAt: ch.requestedAt, type: `${pre}REQUEST`, message: `${req} → ${recv} : ${what} 신청` }); // 신청은 거래 신청처럼 꼬리 없이
  // 조건 입력 — 받는 쪽이 변경 동의함(이제 관리자가 조건을 쓴다)
  if (st === '조건 입력') out.push({ ...base, type: `${pre}AGREED`, message: `${recv} → ${req} : ${what} 동의` });
  // 조건 동의 — 관리자가 조건을 확정해 상대가 동의할 차례
  if (st === '조건 동의') out.push({ ...base, type: 'PPA_CONTRACT_CHANGE_TERMS', message: `관리자 → ${co} : ${what} 조건 확정, 확인` });
  if (st === '전자서명') {
    // 해지 — 받는 쪽이 해지 동의한 뒤 서명이 시작된다
    if (term) {
      const agreed = (ch.events ?? []).find((e) => e.label === '해지 동의');
      if (agreed) out.push({ ...base, createdAt: agreed.at, type: `${pre}AGREED`, message: `${recv} → ${req} : ${what} 동의` });
    }
    if (!!ch.spcSign !== !!ch.companySign) {
      const [from, to] = ch.spcSign ? ['관리자', co] : [co, '관리자'];
      out.push({ ...base, type: `${pre}SIGN`, message: `${from} → ${to} : ${what} 전자서명, 확인` });
    }
  }
  if (st === '승인') out.push({ ...base, type: `${pre}APPROVED`, message: `관리자 → ${co} : ${what} 승인` });
  if (st === '해지') out.push({ ...base, type: `${pre}APPROVED`, message: `관리자 → ${co} : ${what} 승인` });
  if (st === '반려') {
    const e = [...(ch.events ?? [])].reverse().find((x) => x.label === '반려');
    const byAdmin = !e || e.by === 'spc';
    const [from, to] = byAdmin ? ['관리자', co] : [co, '관리자'];
    out.push({ ...base, type: `${pre}REJECTED`, message: `${from} → ${to} : ${what} 반려` });
  }
  return out;
}

/** 알림 id — 데모 건과 알림 종류로 정해진다(읽음 표시가 다시 만들어도 유지되게) */
const idOf = (kind: 1 | 2, rowId: number, type: string) => {
  let h = 0;
  for (const ch of type) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return 100_000 + kind * 100_000 + rowId * 1000 + h;
};

export function buildRe100Notifications(): GenNotif[] {
  const s = useTradingPocStore.getState();
  const out: GenNotif[] = [];
  for (const r of s.requests) fromRequest(r, s.contracts).forEach((n) => out.push({ ...n, id: idOf(1, r.id, n.type) }));
  for (const ch of s.changes) fromChange(ch, s.contracts).forEach((n) => out.push({ ...n, id: idOf(2, ch.id, n.type) }));
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
