// 온실가스 감축 실적 명세서 — 한 달 × 계약 하나 = 한 장.
// 모양은 온실가스 목표관리 운영지침 명세서 '서식 8. 사업장 배출시설별 온실가스 감축실적'(한국환경공단 자료 39쪽) — 플랫폼에서 가져올 수 있는 칸만(2026-11-19 사용자).
//   1. 사업장 정보: 일련번호 · 사업장명 · 사업자등록번호 · 업종 정보(업태). 대표자 · 소재지는 같은 지침 사업장 목록(18쪽) 항목
//   2. 배출시설별 온실가스 감축실적: 배출시설 일련번호 · 배출시설명 · 시설용량(15쪽) / 감축실적(세부 감축조치 · 감축대상 · 감축량 산출근거) · 사업현황(가동일) · 감축효과(온실가스 감축효과) · 투자실적(투자비)
//   값이 없어 뺀 칸: 표준산업분류코드 · 코드[참고7] · 착공일 · 준공일 · 기술공정도. 근거 확인 전이라 뺀 칸: 부하율 · 에너지 절약효과(TJ) · 투자비 회수기간
// 정부 검증 제출용이 아닌 플랫폼 자체 문서(서식 8은 배출권거래제 할당대상업체용 — 목표관리 관리업체는 작성하지 않음). 한일튜브처럼 계약이 둘이면 각각 따로.

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
  /** 투자비(원) — 자가소비 계약 설치비. PPA 는 EPC 가 설치해 기업 투자 없음(0) */
  installCost: number;
  kwh: number;
  tco2: number;
  /** 참고 — 화석에너지 대체(TOE) · 소나무 식재(그루). 서식에 없는 환산값이라 문서 맨 아래 글자로만 */
  toe: number;
  pine: number;
}

export interface GhgFormData {
  /** 사업장 일련번호 — 그 기업의 사업장(설치 주소) 순서, 배출시설 일련번호 — 그 기업의 배출시설(계약번호) 순서. 해마다 같은 번호 */
  siteNo: number;
  facilityNo: number;
  /** 대상 달 YYYY-MM */
  month: string;
  company: GhgFormCompany;
  facility: GhgFormFacility;
  co2Factor: number;
  /** 전력 배출계수 출처 — 에너지 설정 */
  co2Source: string;
  /** 환산 계수 — 관리 › 에너지 설정 화석에너지 대체(TOE/MWh) · 소나무 식재(그루/tCO₂eq) */
  toeFactor: number;
  pineFactor: number;
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
  @font-face { font-family: 'DocFont'; src: url('/fonts/NotoSansKR-Regular.ttf') format('truetype'); }
  body { margin: 0; background: #e5e7eb; font-family: 'DocFont', 'Noto Sans KR', 'Malgun Gothic', sans-serif; color: #000; }
  .a4 { width: 210mm; min-height: 297mm; margin: 12px auto; padding: 18mm 16mm; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.15); }
  h1 { margin: 0 0 12mm; text-align: center; font-size: 22px; letter-spacing: 2px; }
  h2 { margin: 0 0 6px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11.5px; margin-bottom: 8mm; }
  th, td { border: 1px solid #000; padding: 7px 6px; text-align: center; vertical-align: middle; word-break: keep-all; overflow-wrap: anywhere; }
  th { font-weight: 700; }
  td.l { text-align: left; }
  td.r { text-align: right; font-variant-numeric: tabular-nums; }
  td.b { font-weight: 700; }
  .period { margin: -8mm 0 8mm; text-align: center; font-size: 12px; }
  .ref { margin: 0; font-size: 11px; line-height: 1.8; }
  .sign { margin-top: 14mm; text-align: right; font-size: 12px; }
  @page { size: A4 portrait; margin: 0; }
  @media print { body { background: #fff; } .a4 { margin: 0; box-shadow: none; } }
</style></head><body>
<div class="a4">
  <h1>온실가스 감축 실적 명세서</h1>
  <p class="period">대상 기간 ${esc(p.range)}</p>

  <h2>1. 사업장 정보</h2>
  <table>
    <colgroup><col style="width:18%"><col style="width:32%"><col style="width:18%"><col style="width:32%"></colgroup>
    <tr><th>일련번호</th><td class="l">${d.siteNo}</td><th>사업장명</th><td class="l">${esc(c.name)}</td></tr>
    <tr><th>사업자등록번호</th><td class="l">${esc(c.bizNo)}</td><th>대표자</th><td class="l">${esc(c.representative)}</td></tr>
    <tr><th>업태</th><td class="l">${esc(c.industry)}</td><th>소재지</th><td class="l">${esc(c.address)}</td></tr>
  </table>

  <h2>2. 배출시설별 온실가스 감축실적</h2>
  <table>
    <colgroup><col style="width:12%"><col style="width:20%"><col style="width:14%"><col style="width:22%"><col style="width:16%"><col style="width:16%"></colgroup>
    <tr><th rowspan="2">배출시설<br>일련번호</th><th rowspan="2">배출시설명</th><th rowspan="2">시설용량<br>(kW)</th><th colspan="2">감축실적</th><th>사업현황</th></tr>
    <tr><th>세부 감축조치</th><th>감축대상</th><th>가동일</th></tr>
    <tr><td>${d.facilityNo}</td><td>${esc(f.name)}</td><td class="r">${n(f.kw, 2)}</td><td>태양광 발전설비 설치 (${esc(f.kind)})</td><td>간접배출 (전력)</td><td>${esc(f.startDate)}</td></tr>
  </table>
  <table>
    <colgroup><col style="width:56%"><col style="width:22%"><col style="width:22%"></colgroup>
    <tr><th>감축실적</th><th>감축효과</th><th>투자실적</th></tr>
    <tr><th>온실가스 감축량 산출근거</th><th>온실가스 감축효과<br>(tCO₂eq)</th><th>투자비<br>(백만원)</th></tr>
    <tr><td class="l">발전량 ${n(f.kwh / 1000, 3)} MWh × 전력 배출계수 ${d.co2Factor} tCO₂eq/MWh</td><td class="r b">${n(f.tco2, 3)}</td><td class="r">${f.installCost > 0 ? n(f.installCost / 1_000_000, 1) : '-'}</td></tr>
  </table>

  <p class="ref">화석에너지 대체 = 발전량 ${n(f.kwh / 1000, 3)} MWh × ${d.toeFactor} TOE/MWh = ${n(f.toe, 3)} TOE</p>
  <p class="ref">소나무 식재 = 감축량 ${n(f.tco2, 3)} tCO₂eq × ${d.pineFactor} 그루/tCO₂eq = ${n(f.pine)} 그루</p>
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

/** PDF — 미리보기와 같은 문서로 인쇄 창을 연다(PDF로 저장). 명세서 · 보고서 · 청구서 공용 */
export function printGhgStatement(html: string) {
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  f.srcdoc = html;
  f.onload = () => {
    const w = f.contentWindow;
    if (!w) return;
    const go = () =>
      setTimeout(() => {
        w.addEventListener('afterprint', () => f.remove());
        w.focus();
        w.print();
      }, 100);
    if (w.document.fonts?.ready) void w.document.fonts.ready.then(go);
    else setTimeout(go, 600);
  };
  document.body.appendChild(f);
}
