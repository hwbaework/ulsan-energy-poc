'use client';

import React, { useState } from 'react';
import {
  Plus,
  Zap,
  Search,
  PenLine,
  FileText,
  CheckCircle2,
  Clock,
  X,
  Upload,
  Cable,
  Info,
  Sun,
  Wind,
  Lightbulb,
  Building2,
  Calendar as CalendarIcon,
  Wallet,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { SectionCard } from '@/components/features';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { RmsBarChart } from '@/components/ui/Chart';
import { cn } from '@/lib/utils';

/* ───────────────────────── Types & Mock ───────────────────────── */

type Phase = 'empty' | 'requested' | 'matched' | 'signed';

interface MatchedGenerator {
  id: string;
  type: '태양광' | '풍력' | '연료전지' | 'ESS';
  typeColor: string;
  name: string;
  operator: string;
  location: string;
  capacity: number; // MW
  unitPrice: number; // ₩/kWh
  durationYears: number;
}

const COMPANY_NAME = '울산 에너지 자급자족';
const MARKET_AVG_PRICE = 154;

const MATCHED_GENERATORS: MatchedGenerator[] = [
  {
    id: 'g-1',
    type: '풍력',
    typeColor: 'bg-violet-500/[0.10] text-violet-300 ring-violet-500/30',
    name: '경주 풍력 1호기',
    operator: '경주 윈드㈜',
    location: '경북 경주시',
    capacity: 2.4,
    unitPrice: 132,
    durationYears: 5,
  },
  {
    id: 'g-2',
    type: '태양광',
    typeColor: 'bg-amber-500/[0.10]  text-amber-300  ring-amber-500/30',
    name: '밀양 태양광 단지',
    operator: '밀양솔라㈜',
    location: '경남 밀양시',
    capacity: 1.8,
    unitPrice: 141,
    durationYears: 5,
  },
  {
    id: 'g-3',
    type: '태양광',
    typeColor: 'bg-amber-500/[0.10]  text-amber-300  ring-amber-500/30',
    name: '울진 태양광 2호기',
    operator: '울진그린에너지㈜',
    location: '경북 울진군',
    capacity: 3.5,
    unitPrice: 143,
    durationYears: 5,
  },
];

const TOTAL_CAPACITY = MATCHED_GENERATORS.reduce((s, g) => s + g.capacity, 0);
const AVG_PRICE = Math.round(MATCHED_GENERATORS.reduce((s, g) => s + g.unitPrice, 0) / MATCHED_GENERATORS.length);
const KEPCO_SAVINGS = (((MARKET_AVG_PRICE - AVG_PRICE) / MARKET_AVG_PRICE) * 100).toFixed(1);

/* Hourly price chart (24 hours) */
const HOURLY_PRICES = Array.from({ length: 24 }, (_, i) => ({
  hour: String(i).padStart(2, '0'),
  price: Math.round(115 + Math.sin(((i - 6) / 12) * Math.PI) * 30 + Math.random() * 6),
}));

/* Process steps for requested phase */
const PROCESS_STEPS = ['신청 접수', '매칭 진행 중', '발전 사업자 승인', '패키지 산출', '매칭 완료'];

/* ───────────────────────── Goal Modal ───────────────────────── */

type AutoProfile = 'front' | 'middle' | 'back';

type MatchingMode = 'auto' | 'group6h' | 'hourly' | 'excel' | 'kepco';

interface GoalForm {
  // 대상 사업장
  siteId: string;
  // 계약 조건
  desiredCapacity: number;
  currentContractCapacity: number;
  durationYears: 5 | 10 | 15 | 20;
  startDate: string;
  desiredUnitPrice: number;
  matchingMode: MatchingMode;
  autoProfile: AutoProfile;
  group6h: [number, number, number, number];
  hourly: number[];
  settlementCycle: 'monthly' | 'quarterly' | 'yearly';
  paymentDay: number;
}

// 등록된 사업장 목록 (mock — 실서비스에선 API로)
interface AvailableSite {
  id: string;
  label: string;
  location: string;
  currentPpaCount: number;
}

const AVAILABLE_SITES: AvailableSite[] = [
  { id: 'site-a', label: '사업장 A', location: '서울 본사', currentPpaCount: 2 },
  { id: 'site-b', label: '사업장 B', location: '수원 공장', currentPpaCount: 1 },
  { id: 'site-c', label: '사업장 C', location: '부산 물류', currentPpaCount: 2 },
];

// 100 MWh 기준의 일반적 시간대별 분포 합계 ≈ 100
const DEFAULT_HOURLY_MWH = [
  2.0, 1.8, 1.6, 1.5, 1.6, 2.0, 3.5, 5.0, 6.0, 6.2, 6.0, 5.8, 6.5, 6.8, 6.5, 5.8, 5.2, 5.0, 4.8, 4.2, 3.8, 3.2, 2.8,
  2.4,
];

const DEFAULT_GOAL: GoalForm = {
  siteId: AVAILABLE_SITES[0]?.id ?? '',
  desiredCapacity: 100,
  currentContractCapacity: 800,
  durationYears: 5,
  startDate: '2026-05-01',
  desiredUnitPrice: 140,
  matchingMode: 'auto',
  autoProfile: 'middle',
  group6h: [10, 30, 35, 25],
  hourly: DEFAULT_HOURLY_MWH,
  settlementCycle: 'monthly',
  paymentDay: 10,
};

const MIN_CONTRACT_CAPACITY_KW = 300;

const AUTO_PROFILES: { value: AutoProfile; label: string; points: number[] }[] = [
  { value: 'front', label: '앞이 높은 표', points: [95, 88, 78, 60, 42, 28] },
  { value: 'middle', label: '중간이 높은 표', points: [30, 60, 90, 92, 70, 38] },
  { value: 'back', label: '뒤가 높은 표', points: [25, 38, 55, 72, 88, 95] },
];

function ProfileLine({ points, active }: { points: number[]; active: boolean }) {
  const w = 120;
  const h = 40;
  const max = 100;
  const step = w / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${(h - (p / max) * (h - 4) - 2).toFixed(2)}`)
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={active ? 'text-primary' : 'text-slate-500'}>
      <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={i * step} cy={h - (p / max) * (h - 4) - 2} r={1.8} fill="currentColor" />
      ))}
    </svg>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-md font-semibold text-white border-b border-white/[0.08] pb-2">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="flex items-center justify-between text-xs text-slate-400">
        <span>{label}</span>
        {hint && <span className="text-slate-500">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function PillRadio<V extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg bg-white/[0.04] p-1 ring-1 ring-white/[0.06]">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded transition-colors',
            size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            o.value === value ? 'bg-primary text-white font-medium' : 'text-slate-400 hover:text-white',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function GoalModal({
  open,
  onClose,
  onSubmit,
  mode = 'create',
  initialValues,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (form: GoalForm) => void;
  mode?: 'create' | 'edit';
  initialValues?: Partial<GoalForm>;
}) {
  const [form, setForm] = useState<GoalForm>({ ...DEFAULT_GOAL, ...initialValues });

  // initialValues가 바뀌면 (다른 계약을 수정하려고 모달을 다시 열 때) 폼 리셋
  React.useEffect(() => {
    if (open) setForm({ ...DEFAULT_GOAL, ...initialValues });
  }, [open, initialValues]);

  const update = <K extends keyof GoalForm>(k: K, v: GoalForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const group6hSum = form.group6h.reduce((s, v) => s + v, 0);
  const hourlySum = form.hourly.reduce((s, v) => s + v, 0);
  const priceDiff = form.desiredUnitPrice - MARKET_AVG_PRICE;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Offsite PPA — 신청 수정' : 'Offsite PPA — 전력목표 설정'}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={() => onSubmit(form)}>
            <Plus size={14} className="mr-1.5" />
            {mode === 'edit' ? '수정 완료' : '신청하기'}
          </Button>
        </>
      }
    >
      <div className="max-h-[70vh] overflow-y-auto space-y-6 -mx-6 px-6 pb-2">
        {/* 유형 안내 — Lease 문의 모달과 동일한 헤더 배너 */}
        <div className="rounded-lg ring-1 ring-blue-500/30 bg-blue-500/[0.06] px-4 py-3">
          <p className="text-sm font-semibold text-blue-300">Offsite PPA</p>
          <p className="text-xs text-slate-300 mt-0.5">
            발전사가 외부 발전소 → 망 경유로 전력 공급 · 24/7 CFE 매칭률 산출 · 5/10/15/20년 장기 계약
          </p>
        </div>

        {/* 1. 대상 사업장 — 단일 선택 */}
        <FormSection title="① 대상 사업장">
          <Field label="사업장 *">
            <select
              value={form.siteId}
              onChange={(e) => update('siteId', e.target.value)}
              className="w-full h-9 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 text-sm text-white focus:outline-none focus:ring-primary"
            >
              {AVAILABLE_SITES.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#0d1520]">
                  {s.label} — {s.location} (현재 PPA {s.currentPpaCount}개)
                </option>
              ))}
            </select>
          </Field>
        </FormSection>

        {/* 2. 사업장 정보 */}
        <FormSection title="② 사업장 정보">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="회사이름">
              <Input value={COMPANY_NAME} disabled />
            </Field>
            <Field label="수요희망 용량 (MWh)">
              <Input
                type="number"
                value={form.desiredCapacity}
                onChange={(e) => update('desiredCapacity', Number(e.target.value))}
              />
              <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-primary/[0.10] px-2 py-1 text-xs font-medium text-primary ring-1 ring-primary/30">
                <Info size={12} />
                한달 전기 사용량을 입력하세요.
              </p>
            </Field>
            <Field
              label="현재 계약 전력 (kW)"
              hint={<span className="text-slate-500">법적 최소 {MIN_CONTRACT_CAPACITY_KW}kW</span>}
            >
              <Input
                type="number"
                min={MIN_CONTRACT_CAPACITY_KW}
                value={form.currentContractCapacity}
                onChange={(e) => update('currentContractCapacity', Number(e.target.value))}
                onBlur={() => {
                  if (form.currentContractCapacity < MIN_CONTRACT_CAPACITY_KW) {
                    update('currentContractCapacity', MIN_CONTRACT_CAPACITY_KW);
                  }
                }}
              />
              {form.currentContractCapacity < MIN_CONTRACT_CAPACITY_KW && (
                <p className="text-[11px] text-rose-400 mt-1">최소 {MIN_CONTRACT_CAPACITY_KW}kW 이상 입력해주세요.</p>
              )}
            </Field>
          </div>
        </FormSection>

        {/* 2. 계약 조건 */}
        <FormSection title="③ 계약 조건">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="계약 희망 기간">
              <PillRadio
                options={[
                  { value: 5, label: '5년' },
                  { value: 10, label: '10년' },
                  { value: 15, label: '15년' },
                  { value: 20, label: '20년' },
                ]}
                value={form.durationYears}
                onChange={(v) => update('durationYears', v)}
                size="sm"
              />
            </Field>
            <Field label="계약 개시 희망일">
              <Input type="date" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} />
            </Field>
            <Field
              label="희망 kWh당 단가 (원)"
              hint={
                <span>
                  시장 평균 <span className="text-white tabular-nums">{MARKET_AVG_PRICE}원</span>
                </span>
              }
            >
              <div className="relative">
                <Input
                  type="number"
                  value={form.desiredUnitPrice}
                  onChange={(e) => update('desiredUnitPrice', Number(e.target.value))}
                />
                <span
                  className={cn(
                    'absolute right-3 top-1/2 -translate-y-1/2 text-[10px] tabular-nums',
                    priceDiff < 0 ? 'text-emerald-400' : 'text-amber-400',
                  )}
                >
                  {priceDiff >= 0 ? '+' : ''}
                  {priceDiff}
                </span>
              </div>
            </Field>
          </div>
        </FormSection>

        {/* 3. 24/7 매칭 */}
        <FormSection title="④ 24/7 매칭 목표">
          <PillRadio
            options={[
              { value: 'auto', label: '시스템 자동 추천' },
              { value: 'group6h', label: '6시간 그룹별' },
              { value: 'hourly', label: '시간 단위 (고급)' },
              { value: 'excel', label: '엑셀 업로드' },
              { value: 'kepco', label: '한전 API 연동' },
            ]}
            value={form.matchingMode}
            onChange={(v) => update('matchingMode', v)}
          />

          {form.matchingMode === 'auto' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06] px-3 py-2 text-xs">
                <span className="inline-flex items-center gap-1.5 text-slate-300">
                  <Sparkles size={12} className="text-emerald-400" />
                  수요희망 용량 기준 매칭 패턴
                </span>
                <span className="text-white font-semibold tabular-nums">{form.desiredCapacity} MWh</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {AUTO_PROFILES.map((p) => {
                  const active = form.autoProfile === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => update('autoProfile', p.value)}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-lg border px-3 py-3 transition-colors',
                        active
                          ? 'border-primary bg-primary/[0.08]'
                          : 'border-white/10 bg-white/[0.02] hover:border-white/20',
                      )}
                    >
                      <ProfileLine points={p.points} active={active} />
                      <span className={cn('text-xs', active ? 'text-white font-medium' : 'text-slate-300')}>
                        {p.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {form.matchingMode === 'group6h' && (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2">
                {(['새벽 0~6', '오전 6~12', '오후 12~18', '야간 18~24'] as const).map((label, i) => (
                  <Field key={label} label={`${label} (MWh)`}>
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      value={form.group6h[i]}
                      onChange={(e) => {
                        const next = [...form.group6h] as typeof form.group6h;
                        next[i] = Number(e.target.value);
                        update('group6h', next);
                      }}
                    />
                  </Field>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06] px-3 py-2 text-xs">
                <span className="text-slate-400">합계</span>
                <span className="text-white font-semibold tabular-nums">
                  {group6hSum.toFixed(1)} MWh
                  <span className="ml-2 text-slate-500">/ 수요희망 {form.desiredCapacity} MWh</span>
                </span>
              </div>
            </div>
          )}

          {form.matchingMode === 'hourly' && (
            <div className="rounded-lg border border-white/[0.06] p-3 space-y-2">
              <p className="text-xs text-slate-500">24시간 시간대별 매칭 용량 (MWh)</p>
              <div className="grid grid-cols-12 gap-1">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="space-y-0.5">
                    <p className="text-[10px] text-slate-600 text-center tabular-nums">{h}</p>
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      value={form.hourly[h]}
                      onChange={(e) => {
                        const next = [...form.hourly];
                        next[h] = Number(e.target.value);
                        update('hourly', next);
                      }}
                      className="h-7 px-1.5 text-[10px] text-center"
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06] px-3 py-2 text-xs">
                <span className="text-slate-400">합계</span>
                <span className="text-white font-semibold tabular-nums">
                  {hourlySum.toFixed(1)} MWh
                  <span className="ml-2 text-slate-500">/ 수요희망 {form.desiredCapacity} MWh</span>
                </span>
              </div>
            </div>
          )}

          {form.matchingMode === 'excel' && (
            <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center">
              <Upload size={20} className="mx-auto text-slate-500 mb-2" />
              <p className="text-xs text-slate-300">엑셀 파일 업로드 (1시간 단위, .xlsx)</p>
              <p className="text-[11px] text-slate-500 mt-1">A열: 시간(0~23) · B열: 매칭 용량(MWh) — 24행</p>
              <Button variant="ghost" size="sm" className="mt-3">
                파일 선택
              </Button>
            </div>
          )}

          {form.matchingMode === 'kepco' && (
            <div className="rounded-lg bg-emerald-500/[0.06] ring-1 ring-emerald-500/20 px-3 py-3 text-xs text-emerald-200/80 space-y-2">
              <div>
                <Cable size={12} className="inline mr-1" />
                한전 마이데이터 API 연동 시, 최근 12개월 시간대별 사용량(MWh)이 자동 수집되어 24시간 매칭 패턴으로
                변환됩니다.
              </div>
              <Button variant="primary" size="sm">
                한전 API 연결하기
              </Button>
            </div>
          )}

          {(form.matchingMode === 'group6h' || form.matchingMode === 'hourly') && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/[0.06] ring-1 ring-amber-500/20 px-3 py-2 text-[11px] text-amber-200/80">
              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-400" />
              <span>
                해당 구간에서 계약 가능한 최대 용량까지만 설정됩니다. 야간 시간은 연료전지 잔여 용량 기준으로 자동
                제한됩니다.
              </span>
            </div>
          )}
        </FormSection>

        {/* 4. 계약서 요청사항 */}
        <FormSection title="⑤ 계약서 요청사항">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="정산주기">
              <PillRadio
                options={[
                  { value: 'monthly', label: '월별' },
                  { value: 'quarterly', label: '분기별' },
                  { value: 'yearly', label: '연도별' },
                ]}
                value={form.settlementCycle}
                onChange={(v) => update('settlementCycle', v)}
                size="sm"
              />
            </Field>
            <Field label="입금 예정일자 (매월 N일)">
              <Input
                type="number"
                min={1}
                max={28}
                value={form.paymentDay}
                onChange={(e) => update('paymentDay', Number(e.target.value))}
              />
            </Field>
          </div>
        </FormSection>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Cancel Modal ───────────────────────── */

const CANCEL_REASONS = [
  { value: 'condition', label: '조건 변경' },
  { value: 'price', label: '단가 부적절' },
  { value: 'type', label: '발전 유형 변경' },
  { value: 'other', label: '기타' },
] as const;

function CancelModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string, detail: string) => void;
}) {
  const [reason, setReason] = useState<string>('condition');
  const [detail, setDetail] = useState('');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="계약 요청 취소"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            돌아가기
          </Button>
          <Button variant="danger" onClick={() => onConfirm(reason, detail)} disabled={!detail.trim()}>
            요청 취소
          </Button>
        </>
      }
    >
      <p className="text-xs text-slate-400 mb-4">취소 사유를 입력해주세요. 향후 매칭 개선에 활용됩니다.</p>
      <div className="space-y-4">
        <Field label="사유 (선택)">
          <div className="grid grid-cols-2 gap-2">
            {CANCEL_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm transition-colors',
                  reason === r.value
                    ? 'border-primary bg-primary/[0.08] text-white'
                    : 'border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="상세 내용 *">
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="구체적인 취소 사유를 입력해주세요"
            rows={4}
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Sign Modal ───────────────────────── */

function SignModal({
  open,
  onClose,
  onSign,
}: {
  open: boolean;
  onClose: () => void;
  onSign: (signerName: string) => void;
}) {
  const [agreePpa, setAgreePpa] = useState(false);
  const [agreeSign, setAgreeSign] = useState(false);
  const [signer, setSigner] = useState('홍길동');
  const canSign = agreePpa && agreeSign && signer.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="계약 확정 · 전자서명"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={() => onSign(signer)} disabled={!canSign}>
            <PenLine size={14} className="mr-1.5" />
            서명하고 계약 체결
          </Button>
        </>
      }
    >
      <p className="text-xs text-slate-400 mb-4">선택하신 발전사들과 계약을 체결합니다.</p>
      <div className="space-y-5">
        {/* 선택 발전사 */}
        <div>
          <p className="text-xs font-semibold text-slate-300 mb-2">선택 발전사</p>
          <div className="space-y-2">
            {MATCHED_GENERATORS.map((g) => (
              <div
                key={g.id}
                className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] p-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/[0.10]">
                  <Zap size={14} className="text-amber-400" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{g.name}</p>
                  <p className="text-[11px] text-slate-500">{g.operator}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-white tabular-nums">{g.capacity} MW</p>
                  <p className="text-[11px] text-slate-400 tabular-nums">{g.unitPrice}원/kWh</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 계약 요약 */}
        <div>
          <p className="text-xs font-semibold text-slate-300 mb-2">계약 요약</p>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
            <div className="flex justify-between px-3 py-2 text-sm">
              <span className="text-slate-400">사업장</span>
              <span className="text-white">부산물류센터</span>
            </div>
            <div className="flex justify-between px-3 py-2 text-sm">
              <span className="text-slate-400">총 계약 용량</span>
              <span className="text-white tabular-nums">100 kW</span>
            </div>
            <div className="flex justify-between px-3 py-2 text-sm">
              <span className="text-slate-400">예상 평균 단가</span>
              <span className="text-white tabular-nums">평균 {AVG_PRICE}원/kWh</span>
            </div>
            <div className="flex justify-between px-3 py-2 text-sm">
              <span className="text-slate-400">계약 기간</span>
              <span className="text-white tabular-nums">5년 (2026.05 ~ 2031.04)</span>
            </div>
          </div>
        </div>

        {/* 동의 */}
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={agreePpa}
              onChange={(e) => setAgreePpa(e.target.checked)}
              className="mt-0.5 cursor-pointer accent-primary"
            />
            위 계약 조건을 확인했으며 PPA 계약 체결에 동의합니다.
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeSign}
              onChange={(e) => setAgreeSign(e.target.checked)}
              className="mt-0.5 cursor-pointer accent-primary"
            />
            전자서명법에 따른 전자서명에 동의합니다.
          </label>
        </div>

        {/* 서명자 */}
        <Field label="서명자 성명">
          <Input value={signer} onChange={(e) => setSigner(e.target.value)} placeholder="홍길동" />
        </Field>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Phase: Empty ───────────────────────── */

export function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-surface-card p-12">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/[0.10] ring-1 ring-amber-500/30 mb-4">
          <Zap size={28} className="text-amber-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">아직 진행 중인 계약 요청이 없습니다</h2>
        <p className="mt-2 text-sm text-slate-400">
          원하시는 용량과 조건을 입력하시면 매칭 가능한 발전사를 제안해드립니다.
          <br />
          24/7 매칭, 발전 유형, 사업장별 분배까지 한번에.
        </p>
        <Button variant="primary" size="lg" onClick={onStart} className="mt-6">
          <Plus size={16} className="mr-1.5" />
          신규 계약 요청 시작하기
        </Button>

        <div className="mt-8 w-full pt-8 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { icon: PenLine, label: '조건 입력', desc: '용량 / 사업장 / 24/7' },
            { icon: Search, label: '발전사 매칭', desc: '조건에 맞는 후보 추천' },
            { icon: FileText, label: '전자서명', desc: '계약 즉시 체결' },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <s.icon size={20} className="text-primary mb-1" />
              <p className="text-sm font-semibold text-white">{s.label}</p>
              <p className="text-xs text-slate-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Phase: Requested ───────────────────────── */

function RequestedState({ onAdvance }: { onAdvance: () => void }) {
  const currentStep = 2; // 매칭 진행 중

  return (
    <div className="rounded-xl border border-white/[0.06] bg-surface-card p-8 space-y-8">
      <div className="text-center">
        <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-blue-500/[0.10] ring-1 ring-blue-500/30 mb-3 animate-pulse">
          <Clock size={24} className="text-blue-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">신청이 접수되었습니다</h2>
        <p className="mt-2 text-sm text-slate-400">
          매칭이 완료되면 이메일 + 플랫폼 알림으로 안내드립니다. 마이페이지에서 진행 상황을 실시간으로 확인할 수
          있습니다.
        </p>
      </div>

      {/* Process tracker */}
      <div className="px-4 py-2">
        <div className="flex items-center">
          {PROCESS_STEPS.map((label, i) => {
            const stepNum = i + 1;
            const done = stepNum < currentStep;
            const active = stepNum === currentStep;
            return (
              <div key={label} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold tabular-nums ring-2',
                      done && 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/40',
                      active && 'bg-primary text-white ring-primary animate-pulse',
                      !done && !active && 'bg-white/[0.04] text-slate-600 ring-white/[0.08]',
                    )}
                  >
                    {done ? <CheckCircle2 size={16} /> : stepNum}
                  </div>
                  <span className={cn('text-xs text-center', active ? 'text-white font-medium' : 'text-slate-500')}>
                    {label}
                  </span>
                </div>
                {i < PROCESS_STEPS.length - 1 && (
                  <div
                    className={cn(
                      'h-px flex-1 mx-1 mb-7',
                      stepNum < currentStep ? 'bg-emerald-500/40' : 'bg-white/[0.06]',
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={onAdvance}>
          [데모] 매칭 완료 단계로 이동 →
        </Button>
      </div>
    </div>
  );
}

/* ───────────────────────── Phase: Matched ───────────────────────── */

function MatchedState({ onProceed, onCancel }: { onProceed: () => void; onCancel: () => void }) {
  return (
    <div className="space-y-6">
      {/* Request banner */}
      <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/[0.10] ring-1 ring-primary/30">
          <FileText size={16} className="text-primary" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary">신규 계약 요청 접수</p>
          <p className="text-sm text-white mt-0.5">부산물류센터 · 100 kW · 24/7 매칭 희망</p>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
            <span>선호 유형:</span>
            <span className="inline-flex items-center gap-1 text-amber-300">
              <Sun size={10} /> 태양광
            </span>
            <span className="text-slate-600">·</span>
            <span className="inline-flex items-center gap-1 text-violet-300">
              <Wind size={10} /> 풍력
            </span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-rose-300 hover:text-rose-200 hover:bg-rose-500/[0.08]"
        >
          <X size={14} className="mr-1" />
          요청 취소
        </Button>
      </div>

      {/* Chart + Summary */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <SectionCard
            title="분석실 · 시간대별 단가 추이"
            actions={<span className="text-[11px] text-slate-500">단위: 원/kWh</span>}
          >
            <div className="px-2 pt-2">
              <RmsBarChart
                data={HOURLY_PRICES}
                xKey="hour"
                bars={[{ key: 'price', name: '단가 (원/kWh)', color: '#06B6D4' }]}
                height={260}
              />
            </div>
          </SectionCard>
        </div>

        <SectionCard title="매칭 결과 요약">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">매칭된 발전사</span>
              <span className="text-white font-semibold tabular-nums">{MATCHED_GENERATORS.length} 곳</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">총 가용 용량</span>
              <span className="text-white font-semibold tabular-nums">{TOTAL_CAPACITY.toFixed(1)} MW</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">예상 평균 단가</span>
              <span className="text-emerald-400 font-semibold tabular-nums">{AVG_PRICE}원/kWh</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">한전 대비 절감</span>
              <span className="text-emerald-400 font-semibold tabular-nums">{KEPCO_SAVINGS}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">24/7 매칭률</span>
              <span className="text-white font-semibold tabular-nums">94%</span>
            </div>
          </div>
          <div className="px-6 pb-4">
            <Button variant="primary" size="lg" onClick={onProceed} className="w-full">
              <PenLine size={14} className="mr-1.5" />이 매칭으로 계약 진행
            </Button>
          </div>
        </SectionCard>
      </div>

      {/* Matched generators */}
      <SectionCard
        title={`매칭된 발전사`}
        description={`태양광 ${MATCHED_GENERATORS.filter((g) => g.type === '태양광').length} + 풍력 ${MATCHED_GENERATORS.filter((g) => g.type === '풍력').length}`}
      >
        <div className="px-6 pt-2 pb-3">
          <p className="text-xs text-slate-500">
            <Lightbulb size={11} className="inline mr-1 text-amber-400" />
            시스템 매칭 결과 · 발전사들과 사전 커넥된 상태이므로 선택은 불가하며 일괄 진행됩니다.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 px-6 pb-6">
          {MATCHED_GENERATORS.map((g) => (
            <div key={g.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
                  g.typeColor,
                )}
              >
                {g.type}
              </span>
              <div>
                <p className="text-base font-semibold text-white">{g.name}</p>
                <p className="text-xs text-slate-500">
                  {g.operator} · {g.location}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.06] text-xs">
                <div>
                  <p className="text-slate-500">용량</p>
                  <p className="text-white font-semibold tabular-nums mt-0.5">{g.capacity} MW</p>
                </div>
                <div>
                  <p className="text-slate-500">단가</p>
                  <p className="text-emerald-400 font-semibold tabular-nums mt-0.5">{g.unitPrice}원/kWh</p>
                </div>
                <div>
                  <p className="text-slate-500">기간</p>
                  <p className="text-white font-semibold tabular-nums mt-0.5">{g.durationYears}년</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Phase: Signed ───────────────────────── */

function SignedState({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-12">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/[0.10] ring-1 ring-emerald-500/30 mb-4">
          <CheckCircle2 size={28} className="text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold text-white">계약이 체결되었습니다</h2>
        <p className="mt-2 text-sm text-slate-400">
          전자서명이 완료되어 거래소에 제출되었습니다. 잠시 후 PPA 메뉴 전체에서 새 계약을 확인할 수 있습니다.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-3 text-xs">
          {[
            { icon: Building2, label: '사업장', value: '부산물류센터' },
            { icon: Wallet, label: '평균 단가', value: `${AVG_PRICE}원/kWh` },
            { icon: CalendarIcon, label: '계약 기간', value: '5년' },
          ].map((m) => (
            <div key={m.label} className="rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-3">
              <m.icon size={14} className="mx-auto text-emerald-400 mb-1" />
              <p className="text-slate-500">{m.label}</p>
              <p className="text-sm text-white font-semibold mt-0.5">{m.value}</p>
            </div>
          ))}
        </div>
        <Button variant="primary" size="lg" onClick={onContinue} className="mt-6">
          계약 목록으로 돌아가기
        </Button>
      </div>
    </div>
  );
}

/* ───────────────────────── Main Component ───────────────────────── */

export default function NewContractWizard({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<Phase>('empty');
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);

  const handleSubmit = () => {
    setShowGoalModal(false);
    setPhase('requested');
  };
  const handleCancelConfirm = () => {
    setShowCancelModal(false);
    setPhase('empty');
  };
  const handleSign = () => {
    setShowSignModal(false);
    setPhase('signed');
  };

  return (
    <div className="space-y-6 animate-[fadeIn_300ms_ease-out]">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">신규 계약 요청</h2>
          <p className="mt-1 text-sm text-slate-400">신규 PPA 계약 요청 · 발전사 매칭 · 전자서명</p>
        </div>
        {phase === 'empty' && (
          <Button variant="primary" size="md" onClick={() => setShowGoalModal(true)}>
            <Plus size={16} className="mr-1.5" />
            신규 계약 요청
          </Button>
        )}
      </div>

      {/* Phase content */}
      {phase === 'empty' && <EmptyState onStart={() => setShowGoalModal(true)} />}
      {phase === 'requested' && <RequestedState onAdvance={() => setPhase('matched')} />}
      {phase === 'matched' && (
        <MatchedState onProceed={() => setShowSignModal(true)} onCancel={() => setShowCancelModal(true)} />
      )}
      {phase === 'signed' && <SignedState onContinue={onComplete} />}

      {/* Modals */}
      <GoalModal open={showGoalModal} onClose={() => setShowGoalModal(false)} onSubmit={handleSubmit} />
      <CancelModal open={showCancelModal} onClose={() => setShowCancelModal(false)} onConfirm={handleCancelConfirm} />
      <SignModal open={showSignModal} onClose={() => setShowSignModal(false)} onSign={handleSign} />
    </div>
  );
}
