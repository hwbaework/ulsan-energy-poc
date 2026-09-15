import type { ReactNode } from 'react';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InvoiceStatusPill, type InvoiceStatus } from './InvoiceStatusPill';
import { Button } from '@/components/ui/Button';

function DetailRow({
  label,
  value,
  valueClass = 'text-white',
}: {
  label: string;
  value: ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className={cn('text-sm tabular-nums text-right', valueClass)}>{value}</span>
    </div>
  );
}

interface Counterparty {
  label: string;
  name: string;
  bizId: string;
  representative?: string;
  address?: string;
  bizType?: string;
  bizCategory?: string;
}

interface AmountRow {
  label: string;
  value: ReactNode;
  valueClass?: string;
}

interface PaymentInfo {
  sectionTitle: string;
  dateLabel: string;
  date: ReactNode;
  statusValue: string;
  statusClass: string;
  accountLabel: string;
  accountValue?: string;
}

export interface InvoiceDetailPanelProps {
  issueMonth: string;
  headerSuffix?: string;
  issuePeriodStart: string;
  issuePeriodEnd: string;
  status: InvoiceStatus;
  statusLabelOverride?: string;
  number: string;
  issueDate: ReactNode;
  type: string;
  counterparty: Counterparty;
  receiver?: Counterparty;
  assetLabel: string;
  assetValue: string;
  amountRows: AmountRow[];
  supplyAmount: number;
  vat: number;
  total: number;
  payment: PaymentInfo;
  /** 하단 액션 영역 커스텀 — 미전달 시 기본 PDF 다운로드 버튼 */
  actions?: ReactNode;
}

export function InvoiceDetailPanel(props: InvoiceDetailPanelProps) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-surface-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-white">
            {props.issueMonth} 세금계산서{props.headerSuffix ? ` ${props.headerSuffix}` : ''}
          </p>
          <p className="mt-0.5 text-xs text-slate-400 tabular-nums">
            발급기간: {props.issuePeriodStart} ~ {props.issuePeriodEnd}
          </p>
        </div>
        <InvoiceStatusPill status={props.status} labelOverride={props.statusLabelOverride} />
      </div>

      {/* 발급정보 */}
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <p className="text-xs font-semibold text-slate-300 mb-2">발급정보</p>
        <DetailRow label="발급번호" value={props.number} />
        <DetailRow label="발급일" value={props.issueDate} />
        <DetailRow label="유형" value={props.type} />
      </div>

      {/* 거래 정보 — 공급자 */}
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <p className="text-xs font-semibold text-slate-300 mb-2">{props.counterparty.label}</p>
        <DetailRow label="상호" value={props.counterparty.name} />
        <DetailRow label="사업자번호" value={props.counterparty.bizId} valueClass="text-slate-300" />
        {props.counterparty.representative && (
          <DetailRow label="대표자" value={props.counterparty.representative} valueClass="text-slate-300" />
        )}
        {props.counterparty.address && (
          <DetailRow label="주소" value={props.counterparty.address} valueClass="text-slate-300" />
        )}
        {props.counterparty.bizType && (
          <DetailRow label="업태" value={props.counterparty.bizType} valueClass="text-slate-300" />
        )}
        {props.counterparty.bizCategory && (
          <DetailRow label="종목" value={props.counterparty.bizCategory} valueClass="text-slate-300" />
        )}
      </div>

      {/* 거래 정보 — 공급받는자 */}
      {props.receiver && (
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <p className="text-xs font-semibold text-slate-300 mb-2">{props.receiver.label}</p>
          <DetailRow label="상호" value={props.receiver.name} />
          <DetailRow label="사업자번호" value={props.receiver.bizId} valueClass="text-slate-300" />
          {props.receiver.representative && (
            <DetailRow label="대표자" value={props.receiver.representative} valueClass="text-slate-300" />
          )}
          {props.receiver.address && (
            <DetailRow label="주소" value={props.receiver.address} valueClass="text-slate-300" />
          )}
          {props.receiver.bizType && (
            <DetailRow label="업태" value={props.receiver.bizType} valueClass="text-slate-300" />
          )}
          {props.receiver.bizCategory && (
            <DetailRow label="종목" value={props.receiver.bizCategory} valueClass="text-slate-300" />
          )}
        </div>
      )}

      {/* 자산 정보 */}
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <DetailRow label={props.assetLabel} value={props.assetValue} valueClass="text-slate-300" />
      </div>

      {/* 금액 */}
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <p className="text-xs font-semibold text-slate-300 mb-2">금액</p>
        {props.amountRows.map((row) => (
          <DetailRow
            key={row.label}
            label={row.label}
            value={row.value}
            valueClass={row.valueClass ?? 'text-slate-300'}
          />
        ))}
        <DetailRow label="공급가액" value={`${props.supplyAmount.toLocaleString()} 원`} valueClass="text-slate-300" />
        <DetailRow label="부가세 (10%)" value={`${props.vat.toLocaleString()} 원`} valueClass="text-slate-300" />
      </div>

      {/* 합계 */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-baseline justify-between bg-white/[0.02]">
        <span className="text-sm font-semibold text-white">합계</span>
        <span className="text-lg font-bold text-white tabular-nums">{props.total.toLocaleString()} 원</span>
      </div>

      {/* 결제/입금 */}
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <p className="text-xs font-semibold text-slate-300 mb-2">{props.payment.sectionTitle}</p>
        <DetailRow label={props.payment.dateLabel} value={props.payment.date} valueClass="text-slate-300" />
        <DetailRow label="상태" value={props.payment.statusValue} valueClass={props.payment.statusClass} />
        {props.payment.accountValue && (
          <DetailRow
            label={props.payment.accountLabel}
            value={props.payment.accountValue}
            valueClass="text-slate-300"
          />
        )}
      </div>

      {/* 액션 — 기본 PDF 다운로드. actions 전달 시 대체 (예: 동의 대기 = 미리보기·동의) */}
      <div className="px-5 py-4">
        {props.actions ?? (
          <Button variant="primary" size="md" className="w-full">
            <Download size={14} className="mr-1.5" />
            PDF 다운로드
          </Button>
        )}
      </div>
    </div>
  );
}
