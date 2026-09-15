import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Party {
  name: string;
  bizNo: string;
  representative?: string;
  address?: string;
  bizType?: string;
  bizCategory?: string;
}

interface LineItem {
  month: string;
  day: string;
  description: string;
  spec?: string;
  quantity?: number | string;
  unitPrice?: number | string;
  supplyAmount: number;
  tax: number;
  note?: string;
}

export interface TaxInvoicePreviewProps {
  title?: string;
  issueDate?: string;
  invoiceNumber?: string;
  supplier: Party;
  receiver: Party;
  items: LineItem[];
  supplyTotal: number;
  vatTotal: number;
  grandTotal: number;
  payment?: {
    cash?: number;
    check?: number;
    note?: number;
    credit?: number;
  };
  receiptOrClaim?: 'receipt' | 'claim';
  footer?: ReactNode;
  className?: string;
}

function Cell({
  children,
  className,
  colSpan,
  rowSpan,
}: {
  children?: ReactNode;
  className?: string;
  colSpan?: number;
  rowSpan?: number;
}) {
  return (
    <td colSpan={colSpan} rowSpan={rowSpan} className={cn('border border-slate-600/60 px-2 py-1.5 text-xs', className)}>
      {children}
    </td>
  );
}

function HeaderCell({
  children,
  className,
  colSpan,
  rowSpan,
}: {
  children?: ReactNode;
  className?: string;
  colSpan?: number;
  rowSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      rowSpan={rowSpan}
      className={cn(
        'border border-slate-600/60 px-2 py-1.5 text-[11px] text-slate-400 text-center whitespace-nowrap bg-white/[0.02]',
        className,
      )}
    >
      {children}
    </td>
  );
}

function fmt(n: number) {
  return n.toLocaleString('ko-KR');
}

