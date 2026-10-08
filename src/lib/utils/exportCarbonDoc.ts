import type { DocSpec } from '@/lib/carbon-docs';

// 카본 마켓 준비 서류 PDF — 서식 머리(별지 번호 · 근거 · 제출처 · 기한) → 칸(값 / 기업 작성) · 표 → 주의.
// 한글 폰트는 /fonts/NotoSansKR-Regular.ttf.

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

async function loadKoreanFont(doc: {
  addFileToVFS: (name: string, data: string) => void;
  addFont: (file: string, name: string, style: string) => void;
}) {
  try {
    if (!fontBase64Cache) {
      const res = await fetch('/fonts/NotoSansKR-Regular.ttf');
      if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
      fontBase64Cache = arrayBufferToBase64(await res.arrayBuffer());
    }
    doc.addFileToVFS('NotoSansKR-Regular.ttf', fontBase64Cache);
    doc.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'normal');
    doc.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'bold');
  } catch (e) {
    console.error('Korean font load failed:', e);
  }
}

/** 기업이 쓸 칸 */
export const BLANK = '(기업 작성)';

export async function exportCarbonDocPdf(filename: string, d: DocSpec, company: string) {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await loadKoreanFont(doc);
  doc.setFont('NotoSansKR', 'normal');
  const W = 210;
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  doc.setFontSize(8.5);
  doc.setTextColor(110);
  doc.text(`[${d.form}]  준비본 — ${company}`, 14, 14);
  doc.setTextColor(20);
  doc.setFontSize(16);
  doc.text(d.title, W / 2, 24, { align: 'center' });

  autoTable(doc, {
    startY: 30,
    body: [
      ['근거', d.basis],
      ['제출처', d.submitTo],
      ['기한', d.deadline],
      ['작성일', new Date().toISOString().slice(0, 10)],
    ],
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 1.8, font: 'NotoSansKR', textColor: [30, 30, 30] },
    columnStyles: { 0: { cellWidth: 28, fillColor: [238, 242, 247] } },
  });
  let y = lastY() + 7;

  for (const s of d.sections) {
    if (y > 265) {
      doc.addPage();
      y = 18;
    }
    doc.setFontSize(10.5);
    doc.text(s.title, 14, y);
    if (s.kind === 'fields') {
      autoTable(doc, {
        startY: y + 2.5,
        body: s.fields.map((f) => [f.label, f.value ?? BLANK]),
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 2, font: 'NotoSansKR', textColor: [30, 30, 30] },
        columnStyles: { 0: { cellWidth: 62, fillColor: [247, 249, 252] } },
        didParseCell: (h) => {
          if (h.column.index === 1 && h.cell.raw === BLANK) h.cell.styles.textColor = [160, 160, 160];
        },
      });
    } else {
      autoTable(doc, {
        startY: y + 2.5,
        head: [s.head],
        body: s.body,
        foot: s.foot ? [[{ content: s.foot[0] ?? '', styles: { halign: 'left' as const } }, ...s.foot.slice(1)] as unknown as string[]] : undefined,
        showFoot: 'lastPage',
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.6, font: 'NotoSansKR', halign: 'right' },
        headStyles: { fillColor: [30, 58, 95], font: 'NotoSansKR', halign: 'center' },
        footStyles: { fillColor: [230, 236, 242], textColor: [20, 20, 20], font: 'NotoSansKR' },
        columnStyles: { 0: { halign: 'left' } },
      });
    }
    y = lastY() + 7;
  }

  if (y > 250) {
    doc.addPage();
    y = 18;
  }
  doc.setFontSize(10.5);
  doc.text('주의', 14, y);
  doc.setFontSize(8.5);
  let ny = y + 5.5;
  for (const n of d.notes) {
    const ls = doc.splitTextToSize(`· ${n}`, W - 28) as string[];
    if (ny + ls.length * 4.2 > 285) {
      doc.addPage();
      ny = 18;
    }
    doc.text(ls, 14, ny);
    ny += ls.length * 4.2 + 1;
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(140);
    doc.text(`서식 원본: ${d.original}    ${p} / ${pages}`, W / 2, 291, { align: 'center' });
    doc.setTextColor(20);
  }

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
