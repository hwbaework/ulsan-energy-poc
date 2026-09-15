import { saveAs } from 'file-saver';
import { renderTaxInvoiceCopy, FORM_WIDTH_MM, type FormData } from './taxInvoiceForm';

/* ─── Types ─── */

export interface TaxInvoiceExportParty {
  name: string;
  bizNo: string;
  representative: string;
  address: string;
  bizType: string;
  bizCategory: string;
}

export interface TaxInvoiceExportItem {
  month: string;
  day: string;
  description: string;
  spec: string;
  quantity: string;
  unitPrice: string;
  supplyAmount: number;
  tax: number;
  note: string;
}

export interface TaxInvoiceExportData {
  invoiceNo: string;
  issueDate: string;
  supplier: TaxInvoiceExportParty;
  receiver: TaxInvoiceExportParty;
  items: TaxInvoiceExportItem[];
  supplyTotal: number;
  vatTotal: number;
  grandTotal: number;
  receiptOrClaim: 'receipt' | 'claim';
  type: 'purchase' | 'sale';
}

const EMPTY_PARTY: TaxInvoiceExportParty = {
  name: '',
  bizNo: '',
  representative: '',
  address: '',
  bizType: '',
  bizCategory: '',
};

function blankInvoice(): TaxInvoiceExportData {
  return {
    invoiceNo: '',
    issueDate: '',
    supplier: EMPTY_PARTY,
    receiver: EMPTY_PARTY,
    items: [],
    supplyTotal: 0,
    vatTotal: 0,
    grandTotal: 0,
    receiptOrClaim: 'claim',
    type: 'sale',
  };
}

/* ─── CSV ─── */

