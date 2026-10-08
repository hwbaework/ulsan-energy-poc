'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Download, FileText, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCompany } from '@/hooks/platform/useCompanies';
import { exportBillingInvoicePdf, generateBillingInvoiceHtml, type BillingInvoiceData } from '@/lib/utils';
import {
  CO,
  dueDateOf,
  issueDateOf,
  settlementsOf,
  useTradingPocStore,
  writtenDateOf,
} from '@/stores/useTradingPocStore';
import { useToastStore } from '@/stores/useToastStore';
import { periodOf } from './DocumentSheet';
import { useTradingRole } from './useTradingRole';
import type { Contract } from '@/types/trading-poc';

const PAPER = { height: '80vh', minHeight: 640, border: 'none' } as const;

/**
 * 세금계산서 원본 — 플랫폼이 만들어 주지 않는다. 전자세금계산서 업체(ASP)에서 발행해 내려받은 PDF 를
 * 발전사업자(기업 계정)가 그 달에 올린다. 관리자는 조회만. (ASP API 로 바로 가져오는 건 고도화)
 */
export function useTaxOriginal(contractId: number, period: string) {
  const addToast = useToastStore((s) => s.add);
  const role = useTradingRole();
  const attach = useTradingPocStore((s) => s.attachOriginal);
  // 그 달 세금계산서 자리 — 올린 원본이 붙는 곳(문서 관리와 같은 문서)
  const taxDoc = useTradingPocStore((s) =>
    s.documents.find((d) => d.category === 'TAX' && d.contractId === contractId && periodOf(d) === period),
  );
  const upload = (f: File | undefined) => {
    if (!f || !taxDoc) return;
    if (f.type !== 'application/pdf') return addToast('error', 'PDF 파일만 올릴 수 있습니다');
    if (f.size > 3 * 1024 * 1024) return addToast('error', '3MB 이하 파일만 올릴 수 있습니다');
    const r = new FileReader();
    r.onload = () => {
      attach(taxDoc.id, {
        name: f.name,
        url: String(r.result),
        sizeKb: Math.round(f.size / 1024),
        by: role.companyName,
        at: new Date().toLocaleString('sv-SE').slice(0, 16),
      });
      addToast('success', `${period} 세금계산서 원본을 올렸습니다`);
    };
    r.readAsDataURL(f);
  };
  return { taxDoc, original: taxDoc?.original, upload, canUpload: !role.isAdmin && !!taxDoc };
}

/** 파일 고르기 버튼 — 숨긴 input 을 연다 */
export function UploadButton({
  onFile,
  label,
  size = 'sm',
}: {
  onFile: (f?: File) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <Button
        size={size}
        variant={size === 'sm' ? 'secondary' : 'primary'}
        onClick={(e) => {
          e.stopPropagation();
          ref.current?.click();
        }}
      >
        <Upload size={14} className="mr-1" /> {label}
      </Button>
    </>
  );
}

function TaxOriginalPaper({ contract: c, period }: { contract: Contract; period: string }) {
  const { original, upload, canUpload } = useTaxOriginal(c.id, period);
  return (
    <div className="min-w-0 overflow-hidden rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] md:sticky md:top-4">
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-400">원본</p>
          <p className="truncate text-sm font-semibold text-white">
            {period} 세금계산서 · {c.consumerCompanyName}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canUpload && original && <UploadButton onFile={upload} label="원본 바꾸기" />}
          {original && (
            <a href={original.url} download={original.name}>
              <Button size="sm" variant="secondary">
                <Download size={14} className="mr-1" /> 원본
              </Button>
            </a>
          )}
        </div>
      </div>
      {original ? (
        <>
          <p className="border-b border-white/[0.06] px-5 py-2 text-xs text-slate-400">
            {original.name} · {original.by} · {original.at}
          </p>
          <iframe src={original.url} title={original.name} className="w-full bg-white" style={PAPER} />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
          <FileText size={32} className="text-slate-600" />
          <p className="text-sm text-slate-400">원본 미등록</p>
          {canUpload && <UploadButton onFile={upload} label="원본 올리기" size="md" />}
        </div>
      )}
    </div>
  );
}

