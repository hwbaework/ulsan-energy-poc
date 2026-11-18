/**
 * 데모 서명 — 사람마다 펜으로 그은 것 같은 사인 그림(SVG). 또박또박한 글자가 아니라 실제 사인처럼(2026-11-18 사용자).
 * 크게 쓴 첫 획 → 오른쪽으로 기울어 흘려 쓴 본문(가끔 위로 솟는 고리 · 아래로 처지는 획) → 이름 밑으로 되돌아가는 밑줄.
 * 이름으로 모양을 정해서 같은 사람은 어느 계약이든 같은 사인. 한 장에 1KB 남짓이라 저장 부담은 거의 없다.
 */

/** 이름에서 나오는 고정 난수 — 같은 이름이면 같은 순서 */
function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const f = (n: number) => n.toFixed(1);

export function signatureImage(name: string): string {
  const r = rng(name);
  const base = 60 + r() * 6; // 글줄
  // 1. 첫 획 — 크게 솟았다가 고리를 그리며 내려온다
  const x0 = 26 + r() * 8;
  const top = 14 + r() * 10;
  let x = x0 + 22 + r() * 8;
  let y = base - 4;
  const w = 14 + r() * 34; // 첫 획 폭
  let d = `M${f(x0)} ${f(base + 4 + r() * 8)} C${f(x0 + r() * 16)} ${f(top)} ${f(x0 + w)} ${f(top - 6 + r() * 10)} ${f(x0 + w * (0.4 + r() * 0.5))} ${f(base - 10 - r() * 16)}`;
  d += ` C${f(x0 + r() * 14)} ${f(base + r() * 10)} ${f(x0 - 4 + r() * 10)} ${f(base + 10 + r() * 8)} ${f(x)} ${f(y)}`;
  // 2. 본문 — 작게 출렁이며 오른쪽으로, 오른쪽으로 기운 획
  const steps = 9 + (name.length % 3) * 2;
  for (let i = 0; i < steps; i++) {
    const kind = r();
    const dx = 9 + r() * 7;
    let ny: number;
    if (kind < 0.18) ny = base - 30 - r() * 10; // 위로 솟는 고리
    else if (kind < 0.3) ny = base + 10 + r() * 8; // 아래로 처지는 획
    else ny = base - 6 - r() * 12; // 보통 높이
    const nx = x + dx;
    // 위로 갈 때는 오른쪽으로 기울게, 내려올 때는 살짝 되감기
    const c1 = `${f(x + dx * 0.2)} ${f(y - (y - ny) * 0.9)}`;
    const c2 = `${f(nx - dx * (ny < y ? -0.3 : 0.8))} ${f(ny + (ny < y ? 6 : -4))}`;
    d += ` C${c1} ${c2} ${f(nx)} ${f(ny)}`;
    // 다시 글줄로
    const bx = nx + 4 + r() * 4;
    d += ` C${f(nx + 2)} ${f(ny + 10)} ${f(bx - 4)} ${f(base + 2)} ${f(bx)} ${f(base - 2 + r() * 4)}`;
    x = bx;
    y = base;
  }
  // 3. 끝 — 아래로 내려가 이름 밑으로 되돌아오는 밑줄
  const end = Math.min(x + 18 + r() * 14, 290);
  const under = base + 18 + r() * 8;
  if (r() < 0.6) {
    d += ` C${f(x + 10)} ${f(base + 6)} ${f(end)} ${f(under - 4)} ${f(end - 10)} ${f(under + 2)}`;
    d += ` C${f(end - 60)} ${f(under + 8)} ${f(x0 + 40)} ${f(under - 2)} ${f(x0 + 6 + r() * 30)} ${f(under - 8 - r() * 6)}`;
  } else {
    d += ` C${f(x + 8)} ${f(base + 14)} ${f(end - 6)} ${f(base + 10)} ${f(end)} ${f(top + 10 + r() * 14)}`;
  }
  // 덧붙인 점 하나
  const dot = `M${f(x0 + 60 + r() * 80)} ${f(top + 8 + r() * 10)} l0.5 0.5`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100">` +
    `<g fill="none" stroke="#f1f5f9" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${d}"/><path d="${dot}" stroke-width="3"/></g></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