export function exportTaxInvoiceCsv(filename: string, invoices: TaxInvoiceExportData[]) {
  const list = invoices.length > 0 ? invoices : [blankInvoice()];
  const lines: string[] = [];

  for (const inv of list) {
    const q = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`;
    const label = inv.type === 'purchase' ? '매입' : '매출';

    lines.push(`${q(`세 금 계 산 서 (${label})`)}`);
    lines.push(`No.,${q(inv.invoiceNo)}`);
    lines.push('');

    lines.push(`,${q('공 급 자')},,,,${q('공 급 받 는 자')}`);
    lines.push(
      `${q('등록번호')},${q(inv.supplier.bizNo)},,,,${q('등록번호')},${q(inv.receiver.bizNo)}`,
    );
    lines.push(
      `${q('상호(법인명)')},${q(inv.supplier.name)},${q('성명')},${q(inv.supplier.representative)},,${q('상호(법인명)')},${q(inv.receiver.name)},${q('성명')},${q(inv.receiver.representative)}`,
    );
    lines.push(
      `${q('사업장주소')},${q(inv.supplier.address)},,,,${q('사업장주소')},${q(inv.receiver.address)}`,
    );
    lines.push(
      `${q('업태')},${q(inv.supplier.bizType)},${q('종목')},${q(inv.supplier.bizCategory)},,${q('업태')},${q(inv.receiver.bizType)},${q('종목')},${q(inv.receiver.bizCategory)}`,
    );
    lines.push('');

    lines.push(`${q('작성일')},${q('공급가액')},${q('세액')},${q('비고')}`);
    lines.push(`${q(inv.issueDate)},${inv.supplyTotal},${inv.vatTotal},`);
    lines.push('');

    lines.push(
      `${q('월')},${q('일')},${q('품목')},${q('규격')},${q('수량')},${q('단가')},${q('공급가액')},${q('세액')},${q('비고')}`,
    );
    for (const item of inv.items) {
      lines.push(
        [
          item.month,
          item.day,
          q(item.description),
          q(item.spec),
          item.quantity,
          item.unitPrice,
          item.supplyAmount,
          item.tax,
          q(item.note),
        ].join(','),
      );
    }
    const emptyItemRows = Math.max(0, 4 - inv.items.length);
    for (let i = 0; i < emptyItemRows; i++) lines.push(',,,,,,,,,');
    lines.push('');

    lines.push(`${q('합계금액')},${inv.grandTotal}`);
    lines.push(`${q('현금')},,${q('수표')},,${q('어음')},,${q('외상미수금')}`);
    lines.push(`,,,,,,`);
    lines.push(`${q(`이 금액을 ${inv.receiptOrClaim === 'receipt' ? '영수' : '청구'} 함`)}`);
    lines.push('');

    if (list.length > 1) {
      lines.push('════════════════════════════════════════');
      lines.push('');
    }
  }

  const bom = '﻿';
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

/* ─── Excel ─── */

type CellStyle = {
  font?: { bold?: boolean; sz?: number; color?: { rgb?: string } };
  fill?: { fgColor?: { rgb?: string } };
  border?: Record<string, { style: string; color?: { rgb?: string } }>;
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean };
  numFmt?: string;
};

function borderAll(color = '333333'): CellStyle['border'] {
  const s = { style: 'thin', color: { rgb: color } };
  return { top: s, bottom: s, left: s, right: s };
}

const HEADER_STYLE: CellStyle = {
  font: { bold: true, sz: 9, color: { rgb: '333333' } },
  fill: { fgColor: { rgb: 'E8ECF0' } },
  border: borderAll(),
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
};

const LABEL_STYLE: CellStyle = {
  font: { bold: true, sz: 9, color: { rgb: '333333' } },
  fill: { fgColor: { rgb: 'F5F7FA' } },
  border: borderAll(),
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
};

const VALUE_STYLE: CellStyle = {
  font: { sz: 9 },
  border: borderAll(),
  alignment: { vertical: 'center' },
};

const VALUE_RIGHT: CellStyle = {
  font: { sz: 9 },
  border: borderAll(),
  alignment: { horizontal: 'right', vertical: 'center' },
};

const VALUE_CENTER: CellStyle = {
  font: { sz: 9 },
  border: borderAll(),
  alignment: { horizontal: 'center', vertical: 'center' },
};

const TITLE_STYLE: CellStyle = {
  font: { bold: true, sz: 14, color: { rgb: '1a1a1a' } },
  alignment: { horizontal: 'center', vertical: 'center' },
};

const SUBTITLE_STYLE: CellStyle = {
  font: { sz: 8, color: { rgb: '888888' } },
  alignment: { horizontal: 'center', vertical: 'center' },
};

const AMOUNT_BOLD: CellStyle = {
  font: { bold: true, sz: 10 },
  border: borderAll(),
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: '#,##0',
};

const FOOTER_LABEL: CellStyle = {
  font: { bold: true, sz: 10 },
  fill: { fgColor: { rgb: 'DCE6F0' } },
  border: borderAll(),
  alignment: { horizontal: 'center', vertical: 'center' },
};

const FOOTER_RC: CellStyle = {
  font: { bold: true, sz: 10 },
  border: borderAll(),
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
};

type CellDef = { v: string | number; s?: CellStyle; t?: string };

function sc(v: string | number, s: CellStyle, t?: string): CellDef {
  return { v, s, ...(t ? { t } : {}) };
}

export async function exportTaxInvoiceExcel(filename: string, invoices: TaxInvoiceExportData[]) {
  const XLSX = await import('xlsx-js-style');
  const wb = XLSX.utils.book_new();
  const list = invoices.length > 0 ? invoices : [blankInvoice()];

  for (const inv of list) {
    const label = inv.type === 'purchase' ? '매입' : '매출';
    const sheetName = (inv.invoiceNo ? `${label}_${inv.invoiceNo}` : `세금계산서`).slice(0, 31);

    const data: (CellDef | null)[][] = [];
    const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

    let r = 0;

    // R0: Title
    data.push([
      sc(`세 금 계 산 서 (${label})`, TITLE_STYLE),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    merges.push({ s: { r, c: 0 }, e: { r, c: 9 } });
    r++;

    // R1: Invoice No
    data.push([
      sc(`No. ${inv.invoiceNo}`, SUBTITLE_STYLE),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    merges.push({ s: { r, c: 0 }, e: { r, c: 9 } });
    r++;

    // R2: Blank
    data.push(Array(10).fill(null));
    r++;

    // R3-R6: 공급자 / 공급받는자
    // R3: 등록번호
    data.push([
      sc('공\n급\n자', {
        ...LABEL_STYLE,
        font: { ...LABEL_STYLE.font, sz: 10 },
        fill: { fgColor: { rgb: 'D6E4F0' } },
      }),
      sc('등록번호', LABEL_STYLE),
      sc(inv.supplier.bizNo, VALUE_CENTER),
      null,
      null,
      sc('공\n급\n받\n는\n자', {
        ...LABEL_STYLE,
        font: { ...LABEL_STYLE.font, sz: 10 },
        fill: { fgColor: { rgb: 'D6F0E0' } },
      }),
      sc('등록번호', LABEL_STYLE),
      sc(inv.receiver.bizNo, VALUE_CENTER),
      null,
      null,
    ]);
    merges.push(
      { s: { r, c: 0 }, e: { r: r + 3, c: 0 } },
      { s: { r, c: 2 }, e: { r, c: 4 } },
      { s: { r, c: 5 }, e: { r: r + 3, c: 5 } },
      { s: { r, c: 7 }, e: { r, c: 9 } },
    );
    r++;

    // R4: 상호 / 성명
    data.push([
      null,
      sc('상호\n(법인명)', LABEL_STYLE),
      sc(inv.supplier.name, { ...VALUE_STYLE, font: { bold: true, sz: 9 } }),
      sc('성명', LABEL_STYLE),
      sc(inv.supplier.representative, VALUE_CENTER),
      null,
      sc('상호\n(법인명)', LABEL_STYLE),
      sc(inv.receiver.name, { ...VALUE_STYLE, font: { bold: true, sz: 9 } }),
      sc('성명', LABEL_STYLE),
      sc(inv.receiver.representative, VALUE_CENTER),
    ]);
    r++;

    // R5: 사업장주소
    data.push([
      null,
      sc('사업장\n주소', LABEL_STYLE),
      sc(inv.supplier.address, VALUE_STYLE),
      null,
      null,
      null,
      sc('사업장\n주소', LABEL_STYLE),
      sc(inv.receiver.address, VALUE_STYLE),
      null,
      null,
    ]);
    merges.push({ s: { r, c: 2 }, e: { r, c: 4 } }, { s: { r, c: 7 }, e: { r, c: 9 } });
    r++;

    // R6: 업태 / 종목
    data.push([
      null,
      sc('업태', LABEL_STYLE),
      sc(inv.supplier.bizType, VALUE_CENTER),
      sc('종목', LABEL_STYLE),
      sc(inv.supplier.bizCategory, VALUE_CENTER),
      null,
      sc('업태', LABEL_STYLE),
      sc(inv.receiver.bizType, VALUE_CENTER),
      sc('종목', LABEL_STYLE),
      sc(inv.receiver.bizCategory, VALUE_CENTER),
    ]);
    r++;

    // R7: Blank
    data.push(Array(10).fill(null));
    r++;

    // R8: 작성일 / 공급가액 / 세액 header
    data.push([
      sc('작성일', HEADER_STYLE),
      null,
      sc('공급가액', HEADER_STYLE),
      null,
      null,
      null,
      sc('세액', HEADER_STYLE),
      null,
      null,
      sc('비고', HEADER_STYLE),
    ]);
    merges.push(
      { s: { r, c: 0 }, e: { r, c: 1 } },
      { s: { r, c: 2 }, e: { r, c: 5 } },
      { s: { r, c: 6 }, e: { r, c: 8 } },
    );
    r++;

    // R9: values
    data.push([
      sc(inv.issueDate, VALUE_CENTER),
      null,
      sc(inv.supplyTotal, AMOUNT_BOLD),
      null,
      null,
      null,
      sc(inv.vatTotal, VALUE_RIGHT),
      null,
      null,
      sc('', VALUE_CENTER),
    ]);
    merges.push(
      { s: { r, c: 0 }, e: { r, c: 1 } },
      { s: { r, c: 2 }, e: { r, c: 5 } },
      { s: { r, c: 6 }, e: { r, c: 8 } },
    );
    r++;

    // R10: Blank
    data.push(Array(10).fill(null));
    r++;

    // R11: Items header
    data.push([
      sc('월', HEADER_STYLE),
      sc('일', HEADER_STYLE),
      sc('품목', HEADER_STYLE),
      null,
      sc('규격', HEADER_STYLE),
      sc('수량', HEADER_STYLE),
      sc('단가', HEADER_STYLE),
      sc('공급가액', HEADER_STYLE),
      sc('세액', HEADER_STYLE),
      sc('비고', HEADER_STYLE),
    ]);
    merges.push({ s: { r, c: 2 }, e: { r, c: 3 } });
    r++;

    // Item rows
    const allItems = [...inv.items];
    while (allItems.length < 4) {
      allItems.push({
        month: '',
        day: '',
        description: '',
        spec: '',
        quantity: '',
        unitPrice: '',
        supplyAmount: 0,
        tax: 0,
        note: '',
      });
    }

    for (const item of allItems) {
      const hasData = item.description !== '';
      data.push([
        sc(item.month, VALUE_CENTER),
        sc(item.day, VALUE_CENTER),
        sc(item.description, VALUE_STYLE),
        null,
        sc(item.spec, VALUE_CENTER),
        sc(item.quantity, VALUE_RIGHT),
        sc(item.unitPrice, VALUE_RIGHT),
        hasData
          ? sc(item.supplyAmount, { ...AMOUNT_BOLD, font: { bold: true, sz: 9 } })
          : sc('', VALUE_RIGHT),
        hasData ? sc(item.tax, { ...VALUE_RIGHT, numFmt: '#,##0' }) : sc('', VALUE_RIGHT),
        sc(item.note, VALUE_CENTER),
      ]);
      merges.push({ s: { r, c: 2 }, e: { r, c: 3 } });
      r++;
    }

    // Footer: 합계금액
    data.push([
      sc('합계금액', FOOTER_LABEL),
      null,
      sc('현금', HEADER_STYLE),
      sc('수표', HEADER_STYLE),
      sc('어음', HEADER_STYLE),
      sc('외상미수금', HEADER_STYLE),
      null,
      sc(`이 금액을 ${inv.receiptOrClaim === 'receipt' ? '영수' : '청구'} 함`, FOOTER_RC),
      null,
      null,
    ]);
    merges.push(
      { s: { r, c: 0 }, e: { r, c: 1 } },
      { s: { r, c: 5 }, e: { r, c: 6 } },
      { s: { r, c: 7 }, e: { r: r + 1, c: 9 } },
    );
    r++;

    // Footer values
    data.push([
      sc(inv.grandTotal, { ...AMOUNT_BOLD, font: { bold: true, sz: 12 } }),
      null,
      sc('', VALUE_RIGHT),
      sc('', VALUE_RIGHT),
      sc('', VALUE_RIGHT),
      sc(inv.grandTotal > 0 ? inv.grandTotal : '', { ...VALUE_RIGHT, numFmt: '#,##0' }),
      null,
      null,
      null,
      null,
    ]);
    merges.push({ s: { r, c: 0 }, e: { r, c: 1 } }, { s: { r, c: 5 }, e: { r, c: 6 } });
    r++;

    // Convert to worksheet
    const ws: Record<string, any> = {};
    for (let ri = 0; ri < data.length; ri++) {
      const row = data[ri]!;
      for (let ci = 0; ci < row.length; ci++) {
        const cell = row[ci];
        if (cell == null) continue;
        const ref = XLSX.utils.encode_cell({ r: ri, c: ci });
        const cellObj: any = { v: cell.v, s: cell.s };
        if (cell.t) {
          cellObj.t = cell.t;
        } else if (typeof cell.v === 'number') {
          cellObj.t = 'n';
        } else {
          cellObj.t = 's';
        }
        ws[ref] = cellObj;
      }
    }

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length - 1, c: 9 } });
    ws['!merges'] = merges;
    ws['!cols'] = [
      { wch: 6 }, // 월
      { wch: 8 }, // 일 / 등록번호 label
      { wch: 16 }, // 품목 / 상호
      { wch: 8 }, // 성명 label
      { wch: 12 }, // 규격 / 대표자
      { wch: 8 }, // 수량 / 공급받는자 marker
      { wch: 10 }, // 단가 / 등록번호 label
      { wch: 14 }, // 공급가액 / 상호
      { wch: 12 }, // 세액 / 성명 label
      { wch: 10 }, // 비고 / 대표자
    ];
    ws['!rows'] = [
      { hpt: 28 }, // Title
      { hpt: 16 }, // No
      { hpt: 8 }, // blank
      { hpt: 22 }, // 등록번호
      { hpt: 22 }, // 상호/성명
      { hpt: 22 }, // 사업장주소
      { hpt: 22 }, // 업태/종목
    ];

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(
    new Blob([buf], { type: 'application/octet-stream' }),
    filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`,
  );
}

