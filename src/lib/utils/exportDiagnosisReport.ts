/* ──────────────────────────────────────────────────────────────────────────
 * 에너지 컨설팅 무료진단 리포트 PDF
 *   헤더(제목·도메인·기업) → 진단 등급 → 요약 지표(표) →
 *   주요 리스크 → 기회 요인 → 면책 문구
 *   한글은 NotoSansKR 임베드(다른 export 유틸과 동일 방식).
 * ────────────────────────────────────────────────────────────────────────── */

export interface DiagnosisReportPdfData {
  domainLabel: string;
  grade: string; // A~F
  gradeLabel: string; // "A등급 (우수)"
  gradeDescription: string;
  metricLabel: string; // 재생에너지 비율 / 탄소관리 성숙도 / 분산자원 성숙도
  summaryMetrics: { label: string; value: string; isInput: boolean }[];
  risks: string[];
  opportunities: string[];
  companyName?: string;
  contactName?: string;
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

async function loadKoreanFont(doc: any): Promise<boolean> {
  try {
    if (!fontBase64Cache) {
      const res = await fetch('/fonts/NotoSansKR-Regular.ttf');
      if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
      fontBase64Cache = arrayBufferToBase64(await res.arrayBuffer());
    }
    doc.addFileToVFS('NotoSansKR-Regular.ttf', fontBase64Cache);
    doc.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'normal');
    doc.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'bold');
    return true;
  } catch (e) {
    console.error('Korean font load failed:', e);
    return false;
  }
}

function todayLabel(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

export async function exportDiagnosisReport(data: DiagnosisReportPdfData): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const hasFont = await loadKoreanFont(doc);
  const font = hasFont ? 'NotoSansKR' : 'helvetica';
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 18;

  // ── 헤더 ──
  doc.setFont(font, 'bold');
  doc.setFontSize(18);
  doc.text('에너지 컨설팅 진단 리포트', margin, y);
  y += 7;
  doc.setFont(font, 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(90);
  doc.text(`${data.domainLabel} · 생성일 ${todayLabel()}`, margin, y);
  if (data.companyName || data.contactName) {
    y += 5.5;
    const who = [data.companyName, data.contactName].filter(Boolean).join(' · ');
    doc.text(who, margin, y);
  }
  doc.setTextColor(0);
  y += 6;
  doc.setDrawColor(210);
  doc.line(margin, y, pageW - margin, y);
  y += 9;

  // ── 진단 등급 ──
  doc.setFont(font, 'bold');
  doc.setFontSize(13);
  doc.text('진단 등급', margin, y);
  y += 7;
  doc.setFontSize(26);
  doc.text(`${data.grade}`, margin, y + 2);
  doc.setFontSize(12);
  doc.text(data.gradeLabel, margin + 16, y);
  doc.setFont(font, 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(80);
  doc.text(`${data.metricLabel} 기반`, margin + 16, y + 5);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(40);
  const descLines = doc.splitTextToSize(data.gradeDescription, pageW - margin * 2);
  doc.text(descLines, margin, y + 2);
  doc.setTextColor(0);
  y += descLines.length * 5 + 7;

  // ── 요약 지표 표 ──
  doc.setFont(font, 'bold');
  doc.setFontSize(13);
  doc.text('진단 요약 지표', margin, y);
  y += 3;
  autoTable(doc, {
    startY: y,
    head: [['지표', '값', '구분']],
    body: data.summaryMetrics.map((m) => [m.label, m.value, m.isInput ? '입력값' : '추정']),
    theme: 'grid',
    styles: { font, fontSize: 9, cellPadding: 2.4, textColor: 30 },
    headStyles: { font, fontStyle: 'bold', fillColor: [240, 240, 240], textColor: 40 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center', cellWidth: 22 } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // ── 리스크 / 기회 ──
  const bulletSection = (title: string, items: string[]) => {
    doc.setFont(font, 'bold');
    doc.setFontSize(12);
    doc.text(title, margin, y);
    y += 6;
    doc.setFont(font, 'normal');
    doc.setFontSize(10);
    for (const it of items) {
      const lines = doc.splitTextToSize(`• ${it}`, pageW - margin * 2);
      doc.text(lines, margin, y);
      y += lines.length * 5 + 1.5;
    }
    y += 5;
  };
  bulletSection('주요 리스크', data.risks);
  bulletSection('기회 요인', data.opportunities);

  // ── 면책 푸터 ──
  const footerY = doc.internal.pageSize.getHeight() - 14;
  doc.setFont(font, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(150);
  doc.text(
    '본 리포트는 입력값 기반 AI 추정 결과이며, 실제 수치는 컨설팅 진행 시 정밀 진단됩니다. · RMS 에너지 컨설팅 플랫폼',
    margin,
    footerY,
  );
  doc.setTextColor(0);

  doc.save(`진단리포트_${data.domainLabel}_${todayLabel()}.pdf`);
}
