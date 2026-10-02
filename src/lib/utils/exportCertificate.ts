import type { EduCertificate } from '@/types/education';

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

/** RE100 교육 수료증 PDF (A4 가로) */
export async function exportCertificatePdf(cert: EduCertificate) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  await loadKoreanFont(doc);
  doc.setFont('NotoSansKR', 'normal');

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const cx = pageW / 2;

  // 배경
  doc.setFillColor(252, 252, 250);
  doc.rect(0, 0, pageW, pageH, 'F');

  // 이중 테두리
  doc.setDrawColor(24, 68, 52);
  doc.setLineWidth(1.2);
  doc.rect(10, 10, pageW - 20, pageH - 20);
  doc.setLineWidth(0.3);
  doc.rect(13, 13, pageW - 26, pageH - 26);

  // 수료증 번호 (좌상단)
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(`제 ${cert.certificateNo} 호`, 22, 26);

  // 타이틀
  doc.setFontSize(34);
  doc.setFont('NotoSansKR', 'bold');
  doc.setTextColor(24, 68, 52);
  doc.text('수  료  증', cx, 48, { align: 'center', charSpace: 4 });

  doc.setFontSize(10);
  doc.setFont('NotoSansKR', 'normal');
  doc.setTextColor(130, 130, 130);
  doc.text('Certificate of Completion', cx, 56, { align: 'center' });

  // 구분선
  doc.setDrawColor(24, 68, 52);
  doc.setLineWidth(0.4);
  doc.line(cx - 30, 61, cx + 30, 61);

  // 수여자 정보
  let y = 76;
  doc.setFontSize(11);
  doc.setTextColor(90, 90, 90);
  if (cert.companyName) {
    doc.text(`소속 : ${cert.companyName}`, cx, y, { align: 'center' });
    y += 8;
  }
  doc.setFontSize(20);
  doc.setFont('NotoSansKR', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(cert.userName, cx, y + 4, { align: 'center' });
  y += 18;

  // 본문
  doc.setFontSize(11);
  doc.setFont('NotoSansKR', 'normal');
  doc.setTextColor(60, 60, 60);
  const bodyLines = [
    `위 사람은 RE100 교육 과정`,
    `「${cert.courseTitle}」`,
    `의 동향 레포트 학습과 쪽지시험 전 문항을 이수하였기에`,
    `이 증서를 수여합니다.`,
  ];
  for (const line of bodyLines) {
    doc.text(line, cx, y, { align: 'center' });
    y += 8;
  }

  // 발급일
  const [yy, mm, dd] = cert.issuedAt.split('-');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text(`${yy}년 ${Number(mm)}월 ${Number(dd)}일`, cx, pageH - 40, { align: 'center' });

  doc.save(`수료증-${cert.certificateNo}.pdf`);
}
