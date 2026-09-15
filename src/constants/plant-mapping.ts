export interface LaseePlantInfo {
  laseeId: number;
  name: string;
  latitude: number;
  longitude: number;
}

export const LASEE_PLANTS: LaseePlantInfo[] = [
  { laseeId: 17511, name: '울산 용인금속1', latitude: 35.515211, longitude: 129.347216 },
  { laseeId: 17512, name: '울산 태성산업', latitude: 35.5135, longitude: 129.3458 },
  { laseeId: 17513, name: '울산 건호이엔씨', latitude: 35.505049, longitude: 129.330609 },
  { laseeId: 17514, name: '울산 한일튜브', latitude: 35.5062, longitude: 129.3321 },
  { laseeId: 17515, name: '울산 한길', latitude: 35.475747, longitude: 129.360551 },
  { laseeId: 17558, name: '울산 용인금속2', latitude: 35.5168, longitude: 129.3492 },
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
