// DT 3D 모델(GLB) 레지스트리 — 모니터링 렌즈 L2~L3에서 맵 위에 실모델을 얹는다.
// 앵커 좌표는 consumer-sites의 실좌표(한일튜브 본사공장 = 온산산단 D-7블록) 기준.

export interface DtModel {
  id: string;
  name: string;
  /** public/models/ 아래 GLB 파일 (lazy load — monitor 렌즈 활성 시에만 fetch) */
  file: string;
  lngLat: [number, number];
  /** 모델 회전 (라디안, 시계방향) — 건물 방위 맞춤용 */
  rotateDeg?: number;
  /** 최대 변 목표 크기(m) — 바운딩박스 자동 정규화 (TerraWatt targetSizeM 방식) */
  targetSizeM?: number;
  /** 크기 배율 (targetSizeM 없을 때, GLB 단위=미터 가정) */
  scale?: number;
  altitude?: number;
  /** info 패널 표시 속성 (선택 시 즉시 렌더, fetch 0) */
  props: Record<string, string | number>;
  /** monitoring 도메인 연동 — 수용가 모니터링 데이터 매칭 키 */
  monitoring?: { matchName: string; siteId?: number };
}

export const DT_MODELS: DtModel[] = [
  {
    id: 'haniltube',
    name: '한일튜브 울산공장',
    file: '/models/haniltube.glb',
    // 울산 남구 부곡동 273-6 — TerraWatt(terrawatt-main facilities.ts) 확정 배치와 동일 값.
    lngLat: [129.33079, 35.50515],
    rotateDeg: -25,
    targetSizeM: 115,
    props: {
      유형: '수용가 공장 (지붕태양광)',
      주소: '울산광역시 남구 사평로 203 (부곡동)',
      계약전력: '1,200 kW',
      공급방식: '직접 PPA (발전량 × 단가)',
      PPA단가: '₩92.6/kWh (2026.4~)',
      'RE 비율': '18.7%',
      상태: '가동 중',
    },
    monitoring: { matchName: '한일튜브', siteId: 19 },
  },
];

/** 모델 앵커(클릭 선택용 포인트) GeoJSON — 3D 모델 자체는 ModelLayer가 렌더 */
export const modelAnchorsGeo: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: DT_MODELS.map((m) => ({
    type: 'Feature',
    properties: { assetId: `dt:model:${m.id}`, modelId: m.id, name: m.name, ...m.props },
    geometry: { type: 'Point', coordinates: m.lngLat },
  })),
};
