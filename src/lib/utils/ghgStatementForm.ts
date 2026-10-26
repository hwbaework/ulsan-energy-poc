// 온실가스 명세서 — 「온실가스 배출권거래제의 배출량 보고 및 인증에 관한 지침」 [별지 제11호 서식]
// 온실가스 배출량 및 에너지 사용량 명세서(제28조 관련). 칸 번호 · 이름 · 배치 · 쪽 방향은 법제처 원문(환경부고시 제2025-64호) 그대로.
// 표지(1쪽, 세로) · 1. 할당대상업체 총괄 정보(1-1 · 1-2, 2쪽, 세로) · 8. 사업장 배출시설별 온실가스 감축실적(52쪽, 가로)
// · 9. 기타 온실가스 사용 실적(54쪽, 가로). 2 ~ 7장(배출량 · 에너지 사용량)은 확인 후.
// 플랫폼에 없는 값(담당자 · 자본금 · 생산량 · 착공일 · 투자비 · 기타 온실가스 사용량 등)은 지어내지 않고 빈칸 — 기업 담당자가 채운다.

/** 전기 소비기준 발열량 — 에너지법 시행규칙 에너지열량 환산기준 9.6 MJ/kWh. 에너지 절약효과(TJ) = kWh × 9.6 ÷ 10⁶ */
const MJ_PER_KWH = 9.6;
/** [참고7] 저감수단 코드 — 대체에너지 › 태양에너지 › 태양전지를 이용한 전력생산 */
const REDUCE_CODE = '7114';
const REDUCE_NAME = '태양전지를 이용한 전력생산';

