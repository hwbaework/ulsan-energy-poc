import { saveAs } from 'file-saver';

// 온실가스 감축 실적 — 명세서(PDF/Excel) · 보고서(PDF).
// 화면과 같은 산정값(lib/ghg-reduction.ts)만 받아 그대로 찍는다. 한글 폰트는 /fonts/NotoSansKR-Regular.ttf.

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

const n0 = (v: number) => v.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
const n1 = (v: number) => v.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n2 = (v: number) => v.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n3 = (v: number) => v.toLocaleString('ko-KR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const today = () => new Date().toISOString().slice(0, 10);

/** 명세서 · 보고서 한 줄 — 설비 × 달 */
export interface GhgLine {
  company: string;
  kind: string;
  month: string;
  kw: number;
  kwh: number;
  tco2: number;
  toe: number;
  pine: number;
}
export interface GhgSum {
  kwh: number;
  tco2: number;
  toe: number;
  pine: number;
}
export interface GhgFactorText {
  co2: number;
  toe: number;
  pine: number;
  year: string;
  published: string;
}
export interface GhgDocData {
  /** 대상 — 기업명 또는 '전체 기업' */
  target: string;
  address?: string;
  from: string;
  to: string;
  lines: GhgLine[];
  sum: GhgSum;
  factors: GhgFactorText;
  /** 기업별 합계 — 전체 기업일 때 */
  byCompany?: ({ company: string; kw: number } & GhgSum)[];
  /** 월별 합계 */
  byMonth: ({ month: string } & GhgSum)[];
}

const STMT_HEAD = ['기업', '설비', '월', '설비 용량(kW)', '발전량(kWh)', '감축량(tCO2eq)', '화석에너지 대체(TOE)', '소나무 식재(그루)'];
const stmtBody = (d: GhgDocData) =>
  d.lines.map((l) => [l.company, l.kind, l.month, n2(l.kw), n0(l.kwh), n3(l.tco2), n3(l.toe), n1(l.pine)]);
const factorLine = (f: GhgFactorText) =>
  `전력 배출계수 ${f.co2} tCO2eq/MWh (${f.year}년 기준 · ${f.published} 공표) · 화석에너지 대체 ${f.toe} TOE/MWh · 소나무 식재 ${f.pine} 그루/tCO2 (20년생)`;

type Doc = InstanceType<typeof import('jspdf').default>;
const lastY = (doc: Doc) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
/** 합계 줄 — 첫 칸 말고 오른쪽 정렬 */
const foot = (cells: string[]) => [
  cells.map((c, i) => (i === 0 ? c : { content: c, styles: { halign: 'right' as const } })) as unknown as string[],
];
const tableStyle = {
  showFoot: 'lastPage' as const,
  styles: { fontSize: 8, cellPadding: 1.8, font: 'NotoSansKR' },
  headStyles: { fillColor: [30, 58, 95] as [number, number, number], font: 'NotoSansKR', halign: 'center' as const },
  footStyles: {
    fillColor: [230, 236, 242] as [number, number, number],
    textColor: [20, 20, 20] as [number, number, number],
    font: 'NotoSansKR',
    fontStyle: 'bold' as const,
  },
};

/** 감축 실적 명세서 PDF — 머리(대상 · 기간 · 계수) + 설비 × 달 표 + 합계 */
export async function exportGhgStatementPdf(filename: string, d: GhgDocData) {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  await loadKoreanFont(doc);
  doc.setFont('NotoSansKR', 'normal');

  doc.setFontSize(15);
  doc.text('온실가스 감축 실적 명세서', 14, 16);
  doc.setFontSize(9);
  doc.text(`대상: ${d.target}${d.address ? `  (${d.address})` : ''}    기간: ${d.from} ~ ${d.to}    작성일: ${today()}`, 14, 23);
  doc.text(factorLine(d.factors), 14, 28);
  doc.text('감축량 = 태양광 자가소비 발전량(MWh) × 전력 배출계수', 14, 33);

  autoTable(doc, {
    startY: 38,
    head: [STMT_HEAD],
    body: stmtBody(d),
    foot: foot(['합계', '', '', '', n0(d.sum.kwh), n3(d.sum.tco2), n3(d.sum.toe), n0(d.sum.pine)]),
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
    ...tableStyle,
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/** 감축 실적 명세서 Excel */
export async function exportGhgStatementExcel(filename: string, d: GhgDocData) {
  const XLSX = await import('xlsx');
  const aoa: (string | number)[][] = [
    ['온실가스 감축 실적 명세서'],
    [`대상: ${d.target}`, `기간: ${d.from} ~ ${d.to}`, `작성일: ${today()}`],
    [factorLine(d.factors)],
    [],
    STMT_HEAD,
    ...d.lines.map((l) => [l.company, l.kind, l.month, l.kw, l.kwh, l.tco2, l.toe, l.pine]),
    [],
    ['합계', '', '', '', d.sum.kwh, d.sum.tco2, d.sum.toe, d.sum.pine],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 12 }, { wch: 9 }, { wch: 9 }, { wch: 13 }, { wch: 13 }, { wch: 15 }, { wch: 18 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '명세서');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/** 막대 그래프 — 월별 감축량 */
function drawBars(doc: Doc, x: number, y: number, w: number, h: number, items: { label: string; value: number }[]) {
  const max = Math.max(...items.map((i) => i.value), 0) || 1;
  doc.setDrawColor(220);
  for (let i = 0; i <= 4; i++) {
    const gy = y + h - (h * i) / 4;
    doc.line(x, gy, x + w, gy);
    doc.setFontSize(6.5);
    doc.setTextColor(120);
    doc.text(n1((max * i) / 4), x - 1.5, gy + 1, { align: 'right' });
  }
  const slot = w / Math.max(items.length, 1);
  const bw = Math.min(slot * 0.6, 10);
  items.forEach((it, i) => {
    const bh = (h * it.value) / max;
    const bx = x + slot * i + (slot - bw) / 2;
    doc.setFillColor(245, 158, 11); // 태양광 노랑
    doc.rect(bx, y + h - bh, bw, bh, 'F');
    doc.setTextColor(90);
    doc.text(it.label, bx + bw / 2, y + h + 4, { align: 'center' });
  });
  doc.setTextColor(20);
}

/** 요약 칸 — 이름 · 값 · 단위 */
function drawBox(doc: Doc, x: number, y: number, w: number, label: string, value: string, unit: string) {
  doc.setDrawColor(210);
  doc.setFillColor(247, 249, 252);
  doc.roundedRect(x, y, w, 20, 1.5, 1.5, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(label, x + 4, y + 6);
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text(value, x + 4, y + 15);
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(unit, x + w - 4, y + 15, { align: 'right' });
  doc.setTextColor(20);
}

/** 감축 실적 보고서 PDF — 요약 → 월별 그래프 → 기업별 → 월별 표 → 산정 기준 */
export async function exportGhgReportPdf(filename: string, d: GhgDocData) {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await loadKoreanFont(doc);
  doc.setFont('NotoSansKR', 'normal');
  const W = 210;

  doc.setFillColor(13, 21, 32);
  doc.rect(0, 0, W, 30, 'F');
  doc.setTextColor(255);
  doc.setFontSize(16);
  doc.text('온실가스 감축 실적 보고서', 14, 15);
  doc.setFontSize(9);
  doc.text(`${d.target}  ·  ${d.from} ~ ${d.to}  ·  작성일 ${today()}`, 14, 23);
  doc.setTextColor(20);

  let y = 38;
  doc.setFontSize(11);
  doc.text('1. 요약', 14, y);
  y += 4;
  const bw = (W - 28 - 9) / 4;
  drawBox(doc, 14, y, bw, '감축량', n2(d.sum.tco2), 'tCO2eq');
  drawBox(doc, 14 + (bw + 3), y, bw, '자가소비 발전량', n1(d.sum.kwh / 1000), 'MWh');
  drawBox(doc, 14 + (bw + 3) * 2, y, bw, '화석에너지 대체', n2(d.sum.toe), 'TOE');
  drawBox(doc, 14 + (bw + 3) * 3, y, bw, '소나무 식재', n0(d.sum.pine), '그루');
  y += 30;

  doc.setFontSize(11);
  doc.text('2. 월별 감축량 (tCO2eq)', 14, y);
  y += 6;
  drawBars(
    doc,
    24,
    y,
    W - 38,
    50,
    d.byMonth.map((m) => ({ label: m.month.slice(2).replace('-', '.'), value: m.tco2 })),
  );
  y += 62;

  if (d.byCompany && d.byCompany.length > 0) {
    doc.setFontSize(11);
    doc.text('3. 기업별 감축 실적', 14, y);
    autoTable(doc, {
      startY: y + 3,
      head: [['기업', '설비 용량(kW)', '발전량(kWh)', '감축량(tCO2eq)', '화석에너지 대체(TOE)', '소나무 식재(그루)', '비중']],
      body: d.byCompany.map((c) => [
        c.company,
        n2(c.kw),
        n0(c.kwh),
        n3(c.tco2),
        n3(c.toe),
        n0(c.pine),
        `${n1(d.sum.tco2 ? (c.tco2 / d.sum.tco2) * 100 : 0)}%`,
      ]),
      foot: foot(['합계', n2(d.byCompany.reduce((a, c) => a + c.kw, 0)), n0(d.sum.kwh), n3(d.sum.tco2), n3(d.sum.toe), n0(d.sum.pine), '100.0%']),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
      ...tableStyle,
    });
    y = lastY(doc) + 10;
  }

  const no = d.byCompany && d.byCompany.length > 0 ? 4 : 3;
  doc.setFontSize(11);
  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  doc.text(`${no}. 월별 감축 실적`, 14, y);
  autoTable(doc, {
    startY: y + 3,
    head: [['월', '발전량(kWh)', '감축량(tCO2eq)', '화석에너지 대체(TOE)', '소나무 식재(그루)']],
    body: d.byMonth.map((m) => [m.month, n0(m.kwh), n3(m.tco2), n3(m.toe), n0(m.pine)]),
    foot: foot(['합계', n0(d.sum.kwh), n3(d.sum.tco2), n3(d.sum.toe), n0(d.sum.pine)]),
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    ...tableStyle,
  });
  y = lastY(doc) + 10;

  if (y > 260) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(11);
  doc.text(`${no + 1}. 산정 기준`, 14, y);
  doc.setFontSize(8.5);
  const basis = [
    '감축량(tCO2eq) = 태양광 자가소비 발전량(MWh) × 전력 배출계수',
    '화석에너지 대체(TOE) = 발전량(MWh) × TOE 환산계수 · 소나무 식재(그루) = 감축량(tCO2eq) × 그루 환산계수',
    factorLine(d.factors),
    '발전량: 설비별 월 발전량(설비 용량 × 하루 평균 발전시간 × 날수) — 데이터 마켓 태양광 발전량과 같은 값',
  ];
  let by = y + 6;
  basis.forEach((t) => {
    const ls = doc.splitTextToSize(`· ${t}`, W - 28) as string[];
    doc.text(ls, 14, by);
    by += ls.length * 4.2 + 1;
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(140);
    doc.text(`울산 에너지 자급자족 플랫폼 · 온실가스 인벤토리    ${p} / ${pages}`, W / 2, 290, { align: 'center' });
  }

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
