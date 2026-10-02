'use client';

import { useMemo, useState } from 'react';
import { Link2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToastStore } from '@/stores/useToastStore';
import { CO, GENERATOR_COMPANIES, defaultUnitPrice, useTradingPocStore, type NewRequestInput } from '@/stores/useTradingPocStore';
import { estimateMonthlyAmount, estimateMonthlyKwh, fmtKrw, fmtKwh } from './meta';
import { Info, ModalFooter } from './Bits';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 발전사업자 로그인이면 신청자가 고정, 관리자는 발전사업자를 고른다(대리 등록) */
  isAdmin: boolean;
  companyId: number;
  companyName: string;
  onSubmitted?: (id: number) => void;
}

/**
 * onsite 거래 신청 — 수용가는 플랫폼에 등록된 2곳뿐, 사업장을 고르면 주소가 따라온다.
 * 수용가가 무료진단을 받았으면 진단 결과(권장 설비 용량)를 불러와 채울 수 있다(컨설팅 연계).
 */
const TRADE_CONSUMERS = [
  {
    ...CO.HANIL,
    sites: [{ name: '한일튜브 울산공장', address: '울산 남구 부곡동 273-6' }],
    diagnosis: null as null | { date: string; capacityKw: number; note: string },
  },
  {
    ...CO.CONSUMER_LOGIN,
    sites: [
      { name: '본사공장', address: '울산 남구 처용로 100' },
      { name: '제2공장', address: '울산 남구 용잠로 210' },
    ],
    // 컨설팅 › 무료진단(2026-08-18) 결과 — 필요 설비 용량 추정
    diagnosis: { date: '2026-08-18', capacityKw: 1285, note: 'RE100 이행 전략 진단 · C등급' },
  },
];

export function NewRequestModal({ open, onClose, isAdmin, companyId, companyName, onSubmitted }: Props) {
  const submit = useTradingPocStore((s) => s.submitRequest);
  const addToast = useToastStore((s) => s.add);

  const [generatorId, setGeneratorId] = useState(String(isAdmin ? CO.GENERATOR_LOGIN.id : companyId));
  const [consumerId, setConsumerId] = useState(String(TRADE_CONSUMERS[0]!.id));
  const [siteIdx, setSiteIdx] = useState('0');
  const [capacity, setCapacity] = useState('');
  const [price, setPrice] = useState(String(defaultUnitPrice('ONSITE')));
  const [term, setTerm] = useState('20');
  const [note, setNote] = useState('');

  const consumer = TRADE_CONSUMERS.find((c) => String(c.id) === consumerId) ?? TRADE_CONSUMERS[0]!;
  const site = consumer.sites[Number(siteIdx)] ?? consumer.sites[0]!;

  const cap = Number(capacity) || 0;
  const unit = Number(price) || 0;
  const estimate = useMemo(() => ({ kwh: estimateMonthlyKwh(cap), amount: estimateMonthlyAmount(cap, unit) }), [cap, unit]);
  const valid = cap > 0 && unit > 0 && Number(term) > 0;

  const reset = () => {
    setConsumerId(String(TRADE_CONSUMERS[0]!.id));
    setSiteIdx('0');
    setCapacity('');
    setPrice(String(defaultUnitPrice('ONSITE')));
    setTerm('20');
    setNote('');
  };

  const handleSubmit = () => {
    const gen = isAdmin ? (GENERATOR_COMPANIES.find((g) => String(g.id) === generatorId) ?? CO.GENERATOR_LOGIN) : { id: companyId, name: companyName };
    const input: NewRequestInput = {
      kind: 'ONSITE',
      applicant: isAdmin ? 'spc' : 'generator',
      applicantCompanyId: isAdmin ? CO.SPC.id : companyId,
      applicantCompanyName: isAdmin ? CO.SPC.name : companyName,
      generatorCompanyId: gen.id,
      generatorCompanyName: gen.name,
      plantName: site.name,
      consumerCompanyId: consumer.id,
      consumerCompanyName: consumer.name,
      siteName: site.name,
      address: site.address,
      capacityKw: cap,
      unitPrice: unit,
      termYears: Number(term),
      note: note.trim() || undefined,
    };
    const r = submit(input);
    addToast('success', `${r.no} 신청을 접수했습니다`);
    reset();
    onClose();
    onSubmitted?.(r.id);
  };

  return (
    <Modal open={open} onClose={onClose} title="onsite 거래 신청" size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          {isAdmin ? (
            <Select
              label="발전사업자"
              options={GENERATOR_COMPANIES.map((g) => ({ value: String(g.id), label: g.name }))}
              value={generatorId}
              onChange={(e) => setGeneratorId(e.target.value)}
            />
          ) : (
            <Info label="발전사업자" value={companyName} />
          )}
          <Select
            label="수용가"
            options={TRADE_CONSUMERS.map((c) => ({ value: String(c.id), label: c.name }))}
            value={consumerId}
            onChange={(e) => {
              setConsumerId(e.target.value);
              setSiteIdx('0');
            }}
          />
          <Select
            label="사업장"
            options={consumer.sites.map((s, i) => ({ value: String(i), label: s.name }))}
            value={siteIdx}
            onChange={(e) => setSiteIdx(e.target.value)}
          />
          <Info label="주소" value={site.address} />
        </div>

        {/* 컨설팅 연계 — 수용가의 무료진단 결과에서 권장 설비 용량을 가져온다 */}
        {consumer.diagnosis && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-primary/[0.06] ring-1 ring-primary/20 px-4 py-3">
            <p className="flex items-center gap-2 text-sm text-slate-300">
              <Link2 size={15} className="text-primary shrink-0" />
              컨설팅 연계 · 무료진단 {consumer.diagnosis.date} ({consumer.diagnosis.note}) — 권장 설비 {consumer.diagnosis.capacityKw.toLocaleString()} kW
            </p>
            <Button size="sm" variant="secondary" onClick={() => setCapacity(String(consumer.diagnosis!.capacityKw))}>
              용량 불러오기
            </Button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <Input label="설비 용량 (kW)" type="number" min={1} step="0.01" value={capacity} onChange={(e) => setCapacity(e.target.value)} required />
          <Input label="계약 단가 (₩/kWh)" type="number" min={1} step="0.1" value={price} onChange={(e) => setPrice(e.target.value)} required />
          <Input label="계약 기간 (년)" type="number" min={1} max={25} value={term} onChange={(e) => setTerm(e.target.value)} required />
          <div className="col-span-3">
            <Textarea label="비고" placeholder="설치 일정, 공급 범위 등" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="min-h-[72px]" />
          </div>
        </div>

        {/* 예상 월 정산 — 용량 × 월 평균 발전량(115 kWh/kW) × 단가 */}
        <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-3 grid grid-cols-3 gap-4">
          <Info label="예상 월 공급량" value={cap > 0 ? fmtKwh(estimate.kwh) : '-'} />
          <Info label="예상 월 PPA 요금" value={cap > 0 && unit > 0 ? fmtKrw(estimate.amount) : '-'} />
          <Info label="계약 기간 합계" value={cap > 0 && unit > 0 ? fmtKrw(estimate.amount * 12 * (Number(term) || 0)) : '-'} />
        </div>

        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button disabled={!valid} onClick={handleSubmit}>
            신청 접수
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
