/**
 * 청구서 — 견본(청구서 견본.xlsx) 모양 그대로. 화면 미리보기(HTML, A4)와 PDF 가 같은 구성.
 *   제목 · 청구일 · 공급자(상호 · 성명 · 주소 · 연락처) · "○○ 귀하" · 청구액(금 ○○원정)
 *   품목 표(월일 · 품명 · 수량 · 단가 · 공급가액 · 비고) · 소계 · 부가세 · 합계 · 납부 기한 · 결제 계좌
 */

export interface BillingInvoiceParty {
  name: string;
  bizNo: string;
  representative: string;
  address: string;
  phone: string;
}

export interface BillingInvoiceItem {
  /** 월일 — MM-DD */
  date: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  supplyAmount: number;
  note: string;
}

export interface BillingInvoiceData {
  no: string;
  issueDate: string;
  dueDate: string;
  supplier: BillingInvoiceParty;
  receiverName: string;
  items: BillingInvoiceItem[];
  supplyTotal: number;
  vatTotal: number;
  grandTotal: number;
  /** 결제 계좌 — 없으면 빈칸 */
  bankAccount: string;
}

const won = (n: number) => n.toLocaleString('ko-KR');

/** 금액 한글 — 6,081,108 → 육백팔만일천일백팔 */
export function hangulAmount(n: number): string {
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const small = ['', '십', '백', '천'];
  const big = ['', '만', '억', '조'];
  let num = Math.floor(Math.abs(n));
  if (num === 0) return '영';
  let out = '';
  let bi = 0;
  while (num > 0) {
    const chunk = num % 10000;
    if (chunk > 0) {
      let s = '';
      let c = chunk;
      for (let i = 0; i < 4 && c > 0; i++) {
        const d = c % 10;
        if (d > 0) s = `${digits[d] ?? ''}${small[i] ?? ''}${s}`;
        c = Math.floor(c / 10);
      }
      out = `${s}${big[bi] ?? ''}${out}`;
    }
    num = Math.floor(num / 10000);
    bi++;
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ─── HTML 미리보기 (A4) ─── */

export function generateBillingInvoiceHtml(d: BillingInvoiceData): string {
  const emptyRows = Math.max(0, 8 - d.items.length);
  const itemRows =
    d.items
      .map(
        (it) => `<tr>
      <td class="c">${esc(it.date)}</td>
      <td>${esc(it.name)}</td>
      <td class="r">${won(it.quantity)}</td>
      <td class="r">${won(it.unitPrice)}</td>
      <td class="r">${won(it.supplyAmount)}</td>
      <td class="c">${esc(it.note)}</td>
    </tr>`,
      )
      .join('') +
    '<tr class="blank"><td></td><td></td><td></td><td></td><td></td><td></td></tr>'.repeat(
      emptyRows,
    );
  const qty = d.items.reduce((a, it) => a + it.quantity, 0);
  const unit = d.items[0]?.unit ?? '';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>청구서</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #e5e7eb; font-family: 'Pretendard', 'Noto Sans KR', 'Malgun Gothic', sans-serif; color: #111; }
  .a4 { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 18mm 16mm; }
  h1 { margin: 0 0 8mm; text-align: center; font-size: 26px; letter-spacing: 18px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td, th { border: 1px solid #333; padding: 6px 8px; height: 8mm; }
  th { background: #f1f3f5; font-weight: 600; }
  .lbl { background: #f1f3f5; text-align: center; width: 22mm; font-weight: 600; }
  .c { text-align: center; }
  .r { text-align: right; font-variant-numeric: tabular-nums; }
  .head > tbody > tr > td { border: none; padding: 0; height: auto; vertical-align: top; }
  .head td td { height: 7mm; padding: 3px 6px; }
  .to { font-size: 18px; font-weight: 700; padding-top: 18mm !important; }
  .to small { font-size: 13px; font-weight: 400; margin-left: 6px; }
  .date { font-size: 12px; color: #444; }
  .claim td { font-size: 15px; font-weight: 700; height: 12mm; }
  .blank td { height: 7mm; }
  .sum td { font-weight: 600; }
  .total td { font-weight: 700; background: #f8f9fa; }
  .foot { margin-top: 8mm; font-size: 12px; line-height: 1.8; }
  .foot b { display: inline-block; width: 22mm; }
</style>
</head>
<body>
<div class="a4">
  <h1>청 구 서</h1>
  <table class="head">
    <tr>
      <td style="width:46%">
        <div class="date">청구일 ${esc(d.issueDate)}</div>
        <div class="date">청구 번호 ${esc(d.no)}</div>
        <div class="to">${esc(d.receiverName)}<small>귀하</small></div>
      </td>
      <td>
        <table>
          <tr><td class="lbl" rowspan="4" style="width:8mm;letter-spacing:4px">공급자</td>
              <td class="lbl">등록번호</td><td colspan="3">${esc(d.supplier.bizNo)}</td></tr>
          <tr><td class="lbl">상호</td><td>${esc(d.supplier.name)}</td><td class="lbl" style="width:14mm">성명</td><td>${esc(d.supplier.representative)}</td></tr>
          <tr><td class="lbl">주소</td><td colspan="3">${esc(d.supplier.address)}</td></tr>
          <tr><td class="lbl">연락처</td><td colspan="3">${esc(d.supplier.phone)}</td></tr>
        </table>
      </td>
    </tr>
  </table>

  <table class="claim" style="margin-top:6mm">
    <tr>
      <td class="lbl">청구액</td>
      <td>금 ${hangulAmount(d.grandTotal)} 원정</td>
      <td class="r" style="width:45mm">( ₩ ${won(d.grandTotal)} )</td>
    </tr>
  </table>

  <table style="margin-top:6mm">
    <tr>
      <th style="width:16mm">월일</th>
      <th>품명</th>
      <th style="width:28mm">수량 (${esc(unit)})</th>
      <th style="width:30mm">단가 (VAT 별도)</th>
      <th style="width:32mm">공급가액</th>
      <th style="width:30mm">비고</th>
    </tr>
    ${itemRows}
    <tr class="sum"><td class="c" colspan="2">소 계</td><td class="r">${won(qty)}</td><td></td><td class="r">${won(d.supplyTotal)}</td><td></td></tr>
    <tr class="sum"><td class="c" colspan="2">부가세</td><td></td><td></td><td class="r">${won(d.vatTotal)}</td><td></td></tr>
    <tr class="total"><td class="c" colspan="2">합 계</td><td></td><td></td><td class="r">${won(d.grandTotal)}</td><td></td></tr>
  </table>

  <div class="foot">
    <p>상기 내용을 확인하시어 아래 계좌로 결제 바랍니다. 감사합니다.</p>
    <div><b>납부 기한</b>${esc(d.dueDate)}</div>
    <div><b>결제 계좌</b>${esc(d.bankAccount)}</div>
  </div>
</div>
</body>
</html>`;
}

/* ─── PDF ─── */

let fontCache: string | null = null;
async function loadFont(doc: any) {
  try {
    if (!fontCache) {
      const res = await fetch('/fonts/NotoSansKR-Regular.ttf');
      if (!res.ok) throw new Error(String(res.status));
      const bytes = new Uint8Array(await res.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000)
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      fontCache = btoa(bin);
    }
    doc.addFileToVFS('NotoSansKR-Regular.ttf', fontCache);
    doc.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'normal');
    doc.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'bold');
    return true;
  } catch {
    return false;
  }
}

export async function exportBillingInvoicePdf(filename: string, d: BillingInvoiceData) {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const font = (await loadFont(doc)) ? 'NotoSansKR' : 'helvetica';
  doc.setFont(font, 'normal');
  const pageW = doc.internal.pageSize.getWidth();
  const m = 16;
  const grid = {
    theme: 'grid' as const,
    styles: {
      font,
      fontSize: 9,
      lineColor: [51, 51, 51] as [number, number, number],
      lineWidth: 0.2,
      textColor: [17, 17, 17] as [number, number, number],
      cellPadding: 2,
    },
  };
  const lbl = { fillColor: [241, 243, 245] as [number, number, number], halign: 'center' as const };

  doc.setFontSize(20);
  doc.text('청   구   서', pageW / 2, 26, { align: 'center' });

  // 왼쪽 — 청구일 · 번호 · 귀하
  doc.setFontSize(9);
  doc.setTextColor(68, 68, 68);
  doc.text(`청구일 ${d.issueDate}`, m, 40);
  doc.text(`청구 번호 ${d.no}`, m, 45);
  doc.setTextColor(17, 17, 17);
  doc.setFontSize(14);
  const nameW = doc.getTextWidth(d.receiverName);
  doc.text(d.receiverName, m, 62);
  doc.setFontSize(10);
  doc.text('귀하', m + nameW + 3, 62);

  // 오른쪽 — 공급자
  autoTable(doc, {
    ...grid,
    startY: 36,
    margin: { left: 98, right: m },
    body: [
      [
        { content: '공급자', rowSpan: 4, styles: { ...lbl, valign: 'middle' } },
        { content: '등록번호', styles: lbl },
        { content: d.supplier.bizNo, colSpan: 3 },
      ],
      [
        { content: '상호', styles: lbl },
        d.supplier.name,
        { content: '성명', styles: lbl },
        d.supplier.representative,
      ],
      [
        { content: '주소', styles: lbl },
        { content: d.supplier.address, colSpan: 3 },
      ],
      [
        { content: '연락처', styles: lbl },
        { content: d.supplier.phone, colSpan: 3 },
      ],
    ],
    columnStyles: { 0: { cellWidth: 9 }, 1: { cellWidth: 17 }, 3: { cellWidth: 12 } },
  });
  let y = Math.max((doc as any).lastAutoTable.finalY, 66) + 6;

  // 청구액
  autoTable(doc, {
    ...grid,
    startY: y,
    margin: { left: m, right: m },
    styles: {
      ...grid.styles,
      fontSize: 11,
      fontStyle: 'bold',
      minCellHeight: 10,
      valign: 'middle',
    },
    body: [
      [
        { content: '청구액', styles: lbl },
        `금 ${hangulAmount(d.grandTotal)} 원정`,
        { content: `( ₩ ${won(d.grandTotal)} )`, styles: { halign: 'right' } },
      ],
    ],
    columnStyles: { 0: { cellWidth: 22 }, 2: { cellWidth: 48 } },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // 품목
  const qty = d.items.reduce((a, it) => a + it.quantity, 0);
  const blank = Array.from({ length: Math.max(0, 8 - d.items.length) }, () => [
    '',
    '',
    '',
    '',
    '',
    '',
  ]);
  const r = { halign: 'right' as const };
  autoTable(doc, {
    ...grid,
    startY: y,
    margin: { left: m, right: m },
    head: [
      ['월일', '품명', `수량 (${d.items[0]?.unit ?? ''})`, '단가 (VAT 별도)', '공급가액', '비고'],
    ],
    headStyles: {
      fillColor: [241, 243, 245],
      textColor: [17, 17, 17],
      fontStyle: 'bold',
      halign: 'center',
    },
    body: [
      ...d.items.map((it) => [
        { content: it.date, styles: { halign: 'center' as const } },
        it.name,
        { content: won(it.quantity), styles: r },
        { content: won(it.unitPrice), styles: r },
        { content: won(it.supplyAmount), styles: r },
        { content: it.note, styles: { halign: 'center' as const } },
      ]),
      ...blank,
      [
        { content: '소 계', colSpan: 2, styles: { halign: 'center' as const } },
        { content: won(qty), styles: r },
        '',
        { content: won(d.supplyTotal), styles: r },
        '',
      ],
      [
        { content: '부가세', colSpan: 2, styles: { halign: 'center' as const } },
        '',
        '',
        { content: won(d.vatTotal), styles: r },
        '',
      ],
      [
        {
          content: '합 계',
          colSpan: 2,
          styles: { halign: 'center' as const, fontStyle: 'bold' as const },
        },
        '',
        '',
        { content: won(d.grandTotal), styles: { ...r, fontStyle: 'bold' as const } },
        '',
      ],
    ],
    columnStyles: {
      0: { cellWidth: 16 },
      2: { cellWidth: 28 },
      3: { cellWidth: 26 },
      4: { cellWidth: 32 },
      5: { cellWidth: 30 },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(9);
  doc.text('상기 내용을 확인하시어 아래 계좌로 결제 바랍니다. 감사합니다.', m, y);
  doc.text('납부 기한', m, y + 7);
  doc.text(d.dueDate, m + 24, y + 7);
  doc.text('결제 계좌', m, y + 13);
  doc.text(d.bankAccount, m + 24, y + 13);

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
