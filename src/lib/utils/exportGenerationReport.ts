/* ──────────────────────────────────────────────────────────────────────────
 * 월간 발전 보고서 PDF — 참조 양식(월간발전보고서_제작_v1.0) 레이아웃 재현
 *   헤더(발전소 정보) → 요약 지표 → 일별 발전량(차트+표) →
 *   시간대별 발전량(차트+표) → 수익 분석(표) → 면책 문구 → 푸터
 *   데이터가 없는 값은 참조 양식과 동일하게 표/수익은 '—', 헤더는 공백 처리.
 * ────────────────────────────────────────────────────────────────────────── */

export interface MonthlyGenerationReportData {
  plantName?: string;
  capacityKw?: number;
  address?: string;
  period?: string; // "YYYY.MM"
  monthTotalKwh?: number;
  cumulativeKwh?: number;
  monthHours?: number;
  dailyAvgHours?: number;
  regionAvgHours?: number;
  dailyKwh?: (number | null | undefined)[]; // index 0 = 1일, 최대 31
  hourlyKwh?: (number | null | undefined)[]; // index 0 = 00시, 길이 24
  revenue?: {
    totalKwh?: number;
    unitPrice?: number; // 원/kWh
    monthRevenue?: number; // 원
    cumulativeRevenue?: number; // 원
  };
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

const num = (v?: number | null) => (v === undefined || v === null || Number.isNaN(v) ? null : v);
const dash = (v?: number | null) => {
  const n = num(v);
  return n === null ? '—' : n.toLocaleString('ko-KR');
};
const blank = (v?: number | null) => {
  const n = num(v);
  return n === null ? '' : n.toLocaleString('ko-KR');
};
const pad2 = (n: number) => String(n).padStart(2, '0');

/** 라인 차트 — 가로 가이드라인 4개 + x축 눈금 라벨, 데이터 있으면 폴리라인 */
function drawLineChart(
  doc: any,
  x: number,
  y: number,
  w: number,
  h: number,
  values: (number | null | undefined)[],
  xTicks: { pos: number; label: string }[], // pos: 0~1 비율
) {
  // 가이드라인 4개
  doc.setDrawColor(225);
  doc.setLineWidth(0.2);
  for (let i = 0; i < 4; i++) {
    const gy = y + (h / 3) * i;
    doc.line(x, gy, x + w, gy);
  }
  // x축 눈금 라벨
  doc.setFont('NotoSansKR', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(140);
  for (const t of xTicks) {
    doc.text(t.label, x + w * t.pos, y + h + 3, { align: 'center' });
  }
  doc.setTextColor(0);

  // 데이터 폴리라인
  const nums = values.map((v) => num(v));
  const present = nums.filter((v): v is number => v !== null);
  if (present.length >= 2) {
    const max = Math.max(...present, 1);
    const n = values.length;
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    let prev: { px: number; py: number } | null = null;
    for (let i = 0; i < n; i++) {
      const v = nums[i];
      if (v == null) {
        prev = null;
        continue;
      }
      const px = x + (w * i) / (n - 1);
      const py = y + h - (h * v) / max;
      if (prev) doc.line(prev.px, prev.py, px, py);
      prev = { px, py };
    }
  }
}

export async function exportMonthlyGenerationReport(
  filename: string,
  data: MonthlyGenerationReportData,
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const hasFont = await loadKoreanFont(doc);
  const font = hasFont ? 'NotoSansKR' : 'helvetica';

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = 20;

  // ── 제목 ──
  doc.setFont(font, 'bold');
  doc.setFontSize(20);
  doc.text('월간 발전 보고서', pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setDrawColor(40);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  y += 9;

  // ── 헤더(발전소 정보) ──
  doc.setFont(font, 'normal');
  doc.setFontSize(10.5);
  const line = (label: string, value: string, unit = '') => {
    doc.text(`◦ ${label} : ${value}${unit ? `  ${unit}` : ''}`, margin, y);
    y += 6.5;
  };
  line('발 전 소 명', data.plantName ?? '');
  line('설 치 용 량', blank(data.capacityKw), 'kW');
  line('주        소', data.address ?? '');
  line('기        간', data.period ?? 'YYYY.MM');
  y += 3;
  line('월 총 발 전 량', blank(data.monthTotalKwh), 'kWh');
  line('누 적 발 전 량', blank(data.cumulativeKwh), 'kWh');
  line('월 총 발전시간', blank(data.monthHours), '시간');
  line('월 일평균 발전시간', blank(data.dailyAvgHours), '시간');
  line('지역 평균 발전시간', blank(data.regionAvgHours), '시간');
  y += 4;

  // ── 일별 발전량 ──
  doc.setFont(font, 'bold');
  doc.setFontSize(12);
  doc.text('■ 일별 발전량 (kWh)', margin, y);
  y += 6;
  const daily = data.dailyKwh ?? [];
  drawLineChart(
    doc,
    margin,
    y,
    contentW,
    26,
    Array.from({ length: 31 }, (_, i) => daily[i]),
    [
      { pos: 0, label: '1' },
      { pos: 4 / 30, label: '5' },
      { pos: 9 / 30, label: '10' },
      { pos: 14 / 30, label: '15' },
      { pos: 19 / 30, label: '20' },
      { pos: 24 / 30, label: '25' },
      { pos: 1, label: '31' },
    ],
  );
  y += 26 + 7;

  // 일별 표 — 3개 날짜/발전량 그룹 (1~11 / 12~22 / 23~31 + 합계)
  const dailyTotal = daily.reduce((s: number, v) => s + (num(v) ?? 0), 0);
  const hasDaily = daily.some((v) => num(v) !== null);
  const dailyBody: string[][] = [];
  for (let i = 0; i < 11; i++) {
    const c1d = pad2(i + 1);
    const c1v = dash(daily[i]);
    const c2d = pad2(i + 12);
    const c2v = dash(daily[i + 11]);
    let c3d = '';
    let c3v = '';
    if (i <= 8) {
      c3d = pad2(i + 23);
      c3v = dash(daily[i + 22]);
    } else if (i === 9) {
      c3d = '합계';
      c3v = hasDaily ? dailyTotal.toLocaleString('ko-KR') : '—';
    }
    dailyBody.push([c1d, c1v, c2d, c2v, c3d, c3v]);
  }
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    margin: { left: margin, right: margin },
    head: [['날짜', '발전량', '날짜', '발전량', '날짜', '발전량']],
    body: dailyBody,
    styles: {
      font,
      fontSize: 8,
      halign: 'center',
      cellPadding: 1.4,
      lineColor: [210, 210, 210],
      lineWidth: 0.1,
      textColor: 60,
    },
    headStyles: { font, fontStyle: 'bold', fillColor: [240, 240, 240], textColor: 40 },
    didParseCell: (hook: any) => {
      if (
        hook.section === 'body' &&
        hook.row.index === 9 &&
        (hook.column.index === 4 || hook.column.index === 5)
      ) {
        hook.cell.styles.fontStyle = 'bold';
        hook.cell.styles.fillColor = [245, 245, 245];
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // ── 시간대별 발전량 — 참조 양식: 제목은 1페이지 하단, 차트·표는 2페이지 ──
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont(font, 'bold');
  doc.setFontSize(12);
  doc.text('■ 시간대별 발전량 (kWh)', margin, y);
  if (y > pageH - 90) {
    doc.addPage();
    y = 20;
  } else {
    y += 8;
  }
  const hourly = data.hourlyKwh ?? [];
  drawLineChart(
    doc,
    margin,
    y,
    contentW,
    24,
    Array.from({ length: 24 }, (_, i) => hourly[i]),
    Array.from({ length: 24 }, (_, i) => ({ pos: i / 23, label: pad2(i) })),
  );
  y += 24 + 7;

  const hourHead1 = ['시간', ...Array.from({ length: 12 }, (_, i) => pad2(i))];
  const hourRow1 = ['발전량', ...Array.from({ length: 12 }, (_, i) => dash(hourly[i]))];
  const hourHead2 = ['시간', ...Array.from({ length: 12 }, (_, i) => pad2(i + 12))];
  const hourRow2 = ['발전량', ...Array.from({ length: 12 }, (_, i) => dash(hourly[i + 12]))];
  const hourStyles = {
    theme: 'grid' as const,
    styles: {
      font,
      fontSize: 7,
      halign: 'center' as const,
      cellPadding: 1.2,
      lineColor: [210, 210, 210] as [number, number, number],
      lineWidth: 0.1,
      textColor: 60 as any,
    },
    headStyles: {
      font,
      fontStyle: 'bold' as const,
      fillColor: [240, 240, 240] as [number, number, number],
      textColor: 40,
    },
    columnStyles: {
      0: { fontStyle: 'bold' as const, fillColor: [248, 248, 248] as [number, number, number] },
    },
    margin: { left: margin, right: margin },
  };
  autoTable(doc, { startY: y, head: [hourHead1], body: [hourRow1], ...hourStyles });
  y = (doc as any).lastAutoTable.finalY + 3;
  autoTable(doc, { startY: y, head: [hourHead2], body: [hourRow2], ...hourStyles });
  y = (doc as any).lastAutoTable.finalY + 10;

  // ── 수익 분석 ──
  if (y > pageH - 50) {
    doc.addPage();
    y = 20;
  }
  doc.setFont(font, 'bold');
  doc.setFontSize(12);
  doc.text('■ 수익 분석 (예상치)', margin, y);
  y += 6;
  const rev = data.revenue ?? {};
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    margin: { left: margin, right: margin },
    head: [['월 총발전량', '적용 단가', '월 예상 수익', '누적 예상 수익']],
    body: [
      [
        `${dash(rev.totalKwh)} kWh`,
        `${dash(rev.unitPrice)} 원/kWh`,
        `${dash(rev.monthRevenue)} 원`,
        `${dash(rev.cumulativeRevenue)} 원`,
      ],
    ],
    styles: {
      font,
      fontSize: 8.5,
      halign: 'right',
      cellPadding: 2.2,
      lineColor: [210, 210, 210],
      lineWidth: 0.1,
      textColor: 60,
    },
    headStyles: {
      font,
      fontStyle: 'bold',
      halign: 'center',
      fillColor: [240, 240, 240],
      textColor: 40,
    },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  doc.setFont(font, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(130);
  const disclaimer =
    '본 수익은 월 발전량 × 적용 단가(원/kWh)로 산정한 예상 금액이며, 적용 단가(SMP·REC 등)는 시장 상황에 따라 변동되어 최종 정산액과 다소 오차가 있을 수 있습니다. 정식 세금계산서는 국세청 홈택스 전자세금계산서로 별도 발행됩니다.';
  doc.text(doc.splitTextToSize(disclaimer, contentW), margin, y);
  y += 10;
  doc.text('RMS 플랫폼 · 분산에너지 사업부', pageW - margin, y, { align: 'right' });
  doc.setTextColor(0);

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

// ── HTML 미리보기 ──────────────────────────────────────────────────────────

function svgLineChart(
  values: (number | null | undefined)[],
  xLabels: string[],
  width = 680,
  height = 110,
): string {
  const nums = values.map((v) => num(v));
  const present = nums.filter((v): v is number => v !== null);
  const max = present.length > 0 ? Math.max(...present, 1) : 1;
  const padL = 8;
  const padR = 8;
  const padT = 6;
  const padB = 18;
  const cw = width - padL - padR;
  const ch = height - padT - padB;
  const n = values.length;

  const guides = [0, 1, 2, 3].map((i) => {
    const gy = padT + (ch / 3) * i;
    return `<line x1="${padL}" y1="${gy}" x2="${padL + cw}" y2="${gy}" stroke="#e5e7eb" stroke-width="0.5"/>`;
  });

  let polyline = '';
  if (present.length >= 2) {
    const pts: string[] = [];
    for (let i = 0; i < n; i++) {
      const v = nums[i];
      if (v == null) continue;
      const px = padL + (cw * i) / (n - 1);
      const py = padT + ch - (ch * v) / max;
      pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    }
    polyline = `<polyline points="${pts.join(' ')}" fill="none" stroke="#3B82F6" stroke-width="1.2"/>`;
  }

  const labels = xLabels.map((label, i) => {
    const px = padL + (cw * i) / (xLabels.length - 1);
    return `<text x="${px.toFixed(1)}" y="${height - 3}" text-anchor="middle" font-size="7" fill="#9ca3af">${label}</text>`;
  });

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    ${guides.join('')}${polyline}${labels.join('')}
  </svg>`;
}

export function generateMonthlyReportHtml(data: MonthlyGenerationReportData): string {
  const d = (v?: number | null) => dash(v);
  const b = (v?: number | null, unit = '') => {
    const n = num(v);
    return n === null ? '' : `${n.toLocaleString('ko-KR')}${unit ? ' ' + unit : ''}`;
  };

  const daily = data.dailyKwh ?? [];
  const hourly = data.hourlyKwh ?? [];

  const dailyTotal = daily.reduce((s: number, v) => s + (num(v) ?? 0), 0);
  const hasDaily = daily.some((v) => num(v) !== null);

  // 일별 표 rows (1~11 / 12~22 / 23~31)
  const dailyRows = Array.from({ length: 11 }, (_, i) => {
    const c3d = i <= 8 ? pad2(i + 23) : i === 9 ? '합계' : '';
    const c3v =
      i <= 8
        ? d(daily[i + 22])
        : i === 9
          ? hasDaily
            ? dailyTotal.toLocaleString('ko-KR')
            : '—'
          : '';
    return `<tr>
      <td>${pad2(i + 1)}</td><td>${d(daily[i])}</td>
      <td>${pad2(i + 12)}</td><td>${d(daily[i + 11])}</td>
      <td class="${i === 9 ? 'bold' : ''}">${c3d}</td><td class="${i === 9 ? 'bold' : ''}">${c3v}</td>
    </tr>`;
  }).join('');

  // 시간대별 표
  const hour1Head = ['시간', ...Array.from({ length: 12 }, (_, i) => pad2(i))];
  const hour1Row = ['발전량', ...Array.from({ length: 12 }, (_, i) => d(hourly[i]))];
  const hour2Head = ['시간', ...Array.from({ length: 12 }, (_, i) => pad2(i + 12))];
  const hour2Row = ['발전량', ...Array.from({ length: 12 }, (_, i) => d(hourly[i + 12]))];

  const rev = data.revenue ?? {};
  const disclaimer =
    '본 수익은 월 발전량 × 적용 단가(원/kWh)로 산정한 예상 금액이며, 적용 단가(SMP·REC 등)는 시장 상황에 따라 변동되어 최종 정산액과 다소 오차가 있을 수 있습니다. 정식 세금계산서는 국세청 홈택스 전자세금계산서로 별도 발행됩니다.';

  const dailyChart = svgLineChart(
    Array.from({ length: 31 }, (_, i) => daily[i]),
    ['1', '5', '10', '15', '20', '25', '31'],
  );
  const hourlyChart = svgLineChart(
    Array.from({ length: 24 }, (_, i) => hourly[i]),
    Array.from({ length: 24 }, (_, i) => pad2(i)),
    680,
    90,
  );

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>월간 발전 보고서 — ${data.period ?? ''}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; background: #f5f5f5; color: #333; }
  .page { max-width: 794px; margin: 32px auto; background: #fff; padding: 32px 36px; box-shadow: 0 2px 16px rgba(0,0,0,.12); }
  h1 { font-size: 22px; font-weight: 700; text-align: center; margin-bottom: 6px; }
  .divider { border: none; border-top: 1.5px solid #333; margin-bottom: 20px; }
  .info-block { font-size: 10.5px; line-height: 2; margin-bottom: 16px; }
  .section-title { font-size: 13px; font-weight: 700; margin: 20px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5px; margin-bottom: 6px; }
  th { background: #f0f0f0; color: #333; font-weight: 700; padding: 4px 6px; border: 0.5px solid #d2d2d2; text-align: center; }
  td { padding: 4px 6px; border: 0.5px solid #d2d2d2; text-align: center; color: #3c3c3c; }
  td.bold { font-weight: 700; background: #f5f5f5; }
  td.label { font-weight: 700; background: #f8f8f8; }
  .rev-table td { text-align: right; font-size: 9px; padding: 5px 8px; }
  .rev-table th { font-size: 9px; padding: 5px 8px; }
  .disclaimer { font-size: 7.5px; color: #888; line-height: 1.6; margin-top: 8px; }
  .footer { text-align: right; font-size: 8px; color: #888; margin-top: 6px; }
  svg { display: block; width: 100%; }
  @media print {
    body { background: #fff; }
    .page { box-shadow: none; margin: 0; padding: 20px 24px; }
    .print-btn { display: none; }
  }
</style>
</head>
<body>
<div class="page">
  <div style="text-align:right;margin-bottom:8px">
    <button class="print-btn" onclick="window.print()" style="font-size:12px;padding:4px 12px;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:#f9f9f9">인쇄 / PDF 저장</button>
  </div>

  <h1>월간 발전 보고서</h1>
  <hr class="divider"/>

  <div class="info-block">
    <div>◦ 발 전 소 명 : ${data.plantName ?? ''}</div>
    <div>◦ 설 치 용 량 : ${b(data.capacityKw, 'kW')}</div>
    <div>◦ 주&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;소 : ${data.address ?? ''}</div>
    <div>◦ 기&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;간 : ${data.period ?? 'YYYY.MM'}</div>
    <div style="margin-top:8px">◦ 월 총 발 전 량 : ${b(data.monthTotalKwh, 'kWh')}</div>
    <div>◦ 누 적 발 전 량 : ${b(data.cumulativeKwh, 'kWh')}</div>
    <div>◦ 월 총 발전시간 : ${b(data.monthHours, '시간')}</div>
    <div>◦ 월 일평균 발전시간 : ${b(data.dailyAvgHours, '시간')}</div>
    <div>◦ 지역 평균 발전시간 : ${b(data.regionAvgHours, '시간')}</div>
  </div>

  <div class="section-title">■ 일별 발전량 (kWh)</div>
  ${dailyChart}
  <table style="margin-top:8px">
    <thead><tr><th>날짜</th><th>발전량</th><th>날짜</th><th>발전량</th><th>날짜</th><th>발전량</th></tr></thead>
    <tbody>${dailyRows}</tbody>
  </table>

  <div class="section-title">■ 시간대별 발전량 (kWh)</div>
  ${hourlyChart}
  <table style="margin-top:8px">
    <thead><tr>${hour1Head.map((h, i) => `<th${i === 0 ? ' style="background:#f8f8f8"' : ''}>${h}</th>`).join('')}</tr></thead>
    <tbody><tr>${hour1Row.map((v, i) => `<td${i === 0 ? ' class="label"' : ''}>${v}</td>`).join('')}</tr></tbody>
  </table>
  <table style="margin-top:4px">
    <thead><tr>${hour2Head.map((h, i) => `<th${i === 0 ? ' style="background:#f8f8f8"' : ''}>${h}</th>`).join('')}</tr></thead>
    <tbody><tr>${hour2Row.map((v, i) => `<td${i === 0 ? ' class="label"' : ''}>${v}</td>`).join('')}</tr></tbody>
  </table>

  <div class="section-title">■ 수익 분석 (예상치)</div>
  <table class="rev-table">
    <thead><tr><th>월 총발전량</th><th>적용 단가</th><th>월 예상 수익</th><th>누적 예상 수익</th></tr></thead>
    <tbody>
      <tr>
        <td>${d(rev.totalKwh)} kWh</td>
        <td>${d(rev.unitPrice)} 원/kWh</td>
        <td>${d(rev.monthRevenue)} 원</td>
        <td>${d(rev.cumulativeRevenue)} 원</td>
      </tr>
    </tbody>
  </table>

  <p class="disclaimer">${disclaimer}</p>
  <p class="footer">RMS 플랫폼 · 분산에너지 사업부</p>
</div>
</body>
</html>`;
}
