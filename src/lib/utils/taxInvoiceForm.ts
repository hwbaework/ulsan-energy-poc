// @ts-nocheck
/**
 * 별지 제11호 서식 — 세 금 계 산 서 정밀 렌더러
 *
 * 좌표/병합/테두리/라벨은 표준 양식 엑셀(`종이 세금계산서 양식.xlsx`)에서 그대로 추출한
 * `taxInvoiceFormSpec.json`을 소비한다. 열 폭은 px(96dpi), 행 높이는 pt(72dpi)를 inch 공통
 * 단위로 변환해 실제 종횡비를 보존한다.
 *
 * 한 장(인보이스 1건)에 2부를 세로로 쌓는다:
 *   상단 = 세 금 계 산 서 (공급받는자) 보관용  — 수용가 보관본
 *   하단 = 세 금 계 산 서 (공급자) 보관용      — 공급자 보관본
 */
import spec from './taxInvoiceFormSpec.json';

interface FormSpec {
  cols: number[]; // 32 (B..AG) widths in px units
  rows: number[]; // 22 (rows 2..23) heights in pt
  V: number[][]; // [boundary 0..32][localRow 0..21] vertical edge weight
  H: number[][]; // [boundary 0..22][localCol 0..31] horizontal edge weight
  texts: { c: [number, number]; r: [number, number]; t: string }[];
}

const FORM = spec as FormSpec;

// 진짜 스케일: 1px=1/96in, 1pt=1/72in → mm. k는 양식 폭을 DRAW_W_MM 로 맞추는 배율.
const DRAW_W_MM = 180;
const colsSumPx = FORM.cols.reduce((a, b) => a + b, 0);
const K = DRAW_W_MM / ((colsSumPx / 96) * 25.4);
const PX2MM = (1 / 96) * 25.4 * K;
const PT2MM = (1 / 72) * 25.4 * K;

// 누적 x 좌표 (열 경계 0..32)
const XS: number[] = [0];
for (const w of FORM.cols) XS.push(XS[XS.length - 1] + w * PX2MM);
// 누적 y 좌표 (행 경계 0..22) — 한 부 기준
const YS: number[] = [0];
for (const h of FORM.rows) YS.push(YS[YS.length - 1] + h * PT2MM);

export const FORM_WIDTH_MM: number = XS[XS.length - 1];
export const COPY_HEIGHT_MM: number = YS[YS.length - 1];

const WEIGHT_MM: Record<number, number> = { 1: 0.18, 2: 0.42, 3: 0.7 };