/* ─── PDF ─── */

let fontBase64Cache: string | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

async function loadKoreanFont(doc: any): Promise<boolean> {
  try {
    if (!fontBase64Cache) {
      const res = await fetch('/fonts/NotoSansKR-Regular.ttf');
      if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
      const buf = await res.arrayBuffer();
      fontBase64Cache = arrayBufferToBase64(buf);
    }
    doc.addFileToVFS('NotoSansKR-Regular.ttf', fontBase64Cache);
    doc.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'normal');
    doc.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'bold');
    return true;
  } catch {
    return false;
  }
}

function toFormData(inv: TaxInvoiceExportData): FormData {
  const [y, m, d] = (inv.issueDate || '').split(/[.\-/]/);
  return {
    bookNo: '',
    serialNo: inv.invoiceNo,
    supplier: { ...inv.supplier },
    receiver: { ...inv.receiver },
    writeYear: y ?? '',
    writeMonth: m ? String(Number(m)) : '',
    writeDay: d ? String(Number(d)) : '',
    items: inv.items.map((it) => ({
      month: it.month,
      day: it.day,
      description: it.description,
      spec: it.spec,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      supplyAmount: it.supplyAmount,
      tax: it.tax,
      note: it.note,
    })),
    supplyTotal: inv.supplyTotal,
    vatTotal: inv.vatTotal,
    grandTotal: inv.grandTotal,
    // 합계금액 분개 — 매출(발급)은 청구, 입금 완료분은 현금 처리 가능. 기본은 외상미수금(청구).
    credit: inv.grandTotal,
    receiptOrClaim: inv.receiptOrClaim,
  };
}

