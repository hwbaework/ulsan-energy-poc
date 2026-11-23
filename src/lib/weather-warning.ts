/**
 * 기상특보(실시간) — 울산동부 · 울산서부에 지금 발효 중인 태풍 · 호우 "경보"(강풍 · 대설은 알리지 않는다, 2026-11-23 사용자).
 * 기상청 API허브 특보현황 조회(wrn_now_data.php)를 로컬 서버(npm run toss 의 /weather/warnings) 또는 배포 워커(/api/weather/warnings)로 받는다.
 * 키가 없거나 서버가 꺼져 있으면 빈 목록 — 특보 알림을 만들지 않는다(없는 건 없는 대로, 2026-11-23 사용자). 샘플 문구를 지어내지 않는다.
 * 2026-11-23 실제 응답으로 확인한 값: WRN = 강풍 · 호우 · 태풍 · 대설 …, LVL = 예비 · 주의 · 경보.
 */
import { TOSS_SERVER_URL } from '@/lib/toss-billing';

export interface WeatherWarningRow {
  regId: string;
  regName: string;
  /** 특보 종류 — 강풍 · 호우 · 태풍 · 대설 … */
  wrn: string;
  /** 특보 수준 — 예비 · 주의 · 경보 */
  lvl: string;
  cmd: string;
  /** 발표 · 발효 시각 — YYYYMMDDHHmm(KST) */
  tmFc: string;
  tmEf: string;
  edTm: string;
}

/** 알림을 보내는 특보 — 태풍 · 호우 둘(2026-11-23 사용자). 기상청 응답의 다른 종류(강풍 · 대설 · 건조 …)는 버린다 */
const KEY_OF: Record<string, string> = { 태풍: 'TYPHOON_WARNING', 호우: 'HEAVY_RAIN_WARNING' };

const REFRESH_MS = 5 * 60_000;
let rows: WeatherWarningRow[] = [];
let loadedAt = 0;
let inflight: Promise<void> | null = null;

async function load(): Promise<WeatherWarningRow[]> {
  const read = async (r: Response) => (r.ok ? (((await r.json()) as { warnings?: WeatherWarningRow[] }).warnings ?? []) : null);
  // 로컬 서버가 있으면 그쪽, 없거나 실패하면 배포 워커
  if (TOSS_SERVER_URL) {
    try {
      const got = await read(await fetch(`${TOSS_SERVER_URL}/weather/warnings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }));
      if (got) return got;
    } catch {
      /* 서버 꺼짐 — 아래로 */
    }
  }
  try {
    const got = await read(await fetch('/api/weather/warnings'));
    if (got) return got;
  } catch {
    /* 연결 안 됨 */
  }
  return [];
}

/** 5분에 한 번 다시 받는다 — 부르는 쪽은 기다리지 않고 지금 가진 값을 쓴다 */
export function refreshWeatherWarnings(): void {
  if (typeof window === 'undefined' || inflight || Date.now() - loadedAt < REFRESH_MS) return;
  inflight = load()
    .then((got) => {
      rows = got;
    })
    .finally(() => {
      loadedAt = Date.now();
      inflight = null;
    });
}

/** 받은 줄에서 알릴 경보만 — 종류마다 한 줄(구역은 모아서). 주의보 · 예비특보는 알리지 않는다 */
export function pickWarnings(list: WeatherWarningRow[]): { type: string; wrn: string; zones: string[]; since: string }[] {
  const out: { type: string; wrn: string; zones: string[]; since: string }[] = [];
  for (const r of list) {
    const type = KEY_OF[r.wrn];
    if (!type || r.lvl !== '경보') continue;
    // 발효 시각 YYYYMMDDHHmm → YYYY-MM-DDTHH:mm:00
    const since = r.tmEf.length >= 12 ? `${r.tmEf.slice(0, 4)}-${r.tmEf.slice(4, 6)}-${r.tmEf.slice(6, 8)}T${r.tmEf.slice(8, 10)}:${r.tmEf.slice(10, 12)}:00` : '';
    const cur = out.find((x) => x.type === type);
    if (cur) {
      if (!cur.zones.includes(r.regName)) cur.zones.push(r.regName);
      if (since && since < cur.since) cur.since = since;
    } else out.push({ type, wrn: r.wrn, zones: [r.regName], since });
  }
  return out;
}

/** 지금 울산에 발효 중인 경보 */
export function activeWeatherWarnings() {
  refreshWeatherWarnings();
  return pickWarnings(rows);
}
