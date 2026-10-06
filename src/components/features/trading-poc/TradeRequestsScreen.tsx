'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Send } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import {
  PLAN_LABEL,
  SELF_CAPEX_UNIT,
  SELF_EXTRA_COST,
  SELF_OM,
  VER_LABEL,
  tableOf,
  reviewNo as toReviewNo,
} from '@/lib/solar-sim';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useDiagnoses } from '@/hooks/consulting/useConsultations';
import { useToastStore } from '@/stores/useToastStore';
import { CONSUMERS, CO, defaultTermYears, defaultUnitPrice, useTradingPocStore } from '@/stores/useTradingPocStore';
import type { Diagnosis } from '@/types/consultation';
import type { PlantContractKind } from '@/types/monitoring';
import { useTradingRole } from './useTradingRole';
import { estimateMonthlyAmount, estimateMonthlyKwh, fmtKrw, fmtKw, fmtKwh, kindLabel } from './meta';
import { Info } from './Bits';

const PLAN_OPTIONS = [{ value: '', label: '선택' }, ...Object.values(PLAN_LABEL).map((l) => ({ value: l, label: l }))];
const VER_OPTIONS = [{ value: '', label: '선택' }, ...Object.values(VER_LABEL).map((l) => ({ value: l, label: l }))];
/** 진단 분석 기간 — 시뮬레이터는 20년으로 본다 */
const SIM_YEARS = 20;
const won = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`;

/** 계약 유형 카드 — 무엇인지 · 누가 무엇을 하는지 · 어떻게 청구하는지 */
/** 계약 유형 카드 — 전기사용자가 얻는 것(장점)과 알고 있어야 할 것(유의) */
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
    note: '초기 설치비는 기업 부담 — 설치 용량에 따라 비용이 클 수 있음',
  },
  {
    value: 'ONSITE',
    title: 'onsite',
    headline: '초기 비용 0원, 한전보다 낮은 단가로 절감',
    points: [
      '초기 비용 0원 · 설치비는 EPC 부담',
      '사용분은 PPA 단가로 지급 — 한전보다 낮은 단가로 절감',
      '발전량 · 절감액을 플랫폼에서 실시간 확인',
    ],
    note: '절감액의 일부는 매월 반환 · 20년 장기 계약',
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
  pickedDiag: string;
  reviewNo?: string;
  capacity: string;
  term: string;
  tariffPlan: string;
  tariffBasis: string;
  price: string;
  estInstallUnit?: number;
  installUnit: string;
  /** 추가 시공비(원) · 연간 O&M(총사업비 대비 %) — 자가소비 */
  extraCost: string;
  omRate: string;
  ppaSegText?: string;
  /** onsite 구간 — 1구간 끝 년차 · 1구간 단가 · 2구간 단가 */
  seg1End: string;
  seg1Price: string;
  seg2Price: string;
  surveyRequested: boolean;
  surveyDate: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  note: string;
};

/**
 * 거래 신청 — 신청만 한다(진행은 거래 현황, 승인·서명은 거래 승인).
 * 계약 유형을 먼저 고르고 내용을 넣는다. 기존 기업은 골라서 채우고, 전화로 들어온 신규 기업은 직접 입력(기업명·기업 주소 — 회원가입과 같은 말).
 * 무료진단(같은 유형)을 불러오면 설치 용량·계약 기간·요금제·요금 기준·단가·연락처가 채워진다. 진단은 추정이라 현장 실측을 함께 요청.
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
  const blank = (k: PlantContractKind | null): Form => ({
    consumerPick: own?.value ?? '',
    consumerName: own?.name ?? '',
    address: own?.address ?? '',
    pickedDiag: '',
    capacity: '',
    term: k ? String(defaultTermYears(k)) : '',
    tariffPlan: '',
    tariffBasis: '',
    price: k ? String(defaultUnitPrice(k)) : '',
    installUnit: '',
    extraCost: '',
    omRate: '',
    seg1End: '',
    seg1Price: '',
    seg2Price: '',
    surveyRequested: true,
    surveyDate: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    note: '',
  });
  const [kind, setKind] = useState<PlantContractKind | null>(null);
  const [f, setF] = useState<Form>(() => blank(null));
  // 불러오기 직전 값 — [불러오기 취소]로 되돌린다
  const [beforeLoad, setBeforeLoad] = useState<Form | null>(null);
  const set = (patch: Partial<Form>) => setF((prev) => ({ ...prev, ...patch }));

  const picked = own ?? COMPANY_OPTIONS.find((c) => c.value === f.consumerPick);
  // 통합관제 연계 — 기존 전기사용자의 운영 중 계약
  const running = useMemo(
    () => (picked ? contractsAll.filter((c) => c.consumerCompanyId === picked.id && c.status === 'ACTIVE') : []),
    [contractsAll, picked],
  );
  // 컨설팅 연계 — 고른 유형과 같은 무료진단만. 기존 기업은 그 기업 기록, 신규 기업 등록은 관리자가 진단에서 직접 입력한 미등록 기업 기록 전부(불러오면 기업명·기업 주소까지)
  const { data: diagData } = useDiagnoses();
  const diagnoses = useMemo(
    () =>
      ((diagData ?? []) as Diagnosis[]).filter(
        (d) =>
          d.sim &&
          (picked ? d.companyId === picked.id : d.companyId === 0) &&
          (kind === 'ONSITE' ? d.sim.mode === 'ppa' : d.sim.mode === 'self'),
      ),
    [diagData, kind, picked],
  );

  const chooseKind = (k: PlantContractKind) => {
    setKind(k);
    setBeforeLoad(null);
    // 유형이 바뀌면 진단·조건은 다시(전기사용자·연락처는 둔다)
    setF((prev) => ({
      ...prev,
      pickedDiag: '',
      reviewNo: undefined,
      capacity: '',
      term: String(defaultTermYears(k)),
      tariffPlan: '',
      tariffBasis: '',
      price: String(defaultUnitPrice(k)),
      estInstallUnit: undefined,
      installUnit: '',
      extraCost: k === 'SELF_CONSUMPTION' ? String(SELF_EXTRA_COST) : '',
      omRate: k === 'SELF_CONSUMPTION' ? String(SELF_OM) : '',
      ppaSegText: undefined,
      seg1End: '',
      seg1Price: '',
      seg2Price: '',
    }));
  };
  const pickConsumer = (v: string) => {
    setBeforeLoad(null);
    const c = COMPANY_OPTIONS.find((x) => x.value === v);
    set(
      c
        ? { consumerPick: v, consumerName: c.name, address: c.address, pickedDiag: '' }
        : { consumerPick: '', pickedDiag: '' },
    );
  };
  const loadDiagnosis = () => {
    const d = diagnoses.find((x) => String(x.id) === f.pickedDiag);
    if (!d?.sim || !kind) return;
    const sim = d.sim;
    setBeforeLoad((prev) => prev ?? f); // 여러 번 불러와도 처음 값으로 되돌린다
    const seg = sim.ppa.segs.slice(0, 2);
    const segPrice = (s: { linked: boolean; price: number }) => (s.linked ? '한전 연동' : `₩${s.price}/kWh`);
    set({
      reviewNo: toReviewNo(d.id, d.createdAt),
      // 신규 기업 등록이면 진단의 기업명·기업 주소도 가져온다
      ...(picked ? {} : { consumerName: d.companyName }),
      address: picked ? f.address : sim.address || f.address,
      capacity: String(kind === 'ONSITE' ? sim.ppa.cap : sim.self.cap),
      term: String(SIM_YEARS),
      tariffPlan: PLAN_LABEL[kind === 'ONSITE' ? sim.ppa.plan : sim.self.plan],
      tariffBasis: tableOf(sim, kind === 'ONSITE' ? sim.ppa.ver : sim.self.ver).label,
      estInstallUnit: kind === 'SELF_CONSUMPTION' ? (sim.self.capexUnit ?? SELF_CAPEX_UNIT) : undefined,
      extraCost: kind === 'SELF_CONSUMPTION' ? String(sim.self.extraCost ?? SELF_EXTRA_COST) : '',
      omRate: kind === 'SELF_CONSUMPTION' ? String(sim.self.om ?? SELF_OM) : '',
      // onsite 구간 단가 — 한전 연동 구간은 금액이 정해지지 않아 비워 두고 직접 적는다
      seg1End: kind === 'ONSITE' ? String(sim.ppa.b1) : '',
      seg1Price: kind === 'ONSITE' && !seg[0]!.linked ? String(seg[0]!.price) : '',
      seg2Price: kind === 'ONSITE' && !seg[1]!.linked ? String(seg[1]!.price) : '',
      ppaSegText:
        kind === 'ONSITE'
          ? `1구간 1~${sim.ppa.b1}년 ${segPrice(seg[0]!)} · 2구간 ${sim.ppa.b1 + 1}~20년 ${segPrice(seg[1]!)}`
          : undefined,
      contactName: d.contactName ?? f.contactName,
      contactPhone: d.contactPhone ?? f.contactPhone,
      contactEmail: d.contactEmail ?? f.contactEmail,
    });
  };

  const cap = Number(f.capacity) || 0;
  const years = Number(f.term) || 0;
  const seg1End = Number(f.seg1End) || 0;
  const p1 = Number(f.seg1Price) || 0;
  const p2 = Number(f.seg2Price) || 0;
  const segOk = seg1End >= 1 && seg1End < years && p1 > 0 && p2 > 0;
  const monthlyKwh = estimateMonthlyKwh(cap);
  // 자가소비 — 예상 설치비(총사업비) = 설치 용량 × 설치 가능 단가 + 추가 시공비, 연간 O&M = 총사업비 × O&M %
  const installUnit = Number(f.installUnit) || 0;
  const extraCost = Number(f.extraCost) || 0;
  const omRate = Number(f.omRate) || 0;
  const totalCost = cap > 0 && installUnit > 0 ? cap * installUnit + extraCost : 0;
  const annualOm = (totalCost * omRate) / 100;
  // 설치 가능 단가가 진단 예상의 50% 미만 · 150% 초과면 확인 — 10원처럼 불가능한 값 방지
  const estUnit = f.estInstallUnit ?? SELF_CAPEX_UNIT;
  const unitRatio = installUnit > 0 ? installUnit / estUnit : 1;
  const unitOff = kind === 'SELF_CONSUMPTION' && installUnit > 0 && (unitRatio < 0.5 || unitRatio > 1.5);
  // 정산 단가(₩/kWh) — onsite 는 1구간 단가, 자가소비는 연간 O&M 을 연 발전량으로 나눈 값(월 정산이 쓰는 값)
  const unit = kind === 'ONSITE' ? p1 : monthlyKwh > 0 ? Math.round((annualOm / (monthlyKwh * 12)) * 10) / 10 : 0;
  // 계약 기간 합계 — onsite 는 구간별 단가로, 자가소비는 연간 O&M × 기간
  const termTotal =
    kind === 'ONSITE' ? (segOk ? monthlyKwh * 12 * (seg1End * p1 + (years - seg1End) * p2) : 0) : annualOm * years;
  const [confirmOff, setConfirmOff] = useState(false);
  const valid =
    !!kind &&
    !!f.consumerName.trim() &&
    !!f.address.trim() &&
    cap > 0 &&
    unit > 0 &&
    years > 0 &&
    (kind === 'ONSITE' ? segOk : installUnit > 0 && omRate > 0) &&
    !!f.contactName.trim() &&
    !!f.contactPhone.trim();

  const handleSubmit = (force = false) => {
    if (!kind || !valid) return;
    if (unitOff && !force) {
      setConfirmOff(true);
      return;
    }
    const consumerName = f.consumerName.trim();
    const consumerId = CONSUMERS.find((c) => c.name === consumerName)?.id ?? 0; // 0 = 미등록(신규) 기업
    const r = submit({
      kind,
      applicant: role.isAdmin ? 'spc' : 'generator',
      applicantCompanyId: role.isAdmin ? CO.SPC.id : role.companyId,
      applicantCompanyName: role.isAdmin ? CO.SPC.name : role.companyName,
      // 상대는 플랫폼(SPC) — 발전사업자가 전력을 공급하는 구조가 아니다(offsite 없음). 자가소비는 전기사용자가 설치비 부담, onsite 는 EPC 가 설치비 부담
      generatorCompanyId: CO.SPC.id,
      generatorCompanyName: CO.SPC.name,
      plantName: consumerName,
      consumerCompanyId: consumerId,
      consumerCompanyName: consumerName,
      siteName: consumerName,
      address: f.address.trim(),
      capacityKw: cap,
      unitPrice: unit,
      termYears: years,
      note: f.note.trim() || undefined,
      reviewNo: f.reviewNo,
      tariffPlan: f.tariffPlan || undefined,
      tariffBasis: f.tariffBasis || undefined,
      estInstallUnit: f.estInstallUnit,
      installUnit: kind === 'SELF_CONSUMPTION' ? installUnit : undefined,
      extraCost: kind === 'SELF_CONSUMPTION' ? extraCost : undefined,
      omRatePct: kind === 'SELF_CONSUMPTION' ? omRate : undefined,
      segments:
        kind === 'ONSITE'
          ? [
              { from: 1, to: seg1End, price: p1 },
              { from: seg1End + 1, to: years, price: p2 },
            ]
          : undefined,
      omIncluded: true,
      surveyRequested: f.surveyRequested,
      surveyDate: f.surveyRequested && f.surveyDate ? f.surveyDate : undefined,
      contact: { name: f.contactName.trim(), phone: f.contactPhone.trim(), email: f.contactEmail.trim() || undefined },
    });
    addToast('success', `${r.no} 신청 접수`);
    setKind(null);
    setBeforeLoad(null);
    setF(blank(null));
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
              className={cn(
                'rounded-xl bg-[#0d1520] p-6 ring-1 transition-colors',
                on ? tone.ring : 'ring-white/[0.06]',
              )}
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
              {/* 유의 — 전기사용자가 알고 있어야 할 것 */}
              <p className="mt-4 flex gap-2 border-t border-white/[0.06] pt-4 text-sm text-amber-300/90">
                <span className="shrink-0 font-semibold">유의</span>
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
                  value={
                    running.length ? running.map((c) => `${kindLabel(c.kind)} ${fmtKw(c.capacityKw)}`).join(' · ') : '-'
                  }
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
                    <Input
                      label="기업명"
                      value={f.consumerName}
                      onChange={(e) => set({ consumerName: e.target.value })}
                      required
                    />
                    <Input
                      label="기업 주소"
                      value={f.address}
                      onChange={(e) => set({ address: e.target.value })}
                      required
                    />
                  </>
                )}
              </div>
            </Section>

            {(role.isAdmin || diagnoses.length > 0) && (
              <Section title="무료진단">
                {diagnoses.length === 0 ? (
                  <ReadOnly label="검토 기록" value="무료진단 기록 없음" />
                ) : (
                  <div className="flex flex-wrap items-end gap-3">
                    <Select
                      label="검토 기록"
                      options={[
                        { value: '', label: '선택' },
                        ...diagnoses.map((d) => ({
                          value: String(d.id),
                          label: `${toReviewNo(d.id, d.createdAt)} · ${d.createdAt.slice(0, 10)} · ${d.companyName} · ${fmtKw(kind === 'ONSITE' ? d.sim!.ppa.cap : d.sim!.self.cap)}`,
                        })),
                      ]}
                      value={f.pickedDiag}
                      onChange={(e) => set({ pickedDiag: e.target.value })}
                      className="w-[420px] max-w-full"
                    />
                    <Button variant="secondary" disabled={!f.pickedDiag} onClick={loadDiagnosis}>
                      불러오기
                    </Button>
                    {f.reviewNo && beforeLoad && (
                      <>
                        <Button
                          variant="cancel"
                          onClick={() => {
                            setF({ ...beforeLoad, pickedDiag: f.pickedDiag });
                            setBeforeLoad(null);
                          }}
                        >
                          불러오기 취소
                        </Button>
                        <span className="pb-2 text-sm text-slate-400 tabular-nums">{f.reviewNo} 적용</span>
                      </>
                    )}
                  </div>
                )}
              </Section>
            )}

            <Section title="계약 조건">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Input
                  label="설치 용량 (kW)"
                  type="number"
                  min={1}
                  step="0.01"
                  value={f.capacity}
                  onChange={(e) => set({ capacity: e.target.value })}
                  required
                />
                <Input
                  label="계약 기간 (년)"
                  type="number"
                  min={1}
                  max={25}
                  value={f.term}
                  onChange={(e) => set({ term: e.target.value })}
                  required
                />
                <ReadOnly label="O&M" value="포함 (필수)" />
                <Select
                  label="요금제"
                  options={PLAN_OPTIONS}
                  value={f.tariffPlan}
                  onChange={(e) => set({ tariffPlan: e.target.value })}
                />
                <Select
                  label="요금 기준"
                  options={VER_OPTIONS}
                  value={f.tariffBasis}
                  onChange={(e) => set({ tariffBasis: e.target.value })}
                />
                {kind === 'SELF_CONSUMPTION' ? (
                  <>
                    <Input
                      label="연간 O&M (총사업비 대비, %)"
                      type="number"
                      min={0.1}
                      step="0.1"
                      value={f.omRate}
                      onChange={(e) => set({ omRate: e.target.value })}
                      required
                    />
                    <ReadOnly
                      label="예상 설치단가 (무료진단)"
                      value={f.estInstallUnit ? `${won(f.estInstallUnit)}/kW` : '-'}
                    />
                    <div>
                      <Money
                        label="설치 가능 단가 (원/kW)"
                        placeholder="가능한 단가까지 기재해 주세요"
                        value={f.installUnit}
                        onChange={(v) => set({ installUnit: v })}
                        required
                      />
                      {unitOff && (
                        <p className="mt-1.5 text-xs text-amber-300">
                          예상 설치단가({won(estUnit)}/kW)의 {Math.round(unitRatio * 100)}% — 다시 확인해 주세요
                        </p>
                      )}
                    </div>
                    <Money label="추가 시공비 (원)" value={f.extraCost} onChange={(v) => set({ extraCost: v })} />
                  </>
                ) : (
                  <>
                    <Input
                      label="1구간 끝 (년차)"
                      type="number"
                      min={1}
                      max={Math.max(1, years - 1)}
                      value={f.seg1End}
                      onChange={(e) => set({ seg1End: e.target.value })}
                      required
                    />
                    <Input
                      label={`1구간 단가 (1~${seg1End || 'n'}년차, ₩/kWh)`}
                      type="number"
                      min={1}
                      step="0.1"
                      value={f.seg1Price}
                      onChange={(e) => set({ seg1Price: e.target.value })}
                      required
                    />
                    <Input
                      label={`2구간 단가 (${seg1End ? seg1End + 1 : 'n'}~${years || 'n'}년차, ₩/kWh)`}
                      type="number"
                      min={1}
                      step="0.1"
                      value={f.seg2Price}
                      onChange={(e) => set({ seg2Price: e.target.value })}
                      required
                    />
                    <ReadOnly label="진단 단가 (참고)" value={f.ppaSegText ?? '-'} />
                  </>
                )}
              </div>
            </Section>

            <Section title="예상 정산">
              {kind === 'SELF_CONSUMPTION' ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <Info
                    label="예상 설치비 (용량 × 단가 + 추가 시공비)"
                    value={totalCost > 0 ? won(totalCost) : undefined}
                  />
                  <Info label="연간 O&M" value={annualOm > 0 ? won(annualOm) : undefined} />
                  <Info label="계약 기간 O&M 합계" value={termTotal > 0 ? won(termTotal) : undefined} />
                  <Info label="월 발전량" value={cap > 0 ? fmtKwh(monthlyKwh) : undefined} />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Info label="월 발전량" value={cap > 0 ? fmtKwh(monthlyKwh) : undefined} />
                  <Info
                    label="월 납입료"
                    value={cap > 0 && unit > 0 ? fmtKrw(estimateMonthlyAmount(cap, unit)) : undefined}
                  />
                  <Info label="계약 기간 합계" value={cap > 0 && termTotal > 0 ? fmtKrw(termTotal) : undefined} />
                </div>
              )}
            </Section>

            <Section title="현장 실측">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Info
                  label="실측 요청"
                  value={
                    <Checkbox
                      label="요청"
                      checked={f.surveyRequested}
                      onChange={(e) => set({ surveyRequested: e.target.checked })}
                    />
                  }
                />
                <Input
                  label="희망일"
                  type="date"
                  value={f.surveyDate}
                  disabled={!f.surveyRequested}
                  onChange={(e) => set({ surveyDate: e.target.value })}
                />
              </div>
            </Section>

            <Section title="담당자">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Input
                  label="이름"
                  value={f.contactName}
                  onChange={(e) => set({ contactName: e.target.value })}
                  required
                />
                <Input
                  label="연락처"
                  type="tel"
                  value={f.contactPhone}
                  onChange={(e) => set({ contactPhone: e.target.value })}
                  required
                />
                <Input
                  label="이메일"
                  type="email"
                  value={f.contactEmail}
                  onChange={(e) => set({ contactEmail: e.target.value })}
                />
              </div>
            </Section>

            <Section title="비고" last>
              <Textarea
                value={f.note}
                onChange={(e) => set({ note: e.target.value })}
                rows={3}
                className="min-h-[88px] resize-none"
              />
            </Section>
          </>
        </div>
      )}

      <ConfirmDialog
        open={confirmOff}
        onClose={() => setConfirmOff(false)}
        onConfirm={() => {
          setConfirmOff(false);
          handleSubmit(true);
        }}
        title="설치 가능 단가 확인"
        message={`설치 가능 단가 ${won(installUnit)}/kW 가 예상 설치단가(${won(estUnit)}/kW)의 ${Math.round(unitRatio * 100)}% 입니다. 그대로 신청할까요?`}
        confirmLabel="그대로 신청"
      />
    </div>
  );
}

/** 값만 보이는 칸 — 입력칸과 같은 모양·높이(읽기 전용), 값 없으면 '-' */
function ReadOnly({ label, value }: { label: string; value: string }) {
  return <Input label={label} value={value} readOnly tabIndex={-1} className="cursor-default text-slate-400" />;
}

/** 금액 입력 — 1,300,000 처럼 쉼표로 보이고 값은 숫자만 */
function Money({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <Input
      label={label}
      inputMode="numeric"
      placeholder={placeholder}
      required={required}
      value={value ? Number(value).toLocaleString('ko-KR') : ''}
      onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
      className="tabular-nums"
    />
  );
}

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn('px-8 py-6', !last && 'border-b border-white/[0.06]')}>
      <h2 className="mb-4 text-base font-semibold text-white">{title}</h2>
      {children}
    </div>
  );
}