export function TaxInvoicePreview(props: TaxInvoicePreviewProps) {
  const {
    title = '세 금 계 산 서',
    issueDate,
    invoiceNumber,
    supplier,
    receiver,
    items,
    supplyTotal,
    vatTotal,
    grandTotal,
    payment,
    receiptOrClaim = 'claim',
    footer,
    className,
  } = props;

  const parsedDate = issueDate ? new Date(issueDate) : null;
  const yr = parsedDate ? String(parsedDate.getFullYear()) : '';
  const mo = parsedDate ? String(parsedDate.getMonth() + 1).padStart(2, '0') : '';
  const dy = parsedDate ? String(parsedDate.getDate()).padStart(2, '0') : '';

  return (
    <div className={cn('rounded-lg bg-[#0d1520] ring-1 ring-white/10 p-5 overflow-x-auto', className)}>
      {/* Title */}
      <div className="text-center mb-1">
        <h3 className="text-base font-bold text-white tracking-[0.3em]">{title}</h3>
        {invoiceNumber && <p className="text-[10px] text-slate-500 mt-0.5">No. {invoiceNumber}</p>}
      </div>

      <table className="w-full border-collapse text-white min-w-[600px]">
        <tbody>
          {/* ── 공급자 / 공급받는자 ── */}
          <tr>
            <HeaderCell rowSpan={4} className="w-8 text-center font-semibold bg-blue-500/[0.06]">
              공<br />급<br />자
            </HeaderCell>
            <HeaderCell className="w-20">등록번호</HeaderCell>
            <Cell colSpan={3} className="tabular-nums text-slate-300">
              {supplier.bizNo}
            </Cell>
            <HeaderCell rowSpan={4} className="w-8 text-center font-semibold bg-emerald-500/[0.06]">
              공<br />급<br />받<br />는<br />자
            </HeaderCell>
            <HeaderCell className="w-20">등록번호</HeaderCell>
            <Cell colSpan={3} className="tabular-nums text-slate-300">
              {receiver.bizNo}
            </Cell>
          </tr>
          <tr>
            <HeaderCell>
              상호
              <br />
              <span className="text-[9px]">(법인명)</span>
            </HeaderCell>
            <Cell className="text-white font-medium">{supplier.name}</Cell>
            <HeaderCell>성명</HeaderCell>
            <Cell className="text-slate-300">{supplier.representative ?? '—'}</Cell>
            <HeaderCell>
              상호
              <br />
              <span className="text-[9px]">(법인명)</span>
            </HeaderCell>
            <Cell className="text-white font-medium">{receiver.name}</Cell>
            <HeaderCell>성명</HeaderCell>
            <Cell className="text-slate-300">{receiver.representative ?? '—'}</Cell>
          </tr>
          <tr>
            <HeaderCell>
              사업장
              <br />
              주소
            </HeaderCell>
            <Cell colSpan={3} className="text-slate-400 text-[11px]">
              {supplier.address ?? '—'}
            </Cell>
            <HeaderCell>
              사업장
              <br />
              주소
            </HeaderCell>
            <Cell colSpan={3} className="text-slate-400 text-[11px]">
              {receiver.address ?? '—'}
            </Cell>
          </tr>
          <tr>
            <HeaderCell>업태</HeaderCell>
            <Cell className="text-slate-400">{supplier.bizType ?? '—'}</Cell>
            <HeaderCell>종목</HeaderCell>
            <Cell className="text-slate-400">{supplier.bizCategory ?? '—'}</Cell>
            <HeaderCell>업태</HeaderCell>
            <Cell className="text-slate-400">{receiver.bizType ?? '—'}</Cell>
            <HeaderCell>종목</HeaderCell>
            <Cell className="text-slate-400">{receiver.bizCategory ?? '—'}</Cell>
          </tr>

          {/* ── 작성일 / 공급가액 / 세액 요약 ── */}
          <tr className="bg-white/[0.02]">
            <HeaderCell colSpan={2}>작성일</HeaderCell>
            <HeaderCell colSpan={4}>공급가액</HeaderCell>
            <HeaderCell colSpan={3}>세액</HeaderCell>
            <HeaderCell>비고</HeaderCell>
          </tr>
          <tr>
            <Cell colSpan={2} className="text-center tabular-nums text-slate-300">
              {yr && `${yr}.${mo}.${dy}`}
            </Cell>
            <Cell colSpan={4} className="text-right font-semibold text-emerald-300 tabular-nums">
              ₩{fmt(supplyTotal)}
            </Cell>
            <Cell colSpan={3} className="text-right tabular-nums text-slate-300">
              ₩{fmt(vatTotal)}
            </Cell>
            <Cell className="text-slate-500 text-[10px]"></Cell>
          </tr>

          {/* ── 품목 테이블 헤더 ── */}
          <tr className="bg-white/[0.02]">
            <HeaderCell>월</HeaderCell>
            <HeaderCell>일</HeaderCell>
            <HeaderCell colSpan={2}>품목</HeaderCell>
            <HeaderCell>규격</HeaderCell>
            <HeaderCell>수량</HeaderCell>
            <HeaderCell>단가</HeaderCell>
            <HeaderCell>공급가액</HeaderCell>
            <HeaderCell>세액</HeaderCell>
            <HeaderCell>비고</HeaderCell>
          </tr>

          {/* ── 품목 행 ── */}
          {items.map((item, idx) => (
            <tr key={idx}>
              <Cell className="text-center tabular-nums text-slate-400">{item.month}</Cell>
              <Cell className="text-center tabular-nums text-slate-400">{item.day}</Cell>
              <Cell colSpan={2} className="text-white">
                {item.description}
              </Cell>
              <Cell className="text-slate-400 text-center">{item.spec ?? ''}</Cell>
              <Cell className="text-right tabular-nums text-slate-300">{item.quantity ?? ''}</Cell>
              <Cell className="text-right tabular-nums text-slate-300">
                {typeof item.unitPrice === 'number' ? `₩${fmt(item.unitPrice)}` : (item.unitPrice ?? '')}
              </Cell>
              <Cell className="text-right tabular-nums text-emerald-300 font-medium">₩{fmt(item.supplyAmount)}</Cell>
              <Cell className="text-right tabular-nums text-slate-300">₩{fmt(item.tax)}</Cell>
              <Cell className="text-slate-500 text-[10px]">{item.note ?? ''}</Cell>
            </tr>
          ))}

          {/* 빈 행 (최소 4행 채우기) */}
          {Array.from({ length: Math.max(0, 4 - items.length) }).map((_, i) => (
            <tr key={`empty-${i}`}>
              <Cell className="py-2.5">&nbsp;</Cell>
              <Cell>&nbsp;</Cell>
              <Cell colSpan={2}>&nbsp;</Cell>
              <Cell>&nbsp;</Cell>
              <Cell>&nbsp;</Cell>
              <Cell>&nbsp;</Cell>
              <Cell>&nbsp;</Cell>
              <Cell>&nbsp;</Cell>
              <Cell>&nbsp;</Cell>
            </tr>
          ))}

          {/* ── 합계 / 결제수단 / 영수·청구 ── */}
          <tr className="bg-white/[0.03]">
            <HeaderCell colSpan={2} className="font-semibold text-white bg-blue-500/[0.06]">
              합계금액
            </HeaderCell>
            <HeaderCell>현금</HeaderCell>
            <HeaderCell>수표</HeaderCell>
            <HeaderCell>어음</HeaderCell>
            <HeaderCell colSpan={2}>외상미수금</HeaderCell>
            <Cell colSpan={3} rowSpan={2} className="text-center align-middle">
              <span className="text-xs text-slate-400">이 금액을 </span>
              <span
                className={cn(
                  'text-sm font-bold mx-1',
                  receiptOrClaim === 'receipt' ? 'text-emerald-300' : 'text-blue-300',
                )}
              >
                {receiptOrClaim === 'receipt' ? '영수' : '청구'}
              </span>
              <span className="text-xs text-slate-400"> 함</span>
            </Cell>
          </tr>
          <tr className="bg-white/[0.03]">
            <Cell colSpan={2} className="text-right font-bold text-lg text-white tabular-nums">
              ₩{fmt(grandTotal)}
            </Cell>
            <Cell className="text-right tabular-nums text-slate-400">
              {payment?.cash ? `₩${fmt(payment.cash)}` : ''}
            </Cell>
            <Cell className="text-right tabular-nums text-slate-400">
              {payment?.check ? `₩${fmt(payment.check)}` : ''}
            </Cell>
            <Cell className="text-right tabular-nums text-slate-400">
              {payment?.note ? `₩${fmt(payment.note)}` : ''}
            </Cell>
            <Cell colSpan={2} className="text-right tabular-nums text-slate-400">
              {payment?.credit ? `₩${fmt(payment.credit)}` : ''}
            </Cell>
          </tr>
        </tbody>
      </table>

      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}
