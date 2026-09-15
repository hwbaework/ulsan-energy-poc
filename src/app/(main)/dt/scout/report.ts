// 분석보고서 — 리드/시뮬 입력 + 수익 결과를 A4 HTML로 조판해 새 창에서 인쇄(PDF 저장).
// 별도 라이브러리 없이 브라우저 print API 사용. 프린트 대화상자에서 "PDF로 저장" 선택.
// 스카우팅(리드 전체)·수익 시뮬(리드 없음) 양쪽에서 재사용 — 없는 필드는 섹션을 생략한다.
import type { SimResult } from '../simulation/simEngine';
import { won } from '../simulation/simEngine';

export interface ReportInput {
  name: string;
  complex?: string;
  address?: string;
  roofM2?: number;
  estKw: number;
  irr: number;
  subDistM?: number;
  score?: number;
  rank?: number;
  grade?: string;
  sRoof?: number;
  sIrr?: number;
  sGrid?: number;
  sDemand?: number;
  smp?: number;
  recPrice?: number;
  recWeight?: number;
}

const MONTHS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const num = (v: number, d = 0) => v.toLocaleString('ko-KR', { maximumFractionDigits: d });

export function openAnalysisReport(lead: ReportInput, result: SimResult): void {
  const PARAMS = {
    smp: lead.smp ?? 114.96,
    recPrice: lead.recPrice ?? 71945,
    recWeight: lead.recWeight ?? 1.5,
  };
  const today = new Date();
  const dateStr = `${today.getFullYear()}. ${today.getMonth() + 1}. ${today.getDate()}.`;
  const maxM = Math.max(...result.monthlyKwh);

  const monthBars = result.monthlyKwh
    .map((v, i) => {
      const h = Math.max(4, (v / maxM) * 90);
      return `<div class="mb-col"><div class="mb-bar" style="height:${h}px" title="${num(v)} kWh"></div><span>${MONTHS[i]}</span></div>`;
    })
    .join('');

  const yearRows = result.rows
    .map(
      (r) =>
        `<tr><td>${r.year}</td><td>${num(r.genMwh, 0)}</td><td>${won(r.revenue)}</td><td>${won(r.accumulated)}</td></tr>`,
    )
    .join('');

  const scoreRow = (label: string, v: number, max: number) =>
    `<div class="sc-row"><span>${label}</span><div class="sc-bar"><div class="sc-fill" style="width:${(v / max) * 100}%"></div></div><b>${v.toFixed(1)}</b></div>`;

  const hasScore = lead.score != null && lead.sRoof != null;
  const metaHtml =
    lead.rank != null && lead.grade
      ? `작성일 ${dateStr}<br>대상 순위 전체 ${lead.rank}위 · <span class="grade ${lead.grade}">${lead.grade}급</span>`
      : `작성일 ${dateStr}<br>수익 시뮬레이션 분석`;
  const overviewRows = [
    `<tr><td class="k">대상 건물</td><td class="v">${lead.name}</td></tr>`,
    lead.complex ? `<tr><td class="k">산업단지</td><td class="v">${lead.complex}</td></tr>` : '',
    lead.address ? `<tr><td class="k">주소</td><td class="v">${lead.address}</td></tr>` : '',
    hasScore
      ? `<tr><td class="k">종합 점수</td><td class="v">${lead.score!.toFixed(1)}점 (전체 ${lead.rank}위, ${lead.grade}급)</td></tr>`
      : '',
  ].join('');
  const installRows = [
    lead.roofM2 != null
      ? `<tr><td class="k">지붕면적</td><td class="v">${num(lead.roofM2)} ㎡</td></tr>`
      : '',
    `<tr><td class="k">추정 설치용량</td><td class="v">${num(lead.estKw)} kW</td></tr>`,
    `<tr><td class="k">일사량</td><td class="v">${lead.irr.toFixed(2)} kWh/㎡·일 (NASA)</td></tr>`,
    lead.subDistM != null
      ? `<tr><td class="k">최근접 변전소</td><td class="v">${num(lead.subDistM)} m</td></tr>`
      : '',
  ].join('');
  const scoreSection = hasScore
    ? `<div><h2>3. 점수 구성</h2>
        ${scoreRow('지붕 규모', lead.sRoof!, 35)}
        ${scoreRow('일사량', lead.sIrr!, 20)}
        ${scoreRow('계통 근접', lead.sGrid!, 20)}
        ${scoreRow('추정 수요', lead.sDemand!, 25)}</div>`
    : '';

  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<title>${lead.name} 지붕태양광 분석보고서</title>
<style>
  /* 흑백 정식 문서 톤 — 회색조·얇은 괘선. 가독성 우선(2페이지 허용) */
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Pretendard','Malgun Gothic',sans-serif; color: #111; margin: 0; font-size: 13px; line-height: 1.55; }
  .head { border-bottom: 2.5px solid #111; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end; }
  .head h1 { color: #111; font-size: 23px; font-weight: 800; margin: 0 0 5px; letter-spacing: -0.3px; }
  .head .sub { color: #555; font-size: 13px; }
  .head .meta { text-align: right; color: #555; font-size: 12px; line-height: 1.7; }
  h2 { font-size: 15px; font-weight: 700; color: #111; border-bottom: 1.5px solid #888; padding-bottom: 5px; margin: 22px 0 11px; }
  .kpi { display: flex; gap: 8px; margin-bottom: 12px; }
  .kpi .box { flex: 1; border: 1px solid #bbb; padding: 11px 8px; text-align: center; }
  .kpi .box.hl { border: 2px solid #111; }
  .kpi .box .lbl { font-size: 12px; color: #666; }
  .kpi .box .val { font-size: 20px; font-weight: 800; color: #111; margin-top: 4px; }
  table.info { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  table.info td { padding: 8px 10px; border-bottom: 1px solid #e2e2e2; font-size: 13px; }
  table.info td.k { color: #666; width: 36%; }
  table.info td.v { font-weight: 600; color: #111; }
  .grade { display: inline-block; padding: 1px 7px; border: 1px solid #111; font-weight: 700; font-size: 13px; }
  .sc-row { display: flex; align-items: center; gap: 9px; font-size: 12.5px; color: #555; margin: 7px 0; }
  .sc-row span { width: 74px; } .sc-row b { width: 36px; text-align: right; color: #111; }
  .sc-bar { flex: 1; height: 9px; background: #e8e8e8; overflow: hidden; }
  .sc-fill { height: 100%; background: #555; }
  .mb { display: flex; align-items: flex-end; gap: 5px; height: 90px; padding: 6px 0; border-bottom: 1px solid #ccc; }
  .mb-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 3px; }
  .mb-bar { width: 62%; background: #888; }
  .mb-col span { font-size: 11px; color: #999; }
  table.years { width: 100%; border-collapse: collapse; font-size: 12px; text-align: center; margin-top: 8px; }
  table.years th { background: #f2f2f2; padding: 6px 4px; border: 1px solid #ccc; font-weight: 600; color: #222; }
  table.years td { padding: 5px 4px; border: 1px solid #e2e2e2; color: #333; }
  .env { display: flex; gap: 8px; text-align: center; margin-top: 8px; }
  .env .e { flex: 1; border: 1px solid #bbb; padding: 11px; }
  .env .e .v { font-size: 19px; font-weight: 800; color: #111; }
  .env .e .l { font-size: 12px; color: #666; margin-top: 2px; }
  .foot { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 11px; color: #888; line-height: 1.7; }
  .cols { display: flex; gap: 20px; }
  .cols > div { flex: 1; }
  @media screen { body { background: #e9e9ec; } .page { background: #fff; max-width: 800px; margin: 24px auto; padding: 44px 48px; box-shadow: 0 1px 8px rgba(0,0,0,.15); } .noprint { position: fixed; top: 16px; right: 16px; } }
  @media print { .noprint { display: none; } .page { padding: 0; } }
  .noprint button { background: #111; color: #fff; border: 0; padding: 11px 18px; border-radius: 4px; font-size: 14px; font-weight: 600; cursor: pointer; }
</style></head>
<body>
<div class="noprint"><button onclick="window.print()">🖨 PDF로 저장 / 인쇄</button></div>
<div class="page">
  <div class="head">
    <div><h1>지붕형 태양광 입지 분석보고서</h1><div class="sub">${lead.complex ?? '수익 시뮬레이션'} · RMS 에너지 플랫폼</div></div>
    <div class="meta">${metaHtml}</div>
  </div>

  <h2>1. 대상지 개요</h2>
  <table class="info">${overviewRows}</table>

  <div class="cols">
    <div>
      <h2>2. 설치 조건</h2>
      <table class="info">${installRows}</table>
    </div>
    ${scoreSection}
  </div>

  <h2>4. 1차년도 예상 수익</h2>
  <div class="kpi">
    <div class="box"><div class="lbl">연 발전량</div><div class="val">${num(result.annualKwh / 1000, 1)} MWh</div></div>
    <div class="box"><div class="lbl">SMP 매출</div><div class="val">${won(result.smpRevenue)}</div></div>
    <div class="box"><div class="lbl">REC 매출</div><div class="val">${won(result.recRevenue)}</div></div>
    <div class="box hl"><div class="lbl">연 수익 합계</div><div class="val">${won(result.year1Total)}</div></div>
  </div>

  <h2>5. 월별 예상 발전량 (kWh)</h2>
  <div class="mb">${monthBars}</div>

  <h2>6. 20년 운영 분석 (연 0.5% 열화)</h2>
  <div class="kpi">
    <div class="box"><div class="lbl">20년 총 발전량</div><div class="val">${num(result.totalGenKwh / 1000)} MWh</div></div>
    <div class="box hl"><div class="lbl">20년 총 수익</div><div class="val">${won(result.totalRevenue)}</div></div>
  </div>
  <table class="years">
    <thead><tr><th>년차</th><th>발전량(MWh)</th><th>수익</th><th>누적 수익</th></tr></thead>
    <tbody>${yearRows}</tbody>
  </table>

  <h2>7. 환경 기여 (20년 누적)</h2>
  <div class="env">
    <div class="e"><div class="v">${num(result.env.toe, 1)}</div><div class="l">화석에너지 대체 (TOE)</div></div>
    <div class="e"><div class="v">${num(result.env.tco2, 1)}</div><div class="l">온실가스 저감 (tCO₂)</div></div>
    <div class="e"><div class="v">${num(result.env.trees)}</div><div class="l">소나무 식재 효과 (그루)</div></div>
  </div>

  <div class="foot">
    · 산정 기준: 시스템효율 75%, SMP ${PARAMS.smp}원/kWh, REC ${num(PARAMS.recPrice)}원 × 가중치 ${PARAMS.recWeight}(지붕형), 월별 계절계수 적용.<br>
    · 환경 산식: TOE = MWh×0.229, tCO₂ = TOE×2.37, 식재 = tCO₂×151.5.<br>
    · 데이터 출처: 지붕면적·계통 OSM 실측, 일사량 NASA POWER 위성 기후값, 전력사용량은 면적 기반 추정치.<br>
    · 본 보고서는 입지 스카우팅용 개략 분석이며, 실제 사업성은 구조안전·인허가·계통접속 검토 후 확정됩니다.
  </div>
</div>
<script>window.onload = function(){ /* 필요 시 자동 인쇄: setTimeout(function(){window.print();}, 400); */ };</script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
