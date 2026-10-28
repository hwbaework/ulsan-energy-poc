// 온실가스 감축 실적 명세서 — 한 달 × 계약 하나 = 한 장. 형태 고정(1. 기업 정보 · 2. 배출시설 정보 · 3. 감축 실적 · 4. 산정 방법).
// 정부 검증 제출용이 아닌 플랫폼 자체 문서. 플랫폼이 가진 값(발전량 · 전력 배출계수)만 쓴다 — 사업 배출량처럼 모르는 값은 넣지 않는다.
// 한일튜브처럼 계약이 둘이면 한일튜브(자가소비) · 한일튜브(PPA) 각각 따로(통합관제 · RE100 과 같다). 플랫폼에 없는 값은 지어내지 않는다.

export interface GhgFormCompany {
  name: string;
  bizNo: string;
  representative: string;
  industry: string;
  address: string;
}
export interface GhgFormFacility {
  /** 배출시설명 — 태양광 발전설비 */
  name: string;
  /** 계약 유형 — 자가소비 / PPA */
  kind: string;
  /** 발전원 — 태양광 / ORC / 연료전지 */
  source: string;
  kw: number;
  startDate: string;
  kwh: number;
  tco2: number;
}
export interface GhgFormData {
  /** 대상 달 YYYY-MM */
  month: string;
  company: GhgFormCompany;
  facility: GhgFormFacility;
  co2Factor: number;
  /** 전력 배출계수 출처 — 에너지 설정 */
  co2Source: string;
  /** 작성일 YYYY-MM-DD */
  writtenAt: string;
}

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
const n = (v: number, d = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
/** 대상 기간 글자 — 2026년 9월 (2026-09-01 ~ 2026-09-30) */
export function periodText(month: string) {
  const [y = 2026, m = 1] = month.split('-').map(Number);
  const last = String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0');
  return { name: `${y}년 ${m}월`, range: `${month}-01 ~ ${month}-${last}` };
}

export function generateGhgStatementHtml(d: GhgFormData): string {
  const c = d.company;
  const f = d.facility;
  const p = periodText(d.month);

  return `<!doctype html><html><head><meta charset="utf-8"><title>온실가스 감축 실적 명세서</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #e5e7eb; font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; color: #111; }
  .a4 { width: 210mm; min-height: 297mm; margin: 12px auto; padding: 18mm 16mm; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.15); }
  h1 { margin: 0 0 12mm; text-align: center; font-size: 22px; letter-spacing: 2px; }
  h2 { margin: 0 0 6px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11.5px; margin-bottom: 8mm; }
  th, td { border: 1px solid #555; padding: 7px 6px; text-align: center; vertical-align: middle; word-break: keep-all; overflow-wrap: anywhere; }
  th { background: #f1f3f5; font-weight: 600; }
  td.l { text-align: left; }
  td.r { text-align: right; font-variant-numeric: tabular-nums; }
  td.b { font-weight: 700; }
  .basis { font-size: 11px; line-height: 1.8; color: #333; }
  .sign { margin-top: 14mm; text-align: right; font-size: 12px; }
  @page { size: A4 portrait; margin: 0; }
  @media print { body { background: #fff; } .a4 { margin: 0; box-shadow: none; } }
</style></head><body>
<div class="a4">
  <h1>온실가스 감축 실적 명세서</h1>

  <h2>1. 기업 정보</h2>
  <table>
    <colgroup><col style="width:18%"><col style="width:32%"><col style="width:18%"><col style="width:32%"></colgroup>
    <tr><th>기업명</th><td class="l">${esc(c.name)}</td><th>대표자</th><td class="l">${esc(c.representative)}</td></tr>
    <tr><th>사업자등록번호</th><td class="l">${esc(c.bizNo)}</td><th>업종</th><td class="l">${esc(c.industry)}</td></tr>
    <tr><th>소재지</th><td class="l" colspan="3">${esc(c.address)}</td></tr>
  </table>

  <h2>2. 배출시설 정보</h2>
  <table>
    <colgroup><col style="width:18%"><col style="width:32%"><col style="width:18%"><col style="width:32%"></colgroup>
    <tr><th>배출시설명</th><td class="l">${esc(f.name)}</td><th>계약 유형</th><td class="l">${esc(f.kind)}</td></tr>
    <tr><th>설비 용량</th><td class="l">${n(f.kw, 2)} kW</td><th>가동일</th><td class="l">${esc(f.startDate)}</td></tr>
    <tr><th>발전원</th><td class="l" colspan="3">${esc(f.source)}</td></tr>
  </table>

  <h2>3. 감축 실적</h2>
  <table>
    <colgroup><col style="width:28%"><col style="width:18%"><col style="width:18%"><col style="width:18%"><col style="width:18%"></colgroup>
    <tr><th>기간</th><th>발전량 (kWh)</th><th>발전량 (MWh)</th><th>전력 배출계수<br>(tCO₂eq/MWh)</th><th>감축량 (tCO₂eq)</th></tr>
    <tr><td>${esc(p.range)}</td><td class="r">${n(f.kwh)}</td><td class="r">${n(f.kwh / 1000, 3)}</td><td class="r">${d.co2Factor}</td><td class="r b">${n(f.tco2, 3)}</td></tr>
  </table>

  <h2>4. 산정 방법</h2>
  <div class="basis">
    감축량 = 발전량 (MWh) × 전력 배출계수<br>
    = ${n(f.kwh / 1000, 3)} MWh × ${d.co2Factor} tCO₂eq/MWh = ${n(f.tco2, 3)} tCO₂eq<br>
    발전량: 통합관제에서 수집한 기간 내 발전 이력<br>
    전력 배출계수: ${esc(d.co2Source)}
  </div>

  <p class="sign">작성일 ${esc(d.writtenAt)}</p>
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

/** PDF — 인쇄 창을 연다(PDF로 저장) */
export function printGhgStatement(html: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 600);
}
