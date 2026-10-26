// 온실가스 명세서 — 「온실가스 배출권거래제의 배출량 보고 및 인증에 관한 지침」 [별지 제11호 서식]
// 온실가스 배출량 및 에너지 사용량 명세서(제28조 관련). 칸 번호 · 이름 · 배치는 법제처 원문(환경부고시 제2025-64호) 52쪽 그대로.
// 우리가 다루는 것은 태양광 감축량뿐이라 지금은 '8. 사업장 배출시설별 온실가스 감축실적' 한 장만 낸다(나머지 장은 확인 후).
// 플랫폼에 없는 값(표준산업분류코드 · 착공일 · 준공일 · 투자비 등)은 지어내지 않고 빈칸.

/** 전기 소비기준 발열량 — 에너지법 시행규칙 에너지열량 환산기준 9.6 MJ/kWh. 에너지 절약효과(TJ) = kWh × 9.6 ÷ 10⁶ */
const MJ_PER_KWH = 9.6;
/** [참고7] 저감수단 코드 — 대체에너지 › 태양에너지 › 태양전지를 이용한 전력생산 */
const REDUCE_CODE = '7114';
const REDUCE_NAME = '태양전지를 이용한 전력생산';

export interface GhgFormCompany {
  /** 사업장명 */
  name: string;
  bizNo: string;
  /** 해당 사업장의 부문 또는 업종 */
  industry: string;
}
export interface GhgFormFacility {
  /** 배출시설 일련번호 */
  no: string;
  /** 배출시설명 — 태양광 발전설비(자가소비 · PPA) */
  name: string;
  kw: number;
  startDate: string;
  kwh: number;
  tco2: number;
  /** 설계용량 대비 평균 사용량(%) — 발전량 ÷ (설비 용량 × 가동 시간) */
  loadRate: number;
}
export interface GhgFormData {
  /** 대상 기간 — 2026 또는 2026-09 */
  year: string;
  company: GhgFormCompany;
  facilities: GhgFormFacility[];
  co2Factor: number;
}

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
const n = (v: number, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const tjOf = (kwh: number) => (kwh * MJ_PER_KWH) / 1_000_000;
const basisOf = (f: GhgFormFacility, co2: number) =>
  `발전량 ${n(f.kwh / 1000, 3)} MWh × 전력 배출계수 ${co2} tCO2-eq/MWh`;
const td = (v: unknown, cls = '') => `<td${cls ? ` class="${cls}"` : ''}>${esc(v)}</td>`;

export function generateGhgStatementHtml(d: GhgFormData): string {
  const c = d.company;
  const rows = d.facilities
    .map(
      (f) =>
        `<tr>${td(f.no, 'in')}${td(f.name, 'in')}${td(REDUCE_CODE)}${td(REDUCE_NAME)}${td(`태양광 발전설비 ${n(f.kw, 2)} kW`)}${td(basisOf(f, d.co2Factor), 'l')}${td('')}${td('')}${td(f.startDate)}${td(`${n(f.loadRate, 1)}%`)}${td(n(f.tco2, 3), 'r')}${td(n(tjOf(f.kwh), 3), 'r')}${td('')}${td('')}${td('')}</tr>`,
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>온실가스 배출량 및 에너지 사용량 명세서</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #e5e7eb; font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; color: #111; }
  .a4 { width: 297mm; min-height: 210mm; margin: 12px auto; padding: 22mm 16mm 14mm; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.15); }
  .meta { margin: 0 0 10px; font-size: 11px; color: #555; }
  .sec { display: flex; width: 72%; border: 1px solid #111; margin: 0 0 14mm; }
  .sec b { width: 44px; padding: 6px 0; border-right: 1px solid #111; text-align: center; font-size: 20px; }
  .sec span { padding: 6px 12px; font-size: 20px; font-weight: 800; letter-spacing: 1px; }
  table { border-collapse: collapse; table-layout: fixed; font-size: 11px; }
  th, td { border: 1px solid #333; padding: 4px 3px; text-align: center; vertical-align: middle; word-break: keep-all; overflow-wrap: anywhere; }
  th { background: #ececec; font-weight: 500; }
  td { height: 36px; }
  td.in { background: #fbf9c8; }
  td.l { text-align: left; }
  td.r { text-align: right; font-variant-numeric: tabular-nums; }
  table.site { width: 65%; margin-bottom: 7mm; border: 1.5px solid #111; }
  table.site caption { caption-side: top; text-align: left; padding: 6px 8px; border: 1.5px solid #111; border-bottom: 0; font-size: 12.5px; }
  table.main { width: 100%; border: 1.5px solid #111; font-size: 10.5px; }
  tr.sum td { background: #fafafa; font-weight: 700; height: 28px; }
  @page { size: A4 landscape; margin: 0; }
  @media print { body { background: #fff; } .a4 { margin: 0; box-shadow: none; } }
</style></head><body>
<div class="a4">
  <p class="meta">[별지 제11호 서식] 온실가스 배출량 및 에너지 사용량 명세서 · 대상 ${esc(d.year)}</p>
  <div class="sec"><b>8</b><span>사업장 배출시설별 온실가스 감축실적</span></div>
  <table class="site">
    <caption>8. 사업장 배출시설별 온실가스 감축실적</caption>
    <colgroup><col style="width:6%"><col style="width:8%"><col style="width:13%"><col style="width:26%"><col style="width:7%"><col style="width:20%"><col style="width:20%"></colgroup>
    <tr><th rowspan="2">(1)<br>사업장<br>정보</th><th>일련번호</th><th>사업장명</th><th>사업자등록번호</th><th rowspan="2">(2)<br>업종<br>정보</th><th>표준산업<br>분류코드</th><th>해당 사업장의 부문 또는 업종</th></tr>
    <tr>${td('01', 'in')}${td(c.name, 'in')}${td(c.bizNo, 'in')}${td('', 'in')}${td(c.industry, 'in')}</tr>
  </table>
  <table class="main">
    <colgroup><col style="width:6%"><col style="width:8%"><col style="width:6%"><col style="width:7%"><col style="width:9%"><col style="width:14%"><col style="width:5.5%"><col style="width:5.5%"><col style="width:6.5%"><col style="width:5%"><col style="width:6.5%"><col style="width:6%"><col style="width:5%"><col style="width:5%"><col style="width:5%"></colgroup>
    <tr><th colspan="2">(3)</th><th>(4)</th><th>(5)</th><th>(6)</th><th>(7)</th><th>(8)</th><th>(9)</th><th>(10)</th><th>(11)</th><th colspan="2">(12)</th><th colspan="2">(13)</th><th>(14)</th></tr>
    <tr><th rowspan="3">배출시설<br>일련번호</th><th rowspan="3">배출시설명</th><th colspan="4">감축실적</th><th colspan="4">사업현황</th><th colspan="2">감축효과</th><th colspan="2">투자실적</th><th rowspan="3">기술공정도<br>첨부</th></tr>
    <tr><th rowspan="2">코드<br>[참고7]</th><th rowspan="2">세부<br>감축조치</th><th rowspan="2">감축대상</th><th rowspan="2">온실가스 감축량<br>산출근거</th><th colspan="3">공사기간 등 (연월일)</th><th rowspan="2">부하율</th><th rowspan="2">온실가스<br>감축효과<br>(tCO₂-eq)</th><th rowspan="2">에너지<br>절약효과<br>(TJ)</th><th rowspan="2">투자비<br>(백만원)</th><th rowspan="2">투자비<br>회수기간<br>(년)</th></tr>
    <tr><th>착공일</th><th>준공일</th><th>가동일</th></tr>
    ${rows}
  </table>
</div></body></html>`;
}

/** A4 를 창 너비에 맞춰 줄인다 — 문서 관리 미리보기와 같은 방식(잘리거나 가로로 밀리지 않게) */
export function fitA4(html: string) {
  return html.replace(
    '</head>',
    `<style>.a4{margin:12px auto!important}</style>
<script>function fit(){var a=document.querySelector('.a4');if(!a)return;document.body.style.zoom=1;var z=Math.min(1,(window.innerWidth-24)/a.offsetWidth);document.body.style.zoom=z}addEventListener('load',fit);addEventListener('resize',fit)</script></head>`,
  );
}

/** PDF — 양식 그대로 인쇄 창을 연다(PDF로 저장) */
export function printGhgStatement(html: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 600);
}