/**
 * 세금계산서 · 청구서 문서 — 통합관제 보고서처럼 위에 PDF, 아래 흰 종이 미리보기(iframe).
 *   세금계산서 = 올린 원본만(플랫폼이 만들지 않는다)
 *   청구서 = 청구서 견본 모양으로 만든다. 청구하는 곳 = SPC, 받는 곳 = 계약 기업(기업 정보에서)
 */
export function BillingPaper({
  kind,
  contract: c,
  period,
  autoPdf,
}: {
  kind: 'TAX' | 'INVOICE';
  contract: Contract;
  period: string;
  admin?: boolean;
  /** 문서 목록의 PDF 아이콘으로 들어오면 바로 PDF(청구서) */
  autoPdf?: boolean;
}) {
  if (kind === 'TAX') return <TaxOriginalPaper contract={c} period={period} />;
  return <InvoicePaper contract={c} period={period} autoPdf={autoPdf} />;
}

function InvoicePaper({ contract: c, period, autoPdf }: { contract: Contract; period: string; autoPdf?: boolean }) {
  const { data: spc } = useCompany(CO.SPC.id);
  const { data: buyer } = useCompany(c.consumerCompanyId);
  const s = useMemo(() => settlementsOf([c]).find((x) => x.period === period), [c, period]);

  const doc = useMemo(() => {
    if (!s) return null;
    const end = writtenDateOf(period);
    const inv: BillingInvoiceData = {
      no: `INV-${period}-${c.no}`,
      issueDate: issueDateOf(period),
      dueDate: dueDateOf(period),
      supplier: {
        name: spc?.name ?? CO.SPC.name,
        bizNo: spc?.businessNumber ?? '',
        representative: spc?.representativeName ?? '',
        address: spc?.address ?? '',
        phone: spc?.phone ?? '',
      },
      receiverName: buyer?.name ?? c.consumerCompanyName,
      items: [
        {
          date: end.slice(5),
          name: `전력 사용 (${period})`,
          quantity: Math.round(s.generationKwh),
          unit: 'kWh',
          unitPrice: s.smpUnitPrice,
          supplyAmount: s.supplyAmount,
          note: c.no,
        },
      ],
      supplyTotal: s.supplyAmount,
      vatTotal: s.vat,
      grandTotal: s.total,
      bankAccount: '',
    };
    return { title: `청구서_${period}_${inv.receiverName}`, inv };
  }, [s, spc, buyer, c, period]);

  const onPdf = () => {
    if (doc) void exportBillingInvoicePdf(doc.title, doc.inv);
  };
  const done = useRef(false);
  useEffect(() => {
    if (!autoPdf || done.current || !doc || !spc || !buyer) return;
    done.current = true;
    onPdf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPdf, doc, spc, buyer]);

  if (!doc) return null;
  // A4 를 창 너비에 맞춰 줄인다 — 잘리거나 가로로 밀리지 않게
  const html = generateBillingInvoiceHtml(doc.inv).replace(
    '</head>',
    `<style>.a4{margin:12px auto!important}</style>
<script>function fit(){var a=document.querySelector('.a4');if(!a)return;document.body.style.zoom=1;var z=Math.min(1,(window.innerWidth-24)/a.offsetWidth);document.body.style.zoom=z}addEventListener('load',fit);addEventListener('resize',fit)</script></head>`,
  );

  return (
    <div className="min-w-0 overflow-hidden rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] md:sticky md:top-4">
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-400">미리보기</p>
          <p className="truncate text-sm font-semibold text-white">
            {period} 청구서 · {c.consumerCompanyName}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={onPdf}>
          <FileText size={14} className="mr-1" /> PDF
        </Button>
      </div>
      {/* 문서는 iframe 안에서 흰 종이로 — 화면 테마와 섞이지 않는다 */}
      <iframe srcDoc={html} title={doc.title} className="w-full bg-white" style={PAPER} />
    </div>
  );
}
