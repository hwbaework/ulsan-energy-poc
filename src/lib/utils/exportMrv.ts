import { saveAs } from 'file-saver';

// MRV 출력 유틸 — 배출량 명세서(PDF/Excel/NGMS-CSV) · 공시 서식(PDF/CSV).
// 실 산정데이터(useGhgCalculation·useGhgSources·useGhgDisclosure·useGhgTarget·narrative)만 사용 — 가짜 데이터 없음.
// 한글 폰트: /fonts/NotoSansKR-Regular.ttf (export.ts와 동일 방식 재사용).
// 라이브러리는 이미 설치된 jspdf@4·jspdf-autotable@5·xlsx·xlsx-js-style·file-saver 만 사용(신규 추가 없음).

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

// ── 배출량 명세서 (목표관리제 양식) ──

export interface StatementDetailRow {
  site: string; // 사업장
  facility: string; // 시설
  scope: number; // 1 | 2
  category: string; // 배출활동(sources 매핑)
  activity: number; // 활동량
  unit: string; // 단위
  factor: number; // 배출계수
  tCO2eq: number; // 배출량
}

export interface StatementExportData {
  company: string;
  year: number;
  status: string; // 미생성 | 작성중 | 제출 | 검증완료
  rows: StatementDetailRow[];
  scope1: number;
  scope2: number;
  total: number;
}

const nf = (n: number) => n.toLocaleString('ko-KR');
const ff = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');

/** 명세서 상세 테이블 헤더 — PDF/Excel/CSV 공통 컬럼 순서. */
const STMT_HEADERS = [
  '사업장',
  '시설',
  'Scope',
  '배출활동',
  '활동량',
  '단위',
  '배출계수',
  '배출량(tCO₂eq)',
];

function stmtBodyRows(d: StatementExportData): (string | number)[][] {
  const body: (string | number)[][] = d.rows.map((r) => [
    r.site,
    r.facility,
    `Scope ${r.scope}`,
    r.category,
    nf(r.activity),
    r.unit,
    ff(r.factor),
    nf(Math.round(r.tCO2eq)),
  ]);
  return body;
}

