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
import { PLAN_LABEL, SELF_CAPEX_UNIT, VER_LABEL, reviewNo as toReviewNo } from '@/lib/solar-sim';
import { useDiagnoses } from '@/hooks/consulting/useConsultations';
import { useToastStore } from '@/stores/useToastStore';
import { CONSUMERS, CO, defaultTermYears, defaultUnitPrice, useTradingPocStore } from '@/stores/useTradingPocStore';
import type { Diagnosis } from '@/types/consultation';
import type { PlantContractKind } from '@/types/monitoring';
import { useTradingRole } from './useTradingRole';
import { amountLabel, estimateMonthlyAmount, estimateMonthlyKwh, fmtKrw, fmtKw, fmtKwh, kindLabel } from './meta';
import { Info } from './Bits';

const PLAN_OPTIONS = [{ value: '', label: '선택' }, ...Object.values(PLAN_LABEL).map((l) => ({ value: l, label: l }))];
const VER_OPTIONS = [{ value: '', label: '선택' }, ...Object.values(VER_LABEL).map((l) => ({ value: l, label: l }))];
/** 진단 분석 기간 — 시뮬레이터는 20년으로 본다 */
const SIM_YEARS = 20;
const won = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`;

/** 계약 유형 카드 — 무엇인지 · 누가 무엇을 하는지 · 어떻게 청구하는지 */
/** 계약 유형 카드 — 수용가가 얻는 것(장점)과 알고 있어야 할 것(유의) */
const KIND_CARDS: { value: PlantContractKind; title: string; headline: string; points: string[]; note: string }[] = [
  {
    value: 'SELF_CONSUMPTION',
    title: '자가소비',
    headline: '내 설비로 만든 전기를 직접 써서 한전 요금 절감',
    points: ['내 지붕 태양광 전기를 직접 사용 — 한전 전기요금 절감', '발전량 · 절감액을 플랫폼에서 실시간 확인', '설비는 기업 소유 · O&M 포함'],
    note: '초기 설치비는 기업 부담 — 설치 용량에 따라 비용이 클 수 있음',
  },
  {
    value: 'ONSITE',
    title: 'onsite',
    headline: '초기 비용 0원, 한전보다 낮은 단가로 절감',
    points: ['초기 비용 0원 · 설치비는 EPC 부담', '사용분은 PPA 단가로 지급 — 한전보다 낮은 단가로 절감', '발전량 · 절감액을 플랫폼에서 실시간 확인'],
    note: '절감액의 일부는 매월 반환 · 20년 장기 계약',
  },
];

/** 카드 색 — 자가소비 보라 · onsite 파랑 (제목 글자 · 신청 버튼 · 선택 테두리) */
const KIND_TONE: Record<PlantContractKind, { title: string; btn: string; btnOn: string; ring: string; dot: string }> = {
  SELF_CONSUMPTION: { title: 'text-violet-300', btn: 'bg-violet-500 hover:bg-violet-400', btnOn: 'bg-violet-500/30 ring-1 ring-violet-400/60', ring: 'ring-violet-400/60', dot: 'bg-violet-400' },
  ONSITE: { title: 'text-sky-300', btn: 'bg-blue-500 hover:bg-blue-400', btnOn: 'bg-blue-500/30 ring-1 ring-blue-400/60', ring: 'ring-blue-400/60', dot: 'bg-sky-400' },
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

  // 로그인한 기업이 기존 기업이면(계약한 기업이 직접 신청) 처음부터 그 기업으로, 관리자는 전화 받아 고르거나 직접 입력
  const own = role.isAdmin ? undefined : COMPANY_OPTIONS.find((c) => c.id === role.companyId);
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

  const picked = COMPANY_OPTIONS.find((c) => c.value === f.consumerPick);
  // 통합관제 연계 — 기존 수용가의 운영 중 계약
  const running = useMemo(() => (picked ? contractsAll.filter((c) => c.consumerCompanyId === picked.id && c.status === 'ACTIVE') : []), [contractsAll, picked]);
  // 컨설팅 연계 — 이 기업의 무료진단 중 고른 유형과 같은 것만. 기존 기업은 번호로, 신규 기업(관리자가 진단에 직접 입력)은 기업명으로 찾는다
  const { data: diagData } = useDiagnoses();
  const nameKey = f.consumerName.trim();
  const diagnoses = useMemo(
    () =>
      ((diagData ?? []) as Diagnosis[]).filter(
        (d) =>
          d.sim &&
          (picked ? d.companyId === picked.id : !!nameKey && d.companyName === nameKey) &&
          (kind === 'ONSITE' ? d.sim.mode === 'ppa' : d.sim.mode === 'self'),
      ),
    [diagData, kind, picked, nameKey],
  );

  const chooseKind = (k: PlantContractKind) => {
    setKind(k);
    setBeforeLoad(null);
    // 유형이 바뀌면 진단·조건은 다시(수용가·연락처는 둔다)
    setF((prev) => ({ ...prev, pickedDiag: '', reviewNo: undefined, capacity: '', term: String(defaultTermYears(k)), tariffPlan: '', tariffBasis: '', price: String(defaultUnitPrice(k)), estInstallUnit: undefined, installUnit: '', ppaSegText: undefined, seg1End: '', seg1Price: '', seg2Price: '' }));
  };
  const pickConsumer = (v: string) => {
    setBeforeLoad(null);
    const c = COMPANY_OPTIONS.find((x) => x.value === v);
    set(c ? { consumerPick: v, consumerName: c.name, address: c.address, pickedDiag: '' } : { consumerPick: '', pickedDiag: '' });
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
      address: sim.address || f.address,
      capacity: String(kind === 'ONSITE' ? sim.ppa.cap : sim.self.cap),
      term: String(SIM_YEARS),
      tariffPlan: PLAN_LABEL[kind === 'ONSITE' ? sim.ppa.plan : sim.self.plan],
      tariffBasis: VER_LABEL[kind === 'ONSITE' ? sim.ppa.ver : sim.self.ver],
      estInstallUnit: kind === 'SELF_CONSUMPTION' ? (sim.self.capexUnit ?? SELF_CAPEX_UNIT) : undefined,
      // onsite 구간 단가 — 한전 연동 구간은 금액이 정해지지 않아 비워 두고 직접 적는다
      seg1End: kind === 'ONSITE' ? String(sim.ppa.b1) : '',
      seg1Price: kind === 'ONSITE' && !seg[0]!.linked ? String(seg[0]!.price) : '',
      seg2Price: kind === 'ONSITE' && !seg[1]!.linked ? String(seg[1]!.price) : '',
      ppaSegText: kind === 'ONSITE' ? `1구간 1~${sim.ppa.b1}년 ${segPrice(seg[0]!)} · 2구간 ${sim.ppa.b1 + 1}~20년 ${segPrice(seg[1]!)}` : undefined,
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
  // 대표 단가 — onsite 는 1구간 단가(정산 시작 단가), 자가소비는 운영관리 단가
  const unit = kind === 'ONSITE' ? p1 : Number(f.price) || 0;
  // 계약 기간 합계 — onsite 는 구간별 단가로
  const monthlyKwh = estimateMonthlyKwh(cap);
  const termTotal = kind === 'ONSITE' ? (segOk ? monthlyKwh * 12 * (seg1End * p1 + (years - seg1End) * p2) : 0) : estimateMonthlyAmount(cap, unit) * 12 * years;
  const installUnit = Number(f.installUnit) || 0;
  const valid =
    !!kind &&
    !!f.consumerName.trim() &&
    !!f.address.trim() &&
    cap > 0 &&
    unit > 0 &&
    years > 0 &&
    (kind === 'ONSITE' ? segOk : installUnit > 0) &&
    !!f.contactName.trim() &&
    !!f.contactPhone.trim();

  const handleSubmit = () => {
    if (!kind || !valid) return;
    const consumerName = f.consumerName.trim();
    const consumerId = CONSUMERS.find((c) => c.name === consumerName)?.id ?? 0; // 0 = 미등록(신규) 기업
    const r = submit({
      kind,
      applicant: role.isAdmin ? 'spc' : 'generator',
      applicantCompanyId: role.isAdmin ? CO.SPC.id : role.companyId,
      applicantCompanyName: role.isAdmin ? CO.SPC.name : role.companyName,
      // 상대는 플랫폼(SPC) — 발전사업자가 전력을 공급하는 구조가 아니다(offsite 없음). 자가소비는 수용가가 설치비 부담, onsite 는 EPC 가 설치비 부담
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
      segments: kind === 'ONSITE' ? [{ from: 1, to: seg1End, price: p1 }, { from: seg1End + 1, to: years, price: p2 }] : undefined,
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
          <Button disabled={!valid} onClick={handleSubmit}>
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
            <div key={k.value} className={cn('rounded-xl bg-[#0d1520] p-6 ring-1 transition-colors', on ? tone.ring : 'ring-white/[0.06]')}>
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
              {/* 유의 — 수용가가 알고 있어야 할 것 */}
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
                <Select
                  label="기존 기업 선택"
                  options={[{ value: '', label: '신규 기업 등록' }, ...COMPANY_OPTIONS.map((c) => ({ value: c.value, label: c.label }))]}
                  value={f.consumerPick}
                  onChange={(e) => pickConsumer(e.target.value)}
                />
                <ReadOnly label="운영 중 계약" value={running.length ? running.map((c) => `${kindLabel(c.kind)} ${fmtKw(c.capacityKw)}`).join(' · ') : '-'} />
                <Input label="기업명" value={f.consumerName} onChange={(e) => set({ consumerName: e.target.value })} required />
                <Input label="기업 주소" value={f.address} onChange={(e) => set({ address: e.target.value })} required />
              </div>
            </Section>

            {diagnoses.length > 0 && (
              <Section title="무료진단">
                <div className="flex flex-wrap items-end gap-3">
                  <Select
                    label="검토 기록"
                    options={[
                      { value: '', label: '선택' },
                      ...diagnoses.map((d) => ({
                        value: String(d.id),
                        label: `${toReviewNo(d.id, d.createdAt)} · ${d.createdAt.slice(0, 10)} · ${d.sim!.site} · ${fmtKw(kind === 'ONSITE' ? d.sim!.ppa.cap : d.sim!.self.cap)}`,
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
              </Section>
            )}

            <Section title="계약 조건">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Input label="설치 용량 (kW)" type="number" min={1} step="0.01" value={f.capacity} onChange={(e) => set({ capacity: e.target.value })} required />
                <Input label="계약 기간 (년)" type="number" min={1} max={25} value={f.term} onChange={(e) => set({ term: e.target.value })} required />
                <ReadOnly label="O&M" value="포함 (필수)" />
                <Select label="요금제" options={PLAN_OPTIONS} value={f.tariffPlan} onChange={(e) => set({ tariffPlan: e.target.value })} />
                <Select label="요금 기준" options={VER_OPTIONS} value={f.tariffBasis} onChange={(e) => set({ tariffBasis: e.target.value })} />
                {kind === 'SELF_CONSUMPTION' ? (
                  <>
                    <Input label="운영관리(O&M) 단가 (₩/kWh)" type="number" min={1} step="0.1" value={f.price} onChange={(e) => set({ price: e.target.value })} required />
                    <ReadOnly label="예상 설치단가 (무료진단)" value={f.estInstallUnit ? `${won(f.estInstallUnit)}/kW` : '-'} />
                    <Input label="설치 가능 단가 (원/kW)" type="number" min={1} step="1000" value={f.installUnit} onChange={(e) => set({ installUnit: e.target.value })} required />
                    <ReadOnly label="예상 설치비" value={cap > 0 && installUnit > 0 ? won(cap * installUnit) : '-'} />
                  </>
                ) : (
                  <>
                    <Input label="1구간 끝 (년차)" type="number" min={1} max={Math.max(1, years - 1)} value={f.seg1End} onChange={(e) => set({ seg1End: e.target.value })} required />
                    <Input label={`1구간 단가 (1~${seg1End || 'n'}년차, ₩/kWh)`} type="number" min={1} step="0.1" value={f.seg1Price} onChange={(e) => set({ seg1Price: e.target.value })} required />
                    <Input label={`2구간 단가 (${seg1End ? seg1End + 1 : 'n'}~${years || 'n'}년차, ₩/kWh)`} type="number" min={1} step="0.1" value={f.seg2Price} onChange={(e) => set({ seg2Price: e.target.value })} required />
                    <ReadOnly label="진단 단가 (참고)" value={f.ppaSegText ?? '-'} />
                  </>
                )}
              </div>
            </Section>

            <Section title="예상 정산">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Info label="월 발전량" value={cap > 0 ? fmtKwh(estimateMonthlyKwh(cap)) : undefined} />
                <Info label={kind === 'ONSITE' ? '월 납입료' : `월 ${amountLabel(kind)}`} value={cap > 0 && unit > 0 ? fmtKrw(estimateMonthlyAmount(cap, unit)) : undefined} />
                <Info label="계약 기간 합계" value={cap > 0 && termTotal > 0 ? fmtKrw(termTotal) : undefined} />
              </div>
            </Section>

            <Section title="현장 실측">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Info label="실측 요청" value={<Checkbox label="요청" checked={f.surveyRequested} onChange={(e) => set({ surveyRequested: e.target.checked })} />} />
                <Input label="희망일" type="date" value={f.surveyDate} disabled={!f.surveyRequested} onChange={(e) => set({ surveyDate: e.target.value })} />
              </div>
            </Section>

            <Section title="담당자">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Input label="이름" value={f.contactName} onChange={(e) => set({ contactName: e.target.value })} required />
                <Input label="연락처" type="tel" value={f.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} required />
                <Input label="이메일" type="email" value={f.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} />
              </div>
            </Section>

            <Section title="비고" last>
              <Textarea value={f.note} onChange={(e) => set({ note: e.target.value })} rows={3} className="min-h-[88px] resize-none" />
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
