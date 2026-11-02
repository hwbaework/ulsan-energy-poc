import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';

/**
 * HWPX(한글 서식) 빈칸 채우기 — 서식 원본을 받아 표 칸에 글자를 넣고 다시 묶는다.
 * 칸은 몇 번째 표(table) · 열(col) · 행(row)으로 가리킨다(서식 파일 안 cellAddr).
 * 빈칸의 빈 run(<hp:run charPrIDRef="n"/>) 에 글자만 넣어 원래 글꼴 · 칸 모양을 그대로 쓴다.
 */
export interface HwpxCell {
  table: number;
  col: number;
  row: number;
  text: string;
}

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 표 안 글자 바꾸기 — 그 표에서 처음 나오는 글자(find)를 text 로(날짜 · 서명란 줄 · 'tCO' 앞 수량 등) */
export interface HwpxReplace {
  table: number;
  find: string;
  text: string;
}

/** section XML 의 표 칸 채우기 — 칸을 못 찾거나 이미 글자가 있으면 건너뛴다. replaces 는 표 안 글자 바꾸기 */
export function fillSectionXml(xml: string, cells: HwpxCell[], replaces: HwpxReplace[] = []): string {
  // 표마다 [시작, 끝] — 표 안에 표가 없는 서식 기준
  const tables: [number, number][] = [];
  const re = /<hp:tbl\b[\s\S]*?<\/hp:tbl>/g;
  for (let m = re.exec(xml); m; m = re.exec(xml)) tables.push([m.index, m.index + m[0].length]);
  // 뒤에서부터 바꿔야 앞 위치가 안 밀린다
  const edits: { start: number; end: number; text: string }[] = [];
  for (const c of cells) {
    const t = tables[c.table];
    if (!t || !c.text) continue;
    const tbl = xml.slice(t[0], t[1]);
    const cre = /<hp:tc\b[\s\S]*?<\/hp:tc>/g;
    for (let m = cre.exec(tbl); m; m = cre.exec(tbl)) {
      const tc = m[0];
      if (!tc.includes(`<hp:cellAddr colAddr="${c.col}" rowAddr="${c.row}"/>`)) continue;
      const run = /<hp:run charPrIDRef="(\d+)"\/>/.exec(tc);
      if (!run || /<hp:t>[^<]+<\/hp:t>/.test(tc)) break;
      const start = t[0] + m.index + run.index;
      edits.push({ start, end: start + run[0].length, text: `<hp:run charPrIDRef="${run[1]}"><hp:t>${esc(c.text)}</hp:t></hp:run>` });
      break;
    }
  }
  for (const r of replaces) {
    const t = tables[r.table];
    if (!t || !r.text) continue;
    const tag = `<hp:t>${esc(r.find)}</hp:t>`;
    const i = xml.slice(t[0], t[1]).indexOf(tag);
    if (i < 0) continue;
    const start = t[0] + i;
    edits.push({ start, end: start + tag.length, text: `<hp:t>${esc(r.text)}</hp:t>` });
  }
  let out = xml;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

/** 서식 파일(url)을 받아 칸을 채운 HWPX Blob */
export async function fillHwpx(url: string, cells: HwpxCell[], replaces: HwpxReplace[] = []): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`서식 파일을 받지 못했습니다 (${res.status})`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const files = unzipSync(buf);
  const name = 'Contents/section0.xml';
  if (!files[name]) throw new Error('서식 본문을 찾지 못했습니다');
  files[name] = strToU8(fillSectionXml(strFromU8(files[name]), cells, replaces));
  // mimetype 은 맨 앞 · 압축 없이(HWPX 규칙)
  const zipped: Zippable = {};
  if (files.mimetype) zipped.mimetype = [files.mimetype, { level: 0 }];
  for (const [k, v] of Object.entries(files)) if (k !== 'mimetype') zipped[k] = v;
  return new Blob([zipSync(zipped)], { type: 'application/hwp+zip' });
}
