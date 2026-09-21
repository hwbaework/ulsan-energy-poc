export interface LaseePlantInfo {
  laseeId: number;
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * 계약 건물·발전자산 — 근거: DT정리v0.84_내용정리(260916) "2. 건물" 시트
 * 좌표: 태양광 5개소는 기존 관제 좌표, 연료전지·ORC 는 주소(상개동 427-5 / 사평로 119) 지오코딩 근사값 — 정확 좌표 확인 필요
 */
export const LASEE_PLANTS: LaseePlantInfo[] = [
  { laseeId: 17511, name: '용인금속', latitude: 35.515211, longitude: 129.347216 }, // 남구 여천동 887-18 · 152.32kW
  { laseeId: 17512, name: '태성산업', latitude: 35.5135, longitude: 129.3458 }, // 남구 여천동 358-8 · 46.08kW
  { laseeId: 17513, name: '건호이엔씨', latitude: 35.505049, longitude: 129.330609 }, // 남구 부곡동 22-5 · 33.92kW
  { laseeId: 17514, name: '한일튜브', latitude: 35.5062, longitude: 129.3321 }, // 남구 부곡동 273-6 · 429.44kW
  { laseeId: 17515, name: '한길', latitude: 35.475747, longitude: 129.360551 }, // 남구 용연동 490-11 · 90.88kW
  { laseeId: 17601, name: '연료전지', latitude: 35.50376, longitude: 129.31617 }, // 남구 상개동 427-5 (근사)
  { laseeId: 17602, name: 'ORC', latitude: 35.502657, longitude: 129.329262 }, // 남구 사평로 119 (근사)
];

export const LASEE_PLANT_MAP: Record<number, LaseePlantInfo> = Object.fromEntries(
  LASEE_PLANTS.map((p) => [p.laseeId, p]),
);

export function isLaseePlant(plantId: number): boolean {
  return plantId in LASEE_PLANT_MAP;
}

export function getLaseeCoords(laseeId: number): { latitude: number; longitude: number } | null {
  const info = LASEE_PLANT_MAP[laseeId];
  return info ? { latitude: info.latitude, longitude: info.longitude } : null;
}