/**
 * 표준 양식(별지 제11호) — 인보이스 1건당 A4 1페이지에 1부.
 * copyType 으로 보관본을 지정한다.
 *   '공급자'      — 발전사(공급하는 자)용
 *   '공급받는자'  — 수용가(공급받는 자)용
 */
export async function exportTaxInvoicePdf(
  filename: string,
  invoices: TaxInvoiceExportData[],
  copyType: '공급자' | '공급받는자' = '공급자',
) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const hasFont = await loadKoreanFont(doc);
  const fontName = hasFont ? 'NotoSansKR' : 'helvetica';

  const list = invoices.length > 0 ? invoices : [blankInvoice()];
  const pageW = doc.internal.pageSize.getWidth();
  const sideMargin = (pageW - FORM_WIDTH_MM) / 2;
  const topMargin = 14;

  for (let idx = 0; idx < list.length; idx++) {
    if (idx > 0) doc.addPage();
    const fd = toFormData(list[idx]!);
    renderTaxInvoiceCopy(doc, fd, fontName, sideMargin, topMargin, copyType);
  }

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/* ─── HTML 미리보기 (별지 제11호 서식 — 실제 A4 사이즈) ─── */

export function generateTaxInvoiceHtml(
  inv: TaxInvoiceExportData,
  copyType: '공급자' | '공급받는자' = '공급자',
): string {
  const [y, m, d] = (inv.issueDate || '').split(/[.\-/]/);

  /* 등록번호 셀 — 개별 박스 10칸 */
  const bizNoBoxes = (no: string) => {
    const digits = (no || '').replace(/\D/g, '').padEnd(10, ' ');
    const groups = [digits.slice(0, 3), digits.slice(3, 5), digits.slice(5)];
    return groups
      .map(
        (g, gi) =>
          `<span class="bizno-group">${g
            .split('')
            .map((c) => `<span class="bizno-cell">${c.trim()}</span>`)
            .join('')}${gi < 2 ? '<span class="bizno-dash">-</span>' : ''}</span>`,
      )
      .join('');
  };

  /* 공급가액/세액 숫자 — 각 자리 박스 (억,천,백,십,만,천,백,십,원) */
  const amountBoxes = (n: number, cols: number) => {
    const s = n > 0 ? String(n) : '';
    const padded = s.padStart(cols, ' ');
    return padded
      .split('')
      .map((c) => `<span class="amt-cell">${c.trim()}</span>`)
      .join('');
  };

  const kr = (n: number) => (n > 0 ? n.toLocaleString('ko-KR') : '');
  const sup = inv.supplier;
  const rec = inv.receiver;
  const rcText = inv.receiptOrClaim === 'receipt' ? '영수' : '청구';
  const label = inv.type === 'purchase' ? '매입' : '매출';

  const items = [...inv.items];
  while (items.length < 4) {
    items.push({
      month: '',
      day: '',
      description: '',
      spec: '',
      quantity: '',
      unitPrice: '',
      supplyAmount: 0,
      tax: 0,
      note: '',
    });
  }

  const itemRows = items
    .slice(0, 4)
    .map(
      (it) => `
    <tr class="item-row">
      <td class="item-month">${it.month}</td>
      <td class="item-day">${it.day}</td>
      <td class="item-desc" colspan="2">${it.description || ''}</td>
      <td class="item-spec">${it.spec || ''}</td>
      <td class="item-qty ar">${it.quantity || ''}</td>
      <td class="item-price ar">${it.unitPrice || ''}</td>
      <td class="item-supply ar">${it.supplyAmount > 0 ? kr(it.supplyAmount) : ''}</td>
      <td class="item-tax ar">${it.tax > 0 ? kr(it.tax) : ''}</td>
      <td class="item-note">${it.note || ''}</td>
    </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<title>세금계산서 미리보기</title>
<style>
  /* ── 기반 ── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #e8e8e8; font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; }

  /* ── 인쇄 버튼 바 ── */
  .print-bar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    display: flex; justify-content: flex-end; align-items: center; gap: 8px;
    padding: 6px 12px; background: #555; box-shadow: 0 1px 4px rgba(0,0,0,.3);
  }
  .print-bar button {
    font-size: 12px; padding: 4px 14px; cursor: pointer;
    border: 1px solid #888; border-radius: 3px; background: #f5f5f5;
    font-family: inherit;
  }
  .print-bar span { color: #ccc; font-size: 11px; }

  /* ── A4 용지 ── */
  .a4 {
    width: 210mm;
    min-height: 297mm;
    margin: 44px auto 20px;
    background: #fff;
    padding: 14mm 15mm 10mm;
    box-shadow: 0 4px 20px rgba(0,0,0,.25);
  }

  /* ── 서식 표제 ── */
  .form-label { font-size: 6.5pt; color: #666; text-align: left; margin-bottom: 1mm; }
  .title-block { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2.5mm; }
  .title-text { font-size: 18pt; font-weight: 900; letter-spacing: 0.18em; }
  .title-copy { font-size: 10pt; font-weight: 600; }
  .invoice-no { font-size: 8pt; color: #444; text-align: right; }

  /* ── 메인 표 ── */
  table.inv {
    width: 100%;
    border-collapse: collapse;
    font-size: 8pt;
  }
  table.inv td {
    border: 0.3mm solid #222;
    vertical-align: middle;
    padding: 0 1.5mm;
    white-space: nowrap;
    overflow: hidden;
    height: 7mm;
  }
  .ac { text-align: center; }
  .al { text-align: left; }
  .ar { text-align: right; }

  /* 섹션 레이블 (공급자 / 공급받는자) */
  .sec-lbl {
    background: #dde8f7;
    font-weight: 800;
    font-size: 9pt;
    letter-spacing: 0.05em;
    text-align: center;
    width: 8mm;
    padding: 0;
  }
  .sec-lbl.recv { background: #ddeedd; }

  /* 필드 레이블 */
  .fld { background: #f2f2f2; font-weight: 600; font-size: 7.5pt; text-align: center; width: 20mm; }

  /* 사업자등록번호 박스 */
  .bizno-wrap { display: flex; align-items: center; justify-content: center; gap: 0; height: 100%; }
  .bizno-group { display: flex; align-items: center; }
  .bizno-cell {
    display: inline-flex; align-items: center; justify-content: center;
    width: 5mm; height: 5.5mm; border: 0.25mm solid #555;
    font-size: 9pt; font-weight: 600; margin: 0 0.2mm;
  }
  .bizno-dash { font-size: 10pt; font-weight: 700; margin: 0 0.5mm; }

  /* 공급가액/세액 자리 박스 */
  .amt-wrap { display: flex; align-items: center; justify-content: flex-end; gap: 0; }
  .amt-label-row td { height: 5.5mm; }
  .amt-labels { display: flex; justify-content: flex-end; }
  .amt-label { display: inline-flex; align-items: center; justify-content: center; width: 5mm; font-size: 6pt; color: #666; }
  .amt-cell {
    display: inline-flex; align-items: center; justify-content: center;
    width: 5mm; height: 5.5mm; border: 0.25mm solid #555;
    font-size: 8pt; font-weight: 600; margin: 0 0.1mm;
  }

  /* 컬럼 헤더 */
  .ch { background: #eaecf0; font-weight: 700; font-size: 7.5pt; text-align: center; }

  /* 품목 행 */
  .item-month { width: 8mm; text-align: center; }
  .item-day   { width: 7mm; text-align: center; }
  .item-desc  { text-align: left; padding-left: 2mm; }
  .item-spec  { width: 14mm; text-align: center; }
  .item-qty   { width: 12mm; }
  .item-price { width: 22mm; }
  .item-supply{ width: 24mm; }
  .item-tax   { width: 20mm; }
  .item-note  { width: 18mm; text-align: left; padding-left: 1.5mm; }
  .item-row td { height: 8.5mm; }

  /* 합계 행 */
  .total-lbl  { background: #d8e6f5; font-weight: 800; font-size: 8.5pt; text-align: center; }
  .total-val  { font-weight: 800; font-size: 10pt; text-align: right; }
  .rc-cell    { font-weight: 700; font-size: 10pt; text-align: center; }

  /* 인증 문구 */
  .foot { font-size: 6pt; color: #777; text-align: right; margin-top: 2mm; }

  /* ── 인쇄 ── */
  @media print {
    html, body { background: #fff; }
    .print-bar { display: none; }
    .a4 { margin: 0; box-shadow: none; padding: 10mm 15mm; }
    @page { size: A4 portrait; margin: 0; }
  }
</style>
</head>
<body>

<div class="print-bar">
  <span>세금계산서 미리보기 (별지 제11호)</span>
  <button onclick="window.print()">🖨 인쇄 / PDF 저장</button>
</div>

<div class="a4">

  <!-- 표제 -->
  <div class="form-label">[별지 제11호 서식]</div>
  <div class="title-block">
    <div>
      <span class="title-text">세 금 계 산 서</span>
      <span class="title-copy">&nbsp;(${copyType} 보관용)</span>
    </div>
    <div class="invoice-no">No. ${inv.invoiceNo || '—'}</div>
  </div>

  <table class="inv">

    <!-- ── 공급자 / 공급받는자 헤더 행 ── -->
    <tr>
      <td class="sec-lbl" rowspan="4" style="writing-mode:vertical-rl;letter-spacing:0.3em;font-size:10pt">공급자</td>
      <td class="fld">등 록 번 호</td>
      <td colspan="3">
        <div class="bizno-wrap">${bizNoBoxes(sup.bizNo)}</div>
      </td>
      <td class="sec-lbl recv" rowspan="4" style="writing-mode:vertical-rl;letter-spacing:0.15em;font-size:10pt">공급받는자</td>
      <td class="fld">등 록 번 호</td>
      <td colspan="3">
        <div class="bizno-wrap">${bizNoBoxes(rec.bizNo)}</div>
      </td>
    </tr>
    <tr>
      <td class="fld">상호(법인명)</td>
      <td class="al" style="font-weight:700;width:28mm">${sup.name}</td>
      <td class="fld" style="width:14mm">성&nbsp;&nbsp;&nbsp;&nbsp;명</td>
      <td class="al" style="width:20mm">${sup.representative}</td>
      <td class="fld">상호(법인명)</td>
      <td class="al" style="font-weight:700;width:28mm">${rec.name}</td>
      <td class="fld" style="width:14mm">성&nbsp;&nbsp;&nbsp;&nbsp;명</td>
      <td class="al" style="width:20mm">${rec.representative}</td>
    </tr>
    <tr>
      <td class="fld">사업장 주소</td>
      <td colspan="3" class="al" style="white-space:normal;font-size:7.5pt">${sup.address}</td>
      <td class="fld">사업장 주소</td>
      <td colspan="3" class="al" style="white-space:normal;font-size:7.5pt">${rec.address}</td>
    </tr>
    <tr>
      <td class="fld">업&nbsp;&nbsp;&nbsp;&nbsp;태</td>
      <td class="al">${sup.bizType}</td>
      <td class="fld">종&nbsp;&nbsp;&nbsp;&nbsp;목</td>
      <td class="al">${sup.bizCategory}</td>
      <td class="fld">업&nbsp;&nbsp;&nbsp;&nbsp;태</td>
      <td class="al">${rec.bizType}</td>
      <td class="fld">종&nbsp;&nbsp;&nbsp;&nbsp;목</td>
      <td class="al">${rec.bizCategory}</td>
    </tr>

    <!-- ── 작성일 / 공급가액 / 세액 레이블 행 ── -->
    <tr class="amt-label-row">
      <td class="ch" colspan="2" rowspan="2" style="width:26mm">작 &nbsp; 성 &nbsp; 일</td>
      <td class="ch" colspan="4">
        <div class="amt-labels">
          ${['억', '천', '백', '십', '만', '천', '백', '십', '원'].map((l) => `<span class="amt-label">${l}</span>`).join('')}
        </div>
      </td>
      <td class="ch" colspan="3">
        <div class="amt-labels">
          ${['천', '백', '십', '만', '천', '백', '십', '원'].map((l) => `<span class="amt-label">${l}</span>`).join('')}
        </div>
      </td>
      <td class="ch" rowspan="2" style="width:18mm">비 고</td>
    </tr>
    <tr>
      <td class="ch" colspan="4" style="height:8mm">
        <div style="display:flex;flex-direction:column;gap:0.5mm">
          <div style="font-size:6.5pt;color:#555;text-align:center">공 급 가 액</div>
          <div class="amt-wrap">${amountBoxes(inv.supplyTotal, 9)}</div>
        </div>
      </td>
      <td class="ch" colspan="3" style="height:8mm">
        <div style="display:flex;flex-direction:column;gap:0.5mm">
          <div style="font-size:6.5pt;color:#555;text-align:center">세 &nbsp;&nbsp;&nbsp; 액</div>
          <div class="amt-wrap">${amountBoxes(inv.vatTotal, 8)}</div>
        </div>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="text-align:center;font-size:9pt">
        ${y ?? ''}년&nbsp;${m ? String(Number(m)) : ''}월&nbsp;${d ? String(Number(d)) : ''}일
      </td>
      <td colspan="4" class="ar" style="font-weight:700;font-size:10pt">₩${kr(inv.supplyTotal)}</td>
      <td colspan="3" class="ar" style="font-weight:700">₩${kr(inv.vatTotal)}</td>
      <td></td>
    </tr>

    <!-- ── 품목 헤더 ── -->
    <tr>
      <td class="ch item-month">월</td>
      <td class="ch item-day">일</td>
      <td class="ch item-desc" colspan="2">품 &nbsp;&nbsp;&nbsp; 목</td>
      <td class="ch item-spec">규 격</td>
      <td class="ch item-qty">수 량</td>
      <td class="ch item-price">단 가</td>
      <td class="ch item-supply">공 급 가 액</td>
      <td class="ch item-tax">세 &nbsp;&nbsp;&nbsp; 액</td>
      <td class="ch item-note">비 고</td>
    </tr>

    ${itemRows}

    <!-- ── 합계금액 ── -->
    <tr>
      <td class="total-lbl" colspan="2" style="height:8mm">합 계 금 액</td>
      <td class="ch" style="width:20mm">현 &nbsp;&nbsp; 금</td>
      <td class="ch" style="width:18mm">수 &nbsp;&nbsp; 표</td>
      <td class="ch" style="width:18mm">어 &nbsp;&nbsp; 음</td>
      <td class="ch" colspan="2" style="width:22mm">외 상 미 수 금</td>
      <td class="rc-cell" colspan="3" rowspan="2">이 금액을 &nbsp;<u><b>${rcText}</b></u>&nbsp; 함</td>
    </tr>
    <tr>
      <td class="total-val" colspan="2" style="height:9mm">₩&nbsp;${kr(inv.grandTotal)}</td>
      <td></td>
      <td></td>
      <td></td>
      <td class="ar" colspan="2">₩&nbsp;${kr(inv.grandTotal)}</td>
    </tr>

  </table>

  <p class="foot">※ 이 계산서는 「부가가치세법」 별지 제11호 서식에 따라 작성되었습니다. (${label})</p>

</div><!-- /a4 -->
</body>
</html>`;
}
