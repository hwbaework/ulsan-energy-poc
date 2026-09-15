import { saveAs } from 'file-saver';

/* ─── Settlement Notice Types ─── */

export interface SettlementNoticeExportData {
  period: string; // "2026-05"
  plantName: string;
  generation: number; // kWh
  unitPrice: number; // ₩/kWh
  ppaRevenue: number;
  adjust: number;
  network: number;
  tradeFee: number;
  supplyFee: number;
  manageFee: number;
  vat: number;
  total: number;
}

export function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const bom = '﻿';
  const csv = [
    headers.join(','),
    ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

export async function exportExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(
    new Blob([buf], { type: 'application/octet-stream' }),
    filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`,
  );
}

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

async function loadKoreanFont(doc: any) {
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
  } catch (e) {
    console.error('Korean font load failed:', e);
  }
}

export async function exportPdf(
  filename: string,
  title: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: (rows[0]?.length ?? 0) > 6 ? 'landscape' : 'portrait' });
  await loadKoreanFont(doc);
  doc.setFont('NotoSansKR', 'normal');
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString('ko-KR')}`, 14, 22);
  autoTable(doc, {
    startY: 28,
    head: [headers],
    body: rows.map((r) => r.map(String)),
    styles: { fontSize: 8, cellPadding: 2, font: 'NotoSansKR' },
    headStyles: { fillColor: [30, 58, 95] },
  });
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/* ─── Settlement Notice PDF ─── */

function toKoreanAmount(n: number): string {
  const units = ['', '만', '억', '조'];
  const num = Math.abs(n);
  if (num === 0) return '영원';
  let result = '';
  let chunkIdx = 0;
  let rem = num;
  while (rem > 0) {
    const chunk = rem % 10000;
    if (chunk > 0) result = `${chunk.toLocaleString()}${units[chunkIdx]} ${result}`;
    rem = Math.floor(rem / 10000);
    chunkIdx++;
  }
  return `${n < 0 ? '음 ' : ''}${result.trim()}원`;
}

export async function exportSettlementNoticePdf(
  filename: string,
  data: SettlementNoticeExportData,
) {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await loadKoreanFont(doc);
  doc.setFont('NotoSansKR', 'normal');

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentW = pageW - margin * 2;

  // Parse period
  const [yearStr, monthStr] = data.period.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const mm = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  const periodStart = `${year}.${mm}.01`;
  const periodEnd = `${year}.${mm}.${String(lastDay).padStart(2, '0')}`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nm = String(nextMonth).padStart(2, '0');
  const issueDate = `${nextYear}.${nm}.10`;
  const dueDate = `${nextYear}.${nm}.25`;
  const noticeNo = `SN-${data.period}-01`;

  let y = margin;

  // [별지 제39호서식] top-right
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('[별지 제39호서식]', pageW - margin, y, { align: 'right' });
  y += 5;

  // Title
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 20);
  doc.setFont('NotoSansKR', 'bold');
  doc.text('정산금 통지서', pageW / 2, y + 6, { align: 'center', charSpace: 3 });
  y += 11;

  // Subtitle
  doc.setFontSize(8);
  doc.setFont('NotoSansKR', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Settlement Notice', pageW / 2, y + 3, { align: 'center' });
  doc.setTextColor(20, 20, 20);
  y += 8;

  // Horizontal divider
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  // Metadata 2-column grid
  const colW = contentW / 2 - 3;
  const labelColor: [number, number, number] = [120, 120, 120];
  const valueColor: [number, number, number] = [20, 20, 20];
  const dueColor: [number, number, number] = [180, 30, 30];
  const rowH = 5.5;

  const metaRows: [string, string, string, string][] = [
    ['통지서 번호', noticeNo, '발행일자', issueDate],
    ['정산 기간', `${periodStart} ~ ${periodEnd}`, '지급기한', dueDate],
  ];

  for (const [lbl1, val1, lbl2, val2] of metaRows) {
    doc.setFontSize(7.5);
    doc.setTextColor(...labelColor);
    doc.text(lbl1, margin, y + rowH);
    doc.setTextColor(...valueColor);
    doc.setFont('NotoSansKR', 'bold');
    doc.text(val1, margin + 26, y + rowH);
    doc.setFont('NotoSansKR', 'normal');

    doc.setTextColor(...labelColor);
    doc.text(lbl2, margin + colW + 6, y + rowH);
    if (lbl2 === '지급기한') {
      doc.setTextColor(...dueColor);
      doc.setFont('NotoSansKR', 'bold');
    } else {
      doc.setTextColor(...valueColor);
      doc.setFont('NotoSansKR', 'bold');
    }
    doc.text(val2, margin + colW + 32, y + rowH);
    doc.setFont('NotoSansKR', 'normal');
    doc.setTextColor(...valueColor);
    y += rowH + 1.5;
  }

  y += 2;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // ■ 정산 내역
  doc.setFontSize(9);
  doc.setFont('NotoSansKR', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text('■ 정산 내역', margin, y);
  y += 5;

  const fmt = (n: number) => n.toLocaleString('ko-KR');

  const tableBody: (string | { content: string; styles: object })[][] = [
    [
      '전력량 대금',
      fmt(data.ppaRevenue),
      `발전량 ${Math.round(data.generation).toLocaleString()} kWh × ₩${data.unitPrice}`,
    ],
    ['부가정산금', fmt(data.adjust), 'KPX 정산정정분'],
    ['망이용요금', fmt(data.network), '한전 단가표'],
    ['거래수수료 (전력거래소)', `−${fmt(data.tradeFee)}`, '차감'],
    ['거래수수료 (전력공급거래)', `−${fmt(data.supplyFee)}`, '차감'],
    ['관리 수수료', `−${fmt(data.manageFee)}`, '차감'],
    ['부가세 (10%)', fmt(data.vat), '+ 10%'],
  ];

  const totalRow = [
    {
      content: '합계',
      styles: { fontStyle: 'bold' as const, fillColor: [240, 243, 246] as any },
    },
    {
      content: `₩ ${fmt(data.total)}`,
      styles: {
        fontStyle: 'bold' as const,
        fillColor: [240, 243, 246] as any,
        halign: 'right' as const,
        fontSize: 9,
      },
    },
    {
      content: toKoreanAmount(data.total),
      styles: {
        fillColor: [240, 243, 246] as any,
        textColor: [80, 80, 80] as any,
        fontSize: 7,
      },
    },
  ];

  autoTable(doc, {
    startY: y,
    head: [
      [
        { content: '항목', styles: { halign: 'left' as const } },
        { content: '금액 (원)', styles: { halign: 'right' as const } },
        { content: '비고', styles: { halign: 'left' as const } },
      ],
    ],
    body: [...tableBody, totalRow as any],
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      font: 'NotoSansKR',
      lineColor: [190, 195, 200] as any,
      lineWidth: 0.25,
      textColor: [20, 20, 20] as any,
    },
    headStyles: {
      fillColor: [220, 228, 236] as any,
      fontStyle: 'bold' as const,
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: contentW * 0.42 },
      1: { cellWidth: contentW * 0.27, halign: 'right' },
      2: { cellWidth: contentW * 0.31, textColor: [100, 100, 100] as any },
    },
    margin: { left: margin, right: margin },
    didParseCell: (hookData) => {
      const row = hookData.row.index;
      const col = hookData.column.index;
      // Red text for negative amounts
      if (col === 1 && row >= 3 && row <= 5) {
        hookData.cell.styles.textColor = [180, 30, 30] as any;
      }
      // Green text for 전력량 대금
      if (col === 1 && row === 0) {
        hookData.cell.styles.textColor = [30, 130, 80] as any;
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ■ 지급 정보
  doc.setFontSize(9);
  doc.setFont('NotoSansKR', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text('■ 지급 정보', margin, y);
  y += 5;

  doc.setFontSize(8);
  doc.setFont('NotoSansKR', 'normal');

  const payInfoRows = [
    ['지급 방식', '계좌이체', [20, 20, 20] as [number, number, number]],
    ['지급 기한', dueDate, dueColor as [number, number, number]],
  ] as const;

  for (const [label, value, color] of payInfoRows) {
    doc.setTextColor(...labelColor);
    doc.text(label, margin + 2, y);
    doc.setTextColor(...color);
    doc.setFont('NotoSansKR', color === dueColor ? 'bold' : 'normal');
    doc.text(value, margin + 30, y);
    doc.setFont('NotoSansKR', 'normal');
    y += 5;
  }

  y += 6;

  // Legal text
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  const legalLines = doc.splitTextToSize(
    '본 통지서는 「전기사업법」 제16조 및 「전력거래 정산 운영규정」에 의거하여 위 정산 기간에 대한 정산금을 통지하는 문서입니다. 이의가 있으시면 발행일로부터 7일 이내 서면으로 신청해 주시기 바랍니다.',
    contentW,
  );
  doc.text(legalLines, margin, y);
  y += legalLines.length * 4 + 10;

  // Issue date centered
  doc.setFontSize(9);
  doc.setFont('NotoSansKR', 'normal');
  doc.setTextColor(20, 20, 20);
  doc.text(issueDate, pageW / 2, y, { align: 'center' });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/* ─── 정산금 통지서 HTML 미리보기 (별지 제39호 서식) ─── */

export function generateSettlementNoticeHtml(data: SettlementNoticeExportData): string {
  const [yearStr, monthStr] = data.period.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const mm = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  const periodStart = `${year}.${mm}.01`;
  const periodEnd = `${year}.${mm}.${String(lastDay).padStart(2, '0')}`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nm = String(nextMonth).padStart(2, '0');
  const issueDate = `${nextYear}.${nm}.10`;
  const dueDate = `${nextYear}.${nm}.25`;
  const noticeNo = `SN-${data.period}-01`;
  const fmt = (n: number) => n.toLocaleString('ko-KR');

  const tableRows = [
    [
      '전력량 대금',
      fmt(data.ppaRevenue),
      `발전량 ${Math.round(data.generation).toLocaleString()} kWh × ₩${data.unitPrice}`,
      'green',
    ],
    ['부가정산금', fmt(data.adjust), 'KPX 정산정정분', ''],
    ['망이용요금', fmt(data.network), '한전 단가표', ''],
    ['거래수수료 (전력거래소)', `−${fmt(data.tradeFee)}`, '차감', 'red'],
    ['거래수수료 (전력공급거래)', `−${fmt(data.supplyFee)}`, '차감', 'red'],
    ['관리 수수료', `−${fmt(data.manageFee)}`, '차감', 'red'],
    ['부가세 (10%)', fmt(data.vat), '+ 10%', ''],
  ];

  const bodyRows = tableRows
    .map(([item, amount, note, color]) => {
      const amtStyle =
        color === 'green'
          ? 'color:#1a7a47;font-weight:700'
          : color === 'red'
            ? 'color:#b81e1e'
            : '';
      return `<tr>
      <td class="tl">${item}</td>
      <td class="tr" style="${amtStyle}">${amount}</td>
      <td class="tc" style="color:#666">${note}</td>
    </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<title>정산금 통지서 미리보기</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #e8e8e8; font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; }

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

  .a4 {
    width: 210mm; min-height: 297mm;
    margin: 44px auto 20px;
    background: #fff;
    padding: 18mm 20mm 14mm;
    box-shadow: 0 4px 20px rgba(0,0,0,.25);
  }

  .form-tag { font-size: 7pt; color: #aaa; text-align: right; margin-bottom: 3mm; }
  .title { font-size: 22pt; font-weight: 900; letter-spacing: 0.2em; text-align: center; margin-bottom: 1.5mm; }
  .subtitle { font-size: 9pt; color: #888; text-align: center; margin-bottom: 6mm; }

  .divider { border: none; border-top: 0.4mm solid #bbb; margin: 0 0 5mm; }

  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 8mm; margin-bottom: 5mm; font-size: 9pt; }
  .meta-row { display: flex; gap: 4mm; align-items: baseline; }
  .meta-label { color: #888; min-width: 22mm; flex-shrink: 0; font-size: 8pt; }
  .meta-value { font-weight: 600; }
  .meta-value.due { color: #b81e1e; }

  .section-title { font-size: 10pt; font-weight: 800; margin: 5mm 0 2.5mm; }

  table.notice {
    width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 5mm;
  }
  table.notice thead tr { background: #dce4ec; }
  table.notice th { padding: 3mm 3.5mm; font-weight: 700; border: 0.3mm solid #b0bac4; }
  table.notice td { padding: 2.5mm 3.5mm; border: 0.25mm solid #c0c8d0; vertical-align: middle; }
  table.notice tr.total-row td { background: #edf1f5; font-weight: 800; }
  table.notice tr.total-row td:nth-child(2) { font-size: 10pt; }
  .tl { text-align: left; }
  .tr { text-align: right; font-variant-numeric: tabular-nums; }
  .tc { text-align: left; color: #666; }

  .pay-box { border: 0.3mm solid #bbb; border-radius: 2mm; padding: 4mm 5mm; margin-bottom: 6mm; font-size: 8.5pt; }
  .pay-row { display: flex; gap: 6mm; margin-bottom: 1.5mm; }
  .pay-label { color: #888; min-width: 20mm; }
  .pay-value { font-weight: 600; }
  .pay-value.due { color: #b81e1e; font-weight: 800; }

  .legal { font-size: 7pt; color: #777; line-height: 1.6; margin-bottom: 8mm; }

  .sign-date { font-size: 10pt; text-align: center; margin-top: 4mm; }

  @media print {
    html, body { background: #fff; }
    .print-bar { display: none; }
    .a4 { margin: 0; box-shadow: none; }
    @page { size: A4 portrait; margin: 0; }
  }
</style>
</head>
<body>

<div class="print-bar">
  <span>정산금 통지서 미리보기 (별지 제39호)</span>
  <button onclick="window.print()">🖨 인쇄 / PDF 저장</button>
</div>

<div class="a4">
  <div class="form-tag">[별지 제39호서식]</div>
  <h1 class="title">정산금 통지서</h1>
  <p class="subtitle">Settlement Notice</p>
  <hr class="divider"/>

  <div class="meta-grid">
    <div class="meta-row">
      <span class="meta-label">통지서 번호</span>
      <span class="meta-value">${noticeNo}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">발행일자</span>
      <span class="meta-value">${issueDate}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">정산 기간</span>
      <span class="meta-value">${periodStart} ~ ${periodEnd}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">지급기한</span>
      <span class="meta-value due">${dueDate}</span>
    </div>
  </div>
  <hr class="divider"/>

  <p class="section-title">■ 정산 내역</p>
  <table class="notice">
    <thead>
      <tr>
        <th class="tl" style="width:44%">항목</th>
        <th class="tr" style="width:27%">금액 (원)</th>
        <th class="tl" style="width:29%">비고</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
      <tr class="total-row">
        <td class="tl">합&nbsp;&nbsp;&nbsp;&nbsp;계</td>
        <td class="tr">₩ ${fmt(data.total)}</td>
        <td class="tc" style="font-size:7pt;font-weight:400;color:#666">${toKoreanAmount(data.total)}</td>
      </tr>
    </tbody>
  </table>

  <div class="pay-box">
    <p style="font-weight:700;margin-bottom:2mm">■ 지급 정보</p>
    <div class="pay-row">
      <span class="pay-label">지급 방식</span>
      <span class="pay-value">계좌이체</span>
    </div>
    <div class="pay-row" style="margin-bottom:0">
      <span class="pay-label">지급 기한</span>
      <span class="pay-value due">${dueDate}</span>
    </div>
  </div>

  <p class="legal">
    본 통지서는 「전기사업법」 제16조 및 「전력거래 정산 운영규정」에 의거하여 위 정산 기간에 대한
    정산금을 통지하는 문서입니다. 이의가 있으시면 발행일로부터 7일 이내 서면으로 신청해 주시기 바랍니다.
  </p>

  <p class="sign-date">${issueDate}</p>
</div>

</body>
</html>`;
}
