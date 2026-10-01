'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToastStore } from '@/stores/useToastStore';
import { CO, CONSUMER_COMPANIES, GENERATOR_COMPANIES, defaultUnitPrice, useTradingPocStore, type NewRequestInput } from '@/stores/useTradingPocStore';
import type { PlantContractKind } from '@/types/monitoring';
import { KIND_OPTIONS, amountLabel, estimateMonthlyAmount, estimateMonthlyKwh, fmtKrw, fmtKwh, priceLabel } from './meta';
import { ModalFooter } from './Bits';

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
 * 거래 신청 등록 — 계약 유형(자가소비 · onsite) · 수용가 사업장 · 설비 · 용량 · 단가 · 기간.
 * onsite 는 발전사업자가 전력을 공급하는 계약, 자가소비는 수용가 설비를 설치·운영 관리하는 계약.
 */
export function NewRequestModal({ open, onClose, isAdmin, companyId, companyName, onSubmitted }: Props) {
  const submit = useTradingPocStore((s) => s.submitRequest);
  const addToast = useToastStore((s) => s.add);

  const [kind, setKind] = useState<PlantContractKind>('ONSITE');
  const [generatorId, setGeneratorId] = useState(String(isAdmin ? CO.GENERATOR_LOGIN.id : companyId));
  const [consumerId, setConsumerId] = useState(String(CO.HANIL.id));
  const [siteName, setSiteName] = useState('');
  const [address, setAddress] = useState('');
  const [plantName, setPlantName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [price, setPrice] = useState(String(defaultUnitPrice('ONSITE')));
  const [term, setTerm] = useState('20');
  const [note, setNote] = useState('');

  const changeKind = (k: PlantContractKind) => {
    setKind(k);
    setPrice(String(defaultUnitPrice(k)));
    setTerm(k === 'ONSITE' ? '20' : '10');
  };

  const cap = Number(capacity) || 0;
  const unit = Number(price) || 0;
  const estimate = useMemo(() => ({ kwh: estimateMonthlyKwh(cap), amount: estimateMonthlyAmount(cap, unit) }), [cap, unit]);
  const valid = cap > 0 && unit > 0 && Number(term) > 0 && siteName.trim() && plantName.trim();

  const reset = () => {
    setKind('ONSITE');
    setSiteName('');
    setAddress('');
    setPlantName('');
    setCapacity('');
    setPrice(String(defaultUnitPrice('ONSITE')));
    setTerm('20');
    setNote('');
  };

  const handleSubmit = () => {
    const gen = isAdmin ? (GENERATOR_COMPANIES.find((g) => String(g.id) === generatorId) ?? CO.GENERATOR_LOGIN) : { id: companyId, name: companyName };
    const con = CONSUMER_COMPANIES.find((c) => String(c.id) === consumerId) ?? CO.HANIL;
    const input: NewRequestInput = {
      kind,
      applicant: isAdmin ? 'spc' : 'generator',
      applicantCompanyId: isAdmin ? 1 : companyId,
      applicantCompanyName: isAdmin ? '울산 에너지 플랫폼' : companyName,
      generatorCompanyId: gen.id,
      generatorCompanyName: gen.name,
      plantName: plantName.trim(),
      consumerCompanyId: con.id,
      consumerCompanyName: con.name,
      siteName: siteName.trim(),
      address: address.trim() || '울산광역시',
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
    <Modal open={open} onClose={onClose} title="거래 신청 등록" size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Select label="계약 유형" options={KIND_OPTIONS} value={kind} onChange={(e) => changeKind(e.target.value as PlantContractKind)} />
          {isAdmin ? (
            <Select
              label="발전사업자"
              options={GENERATOR_COMPANIES.map((g) => ({ value: String(g.id), label: g.name }))}
              value={generatorId}
              onChange={(e) => setGeneratorId(e.target.value)}
            />
          ) : (
            <Input label="발전사업자" value={companyName} readOnly />
          )}
          <Select
            label="수용가"
            options={CONSUMER_COMPANIES.map((c) => ({ value: String(c.id), label: c.name }))}
            value={consumerId}
            onChange={(e) => setConsumerId(e.target.value)}
          />
          <Input label="사업장" placeholder="예: 제1공장" value={siteName} onChange={(e) => setSiteName(e.target.value)} required />
          <div className="col-span-2">
            <Input label="사업장 주소" placeholder="울산광역시 …" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <Input
            label={kind === 'ONSITE' ? '발전소(설비)명' : '설비명'}
            placeholder={kind === 'ONSITE' ? '예: 미포 정밀화학 제1공장' : '예: 온산 스틸 제1공장 지붕'}
            value={plantName}
            onChange={(e) => setPlantName(e.target.value)}
            required
          />
          <Input label="설비 용량 (kW)" type="number" min={1} step="0.01" value={capacity} onChange={(e) => setCapacity(e.target.value)} required />
          <Input label={`${priceLabel(kind)} (₩/kWh)`} type="number" min={1} step="0.1" value={price} onChange={(e) => setPrice(e.target.value)} required />
          <Input label="계약 기간 (년)" type="number" min={1} max={25} value={term} onChange={(e) => setTerm(e.target.value)} required />
          <div className="col-span-2">
            <Textarea label="비고" placeholder="설치 일정, 운영 범위 등" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="min-h-[72px]" />
          </div>
        </div>

        {/* 예상 월 정산 — 용량 × 월 평균 발전량(115 kWh/kW) × 단가 */}
        <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-3 grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-slate-400">예상 월 {kind === 'ONSITE' ? '공급량' : '발전량'}</p>
            <p className="text-base text-white tabular-nums">{cap > 0 ? fmtKwh(estimate.kwh) : '-'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">예상 월 {amountLabel(kind)}</p>
            <p className="text-base text-white tabular-nums">{cap > 0 && unit > 0 ? fmtKrw(estimate.amount) : '-'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">계약 기간 합계</p>
            <p className="text-base text-white tabular-nums">{cap > 0 && unit > 0 ? fmtKrw(estimate.amount * 12 * (Number(term) || 0)) : '-'}</p>
          </div>
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
