'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Send } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { CONSUMERS, CO, useTradingPocStore } from '@/stores/useTradingPocStore';
import type { PlantContractKind } from '@/types/monitoring';
import { useTradingRole } from './useTradingRole';
import { fmtKw, kindLabel } from './meta';
import { TEXT_MAX, localToday } from './Bits';

/** 입력 제한 — 기업명 · 기업 주소는 무료진단과 같은 최대값 */
const LIMIT = {
  company: [2, 50],
  address: [5, 100],
  capacity: [1, 10_000], // kW — 산단 지붕 태양광 기준
  name: [2, 20],
  phone: [9, 13], // 하이픈 포함 글자 수
  email: 100,
  note: TEXT_MAX,
} as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const lenOk = (v: string, [lo, hi]: readonly [number, number]) => v.trim().length >= lo && v.trim().length <= hi;
/** 용량 — 숫자와 점 하나, 소수 둘째 자리까지. 최대값을 넘으면 최대값으로 */
const capInput = (raw: string) => {
  let v = raw.replace(/[^0-9.]/g, '');
  const dot = v.indexOf('.');
  if (dot >= 0) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  return Number(v) > LIMIT.capacity[1] ? String(LIMIT.capacity[1]) : v;
};
/** 연락처 — 숫자와 하이픈만 */
const phoneInput = (raw: string) => raw.replace(/[^0-9-]/g, '').slice(0, LIMIT.phone[1]);

/** 계약 유형 카드 — 전기사용자가 얻는 것(장점)과 참고할 것 */
const KIND_CARDS: { value: PlantContractKind; title: string; headline: string; points: string[]; note: string }[] = [
  {
    value: 'SELF_CONSUMPTION',
    title: '자가소비',
    headline: '내 설비로 만든 전기를 직접 써서 한전 요금 절감',
    points: [
      '내 지붕 태양광 전기를 직접 사용 — 한전 전기요금 절감',
      '발전량 · 절감액을 플랫폼에서 실시간 확인',
      '설비는 기업 소유 · O&M 포함',
    ],
    note: '설치비는 기업 부담',
  },
  {
    value: 'ONSITE',
    title: 'PPA',
    headline: '초기 비용 0원, 한전보다 낮은 단가로 절감',
    points: [
      '초기 비용 0원 · 설치비는 EPC 부담',
      '사용분은 PPA 단가로 지급 — 한전보다 낮은 단가로 절감',
      '발전량 · 절감액을 플랫폼에서 실시간 확인',
    ],
    note: '쓴 만큼 사용료(한전보다 낮은 단가) · 20년 장기 계약',
  },
];

/** 카드 색 — 자가소비 보라 · onsite 파랑 (제목 글자 · 신청 버튼 · 선택 테두리) */
const KIND_TONE: Record<PlantContractKind, { title: string; btn: string; btnOn: string; ring: string; dot: string }> = {
  SELF_CONSUMPTION: {
    title: 'text-violet-300',
    btn: 'bg-violet-500 hover:bg-violet-400',
    btnOn: 'bg-violet-500/30 ring-1 ring-violet-400/60',
    ring: 'ring-violet-400/60',
    dot: 'bg-violet-400',
  },
  ONSITE: {
    title: 'text-sky-300',
    btn: 'bg-blue-500 hover:bg-blue-400',
    btnOn: 'bg-blue-500/30 ring-1 ring-blue-400/60',
    ring: 'ring-blue-400/60',
    dot: 'bg-sky-400',
  },
};

/** 기존 기업 선택 — 고르면 기업명·기업 주소가 채워진다 (회원가입과 같은 말) */
const COMPANY_OPTIONS = CONSUMERS.map((c) => ({ value: String(c.id), label: c.name, ...c }));

type Form = {
  consumerPick: string;
  consumerName: string;
  address: string;
  capacity: string;
  surveyDate: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  note: string;
};

