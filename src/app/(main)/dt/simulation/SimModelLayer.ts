// 시뮬레이션 3D 레이어 — 한일튜브 GLB를 클릭 위치에 설치하고, 설치 순간 먼지 파티클을 터뜨린다.
// 먼지는 DustEffect.html의 방사형 확산 파티클(감쇠·상승·페이드)을 미터 스케일로 이식.
import mapboxgl from 'mapbox-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MODEL_URL = '/models/haniltube.glb';
const TARGET_SIZE_M = 115;
export const SIM_LAYER_ID = 'sim-ly-model';

// ── 먼지 파라미터 (DustEffect.html → 115m 건물 스케일로 환산) ──
const DUST_COUNT = 400;
const DUST_RING_M = 48; // 초기 링 반경
const DUST_SPEED = 0.9; // m/frame 수평 확산
const DUST_RISE = 0.22; // m/frame 상승
const DUST_SIZE_M = 22; // 파티클 크기(m)
const DUST_FADE = 0.006; // opacity 감쇠/frame

function smokeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(210,190,170,0.8)');
  grad.addColorStop(0.5, 'rgba(180,160,140,0.3)');
  grad.addColorStop(1, 'rgba(180,160,140,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function alignModel(model: THREE.Object3D) {
  model.position.set(0, 0, 0);
  const box = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  box.getCenter(center);
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
}

export class SimModelLayer implements mapboxgl.CustomLayerInterface {
  id = SIM_LAYER_ID;
  type = 'custom' as const;
  renderingMode = '3d' as const;

  private map: mapboxgl.Map | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private model: THREE.Object3D | null = null;
  private rotationDeg = -25;
  private baseMaxDim = 1; // 원본 최대변 (스케일 전)
  private targetSizeM = TARGET_SIZE_M;

  private lngLat: [number, number] | null = null;
  private origin: { x: number; y: number; z: number; unit: number } | null = null;
  private elev = 0;

  // 먼지
  private dustGeo = new THREE.BufferGeometry();
  private dustMat: THREE.PointsMaterial | null = null;
  private positions = new Float32Array(DUST_COUNT * 3);
  private velocities = new Float32Array(DUST_COUNT * 3);
  private dustActive = false;

  onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext) {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
    });
    this.renderer.autoClear = false;

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(40, 70, 80);
    this.scene.add(sun);

    new GLTFLoader().load(MODEL_URL, (gltf) => {
      const m = gltf.scene;
      const box = new THREE.Box3().setFromObject(m);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      this.baseMaxDim = maxDim;
      m.scale.setScalar(this.targetSizeM / maxDim);
      m.rotation.y = (this.rotationDeg * Math.PI) / 180;
      alignModel(m);
      m.visible = false; // 설치 전
      this.model = m;
      this.scene.add(m);
      this.map?.triggerRepaint();
    });

    this.dustMat = new THREE.PointsMaterial({
      size: DUST_SIZE_M,
      map: smokeTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.dustGeo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.scene.add(new THREE.Points(this.dustGeo, this.dustMat));
  }

  /** 클릭 위치에 설치 + 먼지 발생 */
  placeAt(lngLat: [number, number]) {
    this.lngLat = lngLat;
    this.elev = this.map?.queryTerrainElevation(lngLat) ?? 0;
    const mc = mapboxgl.MercatorCoordinate.fromLngLat(lngLat, this.elev);
    this.origin = { x: mc.x, y: mc.y, z: mc.z, unit: mc.meterInMercatorCoordinateUnits() };
    if (this.model) this.model.visible = true;
    this.spawnDust();
    this.map?.triggerRepaint();
  }

  /** 모델 목표 크기(m) 변경 — 스카우팅에서 추정용량 비례 축소용 */
  setTargetSize(sizeM: number) {
    this.targetSizeM = sizeM;
    if (this.model) {
      this.model.scale.setScalar(sizeM / this.baseMaxDim);
      alignModel(this.model);
      this.map?.triggerRepaint();
    }
  }

  setRotation(deg: number) {
    this.rotationDeg = deg;
    if (this.model) {
      this.model.rotation.y = (deg * Math.PI) / 180;
      alignModel(this.model);
      this.map?.triggerRepaint();
    }
  }

  clear() {
    this.lngLat = null;
    this.origin = null;
    if (this.model) this.model.visible = false;
    if (this.dustMat) this.dustMat.opacity = 0;
    this.dustActive = false;
    this.map?.triggerRepaint();
  }

  placed(): boolean {
    return this.origin != null;
  }

  private spawnDust() {
    if (!this.dustMat) return;
    this.dustMat.opacity = 0.85;
    for (let i = 0; i < DUST_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * DUST_RING_M;
      this.positions[i * 3] = Math.cos(angle) * dist;
      this.positions[i * 3 + 1] = Math.random() * 2;
      this.positions[i * 3 + 2] = Math.sin(angle) * dist;
      const speed = DUST_SPEED * (0.6 + Math.random() * 0.8);
      this.velocities[i * 3] = Math.cos(angle) * speed;
      this.velocities[i * 3 + 1] = DUST_RISE * (0.5 + Math.random());
      this.velocities[i * 3 + 2] = Math.sin(angle) * speed;
    }
    (this.dustGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.dustActive = true;
  }

  render(_gl: WebGLRenderingContext, matrix: number[]) {
    if (!this.renderer || !this.map || !this.origin || !this.lngLat) return;

    // 먼지 프레임 갱신 (확산 감쇠 · 상승 · 페이드) — DustEffect.html 동일 로직
    if (this.dustActive && this.dustMat) {
      for (let i = 0; i < DUST_COUNT; i++) {
        this.positions[i * 3] = this.positions[i * 3]! + this.velocities[i * 3]!;
        this.positions[i * 3 + 1] = this.positions[i * 3 + 1]! + this.velocities[i * 3 + 1]!;
        this.positions[i * 3 + 2] = this.positions[i * 3 + 2]! + this.velocities[i * 3 + 2]!;
        this.velocities[i * 3] = this.velocities[i * 3]! * 0.96;
        this.velocities[i * 3 + 1] = this.velocities[i * 3 + 1]! * 0.98;
        this.velocities[i * 3 + 2] = this.velocities[i * 3 + 2]! * 0.96;
      }
      (this.dustGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      this.dustMat.opacity = Math.max(0, this.dustMat.opacity - DUST_FADE);
      if (this.dustMat.opacity <= 0) this.dustActive = false;
    }

    // 지형 고도 추적 (DEM 늦은 로드 대응)
    const elev = this.map.queryTerrainElevation(this.lngLat) ?? 0;
    if (Math.abs(elev - this.elev) > 0.5) {
      this.elev = elev;
      const mc = mapboxgl.MercatorCoordinate.fromLngLat(this.lngLat, elev);
      this.origin = { x: mc.x, y: mc.y, z: mc.z, unit: mc.meterInMercatorCoordinateUnits() };
    }

    const { x, y, z, unit } = this.origin;
    const rotX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    const m = new THREE.Matrix4().fromArray(matrix);
    const l = new THREE.Matrix4()
      .makeTranslation(x, y, z)
      .scale(new THREE.Vector3(unit, -unit, unit))
      .multiply(rotX);
    (this.camera as THREE.Camera & { projectionMatrix: THREE.Matrix4 }).projectionMatrix =
      m.multiply(l);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);

    if (this.dustActive) this.map.triggerRepaint(); // 먼지 애니메이션 동안만 연속 렌더
  }

  onRemove() {
    this.model = null;
    this.renderer = null;
    this.map = null;
  }
}
