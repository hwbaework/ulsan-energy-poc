'use client';

import { useEffect, useMemo, useRef } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCompany } from '@/hooks/platform/useCompanies';
import {
  exportBillingInvoicePdf,
  exportTaxInvoicePdf,
  generateBillingInvoiceHtml,
  generateTaxInvoiceHtml,
  type BillingInvoiceData,
  type TaxInvoiceExportData,
} from '@/lib/utils';
import { CO, dueDateOf, issueDateOf, settlementsOf, writtenDateOf } from '@/stores/useTradingPocStore';
import type { Contract } from '@/types/trading-poc';
import type { Company } from '@/types/company';

/**
 * 세금계산서 · 청구서 문서 — 통합관제 보고서처럼 흰 종이 미리보기(iframe) + 위에 PDF.
 *   세금계산서 = 별지 제11호 서식(관리자 = 공급자 보관용, 기업 = 공급받는자 보관용)
 *   청구서 = 청구서 견본 모양
 * 공급자 = SPC, 공급받는자 = 계약 기업. 등록번호 · 대표자 · 주소 · 업태 · 종목은 기업 정보에서 가져온다.
 */
export function BillingPaper({
  kind,
  contract: c,
  period,
  admin,
  autoPdf,
}: {
  kind: 'TAX' | 'INVOICE';
  contract: Contract;
  period: string;
  admin: boolean;
  /** 문서 목록의 PDF 아이콘으로 들어오면 바로 PDF */
  autoPdf?: boolean;
}) {
  const { data: spc } = useCompany(CO.SPC.id);
  const { data: buyer } = useCompany(c.consumerCompanyId);
  const s = useMemo(() => settlementsOf([c]).find((x) => x.period === period), [c, period]);

  const doc = useMemo(() => {
    if (!s) return null;
    const party = (co: Company | undefined, name: string) => ({
      name: co?.name ?? name,
      bizNo: co?.businessNumber ?? '',
      representative: co?.representativeName ?? '',
      address: co?.address ?? '',
      bizType: co?.bizType ?? '',
      bizCategory: co?.bizCategory ?? '',
      phone: co?.phone ?? '',
    });
    const supplier = party(spc, CO.SPC.name);
    const receiver = party(buyer, c.consumerCompanyName);
    const end = writtenDateOf(period);
    const kwh = Math.round(s.generationKwh);
    const price = s.smpUnitPrice;
    if (kind === 'TAX') {
      const tax: TaxInvoiceExportData = {
        invoiceNo: `TX-${period}-${c.no}`,
        issueDate: end,
        supplier,
        receiver,
        items: [
          {
            month: String(Number(end.slice(5, 7))),
            day: String(Number(end.slice(8, 10))),
            description: '전력 사용',
            spec: 'kWh',
            quantity: kwh.toLocaleString('ko-KR'),
            unitPrice: price.toLocaleString('ko-KR'),
            supplyAmount: s.supplyAmount,
            tax: s.vat,
            note: c.no,
          },
        ],
        supplyTotal: s.supplyAmount,
        vatTotal: s.vat,
        grandTotal: s.total,
        receiptOrClaim: 'claim',
        type: 'sale',
      };
      return { kind, title: `세금계산서_${period}_${receiver.name}`, tax };
    }
    const inv: BillingInvoiceData = {
      no: `INV-${period}-${c.no}`,
      issueDate: issueDateOf(period),
      dueDate: dueDateOf(period),
      supplier,
      receiverName: receiver.name,
      items: [
        {
          date: end.slice(5),
          name: `전력 사용 (${period})`,
          quantity: kwh,
          unit: 'kWh',
          unitPrice: price,
          supplyAmount: s.supplyAmount,
          note: c.no,
        },
      ],
      supplyTotal: s.supplyAmount,
      vatTotal: s.vat,
      grandTotal: s.total,
      bankAccount: '',
    };
    return { kind, title: `청구서_${period}_${receiver.name}`, inv };
  }, [s, spc, buyer, c, period, kind]);

  const copy = admin ? '공급자' : '공급받는자';
  const onPdf = () => {
    if (!doc) return;
    if (doc.tax) void exportTaxInvoicePdf(doc.title, [doc.tax], copy);
    else void exportBillingInvoicePdf(doc.title, doc.inv!);
  };
  const done = useRef(false);
  useEffect(() => {
    if (!autoPdf || done.current || !doc || !spc || !buyer) return;
    done.current = true;
    onPdf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPdf, doc, spc, buyer]);

  if (!doc) return null;
  // 양식 안의 인쇄 줄은 숨기고(위 PDF 버튼 하나만), A4 를 창 너비에 맞춰 줄인다 — 잘리거나 가로로 밀리지 않게
  const html = (doc.tax ? generateTaxInvoiceHtml(doc.tax, copy) : generateBillingInvoiceHtml(doc.inv!)).replace(
    '</head>',
    `<style>.print-bar{display:none!important}.a4{margin:12px auto!important}</style>
<script>function fit(){var a=document.querySelector('.a4');if(!a)return;document.body.style.zoom=1;var z=Math.min(1,(window.innerWidth-24)/a.offsetWidth);document.body.style.zoom=z}addEventListener('load',fit);addEventListener('resize',fit)</script></head>`,
  );

  return (
    <div className="min-w-0 overflow-hidden rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] md:sticky md:top-4">
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-400">미리보기</p>
          <p className="truncate text-sm font-semibold text-white">
            {period} {kind === 'TAX' ? '세금계산서' : '청구서'} · {c.consumerCompanyName}
            {kind === 'TAX' && <span className="ml-1.5 font-normal text-slate-400">({copy} 보관용)</span>}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={onPdf}>
          <FileText size={14} className="mr-1" /> PDF
        </Button>
      </div>
      {/* 문서는 iframe 안에서 흰 종이로 — 화면 테마와 섞이지 않는다 */}
      <iframe
        srcDoc={html}
        title={doc.title}
        className="w-full bg-white"
        style={{ height: '80vh', minHeight: 640, border: 'none' }}
      />
    </div>
  );
}