/**
 * 거래 신청 — 의향만 넣는다(2026-10-12). 계약 조건(기간 · 단가)은 미팅 뒤 관리자가 거래 이력에서 넣고, 승인 → 전자서명 → 체결.
 * 계약 유형을 먼저 고르고 기업 · 희망 설치 용량 · 미팅 희망일 · 담당자(로그인 계정에서 자동) 를 넣는다.
 * 기존 기업은 골라서 채우고, 전화로 들어온 신규 기업은 관리자가 직접 입력(기업명·기업 주소 — 회원가입과 같은 말).
 */
export function TradeRequestsScreen() {
  const role = useTradingRole();
  const submit = useTradingPocStore((s) => s.submitRequest);
  const contractsAll = useTradingPocStore((s) => s.contracts);
  const addToast = useToastStore((s) => s.add);

  // 관리자만 기업을 고르거나 입력한다. 그 외(계약한 기업이 직접 신청)는 로그인(가입) 값 고정
  const own = role.isAdmin
    ? undefined
    : {
        value: String(role.companyId),
        id: role.companyId,
        name: role.companyName,
        address: role.user?.companyAddress || COMPANY_OPTIONS.find((c) => c.id === role.companyId)?.address || '',
      };
  // 담당자 — 로그인 계정의 이름 · 연락처 · 이메일로 채우고 고칠 수 있다
  const blank = (): Form => ({
    consumerPick: own?.value ?? '',
    consumerName: own?.name ?? '',
    address: own?.address ?? '',
    capacity: '',
    surveyDate: '',
    contactName: role.user?.name ?? '',
    contactPhone: role.user?.phone ?? '',
    contactEmail: role.user?.email ?? '',
    note: '',
  });
  const [kind, setKind] = useState<PlantContractKind | null>(null);
  const [f, setF] = useState<Form>(() => blank());
  const set = (patch: Partial<Form>) => setF((prev) => ({ ...prev, ...patch }));

  const picked = own ?? COMPANY_OPTIONS.find((c) => c.value === f.consumerPick);
  // 통합관제 연계 — 기존 전기사용자의 운영 중 계약
  const running = useMemo(
    () => (picked ? contractsAll.filter((c) => c.consumerCompanyId === picked.id && c.status === 'ACTIVE') : []),
    [contractsAll, picked],
  );
  const chooseKind = (k: PlantContractKind) => {
    setKind(k);
    setF((prev) => ({ ...prev, capacity: '' }));
  };
  const pickConsumer = (v: string) => {
    const c = COMPANY_OPTIONS.find((x) => x.value === v);
    set(c ? { consumerPick: v, consumerName: c.name, address: c.address } : { consumerPick: '' });
  };
  const cap = Number(f.capacity) || 0;
  // 입력했는데 범위를 벗어난 칸 — 칸 아래 안내. 빈 칸은 신청 버튼만 막는다
  const err = {
    company: f.consumerName.trim() && !lenOk(f.consumerName, LIMIT.company) ? `${LIMIT.company[0]}~${LIMIT.company[1]}자` : undefined,
    address: f.address.trim() && !lenOk(f.address, LIMIT.address) ? `${LIMIT.address[0]}~${LIMIT.address[1]}자` : undefined,
    capacity: f.capacity && cap < LIMIT.capacity[0] ? `${LIMIT.capacity[0]} kW 이상` : undefined,
    name: f.contactName.trim() && !lenOk(f.contactName, LIMIT.name) ? `${LIMIT.name[0]}~${LIMIT.name[1]}자` : undefined,
    phone: f.contactPhone.trim() && !lenOk(f.contactPhone, LIMIT.phone) ? `${LIMIT.phone[0]}~${LIMIT.phone[1]}자` : undefined,
    email: f.contactEmail.trim() && !EMAIL_RE.test(f.contactEmail.trim()) ? '이메일 형식' : undefined,
    surveyDate: f.surveyDate && f.surveyDate < localToday() ? '오늘 이후' : undefined,
  };
  const valid =
    !!kind &&
    lenOk(f.consumerName, LIMIT.company) &&
    lenOk(f.address, LIMIT.address) &&
    cap >= LIMIT.capacity[0] &&
    cap <= LIMIT.capacity[1] &&
    lenOk(f.contactName, LIMIT.name) &&
    lenOk(f.contactPhone, LIMIT.phone) &&
    !err.email &&
    !err.surveyDate;

  const handleSubmit = () => {
    if (!kind || !valid) return;
    const consumerName = f.consumerName.trim();
    const consumerId = CONSUMERS.find((c) => c.name === consumerName)?.id ?? 0; // 0 = 미등록(신규) 기업
    const r = submit({
      kind,
      applicant: role.isAdmin ? 'spc' : 'generator',
      applicantCompanyId: role.isAdmin ? CO.SPC.id : role.companyId,
      applicantCompanyName: role.isAdmin ? CO.SPC.name : role.companyName,
      // 상대는 플랫폼(SPC) — 발전사업자가 전력을 공급하는 구조가 아니다(offsite 없음). 자가소비는 전기사용자가 설치비 부담, PPA 는 EPC 가 설치비 부담
      generatorCompanyId: CO.SPC.id,
      generatorCompanyName: CO.SPC.name,
      plantName: consumerName,
      consumerCompanyId: consumerId,
      consumerCompanyName: consumerName,
      siteName: consumerName,
      address: f.address.trim(),
      capacityKw: cap,
      // 단가 · 계약 기간은 미팅 뒤에 넣는다
      unitPrice: 0,
      termYears: 0,
      note: f.note.trim() || undefined,
      omIncluded: true,
      surveyDate: f.surveyDate || undefined,
      contact: { name: f.contactName.trim(), phone: f.contactPhone.trim(), email: f.contactEmail.trim() || undefined },
    });
    addToast('success', `${r.no} 신청 접수`);
    setKind(null);
    setF(blank());
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'RE100', path: '/re100' }, { label: '거래 신청' }]} />
      {/* 제목 줄 — 신청 버튼이 스크롤해도 따라온다 */}
      <div className="sticky top-[100px] z-20 -mt-3 flex items-center justify-between gap-3 py-3 backdrop-blur">
        <h1 className="text-2xl font-bold text-white">거래 신청</h1>
        {kind && (
          <Button disabled={!valid} onClick={() => handleSubmit()}>
            <Send size={15} className="mr-1.5" /> 신청
          </Button>
        )}
      </div>

      {/* 계약 유형 — 먼저 고른다. 카드: 이름 · 한 줄 설명 · 신청 버튼 · 특징 (아이콘 없음) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {KIND_CARDS.map((k) => {
          const on = kind === k.value;
          const tone = KIND_TONE[k.value];
          return (
            <div
              key={k.value}
              className={cn('rounded-xl bg-[#0d1520] p-6 ring-1 transition-colors', on ? tone.ring : 'ring-white/[0.06]')}
            >
              <p className={cn('text-2xl font-bold', tone.title)}>{k.title}</p>
              <p className="mt-1.5 text-base font-semibold text-white">{k.headline}</p>
              <button
                type="button"
                onClick={() => chooseKind(k.value)}
                className={cn(
                  'mt-5 flex h-11 w-full items-center justify-center gap-1.5 rounded-lg text-sm font-semibold text-white transition-colors',
                  on ? tone.btnOn : tone.btn,
                )}
              >
                {on ? (
                  <>
                    <CheckCircle2 size={15} /> {k.title} 선택됨
                  </>
                ) : (
                  <>
                    {k.title} 신청하기 <ArrowUpRight size={15} />
                  </>
                )}
              </button>
              <ul className="mt-5 space-y-2 text-sm text-slate-300">
                {k.points.map((p) => (
                  <li key={p} className="flex gap-2.5">
                    <span className={cn('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', tone.dot)} />
                    {p}
                  </li>
                ))}
              </ul>
              {/* 참고 — 겁주지 않게 노란 경고색 대신 평범한 글씨로 */}
              <p className="mt-4 flex gap-2 border-t border-white/[0.06] pt-4 text-sm text-slate-300">
                <span className="shrink-0 font-semibold text-slate-400">참고</span>
                {k.note}
              </p>
            </div>
          );
        })}
      </div>

      {kind && (
        <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06]">
          <>
            <Section title="기업">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {role.isAdmin ? (
                  <Select
                    label="기존 기업 선택"
                    options={[
                      { value: '', label: '신규 기업 등록' },
                      ...COMPANY_OPTIONS.map((c) => ({ value: c.value, label: c.label })),
                    ]}
                    value={f.consumerPick}
                    onChange={(e) => pickConsumer(e.target.value)}
                  />
                ) : (
                  <ReadOnly label="기업명" value={f.consumerName} />
                )}
                <ReadOnly
                  label="운영 중 계약"
                  value={running.length ? running.map((c) => `${kindLabel(c.kind)} ${fmtKw(c.capacityKw)}`).join(' · ') : '-'}
                />
                {/* 기존 기업을 고르면(또는 관리자가 아니면) 기업명·기업 주소 고정 — 관리자가 신규 기업 등록일 때만 입력 */}
                {!role.isAdmin ? (
                  <div className="md:col-span-2">
                    <ReadOnly label="기업 주소" value={f.address} />
                  </div>
                ) : picked ? (
                  <>
                    <ReadOnly label="기업명" value={f.consumerName} />
                    <ReadOnly label="기업 주소" value={f.address} />
                  </>
                ) : (
                  <>
                    <Input label="기업명" value={f.consumerName} maxLength={LIMIT.company[1]} error={err.company} onChange={(e) => set({ consumerName: e.target.value })} required />
                    <Input label="기업 주소" value={f.address} maxLength={LIMIT.address[1]} error={err.address} onChange={(e) => set({ address: e.target.value })} required />
                  </>
                )}
              </div>
            </Section>

            {/* 신청 — 희망 설치 용량 · 미팅 희망일. 조건(기간 · 단가)은 미팅 뒤 관리자가 넣는다 */}
            <Section title="신청">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Input
                  label="희망 설치 용량 (kW)"
                  inputMode="decimal"
                  value={f.capacity}
                  error={err.capacity}
                  onChange={(e) => set({ capacity: capInput(e.target.value) })}
                  required
                />
                <Input label="미팅 희망일" type="date" min={localToday()} error={err.surveyDate} value={f.surveyDate} onChange={(e) => set({ surveyDate: e.target.value })} />
              </div>
            </Section>

            <Section title="담당자">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Input label="이름" value={f.contactName} maxLength={LIMIT.name[1]} error={err.name} onChange={(e) => set({ contactName: e.target.value })} required />
                <Input label="연락처" type="tel" value={f.contactPhone} error={err.phone} onChange={(e) => set({ contactPhone: phoneInput(e.target.value) })} required />
                <Input label="이메일" type="email" value={f.contactEmail} maxLength={LIMIT.email} error={err.email} onChange={(e) => set({ contactEmail: e.target.value })} />
              </div>
            </Section>

            <Section title="비고" last>
              <Textarea value={f.note} maxLength={LIMIT.note} onChange={(e) => set({ note: e.target.value })} rows={3} className="min-h-[88px] resize-none" />
            </Section>
          </>
        </div>
      )}
    </div>
  );
}

/** 값만 보이는 칸 — 입력칸과 같은 모양·높이(읽기 전용), 값 없으면 '-' */
function ReadOnly({ label, value }: { label: string; value: string }) {
  return <Input label={label} value={value} readOnly tabIndex={-1} className="cursor-default text-slate-400" />;
}

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn('px-8 py-6', !last && 'border-b border-white/[0.06]')}>
      <h2 className="mb-4 text-base font-semibold text-white">{title}</h2>
      {children}
    </div>
  );
}
