/* ──────────────────────────────────────────────────────────────────────────
 * 분산에너지 효율화 컨설팅 — 도입효과 보고서 PDF
 *   헤더(제목·기업·단계) → 진단 요약(에너지사용·전력비용·온실가스·성숙도) →
 *   Mix 시뮬레이션 시나리오(추천 포함) → 면책 문구.
 *   진단·컨설팅·Mix 시뮬 실데이터 기반. 한글은 NotoSansKR 임베드
 *   (exportDiagnosisReport 등 다른 export 유틸과 동일 방식).
 * ────────────────────────────────────────────────────────────────────────── */

export interface DerConsultingReportScenario {
  name: string;
  costSavingKrw: number;
  ghgReductionTon: number;
  selfSufficiencyPct: number;
  paybackYears: number | null;
  recommended: boolean;
}

export interface DerConsultingReportData {
  companyName: string;
  status?: string;
  maturityGrade?: string;
  // 진단 요약(있을 때만 표기)
  annualEnergyUsageMwh?: number;
  currentElecCostKrw?: number;
  annualGhgTon?: number;
  // Mix 시뮬레이션 시나리오(실행됐을 때만)
  scenarios: DerConsultingReportScenario[];
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

const won = (n: number) => `${Math.round(n).toLocaleString()}원`;

export async function exportDerConsultingReport(data: DerConsultingReportData): Promise<void> {
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
  doc.text('분산에너지 효율화 컨설팅 · 도입효과 보고서', margin, y);
  y += 7;
  doc.setFont(font, 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(90);
  const meta = [
    data.companyName,
    data.status ? `단계 ${data.status}` : null,
    `생성일 ${todayLabel()}`,
  ]
    .filter(Boolean)
    .join(' · ');
  doc.text(meta, margin, y);
  doc.setTextColor(0);
  y += 6;
  doc.setDrawColor(210);
  doc.line(margin, y, pageW - margin, y);
  y += 9;

  // ── 진단 요약 ──
  doc.setFont(font, 'bold');
  doc.setFontSize(13);
  doc.text('에너지 사용 진단 요약', margin, y);
  y += 3;

  const summaryRows: [string, string][] = [];
  if (data.annualEnergyUsageMwh != null)
    summaryRows.push(['연간 에너지 사용량', `${data.annualEnergyUsageMwh.toLocaleString()} MWh`]);
  if (data.currentElecCostKrw != null)
    summaryRows.push(['연간 전력비용', won(data.currentElecCostKrw)]);
  if (data.annualGhgTon != null)
    summaryRows.push(['연간 온실가스', `${data.annualGhgTon.toLocaleString()} tCO₂`]);
  if (data.maturityGrade) summaryRows.push(['성숙도 등급', data.maturityGrade]);
  if (summaryRows.length === 0) summaryRows.push(['진단 데이터', '없음 — 진단 선행 필요']);

  autoTable(doc, {
    startY: y,
    head: [['지표', '값']],
    body: summaryRows,
    theme: 'grid',
    styles: { font, fontSize: 9, cellPadding: 2.4, textColor: 30 },
    headStyles: { font, fontStyle: 'bold', fillColor: [240, 240, 240], textColor: 40 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Mix 시뮬레이션 시나리오 ──
  doc.setFont(font, 'bold');
  doc.setFontSize(13);
  doc.text('에너지 Mix 시뮬레이션', margin, y);
  y += 3;

  if (data.scenarios.length === 0) {
    doc.setFont(font, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(
      '시뮬레이션 결과가 없습니다. 진단 기반 Mix 시뮬레이션을 먼저 실행하세요.',
      margin,
      y + 6,
    );
    doc.setTextColor(0);
    y += 12;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['시나리오', '비용절감', '탄소감축(t)', '자립률', '투자회수']],
      body: data.scenarios.map((s) => [
        s.name + (s.recommended ? ' (추천)' : ''),
        won(s.costSavingKrw),
        `-${s.ghgReductionTon.toFixed(1)}`,
        `${s.selfSufficiencyPct.toFixed(1)}%`,
        s.paybackYears != null ? `${s.paybackYears.toFixed(1)}년` : '회수 불가',
      ]),
      theme: 'grid',
      styles: { font, fontSize: 9, cellPadding: 2.4, textColor: 30 },
      headStyles: { font, fontStyle: 'bold', fillColor: [240, 240, 240], textColor: 40 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
      },
      margin: { left: margin, right: margin },
      didParseCell: (hookData: any) => {
        const s = data.scenarios[hookData.row.index];
        if (hookData.section === 'body' && s?.recommended) {
          hookData.cell.styles.fillColor = [235, 245, 238];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    doc.setFont(font, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(
      '절감률 = 절감량 ÷ 기준사용량 × 100 · TOE = 절감량 × 0.229×10⁻³ · 탄소 = 절감량 × 0.4173×10⁻³',
      margin,
      y,
    );
    doc.setTextColor(0);
  }

  // ── 면책 푸터 ──
  const footerY = doc.internal.pageSize.getHeight() - 14;
  doc.setFont(font, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(150);
  doc.text(
    '본 보고서는 진단·컨설팅 및 Mix 시뮬레이션 결과 기반 도입효과 추정이며, 실제 수치는 정밀 진단 시 확정됩니다. · RMS 에너지 플랫폼',
    margin,
    footerY,
  );
  doc.setTextColor(0);

  doc.save(`분산에너지_도입효과보고서_${data.companyName}_${todayLabel()}.pdf`);
}