export interface GhgFormCompany {
  /** 법인명 · 사업장명 */
  name: string;
  bizNo: string;
  representative: string;
  /** 지정업종 · 사업장 업종 · 해당 사업장의 부문 또는 업종 */
  industry: string;
  address: string;
  phone: string;
  employees?: number;
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
const td = (v: unknown, cls = '', span = '') => `<td${cls ? ` class="${cls}"` : ''}${span}>${esc(v)}</td>`;
/** 칸 머리 — (번호) + 이름 */
const hd = (no: string, label: string, span = '') => `<th${span}><span class="no">(${no})</span>${label}</th>`;
/** 장 제목 상자 — '8 | 사업장 배출시설별 …' */
const sec = (no: string, title: string) => `<div class="sec"><b>${no}</b><span>${title}</span></div>`;

export function generateGhgStatementHtml(d: GhgFormData): string {
  const c = d.company;

  const cover = `<div class="a4 port">
  <p class="tag">[별지 제11호 서식]</p>
  <p class="sub">온실가스 배출량 등 명세서 양식(제28조 관련)</p>
  <h1 class="cover-title">온실가스 배출량 및 에너지 사용량 명세서</h1>
  <p class="cover-body">「저탄소녹색성장기본법」 제44조제1항 및 같은 법 시행령 제34조와 「온실가스 배출권의 할당 및 거래에 관한 법률」 제24조제1항에 따라 당사(사업장)의 온실가스 배출량 및 에너지 사용량 등을 아래와 같이 보고합니다.</p>
  <p class="cover-date">년&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;월&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;일</p>
  <p class="cover-sign">신청인&nbsp;&nbsp;${esc(c.name)}&nbsp;&nbsp;${esc(c.representative)}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(서명 또는 인)</p>
  <p class="cover-to">환경부장관 귀하</p>
</div>`;

  const general = `<div class="a4 port">
  ${sec('1', '할당대상업체 총괄 정보')}
  <h3>1-1. 업체(법인)에 대한 일반정보</h3>
  <table class="form">
    <colgroup><col style="width:15%"><col style="width:20%"><col style="width:13%"><col style="width:19%"><col style="width:13%"><col style="width:20%"></colgroup>
    <tr>${hd('1', '법인명')}${td(c.name, 'in')}${hd('2', '대표자')}${td(c.representative, 'in')}${hd('3', '대상년도')}${td(d.year, 'in')}</tr>
    <tr>${hd('4', '법인등록번호')}${td(c.bizNo, 'in', ' colspan="3"')}${hd('5', '지정업종<br>(대표업종)')}${td(c.industry, 'in')}</tr>
    <tr>${hd('6', '법인 소재지')}${td(c.address, 'in l', ' colspan="3"')}${hd('7', '법인<br>전화번호')}${td(c.phone, 'in')}</tr>
    <tr>${hd('8', '법인담당부서')}${td('', 'in')}${hd('9', '법인<br>담당자')}${td('', 'in')}${hd('10', '직급')}${td('', 'in')}</tr>
    <tr>${hd('11', '담당자<br>전화번호')}${td('', 'in')}${hd('12', '담당자<br>휴대폰')}${td('', 'in')}${hd('13', '담당자<br>이메일')}${td('', 'in')}</tr>
    <tr>${hd('14', '주요 생산제품<br>또는 처리물질')}${td('', 'in')}${hd('15', '연간 생산량<br>또는 처리량')}${td('', 'in')}${hd('16', '상시<br>종업원수')}${td(c.employees == null ? '' : n(c.employees), 'in')}</tr>
    <tr>${hd('17', '당해연도<br>매출액<br>(백만원(한화))')}${td('', 'in')}${hd('18', '당해연도<br>에너지비용<br>(백만원)')}${td('', 'in')}${hd('19', '자본금<br>(백만원(한화))')}${td('', 'in')}</tr>
    <tr>${hd('20', '중소기업여부')}${td('', 'in')}${hd('21', '할당대상업체<br>지정기준')}${td('', 'in', ' colspan="3"')}</tr>
  </table>
  <h3>1-2. 사업장 목록</h3>
  <table class="form">
    <colgroup><col style="width:10%"><col style="width:14%"><col style="width:15%"><col style="width:11%"><col style="width:11%"><col style="width:19%"><col style="width:10%"><col style="width:10%"></colgroup>
    <tr>${hd('1', '사업장<br>일련번호')}${hd('2', '사업장명')}${hd('3', '사업자등록번호')}${hd('4', '사업장<br>대표자')}${hd('5', '사업장<br>업종')}${hd('6', '사업장<br>소재지')}${hd('7', '소량배출사업장<br>여부(Y/N)')}${hd('8', '할당대상여부<br>(Y/N)')}</tr>
    <tr>${td('사업장 01')}${td(c.name, 'in')}${td(c.bizNo, 'in')}${td(c.representative, 'in')}${td(c.industry, 'in')}${td(c.address, 'in l')}${td('', 'in')}${td('', 'in')}</tr>
  </table>
</div>`;

  const rows8 = d.facilities
    .map(
      (f) =>
        `<tr>${td(f.no, 'in')}${td(f.name, 'in')}${td(REDUCE_CODE)}${td(REDUCE_NAME)}${td(`태양광 발전설비 ${n(f.kw, 2)} kW`)}${td(basisOf(f, d.co2Factor), 'l')}${td('')}${td('')}${td(f.startDate)}${td(`${n(f.loadRate, 1)}%`)}${td(n(f.tco2, 3), 'r')}${td(n(tjOf(f.kwh), 3), 'r')}${td('')}${td('')}${td('')}</tr>`,
    )
    .join('');
  const reduce = `<div class="a4 land">
  ${sec('8', '사업장 배출시설별 온실가스 감축실적')}
  <table class="site">
    <caption>8. 사업장 배출시설별 온실가스 감축실적</caption>
    <colgroup><col style="width:6%"><col style="width:8%"><col style="width:13%"><col style="width:26%"><col style="width:7%"><col style="width:20%"><col style="width:20%"></colgroup>
    <tr><th rowspan="2">(1)<br>사업장<br>정보</th><th>일련번호</th><th>사업장명</th><th>사업자등록번호</th><th rowspan="2">(2)<br>업종<br>정보</th><th>표준산업<br>분류코드</th><th>해당 사업장의 부문 또는 업종</th></tr>
    <tr>${td('01', 'in')}${td(c.name, 'in')}${td(c.bizNo, 'in')}${td('', 'in')}${td(c.industry, 'in')}</tr>
  </table>
  <table class="form">
    <colgroup><col style="width:6%"><col style="width:8%"><col style="width:6%"><col style="width:7%"><col style="width:9%"><col style="width:14%"><col style="width:5.5%"><col style="width:5.5%"><col style="width:6.5%"><col style="width:5%"><col style="width:6.5%"><col style="width:6%"><col style="width:5%"><col style="width:5%"><col style="width:5%"></colgroup>
    <tr><th colspan="2">(3)</th><th>(4)</th><th>(5)</th><th>(6)</th><th>(7)</th><th>(8)</th><th>(9)</th><th>(10)</th><th>(11)</th><th colspan="2">(12)</th><th colspan="2">(13)</th><th>(14)</th></tr>
    <tr><th rowspan="3">배출시설<br>일련번호</th><th rowspan="3">배출시설명</th><th colspan="4">감축실적</th><th colspan="4">사업현황</th><th colspan="2">감축효과</th><th colspan="2">투자실적</th><th rowspan="3">기술공정도<br>첨부</th></tr>
    <tr><th rowspan="2">코드<br>[참고7]</th><th rowspan="2">세부<br>감축조치</th><th rowspan="2">감축대상</th><th rowspan="2">온실가스 감축량<br>산출근거</th><th colspan="3">공사기간 등 (연월일)</th><th rowspan="2">부하율</th><th rowspan="2">온실가스<br>감축효과<br>(tCO₂-eq)</th><th rowspan="2">에너지<br>절약효과<br>(TJ)</th><th rowspan="2">투자비<br>(백만원)</th><th rowspan="2">투자비<br>회수기간<br>(년)</th></tr>
    <tr><th>착공일</th><th>준공일</th><th>가동일</th></tr>
    ${rows8}
  </table>
</div>`;

  // 9 — 원문 행(CO2 · N2O · SF6 · PFCs …) 그대로, 사용량은 플랫폼에 없어 빈칸
  const gases = ['CO2', 'N2O', 'SF6', 'PFCs', '...'];
  const other = `<div class="a4 land">
  ${sec('9', '기타 온실가스 사용 실적')}
  <table class="form">
    <caption>9. 기타 온실가스 사용 실적</caption>
    <colgroup><col style="width:6%"><col style="width:11%"><col style="width:13%"><col style="width:14%"><col style="width:14%"><col style="width:11%"><col style="width:8%"><col style="width:10%"><col style="width:13%"></colgroup>
    <tr><th rowspan="2">번호</th>${hd('1', '배출시설<br>일련번호')}${hd('2', '활동자료 종류')}${hd('3', '사용 목적')}${hd('4', '사용 시설')}${hd('5', '활동자료')}${hd('6', '단위')}${hd('7', '지구온난화지수<br>(GWP)')}${hd('8', '온실가스 배출량<br>(tCO₂-eq)')}</tr>
    <tr></tr>
    ${gases.map((g, i) => `<tr>${td(g === '...' ? '...' : i + 1)}${td('', 'in')}${td(g === '...' ? '...' : g, 'in')}${td('', 'in')}${td('', 'in')}${td('', 'in')}${td('', 'in')}${td('', 'in')}${td('', 'in')}</tr>`).join('')}
  </table>
  <p class="note">※ 기타 온실가스 사용량을 기재한다. 이 항목에서 보고되는 온실가스 사용량은 사업장 총 배출량에 포함하지 않는다.</p>
</div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>온실가스 배출량 및 에너지 사용량 명세서</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #e5e7eb; font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; color: #111; }
  .a4 { margin: 12px auto; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.15); }
  .port { width: 210mm; min-height: 297mm; padding: 18mm 16mm; page: port; }
  .land { width: 297mm; min-height: 210mm; padding: 20mm 16mm 14mm; page: land; }
  .tag { margin: 0; font-size: 12px; }
  .sub { margin: 4px 0 0; font-size: 12px; color: #444; }
  .cover-title { margin: 60mm 0 18mm; text-align: center; font-size: 24px; letter-spacing: 1px; }
  .cover-body { font-size: 14px; line-height: 2; text-indent: 1em; }
  .cover-date { margin-top: 24mm; text-align: center; font-size: 14px; }
  .cover-sign { margin-top: 10mm; text-align: right; font-size: 14px; }
  .cover-to { margin-top: 16mm; font-size: 16px; font-weight: 700; }
  .sec { display: flex; width: 72%; border: 1px solid #111; margin: 0 0 10mm; }
  .sec b { width: 44px; padding: 6px 0; border-right: 1px solid #111; text-align: center; font-size: 20px; }
  .sec span { padding: 6px 12px; font-size: 20px; font-weight: 800; letter-spacing: 1px; }
  h3 { margin: 16px 0 8px; font-size: 13.5px; }
  table { border-collapse: collapse; table-layout: fixed; font-size: 11px; }
  caption { caption-side: top; text-align: left; padding: 6px 8px; border: 1.5px solid #111; border-bottom: 0; font-size: 12.5px; }
  th, td { border: 1px solid #333; padding: 4px 3px; text-align: center; vertical-align: middle; word-break: keep-all; overflow-wrap: anywhere; }
  th { background: #ececec; font-weight: 500; }
  td { height: 32px; }
  td.in { background: #fbf9c8; }
  td.l { text-align: left; }
  td.r { text-align: right; font-variant-numeric: tabular-nums; }
  .no { display: block; font-weight: 400; color: #555; }
  table.form { width: 100%; border: 1.5px solid #111; margin-bottom: 8mm; }
  table.site { width: 65%; margin-bottom: 7mm; border: 1.5px solid #111; }
  .land table.form { font-size: 10.5px; }
  .note { font-size: 11px; color: #333; }
  @page port { size: A4 portrait; margin: 0; }
  @page land { size: A4 landscape; margin: 0; }
  @media print { body { background: #fff; } .a4 { margin: 0; box-shadow: none; page-break-after: always; } }
</style></head><body>${cover}${general}${reduce}${other}</body></html>`;
}

/** A4 를 창 너비에 맞춰 줄인다 — 문서 관리 미리보기와 같은 방식. 세로 · 가로 쪽이 섞여 가장 넓은 쪽(가로)에 맞춘다 */
export function fitA4(html: string) {
  return html.replace(
    '</head>',
    `<style>.a4{margin:12px auto!important}</style>
<script>function fit(){var w=0;document.querySelectorAll('.a4').forEach(function(a){w=Math.max(w,a.offsetWidth)});if(!w)return;document.body.style.zoom=1;var z=Math.min(1,(window.innerWidth-24)/w);document.body.style.zoom=z}addEventListener('load',fit);addEventListener('resize',fit)</script></head>`,
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
