/**
 * 일출·일몰 계산 (NOAA 태양 위치 근사식) — 외부 API 없이 위도·경도·날짜만으로 산출.
 * 정확도 ±2분 내외. 한국 표준시(UTC+9) 기준 HH시 MM분 문자열을 돌려준다.
 */
const RAD = Math.PI / 180;

function toJulianDay(date: Date): number {
  return date.getTime() / 86_400_000 - 0.5 + 2_440_587.5;
}

function sunEventUtcMinutes(date: Date, lat: number, lng: number, sunrise: boolean): number | null {
  const jd = toJulianDay(date);
  const lw = -lng; // NOAA 식은 서경(+) 기준
  const n = Math.round(jd - 2_451_545 - 0.0009 - lw / 360);
  const jStar = 2_451_545 + 0.0009 + lw / 360 + n;
  const m = ((357.5291 + 0.98560028 * (jStar - 2_451_545)) % 360) * RAD;
  const c = 1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m);
  const lambda = ((m / RAD + 102.9372 + c + 180) % 360) * RAD;
  const jTransit = jStar + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * lambda);
  const delta = Math.asin(Math.sin(lambda) * Math.sin(23.44 * RAD));
  const cosH =
    (Math.sin(-0.83 * RAD) - Math.sin(lat * RAD) * Math.sin(delta)) / (Math.cos(lat * RAD) * Math.cos(delta));
  if (cosH < -1 || cosH > 1) return null; // 백야·극야
  const h = Math.acos(cosH) / RAD;
  const jEvent = jTransit + (sunrise ? -h : h) / 360;
  const minutesUtc = ((jEvent - 2_440_587.5) * 1440) % 1440;
  return (minutesUtc + 1440) % 1440;
}

function fmtKst(minutesUtc: number | null): string {
  if (minutesUtc == null) return '—';
  const kst = (minutesUtc + 9 * 60) % 1440;
  const hh = Math.floor(kst / 60);
  const mm = Math.round(kst % 60);
  return `${String(hh).padStart(2, '0')}시 ${String(mm).padStart(2, '0')}분`;
}

export function getSunTimes(date: Date, lat: number, lng: number): { sunrise: string; sunset: string } {
  return {
    sunrise: fmtKst(sunEventUtcMinutes(date, lat, lng, true)),
    sunset: fmtKst(sunEventUtcMinutes(date, lat, lng, false)),
  };
}

const WIND_DIRS = ['북', '북북동', '북동', '동북동', '동', '동남동', '남동', '남남동', '남', '남남서', '남서', '서남서', '서', '서북서', '북서', '북북서'];

/** 풍향(도) → 16방위 한글 */
export function windDirectionLabel(deg: number): string {
  const idx = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
  return WIND_DIRS[idx] ?? '—';
}