/** 배출량 명세서 PDF — 목표관리제 양식 헤더 + 상세 테이블 + Scope1/2/총량 합계. */
export async function exportStatementPdf(filename: string, d: StatementExportData) {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  await loadKoreanFont(doc);
  doc.setFont('NotoSansKR', 'normal');

  doc.setFontSize(15);
  doc.text('온실가스 배출량 명세서', 14, 16);
  doc.setFontSize(9);
  doc.text('(온실가스 목표관리제 · 명세서 양식)', 14, 22);
  doc.setFontSize(9);
  doc.text(`대상 회사: ${d.company}    대상 연도: ${d.year}년    상태: ${d.status}`, 14, 29);
  doc.text(`작성일: ${new Date().toLocaleString('ko-KR')}`, 14, 34);

  autoTable(doc, {
    startY: 40,
    head: [STMT_HEADERS],
    body: stmtBodyRows(d).map((r) => r.map(String)),
    foot: [
      [
        {
          content: '합계',
          colSpan: 7,
          styles: { halign: 'right', fontStyle: 'bold' },
        } as unknown as string,
        nf(Math.round(d.total)),
      ],
    ],
    styles: { fontSize: 8, cellPadding: 2, font: 'NotoSansKR' },
    headStyles: { fillColor: [30, 58, 95], font: 'NotoSansKR' },
    footStyles: {
      fillColor: [230, 236, 242],
      textColor: [20, 20, 20],
      font: 'NotoSansKR',
      fontStyle: 'bold',
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFontSize(10);
  doc.text(`Scope 1 (직접배출): ${nf(Math.round(d.scope1))} tCO₂eq`, 14, finalY);
  doc.text(`Scope 2 (간접배출·전력): ${nf(Math.round(d.scope2))} tCO₂eq`, 14, finalY + 6);
  doc.setFontSize(11);
  doc.text(`총 배출량: ${nf(Math.round(d.total))} tCO₂eq`, 14, finalY + 13);

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/** 배출량 명세서 Excel(.xlsx) — 상세 시트(행 + 합계행 + Scope 요약). */
export async function exportStatementExcel(filename: string, d: StatementExportData) {
  const XLSX = await import('xlsx');
  const aoa: (string | number)[][] = [
    ['온실가스 배출량 명세서 (목표관리제 양식)'],
    [`회사: ${d.company}`, `연도: ${d.year}`, `상태: ${d.status}`],
    [],
    STMT_HEADERS,
    ...stmtBodyRows(d),
    [],
    ['합계', '', '', '', '', '', '', Math.round(d.total)],
    ['Scope 1 (직접배출)', '', '', '', '', '', '', Math.round(d.scope1)],
    ['Scope 2 (간접배출·전력)', '', '', '', '', '', '', Math.round(d.scope2)],
    ['총 배출량', '', '', '', '', '', '', Math.round(d.total)],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '명세서');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(
    new Blob([buf], { type: 'application/octet-stream' }),
    filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`,
  );
}

/**
 * NGMS(국가온실가스종합관리시스템) 보고용 CSV — UTF-8 BOM.
 * ⚠️ NGMS 공식 제출 스키마는 미상 — 합리적 표준 컬럼으로 실 산정데이터를 export한다.
 *    실제 제출 전 NGMS 규격(항목·코드체계) 확인이 필요하다. (가짜 데이터 아님 — 실 산정 export)
 */
export function exportStatementNgmsCsv(filename: string, d: StatementExportData) {
  const bom = '﻿';
  const headers = [
    '사업장',
    '시설',
    'Scope',
    '배출활동',
    '활동량',
    '단위',
    '배출계수',
    '배출량_tCO2eq',
    '연도',
  ];
  const rows: (string | number)[][] = d.rows.map((r) => [
    r.site,
    r.facility,
    `Scope${r.scope}`,
    r.category,
    r.activity,
    r.unit,
    r.factor,
    Math.round(r.tCO2eq),
    d.year,
  ]);
  const esc = (c: string | number) => `"${String(c).replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

// ── 공시 서식 (ISSB/KSSB) ──

export interface DisclosureExportData {
  framework: 'ISSB' | 'KSSB';
  year: number;
  company: string;
  governance: string;
  strategy: string;
  riskMgmt: string;
  scope1: number;
  scope2: number;
  scope3: number;
  target: { baseYear: number; targetYear: number; targetTco2: number };
}

const frameworkTitle = (f: 'ISSB' | 'KSSB') =>
  f === 'ISSB' ? 'IFRS S2 기후 관련 공시' : 'KSSB 제2호 기후공시';

function disclosureSections(d: DisclosureExportData): [string, string][] {
  const targetLine =
    d.target.targetTco2 > 0
      ? `${d.target.targetYear}년 ${nf(Math.round(d.target.targetTco2))} tCO₂eq (기준연도 ${d.target.baseYear})`
      : '감축목표 미설정';
  return [
    ['거버넌스', d.governance || '(입력 필요)'],
    ['전략', d.strategy || '(입력 필요)'],
    ['위험관리', d.riskMgmt || '(입력 필요)'],
    ['지표·목표 — Scope 1 (직접배출)', `${nf(Math.round(d.scope1))} tCO₂eq`],
    ['지표·목표 — Scope 2 (간접배출)', `${nf(Math.round(d.scope2))} tCO₂eq`],
    ['지표·목표 — Scope 3 (기타 간접)', `${nf(Math.round(d.scope3))} tCO₂eq`],
    ['지표·목표 — 감축목표', targetLine],
  ];
}

/** 공시 서식 PDF — 거버넌스/전략/위험관리 서술 + Scope1/2/3 + 감축목표. */
export async function exportDisclosurePdf(filename: string, d: DisclosureExportData) {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await loadKoreanFont(doc);
  doc.setFont('NotoSansKR', 'normal');

  doc.setFontSize(15);
  doc.text(`${frameworkTitle(d.framework)} ${d.year}`, 14, 16);
  doc.setFontSize(9);
  doc.text(`대상 회사: ${d.company}    작성일: ${new Date().toLocaleString('ko-KR')}`, 14, 23);

  autoTable(doc, {
    startY: 30,
    head: [['공시 항목', '내용']],
    body: disclosureSections(d),
    styles: { fontSize: 9, cellPadding: 3, font: 'NotoSansKR', valign: 'top' },
    headStyles: { fillColor: [30, 58, 95], font: 'NotoSansKR' },
    columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/** 공시 서식 CSV — UTF-8 BOM. 미리보기 pre 내용과 정합. */
export function exportDisclosureCsv(filename: string, d: DisclosureExportData) {
  const bom = '﻿';
  const headers = ['프레임워크', '연도', '회사', '공시항목', '내용'];
  const esc = (c: string | number) => `"${String(c).replace(/"/g, '""')}"`;
  const rows = disclosureSections(d).map(([item, content]) => [
    frameworkTitle(d.framework),
    d.year,
    d.company,
    item,
    content.replace(/\n/g, ' '),
  ]);
  const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}
