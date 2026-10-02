'use client';

import { useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import { reviewNo as toReviewNo } from '@/lib/solar-sim';
import { useDiagnosesByCompany } from '@/hooks/consulting/useConsultations';
import { useToastStore } from '@/stores/useToastStore';
import { CONSUMERS, CO, GENERATOR_COMPANIES, defaultTermYears, defaultUnitPrice, useTradingPocStore } from '@/stores/useTradingPocStore';
import type { Diagnosis } from '@/types/consultation';
import type { PlantContractKind } from '@/types/monitoring';
import { useTradingRole } from './useTradingRole';
import { KIND_OPTIONS, amountLabel, estimateMonthlyAmount, estimateMonthlyKwh, fmtKrw, fmtKw, fmtKwh, kindLabel, priceLabel } from './meta';
import { Info } from './Bits';

/** 무료진단 기록 → 신청값. OnSite PPA 는 고정 단가 구간의 단가, 자가소비는 운영관리 기본 단가 */
function fromDiagnosis(d: Diagnosis) {
  const sim = d.sim!;
  const kind: PlantContractKind = sim.mode === 'ppa' ? 'ONSITE' : 'SELF_CONSUMPTION';
  const fixed = sim.ppa.segs.slice(0, 2).find((s) => !s.linked);
  return {
    kind,
    site: sim.site,
    capacity: sim.mode === 'ppa' ? sim.ppa.cap : sim.self.cap,
    price: kind === 'ONSITE' && fixed ? fixed.price : defaultUnitPrice(kind),
    reviewNo: toReviewNo(d.id, d.createdAt),
  };
}

/** 거래 신청 — 신청만 한다. 진행 상황은 거래 현황, 승인·서명은 거래 승인 */
export function TradeRequestsScreen() {
  const role = useTradingRole();
  const submit = useTradingPocStore((s) => s.submitRequest);
  const contractsAll = useTradingPocStore((s) => s.contracts);
  const addToast = useToastStore((s) => s.add);

  const [kind, setKind] = useState<PlantContractKind>('SELF_CONSUMPTION');
  const [generatorId, setGeneratorId] = useState(String(role.isAdmin ? CO.SPC.id : role.companyId));
  const [consumerId, setConsumerId] = useState(String(CONSUMERS[0]!.id));
  const [siteIdx, setSiteIdx] = useState('0');
  const [capacity, setCapacity] = useState('');
  const [price, setPrice] = useState(String(defaultUnitPrice('SELF_CONSUMPTION')));
  const [term, setTerm] = useState(String(defaultTermYears('SELF_CONSUMPTION')));
  const [note, setNote] = useState('');
  const [reviewNo, setReviewNo] = useState<string | undefined>();
  const [pickedDiag, setPickedDiag] = useState('');

  const consumer = CONSUMERS.find((c) => String(c.id) === consumerId) ?? CONSUMERS[0]!;
  const site = consumer.sites[Number(siteIdx)] ?? consumer.sites[0]!;

  // 통합관제 연계 — 이 수용가의 운영 중 계약(설비)
  const running = useMemo(
    () => contractsAll.filter((c) => c.consumerCompanyId === consumer.id && c.status === 'ACTIVE'),
    [contractsAll, consumer.id],
  );
  // 컨설팅 연계 — 이 수용가의 무료진단 기록
  const { data: diagData } = useDiagnosesByCompany(consumer.id);
  const diagnoses = useMemo(() => ((diagData ?? []) as Diagnosis[]).filter((d) => d.sim), [diagData]);

  const cap = Number(capacity) || 0;
  const unit = Number(price) || 0;
  const years = Number(term) || 0;
  const valid = cap > 0 && unit > 0 && years > 0;

  const changeKind = (k: PlantContractKind) => {
    setKind(k);
    setPrice(String(defaultUnitPrice(k)));
    setTerm(String(defaultTermYears(k)));
  };
  const reset = () => {
    setCapacity('');
    setPrice(String(defaultUnitPrice(kind)));
    setTerm(String(defaultTermYears(kind)));
    setNote('');
    setReviewNo(undefined);
    setPickedDiag('');
  };
  const loadDiagnosis = () => {
    const d = diagnoses.find((x) => String(x.id) === pickedDiag);
    if (!d) return;
    const v = fromDiagnosis(d);
    setKind(v.kind);
    const idx = consumer.sites.findIndex((s) => s.name === v.site);
    if (idx >= 0) setSiteIdx(String(idx));
    setCapacity(String(v.capacity));
    setPrice(String(v.price));
    setTerm(String(defaultTermYears(v.kind)));
    setReviewNo(v.reviewNo);
  };

  const handleSubmit = () => {
    const gen = role.isAdmin ? (GENERATOR_COMPANIES.find((g) => String(g.id) === generatorId) ?? CO.SPC) : { id: role.companyId, name: role.companyName };
    const r = submit({
      kind,
      applicant: role.isAdmin ? 'spc' : 'generator',
      applicantCompanyId: role.isAdmin ? CO.SPC.id : role.companyId,
      applicantCompanyName: role.isAdmin ? CO.SPC.name : role.companyName,
      generatorCompanyId: gen.id,
      generatorCompanyName: gen.name,
      plantName: site.name,
      consumerCompanyId: consumer.id,
      consumerCompanyName: consumer.name,
      siteName: site.name,
      address: site.address,
      capacityKw: cap,
      unitPrice: unit,
      termYears: years,
      note: note.trim() || undefined,
      reviewNo,
    });
    addToast('success', `${r.no} 신청 접수`);
    reset();
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'RE100', path: '/re100' }, { label: '거래 신청' }]} />
      {/* 제목 줄 — 신청 버튼이 스크롤해도 따라온다 */}
      <div className="sticky top-[100px] z-20 -mt-3 flex items-center justify-between gap-3 py-3 backdrop-blur">
        <h1 className="text-2xl font-bold text-white">거래 신청</h1>
        <Button disabled={!valid} onClick={handleSubmit}>
          <Send size={15} className="mr-1.5" /> 신청
        </Button>
      </div>

      <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06]">
        {/* 계약 유형 */}
        <div className="px-8 pt-6">
          <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1.5 ring-1 ring-white/[0.06]">
            {KIND_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => changeKind(o.value)}
                className={cn(
                  'flex-1 rounded-lg py-2.5 text-center text-sm font-semibold transition-colors',
                  kind === o.value ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <Section title="수용가">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {role.isAdmin ? (
              <Select label="발전사업자" options={GENERATOR_COMPANIES.map((g) => ({ value: String(g.id), label: g.name }))} value={generatorId} onChange={(e) => setGeneratorId(e.target.value)} />
            ) : (
              <Info label="발전사업자" value={role.companyName} />
            )}
            <Select
              label="수용가"
              options={CONSUMERS.map((c) => ({ value: String(c.id), label: c.name }))}
              value={consumerId}
              onChange={(e) => {
                setConsumerId(e.target.value);
                setSiteIdx('0');
                setPickedDiag('');
                setReviewNo(undefined);
              }}
            />
            <Select label="사업장" options={consumer.sites.map((s, i) => ({ value: String(i), label: s.name }))} value={siteIdx} onChange={(e) => setSiteIdx(e.target.value)} />
            <Info label="주소" value={site.address} className="md:col-span-2" />
            <Info
              label="운영 중 계약"
              value={running.length ? running.map((c) => `${kindLabel(c.kind)} ${fmtKw(c.capacityKw)}`).join(' · ') : undefined}
            />
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
                    label: `${toReviewNo(d.id, d.createdAt)} · ${d.createdAt.slice(0, 10)} · ${d.sim!.site} · ${d.sim!.mode === 'ppa' ? `onsite ${fmtKw(d.sim!.ppa.cap)}` : `자가소비 ${fmtKw(d.sim!.self.cap)}`}`,
                  })),
                ]}
                value={pickedDiag}
                onChange={(e) => setPickedDiag(e.target.value)}
                className="w-[440px] max-w-full"
              />
              <Button variant="secondary" disabled={!pickedDiag} onClick={loadDiagnosis}>
                불러오기
              </Button>
              {reviewNo && <span className="pb-2 text-sm text-slate-400 tabular-nums">{reviewNo} 적용</span>}
            </div>
          </Section>
        )}

        <Section title="계약 조건">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input label="설비 용량 (kW)" type="number" min={1} step="0.01" value={capacity} onChange={(e) => setCapacity(e.target.value)} required />
            <Input label={`${priceLabel(kind)} (₩/kWh)`} type="number" min={1} step="0.1" value={price} onChange={(e) => setPrice(e.target.value)} required />
            <Input label="계약 기간 (년)" type="number" min={1} max={25} value={term} onChange={(e) => setTerm(e.target.value)} required />
            <div className="md:col-span-3">
              <Textarea label="비고" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="min-h-[72px] resize-none" />
            </div>
          </div>
        </Section>

        <Section title="예상 정산" last>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Info label={`월 ${kind === 'ONSITE' ? '공급량' : '발전량'}`} value={cap > 0 ? fmtKwh(estimateMonthlyKwh(cap)) : undefined} />
            <Info label={`월 ${amountLabel(kind)}`} value={cap > 0 && unit > 0 ? fmtKrw(estimateMonthlyAmount(cap, unit)) : undefined} />
            <Info label="계약 기간 합계" value={valid ? fmtKrw(estimateMonthlyAmount(cap, unit) * 12 * years) : undefined} />
          </div>
        </Section>
      </div>
    </div>
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