export interface FormParty {
  name: string;
  bizNo: string;
  representative: string;
  address: string;
  bizType: string;
  bizCategory: string;
}
export interface FormItem {
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
export interface FormData {
  bookNo?: string; // 책번호 (권)
  serialNo?: string; // 일련번호
  supplier: FormParty;
  receiver: FormParty;
  writeYear: string;
  writeMonth: string;
  writeDay: string;
  items: FormItem[];
  supplyTotal: number;
  vatTotal: number;
  grandTotal: number;
  cash?: number;
  check?: number;
  note?: number; // 어음
  credit?: number; // 외상미수금
  receiptOrClaim: 'receipt' | 'claim';
}

// 엑셀 열문자(B..AG) → 로컬 c 인덱스 (B=0)
function col(letter: string): number {
  let n = 0;
  for (const ch of letter) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 2; // B(2) → 0
}
// 엑셀 행번호(2..23) → 로컬 r 인덱스 (row2=0)
function row(n: number): number {
  return n - 2;
}

type Box = { x: number; y: number; w: number; h: number };
// 셀 범위 → bbox (copy origin 기준)
function cellBox(c0: number, c1: number, r0: number, r1: number, ox: number, oy: number): Box {
  const x = ox + XS[c0];
  const y = oy + YS[r0];
  return { x, y, w: XS[c1 + 1] - XS[c0], h: YS[r1 + 1] - YS[r0] };
}

function isHangul(t: string): boolean {
  return /[가-힣]/.test(t);
}

interface DrawTextOpts {
  align?: 'center' | 'left' | 'right';
  base?: number; // base font size (pt)
  stack?: boolean; // 세로 적층
  pad?: number; // 좌우 패딩 mm
  bold?: boolean;
}

export function renderTaxInvoiceCopy(
  doc: any,
  data: FormData,
  fontName: string,
  ox: number,
  oy: number,
  copyLabel: '공급받는자' | '공급자',
) {
  const setFont = (b: boolean) => doc.setFont(fontName, b ? 'bold' : 'normal');

  // ── 텍스트 헬퍼 (셀 폭에 맞춰 자동 축소) ──
  const drawText = (t: string, box: Box, opts: DrawTextOpts = {}) => {
    if (t == null || t === '') return;
    const { align = 'center', base = 7, stack = false, pad = 0.6, bold = false } = opts;
    setFont(bold);
    const lines = stack ? t.replace(/\s+/g, '').split('') : t.split('\n');
    const maxW = box.w - pad * 2;
    let size = base;
    if (!stack) {
      doc.setFontSize(size);
      let widest = Math.max(...lines.map((l) => doc.getTextWidth(l)));
      while (widest > maxW && size > 3.5) {
        size -= 0.25;
        doc.setFontSize(size);
        widest = Math.max(...lines.map((l) => doc.getTextWidth(l)));
      }
    } else {
      // 적층: 글자 높이 합이 box.h 에 맞도록
      const maxLineH = box.h / lines.length;
      size = Math.min(base, (maxLineH / 0.3527) * 0.78);
      doc.setFontSize(size);
    }
    const lineH = (size / 0.3527 / 72) * 25.4 * 1.02; // mm per line approx (size pt → mm * factor)
    const totalH = (stack ? lines.length : lines.length) * (size * 0.3527) * 1.15;
    const cy = box.y + box.h / 2;
    const startY = cy - totalH / 2 + size * 0.3527 * 1.15 * 0.5;
    let lx = box.x + box.w / 2;
    let textAlign = align;
    if (align === 'left') lx = box.x + pad;
    if (align === 'right') lx = box.x + box.w - pad;
    lines.forEach((ln, i) => {
      doc.text(ln, lx, startY + i * (size * 0.3527) * 1.15, {
        align: textAlign,
        baseline: 'middle',
      });
    });
    void lineH;
  };

  // ── 테두리 그리기 ──
  doc.setLineCap(0);
  doc.setLineJoin(0);
  doc.setDrawColor(0, 0, 0);
  // 수직 에지
  for (let b = 0; b <= 32; b++) {
    for (let r = 0; r < 22; r++) {
      const w = FORM.V[b][r];
      if (!w) continue;
      doc.setLineWidth(WEIGHT_MM[w] ?? 0.18);
      const x = ox + XS[b];
      doc.line(x, oy + YS[r], x, oy + YS[r + 1]);
    }
  }
  // 수평 에지
  for (let b = 0; b <= 22; b++) {
    for (let c = 0; c < 32; c++) {
      const w = FORM.H[b][c];
      if (!w) continue;
      doc.setLineWidth(WEIGHT_MM[w] ?? 0.18);
      const y = oy + YS[b];
      doc.line(ox + XS[c], y, ox + XS[c + 1], y);
    }
  }

  // ── 정적 라벨 ──
  const STACK_CELLS = new Set(['공 급 자', '공급받는자', '이 금액을 ']);
  for (const tx of FORM.texts) {
    let t = tx.t;
    const [c0, c1] = tx.c;
    const [r0, r1] = tx.r;
    // 제목의 거래상대 표기는 보관본에 따라 교체 (r=1 인 '공급받는자')
    if (r0 === 1 && t === '공급받는자') t = copyLabel;
    const box = cellBox(c0, c1, r0, r1, ox, oy);
    // 세로로 긴 라벨 적층
    const tall = box.h > box.w * 1.8;
    if (t === '[별지 제11호 서식]') {
      drawText(t, box, { align: 'left', base: 6, pad: 0 });
      continue;
    }
    if (t === '세 금 계 산 서') {
      drawText(t, box, { align: 'center', base: 15, bold: true });
      continue;
    }
    if (t.includes('인쇄용지') || t.includes('22226-28131')) {
      drawText(t, box, { align: t.includes('인쇄용지') ? 'right' : 'left', base: 5, pad: 0.4 });
      continue;
    }
    const stack =
      tall && (STACK_CELLS.has(tx.t) || (c0 === c1 && tx.t.replace(/\s/g, '').length > 1));
    drawText(t, box, { base: 6.5, stack, align: stack ? 'center' : 'center' });
  }

  // ── 데이터 채우기 ──
  const sup = data.supplier;
  const rec = data.receiver;

  // 등록번호 — 칸별 1자리 (양식에 '-'는 I·L / Y·AB 칸에 미리 인쇄됨 → 숫자 칸만 채움)
  const drawBizNo = (bizNo: string, letters: string[]) => {
    const digits = (bizNo || '').replace(/\D/g, '').split('');
    for (let i = 0; i < digits.length && i < letters.length; i++) {
      const c = col(letters[i]);
      drawText(digits[i], cellBox(c, c, row(5), row(6), ox, oy), { base: 8 });
    }
  };
  drawBizNo(sup.bizNo, ['F', 'G', 'H', 'J', 'K', 'M', 'N', 'O', 'P', 'Q']);
  drawBizNo(rec.bizNo, ['V', 'W', 'X', 'Z', 'AA', 'AC', 'AD', 'AE', 'AF', 'AG']);
  // 상호 / 성명
  drawText(sup.name, cellBox(col('F'), col('K'), row(7), row(8), ox, oy), {
    base: 7.5,
    bold: true,
  });
  drawText(sup.representative, cellBox(col('M'), col('P'), row(7), row(8), ox, oy), { base: 7 });
  drawText(rec.name, cellBox(col('V'), col('AA'), row(7), row(8), ox, oy), {
    base: 7.5,
    bold: true,
  });
  drawText(rec.representative, cellBox(col('AC'), col('AF'), row(7), row(8), ox, oy), { base: 7 });
  // 사업장 주소
  drawText(sup.address, cellBox(col('F'), col('Q'), row(9), row(10), ox, oy), {
    align: 'left',
    base: 6.5,
    pad: 1,
  });
  drawText(rec.address, cellBox(col('V'), col('AG'), row(9), row(10), ox, oy), {
    align: 'left',
    base: 6.5,
    pad: 1,
  });
  // 업태 / 종목
  drawText(sup.bizType, cellBox(col('F'), col('K'), row(11), row(12), ox, oy), { base: 7 });
  drawText(sup.bizCategory, cellBox(col('M'), col('Q'), row(11), row(12), ox, oy), { base: 7 });
  drawText(rec.bizType, cellBox(col('V'), col('AA'), row(11), row(12), ox, oy), { base: 7 });
  drawText(rec.bizCategory, cellBox(col('AC'), col('AG'), row(11), row(12), ox, oy), { base: 7 });

  // 책번호 / 일련번호
  if (data.bookNo)
    drawText(data.bookNo, cellBox(col('AE'), col('AF'), row(3), row(3), ox, oy), { base: 7 });
  if (data.serialNo)
    drawText(data.serialNo, cellBox(col('AB'), col('AG'), row(4), row(4), ox, oy), { base: 7 });

  // 작성 — 년/월/일 (row15 = local r13)
  const r15 = row(15);
  drawText(data.writeYear, cellBox(col('B'), col('C'), r15, r15, ox, oy), { base: 7 });
  drawText(data.writeMonth, cellBox(col('D'), col('D'), r15, r15, ox, oy), { base: 7 });
  drawText(data.writeDay, cellBox(col('E'), col('E'), r15, r15, ox, oy), { base: 7 });

  // 공급가액 자릿수 (H..R = 11칸), 세액 (S..AB = 10칸) — 한 칸당 한 자리, 우측 정렬
  const drawDigits = (value: number, firstCol: number, lastCol: number) => {
    const cells: number[] = [];
    for (let c = firstCol; c <= lastCol; c++) cells.push(c);
    const digits = Math.max(0, Math.round(value))
      .toLocaleString('en-US')
      .replace(/,/g, '')
      .split('');
    let blanks = cells.length - digits.length;
    if (blanks < 0) blanks = 0;
    for (let i = 0; i < digits.length && i < cells.length; i++) {
      const c = cells[blanks + i];
      if (c === undefined) break;
      drawText(digits[i], cellBox(c, c, r15, r15, ox, oy), { base: 8 });
    }
    return blanks;
  };
  const blanks = drawDigits(data.supplyTotal, col('H'), col('R'));
  drawDigits(data.vatTotal, col('S'), col('AB'));
  // 공란수
  drawText(String(blanks), cellBox(col('F'), col('G'), r15, r15, ox, oy), { base: 7 });

  // 품목 행 (rows 17..20 = local r15..r18)
  const COLS = {
    month: ['B', 'B'],
    day: ['C', 'C'],
    desc: ['D', 'I'],
    spec: ['J', 'L'],
    qty: ['M', 'O'],
    price: ['P', 'T'],
    supply: ['U', 'Z'],
    tax: ['AA', 'AE'],
    note: ['AF', 'AG'],
  } as const;
  for (let i = 0; i < 4; i++) {
    const it = data.items[i];
    if (!it) continue;
    const rr = row(17 + i);
    const cell = (key: keyof typeof COLS) =>
      cellBox(col(COLS[key][0]), col(COLS[key][1]), rr, rr, ox, oy);
    drawText(it.month, cell('month'), { base: 6.5 });
    drawText(it.day, cell('day'), { base: 6.5 });
    drawText(it.description, cell('desc'), { align: 'left', base: 6.2, pad: 0.8 });
    drawText(it.spec, cell('spec'), { base: 6.5 });
    drawText(it.quantity, cell('qty'), { base: 6.5, align: 'right', pad: 1 });
    drawText(it.unitPrice, cell('price'), { base: 6.2, align: 'right', pad: 1 });
    drawText(it.supplyAmount > 0 ? it.supplyAmount.toLocaleString('ko-KR') : '', cell('supply'), {
      base: 6.5,
      align: 'right',
      pad: 1,
    });
    drawText(it.tax > 0 ? it.tax.toLocaleString('ko-KR') : '', cell('tax'), {
      base: 6.5,
      align: 'right',
      pad: 1,
    });
    drawText(it.note, cell('note'), { base: 5.5, align: 'left', pad: 0.6 });
  }

  // 합계 (row22 = local r20)
  const r22 = row(22);
  drawText(
    `₩${data.grandTotal.toLocaleString('ko-KR')}`,
    cellBox(col('B'), col('F'), r22, r22, ox, oy),
    {
      base: 8,
      bold: true,
      align: 'right',
      pad: 1.2,
    },
  );
  const money = (n?: number) => (n && n > 0 ? n.toLocaleString('ko-KR') : '');
  drawText(money(data.cash), cellBox(col('G'), col('K'), r22, r22, ox, oy), {
    base: 7,
    align: 'right',
    pad: 1,
  });
  drawText(money(data.check), cellBox(col('L'), col('P'), r22, r22, ox, oy), {
    base: 7,
    align: 'right',
    pad: 1,
  });
  drawText(money(data.note), cellBox(col('Q'), col('U'), r22, r22, ox, oy), {
    base: 7,
    align: 'right',
    pad: 1,
  });
  drawText(money(data.credit), cellBox(col('V'), col('Z'), r22, r22, ox, oy), {
    base: 7,
    align: 'right',
    pad: 1,
  });

  // 영수/청구 선택 강조 (영수=상단, 청구=하단) — 선택된 항목에 동그라미
  const rcBox = cellBox(col('AE'), col('AF'), row(21), row(22), ox, oy);
  doc.setLineWidth(0.4);
  const markY =
    data.receiptOrClaim === 'receipt' ? rcBox.y + rcBox.h * 0.27 : rcBox.y + rcBox.h * 0.73;
  doc.ellipse(rcBox.x + rcBox.w / 2, markY, rcBox.w * 0.42, rcBox.h * 0.22, 'S');

  setFont(false);
  doc.setTextColor(0);
}
