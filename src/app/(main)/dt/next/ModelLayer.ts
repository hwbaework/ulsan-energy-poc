// mapbox CustomLayer + three.js — GLB 실모델을 지도 좌표에 앉힌다.
// TerraWatt(terrawatt-main buildingLayer.ts)와 동일 방식:
//  · 바운딩박스 측정 → targetSizeM으로 자동 정규화 (모델 단위 제각각 대응)
//  · alignModel — 수평 중심 정렬 + 바닥을 지면에 (GLB 원점 치우침 보정)
//  · 회전은 model.rotation.y, 매트릭스는 translate + 단위환산 + rotX(Y-up→Z-up)만
//  · 줌 < 15에서는 렌더 스킵 (광역 뷰 성능)
// + 3D 지형(terrain) 고도 보정은 우리 확장 (DEM 로드 후 지표면 안착).
import mapboxgl from 'mapbox-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DT_MODELS, type DtModel } from './models';

export const MODEL_LAYER_ID = 'next-ly-3d-models';
const MIN_RENDER_ZOOM = 15;

interface Placed {
  model: DtModel;
  scene: THREE.Scene;
  camera: THREE.Camera;
  origin: { x: number; y: number; z: number; unit: number };
  elev: number;
}

function originOf(m: DtModel, terrainElev: number) {
  const mc = mapboxgl.MercatorCoordinate.fromLngLat(m.lngLat, (m.altitude ?? 0) + terrainElev);
  return { x: mc.x, y: mc.y, z: mc.z, unit: mc.meterInMercatorCoordinateUnits() };
}

// 바닥이 지면에 오도록 + 수평 중심 정렬 (TerraWatt alignModel 동일)
function alignModel(model: THREE.Object3D) {
  model.position.set(0, 0, 0);
  const box = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  box.getCenter(center);
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
}

class GlbModelsLayer implements mapboxgl.CustomLayerInterface {
  id = MODEL_LAYER_ID;
  type = 'custom' as const;
  renderingMode = '3d' as const;

  private map: mapboxgl.Map | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private placed: Placed[] = [];
  private loaded = false;

  onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext) {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
    });
    this.renderer.autoClear = false;
    this.loadModels();
  }

  private loadModels() {
    if (this.loaded) return;
    this.loaded = true;
    const loader = new GLTFLoader();
    for (const m of DT_MODELS) {
      const scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0xffffff, 1.2));
      const sun = new THREE.DirectionalLight(0xffffff, 1.5);
      sun.position.set(40, 70, 80);
      scene.add(sun);
      loader.load(
        m.file,
        (gltf) => {
          const model = gltf.scene;
          // 1) 바운딩박스 → targetSizeM 정규화 (없으면 scale 배율)
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          if (m.targetSizeM) model.scale.setScalar(m.targetSizeM / maxDim);
          else if (m.scale) model.scale.setScalar(m.scale);
          // 2) 회전 (정면 방향 보정)
          if (m.rotateDeg) model.rotation.y = (m.rotateDeg * Math.PI) / 180;
          // 3) 수평 중심 + 바닥 정렬 (스케일·회전 반영 후 재측정)
          alignModel(model);
          scene.add(model);
          this.map?.triggerRepaint();
        },
        undefined,
        () => {
          /* 모델 없음/실패 시 조용히 스킵 */
        },
      );
      this.placed.push({
        model: m,
        scene,
        camera: new THREE.Camera(),
        origin: originOf(m, 0),
        elev: 0,
      });
    }
  }

  render(_gl: WebGLRenderingContext, matrix: number[]) {
    if (!this.renderer || !this.map) return;
    if (this.map.getZoom() < MIN_RENDER_ZOOM) return; // 광역 뷰에서는 안 그림
    const rotX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    for (const p of this.placed) {
      // 3D 지형 위 안착 — DEM 로드 후 지표 고도가 잡히면 원점을 지표면으로 (지형 밑 매몰 방지)
      const elev = this.map.queryTerrainElevation(p.model.lngLat) ?? 0;
      if (Math.abs(elev - p.elev) > 0.5) {
        p.elev = elev;
        p.origin = originOf(p.model, elev);
      }
      const { x, y, z, unit } = p.origin;
      const m = new THREE.Matrix4().fromArray(matrix);
      const l = new THREE.Matrix4()
        .makeTranslation(x, y, z)
        .scale(new THREE.Vector3(unit, -unit, unit))
        .multiply(rotX);
      (p.camera as THREE.Camera & { projectionMatrix: THREE.Matrix4 }).projectionMatrix =
        m.multiply(l);
      this.renderer.resetState();
      this.renderer.render(p.scene, p.camera);
    }
    this.map.triggerRepaint();
  }

  onRemove() {
    this.placed = [];
    this.renderer = null;
    this.map = null;
  }
}

/** L2~L3에서만 커스텀 레이어 부착 (GLB lazy load 트리거) */
export function syncModelLayer(map: mapboxgl.Map, visible: boolean) {
  const has = !!map.getLayer(MODEL_LAYER_ID);
  if (visible && !has) map.addLayer(new GlbModelsLayer());
  if (!visible && has) map.removeLayer(MODEL_LAYER_ID);
}
